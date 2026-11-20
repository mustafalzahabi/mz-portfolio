// ============================================================================
// SHEET — the one editing panel. Phones: a bottom sheet (drag the handle or
// swipe down to close). Desktop (≥900px): a side panel; the page moves left
// so the live result stays visible. Only one sheet is open at a time.
// ============================================================================

import { h, svgIcon } from "../utils.js";
import { ICONS } from "../icons.js";

let current = null;

/**
 * render(): returns the body nodes (called again by refresh()).
 * actions: optional footer nodes. onClose: called after closing.
 * Returns { el, body, refresh, close }.
 */
export function openSheet({ title, subtitle = "", render, actions = null, onClose = null, wide = false }) {
  closeSheet();
  const body = h("div.sheet-body");
  const close = () => closeSheet();
  const handle = h("div.sheet-handle", { "aria-hidden": "true" });
  const el = h(`aside.sheet${wide ? ".is-wide" : ""}`, { role: "dialog", "aria-modal": "false", "aria-label": title },
    handle,
    h("header.sheet-head",
      h("div.sheet-titles", h("strong.sheet-title", title), subtitle ? h("span.sheet-subtitle", subtitle) : null),
      h("button.sheet-close", { type: "button", "aria-label": "Close", title: "Close", onclick: close }, svgIcon(ICONS.close)),
    ),
    body,
    actions ? h("footer.sheet-foot", actions) : null,
  );
  const refresh = () => body.replaceChildren(...[].concat(render()).filter(Boolean));
  refresh();

  // Swipe the handle down to close (phones)
  let startY = null;
  handle.addEventListener("pointerdown", (e) => {
    startY = e.clientY;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener("pointermove", (e) => {
    if (startY === null) return;
    el.style.transform = `translateY(${Math.max(0, e.clientY - startY)}px)`;
  });
  handle.addEventListener("pointerup", (e) => {
    const moved = e.clientY - (startY ?? e.clientY);
    startY = null;
    el.style.transform = "";
    if (moved > 90) close();
  });

  const onKey = (e) => {
    if (e.key === "Escape" && !document.querySelector("dialog[open]") && !e.target.closest?.(".ui-select.is-open")) close();
  };
  document.addEventListener("keydown", onKey);
  document.body.appendChild(el);
  document.body.classList.add("has-sheet");
  current = { el, onClose, onKey, refresh };
  requestAnimationFrame(() => el.querySelector("input, textarea, button.ui-select-button, .sheet-body button")?.focus({ preventScroll: true }));
  return { el, body, refresh, close };
}

export function closeSheet() {
  if (!current) return;
  const { el, onClose, onKey } = current;
  current = null;
  document.removeEventListener("keydown", onKey);
  el.remove();
  document.body.classList.remove("has-sheet");
  onClose?.();
}

export const refreshSheet = () => current?.refresh();
export const sheetOpen = () => Boolean(current);
