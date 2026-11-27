// One portfolio from a linked GitHub + Google account: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";

import { combineResumes, combinePosts, newestStore, publicSources, isBlank } from "../public/scripts/combine.js";
import { normalizeConfig } from "../public/scripts/config.js";

const gh = (resume, updatedAt = "2026-01-01T00:00:00Z") => ({ store: "github", resume, updatedAt });
const gd = (resume, updatedAt = "2026-02-01T00:00:00Z") => ({ store: "google", resume, updatedAt });

test("a section only one store has is used as is", () => {
  const { resume, origins } = combineResumes([gh({ work: [{ name: "A" }] }), gd({ education: [{ institution: "U" }] })]);
  assert.deepEqual(resume.work, [{ name: "A" }]);
  assert.deepEqual(resume.education, [{ institution: "U" }]);
  assert.equal(origins.work, "github");
  assert.equal(origins.education, "google");
});

test("when both have a section, the newer store wins", () => {
  const { resume, origins } = combineResumes([gh({ skills: [{ name: "old" }] }), gd({ skills: [{ name: "new" }] })]);
  assert.equal(resume.skills[0].name, "new");
  assert.equal(origins.skills, "google");
  const flipped = combineResumes([gh({ skills: [{ name: "gh" }] }, "2026-03-01T00:00:00Z"), gd({ skills: [{ name: "gd" }] })]);
  assert.equal(flipped.resume.skills[0].name, "gh");
});

test("a chosen store wins over the newer one, unless it has nothing there", () => {
  const parts = [gh({ work: [{ name: "gh" }], awards: [] }), gd({ work: [{ name: "gd" }], awards: [{ title: "x" }] })];
  const { resume } = combineResumes(parts, { resume: { work: "github", awards: "github" } });
  assert.equal(resume.work[0].name, "gh");
  assert.equal(resume.awards[0].title, "x"); // GitHub's is empty → the other one
});

test("basics are combined field by field; blank values never win", () => {
  const { resume, origins } = combineResumes([
    gh({ basics: { name: "Mustafa", email: "a@x.io", label: "Dev" } }),
    gd({ basics: { name: "", label: "Engineer", phone: "1" } }),
  ]);
  assert.deepEqual(resume.basics, { name: "Mustafa", email: "a@x.io", label: "Engineer", phone: "1" });
  assert.equal(origins["basics.name"], "github");
  assert.equal(origins["basics.label"], "google");
});

test("site config is combined key by key, plain meta too", () => {
  const { resume } = combineResumes([
    gh({ meta: { theme: "even", "mz-portfolio-config": [{ colors: { accent: "#111111" }, blog: { enabled: false } }] } }),
    gd({ meta: { "mz-portfolio-config": { colors: { accent: "#222222" } } } }),
  ]);
  assert.equal(resume.meta.theme, "even");
  assert.deepEqual(resume.meta["mz-portfolio-config"], { colors: { accent: "#222222" }, blog: { enabled: false } });
});

test("one store alone comes back unchanged", () => {
  const only = { basics: { name: "N" }, work: [] };
  assert.deepEqual(combineResumes([gh(only), { store: "google", resume: null }]).resume, only);
  assert.equal(combineResumes([]).resume, null);
});

test("posts: union, same slug keeps the newer copy, filtered by store", () => {
  const lists = [
    { store: "github", posts: [{ slug: "a", date: "2026-01-01", updatedAt: "2026-01-01" }, { slug: "b", date: "2026-03-01", updatedAt: "2026-01-02" }] },
    { store: "google", posts: [{ slug: "b", date: "2026-03-01", updatedAt: "2026-04-01", title: "newer" }, { slug: "c", date: "2026-02-01" }] },
  ];
  const all = combinePosts(lists);
  assert.deepEqual(all.map((p) => p.slug), ["b", "c", "a"]);
  assert.equal(all[0].title, "newer");
  assert.equal(all[0].store, "google");
  assert.deepEqual(combinePosts(lists, { posts: "github" }).map((p) => p.slug), ["b", "a"]);
});

test("newestStore and isBlank", () => {
  assert.equal(newestStore([gh({ a: 1 }), gd({ a: 1 })]), "google");
  assert.equal(isBlank({ a: "", b: [] }), true);
  assert.equal(isBlank([0]), false);
});

test("public sources: only addresses and source choices, validated; not a config warning", () => {
  const resume = { meta: { "mz-portfolio-config": { sources: { github: "octocat", drive: "1AbCdEfGhIjKlMnOp", resume: { work: "github" }, posts: "google" } } } };
  assert.deepEqual(publicSources(resume), { github: "octocat", drive: "1AbCdEfGhIjKlMnOp", resume: { work: "github" }, posts: "google" });
  assert.equal(publicSources({ meta: { "mz-portfolio-config": { sources: { github: "bad name!" } } } }), null);
  assert.deepEqual(normalizeConfig(resume.meta).warnings, []);
});
