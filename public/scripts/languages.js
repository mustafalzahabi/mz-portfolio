// ============================================================================
// GITHUB LANGUAGE COLORS — from github/linguist languages.yml (raw host, so it
// doesn't use the GitHub API rate limit), cached in localStorage for a week.
// Tags whose text names a language get that language's color as background.
// ============================================================================

const SOURCE = "https://raw.githubusercontent.com/github/linguist/main/lib/linguist/languages.yml";
const CACHE_KEY = "mz-cache-lang-colors-v2";
const TTL = 7 * 24 * 60 * 60 * 1000;

let colors = null; // Map(lowercase name or alias → "#rrggbb")
let loading = null;

/** Parses languages.yml into a Map of lowercase name/alias → color. */
export function parseLinguist(yaml) {
  const map = new Map();
  let names = [];
  let color = null;
  let inAliases = false;
  const flush = () => {
    if (color) for (const n of names) if (!map.has(n)) map.set(n, color);
  };
  for (const line of String(yaml).split("\n")) {
    const top = line.match(/^(["']?)([^\s#"'][^:]*?)\1:\s*$/);
    if (top) {
      flush();
      names = [top[2].trim().toLowerCase()];
      color = null;
      inAliases = false;
      continue;
    }
    if (/^ {2}aliases:\s*$/.test(line)) {
      inAliases = true;
      continue;
    }
    const alias = inAliases && line.match(/^ {2}- (.+)$/);
    if (alias) {
      names.push(alias[1].trim().replace(/^["']|["']$/g, "").toLowerCase());
      continue;
    }
    if (/^ {2}\S/.test(line)) inAliases = false;
    const c = line.match(/^ {2}color:\s*["']?(#[0-9a-fA-F]{6})["']?/);
    if (c) color = c[1].toLowerCase();
  }
  flush();
  return map;
}

export function loadLanguageColors() {
  if (colors) return Promise.resolve(colors);
  if (loading) return loading;
  loading = (async () => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && Date.now() - cached.at < TTL) {
        colors = new Map(cached.entries);
        return colors;
      }
    } catch {
      /* ignore */
    }
    try {
      const res = await fetch(SOURCE);
      if (!res.ok) throw new Error(res.status);
      colors = parseLinguist(await res.text());
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), entries: [...colors] }));
      } catch {
        /* quota */
      }
    } catch {
      colors = new Map();
    }
    return colors;
  })();
  return loading;
}

// Common resume spellings → linguist names
const ALIASES = { "node.js": "javascript", nodejs: "javascript", es6: "javascript", "c#": "c#", golang: "go" };

export function languageColor(name) {
  if (!colors) return null;
  const raw = String(name || "").trim().toLowerCase();
  const plain = raw.replace(/\s*\(.*\)\s*$/, ""); // "JavaScript (ES6+)" → "javascript"
  const unversioned = plain.replace(/\s*v?\d+(\.\d+)*$/, ""); // "HTML5", "CSS3", "Python 3"
  for (const key of [raw, plain, unversioned]) {
    const hit = colors.get(ALIASES[key] || key);
    if (hit) return hit;
  }
  return null;
}

/** Readable text color on a solid background (WCAG relative luminance). */
export function textOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#111111" : "#ffffff";
}

/** Colors a tag element if its text is a known language. */
export function paintLanguageTag(el, name) {
  const color = languageColor(name);
  if (!color) return el;
  el.classList.add("tag-lang");
  el.style.setProperty("--lang", color);
  el.style.setProperty("--on-lang", textOn(color));
  return el;
}
