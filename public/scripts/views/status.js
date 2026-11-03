// ============================================================================
// STATUS PAGES — loading, not found, rate limited, error, invalid JSON, empty,
// plus the offline banner. One layout, palette-only styling (styles/status.css).
// ============================================================================

import { h, svgIcon } from "../utils.js";
import { ICONS } from "../icons.js";
import { BASE_PATH } from "../router.js";
import { getResumeFilename } from "../data.js";

let countdownTimer = null;

function mount(node) {
  clearInterval(countdownTimer);
  const app = document.getElementById("app");
  app.replaceChildren(node);
  app.setAttribute("aria-busy", "false");
}

function statusPage({ icon, tone = "info", title, body, actions = [], extra = null }) {
  return h("main.status-page", { id: "main", tabindex: "-1", dataset: { tone } },
    h("div.status-card",
      icon ? h("div.status-icon", svgIcon(ICONS[icon])) : null,
      h("h1.status-title", title),
      ...(Array.isArray(body) ? body : [body]).filter(Boolean).map((p) => (typeof p === "string" ? h("p.status-text", p) : p)),
      extra,
      actions.length ? h("div.status-actions", actions) : null,
    ),
  );
}

const homeBtn = () => h("a.btn.btn-ghost", { href: BASE_PATH }, svgIcon(ICONS.arrowLeft), "Home");
const retryBtn = () => h("button.btn.btn-primary", { type: "button", onclick: () => location.reload() }, "Try again");

export function showLoading(label = "Loading portfolio…") {
  const app = document.getElementById("app");
  app.setAttribute("aria-busy", "true");
  app.replaceChildren(
    h("main.status-page.is-loading", { id: "main", "aria-label": label },
      h("div.skeleton",
        h("div.skeleton-banner"),
        h("div.skeleton-row", h("div.skeleton-avatar"), h("div.skeleton-lines", h("span"), h("span"))),
        h("div.skeleton-block"),
        h("div.skeleton-block"),
      ),
      h("p.visually-hidden", { role: "status" }, label),
    ),
  );
}

export function showNotFound(id, reason) {
  document.title = "Not found";
  const file = getResumeFilename();
  const body = {
    "github-user": [`There's no GitHub account named “${id}”.`, "Check the spelling, or paste a Google Drive link instead."],
    drive: ["That Google Drive file or folder doesn't exist, or isn't shared.", "In Drive, set sharing to “Anyone with the link”."],
    "drive-resume": [`The Drive folder has no ${file}.`, `Add a ${file} file to the folder (JSON Resume format).`],
  }[reason] || [`Nothing was found for “${id}”.`];
  mount(statusPage({ icon: "search", tone: "warn", title: "Portfolio not found", body, actions: [homeBtn()] }));
}

export function showRateLimited(resetAt) {
  document.title = "Please wait";
  const countdown = h("div.status-countdown", { role: "timer", "aria-live": "off" });
  const at = new Date(resetAt);
  const page = statusPage({
    icon: "clock",
    tone: "warn",
    title: "GitHub needs a short break",
    body: [
      "GitHub limits how often a browser can ask for profile data. This portfolio will load automatically when the limit resets.",
      `Resets at ${at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`,
    ],
    extra: countdown,
    actions: [homeBtn()],
  });
  mount(page);
  const tick = () => {
    const secs = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
    countdown.textContent = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
    if (secs <= 0) {
      clearInterval(countdownTimer);
      location.reload();
    }
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

export function showError(message, { reason } = {}) {
  document.title = "Something went wrong";
  const body = [message];
  if (reason === "drive-key") body.push("If you run this site, add a Google API key in index.html (see the README).");
  mount(statusPage({ icon: "alert", tone: "error", title: "Couldn't load this portfolio", body, actions: [retryBtn(), homeBtn()] }));
}

export function showInvalidResume(error, source) {
  document.title = "Invalid resume.json";
  const extra = error.line
    ? h("p.status-text", "Open the file and look around ", h("strong", `line ${error.line}`), ". A missing comma or an extra trailing comma is the usual cause.")
    : null;
  const actions = [homeBtn()];
  if (source?.resumeUrl) actions.unshift(h("a.btn.btn-primary", { href: source.resumeUrl }, "Open the file"));
  actions.unshift(h("a.btn.btn-ghost", { href: `${BASE_PATH}preview` }, "Check it in Preview"));
  mount(statusPage({ icon: "alert", tone: "error", title: "resume.json has an error", body: [error.message], extra, actions }));
}

export function showEmpty(id) {
  document.title = "No portfolio yet";
  const file = getResumeFilename();
  mount(
    statusPage({
      icon: "doc",
      tone: "info",
      title: "No portfolio data yet",
      body: [
        `“${id}” exists, but has no public ${file} gist and no public repositories.`,
        h("p.status-text", "Create a public gist named ", h("code", file), " using the ", h("a", { href: "https://jsonresume.org/schema/" }, "JSON Resume schema"), ", then reload."),
      ],
      actions: [h("a.btn.btn-primary", { href: "https://gist.github.com/" }, "Create a gist"), h("a.btn.btn-ghost", { href: `${BASE_PATH}preview` }, "Try Preview"), homeBtn()],
    }),
  );
}

export function showOfflineBanner({ savedAt, resetAt }) {
  document.querySelector(".offline-banner")?.remove();
  const when = savedAt ? new Date(savedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "earlier";
  const banner = h("div.offline-banner", { role: "status" },
    svgIcon(ICONS.clock),
    h("span", `Showing a saved copy from ${when}.`),
    resetAt ? h("span.muted", ` Live data returns around ${new Date(resetAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`) : null,
    h("button.offline-close", { type: "button", "aria-label": "Dismiss", onclick: () => banner.remove() }, svgIcon(ICONS.close)),
  );
  document.body.prepend(banner);
}
