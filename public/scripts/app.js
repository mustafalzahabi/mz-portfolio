// ============================================================================
// APP — routing, loading, and assembling the portfolio
// ============================================================================

import { h, svgIcon, safeUrl } from "./utils.js";
import { ICONS } from "./icons.js";
import { debug } from "./log.js";
import { BASE_PATH, parsePath, rescueRedirect, interceptLinks, navigate } from "./router.js";
import { initTheme, setOwnerDefault } from "./theme.js";
import { normalizeConfig, applyStyleConfig, resetStyleConfig } from "./config.js";
import { collectPortfolioData } from "./data.js";
import { buildViewModel } from "./merge.js";
import {
  SECTION_BUILDERS,
  buildHeader,
  buildTabs,
  buildSectionNav,
  buildFooter,
  buildBlogList,
  buildBlogPost,
  buildProjectPage,
  buildPageBar,
  buildTabPage,
  setTagOptions,
  enrichProjectCovers,
} from "./components.js";
import { loadLanguageColors } from "./languages.js";
import { setupAnimations, teardownAnimations } from "./animations/index.js";
import { openResumeOverlay } from "./resume/index.js";
import { renderLanding } from "./views/landing.js";
import { renderDocs } from "./views/docs.js";
import { renderEditor } from "./views/editor.js";
import { renderPreviewEditor, getPreviewJson, analyzeResume } from "./views/preview.js";
import {
  showLoading,
  showNotFound,
  showRateLimited,
  showError,
  showInvalidResume,
  showEmpty,
  showOfflineBanner,
} from "./views/status.js";

// ============================================================================
// STATE
// ============================================================================

const state = {
  loadId: 0, // bumps on every navigation; stale async work checks it
  key: null, // "gh:user" | "gd:id" | "auto:user" | "preview"
  base: "", // "/<id>" or "/preview/view" — prefix for sub-page links
  vm: null,
  config: null,
  photo: "",
  shell: null, // "profile" (banner + tabs) | "page" (slim bar, e.g. project pages)
  page: null, // which view is rendered inside the shell
  introPlayed: false,
  profileScroll: 0,
  blogState: { query: "", tag: "", page: 1 },
  resumeOverlay: null,
};

let lastRoutedHref = null;

// Inside the editor's live-preview frame: no intro animations, no preview bar.
const EMBEDDED = typeof window !== "undefined" && window.self !== window.top;

// ============================================================================
// ROUTING
// ============================================================================

async function route() {
  const path = parsePath();
  debug("route", path, location.hash);

  if (path.view !== "portfolio") {
    closeResume();
    resetPortfolio();
    if (path.view === "docs") renderDocs();
    else if (path.view === "edit") renderEditor();
    else if (path.view === "preview") renderPreviewEditor(() => navigate(`${BASE_PATH}preview/view`));
    else renderLanding();
    focusMain();
    return;
  }

  const key = path.preview ? "preview" : `${path.source}:${path.id.toLowerCase()}`;
  if (state.key === key && state.vm) {
    renderSub(path.sub);
    return;
  }

  resetPortfolio();
  const loadId = state.loadId;
  let result;

  if (path.preview) {
    const json = getPreviewJson();
    try {
      if (!json) throw new Error("no preview");
      const { resume } = analyzeResume(json);
      result = { status: "ok", data: { resume, github: null, repos: [], posts: [], source: { type: "preview", id: "preview", hasResume: true } } };
    } catch {
      navigate(`${BASE_PATH}preview`, { replace: true });
      return;
    }
  } else {
    showLoading();
    result = await collectPortfolioData(path.source, path.id);
    if (loadId !== state.loadId) return; // navigated elsewhere while loading
  }

  switch (result.status) {
    case "notfound":
      return showNotFound(path.id, result.reason);
    case "ratelimited":
      return showRateLimited(result.resetAt);
    case "invalid":
      return showInvalidResume(result.error, null);
    case "error":
      return showError(result.message, result);
  }

  const { data } = result;
  if (!data.resume && !data.repos.length) return showEmpty(path.id);
  if (!(await showPortfolio(data, key, path.base, loadId))) return;
  renderSub(path.sub);
  if (result.offline) showOfflineBanner(result);
}

// Clears everything one portfolio applied (its colors, fonts, radius, motion,
// theme default) so the next page never inherits another owner's look.
function resetPortfolio() {
  state.loadId++;
  teardownAnimations();
  document.querySelector(".offline-banner")?.remove();
  resetStyleConfig();
  state.key = null;
  state.vm = null;
  state.shell = null;
  state.page = null;
  state.introPlayed = false;
  state.profileScroll = 0;
  state.blogState = { query: "", tag: "", page: 1 };
  setOwnerDefault("auto");
}

// ============================================================================
// PORTFOLIO DATA → STATE
// ============================================================================

/** Prepares a portfolio; returns false if the visitor navigated away meanwhile. */
async function showPortfolio(data, key, base, loadId = state.loadId) {
  const { config, warnings } = normalizeConfig(data.resume?.meta || {});
  if (warnings.length) debug("config warnings", warnings);

  const vm = buildViewModel(data, config);
  // README covers (raw host) and GitHub language colors, with a capped wait
  await Promise.race([
    Promise.all([enrichProjectCovers(vm.projects), config.tags.languageColors ? loadLanguageColors() : null]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  if (loadId !== state.loadId) return false;

  // This owner's look applies only now, while their portfolio is shown
  applyStyleConfig(config);
  setOwnerDefault(config.theme.mode);
  if (EMBEDDED) config.animation.intro = "none";
  setTagOptions({ languageColors: config.tags.languageColors });

  state.key = key;
  state.base = base;
  state.vm = vm;
  state.config = config;
  state.photo = pickPhoto(vm, config);
  state.shell = null;
  state.page = null;
  state.introPlayed = false;
  return true;
}

function pickPhoto(vm, config) {
  const p = config.profile.photo;
  if (p === "none") return "";
  if (p === "gh" || p === "github") return vm.basics.githubAvatar || vm.basics.image;
  return p || vm.basics.image || vm.basics.githubAvatar || "";
}

function ctx() {
  const { config } = state;
  return {
    base: state.base,
    locale: config.text.locale,
    present: config.text.present,
    photo: state.photo,
    bannerImage: safeUrl(config.banner.image, { allowDataImage: true }),
    homeHref: BASE_PATH,
    openResume: () => navigate(`${state.base}/resume`),
  };
}

// ============================================================================
// SHELLS — "profile": banner, identity, tabs · "page": slim bar (project pages)
// ============================================================================

function ensureShell(kind, active) {
  if (state.shell === kind) return;
  const { vm, config } = state;
  const c = ctx();
  const app = document.getElementById("app");
  app.setAttribute("aria-busy", "false");

  const top =
    kind === "profile"
      ? [buildHeader(vm, config, c), buildTabs(vm, config, c, active)]
      : [buildPageBar(vm, config, c, { backHref: `${state.base}#projects`, backLabel: "Projects" })];

  app.replaceChildren(
    ...[
      h("a.skip-link", { href: "#main" }, "Skip to content"),
      vm.source.type === "preview" && !EMBEDDED ? buildPreviewBar() : null,
      ...top,
      h("main.portfolio", { id: "main", tabindex: "-1", dataset: { shell: kind } }, h("div.view", { id: "view" })),
      buildFooter(vm, config, c),
    ].filter(Boolean),
  );
  state.shell = kind;
  state.page = null;
}

function buildPreviewBar() {
  return h("div.preview-bar", { role: "status" },
    h("span", svgIcon(ICONS.eye), "Preview — only you can see this"),
    h("a.btn.btn-ghost", { href: `${BASE_PATH}preview` }, "Edit JSON"),
  );
}

// ============================================================================
// SUB-PAGES: profile · resume · blog · post · project · tab
// ============================================================================

function renderSub(sub) {
  const { vm, config } = state;
  if (!vm) return;
  if (sub.name !== "resume") closeResume();
  if (state.page === "profile") state.profileScroll = scrollY;

  // Project pages get their own layout
  if (sub.name === "project") {
    const project = vm.projects.find((p) => p.slug === sub.param);
    ensureShell("page");
    teardownAnimations();
    showView(
      `project:${sub.param}`,
      project ? buildProjectPage(project, vm, config, ctx()) : notFoundInline("That project doesn't exist.", `${state.base}#projects`, "All projects"),
      project ? `${project.name} — ${vm.basics.name}` : null,
    );
    return;
  }

  const tabKey = sub.name === "tab" ? sub.param : sub.name === "blog" || sub.name === "post" ? "blog" : "profile";
  ensureShell("profile", tabKey);
  setActiveTab(tabKey);

  if (sub.name === "profile" || sub.name === "resume") {
    if (state.page !== "profile") {
      renderProfile(document.getElementById("view"));
      state.page = "profile";
      const target = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
      else scrollTo({ top: state.profileScroll });
    } else if (location.hash.length > 1) {
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (sub.name === "resume") openResume();
    return;
  }

  teardownAnimations();
  const blogOn = config.blog.enabled && vm.posts.length > 0;
  const back = (msg) => notFoundInline(msg, state.base, config.text.tabs.profile || "Profile");

  if (sub.name === "blog" && blogOn) {
    showView("blog", buildBlogList(vm, config, ctx(), state.blogState), `${config.text.tabs.blog || "Blog"} — ${vm.basics.name}`);
  } else if (sub.name === "post" && blogOn) {
    const post = vm.posts.find((p) => p.slug === sub.param);
    showView(`post:${sub.param}`, post ? buildBlogPost(post, vm, config, ctx()) : back("That post doesn't exist."), post ? `${post.title} — ${vm.basics.name}` : null);
  } else if (sub.name === "tab") {
    const tab = config.tabs.find((t) => t.slug === sub.param && t.type !== "link");
    showView(`tab:${sub.param}`, tab ? buildTabPage(tab, vm, config, ctx()) : back("That page doesn't exist."), tab ? `${tab.label} — ${vm.basics.name}` : null);
  } else {
    showView("missing", back("That page doesn't exist."), null);
  }
}

function showView(page, node, title) {
  if (state.page === page) return;
  document.getElementById("view").replaceChildren(node);
  state.page = page;
  if (title) document.title = title;
  scrollTo({ top: 0 });
  focusMain();
}

function renderProfile(view) {
  const { vm, config } = state;
  updateHead(vm, config);
  const c = ctx();
  const hidden = new Set(config.sections.hide);
  const sections = [];
  const builders = new Map();

  for (const key of config.sections.order) {
    if (hidden.has(key)) continue;
    const entry = SECTION_BUILDERS[key];
    const el = entry?.build(vm, config, c);
    if (!el) continue;
    builders.set(el, entry.build);
    sections.push({ key, label: config.text.sections[key] || entry.label, el });
  }

  const content = h("div.sections", sections.map((s) => s.el));
  if (!sections.length) content.appendChild(h("p.empty", "This portfolio has no sections to show yet."));
  const nav = config.navbar.enabled ? buildSectionNav(sections.map(({ key, label }) => ({ key, label }))) : null;
  view.replaceChildren(...[nav, content].filter(Boolean));

  if (!state.introPlayed) {
    state.introPlayed = true;
    const header = document.querySelector(".profile-header");
    const items = [header, ...sections.map((s) => s.el)].filter(Boolean);
    builders.set(header, buildHeader);
    setupAnimations(items, config.animation, (el) => builders.get(el) || null);
  }
}

function notFoundInline(message, href, label) {
  return h("div.status-card.inline", h("p", message), h("a.btn.btn-ghost", { href }, svgIcon(ICONS.arrowLeft), label));
}

function setActiveTab(name) {
  document.querySelectorAll(".tabs .tab").forEach((t) => {
    if (t.dataset.tab === name) t.setAttribute("aria-current", "page");
    else t.removeAttribute("aria-current");
  });
}

// ============================================================================
// RESUME OVERLAY (/<id>/resume)
// ============================================================================

function openResume() {
  if (state.resumeOverlay || !state.vm?.hasResume) return;
  const { config, vm } = state;
  state.resumeOverlay = openResumeOverlay(vm.resume, {
    theme: config.resume.theme,
    allowDownload: config.resume.download,
    allowPrint: config.resume.print,
    onClose: () => {
      state.resumeOverlay = null;
      if (parsePath().sub?.name === "resume") {
        history.replaceState(null, "", state.base + location.search);
        lastRoutedHref = location.href;
      }
    },
  });
}

function closeResume() {
  if (!state.resumeOverlay) return;
  const close = state.resumeOverlay;
  state.resumeOverlay = null;
  if (typeof close === "function") close();
  else close?.close?.();
}

// ============================================================================
// <head>: title, description, Open Graph, JSON-LD
// ============================================================================

function setMeta(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!value) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function updateHead(vm, config) {
  const b = vm.basics;
  const title = config.seo.title || (b.label ? `${b.name} — ${b.label}` : b.name);
  const description = (config.seo.description || b.summary || `${b.name}'s portfolio`).slice(0, 300);
  const image = safeUrl(config.seo.image || state.photo || "");
  document.title = title;
  setMeta("name", "description", description);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:type", "profile");
  setMeta("property", "og:url", location.href.split("#")[0]);
  setMeta("property", "og:image", image);
  setMeta("name", "twitter:card", image ? "summary" : "");

  let ld = document.getElementById("mz-jsonld");
  if (!ld) {
    ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = "mz-jsonld";
    document.head.appendChild(ld);
  }
  ld.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    name: b.name,
    jobTitle: b.label || undefined,
    description: b.summary || undefined,
    email: b.email ? `mailto:${b.email}` : undefined,
    url: b.url || location.href.split("#")[0],
    image: image || undefined,
    sameAs: b.profiles.map((p) => p.url),
  }).replace(/</g, "\\u003c");
}

// ============================================================================
// INIT
// ============================================================================

function focusMain() {
  requestAnimationFrame(() => document.getElementById("main")?.focus({ preventScroll: true }));
}

export function init() {
  rescueRedirect();
  initTheme();
  interceptLinks();
  history.scrollRestoration = "manual";

  // Fragment navigation fires both popstate and hashchange in most browsers;
  // route once per URL.
  const onNavigate = () => {
    if (location.href === lastRoutedHref) return;
    lastRoutedHref = location.href;
    const path = parsePath();
    if (path.view === "docs" && document.querySelector(".docs-main") && location.hash) return; // in-page anchors
    route();
  };
  addEventListener("popstate", onNavigate);
  addEventListener("hashchange", onNavigate);

  onNavigate();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register(new URL("../sw.js", import.meta.url), { scope: BASE_PATH }).catch(() => {});
  }
}
