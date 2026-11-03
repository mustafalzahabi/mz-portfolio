// ============================================================================
// SERVICE WORKER — app shell offline + cached raw content
// Navigations: network first, falling back to the cached shell (every path is
// the SPA). Same-origin assets and raw GitHub/gist content: stale-while-
// revalidate. GitHub API calls are not cached here (the app uses ETags).
// ============================================================================

const CACHE_NAME = "mz-portfolio-v5";
const SHELL = "/index.html";
const urlsToCache = [SHELL, "/styles/style.css?v=4", "/scripts/index.js?v=4", "/manifest.json", "/assets/images/favicon.svg"];
const RUNTIME_HOSTS = ["raw.githubusercontent.com", "gist.githubusercontent.com", "avatars.githubusercontent.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Pages: the host serves index.html for every route (SPA fallback); offline,
  // serve the cached shell for any route.
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(SHELL, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(SHELL)) || Response.error()),
    );
    return;
  }

  if (url.origin === self.location.origin || RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
