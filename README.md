# mz-portfolio

Turn a [JSON Resume](https://jsonresume.org/) (`resume.json`) into a responsive portfolio, rendered entirely in the browser. Pure HTML, CSS and JavaScript: no framework, no build step, no runtime dependencies.

## Features

- **Live from your resume.** The resume loads from a public GitHub gist or Google Drive. Edit it and the site updates.
- **Projects, merged.** Resume projects are matched with your GitHub repos, adding stars, READMEs and cover images. Each project has its own page.
- **Tabs.** Profile, Blog, and up to 8 custom tabs: links, embeds, Markdown, code files or sandboxed HTML demos.
- **Built-in resume viewer.** Native ports of 8 JSON Resume themes, with print/PDF and download.
- **Blog.** Public gists with a `.md` file, or `.md` files in your Drive folder, become posts. Includes search, tags and pagination.
- **Colors.** The TwOP-Architecture color system: 10 tokens, with dark mode generated automatically.
- **Mobile first.** A bottom section bar on phones, side dots on desktop, and a 44px minimum touch target.
- **Configurable from your resume.** Colors, layout, sections, texts and animations, including a "code" intro that types out the code that builds each section.
- **Preview mode.** Paste or drop a `resume.json` to check it before publishing. Nothing is uploaded.
- **Production basics:**
  - Strict CSP and URL sanitising
  - A safe in-house Markdown renderer
  - Offline support (service worker plus saved snapshots)
  - Open Graph and JSON-LD metadata
  - Accessible landmarks and focus handling, with reduced motion respected

## URLs

| URL | Shows |
|---|---|
| `/` | Landing page |
| `/username` | GitHub user's portfolio (gist `resume.json` + repos) |
| `/<drive-file-or-folder-id>` | Google Drive portfolio |
| `/<id>/project/<slug>` | A project's own page |
| `/<id>/blog`, `/<id>/blog/<slug>` | Blog list and posts |
| `/<id>/tab/<slug>` | A custom tab |
| `/<id>/resume` | Profile with the resume viewer open |
| `/preview`, `/preview/view/...` | Check a resume.json locally, then view it |
| `/docs` | Every configuration option |
| `/<id>#projects` | Scroll to a profile section |

**How the source is detected:**
- GitHub usernames are at most 39 characters of letters, digits and single hyphens.
- Drive IDs are usually 25–44 characters and often contain `_`.

So the id alone tells the sources apart, and you can also paste a full `drive.google.com/...` link. In the rare case an id could be either, GitHub is tried first, then Drive. `preview` and `docs` are reserved paths.

`?gistname=cv` loads `cv.json` instead of `resume.json`.

## Tabs

Profile is always the first tab. Blog appears when you have posts. You can add up to 8 tabs of your own in `meta["mz-portfolio-config"].tabs`:

```json
"tabs": [
  { "label": "Talks", "type": "embed", "url": "https://www.youtube.com/embed/VIDEO_ID" },
  { "label": "Notes", "type": "markdown", "url": "https://gist.githubusercontent.com/you/ID/raw/notes.md" },
  { "label": "Snippet", "type": "code", "language": "js", "content": "export const x = 1;" },
  { "label": "Demo", "type": "html", "height": 400, "url": "https://raw.githubusercontent.com/you/repo/main/demo.html" },
  { "label": "Website", "type": "link", "url": "https://example.com" }
]
```

| Type | What it does | Safety |
|---|---|---|
| `link` | Opens the URL in a new browser tab | https only |
| `embed` | Shows another site in a frame | https only, never this site's own pages; the frame can't navigate the portfolio |
| `markdown` | Renders Markdown | The safe built-in renderer; no raw scripts or unsafe links |
| `code` | Shows a code file with highlighting | Displayed as text, never run |
| `html` | Runs a small HTML/CSS/JS demo | Runs in `markup/sandbox.html` inside a sandboxed frame with an opaque origin, so it can't read the portfolio's page, storage or cookies |

Files can come from `content` (inline text) or a `url` on `raw.githubusercontent.com` or `gist.githubusercontent.com`.

## Configuration

Everything is configured inside your own `resume.json`. There is no separate config file.

```json
{
  "meta": {
    "theme": "elegant",
    "mz-portfolio-config": {
      "colors": { "accent": "#2f5d62" },
      "theme": { "mode": "auto", "toggle": "switch" },
      "sections": { "order": ["about", "projects", "work"], "hide": ["references"] },
      "projects": { "layout": "grid", "sort": "stars", "github": "matched" },
      "skills": { "display": "progress" },
      "animation": { "intro": "code" }
    }
  }
}
```

`/docs` lists every option, its type, its default and what it does. That page is generated from the schema in `public/scripts/config.js`. Older config shapes still work: top-level `accent`, `theme.accent`, `themeToggle.style`, `blog: false` and `animation.type`.

Animation intros:
- `none`
- `fade`
- `slide`
- `stagger`
- `typewriter`
- `blueprint`
- `code`: types out each section's builder function (or its HTML with `animation.code.source: "html"`), then reveals the section. Click or press Esc to skip.

### Resume themes (`meta.theme`)

These themes are rendered natively from ports of the original packages: `even` (default), `elegant`, `flat`, `kendall`, `stackoverflow`, `macchiato`, `onepage` and `professional`.

For any other theme name, the viewer asks the JSON Resume registry. If that fails, it shows `even` with a notice.

## Colors

`public/styles/style.css` follows TwOP-Architecture (`public/vanilla/styles/style.css`). There are ten light-mode inputs:

| Token | Role |
|---|---|
| `--base` | Canvas |
| `--core` | Text |
| `--accent` | Actions |
| `--variant` | Hover/focus |
| `--surface` | Cards |
| `--depth` | Borders |
| `--optimal` | Success |
| `--risky` | Warning |
| `--fatal` | Error |
| `--prime` | Brand |

**How dark mode is generated:**
- The `--color-*` outputs pass each token through TwOP's `--dm-*` formulas (oklch lightness inversion and chroma scaling).
- The formulas are written inline as relative colors, so they work in every current browser.
- Every other shade is a `color-mix()` of these outputs. The only exception is tags naming a programming language, which use GitHub's language colors (from linguist; turn off with `tags.languageColors: false`).

## Google Drive setup (site owner)

Browsers can't download Drive files directly, so Drive portfolios use the Drive API with a browser key:

1. In Google Cloud Console, enable the **Google Drive API** and create an **API key**.
2. Restrict the key:
   - **HTTP referrers:** your domain only.
   - **API restrictions:** Drive API only.
3. Put the key in `public/index.html`: `<meta name="mz-google-api-key" content="YOUR_KEY">`.

Users then share their `resume.json` file, or a folder containing it, as **Anyone with the link** and open `/<file-or-folder-id>`.

## GitHub rate limits

Unauthenticated visitors get 60 GitHub API calls per hour.
- A cold visit uses about 3: user, repos and gist list.
- Gists and READMEs come from raw hosts, which aren't limited.
- Responses are revalidated with ETags.
- Each portfolio is snapshotted for 30 minutes.
- If the limit is hit, a saved copy is shown with a banner, or a countdown page if nothing is saved.

## Development

```bash
node tools/dev-server.mjs        # http://localhost:8000 — serves public/ like Cloudflare Pages
node --test                      # unit tests (Node 20.11+, no dependencies)
```

Cloudflare Pages serves `public/index.html` for every route that isn't a file (SPA fallback), so path URLs like `/username/project/x` just work. `wrangler.toml` sets the Pages output directory to `./public`. The dev server does the same locally. Other static servers have no fallback; use `?p=username` there. Assets are linked with absolute paths (`/styles/…`), so the site must be served from the domain root.

## Project structure

The layout follows the [TwOP Architecture](https://github.com/hamuda8/TwOP-Architecture) vanilla template. There is no private origin (backend): everything is the static public origin.

```
public/                       Static public origin (Cloudflare Pages output)
├── index.html                Entry page (served for every route)
├── manifest.json
├── sw.js                     Service worker
├── markup/                   Other HTML: error.html, sandbox.html (isolated demo runner)
├── scripts/
│   ├── index.js              Entry: PortfolioCore class → window.App
│   ├── app.js  router.js  config.js  data.js  api.js  merge.js
│   ├── components.js  theme.js  icons.js  languages.js  markdown.js  utils.js  log.js
│   ├── views/                landing · docs · preview · status
│   ├── animations/           index · code-reveal
│   └── resume/               index · helpers · themes/*.js
├── styles/
│   ├── style.css             TwOP color scheme; imports the parts below
│   └── global · header · navbar · sections · projects · detail · project-page
│       blog · home · status · animations · resume-overlay (.css)
└── assets/
    ├── images/               favicon.svg …
    ├── examples/resume.json  Example used by Preview and the tests
    └── prompt.md             AI assistant prompt (not loaded yet)
tests/                        node --test
tools/dev-server.mjs          Local server with the same SPA fallback as Cloudflare
wrangler.toml                 Pages settings (output dir: ./public)
```

`scripts/chat.js`, `scripts/model.js`, `styles/chat.css` and `assets/prompt.md` hold the AI assistant. It isn't loaded yet.

**TwOP's "no logic bleed" rule:** TwOP says secrets never go in `public/`. The only key here is the optional Google Drive browser key, which is public by design and must be locked to your domain (see above). Anything truly secret would need a private origin.

## License

Personal portfolio engine. Feel free to fork, customize and deploy.
