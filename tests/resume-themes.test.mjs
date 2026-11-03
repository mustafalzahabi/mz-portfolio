// ============================================================================
// RESUME THEME TESTS
// Run with: node --test tests/
// ============================================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  escapeHtml, safeUrl, normalizeThemeName, formatDate, markdownLite,
} from "../public/scripts/resume/helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const resume = JSON.parse(readFileSync(join(root, "public", "assets", "examples", "resume.json"), "utf8"));

// Index.js is a browser module; keep the curated list in sync with it here.
const THEMES = ["even", "elegant", "flat", "kendall", "stackoverflow", "macchiato", "onepage", "professional"];

// Section headings each theme renders for the sections present in the example resume.
const HEADINGS = {
  even: ["Work", "Volunteer", "Education", "Projects", "Awards", "Certificates", "Publications", "Skills", "Languages", "Interests", "References"],
  elegant: ["About", "Work Experience", "Projects Experience", "Skills", "Education", "Certificates", "Awards", "Volunteer Work", "Publications", "Interests", "References"],
  flat: ["Contact", "About", "Profiles", "Work", "Volunteer", "Education", "Awards", "Publications", "Skills", "Languages", "Interests", "References"],
  kendall: ["About", "Work Experience", "Awards", "Volunteer", "Projects", "Contact", "Education", "Skills", "Publications", "Languages", "Interests", "References"],
  stackoverflow: ["Summary", "Skills", "Work Experience", "Projects", "Volunteer", "Education", "Awards", "Certificates", "Publications", "Languages", "Interests", "References"],
  macchiato: ["About", "Summary", "Experience", "Open Source Projects", "Education", "Volunteer", "Awards", "Publications", "Languages", "Interests", "References"],
  onepage: ["SUMMARY", "EXPERIENCE", "PUBLICATIONS", "AWARDS", "VOLUNTEERING", "EDUCATION", "SKILLS", "LANGUAGES", "INTERESTS"],
  professional: ["Education", "Experience", "Projects", "Certificates", "Publications", "Awards", "Languages", "Skills", "Interests", "References"],
};

const XSS = "<img src=x onerror=alert(1)>";

function xssResume() {
  const copy = structuredClone(resume);
  copy.basics.name = XSS;
  copy.basics.summary = `${XSS} **bold** [evil](javascript:alert(1))`;
  copy.basics.url = "javascript:alert(1)";
  copy.basics.image = "javascript:alert(1)";
  copy.basics.profiles[0].url = "javascript:alert(1)";
  copy.basics.profiles[0].network = "linkedin";
  copy.work[0].url = " JaVaScRiPt:alert(1)";
  copy.projects[0].url = "java\tscript:alert(1)";
  return copy;
}

const loadTheme = async (name) => (await import(`../public/scripts/resume/themes/${name}.js`)).default;
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const textOnly = (html) => html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");

// ============================================================================
// THEMES
// ============================================================================

for (const name of THEMES) {
  describe(`theme: ${name}`, () => {
    test("exports name, label and render()", async () => {
      const theme = await loadTheme(name);
      assert.equal(theme.name, name);
      assert.equal(typeof theme.label, "string");
      assert.equal(typeof theme.render, "function");
    });

    test("renders a complete document with the resume name", async () => {
      const html = (await loadTheme(name)).render(resume);
      assert.match(html, /^<!doctype html>/i);
      assert.match(html, /<\/html>\s*$/i);
      assert.match(html, /<style[\s>]/i);
      assert.ok(html.includes("Lina Haddad"), "name missing");
      assert.ok(!/<script/i.test(html), "output must not contain scripts");
    });

    test("renders every supported section heading", async () => {
      const html = (await loadTheme(name)).render(resume);
      for (const heading of HEADINGS[name]) {
        assert.match(html, new RegExp(`>\\s*${escapeRegExp(heading)}\\s*<`), `heading "${heading}" missing`);
      }
    });

    test("never prints undefined / null / [object Object]", async () => {
      const theme = await loadTheme(name);
      for (const input of [resume, {}, null, { basics: { name: "Solo" } }, { work: [{}], education: [{}], skills: [{}], basics: { profiles: [{}], location: {} } }]) {
        const html = theme.render(input);
        assert.match(html, /^<!doctype html>/i);
        assert.ok(!/\bundefined\b|\bnull\b|\[object Object\]|\bNaN\b/.test(textOnly(html)), `bad text for ${JSON.stringify(input)}`);
        assert.ok(!/="undefined"|="null"/.test(html), "bad attribute value");
      }
    });

    test("does not mutate the input resume", async () => {
      const copy = structuredClone(resume);
      (await loadTheme(name)).render(copy);
      assert.deepEqual(copy, resume);
    });

    test("escapes HTML and drops unsafe URLs", async () => {
      const html = (await loadTheme(name)).render(xssResume());
      assert.ok(!html.includes("<img src=x"), "raw <img> injected");
      assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"), "escaped payload missing");
      assert.ok(!/(href|src|action)\s*=\s*["']?\s*java\s*script:/i.test(html), "javascript: URL leaked into an attribute");
      assert.ok(!/<[^>]*java\s*script:/i.test(html), "javascript: inside a tag");
    });
  });
}

// ============================================================================
// HELPERS
// ============================================================================

describe("normalizeThemeName", () => {
  test("strips package prefixes and lowercases", () => {
    assert.equal(normalizeThemeName("even"), "even");
    assert.equal(normalizeThemeName("jsonresume-theme-flat"), "flat");
    assert.equal(normalizeThemeName("@jsonresume/jsonresume-theme-elegant"), "elegant");
    assert.equal(normalizeThemeName("  StackOverflow  "), "stackoverflow");
    assert.equal(normalizeThemeName(" JSONResume-Theme-Kendall "), "kendall");
  });

  test("empty values map to even", () => {
    assert.equal(normalizeThemeName(""), "even");
    assert.equal(normalizeThemeName("   "), "even");
    assert.equal(normalizeThemeName(undefined), "even");
    assert.equal(normalizeThemeName(null), "even");
    assert.equal(normalizeThemeName("jsonresume-theme-"), "even");
  });
});

describe("safeUrl", () => {
  test("allows http, https, mailto and tel", () => {
    assert.equal(safeUrl("https://example.com/a?b=1"), "https://example.com/a?b=1");
    assert.equal(safeUrl("http://example.com"), "http://example.com");
    assert.equal(safeUrl("mailto:a@example.com"), "mailto:a@example.com");
    assert.equal(safeUrl("tel:+15550102030"), "tel:+15550102030");
    assert.equal(safeUrl("  https://example.com  "), "https://example.com");
  });

  test("rejects everything else", () => {
    for (const bad of [
      "javascript:alert(1)", " JAVASCRIPT:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)",
      "data:text/html,<script>alert(1)</script>", "vbscript:msgbox", "file:///etc/passwd",
      "//evil.example", "/relative", "relative/path", "https://", "mailto:", "", null, undefined, 42, {},
    ]) {
      assert.equal(safeUrl(bad), "", `should reject ${String(bad)}`);
    }
  });
});

describe("escapeHtml", () => {
  test("escapes markup characters and ignores non-strings", () => {
    assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    assert.equal(escapeHtml(undefined), "");
    assert.equal(escapeHtml(null), "");
    assert.equal(escapeHtml({}), "");
    assert.equal(escapeHtml(3), "3");
  });
});

describe("formatDate", () => {
  test("formats partial ISO dates", () => {
    assert.equal(formatDate("2019-04", "MMM YYYY"), "Apr 2019");
    assert.equal(formatDate("2019-04-07", "MMMM YYYY"), "April 2019");
    assert.equal(formatDate("2019-04-07", "MMM DD, YYYY"), "Apr 07, 2019");
    assert.equal(formatDate("2019-04", "MM/YYYY"), "04/2019");
    assert.equal(formatDate("2019", "MMM YYYY"), "2019");
    assert.equal(formatDate("soon", "MMM YYYY"), "soon");
    assert.equal(formatDate(undefined, "MMM YYYY"), "");
  });
});

describe("markdownLite", () => {
  test("supports bold, italic, links and breaks safely", () => {
    assert.equal(markdownLite("**a** *b*\nc"), "<p><strong>a</strong> <em>b</em><br>c</p>");
    assert.equal(markdownLite("[x](https://e.com)", { block: false }), '<a href="https://e.com">x</a>');
    assert.equal(markdownLite("[x](javascript:alert(1))", { block: false }).includes("javascript"), false);
    assert.equal(markdownLite("<b>hi</b>"), "<p>&lt;b&gt;hi&lt;/b&gt;</p>");
    assert.equal(markdownLite("a\n\nb"), "<p>a</p>\n<p>b</p>");
  });
});
