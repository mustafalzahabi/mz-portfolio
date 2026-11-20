// ============================================================================
// ACCOUNT — sign in with GitHub or Google, the avatar menu, sign out.
// One account at a time. GitHub sign-in goes through the /api/auth Pages
// Function, which comes back with #gh_token=… (or #gh_error=…). Google's
// comes straight back to the site root with #access_token=…&state=… (see
// google.js).
// ============================================================================

import { h, svgIcon, toast } from "./utils.js";
import { ICONS, logoImg } from "./icons.js";
import { BASE_PATH } from "./router.js";
import { signIn, clearToken } from "./github.js";
import { googleLoginUrl, completeGoogleSignIn, clearGoogle, googleClientId } from "./google.js";
import { session, signOutAll, myPortfolioPath } from "./storage.js";

const LOGIN_ERRORS = {
  denied: "Sign-in was cancelled on GitHub.",
  state: "Sign-in expired or was started in another tab. Please try again.",
  github: "GitHub didn't finish the sign-in. Please try again.",
  not_configured: "GitHub sign-in isn't set up on this site yet. Use a token instead (in the editor's sign-in options).",
};

export function loginUrl(returnPath = location.pathname) {
  return `/api/auth/login?return=${encodeURIComponent(returnPath)}`;
}

/** True when this page load is coming back from a sign-in. */
export function isSignInReturn() {
  return /[#&](gh_(token|error)|access_token|error)=/.test(location.hash) && (/gh_/.test(location.hash) || /[#&]state=/.test(location.hash));
}

/**
 * Finishes a sign-in redirect, if this page load is one.
 * Returns { user, returnPath? } or null.
 */
export async function completeSignIn() {
  if (/[#&]state=/.test(location.hash) && !/gh_/.test(location.hash)) {
    const result = await completeGoogleSignIn();
    if (!result) return null;
    if (result.error) {
      toast(result.error, "error");
      return null;
    }
    clearToken(); // one account at a time
    toast(`Signed in as ${result.user.name || result.user.email}`);
    return result;
  }
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
    clearGoogle(); // one account at a time
    toast(`Signed in as ${user.login}`);
    return { user };
  } catch (e) {
    toast(e.message, "error");
    return null;
  }
}

export function signOut() {
  signOutAll();
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
    if (i.href) return h("a.account-item", { role: "menuitem", href: i.href, target: i.newTab ? "_blank" : null, rel: i.newTab ? "noopener" : null, dataset: { external: i.external ? "" : null } }, icon, i.label);
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

/** The sign-in choices: GitHub always, Google when the site has a client ID. */
export function signInOptions(returnPath = location.pathname + location.search) {
  return [
    { label: "Continue with GitHub", icon: "github", href: loginUrl(returnPath), external: true },
    googleClientId() ? { label: "Continue with Google", icon: "google", href: googleLoginUrl(returnPath), external: true } : null,
  ].filter(Boolean);
}

/**
 * Signed out: "Sign in", opening the choice of GitHub or Google.
 * Signed in: the avatar, opening a menu. `items` adds page-specific entries.
 */
export function accountMenu({ user = session()?.user, items = [], returnPath } = {}) {
  if (!user) {
    return h("button.btn.btn-ghost.account-signin", { type: "button", onclick: () => openSignIn(returnPath) },
      svgIcon(ICONS.user), h("span", "Sign in"));
  }
  const google = user.provider === "google";
  const home = myPortfolioPath();
  return dropdown({
    button: h("button.account-button", { type: "button" }, avatarImg(user, 32)),
    label: `Account: ${user.name || user.login}`,
    head: h("div.account-head", avatarImg(user, 40), h("div",
      h("strong", user.name || user.login),
      h("span.muted", google ? user.email : `@${user.login}`),
      h("span.account-provider", svgIcon(ICONS[google ? "google" : "github"]), google ? "Google Drive" : "GitHub"))),
    items: [
      home ? { label: "My portfolio", icon: "user", href: home } : null,
      { label: home ? "Edit my portfolio" : "Create my portfolio", icon: "pencil", href: `${BASE_PATH}edit` },
      ...items,
      google ? null : { label: "GitHub profile", icon: "github", href: `https://github.com/${encodeURIComponent(user.login)}` },
      "sep",
      { label: "Sign out", icon: "logout", onclick: signOut },
    ],
  });
}

/** The sign-in overlay: every provider in one place, opened from any "Sign in" button. */
export function openSignIn(returnPath = location.pathname + location.search) {
  const close = () => dialog.close();
  const dialog = h("dialog.signin-dialog", { "aria-labelledby": "signin-title" },
    h("div.signin-card",
      h("button.signin-close", { type: "button", "aria-label": "Close", onclick: close }, "×"),
      h("div.signin-mark", logoImg(40)),
      h("h2#signin-title", "Sign in to mz-portfolio"),
      h("p.muted", "Your portfolio is saved to your own account. Pick where it lives."),
      h("div.signin-options", signInOptions(returnPath).map((o) =>
        h("a.btn.btn-ghost.signin-option", { href: o.href, dataset: { external: "" } }, svgIcon(ICONS[o.icon]), o.label))),
      h("p.signin-note.muted", h("a", { href: BASE_PATH + "privacy" }, "Privacy policy")),
    ),
  );
  dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });
  dialog.addEventListener("close", () => dialog.remove());
  document.body.appendChild(dialog);
  dialog.showModal();
}
