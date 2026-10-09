// Service worker legado (app antigo) — este arquivo o substitui e se desinstala.
// Sem isso, navegadores que já visitaram o app antigo continuariam servindo a
// versão em cache. Limpa os caches, remove o worker e recarrega as abas abertas.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => c.navigate(c.url));
    })(),
  );
});
