// ============================================================================
// DATA COLLECTION
// Loads the raw inputs for a portfolio — resume.json, GitHub profile + repos,
// blog posts — from GitHub gists or a Google Drive file/folder, with a
// per-portfolio localStorage snapshot for offline / rate-limited visits.
// Shaping the data for display happens in merge.js.
// ============================================================================

import {
  fetchGithubUser,
  fetchGistList,
  fetchRepos,
  fetchText,
  mapLimit,
  isRateLimited,
  getRateLimitResetAt,
  fetchDriveMeta,
  listDriveFolder,
  downloadDriveFile,
} from "./api.js";
import { parseFrontmatter, slugify } from "./utils.js";
import { debug } from "./log.js";

const SNAPSHOT_PREFIX = "mz-portfolio-data-";
const SNAPSHOT_TTL = 30 * 60 * 1000; // serve without refetching for 30 min
const RECENT_KEY = "mz-recent";
const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

// ============================================================================
// RESUME FILE NAME (?gistname=my-cv → my-cv.json)
// ============================================================================

export function getResumeFilename() {
  const name = new URLSearchParams(location.search).get("gistname");
  if (name) {
    const clean = name.replace(/\.json$/i, "");
    if (/^[\w.-]+$/.test(clean)) return `${clean}.json`;
  }
  return "resume.json";
}

// ============================================================================
// JSON PARSING WITH FRIENDLY ERRORS
// ============================================================================

export class ResumeParseError extends Error {
  constructor(message, line, column) {
    super(message);
    this.name = "ResumeParseError";
    this.line = line;
    this.column = column;
  }
}

export function parseResumeJson(text) {
  try {
    const data = JSON.parse(String(text).replace(/^﻿/, ""));
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new ResumeParseError("The file must contain a JSON object ({ … }).");
    }
    return data;
  } catch (e) {
    if (e instanceof ResumeParseError) throw e;
    const pos = Number((e.message.match(/position (\d+)/) || [])[1]);
    let line, column;
    if (Number.isFinite(pos)) {
      const before = String(text).slice(0, pos);
      line = before.split("\n").length;
      column = pos - before.lastIndexOf("\n");
    } else {
      const lc = e.message.match(/line (\d+) column (\d+)/);
      if (lc) [line, column] = [+lc[1], +lc[2]];
    }
    const where = line ? ` (line ${line}, column ${column})` : "";
    throw new ResumeParseError(`resume.json isn't valid JSON${where}: ${e.message.replace(/^JSON\.parse: /, "")}`, line, column);
  }
}

// ============================================================================
// BLOG POSTS
// ============================================================================

function buildPost({ content, filename, fallbackTitle, created, updated, url, id }) {
  const { metadata, body } = parseFrontmatter(content);
  if (metadata.draft === true || metadata.published === false) return null;
  const firstHeading = body.match(/^#\s+(.+)$/m)?.[1];
  const title = String(metadata.title || fallbackTitle || firstHeading || filename.replace(/\.md$/i, ""));
  return {
    title,
    slug: slugify(metadata.slug || title),
    date: metadata.date || created,
    updatedAt: updated,
    tags: Array.isArray(metadata.tags) ? metadata.tags.map(String) : metadata.tags ? [String(metadata.tags)] : [],
    description: String(metadata.description || metadata.preview || ""),
    image: String(metadata.image || ""),
    body,
    url,
    id,
  };
}

function dedupeSlugs(posts) {
  const seen = new Map();
  for (const post of posts) {
    const n = seen.get(post.slug) || 0;
    seen.set(post.slug, n + 1);
    if (n) post.slug = `${post.slug}-${n + 1}`;
  }
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return posts;
}

async function blogFromGists(gists, resumeFile) {
  const candidates = gists.filter((g) => {
    const names = Object.keys(g.files || {});
    return names.some((n) => /\.md$/i.test(n)) && !names.includes(resumeFile);
  });
  const posts = await mapLimit(candidates, 6, async (gist) => {
    const file = Object.values(gist.files).find((f) => /\.md$/i.test(f.filename));
    const content = await fetchText(file.raw_url);
    if (!content) return null;
    return buildPost({
      content,
      filename: file.filename,
      fallbackTitle: gist.description,
      created: gist.created_at,
      updated: gist.updated_at,
      url: gist.html_url,
      id: gist.id,
    });
  });
  return dedupeSlugs(posts.filter(Boolean));
}

// ============================================================================
// SOURCES
// ============================================================================

async function loadFromGithub(username) {
  const userResult = await fetchGithubUser(username);
  if (userResult.status === "notfound") return { status: "notfound", reason: "github-user" };
  if (userResult.status === "ratelimited") return { status: "ratelimited", resetAt: getRateLimitResetAt() };
  if (userResult.status === "error") return { status: "error", message: "Couldn't reach GitHub. Check your connection and try again." };

  const resumeFile = getResumeFilename();
  const [{ gists, rateLimited }, repos] = await Promise.all([fetchGistList(username), fetchRepos(username)]);
  if (rateLimited && !gists.length) return { status: "ratelimited", resetAt: getRateLimitResetAt() };

  const gist = gists.find((g) => g.files && g.files[resumeFile]);
  let resume = null;
  if (gist) {
    const text = await fetchText(gist.files[resumeFile].raw_url);
    if (text === null) return { status: "error", message: `Found ${resumeFile} but couldn't download it. Try again in a moment.` };
    resume = parseResumeJson(text); // throws ResumeParseError
  }

  const posts = await blogFromGists(gists, resumeFile);

  return {
    status: "ok",
    data: {
      resume,
      github: userResult.user,
      repos,
      posts,
      source: {
        type: "gh",
        id: username,
        resumeFile,
        resumeUrl: gist?.html_url || "",
        updatedAt: gist?.updated_at || "",
        hasResume: !!resume,
      },
    },
  };
}

async function loadFromDrive(id) {
  const metaResult = await fetchDriveMeta(id);
  if (metaResult.status === "nokey") {
    return { status: "error", reason: "drive-key", message: "Google Drive portfolios aren't enabled on this site (no Google API key is configured)." };
  }
  if (metaResult.status === "notfound") return { status: "notfound", reason: "drive" };
  if (metaResult.status === "error") return { status: "error", message: "Couldn't reach Google Drive. Check your connection and try again." };

  const meta = metaResult.meta;
  const resumeFile = getResumeFilename();
  let resumeText = null;
  let resumeMeta = meta;
  let posts = [];

  if (meta.mimeType === DRIVE_FOLDER_MIME) {
    const files = await listDriveFolder(id);
    resumeMeta = files.find((f) => f.name === resumeFile) || files.find((f) => /\.json$/i.test(f.name));
    if (!resumeMeta) return { status: "notfound", reason: "drive-resume" };
    resumeText = await downloadDriveFile(resumeMeta.id);
    const mdFiles = files.filter((f) => /\.md$/i.test(f.name));
    posts = (
      await mapLimit(mdFiles, 6, async (f) => {
        const content = await downloadDriveFile(f.id);
        return content
          ? buildPost({ content, filename: f.name, created: f.createdTime, updated: f.modifiedTime, url: f.webViewLink, id: f.id })
          : null;
      })
    ).filter(Boolean);
    posts = dedupeSlugs(posts);
  } else {
    resumeText = await downloadDriveFile(id);
  }

  if (resumeText === null) return { status: "error", message: "The Drive file exists but couldn't be downloaded. Make sure it's shared as \"Anyone with the link\"." };
  const resume = parseResumeJson(resumeText);

  return {
    status: "ok",
    data: {
      resume,
      github: null,
      repos: [],
      posts,
      source: {
        type: "gd",
        id,
        resumeFile: resumeMeta?.name || resumeFile,
        resumeUrl: resumeMeta?.webViewLink || "",
        updatedAt: resumeMeta?.modifiedTime || "",
        hasResume: true,
      },
    },
  };
}

/** GitHub repos for a Drive resume that lists a GitHub profile. */
async function attachGithubToDrive(data) {
  const gh = (data.resume?.basics?.profiles || []).find((p) => /github/i.test(p.network || "") || /github\.com\//i.test(p.url || ""));
  const username = gh?.username || gh?.url?.match(/github\.com\/([A-Za-z0-9-]+)/)?.[1];
  if (!username || isRateLimited()) return data;
  const user = await fetchGithubUser(username);
  if (user.status !== "ok") return data;
  return { ...data, github: user.user, repos: await fetchRepos(username) };
}

// ============================================================================
// SNAPSHOTS (offline / rate-limited fallback)
// ============================================================================

function snapshotKey(type, id) {
  return `${SNAPSHOT_PREFIX}${type}-${id.toLowerCase()}`;
}

function readSnapshot(type, id) {
  try {
    return JSON.parse(localStorage.getItem(snapshotKey(type, id)) || "null");
  } catch {
    return null;
  }
}

function writeSnapshot(type, id, data) {
  const payload = JSON.stringify({ savedAt: Date.now(), data });
  try {
    localStorage.setItem(snapshotKey(type, id), payload);
  } catch {
    // Quota: drop other portfolios' snapshots and retry once
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(SNAPSHOT_PREFIX) && k !== snapshotKey(type, id))
        .forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(snapshotKey(type, id), payload);
    } catch {
      /* give up silently */
    }
  }
}

// ============================================================================
// MAIN ENTRY
// ============================================================================

/**
 * @param {"gh"|"gd"|"auto"} source
 * @param {string} id
 * @param {{ force?: boolean }} opts
 * @returns {Promise<{status:"ok", data, offline?, savedAt?} | {status:"notfound", reason} |
 *   {status:"ratelimited", resetAt} | {status:"error", message, reason?} | {status:"invalid", error}>}
 */
export async function collectPortfolioData(source, id, { force = false } = {}) {
  debug("collect", source, id);
  const types = source === "auto" ? ["gh", "gd"] : [source];

  // Fresh snapshot → no network at all
  if (!force) {
    for (const type of types) {
      const snap = readSnapshot(type, id);
      if (snap && Date.now() - snap.savedAt < SNAPSHOT_TTL) return { status: "ok", data: snap.data, savedAt: snap.savedAt };
    }
  }

  let result;
  try {
    result = types[0] === "gd" ? await loadFromDrive(id) : await loadFromGithub(id);
    // Auto: a GitHub 404 for a Drive-shaped id → try Drive
    if (source === "auto" && result.status === "notfound" && /^[A-Za-z0-9_-]{20,}$/.test(id)) {
      const drive = await loadFromDrive(id);
      if (drive.status === "ok") result = drive;
    }
    if (result.status === "ok" && result.data.source.type === "gd") {
      result.data = await attachGithubToDrive(result.data);
    }
  } catch (e) {
    if (e.name === "ResumeParseError") return { status: "invalid", error: e };
    result = { status: "error", message: e.message || "Something went wrong while loading this portfolio." };
  }

  if (result.status === "ok") {
    writeSnapshot(result.data.source.type, id, result.data);
    rememberRecent(result.data);
    return result;
  }

  // Failure → fall back to any snapshot we have
  if (result.status === "ratelimited" || result.status === "error") {
    for (const type of types) {
      const snap = readSnapshot(type, id);
      if (snap) return { status: "ok", data: snap.data, offline: true, savedAt: snap.savedAt, resetAt: result.resetAt };
    }
  }
  return result;
}

// ============================================================================
// RECENT PORTFOLIOS (landing page)
// ============================================================================

function rememberRecent(data) {
  try {
    const name = data.resume?.basics?.name || data.github?.name || data.source.id;
    const entry = { type: data.source.type, id: data.source.id, name, at: Date.now() };
    const list = getRecent().filter((r) => !(r.type === entry.type && r.id.toLowerCase() === entry.id.toLowerCase()));
    localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...list].slice(0, 6)));
  } catch {
    /* ignore */
  }
}

export function getRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(list) ? list.filter((r) => r && r.id && r.type) : [];
  } catch {
    return [];
  }
}

export function clearRecent() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
}
