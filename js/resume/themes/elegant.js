// ============================================================================
// THEME: elegant
// Native port of jsonresume-theme-elegant@1.16.1
// (https://github.com/mudassir0909/jsonresume-theme-elegant). Pug templates
// are reproduced as string templates; Bootstrap 3.3.6 is replaced by
// BOOTSTRAP3_LITE and the icomoon font by inline SVGs. Dates follow the
// original ("MMM, YYYY" for ranges, "MMM DD, YYYY" for single dates) with
// moment-precise-range durations. The jQuery floating nav, tooltips and the
// "more profiles" collapse are omitted (all profiles are listed); no Gravatar
// lookup is made when basics.image is empty.
// ============================================================================

import {
  escapeHtml as esc, has, text, textList, safeUrl, mailto, markdownLite, formatDate,
  preciseDuration, icon, networkIcon, joinNonEmpty, normalizeResume, BOOTSTRAP3_LITE,
} from "../helpers.js";

// ============================================================================
// STYLES
// ============================================================================

const CSS = `
.icon-svg{width:1em;height:1em;vertical-align:-0.125em}
.relative{position:relative}
.clear-margin{margin:0}
.space-top{margin-top:10px}
.space-right{margin-right:10px}
.space-bottom{margin-bottom:10px}
.mr-5{margin-right:5px}
.mr-10{margin-right:10px}
.labels{line-height:2}
.label-keyword{display:inline-block;background:#7eb0db;color:white;font-size:0.9em;padding:5px;border:1px solid #357ebd;margin-right:5px;font-weight:normal;line-height:1.42857143;border-radius:0;white-space:normal}
.label-keyword:last-child{margin-right:0}
.label-keyword p{margin:0}
.label-keyword a{color:white}
.link-disguise{color:inherit}
.link-disguise:hover{color:inherit}
.fs-lg{font-size:1.33333333em;line-height:0.75em;vertical-align:-15%}
.fs-2x{font-size:2em}
body{font-family:'Lato',"Helvetica Neue",Helvetica,Arial,sans-serif;background:#f0f0f0;color:#333}
.main{padding:5px}
.card{background:white;border:1px solid #e6e6e6;border-radius:3px;min-height:300px;padding:10px 0}
.card-nested{min-height:0;border-width:1px 0 0 0}
.card-nested:before,.card-nested:after{content:" ";display:table}
.card-nested:after{clear:both}
@media (max-width:480px){.card-nested{padding:5px 0}}
.background-card{padding:10px 20px}
.card-wrapper{padding:5px}
@media (max-width:992px){.card-wrapper{float:none!important}}
.background-details .detail{display:table;width:100%}
.background-details .detail .icon{min-width:45px;max-width:45px;width:45px;text-align:center}
.background-details .detail .info{width:100%}
.background-details .detail .title,.background-details .detail .icon{color:#707070}
.background-details .detail .mobile-title{display:none}
@media (max-width:480px){.background-details .detail .mobile-title{display:inline-block;margin-left:5px;font-weight:bold;text-transform:uppercase;vertical-align:middle}}
.background-details .detail .icon,.background-details .detail .info{display:table-cell;padding:0 10px;vertical-align:top}
.background-details .detail .icon{padding-top:12px}
@media (max-width:480px){
.background-details .detail{display:block}
.background-details .detail .icon{max-width:inherit;min-width:inherit;width:auto;text-align:left}
.background-details .detail .icon,.background-details .detail .info{display:block;padding:10px 0}
.background-details .detail .title{display:none}
ul{padding-left:25px}
}
.current-event{width:8px;height:8px;color:#5ACE24;position:absolute;right:100%;top:6px;left:-12px}
.mop-wrapper>p:last-child{margin:0}
.affix{position:fixed}
@media (max-width:992px){.profile-card-wrapper{position:relative}}
.profile-card-wrapper .profile-card{padding:10px}
.profile-pic{padding:20px 0}
@media (max-width:992px){.profile-pic{padding:10px 0}}
.profile-pic img{width:100px;height:100px;object-fit:cover}
@media (max-width:992px){.name{margin-top:10px}}
@media (max-width:768px){.contact-details{text-align:center}}
.contact-details .detail{display:table;padding:10px 0}
.contact-details .detail .icon{padding:0 10px;color:#707070}
@media (max-width:992px){.contact-details .detail .icon{padding:0 5px 0 0}}
.contact-details .detail .info{font-size:0.8em;word-break:break-word}
.contact-details .detail .icon,.contact-details .detail .info{display:table-cell;vertical-align:middle}
@media (max-width:768px){.contact-details .detail{position:relative;float:left;width:100%;min-height:1px;padding-left:15px;padding-right:15px}}
@media (max-width:992px){.contact-details .detail{position:relative;min-height:1px;padding:10px}.contact-details .detail .icon,.contact-details .detail .info{display:inline-block}}
@media (max-width:992px) and (min-width:768px){.contact-details .detail{float:left;width:25%}}
.social-links{line-height:2.5}
.social-link{margin-left:5px;min-width:35px;display:inline-block}
.social-link:first-child{margin-left:0}
.social-link:hover{text-decoration:none}
.link-github{color:#454545}.link-twitter{color:#33ccff}.link-blog{color:#f36f24}.link-linkedin{color:#007bb6}
.link-skype{color:#12A5F4}.link-instagram{color:#e4405f}.link-stackoverflow{color:#8e8e92}.link-soundcloud{color:#e8822d}
.link-youtube{color:#dd4b39}.link-pinterest{color:#bd091f}.link-vimeo{color:#17b3e8}.link-behance{color:#2c98cf}
.link-codepen{color:#1c1c1c}.link-reddit{color:#545454}.link-spotify{color:#acd200}.link-tumblr{color:#2d4661}
.link-dribbble{color:#ce366f}.link-facebook{color:#4b6daa}.link-bitbucket{color:#205081}.link-hackernews{color:#ff6600}
.link-medium{color:#00AB6C}.link-telegram{color:#3BABDD}.link-gitlab{color:#fc6d26}
.card-skills{position:relative}
.skill-level{border-radius:3px;position:absolute;top:10px;bottom:10px;left:0;width:10px;box-shadow:inset 0 0 1px rgba(0,0,0,0.2)}
.skill-level .skill-progress{position:absolute;border-radius:3px;bottom:0;width:100%}
.skill-level .skill-progress.beginner{height:50%;background:#e74c3c}
.skill-level .skill-progress.intermediate{height:70%;background:#f1c40f}
.skill-level .skill-progress.advanced{height:80%;background:#428bca}
.skill-level .skill-progress.master{height:95%;background:#5cb85c}
.skill-info{margin-left:15px}
@media (max-width:480px){.skill-info{margin-left:20px}}
@media (max-width:768px){.quote{font-size:inherit}}
@media print{
a[href]:after{content:none!important}
.affix{position:static}
.col-md-3,.col-md-9{float:none!important;width:100%}
.profile-card{text-align:center;min-height:0}
.profile-pic{display:inline-block;vertical-align:middle}
.profile-pic img{border-radius:0}
.name-and-profession{display:inline-block;vertical-align:middle;margin-left:15px}
.contact-details .detail{position:relative;float:left;width:25%;min-height:1px;padding:0}
.card-nested{page-break-inside:avoid}
.pagebreak{page-break-before:always}
}
`;

// ============================================================================
// HELPERS
// ============================================================================

const rangeDate = (value) => formatDate(value, "MMM, YYYY");
const singleDate = (value) => formatDate(value, "MMM DD, YYYY");
const md = (value) => markdownLite(value);
const mdInline = (value) => markdownLite(value, { block: false });
const svg = (name, extra = "") => icon(name, { className: `icon-svg ${extra}`.trim() });
const anchor = (url, labelHtml) => {
  const safe = safeUrl(url);
  return safe ? `<a href="${esc(safe)}" target="_blank" rel="noopener">${labelHtml}</a>` : labelHtml;
};

function detail(id, iconName, title, content) {
  if (!content) return "";
  return `
      <div class="detail" id="${id}">
        <div class="icon">${svg(iconName, "fs-lg")}<span class="mobile-title">${title}</span></div>
        <div class="info">
          <h4 class="title text-uppercase">${title}</h4>
          ${content}
        </div>
      </div>`;
}

const currentEvent = (end, title) => (has(end) ? "" : `<span title="${title}">${icon("circle", { className: "current-event" })}</span>`);

function highlights(items) {
  const values = textList(items);
  return values.length ? `<ul>${values.map((h) => `<li class="mop-wrapper">${md(h)}</li>`).join("")}</ul>` : "";
}

function keywordLabels(items) {
  const values = textList(items);
  return values.length ? `<div class="space-top labels">${values.map((k) => `<span class="label label-keyword">${mdInline(k)}</span>`).join(" ")}</div>` : "";
}

function timeRow(start, end) {
  if (!has(start) && !has(end)) return "";
  const duration = has(start) ? preciseDuration(start, end) : "";
  return `<p class="text-muted"><small><span class="space-right">${esc(rangeDate(start))} - ${has(end) ? esc(rangeDate(end)) : "Present"}</span>${duration ? `<span>${svg("clock", "mr-5")}${esc(duration)}</span>` : ""}</small></p>`;
}

// ============================================================================
// PROFILE CARD
// ============================================================================

function profileCard(resume) {
  const { basics } = resume;
  const loc = basics.location;
  const computedLocation = joinNonEmpty([loc.address, loc.city, loc.region, loc.countryCode, loc.postalCode]);
  const languages = resume.languages.map((l) => text(l.language)).filter((l) => l.trim()).join(", ");
  const contact = (iconName, infoHtml, title = "") => `<div class="detail"><span class="icon"${title ? ` title="${title}"` : ""}>${svg(iconName, "fs-lg")}</span><span class="info">${infoHtml}</span></div>`;
  const details = [];
  if (computedLocation) details.push(contact("map-pin", esc(computedLocation)));
  if (has(basics.phone)) details.push(contact("phone", esc(basics.phone)));
  if (has(basics.email)) details.push(contact("mail", `<a class="link-disguise" href="${esc(mailto(basics.email))}">${esc(basics.email)}</a>`));
  const site = safeUrl(basics.url);
  if (site) details.push(contact("link", `<a href="${esc(site)}" target="_blank" rel="noopener">${esc(site)}</a>`));
  if (languages) details.push(contact("languages", esc(languages), "Languages I speak"));

  const links = basics.profiles.filter((p) => safeUrl(p.url)).map((profile) => {
    const label = text(profile.network).trim().toLowerCase().replace(/\s+/g, "");
    const title = `${text(basics.name)} on ${text(profile.network)}`;
    return `<a class="fs-2x social-link link-${esc(label)}" href="${esc(safeUrl(profile.url))}" target="_blank" rel="noopener" title="${esc(title)}" aria-label="${esc(title)}">${svg(networkIcon(label, "globe"))}</a>`;
  });

  const img = safeUrl(basics.image);
  return `
        <section class="col-md-3 card-wrapper profile-card-wrapper affix">
          <div class="card profile-card">
            <span class="profile-pic-container">
              ${img ? `<div class="profile-pic"><img class="media-object img-circle center-block" alt="${esc(basics.name)}" src="${esc(img)}" itemprop="image"></div>` : ""}
              <div class="name-and-profession text-center">
                <h3 itemprop="name"><b>${esc(basics.name)}</b></h3>
                ${has(basics.label) ? `<h5 class="text-muted" itemprop="jobTitle">${esc(basics.label)}</h5>` : ""}
              </div>
            </span>
            ${details.length ? `<hr><div class="contact-details clearfix">${details.join("")}</div>` : ""}
            ${links.length ? `<hr><div class="social-links text-center"><div>${links.join("")}</div></div>` : ""}
          </div>
        </section>`;
}

// ============================================================================
// BACKGROUND SECTIONS
// ============================================================================

function about(basics) {
  if (!has(basics.summary)) return "";
  return detail("about", "layout", "About", `<div class="card card-nested"><div class="content mop-wrapper" itemprop="description">${md(basics.summary)}</div></div>`);
}

function workExperience(entries) {
  if (!entries.length) return "";
  return detail("work-experience", "building", "Work Experience", `<ul class="list-unstyled clear-margin">${entries.map((w) => `
          <li class="card card-nested clearfix">
            <div class="content">
              <p class="clear-margin relative">${currentEvent(w.endDate, "Currently Working")}${joinNonEmpty([has(w.position) ? `<strong>${esc(w.position)}</strong>` : "", anchor(w.url, esc(w.name))], ",&nbsp;")}</p>
              ${timeRow(w.startDate, w.endDate)}
              ${has(w.summary) ? `<div class="mop-wrapper space-bottom">${md(w.summary)}</div>` : ""}
              ${highlights(w.highlights)}
            </div>
          </li>`).join("")}</ul>`);
}

function projectsExperience(entries) {
  if (!entries.length) return "";
  return detail("projects-experience", "code", "Projects Experience", `<ul class="list-unstyled clear-margin">${entries.map((p) => `
          <li class="card card-nested clearfix">
            <div class="content">
              <p class="clear-margin relative">${currentEvent(p.endDate, "Currently Working")}${anchor(p.url, `<strong>${esc(p.name)}</strong>`)}${has(p.entity) ? `<span>,&nbsp;${esc(p.entity)}</span>` : ""}</p>
              ${timeRow(p.startDate, p.endDate)}
              ${has(p.description) ? `<div class="mop-wrapper space-bottom">${md(p.description)}</div>` : ""}
              ${highlights(p.highlights)}
            </div>
          </li>`).join("")}</ul>`);
}

function skills(entries) {
  if (!entries.length) return "";
  const levels = ["beginner", "intermediate", "advanced", "master"];
  return detail("skills", "tool", "Skills", `<div class="content"><ul class="list-unstyled clear-margin">${entries.map((s) => {
    const level = text(s.level).trim().toLowerCase();
    const bar = levels.includes(level)
      ? `<div class="skill-level" title="${esc(level.charAt(0).toUpperCase() + level.slice(1))}"><div class="skill-progress ${level}"></div></div>`
      : "";
    return `<li class="card card-nested card-skills">${bar}<div class="skill-info">${has(s.name) ? `<strong>${esc(s.name)}</strong>` : ""}${keywordLabels(s.keywords)}</div></li>`;
  }).join("")}</ul></div>`);
}

function education(entries) {
  if (!entries.length) return "";
  return detail("education", "graduation-cap", "Education", `<div class="content"><ul class="list-unstyled clear-margin">${entries.map((e) => {
    const degree = joinNonEmpty([e.area, e.studyType]);
    const courses = textList(e.courses);
    const dates = has(e.startDate) || has(e.endDate)
      ? `<p class="text-muted${!has(e.score) && !courses.length ? " clear-margin" : ""}"><small>${esc(rangeDate(e.startDate))} - ${has(e.endDate) ? esc(rangeDate(e.endDate)) : "Present"}</small></p>`
      : "";
    return `
          <li class="card card-nested">
            <div class="content">
              <p class="clear-margin relative">${currentEvent(e.endDate, "Currently Pursuing")}${degree ? `<strong>${esc(degree)},&nbsp;</strong>` : ""}${anchor(e.url, esc(e.institution))}</p>
              ${dates}
              ${has(e.score) ? `<i>${esc(e.score)}</i>` : ""}
              ${keywordLabels(courses)}
            </div>
          </li>`;
  }).join("")}</ul></div>`);
}

function certificates(entries) {
  if (!entries.length) return "";
  return detail("certificates", "file-text", "Certificates", `<div class="content"><ul class="list-unstyled clear-margin">${entries.map((c) => `
          <li class="card card-nested">
            <div class="content">
              <p class="clear-margin"><strong>${anchor(c.url, esc(c.name))}</strong>${has(c.issuer) ? `,&nbsp;${esc(c.issuer)}` : ""}</p>
              ${has(c.date) ? `<p class="text-muted"><small>Issued on: ${esc(singleDate(c.date))}</small></p>` : ""}
            </div>
          </li>`).join("")}</ul></div>`);
}

function awards(entries) {
  if (!entries.length) return "";
  return detail("awards", "trophy", "Awards", `<div class="content"><ul class="list-unstyled clear-margin">${entries.map((a) => `
          <li class="card card-nested">
            <div class="content">
              <p class="clear-margin"><strong>${esc(a.title)}</strong>${has(a.awarder) ? `,&nbsp;${esc(a.awarder)}` : ""}</p>
              ${has(a.date) ? `<p class="text-muted"><small>Awarded on: ${esc(singleDate(a.date))}</small></p>` : ""}
              ${has(a.summary) ? `<div class="mop-wrapper">${md(a.summary)}</div>` : ""}
            </div>
          </li>`).join("")}</ul></div>`);
}

function volunteerWork(entries) {
  if (!entries.length) return "";
  return detail("volunteer-work", "users", "Volunteer Work", `<div class="content"><ul class="list-unstyled clear-margin">${entries.map((v) => `
          <li class="card card-nested">
            <div class="content">
              <p class="clear-margin relative">${currentEvent(v.endDate, "Currently Volunteering")}${joinNonEmpty([has(v.position) ? `<strong>${esc(v.position)}</strong>` : "", anchor(v.url, esc(v.organization))], ", ")}</p>
              ${has(v.startDate) || has(v.endDate) ? `<p class="text-muted"><small>${esc(rangeDate(v.startDate))} - ${has(v.endDate) ? esc(rangeDate(v.endDate)) : "Present"}</small></p>` : ""}
              ${has(v.summary) ? `<div class="mop-wrapper">${md(v.summary)}</div>` : ""}
              ${highlights(v.highlights)}
            </div>
          </li>`).join("")}</ul></div>`);
}

function publications(entries) {
  if (!entries.length) return "";
  return detail("publications", "newspaper", "Publications", `<div class="content"><ul class="list-unstyled clear-margin">${entries.map((p) => `
          <li class="card card-nested">
            <div class="content">
              <p class="clear-margin"><strong>${anchor(p.url, esc(p.name))}</strong>${has(p.publisher) ? `,&nbsp;${esc(p.publisher)}` : ""}</p>
              ${has(p.releaseDate) ? `<p class="text-muted"><small>Published on: ${esc(singleDate(p.releaseDate))}</small></p>` : ""}
              ${has(p.summary) ? `<div class="mop-wrapper">${md(p.summary)}</div>` : ""}
            </div>
          </li>`).join("")}</ul></div>`);
}

function interests(entries) {
  if (!entries.length) return "";
  return detail("interests", "heart", "Interests", `<div class="content"><ul class="list-unstyled clear-margin">${entries.map((i) => `
          <li class="card card-nested">
            ${has(i.name) ? `<p><strong>${esc(i.name)}</strong></p>` : ""}
            ${keywordLabels(i.keywords)}
          </li>`).join("")}</ul></div>`);
}

function references(entries) {
  const items = entries.filter((r) => has(r.name) || has(r.reference));
  if (!items.length) return "";
  return detail("references", "thumbs-up", "References", `<div class="content"><ul class="list-unstyled clear-margin">${items.map((r) => `
          <li class="card card-nested">
            ${anchor(r.url, esc(r.name))}
            ${has(r.reference) ? `<blockquote class="quote"><div class="mop-wrapper">${md(r.reference)}</div></blockquote>` : ""}
          </li>`).join("")}</ul></div>`);
}

// ============================================================================
// DOCUMENT
// ============================================================================

function render(input) {
  const resume = normalizeResume(input);
  const { basics } = resume;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(basics.name) || "Resume"}</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Lato:300,400,700&subset=latin">
    <style>${BOOTSTRAP3_LITE}${CSS}</style>
  </head>
  <body itemscope itemtype="http://schema.org/Person">
    <div class="container-fluid">
      <div class="row main clearfix">
        ${profileCard(resume)}
        <section class="col-md-9 card-wrapper pull-right">
          <div class="card background-card">
            <h4 class="text-uppercase">Background</h4>
            <hr>
            <div class="background-details">
              ${about(basics)}
              ${workExperience(resume.work)}
              ${projectsExperience(resume.projects)}
              ${skills(resume.skills)}
              ${education(resume.education)}
              ${certificates(resume.certificates)}
              ${awards(resume.awards)}
              ${volunteerWork(resume.volunteer)}
              ${publications(resume.publications)}
              ${interests(resume.interests)}
              ${references(resume.references)}
            </div>
          </div>
        </section>
      </div>
    </div>
  </body>
</html>`;
}

export default { name: "elegant", label: "Elegant", render };
