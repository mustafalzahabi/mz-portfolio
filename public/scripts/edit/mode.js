// ============================================================================
// EDIT MODE — edit a portfolio on the page, one object at a time.
// Your own portfolio (signed in, GitHub source) and preview pages get an
// "Edit portfolio" button. In edit mode every object has an Edit button that
// opens a panel (bottom sheet on phones, side panel on desktop) with its
// fields; the page updates live behind it. Projects and blog posts are edited
// on their own pages. Nothing is read-only: GitHub-derived items offer
// "Add to my resume" or "Hide". Drafts stay in this browser and can be saved
// to a secret gist (mz-portfolio-draft.json) to continue on another device.
// ============================================================================

import { h, svgIcon, toast, copyText, downloadFile } from "../utils.js";
import { ICONS } from "../icons.js";
import { BASE_PATH, parsePath, navigate } from "../router.js";
import { setPath, prune, getPath } from "../editor-core.js";
import { SECTIONS, BASICS_FIELDS, LOCATION_FIELDS, PROFILE_FIELDS, templateResume, blankScaffold } from "../template.js";
import { session, storage, DRAFT_FILE as SHARED_DRAFT_FILE } from "../storage.js";
import { dropdown } from "../account.js";
import { normalizeConfig } from "../config.js";
import { getResumeFilename } from "../data.js";
import { openSheet, closeSheet, sheetOpen } from "./sheet.js";
import { canEditReadme, openReadmeEditor, resumeReadmeEdit } from "./readme.js";
import { editInPlace, focusLater } from "./inline.js";
import {
  ed, hooks, ago, begin, changed, undo, redo, save, readDraft, bindControls,
  renderPanel, openPost, loadPosts, photoPicker, bannerPicker, openSignIn, showChanges,
  showShortcuts, choiceDialog, fetchOwnResume, beforeUnload, iconButton, setCfg,
  cfgFields, boundInput, itemList, imageSource, tabsGroup,
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
  if (editing) {
    if (followRenamedProject()) return;
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
  setEditParam(true);
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

function exitEdit() {
  if (ed.dirty) toast("Your unpublished changes are kept as a draft. Click Edit portfolio to continue.");
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
  document.body.classList.remove("is-editing");
  bindControls({});
}

function setEditParam(on) {
  const url = new URL(location.href);
  if (on) url.searchParams.set("edit", "");
  else url.searchParams.delete("edit");
  history.replaceState(history.state, "", url.pathname + url.search.replace(/=(&|$)/, "$1") + url.hash);
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
    const typing = document.activeElement?.closest?.(".ed-inline");
    if (typing) typing.addEventListener("blur", scheduleRerender, { once: true });
    else rerenderNow();
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

function decorate() {
  const page = api.state.page || "";
  document.body.classList.add("is-editing");

  const info = document.querySelector(".profile-info");
  if (info) editButton(info, "Edit profile", openProfile, ".is-header", "Edit profile");
  const banner = document.querySelector(".profile-banner");
  if (banner) editButton(banner, "Edit banner", openBanner, ".is-banner", "Banner");

  inlinePaths(document.querySelector(".profile-info"));
  if (page === "profile") decorateProfile();
  else if (page.startsWith("project:")) decorateProject(decodeURIComponent(page.slice(8)));
  else if (page === "blog") decorateBlog();
  else if (page.startsWith("post:")) decoratePost(decodeURIComponent(page.slice(5)));
  else if (page.startsWith("tab:")) addPageAction("Edit tabs", "pencil", openTabs);

  const footer = document.querySelector("body > #app > .site-footer, #app .site-footer");
  if (footer) editButton(footer, "Edit footer", openFooter, ".is-inline");
}

function decorateProfile() {
  const { vm, config } = api.state;
  for (const section of document.querySelectorAll("#view section.section[data-section]")) {
    const key = section.dataset.section;
    section.classList.add("ed-section");
    section.querySelector(".section-title")?.after(sectionBar(key));
    inlinePaths(section.querySelector(":scope > .section-title"), SPEC[key]?.label);
    const selector = ITEM_SELECTOR[key];
    if (!selector) continue;
    const list = vm[key] || [];
    section.querySelectorAll(selector).forEach((card, i) => {
      const item = list[i];
      const index = resumeIndex(key, item);
      if (key === "projects") {
        card.addEventListener("click", (e) => {
          if (e.target.closest(".ed-edit")) return;
          e.preventDefault();
          editProject(item);
        });
        editButton(card, `Edit ${item?.name || "project"}`, () => editProject(item), ".is-item", "Edit");
      } else if (index < 0) {
        editButton(card, "Edit (from GitHub)", openGithubSkills, ".is-item");
      } else {
        editButton(card, `More details for this ${noun(key)}`, () => openItem(key, index), ".is-item");
        inlineItem(card, key, index);
      }
    });
  }

  // Sections with nothing in them yet, and hidden ones
  const shown = new Set([...document.querySelectorAll("#view section.section[data-section]")].map((s) => s.dataset.section));
  const hidden = config.sections.hide;
  const addable = SECTIONS.filter((s) => !shown.has(s.key) && !hidden.includes(s.key));
  const sections = document.querySelector("#view .sections");
  if (sections && (addable.length || hidden.length)) {
    sections.appendChild(h("section.ed-more-sections",
      addable.length ? h("div", h("h2", "Add a section"),
        h("div.ed-chip-row", addable.map((s) => h("button.btn.btn-ghost", { type: "button", onclick: () => (s.key === "projects" ? addProject() : addItem(s.key)) }, svgIcon(ICONS.plus), s.label)))) : null,
      hidden.length ? h("div", h("h2", "Hidden sections"),
        h("div.ed-chip-row", hidden.map((key) => h("button.btn.btn-ghost", { type: "button", onclick: () => toggleSection(key, false) }, svgIcon(ICONS.eye), `Show ${SPEC[key]?.label || cap(key)}`)))) : null,
    ));
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
      placeholder: placeholder || el.textContent.trim() || "Type here",
      read: () => (isCfg ? getPath(cfg(), path) : getPath(ed.resume, path)) ?? "",
      write: (v) => {
        if (isCfg) setCfg(path, v || undefined);
        else setPath(ed.resume, path, v);
        changed();
      },
    });
  }
}

const FIELD_HINTS = { position: "Job title", name: "Name", company: "Company", organization: "Organization", summary: "A short summary", institution: "School", title: "Title", awarder: "Awarded by", issuer: "Issuer", publisher: "Publisher", language: "Language", fluency: "Fluency" };

/** The fields of one resume item (data-field="position", "highlights.2", …). */
function inlineItem(card, key, index) {
  card.dataset.edIndex = String(index);
  const base = `#view section[data-section="${key}"] [data-ed-index="${index}"]`;
  for (const el of card.querySelectorAll("[data-field]")) {
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
    key === "about" ? smallBtn("pencil", "Edit", openAbout)
    : key === "contact" ? smallBtn("pencil", "Edit", openContact)
    : key === "projects" ? smallBtn("plus", "Add", addProject)
    : SPEC[key] ? smallBtn("plus", "Add", () => addItem(key))
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
  addPageAction("Edit project", "pencil", () => editProject(p));
  if (p.repo && canEditReadme(p)) {
    const onSaved = () => api.rerender(ed.resume);
    const open = () => openReadmeEditor(p, { onSaved });
    addPageAction("Edit README", "github", open, "ghost");
    editButton(document.querySelector(".project-readme"), "Edit README", open, ".ed-edit-readme", "Edit README");
    if (resumeReadmeEdit(p, onSaved)) return;
  }
  if (ed.openProjectSheet) {
    ed.openProjectSheet = false;
    editProject(p);
  }
}

function decorateBlog() {
  if (editKind() !== "own") return;
  addPageAction("New post", "plus", () => openBlog(null));
  const results = document.querySelector(".blog-results");
  const mark = () => results?.querySelectorAll(".post-card").forEach((card) => {
    const slug = decodeURIComponent(card.querySelector("a")?.getAttribute("href")?.split("/").pop() || "");
    const post = api.state.vm.posts.find((x) => x.slug === slug);
    // A post is edited on its own page: the card only offers the way there
    if (post) editButton(card, `Edit ${post.title}`, () => editPost(post), ".is-item", "Edit");
  });
  mark();
  if (results && !results.dataset.edObserved) {
    results.dataset.edObserved = "1";
    new MutationObserver(() => editing && mark()).observe(results, { childList: true });
  }
}

function decoratePost(slug) {
  if (editKind() !== "own") return;
  const post = api.state.vm.posts.find((x) => x.slug === slug);
  if (!post) return;
  addPageAction("Edit post", "pencil", () => openBlog(post));
  if (ed.openPostSheet === post.slug) {
    ed.openPostSheet = null;
    openBlog(post);
  }
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

function editButton(host, label, onclick, extra = "", text = "") {
  if (!host || host.querySelector(`:scope > .ed-edit[aria-label="${CSS.escape(label)}"]`)) return;
  host.classList.add("ed-host");
  host.appendChild(h(`button.ed-edit${extra}`, {
    type: "button", "aria-label": label, title: label,
    onclick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      onclick();
    },
  }, svgIcon(ICONS.pencil), text ? h("span", text) : null));
}

function smallBtn(icon, label, onclick) {
  return h("button.btn.btn-ghost.ed-small", { type: "button", onclick }, svgIcon(ICONS[icon]), label);
}

function addPageAction(label, icon, onclick, kind = "primary") {
  const view = document.getElementById("view");
  if (!view) return;
  let bar = view.querySelector(":scope > .ed-page-actions");
  if (!bar) view.prepend((bar = h("div.ed-page-actions")));
  if ([...bar.children].some((b) => b.textContent === label)) return;
  bar.appendChild(h(`button.btn.btn-${kind}`, { type: "button", onclick }, svgIcon(ICONS[icon]), label));
}

// ============================================================================
// PANELS
// ============================================================================

/** A panel built from forms; edits re-render the page, list changes re-render the panel. */
function formSheet(title, render, opts = {}) {
  ed.root = null;
  const sheet = openSheet({
    title, render, ...opts,
    onClose: () => {
      ed.sheetRender = null;
      opts.onClose?.();
    },
  });
  ed.sheetRender = sheet.refresh;
  return sheet;
}

const doneBtn = () => h("button.btn.btn-primary", { type: "button", onclick: closeSheet }, "Done");

function openProfile() {
  formSheet("Profile", () => [
    photoPicker(),
    ...BASICS_FIELDS.filter(([k]) => k !== "image").map(([k, label, kind, ph]) => boundInput(["basics", k], label, kind, { placeholder: ph })),
    h("h3.ed-sub", "Location"),
    h("div.ed-grid", LOCATION_FIELDS.map(([k, label, kind, ph]) => boundInput(["basics", "location", k], label, kind, { placeholder: ph }))),
    h("h3.ed-sub", "Profile links"),
    itemList({ path: ["basics", "profiles"], fields: PROFILE_FIELDS, noun: "profile", title: (p) => [p.network, p.username].filter(Boolean).join(" · "), addLabel: "Add profile link" }),
    h("h3.ed-sub", "Header"),
    ...cfgFields("text", ["tagline"]),
    ...cfgFields("header"),
    ...cfgFields("profile", ["photoShape"]),
  ], { actions: doneBtn() });
}

function openBanner() {
  formSheet("Banner", () => [bannerPicker(), ...cfgFields("banner", ["aspect", "overlay"])], { actions: doneBtn() });
}

function openAbout() {
  formSheet("About", () => [
    boundInput(["basics", "summary"], "About you", "textarea", { placeholder: "A few sentences about you and your work. Markdown works." }),
    ...cfgFields("text", ["bio"]),
  ], { actions: doneBtn() });
}

function openContact() {
  formSheet("Contact", () => [
    ...cfgFields("text", ["contact_message"]),
    h("p.ed-hint", "The links come from your email, phone, website and profile links."),
    h("button.btn.btn-ghost", { type: "button", onclick: openProfile }, svgIcon(ICONS.pencil), "Edit contact details"),
  ], { actions: doneBtn() });
}

function openFooter() {
  formSheet("Footer", () => cfgFields("footer"), { actions: doneBtn() });
}

function openTabs() {
  formSheet("Tabs", () => [h("p.ed-hint", "Extra pages next to Profile and Blog: links, Markdown, code, HTML demos or embeds."), tabsGroup()], { actions: doneBtn() });
}

function openGithubSkills() {
  formSheet("Languages on GitHub", () => [
    h("p.ed-hint", "This group is built from the languages of your public GitHub repos. Turn it off, or add your own skill groups instead."),
    ...cfgFields("skills"),
    h("button.btn.btn-ghost", { type: "button", onclick: () => addItem("skills") }, svgIcon(ICONS.plus), "Add a skill group"),
  ], { actions: doneBtn() });
}

/** The full form of one item of a resume section, with move / duplicate / delete. */
function openItem(key, index) {
  const spec = SPEC[key];
  const list = () => ed.resume[key] || [];
  const move = (d) => {
    const arr = list();
    const j = index + d;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    index = j;
    changed();
    ed.sheetRender?.();
  };
  formSheet(`Edit ${spec.noun}`, () => {
    if (!list()[index]) return [h("p.muted", "This item no longer exists.")];
    return spec.fields.map(([k, label, kind, ph]) => boundInput([key, index, k], label, kind, { placeholder: ph }));
  }, {
    subtitle: spec.label,
    actions: [
      h("div.ed-row",
        iconButton("chevronUp", "Move up", () => move(-1)),
        iconButton("chevronDown", "Move down", () => move(1)),
        iconButton("copy", "Duplicate", () => {
          list().splice(index + 1, 0, structuredClone(list()[index]));
          index += 1;
          changed();
          ed.sheetRender?.();
          toast(`${cap(spec.noun)} duplicated.`);
        }),
        iconButton("close", "Delete", () => {
          list().splice(index, 1);
          if (!list().length) delete ed.resume[key];
          changed();
          closeSheet();
          toast(`${cap(spec.noun)} deleted. Undo with Ctrl+Z or the bottom bar.`);
        }, ".danger"),
      ),
      doneBtn(),
    ],
  });
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
  openItem(key, index);
}

// ---------- projects: edited on their own page ----------

function editProject(p) {
  if (!p) return;
  const sub = parsePath().sub;
  const onPage = sub?.name === "project" && sub.param === p.slug;
  if (!onPage) {
    ed.openProjectSheet = true;
    ed.projectIndex = p.fromResume === false ? null : p.order;
    navigate(`${api.state.base}/project/${encodeURIComponent(p.slug)}?edit`);
    return;
  }
  if (p.fromResume === false) return openGithubProject(p);
  ed.projectIndex = p.order;
  openProject(p.order);
}

function openProject(index) {
  const spec = SPEC.projects;
  formSheet("Edit project", () => {
    const item = (ed.resume.projects || [])[index];
    if (!item) return [h("p.muted", "This project no longer exists.")];
    return [
      h("h3.ed-sub", "Cover image"),
      imageSource(`project-${index}`, item.image || "", (v) => {
        setPath(ed.resume, ["projects", index, "image"], v);
        changed();
        ed.sheetRender?.();
      }),
      ...spec.fields.map(([k, label, kind, ph]) => boundInput(["projects", index, k], label, kind, { placeholder: ph })),
      boundInput(["projects", index, "images"], "More images (gallery)", "list", { placeholder: "One image link per line" }),
    ];
  }, {
    subtitle: "Projects",
    onClose: () => (ed.projectIndex = null),
    actions: [
      h("button.btn.btn-ghost.ed-danger", { type: "button", onclick: () => {
        ed.resume.projects.splice(index, 1);
        if (!ed.resume.projects.length) delete ed.resume.projects;
        ed.projectIndex = null;
        changed();
        closeSheet();
        navigate(`${api.state.base}#projects`);
        toast("Project deleted. Undo with Ctrl+Z.");
      } }, svgIcon(ICONS.close), "Delete"),
      doneBtn(),
    ],
  });
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
  // Once the page shows it, open its own page with the panel
  setTimeout(() => {
    const p = api.state.vm.projects.find((x) => x.fromResume !== false && x.order === index);
    if (p) editProject(p);
  }, 450);
}

/** A repo from GitHub: make it a resume project, or hide it. */
function openGithubProject(p) {
  formSheet("From GitHub", () => [
    h("p.ed-hint", `“${p.name}” comes from your public GitHub repos. Add it to your resume to edit its name, description, images and more.`),
    h("button.btn.btn-primary", { type: "button", onclick: () => {
      if (!Array.isArray(ed.resume.projects)) ed.resume.projects = [];
      ed.resume.projects.push(prune({ name: p.name, description: p.description, url: p.github || p.url, keywords: p.keywords?.length ? p.keywords : undefined }));
      ed.projectIndex = ed.resume.projects.length - 1;
      changed();
      closeSheet();
      setTimeout(() => openProject(ed.projectIndex), 450);
    } }, svgIcon(ICONS.plus), "Add to my resume"),
    h("button.btn.btn-ghost", { type: "button", onclick: () => {
      setCfg(["projects", "exclude"], [...new Set([...cfg().projects.exclude, p.name])]);
      changed();
      closeSheet();
      navigate(`${api.state.base}#projects`);
      toast(`${p.name} hidden. Find it again under Customize.`);
    } }, svgIcon(ICONS.eye), "Hide this repo"),
    h("h3.ed-sub", "GitHub repos"),
    ...cfgFields("projects", ["github", "showForks", "showStars", "sort"]),
  ], { actions: doneBtn() });
}

// ---------- panels that reuse the editor's tabbed panels ----------

/** A panel showing one of core.js's tab panels (settings, resume, blog, json). */
function panelSheet(title, tab, { tabs = null, then = null } = {}) {
  ed.sheetRender = null;
  ed.tab = tab;
  const nav = tabs
    ? h("nav.ed-tabs", { "aria-label": `${title} sections` },
        tabs.map(([key, label]) => h("button.tab", { type: "button", "aria-current": key === ed.tab ? "page" : null, onclick: (e) => {
          ed.tab = key;
          ed.post = null;
          nav.querySelectorAll(".tab").forEach((t) => t.removeAttribute("aria-current"));
          e.currentTarget.setAttribute("aria-current", "page");
          renderPanel();
        } }, label)))
    : null;
  const sheet = openSheet({
    title, wide: true,
    render: () => [nav, h("div.ed-scroll", { id: "ed-panel" })],
    onClose: () => {
      ed.root = null;
      ed.post = null;
    },
  });
  ed.root = sheet.el;
  renderPanel();
  then?.();
  return sheet;
}

function openCustomize() {
  panelSheet("Customize", ed.tab === "json" ? "json" : "settings", {
    tabs: [["settings", "Design & settings"], ["resume", "All content"], ...(editKind() === "own" ? [["blog", "Blog"]] : []), ["json", "JSON"]],
  });
}

/** Goes to the post's own page in edit mode, where its editor opens. */
function editPost(post) {
  const sub = parsePath().sub;
  if (sub?.name === "post" && sub.param === post.slug) return openBlog(post);
  ed.openPostSheet = post.slug;
  navigate(`${api.state.base}/blog/${encodeURIComponent(post.slug)}?edit`);
}

function openBlog(post) {
  panelSheet(post ? "Edit post" : "New post", "blog", {
    then: async () => {
      try {
        if (!post) return openPost(null);
        if (!ed.posts) await loadPosts();
        const match = ed.posts.find((p) => p.gistId === post.id) || ed.posts.find((p) => p.title === post.title);
        await openPost(match || null);
      } catch (e) {
        toast(e.message, "error");
      }
    },
  });
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
    h("button.btn.btn-ghost", { type: "button", onclick: openCustomize }, svgIcon(ICONS.sliders), h("span.ed-btn-text", "Customize")),
    h("button.btn.btn-ghost", { type: "button", onclick: exitEdit }, "Done"),
  );

  const more = dropdown({
    button: h("button.ed-icon-btn", { type: "button", title: "More" }, svgIcon(ICONS.more)),
    label: "More actions",
    className: ".ed-more",
    items: [
      kind === "own" ? { label: `Save draft to ${storage()?.label || "your account"}`, icon: "upload", onclick: saveDraftToAccount } : null,
      kind === "own" ? { label: "New blog post", icon: "plus", onclick: () => openBlog(null) } : null,
      { label: "Discard changes", icon: "undo", onclick: discardChanges },
      "sep",
      { label: "Copy JSON", icon: "copy", onclick: async () => toast((await copyText(json())) ? "JSON copied" : "Couldn't copy") },
      { label: "Download resume.json", icon: "download", onclick: () => downloadFile("resume.json", json(), "application/json") },
      { label: "Keyboard shortcuts", icon: "keyboard", onclick: showShortcuts },
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
