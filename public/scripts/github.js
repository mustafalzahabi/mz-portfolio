// ============================================================================
// GITHUB WRITE ACCESS — for the editor only.
// Sign-in (GitHub OAuth via /api/auth, or a pasted token) gives a token limited
// to gists. It is kept in
// localStorage until you sign out or GitHub rejects it (expired/revoked), never
// logged, and only ever sent to https://api.github.com in an Authorization
// header. Reads elsewhere in the app stay anonymous.
// ============================================================================

const API = "https://api.github.com";
const TOKEN_KEY = "mz-gh-token";
let lastScopes = null; // classic tokens report their scopes; fine-grained ones don't

export const TOKEN_HELP_URL =
  "https://github.com/settings/tokens/new?scopes=gist&description=mz-portfolio%20editor";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

const USER_KEY = "mz-gh-user";

/** The last known signed-in user ({ login, name, avatar_url }), to draw the UI before /user answers. */
export function cachedUser() {
  if (!getToken()) return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function rememberUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify({ login: user.login, id: user.id || null, name: user.name || "", avatar_url: user.avatar_url || "" }));
  } catch {
    /* ignore */
  }
  return user;
}

export function clearToken() {
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REPO_OK_KEY);
  } catch {
    /* ignore */
  }
}

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

async function request(method, path, body, { token: asToken, messages: extra = {} } = {}) {
  const token = asToken || getToken();
  if (!token) throw new GitHubError("Sign in with a GitHub token first.", 401);
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new GitHubError("Couldn't reach GitHub. Check your connection.", 0);
  }
  lastScopes = res.headers.get("x-oauth-scopes");
  if (!asToken && lastScopes !== null) rememberRepoScope(lastScopes);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (res.status === 401 && !asToken) clearToken();
  if (!res.ok) {
    const messages = {
      401: "GitHub rejected the token. It may be expired or mistyped.",
      403: "This token isn't allowed to change gists. Create one with the \"gist\" scope.",
      404: "That gist no longer exists, or the token can't see it.",
      422: data?.message || "GitHub couldn't accept that change.",
      ...extra,
    };
    throw new GitHubError(messages[res.status] || data?.message || `GitHub error ${res.status}.`, res.status);
  }
  return data;
}

/** Validates and stores a token. Returns the GitHub user. */
export async function signIn(token) {
  const clean = String(token || "").trim();
  if (!/^(gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}$/.test(clean)) {
    throw new GitHubError("That doesn't look like a GitHub token (they start with ghp_ or github_pat_).", 400);
  }
  localStorage.setItem(TOKEN_KEY, clean);
  try {
    const user = await request("GET", "/user");
    if (lastScopes !== null && !lastScopes.split(",").map((x) => x.trim()).includes("gist")) {
      throw new GitHubError("This token doesn't have the \"gist\" permission. Create one with only \"gist\" ticked.", 403);
    }
    return rememberUser(user);
  } catch (e) {
    clearToken();
    throw e;
  }
}

/**
 * A token kept without its user (an older version, or storage partly
 * cleared) would show "Sign in" forever: look the user up once, or drop a
 * token GitHub no longer accepts. Returns true when the user was restored.
 */
export async function repairSession() {
  if (!getToken() || cachedUser()) return false;
  try {
    return Boolean(await currentUser());
  } catch (e) {
    if (e.status === 401) clearToken();
    return false;
  }
}

export async function currentUser() {
  return getToken() ? rememberUser(await request("GET", "/user")) : null;
}

/** All of the signed-in user's gists (public and secret), newest first. */
export async function listMyGists(maxPages = 3) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await request("GET", `/gists?per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

export function getGist(id) {
  return request("GET", `/gists/${encodeURIComponent(id)}`);
}

export function createGist({ description, files, isPublic = true }) {
  return request("POST", "/gists", { description, public: isPublic, files });
}

/** files: { "name.md": { content } } — a null entry deletes that file. */
export function updateGist(id, { description, files }) {
  return request("PATCH", `/gists/${encodeURIComponent(id)}`, { description, files });
}

export function deleteGist(id) {
  return request("DELETE", `/gists/${encodeURIComponent(id)}`);
}

/** Full text of one file in a gist (the API truncates big files; fall back to raw_url). */
export async function gistFileText(gist, filename) {
  const file = gist.files?.[filename];
  if (!file) return null;
  if (!file.truncated && typeof file.content === "string") return file.content;
  const res = await fetch(file.raw_url, { cache: "no-store" });
  return res.ok ? res.text() : null;
}

/** Drops this app's cached copies of a user's data so the portfolio shows changes now. */
export function forgetCachedPortfolio(login) {
  try {
    const id = String(login).toLowerCase();
    for (const key of Object.keys(localStorage)) {
      const k = key.toLowerCase();
      if (k.startsWith("mz-portfolio-data-") && k.endsWith(`-${id}`)) localStorage.removeItem(key);
      if (k.startsWith(`mz-cache-gists-${id}-`)) localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

// ============================================================================
// REPO README — edited only after the person agrees to give mz-portfolio
// "public_repo" access, either for one save (the token is kept in this tab
// only and dropped right after) or always (it replaces the stored token).
// ============================================================================

const ONCE_KEY = "mz-gh-repo-once"; // sessionStorage: a token allowed for one README save
const REPO_OK_KEY = "mz-gh-repo-scope"; // localStorage "1": the stored token can change public repos

function rememberRepoScope(scopes) {
  const list = scopes.split(",").map((x) => x.trim());
  try {
    if (list.includes("public_repo") || list.includes("repo")) localStorage.setItem(REPO_OK_KEY, "1");
    else localStorage.removeItem(REPO_OK_KEY);
  } catch {
    /* ignore */
  }
}

function onceToken() {
  try {
    return sessionStorage.getItem(ONCE_KEY) || "";
  } catch {
    return "";
  }
}

/** Keeps a token for a single README save, in this tab only. */
export function setOnceToken(token) {
  try {
    sessionStorage.setItem(ONCE_KEY, String(token || ""));
  } catch {
    /* ignore */
  }
}

/** Drops the one-save token. */
export function dropOnceToken() {
  try {
    sessionStorage.removeItem(ONCE_KEY);
  } catch {
    /* ignore */
  }
}

/** "Always allow" README pushes was chosen on this device. */
export function repoScopeRemembered() {
  try {
    return localStorage.getItem(REPO_OK_KEY) === "1";
  } catch {
    return false;
  }
}

/** Ask again before the next README push. (Removing the access itself is done on GitHub.) */
export function forgetRepoScope() {
  try {
    localStorage.removeItem(REPO_OK_KEY);
  } catch {
    /* nothing kept */
  }
}

/** True when a README can be saved now without asking for more permission. */
export function canWriteRepos() {
  if (onceToken()) return true;
  try {
    return Boolean(getToken()) && localStorage.getItem(REPO_OK_KEY) === "1";
  } catch {
    return false;
  }
}

const toBase64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\s/g, "")), (c) => c.charCodeAt(0)));
export const base64 = { encode: toBase64, decode: fromBase64 };

const REPO_MESSAGES = {
  403: "GitHub didn't allow changing this repository with the current permission.",
  404: "That repository or README wasn't found, or it's private.",
  409: "The README changed on GitHub since you opened it.",
};

/** The repo's README: { path, sha, text }. Reading works with any token. */
export async function getRepoReadme(owner, repo, branch) {
  const ref = branch ? `?ref=${encodeURIComponent(branch)}` : "";
  const data = await request("GET", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme${ref}`, null, { token: onceToken() || undefined, messages: REPO_MESSAGES });
  return { path: data.path, sha: data.sha, text: fromBase64(data.content || "") };
}

/** Saves a file in a repo (sha = the version it was edited from). Returns the new sha. */
export async function putRepoFile(owner, repo, { path, text, sha, message, branch }) {
  const body = { message: message || `Update ${path}`, content: toBase64(text), sha };
  if (branch) body.branch = branch;
  const data = await request("PUT", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, body, { token: onceToken() || undefined, messages: REPO_MESSAGES });
  return data?.content?.sha || "";
}

// A README save waiting on the permission sign-in (which leaves the page):
// { owner, repo, branch, path, sha, text, message, mode: "once" | "always", returnPath }
const PENDING_KEY = "mz-readme-pending";

export function readmePending() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
  } catch {
    return null;
  }
}

export function setReadmePending(value) {
  try {
    if (value) sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}
