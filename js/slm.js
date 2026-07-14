// ============================================================================
// CLIENT-SIDE SLM — Free API chatbot via Pollinations.ai
// No API key, no download, no WASM, works on every browser.
// ============================================================================

import { getCachedData } from "./data.js";

const API_URL = "https://text.pollinations.ai/openai";
const MODEL = "qwen-safety";

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
    promptTemplate = `You are a portfolio assistant. Present the candidate positively using ONLY the data below. Keep answers concise.\n\n{{DATA}}`;
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
const MAX_HISTORY = 20; // 10 user + 10 assistant

async function ensureHistory() {
  if (messageHistory) return;
  const sp = await getSystemPrompt();
  messageHistory = [{ role: "system", content: sp }];
}

function pushToHistory(msg) {
  messageHistory.push(msg);
  // Keep system prompt + last MAX_HISTORY messages
  if (messageHistory.length > MAX_HISTORY + 1) {
    messageHistory = [
      messageHistory[0],
      ...messageHistory.slice(-MAX_HISTORY),
    ];
  }
}

// ---------------------------------------------------------------------------
// SSE stream parser (OpenAI-compatible format)
// ---------------------------------------------------------------------------

async function* parseSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") return;
        try {
          yield JSON.parse(payload);
        } catch {}
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function loadModel() {
  return true;
}

export async function chat(userMessage, onToken) {
  await ensureHistory();
  pushToHistory({ role: "user", content: userMessage });

  let fullResponse = "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: messageHistory,
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`API error ${res.status}: ${errText}`);
    }

    for await (const json of parseSSE(res)) {
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) {
        // Handle both cumulative and delta chunk formats
        if (delta.startsWith(fullResponse)) {
          fullResponse = delta;
        } else {
          fullResponse += delta;
        }
        onToken(fullResponse);
      }
    }

    if (!fullResponse) throw new Error("Empty response from API");
  } catch (e) {
    messageHistory = null; // Reset on error
    throw e;
  }

  pushToHistory({ role: "assistant", content: fullResponse });
  return fullResponse;
}

export function isModelReady() {
  return true;
}

export function isModelLoading() {
  return false;
}

export function getModelError() {
  return null;
}
