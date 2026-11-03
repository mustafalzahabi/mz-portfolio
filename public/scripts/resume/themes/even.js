// ============================================================================
// THEME: even
// Native port of jsonresume-theme-even@0.27.0 (official JSON Resume default,
// https://github.com/rbardini/jsonresume-theme-even). Markup, class names,
// section order, CSS and date format ("MMM YYYY", UTC) follow the original.
// Feather icons are inlined; the <time-duration> custom element is computed at
// render time instead of by a client script.
// ============================================================================

import {
  escapeHtml as esc, has, text, textList, linkTo, mailto, tel, stripProtocol,
  markdownLite, stripMarkdown, formatMonthYear, compactDuration, countryName,
  formatList, icon, networkIcon, normalizeResume, safeUrl,
} from "../helpers.js";

// ============================================================================
// STYLES (verbatim from the original bundle)
// ============================================================================

const CSS = `:root{color-scheme:light dark;--color-background-light:#fff;--color-dimmed-light:#f3f4f6;--color-primary-light:#111827;--color-secondary-light:#6b7280;--color-accent-light:#527575;--color-background-dark:#121113;--color-dimmed-dark:#222;--color-primary-dark:#c1c1c1;--color-secondary-dark:#888;--color-accent-dark:#5f8787;--color-background:var(--color-background-light);--color-dimmed:var(--color-dimmed-light);--color-primary:var(--color-primary-light);--color-secondary:var(--color-secondary-light);--color-accent:var(--color-accent-light);--scale-ratio:1.25;--scale0:1rem;--scale1:calc(var(--scale0) * var(--scale-ratio));--scale2:calc(var(--scale1) * var(--scale-ratio));--scale3:calc(var(--scale2) * var(--scale-ratio));--scale4:calc(var(--scale3) * var(--scale-ratio));--scale5:calc(var(--scale4) * var(--scale-ratio))}@media (prefers-color-scheme:dark){:root{--color-background:var(--color-background-dark);--color-dimmed:var(--color-dimmed-dark);--color-primary:var(--color-primary-dark);--color-secondary:var(--color-secondary-dark);--color-accent:var(--color-accent-dark)}}*{box-sizing:border-box;margin:0;padding:0}html{font-size:14px}body{background:var(--color-background);color:var(--color-primary);grid-template-rows:auto[content]0;grid-template-columns:[full-start]1fr[main-start side-start]minmax(min-content,12em)[side-end content-start]minmax(min-content,36em)[main-end content-end]1fr[full-end];gap:2em;margin-bottom:4em;font:1em/1.5 Lato,sans-serif;display:grid}body:before{content:"";grid-area:content/full}ol,ul{padding-left:1em}:not(.icon-list,.tag-list)>li+li{margin-top:.4em}li::marker,.network{color:var(--color-secondary)}a{color:var(--color-accent);text-decoration:none}a:focus,a:hover{text-decoration:underline}h1,h2,h3,h5{font-weight:400}h1,h2,h3{line-height:1.2}h1{font-size:var(--scale5)}h2{color:var(--color-secondary);font-size:var(--scale4)}h3{color:var(--color-secondary);font-size:var(--scale3);grid-column:side;margin-bottom:1rem}h4{font-size:var(--scale2)}h5{font-size:var(--scale1)}h6{font-size:var(--scale0)}blockquote{border-left:.2em solid var(--color-dimmed);padding-left:1em}cite{color:var(--color-secondary);font-style:inherit}cite:before{content:"— "}svg{vertical-align:text-bottom;margin-right:.2em}.masthead{background:var(--color-dimmed);display:inherit;gap:inherit;grid-column:full;grid-template-columns:inherit;text-align:center;padding:4em 0}.masthead>*,section{grid-column:main}.masthead>img{border:4px solid;border-radius:50%;max-width:12em;margin:0 auto}article>*+*,blockquote>*+*,.timeline>div>*+*{margin-top:.6em}.meta{color:var(--color-secondary)}.stack{gap:1.5em;display:grid}.icon-list{flex-wrap:wrap;justify-content:center;gap:.4em 1em;padding:0;list-style:none;display:flex}.grid-list{gap:1em;display:grid}.tag-list{flex-wrap:wrap;gap:.4em;padding:0;list-style:none;display:flex}.tag-list>li{background:var(--color-dimmed);border-radius:.2em;padding:.2em .6em}.timeline>div{position:relative}.timeline>div:not(:last-child){padding-bottom:1rem}.timeline>div:not(:last-child):before{content:"";background:var(--color-secondary);width:2px;height:100%;position:absolute;top:1rem;left:-15px}.timeline>div:not(:only-child):after{content:"";background:var(--color-secondary);border:2px solid var(--color-background);border-radius:50%;width:8px;height:8px;position:absolute;top:.6rem;left:-20px}@media print,(width>=48em){h3{text-align:right;margin-bottom:inherit}.masthead{text-align:inherit}.masthead>*,section{grid-column:content}.masthead img{grid-area:span 2/side;max-width:100%}section{display:contents}.icon-list{flex-direction:column}.grid-list{grid-template-columns:repeat(auto-fit,minmax(calc(50% - .5em),1fr))}}time+time-duration:before{content:"· "}@media print{time-duration{display:none}}`;

// ============================================================================
// COMPONENTS
// ============================================================================

const md = (value) => markdownLite(value);

function themeColors(meta) {
  const colors = meta?.themeOptions?.colors;
  if (!colors || typeof colors !== "object") return "";
  const safe = /^[#\w\s(),.%-]+$/;
  return Object.entries(colors)
    .filter(([key, value]) => /^[a-z-]+$/i.test(key) && Array.isArray(value) && value.length)
    .map(([key, [light, dark = light]]) => [key, text(light), text(dark)])
    .filter(([, light, dark]) => safe.test(light) && safe.test(dark))
    .map(([key, light, dark]) => `--color-${key}-light:${light}; --color-${key}-dark:${dark};`)
    .join(" ");
}

function dateTime(value) {
  return `<time datetime="${esc(value)}">${esc(formatMonthYear(value))}</time>`;
}

function duration(ranges) {
  const dates = ranges.map(({ startDate, endDate }) => [text(startDate), text(endDate)]).flat().join("|");
  return `<time-duration dates="${esc(dates)}">${esc(compactDuration(ranges))}</time-duration>`;
}

function dateRange(start, end) {
  if (has(end) && text(end) === text(start)) return dateTime(end);
  return `${dateTime(start)} – ${has(end) ? dateTime(end) : "Present"} ${duration([{ startDate: start, endDate: end }])}`;
}

/** link(url, name): named link, plain name, or bare URL link. */
function link(url, name) {
  if (has(name)) return linkTo(url, esc(name));
  const safe = safeUrl(url);
  return safe ? linkTo(safe, esc(stripProtocol(safe))) : "";
}

function bullets(items) {
  const values = textList(items);
  return values.length ? `<ul>${values.map((item) => `<li>${md(item)}</li>`).join("")}</ul>` : "";
}

function tags(items) {
  const values = textList(items);
  return values.length ? `<ul class="tag-list">${values.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : "";
}

function section(id, title, className, items) {
  if (!items.length) return "";
  return `<section id="${id}"><h3>${title}</h3><div class="${className}">${items.join("")}</div></section>`;
}

function header(basics) {
  const { email, image, label, location, name, phone, profiles, summary, url } = basics;
  const items = [];
  if (has(location.city)) {
    const country = has(location.countryCode) ? `, ${esc(countryName(location.countryCode))}` : "";
    items.push(`<li>${icon("map-pin", { size: 16 })} ${esc(location.city)}${country}</li>`);
  }
  if (has(email)) items.push(`<li>${icon("mail", { size: 16 })} ${linkTo(mailto(email), esc(email))}</li>`);
  if (has(phone)) items.push(`<li>${icon("phone", { size: 16 })} ${linkTo(tel(phone), esc(phone))}</li>`);
  if (has(url) && safeUrl(url)) items.push(`<li>${icon("link", { size: 16 })} ${link(url)}</li>`);
  for (const { network, url: profileUrl, username } of profiles) {
    const label = link(profileUrl, username);
    if (!label && !has(network)) continue;
    items.push(`<li>${has(network) ? icon(networkIcon(network, "user"), { size: 16 }) : ""} ${label}${has(network) ? ` <span class="network">(${esc(network)})</span>` : ""}</li>`);
  }
  const img = safeUrl(image);
  const heading = [has(name) ? `<h1>${esc(name)}</h1>` : "", has(label) ? `<h2>${esc(label)}</h2>` : ""].filter(Boolean).join(" ");
  return `<header class="masthead">
      ${img ? `<img src="${esc(img)}" alt="" />` : ""}
      <div>${heading}</div>
      ${has(summary) ? `<article>${md(summary)}</article>` : ""}
      ${items.length ? `<ul class="icon-list">${items.join("")}</ul>` : ""}
    </header>`;
}

function work(entries) {
  const groups = entries.reduce((acc, { description, name, url, ...item }) => {
    const last = acc[acc.length - 1];
    if (last && last.name === name && last.description === description && last.url === url) last.items.push(item);
    else acc.push({ description, name, url, items: [item] });
    return acc;
  }, []);
  return section("work", "Work", "stack", groups.map(({ description, name, url, items }) => {
    const single = items.length === 1 ? items[0] : undefined;
    const company = link(url, name);
    const meta = single
      ? [
        [company && `<strong>${company}</strong>`, has(description) ? esc(description) : ""].filter(Boolean).join(" · "),
        has(single.startDate) ? dateRange(single.startDate, single.endDate) : "",
        has(single.location) ? esc(single.location) : "",
      ]
      : [
        has(description) ? esc(description) : "",
        items.some((item) => has(item.startDate)) ? duration(items) : "",
      ];
    const timeline = items.map(({ highlights, location, position, startDate, endDate, summary }) => {
      const sub = single ? "" : `<div>${has(position) ? `<h5>${esc(position)}</h5>` : ""}<div class="meta">${has(startDate) ? `<div>${dateRange(startDate, endDate)}</div>` : ""}${has(location) ? `<div>${esc(location)}</div>` : ""}</div></div>`;
      return `<div>${sub}${has(summary) ? md(summary) : ""}${bullets(highlights)}</div>`;
    }).join("");
    const title = single ? esc(single.position) : company;
    return `<article><header>${title ? `<h4>${title}</h4>` : ""}<div class="meta">${meta.filter(Boolean).map((m) => `<div>${m}</div>`).join("")}</div></header><div class="timeline">${timeline}</div></article>`;
  }));
}

function volunteer(entries) {
  return section("volunteer", "Volunteer", "stack", entries.map(({ highlights, organization, position, startDate, endDate, summary, url }) => {
    const title = link(url, organization);
    return `<article><header>${title ? `<h4>${title}</h4>` : ""}<div class="meta">${has(position) ? `<strong>${esc(position)}</strong>` : ""}${has(startDate) ? `<div>${dateRange(startDate, endDate)}</div>` : ""}</div></header>${has(summary) ? md(summary) : ""}${bullets(highlights)}</article>`;
  }));
}

function education(entries) {
  return section("education", "Education", "stack", entries.map(({ area, courses, institution, startDate, endDate, studyType, url }) => {
    const title = link(url, institution);
    const degree = [has(studyType) ? esc(studyType) : "", has(area) ? `<strong>${esc(area)}</strong>` : ""].filter(Boolean).join(" in ");
    const courseList = textList(courses);
    return `<article><header>${title ? `<h4>${title}</h4>` : ""}<div class="meta">${degree ? `<div>${degree}</div>` : ""}${has(startDate) ? `<div>${dateRange(startDate, endDate)}</div>` : ""}</div></header>${courseList.length ? `<h5>Courses</h5>${bullets(courseList)}` : ""}</article>`;
  }));
}

function projects(entries) {
  return section("projects", "Projects", "stack", entries.map(({ description, entity, highlights, keywords, name, startDate, endDate, roles, type, url }) => {
    const title = link(url, name);
    const roleList = textList(roles);
    const who = [roleList.length ? `<strong>${esc(formatList(roleList))}</strong>` : "", has(entity) ? `at <strong>${esc(entity)}</strong>` : ""].filter(Boolean).join(" ");
    return `<article><header>${title ? `<h4>${title}</h4>` : ""}<div class="meta">${who ? `<div>${who}</div>` : ""}${has(startDate) ? `<div>${dateRange(startDate, endDate)}</div>` : ""}${has(type) ? `<div>${esc(type)}</div>` : ""}</div></header>${has(description) ? md(description) : ""}${bullets(highlights)}${tags(keywords)}</article>`;
  }));
}

function awards(entries) {
  return section("awards", "Awards", "stack", entries.map(({ awarder, date, summary, title }) => (
    `<article><header>${has(title) ? `<h4>${esc(title)}</h4>` : ""}<div class="meta">${has(awarder) ? `<div>Awarded by <strong>${esc(awarder)}</strong></div>` : ""} ${has(date) ? dateTime(date) : ""}</div></header>${has(summary) ? md(summary) : ""}</article>`
  )));
}

function certificates(entries) {
  return section("certificates", "Certificates", "stack", entries.map(({ date, issuer, name, url }) => {
    const title = link(url, name);
    return `<article><header>${title ? `<h4>${title}</h4>` : ""}<div class="meta">${has(issuer) ? `<div>Issued by <strong>${esc(issuer)}</strong></div>` : ""} ${has(date) ? dateTime(date) : ""}</div></header></article>`;
  }));
}

function publications(entries) {
  return section("publications", "Publications", "stack", entries.map(({ name, publisher, releaseDate, summary, url }) => {
    const title = link(url, name);
    return `<article><header>${title ? `<h4>${title}</h4>` : ""}<div class="meta">${has(publisher) ? `<div>Published by <strong>${esc(publisher)}</strong></div>` : ""}${has(releaseDate) ? dateTime(releaseDate) : ""}</div></header>${has(summary) ? md(summary) : ""}</article>`;
  }));
}

function keywordGroups(id, title, entries) {
  return section(id, title, "grid-list", entries
    .filter(({ name, keywords }) => has(name) || textList(keywords).length)
    .map(({ name, keywords }) => `<div>${has(name) ? `<h4>${esc(name)}</h4>` : ""}${tags(keywords)}</div>`));
}

function languages(entries) {
  return section("languages", "Languages", "grid-list", entries
    .filter(({ language, fluency }) => has(language) || has(fluency))
    .map(({ fluency, language }) => `<div>${has(language) ? `<h4>${esc(language)}</h4>` : ""} ${esc(fluency)}</div>`));
}

function references(entries) {
  return section("references", "References", "stack", entries
    .filter(({ name, reference }) => has(name) || has(reference))
    .map(({ name, reference }) => `<blockquote>${has(reference) ? md(reference) : ""}${has(name) ? `<p><cite>${esc(name)}</cite></p>` : ""}</blockquote>`));
}

// ============================================================================
// DOCUMENT
// ============================================================================

function render(input) {
  const resume = normalizeResume(input);
  const { basics } = resume;
  const style = themeColors(resume.meta);
  return `<!doctype html>
<html lang="en"${style ? ` style="${esc(style)}"` : ""}>
  <head>
    <meta charset="utf-8" />
    ${has(basics.name) ? `<title>${esc(basics.name)}</title>` : "<title>Resume</title>"}
    ${has(basics.summary) ? `<meta name="description" content="${esc(stripMarkdown(basics.summary))}" />` : ""}
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Lato:400,700&display=swap" />
    <style>${CSS}</style>
  </head>
  <body>
    ${header(basics)} ${work(resume.work)} ${volunteer(resume.volunteer)} ${education(resume.education)}
    ${projects(resume.projects)} ${awards(resume.awards)} ${certificates(resume.certificates)}
    ${publications(resume.publications)} ${keywordGroups("skills", "Skills", resume.skills)} ${languages(resume.languages)}
    ${keywordGroups("interests", "Interests", resume.interests)} ${references(resume.references)}
  </body>
</html>`;
}

export default { name: "even", label: "Even", render };
