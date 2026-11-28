// ============================================================================
// SERVICE WORKER â€” app shell offline + cached raw content
// Navigations: network first, falling back to the cached shell (every path is
// the SPA). Same-origin assets and raw GitHub/gist content: stale-while-
// revalidate. GitHub API calls are not cached here (the app uses ETags).
// ============================================================================

const CACHE_NAME = "mz-portfolio-v46";
const SHELL = "/index.html";
// Everything the app loads, so a first visit works offline. tools/check.mjs
// keeps this list in sync with the files on disk.
const urlsToCache = [
  "/index.html",
  "/styles/style.css?v=6",
  "/scripts/index.js?v=5",
  "/manifest.json",
  "/assets/images/logo.svg",
  "/markup/sandbox.html",
  "/styles/account.css",
  "/styles/animations.css",
  "/styles/blog.css",
  "/styles/detail.css",
  "/styles/edit.css",
  "/styles/editor.css",
  "/styles/global.css",
  "/styles/header.css",
  "/styles/home.css",
  "/styles/landing.css",
  "/styles/navbar.css",
  "/styles/project-page.css",
  "/styles/projects.css",
  "/styles/resume-overlay.css",
  "/styles/sections.css",
  "/styles/status.css",
  "/styles/ui.css",
  "/scripts/account.js",
  "/scripts/animations/code-reveal.js",
  "/scripts/animations/dissolve.js",
  "/scripts/animations/index.js",
  "/scripts/api.js",
  "/scripts/app.js",
  "/scripts/components.js",
  "/scripts/config.js",
  "/scripts/data.js",
  "/scripts/edit/core.js",
  "/scripts/edit/mode.js",
  "/scripts/edit/readme.js",
  "/scripts/edit/inline.js",
  "/scripts/edit/datepicker.js",
  "/scripts/edit/settings-ui.js",
  "/scripts/views/account-settings.js",
  "/scripts/combine.js",
  "/scripts/account-link.js",
  "/scripts/edit/direct.js",
  "/scripts/edit/post-page.js",
  "/scripts/edit/markdown-editor.js",
  "/scripts/edit/sheet.js",
  "/scripts/editor-core.js",
  "/scripts/github.js",
  "/scripts/google.js",
  "/scripts/storage.js",
  "/scripts/posts.js",
  "/scripts/icons.js",
  "/scripts/images.js",
  "/scripts/languages.js",
  "/scripts/log.js",
  "/scripts/latex.js",
  "/scripts/highlight.js",
  "/scripts/subscriptions.js",
  "/scripts/follow-sync.js",
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
  "/scripts/ui.js",
  "/scripts/utils.js",
  "/scripts/views/docs.js",
  "/scripts/views/landing.js",
  "/scripts/views/preview.js",
  "/scripts/views/site-header.js",
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

/** Our own files: always try the network first, so a new deploy shows at once; cache = offline fallback. */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true })) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached || Response.error());
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return; // sign-in redirects

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

  if (url.origin === self.location.origin) event.respondWith(networkFirst(request));
  else if (RUNTIME_HOSTS.includes(url.hostname)) event.respondWith(staleWhileRevalidate(request));
});

// ============================================================================
// BLOG SUBSCRIPTIONS (see scripts/subscriptions.js). The followed blogs live in
// this browser's IndexedDB only; this checks their RSS feeds in the background
// (periodicsync) or when the site asks (message), and notifies of new posts.
// ============================================================================

const SUBS_DB = "mz-subscriptions";

function subsStore(mode, fn) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SUBS_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("blogs", { keyPath: "feed" });
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const t = req.result.transaction("blogs", mode);
      const r = fn(t.objectStore("blogs"));
      t.oncomplete = () => resolve(r && r.result);
      t.onerror = () => reject(t.error);
    };
  });
}

function feedItems(xml) {
  const unescape = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const tag = (block, name) => {
    const m = block.match(new RegExp("<" + name + "[^>]*>([\s\S]*?)</" + name + ">"));
    return m ? unescape(m[1].trim()) : "";
  };
  return [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, block]) => {
    const link = tag(block, "link");
    return { title: tag(block, "title"), link, guid: tag(block, "guid") || link };
  });
}

async function checkSubscriptions() {
  if (self.Notification && Notification.permission !== "granted") return;
  const blogs = (await subsStore("readonly", (s) => s.getAll())) || [];
  for (const blog of blogs) {
    try {
      const res = await fetch(blog.feed, { cache: "no-store" });
      if (!res.ok) continue;
      const items = feedItems(await res.text());
      const fresh = items.filter((i) => !blog.seen.includes(i.guid));
      if (!fresh.length) continue;
      const one = fresh.length === 1;
      await self.registration.showNotification(one ? `New post · ${blog.name}` : `${fresh.length} new posts · ${blog.name}`, {
        body: one ? fresh[0].title : fresh.slice(0, 3).map((i) => i.title).join("\n"),
        icon: "/assets/images/logo.svg",
        tag: blog.feed,
        data: { url: one ? fresh[0].link : blog.blogUrl },
      });
      blog.seen = [...new Set([...items.map((i) => i.guid), ...blog.seen])].slice(0, 500);
      await subsStore("readwrite", (s) => s.put(blog));
    } catch {
      // offline or the feed moved: try again next time
    }
  }
}

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "mz-blog-check") event.waitUntil(checkSubscriptions());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "mz-check-subscriptions") event.waitUntil(checkSubscriptions());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
    if (win) {
      await win.focus();
      return win.navigate(url).catch(() => self.clients.openWindow(url));
    }
    return self.clients.openWindow(url);
  })());
});
