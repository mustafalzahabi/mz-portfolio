// ============================================================================
// DISSOLVE — every small element (a heading, a line of text, a link, an
// icon, an image) appears first as a wisp of its own code, floating where it
// will be, which then dissolves into the air as the real element condenses in.
// Fast, no panel, no background; elements go one after another.
// ============================================================================

const UNIT_TAGS = new Set(["IMG", "SVG", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "VIDEO", "IFRAME", "CANVAS", "HR", "PICTURE"]);
const INLINE = new Set(["SPAN", "STRONG", "EM", "B", "I", "A", "CODE", "SMALL", "TIME", "ABBR", "MARK", "BR", "SUP", "SUB"]);
const MAX_UNITS = 90;
const active = new Set();

/** Elements that read as one tiny piece: media, controls, or a line of text. */
export function collectUnits(root, max = MAX_UNITS) {
  const units = [];
  const walk = (el) => {
    if (units.length >= max) return;
    if (el.nodeType !== 1 || el.classList.contains("ed-edit") || el.classList.contains("dz-layer")) return;
    const tag = el.tagName.toUpperCase();
    const kids = [...el.children];
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const leafy = UNIT_TAGS.has(tag) || !kids.length || (ownText && kids.every((k) => INLINE.has(k.tagName.toUpperCase())));
    if (leafy) {
      const r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) units.push(el);
      return;
    }
    kids.forEach(walk);
  };
  [...root.children].forEach(walk);
  return units;
}

/** A short code fragment for an element: <h2.title>, <img/>, "Lorem…". */
export function snippetFor(el) {
  const tag = el.tagName.toLowerCase();
  const cls = [...el.classList].find((c) => !c.startsWith("anim") && !c.startsWith("dz")) || "";
  const name = cls ? `${tag}.${cls}` : tag;
  if (["img", "svg", "input", "hr", "iframe", "video", "canvas"].includes(tag)) return `<${name}/>`;
  const text = el.textContent.trim().replace(/\s+/g, " ");
  if (text && text.length <= 14 && Math.random() < 0.35) return `"${text}"`;
  return `<${name}>`;
}

export function finishAllDissolves() {
  for (const d of [...active]) d.finish();
}

/**
 * Plays the dissolve on `host`. Resolves when done. speed > 1 is faster.
 */
export function dissolveIn(host, { speed = 1 } = {}) {
  return new Promise((resolve) => {
    const units = collectUnits(host);
    host.classList.add("is-in");
    if (!units.length || typeof host.animate !== "function") return resolve();

    const layer = document.createElement("div");
    layer.className = "dz-layer";
    layer.setAttribute("aria-hidden", "true");
    if (getComputedStyle(host).position === "static") host.classList.add("dz-host");
    host.appendChild(layer);

    const base = host.getBoundingClientRect();
    const step = Math.min(16, 520 / units.length) / speed; // whole cascade ≤ ~0.5s
    const animations = [];
    const ease = "cubic-bezier(0.2, 0.7, 0.2, 1)";

    units.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const delay = i * step;
      const wisp = document.createElement("span");
      wisp.className = "dz-code";
      wisp.textContent = snippetFor(el);
      wisp.style.left = `${r.left - base.left}px`;
      wisp.style.top = `${r.top - base.top + Math.max(0, (r.height - 16) / 2)}px`;
      wisp.style.fontSize = `${Math.max(10, Math.min(14, r.height * 0.55))}px`;
      layer.appendChild(wisp);

      const drift = (i % 2 ? -1 : 1) * (4 + (i % 5) * 2);
      animations.push(
        wisp.animate(
          [
            { opacity: 0, filter: "blur(3px)", transform: "translateY(5px)" },
            { opacity: 0.95, filter: "blur(0)", transform: "translateY(0)", offset: 0.35 },
            { opacity: 0.9, filter: "blur(0)", transform: "translateY(0)", offset: 0.55 },
            { opacity: 0, filter: "blur(6px)", transform: `translate(${drift}px, -10px) scale(1.25)`, letterSpacing: "0.25em" },
          ],
          { duration: 420 / speed, delay, easing: "ease-out", fill: "both" },
        ),
        el.animate(
          [
            { opacity: 0, filter: "blur(5px)" },
            { opacity: 1, filter: "blur(0)" },
          ],
          { duration: 300 / speed, delay: delay + 190 / speed, easing: ease, fill: "backwards" },
        ),
      );
    });

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      active.delete(entry);
      animations.forEach((a) => a.finish?.());
      layer.remove();
      host.classList.remove("dz-host");
      resolve();
    };
    const entry = { finish };
    active.add(entry);
    Promise.all(animations.map((a) => a.finished)).then(finish, finish);
  });
}
