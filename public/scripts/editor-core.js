// ============================================================================
// EDITOR CORE — DOM-free helpers for the /edit editor (tested in Node).
// ============================================================================

import { safeUrl } from "./utils.js";

export const isEmpty = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) ||
  (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);

export function getPath(obj, path) {
  return path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Sets a value; empty values are removed and empty parents pruned. */
export function setPath(obj, path, value) {
  const parents = [];
  let o = obj;
  path.slice(0, -1).forEach((k, i) => {
    // The container type follows the NEXT key: a number means a list
    if (o[k] == null || typeof o[k] !== "object") o[k] = typeof path[i + 1] === "number" ? [] : {};
    parents.push([o, k]);
    o = o[k];
  });
  const last = path[path.length - 1];
  if (isEmpty(value) && !Array.isArray(o)) delete o[last];
  else o[last] = value;
  for (let i = parents.length - 1; i >= 0; i--) {
    const [p, k] = parents[i];
    if (isEmpty(p[k]) && !Array.isArray(p)) delete p[k];
  }
}

/** Drops empty objects/strings/arrays everywhere (e.g. blank scaffold items) before saving. */
export function prune(value) {
  if (Array.isArray(value)) return value.map(prune).filter((v) => !isEmpty(v));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const p = prune(v);
      if (!isEmpty(p)) out[k] = p;
    }
    return out;
  }
  return typeof value === "string" && !value.trim() ? "" : value;
}

// ============================================================================
// UNDO / REDO — JSON snapshots. Edits to the same field within `mergeMs`
// collapse into one step, so undo doesn't go back one keystroke at a time.
// ============================================================================

export class History {
  constructor(initial, { limit = 100, mergeMs = 600, now = () => Date.now() } = {}) {
    this.stack = [JSON.stringify(initial)];
    this.index = 0;
    this.limit = limit;
    this.mergeMs = mergeMs;
    this.now = now;
    this.lastKey = null;
    this.lastAt = 0;
  }

  /** Records a new state. `key` identifies the field being edited. */
  push(state, key = null) {
    const snap = JSON.stringify(state);
    if (snap === this.stack[this.index]) return false;
    const t = this.now();
    const merge = key !== null && key === this.lastKey && t - this.lastAt < this.mergeMs && this.index > 0 && this.index === this.stack.length - 1;
    this.stack.length = this.index + 1;
    if (merge) this.stack[this.index] = snap;
    else {
      this.stack.push(snap);
      if (this.stack.length > this.limit) this.stack.shift();
      this.index = this.stack.length - 1;
    }
    this.lastKey = key;
    this.lastAt = t;
    return true;
  }

  get canUndo() {
    return this.index > 0;
  }

  get canRedo() {
    return this.index < this.stack.length - 1;
  }

  undo() {
    if (!this.canUndo) return null;
    this.lastKey = null;
    return JSON.parse(this.stack[--this.index]);
  }

  redo() {
    if (!this.canRedo) return null;
    this.lastKey = null;
    return JSON.parse(this.stack[++this.index]);
  }
}

// ============================================================================
// DIFF SUMMARY — "work: 1 added · basics: 2 fields changed"
// ============================================================================

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function diffSummary(before = {}, after = {}) {
  const out = [];
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
  for (const key of keys) {
    const a = before?.[key];
    const b = after?.[key];
    if (same(a, b)) continue;
    if (Array.isArray(a) || Array.isArray(b)) {
      const x = Array.isArray(a) ? a : [];
      const y = Array.isArray(b) ? b : [];
      const parts = [];
      if (y.length > x.length) parts.push(`${y.length - x.length} added`);
      if (y.length < x.length) parts.push(`${x.length - y.length} removed`);
      const edited = Math.min(x.length, y.length);
      let changed = 0;
      for (let i = 0; i < edited; i++) if (!same(x[i], y[i])) changed++;
      if (changed) parts.push(`${changed} edited`);
      out.push(`${key}: ${parts.join(", ") || "reordered"}`);
    } else if (a && b && typeof a === "object" && typeof b === "object") {
      const n = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !same(a[k], b[k])).length;
      out.push(`${key}: ${n} field${n === 1 ? "" : "s"} changed`);
    } else if (a === undefined) out.push(`${key}: added`);
    else if (b === undefined) out.push(`${key}: removed`);
    else out.push(`${key}: changed`);
  }
  return out;
}

// ============================================================================
// FIELD VALIDATION — returns a message, or "" when the value is fine/empty.
// ============================================================================

export function validateField(kind, value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  switch (kind) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "That doesn't look like an email address.";
    case "url":
      return safeUrl(v) && !/\s/.test(v) ? "" : "Use a full link, like https://example.com";
    case "date":
      return /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/.test(v) ? "" : "Use YYYY, YYYY-MM or YYYY-MM-DD.";
    case "tel":
      return /^[+\d\s().-]{5,}$/.test(v) ? "" : "Use digits, spaces and + ( ) - only.";
    default:
      return "";
  }
}

// ============================================================================
// BLOG FRONTMATTER
// ============================================================================

export function frontmatter(post) {
  const q = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const lines = ["---", `title: ${q(post.title || "Untitled")}`];
  if (post.date) lines.push(`date: ${post.date}`);
  if (post.tags?.length) lines.push(`tags: [${post.tags.map((t) => q(t)).join(", ")}]`);
  if (post.description) lines.push(`description: ${q(post.description)}`);
  if (post.image) lines.push(`image: ${q(post.image)}`);
  if (post.draft) lines.push("draft: true");
  lines.push("---", "");
  return `${lines.join("\n")}\n${String(post.body || "").trim()}\n`;
}

/** Wraps/prefixes a textarea selection for the Markdown toolbar. Returns { text, start, end }. */
export function applyMarkdown(text, start, end, action) {
  const sel = text.slice(start, end);
  const wrap = (l, r = l, fallback = "text") => {
    const inner = sel || fallback;
    const next = `${text.slice(0, start)}${l}${inner}${r}${text.slice(end)}`;
    return { text: next, start: start + l.length, end: start + l.length + inner.length };
  };
  const linePrefix = (prefix) => {
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const block = text.slice(lineStart, end) || "";
    const lines = block.split("\n").map((l, i) => (typeof prefix === "function" ? prefix(i) : prefix) + l);
    const joined = lines.join("\n");
    const next = text.slice(0, lineStart) + joined + text.slice(end);
    return { text: next, start: lineStart, end: lineStart + joined.length };
  };
  switch (action) {
    case "bold": return wrap("**");
    case "italic": return wrap("*");
    case "code": return sel.includes("\n") ? wrap("```\n", "\n```", "code") : wrap("`", "`", "code");
    case "link": return wrap("[", "](https://)", "link text");
    case "image": return wrap("![", "](https://)", "description");
    case "heading": return linePrefix("## ");
    case "list": return linePrefix("- ");
    case "ordered": return linePrefix((i) => `${i + 1}. `);
    case "quote": return linePrefix("> ");
    default: return { text, start, end };
  }
}
