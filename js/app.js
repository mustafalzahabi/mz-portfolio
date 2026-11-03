// ============================================================================
// APP — routing, loading, and assembling the portfolio
// ============================================================================

import { h, svgIcon, safeUrl } from "./utils.js";
import { ICONS } from "./icons.js";
import { debug } from "./log.js";
import { BASE_PATH, parsePath, parseHash, rescueRedirect, interceptLinks } from "./router.js";
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
  buildProjectDetail,
  enrichProjectCovers,
} from "./components.js";
import { setupAnimations, teardownAnimations } from "./animations/index.js";
import { openResumeOverlay } from "./resume/index.js";
import { renderLanding } from "./views/landing.js";
import { renderDocs } from "./views/docs.js";
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
  key: null, // "gh:user" | "gd:id" | "preview"
  vm: null,
  config: null,
  photo: "",
  introPlayed: false,
  profileScroll: 0,
  lastHashName: null,
  blogState: { query: "", tag: "", page: 1 },
  resumeOverlay: null,
};

// ============================================================================
// ROUTING
// ============================================================================

async function route() {
  const path = parsePath();
  debug("route", path, location.hash);

  if (path.view !== "portfolio" && path.view !== "preview") {
    closeResume();
    resetPortfolio();
    if (path.view === "docs") renderDocs();
    else renderLanding();
    focusMain();
    return;
  }

  if (path.view === "preview") {
    const json = getPreviewJson();
    if (!location.hash || location.hash === "#edit" || !json) {
      closeResume();
      resetPortfolio();
      renderPreviewEditor(() => {
        state.key = null;
        location.hash = "#/view";
      });
      return;
    }
    if (state.key !== "preview") {
      resetPortfolio();
      try {
        const { resume } = analyzeResume(json);
        await showPortfolio({ resume, github: null, repos: [], posts: [], source: { type: "preview", id: "preview", hasResume: true } }, "preview");
      } catch {
        location.hash = "#edit";
        return;
      }
    }
    renderSubRoute();
    return;
  }

  const key = `${path.source}:${path.id.toLowerCase()}`;
  if (state.key === key && state.vm) {
    renderSubRoute();
    return;
  }

  resetPortfolio();
  const loadId = state.loadId;
  showLoading();
  const result = await collectPortfolioData(path.source, path.id);
  if (loadId !== state.loadId) return; // navigated elsewhere while loading

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
  if (!(await showPortfolio(data, key, loadId))) return;
  if (result.offline) showOfflineBanner(result);
  renderSubRoute();
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
  state.introPlayed = false;
  state.lastHashName = null;
  state.blogState = { query: "", tag: "", page: 1 };
  setOwnerDefault("auto");
}

// ============================================================================
// PORTFOLIO SHELL
// ============================================================================

/** Renders a portfolio; returns false if the visitor navigated away meanwhile. */
async function showPortfolio(data, key, loadId = state.loadId) {
  const { config, warnings } = normalizeConfig(data.resume?.meta || {});
  if (warnings.length) debug("config warnings", warnings);

  const vm = buildViewModel(data, config);
  // README covers for GitHub-backed project cards (raw host, capped wait)
  await Promise.race([enrichProjectCovers(vm.projects), new Promise((r) => setTimeout(r, 2500))]);
  if (loadId !== state.loadId) return false;

  // This owner's look applies only now, while their portfolio is shown
  applyStyleConfig(config);
  setOwnerDefault(config.theme.mode);

  state.key = key;
  state.vm = vm;
  state.config = config;
  state.photo = pickPhoto(vm, config);
  state.introPlayed = false;
  state.lastHashName = null;

  updateHead(vm, config);
  renderShell();
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
    locale: config.text.locale,
    present: config.text.present,
    photo: state.photo,
    bannerImage: safeUrl(config.banner.image, { allowDataImage: true }),
    homeHref: BASE_PATH,
    openResume: () => {
      location.hash = "#/resume";
    },
  };
}

function renderShell() {
  const { vm, config } = state;
  const app = document.getElementById("app");
  app.setAttribute("aria-busy", "false");

  const view = h("div.view", { id: "view" });
  const main = h("main.portfolio", { id: "main", tabindex: "-1" }, view);

  app.replaceChildren(
    ...[
      h("a.skip-link", { href: "#main" }, "Skip to content"),
      vm.source.type === "preview" ? buildPreviewBar() : null,
      buildHeader(vm, config, ctx()),
      buildTabs(config, config.blog.enabled && vm.posts.length > 0, "profile"),
      main,
      buildFooter(vm, config, ctx()),
    ].filter(Boolean),
  );
}

function buildPreviewBar() {
  return h("div.preview-bar", { role: "status" },
    h("span", svgIcon(ICONS.eye), "Preview — only you can see this"),
    h("a.btn.btn-ghost", { href: `${BASE_PATH}preview#edit` }, "Edit JSON"),
  );
}

// ============================================================================
// SUB-ROUTES (hash): profile, blog, post, project, resume, section anchors
// ============================================================================

function renderSubRoute() {
  const { vm, config } = state;
  if (!vm) return;
  const hr = parseHash();
  const view = document.getElementById("view");
  const blogEnabled = config.blog.enabled && vm.posts.length > 0;

  if (hr.name !== "resume") closeResume();

  // Anchors inside the profile just scroll (rebuild the profile first if needed)
  if (hr.name === "section" || hr.name === "resume" || hr.name === "profile") {
    if (state.lastHashName !== "profile") {
      renderProfile(view);
      if (hr.name === "profile" && state.profileScroll) scrollTo({ top: state.profileScroll });
    }
    if (hr.name === "section") document.getElementById(hr.param)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (hr.name === "resume") openResume();
    setActiveTab("profile");
    state.lastHashName = "profile";
    return;
  }

  if (state.lastHashName === "profile") state.profileScroll = scrollY;
  teardownAnimations();

  if ((hr.name === "blog" || hr.name === "post") && blogEnabled) {
    if (hr.name === "post") {
      const post = vm.posts.find((p) => p.slug === hr.param);
      view.replaceChildren(post ? buildBlogPost(post, vm, config, ctx()) : notFoundInline("That post doesn't exist.", "#/blog", "All posts"));
      document.title = post ? `${post.title} — ${vm.basics.name}` : document.title;
    } else {
      view.replaceChildren(buildBlogList(vm, config, ctx(), state.blogState));
      document.title = `${config.text.tabs.blog || "Blog"} — ${vm.basics.name}`;
    }
    setActiveTab("blog");
    state.lastHashName = hr.name;
    scrollTo({ top: 0 });
    focusMain();
    return;
  }

  if (hr.name === "project") {
    const project = vm.projects.find((p) => p.slug === hr.param || p.name === hr.param);
    view.replaceChildren(project ? buildProjectDetail(project, vm, config, ctx()) : notFoundInline("That project doesn't exist.", "#projects", "All projects"));
    if (project) document.title = `${project.name} — ${vm.basics.name}`;
    setActiveTab("profile");
    state.lastHashName = "project";
    scrollTo({ top: 0 });
    focusMain();
    return;
  }

  // Blog hash while blog is disabled → profile
  location.replace("#");
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
// RESUME OVERLAY (#/resume)
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
      if (location.hash === "#/resume") history.replaceState(null, "", location.pathname + location.search);
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
  let lastHref = null;
  const onNavigate = () => {
    if (location.href === lastHref) return;
    lastHref = location.href;
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
