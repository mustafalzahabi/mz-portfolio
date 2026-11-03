// ============================================================================
// THEME: professional
// Native port of jsonresume-theme-professional@1.1.0 (React + styled-components
// theme from the jsonresume.org monorepo,
// https://github.com/jsonresume/jsonresume.org/tree/master/packages/themes).
// Styled components are flattened into prefixed classes; react-icons are
// replaced by inline SVGs. Dates use the original "MMMM YYYY" (en-US) format.
// The LatinModern font is self-hosted by the registry only, so a Latin Modern
// / Computer Modern / Georgia fallback stack is used. The original has no
// print stylesheet; a minimal one is added.
// ============================================================================

import {
  escapeHtml as esc, has, text, textList, safeUrl, formatMonthYearLong, icon, normalizeResume,
} from "../helpers.js";

// ============================================================================
// STYLES
// ============================================================================

const CSS = `
html {
  font-family: LatinModern, "Latin Modern Roman", "CMU Serif", "Computer Modern Serif", Georgia, "Times New Roman", serif;
  background: #fff;
  font-size: 10px;
}
body { margin: 8px; color: #000; }
h2 { font-size: 1.65rem; }
p { padding: 0; margin: 0; }
p, li { font-size: 1.4rem; line-height: 1.5rem; }
.secondary { color: #111; }
a { text-decoration: none; }
ul { list-style: none; margin: 0; padding: 0; }
*, *::before, *::after { box-sizing: border-box; }

.pro-layout { max-width: 660px; margin: 0 auto; line-height: calc(1ex / 0.32); margin-bottom: 40px; }
.pro-section { max-width: 700px; margin: 0 auto 18px; }
.pro-section h2 { margin: 0; padding: 0; margin-bottom: 3px; font-weight: 600; }
.pro-section hr { margin: 0; padding: 0; margin-top: 7px; margin-bottom: 3px; }
.pro-section-body { margin: 0 8px; }

.pro-hero-title { font-size: 3rem; text-align: center; margin-top: 20px; margin-bottom: 20px; }
.pro-basic-info { display: flex; gap: 10px 20px; justify-content: center; flex-wrap: wrap; }
.pro-info { display: flex; align-items: center; font-size: 1.5rem; }
.pro-info svg { color: #000; margin-right: 5px; width: 10px; height: 10px; flex: none; }
.pro-info a { color: inherit; text-decoration: none; }
.pro-info a:hover { color: #000; }

.pro-experience { margin-bottom: 10px; }
.pro-meta { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 2px; }
.pro-title { font-weight: 600; font-size: 1.45rem; margin-bottom: 3px; }
.pro-subtitle { font-style: italic; font-size: 1.4rem; margin-bottom: 3px; }
.pro-summary { margin-bottom: 5px; }
.pro-date { font-style: italic; font-size: 1.4rem; white-space: nowrap; }
.pro-range { display: flex; font-style: italic; font-size: 13px; }

.pro-list { padding-left: 20px; line-height: 16px; }
.pro-list li::before { content: '•'; display: inline-block; width: 1em; margin-left: -1em; line-height: 10px; }

.pro-one-line { margin-bottom: 5px; display: flex; align-items: baseline; }
.pro-one-line-name { font-weight: 600; font-size: 1.4rem; flex: none; }
.pro-one-line-list { font-size: 1.4rem; margin-left: 5px; }

.pro-reference { margin-bottom: 15px; }
.pro-reference-name { font-weight: 600; font-size: 1.4rem; margin-bottom: 5px; }

@media (max-width: 480px) {
  .pro-meta { flex-direction: column; gap: 0; }
}
@media print {
  @page { margin: 1.5cm; }
  body { margin: 0; }
  .pro-layout { max-width: none; margin-bottom: 0; }
  .pro-experience, .pro-reference, .pro-one-line { break-inside: avoid; page-break-inside: avoid; }
  .pro-section h2 { break-after: avoid; page-break-after: avoid; }
  a { color: inherit; }
}
`;

// ============================================================================
// COMPONENTS
// ============================================================================

const dateText = (value) => `<div class="pro-date">${has(value) ? esc(formatMonthYearLong(value)) : "Present"}</div>`;

function section(title, children) {
  return `<div><div class="pro-section">${title ? `<h2>${title}</h2><hr />` : ""}<div class="pro-section-body">${children}</div></div></div>`;
}

function list(items) {
  const values = textList(items);
  return values.length ? `<ul class="pro-list">${values.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>` : "";
}

function experience({ title, subTitle, date, startDate, endDate, summary, highlights }) {
  let when = "";
  if (has(date)) when = dateText(date);
  else if (has(startDate)) when = `<div class="pro-range">${dateText(startDate)}&nbsp;—&nbsp;${dateText(endDate)}</div>`;
  return `<div class="pro-experience">
      <div class="pro-meta"><div class="pro-title">${esc(title)}</div><div class="secondary">${when}</div></div>
      ${has(subTitle) ? `<div class="pro-subtitle">${esc(subTitle)}</div>` : ""}
      <div class="secondary">${has(summary) ? `<p class="pro-summary">${esc(summary)}</p>` : ""}${list(highlights)}</div>
    </div>`;
}

function oneLine(name, items) {
  const values = textList(items);
  if (!has(name) && !values.length) return "";
  return `<div class="pro-one-line"><div class="pro-one-line-name">${esc(name)}:</div><div class="pro-one-line-list"><div class="secondary">${esc(values.join(", "))}</div></div></div>`;
}

function hero(basics) {
  const { name, url, location, profiles, phone, email } = basics;
  const info = (iconName, inner) => `<div class="pro-info">${icon(iconName, { size: 10 })}${inner}</div>`;
  const find = (network) => profiles.find((p) => text(p.network).trim().toLowerCase() === network);
  const profileLink = (profile, base) => {
    if (!profile || !has(profile.username) && !safeUrl(profile.url)) return "";
    const target = safeUrl(profile.url) || safeUrl(`${base}${encodeURIComponent(text(profile.username).trim())}`);
    return `<a href="${esc(target)}">${esc(has(profile.username) ? profile.username : target)}</a>`;
  };
  const items = [];
  const place = [location.city, location.countryCode].map(text).filter((v) => v.trim()).join(", ");
  if (place) items.push(info("map-pin", esc(place)));
  if (has(email)) items.push(info("mail", esc(email)));
  if (has(phone)) items.push(info("phone", esc(phone)));
  const site = safeUrl(url);
  if (site) items.push(info("link", `<a href="${esc(site)}">${esc(site)}</a>`));
  const linkedin = profileLink(find("linkedin"), "https://linkedin.com/in/");
  if (linkedin) items.push(info("linkedin", linkedin));
  const github = profileLink(find("github"), "https://github.com/");
  if (github) items.push(info("github", github));
  const twitter = profileLink(find("twitter") || find("x"), "https://twitter.com/");
  if (twitter) items.push(info("twitter", twitter));
  return section("", `<div class="pro-hero-title">${esc(name)}</div><div class="secondary"><div class="pro-basic-info">${items.join("")}</div></div>`);
}

function block(title, entries, renderItem) {
  const items = entries.map(renderItem).filter(Boolean);
  return items.length ? section(title, items.join("")) : "";
}

// ============================================================================
// DOCUMENT
// ============================================================================

function render(input) {
  const resume = normalizeResume(input);
  const { basics } = resume;
  const body = [
    hero(basics),
    has(basics.summary) ? section("", `<div class="secondary"><p>${esc(basics.summary)}</p></div>`) : "",
    block("Education", resume.education, (e) => {
      let subTitle = has(e.area) ? [text(e.studyType), text(e.area)].filter(Boolean).join(" in ") : text(e.studyType);
      if (has(e.score)) subTitle = subTitle ? `${subTitle} (${text(e.score)})` : `(${text(e.score)})`;
      return experience({ title: e.institution, subTitle, startDate: e.startDate, endDate: e.endDate, highlights: e.courses });
    }),
    block("Experience", resume.work, (w) => experience({ title: w.position, subTitle: w.name, startDate: w.startDate, endDate: w.endDate, summary: w.summary, highlights: w.highlights })),
    block("Projects", resume.projects, (p) => experience({ title: p.name, startDate: p.startDate, endDate: p.endDate, summary: p.description, highlights: p.highlights })),
    block("Certificates", resume.certificates, (c) => experience({ title: c.name, subTitle: c.issuer, date: c.date })),
    block("Publications", resume.publications, (p) => experience({ title: p.name, subTitle: p.publisher, date: p.releaseDate, summary: p.summary })),
    block("Awards", resume.awards, (a) => experience({ title: a.title, subTitle: a.awarder, date: a.date, summary: a.summary })),
    block("Languages", resume.languages, (l) => oneLine(l.language, [l.fluency])),
    block("Skills", resume.skills, (s) => oneLine(s.name, s.keywords)),
    block("Interests", resume.interests, (i) => oneLine(i.name, i.keywords)),
    block("References", resume.references, (r) => (has(r.name) || has(r.reference)
      ? `<div class="pro-reference">${has(r.name) ? `<div class="pro-reference-name">${esc(r.name)}</div>` : ""}${has(r.reference) ? `<p>${esc(r.reference)}</p>` : ""}</div>`
      : "")),
  ].join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <title>${esc(basics.name) || "Resume"} - Resume</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>${CSS}</style>
</head>
<body><div class="pro-layout">${body}</div></body>
</html>`;
}

export default { name: "professional", label: "Professional", render };
