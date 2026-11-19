// Service worker généré au build (voir vite.config.ts). Cache d'abord, réseau ensuite.
// Aucune requête vers un autre domaine : seules les ressources de l'app sont mises en cache.
const VERSION = '__VERSION__';
const CACHE = `prochain-accord-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('prochain-accord-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    // ignoreVary : la requête d'un script module porte un en-tête Origin absent lors de la mise en cache.
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('./', { ignoreVary: true }) : Response.error()));
    }),
  );
});
