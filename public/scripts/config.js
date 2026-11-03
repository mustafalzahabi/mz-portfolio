// ============================================================================
// PORTFOLIO CONFIG — read from resume.json → meta["mz-portfolio-config"]
// One schema drives defaults, normalization, validation, and the /docs page.
// Users never edit a separate file: everything lives in their resume.json.
// ============================================================================

import { slugify } from "./utils.js";

export const SECTION_KEYS = [
  "about",
  "work",
  "projects",
  "skills",
  "education",
  "certificates",
  "awards",
  "publications",
  "volunteer",
  "languages",
  "interests",
  "references",
  "contact",
];

export const COLOR_TOKENS = [
  "base",
  "core",
  "accent",
  "variant",
  "surface",
  "depth",
  "optimal",
  "risky",
  "fatal",
  "prime",
];

const color = (desc) => ({ type: "color", default: "", desc });
const str = (desc, def = "") => ({ type: "string", default: def, desc });
const bool = (desc, def) => ({ type: "boolean", default: def, desc });
const num = (desc, def, min, max) => ({ type: "number", default: def, min, max, desc });
const oneOf = (values, def, desc) => ({ type: "enum", values, default: def, desc });
const list = (desc, def = [], values) => ({ type: "array", default: def, values, desc });

export const CONFIG_SCHEMA = {
  colors: {
    _desc: "Override any of the ten TwOP color tokens (light-mode values). Dark mode is generated automatically.",
    base: color("Main page background."),
    core: color("Body text, titles and icons."),
    accent: color("Buttons, links and selection."),
    variant: color("Hover, focus and pressed states."),
    surface: color("Cards, banner and navigation."),
    depth: color("Borders, dividers and input wells."),
    optimal: color("Success messages."),
    risky: color("Warnings."),
    fatal: color("Errors."),
    prime: color("Brand: hero, logo and large type."),
  },
  theme: {
    _desc: "Light / dark behaviour and the theme toggle.",
    mode: oneOf(["auto", "light", "dark"], "auto", "Default mode for first-time visitors. A visitor's own choice is remembered."),
    toggle: oneOf(["switch", "icon", "slider", "none"], "switch", "Theme toggle style shown in the banner."),
  },
  typography: {
    _desc: "Fonts and text size (system fonts only, nothing is downloaded).",
    font: oneOf(["sans", "serif", "mono"], "sans", "Font family for the whole portfolio."),
    scale: num("Text size multiplier.", 1, 0.85, 1.25),
  },
  shape: {
    _desc: "Corner rounding.",
    radius: oneOf(["none", "small", "medium", "large"], "medium", "Corner radius for cards, buttons and images."),
  },
  text: {
    _desc: "Text overrides.",
    tagline: str("Line under your name. Defaults to basics.label."),
    cta: str("Header button label. Opens your resume. Empty hides it.", "View resume"),
    bio: str("About text. Defaults to basics.summary."),
    philosophy: str("Optional second About block."),
    contact_message: str("Text above the contact links."),
    locale: str("Locale for dates, e.g. en-GB, fr-FR, ar-EG.", "en-US"),
    present: str("Label for ongoing dates.", "Present"),
    sections: { type: "map", keys: SECTION_KEYS, default: {}, desc: "Section title overrides, e.g. { \"work\": \"Experience\" }." },
    tabs: { type: "map", keys: ["profile", "blog"], default: {}, desc: "Tab labels, e.g. { \"profile\": \"Portfolio\" }." },
  },
  profile: {
    _desc: "Profile photo.",
    photo: str("Image URL, \"gh\" for your GitHub avatar, or \"none\". Defaults to basics.image, then your GitHub avatar."),
    photoShape: oneOf(["circle", "rounded", "square"], "circle", "Photo shape."),
  },
  banner: {
    _desc: "Header banner.",
    image: str("Banner image URL. Defaults to a gradient made from your colors."),
    aspect: oneOf(["short", "medium", "tall"], "medium", "Banner height (taller on phones automatically)."),
    overlay: bool("Darken the banner image so links stay readable.", true),
  },
  header: {
    _desc: "Header details and actions.",
    links: list("Links shown on the banner, in order. Any basics.profiles network name works.", ["email", "github", "linkedin"]),
    showLocation: bool("Show basics.location.", true),
    showPhone: bool("Show basics.phone.", false),
    share: bool("Show a Share button.", true),
    vcard: bool("Show a Save contact (vCard) button.", true),
  },
  sections: {
    _desc: "Which sections appear, and in what order.",
    order: list("Section order. Sections you leave out are added at the end.", SECTION_KEYS, SECTION_KEYS),
    hide: list("Sections to hide.", [], SECTION_KEYS),
  },
  navbar: {
    _desc: "Section navigation (side dots on desktop, bottom bar on phones).",
    enabled: bool("Show section navigation.", true),
    labels: oneOf(["hover", "always"], "hover", "When to show labels next to the desktop dots."),
  },
  projects: {
    _desc: "Projects section.",
    layout: oneOf(["grid", "list", "horizontal"], "grid", "Card layout."),
    imagePosition: oneOf(["top", "left", "right", "bottom", "none"], "top", "Where the cover image goes."),
    sort: oneOf(["resume", "stars", "name", "recent"], "resume", "Sort order. \"resume\" keeps your resume order, then GitHub repos by stars."),
    github: oneOf(["all", "matched", "none"], "all", "Which GitHub repos to include: all public repos, only those matching a resume project, or none."),
    exclude: list("Repo or project names to hide."),
    limit: num("Maximum number of projects (0 = no limit).", 0, 0, 200),
    showStars: bool("Show GitHub star counts.", true),
    showForks: bool("Include forked repositories.", false),
  },
  skills: {
    _desc: "Skills section.",
    display: oneOf(["list", "tags", "progress"], "tags", "\"progress\" uses each skill's level (Beginner, Intermediate, Advanced, Master, or 0–100)."),
    githubLanguages: bool("Add a group with languages from your GitHub repos.", true),
  },
  animation: {
    _desc: "Animations. Always disabled for visitors who ask for reduced motion.",
    intro: oneOf(["none", "fade", "slide", "stagger", "typewriter", "blueprint", "code"], "fade", "How sections appear. \"code\" types out the code that builds each section, then shows it."),
    duration: num("Animation length in seconds.", 0.5, 0.1, 3),
    easing: oneOf(["smooth", "linear", "spring"], "smooth", "Animation curve."),
    hover: {
      _desc: "Card hover effects (mouse/trackpad only).",
      lift: bool("Lift cards slightly.", true),
      shadow: bool("Add a shadow.", true),
      glow: bool("Add a soft glow in the variant color.", false),
    },
    code: {
      _desc: "Options for the \"code\" intro.",
      source: oneOf(["js", "html"], "js", "Type the JavaScript that builds each section, or the HTML it produces."),
      speed: num("Typing speed multiplier.", 1, 0.25, 5),
      maxPerSection: num("Longest time per section, in seconds.", 1.6, 0.3, 6),
    },
  },
  tags: {
    _desc: "Tags on projects and skills.",
    languageColors: bool("Color tags that name a programming language with GitHub's language color.", true),
  },
  tabs: {
    type: "tabs",
    default: [],
    desc:
      "Extra tabs next to Profile and Blog. Each item: { \"label\", \"type\", \"url\" or \"content\" }. " +
      "Types: \"link\" (opens a URL in a new tab), \"embed\" (shows an https page in a sandboxed frame), " +
      "\"markdown\" (renders Markdown), \"code\" (shows a code file, highlighted, never run; optional \"language\"), " +
      "\"html\" (runs a small HTML/CSS/JS demo in an isolated sandbox; optional \"height\" in px). " +
      "File URLs must be raw GitHub or gist links (raw.githubusercontent.com, gist.githubusercontent.com).",
  },
  blog: {
    _desc: "Blog tab (public gists with a .md file, or .md files in your Drive folder).",
    enabled: bool("Show the Blog tab when posts exist.", true),
    perPage: num("Posts per page.", 10, 1, 100),
    showTags: bool("Show tags and the tag filter.", true),
    search: bool("Show the search box.", true),
  },
  resume: {
    _desc: "Built-in resume viewer. The theme comes from meta.theme (JSON Resume standard).",
    theme: str("Resume theme. Same as meta.theme; meta.theme wins if both are set."),
    download: bool("Show a Download resume.json button.", true),
    print: bool("Show a Print / PDF button.", true),
  },
  seo: {
    _desc: "Search and link previews.",
    title: str("Page title. Defaults to \"Name – Label\"."),
    description: str("Page description. Defaults to basics.summary."),
    image: str("Link preview image. Defaults to your photo."),
  },
  footer: {
    _desc: "Footer.",
    text: str("Footer text. Defaults to \"© year name\"."),
    credit: bool("Show the \"Built with mz-portfolio\" credit.", true),
    lastUpdated: bool("Show when the resume was last updated.", true),
  },
};

// ============================================================================
// DEFAULTS
// ============================================================================

function isLeaf(node) {
  return node && typeof node === "object" && "type" in node && "desc" in node;
}

function buildDefaults(schema) {
  const out = {};
  for (const [key, node] of Object.entries(schema)) {
    if (key.startsWith("_")) continue;
    out[key] = isLeaf(node) ? clone(node.default) : buildDefaults(node);
  }
  return out;
}

function clone(v) {
  return Array.isArray(v) ? [...v] : v && typeof v === "object" ? { ...v } : v;
}

export const DEFAULT_CONFIG = buildDefaults(CONFIG_SCHEMA);

// ============================================================================
// LEGACY SHAPES → CURRENT SHAPE
// ============================================================================

function migrateLegacy(raw) {
  const cfg = JSON.parse(JSON.stringify(raw || {}));

  // accent at top level or theme.accent → colors.accent
  if (typeof cfg.accent === "string") {
    cfg.colors = { ...(cfg.colors || {}), accent: cfg.colors?.accent || cfg.accent };
    delete cfg.accent;
  }
  if (cfg.theme && typeof cfg.theme === "object") {
    if (typeof cfg.theme.accent === "string") {
      cfg.colors = { ...(cfg.colors || {}), accent: cfg.colors?.accent || cfg.theme.accent };
      delete cfg.theme.accent;
    }
    if (typeof cfg.theme.dark === "boolean") {
      cfg.theme.mode = cfg.theme.mode || (cfg.theme.dark ? "dark" : "light");
      delete cfg.theme.dark;
    }
  }
  // themeToggle.style → theme.toggle
  if (cfg.themeToggle && typeof cfg.themeToggle === "object") {
    cfg.theme = { ...(cfg.theme || {}), toggle: cfg.theme?.toggle || cfg.themeToggle.style };
    delete cfg.themeToggle;
  }
  // blog: false shorthand
  if (typeof cfg.blog === "boolean") cfg.blog = { enabled: cfg.blog };
  // animation.type / transitionDuration / shadowOnHover / glowOnHover (v1)
  if (cfg.animation && typeof cfg.animation === "object") {
    const a = cfg.animation;
    if (a.type && !a.intro) a.intro = a.type;
    if (a.transitionDuration && a.duration === undefined) a.duration = parseFloat(a.transitionDuration);
    if (a.shadowOnHover !== undefined || a.glowOnHover !== undefined) {
      a.hover = { ...(a.hover || {}) };
      if (a.shadowOnHover !== undefined) a.hover.shadow = !!a.shadowOnHover;
      if (a.glowOnHover !== undefined) a.hover.glow = !!a.glowOnHover;
    }
    delete a.type;
    delete a.transitionDuration;
    delete a.shadowOnHover;
    delete a.glowOnHover;
  }
  // projects.imagePosition was meaningful only for some layouts — keep as is
  return cfg;
}

// ============================================================================
// NORMALIZE + VALIDATE
// ============================================================================

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC_COLOR_RE = /^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\([^;{}]*\)$/i;

export function isValidColor(value) {
  return typeof value === "string" && (HEX_RE.test(value.trim()) || FUNC_COLOR_RE.test(value.trim()));
}

function coerceLeaf(node, value, path, warnings) {
  switch (node.type) {
    case "string":
      if (typeof value === "string") return value;
      if (typeof value === "number") return String(value);
      break;
    case "color":
      if (value === "" || isValidColor(value)) return value.trim();
      warnings.push(`${path}: "${value}" is not a color. Use a hex value like #2f5d62.`);
      return node.default;
    case "boolean":
      if (typeof value === "boolean") return value;
      if (value === "true" || value === "false") return value === "true";
      break;
    case "number": {
      const n = typeof value === "string" ? parseFloat(value) : value;
      if (typeof n === "number" && Number.isFinite(n)) {
        const clamped = Math.min(node.max ?? Infinity, Math.max(node.min ?? -Infinity, n));
        if (clamped !== n) warnings.push(`${path}: ${n} is out of range (${node.min}–${node.max}); using ${clamped}.`);
        return clamped;
      }
      break;
    }
    case "enum":
      if (node.values.includes(value)) return value;
      warnings.push(`${path}: "${value}" isn't supported. Use one of: ${node.values.join(", ")}.`);
      return node.default;
    case "array":
      if (Array.isArray(value)) {
        const items = value.filter((v) => typeof v === "string").map((v) => v.trim());
        if (node.values) {
          const bad = items.filter((v) => !node.values.includes(v.toLowerCase()));
          if (bad.length) warnings.push(`${path}: unknown value(s) ${bad.join(", ")}. Allowed: ${node.values.join(", ")}.`);
          return items.map((v) => v.toLowerCase()).filter((v) => node.values.includes(v));
        }
        return items;
      }
      if (typeof value === "string") return [value];
      break;
    case "tabs":
      if (Array.isArray(value)) return normalizeTabs(value, path, warnings);
      break;
    case "map":
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
          if (!node.keys.includes(k)) warnings.push(`${path}.${k}: unknown key. Allowed: ${node.keys.join(", ")}.`);
          else if (typeof v === "string") out[k] = v;
        }
        return out;
      }
      break;
  }
  warnings.push(`${path}: expected ${node.type === "enum" ? "one of " + node.values.join(", ") : node.type}.`);
  return clone(node.default);
}

// ============================================================================
// CUSTOM TABS
// ============================================================================

export const TAB_TYPES = ["link", "embed", "markdown", "code", "html"];
export const TAB_FILE_HOSTS = ["raw.githubusercontent.com", "gist.githubusercontent.com"];
const RESERVED_TAB_SLUGS = new Set(["profile", "blog"]);
const MAX_TAB_CONTENT = 200_000;

function httpsUrl(value) {
  try {
    const u = new URL(String(value || "").trim());
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

function tabSlug(label) {
  return slugify(label) || "tab";
}

function normalizeTabs(items, path, warnings) {
  const out = [];
  const used = new Set(RESERVED_TAB_SLUGS);
  items.slice(0, 8).forEach((item, i) => {
    const p = `${path}[${i}]`;
    if (!item || typeof item !== "object") return warnings.push(`${p}: should be an object.`);
    const label = typeof item.label === "string" ? item.label.trim().slice(0, 24) : "";
    if (!label) return warnings.push(`${p}.label: missing.`);
    const type = TAB_TYPES.includes(item.type) ? item.type : null;
    if (!type) return warnings.push(`${p}.type: use one of ${TAB_TYPES.join(", ")}.`);

    const tab = { label, type };
    if (type === "link" || type === "embed") {
      const u = httpsUrl(item.url);
      if (!u) return warnings.push(`${p}.url: needs an https:// address.`);
      tab.url = u.href;
    } else if (typeof item.content === "string" && item.content.trim()) {
      tab.content = item.content.slice(0, MAX_TAB_CONTENT);
    } else {
      const u = httpsUrl(item.url);
      if (!u || !TAB_FILE_HOSTS.includes(u.hostname)) {
        return warnings.push(`${p}: give "content", or a "url" on ${TAB_FILE_HOSTS.join(" or ")}.`);
      }
      tab.url = u.href;
    }
    if (type === "code" && typeof item.language === "string") tab.language = item.language.slice(0, 30);
    if (type === "embed" || type === "html") {
      const height = Number(item.height);
      tab.height = Number.isFinite(height) ? Math.min(2000, Math.max(200, height)) : 640;
    }

    let slug = tabSlug(label);
    for (let n = 2; used.has(slug); n++) slug = `${tabSlug(label)}-${n}`;
    used.add(slug);
    tab.slug = slug;
    out.push(tab);
  });
  if (items.length > 8) warnings.push(`${path}: only the first 8 tabs are used.`);
  return out;
}

function normalizeNode(schema, raw, path, warnings) {
  const out = {};
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  if (raw !== undefined && (typeof raw !== "object" || Array.isArray(raw))) {
    warnings.push(`${path || "config"}: expected an object.`);
  }
  for (const [key, node] of Object.entries(schema)) {
    if (key.startsWith("_")) continue;
    const p = path ? `${path}.${key}` : key;
    if (isLeaf(node)) {
      out[key] = input[key] === undefined || input[key] === null ? clone(node.default) : coerceLeaf(node, input[key], p, warnings);
    } else {
      out[key] = normalizeNode(node, input[key], p, warnings);
    }
  }
  for (const key of Object.keys(input)) {
    if (!(key in schema)) warnings.push(`${path ? path + "." : ""}${key}: unknown option (ignored).`);
  }
  return out;
}

/**
 * Reads meta["mz-portfolio-config"] (object, or array whose first item is the
 * config) plus meta.theme, and returns { config, warnings }.
 */
export function normalizeConfig(meta = {}) {
  const warnings = [];
  let raw = meta?.["mz-portfolio-config"];
  if (Array.isArray(raw)) raw = raw[0];
  const migrated = migrateLegacy(raw || {});
  const config = normalizeNode(CONFIG_SCHEMA, migrated, "", warnings);

  // Section order: keep user order, append missing sections, drop unknown
  const seen = new Set();
  config.sections.order = [...config.sections.order, ...SECTION_KEYS].filter((k) => {
    if (seen.has(k) || !SECTION_KEYS.includes(k)) return false;
    seen.add(k);
    return true;
  });

  // Resume theme: meta.theme (JSON Resume standard) wins
  if (typeof meta?.theme === "string" && meta.theme.trim()) config.resume.theme = meta.theme.trim();
  if (!config.resume.theme) config.resume.theme = "even";

  return { config, warnings };
}

// ============================================================================
// APPLY GLOBAL STYLE OPTIONS (colors, fonts, radius, motion)
// ============================================================================

const RADIUS = { none: "0", small: "0.375rem", medium: "0.75rem", large: "1.25rem" };
const EASING = {
  smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
  linear: "linear",
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
};

export function applyStyleConfig(config, root = document.documentElement) {
  for (const token of COLOR_TOKENS) {
    const value = config.colors[token];
    if (value) root.style.setProperty(`--${token}`, value);
    else root.style.removeProperty(`--${token}`);
  }
  root.style.setProperty("--font-family", `var(--font-${config.typography.font})`);
  root.style.setProperty("--font-scale", String(config.typography.scale));
  root.style.setProperty("--radius", RADIUS[config.shape.radius]);
  root.style.setProperty("--anim-duration", `${config.animation.duration}s`);
  root.style.setProperty("--anim-ease", EASING[config.animation.easing]);

  root.classList.toggle("hover-lift", config.animation.hover.lift);
  root.classList.toggle("hover-shadow", config.animation.hover.shadow);
  root.classList.toggle("hover-glow", config.animation.hover.glow);
  root.dataset.navLabels = config.navbar.labels;
}

export function resetStyleConfig(root = document.documentElement) {
  for (const token of COLOR_TOKENS) root.style.removeProperty(`--${token}`);
  for (const prop of ["--font-family", "--font-scale", "--radius", "--anim-duration", "--anim-ease"]) {
    root.style.removeProperty(prop);
  }
  root.classList.remove("hover-lift", "hover-shadow", "hover-glow");
  delete root.dataset.navLabels;
}
