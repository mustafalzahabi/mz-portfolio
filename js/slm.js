// ============================================================================
// CLIENT-SIDE SLM — Dual-mode chatbot
// Default: Puter.js (cloud, user-pays). Toggle: SmolLM2-360M (local, offline).
// ============================================================================

import { getCachedData } from "./data.js";
import {
  isPuterReady,
  markPuterReady,
  puterChatStream,
} from "./puter-model.js";
import {
  isLocalModelReady,
  isLocalModelLoading,
  loadLocalModel,
  localChat,
} from "./local-model.js";

// ---------------------------------------------------------------------------
// Mode management
// ---------------------------------------------------------------------------

let currentMode = "cloud"; // "cloud" | "local"

export function switchMode(mode) {
  currentMode = mode;
  resetHistory();
}

export function getMode() {
  return currentMode;
}

// ---------------------------------------------------------------------------
// Prompt template (from prompt.md)
// ---------------------------------------------------------------------------

let promptTemplate = null;

async function loadPromptTemplate() {
  if (promptTemplate) return promptTemplate;
  try {
    const res = await fetch(new URL("../prompt.md", import.meta.url));
    promptTemplate = await res.text();
  } catch {
    promptTemplate =
      "You are a portfolio assistant. Answer briefly about the owner's projects and skills.\n\n{{DATA}}";
  }
  return promptTemplate;
}

function fillTemplate(template, d) {
  if (!d) return template;

  const education = (d.education || [])
    .map((e) => {
      const deg = e.studyType + (e.area ? " in " + e.area : "");
      return `- ${deg} from ${e.institution} (${e.startDate} - ${e.endDate})`;
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
    .replace(
      /\{\{LABEL\}\}/g,
      d.basics.label ? `- Title: ${d.basics.label}` : "",
    )
    .replace(
      /\{\{SUMMARY\}\}/g,
      d.basics.summary ? `- Bio: ${d.basics.summary}` : "",
    )
    .replace(
      /\{\{EMAIL\}\}/g,
      d.basics.email ? `- Email: ${d.basics.email}` : "",
    )
    .replace(/\{\{EDUCATION\}\}/g, education)
    .replace(/\{\{SKILLS\}\}/g, skills)
    .replace(/\{\{PROJECTS\}\}/g, projects)
    .replace(/\{\{LINKS\}\}/g, links);
}

// ---------------------------------------------------------------------------
// System prompt (cached, mode-aware)
// ---------------------------------------------------------------------------

let cloudSystemPrompt = null;
let localSystemPrompt = null;

async function getSystemPrompt() {
  if (currentMode === "cloud") {
    if (cloudSystemPrompt) return cloudSystemPrompt;
    const template = await loadPromptTemplate();
    const d = getCachedData();
    cloudSystemPrompt = fillTemplate(template, d);
    return cloudSystemPrompt;
  } else {
    // Local mode: much shorter prompt for small model (max ~100 tokens)
    if (localSystemPrompt) return localSystemPrompt;
    const d = getCachedData();
    const name = d?.basics?.name || "the portfolio owner";
    const skills = (d?.skills || [])
      .slice(0, 3)
      .map((c) => c.items.slice(0, 5).join(", "))
      .join("; ");
    const projects = (d?.projects || [])
      .slice(0, 3)
      .map((p) => p.name)
      .join(", ");
    localSystemPrompt = `You are ${name}'s portfolio assistant. Answer briefly about their projects and skills. Keep answers under 50 words.\nSkills: ${skills}\nProjects: ${projects}`;
    return localSystemPrompt;
  }
}

// ---------------------------------------------------------------------------
// Conversation history (managed internally, capped at 10 turns)
// ---------------------------------------------------------------------------

let messageHistory = null;
const MAX_HISTORY = 20; // 10 user + 10 assistant

async function ensureHistory() {
  if (messageHistory) return;
  const sp = await getSystemPrompt();
  messageHistory = [{ role: "system", content: sp }];
}

function resetHistory() {
  messageHistory = null;
}

function pushToHistory(msg) {
  messageHistory.push(msg);
  if (messageHistory.length > MAX_HISTORY + 1) {
    messageHistory = [
      messageHistory[0],
      ...messageHistory.slice(-MAX_HISTORY),
    ];
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function loadModel() {
  // Check if Puter.js is available
  if (typeof puter !== "undefined") {
    markPuterReady();
  }

  if (currentMode === "cloud" && isPuterReady()) {
    return true;
  }

  if (currentMode === "local") {
    return await loadLocalModel();
  }

  // Cloud mode but Puter not ready — fall back to local
  if (currentMode === "cloud" && !isPuterReady()) {
    console.warn("[slm] Puter.js not available, falling back to local model");
    currentMode = "local";
    return await loadLocalModel();
  }

  return false;
}

export async function chat(userMessage, onToken) {
  await ensureHistory();
  pushToHistory({ role: "user", content: userMessage });

  try {
    if (currentMode === "cloud") {
      // Cloud mode via Puter.js
      let fullReply = "";
      for await (const text of puterChatStream(messageHistory)) {
        fullReply = text;
        onToken(fullReply);
      }
      if (!fullReply) throw new Error("Empty response from Puter.js");
      pushToHistory({ role: "assistant", content: fullReply });
      return fullReply;
    } else {
      // Local mode via SmolLM2
      const fullReply = await localChat(messageHistory);
      onToken(fullReply);
      pushToHistory({ role: "assistant", content: fullReply });
      return fullReply;
    }
  } catch (e) {
    console.warn(`[slm] ${currentMode} failed:`, e.message);
    resetHistory();
    throw e;
  }
}

export function isModelReady() {
  if (currentMode === "cloud") return isPuterReady();
  return isLocalModelReady();
}

export function isModelLoading() {
  if (currentMode === "local") return isLocalModelLoading();
  return false;
}

export function getModelError() {
  return null;
}
