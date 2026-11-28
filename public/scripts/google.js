// ============================================================================
// GOOGLE SIGN-IN + DRIVE WRITE ACCESS — for the editor only.
// Google's browser sign-in (OAuth "token" response) needs no client secret
// and no server: Google sends the visitor back to this site with
// #access_token=… in the URL fragment. The token only allows Drive files this
// app created (drive.file) and its own hidden app folder (drive.appdata), lasts
// about an hour, is kept in localStorage until it expires or you sign out, and
// is only ever sent to www.googleapis.com.
// The site owner sets <meta name="mz-google-client-id" content="…"> in
// index.html (see the README).
// ============================================================================

import { BASE_PATH } from "./router.js";

const TOKEN_KEY = "mz-google-token"; // { token, expiresAt }
const USER_KEY = "mz-google-user"; // { login, name, avatar_url, email, provider }
const HOME_KEY = "mz-google-home"; // folder id of this account's portfolio
const STATE_KEY = "mz-google-state";
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.appdata",
];
export const DRIVE = "https://www.googleapis.com/drive/v3";
export const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export function googleClientId() {
  return document.querySelector('meta[name="mz-google-client-id"]')?.content?.trim() || "";
}

const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the sign-in lasts for this page only */
  }
};

/** A token that is still valid for at least a minute, or "". */
export function getGoogleToken() {
  const t = read(TOKEN_KEY);
  return t && t.token && t.expiresAt - Date.now() > 60_000 ? t.token : "";
}

/** The signed-in Google user, or null once the token has expired. */
export function cachedGoogleUser() {
  return getGoogleToken() ? read(USER_KEY) : null;
}

/** Signed in before, but the hour is up: the UI offers "Sign in again". */
export function googleSessionExpired() {
  return !getGoogleToken() && !!read(USER_KEY);
}

export function clearGoogle() {
  write(TOKEN_KEY, null);
  write(USER_KEY, null);
  write(HOME_KEY, null);
}

export const googleHome = () => read(HOME_KEY);
export const setGoogleHome = (folderId) => write(HOME_KEY, folderId || null);

/**
 * The address that starts a Google sign-in and comes back to returnPath.
 * The redirect URI is always the site root (register it once in Google Cloud).
 */
export function googleLoginUrl(returnPath = location.pathname + location.search, { silent = false, hint = "" } = {}) {
  const clientId = googleClientId();
  if (!clientId) return "";
  let nonce = "";
  try {
    nonce = sessionStorage.getItem(STATE_KEY) || "";
    if (!nonce) {
      nonce = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
      sessionStorage.setItem(STATE_KEY, nonce);
    }
  } catch {
    return "";
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${location.origin}${BASE_PATH}`,
    response_type: "token",
    scope: SCOPES.join(" "),
    include_granted_scopes: "true",
    // Silent: no account picker or consent, only a fresh token for the same account (fails if Google needs to ask)
    prompt: silent ? "none" : "select_account",
    state: `${nonce}.${silent ? "renew" : encodeURIComponent(safeReturn(returnPath))}`,
  });
  const loginHint = silent ? hint || read(USER_KEY)?.email : "";
  if (loginHint) params.set("login_hint", loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** Same-site paths only (never //host or a full URL). */
function safeReturn(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !/[\\\s]/.test(path) ? path : BASE_PATH;
}

/**
 * Finishes a Google sign-in redirect, if this page load is one.
 * Returns { user, returnPath } or { error } or null.
 */
export async function completeGoogleSignIn() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.get("state") || (!params.get("access_token") && !params.get("error"))) return null;
  history.replaceState(history.state, "", location.pathname + location.search);
  return acceptGoogleReturn(params);
}

/** Checks a Google redirect's parameters and keeps the token. Returns { user, returnPath } or { error }. */
async function acceptGoogleReturn(params, { renew = false } = {}) {
  const token = params.get("access_token");
  const error = params.get("error");
  const state = params.get("state") || "";

  let expected = "";
  try {
    expected = sessionStorage.getItem(STATE_KEY) || "";
    sessionStorage.removeItem(STATE_KEY);
  } catch {
    /* ignore */
  }
  const [nonce, encodedReturn = ""] = state.split(".");
  if (!expected || nonce !== expected) return { error: "Sign-in expired or was started in another tab. Please try again." };
  if (error) return { error: error === "access_denied" ? "Sign-in was cancelled on Google." : "Google didn't finish the sign-in. Please try again." };

  const scopes = (params.get("scope") || "").split(" ");
  if (!scopes.includes(SCOPES[0])) return { error: "Google Drive access wasn't granted, so your portfolio can't be saved. Please try again and allow it." };

  write(TOKEN_KEY, { token, expiresAt: Date.now() + Number(params.get("expires_in") || 3600) * 1000 });
  // A renewal is for the account already signed in: keep its details
  if (renew && read(USER_KEY)) return { user: read(USER_KEY), returnPath: "" };
  try {
    const about = await driveRequest("/about?fields=user(displayName,photoLink,emailAddress,permissionId)");
    const u = about.user || {};
    const user = { provider: "google", login: u.emailAddress || u.permissionId || "google", name: u.displayName || "", avatar_url: u.photoLink || "", email: u.emailAddress || "" };
    write(USER_KEY, user);
    return { user, returnPath: safeReturn(decodeURIComponent(encodedReturn)) };
  } catch (e) {
    clearGoogle();
    return { error: e.message };
  }
}

export class DriveError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "DriveError";
    this.status = status;
  }
}

/**
 * Authorized Drive call. path is relative to /drive/v3 unless it's a full URL.
 * Returns parsed JSON (or text for alt=media, null for 204).
 */
export async function driveRequest(path, { method = "GET", body, headers = {}, raw = false } = {}) {
  const token = getGoogleToken();
  if (!token) throw new DriveError("Your Google sign-in has expired. Sign in again to save.", 401);
  const url = /^https:/.test(path) ? path : `${DRIVE}${path}`;
  const res = await fetch(url, { method, body, headers: { Authorization: `Bearer ${token}`, ...headers }, cache: "no-store" });
  if (res.status === 401) {
    write(TOKEN_KEY, null);
    throw new DriveError("Your Google sign-in has expired. Sign in again to save.", 401);
  }
  if (!res.ok) {
    let message = `Google Drive answered ${res.status}.`;
    try {
      message = (await res.json()).error?.message || message;
    } catch {
      /* not JSON */
    }
    throw new DriveError(message, res.status);
  }
  if (res.status === 204) return null;
  return raw ? res.text() : res.json();
}

// ============================================================================
// SILENT RENEWAL — the token lasts an hour and there's no refresh token
// without a server. Before a save that needs Drive, a small window asks
// Google for a new token for the same account with prompt=none: no picker,
// no consent screen, it closes itself. Called from a click (so it isn't
// blocked as a pop-up); if Google needs the person, it returns false and the
// UI offers "Reconnect Google".
// ============================================================================

export const RENEW_WINDOW = "mz-google-renew";

/** True when this page is that renewal window (the app must not start in it). */
export const isRenewWindow = () => typeof window !== "undefined" && window.name === RENEW_WINDOW && !!window.opener;

/** @param {{ hint?: string }} [o] the account's email when this device hasn't signed in to Google yet */
export function renewGoogleToken({ hint = "" } = {}) {
  return new Promise((resolve) => {
    if (getGoogleToken()) return resolve(true);
    const url = googleLoginUrl(BASE_PATH, { silent: true, hint });
    const popup = url ? window.open(url, RENEW_WINDOW, "popup,width=420,height=560") : null;
    if (!popup) return resolve(false);
    const started = Date.now();
    const timer = setInterval(async () => {
      let hash = "";
      try {
        if (popup.closed) {
          clearInterval(timer);
          return resolve(Boolean(getGoogleToken()));
        }
        if (popup.location.origin === location.origin) hash = popup.location.hash; // back on this site
      } catch {
        /* still on Google's pages */
      }
      if (!hash && Date.now() - started < 45_000) return;
      clearInterval(timer);
      try {
        popup.close();
      } catch {
        /* already closed */
      }
      const result = hash ? await acceptGoogleReturn(new URLSearchParams(hash.slice(1)), { renew: true }) : null;
      resolve(Boolean(result && !result.error && getGoogleToken()));
    }, 250);
  });
}
