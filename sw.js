// Service worker do Karaokê do Hugo (o do Flutter foi deprecado).
// Estratégia: stale-while-revalidate para GET da própria origem — serve do
// cache na hora (abre offline depois da primeira visita) e atualiza em
// segundo plano. Nada de lista de precache gigante: o uso real popula o
// cache (shell, main.dart.js, canvaskit, wasm, assets) já na primeira carga.
'use strict';

const CACHE = 'kdh-swr-v1';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // shell mínimo garantido mesmo se a pessoa instalar e fechar rápido
    await c.addAll([
      'index.html',
      'manifest.json',
      'favicon.png',
      'icons/Icon-192.png',
      'icons/Icon-512.png',
    ]).catch(() => {});
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const nome of await caches.keys()) {
      if (nome.startsWith('kdh-') && nome !== CACHE) await caches.delete(nome);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // YouTube/LRCLIB: direto

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // navegação usa o index cacheado como fallback (SPA)
    const chave = req.mode === 'navigate' ? 'index.html' : req;
    const doCache = await cache.match(chave);
    const daRede = fetch(req).then((resp) => {
      if (resp && resp.ok) cache.put(chave, resp.clone());
      return resp;
    }).catch(() => null);
    if (doCache) {
      daRede.catch(() => {}); // revalida em background
      return doCache;
    }
    const resp = await daRede;
    if (resp) return resp;
    return new Response('offline', {status: 503});
  })());
});
