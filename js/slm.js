// ============================================================================
// CLIENT-SIDE SLM (Small Language Model)
// Runs a quantized model entirely in the browser using Transformers.js
// ============================================================================

import { getCachedData } from "./data.js";

let generator = null;
let modelLoading = false;
let modelReady = false;
let loadError = null;

// ---------------------------------------------------------------------------
// Model configuration
// ---------------------------------------------------------------------------

const MODEL_ID = "Xenova/Qwen2-0.5B-Instruct";

// ---------------------------------------------------------------------------
// Build system prompt from portfolio data (grounding)
// ---------------------------------------------------------------------------

function buildSystemPrompt() {
  const d = getCachedData();
  if (!d) {
    return "You are a helpful assistant for a portfolio website. Answer questions honestly. If you don't know, say so.";
  }

  const parts = [];

  parts.push(`You are a helpful assistant for ${d.basics.name}'s portfolio website.`);
  parts.push(`Answer questions about ${d.basics.name} honestly based ONLY on the information below.`);
  parts.push("If the information is not in the data provided, say 'I don't have that information available.'");
  parts.push("Do not make up or hallucinate any information.");
  parts.push("Keep answers concise and conversational.");
  parts.push("");

  // Basics
  parts.push("## Profile");
  parts.push(`- Name: ${d.basics.name}`);
  if (d.basics.label) parts.push(`- Title: ${d.basics.label}`);
  if (d.basics.summary) parts.push(`- Bio: ${d.basics.summary}`);
  if (d.basics.email) parts.push(`- Email: ${d.basics.email}`);

  // Education
  if (d.education?.length) {
    parts.push("");
    parts.push("## Education");
    for (const edu of d.education) {
      const degree = edu.studyType + (edu.area ? " in " + edu.area : "");
      parts.push(`- ${degree} from ${edu.institution} (${edu.startDate} - ${edu.endDate})`);
    }
  }

  // Skills
  if (d.skills?.length) {
    parts.push("");
    parts.push("## Skills");
    for (const cat of d.skills) {
      parts.push(`- ${cat.category}: ${cat.items.join(", ")}`);
    }
  }

  // Projects
  if (d.projects?.length) {
    parts.push("");
    parts.push("## Projects");
    for (const proj of d.projects) {
      const desc = proj.readmeDescription || proj.description || "";
      const tech = (proj.technologies || []).join(", ");
      parts.push(`- ${proj.name}: ${desc}${tech ? ` [Tech: ${tech}]` : ""}`);
    }
  }

  // Profiles
  if (d.basics.profiles?.length) {
    parts.push("");
    parts.push("## Links");
    for (const p of d.basics.profiles) {
      parts.push(`- ${p.network}: ${p.url}`);
    }
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Model loading
// ---------------------------------------------------------------------------

export async function loadModel(onProgress) {
  if (modelReady) return true;
  if (generator) return true;
  if (modelLoading) return false;

  modelLoading = true;
  loadError = null;

  try {
    // Dynamically import Transformers.js
    const { pipeline, env } = await import(
      "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3"
    );

    // Disable local model caching (use HuggingFace Hub + IndexedDB)
    env.allowLocalModels = false;

    onProgress?.("downloading", 0);

    generator = await pipeline("text-generation", MODEL_ID, {
      dtype: "q4",
      device: "webgpu",
      progress_callback: (progress) => {
        if (progress.status === "progress") {
          onProgress?.("downloading", progress.progress || 0);
        } else if (progress.status === "done") {
          onProgress?.("ready", 100);
        }
      },
    });

    modelReady = true;
    modelLoading = false;
    return true;
  } catch (e) {
    console.warn("[slm] Model load failed:", e.message);
    loadError = e.message;
    modelLoading = false;

    // Try WASM fallback if WebGPU failed
    if (e.message?.includes("webgpu") || e.message?.includes("WebGPU")) {
      try {
        const { pipeline, env } = await import(
          "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3"
        );
        env.allowLocalModels = false;

        generator = await pipeline("text-generation", MODEL_ID, {
          dtype: "q4",
          device: "wasm",
        });

        modelReady = true;
        loadError = null;
        return true;
      } catch (e2) {
        console.warn("[slm] WASM fallback also failed:", e2.message);
        loadError = e2.message;
      }
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Chat inference
// ---------------------------------------------------------------------------

export async function chat(messages) {
  if (!generator) throw new Error("Model not loaded");

  const systemPrompt = buildSystemPrompt();

  // Format as chat messages for the model
  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    })),
  ];

  const output = await generator(formattedMessages, {
    max_new_tokens: 512,
    temperature: 0.3,
    top_p: 0.9,
    do_sample: true,
  });

  // Extract the assistant's reply
  const reply = output[0]?.generated_text?.slice(-1)?.[0]?.content || "";
  return reply.trim();
}

// ---------------------------------------------------------------------------
// State getters
// ---------------------------------------------------------------------------

export function isModelReady() {
  return modelReady;
}

export function isModelLoading() {
  return modelLoading;
}

export function getModelError() {
  return loadError;
}
