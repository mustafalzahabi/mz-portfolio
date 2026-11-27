// ============================================================================
// EDIT MODE — edit a portfolio right on its pages. Your own portfolio and
// preview pages get a pencil button. Edit mode is a page of its own (?edit):
// entering it adds a history entry, so Back (or Done) leaves it, and links
// inside the portfolio stay in it. Text is typed in place; projects, posts and
// custom pages are edited on their own pages; site settings have their own
// page (/settings). There are no editing panels. Drafts stay in this browser
// and can be saved to your account to continue on another device.
// ============================================================================

import { h, svgIcon, toast, copyText, downloadFile } from "../utils.js";
import { ICONS } from "../icons.js";
import { BASE_PATH, parsePath, navigate } from "../router.js";
import { setPath, prune, getPath, validateField } from "../editor-core.js";
import { markdownToHtml } from "../markdown.js";
import { markdownEditor } from "./markdown-editor.js";
import { SECTIONS, BASICS_FIELDS, LOCATION_FIELDS, PROFILE_FIELDS, templateResume, blankScaffold } from "../template.js";
import { session, storage, DRAFT_FILE as SHARED_DRAFT_FILE } from "../storage.js";
import { dropdown } from "../account.js";
import { normalizeConfig } from "../config.js";
import { repoHideKey } from "../merge.js";
import { getResumeFilename } from "../data.js";
import { closeSheet, sheetOpen } from "./sheet.js";
import { canEditReadme, openReadmeEditor, resumeReadmeEdit } from "./readme.js";
import { editInPlace, focusLater } from "./inline.js";
import { editPostOnPage } from "./post-page.js";
import { photoEditor, imageMenu, stripInput, fieldStrip, itemTools, editIcon, addSectionMenu, inlineDates, chipList } from "./direct.js";
import {
  ed, hooks, ago, begin, changed, undo, redo, save, readDraft, bindControls,
  renderPanel, openPost, loadPosts, openSignIn, showChanges,
  showShortcuts, choiceDialog, fetchOwnResume, beforeUnload, iconButton, setCfg,
  cfgFields, cfgRoot,
} from "./core.js";

export const DRAFT_FILE = SHARED_DRAFT_FILE;
const EMBEDDED = typeof window !== "undefined" && window.self !== window.top;

let api = null; // { state, rerender(resume), setPublished(resume) } from app.js
let editing = false;
let entering = false; // enterEdit is awaiting GitHub / the draft dialog
let ui = null; // { toolbar, bar }
let rerenderTimer = null;

const SPEC = Object.fromEntries(SECTIONS.map((s) => [s.key, s]));
const noun = (key) => SPEC[key]?.noun || "item";
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const cfg = () => normalizeConfig(ed.resume?.meta || {}).config;

// ============================================================================
// SETUP (called once by app.js)
// ============================================================================

export function setupEditing(appApi) {
  api = appApi;
  hooks.onChange = scheduleRerender;
  hooks.onSaved = onPublished;
  addEventListener("keydown", onKeydown);
  addEventListener("beforeunload", beforeUnload);
  // Back to the page as it was before editing: leave edit mode (runs before the app routes)
  addEventListener("popstate", () => {
    if (editing && !new URLSearchParams(location.search).has("edit")) stopEditing();
  });
}

export const isEditing = () => editing;

/** The resume viewer's theme picker: in edit mode the choice becomes the portfolio's theme. */
export function setResumeTheme(name) {
  if (!editing) return;
  setPath(ed.resume, ["meta", "theme"], name);
  changed();
  toast(`Resume theme set to ${name}. Publish to keep it.`);
}

/** Who may edit what's on screen: "own", "preview" or null. */
function editKind() {
  const vm = api?.state.vm;
  if (!vm || EMBEDDED) return null;
  if (vm.source.type === "preview") return "preview";
  if (storage()?.owns(vm.source)) return "own";
  return null;
}

/** Runs after every portfolio render: adds the Edit button, or every Edit affordance. */
export function afterRender() {
  document.querySelector(".ed-fab")?.remove();
  const kind = editKind();
  if (!kind) {
    if (editing) leaveEditing();
    return;
  }
  const wantsEdit = new URLSearchParams(location.search).has("edit");
  if (editing) {
    // Back to a page without ?edit: that's leaving edit mode
    if (!wantsEdit) return stopEditing();
    if (followRenamedProject() || followRenamedTab()) return;
    decorate();
    return;
  }
  if (wantsEdit) {
    enterEdit(kind);
    return;
  }
  const label = fabLabel();
  document.body.appendChild(
    h("button.btn.btn-primary.ed-fab", { type: "button", "aria-label": label, title: label, onclick: () => enterEdit(kind) }, svgIcon(ICONS.pencil)),
  );
}

/** What the pencil edits here. */
function fabLabel() {
  const page = api.state.page || "";
  if (page.startsWith("project:")) return "Edit project";
  if (page.startsWith("post:")) return "Edit post";
  if (page.startsWith("tab:")) return "Edit page";
  if (page === "blog") return "Edit blog";
  return "Edit portfolio";
}

/** Called by app.js when navigating away from a portfolio: no edit UI may stay behind. */
export function leaveEditing() {
  document.querySelector(".ed-fab")?.remove();
  if (!editing && !ui) return;
  editing = false;
  leaveUi();
}

// ============================================================================
// ENTER / LEAVE
// ============================================================================

async function enterEdit(kind) {
  if (entering || editing) return; // double click
  entering = true;
  try {
    await enterEditNow(kind);
  } finally {
    entering = false;
  }
}

async function enterEditNow(kind) {
  const { state } = api;
  const loadId = state.loadId;
  // Navigated away (or signed out) while we were waiting: don't edit that page
  const stale = () => state.loadId !== loadId || editKind() !== kind;
  document.querySelector(".ed-fab")?.setAttribute("disabled", "");
  ed.user = session()?.user || null;
  if (kind === "preview") {
    if (!ed.resume || ed.source?.type !== "local") begin(structuredClone(state.data.resume || {}), { type: "local" });
  } else {
    toast("Opening your resume…");
    let own = null;
    try {
      own = await fetchOwnResume();
    } catch (e) {
      toast(e.message, "error");
      document.querySelector(".ed-fab")?.removeAttribute("disabled");
      return;
    }
    if (stale()) return;
    const local = readDraft();
    begin(
      own ? own.resume : { ...blankScaffold(), basics: { name: ed.user?.name || "" } },
      own ? own.source : { type: "local" },
      { base: own ? prune(own.resume) : null, savedAt: own?.source.updatedAt || null },
    );
    await offerDraft(local, own);
  }
  if (stale()) return;
  editing = true;
  setEditParam(true, { push: true });
  mountUi(kind);
  await rerenderNow();
}

/** Offers to continue a newer draft from this browser or from GitHub (another device). */
async function offerDraft(local, own) {
  const candidates = [];
  const sameResume = (d) => (own ? d?.source?.id === own.source.id : d?.source?.type === "local");
  if (local?.dirty && sameResume(local)) candidates.push({ where: "this browser", at: local.editedAt, resume: local.resume });
  try {
    const remote = await loadRemoteDraft();
    if (remote && (!own || remote.gistId === own.source.id)) candidates.push({ where: "GitHub (saved draft)", at: remote.savedAt, resume: remote.resume });
  } catch {
    /* offline or no access — the local draft is enough */
  }
  if (!candidates.length) return;
  const newest = candidates.sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  if (JSON.stringify(prune(newest.resume)) === JSON.stringify(ed.base)) return;
  const choice = await choiceDialog("Continue your draft?",
    h("p", `You have unpublished changes from ${newest.where}, edited ${ago(newest.at)}.`),
    [["published", "Start from published"], ["draft", "Continue draft", "primary"]]);
  if (choice === "draft") {
    ed.resume = newest.resume;
    changed();
  }
}

/** Done: like Back, when edit mode was entered from this page. */
function exitEdit() {
  if (history.state?.mzEdit && api.state.page !== "settings") {
    history.back(); // the popstate leaves edit mode (afterRender)
    return;
  }
  const settings = api.state.page === "settings";
  stopEditing();
  if (settings) navigate(api.state.base, { replace: true });
}

function stopEditing() {
  if (ed.dirty) toast("Your unpublished changes are kept as a draft. Click the pencil to continue.");
  editing = false;
  leaveUi();
  setEditParam(false);
  // A preview has nowhere to publish: what you edited is what it shows
  if (editKind() === "preview") api.setPublished(structuredClone(ed.resume));
  api.rerender(api.state.data.resume);
}

function leaveUi() {
  closeSheet();
  document.querySelector(".ed-fab")?.remove();
  ui?.toolbar.remove();
  ui?.bar.remove();
  ui = null;
  ed.root = null;
  ed.sheetRender = null;
  settingsEl = null;
  document.body.classList.remove("is-editing");
  bindControls({});
}

/** ?edit in the address. Entering from a normal page adds a history entry, so Back leaves. */
function setEditParam(on, { push = false } = {}) {
  const url = new URL(location.href);
  if (on === url.searchParams.has("edit")) return;
  if (on) url.searchParams.set("edit", "");
  else url.searchParams.delete("edit");
  const href = url.pathname + url.search.replace(/=(&|$)/, "$1") + url.hash;
  if (on && push) history.pushState({ mzEdit: true }, "", href);
  else history.replaceState(history.state, "", href);
}

// ============================================================================
// RENDERING
// ============================================================================

function scheduleRerender() {
  if (!editing) return;
  clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(() => {
    // Don't rebuild the page under someone typing in another field on it;
    // re-render once they leave it
    const active = document.activeElement;
    if (active?.closest?.(".ed-inline, .ed-keep")) active.addEventListener("blur", scheduleRerender, { once: true });
    else if (api.state.page === "settings") {
      // Nothing on this page shows the content: restyle now, redraw the rest when leaving
      api.restyle(ed.resume);
      staleSinceSettings = true;
    } else rerenderNow();
  }, 220);
}

async function rerenderNow() {
  clearTimeout(rerenderTimer);
  if (api.state.vm?.source.type === "preview") {
    try {
      sessionStorage.setItem("mz-preview-json", JSON.stringify(ed.resume)); // survives a reload
    } catch {
      /* too large — the draft in localStorage still has it */
    }
  }
  await api.rerender(ed.resume);
}

async function onPublished() {
  api.setPublished(structuredClone(ed.resume));
  try {
    await clearRemoteDraft();
  } catch {
    /* nothing saved there */
  }
}

/** A renamed project changes its URL: follow it instead of showing "not found". */
function followRenamedProject() {
  const sub = parsePath().sub;
  const { vm, base } = api.state;
  const wanted = ed.projectIndex;
  if (wanted == null || sub?.name !== "project") return false;
  const p = vm.projects.find((x) => x.fromResume !== false && x.order === wanted);
  if (!p || sub.param === p.slug) return false;
  history.replaceState(history.state, "", `${base}/project/${encodeURIComponent(p.slug)}${location.search}`);
  api.rerender(ed.resume);
  return true;
}

// ============================================================================
// DECORATE — an Edit button on every object
// ============================================================================

// The cards of each section, in the same order as the view model's list
const ITEM_SELECTOR = {
  work: ".entry", volunteer: ".entry", education: ".entry", awards: ".entry", certificates: ".entry",
  publications: ".entry", interests: ".card", languages: ".chip-card", references: ".quote",
  skills: ".skill-group", projects: ".project-card",
};

// Links and buttons of the portfolio itself don't act while editing (the
// edit controls, tabs and the editing bars still do)
const INERT = [
  ".profile-actions a", ".profile-actions button:not([class*='ed-'])", ".profile-links a", ".profile-facts a",
  ".project-hero-actions a", ".glance-links a", ".entry-link", ".entry-subtitle a", ".contact-link",
  ".post-card a", ".project-card a", ".prose a", ".detail a.btn",
].map((s) => `#app ${s}`).join(", ");

function markInert() {
  for (const el of document.querySelectorAll(INERT)) {
    if (el.closest(".ed-tools, .ed-strip, .ed-photo, .ed-chips, .account-menu")) continue;
    el.classList.add("ed-inert");
    el.setAttribute("aria-disabled", "true");
    el.tabIndex = -1;
  }
}

function blockInert(e) {
  if (!editing) return;
  const el = e.target.closest?.(".ed-inert");
  if (!el) return;
  e.preventDefault();
  // Buttons do their work in their own click handler: stop it from getting there
  if (el.tagName === "BUTTON") e.stopPropagation();
}

function decorate() {
  const page = api.state.page || "";
  document.body.classList.add("is-editing");
  markInert();
  if (!document.documentElement.dataset.edInert) {
    document.documentElement.dataset.edInert = "1";
    document.addEventListener("click", blockInert, true);
  }

  if (page !== "settings" && settingsEl) {
    settingsEl = null;
    ed.root = null;
    if (staleSinceSettings) {
      staleSinceSettings = false;
      rerenderNow();
      return;
    }
  }
  shortcutsInAccountMenu();
  decorateHeader();
  decorateTabsNav();
  if (page === "profile") decorateProfile();
  else if (page.startsWith("project:")) decorateProject(decodeURIComponent(page.slice(8)));
  else if (page === "blog") decorateBlog();
  else if (page.startsWith("post:")) decoratePost(decodeURIComponent(page.slice(5)));
  else if (page.startsWith("tab:")) decorateTab(decodeURIComponent(page.slice(4)));
  else if (page === "settings") decorateSettings();
}

// ---------- site settings: a page of their own ----------

let settingsEl = null; // kept across re-renders so focus and scroll stay
let staleSinceSettings = false;

function decorateSettings() {
  const page = document.querySelector("#view .settings-page");
  if (!page) return;
  page.querySelector(".settings-off")?.remove();
  ed.tab = "settings";
  if (!settingsEl) {
    settingsEl = h("div.ed-settings", h("div", { id: "ed-panel" }));
    ed.root = settingsEl;
    renderPanel();
  }
  ed.root = settingsEl;
  if (settingsEl.parentElement !== page) page.appendChild(settingsEl);
}

function openSettings() {
  if (api.state.page === "settings") return;
  navigate(`${api.state.base}/settings?edit`);
}

// ---------- custom pages (tabs): edited on the page itself ----------

const TAB_KINDS = [
  ["markdown", "Text", "doc"],
  ["code", "Code", "code"],
  ["html", "HTML demo", "layers"],
  ["embed", "Embedded site", "globe"],
  ["link", "Link", "external"],
];

/** The resume's list of custom pages (created when missing). */
function tabsList() {
  const root = cfgRoot(true);
  if (!Array.isArray(root.tabs)) root.tabs = [];
  return root.tabs;
}

const tabPath = (i) => {
  const c = ed.resume.meta["mz-portfolio-config"];
  return ["meta", "mz-portfolio-config", ...(Array.isArray(c) ? [0] : []), "tabs", i];
};

async function addTab() {
  const list = tabsList();
  if (list.length >= 8) return toast("A portfolio can have up to 8 extra pages.", "error");
  const labels = new Set(list.map((t) => t?.label));
  let label = "New page";
  for (let n = 2; labels.has(label); n++) label = `New page ${n}`;
  list.push({ label, type: "markdown", content: "" });
  ed.tabIndex = list.length - 1;
  changed();
  await rerenderNow();
  const t = cfg().tabs.find((x) => x.index === ed.tabIndex);
  if (t) navigate(`${api.state.base}/tab/${encodeURIComponent(t.slug)}?edit`);
  focusLater("#view .tab-page #tab-title", { atEnd: false });
}

/** Page tabs in the header: link tabs open their settings page, and "+" adds a page. */
function decorateTabsNav() {
  const inner = document.querySelector("#app .tabs .tabs-inner");
  if (!inner || inner.querySelector(".ed-tab-add")) return;
  for (const t of cfg().tabs.filter((x) => x.type === "link")) {
    const a = inner.querySelector(`a.tab[data-tab="${CSS.escape(t.slug)}"]`);
    if (a) a.href = `${api.state.base}/tab/${encodeURIComponent(t.slug)}?edit`;
  }
  inner.appendChild(h("button.tab.ed-tab-add", { type: "button", "aria-label": "Add a page", title: "Add a page", onclick: addTab }, svgIcon(ICONS.plus)));
}

function decorateTab(slug) {
  const tab = cfg().tabs.find((t) => t.slug === slug);
  const page = document.querySelector("#view .tab-page");
  if (!tab || !page || page.dataset.edTab) return;
  page.dataset.edTab = "1";
  const i = tab.index;
  ed.tabIndex = i;
  const raw = () => tabsList()[i] || {};
  const base = tabPath(i);

  editInPlace(page.querySelector("#tab-title"), {
    placeholder: "Page name",
    read: () => raw().label || "",
    write: (v) => {
      if (!v.trim()) return toast("A page needs a name.", "error");
      raw().label = v.slice(0, 24);
      changed();
    },
  });

  // Kind of page, its address and options, move / delete
  const setType = (type) => {
    const t = raw();
    if (type === t.type) return;
    // Embeds and links need an address first: ask for it, switch once it's there
    if ((type === "link" || type === "embed") && !/^https:\/\//.test(t.url || "")) {
      pendingType = type;
      draw();
      strip.querySelector('[data-key="url"] input')?.focus();
      return;
    }
    t.type = type;
    if (type !== "link" && type !== "embed" && typeof t.content !== "string") t.content = "";
    changed();
  };
  let pendingType = null;
  const strip = h("div.ed-strip.ed-tab-strip");
  const move = (d) => {
    const list = tabsList();
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    ed.tabIndex = j;
    changed();
  };
  const remove = async () => {
    const choice = await choiceDialog(`Delete "${raw().label}"?`, h("p", "The page and its content are removed when you publish. You can undo this until then."),
      [["cancel", "Keep it"], ["delete", "Delete page", "primary"]]);
    if (choice !== "delete") return;
    tabsList().splice(i, 1);
    ed.tabIndex = null;
    changed();
    navigate(`${api.state.base}?edit`);
  };
  const draw = () => {
    const t = raw();
    const type = pendingType || t.type;
    const kinds = h("div.ed-seg", { role: "group", "aria-label": "Kind of page" },
      TAB_KINDS.map(([k, label, icon]) => h("button.ed-seg-btn", { type: "button", "aria-pressed": String(k === type), onclick: () => setType(k) }, svgIcon(ICONS[icon] || ICONS.doc), label)));
    const needsUrl = type === "link" || type === "embed" || (t.url && !t.content);
    strip.replaceChildren(...[
      kinds,
      needsUrl ? stripInput([...base, "url"], ["url", type === "link" || type === "embed" ? "Address" : "Load from", "url", "https://…"], {
        onCommit: () => {
          if (pendingType && /^https:\/\//.test(raw().url || "")) {
            raw().type = pendingType;
            pendingType = null;
          }
          changed();
        },
      }) : null,
      type === "code" ? stripInput([...base, "language"], ["language", "Language", "text", "e.g. js"]) : null,
      type === "embed" || type === "html" ? stripInput([...base, "height"], ["height", "Height (px)", "text", "640"]) : null,
      h("div.ed-tools.ed-tab-tools", { role: "toolbar", "aria-label": "Page actions" },
        iconButton("arrowLeft", "Move page left", () => move(-1)),
        iconButton("arrowRight", "Move page right", () => move(1)),
        iconButton("trash", "Delete page", remove, ".is-danger")),
      pendingType ? h("p.ed-hint", `Paste an https:// address to make this ${pendingType === "link" ? "a link" : "an embedded site"}.`) : null,
    ].filter(Boolean));
  };
  draw();
  page.querySelector(".tab-page-head")?.after(strip);

  // The content itself, written where it shows
  const t = raw();
  if (t.type === "link" || t.type === "embed" || (t.url && !t.content)) return;
  const body = page.querySelector(".tab-page-body");
  const write = (v) => {
    raw().content = v;
    changed({ key: `tab.${i}.content` });
  };
  if (t.type === "markdown") {
    const md = markdownEditor({ value: t.content || "", toHtml: (s) => markdownToHtml(s), onInput: write, label: "Page content (Markdown)" });
    body.hidden = true;
    body.after(h("div.ed-keep.ed-tab-editor", md.el));
  } else {
    const area = h("textarea.input.ed-code-text", { spellcheck: "false", autocapitalize: "off", "aria-label": t.type === "html" ? "HTML, CSS and JavaScript" : "Code", placeholder: t.type === "html" ? "<h1>Hello</h1>" : "// your code" });
    area.value = t.content || "";
    area.addEventListener("input", () => write(area.value));
    const editor = h("div.ed-keep.ed-tab-editor", area, t.type === "html" ? h("p.ed-hint", "The demo below updates when you leave the editor.") : null);
    if (t.type === "code") body.hidden = true;
    body.before(editor);
  }
}

/** A renamed page changes its address: follow it. */
function followRenamedTab() {
  const sub = parsePath().sub;
  if (sub?.name !== "tab" || ed.tabIndex == null) return false;
  const tabs = cfg().tabs;
  if (tabs.some((x) => x.slug === sub.param)) return false;
  const t = tabs.find((x) => x.index === ed.tabIndex);
  if (!t) return false;
  history.replaceState(history.state, "", `${api.state.base}/tab/${encodeURIComponent(t.slug)}${location.search}`);
  api.rerender(ed.resume);
  return true;
}

/** Header: name and title typed in place, photo and banner on themselves, contact details in a strip. */
/** Adds "Keyboard shortcuts" to the account menu in the header while editing. */
function shortcutsInAccountMenu() {
  for (const menu of document.querySelectorAll("#app .account-menu")) {
    if (menu.querySelector(".ed-shortcuts-item") || !menu.querySelector(".account-item")) continue;
    const item = h("button.account-item.ed-shortcuts-item", { role: "menuitem", type: "button", onclick: () => {
      menu.hidden = true;
      showShortcuts();
    } }, svgIcon(ICONS.keyboard), "Keyboard shortcuts");
    const sep = [...menu.querySelectorAll(".account-sep")].pop();
    if (sep) sep.before(item);
    else menu.appendChild(item);
  }
}

function decorateHeader() {
  const info = document.querySelector(".profile-info");
  if (!info) return;
  inlinePaths(info);

  const photoCfg = String(cfg().profile.photo || "");
  photoEditor(info.querySelector(".profile-photo"), {
    mode: photoCfg === "none" ? "none" : /^(gh|github)$/.test(photoCfg) ? "gh" : photoCfg ? "custom" : "auto",
    onSet: (v) => {
      setCfg(["profile", "photo"], v || undefined);
      changed({ key: "cfg.profile.photo" });
    },
  });

  const banner = document.querySelector(".profile-banner");
  if (banner && !banner.querySelector(".ed-image-menu")) {
    const current = String(cfg().banner.image || "");
    banner.appendChild(h("div.ed-banner-tools", imageMenu(banner, {
      kind: "banner", label: "Change banner image", current, removeLabel: "Use the color gradient",
      onSet: (v) => {
        setCfg(["banner", "image"], v || undefined);
        changed({ key: "cfg.banner.image" });
      },
    })));
  }

  // Contact details and links that aren't typed on the page
  const details = info.querySelector(".profile-details");
  if (details && !details.querySelector(".ed-strip")) {
    const contact = BASICS_FIELDS.filter(([k]) => ["email", "phone", "url"].includes(k));
    const strip = h("div.ed-strip.ed-header-strip",
      ...contact.map((f) => stripInput(["basics", f[0]], f)),
      ...LOCATION_FIELDS.filter(([k]) => ["city", "region", "countryCode"].includes(k)).map((f) => stripInput(["basics", "location", f[0]], f)),
      profileLinks(),
    );
    details.appendChild(strip);
  }
}

/** Profile links as chips (network + link), added and removed in place. */
function profileLinks() {
  const box = h("div.ed-strip-wide.ed-links");
  const list = () => (Array.isArray(ed.resume.basics?.profiles) ? ed.resume.basics.profiles : []);
  const draw = () => {
    const network = h("input.ed-strip-input", { type: "text", placeholder: "Network (e.g. LinkedIn)", "aria-label": "Network", size: 16 });
    const url = h("input.ed-strip-input", { type: "url", placeholder: "https://…/username", "aria-label": "Link", size: 22 });
    const add = () => {
      const u = url.value.trim();
      if (!u) return url.focus();
      if (validateField("url", u)) return toast(validateField("url", u), "error");
      ed.resume.basics ||= {};
      ed.resume.basics.profiles = [...list(), { network: network.value.trim() || new URL(u).hostname.replace(/^www\./, ""), url: u }];
      changed();
      draw();
    };
    url.addEventListener("keydown", (e) => e.key === "Enter" && add());
    box.replaceChildren(
      h("span.ed-strip-label", "Profile links"),
      h("div.ed-chips", list().map((p, i) => h("span.ed-chip", h("span", p.network || p.url),
        h("button.ed-chip-x", { type: "button", "aria-label": `Remove ${p.network || p.url}`, title: "Remove", onclick: () => {
          const next = list().slice();
          next.splice(i, 1);
          ed.resume.basics.profiles = next;
          changed();
          draw();
        } }, svgIcon(ICONS.close))))),
      h("div.ed-link-add", network, url, h("button.ed-tool", { type: "button", "aria-label": "Add link", title: "Add link", onclick: add }, svgIcon(ICONS.plus))),
    );
  };
  draw();
  return box;
}

function decorateProfile() {
  const { vm, config } = api.state;
  for (const section of document.querySelectorAll("#view section.section[data-section]")) {
    const key = section.dataset.section;
    section.classList.add("ed-section");
    section.querySelector(".section-title")?.after(sectionBar(key));
    if (key === "contact" && !section.querySelector(".contact-message")) {
      section.querySelector(".ed-section-bar")?.after(h("p.contact-message", { dataset: { path: "@text.contact_message" } }));
    }
    inlinePaths(section);
    const selector = ITEM_SELECTOR[key];
    if (!selector) continue;
    const list = vm[key] || [];
    section.querySelectorAll(selector).forEach((card, i) => {
      const item = list[i];
      const index = resumeIndex(key, item);
      card.classList.add("ed-card");
      if (key === "projects") {
        // A project is edited on its own page; here it only offers the way there
        card.addEventListener("click", (e) => {
          if (e.target.closest(".ed-tool")) return;
          e.preventDefault();
          editProject(item);
        });
        card.appendChild(h("div.ed-tools", editIcon(`Edit ${item?.name || "project"} on its page`, () => editProject(item))));
      } else if (index < 0) {
        card.dataset.source = "repo"; // the "Languages on GitHub" group: settings in Customize
      } else {
        inlineItem(card, key, index);
        card.appendChild(itemTools(() => ed.resume[key], index, noun(key)));
        const shownKeys = shownFields(card);
        const strip = fieldStrip([key, index], SPEC[key].fields, shownKeys, { skip: ["highlights"] });
        if (strip) card.appendChild(strip);
      }
    });
  }

  // One "Add section" menu: sections not on the page yet, and hidden ones
  const shown = new Set([...document.querySelectorAll("#view section.section[data-section]")].map((s) => s.dataset.section));
  const hidden = config.sections.hide;
  const addable = [
    ...(!shown.has("about") && !hidden.includes("about") ? [{ key: "about", label: "About" }] : []),
    ...SECTIONS.filter((s) => !shown.has(s.key) && !hidden.includes(s.key)),
    ...(document.querySelector("#app .tabs") ? [] : [{ key: "page", label: "Page (its own tab)" }]),
  ];
  const sections = document.querySelector("#view .sections");
  if (sections && (addable.length || hidden.length)) {
    sections.appendChild(addSectionMenu(addable, hidden.map((key) => ({ key, label: SPEC[key]?.label || cap(key) })), {
      onAdd: (k) => (k === "page" ? addTab() : k === "projects" ? addProject() : k === "about" ? addAbout() : addItem(k)),
      onShow: (k) => toggleSection(k, false),
    }));
  }
}

// ---------- typing on the page ----------

const toPath = (s) => s.split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p));

/**
 * Elements with data-path: "basics.name" is a resume path, "@text.tagline" a
 * settings path. `root` may itself carry the attribute.
 */
function inlinePaths(root, placeholder = "") {
  if (!root) return;
  const els = root.matches?.("[data-path]") ? [root] : [...root.querySelectorAll("[data-path]")];
  for (const el of els) {
    const raw = el.dataset.path;
    const isCfg = raw.startsWith("@");
    const path = toPath(isCfg ? raw.slice(1) : raw);
    editInPlace(el, {
      multiline: el.dataset.multiline === "1",
      placeholder: placeholder || el.dataset.placeholder || PATH_HINTS[raw] || el.textContent.trim() || "Type here",
      read: () => (isCfg ? getPath(cfg(), path) : getPath(ed.resume, path)) ?? "",
      write: (v) => {
        if (isCfg) setCfg(path, v || undefined);
        else setPath(ed.resume, path, v);
        changed();
      },
    });
  }
}

const PATH_HINTS = { "basics.name": "Your name", "basics.label": "What you do", "basics.summary": "A few sentences about you and your work. Markdown works.", "@text.contact_message": "A line inviting people to get in touch (optional)" };

const FIELD_HINTS = { position: "Job title", name: "Name", company: "Company", organization: "Organization", summary: "A short summary", institution: "School", title: "Title", awarder: "Awarded by", issuer: "Issuer", publisher: "Publisher", language: "Language", fluency: "Fluency" };

/** Highlights: a remove button on each, and "Add highlight" after the list. */
function highlightControls(card, key, index, base) {
  if (!SPEC[key]?.fields.some(([k]) => k === "highlights") || card.querySelector(".ed-add-line")) return;
  const path = [key, index, "highlights"];
  const list = () => (Array.isArray(getPath(ed.resume, path)) ? getPath(ed.resume, path) : []);
  const els = [...card.querySelectorAll('[data-field^="highlights."]:not([data-source])')];
  for (const el of els) {
    const i = Number(el.dataset.field.split(".")[1]);
    el.closest("li")?.appendChild(h("button.ed-line-x", {
      type: "button", "aria-label": "Remove this highlight", title: "Remove",
      onclick: (e) => {
        e.stopPropagation();
        const next = list().slice();
        next.splice(i, 1);
        setPath(ed.resume, path, next.length ? next : undefined);
        changed();
      },
    }, svgIcon(ICONS.close)));
  }
  const add = h("button.ed-add-line", {
    type: "button", onclick: () => {
      setPath(ed.resume, path, [...list(), ""]);
      changed();
      focusLater(`${base} [data-field="highlights.${list().length - 1}"]`);
    },
  }, svgIcon(ICONS.plus), "Add highlight");
  const ul = els[0]?.closest("ul");
  if (ul) ul.after(add);
  else {
    // None yet: the project page has a (hidden) block for them; cards get the button at the end
    const block = card.querySelector(".project-highlights");
    if (block) {
      block.hidden = false;
      block.appendChild(add);
    } else card.appendChild(add);
  }
}

/** Fields already editable where they're shown (so the strip leaves them out). */
function shownFields(root) {
  const keys = new Set();
  for (const el of root.querySelectorAll("[data-field]:not([data-source])")) keys.add(el.dataset.field.split(".")[0]);
  for (const el of root.querySelectorAll("[data-dates]:not([data-source])")) el.dataset.dates.split(",").forEach((k) => keys.add(k));
  for (const el of root.querySelectorAll("[data-list]:not([data-source])")) keys.add(el.dataset.list);
  return keys;
}

/** The fields of one resume item (data-field="position", "highlights.2", …). */
function inlineItem(card, key, index, base = `#view section[data-section="${key}"] [data-ed-index="${index}"]`) {
  card.dataset.edIndex = String(index);
  highlightControls(card, key, index, base);
  for (const el of card.querySelectorAll("[data-dates]:not([data-source])")) inlineDates(el, [key, index], el.dataset.dates.split(","));
  for (const el of card.querySelectorAll("[data-list]:not([data-source])")) {
    const chips = chipList([key, index, el.dataset.list], { label: "", placeholder: "Add…" });
    chips.dataset.list = el.dataset.list;
    el.replaceWith(chips);
  }
  for (const el of card.querySelectorAll("[data-field]:not([data-source])")) {
    const field = toPath(el.dataset.field);
    const path = [key, index, ...field];
    const isHighlight = field[0] === "highlights" && typeof field[1] === "number";
    const i = field[1];
    editInPlace(el, {
      placeholder: isHighlight ? "A highlight" : FIELD_HINTS[field[0]] || "Type here",
      multiline: field[0] === "summary" || field[0] === "description",
      read: () => getPath(ed.resume, path) ?? "",
      write: (v) => {
        setPath(ed.resume, path, v);
        changed();
      },
      // Enter in a highlight starts the next one; Backspace in an empty one removes it
      onEnter: isHighlight ? () => {
        const list = getPath(ed.resume, [key, index, "highlights"]);
        list.splice(i + 1, 0, "");
        changed();
        focusLater(`${base} [data-field="highlights.${i + 1}"]`);
      } : null,
      onRemoveEmpty: isHighlight ? () => {
        const list = getPath(ed.resume, [key, index, "highlights"]);
        list.splice(i, 1);
        changed();
        if (i > 0) focusLater(`${base} [data-field="highlights.${i - 1}"]`);
      } : null,
    });
  }
}

/** Title-row controls of a section: add or edit, move, hide. */
function sectionBar(key) {
  const order = cfg().sections.order;
  const i = order.indexOf(key);
  const move = (d) => {
    const next = order.slice();
    const j = i + d;
    if (i < 0 || j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setCfg(["sections", "order"], next);
    changed();
  };
  const primary =
    key === "projects" ? iconButton("plus", "Add a project", addProject)
    : SPEC[key] ? iconButton("plus", `Add ${noun(key)}`, () => addItem(key))
    : null;
  return h("div.ed-section-bar", { role: "toolbar", "aria-label": `${SPEC[key]?.label || cap(key)} section` },
    primary,
    iconButton("chevronUp", "Move section up", () => move(-1)),
    iconButton("chevronDown", "Move section down", () => move(1)),
    iconButton("eye", "Hide section", () => toggleSection(key, true)),
  );
}

function toggleSection(key, hide) {
  const set = new Set(cfg().sections.hide);
  if (hide) set.add(key);
  else set.delete(key);
  setCfg(["sections", "hide"], [...set]);
  changed();
  toast(hide ? `${SPEC[key]?.label || cap(key)} hidden. Show it again from the bottom of the page.` : "Section shown.");
}

function decorateProject(slug) {
  const p = api.state.vm.projects.find((x) => x.slug === slug);
  if (!p) return;
  const page = document.querySelector("#view .project-page");
  if (!page) return;
  const index = p.fromResume === false ? -1 : p.order;
  if (index < 0) {
    // Only on GitHub: shown locked, with the two ways to take it over
    page.querySelector(".project-hero-title")?.setAttribute("data-source", "repo");
    addPageAction("Add to my resume", "plus", () => adoptRepoProject(p));
    addPageAction("Hide this repo", "eye", () => {
      setCfg(["projects", "exclude"], [...new Set([...cfg().projects.exclude, p.name])]);
      changed();
      navigate(`${api.state.base}#projects`);
      toast(`"${p.name}" is hidden. Show it again in Site settings → Projects.`);
    }, "ghost");
  } else {
    ed.projectIndex = index; // a rename changes the URL: followRenamedProject keeps us on it
    inlineItem(page, "projects", index, "#view .project-page");
    const strip = fieldStrip(["projects", index], SPEC.projects.fields, shownFields(page), { skip: ["image", "highlights"] });
    if (strip && !page.querySelector(":scope > .ed-strip")) page.querySelector(".project-hero")?.after(strip);
    addPageAction("Delete project", "trash", () => {
      ed.resume.projects.splice(index, 1);
      ed.projectIndex = null;
      changed();
      navigate(`${api.state.base}#projects`);
      toast("Project deleted. Undo with Ctrl+Z or the bottom bar.");
    }, "ghost");
  }
  const draw = () => {
    if (!editing) return;
    editableImages(page, index, p);
    repoToggles(page, p);
    readmeIcons(page, p);
  };
  draw();
  // The README loads after the page: redraw what depends on it once it's there
  if (!page.dataset.edReadmeWatch) {
    page.dataset.edReadmeWatch = "1";
    page.addEventListener("mz:readme", draw);
  }
  if (p.repo && canEditReadme(p)) resumeReadmeEdit(p, () => api.rerender(ed.resume));
}

/** Turns one thing from a project's GitHub repo off (or back on) for this portfolio. */
function toggleRepoThing(p, kind, value = "") {
  const key = repoHideKey(p.repo.name, kind, value);
  const now = cfg().projects.hideFromRepos;
  setCfg(["projects", "hideFromRepos"], now.includes(key) ? now.filter((k) => k !== key) : [...now, key]);
  changed();
}

const repoIsHidden = (p, kind, value = "") => cfg().projects.hideFromRepos.includes(repoHideKey(p.repo.name, kind, value));

/** Greyed README content gets one edit icon each (the owner's repos only). */
function readmeIcons(page, p) {
  if (!p.repo || !canEditReadme(p)) return;
  const open = () => openReadmeEditor(p, { onSaved: () => api.rerender(ed.resume) });
  for (const el of page.querySelectorAll('[data-source="readme"]:not(.slider)')) {
    if (el.querySelector(":scope > .ed-tools")) continue;
    el.classList.add("ed-card");
    el.appendChild(h("div.ed-tools", editIcon(`Edit the README of ${p.repo.owner}/${p.repo.name}`, open)));
  }
}

/**
 * What the project shows from its GitHub repo, each with an on/off switch:
 * the description, the README text, the language and every keyword.
 */
function repoToggles(page, p) {
  page.querySelector(":scope > .ed-repo-strip")?.remove();
  if (!p.repo) return;
  const things = [
    p.sources?.description === "repo" || repoIsHidden(p, "description") ? ["description", "", "Repo description"] : null,
    p.readme || repoIsHidden(p, "readme") ? ["readme", "", "README text"] : null,
    p.repoLanguage ? ["language", "", `Language: ${p.repoLanguage}`] : null,
    ...(p.repoKeywords || []).filter((k) => k !== p.repoLanguage).map((k) => ["keyword", k, k]),
  ].filter(Boolean);
  if (!things.length) return;
  const strip = h("div.ed-strip.ed-repo-strip",
    h("span.ed-strip-label", svgIcon(ICONS.github), `From ${p.repo.owner}/${p.repo.name} — click to show or hide on this portfolio`),
    h("div.ed-chips", things.map(([kind, value, label]) => {
      const off = repoIsHidden(p, kind, value);
      return h("button.ed-toggle-chip", {
        type: "button", "aria-pressed": String(!off), title: off ? "Hidden. Click to show it." : "Shown. Click to hide it.",
        onclick: () => toggleRepoThing(p, kind, value),
      }, svgIcon(ICONS.eye), h("span", label));
    })),
  );
  const after = page.querySelector(":scope > .ed-strip") || page.querySelector(".project-hero");
  after?.after(strip);
}

/**
 * The project's images, in order (the first is the cover): remove, make
 * first, or add by upload, link or drop. Images taken from the README can be
 * hidden or shown again.
 */
function editableImages(page, index, p) {
  const slot = page.querySelector(".project-gallery-slot");
  if (!slot) return;
  const item = () => ed.resume.projects?.[index] || {};
  const own = () => [...new Set([item().image, ...(Array.isArray(item().images) ? item().images : [])].filter(Boolean))];
  const store = (list) => {
    setPath(ed.resume, ["projects", index, "image"], list[0] || undefined);
    setPath(ed.resume, ["projects", index, "images"], list.length > 1 ? list.slice(1) : undefined);
    changed();
  };
  const mine = index >= 0 ? own() : [];
  const readme = !mine.length && p.repo ? (p.readmeImages || []) : [];
  const tool = (icon, label, onclick, extra = "") => h(`button.ed-tool${extra}`, { type: "button", "aria-label": label, title: label, onclick }, svgIcon(ICONS[icon]));
  const tiles = [
    ...mine.map((src, i) => h("figure.ed-thumb-item", h("img", { src, alt: "", loading: "lazy" }),
      i === 0 ? h("span.ed-thumb-badge", "Cover") : null,
      h("div.ed-tools",
        i > 0 ? tool("arrowLeft", "Move earlier", () => {
          const l = own();
          [l[i - 1], l[i]] = [l[i], l[i - 1]];
          store(l);
        }) : null,
        tool("trash", "Remove this image", () => store(own().filter((x) => x !== src)), ".is-danger")))),
    ...readme.map((src) => {
      const off = repoIsHidden(p, "image", src);
      return h("figure.ed-thumb-item", { dataset: { source: "readme" }, class: off ? "is-off" : "" }, h("img", { src, alt: "", loading: "lazy" }),
        h("div.ed-tools", tool("eye", off ? "Show this README image" : "Hide this README image", () => toggleRepoThing(p, "image", src))));
    }),
  ];
  let add = null;
  if (index >= 0) {
    add = h("div.ed-thumb-add");
    add.appendChild(imageMenu(add, {
      kind: `project-${index}-${mine.length + 1}`, label: "Add an image", current: "",
      onSet: (v) => v && store([...own(), v]),
    }));
    add.appendChild(h("span", readme.length ? "Add your own (replaces the README's)" : "Add image"));
  }
  slot.replaceChildren(h("div.ed-thumbs", { role: "list", "aria-label": "Project images" }, ...tiles, ...(add ? [add] : [])));
}

/** Copies a GitHub-only project into the resume, so all of it can be edited. */
function adoptRepoProject(p) {
  if (!Array.isArray(ed.resume.projects)) ed.resume.projects = [];
  ed.resume.projects.push(prune({ name: p.name, description: p.description, url: p.github || p.url, keywords: p.keywords?.length ? p.keywords : undefined }));
  ed.projectIndex = ed.resume.projects.length - 1;
  changed();
  toast(`"${p.name}" is now in your resume. Edit it right here.`);
}

function decorateBlog() {
  if (editKind() !== "own") return;
  // A new post is written right here, in place of the list
  const writeNew = () => mountPostEditor(document.querySelector("#view .blog-results")?.parentElement, null);
  addPageAction("New post", "plus", writeNew);
  if (ed.newPost) {
    ed.newPost = false;
    writeNew();
  }
  const results = document.querySelector(".blog-results");
  const mark = () => results?.querySelectorAll(".post-card").forEach((card) => {
    if (card.querySelector(".ed-tools")) return;
    const slug = decodeURIComponent(card.querySelector("a")?.getAttribute("href")?.split("/").pop() || "");
    const post = api.state.vm.posts.find((x) => x.slug === slug);
    // A post is edited on its own page: the card only offers the way there
    if (post) {
      card.classList.add("ed-card");
      card.appendChild(h("div.ed-tools", editIcon(`Edit ${post.title} on its page`, () => editPost(post))));
    }
  });
  mark();
  if (results && !results.dataset.edObserved) {
    results.dataset.edObserved = "1";
    new MutationObserver(() => editing && mark()).observe(results, { childList: true });
  }
}

/** On a post's own page, the post itself becomes its editor. */
function decoratePost(slug) {
  if (editKind() !== "own") return;
  const post = api.state.vm.posts.find((x) => x.slug === slug);
  const article = document.querySelector("#view .post-detail");
  if (post && article && !article.classList.contains("ed-post-editing")) mountPostEditor(article, post);
}

/** Turns `target` into the post itself, edited in place (a new post when `post` is null). */
async function mountPostEditor(target, post) {
  if (!target) return;
  const base = api.state.base;
  let stored = null;
  try {
    if (post) {
      if (!ed.posts) await loadPosts();
      stored = ed.posts.find((p) => p.gistId === post.id) || ed.posts.find((p) => p.title === post.title) || null;
    }
  } catch (e) {
    toast(e.message, "error");
    return;
  }
  const article = target.classList.contains("post-detail") ? target : h("article.detail.post-detail");
  if (article !== target) target.replaceChildren(article);
  editPostOnPage(article, stored, {
    backHref: `${base}/blog`,
    // A new or renamed post has a new address: load it fresh there
    onSaved: (p) => {
      if (!post || p.slug !== post.slug) location.assign(`${base}/blog/${encodeURIComponent(p.slug)}?edit`);
    },
    onDeleted: () => location.assign(`${base}/blog?edit`),
  });
}

/** Index of a view-model item in the draft resume (same object), or -1. */
function resumeIndex(key, item) {
  if (!item) return -1;
  const list = ed.resume[key];
  if (!Array.isArray(list)) return -1;
  if (key === "projects") return item.fromResume === false ? -1 : (item.order ?? -1);
  if (key === "skills") return item.fromGithub ? -1 : (item.index ?? list.findIndex((s) => s && s.name === item.name));
  return list.indexOf(item);
}



function addPageAction(label, icon, onclick, kind = "primary") {
  const view = document.getElementById("view");
  if (!view) return;
  let bar = view.querySelector(":scope > .ed-page-actions");
  if (!bar) view.prepend((bar = h("div.ed-page-actions")));
  if ([...bar.children].some((b) => b.textContent === label)) return;
  bar.appendChild(h(`button.btn.btn-${kind}`, { type: "button", onclick }, svgIcon(ICONS[icon]), label));
}

function addAbout() {
  ed.resume.basics ||= {};
  ed.resume.basics.summary = "A few sentences about you and your work.";
  changed();
  focusLater('#view section[data-section="about"] [data-path]');
}

function addItem(key) {
  const sample = templateResume()[key]?.[0];
  if (!Array.isArray(ed.resume[key])) ed.resume[key] = [];
  // Start empty: the form shows the placeholders, nothing fake gets published
  ed.resume[key].push(sample ? Object.fromEntries(Object.keys(sample).map((k) => [k, Array.isArray(sample[k]) ? [] : ""])) : {});
  const index = ed.resume[key].length - 1;
  const hidden = cfg().sections.hide;
  if (hidden.includes(key)) setCfg(["sections", "hide"], hidden.filter((k) => k !== key));
  changed();
  // Straight to typing its first field on the page
  focusLater(`#view section[data-section="${key}"] [data-ed-index="${index}"] [data-field]`);
}

// ---------- projects: edited on their own page ----------

function editProject(p) {
  if (!p) return;
  const sub = parsePath().sub;
  if (sub?.name === "project" && sub.param === p.slug) return;
  ed.projectIndex = p.fromResume === false ? null : p.order;
  navigate(`${api.state.base}/project/${encodeURIComponent(p.slug)}?edit`);
}


function addProject() {
  if (!Array.isArray(ed.resume.projects)) ed.resume.projects = [];
  const names = new Set(ed.resume.projects.map((p) => p?.name));
  let name = "New project";
  for (let n = 2; names.has(name); n++) name = `New project ${n}`;
  ed.resume.projects.push({ name });
  const index = ed.resume.projects.length - 1;
  const hidden = cfg().sections.hide;
  if (hidden.includes("projects")) setCfg(["sections", "hide"], hidden.filter((k) => k !== "projects"));
  changed();
  // Once the page shows it, go to its own page to fill it in
  setTimeout(() => {
    const p = api.state.vm.projects.find((x) => x.fromResume !== false && x.order === index);
    if (p) editProject(p);
  }, 450);
}


/** Goes to the post's own page in edit mode, where its editor opens. */
function editPost(post) {
  const sub = parsePath().sub;
  if (sub?.name === "post" && sub.param === post.slug) return;
  navigate(`${api.state.base}/blog/${encodeURIComponent(post.slug)}?edit`);
}


// ============================================================================
// TOOLBAR + BOTTOM BAR
// ============================================================================

function mountUi(kind) {
  leaveUi();
  document.body.classList.add("is-editing");
  const undoBtn = iconButton("undo", "Undo (Ctrl+Z)", undo);
  const redoBtn = iconButton("redo", "Redo (Ctrl+Shift+Z)", redo);
  const statusEl = h("button.ed-status", { type: "button", title: "See what changed", onclick: showChanges });
  const saveBtn = h("button.btn.btn-primary.ed-publish", { type: "button", onclick: () => (!ed.user ? openSignIn() : save()) });

  const toolbar = h("div.ed-toolbar", { role: "toolbar", "aria-label": "Edit mode" },
    h("span.ed-toolbar-label", h("span.ed-dot"), "Editing"),
    h("button.ed-icon-btn", { type: "button", "aria-label": "Site settings", title: "Site settings: colors, fonts, layout, SEO", onclick: openSettings }, svgIcon(ICONS.sliders)),
    h("button.btn.btn-ghost", { type: "button", onclick: exitEdit }, "Done"),
  );

  const more = dropdown({
    button: h("button.ed-icon-btn", { type: "button", title: "More" }, svgIcon(ICONS.more)),
    label: "More actions",
    className: ".ed-more",
    items: [
      kind === "own" ? { label: `Save draft to ${storage()?.label || "your account"}`, icon: "upload", onclick: saveDraftToAccount } : null,
      { label: "Download resume.json", icon: "download", onclick: () => downloadFile("resume.json", json(), "application/json") },
      "sep",
      { label: "Discard changes", icon: "undo", onclick: discardChanges },
    ],
  });

  const bar = h("div.ed-bar", { role: "region", "aria-label": "Changes" },
    h("div.ed-bar-group", undoBtn, redoBtn, statusEl),
    h("div.ed-bar-group", more, saveBtn),
  );

  document.body.append(toolbar, bar);
  ui = { toolbar, bar };
  bindControls({ saveBtn, statusEl, undoBtn, redoBtn });
  if (!ed.user) saveBtn.textContent = "Sign in to publish";
}

const json = () => `${JSON.stringify(prune(ed.resume), null, 2)}\n`;

async function discardChanges() {
  const choice = await choiceDialog("Discard your changes?",
    h("p", ed.base ? "Your portfolio goes back to the published version." : "Your portfolio goes back to empty."),
    [["cancel", "Keep editing"], ["discard", "Discard", "primary"]]);
  if (choice !== "discard") return;
  ed.resume = structuredClone(ed.base || {});
  changed();
  try {
    await clearRemoteDraft();
  } catch {
    /* none saved */
  }
}

// ============================================================================
// DRAFT IN YOUR ACCOUNT — so you can continue on another device. GitHub: a
// secret gist (unlisted, never shown on the portfolio). Google: the app's
// hidden Drive folder. Neither touches the published portfolio.
// ============================================================================

async function saveDraftToAccount() {
  if (!ed.user) return openSignIn();
  const content = `${JSON.stringify({ savedAt: new Date().toISOString(), gistId: ed.source?.id || null, resume: ed.resume }, null, 2)}
`;
  try {
    await storage().saveDraft(content);
    toast(`Draft saved to ${storage().label}. Open edit mode on any device to continue.`);
  } catch (e) {
    toast(e.message, "error");
  }
}

async function loadRemoteDraft() {
  const backend = storage();
  if (!backend) return null;
  const found = await backend.loadDraft();
  const data = JSON.parse(found?.text || "null");
  return data?.resume ? data : null;
}

async function clearRemoteDraft() {
  await storage()?.clearDraft();
}

// ============================================================================
// KEYBOARD
// ============================================================================

function onKeydown(e) {
  if (!editing || document.querySelector("dialog[open]")) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === "s") {
    e.preventDefault();
    if (ed.user) save();
    else openSignIn();
    return;
  }
  const inText = e.target instanceof HTMLElement && e.target.matches("input, textarea, [contenteditable]");
  if (mod && !inText && (key === "z" || key === "y")) {
    e.preventDefault();
    if (key === "y" || e.shiftKey) redo();
    else undo();
    return;
  }
  if (!mod && !inText && e.key === "?" && !sheetOpen()) {
    e.preventDefault();
    showShortcuts();
  }
}

/** /edit: your own portfolio in edit mode, or a preview with every section when signed out. */
export async function routeEdit(go) {
  const s = session();
  if (s?.provider === "github") {
    go(`${BASE_PATH}${encodeURIComponent(s.user.login)}?edit`, { replace: true });
    return;
  }
  if (s?.provider === "google") {
    // Drive portfolios live at their folder's address: find it, or create it
    try {
      const backend = storage();
      let own = await backend.findResume(getResumeFilename());
      if (!own) {
        toast("Creating your portfolio in Google Drive…");
        const resume = { ...blankScaffold(), basics: { name: s.user.name || "" } };
        await backend.writeResume(null, `${JSON.stringify(prune(resume), null, 2)}\n`, getResumeFilename());
      }
      go(`${backend.homePath(own?.source)}?edit`, { replace: true });
    } catch (e) {
      toast(e.message, "error");
      go(BASE_PATH, { replace: true });
    }
    return;
  }
  try {
    const draft = readDraft();
    const resume = draft?.source?.type === "local" ? draft.resume : templateResume();
    sessionStorage.setItem("mz-preview-json", JSON.stringify(resume));
  } catch {
    /* storage full — the preview page explains */
  }
  go(`${BASE_PATH}preview/view?edit`, { replace: true });
}
