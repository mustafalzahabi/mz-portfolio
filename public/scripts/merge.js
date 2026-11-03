// ============================================================================
// MERGE — turns raw inputs (resume.json + GitHub) into the view model the
// components render. Pure functions (no DOM, no network) so they're testable.
// ============================================================================

import { safeUrl, toTimestamp, slugify } from "./utils.js";

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

// ============================================================================
// BASICS & PROFILES
// ============================================================================

function normalizeUrl(url) {
  return String(url || "").replace(/\/+$/, "").replace(/^https?:\/\/(www\.)?/i, "").toLowerCase();
}

export function buildBasics(resumeBasics = {}, github = null, fallbackId = "") {
  const b = resumeBasics && typeof resumeBasics === "object" ? resumeBasics : {};
  const profiles = [];
  const add = (network, url, username = "") => {
    const safe = safeUrl(url);
    if (!safe || profiles.some((p) => normalizeUrl(p.url) === normalizeUrl(safe))) return;
    profiles.push({ network: str(network) || hostLabel(safe), url: safe, username: str(username) });
  };

  for (const p of arr(b.profiles)) {
    if (p?.url) add(p.network, p.url, p.username);
    else if (p?.network && p?.username) {
      const known = PROFILE_URLS[p.network.toLowerCase()];
      if (known) add(p.network, known(p.username), p.username);
    }
  }
  if (github?.html_url) add("GitHub", github.html_url, github.login);
  if (github?.blog) add("Website", /^https?:/i.test(github.blog) ? github.blog : `https://${github.blog}`);
  if (github?.twitter_username) add("X", `https://x.com/${github.twitter_username}`, github.twitter_username);

  const location = b.location && typeof b.location === "object" ? b.location : {};
  const locationText = [location.city, location.region, location.countryCode].map(str).filter(Boolean).join(", ") ||
    str(github?.location);

  return {
    name: str(b.name) || str(github?.name) || str(github?.login) || fallbackId,
    label: str(b.label) || "",
    summary: str(b.summary) || str(github?.bio) || "",
    email: str(b.email) || str(github?.email) || "",
    phone: str(b.phone),
    url: safeUrl(str(b.url)),
    image: str(b.image) || "",
    location: locationText,
    locationParts: location,
    profiles,
    githubUser: github?.login || "",
    githubAvatar: github?.avatar_url || "",
  };
}

const PROFILE_URLS = {
  github: (u) => `https://github.com/${u}`,
  linkedin: (u) => `https://www.linkedin.com/in/${u}`,
  twitter: (u) => `https://x.com/${u}`,
  x: (u) => `https://x.com/${u}`,
  instagram: (u) => `https://www.instagram.com/${u}`,
  behance: (u) => `https://www.behance.net/${u}`,
  dribbble: (u) => `https://dribbble.com/${u}`,
  medium: (u) => `https://medium.com/@${u}`,
  youtube: (u) => `https://www.youtube.com/@${u}`,
  gitlab: (u) => `https://gitlab.com/${u}`,
  stackoverflow: (u) => `https://stackoverflow.com/users/${u}`,
};

function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

export function findProfile(basics, network) {
  const n = network.toLowerCase();
  return basics.profiles.find((p) => p.network.toLowerCase() === n || (n === "x" && /twitter/i.test(p.network)));
}

// ============================================================================
// SKILLS
// ============================================================================

const LEVELS = {
  novice: 20, beginner: 25, basic: 30, elementary: 30,
  intermediate: 55, competent: 60, proficient: 70,
  advanced: 80, expert: 92, master: 100, fluent: 90, native: 100,
};

/** Maps a JSON Resume skill level to 0–100, or null when unknown. */
export function skillLevelPercent(level) {
  if (level === null || level === undefined || level === "") return null;
  if (typeof level === "number") return Math.max(0, Math.min(100, level <= 10 ? level * 10 : level));
  const s = String(level).trim().toLowerCase();
  const num = s.match(/^(\d+(?:\.\d+)?)\s*(%|\/\s*(\d+))?$/);
  if (num) {
    const v = parseFloat(num[1]);
    const max = num[3] ? parseFloat(num[3]) : num[2] === "%" || v > 10 ? 100 : 10;
    return Math.max(0, Math.min(100, (v / max) * 100));
  }
  for (const [word, pct] of Object.entries(LEVELS)) if (s.includes(word)) return pct;
  return null;
}

export function mergeSkills(resumeSkills, repos, { githubLanguages = true } = {}) {
  const groups = arr(resumeSkills)
    .filter((s) => s && (s.name || arr(s.keywords).length))
    .map((s) => ({
      name: str(s.name) || "Skills",
      level: str(s.level),
      percent: skillLevelPercent(s.level),
      keywords: arr(s.keywords).map(str).filter(Boolean),
    }));

  if (githubLanguages && arr(repos).length) {
    const counts = {};
    for (const repo of repos) if (repo.language) counts[repo.language] = (counts[repo.language] || 0) + 1;
    const existing = new Set(groups.flatMap((g) => [g.name, ...g.keywords]).map((s) => s.toLowerCase()));
    const langs = Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a])
      .filter((l) => !existing.has(l.toLowerCase()));
    if (langs.length) {
      const total = repos.filter((r) => r.language).length || 1;
      groups.push({
        name: "Languages on GitHub",
        level: "",
        percent: null,
        keywords: langs,
        weights: Object.fromEntries(langs.map((l) => [l, Math.round((counts[l] / total) * 100)])),
        fromGithub: true,
      });
    }
  }
  return groups;
}

// ============================================================================
// PROJECTS (resume ⨝ GitHub repos)
// ============================================================================

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/^@[^/]+\//, "")
    .replace(/[^a-z0-9]/g, "");
}

function repoSlug(url) {
  const m = String(url || "").match(/github\.com\/([^/]+)\/([^/?#]+)/i);
  return m ? `${m[1]}/${m[2].replace(/\.git$/, "")}`.toLowerCase() : "";
}

function domainOf(url) {
  try {
    return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function findMatchingRepo(rp, repos, taken = new Set()) {
  const candidates = repos.map((r, i) => ({ r, i })).filter(({ i }) => !taken.has(i));
  const links = [rp.github, rp.repository, rp.url, rp.source].map(repoSlug).filter(Boolean);

  // 1. Explicit github.com URL
  for (const { r, i } of candidates) if (links.includes(repoSlug(r.github_link))) return i;
  // 2. Same homepage domain
  const domains = [rp.url, rp.demo].filter(Boolean).map(domainOf).filter((d) => d && d !== "github.com");
  for (const { r, i } of candidates) {
    const home = domainOf(r.live_link || "");
    if (home && domains.includes(home)) return i;
  }
  // 3. Same normalized name
  const name = normalizeName(rp.name);
  if (name) for (const { r, i } of candidates) if (normalizeName(r.name) === name) return i;
  return -1;
}

function projectFromResume(p, index) {
  return {
    name: str(p.name) || `Project ${index + 1}`,
    description: str(p.description),
    highlights: arr(p.highlights).map(str).filter(Boolean),
    keywords: arr(p.keywords).map(str).filter(Boolean),
    roles: arr(p.roles).map(str).filter(Boolean),
    entity: str(p.entity),
    type: str(p.type),
    startDate: str(p.startDate),
    endDate: str(p.endDate),
    url: safeUrl(str(p.url)),
    demo: safeUrl(str(p.demo)),
    github: safeUrl(str(p.github || p.repository)),
    image: str(p.image),
    images: arr(p.images).map(str).filter(Boolean),
    stars: null,
    language: "",
    repo: null,
    fromResume: true,
    order: index,
  };
}

function projectFromRepo(r) {
  return {
    name: r.name,
    description: r.description,
    highlights: [],
    keywords: [...new Set([r.language, ...arr(r.topics)].filter(Boolean))],
    roles: [],
    entity: "",
    type: "",
    startDate: "",
    endDate: "",
    url: "",
    demo: safeUrl(r.live_link),
    github: r.github_link,
    image: "",
    images: [],
    stars: r.stars,
    language: r.language,
    updatedAt: r.updatedAt,
    repo: { owner: r.owner, name: r.name, branch: r.defaultBranch },
    fromResume: false,
    order: Infinity,
  };
}

export function mergeProjects(resumeProjects, repos, cfg = {}) {
  const { github = "all", showForks = false, exclude = [], sort = "resume", limit = 0 } = cfg;
  const pool = github === "none" ? [] : arr(repos).filter((r) => (showForks || !r.fork) && !r.archived);
  const taken = new Set();

  const merged = arr(resumeProjects).filter(Boolean).map((p, idx) => {
    const project = projectFromResume(p, idx);
    const i = pool.length ? findMatchingRepo(p, pool, taken) : -1;
    if (i >= 0) {
      taken.add(i);
      const repo = projectFromRepo(pool[i]);
      project.description ||= repo.description;
      project.keywords = [...new Set([...project.keywords, ...repo.keywords])];
      project.github ||= repo.github;
      project.demo ||= repo.demo;
      project.stars = repo.stars;
      project.language = repo.language;
      project.updatedAt = repo.updatedAt;
      project.repo = repo.repo;
    }
    return project;
  });

  if (github === "all") {
    pool.forEach((r, i) => {
      if (!taken.has(i)) merged.push(projectFromRepo(r));
    });
  }

  const excluded = new Set(arr(exclude).map(normalizeName));
  let list = merged.filter((p) => !excluded.has(normalizeName(p.name)));

  const byStars = (a, b) => (b.stars ?? -1) - (a.stars ?? -1);
  const byRecent = (a, b) =>
    toTimestamp(b.endDate || b.updatedAt || b.startDate) - toTimestamp(a.endDate || a.updatedAt || a.startDate);
  if (sort === "stars") list.sort(byStars);
  else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "recent") list.sort(byRecent);
  else list.sort((a, b) => a.order - b.order || byStars(a, b));

  if (limit > 0) list = list.slice(0, limit);

  // Stable unique slugs for routing
  const used = new Set();
  for (const p of list) {
    const base = slugify(p.name) || "project";
    let slug = base;
    let n = 2;
    while (used.has(slug)) slug = `${base}-${n++}`;
    used.add(slug);
    p.slug = slug;
  }
  return list;
}

// ============================================================================
// RESUME VALIDATION (friendly warnings, never blocking)
// ============================================================================

const SECTION_ARRAYS = [
  "work", "volunteer", "education", "awards", "certificates", "publications",
  "skills", "languages", "interests", "references", "projects",
];
const DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const DATE_FIELDS = ["startDate", "endDate", "date", "releaseDate"];

export function validateResume(resume) {
  const warnings = [];
  if (!resume || typeof resume !== "object") return ["resume.json is empty."];
  if (!resume.basics || typeof resume.basics !== "object") warnings.push("basics: missing. Add at least basics.name.");
  else {
    if (!str(resume.basics.name)) warnings.push("basics.name: missing.");
    if (resume.basics.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resume.basics.email)) warnings.push("basics.email: doesn't look like an email address.");
    if (resume.basics.profiles !== undefined && !Array.isArray(resume.basics.profiles)) warnings.push("basics.profiles: should be a list.");
    if (resume.basics.location !== undefined && (typeof resume.basics.location !== "object" || Array.isArray(resume.basics.location))) {
      warnings.push("basics.location: should be an object like { \"city\": \"…\", \"countryCode\": \"…\" }.");
    }
  }
  for (const key of SECTION_ARRAYS) {
    const value = resume[key];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      warnings.push(`${key}: should be a list ([ … ]).`);
      continue;
    }
    value.forEach((item, i) => {
      if (!item || typeof item !== "object") {
        warnings.push(`${key}[${i}]: should be an object.`);
        return;
      }
      for (const f of DATE_FIELDS) {
        if (item[f] && !DATE_RE.test(String(item[f]))) warnings.push(`${key}[${i}].${f}: "${item[f]}" should look like 2024, 2024-06 or 2024-06-15.`);
      }
      for (const listField of ["highlights", "keywords", "courses", "roles"]) {
        if (item[listField] !== undefined && !Array.isArray(item[listField])) warnings.push(`${key}[${i}].${listField}: should be a list.`);
      }
    });
  }
  return warnings;
}

// ============================================================================
// VIEW MODEL
// ============================================================================

export function buildViewModel(data, config) {
  const resume = data.resume && typeof data.resume === "object" ? data.resume : {};
  const basics = buildBasics(resume.basics, data.github, data.source?.id || "");
  const projects = mergeProjects(resume.projects, data.repos, config.projects);
  const skills = mergeSkills(resume.skills, data.repos, config.skills);

  const objs = (key) => arr(resume[key]).filter((x) => x && typeof x === "object");

  return {
    basics,
    resume,
    hasResume: !!data.resume,
    projects,
    skills,
    work: objs("work"),
    volunteer: objs("volunteer"),
    education: objs("education"),
    awards: objs("awards"),
    certificates: objs("certificates"),
    publications: objs("publications"),
    languages: objs("languages"),
    interests: objs("interests"),
    references: objs("references").filter((r) => r.reference || r.name),
    posts: arr(data.posts),
    source: data.source || {},
  };
}
