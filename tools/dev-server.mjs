// ============================================================================
// DEV SERVER — serves ./public like Cloudflare Pages does in production:
// files when they exist, otherwise public/index.html (SPA fallback), so
// /username/project/x works locally. Zero dependencies.
// Like functions/_middleware.js in production, HTML pages get GOOGLE_API_KEY
// and GOOGLE_CLIENT_ID filled in, here from .dev.vars (git-ignored,
// KEY=value lines, the same file `wrangler pages dev` reads).
// usage: node tools/dev-server.mjs [port] [--posts <folder>]
//
// --posts <folder>: preview unpublished blog posts. Every .md file in the
// folder (and its subfolders, except ones starting with "_") is listed at
// /__dev/posts, and its other files (images) are served under
// /__dev/posts/<path>. The preview page (/preview/view) shows them as the
// blog when the site runs on localhost. Nothing is uploaded anywhere.
// ============================================================================

import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, normalize, relative, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const postsFlag = args.indexOf("--posts");
const POSTS_DIR = postsFlag >= 0 && args[postsFlag + 1] ? resolve(args[postsFlag + 1]) : null;
const positional = args.filter((a, i) => i !== postsFlag && i !== postsFlag + 1);
const PORT = Number(positional[0] || process.env.PORT || 8000);
const PUBLIC_DIR = resolve(import.meta.dirname, "..", "public");

/** Every .md under POSTS_DIR as { path, content }; folders starting with "_" are skipped. */
async function localPosts(dir = POSTS_DIR) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await localPosts(full)));
    else if (/\.md$/i.test(entry.name) && !/^(readme|style-guide)\.md$/i.test(entry.name)) {
      const info = await stat(full);
      out.push({ path: relative(POSTS_DIR, full).split(sep).join("/"), content: await readFile(full, "utf8"), modified: info.mtime.toISOString() });
    }
  }
  return out;
}

/** A file inside POSTS_DIR for /__dev/posts/<path>, or null (no ../ escapes). */
async function postFileFor(urlPath) {
  const rel = decodeURIComponent(urlPath.split("?")[0].slice("/__dev/posts/".length));
  const path = normalize(join(POSTS_DIR, rel));
  if (!path.startsWith(POSTS_DIR + sep)) return null;
  try {
    return (await stat(path)).isFile() ? path : null;
  } catch {
    return null;
  }
}

/** KEY=value lines from .dev.vars, if the file exists. */
async function devVars() {
  try {
    const text = await readFile(resolve(import.meta.dirname, "..", ".dev.vars"), "utf8");
    return Object.fromEntries(text.split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  } catch {
    return {};
  }
}

async function fillMeta(html) {
  const vars = await devVars();
  const values = { "mz-google-api-key": vars.GOOGLE_API_KEY, "mz-google-client-id": vars.GOOGLE_CLIENT_ID };
  return html.replace(/<meta name="(mz-google-[a-z-]+)" content="[^"]*">/g, (tag, name) =>
    values[name] ? `<meta name="${name}" content="${values[name].replace(/[^\w.-]/g, "")}">` : tag);
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

async function fileFor(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const path = normalize(join(PUBLIC_DIR, decoded));
  if (!path.startsWith(PUBLIC_DIR)) return null; // no ../ escapes
  try {
    const info = await stat(path);
    if (info.isFile()) return path;
    if (info.isDirectory()) {
      const index = join(path, "index.html");
      if ((await stat(index)).isFile()) return index;
    }
  } catch {
    /* not found */
  }
  return null;
}

const server = createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/__dev/posts")) {
      if (!POSTS_DIR) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Start the dev server with --posts <folder> to preview local posts");
        return;
      }
      if (req.url.split("?")[0] === "/__dev/posts") {
        res.writeHead(200, { "Content-Type": CONTENT_TYPES[".json"], "Cache-Control": "no-store" });
        res.end(JSON.stringify(await localPosts()));
        return;
      }
      const file = await postFileFor(req.url);
      res.writeHead(file ? 200 : 404, {
        "Content-Type": file ? CONTENT_TYPES[extname(file).toLowerCase()] || "application/octet-stream" : "text/plain",
        "Cache-Control": "no-store",
      });
      res.end(file ? await readFile(file) : "Not found");
      return;
    }
    const found = await fileFor(req.url);
    // Assets that don't exist are real 404s; page routes fall back to the app
    const looksLikeAsset = /\.[a-z0-9]+$/i.test(req.url.split("?")[0]);
    if (!found && looksLikeAsset) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    const path = found || join(PUBLIC_DIR, "index.html");
    let data = await readFile(path);
    if (extname(path) === ".html") data = await fillMeta(data.toString("utf8"));
    res.writeHead(200, {
      "Content-Type": CONTENT_TYPES[extname(path).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
    console.error(err);
  }
});

server.listen(PORT, () => {
  console.log(`mz-portfolio dev server: http://localhost:${PORT}`);
  if (POSTS_DIR) console.log(`local posts from ${POSTS_DIR}: open http://localhost:${PORT}/preview/view/blog`);
});
