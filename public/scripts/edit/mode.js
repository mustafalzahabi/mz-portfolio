// ============================================================================
// EDIT MODE — edit a portfolio right on the page.
// Your own portfolio (signed in, GitHub source) and preview pages get an
// "Edit" button. In edit mode:
//   · text is typed in place (contenteditable, mapped back to resume paths)
//   · photo and banner get pencil buttons (pickers from edit/core.js)
//   · list items get a small toolbar (move, duplicate, delete, more fields)
//   · a Customize drawer holds content forms, settings, blog posts and JSON
//   · a bottom bar shows the status: undo/redo, Save draft, Publish
// The draft lives in this browser and can be saved to a secret gist
// (mz-portfolio-draft.json) to continue on another device.
// ============================================================================

import { h, svgIcon, toast, copyText, downloadFile } from "../utils.js";
import { ICONS } from "../icons.js";
import { BASE_PATH } from "../router.js";
import { getPath, setPath, prune } from "../editor-core.js";
import { SECTIONS, templateResume, blankScaffold } from "../template.js";
import { cachedUser, getToken, listMyGists, getGist, createGist, updateGist, deleteGist, gistFileText } from "../github.js";
import { loginUrl } from "../account.js";
import {
  ed, hooks, ago, begin, changed, undo, redo, save, readDraft, bindControls, updateStatus,
  renderPanel, revealGroup, openPost, loadPosts, photoPicker, bannerPicker, openSignIn, showChanges,
  showShortcuts, choiceDialog, fetchOwnResume, beforeUnload, iconButton, setCfg,
} from "./core.js";

export const DRAFT_FILE = "mz-portfolio-draft.json";
const EMBEDDED = typeof window !== "undefined" && window.self !== window.top;

let api = null; // { state, rerender(resume), setPublished(resume) } from app.js
let editing = false;
let ui = null; // { toolbar, bar, drawer }
let rerenderTimer = null;
let pendingRerender = false;

// ============================================================================
// SETUP (called once by app.js)
// ============================================================================

export function setupEditing(appApi) {
  api = appApi;
  hooks.onChange = scheduleRerender;
  hooks.onSaved = onPublished;
  addEventListener("keydown", onKeydown);
  addEventListener("beforeunload", beforeUnload);
  // While editing, clicking text you can type into (or a project card) mustn't navigate
  document.addEventListener("click", (e) => {
    if (!editing) return;
    const a = e.target.closest?.("a[href]");
    if (a && (a.closest("[data-edit-path]") || a.matches(".project-card") || a.querySelector("[data-edit-path]"))) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
}

export const isEditing = () => editing;

/** Who may edit what's on screen: "own", "preview" or null. */
function editKind() {
  const vm = api?.state.vm;
  if (!vm || EMBEDDED) return null;
  if (vm.source.type === "preview") return "preview";
  const user = cachedUser();
  if (user && getToken() && vm.source.type === "gh" && String(vm.source.id).toLowerCase() === user.login.toLowerCase()) return "own";
  return null;
}

/** Runs after every portfolio render: adds the Edit button, or the edit affordances. */
export function afterRender() {
  document.querySelector(".ed-fab")?.remove();
  const kind = editKind();
  if (!kind) {
    if (editing) leaveUi();
    return;
  }
  if (editing) {
    decorate();
    return;
  }
  if (new URLSearchParams(location.search).has("edit")) {
    enterEdit(kind);
    return;
  }
  document.body.appendChild(
    h("button.btn.btn-primary.ed-fab", { type: "button", onclick: () => enterEdit(kind) }, svgIcon(ICONS.pencil), "Edit portfolio"),
  );
}

// ============================================================================
// ENTER / LEAVE
// ============================================================================

async function enterEdit(kind) {
  const { state } = api;
  if (kind === "preview") {
    if (!ed.resume || ed.source?.type !== "local") begin(structuredClone(state.data.resume || {}), { type: "local" });
    ed.user = cachedUser();
  } else {
    ed.user = cachedUser();
    toast("Opening your resume…");
    let own = null;
    try {
      own = await fetchOwnResume();
    } catch (e) {
      toast(e.message, "error");
      return;
    }
    const local = readDraft();
    begin(
      own ? own.resume : { ...blankScaffold(), basics: { name: ed.user?.name || "" } },
      own ? own.source : { type: "local" },
      { base: own ? prune(own.resume) : null, savedAt: own?.source.updatedAt || null },
    );
    await offerDraft(local, own);
  }
  editing = true;
  const url = new URL(location.href);
  url.searchParams.set("edit", "");
  history.replaceState(history.state, "", url.pathname + url.search.replace(/=(&|$)/, "$1") + url.hash);
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
    ed.history.push(ed.resume);
    changed();
  }
}

function exitEdit() {
  if (ed.dirty) toast("Your unpublished changes are kept as a draft. Click Edit to continue.");
  editing = false;
  leaveUi();
  const url = new URL(location.href);
  url.searchParams.delete("edit");
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  api.rerender(api.state.data.resume, { editing: false });
}

function leaveUi() {
  ui?.toolbar.remove();
  ui?.bar.remove();
  ui?.drawer.remove();
  ui = null;
  ed.root = null;
  document.body.classList.remove("is-editing", "ed-drawer-open");
  bindControls({});
}

// ============================================================================
// RENDERING
// ============================================================================

function scheduleRerender() {
  if (!editing) return;
  // Typing in place already shows the change; re-render when the field is left
  if (document.activeElement?.closest?.("[data-edit-path]")) {
    pendingRerender = true;
    return;
  }
  clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(rerenderNow, 200);
}

async function rerenderNow() {
  pendingRerender = false;
  clearTimeout(rerenderTimer);
  if (api.state.vm?.source.type === "preview") {
    try {
      sessionStorage.setItem("mz-preview-json", JSON.stringify(ed.resume)); // survives a reload
    } catch {
      /* too large — the draft in localStorage still has it */
    }
  }
  await api.rerender(ed.resume, { editing: true });
}

async function onPublished() {
  api.setPublished(structuredClone(ed.resume));
  try {
    await clearRemoteDraft();
  } catch {
    /* nothing saved there */
  }
}

// ============================================================================
// INLINE AFFORDANCES
// ============================================================================

// Which rendered element edits which resume field, per section.
// `item`: the cards, in the same order as the view model's list.
const SECTION_FIELDS = {
  work: { item: ".entry", fields: { ".entry-title": "position", ".entry-subtitle": "name", ".entry-summary": "summary" }, highlights: true },
  volunteer: { item: ".entry", fields: { ".entry-title": "position", ".entry-subtitle": "organization", ".entry-summary": "summary" }, highlights: true },
  education: { item: ".entry", fields: { ".entry-subtitle": "institution" } },
  awards: { item: ".entry", fields: { ".entry-title": "title", ".entry-subtitle": "awarder", ".entry-summary": "summary" } },
  certificates: { item: ".entry", fields: { ".entry-title": "name", ".entry-subtitle": "issuer" } },
  publications: { item: ".entry", fields: { ".entry-title": "name", ".entry-subtitle": "publisher", ".entry-summary": "summary" } },
  interests: { item: ".card", fields: { ".entry-title": "name" } },
  languages: { item: ".chip-card", fields: { strong: "language", ".muted": "fluency" } },
  references: { item: ".quote", fields: { blockquote: "reference", figcaption: "name" } },
  skills: { item: ".skill-group", fields: { ".skill-name": "name", ".skill-level": "level" } },
  projects: { item: ".project-card", fields: { ".project-desc": "description" } },
};

const NOUNS = Object.fromEntries(SECTIONS.map((s) => [s.key, s.noun || "item"]));
const LABELS = Object.fromEntries(SECTIONS.map((s) => [s.key, s.label || s.key]));
/** Friendly placeholder for a field, from the template's field specs. */
const hintFor = (key, field) => {
  const f = SECTIONS.find((s) => s.key === key)?.fields?.find((x) => x[0] === field);
  return f ? f[3] || f[1] : field;
};

function decorate() {
  const { state } = api;
  const { vm, config } = state;
  document.body.classList.add("is-editing");
  const cfgText = config.text || {};

  // ---------- header ----------
  editable(document.querySelector(".profile-name"), ["basics", "name"], { placeholder: "Your name" });
  const title = document.querySelector(".profile-title");
  if (title) {
    const usesTagline = Boolean(getPath(ed.resume, ["meta", "mz-portfolio-config", "text", "tagline"]));
    editable(title, usesTagline ? null : ["basics", "label"], {
      placeholder: "What you do",
      onText: usesTagline ? (v) => setCfg(["text", "tagline"], v) : null,
    });
  } else {
    // No title yet: offer one under the name
    document.querySelector(".profile-name")?.after(h("p.profile-title.ed-ghost-field", { onclick: (e) => {
      setPath(ed.resume, ["basics", "label"], "Your title");
      changed();
      e.currentTarget.remove();
    } }, "+ Add a title"));
  }
  pencil(document.querySelector(".profile-photo"), "Change photo", () => popover("Photo", photoPicker()));
  pencil(document.querySelector(".profile-banner"), "Change banner", () => popover("Banner", bannerPicker()), "is-banner");

  // ---------- sections ----------
  for (const section of document.querySelectorAll("#view section.section[data-section]")) {
    const key = section.dataset.section;
    if (key === "about") decorateAbout(section, cfgText);
    const map = SECTION_FIELDS[key];
    if (!map) continue;
    const list = vm[key] || [];
    const cards = section.querySelectorAll(map.item);
    cards.forEach((card, i) => {
      const index = resumeIndex(key, list[i]);
      if (index < 0) {
        card.classList.add("ed-readonly");
        card.title = "From GitHub — edit it on GitHub";
        return;
      }
      for (const [sel, field] of Object.entries(map.fields)) {
        const el = card.querySelector(sel);
        if (el) editable(el, [key, index, field], { placeholder: hintFor(key, field) });
      }
      if (key === "projects") {
        const t = card.querySelector(".project-title");
        if (t && !t.querySelector(".project-stars")) editable(t, [key, index, "name"], { placeholder: "Project name" });
      }
      if (map.highlights) {
        card.querySelectorAll(".entry-highlights li").forEach((li, j) => editable(li, [key, index, "highlights", j], { placeholder: "Highlight" }));
      }
      itemToolbar(card, key, index);
    });
    section.appendChild(addButton(key));
  }

  // Sections with nothing in them yet
  const shown = new Set([...document.querySelectorAll("#view section.section[data-section]")].map((s) => s.dataset.section));
  const hidden = new Set(config.sections.hide);
  const missing = SECTIONS.filter((s) => s.key !== "basics" && !shown.has(s.key) && !hidden.has(s.key) && Array.isArray(templateResume()[s.key]));
  const sections = document.querySelector("#view .sections");
  if (sections && missing.length) {
    sections.appendChild(h("section.ed-missing", h("h2.section-title", "Add a section"),
      h("div.ed-missing-list", missing.map((s) => h("button.btn.btn-ghost", { type: "button", onclick: () => addItem(s.key) }, svgIcon(ICONS.plus), LABELS[s.key])))));
  }

  // ---------- blog ----------
  const view = document.getElementById("view");
  if (ed.user && editKind() === "own") {
    const blogList = view.querySelector(".blog");
    if (blogList && !view.querySelector(".ed-blog-actions")) {
      view.prepend(h("div.ed-blog-actions", h("button.btn.btn-primary", { type: "button", onclick: () => openDrawer("blog", () => openPost(null)) }, svgIcon(ICONS.plus), "New post")));
    }
    const post = api.state.page?.startsWith?.("post:") ? vm.posts.find((p) => `post:${p.slug}` === api.state.page) : null;
    if (post && !view.querySelector(".ed-blog-actions")) {
      view.prepend(h("div.ed-blog-actions", h("button.btn.btn-primary", { type: "button", onclick: () => editPost(post) }, svgIcon(ICONS.pencil), "Edit post")));
    }
  }
}

function decorateAbout(section, cfgText) {
  const prose = section.querySelector(".about-text .prose");
  if (!prose) return;
  const usesBio = Boolean(cfgText.bio);
  const raw = usesBio ? cfgText.bio : getPath(ed.resume, ["basics", "summary"]) || "";
  editable(prose, usesBio ? null : ["basics", "summary"], {
    multiline: true,
    raw,
    placeholder: "A few lines about you",
    onText: usesBio ? (v) => setCfg(["text", "bio"], v) : null,
  });
}

/** Index of a view-model item in the draft resume (same object), or -1. */
function resumeIndex(key, item) {
  if (!item) return -1;
  const list = ed.resume[key];
  if (!Array.isArray(list)) return -1;
  if (key === "projects") return item.fromResume === false ? -1 : (item.order ?? -1);
  if (key === "skills") return item.fromGithub ? -1 : list.findIndex((s) => s && s.name === item.name);
  return list.indexOf(item);
}

/** Makes an element typeable in place; changes go to `path` in the draft (or to onText). */
function editable(el, path, { multiline = false, raw, placeholder = "", onText = null } = {}) {
  if (!el || (!path && !onText)) return;
  // Shown values can be fallbacks (e.g. your GitHub name); an empty field shows its placeholder
  if (path && raw === undefined && !String(getPath(ed.resume, path) ?? "").trim()) el.textContent = "";
  el.contentEditable = "plaintext-only";
  if (el.contentEditable !== "plaintext-only") el.contentEditable = "true"; // older Firefox
  el.dataset.editPath = path ? path.join(".") : "cfg";
  el.dataset.placeholder = placeholder;
  el.spellcheck = true;
  el.setAttribute("role", "textbox");
  if (multiline) el.setAttribute("aria-multiline", "true");
  el.setAttribute("aria-label", `Edit ${placeholder}`);
  if (raw !== undefined) {
    el.addEventListener("focus", () => {
      el.textContent = raw; // edit the Markdown, not the rendered HTML
    }, { once: true });
  }
  el.addEventListener("input", () => {
    const value = multiline ? el.innerText.replace(/\n{3,}/g, "\n\n").trim() : el.textContent.replace(/\s+/g, " ").trim();
    if (onText) onText(value);
    else setPath(ed.resume, path, value);
    changed({ key: el.dataset.editPath });
  });
  el.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" && !multiline) || e.key === "Escape") {
      e.preventDefault();
      el.blur();
    }
  });
  el.addEventListener("paste", (e) => {
    // Plain text only, everywhere
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, multiline ? text : text.replace(/\s+/g, " "));
  });
  el.addEventListener("blur", () => {
    if (pendingRerender) rerenderNow();
  });
}

function pencil(target, label, onclick, extra = "") {
  if (!target) return;
  const host = target.closest(".profile-banner") || target.parentElement;
  if (host.querySelector(`:scope > .ed-pencil[aria-label="${label}"]`)) return;
  const btn = h(`button.ed-pencil${extra ? `.${extra}` : ""}`, { type: "button", "aria-label": label, title: label, onclick }, svgIcon(ICONS.pencil));
  if (target.classList.contains("profile-banner")) target.appendChild(btn);
  else {
    // Pin to the photo's top-right edge, wherever the layout puts the photo
    target.parentElement.classList.add("ed-photo-host");
    target.after(btn);
    const place = () => {
      btn.style.left = `${target.offsetLeft + target.offsetWidth - 34}px`;
      btn.style.top = `${target.offsetTop + 2}px`;
    };
    place();
    new ResizeObserver(place).observe(target.parentElement);
  }
}

function itemToolbar(card, key, index) {
  const list = ed.resume[key];
  const move = (to) => {
    if (to < 0 || to >= list.length) return;
    const [it] = list.splice(index, 1);
    list.splice(to, 0, it);
    changed();
  };
  card.classList.add("ed-item-host");
  card.appendChild(h("div.ed-item-tools", { role: "toolbar", "aria-label": `${NOUNS[key]} ${index + 1}` },
    iconButton("chevronUp", "Move up", () => move(index - 1)),
    iconButton("chevronDown", "Move down", () => move(index + 1)),
    iconButton("copy", "Duplicate", () => {
      list.splice(index + 1, 0, structuredClone(list[index]));
      changed();
    }),
    iconButton("sliders", "More fields", () => openDrawer("resume", () => revealGroup(`resume:${key}`, index))),
    iconButton("close", "Delete", () => {
      list.splice(index, 1);
      if (!list.length) delete ed.resume[key];
      changed();
      toast(`${NOUNS[key][0].toUpperCase()}${NOUNS[key].slice(1)} deleted. Undo with Ctrl+Z.`);
    }),
  ));
}

function addButton(key) {
  return h("button.btn.btn-ghost.ed-add", { type: "button", onclick: () => addItem(key) }, svgIcon(ICONS.plus), `Add ${NOUNS[key]}`);
}

function addItem(key) {
  const sample = templateResume()[key]?.[0] || {};
  if (!Array.isArray(ed.resume[key])) ed.resume[key] = [];
  ed.resume[key].push(structuredClone(sample));
  changed();
  // Focus the new item's first field once it's rendered
  setTimeout(() => {
    const section = document.querySelector(`#view section[data-section="${key}"]`);
    const items = section?.querySelectorAll("[data-edit-path]");
    const last = items?.[items.length - 1]?.closest(".ed-item-host")?.querySelector("[data-edit-path]");
    if (last) {
      last.scrollIntoView({ block: "center", behavior: "smooth" });
      last.focus();
      document.execCommand("selectAll");
    }
  }, 450);
}

async function editPost(post) {
  openDrawer("blog", async () => {
    try {
      if (!ed.posts) await loadPosts();
      const match = ed.posts.find((p) => p.gistId === post.id) || ed.posts.find((p) => p.title === post.title);
      await openPost(match || null);
    } catch (e) {
      toast(e.message, "error");
    }
  });
}

// ============================================================================
// TOOLBAR, BAR, DRAWER, POPOVER
// ============================================================================

function mountUi(kind) {
  leaveUi();
  document.body.classList.add("is-editing");
  const undoBtn = iconButton("undo", "Undo (Ctrl+Z)", undo);
  const redoBtn = iconButton("redo", "Redo (Ctrl+Shift+Z)", redo);
  const statusEl = h("button.ed-status", { type: "button", title: "See what changed", onclick: showChanges });
  const saveBtn = h("button.btn.btn-primary", { type: "button", onclick: () => (kind === "preview" && !ed.user ? openSignIn() : save()) });

  const toolbar = h("div.ed-toolbar", { role: "toolbar", "aria-label": "Edit mode" },
    h("span.ed-toolbar-label", svgIcon(ICONS.pencil), "Editing"),
    h("button.btn.btn-ghost", { type: "button", onclick: () => openDrawer(ed.tab === "json" ? "json" : "settings") }, svgIcon(ICONS.sliders), "Customize"),
    h("button.btn.btn-ghost", { type: "button", onclick: exitEdit }, "Done"),
  );

  const extra = kind === "preview"
    ? [
        iconButton("copy", "Copy JSON", async () => toast((await copyText(json())) ? "JSON copied" : "Couldn't copy")),
        iconButton("download", "Download resume.json", () => downloadFile("resume.json", json(), "application/json")),
      ]
    : [h("button.btn.btn-ghost.ed-save-draft", { type: "button", onclick: saveDraftToGitHub }, "Save draft")];

  const bar = h("div.ed-bar", { role: "region", "aria-label": "Changes" },
    h("div.ed-bar-group", undoBtn, redoBtn, statusEl),
    h("div.ed-bar-group", ...extra, saveBtn),
  );

  const drawer = h("aside.ed-drawer", { "aria-label": "Customize", hidden: true });
  document.body.append(toolbar, bar, drawer);
  ui = { toolbar, bar, drawer };
  bindControls({ saveBtn, statusEl, undoBtn, redoBtn });
  if (kind === "preview" && !ed.user) saveBtn.textContent = "Sign in to publish";
}

const json = () => `${JSON.stringify(prune(ed.resume), null, 2)}\n`;

const DRAWER_TABS = [["resume", "Content"], ["settings", "Customize"], ["blog", "Blog"], ["json", "JSON"]];

function openDrawer(tab = "settings", then) {
  if (!ui) return;
  ed.tab = tab;
  const { drawer } = ui;
  const tabs = h("nav.ed-tabs", { "aria-label": "Customize sections" },
    DRAWER_TABS.map(([key, label]) => h("button.tab", { type: "button", "aria-current": key === ed.tab ? "page" : null, onclick: () => {
      ed.tab = key;
      ed.post = null;
      tabs.querySelectorAll(".tab").forEach((t, i) => (DRAWER_TABS[i][0] === key ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current")));
      renderPanel();
    } }, label)));
  drawer.replaceChildren(
    h("header.ed-drawer-head", h("strong", "Customize"), iconButton("close", "Close", closeDrawer)),
    tabs,
    h("div.ed-scroll", { id: "ed-panel" }),
  );
  drawer.hidden = false;
  document.body.classList.add("ed-drawer-open");
  ed.root = drawer;
  renderPanel();
  then?.();
}

function closeDrawer() {
  if (!ui) return;
  ui.drawer.hidden = true;
  document.body.classList.remove("ed-drawer-open");
  ed.root = null;
  ed.post = null;
}

function popover(title, content) {
  const dialog = h("dialog.ed-dialog.ed-popover",
    h("div.ed-popover-body",
      h("header.ed-drawer-head", h("strong", title), iconButton("close", "Close", () => dialog.close())),
      content,
      h("div.ed-row", h("button.btn.btn-primary", { type: "button", onclick: () => dialog.close() }, "Done")),
    ),
  );
  dialog.addEventListener("close", () => dialog.remove());
  dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());
  document.body.appendChild(dialog);
  dialog.showModal();
}

// ============================================================================
// DRAFT ON GITHUB — a secret gist, so you can continue on another device.
// Secret gists are unlisted (anyone with the link can open them), never shown
// on the portfolio, and don't touch the public resume gist.
// ============================================================================

async function findDraftGist() {
  const gists = await listMyGists();
  return gists.find((g) => g.files?.[DRAFT_FILE]) || null;
}

async function saveDraftToGitHub() {
  if (!ed.user) return openSignIn();
  const content = `${JSON.stringify({ savedAt: new Date().toISOString(), gistId: ed.source?.id || null, resume: ed.resume }, null, 2)}\n`;
  try {
    const existing = await findDraftGist();
    if (existing) await updateGist(existing.id, { files: { [DRAFT_FILE]: { content } } });
    else await createGist({ description: "mz-portfolio draft (unpublished changes)", files: { [DRAFT_FILE]: { content } }, isPublic: false });
    toast("Draft saved to GitHub. Open edit mode on any device to continue.");
  } catch (e) {
    toast(e.message, "error");
  }
}

async function loadRemoteDraft() {
  if (!getToken()) return null;
  const found = await findDraftGist();
  if (!found) return null;
  const full = await getGist(found.id);
  const data = JSON.parse((await gistFileText(full, DRAFT_FILE)) || "null");
  return data?.resume ? data : null;
}

async function clearRemoteDraft() {
  const found = await findDraftGist();
  if (found) await deleteGist(found.id);
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
    save();
    return;
  }
  const inForm = e.target instanceof HTMLElement && e.target.matches(".ed-json, .ed-md");
  if (mod && !inForm && (key === "z" || key === "y")) {
    e.preventDefault();
    document.activeElement?.blur?.();
    if (key === "y" || e.shiftKey) redo();
    else undo();
    return;
  }
  if (e.key === "Escape" && ui && !ui.drawer.hidden) closeDrawer();
  if (!mod && e.key === "?" && !(e.target instanceof HTMLElement && e.target.matches("input, textarea, [contenteditable]"))) {
    e.preventDefault();
    showShortcuts();
  }
}

/** /edit: your own portfolio in edit mode, or the template as a preview when signed out. */
export function routeEdit(navigate) {
  const user = cachedUser();
  if (user && getToken()) {
    navigate(`${BASE_PATH}${encodeURIComponent(user.login)}?edit`, { replace: true });
    return;
  }
  try {
    const draft = readDraft();
    const resume = draft?.source?.type === "local" ? draft.resume : templateResume();
    sessionStorage.setItem("mz-preview-json", JSON.stringify(resume));
  } catch {
    /* storage full — the preview page explains */
  }
  navigate(`${BASE_PATH}preview/view?edit`, { replace: true });
}

export { loginUrl };
