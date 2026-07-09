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
const CDN_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3";
const DTYPES = ["q4", "q8", "fp32"];

// ---------------------------------------------------------------------------
// Detect WebGPU support
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

  parts.push("## Profile");
  parts.push(`- Name: ${d.basics.name}`);
  if (d.basics.label) parts.push(`- Title: ${d.basics.label}`);
  if (d.basics.summary) parts.push(`- Bio: ${d.basics.summary}`);
  if (d.basics.email) parts.push(`- Email: ${d.basics.email}`);

  if (d.education?.length) {
    parts.push("");
    parts.push("## Education");
    for (const edu of d.education) {
      const degree = edu.studyType + (edu.area ? " in " + edu.area : "");
      parts.push(`- ${degree} from ${edu.institution} (${edu.startDate} - ${edu.endDate})`);
    }
  }

  if (d.skills?.length) {
    parts.push("");
    parts.push("## Skills");
    for (const cat of d.skills) {
      parts.push(`- ${cat.category}: ${cat.items.join(", ")}`);
    }
  }

  if (d.projects?.length) {
    parts.push("");
    parts.push("## Projects");
    for (const proj of d.projects) {
      const desc = proj.readmeDescription || proj.description || "";
      const tech = (proj.technologies || []).join(", ");
      parts.push(`- ${proj.name}: ${desc}${tech ? ` [Tech: ${tech}]` : ""}`);
    }
  }

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
// Load Transformers.js dynamically (cached after first load)
// ---------------------------------------------------------------------------

let transformersModule = null;

async function getTransformers() {
  if (transformersModule) return transformersModule;
  try {
    transformersModule = await import(CDN_URL);
    return transformersModule;
  } catch (e) {
    throw new Error(`Failed to load Transformers.js library: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Try loading with a specific device and dtype
// ---------------------------------------------------------------------------

async function tryLoad(device, dtype, onProgress) {
  const { pipeline, env } = await getTransformers();
  env.allowLocalModels = false;

  onProgress?.("downloading", 0);

  return pipeline("text-generation", MODEL_ID, {
    dtype,
    device,
    progress_callback: (progress) => {
      if (progress.status === "progress") {
        onProgress?.("downloading", progress.progress || 0);
      } else if (progress.status === "done") {
        onProgress?.("ready", 100);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Model loading (device x dtype fallback chain)
// ---------------------------------------------------------------------------

export async function loadModel(onProgress) {
  if (modelReady) return true;
  if (generator) return true;
  if (modelLoading) return false;

  modelLoading = true;
  loadError = null;

  // Step 1: Check if Transformers.js can even be loaded
  try {
    await getTransformers();
  } catch (e) {
    loadError = `Library load failed: ${e.message}`;
    modelLoading = false;
    console.error("[slm]", loadError);
    return false;
  }

  // Step 2: Determine device order
  const gpuAvailable = await hasWebGPU();
  console.log("[slm] WebGPU available:", gpuAvailable);
  const devices = gpuAvailable ? ["webgpu", "wasm"] : ["wasm"];

  // Step 3: Try each device + dtype combination
  for (const device of devices) {
    for (const dtype of DTYPES) {
      try {
        console.log(`[slm] Trying ${device} / ${dtype}`);
        onProgress?.("loading", 0);

        generator = await tryLoad(device, dtype, onProgress);

        modelReady = true;
        modelLoading = false;
        loadError = null;
        console.log(`[slm] Model loaded on ${device} / ${dtype}`);
        return true;
      } catch (e) {
        console.warn(`[slm] ${device}/${dtype} failed:`, e.message);
        loadError = `${device}/${dtype}: ${e.message}`;
        // Continue to next combo
      }
    }
  }

  modelLoading = false;
  console.error("[slm] All device/dtype combos failed. Last error:", loadError);
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
