// ============================================================================
// CODE REVEAL — before a section appears, the code that renders it is typed
// out in a panel over the section's space, then the panel dissolves into the
// real element. Source: the builder function itself (fn.toString(): there is
// no bundler, so the served code is the real code) or the produced HTML.
// ============================================================================

import { escapeHtml } from "../utils.js";

// ============================================================================
// TOKENIZERS (palette-only highlighting via CSS classes)
// ============================================================================

const JS_KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "of", "in", "while",
  "new", "await", "async", "export", "import", "from", "class", "extends", "this", "null",
  "undefined", "true", "false", "typeof", "instanceof", "continue", "break", "try", "catch",
  "throw", "switch", "case", "default",
]);

const JS_RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)|([{}()[\];,.=<>!+\-*/%&|?:]+)/g;

export function tokenizeJs(src) {
  const tokens = [];
  let last = 0;
  for (const m of src.matchAll(JS_RE)) {
    if (m.index > last) tokens.push(["", src.slice(last, m.index)]);
    const [text, comment, string, number, fnName, ident] = m;
    let cls = "p";
    if (comment) cls = "c";
    else if (string) cls = "s";
    else if (number) cls = "n";
    else if (fnName) cls = JS_KEYWORDS.has(fnName) ? "k" : "f";
    else if (ident) cls = JS_KEYWORDS.has(ident) ? "k" : "i";
    tokens.push([cls, text]);
    last = m.index + text.length;
  }
  if (last < src.length) tokens.push(["", src.slice(last)]);
  return tokens;
}

const HTML_RE = /(<\/?)([a-zA-Z][\w-]*)|([\w-:]+)(=)("[^"]*")|(\/?>)|([^<]+)/g;

export function tokenizeHtml(src) {
  const tokens = [];
  for (const m of src.matchAll(HTML_RE)) {
    const [, open, tag, attr, eq, value, close, text] = m;
    if (tag) tokens.push(["p", open], ["k", tag]);
    else if (attr) tokens.push(["f", attr], ["p", eq], ["s", value]);
    else if (close) tokens.push(["p", close]);
    else if (text) tokens.push(["", text]);
  }
  return tokens;
}

/** Indents serialized HTML one element per line, truncating long text. */
export function prettyHtml(el, maxLines = 120) {
  const lines = [];
  const walk = (node, depth) => {
    if (lines.length > maxLines) return;
    const pad = "  ".repeat(depth);
    if (node.nodeType === 3) {
      const t = node.textContent.trim().replace(/\s+/g, " ");
      if (t) lines.push(pad + (t.length > 60 ? `${t.slice(0, 57)}…` : t));
      return;
    }
    if (node.nodeType !== 1 || node.tagName === "svg") {
      if (node.tagName === "svg") lines.push(`${pad}<svg …/>`);
      return;
    }
    const attrs = [...node.attributes]
      .filter((a) => !a.name.startsWith("aria-") || a.name === "aria-label")
      .map((a) => ` ${a.name}="${a.value.length > 40 ? `${a.value.slice(0, 37)}…` : a.value}"`)
      .join("");
    const tag = node.tagName.toLowerCase();
    if (!node.childNodes.length) {
      lines.push(`${pad}<${tag}${attrs}></${tag}>`);
      return;
    }
    lines.push(`${pad}<${tag}${attrs}>`);
    node.childNodes.forEach((c) => walk(c, depth + 1));
    lines.push(`${pad}</${tag}>`);
  };
  walk(el, 0);
  if (lines.length > maxLines) lines.length = maxLines, lines.push("  …");
  return lines.join("\n");
}

// ============================================================================
// PANEL
// ============================================================================

const active = new Set();

/** Finishes every running reveal immediately. */
export function finishAllReveals() {
  for (const reveal of [...active]) reveal.finish();
}

/**
 * Types `source` over `target`, then reveals target.
 * @returns {Promise<void>}
 */
export function revealWithCode(target, { source, lang = "js", title = "", speed = 1, maxSeconds = 1.6 }) {
  return new Promise((resolve) => {
    const tokens = lang === "html" ? tokenizeHtml(source) : tokenizeJs(source);
    const total = tokens.reduce((n, [, t]) => n + t.length, 0);

    const panel = document.createElement("div");
    panel.className = "code-reveal";
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `<div class="code-reveal-bar"><span></span><span></span><span></span><em>${escapeHtml(title)}</em></div><pre class="code-reveal-pre"><code></code><i class="code-reveal-caret"></i></pre>`;
    const code = panel.querySelector("code");
    const pre = panel.querySelector("pre");

    target.classList.add("code-reveal-host", "is-typing");
    target.appendChild(panel);

    const frames = Math.max(12, (maxSeconds * 60) / speed);
    const perFrame = Math.max(1, Math.ceil(total / frames));
    let tokenIndex = 0;
    let charIndex = 0;
    let span = null;
    let raf = 0;
    let done = false;

    function step() {
      let budget = perFrame;
      while (budget > 0 && tokenIndex < tokens.length) {
        const [cls, text] = tokens[tokenIndex];
        if (charIndex === 0) {
          span = document.createElement("span");
          if (cls) span.className = `tk-${cls}`;
          code.appendChild(span);
        }
        const take = Math.min(budget, text.length - charIndex);
        span.textContent += text.slice(charIndex, charIndex + take);
        charIndex += take;
        budget -= take;
        if (charIndex >= text.length) {
          tokenIndex++;
          charIndex = 0;
        }
      }
      pre.scrollTop = pre.scrollHeight;
      if (tokenIndex < tokens.length) raf = requestAnimationFrame(step);
      else setTimeout(finish, 180);
    }

    function finish() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      clearTimeout(watchdog);
      active.delete(reveal);
      target.classList.remove("is-typing");
      panel.classList.add("is-leaving");
      target.classList.add("is-revealed");
      setTimeout(() => {
        panel.remove();
        target.classList.remove("code-reveal-host");
        resolve();
      }, 450);
    }

    const reveal = { finish };
    active.add(reveal);
    panel.addEventListener("click", finishAllReveals);
    raf = requestAnimationFrame(step);
    // Safety net: if animation frames stall (throttled tab, embedded view),
    // never leave the section hidden.
    const watchdog = setTimeout(finish, (maxSeconds / speed) * 1000 * 2 + 1500);
  });
}
