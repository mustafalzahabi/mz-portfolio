// ============================================================================
// GITHUB WRITE ACCESS — for the editor only.
// The visitor pastes a personal access token limited to gists. It is kept in
// sessionStorage (this browser tab only, gone when the tab closes), never
// logged, and only ever sent to https://api.github.com in an Authorization
// header. Reads elsewhere in the app stay anonymous.
// ============================================================================

const API = "https://api.github.com";
const TOKEN_KEY = "mz-gh-token";

export const TOKEN_HELP_URL =
  "https://github.com/settings/tokens/new?scopes=gist&description=mz-portfolio%20editor";

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
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

async function request(method, path, body) {
  const token = getToken();
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
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const messages = {
      401: "GitHub rejected the token. It may be expired or mistyped.",
      403: "This token isn't allowed to change gists. Create one with the \"gist\" scope.",
      404: "That gist no longer exists, or the token can't see it.",
      422: data?.message || "GitHub couldn't accept that change.",
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
  sessionStorage.setItem(TOKEN_KEY, clean);
  try {
    return await request("GET", "/user");
  } catch (e) {
    clearToken();
    throw e;
  }
}

export async function currentUser() {
  return getToken() ? request("GET", "/user") : null;
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
