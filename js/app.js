// ============================================================================
// STATE MANAGEMENT
// ============================================================================

export let currentPage = "home";
export let allProjectsData = [];
export let blogPostsData = [];
let pendingTab = "profile";
let pendingBlogSlug = null;

export function setCurrentPage(page) {
  currentPage = page;
}

export function setAllProjectsData(data) {
  allProjectsData = data;
}

export function setBlogPostsData(data) {
  blogPostsData = data;
}

// ============================================================================
// UI STATE FUNCTIONS
// ============================================================================

export function showLoading() {
  document.getElementById("app").innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p class="loading-text">Loading portfolio...</p>
    </div>
  `;
}

export function showError(message) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <nav class="navbar">
      <div class="nav-container">
        <a href="#home" class="logo">MA</a>
      </div>
    </nav>
    <div class="error-state" style="margin-top:40px;">
      <div class="error-icon">!</div>
      <h2>Something went wrong</h2>
      <p id="error-message"></p>
      <button class="retry-btn" onclick="location.reload()">Try Again</button>
    </div>
  `;
  const p = app.querySelector("#error-message");
  if (p) p.textContent = message;
}

export function showLandingPage() {
  document.title = "GitHub Portfolio";
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="home-container">
  <div class="home-bg" aria-hidden="true">
    <div class="home-bg-orb home-bg-orb--1"></div>
    <div class="home-bg-orb home-bg-orb--2"></div>
    <div class="home-bg-orb home-bg-orb--3"></div>
  </div>
  <div class="home-theme-toggle" id="home-theme-switch"></div>
  <!-- Hero Section -->
  <header class="hero-section">
    <div class="brand-badge">mz-portfolio</div>
    <h1 class="hero-title">Turn Your Resume Into a<br>Live Portfolio.</h1>
    <p class="hero-subtitle">
      Point us at your <code>resume.json</code> — a GitHub Gist or a Google Drive file — and watch it become a fully themed, responsive portfolio in seconds. Theme-aware rendering, dark mode, project merging, and zero deploy steps.
    </p>

    <!-- Interactive Form -->
    <form onsubmit="navigateToUser(event)" class="search-form">
      <div class="source-prefix" id="source-prefix">
        <button type="button" class="source-prefix-btn" id="source-prefix-btn">https://www.github.com/</button>
        <div class="source-dropdown-menu" id="source-dropdown-menu">
          <div class="source-dropdown-option active" data-value="gh" data-prefix="https://www.github.com/">https://www.github.com/</div>
          <div class="source-dropdown-option" data-value="gd" data-prefix="https://drive.google.com/folder/d/">https://drive.google.com/folder/d/</div>
        </div>
      </div>
      <input type="hidden" id="source-select" value="gh">
      <div class="input-wrapper">
        <input id="username-input" type="text" placeholder="username" autocomplete="off" spellcheck="false" required="">
      </div>
      <button type="submit" class="cta-button">Generate Portfolio</button>
    </form>
  </header>

  <!-- Features Grid -->
  <section class="features-grid" id="features">
    <div class="feature-card">
      <div class="feature-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
      <h3>Instant &amp; Live</h3>
      <p>Your portfolio pulls directly from your <code>resume.json</code>. Edit the gist, your site updates — no redeploy, no build step, no waiting.</p>
    </div>

    <div class="feature-card">
      <div class="feature-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="13.5" r="2.5"/><circle cx="13.5" cy="20.5" r="2.5"/><circle cx="6" cy="13.5" r="2.5"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/></svg></div>
      <h3>Theme-Aware Rendering</h3>
      <p>Loads your configured JSON Resume theme from CDN and renders it natively in-browser. Supports the full ecosystem of community themes — not just a static template.</p>
    </div>

    <div class="feature-card">
      <div class="feature-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>
      <h3>Smart Project Merging</h3>
      <p>Projects from your resume and your GitHub repos are intelligently matched and merged — combining your curated descriptions with live stars, languages, and README data.</p>
    </div>

    <div class="feature-card">
      <div class="feature-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></div>
      <h3>Dark Mode &amp; Theming</h3>
      <p>Native light/dark/auto theme switching with a draggable toggle. Your accent color flows through every component — fully driven by your meta config.</p>
    </div>

    <div class="feature-card">
      <div class="feature-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></div>
      <h3>Fully Responsive</h3>
      <p>Adapts seamlessly from widescreen monitors to mobile phones. Orientation-aware breakpoints ensure the layout always looks intentional, never broken.</p>
    </div>

    <div class="feature-card">
      <div class="feature-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div>
      <h3>Zero Bloat</h3>
      <p>Pure vanilla JS, CSS, and HTML. No frameworks, no bundler, no node_modules. Sub-second load times on any device, any network.</p>
    </div>
  </section>

  <!-- How It Works -->
  <section class="setup-section" id="how-it-works">
    <h2>How It Works</h2>
    <div class="steps-container">
      <div class="step-item">
        <div class="step-number">1</div>
        <h4>Create Your Resume</h4>
        <p>Write a <code>resume.json</code> following the <a href="https://jsonresume.org/schema/" target="_blank" rel="noopener">JSON Resume</a> schema. Host it as a <strong>public GitHub Gist</strong> or upload it to a <strong>public Google Drive folder</strong>.</p>
      </div>
      <div class="step-item">
        <div class="step-number">2</div>
        <h4>Point &amp; Generate</h4>
        <p>Select your data source above and drop in your <strong>username</strong> or <strong>folder ID</strong>. The app fetches your resume, your GitHub profile, and all public repos in parallel.</p>
      </div>
      <div class="step-item">
        <div class="step-number">3</div>
        <h4>Your Portfolio Is Live</h4>
        <p>A fully styled, theme-aware portfolio — complete with projects, skills, education, and an interactive resume viewer. Share the link, it's done.</p>
      </div>
    </div>
  </section>

  <!-- Meta Config Teaser -->
  <section class="meta-section" id="config">
    <h2>Fully Configurable via JSON</h2>
    <p class="meta-subtitle">Your <code>resume.json</code> meta block controls everything — no code changes needed.</p>
    <div class="meta-grid">
      <div class="meta-item">
        <code>meta.theme</code>
        <span>Choose any JSON Resume theme from the ecosystem</span>
      </div>
      <div class="meta-item">
        <code>meta.accent</code>
        <span>Set your brand accent color across the entire site</span>
      </div>
      <div class="meta-item">
        <code>meta.banner</code>
        <span>Customize banner height, photo shape, and layout</span>
      </div>
      <div class="meta-item">
        <code>meta.sections.order</code>
        <span>Reorder or hide any section — projects, skills, contact</span>
      </div>
    </div>
  </section>

  <!-- Final Conversion Call to Action Banner -->
  <section class="landing-cta-banner">
    <div class="cta-banner-content">
      <h2>Ready to build your developer profile?</h2>
      <p>Takes under 2 minutes to hook up your first schema file. Free, open source, and fully customizable.</p>
      <a href="#username-input" class="cta-button-large" onclick="document.getElementById('username-input').focus();">Get Started Now</a>
    </div>
  </section>

  <!-- Landing Page Footer -->
  <footer class="landing-footer">
    <div class="footer-left">
      <span>mz-portfolio engine</span>
      <span class="footer-sep">•</span>
      <span>Open Source Architecture</span>
    </div>
    <div class="footer-right">
      <a href="https://github.com" target="_blank" rel="noopener">GitHub Source</a>
      <a href="https://jsonresume.org" target="_blank" rel="noopener">JSON Resume Spec</a>
    </div>
  </footer>

</div>
  `;
  // Build theme switch into the home container
  const homeThemeContainer = app.querySelector("#home-theme-switch");
  if (homeThemeContainer) {
    homeThemeContainer.innerHTML = `
      <div class="theme-switch">
        <div class="theme-switch-track" id="theme-track">
          <div class="theme-switch-knob" id="theme-knob">
            <div class="theme-icon theme-icon-moon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </div>
            <div class="theme-icon theme-icon-sun">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/><line x1="12" y1="1.5" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.5"/><line x1="1.5" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.5" y2="12"/><line x1="4.2" y1="4.2" x2="6" y2="6"/><line x1="18" y1="18" x2="19.8" y2="19.8"/><line x1="4.2" y1="19.8" x2="6" y2="18"/><line x1="18" y1="6" x2="19.8" y2="4.2"/></svg>
            </div>
          </div>
        </div>
      </div>`;
  }

  setupThemeToggle();

  // Attach drag handlers for homepage theme switch
  const homeTrack = app.querySelector(".theme-switch-track");
  const homeKnob = app.querySelector("#theme-knob");
  if (homeTrack && homeKnob) {
    attachThemeSwitchHandlers(homeTrack, homeKnob);
  }

  // Wire custom source dropdown
  const prefixBtn = app.querySelector("#source-prefix-btn");
  const dropdownMenu = app.querySelector("#source-dropdown-menu");
  const sourceInput = app.querySelector("#source-select");
  const usernameInput = app.querySelector("#username-input");

  if (prefixBtn && dropdownMenu && sourceInput) {
    prefixBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle("open");
    });

    dropdownMenu.querySelectorAll(".source-dropdown-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        dropdownMenu.querySelectorAll(".source-dropdown-option").forEach((o) => o.classList.remove("active"));
        opt.classList.add("active");
        sourceInput.value = opt.dataset.value;
        prefixBtn.textContent = opt.dataset.prefix;
        dropdownMenu.classList.remove("open");
        if (usernameInput) {
          usernameInput.placeholder = opt.dataset.value === "gd" ? "folder id" : "username";
          usernameInput.value = "";
          usernameInput.focus();
        }
      });
    });

    document.addEventListener("click", () => dropdownMenu.classList.remove("open"));
    if (usernameInput) usernameInput.focus();
  }
}

// Expose navigateToUser globally for the inline onsubmit handler
window.navigateToUser = function (event) {
  if (event) event.preventDefault();
  const source = document.getElementById("source-select")?.value || "gh";
  const input = document.getElementById("username-input");
  const value = input?.value.trim();
  if (!value) return;

  const base =
    window.location.origin +
    (window.location.pathname.endsWith("/")
      ? window.location.pathname
      : window.location.pathname + "/");
  const cleanBase = base.replace(/\/+$/, "/");

  if (source === "gd") {
    window.location.href = `${cleanBase}gd/${encodeURIComponent(value)}`;
  } else {
    window.location.href = `${cleanBase}gh/${encodeURIComponent(value)}`;
  }
};

// ============================================================================
// ROUTE INFO EXTRACTION
// ============================================================================

function getRouteInfo() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);

  if (pathParts.length >= 2) {
    const prefix = pathParts[0].toLowerCase();
    if (prefix === "gh") {
      return { type: "gh", identifier: pathParts.slice(1).join("/") };
    }
    if (prefix === "gd") {
      return { type: "gd", identifier: pathParts.slice(1).join("/") };
    }
  }

  if (pathParts.length >= 1) {
    return { type: "gh", identifier: pathParts[pathParts.length - 1] };
  }

  return { type: "", identifier: "" };
}

// Import component builders
import {
  buildHeader,
  buildTabSelector,
  buildAbout,
  buildEducation,
  buildProjects,
  buildSkills,
  buildContact,
  buildNavbar,
  buildFooter,
  setProjectsDataRef,
  renderProjectDetail,
  buildBlogPostList,
  renderBlogPostDetail,
} from "./components.js";

import {
  fetchGithubUserAvatar,
  fetchGithubUserProfile,
  initializeLanguageColors,
} from "./api.js";

import { collectPortfolioData, fetchBlogPosts, getCachedData } from "./data.js";

import { loadModel as preloadModel, buildChatBubble } from "./chat.js";

import { setupThemeToggle, attachThemeSwitchHandlers } from "./theme.js";

// ============================================================================
// INJECT CUSTOM ACCENT
// ============================================================================

function injectCustomAccent(accent) {
  function getContrast(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((x) => x + x)
        .join("");
    const r = parseInt(hex.substr(0, 2), 16),
      g = parseInt(hex.substr(2, 2), 16),
      b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#222" : "#fff";
  }

  function shade(hex, percent) {
    hex = hex.replace("#", "");
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((x) => x + x)
        .join("");
    let r = parseInt(hex.substr(0, 2), 16),
      g = parseInt(hex.substr(2, 2), 16),
      b = parseInt(hex.substr(4, 2), 16);
    r = Math.min(255, Math.max(0, Math.round(r + (percent / 100) * 255)));
    g = Math.min(255, Math.max(0, Math.round(g + (percent / 100) * 255)));
    b = Math.min(255, Math.max(0, Math.round(b + (percent / 100) * 255)));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  const accentColor = accent;
  const hoverColor = shade(accent, -15);
  const backgroundColor = shade(accent, 80);
  const primaryColor = getContrast(accent);
  const secondaryColor = shade(accent, 60);
  const surfaceColor = shade(accent, 95);
  const borderColor = shade(accent, 70);
  const codeColor = accent;
  const css = `:root {\n  --accent: ${accentColor};\n  --hover: ${hoverColor};\n  --background-color: ${backgroundColor};\n  --primary: ${primaryColor};\n  --secondary: ${secondaryColor};\n  --surface: ${surfaceColor};\n  --border: ${borderColor};\n  --code: ${codeColor};\n}`;
  let styleTag = document.getElementById("mz-custom-accent");
  if (styleTag) styleTag.remove();
  styleTag = document.createElement("style");
  styleTag.id = "mz-custom-accent";
  styleTag.innerText = css;
  document.head.appendChild(styleTag);
}

function setupMetaTags() {
  if (!document.querySelector("meta[charset]")) {
    const meta = document.createElement("meta");
    meta.charset = "UTF-8";
    document.head.appendChild(meta);
  }

  if (!document.querySelector('meta[name="viewport"]')) {
    const meta = document.createElement("meta");
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1.0";
    document.head.appendChild(meta);
  }
}

// ============================================================================
// ROUTING (inline to avoid circular dependency with router.js)
// ============================================================================

function handleRoute() {
  const hash = window.location.hash;

  if (hash === "#blog") {
    pendingTab = "blog";
    loadData();
    return;
  }

  if (hash.startsWith("#/blog/")) {
    const slug = decodeURIComponent(hash.slice(7));
    const post = blogPostsData.find((p) => p.slug === slug);
    if (post) {
      currentPage = "blog-post";
      renderBlogPostDetail(post);
    } else {
      pendingBlogSlug = slug;
      pendingTab = "blog";
      loadData();
    }
    return;
  }

  if (hash.startsWith("#/project/")) {
    const projectName = decodeURIComponent(hash.slice(10));
    const project = allProjectsData.find((p) => p.name === projectName);

    if (project) {
      currentPage = "project-detail";
      renderProjectDetail(project);
    } else {
      loadDataThenRoute(projectName);
    }
  } else {
    currentPage = "home";
    loadData();
  }
}

async function loadDataThenRoute(projectName) {
  try {
    // Try to load the full portfolio data (includes GitHub repos)
    await loadData(projectName);
  } catch (e) {
    console.error(e);
    showError(e.message || "Could not load portfolio data.");
  }
}

// ============================================================================
// MAIN LOAD DATA
// ============================================================================

export async function loadData(projectName) {
  console.log("[loadData] started, projectName:", projectName);
  showLoading();
  try {
    // 1. Determine source and identifier from URL
    const route = getRouteInfo();
    if (!route.identifier) {
      // If we have a project name from hash routing, try cached data
      if (projectName) {
        const cached = getCachedData();
        if (cached?.projects) {
          const project = cached.projects.find((p) => p.name === projectName);
          if (project) {
            allProjectsData = cached.projects;
            currentPage = "project-detail";
            renderProjectDetail(project);
            return;
          }
        }
      }
      showLandingPage();
      return;
    }

    // 2. Collect all data from resume.json + GitHub into a unified structure
    const d = await collectPortfolioData(route.identifier, route.type);
    console.log("[loadData] unified data:", {
      name: d.basics.name,
      hasEducation: !!d.education?.length,
      hasSkills: !!d.skills?.length,
      hasProjects: !!d.projects?.length,
      contactLinks: d.basics.profiles.length,
    });

    // 3. If navigating directly to a project, find and render it
    if (projectName && d.projects) {
      const project = d.projects.find((p) => p.name === projectName);
      if (project) {
        allProjectsData = d.projects;
        currentPage = "project-detail";
        renderProjectDetail(project);
        return;
      }
    }

    // 4. Customization config (from resume.json meta)
    const custom = d.meta?.["mz-portfolio-config"]
      ? Array.isArray(d.meta["mz-portfolio-config"])
        ? d.meta["mz-portfolio-config"][0] || {}
        : d.meta["mz-portfolio-config"]
      : {};
    const theme = custom.theme || {};
    const text = custom.text || {};
    const profileCfg = custom.profile || {};
    const bannerCfg = custom.banner || {};
    const themeToggleCfg = custom.themeToggle || {};
    const projectsCfg = custom.projects || {};
    const skillsCfg = custom.skills || {};
    const sectionsCfg = custom.sections || {};
    const animationCfg = custom.animation || {};
    const blogCfg = custom.blog === false ? { enabled: false } : (custom.blog || {});
    const blogEnabled = blogCfg.enabled !== false;

    let blogPosts = [];
    if (blogEnabled && route.type === "gh") {
      blogPosts = await fetchBlogPosts(route.identifier);
    }
    blogPostsData = blogPosts;

    // Animation/transition CSS vars
    if (
      animationCfg.transitionDuration ||
      animationCfg.type ||
      animationCfg.shadowOnHover !== undefined ||
      animationCfg.glowOnHover !== undefined
    ) {
      let css = ":root {";
      if (animationCfg.transitionDuration)
        css += `--mz-transition-duration: ${animationCfg.transitionDuration};`;
      if (animationCfg.type)
        css += `--mz-animation-type: ${animationCfg.type};`;
      if (animationCfg.shadowOnHover !== undefined)
        css += `--mz-shadow-hover: ${animationCfg.shadowOnHover ? "1" : "0"};`;
      if (animationCfg.glowOnHover !== undefined)
        css += `--mz-glow-hover: ${animationCfg.glowOnHover ? "1" : "0"};`;
      css += "}";
      let styleTag = document.getElementById("mz-custom-anim");
      if (styleTag) styleTag.remove();
      styleTag = document.createElement("style");
      styleTag.id = "mz-custom-anim";
      styleTag.innerText = css;
      document.head.appendChild(styleTag);
    }

    if (theme.accent) {
      injectCustomAccent(theme.accent);
    }

    document.title = `${d.basics.name} - ${d.basics.label || "Portfolio"}`;
    setupMetaTags();

    const app = document.getElementById("app");
    const frag = document.createDocumentFragment();
    const main = document.createElement("main");

    // Profile photo: custom config > resume.json image > GitHub avatar (GH only)
    let profilePhoto = "";
    if (profileCfg.photo) {
      if (profileCfg.photo === "gh" || profileCfg.photo === "github") {
        if (route.type === "gh") {
          profilePhoto = await fetchGithubUserAvatar(route.identifier);
        }
      } else {
        profilePhoto = profileCfg.photo;
      }
    }
    if (!profilePhoto && d.basics.image) {
      profilePhoto = d.basics.image;
    }
    if (!profilePhoto && route.type === "gh") {
      profilePhoto = await fetchGithubUserAvatar(route.identifier);
    }

    // Build header with all profiles
    const cvProfile = d.basics.profiles.find(
      (p) => p.network?.toLowerCase() === "cv",
    );
    const ghProfileEntry = d.basics.profiles.find(
      (p) => p.network?.toLowerCase() === "github",
    );
    const liProfileEntry = d.basics.profiles.find(
      (p) => p.network?.toLowerCase() === "linkedin",
    );

    frag.appendChild(
      buildHeader(
        {
          name: d.basics.name,
          title: d.basics.label || "",
          tagline: text.tagline || d.basics.summary || "",
          photo: profilePhoto,
          photoShape: profileCfg.photoShape || "circle",
          cv_link: cvProfile?.url || "",
          cta: text.cta ?? "",
        },
        {
          email: d.basics.email || "",
          github: ghProfileEntry?.url || "",
          linkedin: liProfileEntry?.url || "",
        },
        {
          bannerImage: bannerCfg.image || "",
          themeToggleStyle: themeToggleCfg.style || "icon",
        },
      ),
    );
    frag.appendChild(buildTabSelector(blogPosts.length > 0));

    // Section order and visibility
    const defaultOrder = [
      "about",
      "education",
      "projects",
      "skills",
      "contact",
    ];
    const order = Array.isArray(sectionsCfg.order)
      ? sectionsCfg.order
      : defaultOrder;
    const hide = Array.isArray(sectionsCfg.hide) ? sectionsCfg.hide : [];

    // Build section data from unified data
    const sectionData = {
      about:
        text.bio || text.philosophy || d.basics.summary
          ? {
              bio: text.bio || d.basics.summary || "",
              philosophy: text.philosophy ?? "",
              cv_link: cvProfile?.url || "",
              _rawResume: d._rawResume
                ? { ...d._rawResume, projects: d.projects || d._rawResume.projects }
                : null,
            }
          : null,
      education:
        d.education && d.education.length
          ? d.education.map((edu) => ({
              degree: edu.studyType + (edu.area ? " in " + edu.area : ""),
              institution: edu.institution,
              start_date: edu.startDate,
              end_date: edu.endDate,
              location: edu.location?.city || "",
              notes: edu.score ? `GPA: ${edu.score}` : "",
            }))
          : null,
      projects:
        d.projects && d.projects.length
          ? d.projects.map((proj) => ({
              name: proj.name,
              description: proj.readmeDescription || proj.description || "",
              technologies: proj.technologies || proj.keywords || [],
              github_link: proj.github_link || proj.url || "",
              live_link: proj.live_link || proj.demo || "",
              image: proj.image || "",
              allImages: proj.allImages || [],
              readmeDescription: proj.readmeDescription || "",
              fullReadme: proj.fullReadme || "",
              stars: proj.stars ?? null,
              isGitHubRepo: proj.isGitHubRepo || false,
            }))
          : null,
      skills: d.skills || null,
      contact: (() => {
        const email = d.basics.email || "";
        const github = ghProfileEntry?.url || `https://github.com/${route.identifier}`;
        const linkedin = liProfileEntry?.url || "";
        // Collect all unique profile URLs for the contact links
        const websiteProfiles = d.basics.profiles.filter(
          (p) =>
            !["github", "linkedin", "cv"].includes(p.network?.toLowerCase()) &&
            p.url,
        );
        const message = text.contact_message || d.basics.summary || "";
        if (email || github || linkedin || websiteProfiles.length || message) {
          return {
            message,
            email,
            github,
            linkedin,
            profiles: websiteProfiles,
          };
        }
        return null;
      })(),
    };

    // Store full project data for routing
    allProjectsData = d.projects || [];
    setProjectsDataRef(sectionData.projects || []);

    // Create sections container
    const sections = document.createElement("div");
    sections.className = "sections";
    let hasAnySection = false;
    for (const key of order) {
      if (hide.includes(key)) continue;
      if (!sectionData[key]) continue;
      hasAnySection = true;
      if (key === "about") sections.appendChild(buildAbout(sectionData.about));
      if (key === "education")
        sections.appendChild(buildEducation(sectionData.education));
      if (key === "projects")
        sections.appendChild(buildProjects(sectionData.projects, projectsCfg));
      if (key === "skills")
        sections.appendChild(buildSkills(sectionData.skills, skillsCfg));
      if (key === "contact")
        sections.appendChild(buildContact(sectionData.contact));
    }

    console.log(
      "[loadData] sections rendered:",
      Object.entries(sectionData)
        .filter(([, v]) => v)
        .map(([k]) => k),
    );

    // Show fallback when no data sections rendered
    if (!hasAnySection) {
      console.warn("[loadData] No sections rendered");
      const emptyMsg = document.createElement("div");
      emptyMsg.style.cssText =
        "text-align:center;padding:4rem 2rem;color:var(--secondary);";
      emptyMsg.innerHTML = `
        <p style="font-size:1.25rem;margin-bottom:0.5rem;">No portfolio data found</p>
        <p style="font-size:0.9rem;">Could not load resume.json${route.type === 'gh' ? ' or GitHub repositories' : ''} for <strong>${route.identifier}</strong>.</p>
        <p style="font-size:0.9rem;">Check the browser console for details, or try again later.</p>
      `;
      sections.appendChild(emptyMsg);
    }

    main.appendChild(buildNavbar());
    main.appendChild(sections);

    // Blog container (hidden by default)
    const blogContainer = document.createElement("div");
    blogContainer.id = "blog-container";
    blogContainer.className = "blog-container";
    blogContainer.style.display = "none";
    if (blogPosts.length > 0) {
      blogContainer.appendChild(buildBlogPostList(blogPosts));
    }
    main.appendChild(blogContainer);

    frag.appendChild(main);
    frag.appendChild(buildFooter(d.basics.name));
    console.log("[loadData] appending content to DOM");
    app.innerHTML = "";
    app.appendChild(frag);

    // Wire tab switching
    const tabSelector = document.querySelector(".tab-selector");
    if (tabSelector) {
      tabSelector.addEventListener("click", (e) => {
        const tab = e.target.closest(".tab-link");
        if (!tab) return;
        e.preventDefault();

        const tabName = tab.dataset.tab;
        tabSelector.querySelectorAll(".tab-link").forEach((t) =>
          t.classList.remove("active")
        );
        tab.classList.add("active");

        const sectionsEl = document.querySelector(".sections");
        const navbar = document.querySelector(".navbar");
        const blogCont = document.getElementById("blog-container");

        if (tabName === "profile") {
          sectionsEl.style.display = "";
          navbar.style.display = "";
          blogCont.style.display = "none";
        } else {
          sectionsEl.style.display = "none";
          navbar.style.display = "none";
          blogCont.style.display = "";
        }
      });
    }

    setupThemeToggle();

    // Activate pending tab (e.g. after back from blog detail)
    if (pendingTab === "blog" && blogPosts.length > 0) {
      const blogTab = tabSelector?.querySelector('[data-tab="blog"]');
      if (blogTab) blogTab.click();
      pendingTab = "profile";
    }

    // Navigate to a specific blog post if pending
    if (pendingBlogSlug && blogPosts.length > 0) {
      const post = blogPostsData.find((p) => p.slug === pendingBlogSlug);
      if (post) {
        renderBlogPostDetail(post);
      }
      pendingBlogSlug = null;
    }

    // Chat bubble
    document.querySelectorAll(".chat-bubble-wrapper").forEach((el) =>
      el.remove(),
    );
    document.body.appendChild(buildChatBubble(d.basics.name));
    setTimeout(() => preloadModel().catch(() => {}), 1000);

  } catch (e) {
    console.error(e);
    showError(e.message || "Could not load portfolio data.");
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

import { initDarkMode } from "./theme.js";

export function init() {
  // Route rescue and URL rewrite logic
  const attemptedUser = sessionStorage.getItem("attempted_user");
  const sourceType = sessionStorage.getItem("source_type") || "gh";
  if (attemptedUser) {
    sessionStorage.removeItem("attempted_user");
    sessionStorage.removeItem("source_type");
    if (sourceType === "gd") {
      window.history.replaceState(null, "", `/gd/${encodeURIComponent(attemptedUser)}`);
    } else {
      window.history.replaceState(null, "", `/gh/${encodeURIComponent(attemptedUser)}`);
    }
  }

  initDarkMode();
  initializeLanguageColors();

  // Check if there's a hash route on page load
  const hash = window.location.hash;
  if (hash.startsWith("#/project/")) {
    loadDataThenRoute();
  } else if (hash === "#blog" || hash.startsWith("#/blog/")) {
    if (hash.startsWith("#/blog/")) {
      pendingBlogSlug = decodeURIComponent(hash.slice(7));
    }
    pendingTab = "blog";
    loadData();
  } else {
    loadData();
  }

  window.addEventListener("hashchange", handleRoute);
}
