// ============================================================================
// CLIENT-SIDE SLM — Thin wrapper around inference Web Worker
// All heavy work (model loading, inference) runs in a dedicated worker thread.
// ============================================================================

import { getCachedData } from "./data.js";

let worker = null;
let ready = false;
let loading = false;
let error = null;

// Pending resolve callbacks for worker messages
let pendingInit = null;
let pendingChat = null;

// Prompt template (loaded once, cached)
let promptTemplate = null;

// Max conversation turns to keep (prevents context overflow + hallucination)
const MAX_TURNS = 2;

// ---------------------------------------------------------------------------
// Load prompt template from prompt.md
// ---------------------------------------------------------------------------

async function loadPromptTemplate() {
  if (promptTemplate) return promptTemplate;
  try {
    const res = await fetch(new URL("../prompt.md", import.meta.url));
    promptTemplate = await res.text();
  } catch {
    // Fallback if prompt.md can't be loaded
    promptTemplate = `You are a portfolio assistant. Answer ONLY using the information below. If the answer is not in the data, say "I don't have that information." Keep answers short and conversational.\n\n{{DATA}}`;
  }
  return promptTemplate;
}

// ---------------------------------------------------------------------------
// Fill prompt template with portfolio data
// ---------------------------------------------------------------------------

function fillTemplate(template, d) {
  if (!d) return template;

  const education = (d.education || [])
    .map((e) => {
      const degree = e.studyType + (e.area ? " in " + e.area : "");
      return `- ${degree} from ${e.institution} (${e.startDate} - ${e.endDate})`;
    })
    .join("\n");

  const skills = (d.skills || [])
    .map((c) => `- ${c.category}: ${c.items.join(", ")}`)
    .join("\n");

  const projects = (d.projects || [])
    .map((p) => {
      const desc = p.readmeDescription || p.description || "";
      const tech = (p.technologies || []).join(", ");
      return `- ${p.name}: ${desc}${tech ? ` [Tech: ${tech}]` : ""}`;
    })
    .join("\n");

  const links = (d.basics.profiles || [])
    .map((p) => `- ${p.network}: ${p.url}`)
    .join("\n");

  return template
    .replace(/\{\{NAME\}\}/g, d.basics.name || "the portfolio owner")
    .replace(/\{\{LABEL\}\}/g, d.basics.label ? `- Title: ${d.basics.label}` : "")
    .replace(/\{\{SUMMARY\}\}/g, d.basics.summary ? `- Bio: ${d.basics.summary}` : "")
    .replace(/\{\{EMAIL\}\}/g, d.basics.email ? `- Email: ${d.basics.email}` : "")
    .replace(/\{\{EDUCATION\}\}/g, education)
    .replace(/\{\{SKILLS\}\}/g, skills)
    .replace(/\{\{PROJECTS\}\}/g, projects)
    .replace(/\{\{LINKS\}\}/g, links);
}

// ---------------------------------------------------------------------------
// Build system prompt (cached per session)
// ---------------------------------------------------------------------------

let cachedSystemPrompt = null;

async function getSystemPrompt() {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const template = await loadPromptTemplate();
  const d = getCachedData();
  cachedSystemPrompt = fillTemplate(template, d);
  return cachedSystemPrompt;
}

// ---------------------------------------------------------------------------
// Prune messages: keep system prompt + last 2 turns (4 messages)
// ---------------------------------------------------------------------------

function pruneMessages(messages) {
  const system = messages.filter((m) => m.role === "system");
  const conversation = messages.filter((m) => m.role !== "system");
  const recent = conversation.slice(-MAX_TURNS * 2);
  return [...system, ...recent];
}

// ---------------------------------------------------------------------------
// Worker setup + message routing
// ---------------------------------------------------------------------------

function ensureWorker() {
  if (worker) return worker;

  worker = new Worker(new URL("./inference.worker.js", import.meta.url), {
    type: "module",
    name: "slm-inference",
  });

  worker.addEventListener("message", (event) => {
    const msg = event.data;

    switch (msg.type) {
      case "progress":
        pendingInit?.onProgress?.(msg.status, msg.progress);
        break;

      case "ready":
        ready = true;
        loading = false;
        error = null;
        console.log("[slm] Model ready");
        pendingInit?.resolve(true);
        pendingInit = null;
        break;

      case "error":
        loading = false;
        error = msg.message;
        console.error("[slm] Worker error:", msg.message);
        if (pendingInit) {
          pendingInit.resolve(false);
          pendingInit = null;
        }
        if (pendingChat) {
          pendingChat.reject(new Error(msg.message));
          pendingChat = null;
        }
        break;

      case "stream":
        pendingChat?.onToken?.(msg.text);
        break;

      case "done":
        pendingChat?.resolve(msg.text);
        pendingChat = null;
        break;

      case "cancelled":
        pendingChat?.resolve("");
        pendingChat = null;
        break;
    }
  });

  worker.addEventListener("error", (e) => {
    console.error("[slm] Worker crashed:", e);
    loading = false;
    error = "Worker crashed";
    ready = false;
    if (pendingInit) {
      pendingInit.resolve(false);
      pendingInit = null;
    }
    if (pendingChat) {
      pendingChat.reject(new Error("Worker crashed"));
      pendingChat = null;
    }
  });

  return worker;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function loadModel(onProgress) {
  if (ready) return Promise.resolve(true);
  if (loading) return Promise.resolve(false);

  loading = true;
  error = null;

  ensureWorker();

  return new Promise((resolve) => {
    pendingInit = { resolve, onProgress };
    worker.postMessage({ type: "init" });
  });
}

export async function chat(messages, onToken) {
  if (!ready) return Promise.reject(new Error("Model not loaded"));

  ensureWorker();

  const systemPrompt = await getSystemPrompt();

  // Build full message list: system prompt + pruned conversation
  const formatted = [
    { role: "system", content: systemPrompt },
    ...pruneMessages(
      messages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ),
  ];

  return new Promise((resolve, reject) => {
    pendingChat = { resolve, reject, onToken };
    worker.postMessage({ type: "chat", messages: formatted });
  });
}

export function cancelGeneration() {
  if (worker && pendingChat) {
    worker.postMessage({ type: "cancel" });
  }
}

export function isModelReady() {
  return ready;
}

export function isModelLoading() {
  return loading;
}

export function getModelError() {
  return error;
}
