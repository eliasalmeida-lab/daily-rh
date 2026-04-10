const CACHE_NAME='rh-painel-v2';
self.addEventListener('install', e=>{
  // Cache minimal vital assets, mas deixa os dados no Firestore (rede first ou dinâmico)
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(['./','./index.html','./manifest.json'])));
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
