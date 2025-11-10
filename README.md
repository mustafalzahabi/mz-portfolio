# Portfolio (Pure HTML/CSS/JS)

A modern, fully responsive portfolio site built with pure HTML, CSS, and JavaScript. All content is loaded dynamically from `data.json`.

## Features

- ✅ **100% Dynamic Markup** - All HTML generated via JavaScript
- ✅ **Dark/Light Mode** - Uses modern `light-dark()` CSS function, defaults to dark
- ✅ **Modern CSS** - Responsive design with proper semantic structure
- ✅ **Error Handling** - Loading states, error pages, and graceful fallbacks
- ✅ **No Dependencies** - Pure vanilla HTML, CSS, JS (no frameworks or libraries)
- ✅ **LocalStorage** - Persists theme preference across sessions
- ✅ **GitHub Integration** - Auto-syncs public repos, extracts screenshots from READMEs

## File Structure

```
.
├── index.html           # Entry point (minimal, with JS fallback)
├── style.css            # Modern CSS with light-dark() color function
├── script.js            # Generates all markup dynamically
├── data.json            # Portfolio content (all sections)
├── error.html           # Fallback error page (if JS fails)
├── 404.html             # 404 page for missing routes
├── assets/              # Images and static files
│   ├── profile.jpg      # Profile picture
│   ├── project1.jpg     # Project thumbnail
│   └── project2.jpg     # Project thumbnail
└── README.md            # This file
```

## How It Works

1. **Browser loads `index.html`** - Minimal entry point with `<noscript>` fallback
2. **`script.js` loads** - Fetches `data.json` and generates the entire page
3. **GitHub sync** - Automatically fetches your public repos (excluding forks)
4. **Screenshot extraction** - Scans README files for relative image URLs (only repo-hosted images)
5. **Styling applied** - `style.css` uses `light-dark()` for theme support
6. **User can toggle theme** - Button in navbar saves preference to localStorage

## Running Locally

```bash
# Start a simple HTTP server
python -m http.server 8000

# Or with Python 3
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Customization

### Update Your Content

Edit `data.json` with your:
- Profile info (name, title, tagline, bio)
- Education history
- **Featured projects** (manual entries with custom images)
- Skills by category
- Contact info

### GitHub Integration

Your public GitHub repositories automatically appear in the Projects section:
- ✅ **All public repos** are fetched and displayed (sorted by stars, highest first)
- ✅ **Forks excluded** - only your original repos show
- ✅ **Screenshots auto-extracted** - if your README has images with relative paths (e.g., `./screenshot.png`), they appear on the card
- ✅ **No configuration needed** - uses your GitHub username from `data.json` (or defaults to `mustafalzahabi`)

To customize the GitHub username:
```json
"profile": {
  "name": "Your Name",
  "github": "https://github.com/yourusername",
  // ... rest of profile
}
```

**Screenshot detection:**
- Your README images must be **relative paths** (e.g., `./images/demo.png` or `/assets/screenshot.jpg`)
- External images (CDN URLs) are ignored for security
- If no screenshot is found, the card displays without an image

## Error Handling

- **`index.html`** has a `<noscript>` fallback if JavaScript is disabled
- **`error.html`** is shown if the app encounters a runtime error
- **`404.html`** is shown for missing routes (configure your server)
- **Loading state** shows spinner while fetching `data.json`

## Browser Support

- Modern browsers with `light-dark()` support:
  - Chrome 123+
  - Firefox 120+
  - Safari 17.4+
  - Edge 123+

For older browsers, graceful fallback styling is applied.

## License

Personal portfolio - feel free to customize and deploy.
