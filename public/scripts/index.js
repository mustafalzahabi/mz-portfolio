// ============================================================================
// ENTRY POINT — TwOP vanilla style: one core class, exposed as window.App
// ============================================================================

import { init } from "./app.js";

class PortfolioCore {
  constructor() {
    this.init();
  }

  init() {
    // Routing, theme, data loading and rendering all start in app.js
    init();
  }
}

// Initialize the app
window.App = new PortfolioCore();
