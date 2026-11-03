// ============================================================================
// THEME MANAGEMENT — auto / light / dark
// Colors come from css/tokens.css (TwOP light-dark() outputs); this module only
// sets data-theme + color-scheme on <html>. A visitor's explicit choice is
// remembered; otherwise the portfolio owner's theme.mode default applies.
// ============================================================================

import { ICONS } from "./icons.js";

const STORAGE_KEY = "mz-theme";
const MODES = ["auto", "light", "dark"];
let ownerDefault = "auto";

const darkQuery = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("theme");
    return MODES.includes(v) ? v : null;
  } catch {
    return null;
  }
}

export function getThemeMode() {
  return readStored() || ownerDefault;
}

export function getEffectiveScheme(mode = getThemeMode()) {
  if (mode === "auto") return darkQuery?.matches ? "dark" : "light";
  return mode;
}

export function applyTheme(mode, { persist = true } = {}) {
  if (!MODES.includes(mode)) mode = "auto";
  const root = document.documentElement;
  const scheme = getEffectiveScheme(mode);
  if (mode === "auto") {
    delete root.dataset.theme;
    root.style.colorScheme = "";
  } else {
    root.dataset.theme = scheme;
    root.style.colorScheme = scheme;
  }
  root.dataset.scheme = scheme;
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
      localStorage.removeItem("theme");
    } catch {
      /* storage unavailable */
    }
  }
  document.dispatchEvent(new CustomEvent("mz-themechange", { detail: { mode, scheme } }));
}

export function initTheme() {
  applyTheme(getThemeMode(), { persist: false });
  darkQuery?.addEventListener("change", () => {
    if (getThemeMode() === "auto") applyTheme("auto", { persist: false });
  });
}

/** Sets the portfolio owner's default (used when the visitor hasn't chosen). */
export function setOwnerDefault(mode) {
  ownerDefault = MODES.includes(mode) ? mode : "auto";
  applyTheme(getThemeMode(), { persist: false });
}

function nextMode(mode) {
  return MODES[(MODES.indexOf(mode) + 1) % MODES.length];
}

const MODE_LABEL = { auto: "Theme: automatic", light: "Theme: light", dark: "Theme: dark" };

// ============================================================================
// TOGGLE BUILDERS — "switch" | "icon" | "slider" | "none"
// ============================================================================

export function buildThemeToggle(style = "switch") {
  if (style === "none") return null;
  if (style === "icon") return buildIconToggle();
  if (style === "slider") return buildSegmentedToggle();
  return buildSwitchToggle();
}

function onThemeChange(el, update) {
  update();
  const handler = () => (el.isConnected ? update() : document.removeEventListener("mz-themechange", handler));
  document.addEventListener("mz-themechange", handler);
}

// Icon button: cycles auto → light → dark
function buildIconToggle() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "theme-toggle theme-toggle--icon";
  const update = () => {
    const mode = getThemeMode();
    btn.innerHTML = ICONS[mode === "auto" ? "auto" : mode === "dark" ? "moon" : "sun"];
    btn.setAttribute("aria-label", `${MODE_LABEL[mode]}. Click to change.`);
    btn.title = MODE_LABEL[mode];
  };
  btn.addEventListener("click", () => applyTheme(nextMode(getThemeMode())));
  onThemeChange(btn, update);
  return btn;
}

// Segmented control: three radio buttons
function buildSegmentedToggle() {
  const group = document.createElement("div");
  group.className = "theme-toggle theme-toggle--slider";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", "Color theme");
  const buttons = MODES.map((mode) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.dataset.mode = mode;
    b.innerHTML = ICONS[mode === "auto" ? "auto" : mode === "dark" ? "moon" : "sun"];
    b.setAttribute("aria-label", mode[0].toUpperCase() + mode.slice(1));
    b.title = MODE_LABEL[mode];
    b.addEventListener("click", () => applyTheme(mode));
    group.appendChild(b);
    return b;
  });
  group.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = MODES.indexOf(getThemeMode());
    const mode = MODES[(i + (e.key === "ArrowRight" ? 1 : MODES.length - 1)) % MODES.length];
    applyTheme(mode);
    buttons[MODES.indexOf(mode)].focus();
  });
  onThemeChange(group, () => {
    const mode = getThemeMode();
    buttons.forEach((b) => {
      const on = b.dataset.mode === mode;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    group.dataset.mode = mode;
  });
  return group;
}

// Draggable switch: drag/tap left = dark, right = light, throw it off = auto
function buildSwitchToggle() {
  const wrap = document.createElement("div");
  wrap.className = "theme-toggle theme-toggle--switch";

  const track = document.createElement("div");
  track.className = "theme-switch-track";
  track.setAttribute("role", "switch");
  track.tabIndex = 0;

  const knob = document.createElement("div");
  knob.className = "theme-switch-knob";
  knob.innerHTML = `<span class="theme-icon theme-icon-moon">${ICONS.moon}</span><span class="theme-icon theme-icon-sun">${ICONS.sun}</span>`;
  track.appendChild(knob);
  wrap.appendChild(track);

  const maxTranslate = () => Math.max(0, track.clientWidth - knob.offsetWidth - 4);
  const place = (x, y = 0, animate = true) => {
    knob.style.transition = animate ? "" : "none";
    knob.style.transform = `translate(${x}px, ${y}px)`;
  };

  const update = () => {
    const mode = getThemeMode();
    const scheme = getEffectiveScheme(mode);
    knob.dataset.mode = scheme;
    knob.classList.toggle("auto-mode", mode === "auto");
    track.setAttribute("aria-checked", String(scheme === "light"));
    track.setAttribute("aria-label", `${MODE_LABEL[mode]}. Press to switch; press A for automatic.`);
    track.title = MODE_LABEL[mode];
    place(scheme === "light" ? maxTranslate() : 0);
  };

  let drag = null;
  knob.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, start: getEffectiveScheme() === "light" ? maxTranslate() : 0, dx: 0, dy: 0, moved: false };
    knob.setPointerCapture?.(e.pointerId);
    knob.classList.add("dragging");
    e.preventDefault();
  });
  knob.addEventListener("pointermove", (e) => {
    if (!drag) return;
    drag.dx = e.clientX - drag.x;
    drag.dy = e.clientY - drag.y;
    if (Math.abs(drag.dx) > 3 || Math.abs(drag.dy) > 3) drag.moved = true;
    const pos = drag.start + drag.dx;
    const escaped = pos < -12 || pos > maxTranslate() + 12;
    place(pos, escaped ? drag.dy : 0, false);
  });
  const end = () => {
    if (!drag) return;
    knob.classList.remove("dragging");
    const { moved, start, dx, dy } = drag;
    drag = null;
    if (!moved) {
      applyTheme(getEffectiveScheme() === "light" ? "dark" : "light");
      return;
    }
    const pos = start + dx;
    const thrown = pos < -40 || pos > maxTranslate() + 40 || Math.abs(dy) > 24;
    applyTheme(thrown ? "auto" : pos > maxTranslate() / 2 ? "light" : "dark");
  };
  knob.addEventListener("pointerup", end);
  knob.addEventListener("pointercancel", end);

  track.addEventListener("click", (e) => {
    if (e.target.closest(".theme-switch-knob")) return;
    applyTheme(getEffectiveScheme() === "light" ? "dark" : "light");
  });
  track.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      applyTheme(getEffectiveScheme() === "light" ? "dark" : "light");
    } else if (e.key === "ArrowRight") applyTheme("light");
    else if (e.key === "ArrowLeft") applyTheme("dark");
    else if (e.key.toLowerCase() === "a") applyTheme("auto");
  });

  onThemeChange(wrap, update);
  // Size is known only once attached
  requestAnimationFrame(update);
  if (typeof ResizeObserver === "function") new ResizeObserver(() => !drag && update()).observe(track);
  return wrap;
}
