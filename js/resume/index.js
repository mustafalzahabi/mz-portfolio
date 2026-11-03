// ============================================================================
// RESUME RENDERING, OVERLAY & PREVIEW CARD
// Native JSON Resume theme rendering (js/resume/themes/*) with a remote
// registry fallback, an accessible full-screen viewer and a preview card.
// ============================================================================

import { normalizeThemeName } from "./helpers.js";

// ============================================================================
// THEMES
// ============================================================================

export const CURATED_THEMES = [
  { name: "even", label: "Even" },
  { name: "elegant", label: "Elegant" },
  { name: "flat", label: "Flat" },
  { name: "kendall", label: "Kendall" },
  { name: "stackoverflow", label: "Stack Overflow" },
  { name: "macchiato", label: "Macchiato" },
  { name: "onepage", label: "One Page" },
  { name: "professional", label: "Professional" },
];

const CURATED_NAMES = new Set(CURATED_THEMES.map((theme) => theme.name));
const REGISTRY_URL = "https://registry.jsonresume.org/theme/";
const REMOTE_TIMEOUT_MS = 8000;

async function renderNative(resume, name) {
  const module = await import(`./themes/${name}.js`);
  return module.default.render(resume);
}

async function renderRemote(resume, name) {
  if (typeof fetch !== "function") return "";
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS) : null;
  try {
    const response = await fetch(REGISTRY_URL + encodeURIComponent(name), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resume),
      signal: controller ? controller.signal : undefined,
    });
    if (!response.ok) return "";
    const html = await response.text();
    return html && html.trim() ? html : "";
  } catch (error) {
    console.warn(`[resume] Remote theme "${name}" failed:`, error);
    return "";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Renders a resume with the given theme.
 * Curated themes render natively; other names are tried against the JSON
 * Resume registry, falling back to "even" with a notice.
 * @returns {Promise<{html: string, theme: string, native: boolean, notice?: string}>}
 */
export async function renderResume(resume, themeName) {
  const name = normalizeThemeName(themeName);
  if (CURATED_NAMES.has(name)) {
    return { html: await renderNative(resume, name), theme: name, native: true, notice: "" };
  }
  const html = await renderRemote(resume, name);
  if (html) return { html, theme: name, native: false, notice: "" };
  return {
    html: await renderNative(resume, "even"),
    theme: "even",
    native: true,
    notice: `Theme "${name}" isn't available, showing "even" instead.`,
  };
}

// ============================================================================
// ICONS (static markup only, never mixed with resume data)
// ============================================================================

const SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

const ICONS = {
  file: `<svg ${SVG_ATTRS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  print: `<svg ${SVG_ATTRS}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
  download: `<svg ${SVG_ATTRS}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  close: `<svg ${SVG_ATTRS}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  palette: `<svg ${SVG_ATTRS}><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
};

function iconSpan(name, className) {
  const span = document.createElement("span");
  span.className = className;
  span.innerHTML = ICONS[name];
  return span;
}

function toolbarButton(iconName, label, ariaLabel) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "resume-overlay-btn";
  button.setAttribute("aria-label", ariaLabel);
  const text = document.createElement("span");
  text.className = "resume-overlay-btn-label";
  text.textContent = label;
  button.append(iconSpan(iconName, "resume-overlay-btn-icon"), text);
  return button;
}

// ============================================================================
// OVERLAY
// ============================================================================

const FOCUSABLE = 'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';
let overlayCount = 0;

/**
 * Opens the resume in an accessible modal viewer.
 * @param {object} resume JSON Resume object
 * @param {{theme?: string, allowDownload?: boolean, allowPrint?: boolean, onClose?: Function}} opts
 * @returns {Function} close()
 */
export function openResumeOverlay(resume, opts = {}) {
  const { allowDownload = true, allowPrint = true, onClose } = opts;
  const requestedTheme = normalizeThemeName(opts.theme || resume?.meta?.theme);
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const previousOverflow = document.body.style.overflow;
  const titleId = `resume-overlay-title-${++overlayCount}`;
  const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ==== Structure ====
  const overlay = document.createElement("div");
  overlay.className = "resume-overlay";

  const backdrop = document.createElement("div");
  backdrop.className = "resume-overlay-backdrop";

  const dialog = document.createElement("div");
  dialog.className = "resume-overlay-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", titleId);
  dialog.tabIndex = -1;

  const toolbar = document.createElement("div");
  toolbar.className = "resume-overlay-toolbar";

  const title = document.createElement("h2");
  title.className = "resume-overlay-title";
  title.id = titleId;
  title.textContent = resume?.basics?.name ? `Resume — ${resume.basics.name}` : "Resume";

  const actions = document.createElement("div");
  actions.className = "resume-overlay-actions";

  // ==== Theme picker ====
  const selectWrap = document.createElement("label");
  selectWrap.className = "resume-overlay-select";
  const selectLabel = document.createElement("span");
  selectLabel.className = "resume-visually-hidden";
  selectLabel.textContent = "Resume theme";
  const select = document.createElement("select");
  select.className = "resume-overlay-select-input";
  const themes = CURATED_NAMES.has(requestedTheme)
    ? CURATED_THEMES
    : [...CURATED_THEMES, { name: requestedTheme, label: `${requestedTheme} (registry)` }];
  for (const theme of themes) {
    const option = document.createElement("option");
    option.value = theme.name;
    option.textContent = theme.label;
    select.appendChild(option);
  }
  select.value = requestedTheme;
  selectWrap.append(iconSpan("palette", "resume-overlay-select-icon"), selectLabel, select);
  actions.appendChild(selectWrap);

  const printBtn = allowPrint ? toolbarButton("print", "Print / PDF", "Print or save as PDF") : null;
  const downloadBtn = allowDownload ? toolbarButton("download", "resume.json", "Download resume.json") : null;
  const closeBtn = toolbarButton("close", "Close", "Close resume");
  closeBtn.classList.add("resume-overlay-close");
  [printBtn, downloadBtn, closeBtn].filter(Boolean).forEach((btn) => actions.appendChild(btn));

  toolbar.append(title, actions);

  const status = document.createElement("p");
  status.className = "resume-overlay-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const frameWrap = document.createElement("div");
  frameWrap.className = "resume-overlay-frame-wrap";
  const frame = document.createElement("iframe");
  frame.className = "resume-overlay-frame";
  frame.title = "Resume document";
  frameWrap.appendChild(frame);

  dialog.append(toolbar, status, frameWrap);
  overlay.append(backdrop, dialog);

  // ==== Status ====
  function setStatus(message, kind = "") {
    status.textContent = message;
    status.className = `resume-overlay-status${kind ? ` is-${kind}` : ""}`;
    status.hidden = !message;
  }

  // ==== Rendering ====
  let renderToken = 0;
  let canPrint = false;

  function setPrintable(printable) {
    canPrint = printable;
    if (!printBtn) return;
    printBtn.disabled = !printable;
    if (printable) printBtn.removeAttribute("title");
    else printBtn.title = "Printing isn't available for themes rendered by the remote registry";
  }

  async function load(themeName) {
    const token = ++renderToken;
    setStatus(`Loading theme "${themeName}"…`, "loading");
    dialog.setAttribute("aria-busy", "true");
    setPrintable(false);
    try {
      const result = await renderResume(resume, themeName);
      if (token !== renderToken) return;
      // Native output is our own escaped markup: same-origin so the parent can
      // print it, but never scripts. Remote HTML gets an opaque origin.
      frame.setAttribute("sandbox", result.native ? "allow-same-origin allow-modals" : "allow-modals");
      frame.srcdoc = result.html;
      setPrintable(result.native);
      setStatus(result.notice || "", result.notice ? "warning" : "");
    } catch (error) {
      if (token !== renderToken) return;
      console.warn("[resume] Failed to render resume:", error);
      setStatus("The resume couldn't be rendered.", "error");
    } finally {
      if (token === renderToken) dialog.removeAttribute("aria-busy");
    }
  }

  select.addEventListener("change", () => load(select.value));

  printBtn?.addEventListener("click", () => {
    if (!canPrint) return;
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (error) {
      console.warn("[resume] Print failed:", error);
      setStatus("Printing isn't available in this browser.", "error");
    }
  });

  downloadBtn?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(resume, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "resume.json";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // ==== Keyboard: Escape + focus trap (one listener) ====
  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => !el.hidden && el.offsetParent !== null);
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  // ==== Close ====
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    renderToken++;
    document.removeEventListener("keydown", onKeydown);
    document.body.style.overflow = previousOverflow;
    overlay.classList.remove("is-open");
    overlay.classList.add("is-closing");
    const remove = () => overlay.remove();
    if (reduceMotion) remove();
    else setTimeout(remove, 200);
    if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    if (typeof onClose === "function") onClose();
  }

  backdrop.addEventListener("click", close);
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", onKeydown);

  // ==== Mount ====
  document.body.style.overflow = "hidden";
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("is-open"));
  closeBtn.focus();
  load(requestedTheme);

  return close;
}

// ============================================================================
// PREVIEW CARD
// ============================================================================

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Builds the resume preview card.
 * @param {object} resume JSON Resume object
 * @param {{theme?: string, allowDownload?: boolean, allowPrint?: boolean, onClose?: Function, onOpen?: Function}} opts
 *   When opts.onOpen is provided the button calls it instead of opening the overlay.
 */
export function buildResumePreview(resume, opts = {}) {
  const card = document.createElement("div");
  card.className = "resume-preview card";

  const header = document.createElement("div");
  header.className = "resume-preview-header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "resume-preview-title-group";

  const title = document.createElement("h3");
  title.className = "resume-preview-title";
  title.textContent = "Resume";

  const subtitle = document.createElement("p");
  subtitle.className = "resume-preview-subtitle";
  const name = typeof resume?.basics?.name === "string" ? resume.basics.name : "";
  const label = typeof resume?.basics?.label === "string" ? resume.basics.label : "";
  subtitle.textContent = [name, label].filter(Boolean).join(" — ") || "JSON Resume";

  titleGroup.append(title, subtitle);
  header.append(iconSpan("file", "resume-preview-icon"), titleGroup);
  card.appendChild(header);

  const count = (value) => (Array.isArray(value) ? value.length : 0);
  const stats = [
    count(resume?.work) && plural(count(resume.work), "role"),
    count(resume?.education) && plural(count(resume.education), "degree"),
    count(resume?.skills) && plural(count(resume.skills), "skill group"),
  ].filter(Boolean);
  if (stats.length) {
    const statText = document.createElement("p");
    statText.className = "resume-preview-stats";
    statText.textContent = stats.join(" · ");
    card.appendChild(statText);
  }

  const viewBtn = document.createElement("button");
  viewBtn.type = "button";
  viewBtn.className = "resume-preview-btn btn btn-primary";
  viewBtn.textContent = "View resume";
  viewBtn.addEventListener("click", () => {
    if (typeof opts.onOpen === "function") opts.onOpen();
    else openResumeOverlay(resume, opts);
  });
  card.appendChild(viewBtn);

  return card;
}
