// ============================================================================
// AI CHAT — the panel for visitors ("Ask about …") and for the owner in edit
// mode ("Edit with AI"). The model runs in the browser (see engine.js); this
// file is only UI and conversation state.
// ============================================================================

import { h, svgIcon } from "../utils.js";
import { ICONS } from "../icons.js";
import * as ai from "./engine.js";
import {
  greeting, chatSystem, EDIT_SYSTEM, EDIT_EXAMPLES, changeGrammar, parseChange, expandChange, splitRequest, checkChange, describeChange,
} from "./prompts.js";

let panel = null; // { el, mode, log, input, status, ... }
let fab = null;
let chatLog = ""; // the conversation so far, as the model sees it
let chatFacts = "";

const chatPrefix = (resume) => ai.START + ai.turn("system", chatSystem(resume)) + ai.turn("assistant", greeting(resume));
const editPrefix = () => ai.START + ai.turn("system", EDIT_SYSTEM) + EDIT_EXAMPLES.map(([q, a]) => ai.turn("user", q) + ai.turn("assistant", a)).join("");

// ---------------------------------------------------------------------------
// Visitor button
// ---------------------------------------------------------------------------

/** Shows the "Ask AI" button for this portfolio (null hides it). */
export function setChatSource(getResume) {
  if (!getResume) {
    fab?.remove();
    fab = null;
    if (panel?.mode === "chat") closePanel();
    return;
  }
  const name = String(getResume()?.basics?.name || "").split(/\s+/)[0];
  const label = name ? `Ask about ${name}` : "Ask AI";
  if (!fab) {
    fab = h("button.ai-fab", { type: "button" }, svgIcon(ICONS.sparkles), h("span.ai-fab-label"));
    document.body.append(fab);
  }
  fab.onclick = () => openAiPanel({ mode: "chat", getResume });
  fab.querySelector(".ai-fab-label").textContent = label;
  fab.setAttribute("aria-label", label);
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

/**
 * @param {{ mode: "chat" | "edit", getResume: () => object, onApply?: (change, request) => void }} o
 * onApply (edit mode) applies one accepted change to the resume being edited.
 */
export function openAiPanel(o) {
  if (panel && panel.mode === o.mode) {
    Object.assign(panel, o);
    panel.input.focus();
    return;
  }
  closePanel();
  const title = o.mode === "chat" ? (fab?.getAttribute("aria-label") || "Ask AI") : "Edit with AI";
  const log = h("div.ai-log", { "aria-live": "polite" });
  const statusText = h("span.ai-status-text");
  const bar = h("progress.ai-progress", { max: 100, value: 0, hidden: true });
  const startBtn = h("button.btn.btn-primary.ai-start", { type: "button", hidden: true, onclick: () => ai.load().catch(() => {}) }, `Start the AI (${ai.MODEL_MB} MB, once)`);
  const status = h("div.ai-status", statusText, bar, startBtn);
  const input = h("input.ai-input", {
    type: "text", autocomplete: "off", enterkeyhint: "send", "aria-label": "Message",
    placeholder: o.mode === "chat" ? "Ask a question…" : "e.g. Add Python and change my title to Senior Engineer",
  });
  const form = h("form.ai-form", { onsubmit: (e) => { e.preventDefault(); submit(); } },
    input, h("button.btn.btn-primary.ai-send", { type: "submit", "aria-label": "Send" }, svgIcon(ICONS.send)));
  const el = h("section.ai-panel", { role: "dialog", "aria-label": title, dataset: { mode: o.mode } },
    h("header.ai-head",
      h("span.ai-title", svgIcon(ICONS.sparkles), title),
      h("button.ed-icon-btn.ai-close", { type: "button", "aria-label": "Close", onclick: closePanel }, svgIcon(ICONS.close))),
    status, log, form,
    h("p.ai-foot", "Runs on your device: nothing you type leaves it. It can be wrong."));
  el.addEventListener("keydown", (e) => e.key === "Escape" && closePanel());
  document.body.append(el);
  panel = { ...o, el, log, input, statusText, bar, startBtn };
  panel.unsub = ai.onStatus(renderStatus);

  if (o.mode === "chat") bubble("bot", greeting(o.getResume()));
  else bubble("bot", "Tell me what to change. Each change shows up here for you to accept or reject; nothing changes until you accept.");
  input.focus();
  start();
}

export function closePanel() {
  if (!panel) return;
  panel.unsub?.();
  panel.el.remove();
  panel = null;
}

async function start() {
  const s = ai.getStatus().state;
  if (s === "ready") return prepare();
  if (s === "loading") return;
  // Opening the panel is the visitor asking for the AI: load at once when it's
  // already downloaded or the connection is free; on mobile data, ask first.
  const c = navigator.connection;
  if ((await ai.isCached()) || !(c?.saveData || c?.type === "cellular")) ai.load().then(prepare, () => {});
  else renderStatus(ai.getStatus());
}

/** Processes this mode's prompt in the background while the visitor types. */
// Once a question is on its way, preparing again would be harmful, not just
// wasted: the model's cache can't keep a shorter prefix of what it holds, so a
// late "prepare" would make it re-read the whole conversation.
let asked = { chat: false, edit: false };
function prepare() {
  if (!panel) return;
  renderStatus(ai.getStatus());
  if (asked[panel.mode]) return;
  if (panel.mode === "chat") {
    const facts = chatSystem(panel.getResume());
    if (facts !== chatFacts) { chatFacts = facts; chatLog = chatPrefix(panel.getResume()); }
    ai.warm(chatLog).catch(() => {});
  } else ai.warm(editPrefix()).catch(() => {});
}

function renderStatus(s) {
  if (!panel) return;
  const { statusText, bar, startBtn } = panel;
  bar.hidden = s.state !== "loading";
  startBtn.hidden = !(s.state === "idle" || s.state === "error");
  panel.el.classList.toggle("is-ready", s.state === "ready");
  if (s.state === "loading") {
    bar.value = Math.round((s.progress || 0) * 100);
    statusText.textContent = s.cached || !s.totalMB ? "Starting the AI…" : `Downloading the AI… ${s.loadedMB} / ${s.totalMB} MB · saved in this browser for next time`;
  } else if (s.state === "error") statusText.textContent = `Couldn't start the AI: ${s.message}`;
  else if (s.state === "idle") {
    statusText.textContent = `The AI runs on your device. It's a one-time ${ai.MODEL_MB} MB download${ai.isFast() ? "" : "; in this browser it's slow (Chrome or Edge are much faster)"}.`;
  } else statusText.textContent = ai.isFast() ? "" : "Running in slow mode in this browser; Chrome or Edge are much faster.";
}

function bubble(cls, text) {
  const el = h(`div.ai-msg.ai-${cls}`, text);
  panel.log.append(el);
  el.scrollIntoView({ block: "nearest" });
  return el;
}

async function submit() {
  const p = panel;
  const text = p.input.value.trim();
  if (!text) return;
  p.input.value = "";
  bubble("user", text);
  const reply = bubble("bot", ai.getStatus().state === "ready" ? "…" : "I'll answer as soon as I'm ready.");
  reply.classList.add("is-pending");
  asked[p.mode] = true;
  if (ai.getStatus().state !== "ready") ai.load().then(() => renderStatus(ai.getStatus()), () => {});
  try {
    if (p.mode === "chat") await answer(p, text, reply);
    else await proposeEdits(p, text, reply);
  } catch (e) {
    reply.textContent = `Something went wrong: ${e?.message || e}`;
  }
  reply.classList.remove("is-pending");
  reply.scrollIntoView({ block: "nearest" });
}

async function answer(p, question, reply) {
  const facts = chatSystem(p.getResume());
  if (facts !== chatFacts || !chatLog) { chatFacts = facts; chatLog = chatPrefix(p.getResume()); } // the portfolio changed: start over
  const prompt = chatLog + ai.turn("user", question) + ai.ASSISTANT;
  const r = await ai.complete(prompt, { maxTokens: 160, onText: (t) => (reply.textContent = t) });
  reply.textContent = r.text || "Sorry, I couldn't answer that.";
  chatLog = prompt + r.text + "<|im_end|>\n";
  ai.warm(chatLog).catch(() => {}); // keep the conversation ready for the next question
}

async function proposeEdits(p, request, reply) {
  const cards = [];
  for (const part of splitRequest(request)) {
    const resume = p.getResume();
    const r = await ai.complete(ai.START + ai.turn("system", EDIT_SYSTEM) + EDIT_EXAMPLES.map(([q, a]) => ai.turn("user", q) + ai.turn("assistant", a)).join("") + ai.turn("user", part) + ai.ASSISTANT,
      { maxTokens: 40, grammar: changeGrammar(resume) });
    for (const change of expandChange(parseChange(r.text))) cards.push(changeCard(p, part, change));
  }
  reply.replaceChildren(...cards);
  const open = cards.filter((c) => c.accept);
  if (open.length > 1) reply.append(h("button.btn.btn-ghost.ai-all", { type: "button", onclick: (e) => { for (const c of open) c.accept(); e.currentTarget.remove(); } }, "Accept all"));
}

function changeCard(p, request, change) {
  const problem = checkChange(change, p.getResume(), request);
  const card = h("div.ai-card", h("div.ai-card-ask", `“${request}”`));
  if (problem) {
    card.classList.add("is-skipped");
    card.append(h("div", `Skipped: ${problem}.`));
    return card;
  }
  const d = describeChange(change, p.getResume());
  const diff = h("div.ai-diff", h("span.ai-field", d.label));
  if (change.op === "set") diff.append(d.before ? h("del", d.before) : h("span.ai-empty", "(empty)"), h("span.ai-arrow", "→"), h("ins", d.after));
  else diff.append(change.op === "add" ? h("ins", `+ ${d.after}`) : h("del", `− ${d.before}`));
  const actions = h("div.ai-card-actions");
  const settle = (label) => {
    actions.replaceChildren(h("span.ai-settled", label));
    card.classList.add("is-done");
    card.accept = null;
  };
  card.accept = () => {
    if (!card.accept) return;
    const again = checkChange(change, p.getResume(), request); // an earlier card may have done it
    if (again) return settle(`Skipped: ${again}`);
    p.onApply?.(change, request);
    settle("Applied");
  };
  actions.append(
    h("button.btn.btn-ghost", { type: "button", onclick: () => settle("Rejected") }, "Reject"),
    h("button.btn.btn-primary", { type: "button", onclick: () => card.accept?.() }, "Accept"));
  card.append(diff, actions);
  return card;
}
