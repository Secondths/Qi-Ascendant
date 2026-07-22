/* Qi Ascendant — Service Worker
   Caches the app shell so the game installs and plays fully offline once loaded once. */

const CACHE_NAME = "qi-ascendant-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Cache-first for anything we already have (instant + offline-safe).
      if (cached) {
        // Refresh the cache in the background for same-origin requests.
        if (event.request.url.startsWith(self.location.origin)) {
          fetch(event.request).then((resp) => {
            if (resp && resp.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resp));
            }
          }).catch(() => {});
        }
        return cached;
      }

      // Not cached yet: try the network, cache same-origin successes, fall back gracefully.
      return fetch(event.request)
        .then((resp) => {
          if (resp && resp.status === 200 && event.request.url.startsWith(self.location.origin)) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return resp;
        })
        .catch(() => {
          // Offline and not cached: for page navigations, fall back to the shell.
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("", { status: 408, statusText: "Offline" });
        });
    })
  );
});
