// ============================================================================
// README EDITOR — edit a project's README.md in its GitHub repo, from the
// project page. Saving changes the person's repository, so the app first says
// exactly which README it will change and asks for GitHub's "public_repo"
// permission: "Allow once" (a token for this one save, then dropped) or
// "Always allow" (kept, so later saves don't ask). Sign-in leaves the page, so
// the edit is stashed in sessionStorage and the save resumes on return.
// ============================================================================

import { h, svgIcon, toast } from "../utils.js";
import { ICONS } from "../icons.js";
import { readmeHtml } from "../components.js";
import { loginUrl } from "../account.js";
import { session } from "../storage.js";
import {
  getRepoReadme, putRepoFile, canWriteRepos, dropOnceToken, readmePending, setReadmePending, GitHubError,
} from "../github.js";
import { choiceDialog } from "./core.js";
import { markdownEditor } from "./markdown-editor.js";

const DEFAULT_MESSAGE = "Update README via mz-portfolio";

/** True when the signed-in GitHub user owns this project's repo. */
export function canEditReadme(project) {
  const s = session();
  const login = s?.provider === "github" ? s.user.login : "";
  return Boolean(project?.repo && login && login.toLowerCase() === String(project.repo.owner).toLowerCase());
}

/** GitHub's own editor for the README, for anyone who can't edit it here. */
export function githubEditUrl(project, path = "README.md") {
  const { owner, name, branch } = project.repo;
  return `https://github.com/${owner}/${name}/edit/${branch || "main"}/${path}`;
}

const repoLabel = (project) => `${project.repo.owner}/${project.repo.name}`;

/**
 * Opens the README editor for a project.
 * @param {object} project       merged project with .repo { owner, name, branch }
 * @param {object} [o]
 * @param {object} [o.restore]   a stashed edit to restore ({ text, message, sha, path })
 * @param {boolean} [o.autoSave] save right away (after the permission sign-in)
 * @param {(text) => void} [o.onSaved]
 */
export async function openReadmeEditor(project, { restore = null, autoSave = false, onSaved = () => {} } = {}) {
  const { owner, name, branch } = project.repo;
  const state = { path: restore?.path || "README.md", sha: restore?.sha || "", text: restore?.text ?? "", message: restore?.message || DEFAULT_MESSAGE };

  const status = h("p.readme-status", { "aria-live": "polite" }, restore ? "" : "Loading the README from GitHub…");
  const message = h("input.input.readme-message", { type: "text", "aria-label": "Commit message", placeholder: DEFAULT_MESSAGE, value: state.message });
  const branchName = branch || "the default branch";
  const saveBtn = h("button.btn.btn-primary", { type: "button", disabled: restore ? null : true }, svgIcon(ICONS.github), "Commit and push");
  const close = () => dialog.close();
  const editorSlot = h("div.readme-body");

  const dialog = h("dialog.readme-dialog", { "aria-labelledby": "readme-title" },
    h("header.readme-head",
      h("div.readme-titles",
        h("h2#readme-title", "Edit README"),
        h("p.muted", "Saving commits ", h("code", state.path), " and pushes it to ", h("strong", branchName), " of ",
          h("a", { href: `https://github.com/${owner}/${name}`, target: "_blank", rel: "noopener" }, repoLabel(project)),
          " on GitHub. The change is public right away and stays in the repository's history."),
      ),
      h("button.readme-close", { type: "button", "aria-label": "Close", onclick: close }, "×"),
    ),
    editorSlot,
    h("footer.readme-foot", status, h("label.readme-message-label", "Commit message", message),
      h("div.readme-actions", h("button.btn.btn-ghost", { type: "button", onclick: close }, "Cancel"), saveBtn)),
  );
  dialog.addEventListener("close", () => dialog.remove());
  document.body.appendChild(dialog);
  dialog.showModal();

  const mount = (text) => {
    state.text = text;
    const md = markdownEditor({ value: text, label: "README.md", toHtml: (t) => readmeHtml(project, t), onInput: (t) => (state.text = t) });
    editorSlot.replaceChildren(md.el);
    return md;
  };
  let md;
  if (restore) md = mount(state.text);
  else {
    try {
      const file = await getRepoReadme(owner, name, branch);
      Object.assign(state, { path: file.path, sha: file.sha });
      dialog.querySelector(".readme-titles code").textContent = file.path;
      md = mount(file.text);
      status.textContent = "";
      saveBtn.disabled = false;
    } catch (e) {
      status.textContent = e.message;
      editorSlot.replaceChildren(h("p.readme-fallback", "You can still ", h("a", { href: githubEditUrl(project), target: "_blank", rel: "noopener" }, "edit it on GitHub"), "."));
      return;
    }
  }

  const save = async () => {
    state.message = message.value.trim() || DEFAULT_MESSAGE;
    if (!canWriteRepos()) {
      const choice = await choiceDialog(`Push a commit to ${repoLabel(project)}?`, [
        h("p", "Saving creates a commit that changes ", h("code", state.path), " on ", h("strong", branchName), " of ", h("strong", repoLabel(project)),
          ", and pushes it to GitHub under your name. It's public as soon as it's pushed, and it can only be undone with another commit."),
        h("p", "To push, mz-portfolio needs GitHub's permission to write to your public repositories (all of them, not just this one)."),
        h("p.muted", "Allow once: the permission is used for this push only, then dropped. Always allow: later README pushes won't ask for permission again (sign out to remove it)."),
      ], [[null, "Cancel"], ["once", "Allow once"], ["always", "Always allow", "primary"]]);
      if (!choice) return;
      const returnPath = location.pathname + location.search;
      setReadmePending({ owner, repo: name, branch, ...state, mode: choice, returnPath });
      location.href = loginUrl(returnPath, { repoAccess: true });
      return;
    }
    saveBtn.disabled = true;
    status.textContent = `Pushing a commit to ${branchName}…`;
    try {
      state.sha = await putRepoFile(owner, name, { path: state.path, text: state.text, sha: state.sha, message: state.message, branch });
    } catch (e) {
      saveBtn.disabled = false;
      if (e instanceof GitHubError && e.status === 409) return conflict();
      if (e instanceof GitHubError && (e.status === 403 || e.status === 404)) dropOnceToken();
      status.textContent = e.message;
      return;
    }
    dropOnceToken();
    forgetReadme(project);
    project.readme = state.text;
    toast(`Commit pushed to ${repoLabel(project)} (${branchName}).`);
    close();
    onSaved(state.text);
  };

  const conflict = async () => {
    status.textContent = "";
    const choice = await choiceDialog("The README changed on GitHub", h("p", "Someone (maybe you, in another tab) saved ", h("code", state.path), " in ", repoLabel(project), " after you opened it."),
      [["theirs", "Load GitHub's version"], ["mine", "Save mine over it", "primary"]]);
    const latest = await getRepoReadme(owner, name, branch).catch((e) => (status.textContent = e.message, null));
    if (!latest) return;
    state.sha = latest.sha;
    if (choice === "theirs") md = mount(latest.text);
    else if (choice === "mine") save();
  };

  saveBtn.addEventListener("click", save);
  if (autoSave) save();
}

/** Clears the cached README so the project page shows the saved one. */
function forgetReadme(project) {
  try {
    localStorage.removeItem(`mz-cache-readme-${project.repo.owner}-${project.repo.name}`);
  } catch {
    /* ignore */
  }
}

/**
 * After the permission sign-in comes back: reopens the stashed README edit on
 * its project page and saves it (or just reopens it if permission was refused).
 */
export function resumeReadmeEdit(project, onSaved) {
  const pending = readmePending();
  if (!pending || !project?.repo) return false;
  if (pending.owner !== project.repo.owner || pending.repo !== project.repo.name) return false;
  setReadmePending(null);
  const restore = { text: pending.text, message: pending.message, sha: pending.sha, path: pending.path };
  openReadmeEditor(project, { restore, autoSave: !pending.denied && canWriteRepos(), onSaved });
  return true;
}
