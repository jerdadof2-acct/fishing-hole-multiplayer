/**
 * One-time game pack — boot assets first (prologue), rest in background.
 */

const CACHE_NAME = 'halleys-big-catch-media-v7';
const BOOT_STORAGE_KEY = 'kittyCreekBootPackVersion';
const FULL_STORAGE_KEY = 'kittyCreekAssetPackVersion';
const DOWNLOAD_CONCURRENCY = 10;

let manifestCache = null;
let deferredPromise = null;

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
    return [
        '/images/prologue-background.png',
        '/images/halley-splash.png',
        '/assets/audio/halleys-big-catch-intro.mp3',
        '/assets/audio/prologue-ocean-seagulls.mp3',
        '/assets/audio/prologue-music.mp3'
    ];
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

async function isBootPackCached(version, bootUrls) {
    const storedBoot = localStorage.getItem(BOOT_STORAGE_KEY);
    if (storedBoot === version) {
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
    let skipped = 0;
    const total = urls.length;

    const worker = async () => {
        while (queue.length > 0) {
            const url = queue.shift();
            if (!url) {
                return;
            }

            try {
                if (await isUrlCached(cache, url)) {
                    skipped += 1;
                } else {
                    const response = await fetch(url);
                    if (response.ok) {
                        await cache.put(url, response.clone());
                    } else {
                        failed += 1;
                        console.warn('[ASSET PACK] Missing:', url, response.status);
                    }
                }
            } catch (error) {
                failed += 1;
                console.warn('[ASSET PACK] Failed:', url, error);
            }

            completed += 1;
            if (onProgress) {
                const percent = Math.round((completed / total) * 100);
                const suffix = failed > 0 ? `, ${failed} skipped` : '';
                onProgress(percent, `${label} (${completed}/${total}${suffix})…`);
            }
        }
    };

    const workers = Math.min(DOWNLOAD_CONCURRENCY, total);
    await Promise.all(Array.from({ length: workers }, () => worker()));

    return { completed, failed, skipped };
}

/**
 * Download only prologue essentials — blocks until ready (fast, ~5 files, parallel).
 */
export async function ensureBootPack(options = {}) {
    const onProgress = options.onProgress ?? (() => {});

    let manifest;
    try {
        manifest = await loadManifest();
    } catch (error) {
        console.warn('[ASSET PACK] Manifest unavailable — skipping boot pack', error);
        return { skipped: true };
    }

    const version = manifest.version || 'unknown';
    const bootUrls = getBootUrls(manifest);

    if (await isBootPackCached(version, bootUrls)) {
        onProgress(100, 'Prologue assets ready');
        startDeferredPackDownload({ silent: true });
        return { cached: true, version, count: bootUrls.length };
    }

    const cache = await openCache();
    if (!cache) {
        markBootReady(version);
        return { skipped: true };
    }

    onProgress(0, `Loading prologue assets (0/${bootUrls.length})…`);

    await cacheUrlsParallel(cache, bootUrls, {
        label: 'Loading prologue assets',
        onProgress
    });

    markBootReady(version);
    onProgress(100, 'Prologue assets ready');

    startDeferredPackDownload({ silent: true });

    return { cached: false, version, count: bootUrls.length };
}

/**
 * Download remaining assets in the background (during prologue / gameplay).
 */
export function startDeferredPackDownload(options = {}) {
    const silent = options.silent === true;
    const onProgress = options.onProgress ?? (() => {});

    if (deferredPromise) {
        return deferredPromise;
    }

    deferredPromise = (async () => {
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
            if (!silent) {
                onProgress(100, 'Full game pack ready');
            }
            return { cached: true, version, count: deferredUrls.length };
        }

        const cache = await openCache();
        if (!cache) {
            markFullPackReady(version);
            return { skipped: true };
        }

        if (!silent) {
            onProgress(0, `Downloading lake assets (0/${deferredUrls.length})…`);
        }

        const result = await cacheUrlsParallel(cache, deferredUrls, {
            label: silent ? 'Caching lake assets' : 'Downloading lake assets',
            onProgress: silent ? undefined : onProgress
        });

        markFullPackReady(version);

        if (!silent) {
            onProgress(100, result.failed > 0 ? 'Game pack ready (some optional files skipped)' : 'Game pack ready');
        } else {
            console.log(`[ASSET PACK] Background download complete (${deferredUrls.length} files, ${result.failed} failed)`);
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

/** Preload narration audio before prologue tap (uses pack cache when available). */
export async function preloadPrologueVoiceover(url) {
    if (!url) {
        return null;
    }

    try {
        const cache = await openCache();
        let response = cache ? await cache.match(url) : null;
        if (!response) {
            response = await fetch(url);
            if (response.ok && cache) {
                await cache.put(url, response.clone());
            }
        }

        if (!response?.ok) {
            throw new Error(`HTTP ${response?.status ?? 'failed'}`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const audio = new Audio(objectUrl);
        audio.preload = 'auto';

        await new Promise((resolve, reject) => {
            const onReady = () => {
                cleanup();
                resolve();
            };
            const onError = () => {
                cleanup();
                reject(new Error('Voiceover failed to load'));
            };
            const cleanup = () => {
                audio.removeEventListener('canplaythrough', onReady);
                audio.removeEventListener('error', onError);
            };
            audio.addEventListener('canplaythrough', onReady, { once: true });
            audio.addEventListener('error', onError, { once: true });
            audio.load();
        });

        return audio;
    } catch (error) {
        console.warn('[ASSET PACK] Voiceover preload failed:', error);
        return null;
    }
}

export { CACHE_NAME as ASSET_PACK_CACHE_NAME };
