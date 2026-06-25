/**
 * One-time "game pack" download — caches all manifest URLs for app-like offline play.
 */

const CACHE_NAME = 'halleys-big-catch-media-v6';
const STORAGE_KEY = 'kittyCreekAssetPackVersion';

let manifestCache = null;

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

export function getCachedPackVersion() {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

function markPackReady(version) {
    try {
        localStorage.setItem(STORAGE_KEY, version);
    } catch {
        /* ignore */
    }
}

async function isPackCached(version) {
    if (getCachedPackVersion() !== version) {
        return false;
    }

    if (!('caches' in window)) {
        return true;
    }

    try {
        const manifest = await loadManifest();
        const cache = await caches.open(CACHE_NAME);
        const probe = manifest.urls?.[0];
        if (!probe) {
            return true;
        }
        const hit = await cache.match(probe);
        return Boolean(hit);
    } catch {
        return false;
    }
}

/**
 * Download every file in the asset manifest into Cache Storage.
 * @param {{ onProgress?: (percent: number, message: string) => void }} options
 */
export async function ensureAssetPack(options = {}) {
    const onProgress = options.onProgress ?? (() => {});

    let manifest;
    try {
        manifest = await loadManifest();
    } catch (error) {
        console.warn('[ASSET PACK] Manifest unavailable — skipping precache', error);
        return { skipped: true };
    }

    const version = manifest.version || 'unknown';
    const urls = Array.isArray(manifest.urls) ? manifest.urls : [];

    if (urls.length === 0) {
        markPackReady(version);
        return { skipped: true };
    }

    if (await isPackCached(version)) {
        onProgress(100, 'Game pack ready');
        return { cached: true, version, count: urls.length };
    }

    if (!('caches' in window)) {
        markPackReady(version);
        return { skipped: true };
    }

    const cache = await caches.open(CACHE_NAME);
    let completed = 0;
    let failed = 0;

    onProgress(0, `Downloading game pack (0/${urls.length})…`);

    for (const url of urls) {
        try {
            const response = await fetch(url, { cache: 'reload' });
            if (response.ok) {
                await cache.put(url, response.clone());
            } else {
                failed += 1;
                console.warn('[ASSET PACK] Missing:', url, response.status);
            }
        } catch (error) {
            failed += 1;
            console.warn('[ASSET PACK] Failed:', url, error);
        }

        completed += 1;
        const percent = Math.round((completed / urls.length) * 100);
        const label = failed > 0
            ? `Downloading game pack (${completed}/${urls.length}, ${failed} skipped)…`
            : `Downloading game pack (${completed}/${urls.length})…`;
        onProgress(percent, label);
    }

    markPackReady(version);
    onProgress(100, failed > 0 ? 'Game pack ready (some files optional)' : 'Game pack ready');

    return { cached: false, version, count: urls.length, failed };
}

/** Preload narration audio before prologue tap (uses pack cache when available). */
export async function preloadPrologueVoiceover(url) {
    if (!url) {
        return null;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
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
