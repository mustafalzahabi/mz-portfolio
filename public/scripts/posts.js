// ============================================================================
// BLOG POST FORMAT — one gist (or one Drive .md file) per post: a Markdown
// file with YAML frontmatter, the way people already blog from gists.
// Keys follow dev.to's frontmatter (title, description, tags, cover_image,
// canonical_url, published) plus date and slug from Jekyll/Hugo, so a post
// copies to dev.to, Hashnode, Jekyll or Hugo as is. Reading is lenient:
// summary/preview, image/images, draft and "a, b" tag strings all work.
// ============================================================================

import { slugify } from "./utils.js";

const DATED = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

const list = (v) =>
  Array.isArray(v) ? v.map((t) => String(t).trim()).filter(Boolean)
  : v ? String(v).split(",").map((t) => t.trim()).filter(Boolean)
  : [];

/** The post file's name without .md and without a YYYY-MM-DD- prefix, plus that date. */
export function splitFilename(filename = "") {
  const base = String(filename).replace(/\.(md|markdown)$/i, "");
  const m = base.match(DATED);
  return m ? { date: m[1], name: m[2] } : { date: "", name: base };
}

/**
 * Normalized post fields from frontmatter, with fallbacks:
 * title: frontmatter → gist description → first # heading → filename;
 * date: frontmatter → filename prefix → created time;
 * slug: frontmatter → title.
 */
export function postFields(metadata = {}, { body = "", filename = "", fallbackTitle = "", created = "" } = {}) {
  const file = splitFilename(filename);
  const firstHeading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title = String(metadata.title || fallbackTitle || firstHeading || file.name || "Untitled");
  const images = Array.isArray(metadata.images) ? metadata.images : [];
  return {
    title,
    slug: slugify(metadata.slug || title),
    date: String(metadata.date || file.date || created || ""),
    tags: list(metadata.tags),
    description: String(metadata.description || metadata.summary || metadata.preview || ""),
    image: String(metadata.cover_image || metadata.image || images[0] || ""),
    canonical: String(metadata.canonical_url || ""),
    draft: metadata.published === false || metadata.draft === true,
  };
}

/** Frontmatter + body for a post, in dev.to's key names. */
export function frontmatter(post) {
  const q = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const lines = ["---", `title: ${q(post.title || "Untitled")}`];
  if (post.description) lines.push(`description: ${q(post.description)}`);
  if (post.date) lines.push(`date: ${post.date}`);
  if (post.tags?.length) lines.push(`tags: [${post.tags.map((t) => q(t)).join(", ")}]`);
  if (post.image) lines.push(`cover_image: ${q(post.image)}`);
  if (post.canonical) lines.push(`canonical_url: ${q(post.canonical)}`);
  if (post.slug) lines.push(`slug: ${post.slug}`);
  lines.push(`published: ${post.draft ? "false" : "true"}`);
  lines.push("---", "");
  return `${lines.join("\n")}\n${String(post.body || "").trim()}\n`;
}
