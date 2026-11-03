// ============================================================================
// THEME: kendall
// Native port of jsonresume-theme-kendall@0.2.0
// (https://github.com/LinuxBozo/jsonresume-theme-kendall). Bootstrap 3.3.7 is
// replaced by BOOTSTRAP3_LITE and Font Awesome 5 by inline SVGs. Dates use the
// original "Month YYYY" text and year-only education columns. Gravatar lookup
// is not performed (basics.image is used when present).
// ============================================================================

import {
  escapeHtml as esc, has, textList, linkTo, safeUrl, mailto, markdownLite,
  parseDate, formatYear, MONTHS_LONG, icon, networkIcon, normalizeResume, BOOTSTRAP3_LITE,
} from "../helpers.js";

// ============================================================================
// STYLES
// ============================================================================

const CSS = `
body{
  font-family: 'Open Sans', Arial, Tahoma;
  font-weight: 400;
  color: #363636;
  background: #334960;
}
blockquote {
  font-size: 1em;
}
.container{
  margin-top: 80px;
  margin-bottom: 15px;
  background: #fff;
}
#photo-header{
  margin-top: -75px;
}
#photo{
  width: 160px;
  height: 160px;
  border-radius: 50%;
  overflow: hidden;
  padding: 5px;
  background: #334960;
  display: inline-block;
}
#photo img{
  width: 150px;
  height: 150px;
  border-radius: 50%;
  object-fit: cover;
}
#text-header h1{
  margin: 0;
  padding: 0;
  font-size: 1.5em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: -1px;
}
#text-header h1::first-line{
  font-size: 1.5em;
  font-weight: 800;
  line-height: 1.5em;
}
#text-header h1 span{
  color: #334960;
  opacity: 0.7;
}
#text-header:after{
  width: 100%;
  height: 3px;
  border-bottom: 1px solid #ddd;
  margin-top: 15px;
  content: '';
  display: block;
}
.ico{
  width: 0.9em;
  height: 0.9em;
  vertical-align: -0.05em;
}
.box{
  padding-bottom: 10px;
  margin-bottom: 25px;
}
.box h2{
  color: #227c74;
  font-size: 1.5em;
  font-weight: 700;
  text-transform: uppercase;
}
#awards,
#education{
  margin-top: 20px;
  margin-bottom: 0;
  position: relative;
  padding: 1em 0;
  list-style: none;
}
#awards:before,
#education:before {
  width: 5px;
  height: 100%;
  position: absolute;
  left: 35px;
  top: 0;
  content: ' ';
  display: block;
  background: #32475c;
  background: linear-gradient(to bottom,  #ffffff 0%,#32475c 7%,#32475c 89%,#ffffff 100%);
}
#awards li,
#education li{
  width: 100%;
  z-index: 2;
  position: relative;
  float: left;
}
#awards .year,
#education .year{
  width: 14%;
  background: #fff;
  padding: 10px;
  font-weight: 700;
  display: inline-block;
}
#awards .description,
#education .description{
  width: 83%;
  display: inline-block;
  background: #eee;
  margin-bottom: 10px;
  position: relative;
  padding: 10px;
  border-bottom: 1px solid #ccc;
  border-right: 1px solid #ccc;
}
#awards .description:after,
#education .description:after {
  content: '';
  position: absolute;
  top: 15px;
  right: 0;
  left: -16px;
  height: 0;
  width: 0;
  border: solid transparent;
  border-right-color: #eee;
  border-width: 8px;
  pointer-events: none;
}
#awards .description h3,
#education .description h3{
  font-size: 1.2em;
  margin: 0;
  padding: 0;
  font-weight: 700;
}
#awards .description p,
#education .description p{
  margin-top: 5px;
  padding: 0;
}
.job{
  margin-bottom: 15px;
}
.job .details {
  margin-left: 3%;
  width: 95%;
  padding: 10px;
  margin-bottom: 10px;
  background: #eee;
  border-bottom: 1px solid #ccc;
  border-right: 1px solid #ccc;
}
.job .where{
  font-size: 1.2em;
  font-weight: bold;
}
.job .year{
  opacity: 0.7;
}
.job .profession{
  font-size: 1.2em;
  font-weight: bold;
}
.job .description{
  line-height: 1.5em;
}
.job .highlights{
  padding: 5px 0;
  font-weight: bold;
}
.job .job-details {
  padding-left: 5%;
  width: 100%;
}
.publication {
  margin-bottom: 0;
}
.publication .name{
  font-size: 1em;
  font-weight: bold;
}
.publication .year{
    opacity: 0.7;
}
.publication p{
  margin: 0;
  padding-top: 10px;
}
.contact-item{
  width: 100%;
  float: left;
}
.contact-item .icon{
  padding: 10px;
  border-right: 1px solid #ccc;
  border-bottom: 1px solid #ccc;
  color: #32475c;
  background: #eee;
  line-height: 1;
}
.contact-item .icon svg{
  width: 1.25em;
  height: 1.25em;
  display: block;
}
.contact-item:last-child .icon{
  border-bottom: none;
}
.contact-item .title{
  width: 80%;
  width: calc(100% - 55px);
  font-weight: 700;
  opacity: 0.9;
}
.contact-item .title.only{
  margin-top: 10px;
}
.contact-item .description{
  width: 80%;
  width: calc(100% - 55px);
  color: #334960;
}
.item-interests,
.item-skills{
  height: 30px;
  color: #334960;
  padding: 5px 10px;
  margin-bottom: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 1.1em;
  font-weight: 600;
}
.interest,
.skill{
  color: #fff;
  display: inline-block;
  margin-right: 5px;
  margin-bottom: 5px;
  padding: 5px 10px;
  background: #32475c;
  position: relative;
  font-size: .85em;
}
.skill-level {
  background-color: #227c74;
  border-radius: 4px;
  color: #fff;
  padding: 1px 8px;
  font-size: .75em;
  position: absolute;
  margin: 1px 10px;
}
#language-skills .skill{
  margin: 10px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}
.description > p:last-child{
  margin-bottom: 0;
}
`;

const PRINT_CSS = `
body {
  font-size: .95em;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
a[href]:after {
  content: none !important;
}
#photo{
  display: none;
}
.box {
  margin-bottom: -10px;
}
blockquote,
#education,
#awards,
.contact-item,
.publication,
.skills,
.interests {
  page-break-inside: avoid;
}
.col-sm-5{
  float: left;
  width: 40%;
  padding: 0 15px;
}
.col-sm-7{
  float: left;
  width: 60%;
  padding: 0 15px;
}
.skills .col-sm-offset-1,
.interests .col-sm-offset-1{
  margin-top: -10px;
  margin-bottom: 5px;
}
#education {
  margin: 0;
  margin-bottom: -20px;
}
#awards:before,
#education:before {
  background: none;
}
#awards .description,
#education .description,
.job .details {
  border: 1px solid #eee;
}
.publication,
.publication .panel-heading,
.publication .name{
  margin: 0;
  padding: 0 5px;
  border: none;
}
.publication .panel-body {
  padding: 0 10px;
  margin: 0;
}
.badge {
  margin: 0;
}
.list-group-item{
  border: none;
  margin: 0;
  padding: 5px 15px;
}
.list-group-item:after{
  content: '';
  position: absolute;
  top: 8px;
  right: 0;
  left: -1px;
  height: 0;
  width: 0;
  border: solid transparent;
  border-right-color: #999;
  border-width: 4px;
  pointer-events: none;
}
`;

// ============================================================================
// DATE HELPERS (match the original getMonth/substr logic)
// ============================================================================

const month = (value) => {
  const parsed = parseDate(value);
  return parsed && parsed.month ? `${MONTHS_LONG[parsed.month - 1]} ` : "";
};
const year = (value) => formatYear(value);
const day = (value) => {
  const parsed = parseDate(value);
  return parsed && parsed.day ? String(parsed.day).padStart(2, "0") : "";
};

function range(start, end) {
  const from = has(start) ? `${month(start)}${year(start)}` : "";
  const to = has(end) ? `${month(end)}${year(end)}` : "Present";
  return `${esc(from)} – ${esc(to)}`;
}

const ico = (name) => icon(name, { className: "ico" });
const inline = (value) => markdownLite(value, { block: false });

// ============================================================================
// COMPONENTS
// ============================================================================

function box(name, title, inner, extraClass = "") {
  if (!inner) return "";
  return `<div class="box${extraClass}"><h2>${ico(name)} ${title}</h2>${inner}</div>`;
}

function highlights(items) {
  const values = textList(items);
  if (!values.length) return "";
  return `<div class="highlights">Highlights</div><ul class="list-group">${values.map((h) => `<li class="list-group-item">${inline(h)}</li>`).join("")}</ul>`;
}

function address(url) {
  const safe = safeUrl(url);
  return safe ? `<div class="address"><a href="${esc(safe)}" target="_blank" rel="noopener">${ico("globe")} ${esc(safe)}</a></div>` : "";
}

function jobs(entries, orgKey) {
  return entries.map((entry) => `
              <div class="job clearfix">
                <div class="row">
                  <div class="details">
                    <div class="where">${esc(entry[orgKey])}${has(entry.location) && orgKey === "name" ? `<div class="pull-right">${esc(entry.location)}</div>` : ""}</div>
                    ${has(entry.description) ? `<div class="description">${esc(entry.description)}</div>` : ""}
                    ${address(entry.url)}
                    ${has(entry.startDate) || has(entry.endDate) ? `<div class="year">${range(entry.startDate, entry.endDate)}</div>` : ""}
                  </div>
                </div>
                <div class="row">
                  <div class="job-details col-xs-11">
                    ${has(entry.position) ? `<div class="profession">${esc(entry.position)}</div>` : ""}
                    <div class="description">${has(entry.summary) ? markdownLite(entry.summary) : ""}${highlights(entry.highlights)}</div>
                  </div>
                </div>
              </div>`).join("");
}

function awards(entries) {
  const items = entries.filter(({ title }) => has(title)).map(({ date, awarder, title, summary }) => `
              <li>
                <div class="year pull-left">${esc(month(date))}${has(date) ? esc(year(date)) : ""}</div>
                <div class="description pull-right">
                  ${has(awarder) ? `<h3>${esc(awarder)}</h3>` : ""}
                  <p>${ico("trophy")} ${esc(title)}</p>
                  ${has(summary) ? `<p>${inline(summary)}</p>` : ""}
                </div>
              </li>`).join("");
  return items ? `<ul id="awards" class="clearfix">${items}</ul>` : "";
}

function projects(entries) {
  const items = entries.filter(({ name }) => has(name)).map(({ name, description, url }) => {
    const title = `<span style="font-weight:bold">${linkTo(url, esc(name))}</span>`;
    return `<li class="list-group-item">${title}${has(description) ? `: ${esc(description)}` : ""}</li>`;
  }).join("");
  return items ? `<ul class="list-group">${items}</ul>` : "";
}

function contact(basics) {
  const items = [];
  const loc = basics.location;
  const cityLine = [
    esc(loc.city),
    has(loc.region) ? `, ${esc(loc.region)}` : "",
    has(loc.postalCode) ? ` ${esc(loc.postalCode)}` : "",
    has(loc.countryCode) ? ` ${esc(loc.countryCode)}` : "",
  ].join("").replace(/^, /, "");
  if (has(loc.address) || cityLine.trim()) {
    items.push(`<div class="contact-item">
              <div class="icon pull-left text-center">${icon("map-marker")}</div>
              ${has(loc.address) ? `<div class="title pull-right">${esc(loc.address)}</div>` : ""}
              ${cityLine.trim() ? `<div class="title ${has(loc.address) ? "" : "only "}pull-right">${cityLine}</div>` : ""}
            </div>`);
  }
  if (has(basics.phone)) {
    items.push(`<div class="contact-item"><div class="icon pull-left text-center">${icon("phone")}</div><div class="title only pull-right">${esc(basics.phone)}</div></div>`);
  }
  if (has(basics.email)) {
    items.push(`<div class="contact-item"><div class="icon pull-left text-center">${icon("mail")}</div><div class="title only pull-right">${linkTo(mailto(basics.email), esc(basics.email), 'target="_blank" rel="noopener"')}</div></div>`);
  }
  const site = safeUrl(basics.url);
  if (site) {
    items.push(`<div class="contact-item"><div class="icon pull-left text-center">${icon("globe")}</div><div class="title only pull-right"><a href="${esc(site)}" target="_blank" rel="noopener">${esc(site)}</a></div></div>`);
  }
  for (const { network, username, url } of basics.profiles) {
    if (!has(network) && !has(username) && !safeUrl(url)) continue;
    const labelText = has(username) ? username : (safeUrl(url) || "");
    items.push(`<div class="contact-item">
              <div class="icon pull-left text-center">${icon(networkIcon(network, "globe"))}</div>
              <div class="title pull-right">${esc(network)}</div>
              <div class="description pull-right">${linkTo(url, esc(labelText), 'target="_blank" rel="noopener"')}</div>
            </div>`);
  }
  return items.join("");
}

function education(entries) {
  const items = entries.filter(({ institution }) => has(institution)).map(({ institution, startDate, endDate, url, studyType, area, score, courses }) => {
    const endYear = has(endDate) ? `${year(endDate)}${Number(year(endDate)) > new Date().getFullYear() ? " (expected)" : ""}` : "Present";
    const courseList = textList(courses);
    return `
              <li>
                <div class="year pull-left">${has(startDate) ? esc(year(startDate)) : ""} ${esc(endYear)}</div>
                <div class="description pull-right">
                  <h3>${esc(institution)}</h3>
                  ${address(url)}
                  ${has(studyType) ? `<p>${ico("graduation-cap")} ${esc(studyType)}</p>` : ""}
                  ${has(area) ? `<p>${esc(area)}</p>` : ""}
                  ${has(score) ? `<p>Grade: ${esc(score)}</p>` : ""}
                  ${courseList.length ? `<div>Courses</div><ul class="list-group">${courseList.map((c) => `<li class="list-group-item">${inline(c)}</li>`).join("")}</ul>` : ""}
                </div>
              </li>`;
  }).join("");
  return items ? `<ul id="education" class="clearfix">${items}</ul>` : "";
}

function keywordGroups(entries, kind) {
  return entries.filter(({ name }) => has(name)).map(({ name, level, keywords }) => `
            <div class="${kind}s clearfix">
              <div class="item-${kind}s">${esc(name)}${kind === "skill" && has(level) ? ` <span class="skill-level">${esc(level)}</span>` : ""}</div>
              <div class="col-sm-offset-1 col-sm-12 clearfix">
                ${textList(keywords).map((k) => `<span class="${kind} badge">${esc(k)}</span>`).join(" ")}
              </div>
            </div>`).join("");
}

function publications(entries) {
  return entries.filter(({ name }) => has(name)).map(({ name, publisher, releaseDate, url, summary }) => {
    const dateText = has(releaseDate) ? [day(releaseDate), month(releaseDate).trim(), year(releaseDate)].filter(Boolean).join(" ") : "";
    return `
            <div class="publication panel panel-default">
              <div class="panel-heading"><div class="name panel-title">${esc(name)}</div></div>
              <div class="panel-body">
                ${has(publisher) ? `<div class="publisher">${ico("bookmark")} ${esc(publisher)}</div>` : ""}
                ${dateText ? `<div class="year">${esc(dateText)}</div>` : ""}
                ${address(url)}
                ${has(summary) ? `<p>${inline(summary)}</p>` : ""}
              </div>
            </div>`;
  }).join("");
}

function languages(entries) {
  const items = entries.filter(({ language }) => has(language)).map(({ language, fluency }) => (
    `<li class="list-group-item">${esc(language)}${has(fluency) ? `<span class="skill badge pull-right">${esc(fluency)}</span>` : ""}</li>`
  )).join("");
  return items ? `<ul class="list-group">${items}</ul>` : "";
}

function references(entries) {
  return entries.filter(({ name, reference }) => has(name) || has(reference)).map(({ name, reference, url }) => `
            <blockquote>
              ${has(reference) ? `<div>${inline(reference)}</div>` : ""}
              ${has(name) ? `<footer>${linkTo(url, esc(name), 'target="_blank" rel="noopener"')}</footer>` : ""}
            </blockquote><br>`).join("");
}

// ============================================================================
// DOCUMENT
// ============================================================================

function render(input) {
  const resume = normalizeResume(input);
  const { basics } = resume;
  const photo = safeUrl(basics.image);
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Resume of ${esc(basics.name)}</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Open+Sans:400,600,700,800">
    <style type="text/css">${BOOTSTRAP3_LITE}${CSS}</style>
    <style type="text/css" media="print">${PRINT_CSS}</style>
  </head>
  <body>
    <div class="container">
      <div class="row">
        <div class="col-xs-12">
          <div id="photo-header" class="text-center">
            ${photo ? `<div id="photo"><img src="${esc(photo)}" alt="avatar"></div>` : ""}
            <div id="text-header"${photo ? "" : ' style="margin-top: 90px;"'}>
              <h1>${esc(basics.name)}<br>${has(basics.label) ? `<span>${esc(basics.label)}</span>` : ""}</h1>
            </div>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col-xs-12 col-sm-7">
          ${has(basics.summary) ? box("user", "About", markdownLite(basics.summary)) : ""}
          ${box("briefcase", "Work Experience", jobs(resume.work, "name"))}
          ${box("award", "Awards", awards(resume.awards))}
          ${box("users", "Volunteer", jobs(resume.volunteer, "organization"))}
          ${box("git-branch", "Projects", projects(resume.projects))}
        </div>
        <div class="col-xs-12 col-sm-5">
          ${box("target", "Contact", contact(basics), " clearfix")}
          ${box("graduation-cap", "Education", education(resume.education))}
          ${box("list", "Skills", keywordGroups(resume.skills, "skill"))}
          ${box("book", "Publications", publications(resume.publications))}
          ${box("languages", "Languages", languages(resume.languages))}
          ${box("heart", "Interests", keywordGroups(resume.interests, "interest"))}
          ${box("check-square", "References", references(resume.references))}
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export default { name: "kendall", label: "Kendall", render };
