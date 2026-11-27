// ============================================================================
// ON-PAGE EDITING — text shown on the portfolio is typed right where it is.
// An element becomes contenteditable (plain text only) while editing; the
// value is committed on blur or Enter, Escape undoes the current change.
// Values that aren't plain text (dates, links, images, locations) stay in the
// item's Edit form.
// ============================================================================

const PLAINTEXT = (() => {
  try {
    const el = document.createElement("div");
    el.contentEditable = "plaintext-only";
    return el.contentEditable === "plaintext-only";
  } catch {
    return false;
  }
})();

/**
 * Makes `el` editable in place.
 * @param {HTMLElement} el
 * @param {object} o
 * @param {() => string} o.read                 the raw value (the page may show it formatted)
 * @param {(value: string) => void} o.write     commits a changed value
 * @param {string} [o.placeholder]
 * @param {boolean} [o.multiline]               Shift+Enter or Enter adds a line
 * @param {() => void} [o.onEnter]              Enter in a single-line field, after committing
 * @param {() => void} [o.onRemoveEmpty]        Backspace in an empty field
 */
export function editInPlace(el, { read, write, placeholder = "", multiline = false, onEnter = null, onRemoveEmpty = null }) {
  if (!el || el.dataset.inline) return;
  el.dataset.inline = "1";
  el.contentEditable = PLAINTEXT ? "plaintext-only" : "true";
  el.spellcheck = true;
  el.tabIndex = 0;
  el.setAttribute("role", "textbox");
  if (multiline) el.setAttribute("aria-multiline", "true");
  if (placeholder) el.dataset.placeholder = placeholder;
  el.classList.add("ed-inline");
  const empty = () => el.classList.toggle("is-empty", !el.textContent.trim());
  empty();

  let start = "";
  el.addEventListener("focus", () => {
    start = String(read() ?? "");
    // Show the raw value (no link, icon or formatting) while it's being typed
    if (el.textContent !== start || el.children.length) el.textContent = start;
    empty();
  });
  el.addEventListener("input", empty);
  el.addEventListener("paste", (e) => {
    if (PLAINTEXT) return;
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  });
  // Links inside an editable field shouldn't navigate while editing
  el.addEventListener("click", (e) => {
    if (e.target.closest("a")) e.preventDefault();
  });

  let cancelled = false;
  let entered = false;
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelled = true;
      el.textContent = start;
      el.blur();
    } else if (e.key === "Enter" && !(multiline && e.shiftKey)) {
      if (multiline && !onEnter) return;
      e.preventDefault();
      entered = Boolean(onEnter);
      el.blur();
    } else if (e.key === "Backspace" && onRemoveEmpty && !el.textContent) {
      e.preventDefault();
      cancelled = true;
      el.blur();
      onRemoveEmpty();
    }
  });
  el.addEventListener("blur", () => {
    const value = el.innerText.replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim();
    const wasCancelled = cancelled;
    const wasEntered = entered;
    cancelled = false;
    entered = false;
    if (wasCancelled) return;
    if (value !== start.trim()) write(multiline ? value : value.replace(/\s*\n\s*/g, " "));
    if (wasEntered) onEnter();
  });
}

/** Focuses the editable element matching `selector` once the page has re-rendered. */
export function focusLater(selector, { atEnd = true, tries = 20 } = {}) {
  const attempt = (n) => {
    const el = document.querySelector(selector);
    if (el) {
      el.focus();
      if (atEnd) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else if (n > 0) requestAnimationFrame(() => attempt(n - 1));
  };
  requestAnimationFrame(() => attempt(tries));
}
