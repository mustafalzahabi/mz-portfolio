// ============================================================================
// MARKDOWN EDITOR — a textarea with the formatting toolbar (bold, italic,
// heading, link, code, lists, quote, image; Ctrl+B / I / K) and a live
// preview. Shared by the README editor; the post editor uses the same pieces.
// ============================================================================

import { h } from "../utils.js";
import { applyMarkdown } from "../editor-core.js";
import { MD_ACTIONS, iconButton } from "./core.js";

/**
 * @param {object} o
 * @param {string} o.value               starting text
 * @param {(text) => string} o.toHtml    preview renderer (already sanitized HTML)
 * @param {(text) => void} [o.onInput]
 * @returns {{ el, textarea, preview, refresh }}
 */
export function markdownEditor({ value = "", toHtml, onInput = () => {}, label = "Markdown" }) {
  const textarea = h("textarea.input.ed-md-text", { spellcheck: "true", "aria-label": label });
  textarea.value = value;
  const preview = h("div.prose.card.ed-md-preview", { "aria-live": "off" });
  let timer = null;
  const refresh = () => {
    preview.innerHTML = toHtml(textarea.value || "*Nothing written yet.*");
  };
  textarea.addEventListener("input", () => {
    onInput(textarea.value);
    clearTimeout(timer);
    timer = setTimeout(refresh, 150);
  });
  const run = (action) => {
    const r = applyMarkdown(textarea.value, textarea.selectionStart, textarea.selectionEnd, action);
    textarea.value = r.text;
    textarea.focus();
    textarea.setSelectionRange(r.start, r.end);
    textarea.dispatchEvent(new Event("input"));
  };
  textarea.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const action = { b: "bold", i: "italic", k: "link" }[e.key.toLowerCase()];
    if (action) {
      e.preventDefault();
      run(action);
    }
  });
  const toolbar = h("div.ed-md-toolbar", { role: "toolbar", "aria-label": "Formatting" },
    MD_ACTIONS.map(([action, text, icon]) => {
      const b = iconButton(icon, text, () => run(action));
      if (action === "ordered") b.replaceChildren(h("span.ed-ol", "1."));
      return b;
    }));

  // Phones: Write / Preview tabs. Wide screens: side by side (CSS).
  const tabs = h("div.md-tabs", { role: "tablist" },
    ["Write", "Preview"].map((name, i) => h("button.md-tab", {
      type: "button", role: "tab", "aria-selected": i === 0 ? "true" : "false",
      onclick: (e) => {
        for (const t of tabs.children) t.setAttribute("aria-selected", String(t === e.currentTarget));
        el.dataset.view = name.toLowerCase();
        if (name === "Preview") refresh();
      },
    }, name)));
  const el = h("div.md-editor", { dataset: { view: "write" } },
    tabs,
    h("div.md-panes", h("div.md-write", toolbar, textarea), h("div.md-preview", preview)));
  refresh();
  return { el, textarea, preview, refresh };
}
