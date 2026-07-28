// ============================================================================
// RESUME PREVIEW & OVERLAY
// ============================================================================

export function buildResumePreview(resume) {
  const card = document.createElement("div");
  card.className = "resume-preview";

  const header = document.createElement("div");
  header.className = "resume-preview-header";

  const icon = document.createElement("div");
  icon.className = "resume-preview-icon";
  icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;

  const titleGroup = document.createElement("div");
  titleGroup.className = "resume-preview-title-group";

  const title = document.createElement("div");
  title.className = "resume-preview-title";
  title.textContent = "Resume";

  const subtitle = document.createElement("div");
  subtitle.className = "resume-preview-subtitle";
  const name = resume.basics?.name || "";
  const label = resume.basics?.label || "";
  subtitle.textContent = [name, label].filter(Boolean).join(" — ") || "JSON Resume";

  titleGroup.append(title, subtitle);
  header.append(icon, titleGroup);

  const stats = document.createElement("div");
  stats.className = "resume-preview-stats";

  const sections = [
    resume.work?.length && `${resume.work.length} role${resume.work.length > 1 ? "s" : ""}`,
    resume.education?.length && `${resume.education.length} degree${resume.education.length > 1 ? "s" : ""}`,
    resume.skills?.length && `${resume.skills.length} skill group${resume.skills.length > 1 ? "s" : ""}`,
  ].filter(Boolean);

  if (sections.length > 0) {
    const statText = document.createElement("span");
    statText.className = "resume-preview-stat-text";
    statText.textContent = sections.join(" · ");
    stats.appendChild(statText);
  }

  const viewBtn = document.createElement("button");
  viewBtn.className = "resume-preview-btn";
  viewBtn.textContent = "View Resume";
  viewBtn.addEventListener("click", () => {
    buildResumeOverlay(resume);
  });

  card.append(header, stats, viewBtn);
  return card;
}

async function buildResumeOverlay(resume) {
  document.body.style.overflow = "hidden"; // Lock background page scroll

  const overlay = document.createElement("div");
  overlay.className = "resume-overlay";

  const backdrop = document.createElement("div");
  backdrop.className = "resume-overlay-backdrop";

  const container = document.createElement("div");
  container.className = "resume-overlay-container";

  const toolbar = document.createElement("div");
  toolbar.className = "resume-overlay-toolbar";

  const toolbarTitle = document.createElement("div");
  toolbarTitle.className = "resume-overlay-toolbar-title";
  toolbarTitle.textContent = "Resume";

  const toolbarActions = document.createElement("div");
  toolbarActions.className = "resume-overlay-toolbar-actions";

  const printBtn = document.createElement("button");
  printBtn.className = "resume-overlay-print";
  printBtn.textContent = "Print";

  const closeBtn = document.createElement("button");
  closeBtn.className = "resume-overlay-close";
  closeBtn.setAttribute("aria-label", "Close resume");
  closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  toolbarActions.append(printBtn, closeBtn);
  toolbar.append(toolbarTitle, toolbarActions);

  const status = document.createElement("div");
  status.className = "resume-overlay-status";
  const requestedTheme = resume.meta?.theme || "default";
  status.innerHTML = `<span class="spinner-inline"></span>Loading theme: ${requestedTheme}...`;
  
  container.append(toolbar, status);

  // Isolated iframe to prevent CSS bleed
  const frame = document.createElement("iframe");
  frame.className = "resume-document-frame";
  frame.style.cssText = "width:100%; height:100%; border:none; background:#ffffff;";
  container.appendChild(frame);

  overlay.append(backdrop, container);

  function close() {
    document.body.style.overflow = "";
    overlay.classList.add("closing");
    setTimeout(() => overlay.remove(), 250);
  }

  backdrop.addEventListener("click", close);
  closeBtn.addEventListener("click", close);
  
  document.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", onEsc);
    }
  });

  // Append overlay immediately so user sees it right away
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("open"));

  // Async: fetch/render theme content into the iframe
  try {
    const renderedContent = await executeThemeRender(requestedTheme, resume);
    status.remove();

    const frameDoc = frame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(renderedContent);
    frameDoc.close();

    printBtn.addEventListener("click", () => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    });
  } catch (e) {
    console.warn("[resume] Failed to render theme:", e);
    status.textContent = `Failed to load theme "${requestedTheme}"`;
    status.className = "resume-overlay-status error";
  }
}

/**
 * Attempts to render theme via official registry service, falling back to local HTML/CSS builders
 */
async function executeThemeRender(themeName, resume) {
  const cleanTheme = themeName
    .replace(/^jsonresume-theme-/, "")
    .replace(/^@jsonresume\/jsonresume-theme-/, "")
    .trim();

  // 1. Primary Attempt: Query JSON Resume official registry API
  if (cleanTheme && cleanTheme !== "default") {
    try {
      const response = await fetch(`https://registry.jsonresume.org/theme/${cleanTheme}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resume),
      });

      if (response.ok) {
        const html = await response.text();
        if (html && html.trim().length > 0) {
          return html;
        }
      }
    } catch (e) {
      console.warn(`[Resume] Could not render remote theme "${cleanTheme}". Falling back to local default.`, e);
    }
  }

  // 2. Fallback Attempt: Native Local Builder + resume-theme.css
  return await renderLocalFallbackTheme(resume);
}

/**
 * Generates standalone HTML document using local theme styles
 */
async function renderLocalFallbackTheme(resume) {
  const doc = document.createElement("div");
  doc.className = "resume-document";

  renderResumeBasics(doc, resume.basics);
  renderResumeWork(doc, resume.work);
  renderResumeEducation(doc, resume.education);
  renderResumeSkills(doc, resume.skills);
  renderResumeProjects(doc, resume.projects);
  renderResumeAwards(doc, resume.awards);
  renderResumeCertificates(doc, resume.certificates);
  renderResumePublications(doc, resume.publications);
  renderResumeVolunteer(doc, resume.volunteer);
  renderResumeLanguages(doc, resume.languages);
  renderResumeInterests(doc, resume.interests);
  renderResumeReferences(doc, resume.references);

  const cssUrl = new URL("../css/resume-theme.css", import.meta.url).href;
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>${resume.basics?.name || "Resume"}</title>
      <link rel="stylesheet" href="${cssUrl}">
    </head>
    <body>
      ${doc.outerHTML}
    </body>
    </html>
  `;
}

// ============================================================================
// LOCAL DOM BUILDER FUNCTIONS
// ============================================================================

function renderResumeBasics(doc, basics) {
  if (!basics) return;
  const section = document.createElement("div");
  section.className = "resume-section resume-basics";

  if (basics.name || basics.label) {
    const h1 = document.createElement("h1");
    h1.className = "resume-name";
    h1.textContent = basics.name || "";
    section.appendChild(h1);
  }

  if (basics.label) {
    const label = document.createElement("div");
    label.className = "resume-label";
    label.textContent = basics.label;
    section.appendChild(label);
  }

  const contactItems = [];
  if (basics.email) contactItems.push({ label: "Email", value: basics.email, href: `mailto:${basics.email}` });
  if (basics.phone) contactItems.push({ label: "Phone", value: basics.phone, href: `tel:${basics.phone}` });
  if (basics.url) contactItems.push({ label: "Website", value: basics.url, href: basics.url });
  if (basics.location) {
    const loc = [basics.location.city, basics.location.region, basics.location.countryCode].filter(Boolean).join(", ");
    if (loc) contactItems.push({ label: "Location", value: loc });
  }

  if (basics.summary) {
    const summary = document.createElement("p");
    summary.className = "resume-summary";
    summary.textContent = basics.summary;
    section.appendChild(summary);
  }

  if (contactItems.length > 0) {
    const contactRow = document.createElement("div");
    contactRow.className = "resume-contact-row";
    contactItems.forEach((item) => {
      const span = document.createElement("span");
      span.className = "resume-contact-item";
      if (item.href) {
        const a = document.createElement("a");
        a.href = item.href;
        a.textContent = item.value;
        if (item.href.startsWith("http")) a.target = "_blank";
        span.appendChild(a);
      } else {
        span.textContent = item.value;
      }
      contactRow.appendChild(span);
    });
    section.appendChild(contactRow);
  }

  if (basics.profiles?.length > 0) {
    const profiles = document.createElement("div");
    profiles.className = "resume-contact-row";
    basics.profiles.forEach((p) => {
      if (!p.url) return;
      const span = document.createElement("span");
      span.className = "resume-contact-item";
      const a = document.createElement("a");
      a.href = p.url;
      a.target = "_blank";
      a.textContent = p.network || p.url;
      span.appendChild(a);
      profiles.appendChild(span);
    });
    if (profiles.children.length > 0) section.appendChild(profiles);
  }

  doc.appendChild(section);
}

function renderResumeSection(doc, title, items, renderer) {
  if (!items || items.length === 0) return;
  const section = document.createElement("div");
  section.className = "resume-section";

  const h2 = document.createElement("h2");
  h2.className = "resume-section-title";
  h2.textContent = title;
  section.appendChild(h2);

  items.forEach((item) => section.appendChild(renderer(item)));

  doc.appendChild(section);
}

function renderResumeWork(doc, work) {
  renderResumeSection(doc, "Work Experience", work, (w) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    const header = document.createElement("div");
    header.className = "resume-entry-header";

    const left = document.createElement("div");
    const position = document.createElement("div");
    position.className = "resume-entry-title";
    position.textContent = w.position || "";
    const company = document.createElement("div");
    company.className = "resume-entry-subtitle";
    company.textContent = w.company || w.name || "";
    left.append(position, company);

    const right = document.createElement("div");
    right.className = "resume-entry-dates";
    const start = w.startDate || "";
    const end = w.endDate || "Present";
    if (start) right.textContent = `${start} – ${end}`;

    header.append(left, right);

    if (w.summary) {
      const summary = document.createElement("p");
      summary.className = "resume-entry-text";
      summary.textContent = w.summary;
      entry.append(header, summary);
    } else {
      entry.appendChild(header);
    }

    if (w.highlights?.length > 0) {
      const ul = document.createElement("ul");
      ul.className = "resume-entry-list";
      w.highlights.forEach((h) => {
        const li = document.createElement("li");
        li.textContent = h;
        ul.appendChild(li);
      });
      entry.appendChild(ul);
    }

    return entry;
  });
}

function renderResumeEducation(doc, education) {
  renderResumeSection(doc, "Education", education, (e) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    const header = document.createElement("div");
    header.className = "resume-entry-header";

    const left = document.createElement("div");
    const degree = document.createElement("div");
    degree.className = "resume-entry-title";
    degree.textContent = [e.studyType, e.area].filter(Boolean).join(" in ") || "";
    const institution = document.createElement("div");
    institution.className = "resume-entry-subtitle";
    institution.textContent = e.institution || "";
    left.append(degree, institution);

    const right = document.createElement("div");
    right.className = "resume-entry-dates";
    const start = e.startDate || "";
    const end = e.endDate || "";
    if (start) right.textContent = end ? `${start} – ${end}` : start;

    header.append(left, right);
    entry.appendChild(header);

    if (e.score) {
      const score = document.createElement("div");
      score.className = "resume-entry-text";
      score.textContent = `GPA: ${e.score}`;
      entry.appendChild(score);
    }

    if (e.courses?.length > 0) {
      const courses = document.createElement("div");
      courses.className = "resume-entry-text";
      courses.textContent = `Courses: ${e.courses.join(", ")}`;
      entry.appendChild(courses);
    }

    return entry;
  });
}

function renderResumeSkills(doc, skills) {
  renderResumeSection(doc, "Skills", skills, (s) => {
    const entry = document.createElement("div");
    entry.className = "resume-skill-group";

    const name = document.createElement("span");
    name.className = "resume-skill-name";
    name.textContent = s.name || "";

    if (s.level) {
      const level = document.createElement("span");
      level.className = "resume-skill-level";
      level.textContent = s.level;
      name.appendChild(level);
    }

    entry.appendChild(name);

    if (s.keywords?.length > 0) {
      const keywords = document.createElement("div");
      keywords.className = "resume-skill-keywords";
      s.keywords.forEach((k) => {
        const tag = document.createElement("span");
        tag.className = "resume-skill-tag";
        tag.textContent = k;
        keywords.appendChild(tag);
      });
      entry.appendChild(keywords);
    }

    return entry;
  });
}

function renderResumeProjects(doc, projects) {
  renderResumeSection(doc, "Projects", projects, (p) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    const header = document.createElement("div");
    header.className = "resume-entry-header";

    const left = document.createElement("div");
    const name = document.createElement("div");
    name.className = "resume-entry-title";
    name.textContent = p.name || "";
    left.appendChild(name);

    const right = document.createElement("div");
    right.className = "resume-entry-dates";
    const start = p.startDate || "";
    const end = p.endDate || "";
    if (start) right.textContent = end ? `${start} – ${end}` : start;

    header.append(left, right);
    entry.appendChild(header);

    if (p.description) {
      const desc = document.createElement("p");
      desc.className = "resume-entry-text";
      desc.textContent = p.description;
      entry.appendChild(desc);
    }

    if (p.highlights?.length > 0) {
      const ul = document.createElement("ul");
      ul.className = "resume-entry-list";
      p.highlights.forEach((h) => {
        const li = document.createElement("li");
        li.textContent = h;
        ul.appendChild(li);
      });
      entry.appendChild(ul);
    }

    if (p.keywords?.length > 0) {
      const tags = document.createElement("div");
      tags.className = "resume-skill-keywords";
      p.keywords.forEach((k) => {
        const tag = document.createElement("span");
        tag.className = "resume-skill-tag";
        tag.textContent = k;
        tags.appendChild(tag);
      });
      entry.appendChild(tags);
    }

    return entry;
  });
}

function renderResumeAwards(doc, awards) {
  renderResumeSection(doc, "Awards", awards, (a) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    const title = document.createElement("div");
    title.className = "resume-entry-title";
    title.textContent = a.title || "";
    entry.appendChild(title);

    const details = [];
    if (a.date) details.push(a.date);
    if (a.awarder) details.push(a.awarder);
    if (details.length > 0) {
      const sub = document.createElement("div");
      sub.className = "resume-entry-subtitle";
      sub.textContent = details.join(" · ");
      entry.appendChild(sub);
    }

    if (a.summary) {
      const p = document.createElement("p");
      p.className = "resume-entry-text";
      p.textContent = a.summary;
      entry.appendChild(p);
    }

    return entry;
  });
}

function renderResumeCertificates(doc, certificates) {
  renderResumeSection(doc, "Certificates", certificates, (c) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    const title = document.createElement("div");
    title.className = "resume-entry-title";
    title.textContent = c.name || c.title || "";
    entry.appendChild(title);

    const details = [];
    if (c.date) details.push(c.date);
    if (c.issuer) details.push(c.issuer);
    if (details.length > 0) {
      const sub = document.createElement("div");
      sub.className = "resume-entry-subtitle";
      sub.textContent = details.join(" · ");
      entry.appendChild(sub);
    }

    if (c.url) {
      const link = document.createElement("a");
      link.href = c.url;
      link.target = "_blank";
      link.className = "resume-entry-link";
      link.textContent = "View Certificate";
      entry.appendChild(link);
    }

    return entry;
  });
}

function renderResumePublications(doc, publications) {
  renderResumeSection(doc, "Publications", publications, (p) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    const title = document.createElement("div");
    title.className = "resume-entry-title";
    title.textContent = p.name || "";
    entry.appendChild(title);

    const details = [];
    if (p.publisher) details.push(p.publisher);
    if (p.releaseDate) details.push(p.releaseDate);
    if (details.length > 0) {
      const sub = document.createElement("div");
      sub.className = "resume-entry-subtitle";
      sub.textContent = details.join(" · ");
      entry.appendChild(sub);
    }

    if (p.summary) {
      const pEl = document.createElement("p");
      pEl.className = "resume-entry-text";
      pEl.textContent = p.summary;
      entry.appendChild(pEl);
    }

    if (p.url) {
      const a = document.createElement("a");
      a.className = "resume-entry-link";
      a.href = p.url;
      a.target = "_blank";
      a.textContent = p.url;
      entry.appendChild(a);
    }

    return entry;
  });
}

function renderResumeVolunteer(doc, volunteer) {
  renderResumeSection(doc, "Volunteer", volunteer, (v) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    const header = document.createElement("div");
    header.className = "resume-entry-header";

    const left = document.createElement("div");
    const position = document.createElement("div");
    position.className = "resume-entry-title";
    position.textContent = v.position || "";
    const org = document.createElement("div");
    org.className = "resume-entry-subtitle";
    org.textContent = v.organization || "";
    left.append(position, org);

    const right = document.createElement("div");
    right.className = "resume-entry-dates";
    const start = v.startDate || "";
    const end = v.endDate || "";
    if (start) right.textContent = end ? `${start} – ${end}` : start;

    header.append(left, right);
    entry.appendChild(header);

    if (v.summary) {
      const p = document.createElement("p");
      p.className = "resume-entry-text";
      p.textContent = v.summary;
      entry.appendChild(p);
    }

    if (v.highlights?.length > 0) {
      const ul = document.createElement("ul");
      ul.className = "resume-entry-list";
      v.highlights.forEach((h) => {
        const li = document.createElement("li");
        li.textContent = h;
        ul.appendChild(li);
      });
      entry.appendChild(ul);
    }

    return entry;
  });
}

function renderResumeLanguages(doc, languages) {
  renderResumeSection(doc, "Languages", languages, (l) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry resume-entry-inline";

    const name = document.createElement("span");
    name.className = "resume-entry-title";
    name.textContent = l.language || "";
    entry.appendChild(name);

    if (l.fluency) {
      const fluency = document.createElement("span");
      fluency.className = "resume-entry-subtitle";
      fluency.textContent = l.fluency;
      entry.appendChild(fluency);
    }

    return entry;
  });
}

function renderResumeInterests(doc, interests) {
  renderResumeSection(doc, "Interests", interests, (i) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    const name = document.createElement("div");
    name.className = "resume-entry-title";
    name.textContent = i.name || "";
    entry.appendChild(name);

    if (i.keywords?.length > 0) {
      const keywords = document.createElement("div");
      keywords.className = "resume-skill-keywords";
      i.keywords.forEach((k) => {
        const tag = document.createElement("span");
        tag.className = "resume-skill-tag";
        tag.textContent = k;
        keywords.appendChild(tag);
      });
      entry.appendChild(keywords);
    }

    return entry;
  });
}

function renderResumeReferences(doc, references) {
  renderResumeSection(doc, "References", references, (r) => {
    const entry = document.createElement("div");
    entry.className = "resume-entry";

    if (r.name) {
      const name = document.createElement("div");
      name.className = "resume-entry-title";
      name.textContent = r.name;
      entry.appendChild(name);
    }

    if (r.reference) {
      const ref = document.createElement("blockquote");
      ref.className = "resume-entry-text";
      ref.textContent = r.reference;
      entry.appendChild(ref);
    }

    return entry;
  });
}