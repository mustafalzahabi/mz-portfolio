// ============================================================================
// RESUME THEME HELPERS
// Pure functions shared by the native JSON Resume theme renderers.
// No DOM access: everything here must run in Node and in the browser.
// ============================================================================

// ============================================================================
// VALUE COERCION
// ============================================================================

/** Coerces a resume value to a display string ("" for null/objects/arrays). */
export function text(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/** True when the value has visible text. */
export function has(value) {
  return text(value).trim() !== "";
}

/** Returns an array with null/undefined entries removed ([] for non-arrays). */
export function list(value) {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined) : [];
}

/** Returns the string entries of an array that have visible text. */
export function textList(value) {
  return list(value).map(text).filter((item) => item.trim() !== "");
}

/** Returns object entries of an array (drops strings, numbers, nulls). */
export function objectList(value) {
  return list(value).filter((item) => typeof item === "object" && !Array.isArray(item));
}

// ============================================================================
// ESCAPING & URLS
// ============================================================================

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes a value for use in HTML text and quoted attributes. */
export function escapeHtml(value) {
  return text(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/**
 * Returns the trimmed URL when it uses http, https, mailto or tel; otherwise "".
 * Relative and protocol-relative URLs are rejected because generated documents
 * are rendered from srcdoc and have no meaningful base URL.
 */
export function safeUrl(value) {
  const raw = text(value).trim();
  if (!raw) return "";
  // Browsers ignore control characters and whitespace inside the scheme, so
  // strip them before deciding what the scheme actually is.
  const compact = raw.replace(/[\u0000- \u007F-\u009F]+/g, "");
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(compact);
  if (!match) return "";
  const scheme = match[1].toLowerCase();
  if (!SAFE_SCHEMES.has(scheme)) return "";
  if ((scheme === "http" || scheme === "https") && !/^https?:\/\/[^/\s]/i.test(compact)) return "";
  if (compact.length <= scheme.length + 1) return "";
  return raw;
}

/** Escaped href attribute value ("" when the URL is not allowed). */
export function href(value) {
  return escapeHtml(safeUrl(value));
}

/** mailto: URL for an e-mail address ("" when empty). */
export function mailto(email) {
  return has(email) ? safeUrl(`mailto:${text(email).trim()}`) : "";
}

/** tel: URL for a phone number, whitespace removed ("" when empty). */
export function tel(phone) {
  return has(phone) ? safeUrl(`tel:${text(phone).replace(/\s/g, "")}`) : "";
}

/**
 * Wraps already-escaped label HTML in a link when the URL is allowed;
 * otherwise returns the label unchanged.
 */
export function linkTo(url, labelHtml, attrs = "") {
  const safe = safeUrl(url);
  if (!safe) return labelHtml;
  return `<a href="${escapeHtml(safe)}"${attrs ? " " + attrs : ""}>${labelHtml}</a>`;
}

/** Strips the protocol and trailing slash from a URL for display. */
export function stripProtocol(url) {
  return text(url).replace(/^(https?:|)\/\//i, "").replace(/\/$/, "");
}

// ============================================================================
// MARKDOWN-LITE
// ============================================================================

/**
 * Renders a small, safe markdown subset: **bold**, __bold__, *italic*,
 * _italic_, [label](url) and line breaks. Input is escaped first; link
 * targets pass through safeUrl. With { block: true } (default) the result is
 * wrapped in <p> elements split on blank lines; single newlines become <br>.
 */
export function markdownLite(value, { block = true } = {}) {
  const source = text(value).replace(/\r\n?/g, "\n").trim();
  if (!source) return "";

  const links = [];
  const withTokens = source.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    links.push({ label, url });
    return `\u0000${links.length - 1}\u0000`;
  });

  const inline = (chunk) => {
    let out = escapeHtml(chunk)
      .replace(/\*\*(?=\S)([^*]*?\S)\*\*/g, "<strong>$1</strong>")
      .replace(/__(?=\S)([^_]*?\S)__/g, "<strong>$1</strong>")
      .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/(^|[^\w_])_(?=\S)([^_\n]*?\S)_(?![\w_])/g, "$1<em>$2</em>")
      .replace(/\n/g, "<br>");
    out = out.replace(/\u0000(\d+)\u0000/g, (_, index) => {
      const { label, url } = links[Number(index)];
      return linkTo(url, escapeHtml(label));
    });
    return out;
  };

  if (!block) return inline(withTokens);
  return withTokens
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${inline(para)}</p>`)
    .join("\n");
}

/** Plain text version of markdown-lite (for meta descriptions). */
export function stripMarkdown(value) {
  return text(value)
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, "$1")
    .replace(/(\*\*|__|\*|_)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================================
// DATES
// ============================================================================

export const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parses ISO-ish resume dates (YYYY, YYYY-MM, YYYY-MM-DD...). Returns null when invalid. */
export function parseDate(value) {
  const match = /^\s*(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(text(value));
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : null;
  const day = match[3] ? Number(match[3]) : null;
  if (month !== null && (month < 1 || month > 12)) return null;
  if (day !== null && (day < 1 || day > 31)) return null;
  return { year, month, day };
}

/**
 * Formats a resume date with tokens YYYY, MMMM, MMM, MM, DD, D.
 * Dates without a month render as the year only. Unparseable values are
 * returned as their raw text (callers escape the result).
 * Options: { monthsShort } to override short month names.
 */
export function formatDate(value, pattern = "MMM YYYY", { monthsShort = MONTHS_SHORT } = {}) {
  const parsed = parseDate(value);
  if (!parsed) return text(value).trim();
  const { year, month, day } = parsed;
  if (month === null) return String(year);
  const d = day || 1;
  return pattern.replace(/YYYY|MMMM|MMM|MM|DD|D/g, (token) => {
    switch (token) {
      case "YYYY": return String(year);
      case "MMMM": return MONTHS_LONG[month - 1];
      case "MMM": return monthsShort[month - 1];
      case "MM": return String(month).padStart(2, "0");
      case "DD": return String(d).padStart(2, "0");
      default: return String(d);
    }
  });
}

/** "Apr 2019" */
export const formatMonthYear = (value) => formatDate(value, "MMM YYYY");
/** "April 2019" */
export const formatMonthYearLong = (value) => formatDate(value, "MMMM YYYY");
/** "2019" */
export const formatYear = (value) => {
  const parsed = parseDate(value);
  return parsed ? String(parsed.year) : text(value).trim();
};

function toUtc(value, fallback) {
  const parsed = parseDate(value);
  if (!parsed) return fallback;
  return Date.UTC(parsed.year, (parsed.month || 1) - 1, parsed.day || 1);
}

const pluralize = (num, word) => `${num} ${num === 1 ? word : word + "s"}`;

/**
 * Compact duration used by jsonresume-theme-even ("3 yrs 2 mos").
 * Accepts [{ startDate, endDate }] and sums the ranges.
 */
export function compactDuration(ranges, now = Date.now()) {
  const total = list(ranges).reduce((acc, range) => {
    if (!range || !has(range.startDate)) return acc;
    const start = toUtc(range.startDate, null);
    if (start === null) return acc;
    const end = has(range.endDate) ? toUtc(range.endDate, now) : now;
    return acc + Math.max(0, end - start);
  }, 0);
  if (!total) return "";
  const diff = new Date(total);
  const years = diff.getUTCFullYear() - 1970;
  const months = diff.getUTCMonth();
  const days = diff.getUTCDate() - 1;
  return [
    years && pluralize(years, "yr"),
    months && pluralize(months, "mo"),
    days && !years && !months && pluralize(days, "day"),
  ].filter(Boolean).join(" ");
}

/**
 * Precise duration used by jsonresume-theme-elegant ("3 years 6 months 1 day").
 * The end date is inclusive (one day is added), matching moment-precise-range.
 */
export function preciseDuration(startValue, endValue, now = new Date()) {
  const start = parseDate(startValue);
  if (!start) return "";
  const s = new Date(Date.UTC(start.year, (start.month || 1) - 1, start.day || 1));
  const endParsed = parseDate(endValue);
  const e = endParsed
    ? new Date(Date.UTC(endParsed.year, (endParsed.month || 1) - 1, endParsed.day || 1))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  e.setUTCDate(e.getUTCDate() + 1);
  let [a, b] = s <= e ? [s, e] : [e, s];
  let years = b.getUTCFullYear() - a.getUTCFullYear();
  let months = b.getUTCMonth() - a.getUTCMonth();
  let days = b.getUTCDate() - a.getUTCDate();
  if (days < 0) {
    const daysInPrevMonth = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 0)).getUTCDate();
    days += Math.max(daysInPrevMonth, a.getUTCDate());
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }
  return [
    years && pluralize(years, "year"),
    months && pluralize(months, "month"),
    days && pluralize(days, "day"),
  ].filter(Boolean).join(" ");
}

// ============================================================================
// MISC FORMATTING
// ============================================================================

/** Region name for an ISO country code ("US" -> "United States"). */
export function countryName(code) {
  const value = text(code).trim();
  if (!value) return "";
  try {
    if (typeof Intl !== "undefined" && Intl.DisplayNames) {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(value.toUpperCase()) || value;
    }
  } catch {
    // Invalid region code: fall through to the raw value.
  }
  return value;
}

/** "a, b and c" (Intl.ListFormat when available). */
export function formatList(items) {
  const values = textList(items);
  try {
    if (typeof Intl !== "undefined" && Intl.ListFormat) return new Intl.ListFormat("en").format(values);
  } catch {
    // Fall back to a comma list.
  }
  return values.join(", ");
}

/** Joins the non-empty parts of a list with a separator. */
export function joinNonEmpty(parts, separator = ", ") {
  return parts.map(text).map((part) => part.trim()).filter(Boolean).join(separator);
}

// ============================================================================
// THEME NAMES
// ============================================================================

/**
 * Maps "x", "jsonresume-theme-x" and "@jsonresume/jsonresume-theme-x" to "x"
 * (lowercase, trimmed). Empty or non-string input maps to "even".
 */
export function normalizeThemeName(name) {
  const value = text(name)
    .trim()
    .toLowerCase()
    .replace(/^@[^/]+\//, "")
    .replace(/^jsonresume-theme-/, "")
    .trim();
  return value || "even";
}

// ============================================================================
// RESUME NORMALISATION
// ============================================================================

/**
 * Returns a defensive, shallow-normalised copy of a resume. Fills v1 field
 * names from common legacy aliases (company -> name, website -> url,
 * picture -> image) so themes written against either schema work.
 * The input object is never mutated.
 */
export function normalizeResume(resume) {
  const src = resume && typeof resume === "object" ? resume : {};
  const basicsSrc = src.basics && typeof src.basics === "object" ? src.basics : {};
  const location = basicsSrc.location && typeof basicsSrc.location === "object" ? basicsSrc.location : {};
  const basics = {
    ...basicsSrc,
    url: has(basicsSrc.url) ? basicsSrc.url : basicsSrc.website,
    image: has(basicsSrc.image) ? basicsSrc.image : basicsSrc.picture,
    location,
    profiles: objectList(basicsSrc.profiles),
  };
  const withAliases = (items, aliases) => objectList(items).map((item) => {
    const copy = { ...item };
    for (const [target, alias] of aliases) {
      if (!has(copy[target]) && has(copy[alias])) copy[target] = copy[alias];
    }
    return copy;
  });
  return {
    ...src,
    basics,
    work: withAliases(src.work, [["name", "company"], ["url", "website"]]),
    volunteer: withAliases(src.volunteer, [["url", "website"]]),
    education: withAliases(src.education, [["score", "gpa"]]),
    awards: objectList(src.awards),
    certificates: objectList(src.certificates),
    publications: withAliases(src.publications, [["url", "website"]]),
    skills: objectList(src.skills),
    languages: objectList(src.languages),
    interests: objectList(src.interests),
    references: objectList(src.references),
    projects: withAliases(src.projects, [["url", "website"]]),
    meta: src.meta && typeof src.meta === "object" ? src.meta : {},
  };
}

// ============================================================================
// INLINE SVG ICONS
// Stroke icons (Feather/Lucide geometry, MIT) replacing icon fonts.
// ============================================================================

const ICON_PATHS = {
  "map-pin": '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  "external-link": '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  newspaper: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  "git-branch": '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  "graduation-cap": '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  "file-text": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
  "thumbs-up": '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
  "check-square": '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  quote: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>',
  "map-marker": '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  rss: '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>',
  github: '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>',
  gitlab: '<path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>',
  linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
  twitter: '<path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>',
  facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
  instagram: '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',
  youtube: '<path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>',
  dribbble: '<circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/>',
  codepen: '<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/><polyline points="2 15.5 12 8.5 22 15.5"/><line x1="12" y1="2" x2="12" y2="8.5"/>',
  circle: '<circle cx="12" cy="12" r="8" fill="currentColor"/>',
};

const NETWORK_ALIASES = {
  "x": "twitter",
  "stack-overflow": "code",
  stackoverflow: "code",
  blog: "rss",
  website: "globe",
  behance: "globe",
  medium: "book",
  "google-plus": "user",
};

/** True when an inline icon exists for the name. */
export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(ICON_PATHS, text(name).toLowerCase());
}

/** Icon name for a social network, falling back to `fallback`. */
export function networkIcon(network, fallback = "globe") {
  const key = text(network).trim().toLowerCase().replace(/\s+/g, "-");
  if (hasIcon(key)) return key;
  if (NETWORK_ALIASES[key] && hasIcon(NETWORK_ALIASES[key])) return NETWORK_ALIASES[key];
  return fallback;
}

/**
 * Inline SVG icon markup. `size` is applied as width/height (CSS units allowed),
 * `className` is added to the svg element. Unknown names render nothing.
 */
export function icon(name, { size = "1em", className = "", strokeWidth = 2 } = {}) {
  const key = text(name).toLowerCase();
  if (!hasIcon(key)) return "";
  const cls = className ? ` class="${escapeHtml(className)}"` : "";
  return `<svg${cls} xmlns="http://www.w3.org/2000/svg" width="${escapeHtml(size)}" height="${escapeHtml(size)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[key]}</svg>`;
}

// ============================================================================
// BOOTSTRAP 3 SUBSET
// Several original themes (flat, kendall, elegant) load Bootstrap 3 from a CDN.
// This is a self-contained subset of the rules those templates rely on, so the
// generated documents need no external stylesheet.
// ============================================================================

export const BOOTSTRAP3_LITE = `
html{font-size:10px;-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent}
*,*:before,*:after{box-sizing:border-box}
body{margin:0;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:14px;line-height:1.42857143;color:#333;background-color:#fff}
article,aside,footer,header,main,nav,section{display:block}
a{color:#337ab7;text-decoration:none;background-color:transparent}
a:hover,a:focus{color:#23527c;text-decoration:underline}
b,strong{font-weight:bold}
small{font-size:85%}
img{border:0;vertical-align:middle;max-width:100%}
hr{margin-top:20px;margin-bottom:20px;border:0;border-top:1px solid #eee;height:0}
h1,h2,h3,h4,h5,h6{font-family:inherit;font-weight:500;line-height:1.1;color:inherit}
h1,h2,h3{margin-top:20px;margin-bottom:10px}
h4,h5,h6{margin-top:10px;margin-bottom:10px}
h1{font-size:36px}h2{font-size:30px}h3{font-size:24px}h4{font-size:18px}h5{font-size:14px}h6{font-size:12px}
p{margin:0 0 10px}
ul,ol{margin-top:0;margin-bottom:10px}
ul ul,ol ul{margin-bottom:0}
blockquote{padding:10px 20px;margin:0 0 20px;font-size:17.5px;border-left:5px solid #eee}
blockquote p:last-child,blockquote ul:last-child{margin-bottom:0}
blockquote footer{display:block;font-size:80%;line-height:1.42857143;color:#777}
blockquote footer:before{content:"\\2014 \\00A0"}
button{font:inherit;margin:0;overflow:visible;text-transform:none;cursor:pointer}
.text-center{text-align:center}.text-left{text-align:left}.text-right{text-align:right}
.text-uppercase{text-transform:uppercase}
.text-muted{color:#777}
.list-unstyled{padding-left:0;list-style:none}
.pull-left{float:left!important}.pull-right{float:right!important}
.center-block{display:block;margin-left:auto;margin-right:auto}
.img-circle{border-radius:50%}
.clearfix:before,.clearfix:after,.container:before,.container:after,.container-fluid:before,.container-fluid:after,.row:before,.row:after{content:" ";display:table}
.clearfix:after,.container:after,.container-fluid:after,.row:after{clear:both}
.container,.container-fluid{padding-right:15px;padding-left:15px;margin-right:auto;margin-left:auto}
@media (min-width:768px){.container{width:750px}}
@media (min-width:992px){.container{width:970px}}
@media (min-width:1200px){.container{width:1170px}}
.row{margin-right:-15px;margin-left:-15px}
[class*="col-xs-"],[class*="col-sm-"],[class*="col-md-"]{position:relative;min-height:1px;padding-right:15px;padding-left:15px}
[class*="col-xs-"]{float:left}
.col-xs-11{width:91.66666667%}.col-xs-12{width:100%}
@media (min-width:768px){
[class*="col-sm-"]{float:left}
.col-sm-3{width:25%}.col-sm-5{width:41.66666667%}.col-sm-6{width:50%}.col-sm-7{width:58.33333333%}.col-sm-9{width:75%}.col-sm-12{width:100%}
.col-sm-push-3{left:25%}
.col-sm-offset-1{margin-left:8.33333333%}
}
@media (min-width:992px){
[class*="col-md-"]{float:left}
.col-md-3{width:25%}.col-md-9{width:75%}
}
.label{display:inline;padding:.2em .6em .3em;font-size:75%;font-weight:bold;line-height:1;color:#fff;text-align:center;white-space:nowrap;vertical-align:baseline;border-radius:.25em}
.badge{display:inline-block;min-width:10px;padding:3px 7px;font-size:12px;font-weight:bold;line-height:1;color:#fff;text-align:center;white-space:nowrap;vertical-align:middle;background-color:#777;border-radius:10px}
.list-group{padding-left:0;margin-bottom:20px}
.list-group-item{position:relative;display:block;padding:10px 15px;margin-bottom:-1px;background-color:#fff;border:1px solid #ddd}
.list-group-item:first-child{border-top-left-radius:4px;border-top-right-radius:4px}
.list-group-item:last-child{margin-bottom:0;border-bottom-right-radius:4px;border-bottom-left-radius:4px}
.list-group-item>.badge{float:right}
.panel{margin-bottom:20px;background-color:#fff;border:1px solid transparent;border-radius:4px;box-shadow:0 1px 1px rgba(0,0,0,.05)}
.panel-default{border-color:#ddd}
.panel-heading{padding:10px 15px;border-bottom:1px solid transparent;border-top-left-radius:3px;border-top-right-radius:3px}
.panel-default>.panel-heading{color:#333;background-color:#f5f5f5;border-color:#ddd}
.panel-title{margin-top:0;margin-bottom:0;font-size:16px;color:inherit}
.panel-body{padding:15px}
.btn{display:inline-block;padding:6px 12px;margin-bottom:0;font-size:14px;font-weight:normal;line-height:1.42857143;text-align:center;white-space:nowrap;vertical-align:middle;border:1px solid transparent;border-radius:4px;background-image:none}
.btn-default{color:#333;background-color:#fff;border-color:#ccc}
.btn-sm{padding:5px 10px;font-size:12px;line-height:1.5;border-radius:3px}
@media print{
*,*:before,*:after{color:#000!important;text-shadow:none!important;background:transparent!important;box-shadow:none!important}
a,a:visited{text-decoration:underline}
a[href]:after{content:" (" attr(href) ")"}
a[href^="mailto:"]:after,a[href^="tel:"]:after{content:""}
blockquote{border:1px solid #999;page-break-inside:avoid}
img{page-break-inside:avoid;max-width:100%!important}
p,h2,h3{orphans:3;widows:3}
h2,h3{page-break-after:avoid}
.label{border:1px solid #000}
}
`;
