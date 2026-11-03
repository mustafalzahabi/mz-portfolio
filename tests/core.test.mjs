// Unit tests for pure modules: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { escapeHtml, safeUrl, formatDate, formatDateRange, slugify, parseFrontmatter, readingTime } from "../public/scripts/utils.js";
import { markdownToHtml } from "../public/scripts/markdown.js";
import { normalizeConfig, DEFAULT_CONFIG, SECTION_KEYS, isValidColor } from "../public/scripts/config.js";
import { detectSource, parsePath, isGithubUsername, looksLikeDriveId } from "../public/scripts/router.js";
import { mergeProjects, mergeSkills, skillLevelPercent, buildBasics, validateResume, buildViewModel } from "../public/scripts/merge.js";

const example = JSON.parse(readFileSync(new URL("../public/assets/examples/resume.json", import.meta.url), "utf8"));

// ---------------------------------------------------------------------------
test("escapeHtml escapes all specials", () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  assert.equal(escapeHtml(null), "");
});

test("safeUrl allows only safe protocols", () => {
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl(" JaVaScRiPt:alert(1)"), "");
  assert.equal(safeUrl("java\nscript:alert(1)"), "");
  assert.equal(safeUrl("data:text/html,<b>"), "");
  assert.equal(safeUrl("https://example.com/a"), "https://example.com/a");
  assert.equal(safeUrl("mailto:a@b.co"), "mailto:a@b.co");
  assert.equal(safeUrl("example.com"), "https://example.com");
  assert.equal(safeUrl("#about"), "#about");
  assert.equal(safeUrl("data:image/png;base64,AAAA", { allowDataImage: true }), "data:image/png;base64,AAAA");
});

test("formatDate handles partial ISO dates", () => {
  assert.equal(formatDate("2024"), "2024");
  assert.equal(formatDate("2024-06"), "Jun 2024");
  assert.equal(formatDate("2024-06-15", "en-US", { long: true }), "June 15, 2024");
  assert.equal(formatDate(""), "");
  assert.equal(formatDateRange("2020-01", "", "en-US", "Present"), "Jan 2020 – Present");
  assert.equal(formatDateRange("2020-01", "2021-03"), "Jan 2020 – Mar 2021");
});

test("slugify, readingTime, frontmatter", () => {
  assert.equal(slugify("Héllo, World!"), "hello-world");
  assert.equal(readingTime("word ".repeat(440)), 2);
  const { metadata, body } = parseFrontmatter('---\ntitle: "Hi"\ntags: [a, b]\ndraft: false\n---\nBody');
  assert.deepEqual(metadata, { title: "Hi", tags: ["a", "b"], draft: false });
  assert.equal(body, "Body");
});

// ---------------------------------------------------------------------------
test("markdown: XSS is neutralized", () => {
  const html = markdownToHtml(`[x](javascript:alert(1)) <img src=x onerror=alert(1)> <script>alert(1)</script> <a href="javascript:void(0)">y</a>`);
  assert.ok(!/javascript:/i.test(html), html);
  assert.ok(!/onerror/i.test(html), html);
  assert.ok(!/<script/i.test(html), html);
});

test("markdown: blocks", () => {
  const html = markdownToHtml("# T\n\n- a\n  - b\n- [x] c\n\n1. one\n\n| A | B |\n|---|--:|\n| 1 | 2 |\n\n> q\n\n```js\nx<y\n```");
  assert.match(html, /<h1 id="t">T<\/h1>/);
  assert.match(html, /<ul><li>a<ul><li>b<\/li><\/ul><\/li><li class="task"><input type="checkbox" disabled checked> c<\/li><\/ul>/);
  assert.match(html, /<ol><li>one<\/li><\/ol>/);
  assert.match(html, /<th style="text-align:right">B<\/th>/);
  assert.match(html, /<blockquote><p>q<\/p><\/blockquote>/);
  assert.match(html, /<code class="language-js">x&lt;y<\/code>/);
});

test("markdown: relative URLs resolve against base", () => {
  const html = markdownToHtml("![a](docs/a.png) [b](./b.md)", {
    baseUrl: "https://github.com/u/r/blob/main/",
    rawBaseUrl: "https://raw.githubusercontent.com/u/r/main/",
  });
  assert.match(html, /src="https:\/\/raw\.githubusercontent\.com\/u\/r\/main\/docs\/a\.png"/);
  assert.match(html, /href="https:\/\/github\.com\/u\/r\/blob\/main\/b\.md"/);
});

// ---------------------------------------------------------------------------
test("config: defaults and full section order", () => {
  const { config, warnings } = normalizeConfig({});
  assert.deepEqual(warnings, []);
  assert.deepEqual(config.sections.order, SECTION_KEYS);
  assert.equal(config.resume.theme, "even");
  assert.equal(config.animation.intro, DEFAULT_CONFIG.animation.intro);
});

test("config: legacy shapes are migrated", () => {
  const { config, warnings } = normalizeConfig({
    theme: "elegant",
    "mz-portfolio-config": [
      {
        accent: "#123456",
        theme: { dark: true },
        themeToggle: { style: "icon" },
        blog: false,
        animation: { type: "slide", transitionDuration: "0.3s", glowOnHover: true },
      },
    ],
  });
  assert.deepEqual(warnings, []);
  assert.equal(config.colors.accent, "#123456");
  assert.equal(config.theme.mode, "dark");
  assert.equal(config.theme.toggle, "icon");
  assert.equal(config.blog.enabled, false);
  assert.equal(config.animation.intro, "slide");
  assert.equal(config.animation.duration, 0.3);
  assert.equal(config.animation.hover.glow, true);
  assert.equal(config.resume.theme, "elegant");
});

test("config: invalid values warn and fall back", () => {
  const { config, warnings } = normalizeConfig({
    "mz-portfolio-config": {
      colors: { accent: "red; background:url(x)" },
      skills: { display: "pie" },
      sections: { order: ["work", "nope"] },
      bogus: 1,
    },
  });
  assert.equal(config.colors.accent, "");
  assert.equal(config.skills.display, "tags");
  assert.equal(config.sections.order[0], "work");
  assert.equal(config.sections.order.length, SECTION_KEYS.length);
  assert.ok(warnings.length >= 4, warnings.join("\n"));
  assert.ok(isValidColor("oklch(0.5 0.1 200)"));
  assert.ok(!isValidColor("red}"));
});

// ---------------------------------------------------------------------------
test("router: source detection", () => {
  assert.ok(isGithubUsername("mustafalzahabi"));
  assert.ok(!isGithubUsername("-bad"));
  assert.ok(!isGithubUsername("a--b"));
  assert.deepEqual(detectSource("mustafalzahabi"), { source: "auto", id: "mustafalzahabi" });
  assert.deepEqual(detectSource("https://github.com/octocat"), { source: "gh", id: "octocat" });
  assert.deepEqual(detectSource("https://drive.google.com/file/d/1AbC_dEf-123456789012345678/view"), { source: "gd", id: "1AbC_dEf-123456789012345678" });
  assert.deepEqual(detectSource("https://drive.google.com/drive/folders/1xYzAbCdEfGhIjKlMnOpQrStUvW"), { source: "gd", id: "1xYzAbCdEfGhIjKlMnOpQrStUvW" });
  assert.equal(detectSource("1AbCdEfGhIjKlMnOpQrStUvWxYz012345").source, "gd");
  assert.ok(looksLikeDriveId("1a_b2C3d4E5f6G7h8I9j0KlMnOpQ"));
});

test("router: path parsing", () => {
  const sub = (path, base = "/") => parsePath(path, base).sub;
  assert.deepEqual(parsePath("/", "/"), { view: "landing" });
  assert.deepEqual(parsePath("/preview", "/"), { view: "preview" });
  assert.deepEqual(parsePath("/repo/docs", "/repo/"), { view: "docs" });
  assert.deepEqual(parsePath("/octocat", "/"), { view: "portfolio", source: "auto", id: "octocat", base: "/octocat", sub: { name: "profile" } });
  assert.deepEqual(parsePath("/1AbC_dEf-123456789012345678", "/"), {
    view: "portfolio", source: "gd", id: "1AbC_dEf-123456789012345678", base: "/1AbC_dEf-123456789012345678", sub: { name: "profile" },
  });
  assert.equal(parsePath("/repo/octocat/blog", "/repo/").base, "/repo/octocat");
  assert.deepEqual(sub("/octocat/project/my%20app"), { name: "project", param: "my app" });
  assert.deepEqual(sub("/octocat/blog"), { name: "blog" });
  assert.deepEqual(sub("/octocat/blog/hello-world"), { name: "post", param: "hello-world" });
  assert.deepEqual(sub("/octocat/tab/talks"), { name: "tab", param: "talks" });
  assert.deepEqual(sub("/octocat/resume"), { name: "resume" });
  assert.deepEqual(sub("/octocat/nope"), { name: "missing" });
  assert.deepEqual(sub("/octocat/project/a/b"), { name: "missing" });
  const preview = parsePath("/preview/view/project/x", "/");
  assert.equal(preview.preview, true);
  assert.equal(preview.base, "/preview/view");
  assert.deepEqual(preview.sub, { name: "project", param: "x" });
});

test("config: custom tabs are validated", () => {
  const { config, warnings } = normalizeConfig({
    "mz-portfolio-config": {
      tabs: [
        { label: "Talk", type: "embed", url: "https://www.youtube.com/embed/x" },
        { label: "Notes", type: "markdown", content: "# hi" },
        { label: "Demo", type: "html", url: "https://raw.githubusercontent.com/u/r/main/demo.html", height: 50 },
        { label: "Bad host", type: "code", url: "https://evil.example/x.js" },
        { label: "Bad link", type: "link", url: "javascript:alert(1)" },
        { label: "Blog", type: "link", url: "https://example.com" },
        { label: "No type" },
      ],
    },
  });
  assert.deepEqual(config.tabs.map((t) => t.slug), ["talk", "notes", "demo", "blog-2"]);
  assert.equal(config.tabs[2].height, 200);
  assert.equal(warnings.length, 3, warnings.join("\n"));
});

// ---------------------------------------------------------------------------
const repo = (name, extra = {}) => ({
  name,
  description: "",
  language: "JavaScript",
  topics: [],
  github_link: `https://github.com/u/${name}`,
  live_link: "",
  stars: 1,
  fork: false,
  archived: false,
  owner: "u",
  defaultBranch: "main",
  updatedAt: "2024-01-01",
  ...extra,
});
const repos = [
  repo("cedar-court", { description: "Repo desc", stars: 5 }),
  repo("other", { language: "Python", topics: ["ml"], stars: 9, updatedAt: "2025-01-01" }),
  repo("forked", { language: "Go", fork: true }),
];

test("merge: projects match by name and respect config", () => {
  const all = mergeProjects(example.projects, repos, { github: "all" });
  assert.equal(all[0].name, "Cedar Court Housing");
  assert.equal(all[0].stars, null, "different names must not match");
  const matched = mergeProjects([{ name: "Cedar Court" }], repos, { github: "matched" });
  assert.equal(matched.length, 1);
  assert.equal(matched[0].stars, 5);
  assert.equal(matched[0].description, "Repo desc");
  assert.ok(!mergeProjects([], repos, { github: "all" }).some((p) => p.name === "forked"));
  assert.ok(mergeProjects([], repos, { github: "all", showForks: true }).some((p) => p.name === "forked"));
  assert.equal(mergeProjects([], repos, { github: "all", sort: "stars" })[0].name, "other");
  assert.equal(mergeProjects(example.projects, repos, { github: "none", limit: 1 }).length, 1);
  assert.equal(mergeProjects(example.projects, repos, { github: "none", exclude: ["Gallery Extension"] }).length, 1);
});

test("merge: skills keep level; levels map to percent", () => {
  const skills = mergeSkills(example.skills, repos, { githubLanguages: true });
  assert.equal(skills[0].level, "Master");
  assert.equal(skills[0].percent, 100);
  assert.ok(skills.at(-1).fromGithub);
  assert.equal(skillLevelPercent("Intermediate"), 55);
  assert.equal(skillLevelPercent(7), 70);
  assert.equal(skillLevelPercent("80%"), 80);
  assert.equal(skillLevelPercent("4/5"), 80);
  assert.equal(skillLevelPercent("unknown"), null);
});

test("merge: basics drop unsafe profile urls and dedupe", () => {
  const b = buildBasics(
    { name: "A", profiles: [{ network: "X", url: "javascript:alert(1)" }, { network: "GitHub", url: "https://github.com/a" }] },
    { html_url: "https://github.com/a/", login: "a" },
  );
  assert.equal(b.profiles.length, 1);
  assert.equal(b.profiles[0].url, "https://github.com/a");
});

test("merge: validation warnings", () => {
  assert.deepEqual(validateResume(example), []);
  const w = validateResume({ basics: { email: "nope" }, work: [{ startDate: "June 2020", highlights: "x" }], skills: {} });
  assert.ok(w.some((x) => x.startsWith("basics.name")));
  assert.ok(w.some((x) => x.startsWith("basics.email")));
  assert.ok(w.some((x) => x.startsWith("work[0].startDate")));
  assert.ok(w.some((x) => x.startsWith("work[0].highlights")));
  assert.ok(w.some((x) => x.startsWith("skills:")));
});

test("merge: view model from example", () => {
  const { config } = normalizeConfig(example.meta);
  const vm = buildViewModel({ resume: example, github: null, repos: [], posts: [], source: { type: "preview", id: "x" } }, config);
  assert.equal(vm.basics.name, "Lina Haddad");
  assert.equal(vm.basics.location, "Cambridge, Massachusetts, US");
  assert.equal(vm.projects.length, 2);
  assert.equal(vm.interests.length, 2);
  assert.equal(vm.references.length, 1);
});

test("isSamePage: matches a portfolio's own address loosely", async () => {
  const { isSamePage } = await import("../public/scripts/utils.js");
  const own = "https://mz-portfolio.pages.dev/mustafalzahabi";
  assert.ok(isSamePage("https://mz-portfolio.pages.dev/mustafalzahabi", own));
  assert.ok(isSamePage("http://www.MZ-portfolio.pages.dev/MustafAlzahabi/", own));
  assert.ok(isSamePage("https://mz-portfolio.pages.dev/mustafalzahabi#projects", own));
  assert.ok(!isSamePage("https://mz-portfolio.pages.dev/someone-else", own));
  assert.ok(!isSamePage("https://github.com/mustafalzahabi", own));
  assert.ok(!isSamePage("mailto:a@b.co", own));
  assert.ok(!isSamePage("not a url", own));
});
