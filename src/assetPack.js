/**
 * Game pack — only prologue images block startup; everything else streams or loads in background.
 */

const CACHE_NAME = 'halleys-big-catch-media-v8';
const BOOT_STORAGE_KEY = 'kittyCreekBootPackVersion';
const FULL_STORAGE_KEY = 'kittyCreekAssetPackVersion';
const DOWNLOAD_CONCURRENCY = 6;
const FETCH_TIMEOUT_MS = 12000;
const DEFERRED_START_DELAY_MS = 4000;

/** Only these block the story from appearing (~310 KB total). */
const INSTANT_BOOT_URLS = [
    '/images/prologue-background.png',
    '/images/halley-splash.png'
];

let manifestCache = null;
let deferredPromise = null;
let imagePrefetchPromise = null;

async function loadManifest() {
    if (manifestCache) {
        return manifestCache;
    }

    const response = await fetch(`/asset-manifest.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error('Could not load asset manifest');
    }

    manifestCache = await response.json();
    return manifestCache;
}

function getBootUrls(manifest) {
    if (Array.isArray(manifest.boot) && manifest.boot.length > 0) {
        return manifest.boot;
    }
    return INSTANT_BOOT_URLS;
}

function getDeferredUrls(manifest) {
    if (Array.isArray(manifest.deferred) && manifest.deferred.length > 0) {
        return manifest.deferred;
    }
    const bootSet = new Set(getBootUrls(manifest));
    return (manifest.urls || []).filter((url) => !bootSet.has(url));
}

export function getCachedPackVersion() {
    try {
        return localStorage.getItem(FULL_STORAGE_KEY);
    } catch {
        return null;
    }
}

function markBootReady(version) {
    try {
        localStorage.setItem(BOOT_STORAGE_KEY, version);
    } catch {
        /* ignore */
    }
}

function markFullPackReady(version) {
    try {
        localStorage.setItem(FULL_STORAGE_KEY, version);
        localStorage.setItem(BOOT_STORAGE_KEY, version);
    } catch {
        /* ignore */
    }
}

async function openCache() {
    if (!('caches' in window)) {
        return null;
    }
    return caches.open(CACHE_NAME);
}

async function isUrlCached(cache, url) {
    if (!cache) {
        return false;
    }
    const hit = await cache.match(url);
    return Boolean(hit);
}

async function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { signal: controller.signal, cache: 'default' });
        return response;
    } finally {
        window.clearTimeout(timer);
    }
}

/** Warm browser + Cache API without blocking on slow cache.put writes. */
async function warmUrl(cache, url) {
    if (cache && await isUrlCached(cache, url)) {
        return { url, cached: true };
    }

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    if (cache) {
        const clone = response.clone();
        void cache.put(url, clone).catch(() => {});
    }

    return { url, cached: false };
}

async function warmUrls(urls, { onProgress, label = 'Loading' } = {}) {
    const cache = await openCache();
    const total = urls.length;
    let completed = 0;
    let failed = 0;

    await Promise.all(urls.map(async (url) => {
        try {
            await warmUrl(cache, url);
        } catch (error) {
            failed += 1;
            console.warn('[ASSET PACK] Warm failed:', url, error);
        } finally {
            completed += 1;
            if (onProgress) {
                const percent = Math.round((completed / total) * 100);
                onProgress(percent, `${label} (${completed}/${total})…`);
            }
        }
    }));

    return { completed, failed, total };
}

/**
 * Start loading prologue images immediately (non-blocking). Safe to call at bootstrap start.
 */
export function prefetchPrologueImages(options = {}) {
    if (imagePrefetchPromise) {
        return imagePrefetchPromise;
    }

    imagePrefetchPromise = (async () => {
        let urls = INSTANT_BOOT_URLS;
        try {
            const manifest = await loadManifest();
            urls = getBootUrls(manifest);
            const version = manifest.version || 'unknown';
            if (localStorage.getItem(BOOT_STORAGE_KEY) === version) {
                const cache = await openCache();
                if (cache) {
                    const hits = await Promise.all(urls.map((url) => isUrlCached(cache, url)));
                    if (hits.every(Boolean)) {
                        return { cached: true, version, count: urls.length };
                    }
                }
            }
        } catch {
            /* use defaults */
        }

        const result = await warmUrls(urls, {
            label: 'Loading story art',
            onProgress: options.onProgress
        });

        try {
            const manifest = await loadManifest();
            markBootReady(manifest.version || 'unknown');
        } catch {
            /* ignore */
        }

        return result;
    })().catch((error) => {
        console.warn('[ASSET PACK] Image prefetch failed (continuing):', error);
        imagePrefetchPromise = null;
        return { failed: true };
    });

    return imagePrefetchPromise;
}

async function isBootPackCached(version, bootUrls) {
    if (localStorage.getItem(BOOT_STORAGE_KEY) === version) {
        return true;
    }

    const cache = await openCache();
    if (!cache) {
        return false;
    }

    const checks = await Promise.all(bootUrls.map((url) => isUrlCached(cache, url)));
    return checks.every(Boolean);
}

async function isFullPackCached(version, allUrls) {
    if (getCachedPackVersion() === version) {
        return true;
    }

    const cache = await openCache();
    if (!cache || allUrls.length === 0) {
        return false;
    }

    const sample = allUrls.slice(0, 8);
    const hits = await Promise.all(sample.map((url) => isUrlCached(cache, url)));
    return hits.filter(Boolean).length >= Math.min(6, sample.length);
}

async function cacheUrlsParallel(cache, urls, { onProgress, label = 'Downloading' }) {
    if (!cache || urls.length === 0) {
        return { completed: 0, failed: 0, skipped: urls.length };
    }

    const queue = [...urls];
    let completed = 0;
    let failed = 0;
    const total = urls.length;

    const worker = async () => {
        while (queue.length > 0) {
            const url = queue.shift();
            if (!url) {
                return;
            }

            try {
                if (await isUrlCached(cache, url)) {
                    /* skip */
                } else {
                    const response = await fetchWithTimeout(url);
                    if (response.ok) {
                        void cache.put(url, response.clone()).catch(() => {});
                    } else {
                        failed += 1;
                    }
                }
            } catch (error) {
                failed += 1;
                console.warn('[ASSET PACK] Deferred failed:', url, error);
            }

            completed += 1;
            if (onProgress) {
                const percent = Math.round((completed / total) * 100);
                onProgress(percent, `${label} (${completed}/${total})…`);
            }
        }
    };

    const workers = Math.min(DOWNLOAD_CONCURRENCY, total);
    await Promise.all(Array.from({ length: workers }, () => worker()));

    return { completed, failed };
}

/**
 * Wait briefly for prologue images before showing the story (never blocks forever).
 */
export async function ensureBootPack(options = {}) {
    const onProgress = options.onProgress ?? (() => {});
    const timeoutMs = options.timeoutMs ?? 6000;

    prefetchPrologueImages({ onProgress });

    const result = await Promise.race([
        imagePrefetchPromise ?? prefetchPrologueImages({ onProgress }),
        new Promise((resolve) => {
            window.setTimeout(() => resolve({ timedOut: true }), timeoutMs);
        })
    ]);

    if (result?.timedOut) {
        console.warn('[ASSET PACK] Image prefetch timed out — starting prologue anyway');
        onProgress(100, 'Starting story…');
    } else {
        onProgress(100, 'Story art ready');
    }

    return result;
}

/**
 * Download remaining assets in the background (after prologue / gameplay has started).
 */
export function startDeferredPackDownload(options = {}) {
    const silent = options.silent === true;
    const onProgress = options.onProgress ?? (() => {});
    const delayMs = options.delayMs ?? DEFERRED_START_DELAY_MS;

    if (deferredPromise) {
        return deferredPromise;
    }

    deferredPromise = (async () => {
        if (delayMs > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, delayMs));
        }

        let manifest;
        try {
            manifest = await loadManifest();
        } catch (error) {
            console.warn('[ASSET PACK] Deferred manifest load failed:', error);
            return { skipped: true };
        }

        const version = manifest.version || 'unknown';
        const allUrls = Array.isArray(manifest.urls) ? manifest.urls : [];
        const deferredUrls = getDeferredUrls(manifest);

        if (await isFullPackCached(version, allUrls)) {
            return { cached: true, version, count: deferredUrls.length };
        }

        const cache = await openCache();
        if (!cache) {
            return { skipped: true };
        }

        if (!silent) {
            onProgress(0, `Caching game assets (0/${deferredUrls.length})…`);
        }

        const result = await cacheUrlsParallel(cache, deferredUrls, {
            label: silent ? 'Caching game assets' : 'Downloading game assets',
            onProgress: silent ? undefined : onProgress
        });

        markFullPackReady(version);

        if (!silent) {
            onProgress(100, 'Game assets ready');
        } else {
            console.log(`[ASSET PACK] Background cache done (${deferredUrls.length} files, ${result.failed} failed)`);
        }

        return { version, count: deferredUrls.length, ...result };
    })().finally(() => {
        deferredPromise = null;
    });

    return deferredPromise;
}

/** @deprecated Use ensureBootPack + startDeferredPackDownload */
export async function ensureAssetPack(options = {}) {
    await ensureBootPack(options);
    return startDeferredPackDownload(options);
}

/** Light voiceover warm-up — streams from URL, does not block on full download. */
export async function preloadPrologueVoiceover(url) {
    if (!url) {
        return null;
    }

    const audio = new Audio(url);
    audio.preload = 'auto';

    return new Promise((resolve) => {
        const finish = () => resolve(audio);
        const timer = window.setTimeout(finish, 4000);

        audio.addEventListener('loadeddata', () => {
            window.clearTimeout(timer);
            finish();
        }, { once: true });

        audio.addEventListener('error', () => {
            window.clearTimeout(timer);
            console.warn('[ASSET PACK] Voiceover stream failed — will retry on play');
            finish();
        }, { once: true });

        audio.load();
    });
}

export { CACHE_NAME as ASSET_PACK_CACHE_NAME };
