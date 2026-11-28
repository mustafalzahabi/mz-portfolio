// ============================================================================
// SETTINGS UI — shared by Site settings (what visitors see) and Account
// settings (yours): an overlay, full screen on phones and a large panel on
// desktop, with groups in a side menu (chips on phones) that follows the
// scroll, cards with a plain title and a line about them, and a search.
// No editor dependencies, so Account settings loads it outside edit mode.
// ============================================================================

import { h, svgIcon } from "../utils.js";
import { ICONS } from "../icons.js";

/**
 * @param {object} o
 * @param {{ id, title, cards: { name, title, desc, body }[] }[]} o.groups
 * @param {string} [o.query]                 the search text to start with
 * @param {(q: string) => void} [o.onQuery]  remembers the search
 * @param {Node} [o.notice]                  shown above the cards (e.g. warnings)
 * @param {string} [o.placeholder]
 */
export function settingsLayout({ groups, query = "", onQuery = () => {}, notice = null, placeholder = "Find a setting" }) {
  const main = h("div.ed-set-main");
  const nav = h("nav.ed-set-nav", { "aria-label": "Setting groups" });
  let pinnedUntil = 0;
  const markCurrent = (id) => {
    let active = null;
    nav.querySelectorAll(".ed-set-link").forEach((a) => {
      a.toggleAttribute("aria-current", a.dataset.group === id);
      if (a.dataset.group === id) active = a;
    });
    // Phones: the chip row scrolls sideways to keep the current group in sight
    if (active && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2, behavior: "smooth" });
  };

  for (const { id, title, cards } of groups) {
    const built = cards.filter((c) => c && c.body).map((c) =>
      h("section.ed-set-card", { id: `set-${c.name}`, dataset: { name: c.name } }, h("header.ed-set-head", h("h3", c.title), c.desc ? h("p", c.desc) : null), c.body));
    if (!built.length) continue;
    main.appendChild(h("section.ed-set-group", { id: `setg-${id}`, dataset: { group: id } }, h("h2.ed-set-title", title), ...built));
    nav.appendChild(h("a.ed-set-link", { href: `#setg-${id}`, dataset: { group: id }, onclick: (e) => {
      e.preventDefault();
      // The chosen group stays marked while the scroll gets there (short last groups never reach the top)
      markCurrent(id);
      pinnedUntil = Date.now() + 1200;
      main.querySelector(`#setg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } }, title));
  }

  const search = h("input.input.ed-search", { type: "search", placeholder, "aria-label": placeholder, value: query });
  const empty = h("p.muted.ed-no-match", { hidden: true });
  const filter = () => {
    const q = search.value.trim().toLowerCase();
    onQuery(search.value);
    let any = 0;
    for (const card of main.querySelectorAll(".ed-set-card")) {
      const head = card.querySelector(".ed-set-head").textContent.toLowerCase();
      const hitCard = !q || head.includes(q);
      let hits = 0;
      for (const f of card.querySelectorAll(".ed-field")) {
        const hit = hitCard || f.textContent.toLowerCase().includes(q);
        f.hidden = !hit;
        hits += hit;
      }
      card.hidden = !(hitCard || hits);
      any += !card.hidden;
    }
    for (const g of main.querySelectorAll(".ed-set-group")) g.hidden = !g.querySelector(".ed-set-card:not([hidden])");
    empty.hidden = !q || any > 0;
    empty.textContent = `Nothing matches “${search.value}”.`;
  };
  search.addEventListener("input", filter);

  // The side list follows the scroll of the overlay (it scrolls, not the page)
  queueMicrotask(() => {
    const scroller = main.closest(".ed-settings");
    if (!scroller) return;
    const follow = () => {
      if (Date.now() < pinnedUntil) return;
      const top = scroller.getBoundingClientRect().top;
      const shown = [...main.querySelectorAll(".ed-set-group:not([hidden])")];
      const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
      let cur = shown[0];
      for (const g of shown) if (g.getBoundingClientRect().top - top < scroller.clientHeight * 0.3) cur = g;
      if (atEnd) cur = shown[shown.length - 1];
      if (cur) markCurrent(cur.dataset.group);
    };
    scroller.addEventListener("scroll", () => requestAnimationFrame(follow), { passive: true });
    follow();
  });

  const panel = h("div.ed-panel.ed-set-layout",
    h("aside.ed-set-side", h("span.ed-search-wrap", svgIcon(ICONS.search), search), nav),
    h("div.ed-set-content", notice, empty, main));
  if (search.value) queueMicrotask(filter);
  return panel;
}

/**
 * The overlay. `content` is placed in its scrolling area (.ed-settings).
 * Returns the <dialog>; closing removes it and calls onClose.
 */
export function openOverlay({ title, content, onClose = () => {}, className = "" }) {
  const id = `ov-${Math.random().toString(36).slice(2, 8)}`;
  const scroller = h("div.ed-settings", content);
  const dialog = h(`dialog.ed-settings-dialog${className}`, { "aria-labelledby": id },
    h("header.ed-settings-head",
      h("h2", { id }, title),
      h("button.ed-icon-btn", { type: "button", "aria-label": `Close ${title.toLowerCase()}`, title: "Close", onclick: () => dialog.close() }, svgIcon(ICONS.close))),
    scroller);
  dialog.addEventListener("click", (e) => e.target === dialog && dialog.close()); // the backdrop
  dialog.addEventListener("close", () => {
    dialog.remove();
    onClose();
  });
  document.body.appendChild(dialog);
  dialog.showModal();
  scroller.querySelector(".ed-search")?.focus();
  return dialog;
}

/** A labelled row (search finds it by its text). */
export function settingRow(label, control, hint = "") {
  return h("div.ed-field.ed-set-row", h("div.ed-set-row-text", h("span.ed-label", label), hint ? h("span.ed-hint", hint) : null), control);
}

/** A row of choices (radio-like buttons); calls onPick(value). */
export function segmented(options, value, onPick, label) {
  const wrap = h("div.ed-seg", { role: "radiogroup", "aria-label": label });
  const draw = (current) => wrap.replaceChildren(...options.map(([v, text]) =>
    h("button.ed-seg-btn", { type: "button", role: "radio", "aria-checked": String(v === current), "aria-pressed": String(v === current), onclick: () => {
      draw(v);
      onPick(v);
    } }, text)));
  draw(value);
  return wrap;
}
