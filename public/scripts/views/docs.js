// ============================================================================
// DOCS — a guide (written here) plus the settings reference (generated from
// CONFIG_SCHEMA). Sidebar on desktop, a "Contents" menu on phones, and the
// current section is highlighted while you scroll.
// ============================================================================

import { h, svgIcon, copyText, toast } from "../utils.js";
import { ICONS } from "../icons.js";
import { CONFIG_SCHEMA } from "../config.js";
import { BASE_PATH } from "../router.js";
import { siteHeader } from "./site-header.js";

// ---------------------------------------------------------------------------
// Small content helpers
// ---------------------------------------------------------------------------

const p = (...c) => h("p", ...c);
const code = (t) => h("code", t);
const ul = (...items) => h("ul", items.map((i) => h("li", i)));
const ol = (...items) => h("ol", items.map((i) => h("li", i)));
const link = (href, text) => h("a", { href }, text);
const note = (...c) => h("aside.docs-note", svgIcon(ICONS.alert), h("div", ...c));

function codeBlock(text, label = "") {
  return h("div.docs-code",
    h("div.docs-code-bar",
      h("span", label),
      h("button.docs-copy", { type: "button", onclick: async () => toast((await copyText(text)) ? "Copied" : "Couldn't copy") }, svgIcon(ICONS.copy), "Copy"),
    ),
    h("pre", h("code", text)),
  );
}

function table(head, rows) {
  return h("div.table-wrap",
    h("table.docs-table",
      h("thead", h("tr", head.map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", rows.map((r) => h("tr", r.map((c, i) => (i ? h("td", c) : h("th", { scope: "row" }, c)))))),
    ),
  );
}

// ---------------------------------------------------------------------------
// Guide
// ---------------------------------------------------------------------------

const host = () => `${location.host}${BASE_PATH}`;

const GUIDE = [
  {
    group: "Getting started",
    pages: [
      { id: "overview", title: "Overview", body: () => [
        p("mz-portfolio turns what you've done into a fast, mobile-first portfolio: a profile, projects, experience, a blog and a printable resume. You edit it right on the page."),
        p("There's no server and no account to create here. Your portfolio is saved to your own GitHub as a gist, and anyone can open it at a short link with your username."),
        ul(
          [h("strong", "Editing on the page."), " Every part has an Edit button that opens a panel."],
          [h("strong", "GitHub, merged."), " Your repos, languages and photo fill in on their own."],
          [h("strong", "Yours to keep."), " The data is plain JSON you can export at any time, compatible with JSON Resume tools."],
        ),
      ] },
      { id: "create", title: "Create your portfolio", body: () => [
        ol(
          ["Click ", link(`${BASE_PATH}edit`, "Create your portfolio"), " or ", h("strong", "Sign in"), ". GitHub asks only for permission to create gists."],
          ["Your portfolio opens in edit mode. Even with just a name it looks finished; fill in what you have."],
          [h("strong", "Publish"), ". Your portfolio is live at ", code(`${host()}your-username`), "."],
        ),
        p("Not ready to sign in? ", link(`${BASE_PATH}preview`, "Try it"), " lets you build one in this browser first, then sign in to publish it."),
      ] },
      { id: "addresses", title: "Addresses", body: () => [
        table(["Address", "Opens"], [
          [code("/username"), "A GitHub user's portfolio"],
          [code("/<drive-id>"), "A portfolio stored in Google Drive"],
          [code("/<id>/project/<slug>"), "One project's page"],
          [code("/<id>/blog"), "The blog, and each post under it"],
          [code("/<id>/tab/<slug>"), "A custom tab"],
          [code("/<id>/resume"), "The resume viewer"],
          [code("/<id>#projects"), "Scrolls to a section"],
        ]),
        p("GitHub usernames and Drive IDs look different, so one address form covers both. ", code("/gh/username"), " still works and redirects. Add ", code("?gistname=cv"), " to load ", code("cv.json"), " instead of the default file."),
      ] },
    ],
  },
  {
    group: "Editing",
    pages: [
      { id: "edit-mode", title: "Edit mode", body: () => [
        p("Open your own portfolio while signed in and click ", h("strong", "Edit portfolio"), ". Other people's portfolios never show edit controls."),
        ul(
          [h("strong", "Edit buttons."), " Every object (your profile, the banner, each job, school, skill group, project and post) has one. It opens a panel: a bottom sheet on phones, a side panel on desktop, with the page updating live beside it."],
          [h("strong", "Sections."), " Each section title has Add, move up/down and Hide. Hidden and empty sections can be brought back at the bottom of the page."],
          [h("strong", "Customize"), " (top bar) holds colors, layout, animations, tabs and every setting in the ", link("#reference", "reference"), " below."],
          [h("strong", "Undo and redo"), " with Ctrl+Z and Ctrl+Shift+Z; Ctrl+S publishes; ? lists all shortcuts."],
        ),
      ] },
      { id: "drafts", title: "Drafts and publishing", body: () => [
        p("Changes are a draft until you publish. The draft is kept in this browser automatically."),
        ul(
          [h("strong", "Save draft to GitHub"), " (the ⋯ menu) stores it in a secret gist named ", code("mz-portfolio-draft.json"), ", so you can continue on another device. It's deleted when you publish."],
          [h("strong", "Publish"), " updates your portfolio's gist, or creates it the first time. Empty fields are dropped. If the gist changed elsewhere since you opened it, you choose which version wins."],
        ),
      ] },
      { id: "projects", title: "Projects and GitHub", body: () => [
        p("Projects you add are matched with your GitHub repos by name or link, picking up their README, languages and images. Repos you didn't add can be shown too (see ", code("projects.github"), ")."),
        p("Each project has its own page, and that's where you edit it, including a cover image. A repo that only comes from GitHub has ", h("strong", "Add to my resume"), " (then it's fully editable) and ", h("strong", "Hide this repo"), "."),
      ] },
      { id: "blog", title: "Blog", body: () => [
        p("Click ", h("strong", "New post"), " on the blog page while editing. Posts are written in Markdown, and each one is saved as its own gist, published separately from the rest of the portfolio."),
        p("Public gists with a ", code(".md"), " file show up as posts. For Drive portfolios, ", code(".md"), " files in the folder do."),
      ] },
      { id: "images", title: "Photos and images", body: () => [
        p("Your photo can be your GitHub avatar, an upload, a link, or none. The banner can be a gradient or an image. Uploads are resized in the browser and stored in a gist on your account, so nothing depends on a third-party host."),
      ] },
    ],
  },
  {
    group: "Your data",
    pages: [
      { id: "storage", title: "Where it's stored", body: () => [
        p("Everything lives in one JSON file, ", code("resume.json"), ", in a gist on your GitHub account. Content follows the open JSON Resume format, so other tools can read it; settings are kept beside it."),
        table(["Part", "Where in the file"], [
          ["Your content", [code("basics"), ", ", code("work"), ", ", code("projects"), " and the other sections"]],
          ["Portfolio settings", code("meta[\"mz-portfolio-config\"]")],
          ["Resume theme", code("meta.theme")],
        ]),
        p("You can copy or download the whole file from the ⋯ menu while editing."),
      ] },
      { id: "import", title: "Import a JSON Resume", body: () => [
        p("Already have a resume.json from another tool? Open ", link(`${BASE_PATH}preview`, "Try it"), ", drop the file in, and choose Edit it. Unknown fields are kept as they are."),
      ] },
      { id: "drive", title: "Google Drive", body: () => [
        p("Share a ", code("resume.json"), " file, or a folder containing it, as ", h("em", "Anyone with the link"), ", then open ", code(`${host()}<file-or-folder-id>`), ". You can also paste the full Drive link into the box on the home page."),
        note("Drive portfolios are read-only here: edit the file in Drive. Site owners need a Google API key; see the README."),
      ] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Reference (generated)
// ---------------------------------------------------------------------------

function isLeaf(node) {
  return node && typeof node === "object" && "type" in node && "desc" in node;
}

function typeLabel(node) {
  if (node.type === "enum") return node.values.map((v) => `"${v}"`).join(" · ");
  if (node.type === "array") return node.values ? `list: ${node.values.join(", ")}` : "list of text";
  if (node.type === "map") return `object: ${node.keys.join(", ")}`;
  if (node.type === "color") return "color";
  if (node.type === "tabs") return "list of tabs";
  if (node.type === "number") return `number, ${node.min} to ${node.max}`;
  return node.type === "string" ? "text" : node.type;
}

function defaultLabel(node) {
  const d = node.default;
  if (d === "" || d === undefined) return null;
  if (Array.isArray(d) && !d.length) return null;
  return JSON.stringify(d);
}

function options(schema, path = []) {
  const out = [];
  for (const [key, node] of Object.entries(schema)) {
    if (key.startsWith("_")) continue;
    const at = [...path, key];
    if (isLeaf(node)) {
      const def = defaultLabel(node);
      out.push(h("div.docs-option", { id: `opt-${at.join("-")}` },
        h("div.docs-option-head", h("code.docs-option-name", at.join(".")), h("span.docs-option-type", typeLabel(node))),
        h("p", node.desc),
        def ? h("p.docs-option-default", "Default: ", code(def)) : null,
      ));
    } else {
      if (node._desc && path.length) out.push(h("h4.docs-subgroup", code(at.join(".")), " ", h("span", node._desc)));
      out.push(...options(node, at));
    }
  }
  return out;
}

const EXAMPLE = `"meta": {
  "theme": "even",
  "mz-portfolio-config": {
    "colors": { "accent": "#2f5d62", "prime": "#3b3a5a" },
    "text": { "tagline": "Your tagline", "sections": { "work": "Experience" } },
    "sections": { "order": ["about", "projects", "work"], "hide": ["references"] },
    "projects": { "layout": "grid", "github": "matched" },
    "animation": { "intro": "dissolve", "speed": 1 }
  }
}`;

const THEMES = ["even", "elegant", "flat", "kendall", "stackoverflow", "macchiato", "onepage", "professional"];

function referencePages() {
  const intro = { id: "reference", title: "Settings reference", body: () => [
    p("Everything here can be changed from ", h("strong", "Customize"), " while editing, so you rarely need this page. It's the full list, for when you want to know exactly what an option does or edit the JSON by hand. Every option is optional."),
    codeBlock(EXAMPLE, "resume.json"),
    p("Resume themes: ", THEMES.map((t, i) => [i ? ", " : "", code(t)]), ". Any other name is looked up in the JSON Resume theme registry, falling back to ", code("even"), "."),
  ] };
  const groups = Object.entries(CONFIG_SCHEMA).map(([key, node]) => ({
    id: `cfg-${key}`,
    title: key,
    mono: true,
    body: () => [
      node._desc && !isLeaf(node) ? p(node._desc) : null,
      h("div.docs-options", isLeaf(node) ? options({ [key]: node }) : options(node, [key])),
    ],
  }));
  return [intro, ...groups];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function renderDocs() {
  document.title = "Docs — mz-portfolio";
  const groups = [...GUIDE, { group: "Reference", pages: referencePages() }];

  const navLinks = [];
  const nav = h("nav.docs-nav", { "aria-label": "Docs" },
    groups.map((g) =>
      h("div.docs-nav-group",
        h("p.docs-nav-title", g.group),
        h("ul", g.pages.map((pg) => {
          const a = h(`a${pg.mono ? ".is-mono" : ""}`, { href: `#${pg.id}`, dataset: { target: pg.id } }, pg.title);
          navLinks.push(a);
          return h("li", a);
        })),
      )),
  );

  // Phones: the nav folds into a "Contents" menu
  const contents = h("details.docs-contents", h("summary", svgIcon(ICONS.menu), "Contents"), nav);
  const wide = matchMedia("(min-width: 960px)");
  const syncOpen = () => (contents.open = wide.matches);
  syncOpen();
  wide.addEventListener("change", syncOpen);
  nav.addEventListener("click", (e) => e.target.closest("a") && !wide.matches && (contents.open = false));

  const article = h("article.docs-article",
    h("header.docs-intro",
      h("h1", "Docs"),
      h("p.docs-lead", "How mz-portfolio works, how to edit and publish, where your data lives, and every setting."),
    ),
    groups.map((g) =>
      h("section.docs-part", { "aria-label": g.group },
        h("p.docs-part-title", g.group),
        g.pages.map((pg) =>
          h("section.docs-section", { id: pg.id },
            h("h2", pg.mono ? code(pg.title) : pg.title, h("a.docs-anchor", { href: `#${pg.id}`, "aria-label": `Link to ${pg.title}` }, "#")),
            ...[].concat(pg.body()).filter(Boolean),
          )),
      )),
  );

  document.getElementById("app").replaceChildren(
    h("div.docs.docs-page",
      siteHeader("docs"),
      h("div.docs-layout",
        h("aside.docs-sidebar", contents),
        h("main.docs-body", { id: "main", tabindex: "-1" }, article),
      ),
    ),
  );

  // Highlight the section being read
  const sections = [...article.querySelectorAll(".docs-section")];
  const mark = () => {
    if (!article.isConnected) return removeEventListener("scroll", mark);
    let current = sections[0];
    const line = (document.querySelector(".docs-sidebar")?.getBoundingClientRect().bottom || 0) + 60;
    for (const s of sections) if (s.getBoundingClientRect().top < Math.max(140, line)) current = s;
    navLinks.forEach((a) => a.toggleAttribute("aria-current", a.dataset.target === current?.id));
    // keep the highlighted link visible in the sidebar's own scroll
    const side = document.querySelector(".docs-sidebar");
    const active = nav.querySelector("a[aria-current]");
    if (wide.matches && side && active) {
      const top = active.getBoundingClientRect().top - side.getBoundingClientRect().top + side.scrollTop;
      if (top < side.scrollTop + 40 || top > side.scrollTop + side.clientHeight - 60) side.scrollTop = top - side.clientHeight / 3;
    }
  };
  addEventListener("scroll", mark, { passive: true });
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  requestAnimationFrame(mark);
}
