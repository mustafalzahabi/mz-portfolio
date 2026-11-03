// ============================================================================
// DEV SERVER — serves ./public like Cloudflare Pages does in production:
// files when they exist, otherwise public/index.html (SPA fallback), so
// /username/project/x works locally. Zero dependencies.
// usage: node tools/dev-server.mjs [port]
// ============================================================================

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const PORT = Number(process.argv[2] || process.env.PORT || 8000);
const PUBLIC_DIR = resolve(import.meta.dirname, "..", "public");

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
    const found = await fileFor(req.url);
    // Assets that don't exist are real 404s; page routes fall back to the app
    const looksLikeAsset = /\.[a-z0-9]+$/i.test(req.url.split("?")[0]);
    if (!found && looksLikeAsset) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    const path = found || join(PUBLIC_DIR, "index.html");
    const data = await readFile(path);
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

server.listen(PORT, () => console.log(`mz-portfolio dev server: http://localhost:${PORT}`));
