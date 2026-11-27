// ============================================================================
// STORAGE — where the signed-in owner's portfolio is saved. One interface,
// two places: GitHub gists (signed in with GitHub) or a Google Drive folder
// (signed in with Google), or both for an account that linked the two
// (account-link.js): then reads combine both and publishing writes to both.
// The editor only talks to this module.
//
//   session()                 → { provider, user, providers, account } | null
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
import { toast } from "./utils.js";
import { parseResumeJson, publicResume } from "./data.js";
import {
  getToken, cachedUser, clearToken, listMyGists, getGist, createGist, updateGist, deleteGist, gistFileText, forgetCachedPortfolio,
} from "./github.js";
import {
  cachedGoogleUser, clearGoogle, driveRequest, DRIVE_UPLOAD, googleHome, setGoogleHome, getGoogleToken,
} from "./google.js";
import {
  ACCOUNT_FILE, readCachedAccount, writeCachedAccount, normalizeRecord, mergeRecords, makeLinkedRecord, isLinked, recordMatches, publicSourcesOf,
} from "./account-link.js";
import { combineResumes, STORES, STORE_LABEL } from "./combine.js";

export const DRAFT_FILE = "mz-portfolio-draft.json";

/**
 * Who is signed in. Both providers can be at once; a linked account (one
 * person, both sign-ins) is shown as one, led by its "primary" identity.
 *   provider   "github" | "google": whose details lead
 *   providers  { github, google }: each signed-in identity, or null
 *   account    the linked account record, or null
 */
export function session() {
  const gh = getToken() ? cachedUser() : null;
  const g = cachedGoogleUser();
  if (!gh && !g) return null;
  const rec = readCachedAccount();
  const account = isLinked(rec) && recordMatches(rec, { githubLogin: gh?.login, googleEmail: g?.email }) ? rec : null;
  const providers = { github: gh ? { ...gh, provider: "github" } : null, google: g || null };
  let provider = gh ? "github" : "google";
  if (account && providers[account.prefs.primary]) provider = account.prefs.primary;
  return { provider, user: { ...providers[provider], provider, linked: Boolean(account) }, providers, account };
}

export function signOutAll() {
  clearToken();
  clearGoogle();
  writeCachedAccount(null);
}

/** Sign out of one provider only (a linked account stays linked). */
export function signOutOf(provider) {
  if (provider === "github") clearToken();
  else clearGoogle();
}

export function storage() {
  const s = session();
  if (!s) return null;
  if (s.account) return accountStore;
  return s.provider === "github" ? gistBackend : driveBackend;
}

/** "My portfolio" address for whoever is signed in ("" when not known yet). */
export function myPortfolioPath() {
  const s = session();
  if (s?.account) return accountStore.homePath();
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
      resume: withoutPublicSources(parseResumeJson(await gistFileText(full, filename))),
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

  // Private files (the draft, the account link) are secret gists: unlisted, never shown on the portfolio
  async writePrivate(name, content, description) {
    const gists = await listMyGists();
    const existing = gists.find((g) => g.files[name]);
    if (existing) await updateGist(existing.id, { files: { [name]: { content } } });
    else await createGist({ description, files: { [name]: { content } }, isPublic: false });
  },

  async readPrivate(name) {
    const gists = await listMyGists();
    const found = gists.find((g) => g.files[name]);
    if (!found) return null;
    return { text: await gistFileText(await getGist(found.id), name) };
  },

  async deletePrivate(name) {
    const gists = await listMyGists();
    await Promise.all(gists.filter((g) => g.files[name]).map((g) => deleteGist(g.id)));
  },

  saveDraft(content) {
    return this.writePrivate(DRAFT_FILE, content, "mz-portfolio draft (unpublished changes)");
  },
  loadDraft() {
    return this.readPrivate(DRAFT_FILE);
  },
  clearDraft() {
    return this.deletePrivate(DRAFT_FILE);
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
      resume: withoutPublicSources(parseResumeJson(await download(file.id))),
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

  // Private files live in the app's hidden folder (only this app can read it)
  async writePrivate(name, content) {
    const [existing] = await driveFind(`name = '${name}'`, { space: "appDataFolder", fields: "id" });
    if (existing) await driveUpdate(existing.id, content);
    else await driveCreate({ name, parents: ["appDataFolder"], mimeType: "application/json" }, content);
  },

  async readPrivate(name) {
    const [found] = await driveFind(`name = '${name}'`, { space: "appDataFolder", fields: "id" });
    return found ? { text: await download(found.id) } : null;
  },

  async deletePrivate(name) {
    const files = await driveFind(`name = '${name}'`, { space: "appDataFolder", fields: "id" });
    await Promise.all(files.map((f) => driveRequest(`/files/${f.id}`, { method: "DELETE" })));
  },

  saveDraft(content) {
    return this.writePrivate(DRAFT_FILE, content);
  },
  loadDraft() {
    return this.readPrivate(DRAFT_FILE);
  },
  clearDraft() {
    return this.deletePrivate(DRAFT_FILE);
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

// ============================================================================
// LINKED ACCOUNT — GitHub and Google as one. Reads combine both stores (a
// store this device isn't signed in to is read like a visitor reads it);
// writes go to the stores the owner chose, among those signed in here.
// ============================================================================

const BACKENDS = { github: gistBackend, google: driveBackend };
const hasToken = (store) => (store === "github" ? Boolean(getToken()) : Boolean(getGoogleToken()));
const linkedAccount = () => session()?.account || null;
const prefs = () => linkedAccount()?.prefs;
const CONFIG_KEY = "mz-portfolio-config";

/** The store a new post / image goes to: the chosen one, else the primary, among those signed in here. */
function writeTarget(pref) {
  const p = prefs();
  const order = [pref, p?.primary, ...STORES].filter(Boolean);
  return order.find((s) => hasToken(s)) || null;
}

const stamp = (stamps) => STORES.map((s) => stamps?.[s] || "").join("|");

/** The published config names both addresses, so visitors of either get the combined portfolio. */
function withPublicSources(content, account) {
  const sources = publicSourcesOf(account);
  if (!sources) return content;
  try {
    const resume = JSON.parse(content);
    resume.meta ||= {};
    let c = resume.meta[CONFIG_KEY];
    if (Array.isArray(c)) c = c[0] ||= {};
    else if (!c || typeof c !== "object") c = resume.meta[CONFIG_KEY] = {};
    c.sources = sources;
    return `${JSON.stringify(resume, null, 2)}\n`;
  } catch {
    return content;
  }
}

/** The editor never sees "sources": it's written on publish from Account settings. */
function withoutPublicSources(resume) {
  let c = resume?.meta?.[CONFIG_KEY];
  if (Array.isArray(c)) c = c[0];
  if (c && typeof c === "object") delete c.sources;
  return resume;
}

const accountStore = {
  kind: "account",
  get label() {
    const p = prefs();
    const to = p?.publishTo === "both" ? STORES : [p?.publishTo || "github"];
    return to.map((s) => STORE_LABEL[s]).join(" and ");
  },

  async findResume(filename) {
    const account = linkedAccount();
    const parts = await Promise.all(STORES.map(async (store) => {
      try {
        if (hasToken(store)) {
          const found = await BACKENDS[store].findResume(filename);
          return { store, resume: found?.resume || null, updatedAt: found?.source.updatedAt || "", source: found?.source || null };
        }
        const id = store === "github" ? account.github.login : account.google.folderId;
        const pub = id ? await publicResume(store === "github" ? "gh" : "gd", id) : null;
        return { store, resume: pub?.resume || null, updatedAt: pub?.updatedAt || "", source: null };
      } catch {
        return { store, resume: null, updatedAt: "", source: null };
      }
    }));
    if (!parts.some((p) => p.resume)) return null;
    const { resume, origins } = combineResumes(parts, account.prefs.sources);
    const stamps = Object.fromEntries(parts.map((p) => [p.store, p.updatedAt]));
    return {
      resume: withoutPublicSources(resume),
      origins,
      source: { type: "account", filename, parts: Object.fromEntries(parts.map((p) => [p.store, p.source])), stamps, updatedAt: stamp(stamps) },
    };
  },

  /** For "changed elsewhere" checks: the combined version and its stamp. */
  async readResume(source) {
    const found = await this.findResume(source.filename);
    return { updatedAt: found?.source.updatedAt || "", read: async () => JSON.stringify(found?.resume || {}) };
  },

  async writeResume(source, content, filename) {
    let account = linkedAccount();
    const p = account.prefs;
    // Drive first: a new Drive folder's address then goes into what GitHub gets
    const targets = (p.publishTo === "both" ? STORES : [p.publishTo]).slice().sort((a) => (a === "google" ? -1 : 1));
    const parts = { ...(source?.parts || {}) };
    const stamps = { ...(source?.stamps || {}) };
    const skipped = [];
    for (const store of targets) {
      if (!hasToken(store)) {
        skipped.push(store);
        continue;
      }
      const saved = await BACKENDS[store].writeResume(parts[store] || null, withPublicSources(content, account), filename);
      parts[store] = saved;
      stamps[store] = saved.updatedAt;
      if (store === "google" && saved.folderId && saved.folderId !== account.google.folderId) {
        account = await saveAccount({ ...account, google: { ...account.google, folderId: saved.folderId } });
      }
    }
    if (skipped.length) toast(`Not published to ${skipped.map((s) => STORE_LABEL[s]).join(" or ")} from this device: sign in with it again (Account settings) to keep it up to date.`);
    return { type: "account", filename, parts, stamps, updatedAt: stamp(stamps) };
  },

  async uploadImage(source, name, dataUrl) {
    const store = writeTarget(prefs()?.imagesTo);
    if (!store) throw new Error("Sign in again to upload images.");
    let part = source?.parts?.[store];
    // That store has no portfolio yet: images go where the portfolio already is
    if (!part) {
      const other = STORES.find((s) => s !== store && hasToken(s) && source?.parts?.[s]);
      if (!other) throw new Error("Publish your portfolio once before adding images.");
      return BACKENDS[other].uploadImage(source.parts[other], name, dataUrl);
    }
    return BACKENDS[store].uploadImage(part, name, dataUrl);
  },

  async listPosts(resumeFile) {
    const lists = await Promise.all(STORES.filter(hasToken).map(async (store) => {
      try {
        return (await BACKENDS[store].listPosts(resumeFile)).map((post) => ({ ...post, store }));
      } catch {
        return [];
      }
    }));
    return lists.flat();
  },

  readPost: (post) => BACKENDS[post.store || writeTarget()]?.readPost(post),

  async writePost(post, fields) {
    const store = post?.store && hasToken(post.store) ? post.store : writeTarget(prefs()?.newPostsTo);
    if (!store) throw new Error("Sign in again to save posts.");
    return { ...(await BACKENDS[store].writePost(post?.store === store ? post : null, fields)), store };
  },

  deletePost(post) {
    if (!hasToken(post.store)) throw new Error(`Sign in with ${STORE_LABEL[post.store]} to delete this post.`);
    return BACKENDS[post.store].deletePost(post);
  },

  get postNoun() {
    return BACKENDS[writeTarget(prefs()?.newPostsTo) || "github"].postNoun;
  },
  get canBePrivate() {
    return BACKENDS[writeTarget(prefs()?.newPostsTo) || "github"].canBePrivate;
  },

  // The draft is kept in the primary store (or whichever is signed in here)
  saveDraft: (content) => BACKENDS[writeTarget()].saveDraft(content),
  loadDraft: () => BACKENDS[writeTarget()].loadDraft(),
  clearDraft: () => Promise.all(STORES.filter(hasToken).map((s) => BACKENDS[s].clearDraft().catch(() => null))),

  forgetCache() {
    const a = linkedAccount();
    if (a?.github?.login) forgetCachedPortfolio(a.github.login);
    if (a?.google?.folderId) forgetCachedPortfolio(a.google.folderId);
  },

  /** The primary address (GitHub's, or the Drive folder's). */
  homePath() {
    const a = linkedAccount();
    const drive = a?.google?.folderId ? `${BASE_PATH}${a.google.folderId}` : "";
    const gh = a?.github?.login ? `${BASE_PATH}${encodeURIComponent(a.github.login)}` : "";
    return (a?.prefs.primary === "google" ? drive || gh : gh || drive) || BASE_PATH;
  },

  /** Either address of this account is "mine". */
  owns(vmSource) {
    const a = linkedAccount();
    if (!a) return false;
    if (vmSource.type === "gh") return String(vmSource.id).toLowerCase() === a.github.login.toLowerCase();
    if (vmSource.type === "gd") return Boolean(a.google.folderId) && vmSource.id === a.google.folderId;
    return false;
  },
};

// ============================================================================
// THE LINK RECORD — read and written in each signed-in store's private file
// ============================================================================

async function readRecordFrom(store) {
  try {
    const found = await BACKENDS[store].readPrivate(ACCOUNT_FILE);
    return found?.text ? normalizeRecord(JSON.parse(found.text)) : null;
  } catch {
    return null;
  }
}

/** Saves the record to every store signed in here, and to this device. Returns it. */
export async function saveAccount(rec) {
  const record = { ...rec, updatedAt: new Date().toISOString() };
  const content = `${JSON.stringify(record, null, 2)}\n`;
  await Promise.all(STORES.filter(hasToken).map((s) =>
    BACKENDS[s].writePrivate(ACCOUNT_FILE, content, "mz-portfolio account (links your GitHub and Google sign-ins)").catch(() => null)));
  writeCachedAccount(record);
  return record;
}

/**
 * After a sign-in: reads the link from each signed-in store, so a person who
 * linked on another device gets their one account here too.
 * Returns the linked record for whoever is signed in, or null.
 */
export async function refreshAccount() {
  const gh = getToken() ? cachedUser() : null;
  const g = cachedGoogleUser();
  const who = { githubLogin: gh?.login, googleEmail: g?.email };
  const copies = await Promise.all(STORES.filter(hasToken).map(readRecordFrom));
  let rec = copies.reduce((a, b) => mergeRecords(a, b), null);
  // A record in one store that names someone else signed in to the other: not this person's link
  if (rec && gh && rec.github && rec.github.login.toLowerCase() !== gh.login.toLowerCase()) rec = null;
  if (rec && g && rec.google && rec.google.email !== String(g.email || "").toLowerCase()) rec = null;
  if (rec && isLinked(rec) && recordMatches(rec, who)) {
    writeCachedAccount(rec);
    return rec;
  }
  const cached = readCachedAccount();
  if (cached && !recordMatches(cached, who)) writeCachedAccount(null); // another person's, on a shared device
  return null;
}

/** Both providers are signed in here: make them one account (works when both already have portfolios). */
export async function linkNow() {
  const gh = cachedUser();
  const g = cachedGoogleUser();
  if (!getToken() || !gh || !g) throw new Error("Sign in with both GitHub and Google to link them.");
  if (!googleHome()) await driveBackend.findResume(ACCOUNT_FILE).catch(() => null); // learns the Drive folder, if any
  const previous = (await Promise.all(STORES.map(readRecordFrom))).reduce((a, b) => mergeRecords(a, b), null);
  return saveAccount(makeLinkedRecord({
    github: { login: gh.login, id: gh.id },
    google: { email: g.email, folderId: googleHome() || "" },
    previous: previous && recordMatches(previous, { githubLogin: gh.login, googleEmail: g.email }) ? previous : null,
  }));
}

/** Changes account settings (prefs), saved everywhere. */
export async function updateAccountPrefs(patch) {
  const rec = readCachedAccount();
  if (!rec) return null;
  return saveAccount({ ...rec, prefs: { ...rec.prefs, ...patch, sources: { ...rec.prefs.sources, ...(patch.sources || {}) } } });
}

/** Separate the two again. Each keeps its own portfolio; the next publish stops combining them. */
export async function unlinkAccount() {
  await Promise.all(STORES.filter(hasToken).map((s) => BACKENDS[s].deletePrivate(ACCOUNT_FILE).catch(() => null)));
  writeCachedAccount(null);
}
