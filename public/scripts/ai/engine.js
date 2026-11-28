// ============================================================================
// AI ENGINE — a small language model running in the visitor's own browser
// LFM2.5-1.2B (Liquid AI) through wllama (llama.cpp compiled to WebAssembly).
// No server, no account, no key: each visitor's device does the work, so no one
// shares a limit. Loaded only when someone opens the chat.
// ============================================================================

const WLLAMA = "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.13.0/esm";
export const MODEL = { repo: "LiquidAI/LFM2.5-1.2B-Instruct-GGUF", file: "LFM2.5-1.2B-Instruct-Q4_K_M.gguf" };
export const MODEL_MB = 730;

/** Threads need a cross-origin-isolated page (Chrome and Edge here); elsewhere it runs on one, much slower. */
export const isFast = () => typeof crossOriginIsolated !== "undefined" && crossOriginIsolated;

let lib = null;
const loadLib = () => (lib ??= import(`${WLLAMA}/index.js`));
let engine = null;
let loading = null;
let busy = Promise.resolve();
const queue = (fn) => {
  const run = busy.then(fn, fn);
  busy = run.catch(() => {});
  return run;
};

const listeners = new Set();
let status = { state: "idle" }; // idle | loading | ready | error
const setStatus = (s) => {
  status = s;
  for (const fn of listeners) fn(s);
};
export const getStatus = () => status;
/** @returns unsubscribe */
export function onStatus(fn) {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

/** True when the model is already saved in this browser (opening the chat then costs no download). */
export async function isCached() {
  try {
    const { Wllama } = await loadLib();
    const list = await new Wllama({ default: `${WLLAMA}/wasm/wllama.wasm` }).cacheManager.list();
    return list.some((e) => e.name.includes(MODEL.file));
  } catch {
    return false;
  }
}

export function load() {
  if (loading) return loading;
  loading = (async () => {
    setStatus({ state: "loading", progress: 0 });
    try {
      const { Wllama } = await loadLib();
      const cached = await isCached();
      engine = new Wllama({ default: `${WLLAMA}/wasm/wllama.wasm` });
      await engine.loadModelFromHF(MODEL, {
        n_ctx: 2048,
        n_gpu_layers: 0,
        n_threads: navigator.hardwareConcurrency || 4,
        progressCallback: ({ loaded, total }) => setStatus({ state: "loading", progress: total ? loaded / total : 0, loadedMB: Math.round(loaded / 1e6), totalMB: Math.round(total / 1e6), cached }),
      });
      setStatus({ state: "ready" });
    } catch (e) {
      engine = null;
      loading = null;
      setStatus({ state: "error", message: e?.message || String(e) });
      throw e;
    }
  })();
  return loading;
}

const turn = (role, content) => `<|im_start|>${role}\n${content}<|im_end|>\n`;
export const START = ""; // the engine adds the model's start token itself
export { turn };
export const ASSISTANT = "<|im_start|>assistant\n";

/**
 * Runs one completion (queued: the engine does one thing at a time).
 * `cache_prompt` reuses whatever part of the prompt it has already processed.
 */
export function complete(prompt, { maxTokens = 120, grammar, onText, signal } = {}) {
  return queue(async () => {
    await load();
    const started = performance.now();
    let first = 0;
    let text = "";
    const stream = await engine.createCompletion({
      prompt, stream: true, max_tokens: maxTokens, temperature: 0.2, top_k: 40, top_p: 0.9, cache_prompt: true, stop: ["<|im_end|>"],
      ...(grammar ? { grammar } : {}), ...(signal ? { abortSignal: signal } : {}),
    });
    for await (const c of stream) {
      const d = c.choices?.[0]?.text || "";
      if (!d) continue;
      if (!first) first = performance.now() - started;
      text += d;
      onText?.(text);
    }
    return { text: text.trim(), first: Math.round(first), total: Math.round(performance.now() - started) };
  });
}

/** Processes a prompt prefix ahead of time, so a question only costs its own few tokens. */
export const warm = (prefix) => complete(prefix, { maxTokens: 0 });

/** Resolves when everything queued so far has run. */
export const idle = () => busy;
