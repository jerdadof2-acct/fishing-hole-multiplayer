/**
 * Halley's Big Catch service worker
 * - Precaches hashed app shell when available
 * - Stale-while-revalidate for stable media
 * - Bounded cache size / age
 * - Normalizes cache keys (strips query strings) to avoid duplicate variants
 */
const CACHE_PREFIX = 'halleys-big-catch-media';
const CACHE_VERSION = 'v35';
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const MAX_MEDIA_ENTRIES = 280;
const MAX_MEDIA_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** Fallback shell when dist/sw-precache.json is unavailable. */
const BOOT_ASSETS = [
    '/',
    '/index.html',
    '/ad-banner.html',
    '/ad-energy.html',
    '/asset-manifest.json',
    '/manifest.json',
    '/css/styles.css',
    '/images/prologue-background.png',
    '/assets/images/loading-poster.avif',
    '/assets/images/loading-poster.webp',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png'
];

function normalizeUrl(urlString) {
    try {
        const url = new URL(urlString, self.location.origin);
        url.search = '';
        url.hash = '';
        return url.href;
    } catch {
        return urlString;
    }
}

function cacheKeyFor(request) {
    return normalizeUrl(request.url);
}

async function loadPrecacheUrls() {
    try {
        const response = await fetch('/sw-precache.json', { cache: 'no-store' });
        if (!response.ok) {
            return BOOT_ASSETS;
        }
        const data = await response.json();
        if (Array.isArray(data?.urls) && data.urls.length) {
            return [...new Set([...BOOT_ASSETS, ...data.urls])];
        }
    } catch {
        // Dist precache optional in local/dev.
    }
    return BOOT_ASSETS;
}

async function trimCache(cache) {
    const keys = await cache.keys();
    if (!keys.length) {
        return;
    }

    const now = Date.now();
    /** @type {{ request: Request, at: number }[]} */
    const scored = [];

    for (const request of keys) {
        const response = await cache.match(request);
        const swStored = Number(response?.headers?.get('x-sw-cached-at') || 0);
        const dateHeader = response?.headers?.get('date');
        const at = Number.isFinite(swStored) && swStored > 0
            ? swStored
            : (dateHeader ? Date.parse(dateHeader) || 0 : 0);
        scored.push({ request, at });
    }

    // Drop expired entries first.
    for (const entry of scored) {
        if (entry.at > 0 && (now - entry.at) > MAX_MEDIA_AGE_MS) {
            await cache.delete(entry.request);
        }
    }

    let remaining = await cache.keys();
    if (remaining.length <= MAX_MEDIA_ENTRIES) {
        return;
    }

    // Evict oldest until under the hard cap.
    scored.sort((a, b) => a.at - b.at);
    for (const entry of scored) {
        if (remaining.length <= MAX_MEDIA_ENTRIES) {
            break;
        }
        await cache.delete(entry.request);
        remaining = await cache.keys();
    }
}

function stampResponse(response) {
    if (!response || !response.ok || response.type === 'opaque') {
        return response;
    }
    const headers = new Headers(response.headers);
    headers.set('x-sw-cached-at', String(Date.now()));
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

function isNavigationRequest(request) {
    return request.mode === 'navigate'
        || (request.destination === 'document');
}

function isAppShellRequest(request) {
    if (request.method !== 'GET') {
        return false;
    }
    try {
        const path = new URL(request.url).pathname;
        return path === '/'
            || path === '/index.html'
            || path.startsWith('/assets/js/')
            || path.startsWith('/assets/css/')
            || path === '/sw-precache.json';
    } catch {
        return false;
    }
}

function isMediaRequest(request) {
    if (request.method !== 'GET') {
        return false;
    }

    const destination = request.destination;
    if (destination === 'image' || destination === 'audio' || destination === 'font') {
        return true;
    }

    try {
        const url = new URL(request.url);
        const path = url.pathname;
        return path.startsWith('/assets/images/')
            || path.startsWith('/images/')
            || path.startsWith('/assets/audio/')
            || path.startsWith('/assets/textures/')
            || path.startsWith('/assets/icons/')
            || path.startsWith('/assets/glb/')
            || path.startsWith('/src/audio/')
            || path === '/asset-manifest.json'
            || /\.(png|jpe?g|webp|avif|gif|mp3|ogg|opus|m4a|wav|glb|hdr|ktx2)$/i.test(path);
    } catch {
        return false;
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const key = cacheKeyFor(request);
    const cached = await cache.match(key);

    const networkPromise = fetch(request).then(async (response) => {
        if (response && response.status === 200) {
            const stamped = stampResponse(response.clone());
            void cache.put(key, stamped).then(() => trimCache(cache));
        }
        return response;
    }).catch((error) => {
        if (cached) {
            return cached;
        }
        throw error;
    });

    return cached || networkPromise;
}

async function networkFirstShell(request) {
    const cache = await caches.open(CACHE_NAME);
    const key = cacheKeyFor(request);
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            void cache.put(key, stampResponse(response.clone()));
        }
        return response;
    } catch (error) {
        const cached = await cache.match(key);
        if (cached) {
            return cached;
        }
        if (isNavigationRequest(request)) {
            const fallback = await cache.match('/index.html') || await cache.match('/');
            if (fallback) {
                return fallback;
            }
        }
        throw error;
    }
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const urls = await loadPrecacheUrls();
        const cache = await caches.open(CACHE_NAME);
        await Promise.all(urls.map(async (url) => {
            try {
                const response = await fetch(url, { cache: 'reload' });
                if (response.ok) {
                    await cache.put(normalizeUrl(url), stampResponse(response));
                }
            } catch (error) {
                console.warn('[SW] Precache miss (non-fatal):', url, error);
            }
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') {
        return;
    }

    // Never cache the service worker itself.
    try {
        if (new URL(request.url).pathname === '/service-worker.js') {
            return;
        }
    } catch {
        return;
    }

    if (isNavigationRequest(request) || isAppShellRequest(request)) {
        event.respondWith(networkFirstShell(request));
        return;
    }

    if (isMediaRequest(request)) {
        event.respondWith(staleWhileRevalidate(request));
    }
});
