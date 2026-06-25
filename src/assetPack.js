/**
 * Game pack — prologue media loads fully before the story plays; lake assets load in background.
 */

import {
    PROLOGUE_FULL_PACK,
    PROLOGUE_SPLASH_PACK
} from './config/prologue.js';

const CACHE_NAME = 'halleys-big-catch-media-v8';
const PROLOGUE_STORAGE_KEY = 'kittyCreekProloguePackVersion';
const FULL_STORAGE_KEY = 'kittyCreekAssetPackVersion';
const DOWNLOAD_CONCURRENCY = 6;
const FETCH_TIMEOUT_MS = 20000;
const AUDIO_READY_TIMEOUT_MS = 45000;
const DEFERRED_START_DELAY_MS = 4000;

let manifestCache = null;
let deferredPromise = null;
let prologuePackPromise = null;
let prologuePackResult = null;
let prologuePackMode = null;

function toAbsoluteUrl(path) {
    if (!path) {
        return path;
    }
    return path.startsWith('/') ? path : `/${path}`;
}

function packItems(full) {
    return (full ? PROLOGUE_FULL_PACK : PROLOGUE_SPLASH_PACK).map((item) => ({
        ...item,
        url: toAbsoluteUrl(item.path)
    }));
}

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

function getDeferredUrls(manifest) {
    if (Array.isArray(manifest.deferred) && manifest.deferred.length > 0) {
        return manifest.deferred;
    }
    const prologueUrls = new Set(PROLOGUE_FULL_PACK.map((item) => toAbsoluteUrl(item.path)));
    return (manifest.urls || []).filter((url) => !prologueUrls.has(url));
}

export function getCachedPackVersion() {
    try {
        return localStorage.getItem(FULL_STORAGE_KEY);
    } catch {
        return null;
    }
}

function markProloguePackReady(version) {
    try {
        localStorage.setItem(PROLOGUE_STORAGE_KEY, version);
    } catch {
        /* ignore */
    }
}

function markFullPackReady(version) {
    try {
        localStorage.setItem(FULL_STORAGE_KEY, version);
        localStorage.setItem(PROLOGUE_STORAGE_KEY, version);
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
        return await fetch(url, { signal: controller.signal, cache: 'default' });
    } finally {
        window.clearTimeout(timer);
    }
}

async function fetchBlob(url) {
    const cache = await openCache();
    let response = cache ? await cache.match(url) : null;

    if (!response) {
        response = await fetchWithTimeout(url);
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
    }

    const blob = await response.blob();

    if (cache) {
        void cache.put(url, new Response(blob.slice())).catch(() => {});
    }

    return blob;
}

async function preloadImageItem(url) {
    const blob = await fetchBlob(url);
    const blobUrl = URL.createObjectURL(blob);
    const img = new Image();

    await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Image failed: ${url}`));
        img.src = blobUrl;
    });

    if (img.decode) {
        await img.decode();
    }

    return { img, blobUrl };
}

async function preloadAudioItem(url, { loop = false } = {}) {
    const blob = await fetchBlob(url);
    const blobUrl = URL.createObjectURL(blob);
    const audio = new Audio(blobUrl);
    audio.preload = 'auto';
    audio.loop = loop;

    await new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
            cleanup();
            reject(new Error(`Audio timed out: ${url}`));
        }, AUDIO_READY_TIMEOUT_MS);

        const onReady = () => {
            cleanup();
            resolve();
        };

        const onError = () => {
            cleanup();
            reject(new Error(`Audio failed: ${url}`));
        };

        const cleanup = () => {
            window.clearTimeout(timer);
            audio.removeEventListener('canplaythrough', onReady);
            audio.removeEventListener('error', onError);
        };

        audio.addEventListener('canplaythrough', onReady, { once: true });
        audio.addEventListener('error', onError, { once: true });
        audio.load();
    });

    return { audio, blobUrl };
}

async function loadProloguePackItems(items, { onProgress } = {}) {
    const total = items.length;
    let completed = 0;
    const result = {};

    const report = (item) => {
        completed += 1;
        const percent = Math.round((completed / total) * 100);
        onProgress?.(percent, `Loading ${item.label} (${completed}/${total})…`);
    };

    await Promise.all(items.map(async (item) => {
        if (item.type === 'image') {
            result[item.key] = await preloadImageItem(item.url);
        } else {
            result[item.key] = await preloadAudioItem(item.url, { loop: item.loop === true });
        }
        report(item);
    }));

    try {
        const manifest = await loadManifest();
        markProloguePackReady(manifest.version || 'unknown');
    } catch {
        /* ignore */
    }

    return result;
}

/**
 * Begin loading prologue media during auth (non-blocking).
 */
export function prefetchProloguePack(options = {}) {
    const full = options.full !== false;
    const mode = full ? 'full' : 'splash';

    if (prologuePackPromise && prologuePackMode === mode) {
        return prologuePackPromise;
    }

    if (prologuePackResult && prologuePackMode === mode) {
        return Promise.resolve(prologuePackResult);
    }

    prologuePackMode = mode;
    const items = packItems(full);

    prologuePackPromise = loadProloguePackItems(items, { onProgress: options.onProgress })
        .then((result) => {
            prologuePackResult = result;
            prologuePackPromise = null;
            return result;
        })
        .catch((error) => {
            prologuePackPromise = null;
            throw error;
        });

    return prologuePackPromise;
}

/**
 * Block until all prologue media is buffered and ready to play.
 */
export async function ensureProloguePack(options = {}) {
    const full = options.full !== false;
    const mode = full ? 'full' : 'splash';
    const onProgress = options.onProgress ?? (() => {});

    if (prologuePackResult && prologuePackMode === mode) {
        onProgress(100, 'Story ready');
        return prologuePackResult;
    }

    if (prologuePackPromise && prologuePackMode === mode) {
        onProgress(0, 'Loading story…');
        const result = await prologuePackPromise;
        onProgress(100, 'Story ready');
        return result;
    }

    onProgress(0, 'Loading story…');
    const result = await prefetchProloguePack({ full, onProgress });
    onProgress(100, 'Story ready');
    return result;
}

/** @deprecated Use prefetchProloguePack */
export function prefetchPrologueImages(options = {}) {
    return prefetchProloguePack({ full: true, ...options });
}

/** @deprecated Use ensureProloguePack */
export async function ensureBootPack(options = {}) {
    return ensureProloguePack({ full: true, ...options });
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
 * Download lake / gameplay assets in the background after the prologue starts.
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

        const result = await cacheUrlsParallel(cache, deferredUrls, {
            label: silent ? 'Caching game assets' : 'Downloading game assets',
            onProgress: silent ? undefined : onProgress
        });

        markFullPackReady(version);

        if (!silent) {
            console.log(`[ASSET PACK] Background cache done (${deferredUrls.length} files, ${result.failed} failed)`);
        }

        return { version, count: deferredUrls.length, ...result };
    })().finally(() => {
        deferredPromise = null;
    });

    return deferredPromise;
}

/** @deprecated Use ensureProloguePack + startDeferredPackDownload */
export async function ensureAssetPack(options = {}) {
    await ensureProloguePack(options);
    return startDeferredPackDownload(options);
}

/** @deprecated Prologue pack preloads voiceover — kept for replay fallback. */
export async function preloadPrologueVoiceover(url) {
    if (!url) {
        return null;
    }

    const { audio } = await preloadAudioItem(url, { loop: false });
    return audio;
}

/** Blob URL or file path for the prologue music track (already cached after prologue load). */
export function getPrologueMusicSource() {
    if (prologuePackResult?.music?.blobUrl) {
        return prologuePackResult.music.blobUrl;
    }

    const src = prologuePackResult?.music?.audio?.src;
    if (src && src.startsWith('blob:')) {
        return src;
    }

    return null;
}

export { CACHE_NAME as ASSET_PACK_CACHE_NAME };
