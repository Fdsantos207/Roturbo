const CACHE_NAME = 'roturbo-v1';
const assets = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/login.html'
];

// Instala o service worker e guarda arquivos essenciais no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

// Faz o app responder mesmo sem internet (usando o que está no cache)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});