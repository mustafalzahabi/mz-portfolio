// ============================================================================
// PUTER.JS WRAPPER — Cloud AI via Puter (User-Pays model)
// CDN loaded in index.html: <script src="https://js.puter.com/v2/"></script>
//
// Strategy: try without auth first (free models may work without a token).
// Only trigger auth (popup) as a last resort.
// ============================================================================

let puterReady = false;

export function isPuterReady() {
  return typeof puter !== "undefined" && puterReady;
}

export function markPuterReady() {
  puterReady = true;
}

// Try to auth silently. Returns true if already authed, false otherwise.
// Does NOT open a popup — we only set the token if one is already in localStorage.
export function trySilentAuth() {
  if (typeof puter === "undefined") return false;
  if (puter.auth.isSignedIn()) return true;

  // Check if there's a stored token the SDK should have picked up
  const stored = localStorage.getItem("puter.auth.token.v2");
  if (stored) {
    try { puter.setAuthToken(stored); } catch {}
    if (puter.auth.isSignedIn()) return true;
  }
  return false;
}

export async function puterChat(messages, model = "openai/gpt-5.4-nano") {
  if (!isPuterReady()) throw new Error("Puter.js not loaded");

  const lastUserMsg = messages.filter((m) => m.role === "user").pop();
  const systemMsg = messages.find((m) => m.role === "system");

  const prompt = systemMsg
    ? `${systemMsg.content}\n\nUser: ${lastUserMsg.content}`
    : lastUserMsg.content;

  const response = await puter.ai.chat(prompt, { model, stream: true });

  let fullText = "";
  for await (const part of response) {
    if (part?.text) fullText += part.text;
  }
  return fullText;
}

export async function* puterChatStream(messages, model = "openai/gpt-5.4-nano") {
  if (!isPuterReady()) throw new Error("Puter.js not loaded");

  const lastUserMsg = messages.filter((m) => m.role === "user").pop();
  const systemMsg = messages.find((m) => m.role === "system");

  const prompt = systemMsg
    ? `${systemMsg.content}\n\nUser: ${lastUserMsg.content}`
    : lastUserMsg.content;

  const response = await puter.ai.chat(prompt, { model, stream: true });

  let fullText = "";
  for await (const part of response) {
    if (part?.text) {
      fullText += part.text;
      yield fullText;
    }
  }
}
