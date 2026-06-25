const CACHE_PREFIX = 'halleys-big-catch-media';
const CACHE_VERSION = 'v7';
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

/** Shell + prologue only — full pack is downloaded by the client in background. */
const BOOT_ASSETS = [
    '/',
    '/index.html',
    '/asset-manifest.json',
    '/manifest.json',
    '/css/styles.css',
    '/images/prologue-background.png',
    '/images/halley-splash.png',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png',
    '/assets/audio/halleys-big-catch-intro.mp3',
    '/assets/audio/prologue-ocean-seagulls.mp3',
    '/assets/audio/prologue-music.mp3'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(BOOT_ASSETS).catch((error) => {
                console.warn('[SW] Boot cache partial fail (non-fatal):', error);
            }))
            .then(() => self.skipWaiting())
    );
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

function isGlbRequest(request) {
    try {
        return new URL(request.url).pathname.startsWith('/assets/glb/');
    } catch (_error) {
        return false;
    }
}

function isMediaRequest(request) {
    if (request.method !== 'GET') {
        return false;
    }

    if (isGlbRequest(request)) {
        return false;
    }

    const destination = request.destination;
    if (destination === 'image' || destination === 'audio') {
        return true;
    }

    try {
        const url = new URL(request.url);
        return url.pathname.startsWith('/assets/images/') ||
            url.pathname.startsWith('/images/') ||
            url.pathname.startsWith('/assets/audio/') ||
            url.pathname.startsWith('/assets/textures/') ||
            url.pathname.startsWith('/assets/icons/') ||
            url.pathname.startsWith('/src/audio/') ||
            url.pathname === '/asset-manifest.json';
    } catch (_error) {
        return false;
    }
}

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (isGlbRequest(request)) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cached = await cache.match(request);
                if (cached) {
                    return cached;
                }
                try {
                    const response = await fetch(request);
                    if (response.ok) {
                        cache.put(request, response.clone());
                    }
                    return response;
                } catch (error) {
                    if (cached) {
                        return cached;
                    }
                    throw error;
                }
            })
        );
        return;
    }

    if (!isMediaRequest(request)) {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cached = await cache.match(request);
            if (cached) {
                return cached;
            }

            try {
                const response = await fetch(request);
                if (response && response.status === 200) {
                    cache.put(request, response.clone());
                }
                return response;
            } catch (error) {
                if (cached) {
                    return cached;
                }
                throw error;
            }
        })
    );
});
