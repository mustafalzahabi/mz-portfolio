// ============================================================================
// CLIENT-SIDE SLM — Chrome Built-in AI (Gemini Nano)
// Uses the LanguageModel API shipped in Chrome 148+.
// No downloads, no WASM, no Web Worker — managed by the browser.
// ============================================================================

import { getCachedData } from "./data.js";

let session = null;
let loading = false;
let ready = false;
let error = null;

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

export async function isAIAvailable() {
  try {
    if (!("LanguageModel" in self)) return false;
    const status = await LanguageModel.availability();
    return status !== "unavailable";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Load prompt template from prompt.md and fill placeholders
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
// Load model — create a Gemini Nano session
// ---------------------------------------------------------------------------

export async function loadModel(onProgress) {
  if (ready) return true;
  if (loading) return false;

  loading = true;
  error = null;

  try {
    const template = await loadPromptTemplate();
    const d = getCachedData();
    const systemPrompt = fillTemplate(template, d);

    session = await LanguageModel.create({
      initialPrompts: [{ role: "system", content: systemPrompt }],
      monitor(m) {
        m.addEventListener("downloadprogress", (e) => {
          const pct = e.total
            ? Math.round((e.loaded / e.total) * 100)
            : 0;
          onProgress?.("downloading", pct);
        });
      },
    });

    ready = true;
    loading = false;
    onProgress?.("ready", 100);
    console.log("[slm] Gemini Nano ready");
    return true;
  } catch (e) {
    error = e.message || "Failed to create AI session";
    loading = false;
    console.error("[slm]", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Chat — send message to the existing session, stream tokens
// ---------------------------------------------------------------------------

export async function chat(userMessage, onToken) {
  if (!session) throw new Error("Model not loaded");

  try {
    const stream = session.promptStreaming(userMessage);
    let full = "";

    for await (const chunk of stream) {
      // Defensive: handle both delta and cumulative chunk formats
      if (chunk.startsWith(full)) {
        full = chunk;
      } else {
        full += chunk;
      }
      onToken(full);
    }

    return full;
  } catch (e) {
    if (e.name === "AbortError") return "";
    throw e;
  }
}

// ---------------------------------------------------------------------------
// State getters
// ---------------------------------------------------------------------------

export function isModelReady() {
  return ready;
}

export function isModelLoading() {
  return loading;
}

export function getModelError() {
  return error;
}
