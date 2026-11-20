// GET /api/auth/login?return=/edit → GitHub's authorize page
import { SCOPE, safeReturn, cookie, backTo } from "./_shared.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const ret = safeReturn(url.searchParams.get("return"));
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return backTo(url.origin, ret, { gh_error: "not_configured" });
  }
  const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const auth = new URL("https://github.com/login/oauth/authorize");
  auth.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  auth.searchParams.set("redirect_uri", `${url.origin}/api/auth/callback`);
  auth.searchParams.set("scope", SCOPE);
  auth.searchParams.set("state", nonce);
  auth.searchParams.set("allow_signup", "true");
  return new Response(null, {
    status: 302,
    headers: { Location: auth.href, "Set-Cookie": cookie(`${nonce}|${ret}`, 600), "Cache-Control": "no-store" },
  });
}
