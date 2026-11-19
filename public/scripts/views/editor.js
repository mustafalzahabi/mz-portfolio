// ============================================================================
// EDITOR (/edit) — edit a resume.json and the portfolio config with forms,
// see a live preview, and save to your own gist. Blog posts (.md gists) can be
// created, edited and deleted too. Without signing in, everything still works
// locally: copy or download the JSON instead of saving. Drafts are kept in this
// browser (localStorage) until saved or discarded.
// ============================================================================

import { h, svgIcon, toast, copyText, downloadFile, slugify, parseFrontmatter, readingTime } from "../utils.js";
import { ICONS, logoImg } from "../icons.js";
import { BASE_PATH } from "../router.js";
import { CONFIG_SCHEMA, DEFAULT_CONFIG, COLOR_TOKENS, normalizeConfig, migrateLegacy, isValidColor } from "../config.js";
import { validateResume } from "../merge.js";
import { parseResumeJson, getResumeFilename } from "../data.js";
import { fetchGistList, fetchText } from "../api.js";
import { markdownToHtml } from "../markdown.js";
import { checkPalette, darkHex } from "../palette.js";
import { CURATED_THEMES } from "../resume/index.js";
import { SECTIONS, BASICS_FIELDS, LOCATION_FIELDS, PROFILE_FIELDS, blankScaffold } from "../template.js";
import { getPath, setPath, isEmpty, prune, History, diffSummary, validateField, frontmatter, applyMarkdown } from "../editor-core.js";
import {
  TOKEN_HELP_URL, getToken, signIn, clearToken, currentUser, listMyGists, getGist, createGist,
  updateGist, deleteGist, gistFileText, forgetCachedPortfolio,
} from "../github.js";

const DRAFT_KEY = "mz-editor-draft";
const POST_DRAFT_KEY = "mz-editor-post-draft";
const PREVIEW_KEY = "mz-preview-json";
const DEVICES = [["phone", "Phone", "phoneDevice"], ["tablet", "Tablet", "tablet"], ["full", "Full width", "monitor"]];

// ============================================================================
// STATE
// ============================================================================

const ed = {
  user: null, // GitHub user when signed in
  resume: null,
  base: null, // last saved / loaded version (pruned), for "unsaved changes" + diff
  source: null, // { type: "gist", id, filename, updatedAt, url } | { type: "local" }
  savedAt: null,
  saving: false,
  tab: "resume",
  dirty: false,
  history: null,
  posts: null, // [{ gistId, filename, title, … }] once loaded
  post: null, // post being edited
  root: null,
  frame: null,
  device: "full",
  query: { resume: "", settings: "" },
  open: new Set(["basics", "settings:colors", "settings:theme"]), // expanded groups
};

const store = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

function ago(ts) {
  if (!ts) return "";
  const s = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const hrs = Math.round(m / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return new Date(ts).toLocaleDateString();
}

/** Starts editing a resume. base = the saved version (null when it isn't saved anywhere yet). */
function begin(resume, source, { base = null, savedAt = null } = {}) {
  ed.resume = resume;
  ed.source = source;
  ed.base = base;
  ed.savedAt = savedAt;
  ed.history = new History(resume);
  ed.post = null;
  ed.dirty = computeDirty();
  saveDraft();
}

/** A collapsible group whose open/closed state survives re-renders. */
function group(key, summaryChildren, body) {
  const d = h("details.ed-group", { open: ed.open.has(key) ? true : null, dataset: { key } }, h("summary", summaryChildren), body);
  d.addEventListener("toggle", () => (d.open ? ed.open.add(key) : ed.open.delete(key)));
  return d;
}

// ============================================================================
// CHANGE HANDLING
// ============================================================================

let previewTimer = null;

const snapshot = () => JSON.stringify(prune(ed.resume));

function computeDirty() {
  if (!ed.resume) return false;
  if (!ed.base) return !isEmpty(prune(ed.resume));
  return snapshot() !== JSON.stringify(ed.base);
}

/** Call after every edit. key = the field path, so typing merges into one undo step. */
function changed({ rerender = false, key = null } = {}) {
  ed.history?.push(ed.resume, key);
  afterChange();
  if (rerender) renderPanel();
}

function afterChange() {
  ed.dirty = computeDirty();
  saveDraft();
  updateStatus();
  clearTimeout(previewTimer);
  previewTimer = setTimeout(pushPreview, 250);
}

function undo() {
  const prev = ed.history?.undo();
  if (!prev) return;
  ed.resume = prev;
  afterChange();
  renderPanel({ keepFocus: true });
}

function redo() {
  const next = ed.history?.redo();
  if (!next) return;
  ed.resume = next;
  afterChange();
  renderPanel({ keepFocus: true });
}

function saveDraft() {
  if (!ed.resume) return;
  ed.draftFailed = !store.set(DRAFT_KEY, { resume: ed.resume, source: ed.source, base: ed.base, savedAt: ed.savedAt, editedAt: new Date().toISOString(), dirty: ed.dirty });
  if (ed.draftFailed) updateStatus("Draft too large to keep in this browser");
}

function readDraft() {
  const d = store.get(DRAFT_KEY);
  return d && d.resume && typeof d.resume === "object" ? d : null;
}

/** Sends the resume to the live-preview frame, which re-renders in place. */
function pushPreview() {
  if (!ed.resume) return;
  try {
    sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(ed.resume));
  } catch {
    /* too large — postMessage still updates the frame */
  }
  ed.frame?.contentWindow?.postMessage({ type: "mz-preview", resume: ed.resume }, location.origin);
}

function reloadPreview() {
  pushPreview();
  try {
    ed.frame.contentWindow.location.reload();
  } catch {
    ed.frame.src = ed.frame.src;
  }
}

// Drafts are kept in localStorage, so leaving only needs a warning when that failed.
function beforeUnload(e) {
  if (ed.dirty && ed.draftFailed && location.pathname.startsWith(`${BASE_PATH}edit`)) {
    e.preventDefault();
    e.returnValue = "";
  }
}

// ============================================================================
// INPUTS
// ============================================================================

let uid = 0;

function field(label, input, hint) {
  const id = `f${++uid}`;
  input.id = id;
  const error = h("p.ed-field-error", { id: `${id}-err`, "aria-live": "polite" });
  input.setAttribute("aria-describedby", `${id}-err`);
  return h("div.ed-field", h("label", { for: id }, label), input, hint ? h("p.ed-hint", hint) : null, error);
}

function showFieldError(input, message) {
  const err = document.getElementById(`${input.id}-err`);
  if (err) err.textContent = message;
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

/** Text-like input bound to resume[path]. kind: text | textarea | url | email | tel | date | list */
function boundInput(path, label, kind = "text", { onChange, placeholder } = {}) {
  const value = getPath(ed.resume, path);
  let input;
  if (kind === "textarea") {
    input = h("textarea.input", { rows: "4", placeholder });
    input.value = value ?? "";
  } else if (kind === "list") {
    input = h("textarea.input", { rows: "3", placeholder: placeholder || "One per line" });
    input.value = Array.isArray(value) ? value.join("\n") : value ?? "";
  } else {
    input = h("input.input", {
      type: kind === "date" ? "text" : kind,
      inputmode: kind === "date" ? "numeric" : null,
      autocomplete: "off",
      placeholder: placeholder || (kind === "date" ? "YYYY-MM" : null),
    });
    input.value = value ?? "";
  }
  input.dataset.path = path.join(".");
  const wrap = field(label, input, kind === "list" ? "One item per line." : null);
  const check = () => showFieldError(input, kind === "list" || kind === "textarea" ? "" : validateField(kind, input.value));
  input.addEventListener("input", () => {
    const v = kind === "list" ? input.value.split("\n").map((s) => s.trim()).filter(Boolean) : input.value;
    setPath(ed.resume, path, kind === "list" ? v : v.trim() === "" ? "" : v);
    onChange?.(v);
    changed({ key: input.dataset.path });
  });
  input.addEventListener("blur", check);
  if (input.value) check();
  return wrap;
}

function iconButton(icon, label, onclick, extra = "") {
  return h(`button.ed-icon-btn${extra}`, { type: "button", "aria-label": label, title: label, onclick }, svgIcon(ICONS[icon] || icon));
}

let drag = null; // { list: "work", from: 2 }

/** Editable list of objects (sections, profiles, tabs) with add / move / drag / duplicate / remove. */
function itemList({ path, fields, title, addLabel, noun = "item", newItem = () => ({}), renderFields }) {
  const listKey = path.join(".");
  const wrap = h("div.ed-items", { dataset: { path: listKey } });
  const items = getPath(ed.resume, path) || [];

  const move = (from, to) => {
    if (to < 0 || to >= items.length || from === to) return;
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    changed({ rerender: true });
  };

  items.forEach((item, i) => {
    const heading = h("span.ed-item-title", title(item) || `New ${noun}`);
    const handle = h("span.ed-grip", { title: "Drag to reorder", "aria-hidden": "true" }, svgIcon(ICONS.grip));
    const card = h("details.ed-item", { open: items.length === 1 ? true : null, dataset: { index: String(i) } },
      h("summary",
        handle,
        heading,
        h("span.ed-item-actions",
          iconButton("chevronUp", "Move up", (e) => { e.preventDefault(); move(i, i - 1); }),
          iconButton("chevronDown", "Move down", (e) => { e.preventDefault(); move(i, i + 1); }),
          iconButton("copy", "Duplicate", (e) => {
            e.preventDefault();
            items.splice(i + 1, 0, structuredClone(item));
            changed({ rerender: true });
          }),
          iconButton("close", "Remove", (e) => {
            e.preventDefault();
            if (isEmpty(prune(item)) || confirm(`Remove "${title(item) || `this ${noun}`}"?`)) {
              items.splice(i, 1);
              setPath(ed.resume, path, items.length ? items : []);
              changed({ rerender: true });
            }
          }, ".danger"),
        ),
      ),
    );

    // Drag to reorder (pointer devices; the arrow buttons cover keyboard and touch)
    handle.addEventListener("pointerdown", () => (card.draggable = true));
    card.addEventListener("dragstart", (e) => {
      drag = { list: listKey, from: i };
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(i));
      card.classList.add("is-dragging");
    });
    card.addEventListener("dragend", () => {
      card.draggable = false;
      card.classList.remove("is-dragging");
      drag = null;
    });
    card.addEventListener("dragover", (e) => {
      if (drag?.list !== listKey) return;
      e.preventDefault();
      card.classList.add("is-drop");
    });
    card.addEventListener("dragleave", () => card.classList.remove("is-drop"));
    card.addEventListener("drop", (e) => {
      card.classList.remove("is-drop");
      if (drag?.list !== listKey) return;
      e.preventDefault();
      move(drag.from, i);
    });

    const body = h("div.ed-item-body");
    if (renderFields) body.append(...renderFields([...path, i], item));
    else for (const [key, label, kind, placeholder] of fields) {
      body.appendChild(boundInput([...path, i, key], label, kind, {
        placeholder,
        onChange: () => (heading.textContent = title(getPath(ed.resume, [...path, i])) || `New ${noun}`),
      }));
    }
    card.appendChild(body);
    wrap.appendChild(card);
  });

  wrap.appendChild(
    h("button.btn.btn-ghost.ed-add", { type: "button", onclick: () => {
      const list = getPath(ed.resume, path) || [];
      list.push(newItem());
      setPath(ed.resume, path, list);
      changed({ rerender: true });
      requestAnimationFrame(() => {
        const el = ed.root.querySelector(`.ed-items[data-path="${CSS.escape(listKey)}"]`);
        el?.closest(".ed-group")?.setAttribute("open", "");
        const added = el?.querySelector(":scope > .ed-item:last-of-type");
        if (added) {
          added.open = true;
          added.scrollIntoView({ block: "nearest", behavior: "smooth" });
          added.querySelector("input, textarea, select")?.focus({ preventScroll: true });
        }
      });
    } }, svgIcon(ICONS.plus), addLabel),
  );
  return wrap;
}

// ============================================================================
// PANEL TOOLS — search, expand/collapse, clickable warnings
// ============================================================================

function panelTools(kind, panel) {
  const search = h("input.input.ed-search", {
    type: "search", placeholder: kind === "resume" ? "Find a field or section" : "Find a setting", "aria-label": "Filter fields", value: ed.query[kind],
  });
  search.addEventListener("input", () => {
    ed.query[kind] = search.value;
    filterPanel(panel, search.value);
  });
  const setAll = (open) => panel.querySelectorAll(".ed-group").forEach((g) => (g.open = open));
  return h("div.ed-tools",
    h("span.ed-search-wrap", svgIcon(ICONS.search), search),
    h("button.link-btn", { type: "button", onclick: () => setAll(true) }, "Expand all"),
    h("button.link-btn", { type: "button", onclick: () => setAll(false) }, "Collapse all"),
  );
}

function filterPanel(panel, query) {
  const q = query.trim().toLowerCase();
  let shown = 0;
  for (const g of panel.querySelectorAll(":scope > .ed-group")) {
    if (!q) {
      g.hidden = false;
      g.querySelectorAll(".ed-field, .ed-item").forEach((el) => (el.hidden = false));
      shown++;
      continue;
    }
    const titleHit = g.querySelector("summary").textContent.toLowerCase().includes(q);
    let any = titleHit;
    for (const f of g.querySelectorAll(".ed-field")) {
      const text = `${f.querySelector("label, .ed-label")?.textContent || ""} ${f.querySelector("input, textarea, select")?.value || ""}`.toLowerCase();
      const hit = titleHit || text.includes(q);
      f.hidden = !hit;
      any ||= hit;
    }
    for (const item of g.querySelectorAll(".ed-item")) {
      item.hidden = !titleHit && ![...item.querySelectorAll(".ed-field")].some((f) => !f.hidden);
      if (!item.hidden && !titleHit) item.open = true;
    }
    g.hidden = !any;
    if (any) {
      g.open = true;
      shown++;
    }
  }
  panel.querySelector(".ed-no-match")?.remove();
  if (q && !shown) panel.appendChild(h("p.muted.ed-no-match", `Nothing matches “${query}”.`));
}

function warningsBox(warnings, label) {
  return h("details.ed-warnings", h("summary", svgIcon(ICONS.alert), label),
    h("ul", warnings.map((w) => {
      const m = /^(\w+)(?:\[(\d+)\])?/.exec(w);
      const key = m?.[1];
      const target = key === "basics" ? "basics" : SECTIONS.some((s) => s.key === key) ? `resume:${key}` : null;
      return h("li", target ? h("button.link-btn", { type: "button", onclick: () => revealGroup(target, m[2]) }, w) : w);
    })));
}

function revealGroup(key, index) {
  ed.open.add(key);
  ed.query.resume = "";
  renderPanel();
  const g = ed.root.querySelector(`.ed-group[data-key="${CSS.escape(key)}"]`);
  if (!g) return;
  const item = index !== undefined ? g.querySelector(`.ed-item[data-index="${index}"]`) : null;
  if (item) item.open = true;
  (item || g).scrollIntoView({ block: "start", behavior: "smooth" });
  (item || g).querySelector("[aria-invalid], input, textarea")?.focus({ preventScroll: true });
}

// ============================================================================
// RESUME TAB
// ============================================================================

function resumePanel() {
  const panel = h("div.ed-panel");
  const warnings = validateResume(prune(ed.resume));
  panel.appendChild(panelTools("resume", panel));
  if (warnings.length) panel.appendChild(warningsBox(warnings, `${warnings.length} thing(s) to check`));

  const body = h("div.ed-group-body");
  const basics = group("basics", [h("strong", "Basics"), h("span.muted", "Name, contact, summary")], body);
  for (const [key, label, kind, placeholder] of BASICS_FIELDS) body.appendChild(boundInput(["basics", key], label, kind, { placeholder }));
  body.appendChild(h("h3.ed-sub", "Location"));
  const loc = h("div.ed-grid");
  for (const [key, label, kind, placeholder] of LOCATION_FIELDS) loc.appendChild(boundInput(["basics", "location", key], label, kind, { placeholder }));
  body.appendChild(loc);
  body.appendChild(h("h3.ed-sub", "Profiles"));
  body.appendChild(itemList({
    path: ["basics", "profiles"],
    fields: PROFILE_FIELDS,
    noun: "profile",
    title: (p) => [p.network, p.username].filter(Boolean).join(" · "),
    addLabel: "Add profile",
  }));
  panel.appendChild(basics);

  for (const s of SECTIONS) {
    const filled = (ed.resume[s.key] || []).filter((x) => !isEmpty(prune(x))).length;
    const total = (ed.resume[s.key] || []).length;
    panel.appendChild(group(`resume:${s.key}`, [h("strong", s.label), h("span.muted", filled ? `${filled}` : "empty")],
      h("div.ed-group-body",
        total ? null : h("p.ed-hint", `No ${s.label.toLowerCase()} yet. Add your first ${s.noun}.`),
        itemList({ path: [s.key], fields: s.fields, title: s.title, noun: s.noun, addLabel: `Add ${s.noun}` }))));
  }
  if (ed.query.resume) queueMicrotask(() => filterPanel(panel, ed.query.resume));
  return panel;
}

// ============================================================================
// SETTINGS TAB (generated from CONFIG_SCHEMA)
// ============================================================================

function cfgRoot(create = false) {
  ed.resume.meta ||= {};
  let c = ed.resume.meta["mz-portfolio-config"];
  if (Array.isArray(c)) {
    if (!c[0] && create) c[0] = {};
    return c[0] || {};
  }
  if (!c || typeof c !== "object") {
    if (!create) return {};
    c = ed.resume.meta["mz-portfolio-config"] = {};
  }
  return c;
}

function setCfg(path, value) {
  const def = getPath(DEFAULT_CONFIG, path);
  const root = cfgRoot(true);
  const same = JSON.stringify(value) === JSON.stringify(def);
  setPath(root, path, same ? undefined : value);
  if (isEmpty(cfgRoot())) {
    if (Array.isArray(ed.resume.meta["mz-portfolio-config"])) ed.resume.meta["mz-portfolio-config"] = [{}];
    else delete ed.resume.meta["mz-portfolio-config"];
  }
  if (isEmpty(ed.resume.meta)) delete ed.resume.meta;
}

const isLeaf = (n) => n && typeof n === "object" && "type" in n && "desc" in n;
const LONG_TEXT = new Set(["bio", "philosophy", "contact_message", "text"]);

function cfgInput(path, node, current) {
  const key = path[path.length - 1];
  const label = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  const fieldKey = `cfg.${path.join(".")}`;
  const set = (v) => {
    setCfg(path, v);
    changed({ key: fieldKey });
  };

  switch (node.type) {
    case "enum": {
      const sel = h("select.input", node.values.map((v) => h("option", { value: v, selected: v === current ? true : null }, v)));
      sel.addEventListener("change", () => set(sel.value));
      return field(label, sel, node.desc);
    }
    case "boolean": {
      const box = h("input", { type: "checkbox", checked: current ? true : null });
      box.addEventListener("change", () => set(box.checked));
      const id = `f${++uid}`;
      box.id = id;
      return h("div.ed-field.ed-check", box, h("label", { for: id }, label), h("p.ed-hint", node.desc));
    }
    case "number": {
      const n = h("input.input", { type: "number", min: node.min, max: node.max, step: node.max <= 10 ? "0.05" : "1", value: current, placeholder: String(node.default) });
      n.addEventListener("change", () => {
        if (n.value === "") return set(node.default);
        const v = Math.min(node.max, Math.max(node.min, Number(n.value)));
        n.value = String(v);
        set(v);
      });
      return field(label, n, `${node.desc} (${node.min}–${node.max})`);
    }
    case "array": {
      const t = h("textarea.input", { rows: "3", placeholder: node.values ? `One per line: ${node.values.join(", ")}` : "One per line" });
      t.value = (current || []).join("\n");
      t.addEventListener("input", () => set(t.value.split("\n").map((s) => s.trim()).filter(Boolean)));
      return field(label, t, node.desc);
    }
    case "map": {
      const box = h("div.ed-grid");
      for (const k of node.keys) {
        const inp = h("input.input", { type: "text", placeholder: "Default", value: current?.[k] || "" });
        inp.addEventListener("input", () => {
          const next = { ...(getPath(cfgRoot(), path) || {}) };
          if (inp.value.trim()) next[k] = inp.value;
          else delete next[k];
          set(next);
        });
        box.appendChild(field(k, inp));
      }
      return h("div.ed-field", h("span.ed-label", label), h("p.ed-hint", node.desc), box);
    }
    default: {
      const long = LONG_TEXT.has(key);
      const placeholder = node.default ? String(node.default) : long ? "Leave empty to use your resume text" : "Default";
      const t = long ? h("textarea.input", { rows: "3", placeholder }) : h("input.input", { type: "text", placeholder });
      t.value = current && current !== node.default ? current : "";
      t.addEventListener("input", () => set(t.value));
      return field(label, t, node.desc);
    }
  }
}

function defaultTokens() {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(COLOR_TOKENS.map((t) => [t, cs.getPropertyValue(`--${t}`).trim()]));
}

function colorsGroup(config) {
  const defaults = defaultTokens();
  const report = h("div.ed-contrast", { "aria-live": "polite" });
  const grid = h("div.ed-colors");

  const tokens = () => Object.fromEntries(COLOR_TOKENS.map((t) => [t, config.colors[t] || defaults[t]]));
  const updateReport = () => {
    const results = checkPalette(tokens());
    const bad = results.filter((r) => !r.ok);
    report.dataset.tone = bad.length ? "warn" : "ok";
    report.replaceChildren(
      h("p", svgIcon(bad.length ? ICONS.alert : ICONS.check),
        bad.length ? `${bad.length} of ${results.length} contrast checks are too low` : `All ${results.length} contrast checks pass in light and dark mode`),
      bad.length ? h("ul", bad.map((r) => h("li", `${r.label} (${r.scheme}): ${r.ratio}:1, needs ${r.min}:1`))) : null,
    );
  };

  for (const t of COLOR_TOKENS) {
    const value = config.colors[t] || "";
    const shown = isValidColor(value) && /^#/.test(value) ? value : defaults[t];
    const picker = h("input.ed-swatch", { type: "color", value: /^#[0-9a-f]{6}$/i.test(shown) ? shown : "#000000", "aria-label": `${t} color` });
    const text = h("input.input", { type: "text", placeholder: defaults[t], value, spellcheck: "false", "aria-label": `${t} hex value` });
    const dark = h("span.ed-dark", { title: "Generated dark-mode color" });
    const paintDark = () => {
      const hex = darkHex(t, config.colors[t] || defaults[t]);
      dark.style.background = hex;
      dark.title = `Dark mode: ${hex}`;
    };
    const apply = (v) => {
      config.colors[t] = v;
      setCfg(["colors", t], v);
      paintDark();
      updateReport();
      changed({ key: `cfg.colors.${t}` });
    };
    picker.addEventListener("input", () => {
      text.value = picker.value;
      text.removeAttribute("aria-invalid");
      apply(picker.value);
    });
    text.addEventListener("input", () => {
      const v = text.value.trim();
      const ok = v === "" || isValidColor(v);
      if (ok) text.removeAttribute("aria-invalid");
      else text.setAttribute("aria-invalid", "true");
      if (ok) {
        if (/^#[0-9a-f]{6}$/i.test(v)) picker.value = v;
        apply(v);
      }
    });
    const reset = iconButton("close", `Reset ${t} to the default`, () => {
      text.value = "";
      picker.value = /^#[0-9a-f]{6}$/i.test(defaults[t]) ? defaults[t] : "#000000";
      apply("");
    });
    paintDark();
    grid.appendChild(h("div.ed-color", h("span.ed-color-name", t), picker, dark, text, reset));
  }
  updateReport();
  return h("div", h("p.ed-hint", "The small square beside each picker shows the generated dark-mode color. Leave a field empty to use the default."), grid, report);
}

function sectionsGroup(config) {
  const list = h("ol.ed-order");
  const order = [...config.sections.order];
  const hidden = new Set(config.sections.hide);
  let from = null;
  const save = () => {
    setCfg(["sections", "order"], order);
    setCfg(["sections", "hide"], order.filter((k) => hidden.has(k)));
    changed();
  };
  const moveTo = (i, j) => {
    if (j < 0 || j >= order.length || i === j) return;
    const [k] = order.splice(i, 1);
    order.splice(j, 0, k);
    render();
    save();
  };
  const render = () => {
    list.replaceChildren(
      ...order.map((key, i) => {
        const box = h("input", { type: "checkbox", checked: hidden.has(key) ? null : true, "aria-label": `Show ${key}` });
        box.addEventListener("change", () => {
          box.checked ? hidden.delete(key) : hidden.add(key);
          li.dataset.hidden = String(hidden.has(key));
          save();
        });
        const li = h("li.ed-order-item", { draggable: "true", dataset: { hidden: String(hidden.has(key)) } },
          h("span.ed-grip", { "aria-hidden": "true" }, svgIcon(ICONS.grip)),
          box,
          h("span", key),
          iconButton("chevronUp", `Move ${key} up`, () => moveTo(i, i - 1)),
          iconButton("chevronDown", `Move ${key} down`, () => moveTo(i, i + 1)),
        );
        li.addEventListener("dragstart", (e) => {
          from = i;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", key);
          li.classList.add("is-dragging");
        });
        li.addEventListener("dragend", () => li.classList.remove("is-dragging"));
        li.addEventListener("dragover", (e) => {
          if (from === null) return;
          e.preventDefault();
          li.classList.add("is-drop");
        });
        li.addEventListener("dragleave", () => li.classList.remove("is-drop"));
        li.addEventListener("drop", (e) => {
          e.preventDefault();
          if (from !== null) moveTo(from, i);
          from = null;
        });
        return li;
      }),
    );
  };
  render();
  return h("div", h("p.ed-hint", "Drag or use the arrows to reorder. Untick a section to hide it. Sections with no content are hidden automatically."), list);
}

const TAB_TYPES = ["link", "embed", "markdown", "code", "html"];

function tabsGroup() {
  const path = ["meta", "mz-portfolio-config", ...(Array.isArray(ed.resume.meta?.["mz-portfolio-config"]) ? [0] : []), "tabs"];
  return h("div",
    h("p.ed-hint", CONFIG_SCHEMA.tabs.desc),
    itemList({
      path,
      noun: "tab",
      title: (t) => [t.label, t.type].filter(Boolean).join(" · "),
      addLabel: "Add tab",
      newItem: () => ({ label: "", type: "markdown" }),
      renderFields: (p) => [
        boundInput([...p, "label"], "Label", "text", { placeholder: "Tab label" }),
        (() => {
          const sel = h("select.input", TAB_TYPES.map((v) => h("option", { value: v, selected: getPath(ed.resume, [...p, "type"]) === v ? true : null }, v)));
          sel.addEventListener("change", () => { setPath(ed.resume, [...p, "type"], sel.value); changed(); });
          return field("Type", sel);
        })(),
        boundInput([...p, "url"], "URL (https; raw GitHub/gist link for files)", "url", { placeholder: "https://…" }),
        boundInput([...p, "content"], "Content (instead of a URL)", "textarea", { placeholder: "Markdown, code or HTML" }),
        boundInput([...p, "language"], "Code language (code tabs)", "text", { placeholder: "e.g. js" }),
        boundInput([...p, "height"], "Height in px (embed / html)", "text", { placeholder: "e.g. 600" }),
      ],
    }),
  );
}

function settingsPanel() {
  const panel = h("div.ed-panel");
  // Migrate legacy config shapes once, so edits land where the app reads them
  const raw = cfgRoot();
  if (raw && Object.keys(raw).length) {
    const migrated = migrateLegacy(raw);
    if (JSON.stringify(migrated) !== JSON.stringify(raw)) {
      for (const k of Object.keys(raw)) delete raw[k];
      Object.assign(raw, migrated);
    }
  }
  const { config, warnings } = normalizeConfig(ed.resume.meta || {});
  panel.appendChild(panelTools("settings", panel));
  if (warnings.length) panel.appendChild(warningsBox(warnings, `${warnings.length} setting(s) need attention`));

  // Resume theme (JSON Resume standard meta.theme)
  const themeSel = h("select.input",
    CURATED_THEMES.map((t) => h("option", { value: t.name, selected: t.name === config.resume.theme ? true : null }, t.label)),
    CURATED_THEMES.some((t) => t.name === config.resume.theme) ? null : h("option", { value: config.resume.theme, selected: true }, `${config.resume.theme} (from the registry)`),
  );
  themeSel.addEventListener("change", () => {
    setPath(ed.resume, ["meta", "theme"], themeSel.value);
    changed();
  });
  panel.appendChild(group("settings:theme", [h("strong", "Resume theme"), h("span.muted", "meta.theme")], h("div.ed-group-body", field("Theme for the resume viewer", themeSel))));

  for (const [name, node] of Object.entries(CONFIG_SCHEMA)) {
    const body = h("div.ed-group-body");
    const details = group(`settings:${name}`, [h("strong", name), node._desc ? h("span.muted", node._desc) : null], body);
    if (name === "colors") body.appendChild(colorsGroup(config));
    else if (name === "sections") body.appendChild(sectionsGroup(config));
    else if (name === "tabs") body.appendChild(tabsGroup());
    else if (isLeaf(node)) body.appendChild(cfgInput([name], node, getPath(config, [name])));
    else {
      const walk = (n, path) => {
        for (const [k, child] of Object.entries(n)) {
          if (k.startsWith("_") || (name === "resume" && k === "theme")) continue;
          if (isLeaf(child)) body.appendChild(cfgInput([...path, k], child, getPath(config, [...path, k])));
          else {
            body.appendChild(h("h3.ed-sub", k));
            walk(child, [...path, k]);
          }
        }
      };
      walk(node, [name]);
    }
    panel.appendChild(details);
  }
  if (ed.query.settings) queueMicrotask(() => filterPanel(panel, ed.query.settings));
  return panel;
}

// ============================================================================
// JSON TAB
// ============================================================================

function jsonPanel() {
  const area = h("textarea.input.ed-json", { spellcheck: "false", autocapitalize: "off", "aria-label": "resume.json" });
  area.value = JSON.stringify(ed.resume, null, 2);
  const status = h("p.ed-hint", { "aria-live": "polite" }, "Edit the raw JSON, then apply it. Changes in the forms show up here.");
  let parsed = null;
  const apply = h("button.btn.btn-primary", { type: "button", disabled: true, onclick: () => {
    if (!parsed) return;
    ed.resume = parsed;
    changed();
    apply.disabled = true;
    status.textContent = "Applied.";
    status.dataset.tone = "ok";
  } }, "Apply JSON");
  const check = () => {
    try {
      parsed = parseResumeJson(area.value);
      const unchanged = JSON.stringify(parsed) === JSON.stringify(ed.resume);
      apply.disabled = unchanged;
      status.textContent = unchanged ? "Valid JSON — no changes yet." : "Valid JSON — apply to use it.";
      status.dataset.tone = "ok";
      area.removeAttribute("aria-invalid");
    } catch (e) {
      parsed = null;
      apply.disabled = true;
      status.textContent = e.message;
      status.dataset.tone = "error";
      area.setAttribute("aria-invalid", "true");
    }
  };
  let t = null;
  area.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(check, 200);
  });
  const format = h("button.btn.btn-ghost", { type: "button", onclick: () => {
    try {
      area.value = JSON.stringify(JSON.parse(area.value), null, 2);
      check();
    } catch {
      check();
    }
  } }, "Format");
  return h("div.ed-panel", area, h("div.ed-row", apply, format, status));
}

// ============================================================================
// BLOG TAB
// ============================================================================

async function loadPosts() {
  const resumeFile = ed.source?.filename || getResumeFilename();
  const gists = await listMyGists();
  ed.posts = gists
    .filter((g) => Object.keys(g.files).some((f) => /\.md$/i.test(f)) && !g.files[resumeFile])
    .map((g) => {
      const filename = Object.keys(g.files).find((f) => /\.md$/i.test(f));
      return { gistId: g.id, filename, title: g.description || filename.replace(/\.md$/i, ""), updatedAt: g.updated_at, isPublic: g.public, url: g.html_url, loaded: false };
    });
}

const POST_FIELDS = ["title", "date", "tags", "description", "image", "draft", "body", "slug", "isPublic"];

function savePostDraft(p) {
  store.set(POST_DRAFT_KEY, { gistId: p.gistId, ...Object.fromEntries(POST_FIELDS.map((k) => [k, p[k]])), editedAt: new Date().toISOString() });
}

function takePostDraft(p) {
  const d = store.get(POST_DRAFT_KEY);
  if (!d || d.gistId !== p.gistId) return;
  const differs = POST_FIELDS.some((k) => JSON.stringify(d[k]) !== JSON.stringify(p[k]));
  if (differs && confirm(`You have unsaved changes to ${p.gistId ? `"${p.title}"` : "a new post"} from ${ago(d.editedAt)}. Restore them?`)) {
    for (const k of POST_FIELDS) if (k in d) p[k] = d[k];
    p.dirty = true;
  } else if (differs) store.remove(POST_DRAFT_KEY);
}

async function openPost(post) {
  if (post && !post.loaded) {
    const gist = await getGist(post.gistId);
    const text = (await gistFileText(gist, post.filename)) || "";
    const { metadata, body } = parseFrontmatter(text);
    Object.assign(post, {
      loaded: true,
      title: String(metadata.title || post.title),
      date: metadata.date ? String(metadata.date).slice(0, 10) : gist.created_at.slice(0, 10),
      tags: Array.isArray(metadata.tags) ? metadata.tags.map(String) : metadata.tags ? [String(metadata.tags)] : [],
      description: String(metadata.description || metadata.preview || ""),
      image: String(metadata.image || ""),
      draft: metadata.draft === true || metadata.published === false,
      body,
      updatedAt: gist.updated_at,
    });
  }
  ed.post = post || {
    gistId: null, filename: "", slug: "", title: "", date: new Date().toISOString().slice(0, 10), tags: [], description: "", image: "", draft: false, body: "", isPublic: true, loaded: true,
  };
  takePostDraft(ed.post);
  renderPanel();
}

function blogPanel() {
  const panel = h("div.ed-panel");
  if (!ed.user) {
    panel.appendChild(h("div.ed-empty", h("p", "Blog posts are public gists with a .md file. Sign in with GitHub to create, edit and delete them here."), signInButton()));
    return panel;
  }
  if (ed.post) return postEditor(panel);

  if (!ed.posts) {
    panel.appendChild(h("p.muted", "Loading your posts…"));
    loadPosts().then(() => renderPanel()).catch((e) => panel.replaceChildren(h("p.ed-error", e.message)));
    return panel;
  }
  panel.appendChild(h("div.ed-row", h("button.btn.btn-primary", { type: "button", onclick: () => openPost(null) }, svgIcon(ICONS.plus), "New post"),
    h("span.muted", `${ed.posts.length} post(s)`)));
  if (!ed.posts.length) panel.appendChild(h("p.ed-hint", "No posts yet. Write your first one — it's published as a gist and shows in your portfolio's Blog tab."));
  const list = h("ul.ed-posts", { role: "list" });
  for (const post of ed.posts) {
    list.appendChild(h("li.card",
      h("button.ed-post-open", { type: "button", onclick: () => openPost(post).catch((e) => toast(e.message, "error")) },
        h("strong", post.title), h("span.muted", `${post.filename} · updated ${ago(post.updatedAt)}${post.isPublic ? "" : " · secret gist (not shown on the portfolio)"}`)),
    ));
  }
  panel.appendChild(list);
  return panel;
}

const MD_ACTIONS = [
  ["bold", "Bold (Ctrl+B)", "bold"], ["italic", "Italic (Ctrl+I)", "italic"], ["heading", "Heading", "heading"],
  ["link", "Link (Ctrl+K)", "link"], ["code", "Code", "code"], ["list", "Bullet list", "list"],
  ["ordered", "Numbered list", "list"], ["quote", "Quote", "quote"], ["image", "Image", "image"],
];

function postEditor(panel) {
  const p = ed.post;
  const touch = () => {
    p.dirty = true;
    savePostDraft(p);
  };
  const bind = (key, label, kind = "text", { hint, placeholder } = {}) => {
    const input = h("input.input", { type: kind === "date" ? "text" : kind, placeholder, inputmode: kind === "date" ? "numeric" : null });
    input.value = key === "tags" ? p.tags.join(", ") : p[key] ?? "";
    const wrap = field(label, input, hint);
    input.addEventListener("input", () => {
      p[key] = key === "tags" ? input.value.split(",").map((s) => s.trim()).filter(Boolean) : input.value;
      if (key === "title" && !p.gistId && !p.slugEdited) slugInput && (slugInput.value = slugify(p.title));
      touch();
    });
    input.addEventListener("blur", () => showFieldError(input, validateField(kind, input.value)));
    return wrap;
  };

  // Body + toolbar + live preview
  const body = h("textarea.input.ed-md", { rows: "16", spellcheck: "true", placeholder: "Write your post in Markdown…" });
  body.value = p.body || "";
  const preview = h("div.prose.card.ed-md-preview");
  const stats = h("p.ed-hint", { "aria-live": "off" });
  let mdTimer = null;
  const renderMd = () => {
    preview.innerHTML = markdownToHtml(p.body || "*Nothing written yet.*");
    const words = String(p.body || "").trim().split(/\s+/).filter(Boolean).length;
    stats.textContent = `${words} word${words === 1 ? "" : "s"} · ${readingTime(p.body)} min read`;
  };
  body.addEventListener("input", () => {
    p.body = body.value;
    touch();
    clearTimeout(mdTimer);
    mdTimer = setTimeout(renderMd, 150);
  });
  const runAction = (action) => {
    const r = applyMarkdown(body.value, body.selectionStart, body.selectionEnd, action);
    body.value = r.text;
    body.focus();
    body.setSelectionRange(r.start, r.end);
    body.dispatchEvent(new Event("input"));
  };
  body.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const action = { b: "bold", i: "italic", k: "link" }[e.key.toLowerCase()];
    if (action) {
      e.preventDefault();
      runAction(action);
    }
  });
  const toolbar = h("div.ed-md-toolbar", { role: "toolbar", "aria-label": "Formatting" },
    MD_ACTIONS.map(([action, label, icon]) => {
      const b = iconButton(icon, label, () => runAction(action));
      if (action === "ordered") b.replaceChildren(h("span.ed-ol", "1."));
      return b;
    }));
  renderMd();

  const draft = h("input", { type: "checkbox", checked: p.draft ? true : null, id: "post-draft" });
  draft.addEventListener("change", () => { p.draft = draft.checked; touch(); });

  let slugInput = null;
  const newPostOptions = [];
  if (!p.gistId) {
    slugInput = h("input.input", { type: "text", placeholder: "post-title", spellcheck: "false" });
    slugInput.value = p.slug || slugify(p.title || "");
    slugInput.addEventListener("input", () => { p.slugEdited = true; p.slug = slugInput.value; touch(); });
    const pub = h("input", { type: "checkbox", checked: p.isPublic !== false ? true : null, id: "post-public" });
    pub.addEventListener("change", () => { p.isPublic = pub.checked; touch(); });
    newPostOptions.push(
      field("File name (URL slug)", slugInput, "The post's address: /blog/<slug>. Can't be changed after publishing."),
      h("div.ed-field.ed-check", pub, h("label", { for: "post-public" }, "Public gist"),
        h("p.ed-hint", "Only public gists show on your portfolio. Untick to keep it as a private (secret) gist.")),
    );
  }

  const saveBtn = h("button.btn.btn-primary", { type: "button" }, p.gistId ? "Save post" : "Publish post");
  const save = async () => {
    if (!p.title.trim()) return toast("Give the post a title first.", "error");
    const content = frontmatter(p);
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      if (p.gistId) {
        const saved = await updateGist(p.gistId, { description: p.title, files: { [p.filename]: { content } } });
        p.updatedAt = saved.updated_at;
      } else {
        const filename = `${slugify(slugInput?.value || p.title)}.md`;
        const gist = await createGist({ description: p.title, files: { [filename]: { content } }, isPublic: p.isPublic !== false });
        Object.assign(p, { gistId: gist.id, filename, url: gist.html_url, isPublic: gist.public, updatedAt: gist.updated_at });
        ed.posts?.unshift(p);
      }
      p.dirty = false;
      store.remove(POST_DRAFT_KEY);
      forgetCachedPortfolio(ed.user.login);
      toast(p.isPublic ? "Post saved. It's live on your portfolio." : "Post saved as a secret gist.");
      renderPanel();
    } catch (e) {
      toast(e.message, "error");
      saveBtn.disabled = false;
      saveBtn.textContent = p.gistId ? "Save post" : "Publish post";
    }
  };
  saveBtn.addEventListener("click", save);
  p.save = save;

  const remove = async () => {
    if (!p.gistId || !confirm(`Delete "${p.title}"? This deletes the gist on GitHub and can't be undone.`)) return;
    try {
      await deleteGist(p.gistId);
      ed.posts = ed.posts.filter((x) => x !== p);
      ed.post = null;
      store.remove(POST_DRAFT_KEY);
      forgetCachedPortfolio(ed.user.login);
      toast("Post deleted.");
      renderPanel();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  panel.append(
    h("div.ed-row",
      h("button.btn.btn-ghost", { type: "button", onclick: () => {
        if (p.dirty) toast("Unsaved post changes are kept as a draft in this browser.");
        ed.post = null;
        renderPanel();
      } }, svgIcon(ICONS.arrowLeft), "All posts"),
      h("span.ed-spacer"),
      p.url ? h("a.btn.btn-ghost", { href: p.url }, svgIcon(ICONS.github), h("span.btn-label", "Gist")) : null,
      p.gistId ? h("button.btn.btn-ghost.ed-danger", { type: "button", onclick: remove }, "Delete") : null,
      saveBtn,
    ),
    bind("title", "Title", "text", { placeholder: "Post title" }),
    ...newPostOptions,
    h("div.ed-grid", bind("date", "Date", "date", { placeholder: "YYYY-MM-DD" }), bind("tags", "Tags", "text", { hint: "Comma separated", placeholder: "tag, another tag" })),
    bind("description", "Short description", "text", { hint: "Shown in the post list.", placeholder: "One sentence about the post" }),
    bind("image", "Cover image URL", "url", { placeholder: "https://…/cover.jpg" }),
    h("div.ed-field.ed-check", draft, h("label", { for: "post-draft" }, "Draft"),
      h("p.ed-hint", "Drafts are hidden from your portfolio, but a public gist can still be found on GitHub.")),
    h("div.ed-md-split",
      h("div.ed-field", h("label", { for: "post-body" }, "Post (Markdown)"), toolbar, body, stats),
      h("div.ed-field", h("span.ed-label", "Preview"), preview)),
  );
  body.id = "post-body";
  return panel;
}

// ============================================================================
// DIALOGS
// ============================================================================

/** A modal with buttons. Resolves to the chosen value (or null on Esc/cancel). */
function choiceDialog(title, content, choices) {
  return new Promise((resolve) => {
    const dialog = h("dialog.ed-dialog",
      h("form", { method: "dialog" },
        h("h2", title),
        ...[].concat(content),
        h("div.ed-row", choices.map(([value, label, kind = "ghost"]) =>
          h(`button.btn.btn-${kind}`, { type: "button", onclick: () => { dialog.close(); resolve(value); } }, label))),
      ),
    );
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(null);
    });
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

const SHORTCUTS = [
  ["Ctrl / ⌘ + S", "Save"],
  ["Ctrl / ⌘ + Z", "Undo"],
  ["Ctrl / ⌘ + Shift + Z", "Redo"],
  ["Ctrl / ⌘ + B · I · K", "Bold · italic · link (in a post)"],
  ["?", "Show these shortcuts"],
];

function showShortcuts() {
  choiceDialog("Keyboard shortcuts",
    h("dl.ed-keys", SHORTCUTS.map(([k, v]) => [h("dt", h("kbd", k)), h("dd", v)])),
    [[null, "Close", "primary"]]);
}

function showChanges() {
  const changes = diffSummary(ed.base || {}, prune(ed.resume));
  choiceDialog("Unsaved changes",
    changes.length ? h("ul.ed-changes", changes.map((c) => h("li", c))) : h("p", "No changes."),
    [[null, "Close"], ...(changes.length ? [["save", ed.user ? "Save now" : "Sign in to save", "primary"]] : [])],
  ).then((v) => v === "save" && save());
}

// ============================================================================
// ACCOUNT
// ============================================================================

function signInButton() {
  return h("button.btn.btn-primary", { type: "button", onclick: openSignIn }, svgIcon(ICONS.github), "Sign in to save");
}

// "Sign in with GitHub" goes through /api/auth (a Cloudflare Pages Function),
// which comes back to /edit#gh_token=… (or #gh_error=…). The draft is in
// localStorage, so leaving the page for GitHub loses nothing.
const LOGIN_URL = "/api/auth/login?return=/edit";

const LOGIN_ERRORS = {
  denied: "Sign-in was cancelled on GitHub.",
  state: "Sign-in expired or was started in another tab. Please try again.",
  github: "GitHub didn't finish the sign-in. Please try again.",
  not_configured: "GitHub sign-in isn't set up on this site yet. Use a token instead.",
};

/** Reads and removes the sign-in result from the URL fragment. */
export function takeLoginResult() {
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get("gh_token");
  const error = params.get("gh_error");
  if (!token && !error) return null;
  history.replaceState(history.state, "", location.pathname + location.search);
  return { token, error: error && (LOGIN_ERRORS[error] || LOGIN_ERRORS.github) };
}

function openSignIn() {
  const tokenForm = tokenSignInForm(() => dialog.close());
  const dialog = h("dialog.ed-dialog",
    h("div.ed-signin",
      h("h2", "Sign in"),
      h("p", "Your resume and blog posts are saved as gists on your GitHub account."),
      h("a.btn.btn-primary.ed-signin-github", { href: LOGIN_URL, dataset: { external: "" } }, svgIcon(ICONS.github), "Sign in with GitHub"),
      h("p.ed-hint", "Asks only for permission to manage your gists. You stay signed in on this browser until you sign out."),
      h("details.ed-signin-token", h("summary", "Use a personal access token instead"), tokenForm),
      h("div.ed-row", h("button.btn.btn-ghost", { type: "button", onclick: () => dialog.close() }, "Cancel")),
    ),
  );
  dialog.addEventListener("close", () => dialog.remove());
  document.body.appendChild(dialog);
  dialog.showModal();
}

function tokenSignInForm(done) {
  const input = h("input.input", { type: "password", autocomplete: "off", spellcheck: "false", placeholder: "ghp_… or github_pat_…", id: "gh-token" });
  const error = h("p.ed-error", { "aria-live": "polite" });
  const submit = h("button.btn.btn-primary", { type: "submit" }, "Sign in");
  return h("form", { onsubmit: async (e) => {
    e.preventDefault();
    error.textContent = "";
    submit.disabled = true;
    submit.textContent = "Checking…";
    try {
      ed.user = await signIn(input.value);
      done();
      toast(`Signed in as ${ed.user.login}`);
      await afterSignIn();
    } catch (err) {
      error.textContent = err.message;
      submit.disabled = false;
      submit.textContent = "Sign in";
    }
  } },
    h("ol.ed-steps",
      h("li", h("a", { href: TOKEN_HELP_URL, target: "_blank", rel: "noopener" }, "Create a token on GitHub"), " (opens with only the ", h("strong", "gist"), " permission ticked)."),
      h("li", "Copy the token and paste it below."),
    ),
    field("Token", input),
    h("p.ed-hint", "Saved in this browser until you sign out, and sent only to api.github.com."),
    error,
    h("div.ed-row", submit),
  );
}

async function afterSignIn() {
  ed.posts = null;
  if (!ed.resume) {
    try {
      await loadOwnResume();
    } catch (e) {
      toast(e.message, "error");
    }
  }
  render();
}

async function fetchOwnResume() {
  const filename = getResumeFilename();
  const gists = await listMyGists();
  const gist = gists.find((g) => g.files[filename]);
  if (!gist) return null;
  const full = await getGist(gist.id);
  return {
    resume: parseResumeJson(await gistFileText(full, filename)),
    source: { type: "gist", id: gist.id, filename, updatedAt: full.updated_at, url: full.html_url },
  };
}

async function loadOwnResume() {
  const own = await fetchOwnResume();
  if (!own) return false;
  begin(own.resume, own.source, { base: prune(own.resume), savedAt: own.source.updatedAt });
  return true;
}

// ============================================================================
// SAVE / STATUS
// ============================================================================

let saveBtn = null;
let statusEl = null;
let undoBtn = null;
let redoBtn = null;

function updateStatus(note) {
  document.title = `${ed.dirty ? "• " : ""}Editor — mz-portfolio`;
  if (undoBtn) undoBtn.disabled = !ed.history?.canUndo;
  if (redoBtn) redoBtn.disabled = !ed.history?.canRedo;
  if (saveBtn) {
    saveBtn.textContent = ed.saving ? "Saving…" : !ed.user ? "Sign in to save" : ed.source?.type === "gist" ? "Save" : "Create resume gist";
    saveBtn.disabled = ed.saving || (ed.user && ed.source?.type === "gist" && !ed.dirty);
  }
  if (!statusEl) return;
  let text;
  let tone;
  if (note) [text, tone] = [note, "warn"];
  else if (ed.saving) [text, tone] = ["Saving…", "busy"];
  else if (ed.dirty) [text, tone] = [ed.source?.type === "gist" ? "Unsaved changes" : "Not saved yet", "warn"];
  else if (ed.source?.type !== "gist") [text, tone] = ["Empty draft", "idle"];
  else [text, tone] = [`Saved${ed.savedAt ? ` ${ago(ed.savedAt)}` : ""}`, "ok"];
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
  statusEl.disabled = !ed.dirty;
}

setInterval(() => statusEl?.isConnected && !ed.dirty && updateStatus(), 30_000);

async function save() {
  if (!ed.resume || ed.saving) return;
  if (ed.post && ed.tab === "blog") return ed.post.save?.();
  if (!ed.user) return openSignIn();
  const clean = prune(ed.resume);
  const content = `${JSON.stringify(clean, null, 2)}\n`;
  ed.saving = true;
  updateStatus();
  try {
    if (ed.source?.type === "gist") {
      const remote = await getGist(ed.source.id);
      if (remote.updated_at !== ed.source.updatedAt) {
        const choice = await choiceDialog("This resume changed on GitHub",
          h("p", `Someone (maybe you, elsewhere) saved it ${ago(remote.updated_at)}, after you opened it here.`),
          [["cancel", "Cancel"], ["theirs", "Load GitHub version"], ["mine", "Overwrite with mine", "primary"]]);
        if (choice === "theirs") {
          const resume = parseResumeJson(await gistFileText(remote, ed.source.filename));
          begin(resume, { ...ed.source, updatedAt: remote.updated_at }, { base: prune(resume), savedAt: remote.updated_at });
          ed.saving = false;
          render();
          toast("Loaded the version from GitHub.");
          return;
        }
        if (choice !== "mine") {
          ed.saving = false;
          updateStatus();
          return;
        }
      }
      const saved = await updateGist(ed.source.id, { files: { [ed.source.filename]: { content } } });
      ed.source.updatedAt = saved.updated_at;
    } else {
      const filename = getResumeFilename();
      const gist = await createGist({ description: "My resume", files: { [filename]: { content } }, isPublic: true });
      ed.source = { type: "gist", id: gist.id, filename, updatedAt: gist.updated_at, url: gist.html_url };
      render();
    }
    const changes = diffSummary(ed.base || {}, clean);
    ed.base = clean;
    ed.savedAt = new Date().toISOString();
    forgetCachedPortfolio(ed.user.login);
    toast(changes.length ? `Saved: ${changes.slice(0, 3).join(" · ")}${changes.length > 3 ? " …" : ""}` : "Saved.");
  } catch (e) {
    toast(e.message, "error");
  }
  ed.saving = false;
  ed.dirty = computeDirty();
  saveDraft();
  updateStatus();
}

// ============================================================================
// START SCREEN
// ============================================================================

function startScreen() {
  const username = h("input.input", { type: "text", placeholder: "GitHub username", autocomplete: "off", spellcheck: "false", "aria-label": "GitHub username" });
  const error = h("p.ed-error", { "aria-live": "polite" });
  const start = (resume, source, opts) => {
    begin(resume, source, opts);
    render();
  };
  const draft = readDraft();

  const fileInput = h("input", { type: "file", accept: ".json,application/json", class: "visually-hidden", id: "ed-import" });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      start(parseResumeJson(await file.text()), { type: "local" });
    } catch (e) {
      error.textContent = e.message;
    }
  });

  return h("div.ed-start",
    h("h1.landing-title", "Edit a portfolio"),
    h("p.landing-lead", "Change your resume and portfolio settings with forms and a live preview, then save straight to your gist."),
    draft ? h("article.card.ed-draft-card",
      h("h2.landing-h3", "Continue your draft"),
      h("p", `${draft.resume.basics?.name ? `${draft.resume.basics.name} · ` : ""}edited ${ago(draft.editedAt)}${draft.dirty ? " · not saved to GitHub" : ""}.`),
      h("div.ed-row",
        h("button.btn.btn-primary", { type: "button", onclick: () => {
          begin(draft.resume, draft.source || { type: "local" }, { base: draft.base || null, savedAt: draft.savedAt || null });
          render();
        } }, "Continue"),
        h("button.btn.btn-ghost", { type: "button", onclick: () => {
          if (draft.dirty && !confirm("Discard this draft? Unsaved changes will be lost.")) return;
          store.remove(DRAFT_KEY);
          render();
        } }, "Discard"),
      ),
    ) : null,
    h("div.ed-start-grid",
      h("article.card",
        h("h2.landing-h3", "My resume gist"),
        h("p", "Sign in with GitHub to load and save your own resume.json gist and blog posts."),
        ed.user ? h("button.btn.btn-primary", { type: "button", onclick: async (e) => {
          e.currentTarget.disabled = true;
          try {
            if (!(await loadOwnResume())) start({ ...blankScaffold(), basics: { name: ed.user.name || "" } }, { type: "local" });
            else render();
          } catch (err) {
            error.textContent = err.message;
            e.currentTarget.disabled = false;
          }
        } }, "Open my resume") : signInButton(),
      ),
      h("article.card",
        h("h2.landing-h3", "Start from a public portfolio"),
        h("p", "Copy anyone's public resume.json as a starting point. Saving creates your own gist."),
        h("form.ed-row", { onsubmit: async (e) => {
          e.preventDefault();
          error.textContent = "";
          const name = username.value.trim();
          if (!name) return;
          try {
            const { gists } = await fetchGistList(name);
            const gist = gists.find((g) => g.files?.[getResumeFilename()]);
            if (!gist) throw new Error(`${name} has no public ${getResumeFilename()}.`);
            start(parseResumeJson(await fetchText(gist.files[getResumeFilename()].raw_url)), { type: "local" });
          } catch (err) { error.textContent = err.message; }
        } }, username, h("button.btn.btn-ghost", { type: "submit" }, "Load")),
      ),
      h("article.card",
        h("h2.landing-h3", "Start fresh"),
        h("p", "Every section ready to fill in, an empty resume, or a resume.json file from your computer."),
        h("div.ed-row",
          h("button.btn.btn-ghost", { type: "button", onclick: () => start(blankScaffold(), { type: "local" }) }, "All sections"),
          h("button.btn.btn-ghost", { type: "button", onclick: () => start({ basics: { name: "" } }, { type: "local" }) }, "Blank"),
          fileInput,
          h("label.btn.btn-ghost", { for: "ed-import" }, svgIcon(ICONS.upload), "Import file"),
        ),
      ),
    ),
    error,
  );
}

// ============================================================================
// LAYOUT
// ============================================================================

const TABS = [
  ["resume", "Resume"],
  ["settings", "Portfolio settings"],
  ["blog", "Blog"],
  ["json", "JSON"],
];

function renderPanel({ keepFocus = false } = {}) {
  const slot = ed.root?.querySelector("#ed-panel");
  if (!slot) return;
  const focusedPath = keepFocus ? document.activeElement?.dataset?.path : null;
  const y = slot.scrollTop;
  const winY = scrollY;
  const panel = ed.tab === "settings" ? settingsPanel() : ed.tab === "blog" ? blogPanel() : ed.tab === "json" ? jsonPanel() : resumePanel();
  slot.replaceChildren(panel);
  slot.scrollTop = y;
  if (scrollY !== winY) scrollTo(0, winY);
  if (focusedPath) slot.querySelector(`[data-path="${CSS.escape(focusedPath)}"]`)?.focus({ preventScroll: true });
}

function topBar() {
  saveBtn = h("button.btn.btn-primary", { type: "button", onclick: save });
  statusEl = h("button.ed-status", { type: "button", title: "See what changed", onclick: showChanges });
  undoBtn = iconButton("undo", "Undo (Ctrl+Z)", undo);
  redoBtn = iconButton("redo", "Redo (Ctrl+Shift+Z)", redo);

  const account = ed.user
    ? h("div.ed-account",
        h("img", { src: ed.user.avatar_url, alt: "", width: 28, height: 28 }),
        h("span.btn-label", ed.user.login),
        h("button.link-btn", { type: "button", onclick: () => {
          if (!confirm("Sign out? The token is removed from this browser.")) return;
          clearToken();
          ed.user = null;
          ed.posts = null;
          ed.post = null;
          render();
        } }, "Sign out"))
    : null;

  const exportMenu = ed.resume
    ? h("div.ed-row.ed-export",
        iconButton("copy", "Copy JSON", async () => toast((await copyText(JSON.stringify(prune(ed.resume), null, 2))) ? "JSON copied" : "Couldn't copy")),
        iconButton("download", "Download resume.json", () => downloadFile("resume.json", `${JSON.stringify(prune(ed.resume), null, 2)}\n`, "application/json")),
      )
    : null;

  const live = ed.user && ed.source?.type === "gist"
    ? h("a.btn.btn-ghost", { href: `${BASE_PATH}${encodeURIComponent(ed.user.login)}` }, svgIcon(ICONS.external), h("span.btn-label", "My portfolio"))
    : null;

  return h("header.ed-top",
    h("a.brand", { href: BASE_PATH, "aria-label": "mz-portfolio home" }, logoImg(32), h("span", "editor")),
    ed.resume ? h("div.ed-history", undoBtn, redoBtn) : null,
    ed.resume ? statusEl : null,
    h("span.ed-spacer"),
    iconButton("keyboard", "Keyboard shortcuts (?)", showShortcuts, ".ed-keys-btn"),
    account || (ed.resume ? null : signInButtonSmall()),
    live,
    exportMenu,
    ed.resume ? saveBtn : null,
  );
}

function signInButtonSmall() {
  return h("button.btn.btn-ghost", { type: "button", onclick: openSignIn }, svgIcon(ICONS.github), h("span.btn-label", "Sign in"));
}

function render() {
  const app = document.getElementById("app");
  ed.root = h("div.editor", { dataset: { view: "edit" } });
  ed.root.appendChild(topBar());

  if (!ed.resume) {
    statusEl = saveBtn = undoBtn = redoBtn = null;
    ed.root.appendChild(h("main.docs-main", { id: "main", tabindex: "-1" }, startScreen()));
    app.replaceChildren(ed.root);
    document.title = "Editor — mz-portfolio";
    return;
  }

  const tabs = h("nav.ed-tabs", { "aria-label": "Editor sections" },
    TABS.map(([key, label]) => h("button.tab", { type: "button", dataset: { tab: key }, "aria-current": ed.tab === key ? "page" : null, onclick: () => {
      if (ed.tab === "blog" && ed.post?.dirty && key !== "blog") toast("Unsaved post changes are kept as a draft in this browser.");
      ed.tab = key;
      ed.post = null;
      ed.root.querySelectorAll(".ed-tabs .tab").forEach((t) => {
        if (t.dataset.tab === key) t.setAttribute("aria-current", "page");
        else t.removeAttribute("aria-current");
      });
      renderPanel();
    } }, label)),
  );

  ed.frame = h("iframe.ed-frame", { src: `${BASE_PATH}preview/view`, title: "Live preview" });
  ed.frame.addEventListener("load", pushPreview);
  const preview = h("section.ed-preview", { "aria-label": "Live preview", dataset: { device: ed.device } });
  const devices = h("div.ed-devices", { role: "group", "aria-label": "Preview width" },
    DEVICES.map(([key, label, icon]) => {
      const b = iconButton(icon, label, () => {
        ed.device = key;
        preview.dataset.device = key;
        devices.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      });
      b.setAttribute("aria-pressed", String(ed.device === key));
      return b;
    }));
  preview.append(
    h("div.ed-preview-bar", h("span", svgIcon(ICONS.eye), "Live preview"), devices, h("button.link-btn", { type: "button", onclick: reloadPreview }, "Reload")),
    h("div.ed-frame-wrap", ed.frame),
  );

  const viewToggle = h("div.ed-view-toggle", { role: "group", "aria-label": "Show" },
    h("button.chip", { type: "button", "aria-pressed": "true", onclick: (e) => setMobileView("edit", e.currentTarget) }, "Edit"),
    h("button.chip", { type: "button", "aria-pressed": "false", onclick: (e) => setMobileView("preview", e.currentTarget) }, svgIcon(ICONS.eye), "Preview"),
  );

  const layout = h("div.ed-layout", { dataset: { mobile: "edit" } },
    h("section.ed-editor", { "aria-label": "Editor" }, tabs, h("div.ed-scroll", { id: "ed-panel" })),
    preview,
  );
  function setMobileView(view, btn) {
    layout.dataset.mobile = view;
    viewToggle.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === btn)));
    scrollTo(0, 0);
  }

  ed.root.append(h("main", { id: "main", tabindex: "-1" }, layout), viewToggle);
  app.replaceChildren(ed.root);
  try {
    sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(ed.resume));
  } catch {
    /* too large — the frame gets it by postMessage on load */
  }
  renderPanel();
  updateStatus();
}

// ============================================================================
// KEYBOARD
// ============================================================================

function onKeydown(e) {
  if (!location.pathname.startsWith(`${BASE_PATH}edit`) || document.querySelector("dialog[open]")) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  const target = e.target;
  const inText = target instanceof HTMLElement && target.matches("input, textarea, select, [contenteditable]");
  if (mod && key === "s") {
    e.preventDefault();
    save();
    return;
  }
  if (!ed.resume) return;
  // The JSON and post bodies keep the browser's own undo
  const nativeUndo = target instanceof HTMLElement && target.matches(".ed-json, .ed-md");
  const inPost = ed.tab === "blog" && ed.post;
  if (mod && !nativeUndo && !inPost && (key === "z" || key === "y")) {
    e.preventDefault();
    if (key === "y" || e.shiftKey) redo();
    else undo();
    return;
  }
  if (!mod && !inText && e.key === "?") {
    e.preventDefault();
    showShortcuts();
  }
}

// ============================================================================
// ENTRY
// ============================================================================

export async function renderEditor() {
  document.title = "Editor — mz-portfolio";
  removeEventListener("beforeunload", beforeUnload);
  addEventListener("beforeunload", beforeUnload);
  removeEventListener("keydown", onKeydown);
  addEventListener("keydown", onKeydown);

  if (!ed.resume) {
    const draft = readDraft();
    if (draft?.dirty) begin(draft.resume, draft.source || { type: "local" }, { base: draft.base || null, savedAt: draft.savedAt || null });
  }
  const login = takeLoginResult();
  if (login?.error) toast(login.error, "error");
  if (login?.token) {
    try {
      ed.user = await signIn(login.token);
      toast(`Signed in as ${ed.user.login}`);
      render();
      await afterSignIn();
      return;
    } catch (e) {
      toast(e.message, "error");
    }
  }
  if (getToken() && !ed.user) {
    try {
      ed.user = await currentUser();
    } catch (e) {
      if (e.status === 401) clearToken();
      else toast(e.message, "error"); // offline etc. — keep the token
    }
  }
  render();
}
