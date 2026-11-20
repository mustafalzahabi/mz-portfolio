// ============================================================================
// SITE HEADER — one header for the home, preview and docs pages. Portfolios
// don't get it: they show only a small account corner (see accountCorner).
// ============================================================================

import { h } from "../utils.js";
import { logoImg } from "../icons.js";
import { BASE_PATH } from "../router.js";
import { buildThemeToggle } from "../theme.js";
import { accountMenu } from "../account.js";
import { cachedUser } from "../github.js";

const LINKS = [
  ["preview", "Try it"],
  ["docs", "Docs"],
];

/** current: "home" | "preview" | "docs" */
export function siteHeader(current = "home") {
  return h("header.site-top",
    h("a.brand", { href: BASE_PATH, "aria-label": "mz-portfolio home" }, logoImg(30), h("span.brand-name", "mz-portfolio")),
    h("nav.site-nav", { "aria-label": "Site" },
      LINKS.map(([key, label]) => h("a.site-link", { href: `${BASE_PATH}${key}`, "aria-current": key === current ? "page" : null }, label)),
    ),
    h("div.site-tools", buildThemeToggle("icon"), accountMenu({ user: cachedUser() })),
  );
}

/**
 * On portfolios: signed in → the avatar menu in the top corner (so you never
 * need the home page to reach your account). Signed out → nothing here; the
 * footer credit carries a quiet "Sign in" link.
 */
export function accountCorner() {
  const user = cachedUser();
  if (!user) return null;
  return h("div.account-corner", accountMenu({ user, items: [{ label: "mz-portfolio home", icon: "globe", href: BASE_PATH }] }));
}
