# Portfolio (JSON Resume, Pure HTML/CSS/JS)

<img width="960" height="438" alt="image" src="https://github.com/user-attachments/assets/edc1f6ba-4d5a-49e6-a894-6de04ad1e440" />


A modern, fully responsive portfolio site built with pure HTML, CSS, and JavaScript. All content is loaded dynamically from a public [JSON Resume](https://jsonresume.org/) (`resume.json`) GitHub gist for any user.

## Features

- ✅ **Dynamic Resume Loading** – Loads any user's resume from their public `resume.json` gist (JSON Resume format)
- ✅ **Gist-Powered Blog** – Any public gist with a `.md` file becomes a blog post (YAML frontmatter supported)
- ✅ **User-Driven** – The GitHub username is taken from the URL path or `?user=` query parameter
- ✅ **Dark/Light Mode** – Modern CSS theme toggle, persists preference
- ✅ **Modern CSS** – Responsive, semantic, accessible
- ✅ **Error Handling** – Clear messages for missing users, gists, or schema errors
- ✅ **No Dependencies** – Pure vanilla HTML, CSS, JS (no frameworks)
- ✅ **LocalStorage** – Persists theme preference

## How It Works

1. **User visits** `yourdomain.com/github_username` **or** `yourdomain.com/?user=github_username`
2. **App fetches** the public gists for `github_username` via the GitHub API
3. **Looks for** a gist file named `resume.json` (must be public, must use [JSON Resume schema](https://jsonresume.org/schema/))
4. **Loads and renders** the resume dynamically
5. **Scans gists for blog posts** – any public gist containing a `.md` file is treated as a blog post (YAML frontmatter parsed for metadata)
6. **Handles errors** for missing users, missing gists, or invalid schema

## Usage

### For End Users

1. **Create a public gist** named `resume.json` in your GitHub account, using the [JSON Resume schema](https://jsonresume.org/schema/)
2. **Share the site URL** as:
   - `yourdomain.com/your_github_username` (path-based – works on GitHub Pages thanks to the built-in SPA redirect)
   - `yourdomain.com/?user=your_github_username` (query-parameter – always works, recommended for local dev)
3. **Your resume** will be loaded and displayed automatically

### For Developers

#### Running Locally

```bash
python -m http.server 8000
# or
python3 -m http.server 8000
```

> **Tip:** Path-based routing (e.g. `/github_username`) requires a server that redirects unknown paths to `index.html`. The included `404.html` handles this automatically on GitHub Pages. For local development, use the `?user=` query parameter instead.

#### File Structure

```
.
├── index.html              # Entry point (minimal, with JS fallback)
├── 404.html                # SPA redirect – sends unknown paths back to index.html
├── error.html              # Fallback error page (if JS fails)
├── README.md               # This file
├── prompt.md               # AI chat system prompt template
├── css/
│   ├── tokens.css          # Design tokens (colors, typography)
│   ├── global.css          # Reset, layout, sections
│   ├── tabs.css            # Tab selector (Profile / Blog)
│   ├── navbar.css          # Side navigation dots
│   ├── header.css          # Banner, profile photo, info
│   ├── about.css           # About section
│   ├── education.css       # Education section
│   ├── projects.css        # Projects grid + cards
│   ├── project-detail.css  # Project detail page
│   ├── slideshow.css       # Image slideshow
│   ├── skills.css          # Skills section
│   ├── contact.css         # Contact section
│   ├── home.css            # Landing page
│   ├── blog.css            # Blog list + detail styles
│   ├── footer.css          # Footer
│   ├── loading.css         # Loading spinner
│   ├── chat.css            # AI chat bubble
│   ├── resume-overlay.css  # Resume modal viewer
│   └── responsive.css      # Media queries
└── js/
    ├── main.js             # Entry point
    ├── app.js              # Core: routing, state, DOM assembly, tab switching
    ├── components.js       # All DOM builders (header, sections, blog, etc.)
    ├── data.js             # Data collection (resume.json, blog posts, GitHub)
    ├── api.js              # GitHub API integration (profile, repos, README)
    ├── chat.js             # AI chat bubble UI
    ├── model.js            # Puter.js AI model wrapper
    ├── theme.js            # Dark/light/auto theme management
    └── utils.js            # Markdown renderer, frontmatter parser, helpers
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
- **No username**: Friendly landing page with a search input

## Browser Support

- Modern browsers with CSS custom properties and `light-dark()`
- Graceful fallback for older browsers

## License

Personal portfolio – feel free to fork, customize, and deploy.

## Blog

Your public GitHub Gists with `.md` files are automatically treated as blog posts. A **Blog** tab appears next to **My Profile** when blog posts are found.

### How Blog Posts Work

1. Every public gist you own with a `.md` file is a blog post candidate
2. The app fetches all your gists, finds `.md` files, and parses their **YAML frontmatter** (if present) for metadata
3. Posts are sorted by date (newest first) and displayed as cards on the Blog tab
4. Clicking a post opens a clean reading view with rendered Markdown

### YAML Frontmatter (Optional but Recommended)

Add metadata at the top of your `.md` file using standard Jekyll-style YAML frontmatter:

```markdown
---
title: "My First Blog Post"
date: 2025-06-15
tags: [javascript, react]
description: "A brief summary shown in the blog listing"
draft: false
---

Your blog content here...
```

Supported frontmatter fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `title` | string | gist description / filename | Post title |
| `date` | string | gist `created_at` | Publish date (ISO 8601) |
| `tags` | array | `[]` | List of tag strings |
| `description` | string | `""` | Short excerpt for the card view |
| `preview` | string | `""` | Alias for `description` |
| `draft` | boolean | `false` | When `true`, post is hidden |
| `published` | boolean | `true` | When `false`, post is hidden |
| `image` | string | `""` | Featured image URL (reserved) |

### No Frontmatter? No Problem.

If your `.md` file has no frontmatter, the app falls back to:
- **Title**: gist description → first `# Heading` → filename (without `.md`)
- **Date**: gist creation date
- **Tags**: empty

### Disabling the Blog

To disable the blog feature entirely, add `"blog": false` to your `meta.mz-portfolio-config`:

```json
{
  "meta": {
    "mz-portfolio-config": {
      "blog": false
    }
  }
}
```

### Example Blog Gist

A minimal blog post gist:

1. Create a **public gist** on https://gist.github.com
2. Name the file `hello-world.md`
3. Add content:

```markdown
---
title: "Hello World"
date: 2025-06-15
tags: [meta]
---

This is my first blog post!
```

4. That's it — it appears on your portfolio's Blog tab automatically.

## Advanced Customization (meta.mz-portfolio-config)

You can fully customize the design and text of your portfolio by adding a `meta.mz-portfolio-config` section to your `resume.json`. This allows you to override colors, layout, section order, and more—without editing any code.

### Example

```json
{
  "basics": { ... },
  "projects": [ ... ],
  "meta": {
    "mz-portfolio-config": {
      "accent": "#0077ff", // Main accent color
      "theme": {
        "dark": true
      },
      "text": {
        "tagline": "Creative Developer",
        "cta": "Download CV"
      },
      "profile": {
        "photo": "gh", // or custom URL/base64
        "photoShape": "circle" // circle | rounded | square
      },
      "banner": {
        "height": "220px"
      },
      "themeToggle": {
        "style": "icon" // icon | slider | switch
      },
      "projects": {
        "layout": "horizontal", // vertical | horizontal
        "imagePosition": "left" // top | left | right | bottom
      },
      "skills": {
        "display": "tags" // list | tags | progress
      },
      "sections": {
        "order": ["about", "projects", "skills", "education", "contact"],
        "hide": ["education"]
      },
      "animation": {
        "transitionDuration": "0.3s",
        "type": "slide", // slide | fade | none
        "shadowOnHover": true,
        "glowOnHover": false
      },
      "blog": {
        "enabled": true // set false to disable the Blog tab
      }
    }
  }
}
```

- All options are optional. Defaults match the current design.
- Section order and hide let you rearrange or remove sections.
- Profile photo can be a URL, base64, or "gh"/"github" for your GitHub avatar.
- All colors are derived from `accent` for a cohesive look.
- `blog: false` (boolean) also works as shorthand to disable the blog.
- See `js/app.js` for all supported options.
