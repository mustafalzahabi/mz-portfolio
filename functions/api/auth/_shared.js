// ============================================================================
// GITHUB SIGN-IN — the only server code. Stateless: nothing is stored.
// GitHub needs a client secret to turn the login code into a token, and its
// token endpoint can't be called from a web page, so this one step runs here.
// Env (Cloudflare Pages → Settings → Variables): GITHUB_CLIENT_ID,
// GITHUB_CLIENT_SECRET (encrypted). The token goes back to the page in the URL
// fragment, which browsers never send to any server.
// ============================================================================

export const STATE_COOKIE = "mz_gh_state";
export const SCOPE = "gist";
// Asked for only when someone saves a repo README in the app (and they've agreed)
const EXTRA_SCOPES = new Set(["public_repo"]);

/** "gist", or "gist public_repo" when that allow-listed extra was asked for. */
export function scopeFor(extra) {
  return EXTRA_SCOPES.has(extra) ? `${SCOPE} ${extra}` : SCOPE;
}

/** Only same-site paths, so the login can't be used to redirect elsewhere. */
export function safeReturn(path) {
  return typeof path === "string" && /^\/(?!\/)[^\\\s]*$/.test(path) ? path : "/edit";
}

export function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

export function cookie(value, maxAge) {
  return `${STATE_COOKIE}=${encodeURIComponent(value)}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function backTo(origin, path, params, extraHeaders = {}) {
  const url = new URL(path, origin);
  url.hash = new URLSearchParams(params).toString();
  return new Response(null, { status: 302, headers: { Location: url.href, "Cache-Control": "no-store", ...extraHeaders } });
}
