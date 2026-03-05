const CACHE_NAME = 'roturbo-v3'; // A MÁGICA ESTÁ AQUI: Mudamos para v3
const assets = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/login.html'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Força a instalação na hora
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Network First: Tenta pegar da internet sempre que possível
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});