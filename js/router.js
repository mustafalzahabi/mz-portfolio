// ============================================================================
// ROUTER
// Path:  /                     landing page
//        /preview              local preview (drop / paste a resume.json)
//        /docs                 configuration reference
//        /preview/view/...     the previewed portfolio
//        /:id/...              portfolio, source auto-detected (GitHub or Drive)
// Hash:  #section-id           scroll to a profile section
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

/**
 * Parses the path (relative to BASE_PATH) into a view.
 * Portfolio pages:  /:id                 profile
 *                   /:id/blog            blog list
 *                   /:id/blog/:slug      blog post
 *                   /:id/project/:slug   project page
 *                   /:id/tab/:slug       custom tab
 *                   /:id/resume          profile with the resume viewer open
 * Preview uses the same sub-pages under /preview/view.
 */
export function parsePath(pathname = location.pathname, base = BASE_PATH) {
  let rel = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, "");
  rel = rel.replace(/^index\.html$/, "");
  const parts = rel.split("/").filter(Boolean).map(safeDecode);

  if (!parts.length) return { view: "landing" };
  const first = parts[0].toLowerCase();
  if (first === "docs" && parts.length === 1) return { view: "docs" };
  if (first === "preview") {
    if (parts[1] !== "view") return { view: "preview" };
    return { view: "portfolio", preview: true, source: "preview", id: "preview", base: `${base}preview/view`, sub: parseSub(parts.slice(2)) };
  }
  if (RESERVED.has(first)) return { view: "landing" };

  const detected = detectSource(parts[0]);
  if (!detected.id) return { view: "landing" };
  return {
    view: "portfolio",
    source: detected.source || "auto",
    id: detected.id,
    base: `${base}${encodeURIComponent(detected.id)}`,
    sub: parseSub(parts.slice(1)),
  };
}

function parseSub(parts) {
  const [kind, slug, ...rest] = parts.map((p) => p.trim());
  if (!kind) return { name: "profile" };
  if (rest.length) return { name: "missing" };
  if (kind === "blog") return slug ? { name: "post", param: slug } : { name: "blog" };
  if (kind === "project" && slug) return { name: "project", param: slug };
  if (kind === "tab" && slug) return { name: "tab", param: slug };
  if (kind === "resume" && !slug) return { name: "resume" };
  return { name: "missing" };
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
    const samePage = url.pathname === location.pathname && url.search === location.search;
    if (samePage && url.hash) return; // in-page anchor → native
    e.preventDefault();
    if (samePage) {
      if (location.hash) history.replaceState(null, "", url.pathname + url.search);
      scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    navigate(url.pathname + url.search + url.hash);
  });
}
