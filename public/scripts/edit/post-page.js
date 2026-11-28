// ============================================================================
// POST PAGE EDITING — a post is edited right on its own page: the title and
// description are typed in place, the date, tags and cover sit where they
// show, and the body is Markdown with a live preview beside it (or behind a
// tab on phones). Posts save on their own, separately from the portfolio.
// ============================================================================

import { h, svgIcon, toast, slugify, readingTime } from "../utils.js";
import { ICONS } from "../icons.js";
import { markdownToHtml } from "../markdown.js";
import { validateField } from "../editor-core.js";
import { frontmatter } from "../posts.js";
import { storage } from "../storage.js";
import { ed, store, loadPost, savePostDraft, POST_DRAFT_KEY } from "./core.js";
import { editInPlace } from "./inline.js";
import { chips, imageMenu } from "./direct.js";
import { markdownEditor } from "./markdown-editor.js";
import { attachDatePicker } from "./datepicker.js";

/**
 * Turns `article` (the post's page, or the blog page for a new post) into the post's editor.
 * @param {HTMLElement} article
 * @param {object|null} post     the stored post (from ed.posts), or null for a new one
 * @param {object} o
 * @param {(post) => void} o.onSaved     after a save (the post's new address may differ)
 * @param {() => void} o.onDeleted
 * @param {string} o.backHref
 */
export async function editPostOnPage(article, post, { onSaved, onDeleted, backHref }) {
  article.classList.add("ed-post-editing");
  article.replaceChildren(h("p.muted", "Loading the post…"));
  let p;
  try {
    p = await loadPost(post);
  } catch (e) {
    article.replaceChildren(h("p.ed-error", e.message));
    return;
  }
  const isNew = !p.gistId;
  const touch = () => {
    p.dirty = true;
    savePostDraft(p);
    status.textContent = "Unsaved changes";
  };
  const status = h("span.ed-post-status", { "aria-live": "polite" }, isNew ? "New post, not published yet" : "");

  // ---- header: title, description, date, tags (all where they show)
  const title = h("h1.detail-title", { dataset: { placeholder: "Post title" } }, p.title);
  editInPlace(title, { placeholder: "Post title", read: () => p.title, write: (v) => { p.title = v; touch(); } });
  const lead = h("p.detail-lead", p.description);
  editInPlace(lead, { placeholder: "A one-line description (shown on the blog list and in link previews)", read: () => p.description, write: (v) => { p.description = v; touch(); } });

  const date = h("input.ed-date-input", { type: "text", inputmode: "numeric", placeholder: "YYYY-MM-DD", "aria-label": "Date", value: p.date || "" });
  attachDatePicker(date, { day: true });
  date.addEventListener("change", () => {
    const err = validateField("date", date.value.trim());
    date.setAttribute("aria-invalid", err ? "true" : "false");
    if (err) return toast(err, "error");
    p.date = date.value.trim();
    touch();
  });
  const readTime = h("span.muted", `${readingTime(p.body)} min read`);
  const tags = chips(() => p.tags, (v) => { p.tags = v; touch(); }, { label: "", placeholder: "Add a tag…" });

  // ---- cover image: on itself, or a slot to drop / pick one
  const cover = h("figure.ed-post-cover");
  const drawCover = () => {
    cover.replaceChildren(
      p.image ? h("img.post-cover", { src: p.image, alt: "", decoding: "async" }) : h("span.ed-post-cover-empty", "Cover image (optional)"),
      h("div.ed-media-tools", imageMenu(cover, {
        kind: `post-${slugify(p.slug || p.title || "new")}`, label: p.image ? "Change cover image" : "Add a cover image", current: p.image,
        onSet: (v) => { p.image = v; touch(); drawCover(); },
      })),
    );
    cover.classList.toggle("has-image", Boolean(p.image));
  };
  drawCover();

  // ---- body: Markdown, with a live preview
  const body = markdownEditor({
    value: p.body,
    label: "Post body (Markdown)",
    toHtml: (text) => markdownToHtml(text),
    onInput: (text) => {
      p.body = text;
      readTime.textContent = `${readingTime(text)} min read`;
      touch();
    },
  });

  // ---- options and actions, at the end of the post
  const slug = h("input.ed-strip-input", { type: "text", spellcheck: "false", placeholder: "post-address", "aria-label": "Address (slug)", value: p.slug || slugify(p.title || ""), size: 24 });
  slug.addEventListener("change", () => { p.slug = slugify(slug.value); slug.value = p.slug; touch(); });
  const canonical = h("input.ed-strip-input", { type: "url", placeholder: "https://… (if first published elsewhere)", "aria-label": "Original link (canonical URL)", value: p.canonical || "", size: 30 });
  canonical.addEventListener("change", () => {
    const err = validateField("url", canonical.value.trim());
    if (err) return toast(err, "error");
    p.canonical = canonical.value.trim();
    touch();
  });
  const draft = h("input", { type: "checkbox", checked: p.draft ? true : null });
  draft.addEventListener("change", () => { p.draft = draft.checked; touch(); });
  const pub = h("input", { type: "checkbox", checked: p.isPublic !== false ? true : null });
  pub.addEventListener("change", () => { p.isPublic = pub.checked; touch(); });

  const saveBtn = h("button.btn.btn-primary", { type: "button" }, svgIcon(ICONS.check), isNew ? "Publish post" : "Save post");
  const save = async () => {
    if (!p.title.trim()) {
      title.focus();
      return toast("Give the post a title first.", "error");
    }
    p.slug = slugify(slug.value || p.slug || p.title);
    saveBtn.disabled = true;
    status.textContent = "Saving…";
    try {
      const filename = isNew ? `${p.slug}.md` : p.filename;
      Object.assign(p, await storage().writePost(isNew ? null : p, { title: p.title, filename, content: frontmatter(p), isPublic: p.isPublic !== false }));
      if (isNew) ed.posts?.unshift(p);
      p.dirty = false;
      store.remove(POST_DRAFT_KEY);
      storage().forgetCache();
      ed.ownResume = null;
      status.textContent = "Saved";
      toast(p.draft ? "Saved as a draft (hidden from the blog)." : p.isPublic !== false ? "Post saved. It's live on your portfolio." : "Post saved as a secret gist.");
      onSaved?.(p);
    } catch (e) {
      status.textContent = "";
      toast(e.message, "error");
    }
    saveBtn.disabled = false;
  };
  saveBtn.addEventListener("click", save);
  const remove = async () => {
    if (!confirm(`Delete "${p.title}"? This deletes the ${storage().postNoun} and can't be undone.`)) return;
    try {
      await storage().deletePost(p);
      ed.posts = ed.posts?.filter((x) => x !== p);
      storage().forgetCache();
      toast("Post deleted.");
      onDeleted?.();
    } catch (e) {
      toast(e.message, "error");
    }
  };
  // Ctrl/⌘+S saves the post while it's open
  article.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      e.stopPropagation();
      save();
    }
  });

  article.replaceChildren(
    h("a.back-link", { href: backHref }, svgIcon(ICONS.arrowLeft), "Blog"),
    h("header.detail-head",
      title,
      lead,
      h("p.detail-meta.ed-post-meta", h("label.ed-inline-label", svgIcon(ICONS.clock), date), " · ", readTime),
      tags,
    ),
    cover,
    h("div.ed-post-body", body.el),
    h("footer.ed-post-bar",
      h("div.ed-post-options",
        h("label.ed-strip-field", h("span.ed-strip-label", "Address"), slug),
        h("label.ed-strip-field", h("span.ed-strip-label", "Original link (optional)"), canonical),
        h("label.ed-check-inline", draft, h("span", "Draft (hidden from the blog)")),
        isNew ? h("label.ed-check-inline", pub, h("span", storage().canBePrivate ? "Public gist (secret gists don't show on the portfolio)" : "Public")) : null,
      ),
      h("div.ed-post-actions",
        status,
        isNew ? null : h("button.ed-tool.is-danger", { type: "button", "aria-label": "Delete post", title: "Delete post", onclick: remove }, svgIcon(ICONS.trash)),
        saveBtn,
      ),
    ),
  );
  if (isNew) title.focus();
}
