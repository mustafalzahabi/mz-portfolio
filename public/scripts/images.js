// ============================================================================
// IMAGES — uploaded photos and banners without a backend.
// Gists only take text, so an uploaded image is stored in the resume gist as a
// small .txt file holding a data: URL, and the settings keep a normal link to
// that file. resolveImage() turns such a link back into a displayable image;
// any other link is used as is.
// ============================================================================

import { safeUrl } from "./utils.js";

const GIST_TEXT_IMAGE = /^https:\/\/gist\.githubusercontent\.com\/[^?#\s]+\.txt$/i;
const cache = new Map();

export const isGistImage = (url) => GIST_TEXT_IMAGE.test(String(url || "").trim());

/** A URL an <img> or CSS background can use, or "" when there is nothing to show. */
export function resolveImage(url) {
  const u = String(url || "").trim();
  if (!isGistImage(u)) return Promise.resolve(safeUrl(u, { allowDataImage: true }));
  if (!cache.has(u)) {
    cache.set(u, fetch(u)
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => safeUrl(text.trim(), { allowDataImage: true }))
      .catch(() => ""));
  }
  return cache.get(u);
}

/**
 * Shrinks a picked file into a compact data: URL (WebP, JPEG where WebP
 * encoding isn't supported). `square` center-crops, for profile photos.
 */
export async function imageToDataUrl(file, { maxWidth, maxHeight, square = false, quality = 0.85 }) {
  if (!file?.type?.startsWith("image/")) throw new Error("That file isn't an image.");
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image couldn't be read. Try a JPG, PNG or WebP.");
  }
  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = sh = side;
  }
  const scale = Math.min(1, maxWidth / sw, maxHeight / sh);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  let url = canvas.toDataURL("image/webp", quality);
  if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", quality);
  if (url.length > 900_000) throw new Error("This image is too large even after shrinking. Try a smaller one.");
  return url;
}

export const IMAGE_FILES = { photo: "portfolio-photo.txt", banner: "portfolio-banner.txt" };
