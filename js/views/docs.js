// ============================================================================
// DOCS — configuration reference generated from CONFIG_SCHEMA
// ============================================================================

import { h, svgIcon, copyText, toast } from "../utils.js";
import { ICONS } from "../icons.js";
import { CONFIG_SCHEMA } from "../config.js";
import { BASE_PATH } from "../router.js";

function isLeaf(node) {
  return node && typeof node === "object" && "type" in node && "desc" in node;
}

function typeLabel(node) {
  if (node.type === "enum") return node.values.map((v) => `"${v}"`).join(" | ");
  if (node.type === "array") return node.values ? `list of ${node.values.join(", ")}` : "list of text";
  if (node.type === "map") return `object (${node.keys.join(", ")})`;
  if (node.type === "color") return "color (#hex)";
  if (node.type === "number") return `number ${node.min}–${node.max}`;
  return node.type === "string" ? "text" : node.type;
}

function defaultLabel(node) {
  const d = node.default;
  if (d === "" || d === undefined) return "—";
  if (Array.isArray(d)) return d.length ? JSON.stringify(d) : "[]";
  if (typeof d === "object") return JSON.stringify(d);
  return JSON.stringify(d);
}

function rows(schema, path = []) {
  const out = [];
  for (const [key, node] of Object.entries(schema)) {
    if (key.startsWith("_")) continue;
    const p = [...path, key];
    if (isLeaf(node)) {
      out.push(
        h("tr",
          h("th", { scope: "row" }, h("code", p.join("."))),
          h("td", h("code", typeLabel(node))),
          h("td", h("code", defaultLabel(node))),
          h("td", node.desc),
        ),
      );
    } else {
      out.push(...rows(node, p));
    }
  }
  return out;
}

const EXAMPLE = `{
  "basics": { "name": "…" },
  "meta": {
    "theme": "even",
    "mz-portfolio-config": {
      "colors": { "accent": "#2f5d62", "prime": "#3b3a5a" },
      "theme": { "mode": "auto", "toggle": "switch" },
      "text": { "tagline": "Calm, light-filled spaces.", "sections": { "work": "Experience" } },
      "sections": { "order": ["about", "projects", "work"], "hide": ["references"] },
      "projects": { "layout": "grid", "sort": "stars", "github": "matched" },
      "skills": { "display": "progress" },
      "animation": { "intro": "code", "hover": { "lift": true, "glow": true } }
    }
  }
}`;

export function renderDocs() {
  document.title = "Configuration — mz-portfolio";
  const groups = Object.entries(CONFIG_SCHEMA).map(([key, node]) =>
    h("section.docs-group", { id: `cfg-${key}`, "aria-labelledby": `cfg-${key}-title` },
      h("h2.docs-h2", { id: `cfg-${key}-title` }, h("code", key)),
      node._desc ? h("p", node._desc) : null,
      h("div.table-wrap",
        h("table.docs-table",
          h("thead", h("tr", h("th", { scope: "col" }, "Option"), h("th", { scope: "col" }, "Type"), h("th", { scope: "col" }, "Default"), h("th", { scope: "col" }, "What it does"))),
          h("tbody", rows(node, [key])),
        ),
      ),
    ),
  );

  document.getElementById("app").replaceChildren(
    h("div.docs",
      h("header.landing-top",
        h("a.brand", { href: BASE_PATH, "aria-label": "mz-portfolio home" }, h("span.brand-mark", "mz"), h("span", "portfolio")),
        h("nav.landing-links", { "aria-label": "Site" }, h("a", { href: `${BASE_PATH}preview` }, "Preview"), h("a", { href: `${BASE_PATH}docs`, "aria-current": "page" }, "Docs")),
      ),
      h("main.docs-main", { id: "main", tabindex: "-1" },
        h("h1.landing-title", "Configuration"),
        h("p.landing-lead", "Everything is set inside your own resume.json, in ", h("code", "meta[\"mz-portfolio-config\"]"), ". The resume viewer's theme uses the JSON Resume standard ", h("code", "meta.theme"), ". All options are optional."),
        h("nav.docs-toc", { "aria-label": "Option groups" }, Object.keys(CONFIG_SCHEMA).map((k) => h("a.chip", { href: `#cfg-${k}` }, k))),
        h("section.docs-group",
          h("h2.docs-h2", "Example"),
          h("div.code-sample-wrap",
            h("pre.code-sample", h("code", EXAMPLE)),
            h("button.btn.btn-ghost.copy-btn", { type: "button", onclick: async () => toast((await copyText(EXAMPLE)) ? "Copied" : "Couldn't copy") }, svgIcon(ICONS.copy), "Copy"),
          ),
          h("p", "Resume themes rendered natively: even, elegant, flat, kendall, stackoverflow, macchiato, onepage, professional. Other theme names are fetched from the JSON Resume registry, falling back to even."),
          h("p", "Links: ", h("code", `${location.host}${BASE_PATH}username`), " (GitHub) or a Drive file/folder ID. ", h("code", "?gistname=cv"), " loads cv.json instead of resume.json."),
        ),
        groups,
      ),
    ),
  );
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}
