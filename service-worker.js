const CACHE_PREFIX = 'kitty-creek-media';
const CACHE_VERSION = 'v1';
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

const MEDIA_ASSETS = [
    // Audio
    'assets/audio/fish-splashing-release-1-96870.mp3',
    'assets/audio/fishing-reel-302355.mp3',
    'assets/audio/reel_clicks.wav',
    'assets/audio/splash-6213.mp3',
    'assets/audio/splash-sound-228915.mp3',
    'assets/audio/splash.wav',
    'assets/audio/tug.wav',
    'assets/audio/water-splashing-202979.mp3',

    // Textures & icons
    'assets/icons/icon.svg',
    'assets/textures/caustics_loop.jpg',
    'assets/textures/particle.png',
    'assets/textures/waterNormals1.jpg',
    'assets/textures/waterNormals2.jpg',

    // Fish images
    'assets/images/Abyssal Eel.png',
    'assets/images/Ancient Sturgeon.png',
    'assets/images/Bass.png',
    'assets/images/Carp.png',
    'assets/images/Catfish.png',
    'assets/images/Crappie.png',
    'assets/images/Crystal Bass.png',
    'assets/images/Dragon Carp.png',
    'assets/images/Flying Fish.png',
    'assets/images/Golden Trout.png',
    'assets/images/Ice Pike.png',
    'assets/images/Leviathan.png',
    'assets/images/Marlin.png',
    'assets/images/Minnow.png',
    'assets/images/Muskie.png',
    'assets/images/Perch.png',
    'assets/images/Phoenix Fish.png',
    'assets/images/Pike.png',
    'assets/images/Platosaurus.png',
    'assets/images/Psycho Puffer.png',
    'assets/images/Salmon.png',
    'assets/images/Shadow Catfish.png',
    'assets/images/Sturgeon.png',
    'assets/images/Sunfish.png',
    'assets/images/Tournament King.png',
    'assets/images/Trophy Bass.png',
    'assets/images/Trophy Catfish.png',
    'assets/images/Trophy King.png',
    'assets/images/Trophy Marlin.png',
    'assets/images/Trophy Pike.png',
    'assets/images/Trophy Salmon.png',
    'assets/images/Trophy Sturgeon.png',
    'assets/images/Trophy Tuna.png',
    'assets/images/Trout.png',
    'assets/images/Tuna.png',
    'assets/images/Tyrannofin Rex.png',
    'assets/images/Walleye.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(MEDIA_ASSETS))
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.warn('[SW] Failed to pre-cache media assets:', error);
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

function isMediaRequest(request) {
    if (request.method !== 'GET') {
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
    if (!isMediaRequest(request)) {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cached = await cache.match(request, { ignoreSearch: true });
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

