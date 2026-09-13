// ============================================================================
// UNIFIED DATA COLLECTION
// Collects data from resume.json gist + GitHub profile + repos,
// merges into a single structure, stores in localStorage.
// ============================================================================

import {
  fetchGithubUserProfile,
  fetchAndMergeProjects,
  checkUserExists,
  isRateLimited,
  getRateLimitResetMs,
} from "./api.js";

import { parseFrontmatter, slugify } from "./utils.js";

const STORAGE_KEY = "mz-portfolio-data";
const GIST_LIST_CACHE_KEY = "mz-cache-gist-list";
const GIST_LIST_TTL = 60 * 60 * 1000; // 1 hour
const MAX_GIST_PAGES = 3; // Fetch up to 300 gists (3 pages x 100)
const LAST_USER_KEY = "mz-last-user";

// ---------------------------------------------------------------------------
// Cache key helpers (per-user caching)
// ---------------------------------------------------------------------------

function getUserCacheKey(username) {
  return `${STORAGE_KEY}-${username || "unknown"}`;
}

// ---------------------------------------------------------------------------
// Get resume filename from URL (?gistname= parameter) or default to resume.json
// ---------------------------------------------------------------------------

function getResumeFilename() {
  const params = new URLSearchParams(window.location.search);
  const gistname = params.get("gistname");
  // Sanitize: strip .json extension if user includes it, we add it back
  if (gistname) {
    const clean = gistname.replace(/\.json$/i, "");
    // Only allow alphanumeric, hyphens, underscores
    if (/^[a-zA-Z0-9_-]+$/.test(clean)) {
      return `${clean}.json`;
    }
  }
  return "resume.json";
}

// ---------------------------------------------------------------------------
// Gist list fetcher (paginated, cached, shared between resume + blog)
// ---------------------------------------------------------------------------

async function fetchGistList(username) {
  const cacheKey = `${GIST_LIST_CACHE_KEY}-${username}`;
  const now = Date.now();

  // Check cache first - but only if data is non-empty
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (cached && cached.data && Array.isArray(cached.data) && cached.data.length > 0 && now - cached.timestamp < GIST_LIST_TTL) {
      console.log("[data] using cached gist list for", username, `(${cached.data.length} gists)`);
      return cached.data;
    }
  } catch (_) { /* ignore */ }

  // Fetch paginated gist list
  const allGists = [];
  let page = 1;
  let rateLimited = false;

  while (page <= MAX_GIST_PAGES) {
    try {
      const headers = {};
      // Try ETag conditional request on first page only
      if (page === 1) {
        try {
          const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
          if (cached?.etag) headers["If-None-Match"] = cached.etag;
        } catch (_) { /* ignore */ }
      }

      const res = await fetch(
        `https://api.github.com/users/${username}/gists?per_page=100&page=${page}`,
        { headers },
      );

      if (res.status === 304) {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
        if (cached?.data && cached.data.length > 0) {
          console.log("[data] gist list 304, using cache for", username);
          cached.timestamp = Date.now();
          localStorage.setItem(cacheKey, JSON.stringify(cached));
          return cached.data;
        }
        // 304 but no cached data - break and return what we have
        break;
      }

      if (res.status === 403) {
        console.warn(`[data] GitHub API rate limited (403) on page ${page}`);
        rateLimited = true;
        break;
      }

      if (!res.ok) {
        console.warn(`[data] GitHub API returned ${res.status} on page ${page}`);
        break;
      }

      const gists = await res.json();
      if (!Array.isArray(gists) || gists.length === 0) break;

      allGists.push(...gists);

      // If we got fewer than 100, there are no more pages
      if (gists.length < 100) break;

      page++;
    } catch (e) {
      console.warn(`[data] Could not fetch gist list page ${page}:`, e.message);
      break;
    }
  }

  // Cache the results (even if empty, but not if rate limited)
  if (!rateLimited && allGists.length > 0) {
    try {
      const etag = ""; // ETag only works for page 1, skip for multi-page
      localStorage.setItem(cacheKey, JSON.stringify({ data: allGists, etag, timestamp: Date.now() }));
    } catch (_) { /* quota exceeded */ }
  }

  console.log(`[data] fetched ${allGists.length} gists across ${page} page(s) for ${username}${rateLimited ? ' (rate limited)' : ''}`);
  return allGists;
}

// ---------------------------------------------------------------------------
// Gist fetcher (exact filename match, content from list → single → raw_url)
// ---------------------------------------------------------------------------

async function fetchResumeGist(username) {
  const targetFile = getResumeFilename();
  console.log(`[data] looking for gist with file: ${targetFile}`);

  try {
    const gists = await fetchGistList(username);
    if (!gists || gists.length === 0) return null;

    // Find gist containing the target file
    const gist = gists.find(
      (g) => g.files && Object.keys(g.files).some((n) => n === targetFile),
    );
    if (!gist) {
      console.warn(`[data] no gist found with file "${targetFile}" for ${username}`);
      return null;
    }

    const fileKey = Object.keys(gist.files).find((n) => n === targetFile);

    // 1) Inline content (list endpoint — usually absent)
    if (gist.files[fileKey]?.content) {
      try {
        return JSON.parse(gist.files[fileKey].content);
      } catch (_) {
        /* fall through */
      }
    }

    // 2) Single-gist endpoint (includes content field)
    try {
      const singleRes = await fetch(
        `https://api.github.com/gists/${gist.id}`,
      );
      if (singleRes.ok) {
        const single = await singleRes.json();
        const key = Object.keys(single.files).find((n) => n === targetFile);
        if (key && single.files[key]?.content) {
          return JSON.parse(single.files[key].content);
        }
      }
    } catch (_) {
      /* fall through */
    }

    // 3) Raw URL fallback
    const rawRes = await fetch(gist.files[fileKey].raw_url);
    if (rawRes.ok) return await rawRes.json();
  } catch (e) {
    console.warn("[data] Could not fetch resume gist:", e.message);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Google Drive fetcher (public folder with resume.json)
// ---------------------------------------------------------------------------

async function fetchResumeFromGDrive(fileId) {
  try {
    // Direct download URL for publicly shared files (no API key needed)
    const downloadUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      console.warn(`[data] Google Drive download returned ${res.status}`);
      return null;
    }
    const text = await res.text();
    // Google may return an HTML page instead of JSON if the file isn't public
    // or if there's a confirmation page we didn't bypass
    if (text.trim().startsWith('<')) {
      console.warn('[data] Google Drive returned HTML instead of JSON — file may not be public');
      return null;
    }
    return JSON.parse(text);
  } catch (e) {
    console.warn('[data] Could not fetch resume.json from Google Drive:', e.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Blog posts fetcher (gists with .md files + YAML frontmatter)
// ---------------------------------------------------------------------------

export async function fetchBlogPosts(username) {
  try {
    const gists = await fetchGistList(username);
    if (!gists || gists.length === 0) return [];

    const targetFile = getResumeFilename();
    const mdGists = gists.filter((g) => {
      const files = Object.keys(g.files);
      return (
        files.some((f) => f.endsWith(".md")) &&
        !files.some((f) => f === targetFile)
      );
    });

    const posts = [];
    for (const gist of mdGists) {
      try {
        const singleRes = await fetch(
          `https://api.github.com/gists/${gist.id}`,
        );
        if (!singleRes.ok) continue;
        const single = await singleRes.json();

        const mdFile = Object.values(single.files).find((f) =>
          f.filename.endsWith(".md"),
        );
        if (!mdFile?.content) continue;

        const { metadata, body } = parseFrontmatter(mdFile.content);
        if (metadata.draft === true || metadata.published === false) continue;

        const title =
          metadata.title ||
          gist.description ||
          mdFile.filename.replace(/\.md$/i, "");
        const slug = slugify(title);

        posts.push({
          title,
          slug,
          date: metadata.date || gist.created_at,
          tags: metadata.tags || [],
          description: metadata.description || metadata.preview || "",
          image: metadata.image || "",
          body,
          gistId: gist.id,
          gistUrl: gist.html_url,
          updatedAt: gist.updated_at,
        });
      } catch (_) {
        /* skip failed gist */
      }
    }

    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    return posts;
  } catch (e) {
    console.warn("[data] Could not fetch blog posts:", e.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Merge helpers
// ---------------------------------------------------------------------------

function normalizeUrl(url) {
  if (!url) return "";
  return url.replace(/\/+$/, "").toLowerCase();
}

function addProfile(profiles, network, url) {
  if (!url) return;
  const norm = normalizeUrl(url);
  if (!profiles.some((p) => normalizeUrl(p.url) === norm)) {
    profiles.push({ network, url });
  }
}

function mergeProfiles(resumeProfiles, ghProfile, username) {
  const profiles = [];

  // Resume.json profiles
  if (Array.isArray(resumeProfiles)) {
    for (const p of resumeProfiles) {
      if (p.network && p.url) {
        addProfile(profiles, p.network, p.url);
      }
    }
  }

  // GitHub profile URL
  addProfile(profiles, "github", ghProfile?.html_url);

  // GitHub blog/website
  if (ghProfile?.blog) {
    const blog = ghProfile.blog.startsWith("http")
      ? ghProfile.blog
      : `https://${ghProfile.blog}`;
    // Only add if not already present as github
    if (!profiles.some((p) => normalizeUrl(p.url) === normalizeUrl(blog))) {
      addProfile(profiles, "website", blog);
    }
  }

  return profiles;
}

function mergeSkills(resumeSkills, repos) {
  // Collect languages from repos
  const langMap = {};
  for (const repo of repos || []) {
    for (const lang of repo.technologies || []) {
      if (!langMap[lang]) langMap[lang] = 0;
      langMap[lang]++;
    }
  }
  const ghLanguages = Object.keys(langMap).sort(
    (a, b) => langMap[b] - langMap[a],
  );

  if (ghLanguages.length === 0 && (!resumeSkills || resumeSkills.length === 0)) {
    return null;
  }

  const categories = [];

  // Resume.json skills
  if (resumeSkills && resumeSkills.length > 0) {
    for (const skill of resumeSkills) {
      categories.push({
        category: skill.name || "Skills",
        items: skill.keywords || [],
      });
    }
  }

  // GitHub languages as a skill category (avoid duplicates)
  if (ghLanguages.length > 0) {
    const existingItems = new Set(
      categories.flatMap((c) => c.items.map((i) => i.toLowerCase())),
    );
    const newLangs = ghLanguages.filter(
      (l) => !existingItems.has(l.toLowerCase()),
    );
    if (newLangs.length > 0) {
      categories.push({
        category: "Languages & Technologies",
        items: newLangs,
      });
    }
  }

  return categories.length > 0 ? categories : null;
}

function mergeProjects(resumeProjects, ghProjects) {
  if (!Array.isArray(resumeProjects) && !Array.isArray(ghProjects)) return null;
  if (!Array.isArray(ghProjects)) {
    return (resumeProjects || []).map((p) => normalizeResumeProject(p));
  }
  if (!Array.isArray(resumeProjects)) return ghProjects;

  const merged = [];
  const matchedRepoIndices = new Set();

  for (const rp of resumeProjects) {
    const match = findMatchingRepo(rp, ghProjects, matchedRepoIndices);
    if (match) {
      merged.push(mergePair(rp, match.repo));
      matchedRepoIndices.add(match.index);
    } else {
      merged.push(normalizeResumeProject(rp));
    }
  }

  for (let i = 0; i < ghProjects.length; i++) {
    if (!matchedRepoIndices.has(i)) {
      merged.push(ghProjects[i]);
    }
  }

  return merged.length > 0 ? merged : null;
}

function normalizeResumeProject(p) {
  return {
    name: p.name || "",
    description: p.description || "",
    technologies: p.keywords || [],
    github_link: p.github || p.url || "",
    live_link: p.demo || "",
    image: p.image || "",
    allImages: p.images || [],
    readmeDescription: p.description || "",
    fullReadme: "",
    stars: null,
    isGitHubRepo: false,
    highlights: p.highlights || [],
    startDate: p.startDate || "",
    endDate: p.endDate || "",
  };
}

function mergePair(resumeProj, repo) {
  const mergedTech = [
    ...new Set([
      ...(repo.technologies || []),
      ...(resumeProj.keywords || []),
    ]),
  ];

  const resumeDesc = resumeProj.description || "";
  const repoDesc = repo.description || "";
  const description =
    resumeDesc.length > repoDesc.length ? resumeDesc : repoDesc;

  const readmeDescription =
    repo.readmeDescription || resumeDesc || repoDesc;

  const mergedImages = [
    ...new Set([...(repo.allImages || []), ...(resumeProj.images || [])]),
  ];
  const image =
    repo.image || resumeProj.image || mergedImages[0] || "";

  return {
    name: resumeProj.name || repo.name || "",
    description,
    technologies: mergedTech,
    github_link: repo.github_link || resumeProj.github || resumeProj.url || "",
    live_link: repo.live_link || resumeProj.demo || "",
    image,
    allImages: mergedImages,
    readmeDescription,
    fullReadme: repo.fullReadme || "",
    stars: repo.stars ?? null,
    isGitHubRepo: true,
    highlights: resumeProj.highlights || [],
    startDate: resumeProj.startDate || "",
    endDate: resumeProj.endDate || "",
  };
}

function findMatchingRepo(resumeProj, ghProjects, matchedIndices) {
  const resumeGithub = resumeProj.github || "";
  const resumeUrl = resumeProj.url || "";
  const resumeDemo = resumeProj.demo || "";

  // Signal 1: resume github/url field IS a github.com URL → match repo.html_url
  for (let i = 0; i < ghProjects.length; i++) {
    if (matchedIndices.has(i)) continue;
    const repoUrl = ghProjects[i].github_link || "";
    if (resumeGithub && urlsMatch(resumeGithub, repoUrl)) {
      return { repo: ghProjects[i], index: i };
    }
    if (resumeUrl && isGithubUrl(resumeUrl) && urlsMatch(resumeUrl, repoUrl)) {
      return { repo: ghProjects[i], index: i };
    }
  }

  // Signal 2: resume url/demo domain appears in repo description or homepage
  const resumeUrls = [resumeUrl, resumeDemo]
    .filter(Boolean)
    .map(extractDomain)
    .filter(Boolean);

  if (resumeUrls.length > 0) {
    for (let i = 0; i < ghProjects.length; i++) {
      if (matchedIndices.has(i)) continue;
      const desc = (ghProjects[i].description || "").toLowerCase();
      const homepage = (ghProjects[i].live_link || "").toLowerCase();
      for (const domain of resumeUrls) {
        if (desc.includes(domain) || homepage.includes(domain)) {
          return { repo: ghProjects[i], index: i };
        }
      }
    }
  }

  // Signal 3: normalized name match
  const normName = normalizeName(resumeProj.name || "");
  if (normName) {
    for (let i = 0; i < ghProjects.length; i++) {
      if (matchedIndices.has(i)) continue;
      const repoNorm = normalizeName(ghProjects[i].name || "");
      if (repoNorm === normName) {
        return { repo: ghProjects[i], index: i };
      }
    }
  }

  // Signal 4: partial name match + keyword overlap ≥ 50%
  const resumeKeywords = (resumeProj.keywords || []).map((k) =>
    k.toLowerCase(),
  );
  if (normName && resumeKeywords.length > 0) {
    for (let i = 0; i < ghProjects.length; i++) {
      if (matchedIndices.has(i)) continue;
      const repoName = normalizeName(ghProjects[i].name || "");
      const repoTech = (ghProjects[i].technologies || []).map((t) =>
        t.toLowerCase(),
      );

      const nameOverlap =
        repoName.includes(normName) || normName.includes(repoName);
      if (!nameOverlap) continue;

      const allTech = new Set([...resumeKeywords, ...repoTech]);
      const overlapCount = resumeKeywords.filter((k) => repoTech.includes(k))
        .length;
      const overlapRatio = overlapCount / allTech.size;

      if (overlapRatio >= 0.5) {
        return { repo: ghProjects[i], index: i };
      }
    }
  }

  return null;
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/^jsonresume-theme-/, "")
    .replace(/^@[^/]+\//, "")
    .replace(/[-_\s]+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function extractDomain(url) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isGithubUrl(url) {
  return /github\.com\/[^/]+\/[^/]+/.test(url);
}

function urlsMatch(a, b) {
  const normA = extractUrlRepo(a);
  const normB = extractUrlRepo(b);
  return normA && normB && normA === normB;
}

function extractUrlRepo(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!match) return null;
  return `${match[1].toLowerCase()}/${match[2].toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Main: collect and merge everything
// ---------------------------------------------------------------------------

export async function collectPortfolioData(identifier, source = 'gh') {
  console.log("[data] collecting for:", identifier, "source:", source);

  if (!identifier) {
    console.error("[data] no identifier provided!");
    return { _notFound: true };
  }

  const userCacheKey = getUserCacheKey(identifier);

  // 1. Read cache — keep both fresh (<1hr) and stale (any age)
  const CACHE_TTL = 60 * 60 * 1000;
  let freshCache = null;
  let staleCache = null;
  try {
    const raw = localStorage.getItem(userCacheKey);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && cached._cachedAt) {
        staleCache = cached;
        if (Date.now() - cached._cachedAt < CACHE_TTL) {
          freshCache = cached;
        }
      }
    }
  } catch (_) {}
  console.log("[data] cache lookup:", { hasFresh: !!freshCache, hasStale: !!staleCache });

  // 2. If cached data exists and we're rate limited, return it with offline flag
  const cacheToReturn = freshCache || staleCache;
  if (cacheToReturn && isRateLimited()) {
    console.log("[data] returning cached data with offline flag (rate limited)");
    return { ...cacheToReturn, _offline: true, _resetMs: getRateLimitResetMs() };
  }

  // 3. If fresh cache exists and NOT rate limited, skip API entirely
  if (freshCache) {
    console.log("[data] returning fresh cached data (age:", Math.round((Date.now() - freshCache._cachedAt) / 1000), "s)");
    return freshCache;
  }

  // 4. No cache at all — if rate limited, show countdown page
  if (isRateLimited()) {
    console.log("[data] no cache, rate limited → showing clock");
    return { _rateLimited: true, _resetMs: getRateLimitResetMs() };
  }

  // 5. For Google Drive, skip user existence check
  if (source === 'gd') {
    const resume = await fetchResumeFromGDrive(identifier);
    if (!resume) {
      if (staleCache) return { ...staleCache, _offline: true, _resetMs: getRateLimitResetMs() };
      return { _notFound: true };
    }
    const unified = buildUnifiedData(resume, null, null, identifier);
    return unified;
  }

  // 5. Check if user exists — uses fetchWithCache so ETag 304 doesn't consume rate limit
  console.log("[data] checking user existence for:", identifier);
  const { exists, rateLimited } = await checkUserExists(identifier);
  console.log("[data] checkUserExists result:", { exists, rateLimited });

  if (rateLimited) {
    // Rate limited — show clock (with or without cache)
    const cached = staleCache || freshCache;
    if (cached) {
      console.log("[data] rate limited, returning cached data with offline flag");
      return { ...cached, _offline: true, _resetMs: getRateLimitResetMs() };
    }
    console.log("[data] rate limited, no cache → showing clock");
    return { _rateLimited: true, _resetMs: getRateLimitResetMs() };
  }

  if (!exists) {
    // User doesn't exist — but if rate limited, show clock instead of 404
    if (isRateLimited()) {
      const cached = staleCache || freshCache;
      if (cached) return { ...cached, _offline: true, _resetMs: getRateLimitResetMs() };
      return { _rateLimited: true, _resetMs: getRateLimitResetMs() };
    }
    if (staleCache) {
      console.log("[data] user not found, returning stale cache with offline flag");
      return { ...staleCache, _offline: true, _resetMs: getRateLimitResetMs() };
    }
    console.log("[data] user not found, no cache → 404");
    return { _notFound: true };
  }

  // 6. Fetch everything
  let resume, ghProfile, repos;

  [resume, ghProfile] = await Promise.all([
    fetchResumeGist(identifier),
    fetchGithubUserProfile(identifier),
  ]);
  repos = await fetchAndMergeProjects(identifier);

  console.log("[data] resume loaded:", !!resume);
  console.log("[data] gh profile loaded:", !!ghProfile);
  console.log("[data] repos loaded:", repos?.length || 0);

  // If we got no data at all, figure out why
  if (!resume && !ghProfile && repos?.length === 0) {
    // Rate limited — show clock instead of empty page
    if (isRateLimited()) {
      const cached = staleCache || freshCache;
      if (cached) return { ...cached, _offline: true, _resetMs: getRateLimitResetMs() };
      return { _rateLimited: true, _resetMs: getRateLimitResetMs() };
    }
    // Has stale cache — show that
    if (staleCache) {
      return { ...staleCache, _stale: true };
    }
  }

  const unified = buildUnifiedData(resume, ghProfile, repos, identifier);
  console.log("[data] unified data built, basics:", !!unified?.basics);
  return unified;
}

function buildUnifiedData(resume, ghProfile, repos, identifier) {
  // --- Merge basics ---
  const resumeBasics = resume?.basics || {};
  const profiles = mergeProfiles(
    resumeBasics.profiles,
    ghProfile,
    identifier,
  );

  const basics = {
    name: resumeBasics.name || ghProfile?.name || identifier,
    label: resumeBasics.label || "",
    summary: resumeBasics.summary || ghProfile?.bio || "",
    email: resumeBasics.email || ghProfile?.email || "",
    image: resumeBasics.image || ghProfile?.avatar_url || "",
    profiles,
  };

  // --- Merge sections ---
  const education = resume?.education || null;
  const skills = mergeSkills(resume?.skills, repos);
  const projects = mergeProjects(resume?.projects, repos);
  const certificates = resume?.certificates || null;
  const work = resume?.work || null;
  const languages = resume?.languages || null;
  const awards = resume?.awards || null;
  const volunteer = resume?.volunteer || null;
  const publications = resume?.publications || null;

  // --- Meta config ---
  const meta = resume?.meta || {};

  const unified = { basics, education, certificates, skills, projects, meta, work, languages, awards, volunteer, publications, _rawResume: resume, _cachedAt: Date.now() };

  // Store in user-specific localStorage key
  const userCacheKey = getUserCacheKey(identifier);
  try {
    localStorage.setItem(userCacheKey, JSON.stringify(unified, null, 2));
    localStorage.setItem(LAST_USER_KEY, identifier);
    console.log("[data] unified data stored in localStorage for", identifier);
  } catch (_) {
    /* quota exceeded or private browsing — ignore */
  }

  return unified;
}

// ---------------------------------------------------------------------------
// Read cached data (synchronous, for quick access)
// ---------------------------------------------------------------------------

export function getCachedData(username) {
  try {
    // If no username provided, try to find the last active user
    if (!username) {
      username = localStorage.getItem(LAST_USER_KEY);
      if (!username) return null;
    }
    const cacheKey = getUserCacheKey(username);
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data._cachedAt) return data; // backward compat
    const CACHE_TTL = 60 * 60 * 1000;
    if (Date.now() - data._cachedAt > CACHE_TTL) return null;
    return data;
  } catch (_) {
    return null;
  }
}

export function clearCachedData(username) {
  if (username) {
    localStorage.removeItem(getUserCacheKey(username));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function clearAllCache() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LAST_USER_KEY);
  // Clear all gist list caches and user-specific caches
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.startsWith(GIST_LIST_CACHE_KEY) || key.startsWith(STORAGE_KEY + "-")) {
      localStorage.removeItem(key);
    }
  }
}
