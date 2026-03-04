const CACHE_NAME = 'roturbo-v2'; // Mudamos para v2 para forçar a atualização
const assets = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/login.html'
];

// Instala o service worker e guarda os arquivos novos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
  self.skipWaiting(); // Força a instalação imediata
});

// APAGA O CACHE ANTIGO (v1) QUANDO O v2 ENTRAR
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

// Intercepta as requisições (Tenta a rede primeiro, depois o cache)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});