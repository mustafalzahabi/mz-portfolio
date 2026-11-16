// ============================================================================
// STATIC CHECKS — zero dependencies. `node tools/check.mjs` or via node --test.
// - every relative import in public/scripts resolves
// - HTML is CSP-safe: no inline event handlers, no inline <script> code
// - colors come only from the token block (style.css) — resume themes and
//   the logo excepted, since they must look like their originals
// - every @import in styles/style.css exists
// ============================================================================

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");

export function checkImports(files = walk(join(PUBLIC, "scripts")).filter((f) => extname(f) === ".js")) {
  const problems = [];
  const re = /(?:^|\n)\s*(?:import|export)\s[^"'`]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(re)) {
      const spec = m[1] || m[2];
      if (!spec.startsWith(".")) continue;
      if (!existsSync(resolve(dirname(file), spec))) problems.push(`${rel(file)}: import "${spec}" not found`);
    }
  }
  return problems;
}

// sandbox.html runs untrusted demo HTML at an opaque origin with its own CSP
export function checkHtml(files = walk(PUBLIC).filter((f) => extname(f) === ".html" && !f.endsWith("sandbox.html"))) {
  const problems = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/<[a-z][^>]*\son[a-z]+\s*=/gi)) problems.push(`${rel(file)}: inline event handler (${m[0].slice(0, 40)}…)`);
    for (const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (!/\bsrc=/.test(m[1]) && !/type=["']application\/(ld\+)?json["']/.test(m[1]) && m[2].trim()) {
        problems.push(`${rel(file)}: inline <script> code (blocked by the CSP)`);
      }
    }
  }
  return problems;
}

const COLOR_RE = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/gi;

/** The stylesheets the app actually loads: style.css and what it @imports. */
function loadedStyles(entry = join(PUBLIC, "styles", "style.css")) {
  const src = readFileSync(entry, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const parts = [...src.matchAll(/@import\s+(?:url\()?["']([^"')?]+)/g)].map((m) => resolve(dirname(entry), m[1])).filter(existsSync);
  return [entry, ...parts];
}

export function checkColors(files = loadedStyles()) {
  const problems = [];
  for (const file of files) {
    let src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    if (file.endsWith(`${"styles"}${file.includes("\\") ? "\\" : "/"}style.css`)) {
      // Token block + its static fallback are the only place colors are defined
      src = src.replace(/--(base|core|accent|variant|surface|depth|optimal|risky|fatal|prime):[^;]+;/g, "");
      src = src.replace(/@supports not[\s\S]*?\n\}/g, "");
    }
    src.split("\n").forEach((line, i) => {
      if (COLOR_RE.test(line)) problems.push(`${rel(file)}:${i + 1}: hard-coded color: ${line.trim()}`);
      COLOR_RE.lastIndex = 0;
    });
  }
  return problems;
}

export function checkCssImports(file = join(PUBLIC, "styles", "style.css")) {
  const problems = [];
  const src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of src.matchAll(/@import\s+(?:url\()?["']([^"')]+)/g)) {
    const path = m[1].split("?")[0];
    if (/^https?:/.test(path)) continue;
    if (!existsSync(resolve(dirname(file), path))) problems.push(`${rel(file)}: @import "${path}" not found`);
  }
  return problems;
}

export function runAll() {
  return { imports: checkImports(), html: checkHtml(), colors: checkColors(), cssImports: checkCssImports() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = runAll();
  let failed = 0;
  for (const [name, problems] of Object.entries(results)) {
    console.log(`${problems.length ? "✖" : "✔"} ${name}${problems.length ? ` (${problems.length})` : ""}`);
    for (const p of problems) console.log(`   ${p}`);
    failed += problems.length;
  }
  process.exit(failed ? 1 : 0);
}
