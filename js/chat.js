// ============================================================================
// CHAT — Bubble UI + prompt/history + streaming inference
// ============================================================================

import { getCachedData } from "./data.js";
import {
  isPuterReady,
  markPuterReady,
  trySilentAuth,
  puterChatStream,
} from "./model.js";

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
// System prompt (cached)
// ---------------------------------------------------------------------------

let systemPrompt = null;

async function getSystemPrompt() {
  if (systemPrompt) return systemPrompt;
  const template = await loadPromptTemplate();
  const d = getCachedData();
  systemPrompt = fillTemplate(template, d);
  return systemPrompt;
}

// ---------------------------------------------------------------------------
// Conversation history (managed internally, capped at 10 turns)
// ---------------------------------------------------------------------------

let messageHistory = null;
const MAX_HISTORY = 20;

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
// Chat API (called by bubble UI)
// ---------------------------------------------------------------------------

export async function loadModel() {
  if (typeof puter !== "undefined") {
    markPuterReady();
  }
  return isPuterReady();
}

export async function chat(userMessage, onToken) {
  await ensureHistory();
  pushToHistory({ role: "user", content: userMessage });

  try {
    // Try silent auth (only if token already cached in localStorage)
    trySilentAuth();

    let fullReply = "";
    for await (const text of puterChatStream(messageHistory)) {
      fullReply = text;
      onToken(fullReply);
    }
    if (!fullReply) throw new Error("Empty response from AI");
    pushToHistory({ role: "assistant", content: fullReply });
    return fullReply;
  } catch (e) {
    console.warn("[chat] inference failed:", e.message);
    resetHistory();
    throw e;
  }
}

export function isModelReady() {
  return isPuterReady();
}

// ---------------------------------------------------------------------------
// Chat bubble UI
// ---------------------------------------------------------------------------

export function buildChatBubble(displayName) {
  const wrapper = document.createElement("div");
  wrapper.className = "chat-bubble-wrapper";

  let isGenerating = false;

  // --- Floating trigger button ---
  const trigger = document.createElement("button");
  trigger.className = "chat-bubble-trigger";
  trigger.setAttribute("aria-label", "Open chat");
  trigger.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

  // --- Chat window ---
  const chatWindow = document.createElement("div");
  chatWindow.className = "chat-window";

  // Header
  const header = document.createElement("div");
  header.className = "chat-header";

  const headerInfo = document.createElement("div");
  headerInfo.className = "chat-header-info";

  const avatar = document.createElement("div");
  avatar.className = "chat-avatar";
  avatar.textContent = (displayName || "AI").charAt(0).toUpperCase();

  const headerText = document.createElement("div");

  const nameEl = document.createElement("div");
  nameEl.className = "chat-header-name";
  nameEl.textContent = displayName || "Portfolio Owner";

  const statusEl = document.createElement("div");
  statusEl.className = "chat-header-status";
  statusEl.textContent = "AI Assistant";

  headerText.append(nameEl, statusEl);
  headerInfo.append(avatar, headerText);

  const closeBtn = document.createElement("button");
  closeBtn.className = "chat-close";
  closeBtn.setAttribute("aria-label", "Close chat");
  closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  header.append(headerInfo, closeBtn);

  // Messages area
  const messages = document.createElement("div");
  messages.className = "chat-messages";

  // Welcome message
  const welcome = document.createElement("div");
  welcome.className = "chat-msg bot";
  welcome.textContent = "Hi! Ask me anything about this portfolio.";
  messages.appendChild(welcome);

  // Typing indicator
  const typing = document.createElement("div");
  typing.className = "chat-typing";
  typing.style.display = "none";
  typing.innerHTML = "<span></span><span></span><span></span>";
  messages.appendChild(typing);

  // Input area
  const inputArea = document.createElement("div");
  inputArea.className = "chat-input-area";

  const input = document.createElement("input");
  input.className = "chat-input";
  input.type = "text";
  input.placeholder = "Type a message...";

  const sendBtn = document.createElement("button");
  sendBtn.className = "chat-send";
  sendBtn.setAttribute("aria-label", "Send message");
  sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

  inputArea.append(input, sendBtn);
  chatWindow.append(header, messages, inputArea);

  // --- Helpers ---
  function addMessage(role, text) {
    const msg = document.createElement("div");
    msg.className = `chat-msg ${role}`;
    msg.textContent = text;
    messages.insertBefore(msg, typing);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  function setGenerating(gen) {
    isGenerating = gen;
    input.disabled = gen;
    sendBtn.disabled = gen;
    input.placeholder = gen ? "Thinking..." : "Type a message...";
    typing.style.display = gen ? "flex" : "none";
    if (gen) messages.scrollTop = messages.scrollHeight;
  }

  async function handleSend() {
    const text = input.value.trim();
    if (!text || isGenerating || !isModelReady()) return;

    input.value = "";
    addMessage("user", text);

    setGenerating(true);

    // Create bot message element for streaming
    const botMsg = document.createElement("div");
    botMsg.className = "chat-msg bot";
    botMsg.textContent = "";
    messages.insertBefore(botMsg, typing);
    messages.scrollTop = messages.scrollHeight;

    let fullReply = "";

    try {
      await chat(text, (token) => {
        fullReply = token;
        botMsg.textContent = fullReply;
        messages.scrollTop = messages.scrollHeight;
      });

      if (!fullReply) {
        botMsg.textContent = "No response generated.";
      }
    } catch (e) {
      console.warn("[chat] inference error:", e);
      botMsg.textContent = "Sorry, something went wrong. Please try again.";
    } finally {
      setGenerating(false);
    }
  }

  // --- Events ---
  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  trigger.addEventListener("click", () => {
    chatWindow.classList.toggle("open");
    trigger.setAttribute(
      "aria-label",
      chatWindow.classList.contains("open") ? "Close chat" : "Open chat",
    );
  });

  closeBtn.addEventListener("click", () => {
    chatWindow.classList.remove("open");
    trigger.setAttribute("aria-label", "Open chat");
  });

  wrapper.append(trigger, chatWindow);
  return wrapper;
}
