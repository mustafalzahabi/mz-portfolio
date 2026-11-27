// ============================================================================
// DIRECT EDITING — everything is edited where it's shown, never in a panel.
// Text is typed in place (inline.js). What isn't plain text on the page sits
// in a small strip right inside its card: dates, links, locations, lists as
// chips. Images (photo, banner, project cover) open a short menu on the image
// itself; the photo gets drag & drop, paste and an in-place crop.
// ============================================================================

import { h, svgIcon, toast } from "../utils.js";
import { ICONS } from "../icons.js";
import { getPath, setPath, validateField } from "../editor-core.js";
import { dropdown } from "../account.js";
import { ed, changed, uploadImage, githubForPreview } from "./core.js";
import { editInPlace } from "./inline.js";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif";

// ---------------------------------------------------------------------------
// Small inputs and chip lists
// ---------------------------------------------------------------------------

/** One compact input bound to a resume path (commits on change). */
export function stripInput(path, [key, label, kind = "text", placeholder = ""], { onCommit = () => changed() } = {}) {
  const type = kind === "email" ? "email" : kind === "tel" ? "tel" : kind === "url" ? "url" : "text";
  const input = h("input.ed-strip-input", {
    type, placeholder: placeholder || label, "aria-label": label, title: label,
    inputmode: kind === "date" ? "numeric" : null, spellcheck: kind === "text" ? "true" : "false",
  });
  input.value = String(getPath(ed.resume, path) ?? "");
  input.dataset.kind = kind;
  const size = () => (input.size = Math.max(6, Math.min(36, (input.value || input.placeholder).length + 1)));
  size();
  input.addEventListener("input", size);
  input.addEventListener("change", () => {
    const v = input.value.trim();
    const err = validateField(kind, v);
    input.setAttribute("aria-invalid", err ? "true" : "false");
    if (err) return toast(err, "error");
    setPath(ed.resume, path, v);
    onCommit();
  });
  input.addEventListener("keydown", (e) => e.key === "Enter" && input.blur());
  return h("label.ed-strip-field", { "data-key": key }, h("span.ed-strip-label", label), input);
}

/** Dates typed where they're shown: one date, or a start – end range (empty end = present). */
export function inlineDates(el, basePath, keys) {
  const input = (key, placeholder) => {
    const i = h("input.ed-date-input", { type: "text", inputmode: "numeric", placeholder, "aria-label": key === "endDate" ? "End date (empty = present)" : key === "startDate" ? "Start date" : "Date", title: "YYYY, YYYY-MM or YYYY-MM-DD" });
    i.value = String(getPath(ed.resume, [...basePath, key]) ?? "");
    i.size = 8;
    i.addEventListener("change", () => {
      const v = i.value.trim();
      const err = validateField("date", v);
      i.setAttribute("aria-invalid", err ? "true" : "false");
      if (err) return toast(err, "error");
      setPath(ed.resume, [...basePath, key], v);
      changed();
    });
    i.addEventListener("keydown", (e) => e.key === "Enter" && i.blur());
    return i;
  };
  const parts = keys.length === 2
    ? [input(keys[0], "YYYY-MM"), h("span.ed-date-sep", "–"), input(keys[1], "Present")]
    : [input(keys[0], "YYYY-MM")];
  el.classList.add("ed-dates");
  el.replaceChildren(...parts);
}

/** A list of short values as chips bound to a resume path: × removes, typing + Enter adds. */
export function chipList(path, opts = {}) {
  return chips(() => getPath(ed.resume, path), (v) => {
    setPath(ed.resume, path, v);
    changed();
  }, opts);
}

/** Chips over any list: get() returns it, set(next) stores it. */
export function chips(get, set, { label, placeholder = "Add…" } = {}) {
  const list = () => (Array.isArray(get()) ? get() : []);
  const box = h("div.ed-chips", { role: "group", "aria-label": label || "List" });
  const draw = () => {
    const input = h("input.ed-chip-input", { type: "text", placeholder, "aria-label": `Add to ${label || "the list"}` });
    input.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === ",") && input.value.trim()) {
        e.preventDefault();
        set([...list(), ...input.value.split(",").map((s) => s.trim()).filter(Boolean)]);
        draw();
        box.querySelector(".ed-chip-input")?.focus();
      } else if (e.key === "Backspace" && !input.value && list().length) {
        set(list().slice(0, -1));
        draw();
        box.querySelector(".ed-chip-input")?.focus();
      }
    });
    box.replaceChildren(...[
      label ? h("span.ed-strip-label", label) : null,
      ...list().map((v, i) => h("span.ed-chip", h("span", String(v)),
        h("button.ed-chip-x", { type: "button", "aria-label": `Remove ${v}`, title: "Remove", onclick: () => {
          const next = list().slice();
          next.splice(i, 1);
          set(next);
          draw();
        } }, svgIcon(ICONS.close)))),
      input,
    ].filter(Boolean));
  };
  draw();
  return box;
}

/**
 * The strip of everything in an item that isn't typed on the page already.
 * `fields` are SECTIONS specs; `shown` are the keys already editable in place.
 */
export function fieldStrip(basePath, fields, shown, { skip = [] } = {}) {
  const strip = h("div.ed-strip");
  for (const f of fields) {
    const [key, label, kind] = f;
    if (shown.has(key) || skip.includes(key)) continue;
    const path = [...basePath, key];
    if (kind === "list") strip.appendChild(chipList(path, { label }));
    else if (kind === "textarea") {
      // Not on the page yet: a typed line right here
      const p = h("p.ed-strip-text");
      editInPlace(p, { placeholder: label, multiline: true, read: () => getPath(ed.resume, path) ?? "", write: (v) => { setPath(ed.resume, path, v); changed(); } });
      p.textContent = String(getPath(ed.resume, path) ?? "");
      strip.appendChild(h("div.ed-strip-wide", h("span.ed-strip-label", label), p));
    } else strip.appendChild(stripInput(path, f));
  }
  return strip.children.length ? strip : null;
}

// ---------------------------------------------------------------------------
// Item tools: move, duplicate, delete (icons only)
// ---------------------------------------------------------------------------

function iconBtn(icon, label, onclick, extra = "") {
  return h(`button.ed-tool${extra}`, { type: "button", "aria-label": label, title: label, onclick: (e) => {
    e.preventDefault();
    e.stopPropagation();
    onclick();
  } }, svgIcon(ICONS[icon]));
}

export function itemTools(list, index, noun) {
  const arr = () => list() || [];
  const move = (d) => {
    const a = arr();
    const j = index + d;
    if (j < 0 || j >= a.length) return;
    [a[index], a[j]] = [a[j], a[index]];
    changed();
  };
  return h("div.ed-tools", { role: "toolbar", "aria-label": `${noun} actions` },
    iconBtn("chevronUp", `Move ${noun} up`, () => move(-1)),
    iconBtn("chevronDown", `Move ${noun} down`, () => move(1)),
    iconBtn("copy", `Duplicate ${noun}`, () => {
      arr().splice(index + 1, 0, structuredClone(arr()[index]));
      changed();
    }),
    iconBtn("trash", `Delete ${noun}`, () => {
      arr().splice(index, 1);
      changed();
      toast(`${noun[0].toUpperCase() + noun.slice(1)} deleted. Undo with Ctrl+Z or the bottom bar.`);
    }, ".is-danger"),
  );
}

/** An icon-only edit button (the same everywhere). */
export function editIcon(label, onclick, extra = "") {
  return iconBtn("pencil", label, onclick, `.ed-edit-icon${extra}`);
}

// ---------------------------------------------------------------------------
// "Add section" menu
// ---------------------------------------------------------------------------

/** addable: [{ key, label }]; hidden: [{ key, label }] */
export function addSectionMenu(addable, hidden, { onAdd, onShow }) {
  const items = [
    ...addable.map((s) => ({ label: s.label, icon: sectionIcon(s.key), onclick: () => onAdd(s.key) })),
    ...(hidden.length && addable.length ? ["sep"] : []),
    ...hidden.map((s) => ({ label: `Show ${s.label}`, icon: "eye", onclick: () => onShow(s.key) })),
  ];
  const menu = dropdown({
    button: h("button.btn.btn-ghost.ed-add-section", { type: "button" }, svgIcon(ICONS.plus), h("span", "Add section")),
    label: "Add section",
    className: ".ed-add-section-menu",
    items,
  });
  return h("div.ed-add-section-row", menu);
}

function sectionIcon(key) {
  return { work: "folder", projects: "layers", education: "doc", skills: "zap", volunteer: "user", awards: "star", certificates: "check", publications: "file", languages: "globe", interests: "tag", references: "quote" }[key] || "plus";
}

// ---------------------------------------------------------------------------
// Images: a menu on the image itself
// ---------------------------------------------------------------------------

function pickFile() {
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept: ACCEPT, class: "visually-hidden" });
    input.addEventListener("change", () => {
      resolve(input.files?.[0] || null);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}

/** An inline "paste a link" row under an image; resolves with the URL or "". */
function linkRow(host, placeholder) {
  return new Promise((resolve) => {
    host.querySelector(".ed-link-row")?.remove();
    const input = h("input.ed-strip-input", { type: "url", placeholder, "aria-label": "Image link", size: 28 });
    const done = (v) => {
      row.remove();
      resolve(v);
    };
    const apply = () => {
      const v = input.value.trim();
      const err = validateField("url", v);
      if (err) return toast(err, "error");
      done(v);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") apply();
      if (e.key === "Escape") done("");
    });
    const row = h("div.ed-link-row", input,
      h("button.btn.btn-primary.ed-small", { type: "button", onclick: apply }, "Use link"),
      h("button.btn.btn-ghost.ed-small", { type: "button", onclick: () => done("") }, "Cancel"));
    host.appendChild(row);
    input.focus();
  });
}

/** Uploads (or, without an account, keeps as a data URL) an image; shows progress on `busyEl`. */
async function storeImage(kind, file, busyEl) {
  busyEl?.classList.add("is-busy");
  try {
    if (!ed.user) {
      const { imageToDataUrl } = await import("../images.js");
      return await imageToDataUrl(file, kind === "photo" ? { maxWidth: 480, maxHeight: 480, square: true } : { maxWidth: 1600, maxHeight: 1000 });
    }
    return await uploadImage(kind, file);
  } catch (e) {
    toast(e.message, "error");
    return "";
  } finally {
    busyEl?.classList.remove("is-busy");
  }
}

/**
 * A camera button on an image (banner, project cover) with a short menu:
 * upload, paste a link, remove. Images can also be dropped on `target`.
 */
export function imageMenu(target, { kind, label, current, onSet, removeLabel = "Remove image", extra = [] }) {
  const set = async (file) => {
    const url = await storeImage(kind, file, target);
    if (url) onSet(url);
  };
  const menu = dropdown({
    button: h("button.ed-tool.ed-image-btn", { type: "button", title: label }, svgIcon(ICONS.camera)),
    label,
    className: ".ed-image-menu",
    items: [
      { label: "Upload an image…", icon: "upload", onclick: async () => {
        const f = await pickFile();
        if (f) set(f);
      } },
      { label: "Paste an image link…", icon: "link", onclick: async () => {
        const v = await linkRow(target, "https://…/image.jpg");
        if (v) onSet(v);
      } },
      ...extra,
      current ? { label: removeLabel, icon: "trash", onclick: () => onSet("") } : null,
    ].filter(Boolean),
  });
  dropTarget(target, set);
  return menu;
}

function dropTarget(el, onFile) {
  el.addEventListener("dragover", (e) => {
    if (![...(e.dataTransfer?.items || [])].some((i) => i.kind === "file")) return;
    e.preventDefault();
    el.classList.add("is-drop");
  });
  el.addEventListener("dragleave", () => el.classList.remove("is-drop"));
  el.addEventListener("drop", (e) => {
    const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith("image/"));
    el.classList.remove("is-drop");
    if (!f) return;
    e.preventDefault();
    onFile(f);
  });
}

// ---------------------------------------------------------------------------
// Profile photo: click, drop or paste an image, then position and zoom it
// right in the circle before saving
// ---------------------------------------------------------------------------

/**
 * @param {HTMLElement} photo   the .profile-photo element on the page
 * @param {object} o
 * @param {string} o.mode       "auto" | "gh" | "custom" | "none"
 * @param {(value: string) => void} o.onSet   "" automatic, "gh", "none" or an image URL
 */
export function photoEditor(photo, { mode, onSet }) {
  if (!photo || photo.closest(".ed-photo")) return;
  const wrap = h("div.ed-photo", { tabindex: "0", role: "group", "aria-label": "Profile photo. Drop or paste an image here, or open the menu to change it." });
  photo.replaceWith(wrap);
  wrap.appendChild(photo);
  const gh = githubForPreview();

  const choose = async () => {
    const f = await pickFile();
    if (f) crop(f);
  };
  const items = [
    { label: "Upload a photo…", icon: "upload", onclick: choose },
    gh && mode !== "gh" ? { label: `Use GitHub photo (@${gh.login})`, icon: "github", onclick: () => onSet("gh") } : null,
    { label: "Paste an image link…", icon: "link", onclick: async () => {
      const v = await linkRow(wrap, "https://…/photo.jpg");
      if (v) onSet(v);
    } },
    mode !== "auto" ? { label: "Automatic (resume or GitHub photo)", icon: "user", onclick: () => onSet("") } : null,
    mode !== "none" ? { label: "Remove photo (show initials)", icon: "trash", onclick: () => onSet("none") } : null,
  ].filter(Boolean);
  const menu = dropdown({
    button: h("button.ed-photo-btn", { type: "button", title: "Change photo" }, svgIcon(ICONS.camera)),
    label: "Change photo",
    className: ".ed-photo-menu",
    items,
  });
  wrap.appendChild(menu);
  // The whole photo opens the menu too
  photo.addEventListener("click", () => menu.querySelector(".ed-photo-btn").click());
  dropTarget(wrap, crop);
  wrap.addEventListener("paste", (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/"));
    if (f) {
      e.preventDefault();
      crop(f);
    }
  });

  /** Position + zoom inside the circle, then save a square crop. */
  async function crop(file) {
    if (!file.type.startsWith("image/")) return toast("That file isn't an image.", "error");
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      return toast("This image couldn't be read. Try a JPG, PNG or WebP.", "error");
    }
    const size = wrap.getBoundingClientRect().width || 160;
    const base = size / Math.min(bitmap.width, bitmap.height); // "cover" scale
    const state = { zoom: 1, x: 0, y: 0 };
    const canvas = h("canvas.ed-crop-canvas", { width: size * 2, height: size * 2, "aria-hidden": "true" });
    const ctx = canvas.getContext("2d");
    const clamp = () => {
      const s = base * state.zoom;
      const maxX = Math.max(0, (bitmap.width * s - size) / 2);
      const maxY = Math.max(0, (bitmap.height * s - size) / 2);
      state.x = Math.max(-maxX, Math.min(maxX, state.x));
      state.y = Math.max(-maxY, Math.min(maxY, state.y));
    };
    const draw = (target = ctx, out = size * 2) => {
      clamp();
      const s = base * state.zoom * (out / size);
      const w = bitmap.width * s;
      const hgt = bitmap.height * s;
      target.clearRect(0, 0, out, out);
      target.drawImage(bitmap, out / 2 - w / 2 + state.x * (out / size), out / 2 - hgt / 2 + state.y * (out / size), w, hgt);
    };
    const zoom = h("input.ed-crop-zoom", { type: "range", min: "1", max: "4", step: "0.01", value: "1", "aria-label": "Zoom" });
    zoom.addEventListener("input", () => {
      state.zoom = Number(zoom.value);
      draw();
    });
    const cancel = () => finish();
    const apply = async () => {
      const out = h("canvas", { width: 480, height: 480 });
      draw(out.getContext("2d"), 480);
      const blob = await new Promise((r) => out.toBlob(r, "image/jpeg", 0.9));
      finish();
      const url = await storeImage("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }), wrap);
      if (url) onSet(url);
    };
    const panel = h("div.ed-crop-controls",
      h("span.ed-crop-hint", "Drag to position"),
      h("label.ed-crop-zoom-label", svgIcon(ICONS.search), zoom),
      h("div.ed-crop-actions",
        h("button.btn.btn-ghost.ed-small", { type: "button", onclick: cancel }, "Cancel"),
        h("button.btn.btn-primary.ed-small", { type: "button", onclick: apply }, svgIcon(ICONS.check), "Save photo")));
    wrap.classList.add("is-cropping");
    wrap.prepend(canvas);
    wrap.appendChild(panel);
    draw();

    // Drag (mouse, touch, pen) and wheel / pinch to zoom
    let drag = null;
    const pointers = new Map();
    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, e);
      drag = { x: e.clientX, y: e.clientY, sx: state.x, sy: state.y, dist: 0, zoom: state.zoom };
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      pointers.set(e.pointerId, e);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        drag.dist ||= dist;
        state.zoom = Math.max(1, Math.min(4, drag.zoom * (dist / drag.dist)));
        zoom.value = String(state.zoom);
      } else {
        state.x = drag.sx + (e.clientX - drag.x);
        state.y = drag.sy + (e.clientY - drag.y);
      }
      draw();
    });
    const up = (e) => {
      pointers.delete(e.pointerId);
      if (!pointers.size) drag = null;
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      state.zoom = Math.max(1, Math.min(4, state.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
      zoom.value = String(state.zoom);
      draw();
    }, { passive: false });
    const keys = (e) => {
      if (e.key === "Escape") cancel();
      if (e.key === "Enter") apply();
    };
    wrap.addEventListener("keydown", keys);
    zoom.focus();

    function finish() {
      wrap.classList.remove("is-cropping");
      canvas.remove();
      panel.remove();
      wrap.removeEventListener("keydown", keys);
      bitmap.close?.();
    }
  }
}
