// ============================================================================
// MARKDOWN → SAFE HTML
// Small in-house CommonMark/GFM subset: headings, paragraphs, emphasis,
// strikethrough, inline/fenced code, links, autolinks, images, block quotes,
// nested ordered/unordered/task lists, tables, horizontal rules, and a
// whitelisted subset of inline HTML (img, a, br, b, i, em, strong, code, kbd,
// sub, sup, details, summary). Everything else is escaped. All URLs pass
// through safeUrl(). Pure string code — runs in Node for tests.
// ============================================================================

import { escapeHtml, safeUrl } from "./utils.js";

/**
 * @param {string} markdown
 * @param {{ baseUrl?: string, rawBaseUrl?: string, headingOffset?: number }} opts
 *   baseUrl     resolves relative links (e.g. https://github.com/u/r/blob/main/)
 *   rawBaseUrl  resolves relative images (e.g. https://raw.githubusercontent.com/u/r/main/)
 *   headingOffset shifts heading levels (1 → "# x" renders as <h2>)
 */
export function markdownToHtml(markdown, opts = {}) {
  const src = String(markdown || "").replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  const ctx = {
    baseUrl: opts.baseUrl || "",
    rawBaseUrl: opts.rawBaseUrl || opts.baseUrl || "",
    headingOffset: opts.headingOffset ?? 0,
    refs: collectReferences(src),
  };
  return parseBlocks(stripReferences(src).split("\n"), ctx);
}

// ============================================================================
// REFERENCES  [label]: url "title"
// ============================================================================

const REF_RE = /^ {0,3}\[([^\]]+)\]:\s*<?(\S+?)>?(?:\s+["'(].*["')])?\s*$/;

function collectReferences(src) {
  const refs = {};
  for (const line of src.split("\n")) {
    const m = line.match(REF_RE);
    if (m) refs[m[1].toLowerCase()] = m[2];
  }
  return refs;
}

function stripReferences(src) {
  return src
    .split("\n")
    .filter((line) => !REF_RE.test(line))
    .join("\n");
}

// ============================================================================
// BLOCK PARSER
// ============================================================================

const RE = {
  fence: /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)?.*$/,
  heading: /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/,
  setextH1: /^ {0,3}=+\s*$/,
  setextH2: /^ {0,3}-+\s*$/,
  hr: /^ {0,3}([-*_])(\s*\1){2,}\s*$/,
  quote: /^ {0,3}>\s?(.*)$/,
  list: /^( *)([-*+]|\d{1,9}[.)])\s+(.*)$/,
  tableSep: /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/,
  blank: /^\s*$/,
  htmlBlock: /^\s*<\/?(div|p|center|table|section|picture|h[1-6]|details|summary)\b[^>]*>\s*$/i,
};

function parseBlocks(lines, ctx) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (RE.blank.test(line)) {
      i++;
      continue;
    }

    // Fenced code
    const fence = line.match(RE.fence);
    if (fence) {
      const marker = fence[1];
      const lang = (fence[2] || "").toLowerCase();
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      out.push(`<pre><code${cls}>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    // Indented code (4 spaces) — only when not inside a list context
    if (/^ {4,}\S/.test(line)) {
      const body = [];
      while (i < lines.length && (/^ {4,}/.test(lines[i]) || RE.blank.test(lines[i]))) {
        body.push(lines[i].replace(/^ {4}/, ""));
        i++;
      }
      out.push(`<pre><code>${escapeHtml(body.join("\n").replace(/\n+$/, ""))}</code></pre>`);
      continue;
    }

    // ATX heading
    const heading = line.match(RE.heading);
    if (heading) {
      out.push(renderHeading(heading[1].length, heading[2], ctx));
      i++;
      continue;
    }

    // Horizontal rule
    if (RE.hr.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    // Block quote
    if (RE.quote.test(line)) {
      const body = [];
      while (i < lines.length && !RE.blank.test(lines[i])) {
        const m = lines[i].match(RE.quote);
        body.push(m ? m[1] : lines[i]);
        i++;
      }
      out.push(`<blockquote>${parseBlocks(body, ctx)}</blockquote>`);
      continue;
    }

    // List
    if (RE.list.test(line)) {
      const result = parseList(lines, i, ctx);
      out.push(result.html);
      i = result.next;
      continue;
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && RE.tableSep.test(lines[i + 1])) {
      const result = parseTable(lines, i, ctx);
      out.push(result.html);
      i = result.next;
      continue;
    }

    // Standalone HTML block line (<p align="center">, </div>, …) → sanitize inline
    if (RE.htmlBlock.test(line)) {
      const html = sanitizeHtml(line.trim(), ctx);
      if (html) out.push(html);
      i++;
      continue;
    }

    // Paragraph (with setext heading detection)
    const para = [];
    while (
      i < lines.length &&
      !RE.blank.test(lines[i]) &&
      !RE.fence.test(lines[i]) &&
      !RE.heading.test(lines[i]) &&
      !RE.quote.test(lines[i]) &&
      !(para.length && RE.list.test(lines[i]) && !/^\s*\d{2,}/.test(lines[i])) &&
      !(para.length && RE.hr.test(lines[i]) && !RE.setextH2.test(lines[i]))
    ) {
      if (para.length && RE.setextH1.test(lines[i])) {
        out.push(renderHeading(1, para.join(" "), ctx));
        para.length = 0;
        i++;
        break;
      }
      if (para.length && RE.setextH2.test(lines[i])) {
        out.push(renderHeading(2, para.join(" "), ctx));
        para.length = 0;
        i++;
        break;
      }
      para.push(lines[i]);
      i++;
    }
    if (para.length) out.push(`<p>${renderInline(para.join("\n"), ctx)}</p>`);
  }

  return out.join("\n");
}

function renderHeading(level, text, ctx) {
  const lvl = Math.min(6, Math.max(1, level + ctx.headingOffset));
  const plain = text.replace(/[`*_~[\]()!<>]/g, "");
  const id = plain
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
  return `<h${lvl} id="${escapeHtml(id)}">${renderInline(text, ctx)}</h${lvl}>`;
}

// ============================================================================
// LISTS (nested, ordered/unordered, task items)
// ============================================================================

function parseList(lines, start, ctx) {
  const first = lines[start].match(RE.list);
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const startNum = ordered ? parseInt(first[2], 10) : 1;
  const items = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(RE.list);

    if (m && m[1].length === baseIndent && /\d/.test(m[2]) === ordered) {
      items.push([m[3]]);
      i++;
      continue;
    }

    if (RE.blank.test(line)) {
      // A blank line ends the list unless the next line continues it
      const next = lines[i + 1];
      if (next !== undefined && (indentOf(next) > baseIndent || (RE.list.test(next) && indentOf(next) === baseIndent))) {
        items[items.length - 1]?.push("");
        i++;
        continue;
      }
      break;
    }

    if (indentOf(line) > baseIndent && items.length) {
      items[items.length - 1].push(line.slice(Math.min(indentOf(line), baseIndent + 2)));
      i++;
      continue;
    }

    // Lazy continuation of the last item's paragraph
    if (!m && items.length && !RE.heading.test(line) && !RE.fence.test(line) && !RE.quote.test(line)) {
      items[items.length - 1].push(line);
      i++;
      continue;
    }
    break;
  }

  const tag = ordered ? "ol" : "ul";
  const startAttr = ordered && startNum !== 1 ? ` start="${startNum}"` : "";
  const lis = items.map((itemLines) => {
    let first = itemLines[0];
    let task = "";
    const taskMatch = first.match(/^\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      task = `<input type="checkbox" disabled${taskMatch[1] !== " " ? " checked" : ""}> `;
      first = taskMatch[2];
    }
    const rest = itemLines.slice(1);
    const hasBlocks = rest.some((l) => RE.list.test(l) || RE.fence.test(l) || RE.blank.test(l));
    if (!rest.length) return `<li${task ? ' class="task"' : ""}>${task}${renderInline(first, ctx)}</li>`;
    if (!hasBlocks) {
      return `<li${task ? ' class="task"' : ""}>${task}${renderInline([first, ...rest].join("\n"), ctx)}</li>`;
    }
    // Inline first paragraph, nested blocks after
    const firstPara = [first];
    let k = 0;
    while (k < rest.length && !RE.blank.test(rest[k]) && !RE.list.test(rest[k]) && !RE.fence.test(rest[k])) {
      firstPara.push(rest[k]);
      k++;
    }
    return `<li${task ? ' class="task"' : ""}>${task}${renderInline(firstPara.join("\n"), ctx)}${parseBlocks(rest.slice(k), ctx)}</li>`;
  });

  return { html: `<${tag}${startAttr}>${lis.join("")}</${tag}>`, next: i };
}

function indentOf(line) {
  return line.match(/^ */)[0].length;
}

// ============================================================================
// TABLES (GFM)
// ============================================================================

function splitRow(row) {
  let r = row.trim();
  if (r.startsWith("|")) r = r.slice(1);
  if (r.endsWith("|") && !r.endsWith("\\|")) r = r.slice(0, -1);
  const cells = [];
  let cur = "";
  let inCode = false;
  for (let k = 0; k < r.length; k++) {
    const ch = r[k];
    if (ch === "`") inCode = !inCode;
    if (ch === "\\" && r[k + 1] === "|") {
      cur += "|";
      k++;
      continue;
    }
    if (ch === "|" && !inCode) {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function parseTable(lines, start, ctx) {
  const header = splitRow(lines[start]);
  const aligns = splitRow(lines[start + 1]).map((c) => {
    const left = c.startsWith(":");
    const right = c.endsWith(":");
    return left && right ? "center" : right ? "right" : left ? "left" : "";
  });
  let i = start + 2;
  const rows = [];
  while (i < lines.length && lines[i].includes("|") && !RE.blank.test(lines[i])) {
    rows.push(splitRow(lines[i]));
    i++;
  }
  const cell = (tag, text, idx) => {
    const align = aligns[idx] ? ` style="text-align:${aligns[idx]}"` : "";
    return `<${tag}${align}>${renderInline(text || "", ctx)}</${tag}>`;
  };
  const thead = `<thead><tr>${header.map((c, k) => cell("th", c, k)).join("")}</tr></thead>`;
  const tbody = rows.length
    ? `<tbody>${rows.map((r) => `<tr>${header.map((_, k) => cell("td", r[k], k)).join("")}</tr>`).join("")}</tbody>`
    : "";
  return { html: `<div class="table-wrap"><table>${thead}${tbody}</table></div>`, next: i };
}

// ============================================================================
// INLINE
// ============================================================================

function resolveUrl(url, base, isImage) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  const isRelative = !/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.startsWith("//");
  if (isRelative) {
    if (raw.startsWith("#")) return raw;
    if (!base) return /^[\w./~%-][\w./~%#?=&+-]*$/.test(raw) ? raw : "";
    try {
      return new URL(raw.replace(/^\//, ""), base).href;
    } catch {
      return "";
    }
  }
  return safeUrl(raw.startsWith("//") ? `https:${raw}` : raw, { allowDataImage: isImage });
}

function linkHtml(text, url, ctx) {
  const href = resolveUrl(url, ctx.baseUrl, false);
  if (!href) return text;
  const external = /^https?:/i.test(href);
  return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
}

function imageHtml(alt, url, ctx) {
  const src = resolveUrl(url, ctx.rawBaseUrl, true);
  if (!src) return escapeHtml(alt);
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
}

export function renderInline(text, ctx = { baseUrl: "", rawBaseUrl: "", refs: {} }) {
  const tokens = [];
  const stash = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  let s = String(text);

  // Code spans
  s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, __, code) => stash(`<code>${escapeHtml(code.trim())}</code>`));

  // Backslash escapes
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!|~<>])/g, (_, ch) => stash(escapeHtml(ch)));

  // Whitelisted inline HTML (before escaping)
  s = s.replace(/<\/?[a-z][a-z0-9]*\b[^<>]*>/gi, (tag) => {
    const html = sanitizeTag(tag, ctx);
    return html === null ? tag : stash(html);
  });

  // Images ![alt](url "title") and reference images ![alt][ref]
  s = s.replace(/!\[([^\]]*)\]\(\s*<?((?:[^\s()<>]|\([^\s()<>]*\))+)>?(?:\s+["'][^"']*["'])?\s*\)/g, (_, alt, url) => stash(imageHtml(alt, url, ctx)));
  s = s.replace(/!\[([^\]]*)\]\[([^\]]*)\]/g, (m, alt, ref) => {
    const url = ctx.refs?.[(ref || alt).toLowerCase()];
    return url ? stash(imageHtml(alt, url, ctx)) : m;
  });

  // Links [text](url "title") and reference links [text][ref] / [text]
  s = s.replace(/\[((?:[^\[\]]|\u0000\d+\u0000)+)\]\(\s*<?((?:[^\s()<>]|\([^\s()<>]*\))*)>?(?:\s+["'][^"']*["'])?\s*\)/g, (_, label, url) =>
    stash(linkHtml(renderEmphasis(escapeHtml(label)), url, ctx)),
  );
  s = s.replace(/\[([^\]]+)\]\[([^\]]*)\]/g, (m, label, ref) => {
    const url = ctx.refs?.[(ref || label).toLowerCase()];
    return url ? stash(linkHtml(renderEmphasis(escapeHtml(label)), url, ctx)) : m;
  });

  // Autolinks <https://…> and bare URLs
  s = s.replace(/<(https?:\/\/[^\s>]+)>/g, (_, url) => stash(linkHtml(escapeHtml(url), url, ctx)));
  s = s.replace(/<([^\s@<>]+@[^\s@<>]+\.[a-z]{2,})>/gi, (_, email) => stash(linkHtml(escapeHtml(email), `mailto:${email}`, ctx)));
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g, (_, pre, url) => pre + stash(linkHtml(escapeHtml(url), url, ctx)));

  // Escape the rest, then emphasis + line breaks
  s = renderEmphasis(escapeHtml(s));
  s = s.replace(/( {2,}|\\)\n/g, "<br>").replace(/\n/g, " ");

  // Restore stashed tokens (may be nested)
  for (let pass = 0; pass < 3 && s.includes("\u0000"); pass++) {
    s = s.replace(/\u0000(\d+)\u0000/g, (_, n) => tokens[+n]);
  }
  return s;
}

function renderEmphasis(s) {
  return s
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "<strong>$2</strong>")
    .replace(/(^|[^\w*])\*(?=\S)([^*]*?\S)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^\w_])_(?=\S)([^_]*?\S)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, "<del>$1</del>");
}

// ============================================================================
// HTML SANITIZER (whitelist)
// ============================================================================

const ALLOWED_TAGS = new Set([
  "a", "img", "br", "b", "strong", "i", "em", "code", "kbd", "sub", "sup",
  "del", "s", "details", "summary", "p", "div", "span", "center", "picture", "source",
  "h1", "h2", "h3", "h4", "h5", "h6",
]);
const DROP_SILENTLY = new Set(["p", "div", "span", "center", "picture", "source", "h1", "h2", "h3", "h4", "h5", "h6"]);

function getAttr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? m[1] ?? m[2] ?? m[3] ?? "" : null;
}

/** Returns sanitized HTML for one tag, "" to drop it, or null if not a tag we handle. */
function sanitizeTag(tag, ctx) {
  const m = tag.match(/^<(\/?)([a-z][a-z0-9]*)/i);
  if (!m) return null;
  const closing = m[1] === "/";
  const name = m[2].toLowerCase();
  if (!ALLOWED_TAGS.has(name)) return "";
  if (DROP_SILENTLY.has(name)) return "";

  if (name === "br") return "<br>";
  if (name === "img") {
    if (closing) return "";
    const src = getAttr(tag, "src");
    if (!src) return "";
    const alt = getAttr(tag, "alt") || "";
    const width = getAttr(tag, "width");
    const img = imageHtml(alt, src, ctx);
    return width && /^\d+%?$/.test(width) && img.startsWith("<img")
      ? img.replace("<img ", `<img width="${escapeHtml(width)}" `)
      : img;
  }
  if (name === "a") {
    if (closing) return "</a>";
    const href = resolveUrl(getAttr(tag, "href") || "", ctx.baseUrl, false);
    if (!href) return "<a>";
    const external = /^https?:/i.test(href);
    return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>`;
  }
  return closing ? `</${name}>` : `<${name}>`;
}

function sanitizeHtml(line, ctx) {
  return line.replace(/<\/?[a-z][a-z0-9]*\b[^<>]*>/gi, (tag) => sanitizeTag(tag, ctx) ?? "").trim();
}

// ============================================================================
// PLAIN TEXT (for excerpts / reading time)
// ============================================================================

export function markdownToText(markdown) {
  return String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
