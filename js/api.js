// ============================================================================
// GITHUB INTEGRATION
// ============================================================================

export function extractGithubUsername(url) {
  if (typeof url !== "string") return null;
  const match = url.match(/github\.com\/([^\/]+)/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Rate limit tracking
// ---------------------------------------------------------------------------

let rateLimitInfo = { remaining: null, resetAt: 0, limited: false };

function updateRateLimit(headers) {
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  if (remaining !== null) rateLimitInfo.remaining = parseInt(remaining, 10);
  if (reset) rateLimitInfo.resetAt = parseInt(reset, 10) * 1000;
  rateLimitInfo.limited = rateLimitInfo.remaining !== null && rateLimitInfo.remaining <= 0;
  if (rateLimitInfo.limited) {
    try {
      localStorage.setItem("mz-rate-limited", JSON.stringify({ resetAt: rateLimitInfo.resetAt }));
    } catch (_) {}
  } else if (rateLimitInfo.remaining !== null && rateLimitInfo.remaining > 0) {
    try { localStorage.removeItem("mz-rate-limited"); } catch (_) {}
  }
}

function loadPersistedRateLimit() {
  try {
    const raw = localStorage.getItem("mz-rate-limited");
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.resetAt && Date.now() < data.resetAt) {
        rateLimitInfo.limited = true;
        rateLimitInfo.resetAt = data.resetAt;
      } else {
        localStorage.removeItem("mz-rate-limited");
      }
    }
  } catch (_) {}
}

loadPersistedRateLimit();

export function isRateLimited() {
  return rateLimitInfo.limited;
}

export function getRateLimitResetMs() {
  if (!rateLimitInfo.limited) return 0;
  return Math.max(0, rateLimitInfo.resetAt - Date.now());
}

export function getRateLimitResetAt() {
  return rateLimitInfo.resetAt;
}

export function setRateLimitInfo(remaining, resetAt) {
  rateLimitInfo.remaining = remaining;
  rateLimitInfo.resetAt = resetAt;
  rateLimitInfo.limited = remaining <= 0;
}

export function getRateLimitInfo() {
  return { ...rateLimitInfo };
}

// ---------------------------------------------------------------------------
// HTTP fetch with localStorage + ETag caching
// ---------------------------------------------------------------------------

function getCache(cacheKey) {
  try {
    const raw = localStorage.getItem(cacheKey);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function setCache(cacheKey, data, etag) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ data, etag, timestamp: Date.now() }));
  } catch (_) { /* quota exceeded */ }
}

async function fetchWithCache(url, cacheKey, fetchOptions = {}) {
  const cached = getCache(cacheKey);

  const headers = { ...fetchOptions.headers };
  if (cached?.etag) {
    headers["If-None-Match"] = cached.etag;
  }

  try {
    const res = await fetch(url, { ...fetchOptions, headers });

    // Always track rate limit from response headers
    updateRateLimit(res.headers);

    if (res.status === 304 && cached?.data) {
      console.log(`[api] 304 hit for ${cacheKey}, returning cache`);
      cached.timestamp = Date.now();
      setCache(cacheKey, cached.data, cached.etag);
      return cached.data;
    }

    if (!res.ok) {
      if (cached?.data) {
        console.log(`[api] fetch failed (${res.status}), falling back to stale cache for ${cacheKey}`);
        return cached.data;
      }
      return null;
    }

    const etag = res.headers.get("etag") || "";
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await res.json();
      setCache(cacheKey, data, etag);
      return data;
    } else {
      const data = await res.text();
      setCache(cacheKey, data, etag);
      return data;
    }
  } catch (e) {
    if (cached?.data) {
      console.log(`[api] network error, falling back to stale cache for ${cacheKey}: ${e.message}`);
      return cached.data;
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Raw fetch (no cache) — returns { data, status } for existence checks
// ---------------------------------------------------------------------------

async function fetchRaw(url, fetchOptions = {}) {
  try {
    const res = await fetch(url, fetchOptions);
    updateRateLimit(res.headers);
    if (res.status === 404) return { data: null, status: 404 };
    if (res.status === 403) return { data: null, status: 403 };
    if (!res.ok) return { data: null, status: res.status };
    const data = await res.json();
    return { data, status: 200 };
  } catch (e) {
    return { data: null, status: 0 };
  }
}

// ---------------------------------------------------------------------------
// User profile
// ---------------------------------------------------------------------------

let githubUserCache = {};

export async function fetchGithubUserProfile(username) {
  if (githubUserCache[username]) return githubUserCache[username];
  try {
    const url = `https://api.github.com/users/${username}`;
    console.log("[fetchGithubUserProfile] fetching:", url);
    const data = await fetchWithCache(url, `mz-cache-gh-user-${username}`);
    if (!data) {
      console.warn(`[fetchGithubUserProfile] returned null for ${username}`);
      return null;
    }
    githubUserCache[username] = data;
    return data;
  } catch (e) {
    console.warn("[fetchGithubUserProfile] Could not fetch GitHub user profile:", e.message);
    return null;
  }
}

// Check if a GitHub user exists — uses fetchWithCache so ETag 304 doesn't count against rate limit
export async function checkUserExists(username) {
  if (githubUserCache[username]) return { exists: true, rateLimited: isRateLimited() };

  try {
    const data = await fetchWithCache(
      `https://api.github.com/users/${username}`,
      `mz-cache-gh-user-${username}`
    );
    if (data) {
      githubUserCache[username] = data;
      return { exists: true, rateLimited: isRateLimited() };
    }
    return { exists: false, rateLimited: isRateLimited() };
  } catch (e) {
    return { exists: false, rateLimited: isRateLimited() };
  }
}

export async function fetchGithubUserAvatar(username) {
  const user = await fetchGithubUserProfile(username);
  return user?.avatar_url || null;
}

export async function fetchAndMergeProjects(githubUsername) {
  try {
    const url = `https://api.github.com/users/${githubUsername}/repos?type=public&sort=stars&per_page=100`;
    console.log("[fetchAndMergeProjects] fetching repos:", url);
    const repos = await fetchWithCache(url, `mz-cache-repos-${githubUsername}`);
    if (!repos || !Array.isArray(repos)) {
      console.warn(`[fetchAndMergeProjects] no repos data for ${githubUsername}`);
      return [];
    }

    const filteredRepos = repos.filter((repo) => !repo.fork);
    console.log(`[fetchAndMergeProjects] found ${filteredRepos.length} non-fork repos`);

    const MAX_DETAILED = 10;

    const reposWithData = await Promise.all(
      filteredRepos.map(async (repo, index) => {
        if (index >= MAX_DETAILED) {
          return {
            name: repo.name,
            description: repo.description || "",
            technologies: repo.language ? [repo.language] : [],
            image: null,
            allImages: [],
            readmeDescription: repo.description || "",
            fullReadme: "",
            live_link: repo.homepage || null,
            github_link: repo.html_url,
            stars: repo.stargazers_count,
            isGitHubRepo: true,
          };
        }

        const readmeData = await fetchReadmeData(
          githubUsername,
          repo.name,
          repo.default_branch,
        );
        const languages = await fetchRepoLanguages(githubUsername, repo.name);

        const displayDescription =
          readmeData?.description || repo.description || "";

        return {
          name: repo.name,
          description: repo.description || "",
          technologies:
            languages.length > 0
              ? languages
              : repo.language
                ? [repo.language]
                : [],
          image: readmeData?.firstImage || null,
          allImages: readmeData?.allImages || [],
          readmeDescription: displayDescription,
          fullReadme: readmeData?.fullText || "",
          live_link: repo.homepage || null,
          github_link: repo.html_url,
          stars: repo.stargazers_count,
          isGitHubRepo: true,
        };
      }),
    );

    console.log(`[fetchAndMergeProjects] fetched ${reposWithData.length} repos with data`);
    return reposWithData;
  } catch (e) {
    console.warn("[fetchAndMergeProjects] Could not fetch GitHub repos:", e.message);
    return [];
  }
}

// GitHub language colors - fetched dynamically
export let GITHUB_LANGUAGE_COLORS = {};
const LANGUAGE_COLORS_LOWER = {};

export function getLanguageColor(name) {
  return GITHUB_LANGUAGE_COLORS[name] || LANGUAGE_COLORS_LOWER[name.toLowerCase()] || null;
}

// Fetch GitHub language colors from github/linguist languages.yml
export async function initializeLanguageColors() {
  try {
    const yaml = await fetchWithCache(
      "https://raw.githubusercontent.com/github/linguist/master/lib/linguist/languages.yml",
      "mz-cache-lang-colors",
    );
    if (!yaml) return;

    GITHUB_LANGUAGE_COLORS = {};

    const lines = yaml.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const langMatch = line.match(/^([a-zA-Z0-9\s\-\+#]+):\s*$/);
      if (langMatch) {
        const langName = langMatch[1].trim();
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const colorMatch = lines[j].match(
            /^\s+color:\s*['"](#[0-9a-fA-F]{6})['"]/,
          );
          if (colorMatch) {
            GITHUB_LANGUAGE_COLORS[langName] = colorMatch[1];
            LANGUAGE_COLORS_LOWER[langName.toLowerCase()] = colorMatch[1];
            break;
          }
          if (
            lines[j].match(/^[a-zA-Z0-9\s\-\+#]+:\s*$/) &&
            !lines[j].startsWith(" ")
          ) {
            break;
          }
        }
      }
    }
  } catch (e) {
    console.warn("Failed to fetch GitHub language colors:", e);
  }
}

async function fetchRepoLanguages(username, repoName) {
  try {
    const url = `https://api.github.com/repos/${username}/${repoName}/languages`;
    const data = await fetchWithCache(url, `mz-cache-langs-${username}-${repoName}`);
    if (!data || typeof data !== "object") return [];
    return Object.keys(data).sort((a, b) => data[b] - data[a]);
  } catch (e) {
    return [];
  }
}

async function fetchReadmeData(username, repoName, branch) {
  try {
    const url = `https://api.github.com/repos/${username}/${repoName}/readme`;
    const text = await fetchWithCache(
      url,
      `mz-cache-readme-${username}-${repoName}`,
      { headers: { Accept: "application/vnd.github.v3.raw" } },
    );

    if (!text || typeof text !== "string") return null;

    const images = extractImages(text, username, repoName, branch);
    const description = extractDescription(text);
    const fullReadmeWithoutFirstPara = stripFirstParagraph(text);

    return {
      firstImage: images[0] || null,
      allImages: images,
      description,
      fullText: fullReadmeWithoutFirstPara,
    };
  } catch (e) {
    return null;
  }
}

function extractImages(readme, username, repoName, branch) {
  const images = [];
  const seen = new Set();

  // Skip badge/icon services
  const skipPatterns = [
    "shields.io",
    "img.shields.io",
    "badge",
    "badges.",
    "travis-ci",
    "circleci.com",
    "codecov.io",
    "coveralls.io",
    "david-dm.org",
    "snyk.io",
    "devops",
    "gitter.im",
    "discord",
    "chat.badge",
    "stars",
    "forks",
    "issues",
    "license",
    "npm",
    "pypi",
    "crates.io",
    ".svg?",  // often tiny badges
  ];

  function shouldSkip(url) {
    const lower = url.toLowerCase();
    return skipPatterns.some((p) => lower.includes(p));
  }

  function addImage(url, alt) {
    if (!url || seen.has(url)) return;
    if (shouldSkip(url)) return;
    seen.add(url);

    // Resolve relative URLs
    if (url.startsWith("./") || url.startsWith("/") || (!url.includes("://") && !url.startsWith("data:"))) {
      const normalized = url.startsWith("./")
        ? url.slice(2)
        : url.startsWith("/")
          ? url.slice(1)
          : url;
      images.push(
        `https://raw.githubusercontent.com/${username}/${repoName}/${branch}/${normalized}`,
      );
    } else if (url.includes("://")) {
      images.push(url);
    }
  }

  // Markdown images: ![alt](url)
  const mdRegex = /!\[(.*?)\]\((.*?)\)/g;
  let match;
  while ((match = mdRegex.exec(readme))) {
    addImage(match[2], match[1]);
  }

  // HTML images: <img src="url" ...>  or  <img src='url' ...>
  const htmlRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  while ((match = htmlRegex.exec(readme))) {
    addImage(match[1], "");
  }

  return images;
}

function extractDescription(readme) {
  const lines = readme.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("!")) {
      return trimmed;
    }
  }
  return "";
}

function stripFirstParagraph(readme) {
  const lines = readme.split("\n");
  let foundPara = false;
  let result = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !foundPara &&
      trimmed &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("!")
    ) {
      foundPara = true;
      continue;
    }
    if (foundPara) {
      result.push(line);
    }
  }

  return result.join("\n").trim();
}
