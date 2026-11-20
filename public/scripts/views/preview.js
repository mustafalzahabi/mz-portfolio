// ============================================================================
// TRY IT (/preview) — edit without an account, see an example, or import a
// JSON Resume. Nothing leaves the browser; the JSON stays in sessionStorage.
// ============================================================================

import { h, svgIcon, plural } from "../utils.js";
import { ICONS } from "../icons.js";
import { cachedUser } from "../github.js";
import { siteHeader } from "./site-header.js";
import { BASE_PATH } from "../router.js";
import { parseResumeJson } from "../data.js";
import { normalizeConfig } from "../config.js";
import { validateResume } from "../merge.js";

const STORAGE_KEY = "mz-preview-json";

export function getPreviewJson() {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function savePreviewJson(text) {
  try {
    sessionStorage.setItem(STORAGE_KEY, text);
  } catch {
    /* too large or unavailable — preview still works for this render */
  }
}

/** Returns { resume, warnings } or throws ResumeParseError. */
export function analyzeResume(text) {
  const resume = parseResumeJson(text);
  const { warnings: cfgWarnings } = normalizeConfig(resume.meta || {});
  return { resume, warnings: [...validateResume(resume), ...cfgWarnings.map((w) => `config ${w}`)] };
}

/**
 * The "Try it" page: start editing without an account, see an example, or
 * import a JSON Resume. onShow(resume, { edit }) opens the previewed portfolio.
 */
export function renderPreviewEditor(onShow) {
  document.title = "Try it — mz-portfolio";
  const user = cachedUser();
  const textarea = h("textarea.input.preview-text", {
    id: "preview-json",
    spellcheck: "false",
    autocapitalize: "off",
    rows: "12",
    placeholder: '{\n  "basics": { "name": "Your Name" }\n}',
  });
  textarea.value = getPreviewJson() || "";
  const report = h("div.preview-report", { "aria-live": "polite" });
  const editBtn = h("button.btn.btn-primary", { type: "submit", value: "edit" }, svgIcon(ICONS.pencil), "Edit it");
  const viewBtn = h("button.btn.btn-ghost", { type: "submit", value: "view" }, svgIcon(ICONS.eye), "View it");

  function check() {
    report.replaceChildren();
    delete report.dataset.tone;
    const text = textarea.value.trim();
    if (!text) {
      editBtn.disabled = viewBtn.disabled = true;
      return null;
    }
    try {
      const result = analyzeResume(text);
      editBtn.disabled = viewBtn.disabled = false;
      report.dataset.tone = result.warnings.length ? "warn" : "ok";
      report.appendChild(h("p", svgIcon(result.warnings.length ? ICONS.alert : ICONS.check), result.warnings.length ? `Ready, with ${plural(result.warnings.length, "suggestion")}:` : "Ready."));
      if (result.warnings.length) report.appendChild(h("ul", result.warnings.slice(0, 30).map((w) => h("li", w))));
      return result;
    } catch (e) {
      editBtn.disabled = viewBtn.disabled = true;
      report.dataset.tone = "error";
      report.appendChild(h("p", svgIcon(ICONS.alert), e.message));
      return null;
    }
  }

  let timer = null;
  textarea.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(check, 250);
  });

  const pasteBox = h("details.preview-paste", h("summary", "Paste JSON instead"), textarea);
  const loadText = (text) => {
    textarea.value = text;
    pasteBox.open = true;
    check();
  };

  const fileInput = h("input", { type: "file", accept: ".json,application/json", class: "visually-hidden", id: "preview-file" });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (file) loadText(await file.text());
  });

  const drop = h("label.dropzone", { for: "preview-file" },
    svgIcon(ICONS.upload),
    h("span", h("strong", "Drop a JSON Resume file"), " or choose one"),
  );
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("is-over")));
  drop.addEventListener("drop", async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) loadText(await file.text());
  });

  const form = h("form.preview-form", {
    onsubmit: (e) => {
      e.preventDefault();
      const result = check();
      if (!result) return;
      savePreviewJson(textarea.value);
      onShow(result.resume, { edit: e.submitter?.value !== "view" });
    },
  },
    drop,
    fileInput,
    pasteBox,
    report,
    h("div.preview-actions", editBtn, viewBtn),
  );
  if (textarea.value) pasteBox.open = true;

  const option = (icon, title, text, action) =>
    h("a.try-option", { href: action }, h("span.try-icon", svgIcon(ICONS[icon])), h("span.try-text", h("strong", title), h("span", text)), svgIcon(ICONS.arrowRight));

  document.getElementById("app").replaceChildren(
    h("div.docs.try",
      siteHeader("preview"),
      h("main.docs-main.try-main", { id: "main", tabindex: "-1" },
        h("div.try-head",
          h("h1.landing-title", "Try it"),
          h("p.landing-lead", "Build a portfolio right here, no account needed. Everything stays in this browser until you sign in and publish."),
        ),
        h("div.try-options",
          user
            ? option("pencil", "Edit my portfolio", `Signed in as @${user.login}. Opens your live portfolio in edit mode.`, `${BASE_PATH}edit`)
            : option("pencil", "Start editing", "A blank portfolio with placeholders. Tap Edit on anything to change it.", `${BASE_PATH}edit`),
          option("eye", "See an example", "A filled-in portfolio, to see what you'll get.", `${BASE_PATH}preview/view?demo`),
        ),
        h("section.try-import", { "aria-labelledby": "import-title" },
          h("h2", { id: "import-title" }, "Import a JSON Resume"),
          h("p.muted", "Have a resume.json from another tool? Bring it in, then edit or just look. Nothing is uploaded."),
          form,
        ),
      ),
    ),
  );
  check();
}
