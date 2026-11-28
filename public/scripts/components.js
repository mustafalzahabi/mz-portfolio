// ============================================================================
// DOM BUILDERS
// Every section builder has the signature build<Name>(vm, cfg, ctx) and returns
// a <section> (or null when there's nothing to show). The "code" intro
// animation types out these functions' own source, so keep them readable.
// ctx = { base, locale, present, photo, openResume() }  (base = "/<id>")
// ============================================================================

import { dropdown, loginUrl, accountMenu } from "./account.js";
import { session } from "./storage.js";
import { h, svgIcon, formatDate, formatDateRange, copyText, downloadFile, toast, plural, readingTime, initials } from "./utils.js";
import { markdownToHtml, markdownToText } from "./markdown.js";
import { ICONS, networkIcon, logoImg } from "./icons.js";
import { findProfile, isRepoHidden } from "./merge.js";
import { buildThemeToggle } from "./theme.js";
import { fetchReadme, extractReadmeImages, extractReadmeSummary, extractReadmeAbout } from "./api.js";
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
  section.appendChild(h("h2.section-title", { id: `${key}-title`, dataset: { path: `@text.sections.${key}` } }, heading));
  return section;
}

function iconLabel(icon, label) {
  return [svgIcon(ICONS[icon] || icon), h("span", label)];
}

function tagList(items, className = "tag", field = null, { languageColors = true } = {}) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return null;
  return h("ul.tags", { role: "list", dataset: { list: field } }, list.map((t) => {
    const li = h(`li.${className}`, t);
    return colorLanguageTags && languageColors ? paintLanguageTag(li, t) : li;
  }));
}

/** Blog tags are topics, not tech stacks: never language-colored. */
const postTags = (tags) => tagList(tags, "tag", null, { languageColors: false });

/** Generic timeline/card entry used by work, volunteer, education, awards, … */
function entryCard({ title, subtitle, subtitleUrl, when, location, summary, highlights, tags, link, linkLabel, extra, fields = {} }) {
  const card = h("article.card.entry");
  const head = h("header.entry-head");
  const titleField = title || !subtitle ? fields.title : fields.subtitle;
  head.appendChild(h("h3.entry-title", { dataset: { field: titleField || null } }, title || subtitle || ""));
  if (subtitle && title) {
    head.appendChild(
      h("p.entry-subtitle", { dataset: { field: fields.subtitle || null } }, subtitleUrl ? h("a", { href: subtitleUrl }, subtitle) : subtitle),
    );
  }
  const meta = [
    when && h("span.entry-when", { dataset: { dates: fields.dates || null } }, when),
    location && h("span.entry-where", svgIcon(ICONS.pin), h("span", { dataset: { field: fields.location || null } }, location)),
  ].filter(Boolean);
  if (meta.length) head.appendChild(h("p.entry-meta", meta));
  card.appendChild(head);

  if (summary) card.appendChild(h("p.entry-summary", { dataset: { field: fields.summary || null } }, summary));
  if (highlights?.length) card.appendChild(h("ul.entry-highlights", highlights.map((x, i) => h("li", h("span", { dataset: { field: fields.highlights ? `${fields.highlights}.${i}` : null } }, x)))));
  if (extra) card.appendChild(extra);
  const tl = tagList(tags, "tag", fields.tags || null);
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
  const toggle = buildThemeToggle();
  const account = signedInMenu(ctx);
  if (toggle || account) banner.appendChild(h("div.banner-toggle", toggle, account));

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
  details.appendChild(h("h1.profile-name", { dataset: { path: "basics.name" } }, b.name));
  const tagline = cfg.text.tagline || b.label;
  if (tagline) details.appendChild(h("p.profile-title", { dataset: { path: cfg.text.tagline ? "@text.tagline" : "basics.label" } }, tagline));

  const facts = h("ul.profile-facts", { role: "list" });
  if (cfg.header.showLocation && b.location) facts.appendChild(h("li", iconLabel("pin", b.location)));
  if (b.url && !isThisPortfolio(b.url, ctx.base)) facts.appendChild(h("li", h("a", { href: b.url }, iconLabel("globe", b.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")))));
  if (cfg.header.showPhone && b.phone) facts.appendChild(h("li", h("a", { href: `tel:${b.phone.replace(/[^\d+]/g, "")}` }, iconLabel("phone", b.phone))));
  if (facts.children.length) details.appendChild(facts);

  // Actions
  const actions = h("div.profile-actions");
  if (cfg.header.resume && vm.hasResume) {
    actions.appendChild(h("button.btn.btn-primary", { type: "button", onclick: () => ctx.openResume() }, svgIcon(ICONS.doc), "Resume"));
  }
  // Profile links (header.links) as round icon buttons, then a ⋯ menu for
  // the less common actions, so the row stays short on every screen
  const links = h("nav.profile-links", { "aria-label": "Profiles" });
  for (const key of cfg.header.links) {
    if (key === "email" && b.email) {
      links.appendChild(h("a.profile-link", { href: `mailto:${b.email}`, "aria-label": "Email", title: "Email" }, svgIcon(ICONS.mail)));
      continue;
    }
    const p = findProfile(b, key);
    if (p && !isThisPortfolio(p.url, ctx.base)) links.appendChild(h("a.profile-link", { href: p.url, "aria-label": p.network, title: p.network }, svgIcon(networkIcon(p.network))));
  }
  const extra = [
    b.email && { label: "Copy email address", icon: "copy", onclick: async () => toast((await copyText(b.email)) ? "Email address copied" : "Couldn't copy", "info") },
    cfg.header.vcard && { label: "Save contact", icon: "contact", onclick: () => downloadVCard(vm) },
    cfg.header.share && { label: "Share", icon: "share", onclick: () => sharePage(b) },
  ].filter(Boolean);
  if (extra.length) {
    links.appendChild(dropdown({
      button: h("button.profile-link", { type: "button", title: "More" }, svgIcon(ICONS.more)),
      label: "More actions",
      className: ".profile-more",
      items: extra,
    }));
  }
  if (links.children.length) actions.appendChild(links);
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
        if (!nav.isConnected) return io.disconnect(); // re-rendered: this nav is gone
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

export function buildAbout(vm, cfg) {
  const bio = cfg.text.bio || vm.basics.summary;
  if (!bio) return null;

  // One readable column; the resume opens from the header button
  const section = createSection("about", "About", cfg);
  const text = h("div.about-text");
  const prose = h("div.prose.about-lead", { dataset: { path: cfg.text.bio ? "@text.bio" : "basics.summary", multiline: "1" } });
  prose.innerHTML = markdownToHtml(bio);
  text.appendChild(prose);
  section.appendChild(text);
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
        fields: { title: "position", subtitle: job.name ? "name" : "company", summary: job.summary || !job.description ? "summary" : "description", highlights: "highlights", dates: "startDate,endDate", location: "location" },
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
        fields: { title: "position", subtitle: "organization", summary: "summary", highlights: "highlights", dates: "startDate,endDate" },
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
        fields: { title: degree ? null : "institution", subtitle: "institution", dates: "startDate,endDate", tags: "courses" },
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
  const grid = h("div.projects", { dataset: { layout: pc.layout, image: pc.imagePosition, count: String(Math.min(vm.projects.length, 3)) } });

  for (const [i, p] of vm.projects.entries()) {
    const card = h("a.card.project-card", { href: `${ctx.base}/project/${encodeURIComponent(p.slug)}`, "aria-label": `${p.name} — details` });
    const cover = p.image || p.images[0];
    if (pc.imagePosition !== "none") {
      // No picture → a generated cover in the owner's colors, so every card has a visual
      const generated = () => h("div.project-media.is-generated", { dataset: { tone: String(i % 3) }, "aria-hidden": "true" }, h("span", initials(p.name)));
      card.appendChild(cover
        ? h("div.project-media", h("img", { src: cover, alt: "", loading: "lazy", decoding: "async", onerror: (e) => e.target.parentElement.replaceWith(generated()) }))
        : generated());
    }
    const body = h("div.project-body");
    const title = h("h3.project-title", p.name);
    if (pc.showStars && p.stars) title.appendChild(h("span.project-stars", { "aria-label": `${p.stars} stars` }, svgIcon(ICONS.star), String(p.stars)));
    body.appendChild(title);
    const meta = [p.entity, p.type, formatDateRange(p.startDate, p.endDate, ctx.locale, ctx.present)].filter(Boolean).join(" · ");
    if (meta) body.appendChild(h("p.project-meta", meta));
    if (p.description) body.appendChild(h("p.project-desc", { dataset: { source: p.sources?.description || null } }, p.description));
    const tl = tagList(p.keywords.slice(0, 6));
    if (tl) body.appendChild(tl);
    card.appendChild(body);
    grid.appendChild(card);
  }
  section.appendChild(grid);
  return section;
}

/** Loads README covers for GitHub-backed projects that have no image yet. */
export async function enrichProjectCovers(projects, max = 8, projectsCfg = {}) {
  const targets = projects.filter((p) => p.repo && !p.image && !p.images.length).slice(0, max);
  await Promise.all(
    targets.map(async (p) => {
      const readme = await fetchReadme(p.repo.owner, p.repo.name, p.repo.branch);
      if (!readme) return;
      p.readme = readme;
      p.readmeImages = extractReadmeImages(readme, p.repo.owner, p.repo.name, p.repo.branch); // all of them, hidden too (edit mode)
      p.images = p.readmeImages.filter((src) => !isRepoHidden(projectsCfg, p.repo.name, "image", src));
      p.sources = { ...p.sources, images: "readme" };
      if (!p.description) {
        p.description = extractReadmeSummary(readme);
        p.sources.description = "readme";
      }
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
  const toggle = buildThemeToggle();
  const account = signedInMenu(ctx);
  if (toggle || account) bar.appendChild(h("div.page-bar-tools", toggle, account));
  return bar;
}

/** Your avatar menu (or "Sign in"), in the page's own top row (never floating over content). */
function signedInMenu(ctx) {
  const user = session()?.user;
  if (ctx.embedded) return null;
  return accountMenu({ user, items: [{ label: "mz-portfolio home", icon: "globe", href: ctx.homeHref }] });
}

function factRow(label, value) {
  if (!value) return null;
  return h("div.fact", h("dt", label), h("dd", value));
}

export function readmeHtml(project, text) {
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
  const repoName = project.repo?.name || "";
  const hidden = (kind, value) => Boolean(repoName) && isRepoHidden(cfg.projects, repoName, kind, value);

  // ---- Images first: one slider, every image fitted to the same frame
  const sliderSlot = h("div.project-slider-slot");
  page.appendChild(sliderSlot);
  let images = [...new Set([project.image, ...project.images].filter(Boolean))];
  // The project cards may already have taken images from the README
  let imagesFromReadme = project.sources?.images === "readme";
  if (imagesFromReadme) {
    project.readmeImages ||= images;
    images = images.filter((src) => !hidden("image", src));
  }
  const renderSlider = () => {
    sliderSlot.replaceChildren(...(images.length ? [buildSlider(images, project.name, { source: imagesFromReadme ? "readme" : null })] : []));
  };
  renderSlider();
  // Edit mode puts the image editor here
  page.appendChild(h("div.project-gallery-slot"));

  // ---- Text
  const hero = h("section.project-hero");
  const intro = h("div.project-hero-text");
  intro.appendChild(h("h1.project-hero-title", { dataset: { field: "name", source: project.sources?.name || null } }, project.name));
  if (project.description) intro.appendChild(h("p.project-hero-lead", { dataset: { field: "description", source: project.sources?.description || null } }, project.description));
  const actions = h("div.project-hero-actions");
  if (live) actions.appendChild(h("a.btn.btn-primary", { href: live }, svgIcon(ICONS.external), "Visit project"));
  if (project.github) actions.appendChild(h("a.btn.btn-ghost", { href: project.github }, svgIcon(ICONS.github), "Source code"));
  if (actions.children.length) intro.appendChild(actions);
  const chips = [
    (project.type || project.entity) && [ICONS.folder, [project.type, project.entity].filter(Boolean).join(" · ")],
    project.roles.length && [ICONS.contact, project.roles.join(", ")],
    when && [ICONS.clock, when, "startDate,endDate"],
    project.stars && [ICONS.star, plural(project.stars, "star")],
  ].filter(Boolean);
  if (chips.length) intro.appendChild(h("ul.project-hero-chips", { role: "list" }, chips.map(([icon, text, dates]) => h("li", svgIcon(icon), h("span", { dataset: { dates: dates || null } }, text)))));
  hero.appendChild(intro);
  page.appendChild(hero);

  // ---- Body: content + "at a glance" sidebar
  const layout = h("div.project-layout");
  const main = h("div.project-main");

  main.appendChild(h("section.project-block.project-highlights", { "aria-labelledby": "p-highlights", hidden: project.highlights.length ? null : true },
    h("h2.project-block-title", { id: "p-highlights" }, "Highlights"),
    h("ul.highlight-grid", { role: "list" }, project.highlights.map((x, i) => h("li.card", svgIcon(ICONS.check), h("span", { dataset: { field: `highlights.${i}` } }, x))))));

  // The README's description only: no images, setup steps, badges or code
  const readmeBlock = h("section.project-block.project-readme", { "aria-labelledby": "p-readme", hidden: true, dataset: { source: "readme" } },
    h("h2.project-block-title", { id: "p-readme" }, "About this project"));
  const readmeBox = h("div.prose");
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
  const tl = tagList(project.keywords, "tag", "keywords");
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
      project.readme = text;
      const about = hidden("readme") ? "" : extractReadmeAbout(text);
      if (about) {
        readmeBox.innerHTML = readmeHtml(project, about);
        readmeBlock.hidden = false;
      }
      if (!images.length) {
        project.readmeImages = extractReadmeImages(text, project.repo.owner, project.repo.name, project.repo.branch);
        images = project.readmeImages.filter((src) => !hidden("image", src));
        imagesFromReadme = true;
        renderSlider();
      }
      page.dispatchEvent(new CustomEvent("mz:readme", { bubbles: true }));
    };
    if (project.readme) render(project.readme);
    else fetchReadme(project.repo.owner, project.repo.name, project.repo.branch).then(render);
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

/**
 * Project images as a filmstrip: every image at the same height and its own
 * shape (portrait, landscape, square: nothing cropped, no empty bars), side
 * by side, centred when they all fit, swiped or stepped through when not.
 * Clicking one opens it full size (arrows / swipe / Escape).
 */
export function buildSlider(images, label, { source = null } = {}) {
  const wrap = h("section.slider", { "aria-roledescription": "carousel", "aria-label": `${label} images`, dataset: { source, count: String(images.length) } });
  const track = h("div.slider-track", { tabindex: "0", "aria-label": `${label} images, use the arrow keys to move` });
  const slides = images.map((src, i) => {
    const img = h("img", {
      src, alt: i === 0 ? `${label} preview` : `${label}, image ${i + 1}`, loading: i < 3 ? "eager" : "lazy", decoding: "async",
      onerror: (e) => {
        e.target.closest("figure")?.remove();
        update();
      },
      onload: (e) => {
        // Very tall or very wide images get a gentler frame (CSS)
        const r = e.target.naturalWidth / Math.max(1, e.target.naturalHeight);
        e.target.closest("figure").dataset.shape = r < 0.7 ? "tall" : r > 2.2 ? "wide" : "";
        update();
      },
    });
    return h("figure.slide", { "aria-roledescription": "slide", "aria-label": `${i + 1} of ${images.length}` },
      h("button.slide-open", { type: "button", "aria-label": `Open image ${i + 1} full size`, onclick: () => openLightbox(i) }, img));
  });
  track.append(...slides);
  wrap.appendChild(track);

  const live = () => [...track.querySelectorAll(".slide")];
  // The slide nearest the middle of the track
  const current = () => {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let dist = Infinity;
    live().forEach((s, i) => {
      const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid);
      if (d < dist) [best, dist] = [i, d];
    });
    return best;
  };
  const go = (i) => {
    const all = live();
    const s = all[Math.max(0, Math.min(all.length - 1, i))];
    if (s) track.scrollTo({ left: s.offsetLeft - (track.clientWidth - s.offsetWidth) / 2, behavior: "smooth" });
  };
  const prev = h("button.slider-btn.prev", { type: "button", "aria-label": "Previous image", onclick: () => go(current() - 1) }, svgIcon(ICONS.arrowLeft));
  const next = h("button.slider-btn.next", { type: "button", "aria-label": "Next image", onclick: () => go(current() + 1) }, svgIcon(ICONS.arrowRight));
  const dots = h("div.slider-dots");
  wrap.append(prev, next, dots);

  // Controls only when the strip is wider than the page
  const update = () => {
    const all = live();
    const overflows = track.scrollWidth > track.clientWidth + 2;
    wrap.classList.toggle("is-scrollable", overflows);
    if (dots.children.length !== all.length) {
      dots.replaceChildren(...all.map((_, i) => h("button.slider-dot", { type: "button", "aria-label": `Show image ${i + 1}`, onclick: () => go(i) })));
    }
    const at = current();
    [...dots.children].forEach((d, i) => d.setAttribute("aria-current", String(i === at)));
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  };
  track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") go(current() + 1);
    else if (e.key === "ArrowLeft") go(current() - 1);
    else return;
    e.preventDefault();
  });
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => update()).observe(track);
  requestAnimationFrame(update);

  function openLightbox(start) {
    if (document.body.classList.contains("is-editing")) return;
    const srcs = live().map((s) => s.querySelector("img").src);
    let at = Math.min(start, srcs.length - 1);
    const img = h("img.lightbox-img", { alt: "" });
    const count = h("span.lightbox-count");
    const show = (i) => {
      at = (i + srcs.length) % srcs.length;
      img.src = srcs[at];
      img.alt = `${label}, image ${at + 1} of ${srcs.length}`;
      count.textContent = srcs.length > 1 ? `${at + 1} / ${srcs.length}` : "";
    };
    const many = srcs.length > 1;
    const dialog = h("dialog.lightbox", { "aria-label": `${label} images` },
      img,
      h("div.lightbox-bar",
        count,
        h("button.lightbox-btn", { type: "button", "aria-label": "Close", onclick: () => dialog.close() }, svgIcon(ICONS.close))),
      many ? h("button.lightbox-btn.lightbox-prev", { type: "button", "aria-label": "Previous image", onclick: () => show(at - 1) }, svgIcon(ICONS.arrowLeft)) : null,
      many ? h("button.lightbox-btn.lightbox-next", { type: "button", "aria-label": "Next image", onclick: () => show(at + 1) }, svgIcon(ICONS.arrowRight)) : null,
    );
    dialog.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" && many) show(at + 1);
      if (e.key === "ArrowLeft" && many) show(at - 1);
    });
    // Click outside the image closes; swipe steps
    dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());
    let x0 = null;
    dialog.addEventListener("pointerdown", (e) => (x0 = e.clientX));
    dialog.addEventListener("pointerup", (e) => {
      if (x0 !== null && many && Math.abs(e.clientX - x0) > 50) show(at + (e.clientX < x0 ? 1 : -1));
      x0 = null;
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      go(at);
    });
    show(at);
    document.body.appendChild(dialog);
    dialog.showModal();
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
    const head = h("header.skill-head", h("h3.skill-name", { dataset: { field: "name" } }, group.name));
    if (group.level) head.appendChild(h("span.skill-level", group.level));
    card.appendChild(head);

    if (display === "progress" && (group.percent !== null || group.weights)) {
      if (group.percent !== null) {
        card.appendChild(h("div.meter", { role: "meter", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(group.percent)), "aria-label": `${group.name}: ${group.level}` }, h("span.meter-fill", { style: { width: `${group.percent}%` } })));
        const tl = tagList(group.keywords, "tag", "keywords");
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
      card.appendChild(h("ul.plain-list", { dataset: { list: "keywords" } }, group.keywords.map((k) => h("li", k))));
    } else {
      const tl = tagList(group.keywords, "tag", "keywords");
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
    list.appendChild(h("li.card.chip-card", h("strong", { dataset: { field: lang.language || !lang.name ? "language" : "name" } }, lang.language || lang.name || ""), lang.fluency ? h("span.muted", { dataset: { field: "fluency" } }, lang.fluency) : null));
  }
  section.appendChild(list);
  return section;
}

export function buildInterests(vm, cfg) {
  if (!vm.interests.length) return null;
  const section = createSection("interests", "Interests", cfg);
  const grid = h("div.card-grid");
  for (const it of vm.interests) {
    grid.appendChild(h("article.card", h("h3.entry-title", { dataset: { field: "name" } }, it.name || ""), tagList(it.keywords, "tag", "keywords")));
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
    grid.appendChild(entryCard({ title: a.title, subtitle: a.awarder, when: formatDate(a.date, ctx.locale), summary: a.summary, fields: { title: "title", subtitle: "awarder", summary: "summary", dates: "date" } }));
  }
  section.appendChild(grid);
  return section;
}

export function buildCertificates(vm, cfg, ctx) {
  if (!vm.certificates.length) return null;
  const section = createSection("certificates", "Certificates", cfg);
  const grid = h("div.card-grid");
  for (const c of vm.certificates) {
    grid.appendChild(entryCard({ title: c.name, subtitle: c.issuer, when: formatDate(c.date, ctx.locale), link: c.url, linkLabel: "View certificate", fields: { title: "name", subtitle: "issuer", dates: "date" } }));
  }
  section.appendChild(grid);
  return section;
}

export function buildPublications(vm, cfg, ctx) {
  if (!vm.publications.length) return null;
  const section = createSection("publications", "Publications", cfg);
  const grid = h("div.card-grid");
  for (const p of vm.publications) {
    grid.appendChild(entryCard({ title: p.name, subtitle: p.publisher, when: formatDate(p.releaseDate, ctx.locale), summary: p.summary, link: p.url, linkLabel: "Read", fields: { title: "name", subtitle: "publisher", summary: "summary", dates: "releaseDate" } }));
  }
  section.appendChild(grid);
  return section;
}

export function buildReferences(vm, cfg) {
  if (!vm.references.length) return null;
  const section = createSection("references", "References", cfg);
  const grid = h("div.card-grid");
  for (const r of vm.references) {
    grid.appendChild(h("figure.card.quote", h("blockquote", { dataset: { field: "reference" } }, r.reference || ""), h("figcaption", { dataset: { field: "name" } }, r.name || "")));
  }
  section.appendChild(grid);
  return section;
}

// ============================================================================
// CONTACT & FOOTER
// ============================================================================

/**
 * True when url points back to this very portfolio, on this host or any
 * mz-portfolio deployment (production, staging, previews).
 */
export function isThisPortfolio(url, base) {
  try {
    const u = new URL(url, location.origin);
    const host = u.host.replace(/^www\./, "");
    const ours = host === location.host || /(^|\.)mz-portfolio\.pages\.dev$/.test(host);
    // "/gh/user" and "/gd/id" are older forms of the same address
    const path = (p) => decodeURIComponent(p).replace(/\/+$/, "").replace(/^\/(gh|gd)\//, "/").toLowerCase();
    return ours && path(u.pathname) === path(new URL(base || "/", location.origin).pathname);
  } catch {
    return false;
  }
}

export function buildContact(vm, cfg, ctx) {
  const b = vm.basics;
  // Links back to this very portfolio (e.g. basics.url) are left out
  const ownUrl = { test: (u) => isThisPortfolio(u, ctx.base) };
  const links = [];
  if (b.email) links.push({ href: `mailto:${b.email}`, label: b.email, icon: ICONS.mail });
  if (b.phone && cfg.header.showPhone) links.push({ href: `tel:${b.phone.replace(/[^\d+]/g, "")}`, label: b.phone, icon: ICONS.phone });
  if (b.url && !ownUrl.test(b.url)) links.push({ href: b.url, label: b.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), icon: ICONS.globe });
  for (const p of b.profiles) if (!ownUrl.test(p.url)) links.push({ href: p.url, label: p.network, icon: networkIcon(p.network) });
  const message = cfg.text.contact_message;
  if (!links.length && !message) return null;

  const section = createSection("contact", "Get in touch", cfg);
  if (message) section.appendChild(h("p.contact-message", { dataset: { path: "@text.contact_message" } }, message));
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
        h("span", " · "),
        h("a", { href: ctx.homeHref }, "Make your own"),
        session()?.user ? null : h("span", " · "),
        session()?.user ? null : h("a", { href: loginUrl(location.pathname), dataset: { external: "" } }, "Sign in")),
    );
  }
  return footer;
}

// ============================================================================
// BLOG
// ============================================================================

/** "Main title — subtitle" → [main, subtitle]. */
export function splitTitle(title) {
  const m = String(title).match(/^(.+?)\s+[—–]\s+(.+)$/);
  return m ? [m[1], m[2]] : [String(title), ""];
}

/** Keeps "Chi-Squared" together: hyphens inside words become non-breaking. */
const noBreakHyphens = (s) => String(s).replace(/(\w)-(\w)/g, "$1‑$2");

/** The post's picture: its cover, else its first image, else null. */
export function postImage(post) {
  return post.image || post.body.match(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/)?.[1] || null;
}

/** Text with every match of q wrapped in <mark>. */
function markMatches(text, q) {
  text = String(text);
  if (!q) return text;
  const out = [];
  const lower = text.toLowerCase();
  let at = 0;
  for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, at)) {
    out.push(text.slice(at, i), h("mark", text.slice(i, i + q.length)));
    at = i + q.length;
  }
  out.push(text.slice(at));
  return out;
}

const seedTone = (seed) => [...String(seed)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % 3;

/** A card's picture; posts without one get a generated cover in the palette. */
function postThumb(post, seed) {
  const generated = () =>
    h("div.post-thumb.is-generated", { dataset: { tone: String(seedTone(seed)) }, "aria-hidden": "true" },
      h("span", initials((post.tags[0] || post.title).replace(/-/g, " "))));
  const src = postImage(post);
  return src
    ? h("div.post-thumb", h("img", { src, alt: "", loading: "lazy", decoding: "async", onerror: (e) => e.target.parentElement.replaceWith(generated()) }))
    : generated();
}

export function buildBlogList(vm, cfg, ctx, state = { query: "", tag: "", page: 1 }) {
  const wrap = h("section.blog", { "aria-labelledby": "blog-title" });
  wrap.appendChild(h("h2.section-title", { id: "blog-title" }, cfg.text.tabs.blog || "Blog",
    ctx.feedHref ? h("a.icon-btn.blog-feed", { href: ctx.feedHref, "aria-label": "RSS feed", title: "RSS feed" }, svgIcon(ICONS.rss)) : null));

  // Most-used tags first, so the useful filters come before the long tail
  const tagCount = new Map();
  for (const t of vm.posts.flatMap((p) => p.tags)) tagCount.set(t, (tagCount.get(t) || 0) + 1);
  const allTags = [...tagCount.keys()].sort((a, b) => tagCount.get(b) - tagCount.get(a) || a.localeCompare(b));
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
    // Past a dozen tags, the rest wait behind "More" (always shown if one of them is selected)
    const SHOWN = 12;
    allTags.forEach((t, i) => {
      const c = chip(t, t);
      if (i >= SHOWN && t !== state.tag) c.hidden = true;
      chips.appendChild(c);
    });
    if (allTags.length > SHOWN) {
      const more = h("button.chip.chip-more", { type: "button", "aria-expanded": "false" }, `+${allTags.length - SHOWN} more`);
      more.addEventListener("click", () => {
        const open = more.getAttribute("aria-expanded") !== "true";
        more.setAttribute("aria-expanded", String(open));
        more.textContent = open ? "Fewer" : `+${allTags.length - SHOWN} more`;
        chips.querySelectorAll(".chip[data-tag]").forEach((c, i) => {
          if (i > SHOWN) c.hidden = !open && c.dataset.tag !== state.tag;
        });
      });
      chips.appendChild(more);
    }
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
    // Browsing (no search, no tag): a series shows once, as one card for all its parts
    const items = [];
    const seen = new Set();
    for (const p of filtered) {
      if (!q && !state.tag && p.series) {
        if (seen.has(p.series)) continue;
        const parts = filtered.filter((x) => x.series === p.series);
        if (parts.length > 1) {
          seen.add(p.series);
          items.push({ series: p.series, parts: parts.sort((a, b) => (a.part || 0) - (b.part || 0)) });
          continue;
        }
      }
      items.push(p);
    }
    // Same day: a series card leads the single posts
    const day = (it) => (it.parts || [it]).map((p) => String(p.date).slice(0, 10)).sort().pop();
    items.sort((x, y) => day(y).localeCompare(day(x)) || (y.parts ? 1 : 0) - (x.parts ? 1 : 0));
    const per = cfg.blog.perPage;
    const pages = Math.max(1, Math.ceil(items.length / per));
    state.page = Math.min(state.page, pages);
    const slice = items.slice((state.page - 1) * per, state.page * per);

    results.replaceChildren();
    if (!slice.length) {
      results.appendChild(h("p.empty", "No posts match."));
      return;
    }
    const href = (p) => `${ctx.base}/blog/${encodeURIComponent(p.slug)}`;
    const list = h("div.post-list");
    // Archive: month headings, once the posts span more than one month
    const month = (it) => day(it).slice(0, 7);
    const months = new Set(items.map(month));
    let lastMonth = "";
    for (const item of slice) {
      if (months.size > 1 && month(item) !== lastMonth) {
        lastMonth = month(item);
        const d = new Date(`${lastMonth}-01T00:00:00`);
        list.appendChild(h("h3.post-month", Number.isNaN(d.getTime()) ? lastMonth : d.toLocaleDateString(ctx.locale || undefined, { month: "long", year: "numeric" })));
      }
      if (item.parts) {
        const first = item.parts[0];
        const minutes = item.parts.reduce((n, p) => n + readingTime(p.body), 0);
        const card = h("article.post-card.series-card");
        const bodyEl = h("div.post-card-body");
        bodyEl.appendChild(h("p.post-series", "Series"));
        bodyEl.appendChild(h("h3.post-title", h("a", { href: href(first) }, noBreakHyphens(item.series))));
        bodyEl.appendChild(h("p.post-meta", `${item.parts.length} parts · ${minutes} min read`));
        bodyEl.appendChild(h("p.post-excerpt", "Starts with ", h("a.series-start", { href: href(first) }, noBreakHyphens(splitTitle(first.title)[0])), item.parts[1] ? `, then ${splitTitle(item.parts[1].title)[0]}${item.parts.length > 2 ? " and more" : ""}.` : "."));
        card.appendChild(bodyEl);
        card.appendChild(postThumb(first, item.series));
        list.appendChild(card);
        continue;
      }
      const post = item;
      const [title, subtitle] = splitTitle(post.title);
      const card = h("article.post-card");
      const bodyEl = h("div.post-card-body");
      if (post.series) bodyEl.appendChild(h("p.post-series", post.part ? `${post.series} · Part ${post.part}` : post.series));
      bodyEl.appendChild(h("h3.post-title", h("a", { href: href(post) }, markMatches(noBreakHyphens(title), q.replace(/-/g, "‑")))));
      if (subtitle) bodyEl.appendChild(h("p.post-subtitle", markMatches(subtitle, q)));
      bodyEl.appendChild(h("p.post-meta", formatDate(String(post.date).slice(0, 10), ctx.locale, { long: true }), " · ", `${readingTime(post.body)} min read`));
      // A description is shown whole; only text cut from the body gets "…"
      const text = post.description ? "" : markdownToText(post.body);
      let excerpt = post.description || (text.length > 180 ? `${text.slice(0, 180).replace(/\s+\S*$/, "")}…` : text);
      // Searching: when the match is only in the text, show the passage around it
      if (q && !`${post.title} ${excerpt}`.toLowerCase().includes(q)) {
        const full = markdownToText(post.body);
        const i = full.toLowerCase().indexOf(q);
        if (i !== -1) excerpt = `…${full.slice(Math.max(0, i - 70), i + q.length + 110).replace(/^\S*\s/, "").replace(/\s\S*$/, "")}…`;
      }
      if (excerpt) bodyEl.appendChild(h("p.post-excerpt", markMatches(excerpt, q)));
      if (cfg.blog.showTags) {
        const tl = postTags(post.tags);
        if (tl) bodyEl.appendChild(tl);
      }
      card.appendChild(bodyEl);
      card.appendChild(postThumb(post, post.series || post.tags[0] || post.title));
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
  const postHref = (p) => `${ctx.base}/blog/${encodeURIComponent(p.slug)}`;
  const page = h("article.detail.post-detail");

  const head = h("header.detail-head");
  const [mainTitle, subtitle] = splitTitle(post.title);
  head.appendChild(h("h1.detail-title", noBreakHyphens(mainTitle)));
  if (subtitle) head.appendChild(h("p.detail-subtitle", subtitle));
  head.appendChild(
    h("p.detail-meta",
      formatDate(String(post.date).slice(0, 10), ctx.locale, { long: true }), " · ", `${readingTime(post.body)} min read`,
      h("button.icon-btn.post-copy", { type: "button", "aria-label": "Copy link to this post", title: "Copy link", onclick: async () => toast((await copyText(location.href)) ? "Link copied" : "Couldn't copy") }, svgIcon(ICONS.link)),
      post.url ? h("a.icon-btn.post-copy", { href: post.url, "aria-label": "View the source of this post", title: "Source" }, svgIcon(ICONS.external)) : null),
  );
  const tl = cfg.blog.showTags ? postTags(post.tags) : null;
  if (tl) head.appendChild(tl);
  // Everything in the reading column; the contents (if any) sit beside it
  const main = h("div.post-main", head);

  // Series: where this post sits, and the whole reading order one click away
  const series = post.series ? vm.posts.filter((p) => p.series === post.series).sort((a, b) => (a.part || 0) - (b.part || 0)) : [];
  if (series.length > 1) {
    const pos = series.indexOf(post) + 1;
    const box = h("details.post-series-box");
    box.appendChild(h("summary", h("span.muted", `Part ${post.part || pos} of ${series.length}`), " · ", h("strong", post.series)));
    box.appendChild(h("ol", series.map((p) => h("li", p === post ? h("span", { "aria-current": "page" }, p.title) : h("a", { href: postHref(p) }, p.title)))));
    main.appendChild(box);
  }

  if (post.image) main.appendChild(h("img.post-cover", { src: post.image, alt: "", decoding: "async" }));
  const body = h("div.prose");
  body.innerHTML = markdownToHtml(post.body.replace(new RegExp(`^#\\s+${post.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n`), ""));

  // Pictures open full size (diagrams are hard to read at text width)
  for (const img of body.querySelectorAll("img")) {
    img.classList.add("zoomable");
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    img.setAttribute("aria-label", `Enlarge image${img.alt ? `: ${img.alt}` : ""}`);
    const open = () => {
      const dlg = h("dialog.lightbox", { "aria-label": img.alt || "Image" },
        h("img", { src: img.currentSrc || img.src, alt: img.alt }),
        h("button.icon-btn.lightbox-close", { type: "button", "aria-label": "Close" }, svgIcon(ICONS.close)));
      dlg.addEventListener("click", () => dlg.close());
      dlg.addEventListener("close", () => { dlg.remove(); img.focus(); });
      document.body.appendChild(dlg);
      dlg.showModal();
    };
    img.addEventListener("click", open);
    img.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  }

  // Code blocks get a copy button
  for (const pre of body.querySelectorAll("pre")) {
    const btn = h("button.icon-btn.code-copy", { type: "button", "aria-label": "Copy code", title: "Copy code" }, svgIcon(ICONS.copy));
    btn.addEventListener("click", async () => {
      const ok = await copyText(pre.querySelector("code")?.textContent ?? pre.textContent);
      btn.replaceChildren(svgIcon(ok ? ICONS.check : ICONS.alert));
      setTimeout(() => btn.replaceChildren(svgIcon(ICONS.copy)), 1500);
    });
    pre.before(h("div.code-wrap", btn));
    btn.parentElement.prepend(pre);
  }

  // Table of contents from the ## headings, for posts long enough to need one
  const headings = [...body.querySelectorAll("h2")];
  const usedIds = new Set();
  for (const hd of body.querySelectorAll("h2, h3")) {
    let id = `s-${hd.textContent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section"}`;
    while (usedIds.has(id)) id += "-";
    usedIds.add(id);
    hd.id = id;
    // A # beside each heading links straight to it
    hd.appendChild(h("a.heading-anchor", { href: `#${id}`, "aria-label": `Link to “${hd.textContent}”`, onclick: async (e) => {
      e.preventDefault();
      history.replaceState(history.state, "", `#${id}`);
      hd.scrollIntoView({ behavior: "smooth", block: "start" });
      if (await copyText(location.href)) toast("Link to section copied");
    } }, "#"));
  }
  if (headings.length >= 3) {
    const items = headings.map((hd) => {
      const id = hd.id;
      const label = hd.textContent.replace(/#$/, "");
      return h("li", h("a", { href: `#${id}`, onclick: (e) => { e.preventDefault(); hd.scrollIntoView({ behavior: "smooth", block: "start" }); history.replaceState(history.state, "", `#${id}`); } }, label));
    });
    // Open beside the article on wide screens; a one-line toggle above it on phones
    const toc = h("details.post-toc", { open: matchMedia("(min-width: 1100px)").matches });
    toc.appendChild(h("summary", "On this page"));
    toc.appendChild(h("ol", items));
    // Phones: the toggle goes between the header and the text
    main.appendChild(body);
    const aside = h("aside.post-toc-wrap");
    const place = () => (matchMedia("(min-width: 1100px)").matches ? aside.appendChild(toc) : main.insertBefore(toc, body));
    place();
    matchMedia("(min-width: 1100px)").addEventListener("change", place);
    page.appendChild(h("div.post-layout", aside, main));
    // Highlight the section being read
    const links = new Map(items.map((li, n) => [headings[n], li.firstChild]));
    const spy = new IntersectionObserver((entries) => {
      if (!page.isConnected) return spy.disconnect();
      const top = headings.filter((hd) => hd.getBoundingClientRect().top < innerHeight * 0.35).pop() || headings[0];
      for (const [hd, a] of links) a.toggleAttribute("aria-current", hd === top);
    }, { rootMargin: "0px 0px -60% 0px" });
    headings.forEach((hd) => spy.observe(hd));
  } else {
    main.appendChild(body);
    page.appendChild(main);
  }

  // Next/previous: within the series when there is one, otherwise by date
  const seq = series.length > 1 ? series : vm.posts;
  const i = seq.indexOf(post);
  const [before, after] = series.length > 1 ? [seq[i - 1], seq[i + 1]] : [seq[i + 1], seq[i - 1]];
  const pager = h("nav.pager.post-pager", { "aria-label": series.length > 1 ? "More in this series" : "More posts" });
  const pagerCard = (p, cls, label) =>
    h(`a.card.${cls}`, { href: postHref(p) },
      h("span.pager-label", label),
      h("strong", noBreakHyphens(splitTitle(p.title)[0])),
      p.description ? h("span.pager-desc", p.description) : null);
  const inSeries = series.length > 1;
  if (before) pager.appendChild(pagerCard(before, "pager-prev", inSeries ? "← Previous part" : "← Older"));
  if (after) pager.appendChild(pagerCard(after, "pager-next", inSeries ? "Next part →" : "Newer →"));
  if (pager.children.length) page.appendChild(pager);

  // Outside a series: up to three posts sharing the most tags
  if (!inSeries && post.tags.length) {
    const related = vm.posts
      .filter((p) => p !== post)
      .map((p) => ({ p, n: p.tags.filter((t) => post.tags.includes(t)).length }))
      .filter((x) => x.n)
      .sort((a, b) => b.n - a.n || new Date(b.p.date) - new Date(a.p.date))
      .slice(0, 3);
    if (related.length) {
      page.appendChild(h("section.related", { "aria-labelledby": "related-title" },
        h("h2.related-title", { id: "related-title" }, "Related posts"),
        h("ul", related.map(({ p }) => h("li", h("a", { href: postHref(p) }, noBreakHyphens(splitTitle(p.title)[0])), p.description ? h("span.muted", p.description) : null)))));
    }
  }

  // Back to top, once the reader is well into a long post
  const toTop = h("button.icon-btn.to-top", { type: "button", "aria-label": "Back to top", title: "Back to top", hidden: true, onclick: () => scrollTo({ top: 0, behavior: "smooth" }) }, svgIcon(ICONS.arrowLeft));
  page.appendChild(toTop);

  // Reading progress, a thin bar under the top edge
  const bar = h("div.read-progress", { "aria-hidden": "true" });
  page.prepend(bar);
  const onScroll = () => {
    if (!page.isConnected) return removeEventListener("scroll", onScroll);
    const r = main.getBoundingClientRect();
    const done = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
    bar.style.transform = `scaleX(${done})`;
    toTop.hidden = scrollY < innerHeight * 1.5;
  };
  addEventListener("scroll", onScroll, { passive: true });
  requestAnimationFrame(onScroll);
  return page;
}

// ============================================================================
// CUSTOM TABS — embed | markdown | code | html  ("link" tabs never get a page)
// Nothing here can reach the portfolio's own origin: embeds must be other
// https sites, code is only displayed, HTML runs in an opaque-origin sandbox.
// ============================================================================

const SANDBOX_URL = new URL("../markup/sandbox.html", import.meta.url).href;

async function loadTabText(tab) {
  if (typeof tab.content === "string") return tab.content;
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

  if (tab.type === "link") {
    body.appendChild(h("p.muted", "Visitors who click this tab go straight to ", h("a", { href: tab.url, target: "_blank", rel: "noopener" }, tab.url), "."));
    return page;
  }

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
