// ============================================================================
// THEME MANAGEMENT
// ============================================================================

let themeKnobPosition = 0; // 0 = dark (left), 1 = light (right), -1 = auto (thrown off)

export function initDarkMode() {
  const savedMode = localStorage.getItem("theme") || "auto";
  applyTheme(savedMode);
}

export function applyTheme(mode) {
  let effectiveScheme = mode;

  if (mode === "auto") {
    effectiveScheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  document.documentElement.style.colorScheme = effectiveScheme;
  document.documentElement.dataset.theme = effectiveScheme;
  localStorage.setItem("theme", mode);
  updateThemeToggleButton();
}

export function getCurrentTheme() {
  return localStorage.getItem("theme") || "auto";
}

export function toggleDarkMode() {
  const themes = ["auto", "light", "dark"];
  const current = getCurrentTheme();
  const currentIndex = themes.indexOf(current);
  const nextIndex = (currentIndex + 1) % themes.length;
  applyTheme(themes[nextIndex]);
}

function updateThemeToggleButton() {
  const knob = document.getElementById("theme-knob");
  const track = document.getElementById("theme-track");
  if (!knob || !track) return;

  const mode = getCurrentTheme();
  const trackRect = track.getBoundingClientRect();
  const knobRect = knob.getBoundingClientRect();
  const trackWidth = Math.round(trackRect.width);
  const knobWidth = Math.round(knobRect.width);
  const maxTranslate = Math.round(trackWidth - knobWidth);

  if (mode === "auto") {
    knob.classList.add("auto-mode");
    const effective = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    knob.setAttribute("data-mode", effective);
    knob.setAttribute("data-auto", "true");
    if (effective === "light") {
      knob.style.transform = `translate(${maxTranslate}px, -50%)`;
    } else {
      knob.style.transform = `translate(0px, -50%)`;
    }
  } else if (mode === "light") {
    knob.classList.remove("auto-mode");
    knob.setAttribute("data-mode", "light");
    knob.style.transform = `translate(${maxTranslate}px, -50%)`;
  } else {
    knob.classList.remove("auto-mode");
    knob.setAttribute("data-mode", "dark");
    knob.style.transform = "translate(0px, -50%)";
  }
}

// Listen for system theme changes when in auto mode
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (getCurrentTheme() === "auto") {
      applyTheme("auto");
    }
  });

let _themeMoveHandler = null;
let _themeUpHandler = null;

export function attachThemeSwitchHandlers(track, knob) {
  // Remove previous document-level handlers if any
  if (_themeMoveHandler) document.removeEventListener("pointermove", _themeMoveHandler);
  if (_themeUpHandler) document.removeEventListener("pointerup", _themeUpHandler);

  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPos = 0;
  let currentPos = 0;
  let currentY = 0;
  let escapeTrack = false;

  function computeSizes() {
    const tRect = track.getBoundingClientRect();
    const kRect = knob.getBoundingClientRect();
    return {
      trackWidth: Math.round(tRect.width),
      trackHeight: Math.round(tRect.height),
      knobWidth: Math.round(kRect.width),
      knobHeight: Math.round(kRect.height),
      maxTranslate: Math.round(tRect.width - kRect.width),
    };
  }

  let { trackWidth, trackHeight, knobWidth, knobHeight, maxTranslate } =
    computeSizes();
  const midpoint = maxTranslate / 2;
  const throwThreshold = 40;
  const verticalThreshold = 20;
  const escapeThreshold = 15;

  function snapToPosition(endPos, endY) {
    const throwThresholdRight = maxTranslate + throwThreshold;
    const throwThresholdLeft = -throwThreshold;
    const isOffVertically = Math.abs(endY) > verticalThreshold;
    const isOffHorizontally =
      endPos > throwThresholdRight || endPos < throwThresholdLeft;

    if (isOffHorizontally || isOffVertically) {
      applyTheme("auto");
    } else if (endPos > midpoint) {
      applyTheme("light");
    } else {
      applyTheme("dark");
    }
  }

  knob.addEventListener("pointerdown", (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    ({ trackWidth, trackHeight, knobWidth, knobHeight, maxTranslate } =
      computeSizes());
    const transform = knob.style.transform;
    const matchX = transform.match(/translate\(([-\d.]+)px/);
    dragStartPos = matchX ? parseFloat(matchX[1]) : 0;
    currentY = 0;
    escapeTrack = false;
    knob.classList.add("dragging");
    e.preventDefault();
    if (e.pointerId && knob.setPointerCapture) {
      try {
        knob.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
    }
  });

  _themeMoveHandler = (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    currentPos = dragStartPos + deltaX;

    const hasEscapedRight = currentPos > maxTranslate + escapeThreshold;
    const hasEscapedLeft = currentPos < -escapeThreshold;

    if (hasEscapedRight || hasEscapedLeft) {
      escapeTrack = true;
    }

    if (escapeTrack) {
      currentY = deltaY;
    } else {
      currentY = 0;
    }

    knob.style.transform = `translate(${currentPos}px, calc(-50% + ${currentY}px))`;
    knob.style.transition = "none";
  };

  _themeUpHandler = () => {
    if (!isDragging) return;
    isDragging = false;
    knob.classList.remove("dragging");
    knob.style.transition = "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
    snapToPosition(currentPos, currentY);
    try {
      if (knob.releasePointerCapture) knob.releasePointerCapture();
    } catch (e) {
      /* ignore */
    }
  };

  document.addEventListener("pointermove", _themeMoveHandler);
  document.addEventListener("pointerup", _themeUpHandler);

  track.addEventListener("click", (e) => {
    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const kRect = knob.getBoundingClientRect();
    const knobLeft = kRect.left - rect.left;
    const knobRight = knobLeft + kRect.width;

    if (clickX < knobLeft || clickX > knobRight) {
      const current = getCurrentTheme();
      if (current === "auto") {
        applyTheme("dark");
      } else if (current === "dark") {
        applyTheme("light");
      } else {
        applyTheme("dark");
      }
    }
  });

  track.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const current = getCurrentTheme();
      if (current === "auto") {
        applyTheme("dark");
      } else if (current === "dark") {
        applyTheme("light");
      } else {
        applyTheme("dark");
      }
    } else if (e.key === "ArrowRight") {
      applyTheme("light");
    } else if (e.key === "ArrowLeft") {
      applyTheme("dark");
    }
  });

  updateThemeToggleButton();
}

export function setupThemeToggle() {
  const track = document.getElementById("theme-track");
  const knob = document.getElementById("theme-knob");
  if (track && knob) {
    updateThemeToggleButton();
  }
}
