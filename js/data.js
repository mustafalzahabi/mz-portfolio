// ============================================================================
// UNIFIED DATA COLLECTION
// Collects data from resume.json gist + GitHub profile + repos,
// merges into a single structure, stores in localStorage.
// ============================================================================

import {
  fetchGithubUserProfile,
  fetchAndMergeProjects,
} from "./api.js";

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
  const all = [];

  // Resume.json projects first
  if (Array.isArray(resumeProjects)) {
    for (const p of resumeProjects) {
      all.push({
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
      });
    }
  }

  // GitHub repos (skip duplicates by name)
  const existingNames = new Set(all.map((p) => p.name.toLowerCase()));
  for (const repo of ghProjects || []) {
    if (!existingNames.has(repo.name.toLowerCase())) {
      all.push(repo);
    }
  }

  return all.length > 0 ? all : null;
}

// ---------------------------------------------------------------------------
// Main: collect and merge everything
// ---------------------------------------------------------------------------

export async function collectPortfolioData(githubUsername) {
  console.log("[data] collecting for:", githubUsername);

  // Fetch everything in parallel where possible
  const [resume, ghProfile] = await Promise.all([
    fetchResumeGist(githubUsername),
    fetchGithubUserProfile(githubUsername),
  ]);

  console.log("[data] resume loaded:", !!resume);
  console.log("[data] gh profile loaded:", !!ghProfile);

  // Fetch repos (needs ghProfile for languages)
  const repos = await fetchAndMergeProjects(
    resume?.projects,
    githubUsername,
  );
  console.log("[data] repos loaded:", repos?.length || 0);

  // --- Merge basics ---
  const resumeBasics = resume?.basics || {};
  const profiles = mergeProfiles(
    resumeBasics.profiles,
    ghProfile,
    githubUsername,
  );

  const basics = {
    name: resumeBasics.name || ghProfile?.name || githubUsername,
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
