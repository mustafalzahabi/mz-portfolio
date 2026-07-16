// ============================================================================
// PUTER.JS WRAPPER — Cloud AI via Puter (User-Pays model)
// CDN loaded in index.html: <script src="https://js.puter.com/v2/"></script>
// ============================================================================

let puterReady = false;
let puterAuthed = false;

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

export async function ensurePuterAuth() {
  if (typeof puter === "undefined") return false;
  if (puter.auth.isSignedIn()) {
    puterAuthed = true;
    hidePuterUI();
    return true;
  }
  try {
    await puter.auth.signIn({ attempt_temp_user_creation: true });
    puterAuthed = true;
    hidePuterUI();
    return true;
  } catch {
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
