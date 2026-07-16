// ============================================================================
// LOCAL MODEL — SmolLM2-360M-Instruct via Transformers.js
// Downloads ~273 MB on first use, cached in browser for offline.
// ============================================================================

let generator = null;
let loading = false;

export function isLocalModelReady() {
  return generator !== null;
}

export function isLocalModelLoading() {
  return loading;
}

export async function loadLocalModel(onProgress) {
  if (generator) return true;
  if (loading) return false;
  loading = true;

  try {
    const { pipeline } = await import(
      "https://cdn.jsdelivr.net/npm/@huggingface/transformers"
    );

    generator = await pipeline(
      "text-generation",
      "HuggingFaceTB/SmolLM2-360M-Instruct",
      {
        dtype: "q4",
        device: "wasm",
        progress_callback: onProgress,
      },
    );

    loading = false;
    return true;
  } catch (e) {
    console.error("[local-model] load failed:", e);
    loading = false;
    throw e;
  }
}

export async function localChat(messages, maxTokens = 150) {
  if (!generator) throw new Error("Local model not loaded");

  const result = await generator(messages, {
    max_new_tokens: maxTokens,
    do_sample: true,
    temperature: 0.7,
    top_p: 0.9,
    repetition_penalty: 1.1,
  });

  return result[0].generated_text;
}
