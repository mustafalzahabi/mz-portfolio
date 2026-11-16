// ============================================================================
// EDITOR (/edit) — edit a resume.json and the portfolio config with forms,
// see a live preview, and save to your own gist. Blog posts (.md gists) can be
// created, edited and deleted too. Without signing in, everything still works
// locally: copy or download the JSON instead of saving.
// ============================================================================

import { h, svgIcon, toast, copyText, downloadFile, slugify, parseFrontmatter } from "../utils.js";
import { ICONS, logoImg } from "../icons.js";
import { BASE_PATH } from "../router.js";
import { CONFIG_SCHEMA, DEFAULT_CONFIG, COLOR_TOKENS, normalizeConfig, migrateLegacy, isValidColor } from "../config.js";
import { validateResume } from "../merge.js";
import { parseResumeJson, getResumeFilename } from "../data.js";
import { fetchGistList, fetchText } from "../api.js";
import { markdownToHtml } from "../markdown.js";
import { checkPalette, darkHex } from "../palette.js";
import { CURATED_THEMES } from "../resume/index.js";
import {
  TOKEN_HELP_URL, getToken, signIn, clearToken, currentUser, listMyGists, getGist, createGist,
  updateGist, deleteGist, gistFileText, forgetCachedPortfolio,
} from "../github.js";

const DRAFT_KEY = "mz-editor-draft";
const PREVIEW_KEY = "mz-preview-json";
const EXAMPLE_URL = new URL("../../assets/examples/resume.json", import.meta.url).href;

// ============================================================================
// STATE
// ============================================================================

const ed = {
  user: null, // GitHub user when signed in
  resume: null,
  source: null, // { type: "gist", id, filename, updatedAt, url } | { type: "local" }
  tab: "resume",
  dirty: false,
  posts: null, // [{ gistId, filename, title, … }] once loaded
  post: null, // post being edited
  root: null,
  frame: null,
  open: new Set(["basics", "settings:colors", "settings:theme"]), // expanded groups
};

/** A collapsible group whose open/closed state survives re-renders. */
function group(key, summaryChildren, body) {
  const d = h("details.ed-group", { open: ed.open.has(key) ? true : null, dataset: { key } }, h("summary", summaryChildren), body);
  d.addEventListener("toggle", () => (d.open ? ed.open.add(key) : ed.open.delete(key)));
  return d;
}

const isEmpty = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) ||
  (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);

function getPath(obj, path) {
  return path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Sets a value; empty values are removed and empty parents pruned. */
function setPath(obj, path, value) {
  const parents = [];
  let o = obj;
  path.slice(0, -1).forEach((k, i) => {
    // The container type follows the NEXT key: a number means a list
    if (o[k] == null || typeof o[k] !== "object") o[k] = typeof path[i + 1] === "number" ? [] : {};
    parents.push([o, k]);
    o = o[k];
  });
  const last = path[path.length - 1];
  if (isEmpty(value) && !Array.isArray(o)) delete o[last];
  else o[last] = value;
  for (let i = parents.length - 1; i >= 0; i--) {
    const [p, k] = parents[i];
    if (isEmpty(p[k]) && !Array.isArray(p)) delete p[k];
  }
}

// ============================================================================
// FIELD SPECS (JSON Resume v1)
// ============================================================================

const SECTIONS = [
  { key: "work", label: "Experience", title: (i) => [i.position, i.name].filter(Boolean).join(" · "),
    fields: [["position", "Position"], ["name", "Company"], ["url", "Website", "url"], ["location", "Location"], ["startDate", "Start", "date"], ["endDate", "End (empty = present)", "date"], ["summary", "Summary", "textarea"], ["highlights", "Highlights", "list"]] },
  { key: "projects", label: "Projects", title: (i) => i.name,
    fields: [["name", "Name"], ["description", "Description", "textarea"], ["url", "Link", "url"], ["entity", "Organization"], ["type", "Type"], ["startDate", "Start", "date"], ["endDate", "End", "date"], ["roles", "Roles", "list"], ["keywords", "Keywords", "list"], ["highlights", "Highlights", "list"], ["image", "Image URL", "url"]] },
  { key: "education", label: "Education", title: (i) => [i.studyType, i.area, i.institution].filter(Boolean).join(" · "),
    fields: [["institution", "Institution"], ["url", "Website", "url"], ["studyType", "Degree"], ["area", "Field"], ["startDate", "Start", "date"], ["endDate", "End", "date"], ["score", "Score"], ["courses", "Courses", "list"]] },
  { key: "skills", label: "Skills", title: (i) => i.name,
    fields: [["name", "Group name"], ["level", "Level (e.g. Advanced, or 0–100)"], ["keywords", "Skills", "list"]] },
  { key: "certificates", label: "Certificates", title: (i) => i.name,
    fields: [["name", "Name"], ["issuer", "Issuer"], ["date", "Date", "date"], ["url", "Link", "url"]] },
  { key: "awards", label: "Awards", title: (i) => i.title,
    fields: [["title", "Title"], ["awarder", "Awarded by"], ["date", "Date", "date"], ["summary", "Summary", "textarea"]] },
  { key: "publications", label: "Publications", title: (i) => i.name,
    fields: [["name", "Title"], ["publisher", "Publisher"], ["releaseDate", "Date", "date"], ["url", "Link", "url"], ["summary", "Summary", "textarea"]] },
  { key: "volunteer", label: "Volunteering", title: (i) => [i.position, i.organization].filter(Boolean).join(" · "),
    fields: [["position", "Role"], ["organization", "Organization"], ["url", "Website", "url"], ["startDate", "Start", "date"], ["endDate", "End", "date"], ["summary", "Summary", "textarea"], ["highlights", "Highlights", "list"]] },
  { key: "languages", label: "Languages", title: (i) => [i.language, i.fluency].filter(Boolean).join(" · "),
    fields: [["language", "Language"], ["fluency", "Fluency"]] },
  { key: "interests", label: "Interests", title: (i) => i.name,
    fields: [["name", "Interest"], ["keywords", "Keywords", "list"]] },
  { key: "references", label: "References", title: (i) => i.name,
    fields: [["name", "Name"], ["reference", "Reference", "textarea"]] },
];

const BASICS_FIELDS = [
  ["name", "Name"], ["label", "Title"], ["email", "Email", "email"], ["phone", "Phone", "tel"],
  ["url", "Website", "url"], ["image", "Photo URL", "url"], ["summary", "Summary", "textarea"],
];
const LOCATION_FIELDS = [["city", "City"], ["region", "Region"], ["countryCode", "Country code"], ["address", "Address"], ["postalCode", "Postal code"]];
const PROFILE_FIELDS = [["network", "Network"], ["username", "Username"], ["url", "URL", "url"]];

// ============================================================================
// CHANGE HANDLING
// ============================================================================

let previewTimer = null;

function changed({ rerender = false } = {}) {
  ed.dirty = true;
  saveDraft();
  updateSaveButton();
  clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 450);
  if (rerender) renderPanel();
}

function saveDraft() {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ resume: ed.resume, source: ed.source, dirty: ed.dirty }));
  } catch {
    /* too large — preview still works */
  }
}

function readDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
  } catch {
    return null;
  }
}

function refreshPreview() {
  if (!ed.resume) return;
  try {
    sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(ed.resume));
  } catch {
    return;
  }
  const win = ed.frame?.contentWindow;
  if (!win) return;
  try {
    const y = win.scrollY;
    ed.frame.addEventListener("load", () => win.scrollTo?.(0, y), { once: true });
    ed.frame.contentWindow.location.reload();
  } catch {
    ed.frame.src = ed.frame.src;
  }
}

function beforeUnload(e) {
  if (ed.dirty && location.pathname.startsWith(`${BASE_PATH}edit`)) {
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
  return h("div.ed-field", h("label", { for: id }, label), input, hint ? h("p.ed-hint", hint) : null);
}

/** Text-like input bound to resume[path]. kind: text | textarea | url | email | tel | date | list */
function boundInput(path, label, kind = "text", { onChange } = {}) {
  const value = getPath(ed.resume, path);
  let input;
  if (kind === "textarea") {
    input = h("textarea.input", { rows: "4" });
    input.value = value ?? "";
  } else if (kind === "list") {
    input = h("textarea.input", { rows: "3", placeholder: "One per line" });
    input.value = Array.isArray(value) ? value.join("\n") : value ?? "";
  } else {
    input = h("input.input", {
      type: kind === "date" ? "text" : kind,
      inputmode: kind === "date" ? "numeric" : null,
      placeholder: kind === "date" ? "2024-06" : null,
      pattern: kind === "date" ? "\\d{4}(-\\d{2}(-\\d{2})?)?" : null,
    });
    input.value = value ?? "";
  }
  input.addEventListener("input", () => {
    const v = kind === "list" ? input.value.split("\n").map((s) => s.trim()).filter(Boolean) : input.value;
    setPath(ed.resume, path, kind === "list" ? v : v.trim() === "" ? "" : v);
    onChange?.(v);
    changed();
  });
  return field(label, input, kind === "list" ? "One item per line." : kind === "date" ? "YYYY, YYYY-MM or YYYY-MM-DD" : null);
}

function iconButton(icon, label, onclick, extra = "") {
  return h(`button.ed-icon-btn${extra}`, { type: "button", "aria-label": label, title: label, onclick }, svgIcon(ICONS[icon] || icon));
}

/** Editable list of objects (sections, profiles, tabs) with add / move / remove. */
function itemList({ path, fields, title, addLabel, newItem = () => ({}), renderFields }) {
  const wrap = h("div.ed-items", { dataset: { path: path.join(".") } });
  const items = getPath(ed.resume, path) || [];

  items.forEach((item, i) => {
    const heading = h("span.ed-item-title", title(item) || "Untitled");
    const card = h("details.ed-item", { open: items.length === 1 ? true : null },
      h("summary",
        heading,
        h("span.ed-item-actions",
          iconButton("arrowLeft", "Move up", (e) => { e.preventDefault(); move(i, -1); }, ".up"),
          iconButton("arrowRight", "Move down", (e) => { e.preventDefault(); move(i, 1); }, ".down"),
          iconButton("close", "Remove", (e) => {
            e.preventDefault();
            if (confirm(`Remove "${title(item) || "this item"}"?`)) {
              items.splice(i, 1);
              setPath(ed.resume, path, items.length ? items : []);
              changed({ rerender: true });
            }
          }, ".danger"),
        ),
      ),
    );
    const body = h("div.ed-item-body");
    if (renderFields) body.append(...renderFields([...path, i], item));
    else for (const [key, label, kind] of fields) {
      body.appendChild(boundInput([...path, i, key], label, kind, { onChange: () => (heading.textContent = title(getPath(ed.resume, [...path, i])) || "Untitled") }));
    }
    card.appendChild(body);
    wrap.appendChild(card);
  });

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    changed({ rerender: true });
  }

  wrap.appendChild(
    h("button.btn.btn-ghost.ed-add", { type: "button", onclick: () => {
      const list = getPath(ed.resume, path) || [];
      list.push(newItem());
      setPath(ed.resume, path, list);
      changed({ rerender: true });
      requestAnimationFrame(() => {
        const list = ed.root.querySelector(`.ed-items[data-path="${CSS.escape(path.join("."))}"]`);
        list?.closest(".ed-group")?.setAttribute("open", "");
        const added = list?.querySelector(":scope > .ed-item:last-of-type");
        if (added) {
          added.open = true;
          added.querySelector("input, textarea, select")?.focus();
        }
      });
    } }, svgIcon(ICONS.plus), addLabel),
  );
  return wrap;
}

// ============================================================================
// RESUME TAB
// ============================================================================

function resumePanel() {
  const panel = h("div.ed-panel");
  const warnings = validateResume(ed.resume);
  if (warnings.length) {
    panel.appendChild(h("details.ed-warnings", h("summary", svgIcon(ICONS.alert), `${warnings.length} thing(s) to check`), h("ul", warnings.map((w) => h("li", w)))));
  }

  const body = h("div.ed-group-body");
  const basics = group("basics", [h("strong", "Basics"), h("span.muted", "Name, contact, summary")], body);
  for (const [key, label, kind] of BASICS_FIELDS) body.appendChild(boundInput(["basics", key], label, kind));
  body.appendChild(h("h3.ed-sub", "Location"));
  const loc = h("div.ed-grid");
  for (const [key, label] of LOCATION_FIELDS) loc.appendChild(boundInput(["basics", "location", key], label));
  body.appendChild(loc);
  body.appendChild(h("h3.ed-sub", "Profiles"));
  body.appendChild(itemList({
    path: ["basics", "profiles"],
    fields: PROFILE_FIELDS,
    title: (p) => [p.network, p.username].filter(Boolean).join(" · "),
    addLabel: "Add profile",
  }));
  panel.appendChild(basics);

  for (const s of SECTIONS) {
    const count = (ed.resume[s.key] || []).length;
    panel.appendChild(group(`resume:${s.key}`, [h("strong", s.label), h("span.muted", count ? `${count}` : "empty")],
      h("div.ed-group-body", itemList({ path: [s.key], fields: s.fields, title: s.title, addLabel: `Add to ${s.label.toLowerCase()}` }))));
  }
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
}

const isLeaf = (n) => n && typeof n === "object" && "type" in n && "desc" in n;
const LONG_TEXT = new Set(["bio", "philosophy", "contact_message", "text"]);

function cfgInput(path, node, current) {
  const key = path[path.length - 1];
  const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  const set = (v) => {
    setCfg(path, v);
    changed();
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
      const n = h("input.input", { type: "number", min: node.min, max: node.max, step: node.max <= 10 ? "0.05" : "1", value: current });
      n.addEventListener("change", () => n.value !== "" && set(Number(n.value)));
      return field(label, n, `${node.desc} (${node.min}–${node.max})`);
    }
    case "array": {
      const t = h("textarea.input", { rows: "3", placeholder: "One per line" });
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
      const t = long ? h("textarea.input", { rows: "3" }) : h("input.input", { type: "text" });
      t.value = current ?? "";
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
      changed();
    };
    picker.addEventListener("input", () => {
      text.value = picker.value;
      apply(picker.value);
    });
    text.addEventListener("input", () => {
      const v = text.value.trim();
      if (v === "" || isValidColor(v)) {
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
  const save = () => {
    setCfg(["sections", "order"], order);
    setCfg(["sections", "hide"], order.filter((k) => hidden.has(k)));
    changed();
  };
  const render = () => {
    list.replaceChildren(
      ...order.map((key, i) => {
        const box = h("input", { type: "checkbox", checked: hidden.has(key) ? null : true, "aria-label": `Show ${key}` });
        box.addEventListener("change", () => {
          box.checked ? hidden.delete(key) : hidden.add(key);
          save();
        });
        return h("li.ed-order-item", { dataset: { hidden: String(hidden.has(key)) } },
          box,
          h("span", key),
          iconButton("arrowLeft", `Move ${key} up`, () => { if (i) { [order[i - 1], order[i]] = [order[i], order[i - 1]]; render(); save(); } }, ".up"),
          iconButton("arrowRight", `Move ${key} down`, () => { if (i < order.length - 1) { [order[i + 1], order[i]] = [order[i], order[i + 1]]; render(); save(); } }, ".down"),
        );
      }),
    );
  };
  render();
  return h("div", h("p.ed-hint", "Untick a section to hide it. Sections with no content are hidden automatically."), list);
}

function tabsGroup() {
  const path = ["meta", "mz-portfolio-config", ...(Array.isArray(ed.resume.meta?.["mz-portfolio-config"]) ? [0] : []), "tabs"];
  cfgRoot(true);
  return h("div",
    h("p.ed-hint", CONFIG_SCHEMA.tabs.desc),
    itemList({
      path,
      title: (t) => [t.label, t.type].filter(Boolean).join(" · "),
      addLabel: "Add tab",
      newItem: () => ({ label: "New tab", type: "markdown", content: "" }),
      renderFields: (p) => [
        boundInput([...p, "label"], "Label"),
        (() => {
          const sel = h("select.input", ["link", "embed", "markdown", "code", "html"].map((v) => h("option", { value: v, selected: getPath(ed.resume, [...p, "type"]) === v ? true : null }, v)));
          sel.addEventListener("change", () => { setPath(ed.resume, [...p, "type"], sel.value); changed(); });
          return field("Type", sel);
        })(),
        boundInput([...p, "url"], "URL (https; raw GitHub/gist link for files)", "url"),
        boundInput([...p, "content"], "Content (instead of a URL)", "textarea"),
        boundInput([...p, "language"], "Code language (code tabs)"),
        boundInput([...p, "height"], "Height in px (embed / html)"),
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
  if (warnings.length) {
    panel.appendChild(h("details.ed-warnings", h("summary", svgIcon(ICONS.alert), `${warnings.length} setting(s) need attention`), h("ul", warnings.map((w) => h("li", w)))));
  }

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
  return panel;
}

// ============================================================================
// JSON TAB
// ============================================================================

function jsonPanel() {
  const area = h("textarea.input.ed-json", { spellcheck: "false", autocapitalize: "off" });
  area.value = JSON.stringify(ed.resume, null, 2);
  const status = h("p.ed-hint", { "aria-live": "polite" }, "Edit the raw JSON, then apply it.");
  const apply = h("button.btn.btn-primary", { type: "button", onclick: () => {
    try {
      ed.resume = parseResumeJson(area.value);
      status.textContent = "Applied.";
      changed();
    } catch (e) {
      status.textContent = e.message;
    }
  } }, "Apply JSON");
  return h("div.ed-panel", area, h("div.ed-row", apply, status));
}

// ============================================================================
// BLOG TAB
// ============================================================================

function frontmatter(post) {
  const q = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const lines = ["---", `title: ${q(post.title || "Untitled")}`];
  if (post.date) lines.push(`date: ${post.date}`);
  if (post.tags.length) lines.push(`tags: [${post.tags.map((t) => q(t)).join(", ")}]`);
  if (post.description) lines.push(`description: ${q(post.description)}`);
  if (post.image) lines.push(`image: ${q(post.image)}`);
  if (post.draft) lines.push("draft: true");
  lines.push("---", "");
  return `${lines.join("\n")}\n${post.body.trim()}\n`;
}

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
    gistId: null, filename: "", title: "", date: new Date().toISOString().slice(0, 10), tags: [], description: "", image: "", draft: false, body: "", loaded: true,
  };
  renderPanel();
}

function blogPanel() {
  const panel = h("div.ed-panel");
  if (!ed.user) {
    panel.appendChild(h("div.ed-empty", h("p", "Blog posts are public gists with a .md file. Sign in with a GitHub token to create, edit and delete them here."), signInButton()));
    return panel;
  }
  if (ed.post) return postEditor(panel);

  if (!ed.posts) {
    panel.appendChild(h("p.muted", "Loading your posts…"));
    loadPosts().then(renderPanel).catch((e) => panel.replaceChildren(h("p.ed-error", e.message)));
    return panel;
  }
  panel.appendChild(h("div.ed-row", h("button.btn.btn-primary", { type: "button", onclick: () => openPost(null) }, "New post"),
    h("span.muted", `${ed.posts.length} post(s)`)));
  const list = h("ul.ed-posts", { role: "list" });
  for (const post of ed.posts) {
    list.appendChild(h("li.card",
      h("button.ed-post-open", { type: "button", onclick: () => openPost(post).catch((e) => toast(e.message, "error")) },
        h("strong", post.title), h("span.muted", `${post.filename} · updated ${post.updatedAt.slice(0, 10)}${post.isPublic ? "" : " · secret gist (not shown on the portfolio)"}`)),
    ));
  }
  panel.appendChild(list);
  return panel;
}

function postEditor(panel) {
  const p = ed.post;
  const bind = (key, label, kind = "text", hint) => {
    const input = kind === "textarea" ? h("textarea.input.ed-md", { rows: "16", spellcheck: "true" }) : h("input.input", { type: kind });
    input.value = key === "tags" ? p.tags.join(", ") : p[key] ?? "";
    input.addEventListener("input", () => {
      p[key] = key === "tags" ? input.value.split(",").map((s) => s.trim()).filter(Boolean) : input.value;
      p.dirty = true;
      if (key === "body" || key === "title") renderMd();
    });
    return field(label, input, hint);
  };
  const preview = h("div.prose.card.ed-md-preview");
  const renderMd = () => {
    preview.innerHTML = markdownToHtml(p.body || "*Nothing written yet.*");
  };
  renderMd();

  const draft = h("input", { type: "checkbox", checked: p.draft ? true : null, id: "post-draft" });
  draft.addEventListener("change", () => { p.draft = draft.checked; p.dirty = true; });

  const save = async () => {
    if (!p.title.trim()) return toast("Give the post a title first.", "error");
    const content = frontmatter(p);
    try {
      if (p.gistId) {
        await updateGist(p.gistId, { description: p.title, files: { [p.filename]: { content } } });
      } else {
        const filename = `${slugify(p.title)}.md`;
        const gist = await createGist({ description: p.title, files: { [filename]: { content } }, isPublic: true });
        Object.assign(p, { gistId: gist.id, filename, url: gist.html_url, isPublic: true });
        ed.posts?.unshift(p);
      }
      p.dirty = false;
      p.updatedAt = new Date().toISOString();
      forgetCachedPortfolio(ed.user.login);
      toast("Post saved to GitHub.");
      renderPanel();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const remove = async () => {
    if (!p.gistId || !confirm(`Delete "${p.title}"? This deletes the gist on GitHub and can't be undone.`)) return;
    try {
      await deleteGist(p.gistId);
      ed.posts = ed.posts.filter((x) => x !== p);
      ed.post = null;
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
        if (p.dirty && !confirm("Leave this post without saving?")) return;
        ed.post = null;
        renderPanel();
      } }, svgIcon(ICONS.arrowLeft), "All posts"),
      h("span.ed-spacer"),
      p.gistId ? h("button.btn.btn-ghost.ed-danger", { type: "button", onclick: remove }, "Delete") : null,
      h("button.btn.btn-primary", { type: "button", onclick: save }, p.gistId ? "Save post" : "Publish post"),
    ),
    bind("title", "Title"),
    h("div.ed-grid", bind("date", "Date", "date"), bind("tags", "Tags", "text", "Comma separated")),
    bind("description", "Short description", "text", "Shown in the post list."),
    bind("image", "Cover image URL", "url"),
    h("div.ed-field.ed-check", draft, h("label", { for: "post-draft" }, "Draft"),
      h("p.ed-hint", "Drafts are hidden from your portfolio, but the gist itself is still public on GitHub.")),
    h("div.ed-md-split", bind("body", "Post (Markdown)", "textarea"), h("div.ed-field", h("span.ed-label", "Preview"), preview)),
  );
  return panel;
}

// ============================================================================
// ACCOUNT
// ============================================================================

function signInButton() {
  return h("button.btn.btn-primary", { type: "button", onclick: openSignIn }, svgIcon(ICONS.github), "Sign in to save");
}

function openSignIn() {
  const input = h("input.input", { type: "password", autocomplete: "off", spellcheck: "false", placeholder: "ghp_… or github_pat_…", id: "gh-token" });
  const error = h("p.ed-error", { "aria-live": "polite" });
  const dialog = h("dialog.ed-dialog",
    h("form", { method: "dialog", onsubmit: async (e) => {
      e.preventDefault();
      error.textContent = "";
      try {
        ed.user = await signIn(input.value);
        dialog.close();
        dialog.remove();
        toast(`Signed in as ${ed.user.login}`);
        await afterSignIn();
      } catch (err) {
        error.textContent = err.message;
      }
    } },
      h("h2", "Sign in with a GitHub token"),
      h("ol.ed-steps",
        h("li", h("a", { href: TOKEN_HELP_URL }, "Create a token on GitHub"), " (opens with only the ", h("strong", "gist"), " permission ticked). Pick an expiry date."),
        h("li", "Copy the token and paste it below."),
      ),
      field("Token", input),
      h("p.ed-hint", "The token stays in this browser tab only and is sent only to api.github.com. Closing the tab forgets it. It can only change your gists — nothing else on your account."),
      error,
      h("div.ed-row", h("button.btn.btn-ghost", { type: "button", onclick: () => { dialog.close(); dialog.remove(); } }, "Cancel"), h("button.btn.btn-primary", { type: "submit" }, "Sign in")),
    ),
  );
  document.body.appendChild(dialog);
  dialog.showModal();
  input.focus();
}

async function afterSignIn() {
  ed.posts = null;
  if (!ed.resume) await loadOwnResume();
  render();
}

async function loadOwnResume() {
  const filename = getResumeFilename();
  const gists = await listMyGists();
  const gist = gists.find((g) => g.files[filename]);
  if (!gist) {
    ed.source = { type: "local" };
    return false;
  }
  const full = await getGist(gist.id);
  ed.resume = parseResumeJson(await gistFileText(full, filename));
  ed.source = { type: "gist", id: gist.id, filename, updatedAt: full.updated_at, url: full.html_url };
  ed.dirty = false;
  saveDraft();
  return true;
}

// ============================================================================
// SAVE / EXPORT
// ============================================================================

let saveBtn = null;

function updateSaveButton() {
  if (!saveBtn) return;
  saveBtn.textContent = !ed.user ? "Sign in to save" : ed.source?.type === "gist" ? (ed.dirty ? "Save to gist" : "Saved") : "Create resume gist";
  saveBtn.disabled = ed.user && ed.source?.type === "gist" && !ed.dirty;
  document.title = `${ed.dirty ? "• " : ""}Editor — mz-portfolio`;
}

async function save() {
  if (!ed.user) return openSignIn();
  const content = `${JSON.stringify(ed.resume, null, 2)}\n`;
  saveBtn.disabled = true;
  try {
    if (ed.source?.type === "gist") {
      const remote = await getGist(ed.source.id);
      if (remote.updated_at !== ed.source.updatedAt &&
        !confirm("This resume was changed on GitHub after you opened it. Overwrite those changes with yours?")) {
        saveBtn.disabled = false;
        return;
      }
      const saved = await updateGist(ed.source.id, { files: { [ed.source.filename]: { content } } });
      ed.source.updatedAt = saved.updated_at;
    } else {
      const filename = getResumeFilename();
      const gist = await createGist({ description: "My resume", files: { [filename]: { content } }, isPublic: true });
      ed.source = { type: "gist", id: gist.id, filename, updatedAt: gist.updated_at, url: gist.html_url };
    }
    ed.dirty = false;
    saveDraft();
    forgetCachedPortfolio(ed.user.login);
    toast("Saved. Your portfolio shows the changes now.");
  } catch (e) {
    toast(e.message, "error");
  }
  updateSaveButton();
}

// ============================================================================
// START SCREEN
// ============================================================================

function startScreen() {
  const username = h("input.input", { type: "text", placeholder: "GitHub username", autocomplete: "off", spellcheck: "false" });
  const error = h("p.ed-error", { "aria-live": "polite" });
  const begin = (resume, source) => {
    ed.resume = resume;
    ed.source = source;
    ed.dirty = source.type === "local";
    saveDraft();
    render();
  };
  const draft = readDraft();

  return h("div.ed-start",
    h("h1.landing-title", "Edit a portfolio"),
    h("p.landing-lead", "Change your resume and portfolio settings with forms and a live preview, then save straight to your gist."),
    h("div.ed-start-grid",
      h("article.card",
        h("h2.landing-h3", "My resume gist"),
        h("p", "Sign in with a GitHub token to load and save your own resume.json gist and blog posts."),
        ed.user ? h("button.btn.btn-primary", { type: "button", onclick: async () => {
          try {
            if (!(await loadOwnResume())) begin({ basics: { name: ed.user.name || ed.user.login } }, { type: "local" });
            else render();
          } catch (e) { error.textContent = e.message; }
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
            begin(parseResumeJson(await fetchText(gist.files[getResumeFilename()].raw_url)), { type: "local" });
          } catch (err) { error.textContent = err.message; }
        } }, username, h("button.btn.btn-ghost", { type: "submit" }, "Load")),
      ),
      h("article.card",
        h("h2.landing-h3", "Start fresh"),
        h("p", "Begin with a filled-in example, or an empty resume."),
        h("div.ed-row",
          h("button.btn.btn-ghost", { type: "button", onclick: async () => begin(await (await fetch(EXAMPLE_URL)).json(), { type: "local" }) }, "Example"),
          h("button.btn.btn-ghost", { type: "button", onclick: () => begin({ basics: { name: "" } }, { type: "local" }) }, "Blank"),
        ),
      ),
      draft?.resume ? h("article.card",
        h("h2.landing-h3", "Continue your draft"),
        h("p", `Unsaved work from this tab${draft.resume.basics?.name ? ` (${draft.resume.basics.name})` : ""}.`),
        h("button.btn.btn-primary", { type: "button", onclick: () => { ed.resume = draft.resume; ed.source = draft.source; ed.dirty = !!draft.dirty; render(); } }, "Continue"),
      ) : null,
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

function renderPanel() {
  const slot = ed.root?.querySelector("#ed-panel");
  if (!slot) return;
  const y = slot.scrollTop;
  const panel = ed.tab === "settings" ? settingsPanel() : ed.tab === "blog" ? blogPanel() : ed.tab === "json" ? jsonPanel() : resumePanel();
  slot.replaceChildren(panel);
  slot.scrollTop = y;
}

function topBar() {
  saveBtn = h("button.btn.btn-primary", { type: "button", onclick: save });
  const account = ed.user
    ? h("div.ed-account",
        h("img", { src: ed.user.avatar_url, alt: "", width: 28, height: 28 }),
        h("span", ed.user.login),
        h("button.link-btn", { type: "button", onclick: () => { clearToken(); ed.user = null; ed.posts = null; render(); } }, "Sign out"))
    : null;

  const exportMenu = ed.resume
    ? h("div.ed-row.ed-export",
        iconButton("copy", "Copy JSON", async () => toast((await copyText(JSON.stringify(ed.resume, null, 2))) ? "JSON copied" : "Couldn't copy")),
        iconButton("download", "Download resume.json", () => downloadFile("resume.json", `${JSON.stringify(ed.resume, null, 2)}\n`, "application/json")),
      )
    : null;

  const live = ed.user && ed.source?.type === "gist"
    ? h("a.btn.btn-ghost", { href: `${BASE_PATH}${encodeURIComponent(ed.user.login)}` }, svgIcon(ICONS.external), h("span.btn-label", "My portfolio"))
    : null;

  return h("header.ed-top",
    h("a.brand", { href: BASE_PATH, "aria-label": "mz-portfolio home" }, logoImg(32), h("span", "editor")),
    h("span.ed-spacer"),
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
    ed.root.appendChild(h("main.docs-main", { id: "main", tabindex: "-1" }, startScreen()));
    app.replaceChildren(ed.root);
    document.title = "Editor — mz-portfolio";
    return;
  }

  const tabs = h("nav.ed-tabs", { "aria-label": "Editor sections" },
    TABS.map(([key, label]) => h("button.tab", { type: "button", dataset: { tab: key }, "aria-current": ed.tab === key ? "page" : null, onclick: () => {
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
  const viewToggle = h("div.ed-view-toggle", { role: "group", "aria-label": "Show" },
    h("button.chip", { type: "button", "aria-pressed": "true", onclick: (e) => setMobileView("edit", e.currentTarget) }, "Edit"),
    h("button.chip", { type: "button", "aria-pressed": "false", onclick: (e) => setMobileView("preview", e.currentTarget) }, "Preview"),
  );

  const layout = h("div.ed-layout", { dataset: { mobile: "edit" } },
    h("section.ed-editor", { "aria-label": "Editor" }, tabs, h("div.ed-scroll", { id: "ed-panel" })),
    h("section.ed-preview", { "aria-label": "Live preview" }, h("div.ed-preview-bar", h("span", svgIcon(ICONS.eye), "Live preview"), h("button.link-btn", { type: "button", onclick: refreshPreview }, "Reload")), ed.frame),
  );
  function setMobileView(view, btn) {
    layout.dataset.mobile = view;
    viewToggle.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === btn)));
  }

  ed.root.append(viewToggle, h("main", { id: "main", tabindex: "-1" }, layout));
  app.replaceChildren(ed.root);
  sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(ed.resume));
  renderPanel();
  updateSaveButton();
}

// ============================================================================
// ENTRY
// ============================================================================

export async function renderEditor() {
  document.title = "Editor — mz-portfolio";
  removeEventListener("beforeunload", beforeUnload);
  addEventListener("beforeunload", beforeUnload);

  if (!ed.resume) {
    const draft = readDraft();
    if (draft?.resume && draft.dirty) {
      Object.assign(ed, { resume: draft.resume, source: draft.source, dirty: true });
    }
  }
  if (getToken() && !ed.user) {
    try {
      ed.user = await currentUser();
    } catch {
      clearToken();
    }
  }
  render();
}

export const __test = { setPath, frontmatter };
