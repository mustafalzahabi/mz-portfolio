// ============================================================================
// UNIFIED DATA COLLECTION
// Collects data from resume.json gist + GitHub profile + repos,
// merges into a single structure, stores in localStorage.
// ============================================================================

import {
  fetchGithubUserProfile,
  fetchAndMergeProjects,
} from "./api.js";

import { parseFrontmatter, slugify } from "./utils.js";

const STORAGE_KEY = "mz-portfolio-data";

// ---------------------------------------------------------------------------
// Gist fetcher (3-tier: inline content → single-gist endpoint → raw_url)
// ---------------------------------------------------------------------------

async function fetchResumeGist(username) {
  try {
    const gistsRes = await fetch(
      `https://api.github.com/users/${username}/gists`,
    );
    if (!gistsRes.ok) return null;

    const gists = await gistsRes.json();
    const gist = gists.find(
      (g) =>
        g.files &&
        Object.keys(g.files).some(
          (n) => n.toLowerCase() === "resume.json",
        ),
    );
    if (!gist) return null;

    const fileKey = Object.keys(gist.files).find(
      (n) => n.toLowerCase() === "resume.json",
    );

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
        const key = Object.keys(single.files).find(
          (n) => n.toLowerCase() === "resume.json",
        );
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
    console.warn("[data] Could not fetch resume.json gist:", e.message);
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
    const res = await fetch(
      `https://api.github.com/users/${username}/gists?per_page=100`,
    );
    if (!res.ok) return [];

    const gists = await res.json();
    const mdGists = gists.filter((g) => {
      const files = Object.keys(g.files);
      return (
        files.some((f) => f.endsWith(".md")) &&
        !files.some((f) => f.toLowerCase() === "resume.json")
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
    name: repo.name || resumeProj.name || "",
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

  console.log(`[match] "${resumeProj.name}" — github:"${resumeGithub}" url:"${resumeUrl}" demo:"${resumeDemo}"`);

  // Signal 1: resume github/url field IS a github.com URL → match repo.html_url
  for (let i = 0; i < ghProjects.length; i++) {
    if (matchedIndices.has(i)) continue;
    const repoUrl = ghProjects[i].github_link || "";
    if (resumeGithub && urlsMatch(resumeGithub, repoUrl)) {
      console.log(`  → matched via github URL: ${repoUrl}`);
      return { repo: ghProjects[i], index: i };
    }
    if (resumeUrl && isGithubUrl(resumeUrl) && urlsMatch(resumeUrl, repoUrl)) {
      console.log(`  → matched via url field: ${repoUrl}`);
      return { repo: ghProjects[i], index: i };
    }
  }

  // Signal 2: resume url/demo domain appears in repo description
  const resumeUrls = [resumeUrl, resumeDemo]
    .filter(Boolean)
    .map(extractDomain)
    .filter(Boolean);

  if (resumeUrls.length > 0) {
    for (let i = 0; i < ghProjects.length; i++) {
      if (matchedIndices.has(i)) continue;
      const desc = (ghProjects[i].description || "").toLowerCase();
      for (const domain of resumeUrls) {
        if (desc.includes(domain)) {
          console.log(`  → matched via domain "${domain}" in repo description`);
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
        console.log(`  → matched via name: "${ghProjects[i].name}"`);
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
        console.log(`  → matched via name+keywords: "${ghProjects[i].name}" (overlap: ${(overlapRatio * 100).toFixed(0)}%)`);
        return { repo: ghProjects[i], index: i };
      }
    }
  }

  console.log(`  → NO MATCH found`);
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

  let resume, ghProfile, repos;

  if (source === 'gd') {
    // Google Drive source: fetch resume.json from public file only
    resume = await fetchResumeFromGDrive(identifier);
    ghProfile = null;
    repos = null;
  } else {
    // GitHub source: fetch resume.json gist + GitHub profile + repos
    [resume, ghProfile] = await Promise.all([
      fetchResumeGist(identifier),
      fetchGithubUserProfile(identifier),
    ]);
    repos = await fetchAndMergeProjects(identifier);
  }

  console.log("[data] resume loaded:", !!resume);
  if (source !== 'gd') console.log("[data] gh profile loaded:", !!ghProfile);
  console.log("[data] repos loaded:", repos?.length || 0);

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

  // --- Meta config ---
  const meta = resume?.meta || {};

  const unified = { basics, education, skills, projects, meta, _rawResume: resume };

  // Store in localStorage for debugging / caching
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unified, null, 2));
    console.log("[data] unified data stored in localStorage");
  } catch (_) {
    /* quota exceeded or private browsing — ignore */
  }

  return unified;
}

// ---------------------------------------------------------------------------
// Read cached data (synchronous, for quick access)
// ---------------------------------------------------------------------------

export function getCachedData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function clearCachedData() {
  localStorage.removeItem(STORAGE_KEY);
}
