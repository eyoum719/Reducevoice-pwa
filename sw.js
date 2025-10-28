const CACHE_NAME = 'audioclean-v1';
const ASSETS_TO_CACHE = [
    './index.html',
    './app.js',
    './manifest.json',
    './icon-192x192.png',
    './icon-512x512.png',
    'https://cdn.jsdelivr.net/npm/webaudio-peaks@1.3.4/dist/webaudio-peaks.min.js',
    'https://cdn.jsdelivr.net/npm/ffmpeg.js@4.2.9003/ffmpeg-core.js'
];

// Installation : mise en cache des assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

// Activation : nettoyage de caches anciens
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Interception des requêtes (offline first)
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request)
            .then(cachedResponse => {
                return cachedResponse || fetch(e.request);
            })
    );
});
