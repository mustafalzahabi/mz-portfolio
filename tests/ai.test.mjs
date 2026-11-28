import { test } from "node:test";
import assert from "node:assert/strict";
import {
  skillNames, resumeFacts, changeGrammar, parseChange, expandChange, splitRequest, checkChange, applyChange, describeChange,
} from "../public/scripts/ai/prompts.js";

const resume = () => ({
  basics: { name: "Sam Lee", label: "Developer", summary: "Builds things.", location: { city: "Ampang", countryCode: "MY" } },
  work: [{ name: "Acme", position: "Engineer", startDate: "2024-01", highlights: ["Built chatbots"] }],
  skills: [{ name: "Frontend", keywords: ["React", "CSS"] }, { name: "Backend", keywords: ["Node.js"] }, { name: "Leadership" }],
  projects: [{ name: "Resume Engine", description: "Renders a JSON resume" }],
});

test("skillNames flattens keywords and keyword-less groups", () => {
  assert.deepEqual(skillNames(resume()), ["React", "CSS", "Node.js", "Leadership"]);
});

test("resumeFacts stays within its budget and keeps the essentials", () => {
  const f = resumeFacts(resume());
  assert.match(f, /Developer, Ampang, MY/);
  assert.match(f, /Engineer at Acme \(2024-now\): Built chatbots/);
  assert.match(f, /Skills: React, CSS, Node\.js, Leadership/);
  const big = resume();
  big.work = Array.from({ length: 10 }, (_, i) => ({ name: `Co${i}`, position: "Dev", highlights: ["x".repeat(200)] }));
  assert.ok(resumeFacts(big, { max: 500 }).length <= 500);
});

test("resumeFacts shrinks details before dropping sections", () => {
  const r = resume();
  r.work = Array.from({ length: 4 }, (_, i) => ({ name: `Co${i}`, position: "Dev", highlights: ["y".repeat(300), "z".repeat(300)] }));
  r.education = [{ studyType: "BSc", area: "Computer Science", institution: "UoPeople" }];
  const f = resumeFacts(r, { max: 900 });
  assert.ok(f.length <= 900);
  assert.match(f, /Education: BSc Computer Science, UoPeople/);
  assert.match(f, /Skills: /);
});

test("parseChange reads the three shapes and rejects the rest", () => {
  assert.deepEqual(parseChange("set city = Kuala Lumpur"), { op: "set", field: "city", value: "Kuala Lumpur" });
  assert.deepEqual(parseChange("add skill = Python"), { op: "add", field: "skill", value: "Python" });
  assert.deepEqual(parseChange('set position = "Lead"'), { op: "set", field: "position", value: "Lead" });
  assert.equal(parseChange("set shoe = 9"), null);
  assert.equal(parseChange("hello"), null);
});

test("expandChange splits several skills into separate changes", () => {
  assert.deepEqual(expandChange({ op: "add", field: "skill", value: "Docker and Kubernetes" }).map((c) => c.value), ["Docker", "Kubernetes"]);
  assert.equal(expandChange({ op: "set", field: "title", value: "A and B" }).length, 1);
});

test("splitRequest: one request per change, lists kept together", () => {
  assert.deepEqual(splitRequest("Remove Java. I now work at Google"), ["Remove Java", "I now work at Google"]);
  assert.deepEqual(splitRequest("Change my title to X, add Python and then remove Git"), ["Change my title to X", "add Python", "remove Git"]);
  assert.deepEqual(splitRequest("add React and Next.js to skills"), ["add React and Next.js to skills"]);
});

test("checkChange catches the model's guesses", () => {
  const r = resume();
  assert.equal(checkChange({ op: "set", field: "city", value: "Kuala Lumpur" }, r, "move me to Kuala Lumpur."), "");
  assert.equal(checkChange({ op: "set", field: "position", value: "Lead Designer" }, r, "Remove Java"), "not what you asked");
  assert.equal(checkChange({ op: "remove", field: "skill", value: "CSS" }, r, "Remove Java"), "not in your skills");
  assert.equal(checkChange({ op: "add", field: "skill", value: "react" }, r, "add react"), "already there");
  assert.equal(checkChange({ op: "set", field: "title", value: "Developer" }, r, "my title is developer"), "already set");
  assert.equal(checkChange({ op: "add", field: "skill", value: "C#" }, r, "add C#"), "");
});

test("applyChange edits a JSON Resume in place", () => {
  const r = resume();
  applyChange(r, { op: "set", field: "city", value: "Paris" });
  applyChange(r, { op: "add", field: "skill", value: "Go" }, "add Go to backend");
  applyChange(r, { op: "add", field: "skill", value: "Vue" }, "add Vue");
  applyChange(r, { op: "remove", field: "skill", value: "CSS" });
  applyChange(r, { op: "remove", field: "skill", value: "Leadership" });
  assert.equal(r.basics.location.city, "Paris");
  assert.deepEqual(r.skills, [{ name: "Frontend", keywords: ["React", "Vue"] }, { name: "Backend", keywords: ["Node.js", "Go"] }]);
  const empty = {};
  applyChange(empty, { op: "set", field: "position", value: "CTO" });
  assert.equal(empty.work[0].position, "CTO");
});

test("describeChange gives before and after", () => {
  assert.deepEqual(describeChange({ op: "set", field: "title", value: "Lead" }, resume()), { label: "Title", before: "Developer", after: "Lead" });
});

test("changeGrammar only lets removals name existing skills", () => {
  const g = changeGrammar(resume());
  assert.match(g, /skill ::= "React" \| "CSS" \| "Node\.js" \| "Leadership"/);
  assert.doesNotMatch(changeGrammar({}), /remove skill/);
});
