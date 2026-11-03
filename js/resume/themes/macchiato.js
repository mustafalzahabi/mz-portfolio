// ============================================================================
// THEME: macchiato
// Native port of jsonresume-theme-macchiato@1.1.0
// (https://github.com/biosan/jsonresume-theme-macchiato). Handlebars partials
// are reproduced as string templates; Font Awesome 4.7 is replaced by inline
// SVGs. Dates use the original moment "MM/YYYY" format. A small-screen rule
// (not in the original) lets the fixed 612px page reflow on phones.
// ============================================================================

import {
  escapeHtml as esc, has, text, textList, safeUrl, mailto, stripProtocol, formatDate,
  icon, networkIcon, normalizeResume, joinNonEmpty,
} from "../helpers.js";

// ============================================================================
// STYLES
// ============================================================================

const CSS = `
html {
  background: white;
}
body {
  font-family: "Lato", Helvetica, Arial, sans-serif;
  font-weight: 400;
  background: white;
  margin: 50px 0 100px;
  letter-spacing: .3px;
  color: #39424B;
}
h1, h2, h3, h4, h5, h6 {
  text-transform: none;
  margin: 0;
}
h1 {
  font-family: "Josefin Sans", Helvetica, Arial, sans-serif;
  font-weight: 700;
  font-size: 40px;
  letter-spacing: 1px;
}
h2 {
  font-family: "Josefin Sans", Helvetica, Arial, sans-serif;
  font-weight: 300;
  font-size: 16px;
  letter-spacing: .5px;
}
h3 {
  font-family: "Lato", Helvetica, Arial, sans-serif;
  font-weight: 300;
  font-size: 14px;
  letter-spacing: .4px;
}
h3.bold { font-weight: 700; }
h4 {
  font-family: "Lato", Helvetica, Arial, sans-serif;
  font-weight: 300;
  font-size: 12px;
}
h4.bold { font-weight: 700; }
h5 {
  font-family: "Lato", Helvetica, Arial, sans-serif;
  font-weight: 300;
  font-size: 11px;
}
h5.italic { font-style: italic; }
h6 {
  font-family: "Lato", Helvetica, Arial, sans-serif;
  font-weight: 400;
  font-size: 10px;
}
a {
  color: inherit;
  text-decoration: inherit;
}
a:hover { color: #2895F1; }
p, li { font-size: 11px; }
blockquote {
  font-size: 11px;
  font-family: "Lato", Helvetica, Arial, sans-serif;
  font-weight: 400;
  font-style: italic;
  margin: 10px 25px;
}
em { color: #999; }
ul {
  margin: 10px 0 0;
  padding-inline-start: 25px;
}
ul li { padding-left: 10px; }
ul.minimal {
  list-style: none;
  padding: 0;
}
ul.minimal li {
  margin-bottom: 3px;
  padding-left: 0;
}
ul.two-column {
  column-count: 2;
  column-gap: 28px;
}
ul.two-column li { padding-left: 0; }
@page { size: A4; }
.container { padding-top: 20px; }
.keyline {
  width: 45px;
  margin: 8px 0 10px;
  border-top: 1px solid #56817A;
}
.pull-left { float: left; }
.pull-right { float: right; }
.clearfix:after {
  content: "";
  display: table;
  clear: both;
}
.profile-pic {
  margin-top: -5px;
  margin-right: 18px;
}
.profile-pic img {
  height: 52px;
  width: 52px;
  border-radius: 50%;
  border: 2px solid #56817A;
  object-fit: cover;
}
.summary { margin: 5px 0 5px; }
.sublink {
  font-size: 70%;
  font-weight: 200;
  color: dimgray;
}
.capitalize { text-transform: capitalize; }
.page {
  background: white;
  width: 612px;
  min-height: 792px;
  display: block;
  margin: 0 auto;
  border-top: 10px solid #56817A;
  padding: 36px 22px 30px 34px;
  box-shadow: 0 1px 10px rgba(0, 0, 0, 0.5);
}
.page:after {
  content: "";
  display: table;
  clear: both;
}
.left-column {
  float: left;
  width: 160px;
  margin-right: 20px;
  word-wrap: break-word;
}
.right-column {
  width: auto;
  overflow: hidden;
}
.item { margin-bottom: 15px; }
.item:last-child { margin-bottom: 0; }
.info-tag-container { margin-bottom: 5px; }
.info-tag-container .fa {
  width: 12px;
  height: 12px;
  margin-right: 5px;
  vertical-align: middle;
}
.info-tag-container .info-text {
  font-size: 12px;
  text-transform: none;
  display: inline-block;
  vertical-align: middle;
  width: 139px;
}
.references-container .fa {
  width: 14px;
  height: 14px;
  margin-right: 6px;
}
.education-container .location {
  padding-bottom: 6px;
  font-weight: 400;
}
.education-container .specialization {
  text-transform: none;
  font-style: italic;
}
.flex-container {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}
.main-skill { font-size: 80%; }
.skill {
  margin: .15em;
  padding: .15em;
  background: ghostwhite;
  border-radius: 5px;
}
@media screen and (max-width: 660px) {
  body { margin: 0; }
  .page { width: auto; min-height: 0; padding: 24px 16px; box-shadow: none; }
  .left-column { float: none; width: auto; margin-right: 0; }
}
@media print {
  body { margin: 0; }
  .page {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 36px 0 30px;
    box-shadow: none;
  }
  .page .resume-header,
  .page .resume-content {
    padding: 0 22px 0 34px;
  }
  .container { page-break-inside: avoid; }
  .work-container .item { page-break-inside: avoid; }
}
`;

const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Josefin+Sans:300,700|Lato:300,300i,400,400i,700,700i&display=swap">`;

// ============================================================================
// PARTIALS
// ============================================================================

const formatDateMY = (value) => formatDate(value, "MM/YYYY");

const title = (value) => `<div class="title"><h3>${esc(value)}</h3><div class="keyline"></div></div>`;

function infoTag({ textValue, iconName, url = "", isEmail = false }) {
  const glyph = iconName ? icon(iconName, { className: "fa" }) : "";
  const target = isEmail ? mailto(url) : safeUrl(url);
  const body = target
    ? `<h6 class="info-text"><a href="${esc(target)}" target="_blank" rel="noopener">${esc(stripProtocol(textValue))}</a></h6>`
    : `<h6 class="info-text">${esc(textValue)}</h6>`;
  return `<div class="info-tag-container">${glyph}${body}</div>`;
}

function sectionHeader(item, { name, website = "", showWebsite = false }) {
  const safe = safeUrl(website);
  let heading = "";
  if (has(name)) {
    const inner = safe
      ? `<a href="${esc(safe)}" target="_blank" rel="noopener">${esc(name)}</a>${showWebsite ? ` <span class="sublink">∙ <a href="${esc(safe)}" target="_blank" rel="noopener" class="sublink">${esc(safe)}</a></span>` : ""}`
      : esc(name);
    heading = `<h3 class="bold pull-left">${inner}</h3>`;
  }
  let dates = "";
  if (has(item.startDate)) {
    dates = `<span class="startDate">${esc(formatDateMY(item.startDate))}</span><span class="endDate"> - ${has(item.endDate) ? esc(formatDateMY(item.endDate)) : "Present"}</span>`;
  } else if (has(item.releaseDate)) {
    dates = esc(formatDateMY(item.releaseDate));
  }
  const description = has(item.description) ? `<h4>${esc(item.description)}</h4>` : "";
  return `<div class="section-header clearfix">${heading}${dates ? `<h5 class="italic pull-right">${dates}</h5>` : ""}</div>${description}`;
}

function bulletList(items) {
  const values = textList(items);
  return values.length ? `<ul>${values.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>` : "";
}

function skillTags(items, className = "skill") {
  const values = textList(items);
  return values.length ? `<div class="flex-container">${values.map((k) => `<h6 class="${className}">${esc(k)}</h6>`).join("")}</div>` : "";
}

function container(className, heading, items) {
  if (!items.length) return "";
  return `<div class="container ${className}">${title(heading)}${items.join("")}</div>`;
}

function header(basics) {
  const img = safeUrl(basics.image);
  return `<header class="resume-header clearfix">
      <div class="profile-header pull-left">
        <h1>${esc(basics.name)}</h1>
        ${has(basics.label) ? `<h2>${esc(basics.label)}</h2>` : ""}
      </div>
      <div class="profile-pic pull-right">${img ? `<img src="${esc(img)}" alt="profile-pic">` : ""}</div>
    </header>`;
}

function about(basics) {
  const tags = [];
  const loc = basics.location;
  const address = joinNonEmpty([loc.address, loc.city, loc.region, loc.postalCode, loc.countryCode], " ");
  if (address) tags.push(infoTag({ textValue: address, iconName: "map-pin" }));
  if (has(basics.birthday)) tags.push(infoTag({ textValue: `Born in ${text(basics.birthday)}`, iconName: "calendar" }));
  if (has(basics.email)) tags.push(infoTag({ textValue: basics.email, iconName: "mail", isEmail: true, url: basics.email }));
  if (has(basics.phone)) tags.push(infoTag({ textValue: basics.phone, iconName: "smartphone" }));
  if (has(basics.url) && safeUrl(basics.url)) tags.push(infoTag({ textValue: basics.url, iconName: "globe", url: basics.url }));
  for (const profile of basics.profiles) {
    if (!has(profile.network) || !has(profile.username)) continue;
    tags.push(infoTag({ textValue: profile.username, iconName: networkIcon(profile.network, "user") }));
  }
  return container("about-container", "About", tags);
}

function skills(entries) {
  const items = entries.filter((s) => has(s.name) || has(s.level) || textList(s.keywords).length).map((skill) => (
    `<section class="container">${has(skill.name) ? title(skill.name) : ""}${has(skill.level) ? `<h4 class="bold capitalize">${esc(skill.level)}</h4>` : ""}${textList(skill.keywords).length ? `<div class="minimal flex-container">${textList(skill.keywords).map((k) => `<h6 class="main-skill skill">${esc(k)}</h6>`).join("")}</div>` : ""}</section>`
  ));
  return items.length ? `<div class="skills-container">${items.join("")}</div>` : "";
}

function languages(entries) {
  const items = entries.filter((l) => has(l.language)).map((l) => `<li><h6>${esc(l.language)} ${has(l.fluency) ? `<em>(${esc(l.fluency)})</em>` : ""}</h6></li>`);
  return items.length ? `<div class="container languages-container">${title("Languages")}<ul class="minimal">${items.join("")}</ul></div>` : "";
}

function interests(entries) {
  return container("interests-container", "Interests", entries.filter((i) => has(i.name) || textList(i.keywords).length).map((interest) => {
    const keywords = textList(interest.keywords);
    return `<section class="item">${has(interest.name) ? `<h4 class="bold">${esc(interest.name)}</h4>` : ""}${keywords.length ? `<ul class="minimal">${keywords.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}</section>`;
  }));
}

function summary(basics) {
  return has(basics.summary) ? `<div class="container summary-container">${title("Summary")}<p class="summary">${esc(basics.summary)}</p></div>` : "";
}

function work(entries) {
  return container("work-container", "Experience", entries.map((item) => (
    `<section class="item">${sectionHeader(item, { name: item.name, website: item.url })}${has(item.position) ? `<h4>${esc(item.position)}</h4>` : ""}${skillTags(item.keywords)}${has(item.summary) ? `<p class="summary">${esc(item.summary)}</p>` : ""}${bulletList(item.highlights)}</section>`
  )));
}

function projects(entries) {
  return container("project-container", "Open Source Projects", entries.map((item) => {
    const role = has(item.role) ? text(item.role) : textList(item.roles).join(", ");
    return `<section class="item">${sectionHeader(item, { name: item.name, website: item.url, showWebsite: true })}${role ? `<h5>${esc(role)}</h5>` : ""}${skillTags(item.keywords)}${has(item.summary) ? `<p class="summary">${esc(item.summary)}</p>` : ""}${bulletList(item.highlights)}</section>`;
  }));
}

function education(entries) {
  return container("education-container", "Education", entries.map((item) => {
    const degree = joinNonEmpty([item.studyType, item.area], " ");
    const courses = textList(item.courses);
    return `<section class="item">${sectionHeader(item, { name: item.institution })}${has(item.location) ? `<h5 class="location">${esc(item.location)}</h5>` : ""}${degree ? `<h4>${esc(degree)}</h4>` : ""}${has(item.score) ? `<h5>${esc(item.score)}</h5>` : ""}${has(item.specialization) ? `<h5 class="specialization">${esc(item.specialization)}</h5>` : ""}${courses.length ? `<ul class="two-column">${courses.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}</section>`;
  }));
}

function volunteer(entries) {
  return container("volunteer-container", "Volunteer", entries.map((item) => (
    `<section class="item">${sectionHeader(item, { name: item.organization, website: item.url, showWebsite: true })}${has(item.position) ? `<h5>${esc(item.position)}</h5>` : ""}${has(item.summary) ? `<p class="summary">${esc(item.summary)}</p>` : ""}${bulletList(item.highlights)}</section>`
  )));
}

function awards(entries) {
  return container("awards-container", "Awards", entries.map((item) => (
    `<section class="item">${sectionHeader({}, { name: item.title })}${has(item.awarder) ? `<h5 class="awarder">${esc(item.awarder)}</h5>` : ""}${has(item.summary) ? `<p class="summary">${esc(item.summary)}</p>` : ""}</section>`
  )));
}

function publications(entries) {
  return container("publications-container", "Publications", entries.map((item) => (
    `<section class="item">${sectionHeader({ releaseDate: item.releaseDate }, { name: item.name })}${has(item.publisher) ? `<h5 class="awarder">${esc(item.publisher)}</h5>` : ""}${has(item.summary) ? `<p class="summary">${esc(item.summary)}</p>` : ""}</section>`
  )));
}

function references(entries) {
  return container("references-container", "References", entries.filter((r) => has(r.name) || has(r.reference)).map((item) => (
    `<section class="item clearfix">${has(item.reference) ? `${icon("quote", { className: "fa pull-left" })}<blockquote>${esc(item.reference)}</blockquote>` : ""}${has(item.name) ? `<h5 class="pull-right"> — ${esc(item.name)}</h5>` : ""}</section>`
  )));
}

// ============================================================================
// DOCUMENT
// ============================================================================

function render(input) {
  const resume = normalizeResume(input);
  const { basics } = resume;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(basics.name) || "Resume"}</title>
  ${FONTS}
  <style>${CSS}</style>
</head>
<body>
  <main id="resume" class="page">
    ${header(basics)}
    <div class="resume-content">
      <aside class="left-column">
        ${about(basics)}
        ${skills(resume.skills)}
        ${languages(resume.languages)}
        ${interests(resume.interests)}
      </aside>
      <div class="right-column">
        ${summary(basics)}
        ${work(resume.work)}
        ${projects(resume.projects)}
        ${education(resume.education)}
        ${volunteer(resume.volunteer)}
        ${awards(resume.awards)}
        ${publications(resume.publications)}
        ${references(resume.references)}
      </div>
    </div>
  </main>
</body>
</html>`;
}

export default { name: "macchiato", label: "Macchiato", render };
