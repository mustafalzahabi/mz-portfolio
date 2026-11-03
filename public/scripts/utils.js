// ============================================================================
// UTILITY FUNCTIONS
// Pure helpers (no DOM access at import time, safe to run in Node tests).
// ============================================================================

// ============================================================================
// ESCAPING & URL SAFETY
// ============================================================================

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Returns the URL if it uses an allowed protocol, otherwise "".
 * Relative URLs (#hash, /path, ./path) are allowed. data: is allowed only for
 * raster images when `allowDataImage` is set.
 */
export function safeUrl(url, { allowDataImage = false } = {}) {
  if (typeof url !== "string") return "";
  const trimmed = url.trim().replace(/[\u0000-\u001F\u007F]/g, "");
  if (!trimmed) return "";
  if (/^(#|\/(?!\/)|\.\.?\/)/.test(trimmed)) return trimmed;
  if (allowDataImage && /^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    return SAFE_PROTOCOLS.has(parsed.protocol) ? parsed.href : "";
  } catch {
    // Bare domains such as "example.com" → https
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(trimmed)) return `https://${trimmed}`;
    return "";
  }
}

export function isExternalUrl(url) {
  return /^https?:\/\//i.test(url || "");
}

// ============================================================================
// DOM BUILDER
// h("a.btn", { href, onclick }, "text", childNode, [more])
// ============================================================================

export function h(tag, props, ...children) {
  const [name, ...classes] = tag.split(".");
  const el = document.createElement(name || "div");
  if (classes.length) el.className = classes.join(" ");

  if (props && (typeof props !== "object" || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
    props = null;
  }

  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class" || key === "className") el.className = [el.className, value].filter(Boolean).join(" ");
    else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
    else if (key === "href" || key === "src") {
      const safe = safeUrl(String(value), { allowDataImage: key === "src" });
      if (safe) el.setAttribute(key, safe);
    } else if (key === "text") el.textContent = value;
    else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, String(value));
  }

  if (el.tagName === "A" && isExternalUrl(el.getAttribute("href")) && !el.hasAttribute("target")) {
    el.target = "_blank";
  }
  if (el.target === "_blank") el.rel = "noopener noreferrer";

  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === "") continue;
    if (Array.isArray(child)) appendChildren(el, child);
    else if (child instanceof Node) el.appendChild(child);
    else el.appendChild(document.createTextNode(String(child)));
  }
}

export function svgIcon(markup, label) {
  const span = document.createElement("span");
  span.className = "icon";
  span.setAttribute("aria-hidden", label ? "false" : "true");
  if (label) span.setAttribute("aria-label", label);
  span.innerHTML = markup; // trusted, static markup only
  return span;
}

// ============================================================================
// DATES
// ============================================================================

/**
 * Formats JSON Resume ISO-8601 partial dates: "2024", "2024-06", "2024-06-15".
 * Returns "" for empty/invalid input; returns the raw string if unparseable.
 */
export function formatDate(value, locale = "en-US", { long = false } = {}) {
  if (!value) return "";
  const str = String(value).trim();
  const m = str.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
  if (!m) return str;
  const [, y, mo, d] = m;
  if (!mo) return y;
  const date = new Date(Date.UTC(+y, +mo - 1, d ? +d : 1));
  if (Number.isNaN(date.getTime())) return str;
  const opts = { year: "numeric", month: long ? "long" : "short", timeZone: "UTC" };
  if (d && long) opts.day = "numeric";
  try {
    return new Intl.DateTimeFormat(locale, opts).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", opts).format(date);
  }
}

export function formatDateRange(start, end, locale = "en-US", present = "Present") {
  const s = formatDate(start, locale);
  const e = end ? formatDate(end, locale) : s ? present : "";
  if (s && e && s !== e) return `${s} – ${e}`;
  return s || e;
}

export function toTimestamp(value) {
  const t = new Date(value || 0).getTime();
  return Number.isNaN(t) ? 0 : t;
}

// ============================================================================
// TEXT HELPERS
// ============================================================================

export function slugify(text) {
  return (
    String(text || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "") || "post"
  );
}

export function readingTime(text, wpm = 220) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / wpm));
}

export function capitalize(text) {
  const s = String(text || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function initials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export function stripImagesFromMarkdown(markdown) {
  return String(markdown || "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/<img\s+[^>]*>/gi, "");
}

export function plural(count, word, pluralWord = `${word}s`) {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

// ============================================================================
// YAML FRONTMATTER PARSER
// ============================================================================

function parseYamlValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\(["\\])/g, "$1"); // YAML double-quoted escapes
  }
  if (value.length > 1 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'"); // YAML single-quoted escape
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((s) => parseYamlValue(s.trim()))
      .map(String)
      .filter(Boolean);
  }
  return value;
}

export function parseFrontmatter(content) {
  const text = String(content || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { metadata: {}, body: text.trim() };

  const yaml = match[1];
  const body = text.slice(match[0].length).trim();
  const metadata = {};
  let currentKey = null;

  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const itemMatch = trimmed.match(/^-\s+(.+)$/);
    if (itemMatch && currentKey) {
      if (!Array.isArray(metadata[currentKey])) metadata[currentKey] = [];
      metadata[currentKey].push(parseYamlValue(itemMatch[1]));
      continue;
    }

    const kvMatch = trimmed.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const value = kvMatch[2].trim();
      metadata[currentKey] = value === "" ? [] : parseYamlValue(value);
    }
  }

  return { metadata, body };
}

// ============================================================================
// BROWSER HELPERS
// ============================================================================

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function downloadFile(filename, content, type = "text/plain") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let toastTimer = null;
export function toast(message, kind = "info") {
  let el = document.getElementById("mz-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "mz-toast";
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.dataset.kind = kind;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
