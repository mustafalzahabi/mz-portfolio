// ============================================================================
// ENTRY POINT — TwOP vanilla style: one core class, exposed as window.App
// ============================================================================

import { init } from "./app.js";
import { isRenewWindow } from "./google.js";

class PortfolioCore {
  constructor() {
    this.init();
  }

  init() {
    // The small window that renews a Google sign-in: the page that opened it
    // reads the result from its address, so nothing may run (or consume it) here
    if (isRenewWindow()) {
      document.body.textContent = "Renewing your Google sign-in…";
      return;
    }
    // Routing, theme, data loading and rendering all start in app.js
    init();
  }
}

// Initialize the app
window.App = new PortfolioCore();
