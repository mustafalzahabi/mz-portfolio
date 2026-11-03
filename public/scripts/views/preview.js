// ============================================================================
// PREVIEW — drop, pick or paste a resume.json and see the portfolio. Nothing
// leaves the browser; the JSON is kept in sessionStorage for this tab only.
// ============================================================================

import { h, svgIcon } from "../utils.js";
import { ICONS, logoImg } from "../icons.js";
import { BASE_PATH } from "../router.js";
import { parseResumeJson } from "../data.js";
import { normalizeConfig } from "../config.js";
import { validateResume } from "../merge.js";

const STORAGE_KEY = "mz-preview-json";
const EXAMPLE_URL = new URL("../../assets/examples/resume.json", import.meta.url).href;

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
 * Renders the editor. onShow(resume) renders the portfolio for the JSON.
 */
export function renderPreviewEditor(onShow) {
  document.title = "Preview — mz-portfolio";
  const textarea = h("textarea.input.preview-text", {
    id: "preview-json",
    spellcheck: "false",
    autocapitalize: "off",
    rows: "14",
    placeholder: '{\n  "basics": { "name": "Your Name" }\n}',
  });
  textarea.value = getPreviewJson() || "";
  const report = h("div.preview-report", { "aria-live": "polite" });
  const showBtn = h("button.btn.btn-primary", { type: "submit" }, svgIcon(ICONS.eye), "Show portfolio");

  function check() {
    report.replaceChildren();
    const text = textarea.value.trim();
    if (!text) {
      showBtn.disabled = true;
      return null;
    }
    try {
      const result = analyzeResume(text);
      showBtn.disabled = false;
      report.dataset.tone = result.warnings.length ? "warn" : "ok";
      report.appendChild(h("p", svgIcon(result.warnings.length ? ICONS.alert : ICONS.check), result.warnings.length ? `Valid JSON with ${result.warnings.length} suggestion(s):` : "Looks good."));
      if (result.warnings.length) report.appendChild(h("ul", result.warnings.slice(0, 30).map((w) => h("li", w))));
      return result;
    } catch (e) {
      showBtn.disabled = true;
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

  const loadText = (text) => {
    textarea.value = text;
    check();
  };

  const fileInput = h("input", { type: "file", accept: ".json,application/json", class: "visually-hidden", id: "preview-file" });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (file) loadText(await file.text());
  });

  const drop = h("label.dropzone", { for: "preview-file" },
    svgIcon(ICONS.upload),
    h("span", h("strong", "Drop resume.json here"), " or choose a file"),
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
      onShow(result.resume);
    },
  },
    drop,
    fileInput,
    h("label.preview-label", { for: "preview-json" }, "Or paste JSON"),
    textarea,
    report,
    h("div.preview-actions",
      showBtn,
      h("button.btn.btn-ghost", { type: "button", onclick: async () => {
        const res = await fetch(EXAMPLE_URL);
        if (res.ok) loadText(await res.text());
      } }, "Load example"),
      h("a.btn.btn-ghost", { href: `${BASE_PATH}docs` }, "Config docs"),
    ),
  );

  document.getElementById("app").replaceChildren(
    h("div.docs",
      h("header.landing-top",
        h("a.brand", { href: BASE_PATH, "aria-label": "mz-portfolio home" }, logoImg(32), h("span", "mz-portfolio")),
        h("nav.landing-links", { "aria-label": "Site" }, h("a", { href: `${BASE_PATH}preview`, "aria-current": "page" }, "Preview"), h("a", { href: `${BASE_PATH}docs` }, "Docs"), h("a", { href: `${BASE_PATH}edit` }, "Edit")),
      ),
      h("main.docs-main", { id: "main", tabindex: "-1" },
        h("h1.landing-title", "Preview"),
        h("p.landing-lead", "Check a resume.json before you publish it. It stays in this browser tab — nothing is uploaded."),
        form,
      ),
    ),
  );
  check();
}
