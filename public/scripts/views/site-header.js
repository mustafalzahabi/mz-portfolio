// ============================================================================
// SITE HEADER — one header for the home, preview and docs pages. Portfolios
// don't get it: a signed-in user's avatar sits in the portfolio's own top row.
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
    h("div.site-tools", buildThemeToggle("switch"), accountMenu({ user: cachedUser() })),
  );
}
