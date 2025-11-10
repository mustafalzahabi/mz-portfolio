# Portfolio (Pure HTML/CSS/JS)

A modern, fully responsive portfolio site built with pure HTML, CSS, and JavaScript. All content is loaded dynamically from `data.json`.

## Features

- ✅ **100% Dynamic Markup** - All HTML generated via JavaScript
- ✅ **Dark/Light Mode** - Uses modern `light-dark()` CSS function, defaults to dark
- ✅ **Modern CSS** - Responsive design with proper semantic structure
- ✅ **Error Handling** - Loading states, error pages, and graceful fallbacks
- ✅ **No Dependencies** - Pure vanilla HTML, CSS, JS (no frameworks or libraries)
- ✅ **LocalStorage** - Persists theme preference across sessions

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
3. **Styling applied** - `style.css` uses `light-dark()` for theme support
4. **User can toggle theme** - Button in navbar saves preference to localStorage

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
- Projects with links and tech stack
- Skills by category
- Contact info

### Add Images

Replace placeholder images in `assets/`:
- `profile.jpg` - Your profile picture
- `project1.jpg`, `project2.jpg` - Project screenshots
- Add CV/Resume PDF if needed

### Customize Theme Colors

Edit `style.css` - Look for `light-dark()` functions. The first value is light mode, second is dark mode:

```css
color: light-dark(#1a1a1a, #e0e0e0);  /* light, dark */
```

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
