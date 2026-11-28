// AI lab: an on-device model (LFM2.5-1.2B via wllama / llama.cpp in WebAssembly)
// for visitor chat and for editing the portfolio. Every visitor runs it on their
// own device: no account, no key, no shared limit.
import { Wllama } from "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.13.0/esm/index.js";

const MODEL = { repo: "LiquidAI/LFM2.5-1.2B-Instruct-GGUF", file: new URLSearchParams(location.search).get("file") || "LFM2.5-1.2B-Instruct-Q4_K_M.gguf" };
const WASM = { default: "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.13.0/esm/wasm/wllama.wasm" };

let resume = {
  basics: { name: "Mustafa Alzahabi", label: "Software Developer and AI Automation Engineer", summary: "Builds AI automation and web apps.", location: { city: "Ampang" } },
  skills: ["JavaScript", "TypeScript", "React", "Next.js", "Node.js", "n8n", "AI agents", "LLM integration", "Git"],
  work: [{ name: "ArchitWeb", position: "Developer", startDate: "2026", highlights: ["Built AI chatbots for two clients with n8n agents linked to their order systems", "Built React/Next.js interfaces and reusable components"] }],
  projects: [{ name: "Dynamic Resume Engine", description: "A portfolio rendered from a JSON resume" }, { name: "Offline-First Helpdesk PWA", description: "Built with Next.js" }],
  education: [{ studyType: "BSc", area: "Computer Science", institution: "University of the People" }],
};

// ---------- prompts ----------
const facts = (r) => [
  `- ${r.basics.label}, ${r.basics.location.city}, Malaysia`,
  ...r.work.map((w) => `- ${w.name} (${w.startDate}-now, ${w.position}): ${w.highlights.join("; ")}`),
  `- Skills: ${r.skills.join(", ")}`,
  `- Projects: ${r.projects.map((p) => `${p.name} (${p.description})`).join("; ")}`,
  ...r.education.map((e) => `- ${e.studyType} ${e.area}, ${e.institution}`),
].join("\n");
const chatSystem = (r) => `You are the chat assistant on ${r.basics.name}'s portfolio. Answer in 1-2 short sentences using only these facts; if they don't cover it, say the portfolio doesn't mention it.\n${facts(r)}`;
const GREETING = "Hi! Ask me anything about Mustafa's work and skills.";

const FIELDS = {
  "basics.name": "full name",
  "basics.label": "job title",
  "basics.summary": "short bio",
  "basics.location.city": "city they live in",
  "work[0].position": "position at current job",
  "work[0].name": "current employer",
  skills: "skills list",
};
// The model answers in plain words ("set city = Paris"); small models pick the
// right field far more reliably than with JSON paths. Word -> resume path:
const WORDS = { name: "basics.name", title: "basics.label", bio: "basics.summary", city: "basics.location.city", position: "work[0].position", employer: "work[0].name" };
const EDIT_SYSTEM = `You turn one request about the user's resume into one change line:
set <field> = <new text>   (fields: name, title, bio, city, position, employer)
add skill = <skill>
remove skill = <skill>`;
// Worked examples as earlier turns: the strongest hint for a small model.
const EDIT_EXAMPLES = [
  ["I'm a Data Analyst now", "set title = Data Analyst"],
  ["drop Photoshop", "remove skill = Photoshop"],
  ["I also know Figma", "add skill = Figma"],
  ["I moved to Berlin", "set city = Berlin"],
  ["add Docker", "add skill = Docker"],
  ["my position is Team Lead", "set position = Team Lead"],
  ["I work at Acme Corp now", "set employer = Acme Corp"],
];
const gbnfStr = (s) => `"${s.replace(/[\\"]/g, (c) => "\\" + c)}"`;
// llama.cpp grammar: only a well-formed line; a removal can only name a skill that exists.
const changeGrammar = (r) => `root ::= "set " field " = " val | "add skill = " val | "remove skill = " skill
field ::= ${Object.keys(WORDS).map(gbnfStr).join(" | ")}
skill ::= ${r.skills.map(gbnfStr).join(" | ")}
val ::= [^\\n]+`;
function parseChange(line) {
  const m = /^(set|add|remove) (\w+) = (.+)$/.exec(line.trim());
  if (!m) return null;
  const [, op, word, value] = m;
  return { op, path: op === "set" ? WORDS[word] : "skills", value: value.trim() };
}

// ---------- model ----------
const turn = (role, content) => `<|im_start|>${role}\n${content}<|im_end|>\n`;
let wllama = null;
let busy = Promise.resolve();
const queue = (fn) => (busy = busy.then(fn, fn));

async function complete(prompt, maxTokens, extra = {}, onText) {
  const started = performance.now();
  let first = 0, text = "";
  const stream = await wllama.createCompletion({ prompt, stream: true, max_tokens: maxTokens, temperature: 0.2, top_k: 40, top_p: 0.9, cache_prompt: true, stop: ["<|im_end|>"], ...extra });
  for await (const c of stream) {
    const d = c.choices?.[0]?.text || "";
    if (!d) continue;
    if (!first) first = performance.now() - started;
    text += d;
    onText?.(text);
  }
  return { text: text.trim(), first: Math.round(first), total: Math.round(performance.now() - started) };
}

// The prefix every request starts with; processing it ahead of time (while the
// visitor reads or types) means a question only costs its own few tokens.
let chatLog = "";
const chatPrefix = () => `<|startoftext|>${turn("system", chatSystem(resume))}${turn("assistant", GREETING)}`;
const editPrefix = () => `<|startoftext|>${turn("system", EDIT_SYSTEM)}${EDIT_EXAMPLES.map(([q, a]) => turn("user", q) + turn("assistant", a)).join("")}`;
const warm = (prefix) => queue(async () => { const t = performance.now(); await complete(prefix, 0); lab.warmMs = Math.round(performance.now() - t); });

// ---------- chat ----------
function ask(question, onText) {
  return queue(async () => {
    if (!chatLog) chatLog = chatPrefix();
    const prompt = chatLog + turn("user", question) + "<|im_start|>assistant\n";
    const r = await complete(prompt, 120, {}, onText);
    chatLog = prompt + r.text + "<|im_end|>\n";
    return r;
  });
}

// ---------- edit ----------
const VERBS = "add|remove|delete|drop|change|set|rename|move|update|make|replace|put|include|i|i'm|my";
/** "Remove n8n and move me to KL. I work at X" -> one request per change; keeps "React and Next.js" together. */
export function splitRequest(text) {
  const joiner = new RegExp(`(?:\\s*(?:,|\\band\\b|\\bthen\\b|\\balso\\b))+\\s*(?=(?:${VERBS})\\b)`, "i");
  return text
    .split(/(?<=[.;!?])\s+|;\s*/) // sentences ("Next.js" has no space after the dot)
    .flatMap((s) => s.split(joiner))
    .map((s) => s.trim().replace(/[.;!?]+$/, ""))
    .filter(Boolean);
}

const getPath = (obj, path) => path.replace(/\[(\d+)\]/g, ".$1").split(".").reduce((o, k) => o?.[k], obj);
function setPath(obj, path, value) {
  const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), obj)[last] = value;
}
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** Throws away changes that can't be right; returns a reason when rejected. */
export function checkChange(c, r, request = "") {
  if (!c || !FIELDS[c.path] || !c.value?.trim()) return "not understood";
  // grounding: the new text must come from the request itself
  const words = (t) => (t.toLowerCase().match(/[a-z0-9+#.]+/g) || []).map((w) => w.replace(/\.+$/, "")).filter(Boolean);
  const asked = words(request);
  if (request && !words(c.value).every((w) => asked.includes(w))) return c.op === "set" ? "not what you asked" : "not in your skills";
  const list = c.path === "skills";
  if (list && c.op === "set") return "not understood";
  if (!list && c.op !== "set") return "not understood";
  const cur = getPath(r, c.path);
  if (c.op === "set" && same(cur, c.value)) return "already set";
  if (c.op === "add" && cur.some((s) => same(s, c.value))) return "already there";
  if (c.op === "remove" && !cur.some((s) => same(s, c.value))) return `"${c.value}" isn't in the list`;
  return "";
}

function proposeEdits(request) {
  return queue(async () => {
    const out = [];
    for (const part of splitRequest(request)) {
      const prompt = `${editPrefix()}${turn("user", part)}<|im_start|>assistant\n`;
      const r = await complete(prompt, 40, { grammar: changeGrammar(resume) });
      const change = parseChange(r.text);
      // "add skill = React and Next.js" -> one card per skill
      const changes = change && change.op !== "set" ? change.value.split(/\s*(?:,|\band\b|&)\s*/).filter(Boolean).map((value) => ({ ...change, value })) : [change];
      for (const c of changes) out.push({ request: part, change: c, problem: checkChange(c, resume, part), ms: r.total, raw: r.text });
    }
    return out;
  });
}

function applyChange(c) {
  if (c.op === "set") setPath(resume, c.path, c.value);
  else if (c.op === "add") resume.skills.push(c.value);
  else resume.skills = resume.skills.filter((s) => !same(s, c.value));
  chatLog = ""; // facts changed: the chat starts over with the new ones
  showResume();
}

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
let mode = "chat";

function bubble(cls, text) {
  const el = document.createElement("div");
  el.className = `msg ${cls}`;
  el.textContent = text;
  $("log").append(el);
  el.scrollIntoView({ block: "end" });
  return el;
}
function meta(el, text) {
  const m = document.createElement("span");
  m.className = "meta";
  m.textContent = text;
  el.append(m);
}
const showResume = () => ($("resume").textContent = JSON.stringify(resume, null, 2));

function changeCard(item) {
  const card = document.createElement("div");
  card.className = "card";
  const head = document.createElement("div");
  head.className = "field";
  head.textContent = `“${item.request}”`;
  card.append(head);
  const body = document.createElement("div");
  const c = item.change;
  if (item.problem) {
    body.textContent = `Skipped: ${item.problem}.`;
    card.classList.add("done");
    card.append(body);
    return card;
  }
  const field = c.path === "skills" ? "Skills" : FIELDS[c.path][0].toUpperCase() + FIELDS[c.path].slice(1);
  body.append(`${field}: `);
  if (c.op === "set") {
    const del = document.createElement("del"); del.textContent = getPath(resume, c.path);
    const ins = document.createElement("ins"); ins.textContent = c.value;
    body.append(del, " → ", ins);
  } else {
    const el = document.createElement(c.op === "add" ? "ins" : "del");
    el.textContent = `${c.op === "add" ? "+ " : "− "}${c.value}`;
    body.append(el);
  }
  const row = document.createElement("div");
  row.className = "row";
  const no = Object.assign(document.createElement("button"), { type: "button", className: "btn", textContent: "Reject" });
  const yes = Object.assign(document.createElement("button"), { type: "button", className: "btn primary", textContent: "Accept" });
  const settle = (label) => { row.replaceChildren(Object.assign(document.createElement("span"), { className: "muted", textContent: label })); card.classList.add("done"); };
  yes.addEventListener("click", () => { applyChange(c); settle("Applied"); });
  no.addEventListener("click", () => settle("Rejected"));
  row.append(no, yes);
  card.append(body, row);
  return card;
}

function setMode(next) {
  mode = next;
  for (const b of document.querySelectorAll("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
  $("log").replaceChildren();
  $("q").placeholder = mode === "chat" ? "Ask about Mustafa…" : "e.g. Add Python and change my title to Senior Engineer";
  $("data").hidden = mode !== "edit";
  if (mode === "chat") { bubble("bot", GREETING); chatLog = ""; }
  else bubble("bot", "Tell me what to change. I'll show each change for you to accept or reject.");
  if (wllama) warm(mode === "chat" ? chatPrefix() : editPrefix());
}

// Requests wait here until the model is loaded, so visitors can type at once.
let markReady;
busy = new Promise((r) => (markReady = r));
let loading = null;
let fromCache = false;

const status = (text, pct) => {
  $("status").textContent = text;
  $("bar").hidden = pct == null;
  if (pct != null) $("bar").value = pct;
};

function load() {
  if (loading) return loading;
  $("load").hidden = true;
  const t = performance.now();
  loading = (async () => {
    try {
      wllama = new Wllama(WASM);
      status("Starting the AI…", 0);
      await wllama.loadModelFromHF(MODEL, {
        n_ctx: 2048, n_gpu_layers: 0, n_threads: navigator.hardwareConcurrency || 4,
        ...JSON.parse(new URLSearchParams(location.search).get("opts") || "{}"),
        progressCallback: ({ loaded, total }) => status(fromCache ? "Loading the AI…" : `Downloading the AI… ${Math.round(loaded / 1e6)} / ${Math.round(total / 1e6)} MB (once; saved in this browser)`, Math.round((loaded / total) * 100)),
      });
    } catch (e) {
      status(`Couldn't start the AI: ${e?.message || e}`);
      $("load").hidden = false;
      loading = null;
      return;
    }
    lab.loadMs = Math.round(performance.now() - t);
    lab.threads = wllama.getNumThreads();
    status("Getting ready…");
    markReady();
    // Prepare both modes in the background; the engine keeps each in its own slot.
    const other = mode === "chat" ? editPrefix() : chatPrefix();
    await warm(mode === "chat" ? chatPrefix() : editPrefix());
    status("Ready. Runs on your device: nothing you type leaves it.");
    lab.warmed = true;
    await warm(other);
  })();
  return loading;
}

/** Start without asking when it costs nothing: already downloaded, or not on mobile data / Data Saver. */
async function autoStart() {
  const c = navigator.connection;
  let cached = false;
  try { cached = (await new Wllama(WASM).cacheManager.list()).some((e) => e.name.includes(MODEL.file)); } catch {}
  fromCache = cached;
  if (cached || !(c?.saveData || c?.type === "cellular")) return load();
  status("The AI is about 730 MB. Download it now, or tap Send and it starts then.");
  $("load").hidden = false;
}

async function onSubmit(e) {
  e.preventDefault();
  const text = $("q").value.trim();
  if (!text) return;
  $("q").value = "";
  bubble("user", text);
  const reply = bubble("bot", wllama && lab.loadMs ? "…" : "I'll answer as soon as I'm ready (see progress above).");
  load();
  try {
    if (mode === "chat") {
      const r = await ask(text, (t) => (reply.textContent = t));
      reply.textContent = r.text;
      meta(reply, `${(r.first / 1000).toFixed(1)}s to start · ${(r.total / 1000).toFixed(1)}s total`);
      lab.last = r;
    } else {
      const t = performance.now();
      const items = await proposeEdits(text);
      reply.replaceChildren(...items.map(changeCard));
      meta(reply, `${((performance.now() - t) / 1000).toFixed(1)}s`);
      lab.last = items;
    }
  } catch (err) {
    reply.textContent = `Something went wrong: ${err?.message || err}`;
  }
  if (mode === "chat") warm(chatLog); // keep the cache on the conversation so far
}

// Test hook (used over remote debugging; no UI)
const lab = (window.lab = { ask, proposeEdits, splitRequest, checkChange, get resume() { return resume; }, ready: () => busy });

for (const b of document.querySelectorAll("[data-mode]")) b.addEventListener("click", () => setMode(b.dataset.mode));
$("load").addEventListener("click", load);
$("ask").addEventListener("submit", onSubmit);
lab.load = load;
lab.setMode = setMode;
showResume();
setMode("chat");
if (!new URLSearchParams(location.search).has("manual")) autoStart();
