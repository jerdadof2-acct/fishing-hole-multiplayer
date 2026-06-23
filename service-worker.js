const CACHE_PREFIX = 'halleys-big-catch-media';
const CACHE_VERSION = 'v4';
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

/** Only assets needed for first paint — fish/audio cache on demand via fetch handler */
const BOOT_ASSETS = [
    'assets/icons/icon-192.png',
    'assets/icons/icon-512.png',
    'assets/textures/particle.png',
    'assets/textures/waterNormals1.jpg',
    'assets/textures/waterNormals2.jpg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(BOOT_ASSETS))
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.warn('[SW] Boot cache partial fail (non-fatal):', error);
            })
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
            url.pathname.startsWith('/assets/audio/') ||
            url.pathname.startsWith('/assets/textures/') ||
            url.pathname.startsWith('/assets/icons/');
    } catch (_error) {
        return false;
    }
}

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // GLB models: always network-first so cat model updates are not stuck in cache
    if (isGlbRequest(request)) {
        event.respondWith(
            fetch(request).catch(() => caches.match(request))
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
