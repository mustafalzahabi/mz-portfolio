// ============================================================================
// DATE PICKER — for resume dates, which are a year, a month or a day
// (YYYY, YYYY-MM, YYYY-MM-DD). Opens under a date field: step through years,
// pick a month (most resume dates), or go on to pick a day. "Present" for
// end dates. Typing in the field still works; the picker writes the same text
// and fires "change", so every field keeps its own saving and validation.
// ============================================================================

import { h, svgIcon } from "../utils.js";
import { ICONS } from "../icons.js";

const pad = (n) => String(n).padStart(2, "0");
let open = null; // { pop, input, close }

function parse(v) {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(String(v || "").trim());
  return m ? { y: +m[1], m: m[2] ? +m[2] : null, d: m[3] ? +m[3] : null } : null;
}

/**
 * @param {HTMLInputElement} input
 * @param {object} [o]
 * @param {boolean} [o.present]   offer "Present" (an empty end date)
 * @param {boolean} [o.day]       start on the day grid (e.g. blog post dates)
 */
export function attachDatePicker(input, { present = false, day = false } = {}) {
  if (input.dataset.picker) return;
  input.dataset.picker = "1";
  input.setAttribute("autocomplete", "off");
  input.setAttribute("aria-haspopup", "dialog");
  input.addEventListener("click", () => openPicker(input, { present, day }));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && e.altKey) openPicker(input, { present, day });
    if (e.key === "Escape" || e.key === "Tab") closePicker();
  });
  input.addEventListener("input", () => open?.input === input && open.redraw());
}

export function closePicker() {
  open?.close();
}

function openPicker(input, { present, day }) {
  if (open?.input === input) return;
  closePicker();
  const now = new Date();
  const cur = parse(input.value);
  let year = cur?.y ?? now.getFullYear();
  let view = day || cur?.d ? "days" : "months";
  let month = cur?.m ?? now.getMonth() + 1;
  const locale = document.documentElement.lang || undefined;
  const monthName = (m, style = "short") => new Date(2000, m - 1, 1).toLocaleString(locale, { month: style });

  const pop = h("div.dp", { role: "dialog", "aria-label": "Pick a date" });
  const set = (value) => {
    input.value = value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    close();
    input.focus();
  };

  const navBtn = (icon, label, onclick) => h("button.dp-nav", { type: "button", "aria-label": label, onclick }, svgIcon(ICONS[icon]));
  const draw = () => {
    const sel = parse(input.value);
    let body;
    let title;
    if (view === "months") {
      title = h("button.dp-title", { type: "button", "aria-label": `Year ${year}. Pick this year only`, title: "Use the year only", onclick: () => set(String(year)) }, String(year));
      body = h("div.dp-grid.dp-months", Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const isSel = sel && sel.y === year && sel.m === m;
        const isNow = now.getFullYear() === year && now.getMonth() + 1 === m;
        return h("button.dp-cell", { type: "button", "aria-pressed": String(Boolean(isSel)), "aria-label": `${monthName(m, "long")} ${year}`, dataset: { now: isNow ? "1" : null }, onclick: () => set(`${year}-${pad(m)}`) }, monthName(m));
      }));
    } else {
      title = h("button.dp-title", { type: "button", title: "Back to months", onclick: () => { view = "months"; draw(); } }, `${monthName(month, "long")} ${year}`);
      const first = new Date(year, month - 1, 1);
      const days = new Date(year, month, 0).getDate();
      const lead = (first.getDay() + 6) % 7; // weeks start on Monday
      const heads = Array.from({ length: 7 }, (_, i) => h("span.dp-wd", new Date(2024, 0, 1 + i).toLocaleString(locale, { weekday: "narrow" })));
      body = h("div.dp-grid.dp-days", ...heads, ...Array.from({ length: lead }, () => h("span")), ...Array.from({ length: days }, (_, i) => {
        const d = i + 1;
        const isSel = sel && sel.y === year && sel.m === month && sel.d === d;
        const isNow = now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === d;
        return h("button.dp-cell", { type: "button", "aria-pressed": String(Boolean(isSel)), dataset: { now: isNow ? "1" : null }, onclick: () => set(`${year}-${pad(month)}-${pad(d)}`) }, String(d));
      }));
    }
    const step = (d) => {
      if (view === "months") year += d;
      else {
        month += d;
        if (month < 1) [month, year] = [12, year - 1];
        if (month > 12) [month, year] = [1, year + 1];
      }
      draw();
    };
    pop.replaceChildren(
      h("div.dp-head",
        navBtn("arrowLeft", view === "months" ? "Previous year" : "Previous month", () => step(-1)),
        title,
        navBtn("arrowRight", view === "months" ? "Next year" : "Next month", () => step(1))),
      body,
      h("div.dp-foot",
        view === "months"
          ? h("button.dp-link", { type: "button", onclick: () => { view = "days"; draw(); } }, "Pick a day")
          : h("button.dp-link", { type: "button", onclick: () => set(`${year}-${pad(month)}`) }, "Month only"),
        h("button.dp-link", { type: "button", onclick: () => set(view === "days" ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` : `${now.getFullYear()}-${pad(now.getMonth() + 1)}`) }, "Today"),
        present ? h("button.dp-link.dp-strong", { type: "button", onclick: () => set("") }, "Present") : h("button.dp-link", { type: "button", onclick: () => set("") }, "Clear")),
    );
  };

  const place = () => {
    const r = input.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = innerHeight;
    const w = pop.offsetWidth;
    const hgt = pop.offsetHeight;
    const left = Math.min(Math.max(8, r.left), vw - w - 8);
    const below = r.bottom + 6 + hgt <= vh - 8 || r.top - 6 - hgt < 8;
    Object.assign(pop.style, { left: `${Math.round(left)}px`, top: `${Math.round(below ? r.bottom + 6 : r.top - 6 - hgt)}px` });
  };
  const onDown = (e) => {
    if (!pop.contains(e.target) && e.target !== input) close();
  };
  const onKey = (e) => {
    if (e.key === "Escape") {
      close();
      input.focus();
    }
  };
  const close = () => {
    pop.remove();
    removeEventListener("pointerdown", onDown, true);
    removeEventListener("keydown", onKey, true);
    removeEventListener("scroll", place, true);
    removeEventListener("resize", place);
    if (open?.pop === pop) open = null;
  };

  draw();
  document.body.appendChild(pop);
  place();
  addEventListener("pointerdown", onDown, true);
  addEventListener("keydown", onKey, true);
  addEventListener("scroll", place, true);
  addEventListener("resize", place);
  open = {
    pop, input, close,
    redraw: () => {
      const p = parse(input.value);
      if (p) {
        year = p.y;
        if (p.m) month = p.m;
      }
      draw();
      place();
    },
  };
}
