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
    <div style="display:flex;justify-content:center;align-items:center;min-height:100vh;flex-direction:column;">
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
  <div class="home-theme-toggle" id="home-theme-switch"></div>
  <!-- Hero Section -->
  <header class="hero-section">
    <div class="brand-badge">mz-portfolio</div>
    <h1 class="hero-title">Turn Your Resume Into a<br>Live Portfolio.</h1>
    <p class="hero-subtitle">
      Point us at your <code>resume.json</code> — a GitHub Gist or a Google Drive file — and watch it become a fully themed, responsive portfolio in seconds. Theme-aware, dark mode ready, zero setup.
    </p>

    <!-- Interactive Form -->
    <form onsubmit="navigateToUser(event)" class="search-form">
      <div class="source-dropdown" id="source-dropdown">
        <button type="button" class="source-dropdown-btn" id="source-dropdown-btn">
          <svg class="source-icon source-icon-gh" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          <span>GitHub Gist</span>
        </button>
        <div class="source-dropdown-menu" id="source-dropdown-menu">
          <div class="source-dropdown-option active" data-value="gh">
            <svg class="source-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            <span>GitHub Gist</span>
          </div>
          <div class="source-dropdown-option" data-value="gd">
            <svg class="source-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span>Google Drive</span>
          </div>
        </div>
      </div>
      <input type="hidden" id="source-select" value="gh">
      <div class="input-wrapper">
        <input
          id="username-input"
          type="text"
          placeholder="username"
          autocomplete="off"
          spellcheck="false"
          required
        />
      </div>
      <button type="submit" class="cta-button">Generate Portfolio</button>
    </form>
  </header>

  <!-- Features Grid -->
  <section class="features-grid">
    <div class="feature-card">
      <div class="feature-icon">&#9889;</div>
      <h3>Instant & Live</h3>
      <p>Your portfolio pulls directly from your <code>resume.json</code>. Edit the gist, your site updates — no redeploy, no build step, no waiting.</p>
    </div>

    <div class="feature-card">
      <div class="feature-icon">&#9733;</div>
      <h3>Theme-Aware Rendering</h3>
      <p>Picks up your configured JSON Resume theme and renders it natively in the browser. Supports the full ecosystem of community themes.</p>
    </div>

    <div class="feature-card">
      <div class="feature-icon">&#9881;</div>
      <h3>Zero Bloat</h3>
      <p>Pure vanilla JS, CSS, and HTML. No frameworks, no bundler, no node_modules. Sub-second load times on any device.</p>
    </div>
  </section>

  <!-- Quick Setup Instructions Guide -->
  <section class="setup-section">
    <h2>Three Steps to Your Portfolio</h2>
    <div class="steps-container">
      <div class="step-item">
        <div class="step-number">1</div>
        <p>Create a <strong>public GitHub Gist</strong> or <strong>Google Drive file</strong> named <code>resume.json</code> following the <a href="https://jsonresume.org/schema/" target="_blank" rel="noopener">JSON Resume</a> schema.</p>
      </div>
      <div class="step-item">
        <div class="step-number">2</div>
        <p>Pick your data source above and enter your <strong>GitHub username</strong> or <strong>Drive file ID</strong>.</p>
      </div>
      <div class="step-item">
        <div class="step-number">3</div>
        <p>Hit <strong>Generate</strong>. Your portfolio is live — complete with projects, skills, and an interactive theme switcher.</p>
      </div>
    </div>
  </section>
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
  const dropdownBtn = app.querySelector("#source-dropdown-btn");
  const dropdownMenu = app.querySelector("#source-dropdown-menu");
  const sourceInput = app.querySelector("#source-select");
  const usernameInput = app.querySelector("#username-input");

  if (dropdownBtn && dropdownMenu && sourceInput) {
    dropdownBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle("open");
    });

    dropdownMenu.querySelectorAll(".source-dropdown-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        dropdownMenu.querySelectorAll(".source-dropdown-option").forEach((o) => o.classList.remove("active"));
        opt.classList.add("active");
        sourceInput.value = opt.dataset.value;
        dropdownBtn.querySelector("span").textContent = opt.querySelector("span").textContent;
        const ghIcon = dropdownBtn.querySelector(".source-icon-gh");
        const gdIcon = opt.querySelector(".source-icon");
        if (ghIcon && gdIcon) {
          ghIcon.outerHTML = gdIcon.outerHTML;
        }
        dropdownMenu.classList.remove("open");
        if (usernameInput) {
          usernameInput.placeholder = opt.dataset.value === "gd" ? "file id (e.g. 1abc2def3ghi)" : "username";
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

import { collectPortfolioData, fetchBlogPosts } from "./data.js";

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
          bannerHeight: bannerCfg.height || "200px",
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
