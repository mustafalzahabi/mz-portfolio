// ============================================================================
// REMOTE SOURCES — GitHub API, raw hosts, Google Drive API v3
// Rate-limit budget: the GitHub REST API allows 60 unauthenticated requests
// per hour. Only the user profile, repo list and gist list use it; file
// contents (gists, READMEs) come from raw hosts, which don't count.
// ============================================================================

import { debug, warn } from "./log.js";

const GH_API = "https://api.github.com";

// ============================================================================
// RATE LIMIT TRACKING
// ============================================================================

const RL_KEY = "mz-rate-limited";
const rateLimit = { remaining: null, resetAt: 0, limited: false };

(function loadPersistedRateLimit() {
  try {
    const data = JSON.parse(localStorage.getItem(RL_KEY) || "null");
    if (data?.resetAt && Date.now() < data.resetAt) {
      rateLimit.limited = true;
      rateLimit.resetAt = data.resetAt;
    } else {
      localStorage.removeItem(RL_KEY);
    }
  } catch {
    /* storage unavailable */
  }
})();

function trackRateLimit(res) {
  if (!res.url.startsWith(GH_API)) return;
  const remaining = res.headers.get("x-ratelimit-remaining");
  const reset = res.headers.get("x-ratelimit-reset");
  if (remaining !== null) rateLimit.remaining = parseInt(remaining, 10);
  if (reset) rateLimit.resetAt = parseInt(reset, 10) * 1000;
  rateLimit.limited =
    (rateLimit.remaining !== null && rateLimit.remaining <= 0) ||
    ((res.status === 403 || res.status === 429) && remaining === "0");
  try {
    if (rateLimit.limited) localStorage.setItem(RL_KEY, JSON.stringify({ resetAt: rateLimit.resetAt }));
    else if (rateLimit.remaining > 0) localStorage.removeItem(RL_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function isRateLimited() {
  if (rateLimit.limited && rateLimit.resetAt && Date.now() >= rateLimit.resetAt) rateLimit.limited = false;
  return rateLimit.limited;
}

export function getRateLimitResetAt() {
  return rateLimit.resetAt || Date.now() + 60 * 60 * 1000;
}

// ============================================================================
// HTTP WITH ETAG CACHE (localStorage)
// 304 responses don't count against the GitHub rate limit.
// ============================================================================

function readCache(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeCache(key, data, etag) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, etag, timestamp: Date.now() }));
  } catch {
    pruneCache();
  }
}

/** Frees space by removing the oldest mz-cache-* entries. */
function pruneCache() {
  try {
    const entries = Object.keys(localStorage)
      .filter((k) => k.startsWith("mz-cache-"))
      .map((k) => ({ k, t: readCache(k)?.timestamp || 0 }))
      .sort((a, b) => a.t - b.t);
    entries.slice(0, Math.ceil(entries.length / 2)).forEach(({ k }) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/**
 * Fetch with ETag revalidation. Returns { status, data, fromCache }.
 * status: HTTP status, or 0 on network failure.
 */
export async function cachedFetch(url, cacheKey, { as = "json", headers = {}, maxAge = 0 } = {}) {
  const cached = readCache(cacheKey);
  if (cached && maxAge && Date.now() - cached.timestamp < maxAge) {
    return { status: 200, data: cached.data, fromCache: true };
  }

  const reqHeaders = { ...headers };
  if (cached?.etag) reqHeaders["If-None-Match"] = cached.etag;

  let res;
  try {
    res = await fetch(url, { headers: reqHeaders });
  } catch (e) {
    warn("network error", url, e.message);
    return cached ? { status: 200, data: cached.data, fromCache: true, stale: true } : { status: 0, data: null };
  }
  trackRateLimit(res);

  if (res.status === 304 && cached) {
    writeCache(cacheKey, cached.data, cached.etag);
    return { status: 200, data: cached.data, fromCache: true };
  }
  if (!res.ok) {
    debug("fetch failed", res.status, url);
    if (cached && res.status !== 404) return { status: 200, data: cached.data, fromCache: true, stale: true };
    return { status: res.status, data: null };
  }

  const data = as === "text" ? await res.text() : await res.json();
  writeCache(cacheKey, data, res.headers.get("etag") || "");
  return { status: 200, data, fromCache: false };
}

/** Plain fetch for raw hosts (no rate limit). Returns text or null. */
export async function fetchText(url) {
  try {
    const res = await fetch(url);
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Runs async tasks with limited concurrency. */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// ============================================================================
// GITHUB
// ============================================================================

/** Returns { status: "ok" | "notfound" | "ratelimited" | "error", user } */
export async function fetchGithubUser(username) {
  const { status, data } = await cachedFetch(`${GH_API}/users/${encodeURIComponent(username)}`, `mz-cache-gh-user-${username}`);
  if (data) return { status: "ok", user: data };
  if (status === 404) return { status: "notfound", user: null };
  if (isRateLimited() || status === 403 || status === 429) return { status: "ratelimited", user: null };
  return { status: "error", user: null };
}

export async function fetchGistList(username, maxPages = 3) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const { status, data } = await cachedFetch(
      `${GH_API}/users/${encodeURIComponent(username)}/gists?per_page=100&page=${page}`,
      `mz-cache-gists-${username}-${page}`,
    );
    if (!Array.isArray(data)) {
      if (status === 403 || status === 429) return { gists: all, rateLimited: true };
      break;
    }
    all.push(...data);
    if (data.length < 100) break;
  }
  return { gists: all, rateLimited: false };
}

export async function fetchRepos(username) {
  const { data } = await cachedFetch(
    `${GH_API}/users/${encodeURIComponent(username)}/repos?type=owner&sort=pushed&per_page=100`,
    `mz-cache-repos-${username}`,
  );
  if (!Array.isArray(data)) return [];
  return data.map((repo) => ({
    name: repo.name,
    description: repo.description || "",
    technologies: [repo.language, ...(repo.topics || [])].filter(Boolean),
    language: repo.language || "",
    topics: repo.topics || [],
    github_link: repo.html_url,
    live_link: repo.homepage || "",
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    fork: !!repo.fork,
    archived: !!repo.archived,
    owner: repo.owner?.login || username,
    defaultBranch: repo.default_branch || "main",
    updatedAt: repo.pushed_at || repo.updated_at || "",
    isGitHubRepo: true,
  }));
}

const README_NAMES = ["README.md", "readme.md", "Readme.md", "README.markdown", "README"];

/** Fetches a README from raw.githubusercontent.com (no API cost). */
export async function fetchReadme(owner, repo, branch = "main") {
  const cacheKey = `mz-cache-readme-${owner}-${repo}`;
  const cached = readCache(cacheKey);
  if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) return cached.data;
  for (const name of README_NAMES) {
    const text = await fetchText(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${name}`);
    if (text !== null) {
      writeCache(cacheKey, text, "");
      return text;
    }
  }
  writeCache(cacheKey, "", "");
  return cached?.data || "";
}

// ============================================================================
// README PARSING
// ============================================================================

const BADGE_PATTERNS = [
  "shields.io", "badge", "travis-ci", "circleci.com", "codecov.io", "coveralls.io",
  "david-dm.org", "snyk.io", "gitter.im", "/workflows/", "actions/workflows", "badgen.net",
  "forthebadge", "github-readme-stats", "komarev.com", "visitor-badge",
];

export function extractReadmeImages(readme, owner, repo, branch) {
  const images = [];
  const seen = new Set();
  const add = (url) => {
    if (!url || seen.has(url)) return;
    const lower = url.toLowerCase();
    if (BADGE_PATTERNS.some((p) => lower.includes(p))) return;
    if (/\.svg(\?|$)/i.test(lower) && !lower.includes("raw")) return;
    seen.add(url);
    if (/^https?:\/\//i.test(url)) images.push(url);
    else if (!/^[a-z]+:/i.test(url)) {
      const path = url.replace(/^\.?\//, "");
      images.push(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`);
    }
  };
  let m;
  const md = /!\[[^\]]*\]\(\s*<?([^\s)>]+)/g;
  while ((m = md.exec(readme))) add(m[1]);
  const html = /<img\s[^>]*src=["']([^"']+)["']/gi;
  while ((m = html.exec(readme))) add(m[1]);
  return images;
}

/** First real paragraph of a README (skips headings, badges, images, HTML). */
export function extractReadmeSummary(readme) {
  for (const block of String(readme || "").split(/\n\s*\n/)) {
    const t = block.trim();
    if (!t || /^(#|!\[|<|\[!\[|```|---|\||>)/.test(t)) continue;
    return t.replace(/\s+/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "");
  }
  return "";
}

// ============================================================================
// GOOGLE DRIVE (API v3 with a referrer-restricted browser key)
// The deployer sets <meta name="mz-google-api-key" content="…"> in index.html.
// ============================================================================

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

export function getDriveApiKey() {
  return document.querySelector('meta[name="mz-google-api-key"]')?.content?.trim() || "";
}

async function driveJson(url) {
  try {
    const res = await fetch(url);
    if (res.ok) return { status: 200, data: await res.json() };
    return { status: res.status, data: null };
  } catch {
    return { status: 0, data: null };
  }
}

/** Returns { status: "ok"|"nokey"|"notfound"|"error", meta } */
export async function fetchDriveMeta(id) {
  const key = getDriveApiKey();
  if (!key) return { status: "nokey", meta: null };
  const fields = "id,name,mimeType,modifiedTime,createdTime,webViewLink";
  const { status, data } = await driveJson(
    `${DRIVE_API}/${encodeURIComponent(id)}?fields=${fields}&supportsAllDrives=true&key=${encodeURIComponent(key)}`,
  );
  if (data) return { status: "ok", meta: data };
  if (status === 404 || status === 403) return { status: "notfound", meta: null };
  return { status: "error", meta: null };
}

export async function listDriveFolder(folderId) {
  const key = getDriveApiKey();
  const q = encodeURIComponent(`'${folderId.replace(/'/g, "")}' in parents and trashed = false`);
  const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime,createdTime,webViewLink)");
  const { data } = await driveJson(
    `${DRIVE_API}?q=${q}&fields=${fields}&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${encodeURIComponent(key)}`,
  );
  return data?.files || [];
}

export async function downloadDriveFile(id) {
  const key = getDriveApiKey();
  return fetchText(`${DRIVE_API}/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(key)}`);
}

// Sections of a README that are about running the code, not about the project
const README_SKIP = /^(install|setup|set up|getting started|quick ?start|usage|how to (run|use|install)|run(ning)?( locally)?|local development|development|build(ing)?|deploy(ment|ing)?|license|licen[cs]e|contribut|tests?|testing|scripts|commands|requirements|prerequisites|configuration|config|environment|env|faq|credits|acknowledg|changelog|roadmap|table of contents|contents|toc|support|contact|author|screenshots?|demo|preview|api( reference)?|folder structure|project structure|directory structure|file structure|tech stack|built with|technologies|dependencies|badges?|status)/i;

/**
 * The part of a README that describes the project: its intro paragraphs and
 * descriptive sections (features, about, overview…), as Markdown without
 * images, badges, HTML, code, tables or setup / license sections.
 */
export function extractReadmeAbout(readme, { maxBlocks = 6 } = {}) {
  const lines = String(readme || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let current = [];
  let skipping = false;
  let fence = false;
  let sawTitle = false;
  const flush = () => {
    const text = current.join("\n").trim();
    current = [];
    if (!text || skipping) return;
    if (/^(\||<|>|-{3,}|\*{3,}|_{3,})/.test(text)) return; // tables, HTML, quotes, rules
    const clean = text
      .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "") // linked badges
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
      .replace(/<[^>]+>/g, "") // inline HTML
      .replace(/[ \t]+\n/g, "\n")
      .trim();
    if (clean.replace(/[-*+\d.\s]/g, "").length < 3) return;
    blocks.push(clean);
  };
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      flush();
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      flush();
      const text = heading[2].replace(/[^\w\s&'-]/g, "").trim();
      if (heading[1].length === 1 && !sawTitle) {
        sawTitle = true; // the project's name: already the page title
        continue;
      }
      skipping = README_SKIP.test(text);
      if (!skipping && blocks.length) blocks.push(`**${heading[2].replace(/[*_`]/g, "").trim()}**`);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();
  // Drop a section label left with nothing after it, then cap the length
  const out = blocks.filter((b, i) => !(/^\*\*.*\*\*$/.test(b) && (i === blocks.length - 1 || /^\*\*.*\*\*$/.test(blocks[i + 1]))));
  return out.slice(0, maxBlocks).join("\n\n");
}
