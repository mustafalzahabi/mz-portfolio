// ============================================================================
// PUTER.JS WRAPPER — Cloud AI via Puter (User-Pays model)
// CDN loaded in index.html: <script src="https://js.puter.com/v2/"></script>
//
// Silent auth: fetch anonymous token from Puter API and inject via
// puter.setAuthToken() to bypass the "Setting up your account" popup.
// ============================================================================

const STORAGE_KEY = "puter_anon_token";
const API_ORIGIN = "https://api.puter.com";

let puterReady = false;
let puterAuthed = false;

// Fetch anonymous token from Puter API (no popup)
async function fetchAnonymousToken() {
  const res = await fetch(`${API_ORIGIN}/v1/auth/anonymous`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Anonymous auth failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

// Inject token into Puter SDK (tricks it into thinking user is signed in)
function injectToken(token) {
  if (typeof puter !== "undefined" && puter.setAuthToken) {
    puter.setAuthToken(token);
    return true;
  }
  return false;
}

// Hide any Puter UI elements that appear
function hidePuterUI() {
  const selectors = [
    "puter-dialog",
    "puter-modal",
    "[data-puter]",
    ".puter-ui",
    ".puter-dialog",
    ".puter-modal",
  ];
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach((el) => {
      el.style.display = "none";
      el.style.visibility = "hidden";
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
    });
  }
}

// Watch for Puter UI elements and hide them
const puterObserver = new MutationObserver(() => hidePuterUI());
puterObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

export function isPuterReady() {
  return typeof puter !== "undefined" && puterReady;
}

export function isPuterAuthed() {
  return puterAuthed;
}

export function markPuterReady() {
  puterReady = true;
  if (typeof puter !== "undefined") {
    puterAuthed = puter.auth.isSignedIn();
  }
}

// Silent auth: fetch anonymous token and inject into SDK
// No popups, no user interaction required
export async function ensurePuterAuth() {
  if (typeof puter === "undefined") return false;

  // Already signed in
  if (puter.auth.isSignedIn()) {
    puterAuthed = true;
    hidePuterUI();
    return true;
  }

  try {
    // Check localStorage for existing token
    let token = localStorage.getItem(STORAGE_KEY);

    if (!token) {
      // Fetch new anonymous token (no popup)
      token = await fetchAnonymousToken();
      if (token) {
        localStorage.setItem(STORAGE_KEY, token);
      }
    }

    if (token) {
      // Inject token into SDK — tricks it into thinking user is signed in
      const injected = injectToken(token);
      if (injected) {
        puterAuthed = true;
        hidePuterUI();
        return true;
      }
    }

    puterAuthed = false;
    hidePuterUI();
    return false;
  } catch (err) {
    console.error("Silent Puter auth failed:", err);
    puterAuthed = false;
    hidePuterUI();
    return false;
  }
}

export async function puterChat(messages, model = "openai/gpt-5.4-nano") {
  if (!isPuterReady()) {
    throw new Error("Puter.js not loaded");
  }

  const lastUserMsg = messages.filter((m) => m.role === "user").pop();
  const systemMsg = messages.find((m) => m.role === "system");

  const prompt = systemMsg
    ? `${systemMsg.content}\n\nUser: ${lastUserMsg.content}`
    : lastUserMsg.content;

  const response = await puter.ai.chat(prompt, {
    model,
    stream: true,
  });

  let fullText = "";
  for await (const part of response) {
    if (part?.text) {
      fullText += part.text;
    }
  }
  return fullText;
}

export async function* puterChatStream(messages, model = "openai/gpt-5.4-nano") {
  if (!isPuterReady()) {
    throw new Error("Puter.js not loaded");
  }

  const lastUserMsg = messages.filter((m) => m.role === "user").pop();
  const systemMsg = messages.find((m) => m.role === "system");

  const prompt = systemMsg
    ? `${systemMsg.content}\n\nUser: ${lastUserMsg.content}`
    : lastUserMsg.content;

  const response = await puter.ai.chat(prompt, {
    model,
    stream: true,
  });

  let fullText = "";
  for await (const part of response) {
    if (part?.text) {
      fullText += part.text;
      yield fullText;
    }
  }
}
