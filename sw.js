// ============================================================================
// SERVICE WORKER — app shell offline + cached raw content
// Navigations: network first, falling back to the cached shell (any path is
// the SPA). Same-origin assets and raw GitHub/gist content: stale-while-
// revalidate. GitHub API calls are not cached here (the app uses ETags).
// ============================================================================

const VERSION = "mz-v3";
const SHELL = "./index.html";
const RUNTIME_HOSTS = ["raw.githubusercontent.com", "gist.githubusercontent.com", "avatars.githubusercontent.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll([SHELL, "./favicon.svg", "./manifest.webmanifest"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
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

  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && url.pathname.endsWith("/")) caches.open(VERSION).then((c) => c.put(SHELL, res.clone()));
          return res;
        })
        .catch(async () => {
          const scope = new URL(self.registration.scope);
          const rel = url.pathname.slice(scope.pathname.length);
          // Relative asset URLs only resolve from the app root, so redirect there
          if (rel && rel !== "index.html") return Response.redirect(`${scope.href}?p=${encodeURIComponent(rel)}${url.hash}`, 302);
          return (await caches.match(SHELL)) || Response.error();
        }),
    );
    return;
  }

  if (url.origin === self.location.origin || RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
