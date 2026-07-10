// ============================================================================
// INFERENCE WEB WORKER
// Loads Transformers.js + SmolLM2-135M-Instruct in a dedicated thread.
// Never blocks the main UI thread.
// ============================================================================

const MODEL_ID = "HuggingFaceTB/SmolLM2-135M-Instruct";
const CDN_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3";

let generator = null;
let abortController = null;

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.addEventListener("message", async (event) => {
  const { type, messages } = event.data;

  if (type === "init") {
    await handleInit();
  } else if (type === "chat") {
    await handleChat(messages);
  } else if (type === "cancel") {
    handleCancel();
  }
});

// ---------------------------------------------------------------------------
// Init: load Transformers.js + model
// ---------------------------------------------------------------------------

async function handleInit() {
  try {
    self.postMessage({ type: "progress", status: "loading-library" });

    const { pipeline, env, TextStreamer } = await import(CDN_URL);
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    // Single-threaded WASM — no COOP/COEP needed, safe on iOS
    try {
      env.backends.onnx.wasm.numThreads = 1;
    } catch (_) {}

    self.postMessage({ type: "progress", status: "loading-model", progress: 0 });

    generator = await pipeline("text-generation", MODEL_ID, {
      dtype: "q4f16",
      device: "wasm",
      progress_callback: (progress) => {
        if (progress.status === "progress") {
          self.postMessage({
            type: "progress",
            status: "downloading",
            progress: progress.progress || 0,
          });
        } else if (progress.status === "done") {
          self.postMessage({ type: "progress", status: "ready", progress: 100 });
        }
      },
    });

    self.postMessage({ type: "ready" });
  } catch (e) {
    console.error("[worker] init failed:", e);
    self.postMessage({ type: "error", message: e.message || "Failed to load model" });
  }
}

// ---------------------------------------------------------------------------
// Chat: run inference with token streaming
// ---------------------------------------------------------------------------

async function handleChat(messages) {
  if (!generator) {
    self.postMessage({ type: "error", message: "Model not loaded" });
    return;
  }

  abortController = new AbortController();

  try {
    const streamer = new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (text) => {
        self.postMessage({ type: "stream", text });
      },
    });

    const output = await generator(messages, {
      max_new_tokens: 256,
      temperature: 0.3,
      top_p: 0.9,
      do_sample: true,
      streamer,
      signal: abortController.signal,
    });

    const reply = output[0]?.generated_text?.slice(-1)?.[0]?.content || "";
    self.postMessage({ type: "done", text: reply.trim() });
  } catch (e) {
    if (e.name === "AbortError") {
      self.postMessage({ type: "cancelled" });
    } else {
      console.error("[worker] chat failed:", e);
      self.postMessage({ type: "error", message: e.message || "Generation failed" });
    }
  }
}

// ---------------------------------------------------------------------------
// Cancel: abort current generation
// ---------------------------------------------------------------------------

function handleCancel() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}
