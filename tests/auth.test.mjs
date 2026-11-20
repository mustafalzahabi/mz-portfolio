// GitHub sign-in Pages Functions: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequestGet as login } from "../functions/api/auth/login.js";
import { onRequestGet as callback } from "../functions/api/auth/callback.js";
import { safeReturn } from "../functions/api/auth/_shared.js";

const env = { GITHUB_CLIENT_ID: "cid", GITHUB_CLIENT_SECRET: "secret" };
const req = (path, cookie = "") => new Request(`https://site.test${path}`, { headers: cookie ? { Cookie: cookie } : {} });

test("auth: return paths stay on this site", () => {
  assert.equal(safeReturn("/edit"), "/edit");
  assert.equal(safeReturn("//evil.com"), "/edit");
  assert.equal(safeReturn("https://evil.com"), "/edit");
  assert.equal(safeReturn("/\\evil.com"), "/edit");
  assert.equal(safeReturn(null), "/edit");
});

test("auth: login redirects to GitHub with the gist scope and a state cookie", async () => {
  const res = await login({ request: req("/api/auth/login?return=/edit"), env });
  assert.equal(res.status, 302);
  const to = new URL(res.headers.get("Location"));
  assert.equal(to.origin + to.pathname, "https://github.com/login/oauth/authorize");
  assert.equal(to.searchParams.get("scope"), "gist");
  assert.equal(to.searchParams.get("redirect_uri"), "https://site.test/api/auth/callback");
  const cookie = res.headers.get("Set-Cookie");
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
  assert.ok(cookie.includes(to.searchParams.get("state")));
});

test("auth: without env vars, login reports not_configured", async () => {
  const res = await login({ request: req("/api/auth/login"), env: {} });
  assert.equal(res.headers.get("Location"), "https://site.test/edit#gh_error=not_configured");
});

test("auth: callback rejects a mismatched state", async () => {
  const res = await callback({ request: req("/api/auth/callback?code=x&state=bad", "mz_gh_state=good%7C%2Fedit"), env });
  assert.equal(res.headers.get("Location"), "https://site.test/edit#gh_error=state");
});

test("auth: callback swaps the code for a token and returns it in the fragment", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://github.com/login/oauth/access_token");
    assert.equal(JSON.parse(init.body).client_secret, "secret");
    return Response.json({ access_token: "gho_abc" });
  });
  const res = await callback({ request: req("/api/auth/callback?code=x&state=n1", "mz_gh_state=n1%7C%2Fedit"), env });
  assert.equal(res.headers.get("Location"), "https://site.test/edit#gh_token=gho_abc");
  assert.match(res.headers.get("Set-Cookie"), /Max-Age=0/);
});
