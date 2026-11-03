// ============================================================================
// DOM BUILDERS
// Every section builder has the signature build<Name>(vm, cfg, ctx) and returns
// a <section> (or null when there's nothing to show). The "code" intro
// animation types out these functions' own source, so keep them readable.
// ctx = { base, locale, present, photo, openResume() }  (base = "/<id>")
// ============================================================================

import { h, svgIcon, formatDate, formatDateRange, copyText, downloadFile, toast, plural, readingTime, initials } from "./utils.js";
import { markdownToHtml, markdownToText } from "./markdown.js";
import { ICONS, networkIcon, logoImg } from "./icons.js";
import { findProfile } from "./merge.js";
import { buildThemeToggle } from "./theme.js";
import { fetchReadme, extractReadmeImages, extractReadmeSummary } from "./api.js";
import { buildResumePreview } from "./resume/index.js";
import { paintLanguageTag } from "./languages.js";
import { tokenizeJs, tokenizeHtml } from "./animations/code-reveal.js";

let colorLanguageTags = true;

/** Set per portfolio from config.tags.languageColors. */
export function setTagOptions({ languageColors }) {
  colorLanguageTags = languageColors !== false;
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

function createSection(key, title, cfg) {
  const heading = cfg?.text?.sections?.[key] || title;
  const section = h("section.section", { id: key, "aria-labelledby": `${key}-title`, dataset: { section: key } });
  section.appendChild(h("h2.section-title", { id: `${key}-title` }, heading));
  return section;
}

function iconLabel(icon, label) {
  return [svgIcon(ICONS[icon] || icon), h("span", label)];
}

function tagList(items, className = "tag") {
  const list = (items || []).filter(Boolean);
  if (!list.length) return null;
  return h("ul.tags", { role: "list" }, list.map((t) => {
    const li = h(`li.${className}`, t);
    return colorLanguageTags ? paintLanguageTag(li, t) : li;
  }));
}

/** Generic timeline/card entry used by work, volunteer, education, awards, … */
function entryCard({ title, subtitle, subtitleUrl, when, location, summary, highlights, tags, link, linkLabel, extra }) {
  const card = h("article.card.entry");
  const head = h("header.entry-head");
  head.appendChild(h("h3.entry-title", title || subtitle || ""));
  if (subtitle && title) {
    head.appendChild(
      h("p.entry-subtitle", subtitleUrl ? h("a", { href: subtitleUrl }, subtitle) : subtitle),
    );
  }
  const meta = [when && h("span.entry-when", when), location && h("span.entry-where", svgIcon(ICONS.pin), location)].filter(Boolean);
  if (meta.length) head.appendChild(h("p.entry-meta", meta));
  card.appendChild(head);

  if (summary) card.appendChild(h("p.entry-summary", summary));
  if (highlights?.length) card.appendChild(h("ul.entry-highlights", highlights.map((x) => h("li", x))));
  if (extra) card.appendChild(extra);
  const tl = tagList(tags);
  if (tl) card.appendChild(tl);
  if (link) card.appendChild(h("a.entry-link", { href: link }, linkLabel || "View", svgIcon(ICONS.external)));
  return card;
}

// ============================================================================
// HEADER
// ============================================================================

export function buildHeader(vm, cfg, ctx) {
  const b = vm.basics;
  const header = h("header.profile-header", { id: "top" });

  // Banner
  const banner = h("div.profile-banner", { dataset: { aspect: cfg.banner.aspect } });
  if (ctx.bannerImage) {
    banner.style.backgroundImage = `url("${ctx.bannerImage.replace(/["\\]/g, "")}")`;
    banner.classList.add("has-image");
    if (cfg.banner.overlay) banner.classList.add("has-overlay");
  }
  const toggle = buildThemeToggle(cfg.theme.toggle);
  if (toggle) banner.appendChild(h("div.banner-toggle", toggle));

  const bannerLinks = h("nav.banner-links", { "aria-label": "Profiles" });
  for (const key of cfg.header.links) {
    if (key === "email" && b.email) {
      bannerLinks.appendChild(h("a.banner-link", { href: `mailto:${b.email}`, "aria-label": "Email" }, svgIcon(ICONS.mail), h("span", "Email")));
      continue;
    }
    const p = findProfile(b, key);
    if (p) bannerLinks.appendChild(h("a.banner-link", { href: p.url, "aria-label": p.network }, svgIcon(networkIcon(p.network)), h("span", p.network)));
  }
  if (bannerLinks.children.length) banner.appendChild(bannerLinks);
  header.appendChild(banner);

  // Identity
  const info = h("div.profile-info");
  if (ctx.photo) {
    info.appendChild(
      h("img.profile-photo", {
        src: ctx.photo,
        alt: b.name,
        width: 160,
        height: 160,
        decoding: "async",
        dataset: { shape: cfg.profile.photoShape },
        onerror: (e) => e.target.replaceWith(h("div.profile-photo.profile-initials", { dataset: { shape: cfg.profile.photoShape }, "aria-hidden": "true" }, initials(b.name))),
      }),
    );
  } else {
    info.appendChild(h("div.profile-photo.profile-initials", { dataset: { shape: cfg.profile.photoShape }, "aria-hidden": "true" }, initials(b.name)));
  }

  const details = h("div.profile-details");
  details.appendChild(h("h1.profile-name", b.name));
  const tagline = cfg.text.tagline || b.label;
  if (tagline) details.appendChild(h("p.profile-title", tagline));

  const facts = h("ul.profile-facts", { role: "list" });
  if (cfg.header.showLocation && b.location) facts.appendChild(h("li", iconLabel("pin", b.location)));
  if (b.url) facts.appendChild(h("li", h("a", { href: b.url }, iconLabel("globe", b.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")))));
  if (cfg.header.showPhone && b.phone) facts.appendChild(h("li", h("a", { href: `tel:${b.phone.replace(/[^\d+]/g, "")}` }, iconLabel("phone", b.phone))));
  if (facts.children.length) details.appendChild(facts);

  // Actions
  const actions = h("div.profile-actions");
  if (cfg.text.cta && vm.hasResume) {
    actions.appendChild(h("button.btn.btn-primary", { type: "button", onclick: () => ctx.openResume() }, svgIcon(ICONS.doc), cfg.text.cta));
  }
  if (b.email) {
    actions.appendChild(
      h("button.btn.btn-ghost", {
        type: "button",
        "aria-label": `Copy email address ${b.email}`,
        onclick: async () => toast((await copyText(b.email)) ? "Email address copied" : "Couldn't copy", "info"),
      }, svgIcon(ICONS.copy), h("span.btn-label", "Copy email")),
    );
  }
  if (cfg.header.vcard) {
    actions.appendChild(
      h("button.btn.btn-ghost", { type: "button", onclick: () => downloadVCard(vm) }, svgIcon(ICONS.contact), h("span.btn-label", "Save contact")),
    );
  }
  if (cfg.header.share) {
    actions.appendChild(h("button.btn.btn-ghost", { type: "button", onclick: () => sharePage(b) }, svgIcon(ICONS.share), h("span.btn-label", "Share")));
  }
  if (actions.children.length) details.appendChild(actions);

  info.appendChild(details);
  header.appendChild(info);
  return header;
}

async function sharePage(basics) {
  const data = { title: document.title, text: basics.label ? `${basics.name} — ${basics.label}` : basics.name, url: location.href.split("#")[0] };
  if (navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  toast((await copyText(data.url)) ? "Link copied" : "Couldn't copy the link");
}

function vcardEscape(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

export function buildVCard(vm) {
  const b = vm.basics;
  const parts = b.name.split(/\s+/);
  const last = parts.length > 1 ? parts.pop() : "";
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${vcardEscape(last)};${vcardEscape(parts.join(" "))};;;`,
    `FN:${vcardEscape(b.name)}`,
  ];
  if (b.label) lines.push(`TITLE:${vcardEscape(b.label)}`);
  if (vm.work[0]?.name && !vm.work[0].endDate) lines.push(`ORG:${vcardEscape(vm.work[0].name)}`);
  if (b.email) lines.push(`EMAIL;TYPE=INTERNET:${vcardEscape(b.email)}`);
  if (b.phone) lines.push(`TEL;TYPE=CELL:${vcardEscape(b.phone)}`);
  if (b.url) lines.push(`URL:${vcardEscape(b.url)}`);
  const loc = b.locationParts || {};
  if (loc.city || loc.countryCode) {
    lines.push(`ADR;TYPE=WORK:;;${vcardEscape(loc.address)};${vcardEscape(loc.city)};${vcardEscape(loc.region)};${vcardEscape(loc.postalCode)};${vcardEscape(loc.countryCode)}`);
  }
  for (const p of b.profiles) lines.push(`X-SOCIALPROFILE;TYPE=${vcardEscape(p.network.toLowerCase())}:${vcardEscape(p.url)}`);
  lines.push(`URL;TYPE=portfolio:${vcardEscape(location.href.split("#")[0])}`);
  if (b.summary) lines.push(`NOTE:${vcardEscape(b.summary)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function downloadVCard(vm) {
  const file = `${vm.basics.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "contact"}.vcf`;
  downloadFile(file, buildVCard(vm), "text/vcard");
}

// ============================================================================
// TABS & SECTION NAVIGATION
// ============================================================================

/** Profile, Blog (when there are posts) and the owner's custom tabs. */
export function buildTabs(vm, cfg, ctx, active = "profile") {
  const tabs = [{ key: "profile", href: ctx.base, label: cfg.text.tabs.profile || "Profile" }];
  if (cfg.blog.enabled && vm.posts.length) tabs.push({ key: "blog", href: `${ctx.base}/blog`, label: cfg.text.tabs.blog || "Blog" });
  for (const tab of cfg.tabs) {
    tabs.push(
      tab.type === "link"
        ? { key: tab.slug, href: tab.url, label: tab.label, external: true }
        : { key: tab.slug, href: `${ctx.base}/tab/${encodeURIComponent(tab.slug)}`, label: tab.label },
    );
  }
  if (tabs.length < 2) return null;

  const nav = h("nav.tabs", { "aria-label": "Portfolio pages" });
  const list = h("div.tabs-inner");
  for (const t of tabs) {
    list.appendChild(
      h("a.tab", { href: t.href, dataset: { tab: t.key }, "aria-current": t.key === active ? "page" : null },
        t.label, t.external ? svgIcon(ICONS.external) : null),
    );
  }
  nav.appendChild(list);
  return nav;
}

/** Side dots on desktop, scrollable bottom bar on phones (one element, CSS decides). */
export function buildSectionNav(entries) {
  if (entries.length < 2) return null;
  const nav = h("nav.section-nav", { "aria-label": "Sections" });
  const list = h("ol.section-nav-list");
  for (const { key, label } of entries) {
    list.appendChild(
      h("li", h("a.section-nav-link", { href: `#${key}`, dataset: { section: key } }, h("span.section-nav-dot", { "aria-hidden": "true" }), h("span.section-nav-label", label))),
    );
  }
  nav.appendChild(list);

  // Highlight the section in view
  if (typeof IntersectionObserver === "function") {
    const visible = new Map();
    const io = new IntersectionObserver(
      (records) => {
        for (const r of records) visible.set(r.target.id, r.intersectionRatio);
        let best = null;
        let bestRatio = 0;
        for (const [id, ratio] of visible) if (ratio > bestRatio) [best, bestRatio] = [id, ratio];
        nav.querySelectorAll(".section-nav-link").forEach((a) => {
          const on = a.dataset.section === best;
          a.classList.toggle("active", on);
          if (on) {
            a.setAttribute("aria-current", "location");
            if (nav.scrollWidth > nav.clientWidth) a.scrollIntoView({ block: "nearest", inline: "center" });
          } else a.removeAttribute("aria-current");
        });
      },
      { threshold: [0, 0.2, 0.5, 0.8], rootMargin: "-20% 0px -40% 0px" },
    );
    requestAnimationFrame(() => entries.forEach(({ key }) => document.getElementById(key) && io.observe(document.getElementById(key))));
  }
  return nav;
}

// ============================================================================
// ABOUT
// ============================================================================

export function buildAbout(vm, cfg, ctx) {
  const bio = cfg.text.bio || vm.basics.summary;
  const philosophy = cfg.text.philosophy || vm.resume.meta?.philosophy || vm.resume.basics?.philosophy || "";
  if (!bio && !philosophy && !vm.hasResume) return null;

  const section = createSection("about", "About", cfg);
  const grid = h("div.about-grid");
  const text = h("div.about-text");
  if (bio) {
    const prose = h("div.prose");
    prose.innerHTML = markdownToHtml(bio);
    text.appendChild(prose);
  }
  if (philosophy) {
    text.appendChild(h("h3.about-subtitle", "Philosophy"));
    const p = h("div.prose");
    p.innerHTML = markdownToHtml(philosophy);
    text.appendChild(p);
  }
  grid.appendChild(text);

  if (vm.hasResume) {
    grid.appendChild(
      buildResumePreview(vm.resume, {
        theme: cfg.resume.theme,
        allowDownload: cfg.resume.download,
        allowPrint: cfg.resume.print,
        onOpen: ctx.openResume,
      }),
    );
  }
  section.appendChild(grid);
  return section;
}

// ============================================================================
// WORK / VOLUNTEER / EDUCATION
// ============================================================================

export function buildWork(vm, cfg, ctx) {
  if (!vm.work.length) return null;
  const section = createSection("work", "Experience", cfg);
  const list = h("div.timeline");
  for (const job of vm.work) {
    list.appendChild(
      entryCard({
        title: job.position,
        subtitle: job.name || job.company,
        subtitleUrl: job.url,
        when: formatDateRange(job.startDate, job.endDate, ctx.locale, ctx.present),
        location: job.location,
        summary: job.summary || job.description,
        highlights: job.highlights,
      }),
    );
  }
  section.appendChild(list);
  return section;
}

export function buildVolunteer(vm, cfg, ctx) {
  if (!vm.volunteer.length) return null;
  const section = createSection("volunteer", "Volunteering", cfg);
  const list = h("div.timeline");
  for (const v of vm.volunteer) {
    list.appendChild(
      entryCard({
        title: v.position,
        subtitle: v.organization,
        subtitleUrl: v.url,
        when: formatDateRange(v.startDate, v.endDate, ctx.locale, ctx.present),
        summary: v.summary,
        highlights: v.highlights,
      }),
    );
  }
  section.appendChild(list);
  return section;
}

export function buildEducation(vm, cfg, ctx) {
  if (!vm.education.length) return null;
  const section = createSection("education", "Education", cfg);
  const list = h("div.card-grid");
  for (const edu of vm.education) {
    const degree = [edu.studyType, edu.area].filter(Boolean).join(", ");
    const extra = edu.score ? h("p.entry-score", h("strong", "Score: "), String(edu.score)) : null;
    list.appendChild(
      entryCard({
        title: degree || edu.institution,
        subtitle: degree ? edu.institution : "",
        subtitleUrl: edu.url,
        when: formatDateRange(edu.startDate, edu.endDate, ctx.locale, ctx.present),
        location: typeof edu.location === "string" ? edu.location : edu.location?.city,
        tags: edu.courses,
        extra,
      }),
    );
  }
  section.appendChild(list);
  return section;
}

// ============================================================================
// PROJECTS
// ============================================================================

export function buildProjects(vm, cfg, ctx) {
  if (!vm.projects.length) return null;
  const pc = cfg.projects;
  const section = createSection("projects", "Projects", cfg);
  const grid = h("div.projects", { dataset: { layout: pc.layout, image: pc.imagePosition } });

  for (const p of vm.projects) {
    const card = h("a.card.project-card", { href: `${ctx.base}/project/${encodeURIComponent(p.slug)}`, "aria-label": `${p.name} — details` });
    const cover = p.image || p.images[0];
    if (cover && pc.imagePosition !== "none") {
      card.appendChild(
        h("div.project-media", h("img", { src: cover, alt: "", loading: "lazy", decoding: "async", onerror: (e) => e.target.parentElement.remove() })),
      );
    }
    const body = h("div.project-body");
    const title = h("h3.project-title", p.name);
    if (pc.showStars && p.stars) title.appendChild(h("span.project-stars", { "aria-label": `${p.stars} stars` }, svgIcon(ICONS.star), String(p.stars)));
    body.appendChild(title);
    const meta = [p.entity, p.type, formatDateRange(p.startDate, p.endDate, ctx.locale, ctx.present)].filter(Boolean).join(" · ");
    if (meta) body.appendChild(h("p.project-meta", meta));
    if (p.description) body.appendChild(h("p.project-desc", p.description));
    const tl = tagList(p.keywords.slice(0, 6));
    if (tl) body.appendChild(tl);
    card.appendChild(body);
    grid.appendChild(card);
  }
  section.appendChild(grid);
  return section;
}

/** Loads README covers for GitHub-backed projects that have no image yet. */
export async function enrichProjectCovers(projects, max = 8) {
  const targets = projects.filter((p) => p.repo && !p.image && !p.images.length).slice(0, max);
  await Promise.all(
    targets.map(async (p) => {
      const readme = await fetchReadme(p.repo.owner, p.repo.name, p.repo.branch);
      if (!readme) return;
      p.readme = readme;
      p.images = extractReadmeImages(readme, p.repo.owner, p.repo.name, p.repo.branch);
      if (!p.description) p.description = extractReadmeSummary(readme);
    }),
  );
}

// ============================================================================
// PROJECT PAGE — standalone page at /<id>/project/<slug>
// ============================================================================

/** Slim sticky bar for standalone pages: back to the portfolio + theme toggle. */
export function buildPageBar(vm, cfg, ctx, { backHref, backLabel }) {
  const bar = h("header.page-bar");
  const back = h("a.page-bar-back", { href: backHref, "aria-label": `${backLabel} — ${vm.basics.name}` });
  back.appendChild(svgIcon(ICONS.arrowLeft));
  if (ctx.photo) back.appendChild(h("img.page-bar-avatar", { src: ctx.photo, alt: "", width: 32, height: 32, decoding: "async" }));
  back.appendChild(h("span.page-bar-text", h("strong", vm.basics.name), h("span.muted", backLabel)));
  bar.appendChild(back);
  const toggle = buildThemeToggle(cfg.theme.toggle === "none" ? "none" : "icon");
  if (toggle) bar.appendChild(toggle);
  return bar;
}

function factRow(label, value) {
  if (!value) return null;
  return h("div.fact", h("dt", label), h("dd", value));
}

function readmeHtml(project, text) {
  const { owner, name, branch } = project.repo;
  return markdownToHtml(text, {
    baseUrl: `https://github.com/${owner}/${name}/blob/${branch}/`,
    rawBaseUrl: `https://raw.githubusercontent.com/${owner}/${name}/${branch}/`,
    headingOffset: 1,
  });
}

export function buildProjectPage(project, vm, cfg, ctx) {
  const index = vm.projects.indexOf(project);
  const page = h("article.project-page");
  const when = formatDateRange(project.startDate, project.endDate, ctx.locale, ctx.present);
  const live = project.demo || project.url;
  let images = [...new Set([project.image, ...project.images].filter(Boolean))];

  // ---- Hero
  const hero = h("section.project-hero");
  const intro = h("div.project-hero-text");
  const eyebrow = [project.type, project.entity].filter(Boolean).join(" · ");
  if (eyebrow) intro.appendChild(h("p.eyebrow", eyebrow));
  intro.appendChild(h("h1.project-hero-title", project.name));
  if (project.description) intro.appendChild(h("p.project-hero-lead", project.description));
  const actions = h("div.project-hero-actions");
  if (live) actions.appendChild(h("a.btn.btn-primary", { href: live }, svgIcon(ICONS.external), "Visit project"));
  if (project.github) actions.appendChild(h("a.btn.btn-ghost", { href: project.github }, svgIcon(ICONS.github), "Source code"));
  if (actions.children.length) intro.appendChild(actions);
  const chips = [
    project.roles.length && [ICONS.contact, project.roles.join(", ")],
    when && [ICONS.clock, when],
    project.stars && [ICONS.star, plural(project.stars, "star")],
  ].filter(Boolean);
  if (chips.length) intro.appendChild(h("ul.project-hero-chips", { role: "list" }, chips.map(([icon, text]) => h("li", svgIcon(icon), text))));
  hero.appendChild(intro);

  const media = h("figure.project-hero-media");
  const showCover = (src) => {
    media.replaceChildren(
      h("div.frame-bar", { "aria-hidden": "true" }, h("span"), h("span"), h("span")),
      h("img", { src, alt: `${project.name} preview`, decoding: "async", onerror: () => media.remove() }),
    );
    hero.classList.add("has-media");
  };
  if (images[0]) showCover(images[0]);
  hero.appendChild(media);
  page.appendChild(hero);

  // ---- Body: content + "at a glance" sidebar
  const layout = h("div.project-layout");
  const main = h("div.project-main");

  if (project.highlights.length) {
    main.appendChild(
      h("section.project-block", { "aria-labelledby": "p-highlights" },
        h("h2.project-block-title", { id: "p-highlights" }, "Highlights"),
        h("ul.highlight-grid", { role: "list" }, project.highlights.map((x) => h("li.card", svgIcon(ICONS.check), h("span", x))))),
    );
  }

  const gallerySlot = h("div");
  main.appendChild(gallerySlot);
  const renderGallery = () => {
    if (images.length > 1) {
      gallerySlot.replaceChildren(
        h("section.project-block", { "aria-labelledby": "p-gallery" }, h("h2.project-block-title", { id: "p-gallery" }, "Gallery"), buildGallery(images, project.name)),
      );
    }
  };
  renderGallery();

  const readmeBlock = h("section.project-block.project-readme", { "aria-labelledby": "p-readme", hidden: true },
    h("h2.project-block-title", { id: "p-readme" }, "About this project"));
  const readmeBox = h("div.prose.card");
  readmeBlock.appendChild(readmeBox);
  main.appendChild(readmeBlock);
  layout.appendChild(main);

  const aside = h("aside.project-aside");
  const glance = h("div.card.glance", h("h2.glance-title", "At a glance"));
  const facts = h("dl.facts",
    factRow("Role", project.roles.join(", ")),
    factRow("Organization", project.entity),
    factRow("Type", project.type ? project.type[0].toUpperCase() + project.type.slice(1) : ""),
    factRow("Timeline", when),
    factRow("Language", project.language),
    factRow("Stars", project.stars ? String(project.stars) : ""),
    factRow("Last update", project.updatedAt ? formatDate(project.updatedAt.slice(0, 10), ctx.locale, { long: true }) : ""),
  );
  if (facts.children.length) glance.appendChild(facts);
  const tl = tagList(project.keywords);
  if (tl) glance.append(h("h3.glance-sub", "Built with"), tl);
  const links = [live && [ICONS.external, "Live site", live], project.github && [ICONS.github, "Repository", project.github]].filter(Boolean);
  if (links.length) {
    glance.appendChild(h("ul.glance-links", { role: "list" }, links.map(([icon, label, href]) => h("li", h("a", { href }, svgIcon(icon), label)))));
  }
  aside.appendChild(glance);
  layout.appendChild(aside);
  page.appendChild(layout);

  // README (lazy, raw host — no API cost)
  if (project.repo) {
    const render = (text) => {
      if (!text) return;
      readmeBox.innerHTML = readmeHtml(project, text);
      readmeBlock.hidden = false;
      if (!images.length) {
        images = extractReadmeImages(text, project.repo.owner, project.repo.name, project.repo.branch);
        if (images[0]) showCover(images[0]);
        renderGallery();
      }
    };
    if (project.readme) render(project.readme);
    else fetchReadme(project.repo.owner, project.repo.name, project.repo.branch).then((text) => {
      project.readme = text;
      render(text);
    });
  }

  // ---- More projects
  const others = [vm.projects[index - 1], vm.projects[index + 1]].filter(Boolean);
  if (others.length) {
    const more = h("nav.project-more", { "aria-labelledby": "p-more" }, h("h2.project-block-title", { id: "p-more" }, "More projects"));
    const grid = h("div.project-more-grid");
    others.forEach((p) => {
      const cover = p.image || p.images[0];
      grid.appendChild(
        h("a.card.more-card", { href: `${ctx.base}/project/${encodeURIComponent(p.slug)}` },
          cover ? h("img", { src: cover, alt: "", loading: "lazy", decoding: "async", onerror: (e) => e.target.remove() }) : null,
          h("span.more-dir", vm.projects.indexOf(p) < index ? "Previous" : "Next"),
          h("strong", p.name),
          p.description ? h("span.more-desc", p.description) : null),
      );
    });
    more.appendChild(grid);
    page.appendChild(more);
  }
  return page;
}

/** Scroll-snap gallery with buttons (swipe on touch, arrows on desktop). */
export function buildGallery(images, label) {
  const wrap = h("div.gallery", { role: "region", "aria-roledescription": "carousel", "aria-label": `${label} images` });
  const track = h("div.gallery-track", { tabindex: "0" });
  images.forEach((src, i) => {
    track.appendChild(
      h("figure.gallery-slide", { "aria-label": `${i + 1} of ${images.length}` },
        h("img", { src, alt: i === 0 ? `${label} preview` : "", loading: i ? "lazy" : "eager", decoding: "async", onerror: (e) => e.target.closest("figure").remove() })),
    );
  });
  wrap.appendChild(track);
  if (images.length > 1) {
    const go = (dir) => track.scrollBy({ left: dir * track.clientWidth, behavior: "smooth" });
    wrap.appendChild(h("button.gallery-btn.prev", { type: "button", "aria-label": "Previous image", onclick: () => go(-1) }, svgIcon(ICONS.arrowLeft)));
    wrap.appendChild(h("button.gallery-btn.next", { type: "button", "aria-label": "Next image", onclick: () => go(1) }, svgIcon(ICONS.arrowRight)));
  }
  return wrap;
}

// ============================================================================
// SKILLS / LANGUAGES / INTERESTS
// ============================================================================

export function buildSkills(vm, cfg) {
  if (!vm.skills.length) return null;
  const display = cfg.skills.display;
  const section = createSection("skills", "Skills", cfg);
  const grid = h("div.card-grid.skills", { dataset: { display } });

  for (const group of vm.skills) {
    const card = h("article.card.skill-group");
    const head = h("header.skill-head", h("h3.skill-name", group.name));
    if (group.level) head.appendChild(h("span.skill-level", group.level));
    card.appendChild(head);

    if (display === "progress" && (group.percent !== null || group.weights)) {
      if (group.percent !== null) {
        card.appendChild(h("div.meter", { role: "meter", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(group.percent)), "aria-label": `${group.name}: ${group.level}` }, h("span.meter-fill", { style: { width: `${group.percent}%` } })));
        const tl = tagList(group.keywords);
        if (tl) card.appendChild(tl);
      } else {
        const list = h("ul.meter-list");
        for (const k of group.keywords) {
          const pct = group.weights[k];
          list.appendChild(h("li", h("span.meter-label", k, h("span.muted", ` ${pct}%`)), h("div.meter", { role: "meter", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(pct), "aria-label": k }, h("span.meter-fill", { style: { width: `${Math.max(4, pct)}%` } }))));
        }
        card.appendChild(list);
      }
    } else if (display === "list") {
      card.appendChild(h("ul.plain-list", group.keywords.map((k) => h("li", k))));
    } else {
      const tl = tagList(group.keywords);
      if (tl) card.appendChild(tl);
    }
    grid.appendChild(card);
  }
  section.appendChild(grid);
  return section;
}

export function buildLanguages(vm, cfg) {
  if (!vm.languages.length) return null;
  const section = createSection("languages", "Languages", cfg);
  const list = h("ul.chip-list", { role: "list" });
  for (const lang of vm.languages) {
    list.appendChild(h("li.card.chip-card", h("strong", lang.language || lang.name || ""), lang.fluency ? h("span.muted", lang.fluency) : null));
  }
  section.appendChild(list);
  return section;
}

export function buildInterests(vm, cfg) {
  if (!vm.interests.length) return null;
  const section = createSection("interests", "Interests", cfg);
  const grid = h("div.card-grid");
  for (const it of vm.interests) {
    grid.appendChild(h("article.card", h("h3.entry-title", it.name || ""), tagList(it.keywords)));
  }
  section.appendChild(grid);
  return section;
}

// ============================================================================
// AWARDS / CERTIFICATES / PUBLICATIONS / REFERENCES
// ============================================================================

export function buildAwards(vm, cfg, ctx) {
  if (!vm.awards.length) return null;
  const section = createSection("awards", "Awards", cfg);
  const grid = h("div.card-grid");
  for (const a of vm.awards) {
    grid.appendChild(entryCard({ title: a.title, subtitle: a.awarder, when: formatDate(a.date, ctx.locale), summary: a.summary }));
  }
  section.appendChild(grid);
  return section;
}

export function buildCertificates(vm, cfg, ctx) {
  if (!vm.certificates.length) return null;
  const section = createSection("certificates", "Certificates", cfg);
  const grid = h("div.card-grid");
  for (const c of vm.certificates) {
    grid.appendChild(entryCard({ title: c.name, subtitle: c.issuer, when: formatDate(c.date, ctx.locale), link: c.url, linkLabel: "View certificate" }));
  }
  section.appendChild(grid);
  return section;
}

export function buildPublications(vm, cfg, ctx) {
  if (!vm.publications.length) return null;
  const section = createSection("publications", "Publications", cfg);
  const grid = h("div.card-grid");
  for (const p of vm.publications) {
    grid.appendChild(entryCard({ title: p.name, subtitle: p.publisher, when: formatDate(p.releaseDate, ctx.locale), summary: p.summary, link: p.url, linkLabel: "Read" }));
  }
  section.appendChild(grid);
  return section;
}

export function buildReferences(vm, cfg) {
  if (!vm.references.length) return null;
  const section = createSection("references", "References", cfg);
  const grid = h("div.card-grid");
  for (const r of vm.references) {
    grid.appendChild(h("figure.card.quote", h("blockquote", r.reference || ""), r.name ? h("figcaption", r.name) : null));
  }
  section.appendChild(grid);
  return section;
}

// ============================================================================
// CONTACT & FOOTER
// ============================================================================

export function buildContact(vm, cfg) {
  const b = vm.basics;
  const links = [];
  if (b.email) links.push({ href: `mailto:${b.email}`, label: b.email, icon: ICONS.mail });
  if (b.phone && cfg.header.showPhone) links.push({ href: `tel:${b.phone.replace(/[^\d+]/g, "")}`, label: b.phone, icon: ICONS.phone });
  if (b.url) links.push({ href: b.url, label: b.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), icon: ICONS.globe });
  for (const p of b.profiles) links.push({ href: p.url, label: p.network, icon: networkIcon(p.network) });
  const message = cfg.text.contact_message;
  if (!links.length && !message) return null;

  const section = createSection("contact", "Get in touch", cfg);
  if (message) section.appendChild(h("p.contact-message", message));
  section.appendChild(h("ul.contact-links", { role: "list" }, links.map((l) => h("li", h("a.contact-link.card", { href: l.href }, svgIcon(l.icon), h("span", l.label))))));
  return section;
}

export function buildFooter(vm, cfg, ctx) {
  const footer = h("footer.site-footer");
  footer.appendChild(h("p", cfg.footer.text || `\u00A9 ${new Date().getFullYear()} ${vm.basics.name}`));
  if (cfg.footer.lastUpdated && vm.source.updatedAt) {
    footer.appendChild(h("p.muted", `Last updated ${formatDate(vm.source.updatedAt.slice(0, 10), ctx.locale, { long: true })}`));
  }
  if (cfg.footer.credit) {
    footer.appendChild(
      h("p.muted.footer-credit",
        h("a.footer-brand", { href: ctx.homeHref }, logoImg(20), "mz-portfolio"),
        h("span", " — make yours from a resume.json. "),
        h("a", { href: `${ctx.homeHref}edit` }, "Edit")),
    );
  }
  return footer;
}

// ============================================================================
// BLOG
// ============================================================================

export function buildBlogList(vm, cfg, ctx, state = { query: "", tag: "", page: 1 }) {
  const wrap = h("section.blog", { "aria-labelledby": "blog-title" });
  wrap.appendChild(h("h2.section-title", { id: "blog-title" }, cfg.text.tabs.blog || "Blog"));

  const allTags = [...new Set(vm.posts.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b));
  const controls = h("div.blog-controls");
  const results = h("div.blog-results", { "aria-live": "polite" });

  if (cfg.blog.search) {
    const input = h("input.input", { type: "search", placeholder: "Search posts", "aria-label": "Search posts", value: state.query });
    input.addEventListener("input", () => {
      state.query = input.value;
      state.page = 1;
      renderResults();
    });
    controls.appendChild(h("label.search", svgIcon(ICONS.search), input));
  }
  if (cfg.blog.showTags && allTags.length) {
    const chips = h("div.tag-filter", { role: "group", "aria-label": "Filter by tag" });
    const chip = (tag, label) =>
      h("button.chip", {
        type: "button",
        "aria-pressed": String(state.tag === tag),
        onclick: () => {
          state.tag = tag;
          state.page = 1;
          chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.tag === tag)));
          renderResults();
        },
        dataset: { tag },
      }, label);
    chips.appendChild(chip("", "All"));
    allTags.forEach((t) => chips.appendChild(chip(t, t)));
    controls.appendChild(chips);
  }
  if (controls.children.length) wrap.appendChild(controls);
  wrap.appendChild(results);

  function renderResults() {
    const q = state.query.trim().toLowerCase();
    const filtered = vm.posts.filter(
      (p) =>
        (!state.tag || p.tags.includes(state.tag)) &&
        (!q || `${p.title} ${p.description} ${p.tags.join(" ")} ${p.body}`.toLowerCase().includes(q)),
    );
    const per = cfg.blog.perPage;
    const pages = Math.max(1, Math.ceil(filtered.length / per));
    state.page = Math.min(state.page, pages);
    const slice = filtered.slice((state.page - 1) * per, state.page * per);

    results.replaceChildren();
    if (!slice.length) {
      results.appendChild(h("p.empty", "No posts match."));
      return;
    }
    const list = h("div.post-list");
    for (const post of slice) {
      const card = h("article.card.post-card");
      card.appendChild(h("h3.post-title", h("a", { href: `${ctx.base}/blog/${encodeURIComponent(post.slug)}` }, post.title)));
      card.appendChild(h("p.post-meta", formatDate(String(post.date).slice(0, 10), ctx.locale, { long: true }), " · ", `${readingTime(post.body)} min read`));
      const excerpt = post.description || markdownToText(post.body).slice(0, 180);
      if (excerpt) card.appendChild(h("p.post-excerpt", excerpt.length >= 180 ? `${excerpt}…` : excerpt));
      if (cfg.blog.showTags) {
        const tl = tagList(post.tags);
        if (tl) card.appendChild(tl);
      }
      list.appendChild(card);
    }
    results.appendChild(list);

    if (pages > 1) {
      const pager = h("nav.pager.pager-pages", { "aria-label": "Blog pages" });
      for (let i = 1; i <= pages; i++) {
        pager.appendChild(
          h("button.chip", { type: "button", "aria-current": i === state.page ? "page" : null, onclick: () => {
            state.page = i;
            renderResults();
            wrap.scrollIntoView({ behavior: "smooth", block: "start" });
          } }, String(i)),
        );
      }
      results.appendChild(pager);
    }
  }

  renderResults();
  return wrap;
}

export function buildBlogPost(post, vm, cfg, ctx) {
  const index = vm.posts.indexOf(post);
  const page = h("article.detail.post-detail");
  page.appendChild(h("a.back-link", { href: `${ctx.base}/blog` }, svgIcon(ICONS.arrowLeft), cfg.text.tabs.blog || "Blog"));

  const head = h("header.detail-head");
  head.appendChild(h("h1.detail-title", post.title));
  head.appendChild(h("p.detail-meta", formatDate(String(post.date).slice(0, 10), ctx.locale, { long: true }), " · ", `${readingTime(post.body)} min read`));
  const tl = cfg.blog.showTags ? tagList(post.tags) : null;
  if (tl) head.appendChild(tl);
  head.appendChild(
    h("div.detail-actions",
      h("button.btn.btn-ghost", { type: "button", onclick: async () => toast((await copyText(location.href)) ? "Link copied" : "Couldn't copy") }, svgIcon(ICONS.link), "Copy link"),
      post.url ? h("a.btn.btn-ghost", { href: post.url }, svgIcon(ICONS.external), "Source") : null),
  );
  page.appendChild(head);

  if (post.image) page.appendChild(h("img.post-cover", { src: post.image, alt: "", decoding: "async" }));
  const body = h("div.prose");
  body.innerHTML = markdownToHtml(post.body.replace(new RegExp(`^#\\s+${post.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n`), ""));
  page.appendChild(body);

  const pager = h("nav.pager", { "aria-label": "More posts" });
  const newer = vm.posts[index - 1];
  const older = vm.posts[index + 1];
  if (older) pager.appendChild(h("a.pager-prev", { href: `${ctx.base}/blog/${encodeURIComponent(older.slug)}` }, svgIcon(ICONS.arrowLeft), h("span", older.title)));
  if (newer) pager.appendChild(h("a.pager-next", { href: `${ctx.base}/blog/${encodeURIComponent(newer.slug)}` }, h("span", newer.title), svgIcon(ICONS.arrowRight)));
  if (pager.children.length) page.appendChild(pager);
  return page;
}

// ============================================================================
// CUSTOM TABS — embed | markdown | code | html  ("link" tabs never get a page)
// Nothing here can reach the portfolio's own origin: embeds must be other
// https sites, code is only displayed, HTML runs in an opaque-origin sandbox.
// ============================================================================

const SANDBOX_URL = new URL("../markup/sandbox.html", import.meta.url).href;

async function loadTabText(tab) {
  if (tab.content) return tab.content;
  const res = await fetch(tab.url);
  if (!res.ok) throw new Error(`Couldn't load ${tab.url} (${res.status}).`);
  const text = await res.text();
  return text.slice(0, 200_000);
}

function highlight(code, language = "") {
  const pre = h("pre.code-view");
  const el = h("code");
  const tokens = /^(html|xml|svg|vue)$/i.test(language) ? tokenizeHtml(code) : tokenizeJs(code);
  for (const [cls, text] of tokens) el.appendChild(cls ? h(`span.tk-${cls}`, text) : document.createTextNode(text));
  pre.appendChild(el);
  return pre;
}

export function buildTabPage(tab, vm, cfg, ctx) {
  const page = h("section.tab-page", { "aria-labelledby": "tab-title" });
  const head = h("header.tab-page-head", h("h1.section-title", { id: "tab-title" }, tab.label));
  page.appendChild(head);
  const body = h("div.tab-page-body");
  page.appendChild(body);

  if (tab.type === "embed") {
    if (new URL(tab.url).origin === location.origin) {
      body.appendChild(h("p.empty", "This tab can't embed a page from this site."));
      return page;
    }
    head.appendChild(h("a.btn.btn-ghost", { href: tab.url }, svgIcon(ICONS.external), "Open in new tab"));
    body.appendChild(
      h("div.embed-frame", { style: { height: `${tab.height}px` } },
        h("iframe", {
          src: tab.url,
          title: tab.label,
          loading: "lazy",
          referrerpolicy: "no-referrer",
          allow: "fullscreen; picture-in-picture; clipboard-write",
          sandbox: "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation",
        })),
    );
    return page;
  }

  body.appendChild(h("p.muted", "Loading…"));
  loadTabText(tab)
    .then((text) => {
      body.replaceChildren();
      if (tab.type === "markdown") {
        const prose = h("div.prose.card");
        prose.innerHTML = markdownToHtml(text);
        body.appendChild(prose);
      } else if (tab.type === "code") {
        const name = tab.url ? decodeURIComponent(tab.url.split("/").pop()) : tab.language || "code";
        body.appendChild(
          h("div.code-card",
            h("div.code-card-bar",
              h("span", name),
              h("button.btn.btn-ghost", { type: "button", onclick: async () => toast((await copyText(text)) ? "Copied" : "Couldn't copy") }, svgIcon(ICONS.copy), "Copy"),
              tab.url ? h("a.btn.btn-ghost", { href: tab.url }, "Raw") : null),
            highlight(text, tab.language || name.split(".").pop())),
        );
      } else if (tab.type === "html") {
        const frame = h("iframe.html-sandbox", {
          src: SANDBOX_URL,
          title: tab.label,
          sandbox: "allow-scripts allow-modals allow-popups allow-popups-to-escape-sandbox",
          referrerpolicy: "no-referrer",
          style: { height: `${tab.height}px` },
        });
        const onMessage = (e) => {
          if (e.source !== frame.contentWindow || e.data?.type !== "mz-sandbox-ready") return;
          removeEventListener("message", onMessage);
          frame.contentWindow.postMessage({ type: "mz-render", html: text }, "*");
        };
        addEventListener("message", onMessage);
        body.appendChild(h("div.embed-frame", frame));
      }
    })
    .catch((e) => body.replaceChildren(h("p.empty", e.message)));
  return page;
}

// ============================================================================
// SECTION REGISTRY — order, labels, builders (navbar + layout share this)
// ============================================================================

export const SECTION_BUILDERS = {
  about: { label: "About", build: buildAbout },
  work: { label: "Experience", build: buildWork },
  projects: { label: "Projects", build: buildProjects },
  skills: { label: "Skills", build: buildSkills },
  education: { label: "Education", build: buildEducation },
  certificates: { label: "Certificates", build: buildCertificates },
  awards: { label: "Awards", build: buildAwards },
  publications: { label: "Publications", build: buildPublications },
  volunteer: { label: "Volunteering", build: buildVolunteer },
  languages: { label: "Languages", build: buildLanguages },
  interests: { label: "Interests", build: buildInterests },
  references: { label: "References", build: buildReferences },
  contact: { label: "Contact", build: buildContact },
};
