// ============================================================================
// STORAGE — where the signed-in owner's portfolio is saved. One interface,
// two places: GitHub gists (signed in with GitHub) or a Google Drive folder
// (signed in with Google). The editor only talks to this module.
//
//   session()                 → { provider, user } | null
//   storage()                 → the backend for that session, or null
//   backend.findResume(file)  → { resume, source } | null
//   backend.readResume(src)   → { text, updatedAt }
//   backend.writeResume(src|null, content, file) → source
//   backend.uploadImage(src, name, dataUrl) → public image URL
//   backend.listPosts / readPost / writePost / deletePost
//   backend.saveDraft / loadDraft / clearDraft   (private, never public)
//   backend.forgetCache()     → drop cached copies so changes show now
//   backend.homePath(src?)    → this owner's portfolio address
// ============================================================================

import { BASE_PATH } from "./router.js";
import { parseResumeJson } from "./data.js";
import {
  getToken, cachedUser, clearToken, listMyGists, getGist, createGist, updateGist, deleteGist, gistFileText, forgetCachedPortfolio,
} from "./github.js";
import {
  cachedGoogleUser, clearGoogle, driveRequest, DRIVE_UPLOAD, googleHome, setGoogleHome,
} from "./google.js";

export const DRAFT_FILE = "mz-portfolio-draft.json";

/** Who is signed in. One account at a time. */
export function session() {
  const gh = getToken() ? cachedUser() : null;
  if (gh) return { provider: "github", user: { ...gh, provider: "github" } };
  const g = cachedGoogleUser();
  if (g) return { provider: "google", user: g };
  return null;
}

export function signOutAll() {
  clearToken();
  clearGoogle();
}

export function storage() {
  const s = session();
  return s?.provider === "github" ? gistBackend : s?.provider === "google" ? driveBackend : null;
}

/** "My portfolio" address for whoever is signed in ("" when not known yet). */
export function myPortfolioPath() {
  const s = session();
  if (s?.provider === "github") return `${BASE_PATH}${encodeURIComponent(s.user.login)}`;
  if (s?.provider === "google") return googleHome() ? `${BASE_PATH}${googleHome()}` : "";
  return "";
}

// ============================================================================
// GITHUB GISTS
// ============================================================================

const gistBackend = {
  kind: "gist",
  label: "GitHub",

  async findResume(filename) {
    const gists = await listMyGists();
    const gist = gists.find((g) => g.files[filename]);
    if (!gist) return null;
    const full = await getGist(gist.id);
    return {
      resume: parseResumeJson(await gistFileText(full, filename)),
      source: { type: "gist", id: gist.id, filename, updatedAt: full.updated_at, url: full.html_url },
    };
  },

  async readResume(source) {
    const gist = await getGist(source.id);
    return { updatedAt: gist.updated_at, read: async () => gistFileText(gist, source.filename) };
  },

  async writeResume(source, content, filename) {
    if (source) {
      const saved = await updateGist(source.id, { files: { [source.filename]: { content } } });
      return { ...source, updatedAt: saved.updated_at };
    }
    const gist = await createGist({ description: "My resume", files: { [filename]: { content } }, isPublic: true });
    return { type: "gist", id: gist.id, filename, updatedAt: gist.updated_at, url: gist.html_url };
  },

  /** Gists only hold text: the image is stored as a data: URL in a .txt file. */
  async uploadImage(source, name, dataUrl) {
    const filename = `${name}.txt`;
    const saved = await updateGist(source.id, { files: { [filename]: { content: dataUrl } } });
    source.updatedAt = saved.updated_at;
    const raw = saved.files?.[filename]?.raw_url;
    if (!raw) throw new Error("GitHub didn't return a link for the uploaded image.");
    return raw;
  },

  async listPosts(resumeFile) {
    const gists = await listMyGists();
    return gists
      .filter((g) => Object.keys(g.files).some((f) => /\.md$/i.test(f)) && !g.files[resumeFile])
      .map((g) => {
        const filename = Object.keys(g.files).find((f) => /\.md$/i.test(f));
        return { gistId: g.id, filename, title: g.description || filename.replace(/\.md$/i, ""), updatedAt: g.updated_at, isPublic: g.public, url: g.html_url, loaded: false };
      });
  },

  async readPost(post) {
    const gist = await getGist(post.gistId);
    return { text: (await gistFileText(gist, post.filename)) || "", createdAt: gist.created_at, updatedAt: gist.updated_at };
  },

  async writePost(post, { title, filename, content, isPublic }) {
    if (post?.gistId) {
      const saved = await updateGist(post.gistId, { description: title, files: { [post.filename]: { content } } });
      return { gistId: post.gistId, filename: post.filename, updatedAt: saved.updated_at };
    }
    const gist = await createGist({ description: title, files: { [filename]: { content } }, isPublic });
    return { gistId: gist.id, filename, url: gist.html_url, isPublic: gist.public, updatedAt: gist.updated_at };
  },

  deletePost: (post) => deleteGist(post.gistId),

  postNoun: "gist",
  canBePrivate: true,

  async saveDraft(content) {
    const gists = await listMyGists();
    const existing = gists.find((g) => g.files[DRAFT_FILE]);
    if (existing) await updateGist(existing.id, { files: { [DRAFT_FILE]: { content } } });
    else await createGist({ description: "mz-portfolio draft (unpublished changes)", files: { [DRAFT_FILE]: { content } }, isPublic: false });
  },

  async loadDraft() {
    const gists = await listMyGists();
    const found = gists.find((g) => g.files[DRAFT_FILE]);
    if (!found) return null;
    const full = await getGist(found.id);
    return { text: await gistFileText(full, DRAFT_FILE) };
  },

  async clearDraft() {
    const gists = await listMyGists();
    const found = gists.find((g) => g.files[DRAFT_FILE]);
    if (found) await deleteGist(found.id);
  },

  forgetCache() {
    const s = session();
    if (s?.provider === "github") forgetCachedPortfolio(s.user.login);
  },

  homePath() {
    const s = session();
    return s ? `${BASE_PATH}${encodeURIComponent(s.user.login)}` : BASE_PATH;
  },

  /** Is this rendered portfolio (view-model source) the signed-in owner's? */
  owns(vmSource) {
    const s = session();
    return s?.provider === "github" && vmSource.type === "gh" && String(vmSource.id).toLowerCase() === s.user.login.toLowerCase();
  },
};

// ============================================================================
// GOOGLE DRIVE
// A folder "mz-portfolio" (shared: anyone with the link can view) holds
// resume.json, posts (.md) and images. The private draft lives in the app's
// hidden appDataFolder. Files are found by appProperties, so renaming or
// moving them in Drive doesn't lose them.
// ============================================================================

const FOLDER_MIME = "application/vnd.google-apps.folder";
const q = (s) => encodeURIComponent(s);
const FILE_FIELDS = "id,name,mimeType,modifiedTime,createdTime,parents,webViewLink";

/** Multipart upload: metadata + content in one request. */
function multipart(metadata, content, type = "application/json") {
  const boundary = `mz${Math.random().toString(36).slice(2)}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${type}\r\n\r\n`,
    content,
    `\r\n--${boundary}--`,
  ]);
  return { body, headers: { "Content-Type": `multipart/related; boundary=${boundary}` } };
}

async function driveCreate(metadata, content, type) {
  const { body, headers } = multipart(metadata, content, type);
  return driveRequest(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=${q(FILE_FIELDS)}`, { method: "POST", body, headers });
}

async function driveUpdate(id, content, type = "application/json") {
  return driveRequest(`${DRIVE_UPLOAD}/files/${id}?uploadType=media&fields=${q(FILE_FIELDS)}`, { method: "PATCH", body: content, headers: { "Content-Type": type } });
}

async function driveFind(query, { space = "drive", fields = FILE_FIELDS } = {}) {
  const res = await driveRequest(`/files?q=${q(`${query} and trashed = false`)}&spaces=${space}&fields=${q(`files(${fields})`)}&pageSize=100&orderBy=modifiedTime desc`);
  return res.files || [];
}

const tagged = (value) => `appProperties has { key='mzPortfolio' and value='${value}' }`;
const download = (id) => driveRequest(`/files/${id}?alt=media`, { raw: true });

async function makeFolderPublic(folderId) {
  await driveRequest(`/files/${folderId}/permissions`, {
    method: "POST",
    body: JSON.stringify({ type: "anyone", role: "reader" }),
    headers: { "Content-Type": "application/json" },
  });
}

/** data: URL → Blob (images are resized in the browser before upload). */
function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(",");
  const type = head.match(/data:([^;]+)/)?.[1] || "image/jpeg";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type });
}

const driveBackend = {
  kind: "drive",
  label: "Google Drive",

  async findResume(filename) {
    const [file] = await driveFind(tagged("resume"));
    if (!file) return null;
    const folderId = file.parents?.[0] || "";
    setGoogleHome(folderId);
    return {
      resume: parseResumeJson(await download(file.id)),
      source: { type: "drive", id: file.id, folderId, filename: file.name || filename, updatedAt: file.modifiedTime, url: file.webViewLink },
    };
  },

  async readResume(source) {
    const meta = await driveRequest(`/files/${source.id}?fields=modifiedTime`);
    return { updatedAt: meta.modifiedTime, read: () => download(source.id) };
  },

  async writeResume(source, content, filename) {
    if (source) {
      const saved = await driveUpdate(source.id, content);
      return { ...source, updatedAt: saved.modifiedTime };
    }
    // First publish: a shared folder with the resume inside
    const folder = await driveRequest(`/files?fields=${q(FILE_FIELDS)}`, {
      method: "POST",
      body: JSON.stringify({ name: "mz-portfolio", mimeType: FOLDER_MIME, appProperties: { mzPortfolio: "folder" } }),
      headers: { "Content-Type": "application/json" },
    });
    await makeFolderPublic(folder.id);
    const file = await driveCreate({ name: filename, parents: [folder.id], mimeType: "application/json", appProperties: { mzPortfolio: "resume" } }, content);
    setGoogleHome(folder.id);
    return { type: "drive", id: file.id, folderId: folder.id, filename, updatedAt: file.modifiedTime, url: file.webViewLink };
  },

  /** A real image file in the folder; a new file per upload so no cache shows the old one. */
  async uploadImage(source, name, dataUrl) {
    const blob = dataUrlToBlob(dataUrl);
    const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "img";
    const old = await driveFind(`'${source.folderId}' in parents and ${tagged(`image-${name}`)}`);
    const file = await driveCreate({ name: `${name}.${ext}`, parents: [source.folderId], appProperties: { mzPortfolio: `image-${name}` } }, blob, blob.type);
    await Promise.all(old.map((f) => driveRequest(`/files/${f.id}`, { method: "DELETE" }).catch(() => null)));
    return `https://lh3.googleusercontent.com/d/${file.id}`;
  },

  async listPosts() {
    const folderId = googleHome();
    if (!folderId) return [];
    const files = await driveFind(`'${folderId}' in parents and ${tagged("post")}`);
    return files.map((f) => ({ gistId: f.id, filename: f.name, title: f.name.replace(/\.md$/i, ""), updatedAt: f.modifiedTime, isPublic: true, url: f.webViewLink, loaded: false }));
  },

  async readPost(post) {
    const meta = await driveRequest(`/files/${post.gistId}?fields=createdTime,modifiedTime`);
    return { text: (await download(post.gistId)) || "", createdAt: meta.createdTime, updatedAt: meta.modifiedTime };
  },

  async writePost(post, { filename, content }) {
    if (post?.gistId) {
      const saved = await driveUpdate(post.gistId, content, "text/markdown");
      return { gistId: post.gistId, filename: post.filename, updatedAt: saved.modifiedTime };
    }
    const folderId = googleHome();
    if (!folderId) throw new Error("Publish your portfolio once before adding posts.");
    const file = await driveCreate({ name: filename, parents: [folderId], mimeType: "text/markdown", appProperties: { mzPortfolio: "post" } }, content, "text/markdown");
    return { gistId: file.id, filename, url: file.webViewLink, isPublic: true, updatedAt: file.modifiedTime };
  },

  deletePost: (post) => driveRequest(`/files/${post.gistId}`, { method: "DELETE" }),

  postNoun: "file in your Drive folder",
  canBePrivate: false,

  async saveDraft(content) {
    const [existing] = await driveFind(`name = '${DRAFT_FILE}'`, { space: "appDataFolder", fields: "id" });
    if (existing) await driveUpdate(existing.id, content);
    else await driveCreate({ name: DRAFT_FILE, parents: ["appDataFolder"], mimeType: "application/json" }, content);
  },

  async loadDraft() {
    const [found] = await driveFind(`name = '${DRAFT_FILE}'`, { space: "appDataFolder", fields: "id" });
    return found ? { text: await download(found.id) } : null;
  },

  async clearDraft() {
    const files = await driveFind(`name = '${DRAFT_FILE}'`, { space: "appDataFolder", fields: "id" });
    await Promise.all(files.map((f) => driveRequest(`/files/${f.id}`, { method: "DELETE" })));
  },

  forgetCache() {
    const id = googleHome();
    if (id) forgetCachedPortfolio(id);
  },

  homePath(source) {
    const id = source?.folderId || googleHome();
    return id ? `${BASE_PATH}${id}` : BASE_PATH;
  },

  owns(vmSource) {
    const s = session();
    return s?.provider === "google" && vmSource.type === "gd" && !!googleHome() && vmSource.id === googleHome();
  },
};
