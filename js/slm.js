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
// Detect WebGPU support (including Android Chrome)
// ---------------------------------------------------------------------------

async function hasWebGPU() {
  try {
    if (!navigator.gpu) return false;
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

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
// Try loading with a specific device
// ---------------------------------------------------------------------------

async function tryLoad(device, onProgress) {
  const { pipeline, env } = await import(
    "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3"
  );

  env.allowLocalModels = false;

  onProgress?.("downloading", 0);

  const pipe = await pipeline("text-generation", MODEL_ID, {
    dtype: "q4",
    device,
    progress_callback: (progress) => {
      if (progress.status === "progress") {
        onProgress?.("downloading", progress.progress || 0);
      } else if (progress.status === "done") {
        onProgress?.("ready", 100);
      }
    },
  });

  return pipe;
}

// ---------------------------------------------------------------------------
// Model loading (WebGPU → WASM fallback chain)
// ---------------------------------------------------------------------------

export async function loadModel(onProgress) {
  if (modelReady) return true;
  if (generator) return true;
  if (modelLoading) return false;

  modelLoading = true;
  loadError = null;

  const gpuAvailable = await hasWebGPU();
  console.log("[slm] WebGPU available:", gpuAvailable);

  // Try WebGPU first, then WASM
  const devices = gpuAvailable ? ["webgpu", "wasm"] : ["wasm"];

  for (const device of devices) {
    try {
      console.log(`[slm] Trying device: ${device}`);
      onProgress?.("loading", 0);

      generator = await tryLoad(device, onProgress);

      modelReady = true;
      modelLoading = false;
      console.log(`[slm] Model loaded on ${device}`);
      return true;
    } catch (e) {
      console.warn(`[slm] ${device} failed:`, e.message);
      loadError = e.message;
      // Continue to next device
    }
  }

  modelLoading = false;
  console.error("[slm] All devices failed");
  return false;
}

// ---------------------------------------------------------------------------
// Chat inference
// ---------------------------------------------------------------------------

export async function chat(messages) {
  if (!generator) throw new Error("Model not loaded");

  const systemPrompt = buildSystemPrompt();

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
