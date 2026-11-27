// ============================================================================
// COMBINE — one portfolio from two stores (GitHub gists and a Google Drive
// folder) of the same linked account. Pure functions, no network.
//
// Resume: section by section. A section only one store has is used as is;
// when both have it, the store updated most recently wins, unless the owner
// picked a store for that section. `basics` is combined field by field and
// the site config key by key, with the same rule.
// Posts: everything from both (or only the chosen store); the same post
// (same slug) in both → the newer copy.
// ============================================================================

export const STORES = ["github", "google"];
export const STORE_LABEL = { github: "GitHub", google: "Google Drive" };
const CONFIG_KEY = "mz-portfolio-config";

const time = (v) => {
  const t = Date.parse(v || "");
  return Number.isFinite(t) ? t : 0;
};

/** Nothing worth keeping: undefined, null, "", [] or {} (all empty). */
export function isBlank(v) {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.values(v).every(isBlank);
  return false;
}

const newestFirst = (parts) => parts.filter((p) => p && p.resume).slice().sort((a, b) => time(b.updatedAt) - time(a.updatedAt));

/** Picks a value for one key: the chosen store's, else the newest store that has one. */
function pick(parts, get, choice) {
  if (choice && choice !== "auto") {
    const chosen = parts.find((p) => p.store === choice);
    const v = chosen && get(chosen.resume);
    if (!isBlank(v)) return { value: v, from: chosen.store };
  }
  for (const p of parts) {
    const v = get(p.resume);
    if (!isBlank(v)) return { value: v, from: p.store };
  }
  return { value: undefined, from: null };
}

const configOf = (resume) => {
  const c = resume?.meta?.[CONFIG_KEY];
  return (Array.isArray(c) ? c[0] : c) || undefined;
};

/**
 * @param {{ store: "github"|"google", resume: object, updatedAt?: string }[]} parts
 * @param {{ resume?: Record<string, "auto"|"github"|"google"> }} [sources]
 * @returns {{ resume: object|null, origins: Record<string, string> }}
 *   origins: which store each section (and "basics.<field>", "config.<key>") came from
 */
export function combineResumes(parts, sources = {}) {
  const list = newestFirst(parts);
  if (!list.length) return { resume: null, origins: {} };
  if (list.length === 1) return { resume: structuredClone(list[0].resume), origins: {} };
  const choice = sources.resume || {};
  const resume = {};
  const origins = {};
  const keys = [...new Set(list.flatMap((p) => Object.keys(p.resume)))];

  for (const key of keys) {
    if (key === "basics") {
      const fields = [...new Set(list.flatMap((p) => Object.keys(p.resume.basics || {})))];
      const basics = {};
      for (const f of fields) {
        const r = pick(list, (x) => x.basics?.[f], choice.basics);
        if (r.from) {
          basics[f] = structuredClone(r.value);
          origins[`basics.${f}`] = r.from;
        }
      }
      resume.basics = basics;
    } else if (key === "meta") {
      const metaKeys = [...new Set(list.flatMap((p) => Object.keys(p.resume.meta || {})))].filter((k) => k !== CONFIG_KEY);
      const meta = {};
      for (const k of metaKeys) {
        const r = pick(list, (x) => x.meta?.[k], choice.meta);
        if (r.from) meta[k] = structuredClone(r.value);
      }
      // The site config, key by key
      const cfgKeys = [...new Set(list.flatMap((p) => Object.keys(configOf(p.resume) || {})))];
      if (cfgKeys.length) {
        const config = {};
        for (const k of cfgKeys) {
          const r = pick(list, (x) => configOf(x)?.[k], choice.config);
          if (r.from) {
            config[k] = structuredClone(r.value);
            origins[`config.${k}`] = r.from;
          }
        }
        meta[CONFIG_KEY] = config;
      }
      if (Object.keys(meta).length) resume.meta = meta;
    } else {
      const r = pick(list, (x) => x[key], choice[key]);
      if (r.from) {
        resume[key] = structuredClone(r.value);
        origins[key] = r.from;
      }
    }
  }
  return { resume, origins };
}

/**
 * @param {{ store: string, posts: object[] }[]} lists
 * @param {{ posts?: "both"|"github"|"google" }} [sources]
 * @returns {object[]} posts, each with .store, newest date first
 */
export function combinePosts(lists, sources = {}) {
  const only = sources.posts && sources.posts !== "both" ? sources.posts : null;
  const bySlug = new Map();
  for (const { store, posts } of lists) {
    if (only && store !== only) continue;
    for (const post of posts || []) {
      const item = { ...post, store };
      const had = bySlug.get(post.slug);
      const when = (p) => time(p.updatedAt) || time(p.date);
      if (!had || when(item) > when(had)) bySlug.set(post.slug, item);
    }
  }
  return [...bySlug.values()].sort((a, b) => time(b.date) - time(a.date));
}

/** Which store was updated last ("" when unknown). */
export function newestStore(parts) {
  return newestFirst(parts)[0]?.store || "";
}

/** The account's public addresses, as kept in the published config: { github: login, drive: folderId }. */
export function publicSources(resume) {
  const s = configOf(resume)?.sources;
  if (!s || typeof s !== "object") return null;
  const github = typeof s.github === "string" && /^[A-Za-z0-9-]{1,39}$/.test(s.github) ? s.github : "";
  const drive = typeof s.drive === "string" && /^[A-Za-z0-9_-]{10,}$/.test(s.drive) ? s.drive : "";
  return github || drive ? { github, drive, resume: s.resume && typeof s.resume === "object" ? s.resume : {}, posts: ["both", ...STORES].includes(s.posts) ? s.posts : "both" } : null;
}
