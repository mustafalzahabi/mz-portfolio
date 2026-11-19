// ============================================================================
// ACCOUNT — "Sign in with GitHub", the avatar menu, sign out.
// Used by the landing page and the editor. Sign-in goes through the
// /api/auth Pages Function, which comes back to the page it started on with
// #gh_token=… (or #gh_error=…) in the URL fragment.
// ============================================================================

import { h, svgIcon, toast } from "./utils.js";
import { ICONS } from "./icons.js";
import { BASE_PATH } from "./router.js";
import { signIn, clearToken, cachedUser } from "./github.js";

const LOGIN_ERRORS = {
  denied: "Sign-in was cancelled on GitHub.",
  state: "Sign-in expired or was started in another tab. Please try again.",
  github: "GitHub didn't finish the sign-in. Please try again.",
  not_configured: "GitHub sign-in isn't set up on this site yet. Use a token instead (in the editor's sign-in options).",
};

export function loginUrl(returnPath = location.pathname) {
  return `/api/auth/login?return=${encodeURIComponent(returnPath)}`;
}

/** Finishes a sign-in redirect, if this page load is one. Returns the user or null. */
export async function completeSignIn() {
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get("gh_token");
  const error = params.get("gh_error");
  if (!token && !error) return null;
  history.replaceState(history.state, "", location.pathname + location.search);
  if (error) {
    toast(LOGIN_ERRORS[error] || LOGIN_ERRORS.github, "error");
    return null;
  }
  try {
    const user = await signIn(token);
    toast(`Signed in as ${user.login}`);
    return user;
  } catch (e) {
    toast(e.message, "error");
    return null;
  }
}

export function signOut() {
  clearToken();
  dispatchEvent(new CustomEvent("mz-auth", { detail: { user: null } }));
}

export function avatarImg(user, size = 32) {
  const initials = String(user?.name || user?.login || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const fallback = () => h("span.avatar.avatar-initials", { style: `--size:${size}px`, "aria-hidden": "true" }, initials);
  if (!user?.avatar_url) return fallback();
  const img = h("img.avatar", { src: user.avatar_url, alt: "", width: size, height: size, decoding: "async", style: `--size:${size}px` });
  img.addEventListener("error", () => img.replaceWith(fallback()));
  return img;
}

/**
 * A button that opens a menu. `items`: [{ label, icon, href | onclick }] or "sep".
 * `head` is an optional node shown above the items.
 */
export function dropdown({ button, label, items, head = null, className = "" }) {
  const wrap = h(`div.account${className}`);
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  if (label) button.setAttribute("aria-label", label);
  const entry = (i) => {
    if (i === "sep") return h("div.account-sep", { role: "separator" });
    const icon = i.icon ? svgIcon(ICONS[i.icon]) : null;
    if (i.href) return h("a.account-item", { role: "menuitem", href: i.href, target: i.newTab ? "_blank" : null, rel: i.newTab ? "noopener" : null }, icon, i.label);
    return h("button.account-item", { role: "menuitem", type: "button", onclick: () => { close(); i.onclick(); } }, icon, i.label);
  };
  const menu = h("div.account-menu", { role: "menu", hidden: true }, head, head ? entry("sep") : null, items.filter(Boolean).map(entry));
  const list = () => [...menu.querySelectorAll(".account-item")];
  const onDoc = (e) => {
    if (!wrap.contains(e.target)) close();
  };
  const onKey = (e) => {
    const all = list();
    const i = all.indexOf(document.activeElement);
    if (e.key === "Escape") {
      close();
      button.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      all[(i + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length]?.focus();
    } else if (e.key === "Tab") close();
  };
  function open() {
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", onDoc);
    menu.addEventListener("keydown", onKey);
    list()[0]?.focus();
  }
  function close() {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onDoc);
    menu.removeEventListener("keydown", onKey);
  }
  menu.addEventListener("click", (e) => e.target.closest("a.account-item") && close());
  button.addEventListener("click", () => (menu.hidden ? open() : close()));
  button.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && menu.hidden) {
      e.preventDefault();
      open();
    }
  });
  wrap.append(button, menu);
  return wrap;
}

/**
 * Signed out: a "Sign in" button. Signed in: the avatar, opening a menu.
 * `items` adds page-specific entries before "GitHub profile".
 */
export function accountMenu({ user = cachedUser(), items = [], returnPath } = {}) {
  if (!user) {
    return h("a.btn.btn-ghost.account-signin", { href: loginUrl(returnPath), dataset: { external: "" } }, svgIcon(ICONS.github), h("span", "Sign in"));
  }
  return dropdown({
    button: h("button.account-button", { type: "button" }, avatarImg(user, 32)),
    label: `Account: ${user.login}`,
    head: h("div.account-head", avatarImg(user, 40), h("div", h("strong", user.name || user.login), h("span.muted", `@${user.login}`))),
    items: [
      { label: "My portfolio", icon: "user", href: `${BASE_PATH}${encodeURIComponent(user.login)}` },
      { label: "Edit my portfolio", icon: "pencil", href: `${BASE_PATH}edit` },
      ...items,
      { label: "GitHub profile", icon: "github", href: `https://github.com/${encodeURIComponent(user.login)}` },
      "sep",
      { label: "Sign out", icon: "logout", onclick: signOut },
    ],
  });
}
