// ============================================================================
// AI PROMPTS — pure functions (no DOM, no model), unit-tested
// The on-device model is small (1.2B), so everything here is about keeping its
// job easy: a short fact sheet for chat, and one-line, grammar-constrained
// changes for editing, each checked against the request before it's shown.
// ============================================================================

const clip = (s, n) => {
  s = String(s ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
};
const year = (d) => String(d || "").slice(0, 4);
const span = (a, b) => (year(a) ? `${year(a)}-${year(b) || "now"}` : "");

/** Every skill name: the keywords of each group, or the group's name when it has none. */
export function skillNames(resume) {
  const out = [];
  for (const g of resume?.skills || []) {
    const kws = (g.keywords || []).filter(Boolean);
    if (kws.length) out.push(...kws);
    else if (g.name) out.push(g.name);
  }
  return [...new Set(out.map((s) => String(s).trim()).filter(Boolean))];
}

/**
 * The portfolio as a short fact sheet. Kept under `max` characters: every
 * character is work the visitor's device does before the first answer.
 */
export function resumeFacts(resume, { max = 1400 } = {}) {
  // Every section gets in; details shrink until it fits (most → least detail)
  const levels = [
    { about: 220, hl: 2, hlLen: 110, jobs: 4, skills: 40, projects: 6, pLen: 70 },
    { about: 160, hl: 1, hlLen: 90, jobs: 4, skills: 30, projects: 5, pLen: 50 },
    { about: 110, hl: 1, hlLen: 70, jobs: 3, skills: 25, projects: 4, pLen: 0 },
    { about: 0, hl: 0, hlLen: 0, jobs: 3, skills: 20, projects: 3, pLen: 0 },
  ];
  let out = "";
  for (const lv of levels) {
    out = factLines(resume, lv).join("\n");
    if (out.length <= max) return out;
  }
  return out.slice(0, max);
}

function factLines(resume, lv) {
  const b = resume?.basics || {};
  const loc = [b.location?.city, b.location?.region, b.location?.countryCode].filter(Boolean).join(", ");
  const lines = [];
  if (b.label || loc) lines.push(`- ${[b.label, loc].filter(Boolean).join(", ")}`);
  if (b.summary && lv.about) lines.push(`- About: ${clip(b.summary, lv.about)}`);
  for (const w of (resume?.work || []).slice(0, lv.jobs)) {
    const hl = (w.highlights || []).slice(0, lv.hl).map((x) => clip(x, lv.hlLen)).join("; ");
    const detail = hl || (lv.hl && w.summary ? clip(w.summary, lv.hlLen) : "");
    lines.push(`- ${[w.position, w.name && `at ${w.name}`].filter(Boolean).join(" ")} (${span(w.startDate, w.endDate)})${detail ? `: ${detail}` : ""}`);
  }
  for (const e of (resume?.education || []).slice(0, 3)) {
    lines.push(`- Education: ${[e.studyType, e.area].filter(Boolean).join(" ")}${e.institution ? `, ${e.institution}` : ""}${year(e.endDate) ? ` (${year(e.endDate)})` : ""}`);
  }
  const skills = skillNames(resume);
  if (skills.length) lines.push(`- Skills: ${skills.slice(0, lv.skills).join(", ")}`);
  const projects = (resume?.projects || []).slice(0, lv.projects).map((p) => `${p.name}${p.description && lv.pLen ? ` (${clip(p.description, lv.pLen)})` : ""}`);
  if (projects.length) lines.push(`- Projects: ${projects.join("; ")}`);
  const langs = (resume?.languages || []).map((l) => [l.language, l.fluency && `(${l.fluency})`].filter(Boolean).join(" "));
  if (langs.length) lines.push(`- Languages: ${langs.join(", ")}`);
  const certs = (resume?.certificates || []).slice(0, 5).map((c) => c.name).filter(Boolean);
  if (certs.length) lines.push(`- Certificates: ${certs.join(", ")}`);
  if (b.email) lines.push(`- Contact: ${b.email}`);
  return lines;
}

const firstName = (resume) => String(resume?.basics?.name || "").trim().split(/\s+/)[0] || "them";

export const greeting = (resume) => `Hi! Ask me anything about ${firstName(resume)}'s work and skills.`;

export const chatSystem = (resume) =>
  `You are the chat assistant on ${resume?.basics?.name || "this person"}'s portfolio. Answer in 1-2 short sentences using only these facts; if they don't cover it, say the portfolio doesn't mention it.\n${resumeFacts(resume)}`;

// ---------------------------------------------------------------------------
// Editing: "set city = Paris", "add skill = Python", "remove skill = Git"
// ---------------------------------------------------------------------------

/** Field word -> [path, label]. work[0] = the most recent job. */
export const FIELDS = {
  name: [["basics", "name"], "Name"],
  title: [["basics", "label"], "Title"],
  bio: [["basics", "summary"], "Bio"],
  city: [["basics", "location", "city"], "City"],
  email: [["basics", "email"], "Email"],
  phone: [["basics", "phone"], "Phone"],
  website: [["basics", "url"], "Website"],
  employer: [["work", 0, "name"], "Current employer"],
  position: [["work", 0, "position"], "Current position"],
};

export const EDIT_SYSTEM = `You turn one request about the user's resume into one change line:
set <field> = <new text>   (fields: ${Object.keys(FIELDS).join(", ")})
add skill = <skill>
remove skill = <skill>`;

/** Worked examples, given as earlier turns: the strongest hint for a small model. */
export const EDIT_EXAMPLES = [
  ["I'm a Data Analyst now", "set title = Data Analyst"],
  ["drop Photoshop", "remove skill = Photoshop"],
  ["I also know Figma", "add skill = Figma"],
  ["I moved to Berlin", "set city = Berlin"],
  ["add Docker", "add skill = Docker"],
  ["my position is Team Lead", "set position = Team Lead"],
  ["I work at Acme Corp now", "set employer = Acme Corp"],
];

const gbnfStr = (s) => `"${String(s).replace(/[\\"]/g, (c) => "\\" + c).replace(/\n/g, " ")}"`;

/** llama.cpp grammar: only a well-formed line; a removal can only name an existing skill. */
export function changeGrammar(resume) {
  const skills = skillNames(resume);
  return [
    `root ::= "set " field " = " val | "add skill = " val${skills.length ? ` | "remove skill = " skill` : ""}`,
    `field ::= ${Object.keys(FIELDS).map(gbnfStr).join(" | ")}`,
    skills.length ? `skill ::= ${skills.map(gbnfStr).join(" | ")}` : "",
    `val ::= [^\\n]+`,
  ].filter(Boolean).join("\n");
}

/** "set city = Paris" -> { op: "set", field: "city", value: "Paris" } */
export function parseChange(line) {
  const m = /^(set|add|remove) (\w+) = (.+)$/.exec(String(line || "").trim());
  if (!m) return null;
  const [, op, word, raw] = m;
  const value = raw.trim().replace(/^["'](.*)["']$/, "$1").trim();
  if (op === "set" ? !FIELDS[word] : word !== "skill") return null;
  return { op, field: op === "set" ? word : "skill", value };
}

/** "add skill = Docker and Kubernetes" -> two changes. */
export function expandChange(c) {
  if (!c || c.op === "set") return [c];
  return c.value.split(/\s*(?:,|\band\b|&)\s*/i).filter(Boolean).map((value) => ({ ...c, value }));
}

const VERBS = "add|remove|delete|drop|change|set|rename|move|update|make|replace|put|include|i|i'm|my";
const JOINER = new RegExp(`(?:\\s*(?:,|\\band\\b|\\bthen\\b|\\balso\\b))+\\s*(?=(?:${VERBS})\\b)`, "i");

/** "Remove n8n and move me to KL. I work at X" -> one request per change; keeps "React and Next.js" together. */
export function splitRequest(text) {
  return String(text || "")
    .split(/(?<=[.;!?])\s+|;\s*/)
    .flatMap((s) => s.split(JOINER))
    .map((s) => s.trim().replace(/[.;!?]+$/, ""))
    .filter(Boolean);
}

const getAt = (obj, path) => path.reduce((o, k) => o?.[k], obj);
const same = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
const words = (t) => (String(t).toLowerCase().match(/[\p{L}\p{N}+#.@-]+/gu) || []).map((w) => w.replace(/\.+$/, "")).filter(Boolean);

/** Why a change can't be right ("" when it's fine). Small models guess; this catches the guesses. */
export function checkChange(c, resume, request = "") {
  if (!c || !c.value) return "not understood";
  // grounding: the new text must come from the request itself
  const asked = words(request);
  if (request && !words(c.value).every((w) => asked.includes(w))) return c.op === "set" ? "not what you asked" : "not in your skills";
  if (c.op === "set") {
    if (c.field === "employer" || c.field === "position") if (!resume?.work?.length) return "there's no job to change";
    return same(getAt(resume, FIELDS[c.field][0]), c.value) ? "already set" : "";
  }
  const has = skillNames(resume).some((s) => same(s, c.value));
  if (c.op === "add" && has) return "already there";
  if (c.op === "remove" && !has) return `"${c.value}" isn't in your skills`;
  return "";
}

/** Before/after for the change card. */
export function describeChange(c, resume) {
  if (c.op === "set") return { label: FIELDS[c.field][1], before: String(getAt(resume, FIELDS[c.field][0]) ?? ""), after: c.value };
  return { label: "Skills", before: c.op === "remove" ? c.value : "", after: c.op === "add" ? c.value : "" };
}

/** Applies one change to a JSON Resume (mutates it). `request` picks the skill group when it names one. */
export function applyChange(resume, c, request = "") {
  if (c.op === "set") {
    const path = FIELDS[c.field][0];
    let o = resume;
    for (let i = 0; i < path.length - 1; i++) o = o[path[i]] ??= typeof path[i + 1] === "number" ? [] : {};
    o[path.at(-1)] = c.value;
    return;
  }
  resume.skills ??= [];
  if (c.op === "remove") {
    resume.skills = resume.skills
      .map((g) => ({ ...g, keywords: (g.keywords || []).filter((k) => !same(k, c.value)) }))
      .filter((g) => !(same(g.name, c.value) && !g.keywords.length));
    for (const g of resume.skills) if (!g.keywords.length) delete g.keywords;
    return;
  }
  const asked = words(request);
  const named = resume.skills.find((g) => g.name && words(g.name).every((w) => asked.includes(w)) && g.keywords);
  const target = named || resume.skills.find((g) => g.keywords?.length);
  if (target) target.keywords.push(c.value);
  else resume.skills.push({ name: c.value });
}
