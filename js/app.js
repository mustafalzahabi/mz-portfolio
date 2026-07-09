// ============================================================================
// STATE MANAGEMENT
// ============================================================================

export let currentPage = "home";
export let allProjectsData = [];

export function setCurrentPage(page) {
  currentPage = page;
}

export function setAllProjectsData(data) {
  allProjectsData = data;
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
      <div class="error-icon">\u26A0\uFE0F</div>
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
  <!-- Hero Section -->
  <header class="hero-section">
    <div class="brand-badge">\u26A1 mz-portfolio</div>
    <h1 class="hero-title">Your GitHub Gist.<br>Your Instant Portfolio.</h1>
    <p class="hero-subtitle">
      Transform a simple <code>resume.json</code> public gist into a stunning, responsive, and highly customizable personal website. Zero dependencies, pure performance.
    </p>

    <!-- Interactive Form -->
    <form onsubmit="navigateToUser(event)" class="search-form">
      <div class="input-wrapper">
        <span class="input-prefix">github.com/</span>
        <input
          id="username-input"
          type="text"
          placeholder="username"
          autocomplete="username"
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
      <div class="feature-icon">\u2728</div>
      <h3>Dynamic Rendering</h3>
      <p>Fetches data directly from your public GitHub gists on the fly. Update your gist, your portfolio updates instantly.</p>
    </div>

    <div class="feature-card">
      <div class="feature-icon">\uD83C\uDFA8</div>
      <h3>Advanced Meta Config</h3>
      <p>Fine-tune accent colors, toggle themes, inject custom tags, or reorder/hide layout sections directly from your JSON.</p>
    </div>

    <div class="feature-card">
      <div class="feature-icon">\u26A1</div>
      <h3>Pure Vanilla Power</h3>
      <p>Built with raw HTML, CSS, and JS. No heavy frameworks, zero bloat, lightning-fast load times, and native light/dark mode.</p>
    </div>
  </section>

  <!-- Quick Setup Instructions Guide -->
  <section class="setup-section">
    <h2>Get Started in 60 Seconds</h2>
    <div class="steps-container">
      <div class="step-item">
        <div class="step-number">1</div>
        <p>Create a public GitHub gist named <strong><code>resume.json</code></strong>.</p>
      </div>
      <div class="step-item">
        <div class="step-number">2</div>
        <p>Structure your data using the standard <a href="https://jsonresume.org/schema/" target="_blank" rel="noopener">JSON Resume</a> specification.</p>
      </div>
      <div class="step-item">
        <div class="step-number">3</div>
        <p>Drop your username above or share your custom link with the world.</p>
      </div>
    </div>
  </section>
</div>
  `;
  const input = app.querySelector("#username-input");
  if (input) input.focus();
}

// Expose navigateToUser globally for the inline onsubmit handler
window.navigateToUser = function (event) {
  if (event) event.preventDefault();
  const input = document.getElementById("username-input");
  const username = input?.value.trim();
  if (username) {
    const base =
      window.location.origin +
      (window.location.pathname.endsWith("/")
        ? window.location.pathname
        : window.location.pathname + "/");
    const cleanBase = base.replace(/\/+$/, "/");
    window.location.href = cleanBase + encodeURIComponent(username);
  }
};

// ============================================================================
// MAIN PAGE LOADING
// ============================================================================

async function getDynamicResume() {
  // 1. Restore path if redirected from 404.html
  if (window.location.search[1] === "/") {
    const decoded = window.location.search
      .slice(1)
      .split("&")
      .map((s) => s.replace(/~and~/g, "&"))
      .join("?");
    window.history.replaceState(
      null,
      null,
      window.location.pathname.replace(/\/$/, "") +
        decoded +
        window.location.hash,
    );
  }

  // 2. Determine the GitHub username from the path
  let githubUsername = "";
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const isGitHubPages = window.location.hostname.endsWith(".github.io");
  if (isGitHubPages) {
    if (pathParts.length >= 2) {
      githubUsername = pathParts[pathParts.length - 1];
    }
  } else {
    if (pathParts.length >= 1) {
      githubUsername = pathParts[pathParts.length - 1];
    }
  }

  if (!githubUsername) {
    return null;
  }

  // 3. Fetch the user's gists list from the GitHub API
  const gistsResponse = await fetch(
    `https://api.github.com/users/${githubUsername}/gists`,
  );
  if (gistsResponse.status === 403) {
    throw new Error("GitHub API rate limit exceeded. Please try again later.");
  }
  if (!gistsResponse.ok) {
    throw new Error(`GitHub user "${githubUsername}" not found.`);
  }
  const gists = await gistsResponse.json();

  // 4. Scan the gists for a file called 'resume.json'
  const resumeGist = gists.find(
    (gist) => gist.files && gist.files["resume.json"],
  );
  if (!resumeGist) {
    throw new Error(
      `User "${githubUsername}" does not have a public gist named 'resume.json'.`,
    );
  }

  // 5. Fetch the raw JSON from that gist file
  const rawUrl = resumeGist.files["resume.json"].raw_url;
  const resumeResponse = await fetch(rawUrl);
  if (!resumeResponse.ok) {
    throw new Error("Could not fetch resume.json from gist.");
  }
  const resumeData = await resumeResponse.json();
  return { resumeData, githubUsername };
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
} from "./components.js";

import {
  fetchGithubUserAvatar,
  fetchAndMergeProjects,
  initializeLanguageColors,
} from "./api.js";

import { setupThemeToggle } from "./theme.js";

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
  const css = `:root {\n  --accent-color: ${accentColor};\n  --hover-color: ${hoverColor};\n  --background-color: ${backgroundColor};\n  --primary-color: ${primaryColor};\n  --secondary-color: ${secondaryColor};\n  --surface-color: ${surfaceColor};\n  --border-color: ${borderColor};\n  --code-color: ${codeColor};\n}`;
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

  if (hash.startsWith("#/project/")) {
    const projectName = decodeURIComponent(hash.slice(10));
    const project = allProjectsData.find((p) => p.name === projectName);

    if (project) {
      currentPage = "project-detail";
      renderProjectDetail(project, allProjectsData);
    } else {
      loadDataThenRoute();
    }
  } else {
    currentPage = "home";
    loadData();
  }
}

async function loadDataThenRoute() {
  showLoading();

  try {
    const result = await getDynamicResume();
    if (!result) {
      showLandingPage();
      return;
    }
    const { resumeData: data, githubUsername } = result;
    const resumeProjects = (data.projects || []).map((proj) => ({
      name: proj.name,
      description: proj.description,
      technologies: proj.keywords || [],
      github_link: proj.url || "",
      live_link: proj.demo || "",
      image: proj.image || "",
    }));

    allProjectsData = resumeProjects;
    handleRoute();
  } catch (e) {
    console.error(e);
    showError(e.message || "Could not load portfolio data.");
  }
}

// ============================================================================
// MAIN LOAD DATA
// ============================================================================

export async function loadData() {
  showLoading();
  try {
    const result = await getDynamicResume();

    // No username in URL -> show the landing page
    if (!result) {
      showLandingPage();
      return;
    }

    const { resumeData: data, githubUsername } = result;

    // --- Customization Section ---
    let custom = {};
    if (data.meta && data.meta["mz-portfolio-config"]) {
      if (Array.isArray(data.meta["mz-portfolio-config"])) {
        custom = data.meta["mz-portfolio-config"][0] || {};
      } else {
        custom = data.meta["mz-portfolio-config"];
      }
    }
    const theme = custom.theme || {};
    const text = custom.text || {};
    const profileCfg = custom.profile || {};
    const bannerCfg = custom.banner || {};
    const themeToggleCfg = custom.themeToggle || {};
    const projectsCfg = custom.projects || {};
    const skillsCfg = custom.skills || {};
    const sectionsCfg = custom.sections || {};
    const animationCfg = custom.animation || {};

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

    // 1. Apply custom accent color and derived palette if present
    if (theme.accent) {
      injectCustomAccent(theme.accent);
    }

    document.title = `${data.basics?.name || githubUsername} - ${data.basics?.label || ""}`;
    setupMetaTags();

    const app = document.getElementById("app");
    app.innerHTML = "";

    const frag = document.createDocumentFragment();
    const main = document.createElement("main");

    // Profile photo selection order
    let profilePhoto = "";
    let photoSource = "";
    if (profileCfg.photo) {
      if (profileCfg.photo === "gh" || profileCfg.photo === "github") {
        profilePhoto = await fetchGithubUserAvatar(githubUsername);
        photoSource = "github";
      } else {
        profilePhoto = profileCfg.photo;
        photoSource = "custom";
      }
    }
    if (!profilePhoto && data.basics?.image) {
      profilePhoto = data.basics.image;
      photoSource = "resume";
    }
    if (!profilePhoto && githubUsername) {
      profilePhoto = await fetchGithubUserAvatar(githubUsername);
      photoSource = "github";
    }
    if (!profilePhoto) photoSource = "none";

    // Build header
    frag.appendChild(
      buildHeader(
        {
          name: data.basics?.name || githubUsername,
          title: data.basics?.label || "",
          tagline: text.tagline ?? "",
          photo: profilePhoto,
          photoShape: profileCfg.photoShape || "circle",
          cv_link:
            (data.basics?.profiles || []).find(
              (p) => p.network?.toLowerCase() === "cv",
            )?.url || "",
          cta: text.cta ?? "",
        },
        {
          email: data.basics?.email || "",
          github:
            (data.basics?.profiles || []).find(
              (p) => p.network?.toLowerCase() === "github",
            )?.url || "",
          linkedin:
            (data.basics?.profiles || []).find(
              (p) => p.network?.toLowerCase() === "linkedin",
            )?.url || "",
        },
        {
          bannerHeight: bannerCfg.height || "200px",
          themeToggleStyle: themeToggleCfg.style || "icon",
        },
      ),
    );
    frag.appendChild(buildTabSelector());

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

    // Section data
    const mergedProjects = await fetchAndMergeProjects(
      data.projects,
      githubUsername,
    );
    const sectionData = {
      about:
        text.bio || text.philosophy
          ? {
              bio: text.bio ?? "",
              philosophy: text.philosophy ?? "",
              cv_link:
                (data.basics?.profiles || []).find(
                  (p) => p.network?.toLowerCase() === "cv",
                )?.url || "",
            }
          : null,
      education:
        data.education && data.education.length
          ? (data.education || []).map((edu) => ({
              degree: edu.studyType + (edu.area ? " in " + edu.area : ""),
              institution: edu.institution,
              start_date: edu.startDate,
              end_date: edu.endDate,
              location: edu.location?.city || "",
              notes: edu.score ? `GPA: ${edu.score}` : "",
            }))
          : null,
      projects:
        mergedProjects && mergedProjects.length
          ? mergedProjects.map((proj) => ({
              name: proj.name,
              description: proj.description,
              technologies: proj.technologies || proj.keywords || [],
              github_link: proj.github_link || proj.url || "",
              live_link: proj.live_link || proj.demo || "",
              image: proj.image || "",
            }))
          : null,
      skills:
        data.skills && data.skills.length
          ? (data.skills || []).map((skill) => ({
              category: skill.name,
              items: skill.keywords || [],
            }))
          : null,
      contact:
        text.contact_message ||
        data.basics?.email ||
        (data.basics?.profiles || []).find(
          (p) => p.network?.toLowerCase() === "github",
        )?.url ||
        (data.basics?.profiles || []).find(
          (p) => p.network?.toLowerCase() === "linkedin",
        )?.url
          ? {
              message: text.contact_message ?? "",
              email: data.basics?.email || "",
              github:
                (data.basics?.profiles || []).find(
                  (p) => p.network?.toLowerCase() === "github",
                )?.url || "",
              linkedin:
                (data.basics?.profiles || []).find(
                  (p) => p.network?.toLowerCase() === "linkedin",
                )?.url || "",
            }
          : null,
    };

    // Store projects for routing
    const projectsForRouting = sectionData.projects || [];
    allProjectsData = projectsForRouting;
    setProjectsDataRef(projectsForRouting);

    // Create sections container
    const sections = document.createElement("div");
    sections.className = "sections";
    for (const key of order) {
      if (hide.includes(key)) continue;
      if (!sectionData[key]) continue;
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

    main.appendChild(buildNavbar());
    main.appendChild(sections);
    frag.appendChild(main);
    frag.appendChild(buildFooter(data.basics?.name || githubUsername));
    app.appendChild(frag);
    setupThemeToggle();
  } catch (e) {
    console.error(e);
    showError(e.message || "Could not load JSON Resume.");
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

import { initDarkMode } from "./theme.js";

export function init() {
  // Username rescue and URL rewrite logic
  const attemptedUser = sessionStorage.getItem("attempted_user");
  if (attemptedUser) {
    sessionStorage.removeItem("attempted_user");
    window.history.replaceState(null, "", `/${attemptedUser}`);
  }

  initDarkMode();
  initializeLanguageColors();

  // Check if there's a hash route on page load
  const hash = window.location.hash;
  if (hash.startsWith("#/project/")) {
    loadDataThenRoute();
  } else {
    loadData();
  }

  window.addEventListener("hashchange", handleRoute);
}
