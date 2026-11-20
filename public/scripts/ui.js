// ============================================================================
// UI CONTROLS — custom dropdown that looks the same in every browser.
// A button (role=combobox) opens a listbox. Keyboard: ↑/↓, Home/End,
// Enter/Space to pick, Escape to close, letters jump to matching options.
// ============================================================================

import { h, svgIcon } from "./utils.js";
import { ICONS } from "./icons.js";

let uid = 0;

/**
 * options: [{ value, label, hint? }] (or plain strings).
 * Returns a wrapper element; wrapper.value reads the current value.
 */
export function selectMenu({ options, value, onChange, placeholder = "Choose…" }) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const id = `ui-select-${++uid}`;
  let current = value;
  let active = Math.max(0, opts.findIndex((o) => o.value === current));

  const labelEl = h("span.ui-select-label");
  const button = h("button.ui-select-button", {
    type: "button",
    role: "combobox",
    "aria-haspopup": "listbox",
    "aria-expanded": "false",
    "aria-controls": `${id}-list`,
  }, labelEl, svgIcon(ICONS.chevronDown));
  const list = h("ul.ui-select-list", { id: `${id}-list`, role: "listbox", tabindex: "-1", hidden: true });
  const wrap = h("div.ui-select", button, list);

  const items = opts.map((o, i) => {
    const li = h("li.ui-select-option", { id: `${id}-o${i}`, role: "option", "aria-selected": "false" },
      h("span.ui-select-option-text", h("span", o.label), o.hint ? h("span.ui-select-hint", o.hint) : null),
      svgIcon(ICONS.check),
    );
    li.addEventListener("pointerdown", (e) => e.preventDefault()); // keep focus on the button
    li.addEventListener("click", () => pick(i));
    li.addEventListener("pointermove", () => setActive(i, false));
    return li;
  });
  list.append(...items);

  function sync() {
    const sel = opts.find((o) => o.value === current);
    labelEl.textContent = sel ? sel.label : placeholder;
    labelEl.classList.toggle("is-placeholder", !sel);
    items.forEach((li, i) => li.setAttribute("aria-selected", String(opts[i].value === current)));
  }

  function setActive(i, scroll = true) {
    active = (i + opts.length) % opts.length;
    items.forEach((li, j) => li.classList.toggle("is-active", j === active));
    button.setAttribute("aria-activedescendant", items[active].id);
    if (scroll) items[active].scrollIntoView({ block: "nearest" });
  }

  const onDoc = (e) => {
    if (!wrap.contains(e.target)) close();
  };

  function open() {
    if (!list.hidden) return;
    list.hidden = false;
    wrap.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
    // Open upwards when there's no room below
    const r = button.getBoundingClientRect();
    wrap.classList.toggle("is-up", innerHeight - r.bottom < 260 && r.top > innerHeight - r.bottom);
    setActive(Math.max(0, opts.findIndex((o) => o.value === current)));
    document.addEventListener("pointerdown", onDoc);
  }

  function close() {
    if (list.hidden) return;
    list.hidden = true;
    wrap.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
    button.removeAttribute("aria-activedescendant");
    document.removeEventListener("pointerdown", onDoc);
  }

  function pick(i) {
    const next = opts[i].value;
    close();
    button.focus();
    if (next === current) return;
    current = next;
    sync();
    onChange?.(next);
  }

  let typed = "";
  let typedAt = 0;
  button.addEventListener("click", () => (list.hidden ? open() : close()));
  button.addEventListener("keydown", (e) => {
    const isOpen = !list.hidden;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        if (!isOpen) open();
        else setActive(active + (e.key === "ArrowDown" ? 1 : -1));
        return;
      case "Home":
      case "End":
        if (!isOpen) return;
        e.preventDefault();
        setActive(e.key === "Home" ? 0 : opts.length - 1);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (isOpen) pick(active);
        else open();
        return;
      case "Escape":
        if (isOpen) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        return;
      case "Tab":
        close();
        return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const now = Date.now();
          typed = now - typedAt > 700 ? e.key.toLowerCase() : typed + e.key.toLowerCase();
          typedAt = now;
          const i = opts.findIndex((o) => String(o.label).toLowerCase().startsWith(typed));
          if (i < 0) return;
          if (isOpen) setActive(i);
          else pick(i);
        }
    }
  });

  Object.defineProperty(wrap, "value", { get: () => current });
  wrap.control = button; // what a <label for> should point at
  sync();
  return wrap;
}
