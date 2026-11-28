// ============================================================================
// ACCOUNT LINK — one account across a GitHub and a Google sign-in, with no
// database. Connecting the second provider (while signed in to the first)
// proves both belong to the same person; the link is then written privately
// to both: a secret gist and Drive's hidden app folder, as
// mz-portfolio-account.json. Signing in with either one later reads it.
// This device keeps a copy (localStorage) so pages know right away.
// A matching email alone never links anything: anyone could register that
// email with the other provider.
// ============================================================================

export const ACCOUNT_FILE = "mz-portfolio-account.json";
const CACHE_KEY = "mz-account";
const STORE_CHOICES = ["github", "google"];

export const DEFAULT_PREFS = Object.freeze({
  primary: "github", // whose name / photo / address leads
  publishTo: "both", // "both" | "github" | "google"
  newPostsTo: "", // "" = the primary store
  imagesTo: "",
  sources: { resume: {}, posts: "both" },
});

const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);

/** Fills in and validates prefs (anything unknown falls back to the default). */
export function normalizePrefs(raw = {}) {
  const p = raw && typeof raw === "object" ? raw : {};
  const resume = {};
  for (const [k, v] of Object.entries(p.sources?.resume || {})) {
    if (/^[A-Za-z]{1,30}$/.test(k) && ["auto", ...STORE_CHOICES].includes(v)) resume[k] = v;
  }
  return {
    primary: oneOf(p.primary, STORE_CHOICES, DEFAULT_PREFS.primary),
    publishTo: oneOf(p.publishTo, ["both", ...STORE_CHOICES], "both"),
    newPostsTo: oneOf(p.newPostsTo, ["", ...STORE_CHOICES], ""),
    imagesTo: oneOf(p.imagesTo, ["", ...STORE_CHOICES], ""),
    sources: { resume, posts: oneOf(p.sources?.posts, ["both", ...STORE_CHOICES], "both") },
  };
}

/** A record read from storage or the cache, cleaned up; null when it isn't one. */
export function normalizeRecord(raw) {
  if (!raw || typeof raw !== "object" || raw.v !== 1) return null;
  const login = str(raw.github?.login, 39);
  const email = str(raw.google?.email, 254).toLowerCase();
  if (!login && !email) return null;
  return {
    v: 1,
    github: login ? { login, id: Number(raw.github.id) || null } : null,
    google: email ? { email, folderId: /^[A-Za-z0-9_-]{10,}$/.test(raw.google.folderId || "") ? raw.google.folderId : "" } : null,
    prefs: normalizePrefs(raw.prefs),
    linkedAt: str(raw.linkedAt, 40),
    updatedAt: str(raw.updatedAt, 40),
  };
}

/** Both identities known: GitHub and Google are one account. */
export const isLinked = (rec) => Boolean(rec?.github?.login && rec?.google?.email);

/** Does this record belong to whoever is signed in? (either identity matches) */
export function recordMatches(rec, { githubLogin = "", googleEmail = "" } = {}) {
  if (!rec) return false;
  const gh = rec.github?.login && githubLogin && rec.github.login.toLowerCase() === githubLogin.toLowerCase();
  const g = rec.google?.email && googleEmail && rec.google.email === googleEmail.toLowerCase();
  return Boolean(gh || g);
}

/**
 * Two copies of the record (one per store) → one. Identities are combined,
 * prefs come from the copy saved last.
 */
export function mergeRecords(a, b) {
  const x = normalizeRecord(a);
  const y = normalizeRecord(b);
  if (!x || !y) return x || y;
  const [newer, older] = (Date.parse(x.updatedAt) || 0) >= (Date.parse(y.updatedAt) || 0) ? [x, y] : [y, x];
  return {
    v: 1,
    github: newer.github || older.github,
    google: newer.google ? { ...newer.google, folderId: newer.google.folderId || older.google?.folderId || "" } : older.google,
    prefs: newer.prefs,
    linkedAt: newer.linkedAt || older.linkedAt,
    updatedAt: newer.updatedAt,
  };
}

/** A new linked record from both signed-in identities (keeping prefs from what existed). */
export function makeLinkedRecord({ github, google, previous = null, now = new Date().toISOString() }) {
  return {
    v: 1,
    github: { login: github.login, id: github.id || null },
    google: { email: String(google.email || "").toLowerCase(), folderId: google.folderId || "" },
    prefs: normalizePrefs(previous?.prefs),
    linkedAt: previous && isLinked(previous) ? previous.linkedAt || now : now,
    updatedAt: now,
  };
}

/** What visitors may see: the two public addresses and the source choices. Never emails. */
export function publicSourcesOf(rec) {
  if (!isLinked(rec)) return null;
  const out = { github: rec.github.login, resume: rec.prefs.sources.resume, posts: rec.prefs.sources.posts };
  if (rec.google.folderId) out.drive = rec.google.folderId;
  return out;
}

// ---------- this device's copy ----------

export function readCachedAccount() {
  try {
    return normalizeRecord(JSON.parse(localStorage.getItem(CACHE_KEY) || "null"));
  } catch {
    return null;
  }
}

export function writeCachedAccount(rec) {
  try {
    if (rec) localStorage.setItem(CACHE_KEY, JSON.stringify(rec));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage unavailable: the link is read from your account each time */
  }
}
