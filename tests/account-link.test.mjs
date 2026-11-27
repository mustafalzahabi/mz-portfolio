// The link between a GitHub and a Google sign-in: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeRecord, normalizePrefs, mergeRecords, makeLinkedRecord, isLinked, recordMatches, publicSourcesOf, DEFAULT_PREFS } from "../public/scripts/account-link.js";

const linked = makeLinkedRecord({ github: { login: "Octo", id: 1 }, google: { email: "Me@X.io", folderId: "1AbCdEfGhIjKlMnOp" }, now: "2026-05-01T00:00:00Z" });

test("a linked record round-trips through JSON and normalizes emails", () => {
  const back = normalizeRecord(JSON.parse(JSON.stringify(linked)));
  assert.deepEqual(back, linked);
  assert.equal(back.google.email, "me@x.io");
  assert.ok(isLinked(back));
  assert.deepEqual(back.prefs, normalizePrefs(DEFAULT_PREFS));
});

test("junk is not a record; bad prefs fall back to defaults", () => {
  assert.equal(normalizeRecord(null), null);
  assert.equal(normalizeRecord({ v: 2, github: { login: "a" } }), null);
  assert.equal(normalizeRecord({ v: 1 }), null);
  const p = normalizePrefs({ publishTo: "dropbox", sources: { resume: { work: "github", "bad key!": "google", skills: "nope" }, posts: "x" } });
  assert.equal(p.publishTo, "both");
  assert.deepEqual(p.sources, { resume: { work: "github" }, posts: "both" });
});

test("either identity matches the record, case-insensitively", () => {
  assert.ok(recordMatches(linked, { githubLogin: "octo" }));
  assert.ok(recordMatches(linked, { googleEmail: "ME@x.io" }));
  assert.ok(!recordMatches(linked, { githubLogin: "someone" }));
  assert.ok(!recordMatches(null, { githubLogin: "octo" }));
});

test("two copies merge: identities combined, prefs from the newer copy", () => {
  const older = { ...linked, google: { email: "me@x.io", folderId: "" }, prefs: { ...linked.prefs, publishTo: "github" }, updatedAt: "2026-01-01T00:00:00Z" };
  const newer = { ...linked, github: null, prefs: { ...linked.prefs, publishTo: "google" }, updatedAt: "2026-06-01T00:00:00Z" };
  const m = mergeRecords(older, newer);
  assert.equal(m.github.login, "Octo");
  assert.equal(m.google.folderId, "1AbCdEfGhIjKlMnOp");
  assert.equal(m.prefs.publishTo, "google");
});

test("relinking keeps the original link date and prefs", () => {
  const again = makeLinkedRecord({ github: { login: "Octo" }, google: { email: "me@x.io" }, previous: { ...linked, prefs: { ...linked.prefs, primary: "google" } }, now: "2026-07-01T00:00:00Z" });
  assert.equal(again.linkedAt, "2026-05-01T00:00:00Z");
  assert.equal(again.prefs.primary, "google");
});

test("visitors only get addresses and source choices, never the email", () => {
  const pub = publicSourcesOf(linked);
  assert.deepEqual(pub, { github: "Octo", drive: "1AbCdEfGhIjKlMnOp", resume: {}, posts: "both" });
  assert.ok(!JSON.stringify(pub).includes("@"));
  assert.equal(publicSourcesOf({ ...linked, google: null }), null);
});
