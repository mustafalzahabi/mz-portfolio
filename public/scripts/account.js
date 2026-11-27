// ============================================================================
// ACCOUNT — sign in with GitHub or Google, the avatar menu, sign out.
// Both can be signed in at once, and linked into one account (Account
// settings, or the offer shown when both are signed in). GitHub sign-in goes
// through the /api/auth Pages Function, which comes back with #gh_token=…
// (or #gh_error=…). Google's comes straight back to the site root with
// #access_token=…&state=… (see google.js).
// ============================================================================

import { h, svgIcon, toast } from "./utils.js";
import { ICONS, logoImg } from "./icons.js";
import { BASE_PATH } from "./router.js";
import { signIn, readmePending, setReadmePending, setOnceToken } from "./github.js";
import { googleLoginUrl, completeGoogleSignIn, googleClientId } from "./google.js";
import { session, signOutAll, myPortfolioPath, refreshAccount, linkNow } from "./storage.js";

const LINK_KEY = "mz-link-pending"; // "Connect Google / GitHub" started from Account settings
const DISMISS_KEY = "mz-link-dismissed"; // "Not now" for this pair of sign-ins

const LOGIN_ERRORS = {
  denied: "Sign-in was cancelled on GitHub.",
  state: "Sign-in expired or was started in another tab. Please try again.",
  github: "GitHub didn't finish the sign-in. Please try again.",
  not_configured: "GitHub sign-in isn't set up on this site yet. Use a token instead (in the editor's sign-in options).",
};

export function loginUrl(returnPath = location.pathname, { repoAccess = false } = {}) {
  return `/api/auth/login?return=${encodeURIComponent(returnPath)}${repoAccess ? "&scope=public_repo" : ""}`;
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
    toast(`Signed in as ${result.user.name || result.user.email}`);
    await afterSignIn();
    return result;
  }
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get("gh_token");
  const error = params.get("gh_error");
  if (!token && !error) return null;
  history.replaceState(history.state, "", location.pathname + location.search);
  const pending = readmePending();
  if (error) {
    if (pending) setReadmePending({ ...pending, denied: true });
    toast(pending && error === "denied" ? "Permission wasn't given, so the README wasn't saved." : LOGIN_ERRORS[error] || LOGIN_ERRORS.github, "error");
    return null;
  }
  // "Allow once" for a README save: keep this token for that save only,
  // and stay signed in with the usual gist-only one
  if (pending?.mode === "once") {
    setOnceToken(token);
    return null;
  }
  try {
    const user = await signIn(token);
    toast(`Signed in as ${user.login}`);
    await afterSignIn();
    return { user };
  } catch (e) {
    toast(e.message, "error");
    return null;
  }
}

// ============================================================================
// ONE ACCOUNT FROM TWO SIGN-INS
// ============================================================================

/** Starts the other provider's sign-in; coming back, the two are linked. */
export function connectProvider(provider, returnPath = location.pathname + location.search) {
  const url = provider === "google" ? googleLoginUrl(returnPath) : loginUrl(returnPath);
  if (!url) return toast("Google sign-in isn't set up on this site.", "error");
  try {
    sessionStorage.setItem(LINK_KEY, "1");
  } catch {
    /* the offer to link still shows when both are signed in */
  }
  location.assign(url);
}

/**
 * After any sign-in: finish a "Connect" that was started, else read the link
 * from the account (made on another device), else, when both providers are
 * signed in here but not linked, offer to link them.
 */
async function afterSignIn() {
  let wanted = false;
  try {
    wanted = sessionStorage.getItem(LINK_KEY) === "1";
    sessionStorage.removeItem(LINK_KEY);
  } catch {
    /* no session storage */
  }
  const s = session();
  const both = Boolean(s?.providers.github && s?.providers.google);
  try {
    if (both && wanted) {
      await linkNow();
      toast("GitHub and Google are now one account. Either sign-in opens it.");
      return;
    }
    const linked = await refreshAccount();
    if (both && !linked) setTimeout(offerLink, 900); // once the page has drawn
  } catch (e) {
    toast(e.message, "error");
  }
}

/** Both sign-ins on this device but not linked: ask (never linked on an email match alone). */
export function offerLink() {
  const s = session();
  const gh = s?.providers.github;
  const g = s?.providers.google;
  if (!gh || !g || s.account || document.querySelector(".link-dialog")) return;
  const pair = `${gh.login}|${g.email}`.toLowerCase();
  try {
    if (localStorage.getItem(DISMISS_KEY) === pair) return;
  } catch {
    /* ask */
  }
  const close = () => dialog.close();
  const link = async () => {
    linkBtn.disabled = true;
    try {
      await linkNow();
      close();
      toast("Linked. GitHub and Google are now one account.");
      dispatchEvent(new CustomEvent("mz-auth", { detail: { user: session()?.user } }));
    } catch (e) {
      linkBtn.disabled = false;
      toast(e.message, "error");
    }
  };
  const linkBtn = h("button.btn.btn-primary", { type: "button", onclick: link }, "Link them");
  const dialog = h("dialog.signin-dialog.link-dialog", { "aria-labelledby": "link-title" },
    h("div.signin-card",
      h("h2#link-title", "Make these one account?"),
      h("p.muted", "You're signed in with both on this device:"),
      h("ul.link-who",
        h("li", svgIcon(ICONS.github), h("span", `@${gh.login}`)),
        h("li", svgIcon(ICONS.google), h("span", g.email))),
      h("p.muted", "Linked, either sign-in opens the same account, and your portfolio combines what's in both (the newest wins). You can unlink in Account settings."),
      h("div.link-actions",
        h("button.btn.btn-ghost", { type: "button", onclick: () => {
          try {
            localStorage.setItem(DISMISS_KEY, pair);
          } catch {
            /* asks again next time */
          }
          close();
        } }, "Not now"),
        linkBtn)));
  dialog.addEventListener("close", () => dialog.remove());
  document.body.appendChild(dialog);
  dialog.showModal();
}

/** Opens Account settings (loaded when first needed). */
export function openAccountSettings(group) {
  import("./views/account-settings.js").then((m) => m.openAccountSettings(group)).catch((e) => toast(e.message, "error"));
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
    fitInViewport(menu, button);
    if (menu.style.position === "fixed") addEventListener("scroll", close, { once: true, passive: true });
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

/** Shifts an open menu sideways so it never runs past the screen edge. */
function fitInViewport(menu, button) {
  menu.style.cssText = "";
  const vw = document.documentElement.clientWidth;
  const edge = 8;
  const b = button.getBoundingClientRect();
  const w = menu.offsetWidth;
  const r = menu.getBoundingClientRect();
  // Inside a scrolling strip (the image slider) the menu would be cut off: pin it to the screen
  const clipped = button.closest(".slider-track");
  if (!clipped && r.left >= edge && r.right <= vw - edge) return; // fits where it is
  // Pinned to the screen instead, so it never sticks out or adds a sideways scroll
  const left = Math.min(Math.max(edge, b.right - w), vw - w - edge);
  Object.assign(menu.style, { position: "fixed", top: `${Math.round(b.bottom + 6)}px`, left: `${Math.round(left)}px`, right: "auto" });
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
  const s = session();
  const ghUser = s?.providers.github || (s?.account ? { login: s.account.github.login } : null);
  // Which sign-ins make up this account (both when linked)
  const providers = s?.account
    ? [["github", `@${s.account.github.login}`], ["google", s.account.google.email]]
    : [[google ? "google" : "github", google ? "Google Drive" : "GitHub"]];
  return dropdown({
    button: h("button.account-button", { type: "button" }, avatarImg(user, 32)),
    label: `Account: ${user.name || user.login}`,
    head: h("div.account-head", avatarImg(user, 40), h("div",
      h("strong", user.name || user.login),
      h("span.muted", google ? user.email : `@${user.login}`),
      ...providers.map(([p, text]) => h("span.account-provider", svgIcon(ICONS[p]), text)))),
    items: [
      home ? { label: "My portfolio", icon: "user", href: home } : null,
      { label: home ? "Edit my portfolio" : "Create my portfolio", icon: "pencil", href: `${BASE_PATH}edit` },
      { label: "Account settings", icon: "sliders", onclick: () => openAccountSettings() },
      ...items,
      ghUser ? { label: "GitHub profile", icon: "github", href: `https://github.com/${encodeURIComponent(ghUser.login)}` } : null,
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
