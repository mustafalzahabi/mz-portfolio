// ============================================================================
// LANDING PAGE
// Hero with a live-looking portfolio mock, feature bento, steps, config
// sample and a closing call to action. Styles: styles/landing.css.
// ============================================================================

import { h, svgIcon } from "../utils.js";
import { ICONS, logoImg } from "../icons.js";
import { BASE_PATH, detectSource, portfolioPath, navigate } from "../router.js";
import { getRecent, clearRecent } from "../data.js";
import { buildThemeToggle } from "../theme.js";
import { accountMenu, avatarImg, loginUrl } from "../account.js";
import { cachedUser } from "../github.js";

const FEATURES = [
  { icon: "zap", title: "Live from your resume", text: "Change your resume.json and the portfolio follows. No build, no deploy, no hosting to manage.", size: "wide" },
  { icon: "palette", title: "Your colors", text: "Ten color tokens, with dark mode generated for you." },
  { icon: "merge", title: "Projects, merged", text: "Resume projects meet your GitHub repos: stars, READMEs and images." },
  { icon: "doc", title: "Printable resume", text: "Eight classic JSON Resume themes, rendered natively." },
  { icon: "phoneDevice", title: "Mobile first", text: "Made for phones, great on desktop, works offline." },
  { icon: "pencil", title: "A real editor", text: "Forms for every section, a live preview, undo, and one-click save to GitHub.", size: "wide" },
  { icon: "blog", title: "A blog, built in", text: "Write posts in Markdown. Each one is a gist you own." },
];

const STEPS = [
  ["Write", "Fill in your resume in the editor, or bring a resume.json you already have."],
  ["Save", "It's stored as a gist on your GitHub account. You own it, nothing else to sign up for."],
  ["Share", "Your portfolio lives at a short link with your username. Update it any time."],
];

/**
 * The real portfolio renderer, scaled down: /preview/view?demo shows the
 * placeholder template, so the picture always matches the actual design.
 */
function heroMock() {
  const frame = h("iframe", { src: `${BASE_PATH}preview/view?demo`, title: "Example portfolio", loading: "lazy", scrolling: "no", tabindex: "-1", "aria-hidden": "true" });
  const viewport = h("div.lp-mock-viewport", frame);
  const fit = () => viewport.style.setProperty("--scale", String(viewport.clientWidth / 1280 || 0.4));
  new ResizeObserver(fit).observe(viewport);
  return h("div.lp-mock", { "aria-hidden": "true" },
    h("div.lp-mock-window",
      h("div.lp-mock-bar", h("span"), h("span"), h("span"), h("span.lp-mock-url", "mz-portfolio.pages.dev/you")),
      viewport,
    ),
    h("div.lp-mock-chip.is-a", svgIcon(ICONS.star), "128 stars"),
    h("div.lp-mock-chip.is-b", svgIcon(ICONS.check), "Saved to GitHub"),
  );
}

export function renderLanding() {
  document.title = "mz-portfolio — turn your resume into a portfolio";
  const app = document.getElementById("app");
  const user = cachedUser();

  // ---------- open a portfolio ----------
  const input = h("input.lp-input", {
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
  const hint = h("p.lp-hint", { id: "source-hint", "aria-live": "polite" }, "See anyone's portfolio: type a GitHub username.");
  input.addEventListener("input", () => {
    const { source, id } = detectSource(input.value);
    hint.dataset.state = input.value && !id ? "error" : "";
    hint.textContent = !input.value
      ? "See anyone's portfolio: type a GitHub username."
      : source === "gd"
        ? `Google Drive · ${id}`
        : source === "auto" || source === "gh"
          ? `Opens ${location.host}${BASE_PATH}${id}`
          : "That doesn't look like a GitHub username or a Drive link.";
  });
  const form = h("form.lp-search", {
    role: "search",
    onsubmit: (e) => {
      e.preventDefault();
      const { source, id } = detectSource(input.value);
      if (!id || !source) return input.focus();
      navigate(portfolioPath(id));
    },
  },
    h("label.visually-hidden", { for: "portfolio-id" }, "GitHub username or Google Drive link"),
    h("div.lp-search-field", svgIcon(ICONS.search), input, h("button.lp-search-go", { type: "submit", "aria-label": "Open portfolio" }, svgIcon(ICONS.arrowRight))),
    hint,
  );

  const recent = getRecent();
  const recentBlock = recent.length
    ? h("div.lp-recent",
        h("span.muted", "Recently viewed:"),
        recent.slice(0, 5).map((r) => h("a.lp-recent-chip", { href: portfolioPath(r.id) }, r.name)),
        h("button.link-btn", { type: "button", onclick: (e) => { clearRecent(); e.target.closest(".lp-recent").remove(); } }, "Clear"),
      )
    : null;

  // ---------- primary actions ----------
  const ctas = user
    ? h("div.lp-ctas",
        h("a.btn.btn-primary.lp-btn", { href: `${BASE_PATH}edit` }, svgIcon(ICONS.pencil), "Edit my portfolio"),
        h("a.btn.btn-ghost.lp-btn", { href: `${BASE_PATH}${encodeURIComponent(user.login)}` }, avatarImg(user, 22), "View it"),
      )
    : h("div.lp-ctas",
        h("a.btn.btn-primary.lp-btn", { href: `${BASE_PATH}edit` }, "Create your portfolio", svgIcon(ICONS.arrowRight)),
        h("a.btn.btn-ghost.lp-btn", { href: loginUrl(`${BASE_PATH}edit`), dataset: { external: "" } }, svgIcon(ICONS.github), "Sign in with GitHub"),
      );

  const toggle = buildThemeToggle("icon");

  app.replaceChildren(
    h("div.landing.lp",
      h("div.lp-glow", { "aria-hidden": "true" }, h("span"), h("span"), h("span")),
      h("header.lp-top",
        h("a.brand", { href: BASE_PATH, "aria-label": "mz-portfolio home" }, logoImg(30), h("span", "mz-portfolio")),
        h("nav.lp-nav", { "aria-label": "Site" },
          h("a", { href: `${BASE_PATH}docs` }, "Docs"),
          h("a", { href: `${BASE_PATH}preview` }, "Preview"),
          user ? null : h("a", { href: `${BASE_PATH}edit` }, "Editor"),
          toggle,
          accountMenu({ user }),
        ),
      ),
      h("main.lp-main", { id: "main", tabindex: "-1" },
        h("section.lp-hero",
          h("div.lp-hero-text",
            h("p.lp-badge", h("span.lp-badge-dot"), user ? `Welcome back, ${user.name?.split(/\s+/)[0] || user.login}` : "Free · open source · no backend"),
            h("h1.lp-title", "Your resume, ", h("span.lp-gradient-text", "as a living portfolio.")),
            h("p.lp-lead", "Write it once as a JSON Resume. Get a fast, beautiful portfolio with projects, a blog and a printable resume, all saved on your own GitHub."),
            ctas,
            form,
            recentBlock,
          ),
          heroMock(),
        ),

        h("section.lp-section", { "aria-labelledby": "features-title" },
          h("div.lp-section-head",
            h("p.lp-kicker", "Why it's different"),
            h("h2.lp-h2", { id: "features-title" }, "Everything a portfolio needs. Nothing to maintain."),
          ),
          h("div.lp-bento", FEATURES.map((f) =>
            h(`article.lp-tile${f.size === "wide" ? ".is-wide" : ""}`,
              h("span.lp-tile-icon", svgIcon(ICONS[f.icon])),
              h("h3", f.title),
              h("p", f.text),
            ))),
        ),

        h("section.lp-section", { "aria-labelledby": "steps-title" },
          h("div.lp-section-head",
            h("p.lp-kicker", "How it works"),
            h("h2.lp-h2", { id: "steps-title" }, "Live in three steps."),
          ),
          h("ol.lp-steps", STEPS.map(([title, text], i) =>
            h("li", h("span.lp-step-num", String(i + 1)), h("h3", title), h("p", text)))),
        ),

        h("section.lp-section.lp-split", { "aria-labelledby": "config-title" },
          h("div",
            h("p.lp-kicker", "For tinkerers"),
            h("h2.lp-h2", { id: "config-title" }, "Configured from your resume."),
            h("p.lp-text", "Colors, layout, section order, animations and tabs all live in one optional block of your resume.json. Prefer forms? The editor writes it for you."),
            h("a.btn.btn-ghost", { href: `${BASE_PATH}docs` }, "All options", svgIcon(ICONS.arrowRight)),
          ),
          h("div.lp-code",
            h("div.lp-code-bar", h("span"), h("span"), h("span"), h("em", "resume.json")),
            h("pre", h("code", `"meta": {
  "theme": "elegant",
  "mz-portfolio-config": {
    "colors": { "accent": "#2f5d62" },
    "sections": { "order": ["about", "projects"] },
    "animation": { "intro": "code" }
  }
}`)),
          ),
        ),

        h("section.lp-final",
          h("h2", user ? "Pick up where you left off." : "Your portfolio is five minutes away."),
          h("p", user ? "Your resume, settings and posts are one click away." : "Start in the editor. No account needed until you save."),
          h("div.lp-ctas", user
            ? h("a.btn.btn-primary.lp-btn", { href: `${BASE_PATH}edit` }, svgIcon(ICONS.pencil), "Open the editor")
            : h("a.btn.btn-primary.lp-btn", { href: `${BASE_PATH}edit` }, "Create your portfolio", svgIcon(ICONS.arrowRight))),
        ),
      ),
      h("footer.site-footer",
        h("p.footer-credit", h("span.footer-brand", logoImg(20), "mz-portfolio"), " · open source · ", h("a", { href: "https://github.com/mustafalzahabi/mz-portfolio" }, "Source"), " · ", h("a", { href: "https://jsonresume.org" }, "JSON Resume")),
      ),
    ),
  );
}
