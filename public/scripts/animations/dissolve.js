// ============================================================================
// DISSOLVE — every small element (a heading, a line of text, a link, an
// icon, an image) appears first as a wisp of the highlighted JavaScript that
// builds it (the real line from this app's source), floating where it will be,
// which then dissolves into the air as the real element condenses in.
// Fast, no panel, no background; elements go one after another.
// ============================================================================

import { tokenizeJs } from "./code-reveal.js";
import { sourceOf } from "../utils.js";

const UNIT_TAGS = new Set(["IMG", "SVG", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "VIDEO", "IFRAME", "CANVAS", "HR", "PICTURE"]);
const INLINE = new Set(["SPAN", "STRONG", "EM", "B", "I", "A", "CODE", "SMALL", "TIME", "ABBR", "MARK", "BR", "SUP", "SUB"]);
const MAX_UNITS = 90;
const active = new Set();

/** Elements that read as one tiny piece: media, controls, or a line of text. */
export function collectUnits(root, max = MAX_UNITS) {
  const units = [];
  const walk = (el) => {
    if (units.length >= max) return;
    if (el.nodeType !== 1 || el.classList.contains("ed-edit") || el.classList.contains("dz-layer")) return;
    const tag = el.tagName.toUpperCase();
    const kids = [...el.children];
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const leafy = UNIT_TAGS.has(tag) || !kids.length || (ownText && kids.every((k) => INLINE.has(k.tagName.toUpperCase())));
    if (leafy) {
      const r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) units.push(el);
      return;
    }
    kids.forEach(walk);
  };
  [...root.children].forEach(walk);
  return units;
}

const clip = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const str = (t) => JSON.stringify(clip(t, 26));

let sourceFiles = null; // url (no query) -> raw lines
let sourceLines = null; // every code line, trimmed, for the class-based fallback
let sourceLoading = null;

/** Loads every same-origin script this page has run (from cache). */
export function loadSources() {
  if (sourceLines || sourceLoading) return sourceLoading || Promise.resolve();
  const urls = [...new Set(performance.getEntriesByType("resource")
    .map((e) => e.name)
    .filter((u) => u.startsWith(location.origin) && /\.js(\?|$)/.test(u) && !/\/sw\.js/.test(u)))];
  sourceLoading = Promise.all(urls.map((u) => fetch(u).then((r) => (r.ok ? r.text() : "")).catch(() => "")))
    .then((texts) => {
      sourceFiles = new Map(urls.map((u, i) => [u.split("?")[0], texts[i].split(/\r?\n/)]));
      sourceLines = texts.flatMap((t) => t.split(/\r?\n/)).map((l) => l.trim())
        .filter((l) => l && !l.startsWith("//") && !l.startsWith("*") && !l.startsWith("/*"));
    })
    .finally(() => (sourceLoading = null));
  return sourceLoading;
}

/** The statement starting at `line` (1-based): continued until its brackets close. */
function statementAt(lines, line) {
  let out = "";
  let depth = 0;
  for (let i = line - 1; i < lines.length && i < line + 6; i++) {
    const part = lines[i].trim();
    out += (out && !/^[)\]}.,]/.test(part) ? " " : "") + part;
    for (const ch of part.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "")) {
      if ("([{".includes(ch)) depth++;
      else if (")]}".includes(ch)) depth--;
    }
    if (depth <= 0 || out.length > 220) break;
  }
  return out;
}

/** The exact line that created `el` or its nearest tracked parent (see traceSources). */
function exactLineFor(el) {
  if (!sourceFiles) return "";
  for (let node = el, depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    const where = sourceOf(node);
    const lines = where && sourceFiles.get(where.url);
    if (lines?.[where.line - 1]) return statementAt(lines, where.line);
  }
  return "";
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ownClasses = (el) => [...el.classList].filter((c) => !/^(anim|dz|is-|has-)/.test(c));

/** The real source line that builds `el`: its exact creation site, else the best class match. */
export function sourceLineFor(el) {
  if (!sourceLines) return "";
  const exact = exactLineFor(el);
  if (exact) return exact;
  let node = el;
  for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    const classes = ownClasses(node);
    if (!classes.length) continue;
    // h("tag.cls", …), h(`tag.cls${…}`, …) or className = "cls"; the line that
    // names the most of this element's classes (and its tag) wins, so generic
    // classes like "btn" don't pick an unrelated line
    const tests = classes.map((cls) => new RegExp(`["'\`][a-z0-9]*[.#\\w-]*\\.${escapeRe(cls)}(?![\\w-])|className\\s*=\\s*["'\`][\\w -]*\\b${escapeRe(cls)}(?![\\w-])`));
    const tag = new RegExp(`["'\`]${node.tagName.toLowerCase()}[.#]`);
    let best = "", bestScore = 0;
    for (const l of sourceLines) {
      const hits = tests.filter((re) => re.test(l)).length;
      if (!hits) continue;
      const score = hits * 2 + (tag.test(l) ? 1 : 0) - (hits < classes.length ? 0.5 : 0);
      if (score > bestScore) [best, bestScore] = [l, score];
    }
    if (best && (bestScore >= 2.5 || classes.length === 1)) return best;
  }
  return "";
}

/** A line of JavaScript for an element: the real source when found, else a reconstruction. */
export function codeFor(el) {
  return sourceLineFor(el) || reconstructedCode(el);
}

/** The line of JavaScript that builds an element, e.g. h("h1.profile-name", "Ada"). */
function reconstructedCode(el) {
  const tag = el.tagName.toLowerCase();
  const cls = [...el.classList].find((c) => !/^(anim|dz|is-|has-)/.test(c));
  const sel = cls ? `${tag}.${cls}` : tag;
  const text = el.textContent.trim().replace(/\s+/g, " ");
  if (tag === "svg") return `svgIcon(ICONS.${el.closest("[data-icon]")?.dataset.icon || "icon"})`;
  if (tag === "img") return `h("${sel}", { src: photo, alt: ${str(el.alt || "")} })`;
  if (tag === "a") return `h("${sel}", { href: ${str((el.getAttribute("href") || "").replace(/^https?:\/\/(www\.)?/, ""))} }${text ? `, ${str(text)}` : ""})`;
  if (tag === "button") return `h("${sel}", { onclick }${text ? `, ${str(text)}` : ""})`;
  if (/^h[1-6]$/.test(tag) || tag === "p" || tag === "li" || tag === "span" || tag === "strong" || tag === "time") return text ? `h("${sel}", ${str(text)})` : `h("${sel}")`;
  return `h("${sel}"${text ? `, ${str(text)}` : ""})`;
}

/** Highlighted spans for a line of code. */
function paint(target, code) {
  for (const [cls, t] of tokenizeJs(code)) {
    const span = document.createElement("span");
    if (cls) span.className = `tk-${cls}`;
    span.textContent = t;
    target.appendChild(span);
  }
}

export function finishAllDissolves() {
  for (const d of [...active]) d.finish();
}

/**
 * Plays the dissolve on `host`. Resolves when done. speed > 1 is faster.
 */
export function dissolveIn(host, { speed = 1 } = {}) {
  return new Promise((resolve) => {
    const units = collectUnits(host);
    host.classList.add("is-in");
    if (!units.length || typeof host.animate !== "function") return resolve();

    const layer = document.createElement("div");
    layer.className = "dz-layer";
    layer.setAttribute("aria-hidden", "true");
    if (getComputedStyle(host).position === "static") host.classList.add("dz-host");
    host.appendChild(layer);

    const base = host.getBoundingClientRect();
    const step = Math.min(28, 950 / units.length) / speed; // whole cascade ≤ ~1s
    const animations = [];
    const ease = "cubic-bezier(0.2, 0.7, 0.2, 1)";

    units.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const delay = i * step;
      const wisp = document.createElement("span");
      wisp.className = "dz-code";
      paint(wisp, codeFor(el));
      wisp.style.left = `${r.left - base.left}px`;
      wisp.style.top = `${r.top - base.top + Math.max(0, (r.height - 16) / 2)}px`;
      wisp.style.fontSize = `${Math.max(10, Math.min(13, r.height * 0.5))}px`;
      const drift = (i % 2 ? -1 : 1) * (4 + (i % 5) * 2);
      // Room to the screen's right edge, after the drift and the 1.25 scale
      // (grown from the left), so a wisp never adds a sideways scroll
      const room = (document.documentElement.clientWidth - 8 - Math.max(r.left, 0) - Math.abs(drift)) / 1.25;
      wisp.style.maxWidth = `${Math.max(0, Math.min(Math.max(r.width + 80, 160), room))}px`;
      wisp.style.transformOrigin = "left center";
      layer.appendChild(wisp);

      animations.push(
        wisp.animate(
          [
            { opacity: 0, filter: "blur(3px)", transform: "translateY(5px)" },
            { opacity: 0.95, filter: "blur(0)", transform: "translateY(0)", offset: 0.35 },
            { opacity: 0.9, filter: "blur(0)", transform: "translateY(0)", offset: 0.55 },
            { opacity: 0, filter: "blur(6px)", transform: `translate(${drift}px, -10px) scale(1.25)`, letterSpacing: "0.25em" },
          ],
          { duration: 720 / speed, delay, easing: "ease-out", fill: "both" },
        ),
        el.animate(
          [
            { opacity: 0, filter: "blur(5px)" },
            { opacity: 1, filter: "blur(0)" },
          ],
          { duration: 420 / speed, delay: delay + 360 / speed, easing: ease, fill: "backwards" },
        ),
      );
    });

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      active.delete(entry);
      animations.forEach((a) => a.finish?.());
      layer.remove();
      host.classList.remove("dz-host");
      resolve();
    };
    const entry = { finish };
    active.add(entry);
    Promise.all(animations.map((a) => a.finished)).then(finish, finish);
  });
}
