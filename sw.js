'use strict';
// Service worker: caches the whole app so Surge opens and runs with no connection.
// Bump VERSION whenever a cached file changes so installed copies pick up the new files.
const VERSION = 'surge-v5';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'core.js',
  'medicines.js',
  'config.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      // One missing file (for example config.js on a fresh clone) must not stop the rest from caching.
      await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== VERSION).map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// Same-origin files: serve the cached copy at once and refresh it in the background (stale-while-revalidate).
// Anything on another origin (the weather API) goes straight to the network and is never cached.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(request, { ignoreSearch: true });
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);
      if (cached) {
        refresh.catch(() => {});
        return cached;
      }
      const fresh = await refresh;
      if (fresh) return fresh;
      if (request.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    })()
  );
});
