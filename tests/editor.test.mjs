// Palette math (JS mirror of styles/style.css) and editor helpers: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { checkPalette, darkHex, contrast, hexToRgb } from "../public/scripts/palette.js";
import { parseFrontmatter } from "../public/scripts/utils.js";
import { postFields } from "../public/scripts/posts.js";
import { setPath, frontmatter, prune, History, diffSummary, validateField, applyMarkdown } from "../public/scripts/editor-core.js";
import { SECTIONS, templateResume, blankScaffold } from "../public/scripts/template.js";
import { validateResume } from "../public/scripts/merge.js";

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
  setPath(o, ["basics", "location", "city"], "");
  assert.deepEqual(o, { basics: { name: "A" } });
  setPath(o, ["work", 0, "highlights"], ["one"]);
  assert.deepEqual(o.work, [{ highlights: ["one"] }]);
});

test("editor: blog frontmatter round-trips through the parser", () => {
  const post = { title: 'He said "hi"', date: "2026-11-03", tags: ["notes", "a b"], description: "Short", image: "", draft: true, body: "# Hello\n\nText" };
  const { metadata, body } = parseFrontmatter(frontmatter(post));
  assert.equal(metadata.title, 'He said "hi"');
  assert.equal(String(metadata.date), "2026-11-03");
  assert.deepEqual(metadata.tags, ["notes", "a b"]);
  assert.equal(metadata.published, false);
  assert.equal(body, "# Hello\n\nText");
});

test("posts: dev.to keys are written and read back", () => {
  const post = { title: "T", date: "2026-11-03", tags: ["a"], description: "D", image: "https://x/c.png", canonical: "https://x/p", slug: "my-post", draft: false, body: "Hi" };
  const { metadata, body } = parseFrontmatter(frontmatter(post));
  assert.equal(metadata.cover_image, "https://x/c.png");
  assert.equal(metadata.canonical_url, "https://x/p");
  assert.equal(metadata.published, true);
  const back = postFields(metadata, { body, filename: "x.md" });
  assert.equal(back.slug, "my-post");
  assert.equal(back.image, "https://x/c.png");
  assert.equal(back.canonical, "https://x/p");
  assert.equal(back.draft, false);
});

test("posts: lenient reading and fallbacks", () => {
  const a = postFields({ summary: "S", image: "i.png", tags: "a, b", draft: true }, { body: "# Heading\n", filename: "2025-04-01-hello-there.md" });
  assert.equal(a.title, "Heading");
  assert.equal(a.description, "S");
  assert.equal(a.image, "i.png");
  assert.deepEqual(a.tags, ["a", "b"]);
  assert.equal(a.date, "2025-04-01");
  assert.equal(a.draft, true);
  const b = postFields({ images: ["one.png"] }, { body: "no heading", filename: "2025-04-01-hello-there.md", fallbackTitle: "From gist" });
  assert.equal(b.title, "From gist");
  assert.equal(b.image, "one.png");
  assert.equal(postFields({}, { filename: "2025-04-01-hello-there.md" }).title, "hello-there");
  assert.equal(postFields({}, { filename: "x.md", created: "2024-01-02T00:00:00Z" }).date, "2024-01-02T00:00:00Z");
});

test("logo: logo.svg carries its own color", () => {
  const file = readFileSync(new URL("../public/assets/images/logo.svg", import.meta.url), "utf8");
  assert.match(file, /fill="#2f5d62"/);
});

test("template: covers every section with placeholder text and validates", () => {
  const t = templateResume();
  assert.equal(t.basics.name, "Full name");
  for (const s of SECTIONS) assert.equal(t[s.key]?.length, 1, s.key);
  assert.deepEqual(validateResume(t), []);
  assert.ok(!JSON.stringify(t).match(/Jack/));
});

test("template: blank scaffold prunes to an empty resume", () => {
  assert.deepEqual(prune(blankScaffold()), {});
  assert.deepEqual(prune({ work: [{}, { name: "A", highlights: ["", "x"] }], basics: { name: " " } }), { work: [{ name: "A", highlights: ["x"] }] });
});

test("history: undo/redo with per-field merging", () => {
  let t = 0;
  const hist = new History({ a: "" }, { now: () => t });
  hist.push({ a: "h" }, "a");
  t = 100;
  hist.push({ a: "hi" }, "a"); // merged into the previous step
  t = 2000;
  hist.push({ a: "hi", b: 1 }, "b");
  assert.deepEqual(hist.undo(), { a: "hi" });
  assert.deepEqual(hist.undo(), { a: "" });
  assert.equal(hist.canUndo, false);
  assert.deepEqual(hist.redo(), { a: "hi" });
  hist.push({ a: "new" }, "a"); // a new edit drops the redo branch
  assert.equal(hist.canRedo, false);
});

test("diffSummary: describes changes per section", () => {
  const a = { basics: { name: "A", label: "B" }, work: [{ name: "x" }] };
  const b = { basics: { name: "A2", label: "B2" }, work: [{ name: "x" }, { name: "y" }], skills: [{ name: "s" }] };
  assert.deepEqual(diffSummary(a, b), ["basics: 2 fields changed", "work: 1 added", "skills: 1 added"]);
  assert.deepEqual(diffSummary(a, a), []);
});

test("validateField: email, url, date, tel", () => {
  assert.equal(validateField("email", "a@b.co"), "");
  assert.ok(validateField("email", "nope"));
  assert.equal(validateField("url", "https://x.dev"), "");
  assert.ok(validateField("url", "javascript:alert(1)"));
  assert.equal(validateField("date", "2024-06"), "");
  assert.ok(validateField("date", "2024-13"));
  assert.ok(validateField("tel", "call me"));
  assert.equal(validateField("email", ""), "");
});

test("applyMarkdown: wraps selections and prefixes lines", () => {
  assert.deepEqual(applyMarkdown("say hi", 4, 6, "bold"), { text: "say **hi**", start: 6, end: 8 });
  assert.equal(applyMarkdown("a\nb", 0, 3, "list").text, "- a\n- b");
  assert.equal(applyMarkdown("x", 1, 1, "link").text, "x[link text](https://)");
});

test("images: uploaded gist images are recognised, other links pass through", async () => {
  const { isGistImage, resolveImage } = await import("../public/scripts/images.js");
  assert.equal(isGistImage("https://gist.githubusercontent.com/u/abc/raw/123/portfolio-photo.txt"), true);
  assert.equal(isGistImage("https://example.com/photo.txt"), false);
  assert.equal(isGistImage("https://gist.githubusercontent.com/u/abc/raw/photo.png"), false);
  assert.equal(await resolveImage("https://example.com/a.jpg"), "https://example.com/a.jpg");
  assert.equal(await resolveImage("javascript:alert(1)"), "");
});

test("post series: read from frontmatter and written back", () => {
  const a = postFields({ title: "T", series: "Math, Step by Step", part: "3" }, { body: "", filename: "t.md" });
  assert.equal(a.series, "Math, Step by Step");
  assert.equal(a.part, 3);
  const { metadata, body } = parseFrontmatter(frontmatter({ ...a, body: "Hi" }));
  const back = postFields(metadata, { body, filename: "t.md" });
  assert.equal(back.series, "Math, Step by Step");
  assert.equal(back.part, 3);
  assert.equal(postFields({ title: "T" }, { filename: "t.md" }).series, "");
});
