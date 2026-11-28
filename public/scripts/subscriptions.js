// ============================================================================
// BLOG SUBSCRIPTIONS — notifications without accounts or a server-side list.
// The reader's browser keeps the blogs it follows (IndexedDB, shared with the
// service worker) and which posts it has already seen. The service worker
// checks those blogs' RSS feeds in the background (Periodic Background Sync,
// Chromium browsers with the site installed as an app) and whenever the site
// is opened, then shows a notification for new posts. Nothing is sent to or
// stored by the site's server.
// ============================================================================

const DB = "mz-subscriptions";
const STORE = "blogs";
export const SYNC_TAG = "mz-blog-check";

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "feed" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result?.result);
    t.onerror = () => reject(t.error);
  });
}

const unescapeXml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** [{ title, link, guid }] from an RSS document (the site's own feed format). */
export function feedItems(xml) {
  const tag = (block, name) => unescapeXml(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1]?.trim() || "");
  return [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, block]) => {
    const link = tag(block, "link");
    return { title: tag(block, "title"), link, guid: tag(block, "guid") || link };
  });
}

export const supported = () => "serviceWorker" in navigator && "Notification" in window && "indexedDB" in window;

export async function isSubscribed(feed) {
  try {
    return Boolean(await tx("readonly", (s) => s.get(feed)));
  } catch {
    return false;
  }
}

/**
 * Follows a blog. Resolves to "background" when the browser will check in the
 * background, "on-visit" when it only checks while the site is open, or
 * "denied" when notifications were refused.
 */
export async function subscribe({ feed, name, blogUrl }) {
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return "denied";
  // Everything already published counts as seen: only later posts notify
  let seen = [];
  try {
    const res = await fetch(feed, { cache: "no-store" });
    if (res.ok) seen = feedItems(await res.text()).map((i) => i.guid);
  } catch { /* offline: the first check marks what it finds */ }
  await tx("readwrite", (s) => s.put({ feed, name, blogUrl, seen, added: new Date().toISOString() }));
  return (await enableBackgroundChecks()) ? "background" : "on-visit";
}

export async function unsubscribe(feed) {
  await tx("readwrite", (s) => s.delete(feed));
  const left = await tx("readonly", (s) => s.count());
  if (!left) {
    const reg = await navigator.serviceWorker.ready;
    await reg.periodicSync?.unregister(SYNC_TAG).catch(() => {});
  }
}

/** Asks for background checks about every 6 hours (the browser decides the real rhythm). */
async function enableBackgroundChecks() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.periodicSync) return false;
    const status = await navigator.permissions.query({ name: "periodic-background-sync" });
    if (status.state !== "granted") return false; // granted once the site is installed as an app
    await reg.periodicSync.register(SYNC_TAG, { minInterval: 6 * 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}

/** On each visit (at most hourly): the service worker checks followed blogs now. */
export async function checkOnVisit() {
  try {
    if (!supported() || Notification.permission !== "granted") return;
    const last = Number(localStorage.getItem("mz-subs-checked") || 0);
    if (Date.now() - last < 60 * 60 * 1000) return;
    if (!(await tx("readonly", (s) => s.count()))) return;
    localStorage.setItem("mz-subs-checked", String(Date.now()));
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "mz-check-subscriptions" });
    enableBackgroundChecks(); // the site may have been installed since
  } catch { /* storage blocked: nothing to check */ }
}
