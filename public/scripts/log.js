// ============================================================================
// DEBUG LOGGING — silent unless ?debug=1 (or localStorage "mz-debug" = "1")
// ============================================================================

function detectDebug() {
  try {
    if (new URLSearchParams(location.search).get("debug") === "1") return true;
    return localStorage.getItem("mz-debug") === "1";
  } catch {
    return false;
  }
}

export const DEBUG = typeof location !== "undefined" && detectDebug();

export function debug(...args) {
  if (DEBUG) console.log("[mz]", ...args);
}

export function warn(...args) {
  if (DEBUG) console.warn("[mz]", ...args);
}
