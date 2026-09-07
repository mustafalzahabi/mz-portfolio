// ============================================================================
// DOM BUILDERS
// ============================================================================

import { getContrastTextColor, markdownToHtml, stripImagesFromMarkdown } from "./utils.js";
import { getLanguageColor } from "./api.js";
import { attachThemeSwitchHandlers } from "./theme.js";
import { buildResumePreview } from "./resume.js";

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
  if (opts.bannerImage) {
    banner.style.backgroundImage = `url(${opts.bannerImage})`;
    banner.style.backgroundSize = "cover";
    banner.style.backgroundPosition = "center";
  }

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

  const moonIcon = document.createElement("div");
  moonIcon.className = "theme-icon theme-icon-moon";
  moonIcon.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

  const sunIcon = document.createElement("div");
  sunIcon.className = "theme-icon theme-icon-sun";
  sunIcon.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/><line x1="12" y1="1.5" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.5"/><line x1="1.5" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.5" y2="12"/><line x1="4.2" y1="4.2" x2="6" y2="6"/><line x1="18" y1="18" x2="19.8" y2="19.8"/><line x1="4.2" y1="19.8" x2="6" y2="18"/><line x1="18" y1="6" x2="19.8" y2="4.2"/></svg>`;

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

  details.append(h1, title);
  profileInfo.appendChild(details);
  header.appendChild(profileInfo);

  return header;
}

export function buildTabSelector(hasBlog) {
  const tabSelector = document.createElement("nav");
  tabSelector.className = "tab-selector";

  const profileTab = document.createElement("a");
  profileTab.href = "#";
  profileTab.className = "tab-link active";
  profileTab.dataset.tab = "profile";
  profileTab.textContent = "My Profile";
  tabSelector.appendChild(profileTab);

  if (hasBlog) {
    const blogTab = document.createElement("a");
    blogTab.href = "#";
    blogTab.className = "tab-link";
    blogTab.dataset.tab = "blog";
    blogTab.textContent = "Blog";
    tabSelector.appendChild(blogTab);
  }

  return tabSelector;
}

export function buildAbout(about) {
  const section = createSection("About Me", "about");
  const container = document.createElement("div");
  container.className = "about-container";

  if (about.bio) container.appendChild(createTextBlock("Biography", about.bio));
  if (about.philosophy) container.appendChild(createTextBlock("Philosophy", about.philosophy));

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
      const color = getLanguageColor(tech);
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
    if (proj.github_link) {
      const ghLink = document.createElement("a");
      ghLink.href = proj.github_link;
      ghLink.target = "_blank";
      ghLink.textContent = /github\.com/.test(proj.github_link) ? "GitHub" : "Visit";
      ghLink.onclick = (e) => e.stopPropagation();
      links.appendChild(ghLink);
    }
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
        bar.style.background = "var(--border)";
        bar.style.marginLeft = "0.5rem";
        const fill = document.createElement("div");
        fill.style.height = "100%";
        fill.style.width = Math.floor(40 + Math.random() * 60) + "%";
        fill.style.background = "var(--accent)";
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

  // Normalize URL for comparison (strip trailing slash, lowercase protocol/host)
  const normalizeUrl = (url) => {
    try {
      const u = new URL(url);
      return (u.origin + u.pathname).replace(/\/+$/, "").toLowerCase();
    } catch {
      return url.replace(/\/+$/, "").toLowerCase();
    }
  };

  const currentPageUrl = normalizeUrl(window.location.href);

  const isCurrentPage = (url) => normalizeUrl(url) === currentPageUrl;

  if (contact.email && !isCurrentPage(`mailto:${contact.email}`)) {
    const emailLink = document.createElement("a");
    emailLink.href = `mailto:${contact.email}`;
    emailLink.textContent = "Email";
    links.appendChild(emailLink);
  }

  if (contact.github && !isCurrentPage(contact.github)) {
    const ghLink = document.createElement("a");
    ghLink.href = contact.github;
    ghLink.target = "_blank";
    ghLink.textContent = "GitHub";
    links.appendChild(ghLink);
  }

  if (contact.linkedin && !isCurrentPage(contact.linkedin)) {
    const liLink = document.createElement("a");
    liLink.href = contact.linkedin;
    liLink.target = "_blank";
    liLink.textContent = "LinkedIn";
    links.appendChild(liLink);
  }

  // Additional profile links (website, blog, etc.)
  if (Array.isArray(contact.profiles)) {
    for (const profile of contact.profiles) {
      if (isCurrentPage(profile.url)) continue;
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
// BLOG BUILDERS
// ============================================================================

export function buildBlogPostList(posts) {
  const container = document.createElement("div");
  container.className = "blog-posts";
  container.id = "blog-posts";

  for (const post of posts) {
    const card = document.createElement("article");
    card.className = "blog-card";

    const title = document.createElement("h2");
    title.className = "blog-card-title";
    const link = document.createElement("a");
    link.href = `#/blog/${encodeURIComponent(post.slug)}`;
    link.textContent = post.title;
    title.appendChild(link);

    const meta = document.createElement("div");
    meta.className = "blog-card-meta";
    const d = new Date(post.date);
    meta.textContent = d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    card.append(title, meta);

    if (post.description) {
      const desc = document.createElement("p");
      desc.className = "blog-card-description";
      desc.textContent = post.description;
      card.appendChild(desc);
    }

    if (post.tags?.length > 0) {
      const tags = document.createElement("div");
      tags.className = "blog-card-tags";
      post.tags.forEach((tag) => {
        const tagEl = document.createElement("span");
        tagEl.className = "blog-card-tag";
        tagEl.textContent = tag;
        tags.appendChild(tagEl);
      });
      card.appendChild(tags);
    }

    container.appendChild(card);
  }

  return container;
}

export function renderBlogPostDetail(post) {
  const app = document.getElementById("app");
  const frag = document.createDocumentFragment();
  const main = document.createElement("main");

  const page = document.createElement("div");
  page.className = "blog-detail";

  const backBtn = document.createElement("a");
  backBtn.href = "#blog";
  backBtn.className = "blog-detail-back";
  backBtn.textContent = "\u2190 Back to Blog";
  page.appendChild(backBtn);

  const title = document.createElement("h1");
  title.className = "blog-detail-title";
  title.textContent = post.title;
  page.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "blog-detail-meta";
  const d = new Date(post.date);
  meta.textContent = d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  page.appendChild(meta);

  if (post.tags?.length > 0) {
    const tags = document.createElement("div");
    tags.className = "blog-detail-tags";
    post.tags.forEach((tag) => {
      const tagEl = document.createElement("span");
      tagEl.className = "blog-card-tag";
      tagEl.textContent = tag;
      tags.appendChild(tagEl);
    });
    page.appendChild(tags);
  }

  const content = document.createElement("div");
  content.className = "blog-detail-content";
  content.innerHTML = markdownToHtml(post.body);
  page.appendChild(content);

  const gistLink = document.createElement("a");
  gistLink.href = post.gistUrl;
  gistLink.target = "_blank";
  gistLink.className = "blog-detail-gist-link";
  gistLink.textContent = "View on GitHub Gist \u2192";
  page.appendChild(gistLink);

  main.appendChild(page);
  frag.appendChild(main);
  app.innerHTML = "";
  app.appendChild(frag);
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
  document.title = `${project.name} | Portfolio`;
  const app = document.getElementById("app");
  const frag = document.createDocumentFragment();
  const main = document.createElement("main");
  main.appendChild(buildNavbar());

  const page = document.createElement("div");
  page.className = "project-detail";

  // -- Hero image (full-width within card) --
  const heroImg = project.image || (project.allImages && project.allImages[0]);
  if (heroImg) {
    const hero = document.createElement("div");
    hero.className = "project-detail-hero";
    const img = document.createElement("img");
    img.src = heroImg;
    img.alt = project.name;
    img.loading = "eager";
    hero.appendChild(img);
    page.appendChild(hero);
  }

  // -- Body wrapper --
  const body = document.createElement("div");
  body.className = "project-detail-body";

  // -- Back button --
  const backBtn = document.createElement("a");
  backBtn.href = "#";
  backBtn.className = "project-detail-back";
  backBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> Back to Projects`;
  body.appendChild(backBtn);

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
    starBadge.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ${project.stars}`;
    badges.appendChild(starBadge);
  }
  if (project.isGitHubRepo) {
    const repoBadge = document.createElement("span");
    repoBadge.className = "project-detail-badge";
    repoBadge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg> Public Repo`;
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
    liveBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Live Demo`;
    actions.appendChild(liveBtn);
  }
  if (project.github_link) {
    const ghBtn = document.createElement("a");
    ghBtn.href = project.github_link;
    ghBtn.target = "_blank";
    ghBtn.className = "project-detail-btn secondary";
    const isGh = /github\.com/.test(project.github_link);
    ghBtn.innerHTML = isGh
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg> View on GitHub`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Visit`;
    actions.appendChild(ghBtn);
  }
  if (actions.children.length > 0) header.appendChild(actions);

  body.appendChild(header);

  // -- Overview card (key facts at a glance) --
  const overviewItems = [];
  if (project.technologies?.length > 0) {
    overviewItems.push({ label: "Stack", value: project.technologies.slice(0, 5).join(", ") + (project.technologies.length > 5 ? ` +${project.technologies.length - 5} more` : "") });
  }
  if (project.stars != null) {
    overviewItems.push({ label: "Stars", value: `${project.stars}` });
  }
  if (project.github_link && /github\.com/.test(project.github_link)) {
    const repoName = project.github_link.replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
    overviewItems.push({ label: "Repository", value: repoName });
  }
  if (overviewItems.length > 0) {
    const overview = document.createElement("div");
    overview.className = "project-detail-overview";
    const overviewTitle = document.createElement("h2");
    overviewTitle.textContent = "Overview";
    const grid = document.createElement("div");
    grid.className = "project-detail-overview-grid";
    overviewItems.forEach((item) => {
      const el = document.createElement("div");
      el.className = "project-detail-overview-item";
      el.innerHTML = `<span class="project-detail-overview-label">${item.label}</span><span class="project-detail-overview-value">${item.value}</span>`;
      grid.appendChild(el);
    });
    overview.append(overviewTitle, grid);
    body.appendChild(overview);
  }

  // -- Image gallery (if more than the hero image) --
  const allImages = project.allImages || [];
  const remainingImages = allImages.filter((img) => img !== heroImg);
  if (remainingImages.length > 0) {
    body.appendChild(buildSlideshow(remainingImages));
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
      const color = getLanguageColor(t);
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
      const isGh = /github\.com/.test(project.github_link);
      ghLink.innerHTML = isGh
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg> Repository`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Link`;
      linksList.appendChild(ghLink);
    }
    if (project.live_link) {
      const liveLink = document.createElement("a");
      liveLink.href = project.live_link;
      liveLink.target = "_blank";
      liveLink.className = "project-detail-link-item";
      liveLink.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Live Demo`;
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
  body.appendChild(contentGrid);
  page.appendChild(body);

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
