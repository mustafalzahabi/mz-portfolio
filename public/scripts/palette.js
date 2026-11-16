// ============================================================================
// PALETTE MATH — a JS mirror of the CSS in styles/style.css, so the editor can
// check contrast for any ten-token palette in light AND generated dark mode
// without rendering it. Pure functions (runs in Node for tests).
// ============================================================================

// ---------- sRGB ⇄ OKLab ⇄ OKLCH ----------

function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, "");
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToOklab([r, g, b]) {
  [r, g, b] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, c))))));
}

const labToLch = ([L, a, b]) => [L, Math.hypot(a, b), Math.atan2(b, a)];
const lchToLab = ([L, C, H]) => [L, C * Math.cos(H), C * Math.sin(H)];

export function rgbToHex(rgb) {
  return "#" + rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");
}

// ---------- TwOP dark-mode engine (same formulas as style.css) ----------

const clamp = (min, v, max) => Math.min(max, Math.max(min, v));
const ENGINE = {
  canvas: (L, C) => [clamp(0.1, 1 - L * L, 0.25), C * 0.5],
  text: (L, C) => [clamp(0.85, 1 - L * L, 0.95), C * 0.6],
  border: (L, C) => [clamp(0.25, 1 - L * L, 0.4), C * 0.4],
  brand: (L, C) => [clamp(0.25, 1 - L * L, 0.55), C * Math.max(0.6, 1 - L * 0.4)],
  action: (L, C) => [clamp(0.45, 1 - L * L, 0.75), C * Math.max(0.7, 1 - L * 0.3)],
  signal: (L, C) => [clamp(0.45, 1 - L * L, 0.8), C * Math.max(0.75, 1 - L * 0.25)],
};

const ROLE = {
  base: "canvas", surface: "canvas", core: "text", depth: "border",
  accent: "action", variant: "action", optimal: "signal", risky: "signal", fatal: "signal", prime: "brand",
};

const OUTPUT = { b: "base", c: "core", a: "accent", v: "variant", s: "surface", d: "depth", o: "optimal", r: "risky", f: "fatal", p: "prime" };

function darkOf(token, rgb) {
  const [L, C, H] = labToLch(rgbToOklab(rgb));
  const [L2, C2] = ENGINE[ROLE[token]](L, C);
  return oklabToRgb(lchToLab([L2, C2, H]));
}

/** color-mix(in oklab, x p%, y) */
function mix(x, p, y) {
  const [a, b] = [rgbToOklab(x), rgbToOklab(y)];
  return oklabToRgb(a.map((v, i) => v * p + b[i] * (1 - p)));
}

/** Resolves --color-* and the derived shades the UI uses, for one scheme. */
export function resolvePalette(tokens, scheme = "light") {
  const out = {};
  for (const [k, token] of Object.entries(OUTPUT)) {
    const rgb = hexToRgb(tokens[token]);
    if (!rgb) return null;
    out[k] = scheme === "dark" ? darkOf(token, rgb) : rgb;
  }
  out.muted = mix(out.c, 0.72, out.d);
  out.lineStrong = mix(out.d, 0.72, out.c);
  out.card = scheme === "dark" ? out.s : mix(out.s, 0.55, out.b);
  return out;
}

// ---------- WCAG contrast ----------

function luminance(rgb) {
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(x, y) {
  const [a, b] = [luminance(x), luminance(y)].sort((m, n) => n - m);
  return (a + 0.05) / (b + 0.05);
}

const CHECKS = [
  ["Text on page", "c", "b", 4.5],
  ["Text on cards", "c", "card", 4.5],
  ["Secondary text", "muted", "b", 4.5],
  ["Links", "a", "b", 4.5],
  ["Button text", "b", "a", 4.5],
  ["Hover color", "v", "b", 4.5],
  ["Name & headings (prime)", "p", "b", 3],
  ["Form field borders", "lineStrong", "b", 3],
  ["Success color", "o", "b", 3],
  ["Warning color", "r", "b", 3],
  ["Error color", "f", "b", 3],
];

/**
 * @param {Record<string,string>} tokens all ten tokens as hex
 * @returns {{ scheme, label, ratio, min, ok }[]}
 */
export function checkPalette(tokens) {
  const results = [];
  for (const scheme of ["light", "dark"]) {
    const p = resolvePalette(tokens, scheme);
    if (!p) continue;
    for (const [label, fg, bg, min] of CHECKS) {
      const ratio = Math.round(contrast(p[fg], p[bg]) * 100) / 100;
      results.push({ scheme, label, ratio, min, ok: ratio >= min });
    }
  }
  return results;
}

export function darkHex(token, hex) {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(darkOf(token, rgb)) : "";
}

export { hexToRgb };
