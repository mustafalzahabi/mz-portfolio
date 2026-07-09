// ============================================================================
// DOM BUILDERS
// ============================================================================

import { getContrastTextColor } from "./utils.js";
import { GITHUB_LANGUAGE_COLORS } from "./api.js";
import { attachThemeSwitchHandlers } from "./theme.js";

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

  if (profile.cv_link) {
    const resumeLink = document.createElement("a");
    resumeLink.href = profile.cv_link;
    resumeLink.target = "_blank";
    resumeLink.className = "banner-link-item";
    resumeLink.textContent = "\uD83D\uDCC4 Resume";
    bannerLinks.appendChild(resumeLink);
  }

  if (contact) {
    if (contact.email) {
      const emailLink = document.createElement("a");
      emailLink.href = `mailto:${contact.email}`;
      emailLink.className = "banner-link-item";
      emailLink.textContent = "\u2709\uFE0F Email";
      bannerLinks.appendChild(emailLink);
    }

    if (contact.github) {
      const ghLink = document.createElement("a");
      ghLink.href = contact.github;
      ghLink.target = "_blank";
      ghLink.className = "banner-link-item";
      ghLink.textContent = "\uD83D\uDC19 GitHub";
      bannerLinks.appendChild(ghLink);
    }

    if (contact.linkedin) {
      const liLink = document.createElement("a");
      liLink.href = contact.linkedin;
      liLink.target = "_blank";
      liLink.className = "banner-link-item";
      liLink.textContent = "\uD83D\uDCBC LinkedIn";
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

  const cvLink = document.createElement("a");
  cvLink.href = about.cv_link;
  cvLink.className = "cv-link";
  cvLink.download = "";
  cvLink.textContent = "Download Resume";
  philDiv.appendChild(cvLink);

  container.append(bioDiv, philDiv);
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

  const msg = document.createElement("p");
  msg.textContent = contact.message;

  const links = document.createElement("div");
  links.className = "contact-links";

  const emailLink = document.createElement("a");
  emailLink.href = `mailto:${contact.email}`;
  emailLink.textContent = "Email";

  const ghLink = document.createElement("a");
  ghLink.href = contact.github;
  ghLink.target = "_blank";
  ghLink.textContent = "GitHub";

  const liLink = document.createElement("a");
  liLink.href = contact.linkedin;
  liLink.target = "_blank";
  liLink.textContent = "LinkedIn";

  links.append(emailLink, ghLink, liLink);
  container.append(msg, links);
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
// SLIDESHOW
// ============================================================================

export function buildSlideshow(images) {
  const container = document.createElement("div");
  container.className = "slideshow-container";

  const wrapper = document.createElement("div");
  wrapper.className = "slideshow-wrapper";

  let currentIndex = 0;

  const img = document.createElement("img");
  img.className = "slideshow-img";
  img.src = images[0];
  img.alt = "Project screenshot";
  img.onerror = () => (img.style.display = "none");

  const counter = document.createElement("div");
  counter.className = "slideshow-counter";
  counter.textContent = `${currentIndex + 1}/${images.length}`;

  wrapper.append(img, counter);

  if (images.length > 1) {
    const animateSlide = (direction, onClick) => {
      const outClass =
        direction === "next" ? "slide-out-left" : "slide-out-right";
      const inClass = direction === "next" ? "slide-in-right" : "slide-in-left";

      img.classList.add(outClass);

      setTimeout(() => {
        img.classList.remove(outClass, inClass);
        onClick();
        img.src = images[currentIndex];
        counter.textContent = `${currentIndex + 1}/${images.length}`;
        void img.offsetWidth;
        img.classList.add(inClass);
      }, 400);
    };

    const createBtn = (text, direction, onClick) => {
      const btn = document.createElement("button");
      btn.className = "slideshow-btn";
      btn.textContent = text;
      btn.onmouseover = () => (btn.style.background = "rgba(0,0,0,0.7)");
      btn.onmouseout = () => (btn.style.background = "rgba(0,0,0,0.5)");
      btn.onclick = () => animateSlide(direction, onClick);
      return btn;
    };

    const prevBtn = createBtn("\u25C0", "prev", () => {
      currentIndex = (currentIndex - 1 + images.length) % images.length;
    });
    prevBtn.style.left = "16px";

    const nextBtn = createBtn("\u25B6", "next", () => {
      currentIndex = (currentIndex + 1) % images.length;
    });
    nextBtn.style.right = "16px";

    const buttons = document.createElement("div");
    buttons.className = "slideshow-buttons";
    buttons.append(prevBtn, nextBtn);
    wrapper.appendChild(buttons);
  }

  container.appendChild(wrapper);
  return container;
}

// ============================================================================
// PROJECT DETAIL PAGE
// ============================================================================

export function renderProjectDetail(project, allProjectsData) {
  const app = document.getElementById("app");
  const frag = document.createDocumentFragment();
  const main = document.createElement("main");
  main.appendChild(buildNavbar());

  const card = document.createElement("div");
  card.className = "project-detail-card";

  // Back button
  const backBtn = document.createElement("a");
  backBtn.href = "#";
  backBtn.className = "project-detail-back";
  backBtn.textContent = "\u2190 Back to Projects";
  card.appendChild(backBtn);

  // Title and links
  const h1 = document.createElement("h1");
  h1.className = "project-detail-title";
  h1.textContent = project.name;
  card.appendChild(h1);

  const links = document.createElement("div");
  links.className = "project-links";
  if (project.live_link) {
    const a = document.createElement("a");
    a.href = project.live_link;
    a.target = "_blank";
    a.textContent = "\uD83D\uDD17 Live Demo";
    links.appendChild(a);
  }
  const ghLink = document.createElement("a");
  ghLink.href = project.github_link;
  ghLink.target = "_blank";
  ghLink.textContent = "\uD83D\uDC19 GitHub";
  links.appendChild(ghLink);
  card.appendChild(links);

  // Responsive flex container: slideshow left, about/tech right
  const container = document.createElement("div");
  container.className = "project-detail-container";

  // Left: Slideshow or image
  const leftCol = document.createElement("div");
  leftCol.className = "project-detail-left";
  if (project.allImages && project.allImages.length > 0) {
    leftCol.appendChild(buildSlideshow(project.allImages));
  } else if (project.image) {
    const img = document.createElement("img");
    img.src = project.image;
    img.alt = project.name;
    img.className = "project-detail-image";
    leftCol.appendChild(img);
  }

  // Right: About + Technologies
  const rightCol = document.createElement("div");
  rightCol.className = "project-detail-right";
  if (project.readmeDescription || project.description) {
    const desc = document.createElement("div");
    desc.className = "project-detail-section";
    const h2 = document.createElement("h2");
    h2.textContent = "About";
    const p = document.createElement("p");
    p.textContent = project.readmeDescription || project.description;
    desc.append(h2, p);
    rightCol.appendChild(desc);
  }
  if (project.technologies?.length > 0) {
    const tech = document.createElement("div");
    tech.className = "project-detail-section";
    const h2 = document.createElement("h2");
    h2.textContent = "Technologies";
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
    tech.append(h2, tags);
    rightCol.appendChild(tech);
  }
  container.append(leftCol, rightCol);
  card.appendChild(container);

  // Full-width README section below
  if (project.fullReadme) {
    const readmeSection = document.createElement("section");
    readmeSection.className = "project-detail-readme";
    const readmeTitle = document.createElement("h2");
    readmeTitle.textContent = "README";
    const readmeContent = document.createElement("div");
    readmeContent.className = "project-detail-readme-content";
    readmeContent.innerHTML = markdownToHtml(project.fullReadme);
    readmeSection.append(readmeTitle, readmeContent);
    card.appendChild(readmeSection);
  }

  main.appendChild(card);
  frag.appendChild(main);
  frag.appendChild(buildFooter());
  app.innerHTML = "";
  app.appendChild(frag);
  setupThemeToggle();
  window.scrollTo(0, 0);
}

// Re-export setupThemeToggle for use in renderProjectDetail
import { setupThemeToggle } from "./theme.js";
