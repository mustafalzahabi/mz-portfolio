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
  <!-- Hero Section -->
  <header class="hero-section">
    <div class="brand-badge">mz-portfolio</div>
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
      <div class="feature-icon"></div>
      <h3>Dynamic Rendering</h3>
      <p>Fetches data directly from your public GitHub gists on the fly. Update your gist, your portfolio updates instantly.</p>
    </div>

    <div class="feature-card">
      <div class="feature-icon"></div>
      <h3>Advanced Meta Config</h3>
      <p>Fine-tune accent colors, toggle themes, inject custom tags, or reorder/hide layout sections directly from your JSON.</p>
    </div>

    <div class="feature-card">
      <div class="feature-icon"></div>
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
  const githubUsername = getGithubUsername();
  console.log("[getDynamicResume] extracted username:", githubUsername);
  if (!githubUsername) {
    return null;
  }

  // 3. Try to fetch resume.json from gists (optional)
  try {
    const gistUrl = `https://api.github.com/users/${githubUsername}/gists`;
    console.log("[getDynamicResume] fetching gists:", gistUrl);
    const gistsResponse = await fetch(gistUrl);
    console.log("[getDynamicResume] gist response status:", gistsResponse.status);
    if (gistsResponse.status === 403) {
      console.warn(
        "GitHub API rate limit exceeded. Resume data may not load.",
      );
    } else if (!gistsResponse.ok) {
      console.warn(
        `GitHub user "${githubUsername}" not found via gist API.`,
      );
    } else {
      const gists = await gistsResponse.json();
      const resumeGist = gists.find(
        (gist) =>
          gist.files &&
          Object.keys(gist.files).some(
            (name) => name.toLowerCase() === "resume.json",
          ),
      );
      if (resumeGist) {
        const gistId = resumeGist.id;
        const resumeFile = Object.keys(resumeGist.files).find(
          (name) => name.toLowerCase() === "resume.json",
        );

        // 1) Try inline content from list endpoint (usually absent, but check)
        if (resumeGist.files[resumeFile]?.content) {
          try {
            const resumeData = JSON.parse(resumeGist.files[resumeFile].content);
            console.log("[getDynamicResume] resume.json loaded from inline content. Sections:", {
              hasName: !!resumeData?.basics?.name,
              hasSummary: !!resumeData?.basics?.summary,
              hasEducation: !!(resumeData?.education?.length),
              hasSkills: !!(resumeData?.skills?.length),
              hasProjects: !!(resumeData?.projects?.length),
            });
            return { resumeData, githubUsername };
          } catch (e) {
            console.warn("[getDynamicResume] inline parse failed:", e.message);
          }
        }

        // 2) Fetch the single gist by ID — this endpoint includes the content field
        try {
          const singleUrl = `https://api.github.com/gists/${gistId}`;
          console.log("[getDynamicResume] fetching single gist:", singleUrl);
          const singleRes = await fetch(singleUrl);
          if (singleRes.ok) {
            const singleGist = await singleRes.json();
            const fileKey = Object.keys(singleGist.files).find(
              (name) => name.toLowerCase() === "resume.json",
            );
            if (fileKey && singleGist.files[fileKey]?.content) {
              const resumeData = JSON.parse(singleGist.files[fileKey].content);
              console.log("[getDynamicResume] resume.json loaded from single-gist endpoint. Sections:", {
                hasName: !!resumeData?.basics?.name,
                hasSummary: !!resumeData?.basics?.summary,
                hasEducation: !!(resumeData?.education?.length),
                hasSkills: !!(resumeData?.skills?.length),
                hasProjects: !!(resumeData?.projects?.length),
              });
              return { resumeData, githubUsername };
            }
          } else {
            console.warn("[getDynamicResume] single-gist fetch returned", singleRes.status);
          }
        } catch (e) {
          console.warn("[getDynamicResume] single-gist fetch error:", e.message);
        }

        // 3) Final fallback: raw_url (may be rate-limited)
        const rawUrl = resumeGist.files[resumeFile].raw_url;
        console.log("[getDynamicResume] fetching resume.json from raw_url:", rawUrl);
        const resumeResponse = await fetch(rawUrl);
        if (resumeResponse.ok) {
          const resumeData = await resumeResponse.json();
          console.log("[getDynamicResume] resume.json loaded from raw_url. Sections:", {
            hasName: !!resumeData?.basics?.name,
            hasSummary: !!resumeData?.basics?.summary,
            hasEducation: !!(resumeData?.education?.length),
            hasSkills: !!(resumeData?.skills?.length),
            hasProjects: !!(resumeData?.projects?.length),
          });
          return { resumeData, githubUsername };
        } else {
          console.warn("[getDynamicResume] raw_url fetch returned", resumeResponse.status);
        }
      } else {
        console.log("[getDynamicResume] no resume.json gist found");
      }
    }
  } catch (e) {
    console.warn("[getDynamicResume] Could not fetch resume.json:", e.message);
  }

  // 4. No resume.json found - return just the username so GitHub repos can be used
  console.log("[getDynamicResume] returning username only:", githubUsername);
  return { resumeData: null, githubUsername };
}

function getGithubUsername() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  if (pathParts.length >= 1) {
    return pathParts[pathParts.length - 1];
  }
  return "";
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
  fetchGithubUserProfile,
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
    const result = await getDynamicResume();
    console.log("[loadData] getDynamicResume result:", result);

    // No username in URL -> show the landing page
    if (!result) {
      showLandingPage();
      return;
    }

    const { resumeData: data, githubUsername } = result;

    // If navigating directly to a project, fetch full data and render
    if (projectName) {
      const mergedProjects = await fetchAndMergeProjects(
        data?.projects,
        githubUsername,
      );
      allProjectsData = mergedProjects;
      const project = mergedProjects.find((p) => p.name === projectName);
      if (project) {
        currentPage = "project-detail";
        renderProjectDetail(project);
        return;
      }
      // Project not found, fall through to normal load
    }

    // --- Customization Section (only if resume.json exists) ---
    const custom = data?.meta?.["mz-portfolio-config"]
      ? Array.isArray(data.meta["mz-portfolio-config"])
        ? data.meta["mz-portfolio-config"][0] || {}
        : data.meta["mz-portfolio-config"]
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

    document.title = data
      ? `${data.basics?.name || ghProfile?.name || githubUsername} - ${data.basics?.label || ""}`
      : `${ghProfile?.name || githubUsername} - Portfolio`;
    setupMetaTags();

    const app = document.getElementById("app");

    const frag = document.createDocumentFragment();
    const main = document.createElement("main");

    // Profile photo selection order
    let profilePhoto = "";
    if (profileCfg.photo) {
      if (profileCfg.photo === "gh" || profileCfg.photo === "github") {
        profilePhoto = await fetchGithubUserAvatar(githubUsername);
      } else {
        profilePhoto = profileCfg.photo;
      }
    }
    if (!profilePhoto && data?.basics?.image) {
      profilePhoto = data.basics.image;
    }
    if (!profilePhoto && githubUsername) {
      profilePhoto = await fetchGithubUserAvatar(githubUsername);
    }

    // Fetch GitHub profile for display name and bio fallback
    const ghProfile = await fetchGithubUserProfile(githubUsername);

    // Build header
    frag.appendChild(
      buildHeader(
        {
          name: data?.basics?.name || ghProfile?.name || githubUsername,
          title: data?.basics?.label || "",
          tagline: text.tagline || data?.basics?.summary || ghProfile?.bio || "",
          photo: profilePhoto,
          photoShape: profileCfg.photoShape || "circle",
          cv_link:
            (data?.basics?.profiles || []).find(
              (p) => p.network?.toLowerCase() === "cv",
            )?.url || "",
          cta: text.cta ?? "",
        },
        {
          email: data?.basics?.email || ghProfile?.email || "",
          github:
            (data?.basics?.profiles || []).find(
              (p) => p.network?.toLowerCase() === "github",
            )?.url || "",
          linkedin:
            (data?.basics?.profiles || []).find(
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
      data?.projects,
      githubUsername,
    );
    const sectionData = {
      about:
        text.bio || text.philosophy || data?.basics?.summary
          ? {
              bio: text.bio || data?.basics?.summary || "",
              philosophy: text.philosophy ?? "",
              cv_link:
                (data?.basics?.profiles || []).find(
                  (p) => p.network?.toLowerCase() === "cv",
                )?.url || "",
            }
          : null,
      education:
        data?.education && data.education.length
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
      skills:
        data?.skills && data.skills.length
          ? (data.skills || []).map((skill) => ({
              category: skill.name,
              items: skill.keywords || [],
            }))
          : null,
      contact: (() => {
        // Resume.json contact
        const rEmail = data?.basics?.email || "";
        const rGithub =
          (data?.basics?.profiles || []).find(
            (p) => p.network?.toLowerCase() === "github",
          )?.url || "";
        const rLinkedin =
          (data?.basics?.profiles || []).find(
            (p) => p.network?.toLowerCase() === "linkedin",
          )?.url || "";
        const rMessage = text.contact_message ?? "";

        // Fallback: GitHub profile data
        const ghEmail = ghProfile?.email || "";
        const ghBio = ghProfile?.bio || "";
        const ghUrl = `https://github.com/${githubUsername}`;

        const email = rEmail || ghEmail;
        const github = rGithub || ghUrl;
        const linkedin = rLinkedin || "";
        const message = rMessage || ghBio || "";

        if (email || github || linkedin || message) {
          return { message, email, github, linkedin };
        }
        return null;
      })(),
    };

    const displayName =
      data?.basics?.name || ghProfile?.name || githubUsername;

    // Store full project data for routing (with all fields)
    allProjectsData = mergedProjects || [];
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

    console.log("[loadData] sectionData keys present:", Object.entries(sectionData).filter(([,v]) => v).map(([k]) => k));

    // Show fallback when no data sections rendered
    if (!hasAnySection) {
      console.warn(
        "[loadData] No sections rendered — gist and/or repo data may be empty or rate-limited",
      );
      const emptyMsg = document.createElement("div");
      emptyMsg.style.cssText =
        "text-align:center;padding:4rem 2rem;color:var(--secondary-color);";
      emptyMsg.innerHTML = `
        <p style="font-size:1.25rem;margin-bottom:0.5rem;">No portfolio data found</p>
        <p style="font-size:0.9rem;">Could not load resume.json gist or GitHub repositories for <strong>${githubUsername}</strong>.</p>
        <p style="font-size:0.9rem;">Check the browser console for details, or try again later if rate-limited.</p>
      `;
      sections.appendChild(emptyMsg);
    }

    main.appendChild(buildNavbar());
    main.appendChild(sections);
    frag.appendChild(main);
    frag.appendChild(buildFooter(displayName));
    console.log("[loadData] appending content to DOM");
    app.innerHTML = "";
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
