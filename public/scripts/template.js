// ============================================================================
// RESUME FIELD SPECS + STARTER TEMPLATE
// One source of truth for the editor's forms and the placeholder template.
// Field: [key, label, kind?, placeholder?] — kind: text | textarea | url |
// email | tel | date | list. No sample data: placeholders only.
// ============================================================================

export const BASICS_FIELDS = [
  ["name", "Name", "text", "Full name"],
  ["label", "Title", "text", "Job title"],
  ["email", "Email", "email", "name@email.com"],
  ["phone", "Phone", "tel", "Phone number"],
  ["url", "Website", "url", "https://your-site.com"],
  ["image", "Photo URL", "url", "https://…/photo.jpg"],
  ["summary", "Summary", "textarea", "A few sentences about you and your work."],
];

export const LOCATION_FIELDS = [
  ["city", "City", "text", "City"],
  ["region", "Region", "text", "Region / state"],
  ["countryCode", "Country code", "text", "Country code (e.g. US)"],
  ["address", "Address", "text", "Street address"],
  ["postalCode", "Postal code", "text", "Postal code"],
];

export const PROFILE_FIELDS = [
  ["network", "Network", "text", "Network (e.g. LinkedIn)"],
  ["username", "Username", "text", "Username"],
  ["url", "URL", "url", "https://…/username"],
];

const START = ["startDate", "Start", "date", "YYYY-MM"];
const END = ["endDate", "End (empty = present)", "date", "YYYY-MM"];

export const SECTIONS = [
  { key: "work", label: "Experience", noun: "position", title: (i) => [i.position, i.name].filter(Boolean).join(" · "),
    fields: [["position", "Position", "text", "Position"], ["name", "Company", "text", "Company name"], ["url", "Website", "url", "https://company.com"], ["location", "Location", "text", "City, country"], START, END, ["summary", "Summary", "textarea", "What you did there."], ["highlights", "Highlights", "list", "One achievement per line"]] },
  { key: "projects", label: "Projects", noun: "project", title: (i) => i.name,
    fields: [["name", "Name", "text", "Project name"], ["description", "Description", "textarea", "What the project is."], ["url", "Link", "url", "https://project-link.com"], ["entity", "Organization", "text", "Organization"], ["type", "Type", "text", "Type (e.g. application)"], START, ["endDate", "End", "date", "YYYY-MM"], ["roles", "Roles", "list", "One role per line"], ["keywords", "Keywords", "list", "One keyword per line"], ["highlights", "Highlights", "list", "One highlight per line"], ["image", "Image URL", "url", "https://…/image.jpg"]] },
  { key: "education", label: "Education", noun: "school", title: (i) => [i.studyType, i.area, i.institution].filter(Boolean).join(" · "),
    fields: [["institution", "Institution", "text", "Institution name"], ["url", "Website", "url", "https://institution.edu"], ["studyType", "Degree", "text", "Degree (e.g. Bachelor)"], ["area", "Field", "text", "Field of study"], START, ["endDate", "End", "date", "YYYY-MM"], ["score", "Score", "text", "Score / GPA"], ["courses", "Courses", "list", "One course per line"]] },
  { key: "skills", label: "Skills", noun: "skill group", title: (i) => i.name,
    fields: [["name", "Group name", "text", "Skill group"], ["level", "Level (e.g. Advanced, or 0–100)", "text", "Level"], ["keywords", "Skills", "list", "One skill per line"]] },
  { key: "certificates", label: "Certificates", noun: "certificate", title: (i) => i.name,
    fields: [["name", "Name", "text", "Certificate name"], ["issuer", "Issuer", "text", "Issuer"], ["date", "Date", "date", "YYYY-MM"], ["url", "Link", "url", "https://…"]] },
  { key: "awards", label: "Awards", noun: "award", title: (i) => i.title,
    fields: [["title", "Title", "text", "Award title"], ["awarder", "Awarded by", "text", "Awarded by"], ["date", "Date", "date", "YYYY-MM"], ["summary", "Summary", "textarea", "What it was for."]] },
  { key: "publications", label: "Publications", noun: "publication", title: (i) => i.name,
    fields: [["name", "Title", "text", "Publication title"], ["publisher", "Publisher", "text", "Publisher"], ["releaseDate", "Date", "date", "YYYY-MM"], ["url", "Link", "url", "https://…"], ["summary", "Summary", "textarea", "Short summary."]] },
  { key: "volunteer", label: "Volunteering", noun: "role", title: (i) => [i.position, i.organization].filter(Boolean).join(" · "),
    fields: [["position", "Role", "text", "Role"], ["organization", "Organization", "text", "Organization"], ["url", "Website", "url", "https://…"], START, ["endDate", "End", "date", "YYYY-MM"], ["summary", "Summary", "textarea", "What you did."], ["highlights", "Highlights", "list", "One highlight per line"]] },
  { key: "languages", label: "Languages", noun: "language", title: (i) => [i.language, i.fluency].filter(Boolean).join(" · "),
    fields: [["language", "Language", "text", "Language"], ["fluency", "Fluency", "text", "Fluency (e.g. Native)"]] },
  { key: "interests", label: "Interests", noun: "interest", title: (i) => i.name,
    fields: [["name", "Interest", "text", "Interest"], ["keywords", "Keywords", "list", "One keyword per line"]] },
  { key: "references", label: "References", noun: "reference", title: (i) => i.name,
    fields: [["name", "Name", "text", "Referee name"], ["reference", "Reference", "textarea", "What they said about you."]] },
];

/** Value a placeholder would have as JSON (lists become one-item arrays). */
function placeholderValue([, label, kind, ph]) {
  const text = ph || label;
  return kind === "list" ? [text] : text;
}

function itemFrom(fields) {
  return Object.fromEntries(fields.map((f) => [f[0], placeholderValue(f)]));
}

/**
 * A resume whose values are the placeholder labels ("Full name", "Job title"…),
 * with one item in every section. Used by Preview's "Load template".
 */
export function templateResume() {
  const basics = itemFrom(BASICS_FIELDS);
  delete basics.image; // a fake URL would render as a broken photo
  basics.location = itemFrom(LOCATION_FIELDS);
  basics.profiles = [itemFrom(PROFILE_FIELDS)];
  const resume = { basics };
  for (const s of SECTIONS) {
    const item = itemFrom(s.fields);
    delete item.image;
    for (const [key, , kind] of s.fields) if (kind === "date") item[key] = "2024-01";
    if (s.key === "skills") item.level = "Advanced";
    resume[s.key] = [item];
  }
  return resume;
}

/** An empty resume with one blank item per section, so the editor shows placeholders. */
export function blankScaffold() {
  const resume = { basics: { name: "" } };
  for (const s of SECTIONS) resume[s.key] = [{}];
  return resume;
}
