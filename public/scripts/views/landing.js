// ============================================================================
// LANDING PAGE
// Hero with a live portfolio mock, feature bento, steps, ways to start
// and a closing call to action. Styles: styles/landing.css.
// ============================================================================

import { h, svgIcon } from "../utils.js";
import { ICONS, logoImg } from "../icons.js";
import { BASE_PATH, detectSource, portfolioPath, navigate } from "../router.js";
import { getRecent, clearRecent } from "../data.js";
import { avatarImg, loginUrl } from "../account.js";
import { siteHeader } from "./site-header.js";
import { cachedUser } from "../github.js";

const FEATURES = [
  { icon: "pencil", title: "Edit right on the page", text: "Tap Edit on anything (a project, a job, a post) and change it in a panel. Undo, drafts and one-click publish.", size: "wide" },
  { icon: "phoneDevice", title: "Mobile first", text: "Made for phones, great on desktop, works offline." },
  { icon: "merge", title: "Projects, merged", text: "Your projects meet your GitHub repos: READMEs, languages and images." },
  { icon: "palette", title: "Your colors", text: "A few colors in, a full theme out, dark mode included." },
  { icon: "doc", title: "A printable resume", text: "The same content as a clean resume, in eight print-ready themes." },
  { icon: "blog", title: "A blog, built in", text: "Write posts in Markdown. Each one is a gist you own." },
  { icon: "zap", title: "Nothing to maintain", text: "No build, no deploy, no hosting. Publish and it's live.", size: "wide" },
];

const STEPS = [
  ["Start", "Sign in with GitHub, or try it first without an account. Even a name alone looks good."],
  ["Fill it in", "Add projects, experience and posts right on the page, from your phone if you like."],
  ["Share", "Publish and your portfolio lives at a short link with your username."],
];

const SOURCES = [
  { icon: "pencil", title: "Start from scratch", text: "A blank portfolio with helpful placeholders.", href: "edit" },
  { icon: "upload", title: "Import a JSON Resume", text: "Already have a resume.json? Drop it in and keep editing.", href: "preview" },
  { icon: "github", title: "Your GitHub, merged", text: "Repos, languages and your photo fill in on their own.", href: "edit" },
];

/**
 * The real portfolio renderer, scaled down: /preview/view?demo shows the
 * placeholder template, so the picture always matches the actual design.
 */
function heroMock() {
  const frame = h("iframe", { src: `${BASE_PATH}preview/view?demo`, title: "Example portfolio", loading: "lazy", scrolling: "no", tabindex: "-1", "aria-hidden": "true" });
  const viewport = h("div.lp-mock-viewport", frame);
  const fit = () => viewport.isConnected ? viewport.style.setProperty("--scale", String(viewport.clientWidth / 1280 || 0.4)) : ro.disconnect();
  const ro = new ResizeObserver(fit);
  ro.observe(viewport);
  return h("div.lp-mock", { "aria-hidden": "true" },
    h("div.lp-mock-window",
      h("div.lp-mock-bar", h("span"), h("span"), h("span"), h("span.lp-mock-url", "mz-portfolio.pages.dev/you")),
      viewport,
    ),
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

  app.replaceChildren(
    h("div.landing.lp",
      h("div.lp-glow", { "aria-hidden": "true" }, h("span"), h("span"), h("span")),
      siteHeader("home"),
      h("main.lp-main", { id: "main", tabindex: "-1" },
        h("section.lp-hero",
          h("div.lp-hero-text",
            h("h1.lp-title", "Your work, ", h("span.lp-gradient-text", "as a living portfolio.")),
            h("p.lp-lead", "A fast, beautiful portfolio with projects, a blog and a printable resume. Edit it right on the page and keep it on your own GitHub."),
            ctas,
            form,
            recentBlock,
          ),
          heroMock(),
        ),

        h("section.lp-section", { "aria-labelledby": "features-title" },
          h("div.lp-section-head",
            h("h2.lp-h2", { id: "features-title" }, "Everything a portfolio needs. Nothing to maintain."),
            h("p.lp-text", "Free and open source. No backend, no lock-in: your content stays on your GitHub."),
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
            h("h2.lp-h2", { id: "steps-title" }, "Live in three steps."),
          ),
          h("ol.lp-steps", STEPS.map(([title, text], i) =>
            h("li", h("span.lp-step-num", String(i + 1)), h("h3", title), h("p", text)))),
        ),

        h("section.lp-section", { "aria-labelledby": "sources-title" },
          h("div.lp-section-head",
            h("h2.lp-h2", { id: "sources-title" }, "Start however you like."),
            h("p.lp-text", "Begin with a blank page, or bring what you already have."),
          ),
          h("div.lp-sources", SOURCES.map((x) =>
            h("a.lp-source", { href: `${BASE_PATH}${x.href}` },
              h("span.lp-tile-icon", svgIcon(ICONS[x.icon])),
              h("span.lp-source-text", h("strong", x.title), h("span", x.text)),
              svgIcon(ICONS.arrowRight),
            ))),
        ),

        h("section.lp-final",
          h("h2", user ? "Pick up where you left off." : "Your portfolio is five minutes away."),
          h("p", user ? "Your portfolio, settings and posts are one click away." : "Try it without an account. Sign in when you're ready to publish."),
          h("div.lp-ctas", user
            ? h("a.btn.btn-primary.lp-btn", { href: `${BASE_PATH}edit` }, svgIcon(ICONS.pencil), "Open the editor")
            : h("a.btn.btn-primary.lp-btn", { href: `${BASE_PATH}edit` }, "Create your portfolio", svgIcon(ICONS.arrowRight))),
        ),
      ),
      h("footer.site-footer",
        h("p.footer-credit", h("span.footer-brand", logoImg(20), "mz-portfolio"), " · open source · ", h("a", { href: "https://github.com/mustafalzahabi/mz-portfolio" }, "Source"), " · ", h("a", { href: `${BASE_PATH}docs` }, "Docs")),
      ),
    ),
  );
}
