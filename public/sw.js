// ============================================================================
// SERVICE WORKER — app shell offline + cached raw content
// Navigations: network first, falling back to the cached shell (every path is
// the SPA). Same-origin assets and raw GitHub/gist content: stale-while-
// revalidate. GitHub API calls are not cached here (the app uses ETags).
// ============================================================================

const CACHE_NAME = "mz-portfolio-v9";
const SHELL = "/index.html";
// Everything the app loads, so a first visit works offline. tools/check.mjs
// keeps this list in sync with the files on disk.
const urlsToCache = [
  "/index.html",
  "/styles/style.css?v=5",
  "/scripts/index.js?v=5",
  "/manifest.json",
  "/assets/images/logo.svg",
  "/markup/sandbox.html",
  "/styles/animations.css",
  "/styles/blog.css",
  "/styles/detail.css",
  "/styles/editor.css",
  "/styles/global.css",
  "/styles/header.css",
  "/styles/home.css",
  "/styles/navbar.css",
  "/styles/project-page.css",
  "/styles/projects.css",
  "/styles/resume-overlay.css",
  "/styles/sections.css",
  "/styles/status.css",
  "/scripts/animations/code-reveal.js",
  "/scripts/animations/index.js",
  "/scripts/api.js",
  "/scripts/app.js",
  "/scripts/components.js",
  "/scripts/config.js",
  "/scripts/data.js",
  "/scripts/editor-core.js",
  "/scripts/github.js",
  "/scripts/icons.js",
  "/scripts/languages.js",
  "/scripts/log.js",
  "/scripts/markdown.js",
  "/scripts/merge.js",
  "/scripts/palette.js",
  "/scripts/resume/helpers.js",
  "/scripts/resume/index.js",
  "/scripts/resume/themes/elegant.js",
  "/scripts/resume/themes/even.js",
  "/scripts/resume/themes/flat.js",
  "/scripts/resume/themes/kendall.js",
  "/scripts/resume/themes/macchiato.js",
  "/scripts/resume/themes/onepage.js",
  "/scripts/resume/themes/professional.js",
  "/scripts/resume/themes/stackoverflow.js",
  "/scripts/router.js",
  "/scripts/template.js",
  "/scripts/theme.js",
  "/scripts/utils.js",
  "/scripts/views/docs.js",
  "/scripts/views/editor.js",
  "/scripts/views/landing.js",
  "/scripts/views/preview.js",
  "/scripts/views/status.js",
];
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
