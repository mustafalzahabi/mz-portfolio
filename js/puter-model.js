// ============================================================================
// PUTER.JS WRAPPER — Cloud AI via Puter (User-Pays model)
// CDN loaded in index.html: <script src="https://js.puter.com/v2/"></script>
// ============================================================================

let puterReady = false;

export function isPuterReady() {
  return typeof puter !== "undefined" && puterReady;
}

export function markPuterReady() {
  puterReady = true;
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
