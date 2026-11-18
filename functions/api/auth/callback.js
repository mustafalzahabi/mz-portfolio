// GET /api/auth/callback?code&state → back to the app with the token in the #fragment
import { STATE_COOKIE, safeReturn, readCookie, cookie, backTo } from "./_shared.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const [nonce, ret] = readCookie(request, STATE_COOKIE).split("|");
  const path = safeReturn(ret);
  const clear = { "Set-Cookie": cookie("", 0) };
  const fail = (code) => backTo(url.origin, path, { gh_error: code }, clear);

  if (url.searchParams.get("error")) return fail(url.searchParams.get("error") === "access_denied" ? "denied" : "github");
  const code = url.searchParams.get("code");
  if (!code || !nonce || url.searchParams.get("state") !== nonce) return fail("state");
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return fail("not_configured");

  let data;
  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "mz-portfolio" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${url.origin}/api/auth/callback`,
      }),
    });
    data = await res.json();
  } catch {
    return fail("github");
  }
  if (!data?.access_token) return fail("github");
  return backTo(url.origin, path, { gh_token: data.access_token }, clear);
}
