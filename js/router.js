// ============================================================================
// ROUTER
// Path:  /                     landing page
//        /preview              local preview (drop / paste a resume.json)
//        /docs                 configuration reference
//        /:id                  portfolio, source auto-detected (GitHub or Drive)
// Hash:  #/project/:name  #/blog  #/blog/:slug  #/resume  #section-id
// The app may live in a sub-folder (e.g. GitHub Pages project site): the base
// path is derived from this module's own URL.
// ============================================================================

const RESERVED = new Set(["preview", "docs"]);

export const BASE_PATH =
  typeof location !== "undefined" ? new URL("../", import.meta.url).pathname : "/";

// GitHub usernames: 1–39 chars, alphanumeric or single hyphens, no leading/trailing hyphen.
const GH_USER_RE = /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/;
// Drive file/folder IDs: base64url, typically 25–44 chars.
const DRIVE_ID_RE = /^[A-Za-z0-9_-]{20,}$/;

export function isGithubUsername(id) {
  return GH_USER_RE.test(id || "");
}

export function looksLikeDriveId(id) {
  if (!DRIVE_ID_RE.test(id || "")) return false;
  // Underscore or >39 chars can never be a GitHub username
  if (id.includes("_") || id.length > 39) return true;
  // Mixed case + digits at Drive-ID length is a strong hint (usernames are rarely 25+ chars)
  return id.length >= 25 && /[a-z]/.test(id) && /[A-Z]/.test(id) && /\d/.test(id);
}

/**
 * Turns whatever the visitor typed/pasted into { source, id }.
 * source: "gh" | "gd" | "auto" ("auto" = GitHub first, Drive if GitHub 404s).
 */
export function detectSource(input) {
  let value = String(input || "").trim();
  if (!value) return { source: "", id: "" };

  // Pasted URLs
  const drive =
    value.match(/drive\.google\.com\/(?:file\/d|drive\/(?:u\/\d+\/)?folders)\/([A-Za-z0-9_-]+)/) ||
    value.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([A-Za-z0-9_-]+)/) ||
    value.match(/docs\.google\.com\/\w+\/d\/([A-Za-z0-9_-]+)/);
  if (drive) return { source: "gd", id: drive[1] };

  const gh = value.match(/(?:gist\.)?github\.com\/([A-Za-z0-9-]+)/);
  if (gh) return { source: "gh", id: gh[1] };

  value = value.replace(/^@/, "");
  if (!isGithubUsername(value)) {
    return DRIVE_ID_RE.test(value) ? { source: "gd", id: value } : { source: "", id: value };
  }
  return { source: looksLikeDriveId(value) ? "gd" : "auto", id: value };
}

/** Parses the path (relative to BASE_PATH) into a view. */
export function parsePath(pathname = location.pathname, base = BASE_PATH) {
  let rel = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, "");
  rel = rel.replace(/^index\.html$/, "");
  const parts = rel.split("/").filter(Boolean).map(decodeURIComponent);

  if (!parts.length) return { view: "landing" };
  if (parts.length === 1 && RESERVED.has(parts[0].toLowerCase())) return { view: parts[0].toLowerCase() };

  if (parts.length > 1) return { view: "landing" };
  const detected = detectSource(parts[0]);
  if (!detected.id) return { view: "landing" };
  return { view: "portfolio", source: detected.source || "auto", id: detected.id };
}

/** Parses location.hash into a sub-route. */
export function parseHash(hash = location.hash) {
  const h = hash || "";
  if (h.startsWith("#/project/")) return { name: "project", param: safeDecode(h.slice(10)) };
  if (h.startsWith("#/blog/")) return { name: "post", param: safeDecode(h.slice(7)) };
  if (h === "#/blog" || h === "#blog") return { name: "blog" };
  if (h === "#/resume") return { name: "resume" };
  if (h.length > 1 && !h.startsWith("#/")) return { name: "section", param: safeDecode(h.slice(1)) };
  return { name: "profile" };
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** URL for a portfolio: always /:id, the source is detected from the id. */
export function portfolioPath(id) {
  return `${BASE_PATH}${encodeURIComponent(id)}`;
}

/** Restores a path handed over by 404.html (?p=/some/path) without reloading. */
export function rescueRedirect() {
  const params = new URLSearchParams(location.search);
  if (!params.has("p")) return;
  const target = BASE_PATH + params.get("p").replace(/^\/+/, "");
  params.delete("p");
  const qs = params.toString();
  history.replaceState(null, "", target + (qs ? `?${qs}` : "") + location.hash);
}

export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  dispatchEvent(new PopStateEvent("popstate"));
}

/** Intercepts same-origin <a> clicks that point inside the app. */
export function interceptLinks(root = document) {
  root.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download") || a.dataset.external !== undefined) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(BASE_PATH)) return;
    if (url.pathname === location.pathname && url.search === location.search) return; // hash-only → native
    e.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  });
}
