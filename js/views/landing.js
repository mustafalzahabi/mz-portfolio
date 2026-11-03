// ============================================================================
// LANDING PAGE
// ============================================================================

import { h, svgIcon } from "../utils.js";
import { ICONS } from "../icons.js";
import { BASE_PATH, detectSource, portfolioPath, navigate } from "../router.js";
import { getRecent, clearRecent } from "../data.js";
import { buildThemeToggle } from "../theme.js";

const FEATURES = [
  { icon: "zap", title: "Live from your resume", text: "Edit your resume.json gist or Drive file and the portfolio updates. No build, no deploy." },
  { icon: "doc", title: "Your JSON Resume theme", text: "The resume viewer renders popular JSON Resume themes natively — set meta.theme and it looks the same." },
  { icon: "merge", title: "Projects, merged", text: "Resume projects are matched with your GitHub repos, adding stars, READMEs and images." },
  { icon: "palette", title: "Colors & dark mode", text: "Ten color tokens with dark mode generated automatically. Change any of them from your resume." },
  { icon: "phoneDevice", title: "Mobile first", text: "Designed for phones first, with a full desktop layout. Works offline after the first visit." },
  { icon: "sliders", title: "Fully configurable", text: "Section order, layouts, animations, texts and more — all from meta in your resume.json." },
];

export function renderLanding() {
  document.title = "mz-portfolio — turn your resume.json into a portfolio";
  const app = document.getElementById("app");

  const input = h("input.input.landing-input", {
    id: "portfolio-id",
    type: "text",
    inputmode: "url",
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: "false",
    placeholder: "GitHub username or Drive link",
    required: true,
    "aria-describedby": "source-hint",
  });
  const hint = h("p.landing-hint", { id: "source-hint", "aria-live": "polite" }, "Enter a GitHub username, or paste a Google Drive file or folder link.");

  input.addEventListener("input", () => {
    const { source, id } = detectSource(input.value);
    hint.dataset.state = input.value && !id ? "error" : "";
    hint.textContent = !input.value
      ? "Enter a GitHub username, or paste a Google Drive file or folder link."
      : source === "gd"
        ? `Google Drive · ${id}`
        : source === "auto" || source === "gh"
          ? `GitHub · github.com/${id}`
          : "That doesn't look like a GitHub username or a Drive link.";
  });

  const form = h("form.landing-form", {
    role: "search",
    onsubmit: (e) => {
      e.preventDefault();
      const { source, id } = detectSource(input.value);
      if (!id || !source) {
        input.focus();
        return;
      }
      navigate(portfolioPath(id));
    },
  },
    h("label.visually-hidden", { for: "portfolio-id" }, "GitHub username or Google Drive link"),
    h("div.landing-field", svgIcon(ICONS.search), input, h("button.btn.btn-primary", { type: "submit" }, "Open portfolio")),
    hint,
  );

  const recent = getRecent();
  const recentBlock = recent.length
    ? h("section.landing-recent", { "aria-labelledby": "recent-title" },
        h("div.landing-recent-head",
          h("h2.landing-h3", { id: "recent-title" }, "Recently viewed"),
          h("button.link-btn", { type: "button", onclick: (e) => { clearRecent(); e.target.closest("section").remove(); } }, "Clear"),
        ),
        h("ul.chip-list", { role: "list" }, recent.map((r) => h("li", h("a.chip", { href: portfolioPath(r.id) }, r.name)))),
      )
    : null;

  const toggle = buildThemeToggle("switch");

  app.replaceChildren(
    h("div.landing",
      h("header.landing-top",
        h("a.brand", { href: BASE_PATH, "aria-label": "mz-portfolio home" }, h("span.brand-mark", "mz"), h("span", "portfolio")),
        h("nav.landing-links", { "aria-label": "Site" },
          h("a", { href: `${BASE_PATH}preview` }, "Preview"),
          h("a", { href: `${BASE_PATH}docs` }, "Docs"),
          toggle,
        ),
      ),
      h("main.landing-main", { id: "main", tabindex: "-1" },
        h("section.landing-hero",
          h("p.eyebrow", "JSON Resume → portfolio"),
          h("h1.landing-title", "Your resume, as a living portfolio."),
          h("p.landing-lead", "Point it at a resume.json in a public GitHub gist or Google Drive and get a themed, responsive portfolio with projects, a blog and a printable resume."),
          form,
          recentBlock,
        ),
        h("section.landing-features", { "aria-label": "Features" },
          FEATURES.map((f) => h("article.card.feature", h("div.feature-icon", svgIcon(ICONS[f.icon])), h("h2.landing-h3", f.title), h("p", f.text))),
        ),
        h("section.landing-steps", { "aria-labelledby": "steps-title" },
          h("h2.landing-h2", { id: "steps-title" }, "How it works"),
          h("ol.steps",
            h("li", h("strong", "Write a resume.json"), h("span", " following the ", h("a", { href: "https://jsonresume.org/schema/" }, "JSON Resume schema"), ". Check it in ", h("a", { href: `${BASE_PATH}preview` }, "Preview"), " first.")),
            h("li", h("strong", "Publish it"), h("span", " as a public gist named resume.json, or a Drive file shared with “Anyone with the link”.")),
            h("li", h("strong", "Share your link"), h("span", ` — ${location.host}${BASE_PATH}your-username. Public gists with a .md file become blog posts.`)),
          ),
        ),
        h("section.landing-config", { "aria-labelledby": "config-title" },
          h("h2.landing-h2", { id: "config-title" }, "Configured from your resume"),
          h("p", "Add a ", h("code", "meta[\"mz-portfolio-config\"]"), " block to your resume.json to change colors, layout, sections and animations. Everything is optional."),
          h("pre.code-sample", h("code", `"meta": {
  "theme": "elegant",
  "mz-portfolio-config": {
    "colors": { "accent": "#2f5d62" },
    "sections": { "order": ["about", "projects", "work"] },
    "animation": { "intro": "code" }
  }
}`)),
          h("a.btn.btn-ghost", { href: `${BASE_PATH}docs` }, "All options", svgIcon(ICONS.arrowRight)),
        ),
      ),
      h("footer.site-footer",
        h("p", "mz-portfolio · open source · ", h("a", { href: "https://github.com/mustafalzahabi/mz-portfolio" }, "Source"), " · ", h("a", { href: "https://jsonresume.org" }, "JSON Resume")),
      ),
    ),
  );
}
