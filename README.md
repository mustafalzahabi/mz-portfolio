# Portfolio (JSON Resume, Pure HTML/CSS/JS)

A modern, fully responsive portfolio site built with pure HTML, CSS, and JavaScript. All content is loaded dynamically from a public [JSON Resume](https://jsonresume.org/) (`resume.json`) GitHub gist for any user.

## Features

- ✅ **Dynamic Resume Loading** – Loads any user's resume from their public `resume.json` gist (JSON Resume format)
- ✅ **User-Driven** – The GitHub username is taken from the URL (e.g. `example.com/github_username`)
- ✅ **Dark/Light Mode** – Modern CSS theme toggle, persists preference
- ✅ **Modern CSS** – Responsive, semantic, accessible
- ✅ **Error Handling** – Clear messages for missing users, gists, or schema errors
- ✅ **No Dependencies** – Pure vanilla HTML, CSS, JS (no frameworks)
- ✅ **LocalStorage** – Persists theme preference

## How It Works

1. **User visits** `yourdomain.com/github_username`
2. **App fetches** the public gists for `github_username` via the GitHub API
3. **Looks for** a gist file named `resume.json` (must be public, must use [JSON Resume schema](https://jsonresume.org/schema/))
4. **Loads and renders** the resume dynamically
5. **Handles errors** for missing users, missing gists, or invalid schema

## Usage

### For End Users

1. **Create a public gist** named `resume.json` in your GitHub account, using the [JSON Resume schema](https://jsonresume.org/schema/)
2. **Share the site URL** as `yourdomain.com/your_github_username`
3. **Your resume** will be loaded and displayed automatically

### For Developers

#### Running Locally

```bash
python -m http.server 8000
# or
python3 -m http.server 8000
```
Then open `http://localhost:8000/github_username` in your browser.

#### File Structure

```
.
├── index.html           # Entry point (minimal, with JS fallback)
├── style.css            # Modern CSS with theme support
├── script.js            # All markup and data loading logic
├── error.html           # Fallback error page (if JS fails)
├── 404.html             # 404 page for missing routes
└── README.md            # This file
```

## JSON Resume Format

Your `resume.json` must follow the [JSON Resume schema](https://jsonresume.org/schema/). Example:

```json
{
  "basics": {
    "name": "Your Name",
    "label": "Your Title",
    "email": "you@example.com",
    "url": "https://yourwebsite.com",
    "summary": "Short bio..."
  },
  "work": [ ... ],
  "education": [ ... ],
  "skills": [ ... ],
  "projects": [ ... ]
}
```

See [jsonresume.org/schema/](https://jsonresume.org/schema/) for full details.

## Error Handling

- **Missing user**: Clear error if GitHub user does not exist
- **No public `resume.json` gist**: Clear error if not found
- **Invalid schema**: Error if `resume.json` is not valid JSON Resume
- **API rate limits**: Error if GitHub API rate limit is hit

## Browser Support

- Modern browsers with CSS custom properties and `light-dark()`
- Graceful fallback for older browsers

## License

Personal portfolio – feel free to fork, customize, and deploy.
