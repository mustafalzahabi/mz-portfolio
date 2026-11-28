import { test } from "node:test";
import assert from "node:assert/strict";
import { feedItems } from "../public/scripts/subscriptions.js";
import { rssFeed } from "../functions/_post-meta.js";

test("subscriptions: read back the site's own RSS feed", () => {
  const xml = rssFeed({ "a-b": { title: "A & <B>", description: "x", date: "2026-02-01", path: "s/a-b" } }, { origin: "https://e.com", user: "octo" });
  assert.deepEqual(feedItems(xml), [{ title: "A & <B>", link: "https://e.com/octo/blog/s/a-b", guid: "https://e.com/octo/blog/s/a-b" }]);
});
