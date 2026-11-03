// ============================================================================
// THEME: flat
// Native port of jsonresume-theme-flat@0.3.7
// (https://github.com/erming/jsonresume-theme-flat). Bootstrap 3.2 is replaced
// by the shared BOOTSTRAP3_LITE subset and Octicons by CSS shapes. Dates are
// shown raw as in the original; a missing end date reads "Present".
// ============================================================================

import {
  escapeHtml as esc, has, textList, linkTo, safeUrl, normalizeResume, BOOTSTRAP3_LITE,
} from "../helpers.js";

// ============================================================================
// STYLES
// ============================================================================

const CSS = `
body {
	background: #fff;
	font-family: Lato, sans-serif;
	margin: 0 0 80px;
}
a {
	color: #2ecc71;
}
a:focus,
a:hover {
	color: #f1c40f;
	text-decoration: none;
}
p {
	line-height: 1.5;
	margin: 0;
}
p + p {
	margin-top: 10px;
}
h1,
h2,
h3,
h4 {
	margin-top: 0
}
section {
	margin-top: 30px;
}
li {
	line-height: 1.8;
	list-style: none;
}
li:before {
	content: "";
	float: left;
	width: 7px;
	height: 7px;
	border-radius: 50%;
	background: #000;
	margin-top: 10px;
	margin-left: -20px;
	opacity: .1;
	position: absolute;
}
blockquote {
	border-left: 5px solid #e7e9ec;
	font-size: 14px;
}
em {
	color: #95a5a6;
	font-weight: normal;
	font-style: normal;
}
h4 span:first-child {
	color: #000;
	font-weight: bold;
}
.container {
	max-width: 750px;
	padding: 0 30px;
}
.col-sm-6 {
	margin-bottom: 10px;
}
.col-sm-12 h4 {
	margin-top: 12px;
}
.col-sm-12 + .col-sm-12 {
	margin-top: 30px;
}
#header {
	background: #f4f6f6;
	padding: 50px 0;
	margin-bottom: 30px;
}
#header h2 {
	color: #95a5a6;
	font-size: 24px;
}
#content h3 {
	color: #f1c40f;
	font-size: 26px;
	margin-top: -4px;
}
#content aside {
	text-align: right;
	padding-right: 30px;
}
#profiles .network {
	text-transform: capitalize;
}
#work .position,
#volunteer .position {
	font-weight: bold;
	margin-bottom: 8px;
}
#education .area {
	font-weight: bold;
}
#education .area:before {
	content: "";
	display: inline-block;
	border-style: solid;
	border-width: 6px 5px 0 5px;
	border-color: currentColor transparent transparent transparent;
	vertical-align: middle;
	margin-right: 6px;
}
#education .studyType {
	margin-left: 25px;
}
#awards .summary,
#publications .summary {
	margin-top: 8px;
}

@media (min-width: 480px) {
	.strike-through {
		border-top: 1px solid #f4f6f6;
		height: 20px;
		margin-top: 12px;
		margin-bottom: -2px;
		position: relative;
	}
	.strike-through span,
	.strike-through a {
		background: #fff;
		position: absolute;
	}
	.strike-through span:first-child {
		padding-right: 20px;
		margin-top: -12px;
	}
	.strike-through span + span {
		font-size: 14px;
		margin-top: -10px;
		padding-left: 20px;
		right: 0;
	}
}
@media (max-width: 768px) {
	.col-sm-6:last-child {
		margin-bottom: 0px;
	}
	#content aside {
		margin-bottom: 20px;
		padding-right: 0;
		text-align: left;
	}
}
@media (max-width: 480px) {
	h1 {
		font-size: 26px;
	}
	.date {
		font-size: 14px;
		margin-bottom: 5px;
	}
	.strike-through span:first-child {
		margin-bottom: 7px;
	}
	.strike-through span {
		display: block;
	}
	#header {
		margin-bottom: 10px;
		padding: 40px 0;
	}
}
@media print {
	#header {
		padding: 20px 0;
	}
	section {
		page-break-inside: avoid;
	}
}
`;

// ============================================================================
// COMPONENTS
// ============================================================================

function block(id, title, inner) {
  if (!inner) return "";
  return `
	<section id="${id}" class="row">
		<aside class="col-sm-3">
			<h3>${title}</h3>
		</aside>
		<div class="col-sm-9">
			<div class="row">${inner}</div>
		</div>
	</section>`;
}

function dates(start, end) {
  if (!has(start) && !has(end)) return "";
  return `<span class="date">${esc(start)} — ${has(end) ? esc(end) : "Present"}</span>`;
}

function website(url) {
  const safe = safeUrl(url);
  return safe ? `<div class="website pull-right"><a href="${esc(safe)}">${esc(safe)}</a></div>` : "";
}

function highlightsList(items, className = "highlights", title = "Highlights") {
  const values = textList(items);
  if (!values.length) return "";
  return `<h4>${title}</h4><ul class="${className}">${values.map((item) => `<li class="bullet">${esc(item)}</li>`).join("")}</ul>`;
}

function experience(entries, orgKey) {
  return entries.map((entry) => `
			<div class="col-sm-12">
				<h4 class="strike-through"><span>${esc(entry[orgKey])}</span>${dates(entry.startDate, entry.endDate)}</h4>
				${website(entry.url)}
				${has(entry.position) ? `<div class="position">${esc(entry.position)}</div>` : ""}
				${has(entry.summary) ? `<div class="summary"><p>${esc(entry.summary)}</p></div>` : ""}
				${highlightsList(entry.highlights)}
			</div>`).join("");
}

function contact(basics) {
  const items = [];
  if (has(basics.email)) items.push(`<div class="col-sm-6"><strong>Email</strong><div class="email">${esc(basics.email)}</div></div>`);
  if (has(basics.phone)) items.push(`<div class="col-sm-6"><strong>Phone</strong><div class="phone">${esc(basics.phone)}</div></div>`);
  const site = safeUrl(basics.url);
  if (site) items.push(`<div class="col-sm-6"><strong>Website</strong><div class="website"><a href="${esc(site)}">${esc(site)}</a></div></div>`);
  return block("contact", "Contact", items.join(""));
}

function profiles(list) {
  return block("profiles", "Profiles", list.map(({ network, username, url }) => {
    const net = has(network) ? `<strong class="network">${esc(network)}</strong>` : "";
    let body = "";
    if (has(username)) {
      body = `<div class="username">${safeUrl(url) ? `<div class="url">${linkTo(url, esc(username))}</div>` : esc(username)}</div>`;
    } else if (safeUrl(url)) {
      body = `<div class="url">${linkTo(url, esc(safeUrl(url)))}</div>`;
    }
    return net || body ? `<div class="col-sm-6">${net}${body}</div>` : "";
  }).join(""));
}

function education(entries) {
  return entries.map(({ institution, startDate, endDate, area, studyType, courses }) => `
			<div class="col-sm-12">
				<h4 class="strike-through"><span>${esc(institution)}</span>${dates(startDate, endDate)}</h4>
				${has(area) ? `<div class="area">${esc(area)}</div>` : ""}
				${has(studyType) ? `<div class="studyType">${esc(studyType)}</div>` : ""}
				${highlightsList(courses, "courses", "Courses")}
			</div>`).join("");
}

function awards(entries) {
  return entries.map(({ title, date, awarder, summary }) => `
			<div class="col-sm-12">
				<h4 class="strike-through"><span>${esc(title)}</span></h4>
				${has(date) ? `<div class="date pull-right"><em>Awarded</em> ${esc(date)}</div>` : ""}
				${has(awarder) ? `<div class="awarder"><em>by</em> <strong>${esc(awarder)}</strong></div>` : ""}
				${has(summary) ? `<div class="summary">${esc(summary)}</div>` : ""}
			</div>`).join("");
}

function publications(entries) {
  return entries.map(({ name, releaseDate, url, publisher, summary }) => {
    const safe = safeUrl(url);
    return `
			<div class="col-sm-12">
				<h4 class="strike-through"><span>${esc(name)}</span>${has(releaseDate) ? `<span class="date">${esc(releaseDate)}</span>` : ""}</h4>
				${safe ? `<div class="website pull-right"><a href="${esc(safe)}">${esc(safe)}</a></div>` : ""}
				${has(publisher) ? `<div class="publisher"><em>Published by</em> <strong>${esc(publisher)}</strong></div>` : ""}
				${has(summary) ? `<div class="summary"><p>${esc(summary)}</p></div>` : ""}
			</div>`;
  }).join("");
}

function keywordGroups(entries) {
  return entries
    .filter(({ name, keywords }) => has(name) || textList(keywords).length)
    .map(({ name, keywords }) => {
      const values = textList(keywords);
      return `
			<div class="col-sm-6">
				${has(name) ? `<div class="name"><h4>${esc(name)}</h4></div>` : ""}
				${values.length ? `<ul class="keywords">${values.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}
			</div>`;
    }).join("");
}

function languages(entries) {
  return entries
    .filter(({ language, fluency }) => has(language) || has(fluency))
    .map(({ language, fluency }) => `
			<div class="col-sm-6">
				${has(language) ? `<div class="language"><strong>${esc(language)}</strong></div>` : ""}
				${has(fluency) ? `<div class="fluency">${esc(fluency)}</div>` : ""}
			</div>`).join("");
}

function references(entries) {
  return entries
    .filter(({ reference }) => has(reference))
    .map(({ name, reference }) => `
			<div class="col-sm-12">
				<blockquote class="reference">
					<p>${esc(reference)}</p>
					${has(name) ? `<p class="name"><strong>— ${esc(name)}</strong></p>` : ""}
				</blockquote>
			</div>`).join("");
}

// ============================================================================
// DOCUMENT
// ============================================================================

function render(input) {
  const resume = normalizeResume(input);
  const { basics } = resume;
  const heading = [
    has(basics.name) ? `<h1>${esc(basics.name)}</h1>` : "",
    has(basics.label) ? `<h2>${esc(basics.label)}</h2>` : "",
  ].join("");
  return `<!doctype html>
<html>
	<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${esc(basics.name) || "Resume"}</title>
	<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Lato:400,700">
	<style type="text/css">${BOOTSTRAP3_LITE}${CSS}</style>
	</head>
	<body>
	<header id="header">
		<div class="container">
			<div class="row">
				<div class="col-sm-9 col-sm-push-3">${heading}</div>
			</div>
		</div>
	</header>
	<div id="content" class="container">
	${contact(basics)}
	${has(basics.summary) ? block("about", "About", `<div class="col-sm-12"><p>${esc(basics.summary)}</p></div>`) : ""}
	${profiles(basics.profiles)}
	${block("work", "Work", experience(resume.work, "name"))}
	${block("volunteer", "Volunteer", experience(resume.volunteer, "organization"))}
	${block("education", "Education", education(resume.education))}
	${block("awards", "Awards", awards(resume.awards))}
	${block("publications", "Publications", publications(resume.publications))}
	${block("skills", "Skills", keywordGroups(resume.skills))}
	${block("languages", "Languages", languages(resume.languages))}
	${block("interests", "Interests", keywordGroups(resume.interests))}
	${block("references", "References", references(resume.references))}
	</div>
	</body>
</html>`;
}

export default { name: "flat", label: "Flat", render };
