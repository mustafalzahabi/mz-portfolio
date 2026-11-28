import { test } from "node:test";
import assert from "node:assert/strict";
import { matchPostPath, buildIndex, absoluteImage, CRAWLER_RE } from "../functions/_post-meta.js";

test("post meta: only /<user>/blog/<slug> paths match", () => {
  assert.deepEqual(matchPostPath("/octo-cat/blog/Hello-World"), { user: "octo-cat", slug: "hello-world" });
  assert.equal(matchPostPath("/octocat/blog"), null);
  assert.equal(matchPostPath("/octocat/project/x"), null);
  assert.equal(matchPostPath("/preview/view/blog/x/y"), null);
});

test("post meta: index by slug, skipping drafts, only https images", async () => {
  const gists = [
    { description: "", created_at: "2026-01-01", files: { "a.md": { filename: "a.md", raw_url: "A" } } },
    { description: "", created_at: "2026-01-01", files: { "b.md": { filename: "b.md", raw_url: "B" } } },
    { description: "resume", files: { "resume.json": { filename: "resume.json", raw_url: "R" } } },
  ];
  const texts = {
    A: "---\ntitle: Hello — World\ndescription: Hi there\n---\n\n![x](https://e.com/p.png)\n",
    B: "---\ntitle: Secret\npublished: false\n---\nbody",
  };
  const index = await buildIndex(gists, async (u) => texts[u] || "");
  assert.deepEqual(Object.keys(index), ["hello-world"]);
  assert.deepEqual(index["hello-world"], { title: "Hello — World", description: "Hi there", image: "https://e.com/p.png", date: "2026-01-01" });
  assert.equal(absoluteImage({ image: "images/x.png" }, ""), "");
});

test("post meta: crawler user agents", () => {
  assert.ok(CRAWLER_RE.test("LinkedInBot/1.0 (compatible; Mozilla/5.0)"));
  assert.ok(CRAWLER_RE.test("Slackbot-LinkExpanding 1.0"));
  assert.ok(CRAWLER_RE.test("facebookexternalhit/1.1"));
  assert.ok(!CRAWLER_RE.test("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"));
});

test("post meta: RSS feed escapes text and orders newest first", async () => {
  const { rssFeed } = await import("../functions/_post-meta.js");
  const xml = rssFeed(
    { old: { title: "Old", description: "", date: "2026-01-01" }, "a-b": { title: "A & <B>", description: "x", date: "2026-02-01" } },
    { origin: "https://e.com", user: "octo" },
  );
  assert.ok(xml.includes("<title>A &amp; &lt;B&gt;</title>"));
  assert.ok(xml.indexOf("a-b") < xml.indexOf("/old"));
  assert.ok(xml.includes("<link>https://e.com/octo/blog/a-b</link>"));
});
