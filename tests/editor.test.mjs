// Palette math (JS mirror of styles/style.css) and editor helpers: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { checkPalette, darkHex, contrast, hexToRgb } from "../public/scripts/palette.js";
import { parseFrontmatter } from "../public/scripts/utils.js";
import { __test } from "../public/scripts/views/editor.js";

const css = readFileSync(new URL("../public/styles/style.css", import.meta.url), "utf8");
const DEFAULTS = Object.fromEntries(
  [...css.matchAll(/^\s*--(base|core|accent|variant|surface|depth|optimal|risky|fatal|prime):\s*(#[0-9a-f]{6});/gim)].map((m) => [m[1], m[2]]),
);

test("palette: default tokens are all present in style.css", () => {
  assert.equal(Object.keys(DEFAULTS).length, 10, JSON.stringify(DEFAULTS));
});

test("palette: dark-mode generation matches the browser", () => {
  // Measured in Chrome from the CSS relative-color formulas
  assert.equal(darkHex("accent", "#2f5d62"), "#8eb7bb");
  assert.equal(darkHex("depth", "#6f9e96"), "#3c4c49");
});

test("palette: every default passes contrast in light and dark mode", () => {
  const failing = checkPalette(DEFAULTS).filter((r) => !r.ok);
  assert.deepEqual(failing, []);
});

test("palette: low-contrast palettes are reported", () => {
  const bad = checkPalette({ ...DEFAULTS, accent: "#c6dfd7" });
  assert.ok(bad.some((r) => !r.ok && r.label === "Links" && r.scheme === "light"));
});

test("palette: WCAG contrast reference values", () => {
  assert.equal(Math.round(contrast(hexToRgb("#000000"), hexToRgb("#ffffff")) * 10) / 10, 21);
  assert.equal(Math.round(contrast(hexToRgb("#777777"), hexToRgb("#ffffff")) * 100) / 100, 4.48);
});

test("editor: setPath removes empty values and prunes empty parents", () => {
  const o = { basics: { name: "A", location: { city: "X" } } };
  __test.setPath(o, ["basics", "location", "city"], "");
  assert.deepEqual(o, { basics: { name: "A" } });
  __test.setPath(o, ["work", 0, "highlights"], ["one"]);
  assert.deepEqual(o.work, [{ highlights: ["one"] }]);
});

test("editor: blog frontmatter round-trips through the parser", () => {
  const post = { title: 'He said "hi"', date: "2026-11-03", tags: ["notes", "a b"], description: "Short", image: "", draft: true, body: "# Hello\n\nText" };
  const { metadata, body } = parseFrontmatter(__test.frontmatter(post));
  assert.equal(metadata.title, 'He said "hi"');
  assert.equal(String(metadata.date), "2026-11-03");
  assert.deepEqual(metadata.tags, ["notes", "a b"]);
  assert.equal(metadata.draft, true);
  assert.equal(body, "# Hello\n\nText");
});

test("logo: logo.svg carries its own color", () => {
  const file = readFileSync(new URL("../public/assets/images/logo.svg", import.meta.url), "utf8");
  assert.match(file, /fill="#2f5d62"/);
});
