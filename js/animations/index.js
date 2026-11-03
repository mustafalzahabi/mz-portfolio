// ============================================================================
// INTRO ANIMATIONS
// intro: none | fade | slide | stagger | typewriter | blueprint | code
// Each section animates the first time it scrolls into view. Click, Esc or
// any key skips; prefers-reduced-motion disables everything.
// ============================================================================

import { prefersReducedMotion } from "../utils.js";
import { revealWithCode, prettyHtml, finishAllReveals } from "./code-reveal.js";

let observer = null;
let skipBound = false;

export function teardownAnimations() {
  observer?.disconnect();
  observer = null;
  finishAllReveals();
}

/**
 * @param {HTMLElement[]} items  elements to animate (in document order)
 * @param {object} cfg           config.animation
 * @param {(el) => Function|null} builderFor  returns the builder that rendered el
 */
export function setupAnimations(items, cfg, builderFor = () => null) {
  teardownAnimations();
  const intro = prefersReducedMotion() ? "none" : cfg.intro;
  document.documentElement.dataset.intro = intro;
  if (intro === "none" || typeof IntersectionObserver !== "function") return;

  bindSkip();
  const isMobile = matchMedia("(max-width: 599px)").matches;
  let queue = Promise.resolve();

  items.forEach((el, i) => {
    el.classList.add("anim", `anim-${intro}`);
    el.style.setProperty("--anim-index", String(i));
    if (intro === "stagger") {
      [...el.querySelectorAll(":scope > *, :scope > div > *")].slice(0, 24).forEach((child, k) => {
        child.classList.add("anim-child");
        child.style.setProperty("--child-index", String(k));
      });
    }
  });

  observer = new IntersectionObserver(
    (records) => {
      for (const r of records) {
        if (!r.isIntersecting) continue;
        const el = r.target;
        observer.unobserve(el);

        if (intro === "code") {
          // Sequential so visible sections type one after another
          queue = queue.then(() => {
            const builder = builderFor(el);
            const useHtml = cfg.code.source === "html" || !builder;
            const source = useHtml ? prettyHtml(el) : builder.toString();
            return revealWithCode(el, {
              source,
              lang: useHtml ? "html" : "js",
              title: useHtml ? `<${el.tagName.toLowerCase()} id="${el.id}">` : `${builder.name}()`,
              speed: cfg.code.speed * (isMobile ? 1.6 : 1),
              maxSeconds: cfg.code.maxPerSection * (isMobile ? 0.7 : 1),
            });
          });
        } else if (intro === "typewriter") {
          typeHeading(el);
          el.classList.add("is-in");
        } else {
          el.classList.add("is-in");
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
  );
  items.forEach((el) => observer.observe(el));
}

function typeHeading(el) {
  const heading = el.querySelector("h1, h2");
  if (!heading || heading.dataset.typed) return;
  heading.dataset.typed = "1";
  const text = heading.textContent;
  heading.setAttribute("aria-label", text);
  heading.textContent = "";
  heading.classList.add("is-typing-heading");
  let i = 0;
  const tick = () => {
    heading.textContent = text.slice(0, ++i);
    if (i < text.length) setTimeout(tick, 28);
    else heading.classList.remove("is-typing-heading");
  };
  tick();
}

function bindSkip() {
  if (skipBound) return;
  skipBound = true;
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") finishAllReveals();
  });
}
