// ============================================================================
// DOM BUILDERS
// ============================================================================

import { getContrastTextColor, markdownToHtml, stripImagesFromMarkdown } from "./utils.js";
import { GITHUB_LANGUAGE_COLORS } from "./api.js";
import { attachThemeSwitchHandlers } from "./theme.js";
import { chat, isModelReady, switchMode, getMode, isModelLoading } from "./slm.js";

let allProjectsDataRef = null;

export function setProjectsDataRef(ref) {
  allProjectsDataRef = ref;
}

export function buildNavbar() {
  const nav = document.createElement("nav");
  nav.className = "navbar";

  const sections = [
    { id: "about", label: "About" },
    { id: "education", label: "Education" },
    { id: "projects", label: "Projects" },
    { id: "skills", label: "Skills" },
    { id: "contact", label: "Contact" },
  ];

  sections.forEach((section) => {
    const navItem = document.createElement("div");
    navItem.className = "nav-item";
    navItem.setAttribute("data-section", section.id);

    const dot = document.createElement("div");
    dot.className = "nav-dot";

    const label = document.createElement("span");
    label.className = "nav-label";
    label.textContent = section.label;

    const a = document.createElement("a");
    a.href = `#${section.id}`;
    a.appendChild(dot);

    navItem.appendChild(a);
    navItem.appendChild(label);
    nav.appendChild(navItem);
  });

  window.addEventListener("scroll", updateActiveNavItem);

  return nav;
}

function updateActiveNavItem() {
  const navItems = document.querySelectorAll(".nav-item");
  const scrollPos = window.scrollY + 200;

  navItems.forEach((item) => {
    const sectionId = item.getAttribute("data-section");
    const section = document.getElementById(sectionId);

    if (section) {
      const sectionTop = section.offsetTop;
      const sectionBottom = sectionTop + section.offsetHeight;

      if (scrollPos >= sectionTop && scrollPos < sectionBottom) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    }
  });
}

export function buildHeader(profile, contact, opts = {}) {
  const header = document.createElement("header");
  header.id = "header";

  // Background banner
  const banner = document.createElement("div");
  banner.className = "profile-banner";
  if (opts.bannerHeight) banner.style.height = opts.bannerHeight;

  // Theme toggle switch (top right) - draggable
  const themeSwitch = document.createElement("div");
  themeSwitch.id = "theme-switch";
  themeSwitch.className = "theme-switch";

  const track = document.createElement("div");
  track.id = "theme-track";
  track.className = "theme-switch-track";
  track.setAttribute("role", "switch");
  track.setAttribute("aria-label", "Toggle theme");
  track.setAttribute("tabindex", "0");

  const knob = document.createElement("div");
  knob.id = "theme-knob";
  knob.className = "theme-switch-knob";

  const moonIcon = document.createElement("img");
  moonIcon.className = "theme-icon theme-icon-moon";
  moonIcon.src = "dark-theme.svg";
  moonIcon.alt = "moon";
  moonIcon.width = 30;
  moonIcon.height = 30;

  const sunIcon = document.createElement("img");
  sunIcon.className = "theme-icon theme-icon-sun";
  sunIcon.src = "light-theme.svg";
  sunIcon.alt = "sun";
  sunIcon.width = 30;
  sunIcon.height = 30;

  knob.appendChild(moonIcon);
  knob.appendChild(sunIcon);
  track.appendChild(knob);
  themeSwitch.appendChild(track);
  banner.appendChild(themeSwitch);

  // Attach drag handlers
  attachThemeSwitchHandlers(track, knob);

  // Banner links (bottom right)
  const bannerLinks = document.createElement("div");
  bannerLinks.className = "banner-links";

  if (contact) {
    if (contact.email) {
      const emailLink = document.createElement("a");
      emailLink.href = `mailto:${contact.email}`;
      emailLink.className = "banner-link-item";
      emailLink.textContent = "Email";
      bannerLinks.appendChild(emailLink);
    }

    if (contact.github) {
      const ghLink = document.createElement("a");
      ghLink.href = contact.github;
      ghLink.target = "_blank";
      ghLink.className = "banner-link-item";
      ghLink.textContent = "GitHub";
      bannerLinks.appendChild(ghLink);
    }

    if (contact.linkedin) {
      const liLink = document.createElement("a");
      liLink.href = contact.linkedin;
      liLink.target = "_blank";
      liLink.className = "banner-link-item";
      liLink.textContent = "LinkedIn";
      bannerLinks.appendChild(liLink);
    }
  }

  banner.appendChild(bannerLinks);
  header.appendChild(banner);

  // Profile info container
  const profileInfo = document.createElement("div");
  profileInfo.className = "profile-info";

  // Profile photo
  if (profile.photo && profile.photo !== "" && profile.photo !== "none") {
    const img = document.createElement("img");
    img.src = profile.photo;
    img.alt = profile.name;
    img.className = "profile-photo";
    if (profile.photoShape === "rounded") img.style.borderRadius = "1.5rem";
    else if (profile.photoShape === "square") img.style.borderRadius = "0";
    profileInfo.appendChild(img);
  }

  // Profile details
  const details = document.createElement("div");
  details.className = "profile-details";

  const h1 = document.createElement("h1");
  h1.className = "profile-name";
  h1.textContent = profile.name;

  const title = document.createElement("div");
  title.className = "profile-title";
  title.textContent = profile.title;

  const tagline = document.createElement("p");
  tagline.className = "profile-tagline";
  tagline.textContent = profile.tagline;

  details.append(h1, title, tagline);
  profileInfo.appendChild(details);
  header.appendChild(profileInfo);

  return header;
}

export function buildTabSelector() {
  const tabSelector = document.createElement("nav");
  tabSelector.className = "tab-selector";

  const tabLink = document.createElement("a");
  tabLink.href = "#";
  tabLink.className = "tab-link active";
  tabLink.textContent = "My Profile";

  tabSelector.appendChild(tabLink);

  return tabSelector;
}

export function buildAbout(about) {
  const section = createSection("About Me", "about");
  const container = document.createElement("div");
  container.className = "about-container";

  const bioDiv = createTextBlock("Biography", about.bio);
  const philDiv = createTextBlock("Philosophy", about.philosophy);

  container.append(bioDiv, philDiv);

  if (about._rawResume) {
    const previewCard = buildResumePreview(about._rawResume);
    container.appendChild(previewCard);
  }

  section.appendChild(container);
  return section;
}

export function buildEducation(education) {
  const section = createSection("Education", "education");
  const list = document.createElement("div");
  list.className = "education-list";

  education.forEach((edu) => {
    const card = document.createElement("div");
    card.className = "education-card";

    const h3 = document.createElement("h3");
    h3.textContent = edu.degree;

    const inst = document.createElement("div");
    inst.className = "institution";
    inst.textContent = edu.institution;

    const dates = document.createElement("div");
    dates.className = "dates";
    dates.textContent = `${edu.start_date} \u2013 ${edu.end_date}`;

    const location = document.createElement("div");
    location.textContent = edu.location;

    card.append(h3, inst, dates, location);

    if (edu.notes) {
      const notes = document.createElement("div");
      notes.className = "notes";
      notes.textContent = edu.notes;
      card.appendChild(notes);
    }

    list.appendChild(card);
  });

  section.appendChild(list);
  return section;
}

export function buildProjects(projects, projectsCfg = {}) {
  const section = createSection("Projects", "projects");
  const grid = document.createElement("div");
  grid.className = "projects-grid";
  if (projectsCfg.layout === "horizontal") grid.style.display = "flex";
  projects.forEach((proj) => {
    const card = document.createElement("div");
    card.className = "project-card";
    card.style.cursor = "pointer";
    card.onclick = () => {
      allProjectsDataRef = projects;
      window.location.hash = `#/project/${encodeURIComponent(proj.name)}`;
    };
    // Image position
    let imgDiv = null;
    if (proj.image) {
      imgDiv = document.createElement("div");
      imgDiv.className = "project-image";
      const img = document.createElement("img");
      img.src = proj.image;
      img.alt = proj.name;
      img.onerror = () => (imgDiv.style.display = "none");
      imgDiv.appendChild(img);
    }
    const content = document.createElement("div");
    content.className = "project-content";
    const h3 = document.createElement("h3");
    h3.textContent = proj.name;
    let desc = null;
    if (proj.description && proj.description.trim()) {
      desc = document.createElement("p");
      desc.textContent = proj.description;
    }
    const techDiv = document.createElement("div");
    techDiv.className = "project-tech";
    proj.technologies.forEach((tech) => {
      const tag = document.createElement("span");
      tag.className = "tech-tag";
      tag.textContent = tech;
      const color = GITHUB_LANGUAGE_COLORS[tech];
      if (color) {
        tag.style.backgroundColor = color;
        tag.style.color = getContrastTextColor(color);
      }
      techDiv.appendChild(tag);
    });
    const links = document.createElement("div");
    links.className = "project-links";
    links.style.pointerEvents = "auto";
    if (proj.live_link) {
      const liveLink = document.createElement("a");
      liveLink.href = proj.live_link;
      liveLink.target = "_blank";
      liveLink.textContent = "Live Demo";
      liveLink.onclick = (e) => e.stopPropagation();
      links.appendChild(liveLink);
    }
    const ghLink = document.createElement("a");
    ghLink.href = proj.github_link;
    ghLink.target = "_blank";
    ghLink.textContent = "GitHub";
    ghLink.onclick = (e) => e.stopPropagation();
    links.appendChild(ghLink);
    // Layout/image position
    if (projectsCfg.layout === "horizontal") {
      card.style.display = "flex";
      if (projectsCfg.imagePosition === "left" && imgDiv)
        card.appendChild(imgDiv);
      card.appendChild(content);
      if (projectsCfg.imagePosition === "right" && imgDiv)
        card.appendChild(imgDiv);
      if (!projectsCfg.imagePosition && imgDiv) card.appendChild(imgDiv);
    } else {
      if (projectsCfg.imagePosition === "bottom" && imgDiv) {
        content.append(h3, desc, techDiv, links);
        card.appendChild(content);
        card.appendChild(imgDiv);
      } else {
        if (imgDiv) card.appendChild(imgDiv);
        content.append(h3, desc, techDiv, links);
        card.appendChild(content);
      }
    }
    grid.appendChild(card);
  });
  section.appendChild(grid);
  return section;
}

export function buildSkills(skills, skillsCfg = {}) {
  const section = createSection("Skills", "skills");
  const grid = document.createElement("div");
  grid.className = "skills-grid";
  skills.forEach((group) => {
    const category = document.createElement("div");
    category.className = "skill-category";
    const h3 = document.createElement("h3");
    h3.textContent = group.category;
    if (skillsCfg.display === "tags") {
      const tagWrap = document.createElement("div");
      tagWrap.style.display = "flex";
      tagWrap.style.flexWrap = "wrap";
      group.items.forEach((item) => {
        const tag = document.createElement("span");
        tag.className = "tech-tag";
        tag.textContent = item;
        tagWrap.appendChild(tag);
      });
      category.append(h3, tagWrap);
    } else if (skillsCfg.display === "progress") {
      group.items.forEach((item) => {
        const wrap = document.createElement("div");
        wrap.style.display = "flex";
        wrap.style.alignItems = "center";
        const label = document.createElement("span");
        label.textContent = item;
        label.style.flex = "1";
        const bar = document.createElement("div");
        bar.style.flex = "2";
        bar.style.height = "0.5rem";
        bar.style.background = "var(--border-color)";
        bar.style.marginLeft = "0.5rem";
        const fill = document.createElement("div");
        fill.style.height = "100%";
        fill.style.width = Math.floor(40 + Math.random() * 60) + "%";
        fill.style.background = "var(--accent-color)";
        bar.appendChild(fill);
        wrap.appendChild(label);
        wrap.appendChild(bar);
        category.appendChild(wrap);
      });
      category.prepend(h3);
    } else {
      const ul = document.createElement("ul");
      group.items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        ul.appendChild(li);
      });
      category.append(h3, ul);
    }
    grid.appendChild(category);
  });
  section.appendChild(grid);
  return section;
}

export function buildContact(contact) {
  const section = createSection("Get In Touch", "contact");
  const container = document.createElement("div");
  container.className = "contact-container";

  if (contact.message) {
    const msg = document.createElement("p");
    msg.textContent = contact.message;
    container.appendChild(msg);
  }

  const links = document.createElement("div");
  links.className = "contact-links";

  if (contact.email) {
    const emailLink = document.createElement("a");
    emailLink.href = `mailto:${contact.email}`;
    emailLink.textContent = "Email";
    links.appendChild(emailLink);
  }

  if (contact.github) {
    const ghLink = document.createElement("a");
    ghLink.href = contact.github;
    ghLink.target = "_blank";
    ghLink.textContent = "GitHub";
    links.appendChild(ghLink);
  }

  if (contact.linkedin) {
    const liLink = document.createElement("a");
    liLink.href = contact.linkedin;
    liLink.target = "_blank";
    liLink.textContent = "LinkedIn";
    links.appendChild(liLink);
  }

  // Additional profile links (website, blog, etc.)
  if (Array.isArray(contact.profiles)) {
    for (const profile of contact.profiles) {
      const a = document.createElement("a");
      a.href = profile.url;
      a.target = "_blank";
      a.textContent =
        profile.network?.charAt(0).toUpperCase() +
          profile.network?.slice(1) ||
        profile.url;
      links.appendChild(a);
    }
  }

  if (links.children.length > 0) {
    container.appendChild(links);
  }
  section.appendChild(container);
  return section;
}

export function buildFooter(name) {
  const footer = document.createElement("footer");
  footer.className = "footer";
  const p = document.createElement("p");
  p.innerHTML = `\u00A9 ${new Date().getFullYear()} ${name || "Portfolio"}. All rights reserved.${name === "Mustafa Alzahabi" ? "" : '<br>Built using <strong>mz-portfolio</strong> by Mustafa Alzahabi. <a href="/">Make yours today.</a>'}`;
  footer.appendChild(p);
  return footer;
}

// ============================================================================
// CHAT BUBBLE
// ============================================================================

export function buildChatBubble(displayName) {
  const wrapper = document.createElement("div");
  wrapper.className = "chat-bubble-wrapper";

  const chatHistory = [];
  let isGenerating = false;

  // --- Floating trigger button ---
  const trigger = document.createElement("button");
  trigger.className = "chat-bubble-trigger";
  trigger.setAttribute("aria-label", "Open chat");
  trigger.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

  // --- Chat window ---
  const chatWindow = document.createElement("div");
  chatWindow.className = "chat-window";

  // Header
  const header = document.createElement("div");
  header.className = "chat-header";

  const headerInfo = document.createElement("div");
  headerInfo.className = "chat-header-info";

  const avatar = document.createElement("div");
  avatar.className = "chat-avatar";
  avatar.textContent = (displayName || "AI").charAt(0).toUpperCase();

  const headerText = document.createElement("div");

  const nameEl = document.createElement("div");
  nameEl.className = "chat-header-name";
  nameEl.textContent = displayName || "Portfolio Owner";

  const statusEl = document.createElement("div");
  statusEl.className = "chat-header-status";
  statusEl.textContent = getMode() === "cloud" ? "Cloud AI" : "Offline";

  headerText.append(nameEl, statusEl);
  headerInfo.append(avatar, headerText);

  const closeBtn = document.createElement("button");
  closeBtn.className = "chat-close";
  closeBtn.setAttribute("aria-label", "Close chat");
  closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  // Mode toggle button
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "chat-mode-toggle";
  toggleBtn.textContent = getMode() === "cloud" ? "Cloud" : "Local";
  toggleBtn.title = "Switch between cloud AI and local model";
  toggleBtn.addEventListener("click", () => {
    const newMode = getMode() === "cloud" ? "local" : "cloud";
    switchMode(newMode);
    toggleBtn.textContent = newMode === "cloud" ? "Cloud" : "Local";
    statusEl.textContent =
      newMode === "cloud" ? "Online" : "Offline-ready";
  });

  header.append(headerInfo, toggleBtn, closeBtn);

  // Messages area
  const messages = document.createElement("div");
  messages.className = "chat-messages";

  // Welcome message
  const welcome = document.createElement("div");
  welcome.className = "chat-msg bot";
  welcome.textContent = "Hi! Ask me anything about this portfolio.";
  messages.appendChild(welcome);

  // Typing indicator
  const typing = document.createElement("div");
  typing.className = "chat-typing";
  typing.style.display = "none";
  typing.innerHTML = "<span></span><span></span><span></span>";
  messages.appendChild(typing);

  // Input area
  const inputArea = document.createElement("div");
  inputArea.className = "chat-input-area";

  const input = document.createElement("input");
  input.className = "chat-input";
  input.type = "text";
  input.placeholder = "Type a message...";

  const sendBtn = document.createElement("button");
  sendBtn.className = "chat-send";
  sendBtn.setAttribute("aria-label", "Send message");
  sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

  inputArea.append(input, sendBtn);
  chatWindow.append(header, messages, inputArea);

  // --- Helpers ---
  function addMessage(role, text) {
    const msg = document.createElement("div");
    msg.className = `chat-msg ${role}`;
    msg.textContent = text;
    messages.insertBefore(msg, typing);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  function setGenerating(gen) {
    isGenerating = gen;
    input.disabled = gen;
    sendBtn.disabled = gen;
    input.placeholder = gen ? "Thinking..." : "Type a message...";
    typing.style.display = gen ? "flex" : "none";
    if (gen) messages.scrollTop = messages.scrollHeight;
  }

  async function handleSend() {
    const text = input.value.trim();
    if (!text || isGenerating || !isModelReady()) return;

    input.value = "";
    addMessage("user", text);
    chatHistory.push({ role: "user", content: text });

    setGenerating(true);

    // Create bot message element for streaming
    const botMsg = document.createElement("div");
    botMsg.className = "chat-msg bot";
    botMsg.textContent = "";
    messages.insertBefore(botMsg, typing);
    messages.scrollTop = messages.scrollHeight;

    let fullReply = "";

    try {
      await chat(text, (token) => {
        fullReply = token;
        botMsg.textContent = fullReply;
        messages.scrollTop = messages.scrollHeight;
      });

      if (fullReply) {
        chatHistory.push({ role: "assistant", content: fullReply });
      } else {
        botMsg.textContent = "No response generated.";
      }
    } catch (e) {
      console.warn("[chat] inference error:", e);
      botMsg.textContent = "Sorry, something went wrong. Please try again.";
    } finally {
      setGenerating(false);
    }
  }

  // --- Events ---
  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  trigger.addEventListener("click", () => {
    chatWindow.classList.toggle("open");
    trigger.setAttribute(
      "aria-label",
      chatWindow.classList.contains("open") ? "Close chat" : "Open chat",
    );
  });

  closeBtn.addEventListener("click", () => {
    chatWindow.classList.remove("open");
    trigger.setAttribute("aria-label", "Open chat");
  });

  wrapper.append(trigger, chatWindow);
  return wrapper;
}

// ============================================================================
// RESUME PREVIEW & OVERLAY
// ============================================================================

function buildResumePreview(resume) {
  const card = document.createElement("div");
  card.className = "resume-preview";

  const header = document.createElement("div");
  header.className = "resume-preview-header";

  const icon = document.createElement("div");
  icon.className = "resume-preview-icon";
  icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;

  const titleGroup = document.createElement("div");
  titleGroup.className = "resume-preview-title-group";

  const title = document.createElement("div");
  title.className = "resume-preview-title";
  title.textContent = "Resume";

  const subtitle = document.createElement("div");
  subtitle.className = "resume-preview-subtitle";
  const name = resume.basics?.name || "";
  const label = resume.basics?.label || "";
  subtitle.textContent = [name, label].filter(Boolean).join(" — ") || "JSON Resume";

  titleGroup.append(title, subtitle);
  header.append(icon, titleGroup);

  const stats = document.createElement("div");
  stats.className = "resume-preview-stats";

  const sections = [
    resume.work?.length && `${resume.work.length} role${resume.work.length > 1 ? "s" : ""}`,
    resume.education?.length && `${resume.education.length} degree${resume.education.length > 1 ? "s" : ""}`,
    resume.skills?.length && `${resume.skills.length} skill group${resume.skills.length > 1 ? "s" : ""}`,
  ].filter(Boolean);

  if (sections.length > 0) {
    const statText = document.createElement("span");
    statText.className = "resume-preview-stat-text";
    statText.textContent = sections.join(" · ");
    stats.appendChild(statText);
  }

  const viewBtn = document.createElement("button");
  viewBtn.className = "resume-preview-btn";
  viewBtn.textContent = "View Resume";
  viewBtn.addEventListener("click", async () => {
    const overlay = await buildResumeOverlay(resume);
    document.body.appendChild(overlay);
  });

  card.append(header, stats, viewBtn);
  return card;
}

async function buildResumeOverlay(resume) {
  const overlay = document.createElement("div");
  overlay.className = "resume-overlay";

  const backdrop = document.createElement("div");
  backdrop.className = "resume-overlay-backdrop";

  const container = document.createElement("div");
  container.className = "resume-overlay-container";

  const toolbar = document.createElement("div");
  toolbar.className = "resume-overlay-toolbar";

  const toolbarTitle = document.createElement("div");
  toolbarTitle.className = "resume-overlay-toolbar-title";
  toolbarTitle.textContent = "Resume";

  const toolbarActions = document.createElement("div");
  toolbarActions.className = "resume-overlay-toolbar-actions";

  const printBtn = document.createElement("button");
  printBtn.className = "resume-overlay-print";
  printBtn.textContent = "Print";
  printBtn.addEventListener("click", () => {
    const content = container.querySelector(".resume-document");
    if (!content) return;
    const w = window.open("", "_blank", "width=800,height=600");
    w.document.write(`<!DOCTYPE html><html><head><title>Resume</title><style>${getResumePrintStyles()}</style></head><body>${content.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  });

  const closeBtn = document.createElement("button");
  closeBtn.className = "resume-overlay-close";
  closeBtn.setAttribute("aria-label", "Close resume");
  closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  toolbarActions.append(printBtn, closeBtn);
  toolbar.append(toolbarTitle, toolbarActions);

  const doc = document.createElement("div");
  doc.className = "resume-document";

  // Try to load the user's chosen JSON Resume theme from CDN
  const themeName = resume.meta?.theme;
  let themed = false;
  if (themeName) {
    themed = await loadThemeIntoDoc(doc, themeName, resume);
  }

  // Fall back to custom renderer if theme didn't load
  if (!themed) {
    renderResumeBasics(doc, resume.basics);
    renderResumeWork(doc, resume.work);
    renderResumeEducation(doc, resume.education);
    renderResumeSkills(doc, resume.skills);
    renderResumeProjects(doc, resume.projects);
    renderResumeAwards(doc, resume.awards);
    renderResumePublications(doc, resume.publications);
    renderResumeVolunteer(doc, resume.volunteer);
    renderResumeLanguages(doc, resume.languages);
    renderResumeInterests(doc, resume.interests);
    renderResumeReferences(doc, resume.references);
  }

  container.append(toolbar, doc);
  overlay.append(backdrop, container);

  function close() {
    overlay.classList.add("closing");
    setTimeout(() => overlay.remove(), 250);
  }

  backdrop.addEventListener("click", close);
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", onEsc);
    }
  });

  requestAnimationFrame(() => overlay.classList.add("open"));

  return overlay;
}

async function loadThemeIntoDoc(doc, themeName, resume) {
  try {
    const mod = await import(`https://unpkg.com/${themeName}`);
    const renderFn = mod.render || mod.default?.render;
    if (!renderFn) return false;

    const html = renderFn(resume);
    if (!html || typeof html !== "string") return false;

    // Inject the theme's rendered HTML
    doc.innerHTML = html;

    // Load any <link rel="stylesheet"> tags the theme references
    const linkTags = doc.querySelectorAll('link[rel="stylesheet"]');
    linkTags.forEach((link) => {
      const href = link.getAttribute("href");
      if (!href) return;
      // Resolve relative URLs against the theme's package
      const resolved = href.startsWith("http")
        ? href
        : `https://unpkg.com/${themeName}/${href.replace(/^\.\//, "")}`;
      const existing = document.querySelector(`link[href="${resolved}"]`);
      if (!existing) {
        const newLink = document.createElement("link");
        newLink.rel = "stylesheet";
        newLink.href = resolved;
        document.head.appendChild(newLink);
      }
    });

    // Load any <style> tags (already in the DOM via innerHTML, no extra work needed)
    return true;
  } catch (e) {
    console.warn(`[resume] Could not load theme "${themeName}":`, e.message);
    return false;
  }
}

function renderResumeBasics(doc, basics) {
  if (!basics) return;
  const section = document.createElement("div");
  section.className = "resume-section resume-basics";

  if (basics.name || basics.label) {
    const h1 = document.createElement("h1");
    h1.className = "resume-name";
    h1.textContent = basics.name || "";
    section.appendChild(h1);
  }

  if (basics.label) {
    const label = document.createElement("div");
    label.className = "resume-label";
    label.textContent = basics.label;
    section.appendChild(label);
  }

  const contactItems = [];
  if (basics.email) contactItems.push({ label: "Email", value: basics.email, href: `mailto:${basics.email}` });
  if (basics.phone) contactItems.push({ label: "Phone", value: basics.phone, href: `tel:${basics.phone}` });
  if (basics.url) contactItems.push({ label: "Website", value: basics.url, href: basics.url });
  if (basics.location) {
    const loc = [basics.location.city, basics.location.region, basics.location.countryCode].filter(Boolean).join(", ");
    if (loc) contactItems.push({ label: "Location", value: loc });
  }

  if (basics.summary) {
    const summary = document.createElement("p");
    summary.className = "resume-summary";
    summary.textContent = basics.summary;
    section.appendChild(summary);
  }

  if (contactItems.length > 0) {
    const contactRow = document.createElement("div");
    contactRow.className = "resume-contact-row";
    contactItems.forEach((item) => {
      const span = document.createElement("span");
      span.className = "resume-contact-item";
      if (item.href) {
        const a = document.createElement("a");
        a.href = item.href;
        a.textContent = item.value;
        if (item.href.startsWith("http")) a.target = "_blank";
        span.appendChild(a);
      } else {
        span.textContent = item.value;
      }
      contactRow.appendChild(span);
    });
    section.appendChild(contactRow);
  }

  if (basics.profiles?.length > 0) {
    const profiles = document.createElement("div");
    profiles.className = "resume-contact-row";
    basics.profiles.forEach((p) => {
      if (!p.url) return;
      const span = document.createElement("span");
      span.className = "resume-contact-item";
      const a = document.createElement("a");
      a.href = p.url;
      a.target = "_blank";
      a.textContent = p.network || p.url;
      span.appendChild(a);
      profiles.appendChild(span);
    });
    if (profiles.children.length > 0) section.appendChild(profiles);
  }

  doc.appendChild(section);
}

function renderResumeSection(doc, title, items, renderer) {
  if (!items || items.length === 0) return;
  const section = document.createElement("div");
  section.className = "resume-section";

  const h2 = document.createElement("h2");
  h2.className = "resume-section-title";
  h2.textContent = title;
  section.appendChild(h2);

  items.forEach((item) => section.appendChild(renderer(item)));

  doc.appendChild(section);
}

function renderResumeWork(doc, work) {
  renderResumeSection(doc, "Work Experience", work, (w) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    const header = document.createElement("div");
    header.className = "resume-entry-header";

    const left = document.createElement("div");
    const position = document.createElement("div");
    position.className = "resume-entry-title";
    position.textContent = w.position || "";
    const company = document.createElement("div");
    company.className = "resume-entry-subtitle";
    company.textContent = w.company || "";
    left.append(position, company);

    const right = document.createElement("div");
    right.className = "resume-entry-dates";
    const start = w.startDate || "";
    const end = w.endDate || "Present";
    if (start) right.textContent = `${start} – ${end}`;

    header.append(left, right);

    if (w.summary) {
      const summary = document.createElement("p");
      summary.className = "resume-entry-text";
      summary.textContent = w.summary;
      entry.append(header, summary);
    } else {
      entry.appendChild(header);
    }

    if (w.highlights?.length > 0) {
      const ul = document.createElement("ul");
      ul.className = "resume-entry-list";
      w.highlights.forEach((h) => {
        const li = document.createElement("li");
        li.textContent = h;
        ul.appendChild(li);
      });
      entry.appendChild(ul);
    }

    return entry;
  });
}

function renderResumeEducation(doc, education) {
  renderResumeSection(doc, "Education", education, (e) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    const header = document.createElement("div");
    header.className = "resume-entry-header";

    const left = document.createElement("div");
    const degree = document.createElement("div");
    degree.className = "resume-entry-title";
    degree.textContent = [e.studyType, e.area].filter(Boolean).join(" in ") || "";
    const institution = document.createElement("div");
    institution.className = "resume-entry-subtitle";
    institution.textContent = e.institution || "";
    left.append(degree, institution);

    const right = document.createElement("div");
    right.className = "resume-entry-dates";
    const start = e.startDate || "";
    const end = e.endDate || "";
    if (start) right.textContent = end ? `${start} – ${end}` : start;

    header.append(left, right);
    entry.appendChild(header);

    if (e.score) {
      const score = document.createElement("div");
      score.className = "resume-entry-text";
      score.textContent = `GPA: ${e.score}`;
      entry.appendChild(score);
    }

    if (e.courses?.length > 0) {
      const courses = document.createElement("div");
      courses.className = "resume-entry-text";
      courses.textContent = `Courses: ${e.courses.join(", ")}`;
      entry.appendChild(courses);
    }

    return entry;
  });
}

function renderResumeSkills(doc, skills) {
  renderResumeSection(doc, "Skills", skills, (s) => {
    const entry = document.createElement("div");
    entry.className = "resume-skill-group";

    const name = document.createElement("span");
    name.className = "resume-skill-name";
    name.textContent = s.name || "";

    if (s.level) {
      const level = document.createElement("span");
      level.className = "resume-skill-level";
      level.textContent = s.level;
      name.appendChild(level);
    }

    entry.appendChild(name);

    if (s.keywords?.length > 0) {
      const keywords = document.createElement("div");
      keywords.className = "resume-skill-keywords";
      s.keywords.forEach((k) => {
        const tag = document.createElement("span");
        tag.className = "resume-skill-tag";
        tag.textContent = k;
        keywords.appendChild(tag);
      });
      entry.appendChild(keywords);
    }

    return entry;
  });
}

function renderResumeProjects(doc, projects) {
  renderResumeSection(doc, "Projects", projects, (p) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    const header = document.createElement("div");
    header.className = "resume-entry-header";

    const left = document.createElement("div");
    const name = document.createElement("div");
    name.className = "resume-entry-title";
    name.textContent = p.name || "";
    left.appendChild(name);

    const right = document.createElement("div");
    right.className = "resume-entry-dates";
    const start = p.startDate || "";
    const end = p.endDate || "";
    if (start) right.textContent = end ? `${start} – ${end}` : start;

    header.append(left, right);
    entry.appendChild(header);

    if (p.description) {
      const desc = document.createElement("p");
      desc.className = "resume-entry-text";
      desc.textContent = p.description;
      entry.appendChild(desc);
    }

    if (p.highlights?.length > 0) {
      const ul = document.createElement("ul");
      ul.className = "resume-entry-list";
      p.highlights.forEach((h) => {
        const li = document.createElement("li");
        li.textContent = h;
        ul.appendChild(li);
      });
      entry.appendChild(ul);
    }

    if (p.keywords?.length > 0) {
      const tags = document.createElement("div");
      tags.className = "resume-skill-keywords";
      p.keywords.forEach((k) => {
        const tag = document.createElement("span");
        tag.className = "resume-skill-tag";
        tag.textContent = k;
        tags.appendChild(tag);
      });
      entry.appendChild(tags);
    }

    return entry;
  });
}

function renderResumeAwards(doc, awards) {
  renderResumeSection(doc, "Awards", awards, (a) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    const title = document.createElement("div");
    title.className = "resume-entry-title";
    title.textContent = a.title || "";
    entry.appendChild(title);

    const details = [];
    if (a.date) details.push(a.date);
    if (a.awarder) details.push(a.awarder);
    if (details.length > 0) {
      const sub = document.createElement("div");
      sub.className = "resume-entry-subtitle";
      sub.textContent = details.join(" · ");
      entry.appendChild(sub);
    }

    if (a.summary) {
      const p = document.createElement("p");
      p.className = "resume-entry-text";
      p.textContent = a.summary;
      entry.appendChild(p);
    }

    return entry;
  });
}

function renderResumePublications(doc, publications) {
  renderResumeSection(doc, "Publications", publications, (p) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    const title = document.createElement("div");
    title.className = "resume-entry-title";
    title.textContent = p.name || "";
    entry.appendChild(title);

    const details = [];
    if (p.publisher) details.push(p.publisher);
    if (p.releaseDate) details.push(p.releaseDate);
    if (details.length > 0) {
      const sub = document.createElement("div");
      sub.className = "resume-entry-subtitle";
      sub.textContent = details.join(" · ");
      entry.appendChild(sub);
    }

    if (p.summary) {
      const pEl = document.createElement("p");
      pEl.className = "resume-entry-text";
      pEl.textContent = p.summary;
      entry.appendChild(pEl);
    }

    if (p.url) {
      const a = document.createElement("a");
      a.className = "resume-entry-link";
      a.href = p.url;
      a.target = "_blank";
      a.textContent = p.url;
      entry.appendChild(a);
    }

    return entry;
  });
}

function renderResumeVolunteer(doc, volunteer) {
  renderResumeSection(doc, "Volunteer", volunteer, (v) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    const header = document.createElement("div");
    header.className = "resume-entry-header";

    const left = document.createElement("div");
    const position = document.createElement("div");
    position.className = "resume-entry-title";
    position.textContent = v.position || "";
    const org = document.createElement("div");
    org.className = "resume-entry-subtitle";
    org.textContent = v.organization || "";
    left.append(position, org);

    const right = document.createElement("div");
    right.className = "resume-entry-dates";
    const start = v.startDate || "";
    const end = v.endDate || "";
    if (start) right.textContent = end ? `${start} – ${end}` : start;

    header.append(left, right);
    entry.appendChild(header);

    if (v.summary) {
      const p = document.createElement("p");
      p.className = "resume-entry-text";
      p.textContent = v.summary;
      entry.appendChild(p);
    }

    if (v.highlights?.length > 0) {
      const ul = document.createElement("ul");
      ul.className = "resume-entry-list";
      v.highlights.forEach((h) => {
        const li = document.createElement("li");
        li.textContent = h;
        ul.appendChild(li);
      });
      entry.appendChild(ul);
    }

    return entry;
  });
}

function renderResumeLanguages(doc, languages) {
  renderResumeSection(doc, "Languages", languages, (l) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry resume-entry-inline";

    const name = document.createElement("span");
    name.className = "resume-entry-title";
    name.textContent = l.language || "";
    entry.appendChild(name);

    if (l.fluency) {
      const fluency = document.createElement("span");
      fluency.className = "resume-entry-subtitle";
      fluency.textContent = l.fluency;
      entry.appendChild(fluency);
    }

    return entry;
  });
}

function renderResumeInterests(doc, interests) {
  renderResumeSection(doc, "Interests", interests, (i) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    const name = document.createElement("div");
    name.className = "resume-entry-title";
    name.textContent = i.name || "";
    entry.appendChild(name);

    if (i.keywords?.length > 0) {
      const keywords = document.createElement("div");
      keywords.className = "resume-skill-keywords";
      i.keywords.forEach((k) => {
        const tag = document.createElement("span");
        tag.className = "resume-skill-tag";
        tag.textContent = k;
        keywords.appendChild(tag);
      });
      entry.appendChild(keywords);
    }

    return entry;
  });
}

function renderResumeReferences(doc, references) {
  renderResumeSection(doc, "References", references, (r) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    if (r.name) {
      const name = document.createElement("div");
      name.className = "resume-entry-title";
      name.textContent = r.name;
      entry.appendChild(name);
    }

    if (r.reference) {
      const ref = document.createElement("blockquote");
      ref.className = "resume-entry-text";
      ref.textContent = r.reference;
      entry.appendChild(ref);
    }

    return entry;
  });
}

function getResumePrintStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; padding: 2rem; line-height: 1.5; }
    .resume-name { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; }
    .resume-label { font-size: 1.1rem; color: #666; margin-bottom: 0.75rem; }
    .resume-summary { margin-bottom: 1rem; }
    .resume-contact-row { display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.875rem; margin-bottom: 0.5rem; }
    .resume-contact-item a { color: #1a1a1a; text-decoration: underline; }
    .resume-section { margin-bottom: 1.5rem; }
    .resume-section-title { font-size: 1.1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #1a1a1a; padding-bottom: 0.25rem; margin-bottom: 0.75rem; }
    .resume-entry { margin-bottom: 1rem; }
    .resume-entry-header { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
    .resume-entry-title { font-weight: 600; }
    .resume-entry-subtitle { color: #666; font-size: 0.9rem; }
    .resume-entry-dates { font-size: 0.875rem; color: #666; white-space: nowrap; flex-shrink: 0; }
    .resume-entry-text { font-size: 0.9rem; margin-top: 0.25rem; }
    .resume-entry-list { font-size: 0.9rem; margin: 0.25rem 0 0 1.25rem; }
    .resume-entry-list li { margin-bottom: 0.15rem; }
    .resume-entry-link { font-size: 0.85rem; color: #666; }
    .resume-skill-group { margin-bottom: 0.5rem; }
    .resume-skill-name { font-weight: 600; }
    .resume-skill-level { font-weight: 400; color: #666; margin-left: 0.5rem; font-size: 0.9rem; }
    .resume-skill-keywords { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.25rem; }
    .resume-skill-tag { font-size: 0.8rem; padding: 0.125rem 0.5rem; background: #f0f0f0; border-radius: 0.25rem; }
    .resume-entry-inline { display: flex; align-items: baseline; gap: 0.5rem; }
  `;
}

// ============================================================================
// HELPER DOM FUNCTIONS
// ============================================================================

function createSection(title, id) {
  const section = document.createElement("section");
  section.className = "section";
  section.id = id;

  const h2 = document.createElement("h2");
  h2.className = "section-title";
  h2.textContent = title;

  section.appendChild(h2);
  return section;
}

function createTextBlock(title, text) {
  const div = document.createElement("div");
  div.className = "about-text";

  const h3 = document.createElement("h3");
  h3.textContent = title;

  const p = document.createElement("p");
  p.textContent = text;

  div.append(h3, p);
  return div;
}

// ============================================================================
// SLIDESHOW (with thumbnails)
// ============================================================================

export function buildSlideshow(images) {
  const container = document.createElement("div");
  container.className = "slideshow";

  // Main image area
  const mainArea = document.createElement("div");
  mainArea.className = "slideshow-main";

  const img = document.createElement("img");
  img.className = "slideshow-img";

  const counter = document.createElement("div");
  counter.className = "slideshow-counter";

  const placeholder = document.createElement("div");
  placeholder.className = "slideshow-placeholder";
  placeholder.textContent = "No images available";

  mainArea.append(img, counter, placeholder);

  const prevBtn = document.createElement("button");
  prevBtn.className = "slideshow-nav-btn slideshow-prev";
  prevBtn.innerHTML = "&#10094;";
  prevBtn.setAttribute("aria-label", "Previous image");

  const nextBtn = document.createElement("button");
  nextBtn.className = "slideshow-nav-btn slideshow-next";
  nextBtn.innerHTML = "&#10095;";
  nextBtn.setAttribute("aria-label", "Next image");

  const thumbs = document.createElement("div");
  thumbs.className = "slideshow-thumbs";

  let validImages = [];
  let currentIndex = 0;
  let thumbEls = [];

  function updateView() {
    if (validImages.length === 0) {
      img.style.display = "none";
      counter.style.display = "none";
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
      thumbs.style.display = "none";
      placeholder.style.display = "";
      return;
    }

    placeholder.style.display = "none";
    img.style.display = "";
    counter.style.display = validImages.length > 1 ? "" : "none";
    prevBtn.style.display = validImages.length > 1 ? "" : "none";
    nextBtn.style.display = validImages.length > 1 ? "" : "none";
    thumbs.style.display = validImages.length > 1 ? "" : "none";

    img.src = validImages[currentIndex];
    img.alt = `Project screenshot ${currentIndex + 1}`;
    counter.textContent = `${currentIndex + 1} / ${validImages.length}`;
    thumbEls.forEach((t, i) => t.classList.toggle("active", i === currentIndex));
  }

  function goTo(newIndex) {
    if (newIndex === currentIndex || validImages.length === 0) return;
    img.classList.add("slideshow-fade-out");
    setTimeout(() => {
      currentIndex = newIndex;
      updateView();
      img.classList.remove("slideshow-fade-out");
      img.classList.add("slideshow-fade-in");
      setTimeout(() => img.classList.remove("slideshow-fade-in"), 300);
    }, 200);
  }

  prevBtn.onclick = () =>
    goTo((currentIndex - 1 + validImages.length) % validImages.length);
  nextBtn.onclick = () =>
    goTo((currentIndex + 1) % validImages.length);

  container.tabIndex = 0;
  container.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft")
      goTo((currentIndex - 1 + validImages.length) % validImages.length);
    if (e.key === "ArrowRight")
      goTo((currentIndex + 1) % validImages.length);
  });

  mainArea.append(prevBtn, nextBtn);
  container.append(mainArea, thumbs);

  // Preload images and filter out broken ones
  Promise.all(
    images.map(
      (url) =>
        new Promise((resolve) => {
          const testImg = new Image();
          testImg.onload = () => resolve({ url, ok: true });
          testImg.onerror = () => {
            console.warn("[slideshow] Broken image:", url);
            resolve({ url, ok: false });
          };
          testImg.src = url;
        }),
    ),
  ).then((results) => {
    validImages = results.filter((r) => r.ok).map((r) => r.url);

    // Build thumbnails
    thumbEls = validImages.map((src, i) => {
      const thumb = document.createElement("button");
      thumb.className = "slideshow-thumb" + (i === 0 ? " active" : "");
      const thumbImg = document.createElement("img");
      thumbImg.src = src;
      thumbImg.alt = `Thumbnail ${i + 1}`;
      thumb.appendChild(thumbImg);
      thumb.onclick = () => goTo(i);
      return thumb;
    });

    thumbs.append(...thumbEls);
    updateView();
  });

  return container;
}

// ============================================================================
// PROJECT DETAIL PAGE
// ============================================================================

export function renderProjectDetail(project) {
  const app = document.getElementById("app");
  const frag = document.createDocumentFragment();
  const main = document.createElement("main");
  main.appendChild(buildNavbar());

  const page = document.createElement("div");
  page.className = "project-detail";

  // -- Back button --
  const backBtn = document.createElement("a");
  backBtn.href = "#";
  backBtn.className = "project-detail-back";
  backBtn.textContent = "\u2190 Back to Projects";
  page.appendChild(backBtn);

  // -- Project header --
  const header = document.createElement("div");
  header.className = "project-detail-header";

  const title = document.createElement("h1");
  title.className = "project-detail-title";
  title.textContent = project.name;
  header.appendChild(title);

  const desc =
    project.readmeDescription || project.description || "";
  if (desc) {
    const subtitle = document.createElement("p");
    subtitle.className = "project-detail-subtitle";
    subtitle.textContent = desc;
    header.appendChild(subtitle);
  }

  // Badges row
  const badges = document.createElement("div");
  badges.className = "project-detail-badges";
  if (project.stars != null && project.stars > 0) {
    const starBadge = document.createElement("span");
    starBadge.className = "project-detail-badge";
      starBadge.textContent = `${project.stars}`;
    badges.appendChild(starBadge);
  }
  if (project.isGitHubRepo) {
    const repoBadge = document.createElement("span");
    repoBadge.className = "project-detail-badge";
    repoBadge.textContent = "Public Repo";
    badges.appendChild(repoBadge);
  }
  if (badges.children.length > 0) header.appendChild(badges);

  // Action buttons
  const actions = document.createElement("div");
  actions.className = "project-detail-actions";
  if (project.live_link) {
    const liveBtn = document.createElement("a");
    liveBtn.href = project.live_link;
    liveBtn.target = "_blank";
    liveBtn.className = "project-detail-btn primary";
    liveBtn.innerHTML = "Live Demo";
    actions.appendChild(liveBtn);
  }
  const ghBtn = document.createElement("a");
  ghBtn.href = project.github_link;
  ghBtn.target = "_blank";
  ghBtn.className = "project-detail-btn secondary";
  ghBtn.innerHTML = "View on GitHub";
  actions.appendChild(ghBtn);
  if (actions.children.length > 0) header.appendChild(actions);

  page.appendChild(header);

  // -- Image gallery --
  const allImages = project.allImages || [];
  if (allImages.length > 0) {
    page.appendChild(buildSlideshow(allImages));
  } else if (project.image) {
    const singleImg = document.createElement("div");
    singleImg.className = "project-detail-single-image";
    const img = document.createElement("img");
    img.src = project.image;
    img.alt = project.name;
    singleImg.appendChild(img);
    page.appendChild(singleImg);
  }

  // -- Content grid --
  const contentGrid = document.createElement("div");
  contentGrid.className = "project-detail-content";

  // Left: About + README
  const leftCol = document.createElement("div");
  leftCol.className = "project-detail-content-left";

  if (project.fullReadme) {
    const readmeSection = document.createElement("div");
    readmeSection.className = "project-detail-readme";
    const readmeTitle = document.createElement("h2");
    readmeTitle.textContent = "About This Project";
    const readmeContent = document.createElement("div");
    readmeContent.className = "project-detail-readme-content";
    // Strip images from README (they're shown in the slideshow)
    const simplified = stripImagesFromMarkdown(project.fullReadme);
    readmeContent.innerHTML = markdownToHtml(simplified);
    readmeSection.append(readmeTitle, readmeContent);
    leftCol.appendChild(readmeSection);
  } else if (desc) {
    const aboutSection = document.createElement("div");
    aboutSection.className = "project-detail-readme";
    const aboutTitle = document.createElement("h2");
    aboutTitle.textContent = "About This Project";
    const aboutText = document.createElement("div");
    aboutText.className = "project-detail-readme-content";
    const p = document.createElement("p");
    p.textContent = desc;
    aboutText.appendChild(p);
    aboutSection.append(aboutTitle, aboutText);
    leftCol.appendChild(aboutSection);
  }

  // Right: Technologies + Quick Links + Stats
  const rightCol = document.createElement("div");
  rightCol.className = "project-detail-content-right";

  // Technologies
  if (project.technologies?.length > 0) {
    const techSection = document.createElement("div");
    techSection.className = "project-detail-info-card";
    const techTitle = document.createElement("h3");
    techTitle.textContent = "Technologies";
    const tags = document.createElement("div");
    tags.className = "project-detail-tech";
    project.technologies.forEach((t) => {
      const tag = document.createElement("span");
      tag.className = "tech-tag";
      tag.textContent = t;
      const color = GITHUB_LANGUAGE_COLORS[t];
      if (color) {
        tag.style.backgroundColor = color;
        tag.style.color = getContrastTextColor(color);
      }
      tags.appendChild(tag);
    });
    techSection.append(techTitle, tags);
    rightCol.appendChild(techSection);
  }

  // Quick Links
  const hasLinks =
    project.github_link || project.live_link;
  if (hasLinks) {
    const linksSection = document.createElement("div");
    linksSection.className = "project-detail-info-card";
    const linksTitle = document.createElement("h3");
    linksTitle.textContent = "Quick Links";
    const linksList = document.createElement("div");
    linksList.className = "project-detail-links";
    if (project.github_link) {
      const ghLink = document.createElement("a");
      ghLink.href = project.github_link;
      ghLink.target = "_blank";
      ghLink.className = "project-detail-link-item";
      ghLink.innerHTML = "Repository";
      linksList.appendChild(ghLink);
    }
    if (project.live_link) {
      const liveLink = document.createElement("a");
      liveLink.href = project.live_link;
      liveLink.target = "_blank";
      liveLink.className = "project-detail-link-item";
      liveLink.innerHTML = "Live Demo";
      linksList.appendChild(liveLink);
    }
    linksSection.append(linksTitle, linksList);
    rightCol.appendChild(linksSection);
  }

  // Stats
  if (project.stars != null || project.technologies?.length > 0) {
    const statsSection = document.createElement("div");
    statsSection.className = "project-detail-info-card";
    const statsTitle = document.createElement("h3");
    statsTitle.textContent = "Stats";
    const statsGrid = document.createElement("div");
    statsGrid.className = "project-detail-stats";
    if (project.stars != null) {
      const statItem = document.createElement("div");
      statItem.className = "project-detail-stat";
      const statValue = document.createElement("div");
      statValue.className = "project-detail-stat-value";
      statValue.textContent = project.stars;
      const statLabel = document.createElement("div");
      statLabel.className = "project-detail-stat-label";
      statLabel.textContent = "Stars";
      statItem.append(statValue, statLabel);
      statsGrid.appendChild(statItem);
    }
    if (project.technologies?.length > 0) {
      const statItem = document.createElement("div");
      statItem.className = "project-detail-stat";
      const statValue = document.createElement("div");
      statValue.className = "project-detail-stat-value";
      statValue.textContent = project.technologies.length;
      const statLabel = document.createElement("div");
      statLabel.className = "project-detail-stat-label";
      statLabel.textContent = "Technologies";
      statItem.append(statValue, statLabel);
      statsGrid.appendChild(statItem);
    }
    statsSection.append(statsTitle, statsGrid);
    rightCol.appendChild(statsSection);
  }

  contentGrid.append(leftCol, rightCol);
  page.appendChild(contentGrid);

  main.appendChild(page);
  frag.appendChild(main);
  frag.appendChild(buildFooter());
  app.innerHTML = "";
  app.appendChild(frag);
  setupThemeToggle();
  window.scrollTo(0, 0);
}

// Re-export setupThemeToggle for use in renderProjectDetail
import { setupThemeToggle } from "./theme.js";
