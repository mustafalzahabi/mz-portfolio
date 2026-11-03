// ============================================================================
// THEME: onepage
// Native port of jsonresume-theme-onepage@0.0.3
// (https://github.com/ainsleyc/jsonresume-theme-onepage). Like the original,
// summaries of work/volunteer/awards/publications are shown as the first
// highlight, courses are split into three columns and dates are shown raw.
// The original does not render projects, certificates or references.
// ============================================================================

import { escapeHtml as esc, has, text, textList, safeUrl, joinNonEmpty, normalizeResume } from "../helpers.js";

// ============================================================================
// STYLES
// ============================================================================

const CSS = `
body {
  background: #EEEEEE;
  font: 12px "Times New Roman", Times, sans-serif;
  line-height: 1.4;
  margin: 40px 0;
}
em { color: #999; }
p { line-height: 1.4; }
ul { margin-bottom: 0; }
li { margin-bottom: 2px; }
a { text-decoration: none; }
#resume {
  margin: 0 auto;
  max-width: 600px;
  padding: 80px 100px;
  background: #fff;
  border: 1px solid #ccc;
  box-shadow: 2px 2px 4px #aaa;
}
.coursesList {
  width: 28%;
  vertical-align: top;
  display: inline-block;
}
.largeFont { font-size: 20px; }
.smallFont { font-size: 12px; }
.sectionBlock {
  display: flex;
  width: 100%;
}
.sectionName {
  width: 18%;
  vertical-align: top;
  display: inline-block;
}
.sectionContent {
  width: 80%;
  vertical-align: top;
  display: inline-block;
}
.sectionContent ul {
  padding-left: 20px;
  margin-top: 6px;
  list-style-type: circle;
}
.sectionContent .title { font-weight: bold; }
.sectionContent .date { float: right; }
.sectionContent .separator { height: 14px; }
.sectionLine {
  border-style: dashed;
  border-width: 1px;
  border-color: #CFCFCF;
  margin-top: 10px;
  margin-bottom: 10px;
}
.divider {
  font-weight: bold;
  margin-left: 5px;
  margin-right: 5px;
}
.summary { margin-top: 6px; }
.skillBlock { margin-bottom: 4px; }
.jobBlock { page-break-inside: avoid; }
@media only screen and (max-width: 40em) {
  body {
    margin: 0;
    font-size: 14px;
  }
  #resume {
    margin: 0 auto;
    max-width: 600px;
    padding: 0.5em 1em;
    border: none;
  }
  .sectionBlock { flex-wrap: wrap; }
  .sectionContent { width: 100%; }
  .sectionContent .date { padding-right: 2em; }
  .sectionName { width: auto; }
  .largeFont { font-size: 20px; }
  .smallFont { font-size: 14px; }
}
@media print {
  body { background: #fff; margin: 0; }
  #resume {
    margin: 0 auto;
    max-width: 600px;
    padding: 0px 0px;
    border: 0px;
    background: #fff;
    box-shadow: none;
  }
  a { color: black; }
}
`;

// ============================================================================
// HELPERS
// ============================================================================

const COURSES_COLUMNS = 3;

/** Summary first, then highlights (the original's PREPEND_SUMMARY_CATEGORIES). */
const withSummary = (entry) => [...(has(entry.summary) ? [text(entry.summary)] : []), ...textList(entry.highlights)];

const separator = (index, total) => (index < total - 1 ? `<div class='separator'></div>` : "");

function highlights(items) {
  return items.length ? `<ul class='highlights'>${items.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : "";
}

function dateRange(start, end) {
  if (!has(start)) return "";
  return `<span class='date'>${esc(start)} &mdash; ${has(end) ? esc(end) : "Present"}</span>`;
}

function website(url) {
  const safe = safeUrl(url);
  return safe ? `<div class='website'><a href='${esc(safe)}'>${esc(safe)}</a></div>` : "";
}

function block(id, name, content, { lineInside = false } = {}) {
  if (!content) return "";
  const line = `<div class='sectionLine'></div>`;
  return `<div id='${id}' class="sectionBlock">
    <div class='sectionName'><span>${name}</span></div>
    <div class='sectionContent'>${content}</div>
    ${lineInside ? line : ""}
  </div>
  ${lineInside ? "" : line}`;
}

const titleLine = (a, b) => esc(joinNonEmpty([a, b], ", "));

// ============================================================================
// SECTIONS
// ============================================================================

function basicsBlock(basics) {
  const contact = [];
  if (has(basics.email)) contact.push(`<span class='email'>${esc(basics.email)}</span>`);
  if (has(basics.phone)) contact.push(`<span class='phone'>${esc(basics.phone)}</span>`);
  const address = joinNonEmpty([basics.location.city, basics.location.region, basics.location.countryCode]);
  if (address) contact.push(`<span class='address'>${esc(address)}</span>`);
  const profiles = basics.profiles.map((p) => safeUrl(p.url)).filter(Boolean)
    .map((url) => `<span class='url'><a href='${esc(url)}'>${esc(url)}</a></span>`);
  const divider = `<span class='divider'>|</span>`;
  return `<div id='nameBlock' class='largeFont'>
    <span class='name'>${esc(basics.name)}${has(basics.label) ? "," : ""}</span>
    ${has(basics.label) ? `<span class='label'>${esc(basics.label)}</span>` : ""}
  </div>
  <div id='basicsBlock' class='smallFont'>
    ${contact.length ? `<div class='contactBlock'>${contact.join(divider)}</div>` : ""}
    ${profiles.length ? `<div id='profilesBlock'>${profiles.join(divider)}</div>` : ""}
  </div>
  <div class='sectionLine'></div>`;
}

function work(entries) {
  return entries.map((job, i) => `
      <div class="jobBlock">
        <div class='blockHeader'>
          <span class='title'>${titleLine(job.name, job.position)}</span>
          ${dateRange(job.startDate, job.endDate)}
        </div>
        ${website(job.url)}
        ${highlights(withSummary(job))}
        ${separator(i, entries.length)}
      </div>`).join("");
}

function publications(entries) {
  return entries.map((pub, i) => `
      <div class='blockHeader'>
        <span class='title'>${titleLine(pub.name, pub.publisher)}</span>
        ${has(pub.releaseDate) ? `<span class='date'><span class='releaseDate'>${esc(pub.releaseDate)}</span></span>` : ""}
      </div>
      ${website(pub.url)}
      ${highlights(withSummary(pub))}
      ${separator(i, entries.length)}`).join("");
}

function awards(entries) {
  return entries.map((award, i) => `
      <div class='blockHeader'>
        <span class='title'>${titleLine(award.title, award.awarder)}</span>
        ${has(award.date) ? `<span class='date'><span class='date'>${esc(award.date)}</span></span>` : ""}
      </div>
      ${highlights(withSummary(award))}
      ${separator(i, entries.length)}`).join("");
}

function volunteer(entries) {
  return entries.map((vol, i) => `
      <div class='blockHeader'>
        <span class='title'>${titleLine(vol.organization, vol.position)}</span>
        ${dateRange(vol.startDate, vol.endDate)}
        ${website(vol.url)}
        ${highlights(withSummary(vol))}
      </div>
      ${separator(i, entries.length)}`).join("");
}

function education(entries) {
  return entries.map((edu, i) => {
    const courses = textList(edu.courses);
    const columns = Array.from({ length: COURSES_COLUMNS }, () => []);
    courses.forEach((course, index) => columns[index % COURSES_COLUMNS].push(course));
    const degree = joinNonEmpty([edu.studyType, edu.area], " - ");
    const detail = `${esc(degree)}${has(edu.score) ? `, GPA: ${esc(edu.score)}` : ""}`;
    return `
      <div class='educationBlock'>
        <span class='title'>${esc(edu.institution)}</span>
        ${dateRange(edu.startDate, edu.endDate)}
        ${detail ? `<div class=''>${detail}</div>` : ""}
        ${courses.length ? `<div class='coursesBlock'>${columns.filter((c) => c.length).map((col) => `<ul class='coursesList'>${col.map((c) => `<li class='course'>${esc(c)}</li>`).join("")}</ul>`).join("")}</div>` : ""}
      </div>
      ${separator(i, entries.length)}`;
  }).join("");
}

function skills(entries) {
  return entries.filter((s) => has(s.name) || textList(s.keywords).length).map((skill) => {
    const keywords = textList(skill.keywords).map((k) => `<span>${esc(k)}</span>`).join(", ");
    return `<div class='skillBlock'><span class='title'>${esc(skill.name)}${has(skill.level) ? ` <em>(${esc(skill.level)})</em>` : ""}:</span> ${keywords}</div>`;
  }).join("");
}

function languages(entries) {
  return entries.filter((l) => has(l.language)).map((lang) => (
    `<span class='language'>${esc(lang.language)}</span>${has(lang.fluency) ? ` <span class='fluency'><em>(${esc(lang.fluency)})</em></span>` : ""}`
  )).join("<span>,</span> ");
}

function interests(entries) {
  return entries.filter((i) => has(i.name)).map((interest) => {
    const keywords = textList(interest.keywords);
    return `<span class='name'>${esc(interest.name)}</span>${keywords.length ? `<span class='keywords'> <em>[${keywords.map(esc).join(", ")}]</em></span>` : ""}`;
  }).join("<span>, </span>");
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
	<meta charset='utf-8'>
	<meta name='viewport' content='width=device-width, initial-scale=1'>
	<title>${esc(basics.name) || "Resume"}</title>
	<style>${CSS}</style>
	</head>
	<body>
	<div id='resume'>
  ${basicsBlock(basics)}
  ${has(basics.summary) ? block("summaryBlock", "SUMMARY", `<span>${esc(basics.summary)}</span>`) : ""}
  ${block("workBlock", "EXPERIENCE", work(resume.work))}
  ${block("publications", "PUBLICATIONS", publications(resume.publications))}
  ${block("awards", "AWARDS", awards(resume.awards))}
  ${block("volunteer", "VOLUNTEERING", volunteer(resume.volunteer))}
  ${block("education", "EDUCATION", education(resume.education))}
  ${block("skills", "SKILLS", skills(resume.skills))}
  ${block("languages", "LANGUAGES", languages(resume.languages))}
  ${block("interests", "INTERESTS", interests(resume.interests))}
	</div>
	</body>
</html>`;
}

export default { name: "onepage", label: "One Page", render };
