// ============================================================================
// Link previews for blog posts. Crawlers (LinkedIn, Slack, X, …) don't run the
// app's JavaScript, so /<github-user>/blog/<slug> would otherwise share the
// generic site card. For crawler requests only, the middleware looks the post
// up in the owner's gists and fills title, description and image into the
// page's existing meta tags. The slug index is cached for an hour.
// ============================================================================

import { parseFrontmatter } from "../public/scripts/utils.js";
import { postFields } from "../public/scripts/posts.js";

export const CRAWLER_RE =
  /bot\b|crawler|spider|facebookexternalhit|linkedin|slack|twitter|discord|whatsapp|telegram|skype|embedly|pinterest|redditbot|mastodon|bluesky|preview/i;

const POST_PATH_RE = /^\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/blog\/([^/]+)\/?$/;

/** { user, slug } for a blog post path, else null. */
export function matchPostPath(pathname) {
  const m = String(pathname).match(POST_PATH_RE);
  if (!m) return null;
  try {
    return { user: m[1], slug: decodeURIComponent(m[2]).toLowerCase() };
  } catch {
    return null;
  }
}

/** The first absolute http(s) picture of a post: cover, else first image in the text. */
export function absoluteImage(fields, body) {
  const candidates = [fields.image, body.match(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/)?.[1]];
  return candidates.find((u) => /^https:\/\//i.test(u || "")) || "";
}

/** slug → { title, description, image } for every published Markdown gist. */
export async function buildIndex(gists, fetchText) {
  const index = {};
  const candidates = gists.filter((g) => Object.keys(g.files || {}).some((n) => /\.md$/i.test(n)));
  await Promise.all(
    candidates.slice(0, 100).map(async (gist) => {
      const file = Object.values(gist.files).find((f) => /\.md$/i.test(f.filename));
      const content = await fetchText(file.raw_url).catch(() => "");
      if (!content) return;
      const { metadata, body } = parseFrontmatter(content);
      const fields = postFields(metadata, { body, filename: file.filename, fallbackTitle: gist.description, created: gist.created_at });
      if (fields.draft || index[fields.slug]) return;
      index[fields.slug] = { title: fields.title, description: fields.description, image: absoluteImage(fields, body), date: fields.date };
    }),
  );
  return index;
}

const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);

/** RSS 2.0 for an owner's posts, newest first. */
export function rssFeed(index, { origin, user }) {
  const base = `${origin}/${encodeURIComponent(user)}`;
  const items = Object.entries(index)
    .sort(([, a], [, b]) => String(b.date).localeCompare(String(a.date)))
    .map(([slug, p]) => {
      const link = `${base}/blog/${encodeURIComponent(slug)}`;
      const date = new Date(p.date);
      return [
        "<item>",
        `<title>${esc(p.title)}</title>`,
        `<link>${esc(link)}</link>`,
        `<guid isPermaLink="true">${esc(link)}</guid>`,
        p.description ? `<description>${esc(p.description)}</description>` : "",
        Number.isNaN(date.getTime()) ? "" : `<pubDate>${date.toUTCString()}</pubDate>`,
        "</item>",
      ].join("");
    });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(user)} — Blog</title><link>${esc(base)}/blog</link><description>Posts by ${esc(user)}</description><atom:link href="${esc(base)}/feed.xml" rel="self" type="application/rss+xml"/>${items.join("")}</channel></rss>`;
}

const FEED_PATH_RE = /^\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/feed\.xml$/;

/** The RSS response for /<github-user>/feed.xml, else null. */
export async function feedResponse(request, waitUntil) {
  const url = new URL(request.url);
  const m = url.pathname.match(FEED_PATH_RE);
  if (!m) return null;
  const index = await cachedIndex(m[1], waitUntil).catch(() => null);
  if (!index || !Object.keys(index).length) return new Response("No posts found.", { status: 404 });
  return new Response(rssFeed(index, { origin: url.origin, user: m[1] }), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

/** Feed readers find the feed from a <link rel="alternate"> on the blog pages. */
export function withFeedLink(request, response) {
  const m = new URL(request.url).pathname.match(/^\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/blog(?:\/[^/]+)?\/?$/);
  if (!m) return response;
  return new HTMLRewriter()
    .on("head", { element(el) { el.append(`<link rel="alternate" type="application/rss+xml" title="Blog" href="/${m[1]}/feed.xml">`, { html: true }); } })
    .transform(response);
}

const GH_HEADERS = { Accept: "application/vnd.github+json", "User-Agent": "mz-portfolio" };

async function cachedIndex(user, waitUntil) {
  const cache = caches.default;
  const key = new Request(`https://post-meta.internal/${user.toLowerCase()}`);
  const hit = await cache.match(key);
  if (hit) return hit.json();
  const res = await fetch(`https://api.github.com/users/${user}/gists?per_page=100`, { headers: GH_HEADERS });
  if (!res.ok) return {};
  const gists = await res.json();
  const index = await buildIndex(Array.isArray(gists) ? gists : [], async (url) => {
    const r = await fetch(url, { headers: { "User-Agent": "mz-portfolio" } });
    return r.ok ? r.text() : "";
  });
  const stored = new Response(JSON.stringify(index), { headers: { "Content-Type": "application/json", "Cache-Control": "max-age=3600" } });
  waitUntil(cache.put(key, stored));
  return index;
}

/** Rewrites the page's meta tags for a crawler visiting a post; any failure leaves the page as it was. */
export async function withPostMeta(request, response, waitUntil) {
  const url = new URL(request.url);
  const match = matchPostPath(url.pathname);
  if (!match || !CRAWLER_RE.test(request.headers.get("user-agent") || "")) return response;
  let meta;
  try {
    meta = (await cachedIndex(match.user, waitUntil))[match.slug];
  } catch {
    return response;
  }
  if (!meta) return response;
  const title = meta.title;
  const description = meta.description || title;
  const props = {
    "og:title": title,
    "og:description": description,
    "og:type": "article",
    "og:url": url.origin + url.pathname,
    ...(meta.image ? { "og:image": meta.image } : {}),
  };
  const names = {
    description,
    ...(meta.image ? { "twitter:card": "summary_large_image" } : {}),
  };
  return new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(title); } })
    .on("meta[property]", { element(el) { const v = props[el.getAttribute("property")]; if (v) el.setAttribute("content", v); } })
    .on("meta[name]", { element(el) { const v = names[el.getAttribute("name")]; if (v) el.setAttribute("content", v); } })
    .transform(response);
}
