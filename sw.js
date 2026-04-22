const CACHE_NAME='rh-painel-v3';
self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(['./','./index.html','./manifest.json'])));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

// Estratégia Stale-While-Revalidate simples para o offline
self.addEventListener('fetch', e=>{
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(catched => {
      const fetchPromise = fetch(e.request).then(networkResponse => {
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, networkResponse.clone()));
        return networkResponse;
      }).catch(() => catched);
      return catched || fetchPromise;
    })
  );
});
