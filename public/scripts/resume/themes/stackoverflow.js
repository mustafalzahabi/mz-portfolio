// ============================================================================
// THEME: stackoverflow
// Native port of jsonresume-theme-stackoverflow@3.3.0
// (https://github.com/phoinixi/jsonresume-theme-stackoverflow). The Svelte
// components are reproduced as string templates with their scoped styles
// flattened under component class names. Font Awesome 6 is replaced by inline
// SVGs; dates use the original en-GB "MMM YYYY" format ("Sept 2015").
// ============================================================================

import {
  escapeHtml as esc, has, text, textList, safeUrl, mailto, tel, formatDate, markdownLite,
  icon, networkIcon, normalizeResume,
} from "../helpers.js";

// ============================================================================
// STYLES (global.css + flattened component styles)
// ============================================================================

const CSS = `
:root {
  --color-text: #40484f; --color-text-secondary: #606d76; --color-text-muted: #757575;
  --color-heading: #202931; --color-date: #202931; --color-accent: #ff6d1f;
  --color-link: #0095ff; --color-link-hover: #0c65a5;
  --color-background: var(--color-section-title-bg); --color-background-alt: #f1f8ff;
  --color-border: #ccc; --color-border-light: #ddd;
  --color-keyword-text: #2c5777; --color-keyword-bg: #dfeaf1; --color-keyword-border: #dfeaf1;
  --color-reference-border: #ff6d1f;
  --color-bar-beginner: #eb5f51; --color-bar-intermediate: #ffdf1f;
  --color-bar-advanced: #5cb85c; --color-bar-master: #59c596;
  --color-section-title-bg: #fff;
  --font-family: "Helvetica Neue", Helvetica, Arial, "Lucida Grande", sans-serif;
  --fs-name: 2.143rem; --fs-label: 1.429rem; --fs-title: 1.143rem; --fs-card: 1.071rem;
  --fs-body: 1rem; --fs-meta: 0.929rem; --fs-section: 0.857rem; --fs-fine: 0.786rem;
  --lh-tight: 1.15; --lh-snug: 1.3; --lh-base: 1.5;
  --sp-1: 0.286rem; --sp-2: 0.571rem; --sp-3: 0.857rem; --sp-4: 1.143rem; --sp-5: 1.714rem; --sp-6: 2.286rem;
}
@media (prefers-color-scheme: dark) {
  :root {
    --color-text: #d4d4d8; --color-text-secondary: #a1a1aa; --color-text-muted: #9ca3af;
    --color-heading: #e4e4e7; --color-date: #ffffff; --color-accent: #fb923c;
    --color-link: #60a5fa; --color-link-hover: #93c5fd;
    --color-background: #18181b; --color-background-alt: #27272a;
    --color-border: #3f3f46; --color-border-light: #3f3f46;
    --color-keyword-text: #93c5fd; --color-keyword-bg: #1e3a5f; --color-keyword-border: #1e3a5f;
    --color-reference-border: #fb923c;
    --color-bar-beginner: #ef4444; --color-bar-intermediate: #eab308;
    --color-bar-advanced: #22c55e; --color-bar-master: #34d399;
    --color-section-title-bg: #18181b;
  }
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
img { max-width: 100%; display: block; }
ul, ol { list-style: none; }
body, html { font-family: var(--font-family); font-size: 14px; color: var(--color-text); background-color: var(--color-background); font-weight: 400; line-height: var(--lh-base); text-align: left; }
p { display: block; }
a { color: var(--color-link); text-decoration: none; }
a:hover { color: var(--color-link-hover); text-decoration: underline; }
li { list-style-type: square; list-style-position: outside; margin-left: 1.3em; }
h1 { font-size: var(--fs-name); line-height: var(--lh-tight); }
h2 { font-size: var(--fs-label); line-height: var(--lh-snug); }
h3 { font-size: var(--fs-card); line-height: var(--lh-snug); }
em { color: var(--color-text-muted); }
strong { font-weight: 700; }
.icon-svg { width: 1em; height: 1em; vertical-align: -0.125em; }
.skip-to-content { position: absolute; left: -9999px; top: 0; z-index: 999; padding: 0.5em 1em; background: var(--color-accent); color: #fff; font-weight: 600; text-decoration: none; }
.skip-to-content:focus { left: 0; }
a:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; border-radius: 2px; }
.clear::after { content: ""; display: table; clear: both; }

/* Resume */
.resume { padding: 1.5rem; }

/* Basics */
.header { margin-bottom: var(--sp-5); }
.header .name { font-size: var(--fs-name); font-weight: 200; line-height: var(--lh-tight); letter-spacing: -0.015em; color: var(--color-heading); }
.header .label { color: var(--color-heading); font-size: var(--fs-label); font-weight: 300; line-height: var(--lh-snug); margin-top: var(--sp-1); margin-bottom: var(--sp-3); }
.header .location { color: var(--color-text-secondary); margin-bottom: var(--sp-2); display: block; }
.header .image { width: 11em; float: right; border-radius: 4px; }
.profiles { display: flex; flex-flow: row wrap; justify-content: flex-start; margin-top: var(--sp-1); gap: var(--sp-1) 0; }
.main-summary { background: var(--color-background-alt); padding: var(--sp-4); line-height: var(--lh-base); }

/* Contact */
.contact { display: flex; flex-flow: row wrap; justify-content: flex-start; margin-top: var(--sp-2); gap: 0 var(--sp-4); }
.contact-item { line-height: var(--lh-snug); }
.contact .icon { margin-right: 0.4em; color: var(--color-text-secondary); }

/* Social profile */
.profiles .item { padding: 0; margin-right: var(--sp-4); line-height: var(--lh-snug); }
.profiles .social { font-size: 1.1em; margin-right: 0.4em; color: var(--brand-light); }
@media (prefers-color-scheme: dark) { .profiles .social { color: var(--brand-dark); } }

/* Section header */
.section { margin-bottom: var(--sp-5); }
.section > header { position: relative; margin-bottom: var(--sp-3); }
.section > header::after { position: absolute; left: 0; top: 50%; height: 1px; background: var(--color-border); content: ""; width: 100%; z-index: 0; display: block; }
.item-count { margin-left: 0.5em; font-weight: 500; opacity: 0.65; }
.section-title { position: relative; z-index: 1; display: inline-block; background: var(--color-section-title-bg); padding-right: 0.85em; color: var(--color-accent); text-transform: uppercase; font-weight: 700; border: none; font-size: var(--fs-section); line-height: var(--lh-tight); letter-spacing: 0.12em; }

/* Timeline item */
.timeline-item { margin-top: var(--sp-4); }
.timeline-item:first-of-type { margin-top: 0; }
.timeline-item .position, .timeline-item .company, .timeline-item .organization, .timeline-item .institution,
.timeline-item .date, .timeline-item .area, .timeline-item .studyType, .timeline-item .title,
.timeline-item .awarder, .timeline-item .publisher, .timeline-item .issuer { display: inline; }
.timeline-item .position, .timeline-item .studyType, .timeline-item .area, .timeline-item .title { font-weight: 700; }
.timeline-item .company::before, .timeline-item .institution::before, .timeline-item .organization::before, .timeline-item .awarder::before { content: "at "; }
.timeline-item .company, .timeline-item .institution, .timeline-item .organization, .timeline-item .awarder { color: var(--color-text-secondary); font-weight: 400; }
.timeline-item .item { overflow: hidden; }
.timeline-item .location { display: block; margin-top: var(--sp-1); color: var(--color-text-secondary); font-weight: 500; font-size: var(--fs-meta); line-height: var(--lh-snug); }
.timeline-item .item .summary { margin-top: var(--sp-2); }
.timeline-item > header { font-size: var(--fs-title); position: relative; line-height: var(--lh-snug); margin-bottom: 0; }
.timeline-item header .date { display: block; font-size: var(--fs-meta); padding: 0; color: var(--color-text-secondary); font-weight: 500; line-height: var(--lh-snug); letter-spacing: 0.02em; }
.timeline-item .website, .timeline-item .url { display: block; margin-top: var(--sp-2); font-size: var(--fs-meta); line-height: var(--lh-snug); }
.timeline-item .website .icon-svg, .timeline-item .url .icon-svg { margin-right: 0.4em; color: var(--color-text-secondary); }
.gpa { clear: both; padding-bottom: 0.5em; }

/* Keyword list */
.keywords, .courses { margin: var(--sp-2) 0 0 0; }
.keywords li, .courses li { display: inline-block; margin: 2px 4px 2px 0; padding: 2px 6px; font-size: var(--fs-fine); line-height: 1.5; color: var(--color-keyword-text); background-color: var(--color-keyword-bg); border: 0 solid var(--color-keyword-border); border-radius: 3px; white-space: nowrap; }

/* Highlights */
.highlights { margin: var(--sp-2) 0 0 0; }
.highlights > li { margin-top: var(--sp-1); line-height: var(--lh-base); }
.highlights > li:first-child { margin-top: 0; }

/* Level bar */
.level { margin-bottom: 0.5em; }
.level em { padding-left: 0.2em; }
.level .bar { border: 1px solid var(--color-border-light); display: block; width: 10em; height: 5px; position: relative; }
.level .bar::after { position: absolute; content: " "; top: 0; left: 0; background: black; height: 5px; }
.level.beginner .bar::after { background: var(--color-bar-beginner); width: 2.5em; }
.level.intermediate .bar::after { background: var(--color-bar-intermediate); width: 5em; }
.level.advanced .bar::after, .level.fluent .bar::after { background: var(--color-bar-advanced); width: 7.5em; }
.level.master .bar::after, .level.expert .bar::after { background: var(--color-bar-master); width: 10em; }

/* Grids (skills, languages, interests) */
.skills-grid, .languages-grid, .interests-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: var(--sp-5); row-gap: var(--sp-3); }
.skill-item, .language-item, .interest-item { padding: 0; border-bottom: none; }
.skill-item .name, .languages-grid .language, .interest-item .name { font-weight: 700; font-size: var(--fs-card); line-height: var(--lh-snug); color: var(--color-heading); margin-bottom: var(--sp-1); }
.display { display: block; opacity: 1 !important; }

/* References */
.reference-item { padding-left: var(--sp-3); margin-bottom: var(--sp-4); border-left: 3px solid var(--color-reference-border); }
.reference-item .reference { font-style: italic; color: var(--color-text); line-height: var(--lh-base); margin-bottom: var(--sp-1); }
.reference-item .name { font-weight: 700; font-size: var(--fs-meta); color: var(--color-text-secondary); }
.reference-item .name::before { content: "— "; }

@media screen and (max-width: 479px) {
  .skills-grid, .languages-grid, .interests-grid { grid-template-columns: 1fr; }
}
@media screen and (min-width: 480px) and (max-width: 601px) {
  .skills-grid, .languages-grid, .interests-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media screen and (max-width: 601px) {
  .resume { width: 100%; padding: 1rem; box-sizing: border-box; }
  .header .profiles, .header .contact { flex-wrap: wrap; }
  .header .name { font-size: 1.857rem; }
  .header .label { font-size: 1.286rem; }
  .header .image { float: none; display: block; margin: 0 auto 1rem; width: 8em; }
  .section > section > header { font-size: 1.071rem; }
  .timeline-item header .date { float: none; margin-top: var(--sp-1); }
}
@media screen and (min-width: 602px) {
  .resume { width: 80%; margin: 0 auto; }
  .timeline-item header .date { float: right; padding-top: 0.2em; }
}
@media screen and (min-width: 1025px) {
  .resume { width: 820px; margin: 2rem auto; }
  li { margin-left: 1.5em; }
  .section > section > .timeline-item, .section > section:not(.main-summary):not(.skills-grid):not(.languages-grid):not(.interests-grid):not(.references-list) { margin-left: 1.67rem; }
  .timeline-item .company::before, .timeline-item .institution::before, .timeline-item .organization::before, .timeline-item .awarder::before { content: "| "; }
  .timeline-item .header-left { float: left; width: 70%; word-break: normal; }
}

@media print {
  @page { margin: 1.4cm 1.4cm; }
  body { line-height: var(--lh-snug); }
  ul { margin-top: var(--sp-2); }
  ul, li { padding: 0; }
  .resume { margin: 0.1em; padding: 0.1em; word-wrap: break-word; line-height: 1.25; width: auto; }
  .skip-to-content { display: none; }
  .header { margin-bottom: var(--sp-4); }
  .profiles a:not(.hide-href-print)::after { content: " · " attr(href); font-size: var(--fs-fine); color: var(--color-text-muted); font-weight: 400; margin-left: 0.2em; }
  .profiles .url .show-only-url-print { display: none; }
  .profiles .url a::after { content: attr(href); }
  .profiles .item { padding: 0; }
  .profiles .social { color: #828386; }
  .main-summary { padding: 0; background: transparent; }
  .section { margin-bottom: var(--sp-4); padding: 0; }
  .section > header { margin-bottom: var(--sp-2); }
  .section > header::after { background: #d8d8d8; height: 0.5px; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .section > section > section { margin: var(--sp-3) 0; }
  .section > section > section:last-of-type { margin-bottom: 0; }
  .item-count { display: none; }
  .timeline-item { margin-top: var(--sp-3); }
  .timeline-item .company a { color: var(--color-text); }
  .timeline-item header .date { float: right; padding-top: 0.2em; }
  .section p { margin: 0; padding: 0; }
  .keywords, .courses { margin: var(--sp-2) 0 0 0; }
  .keywords li, .courses li { margin: 0; padding: 0; font-size: var(--fs-meta); background: transparent; line-height: var(--lh-snug); }
  .keywords li::after, .courses li::after { padding: 0 0.4em; content: "·"; color: var(--color-text-muted); }
  .keywords li:last-of-type::after, .courses li:last-of-type::after { content: ""; }
  ul.keywords::before { content: "Skills: "; font-size: var(--fs-body); font-weight: 600; }
  ul.courses::before { content: "Major courses: "; font-size: var(--fs-body); font-weight: 600; }
  .skills-grid ul.keywords::before { content: none; }
  .skills-grid .keywords { font-size: var(--fs-meta); margin: 0; }
  .skills-grid { column-gap: var(--sp-4); row-gap: var(--sp-3); }
  .skills-grid .skill-item { display: flex; flex-direction: column; margin: 0; padding: 0; }
  .highlights { margin: var(--sp-2) 0 0 0; }
  .highlights > li { margin-top: var(--sp-1); line-height: var(--lh-snug); }
  .highlights > li > p { margin-bottom: var(--sp-1); }
  .level { margin: 0.1rem 0; font-weight: 400; }
  .level em { font-style: normal; padding: 0.1em 0; }
  .level .bar { display: none; }
}
`;

// ============================================================================
// HELPERS
// ============================================================================

const EN_GB_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const MY = (value) => formatDate(value, "MMM YYYY", { monthsShort: EN_GB_SHORT });
const svg = (name) => icon(name, { className: "icon-svg" });
const formatted = (value) => (has(value) ? markdownLite(value).replace(/<p>/g, '<p style="margin:0">') : "");

const BRAND_COLORS = {
  "google-plus": "#dd4b39", tumblr: "#32506d", foursquare: "#0072b1", facebook: "#3b5998",
  linkedin: "#007bb6", pinterest: "#cb2027", dribbble: "#ea4c89", instagram: "#517fa4",
  twitter: "#00aced", soundcloud: "#ff3a00", wordpress: "#21759b", youtube: "#bb0000",
  github: "#171515", "stack-overflow": "#828386", flickr: "#ff0084", reddit: "#ff4500",
  "hacker-news": "#ff6600", telegram: "#2291c3",
};
const DARK_BRAND_COLORS = { github: "#c9d1d9", tumblr: "#5a8aab" };

const LEVELS = {
  beginner: "beginner", novice: "beginner", "entry level": "beginner", "entry-level": "beginner", junior: "beginner",
  elementary: "beginner", basic: "beginner", fundamental: "beginner", starter: "beginner",
  intermediate: "intermediate", moderate: "intermediate", "mid-level": "intermediate", mid: "intermediate",
  competent: "intermediate", proficient: "intermediate", "working knowledge": "intermediate", "limited working": "intermediate",
  advanced: "advanced", senior: "advanced", experienced: "advanced", "highly proficient": "advanced",
  "professional working": "advanced", "full professional": "advanced", fluent: "advanced", strong: "advanced",
  master: "master", expert: "master", "native speaker": "master", native: "master", "native or bilingual": "master",
  mastery: "master", lead: "master", principal: "master", specialist: "master", authority: "master",
};

function normalizeLevel(level) {
  const lower = text(level).toLowerCase().trim();
  if (LEVELS[lower]) return LEVELS[lower];
  for (const [key, tier] of Object.entries(LEVELS)) {
    if (lower.includes(key) || key.includes(lower)) return tier;
  }
  return lower.replace(/[^a-z0-9 -]/g, "");
}

// ============================================================================
// COMPONENTS
// ============================================================================

function sectionHeader(title, count, children) {
  return `<section class="section"><header><h2 class="section-title">${title}${count !== undefined ? ` <span class="item-count">(${count})</span>` : ""}</h2></header>${children}</section>`;
}

function keywordList(keywords, cssClass = "keywords") {
  const values = textList(keywords);
  return values.length ? `<ul class="${cssClass}">${values.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : "";
}

function highlightsList(highlights) {
  const values = textList(highlights);
  return values.length ? `<ul class="highlights">${values.map((h) => `<li>${formatted(h)}</li>`).join("")}</ul>` : "";
}

function levelBar(level, name = "") {
  const normalized = normalizeLevel(level);
  const valueNow = normalized === "beginner" ? 25 : normalized === "intermediate" ? 50 : normalized === "advanced" || normalized === "fluent" ? 75 : 100;
  const label = `${has(name) ? `${text(name)} level: ` : ""}${text(level)}`;
  return `<div class="level ${esc(normalized)}" role="meter" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${valueNow}"><em>${esc(level)}</em><div class="bar" aria-hidden="true"></div></div>`;
}

function timelineItem({ title = "", subtitle = "", subtitleClass = "company", url = "", startDate, endDate, singleDate, summary, highlights, keywords, location, children = "" }) {
  let date = "";
  if (has(startDate)) {
    date = `<div class="date"><span class="startDate">${esc(MY(startDate))}</span> <span class="endDate">- ${has(endDate) ? esc(MY(endDate)) : "Current"}</span></div>`;
  } else if (has(singleDate)) {
    date = `<div class="date">${esc(singleDate)}</div>`;
  }
  const safe = safeUrl(url);
  const sub = has(subtitle)
    ? `<div class="${subtitleClass}">${safe ? `<a target="_blank" rel="noopener" href="${esc(safe)}">${esc(subtitle)}</a>` : esc(subtitle)}</div>`
    : "";
  let loc = "";
  if (typeof location === "string" && has(location)) {
    loc = `<span class="location">${svg("map-pin")} ${esc(location)}</span>`;
  } else if (location && typeof location === "object") {
    const parts = [
      has(location.city) ? `<span class="city">${esc(location.city)}</span>` : "",
      has(location.countryCode) ? `<span class="countryCode">(${esc(location.countryCode)})</span>` : "",
      has(location.region) ? `<span class="region">${esc(location.region)}</span>` : "",
    ].filter(Boolean);
    if (parts.length) loc = `<span class="location">${svg("map-pin")} ${parts.join(" ")}</span>`;
  }
  const body = `${has(summary) ? `<div class="summary">${formatted(summary)}</div>` : ""}${highlightsList(highlights)}`;
  return `<section class="timeline-item"><header class="clear">${date}<div class="header-left">${has(title) ? `<div class="position">${esc(title)}</div>` : ""}${sub}</div></header>${loc}${keywordList(keywords)}${children}${body ? `<div class="item">${body}</div>` : ""}</section>`;
}

function basicsBlock(basics) {
  const img = safeUrl(basics.image);
  const names = `<h1 class="name">${esc(basics.name)}</h1>${has(basics.label) ? `<h2 class="label">${esc(basics.label)}</h2>` : ""}`;
  const loc = basics.location;
  const locParts = [
    has(loc.address) ? `<span>${esc(loc.address)},</span>` : "",
    has(loc.postalCode) ? `<span>${esc(loc.postalCode)},</span>` : "",
    has(loc.city) ? `<span>${esc(loc.city)},</span>` : "",
    has(loc.region) ? `<span>${esc(loc.region)}</span>` : "",
    has(loc.countryCode) ? `<span>(${esc(loc.countryCode)})</span>` : "",
  ].filter(Boolean);

  const contactItems = [];
  if (has(basics.email)) contactItems.push(`<div class="contact-item">${icon("mail", { className: "icon-svg icon" })}<a class="hide-href-print" href="${esc(mailto(basics.email))}">${esc(basics.email)}</a></div>`);
  if (has(basics.phone)) contactItems.push(`<div class="contact-item">${icon("smartphone", { className: "icon-svg icon" })}<a class="hide-href-print" href="${esc(tel(basics.phone))}">${esc(basics.phone)}</a></div>`);
  const site = safeUrl(basics.url);
  if (site) contactItems.push(`<div class="contact-item">${icon("external-link", { className: "icon-svg icon" })}<a class="hide-href-print" target="_blank" rel="noopener" href="${esc(site)}">${esc(site)}</a></div>`);

  const profiles = basics.profiles.filter((p) => has(p.network)).map((profile) => {
    const network = text(profile.network).trim().toLowerCase().replace(/\s+/g, "-");
    const light = BRAND_COLORS[network] || "inherit";
    const dark = DARK_BRAND_COLORS[network] || light;
    const glyph = icon(networkIcon(network, "user"), { className: "icon-svg social" }).replace("<svg", `<svg style="--brand-light: ${light}; --brand-dark: ${dark}"`);
    const url = safeUrl(profile.url);
    const body = url
      ? `<span class="url"><a target="_blank" rel="noopener" href="${esc(url)}"><span class="show-only-url-print">${esc(profile.username || url)}</span></a></span>`
      : `<span>${esc(profile.username)}</span>`;
    return `<div class="item"><div class="username">${glyph}${body}</div></div>`;
  });

  const header = `<header class="header clear">
      ${img ? `<img class="image" src="${esc(img)}" alt="${esc(basics.name)}"><div class="middle">${names}</div>` : `<div>${names}</div>`}
      ${locParts.length ? `<span class="location">${locParts.join(" ")}</span>` : ""}
      ${contactItems.length ? `<div class="contact">${contactItems.join("")}</div>` : ""}
      ${profiles.length ? `<nav class="profiles" aria-label="Social profiles">${profiles.join("")}</nav>` : ""}
    </header>`;
  const summary = has(basics.summary)
    ? sectionHeader("Summary", undefined, `<section class="main-summary"><div>${formatted(basics.summary)}</div></section>`)
    : "";
  return header + summary;
}

function grid(title, entries, cssClass, renderItem) {
  const items = entries.map(renderItem).filter(Boolean);
  return items.length ? sectionHeader(title, items.length, `<section class="${cssClass}">${items.join("")}</section>`) : "";
}

function timeline(title, id, entries, mapItem) {
  if (!entries.length) return "";
  return sectionHeader(title, entries.length, `<section id="${id}">${entries.map((entry) => timelineItem(mapItem(entry))).join("")}</section>`);
}

const SECTIONS = {
  basics: (r) => basicsBlock(r.basics),
  skills: (r) => grid("Skills", r.skills, "skills-grid", (skill) => {
    if (!has(skill.name) && !has(skill.level) && !textList(skill.keywords).length) return "";
    return `<div class="skill-item">${has(skill.name) ? `<h3 class="name">${esc(skill.name)}</h3>` : ""}${has(skill.level) ? levelBar(skill.level, skill.name) : ""}${keywordList(skill.keywords)}</div>`;
  }),
  work: (r) => timeline("Work Experience", "work", r.work, (job) => ({
    title: job.position, subtitle: job.name, subtitleClass: "company", url: job.url,
    startDate: job.startDate, endDate: job.endDate, summary: job.summary,
    highlights: job.highlights, keywords: job.keywords, location: job.location,
  })),
  projects: (r) => timeline("Projects", "projects", r.projects, (project) => {
    const url = safeUrl(project.url);
    return {
      title: project.name, startDate: project.startDate, endDate: project.endDate,
      summary: project.description, highlights: project.highlights, keywords: project.keywords, location: project.location,
      children: url ? `<span class="website">${svg("external-link")}<a target="_blank" rel="noopener" href="${esc(url)}">${esc(url)}</a></span>` : "",
    };
  }),
  volunteer: (r) => timeline("Volunteer", "volunteer", r.volunteer, (vol) => ({
    title: vol.position, subtitle: vol.organization, subtitleClass: "organization", url: vol.url,
    startDate: vol.startDate, endDate: vol.endDate, summary: vol.summary,
    highlights: vol.highlights, keywords: vol.keywords, location: vol.location,
  })),
  education: (r) => timeline("Education", "education", r.education, (edu) => ({
    title: [edu.studyType, edu.area].map(text).filter(Boolean).join(" "),
    subtitle: edu.institution, subtitleClass: "institution", url: edu.url,
    startDate: edu.startDate, endDate: edu.endDate, summary: edu.summary, location: edu.location,
    children: `${keywordList(edu.courses, "courses")}${has(edu.score) ? `<div class="gpa"><strong> Grade:</strong> <span>${esc(edu.score)}</span></div>` : ""}`,
  })),
  awards: (r) => timeline("Awards", "awards", r.awards, (award) => ({
    title: award.title, subtitle: award.awarder, subtitleClass: "awarder",
    singleDate: has(award.date) ? MY(award.date) : undefined, summary: award.summary,
  })),
  certificates: (r) => timeline("Certificates", "certificates", r.certificates, (cert) => {
    const url = safeUrl(cert.url);
    return {
      title: cert.name, subtitle: cert.issuer, subtitleClass: "issuer",
      singleDate: has(cert.date) ? MY(cert.date) : undefined,
      children: url ? `<span class="url">${svg("external-link")}<a target="_blank" rel="noopener" href="${esc(url)}">${esc(url)}</a></span>` : "",
    };
  }),
  publications: (r) => timeline("Publications", "publications", r.publications, (pub) => ({
    title: pub.name, subtitle: has(pub.publisher) ? `in ${text(pub.publisher)}` : "", subtitleClass: "publisher", url: pub.url,
    singleDate: has(pub.releaseDate) ? MY(pub.releaseDate) : undefined, summary: pub.summary, keywords: pub.keywords,
  })),
  languages: (r) => grid("Languages", r.languages, "languages-grid", (lang) => {
    if (!has(lang.language) && !has(lang.fluency)) return "";
    return `<div class="language-entry display">${has(lang.language) ? `<h3 class="language">${esc(lang.language)}</h3>` : ""}<div class="language-item">${has(lang.fluency) ? levelBar(lang.fluency) : ""}</div></div>`;
  }),
  interests: (r) => grid("Interests", r.interests, "interests-grid", (interest) => {
    if (!has(interest.name) && !textList(interest.keywords).length && !has(interest.summary)) return "";
    return `<div class="interest-item">${has(interest.name) ? `<h3 class="name">${esc(interest.name)}</h3>` : ""}${keywordList(interest.keywords)}${has(interest.summary) ? `<div class="summary">${formatted(interest.summary)}</div>` : ""}</div>`;
  }),
  references: (r) => grid("References", r.references, "references-list", (ref) => {
    if (!has(ref.name) && !has(ref.reference)) return "";
    return `<div class="reference-item">${has(ref.reference) ? `<blockquote class="reference">&#8220; ${esc(ref.reference)} &#8221;</blockquote>` : ""}${has(ref.name) ? `<div class="name">${esc(ref.name)}</div>` : ""}</div>`;
  }),
};

const DEFAULT_ORDER = ["basics", "skills", "work", "projects", "volunteer", "education", "awards", "certificates", "publications", "languages", "interests", "references"];

// ============================================================================
// DOCUMENT
// ============================================================================

function render(input) {
  const resume = normalizeResume(input);
  const custom = resume.meta?.theme?.sectionOrder;
  const order = Array.isArray(custom) && custom.length ? custom.filter((s) => DEFAULT_ORDER.includes(s)) : DEFAULT_ORDER;
  return `<!doctype html>
<html lang="en-gb">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(resume.basics.name) || "Resume"}</title>
    <style>${CSS}</style>
  </head>
  <body>
    <a class="skip-to-content" href="#resume">Skip to content</a>
    <main id="resume" class="resume">
      ${order.map((key) => SECTIONS[key](resume)).join("\n")}
    </main>
  </body>
</html>`;
}

export default { name: "stackoverflow", label: "Stack Overflow", render };
