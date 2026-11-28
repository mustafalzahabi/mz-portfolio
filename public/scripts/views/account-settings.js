// ============================================================================
// ACCOUNT SETTINGS — yours, not your portfolio's look (that's Site settings).
// Opened from the avatar menu anywhere. Same overlay and layout as Site
// settings: groups in a side menu (chips on phones), cards, a search.
//
//   Accounts     GitHub and Google: connect, reconnect, sign out of one;
//                link them into one account, or unlink
//   Sources      (linked) where each part of the portfolio comes from,
//                where new posts and images go, where publishing writes
//   Addresses    both public addresses of the portfolio
//   Editing      README push permission, drafts on this device / in your account
//   Following    blogs followed here; sync them through this account (optional)
//   Data         download resume.json, sign out everywhere, forget this device
// ============================================================================

import { h, svgIcon, toast, copyText, downloadFile } from "../utils.js";
import { ICONS } from "../icons.js";
import { BASE_PATH } from "../router.js";
import { SECTIONS } from "../template.js";
import { STORE_LABEL } from "../combine.js";
import { googleClientId, googleSessionExpired, getGoogleToken, renewGoogleToken } from "../google.js";
import { repoScopeRemembered, forgetRepoScope } from "../github.js";
import { getResumeFilename } from "../data.js";
import { session, storage, signOutOf, signOutAll, linkNow, unlinkAccount, updateAccountPrefs, createCopyIn } from "../storage.js";
import { connectProvider, signOut } from "../account.js";
import { settingsLayout, openOverlay, settingRow, segmented } from "../edit/settings-ui.js";
import * as subs from "../subscriptions.js";
import { syncEnabled, setSync, syncFollows } from "../follow-sync.js";

let dialog = null;
let query = "";
// Following: loaded when the overlay opens (both live outside the account record)
let follows = { loaded: false, sync: null, list: [] };

/** Opens the overlay (scrolled to `group`, e.g. "accounts"). */
export function openAccountSettings(group = "") {
  follows = { loaded: false, sync: null, list: [] };
  if (dialog) return;
  const s = session();
  if (!s) return toast("Sign in first.", "error");
  const slot = h("div.ed-account-settings");
  dialog = openOverlay({ title: "Account settings", content: slot, onClose: () => (dialog = null) });
  const draw = () => {
    slot.replaceChildren(settingsLayout({ groups: groups(draw), query, onQuery: (q) => (query = q), placeholder: "Find a setting" }));
  };
  draw();
  dialog.querySelector(".ed-search")?.focus();
  if (group) queueMicrotask(() => slot.querySelector(`#setg-${group}`)?.scrollIntoView({ block: "start" }));
}

const button = (label, onclick, kind = "ghost", icon = "") =>
  h(`button.btn.btn-${kind}.ed-small`, { type: "button", onclick }, icon ? svgIcon(ICONS[icon]) : null, label);

/** Runs an async action with the button disabled; redraws afterwards. */
const busy = (fn, redraw) => async (e) => {
  const b = e?.currentTarget;
  if (b) b.disabled = true;
  try {
    await fn();
  } catch (err) {
    toast(err.message, "error");
  }
  if (b) b.disabled = false;
  redraw();
  dispatchEvent(new CustomEvent("mz-auth", { detail: { user: session()?.user || null } }));
};

/** "Create a copy in …" for a store that has no copy of the portfolio yet. */
function copyRows(account, redraw) {
  const make = (store, label, hint) => settingRow(label, button(`Create a copy in ${STORE_LABEL[store]}`, busy(async () => {
    if (store === "google" && !getGoogleToken() && !(await renewGoogleToken({ hint: account.google.email }))) throw new Error("Sign in with Google again first.");
    const made = await createCopyIn(store);
    toast(made ? `Your portfolio now also lives in ${STORE_LABEL[store]}.` : `${STORE_LABEL[store]} already has a copy.`);
  }, redraw), "ghost", "plus"), hint);
  const rows = [];
  if (!account.google.folderId) rows.push(make("google", "Google Drive has no copy yet", "Makes a public \"mz-portfolio\" folder in your Drive (anyone with the link can view), with your portfolio in it."));
  else if (account.prefs.primary === "google") rows.push(make("github", "Copy on GitHub", "Makes a public resume.json gist, if there isn't one yet."));
  return rows;
}

function groups(redraw) {
  const s = session();
  const account = s?.account || null;
  const prefs = account?.prefs;
  const savePrefs = (patch) => updateAccountPrefs(patch)
    .then(() => toast("Saved. Visitors see the change after your next publish."))
    .catch((e) => toast(e.message, "error"));

  // ---------- Accounts ----------
  const providerCard = (p) => {
    const user = s.providers[p];
    const known = p === "github" ? account?.github?.login && `@${account.github.login}` : account?.google?.email;
    const expired = p === "google" && !user && googleSessionExpired();
    const status = user
      ? h("p.ed-set-status", { dataset: { tone: "ok" } }, svgIcon(ICONS.check), `Signed in as ${p === "github" ? `@${user.login}` : user.email}`)
      : known
        ? h("p.ed-set-status", { dataset: { tone: "warn" } }, svgIcon(ICONS.alert), `${known}: not signed in on this device${expired ? " (the hour is up)" : ""}. ${p === "google" ? "Publishing can't reach Google Drive" : "Publishing can't reach GitHub"} until you sign in.`)
        : h("p.ed-set-status", "Not connected.");
    const actions = [];
    if (p === "google" && !googleClientId()) actions.push(h("span.muted", "Google sign-in isn't set up on this site."));
    else if (!user) actions.push(button(known ? `Sign in with ${STORE_LABEL[p].replace(" Drive", "")}` : `Connect ${STORE_LABEL[p].replace(" Drive", "")}`, () => connectProvider(p), "primary", p));
    else if (s.providers.github && s.providers.google) actions.push(button(`Sign out of ${STORE_LABEL[p].replace(" Drive", "")}`, busy(() => signOutOf(p), redraw)));
    return {
      name: p,
      title: STORE_LABEL[p],
      desc: p === "github" ? "Your portfolio and posts as gists." : "Your portfolio and posts in a Drive folder.",
      body: h("div.ed-set-body", status, h("div.ed-set-actions", ...actions)),
    };
  };

  const both = Boolean(s.providers.github && s.providers.google);
  const linkBody = account
    ? h("div.ed-set-body",
        h("p.ed-set-status", { dataset: { tone: "ok" } }, svgIcon(ICONS.check),
          `One account${account.linkedAt ? ` since ${new Date(account.linkedAt).toLocaleDateString()}` : ""}: either sign-in opens it.`),
        settingRow("Show my name and photo from", segmented([["github", "GitHub"], ["google", "Google"]], prefs.primary, (v) => savePrefs({ primary: v }).then(redraw), "Primary account")),
        h("div.ed-set-actions", button("Unlink", busy(async () => {
          if (!confirm("Unlink GitHub and Google? Each keeps its own portfolio. Publish once afterwards so visitors stop seeing them combined.")) return;
          await unlinkAccount();
          toast("Unlinked.");
        }, redraw))))
    : h("div.ed-set-body",
        h("p", both
          ? "You're signed in with both here. Link them to make one account: either sign-in opens it, and your portfolio combines what's in both (the newest wins)."
          : `Connect ${s.providers.github ? "Google" : "GitHub"} to make one account from both. It works even if you already have a portfolio in each: they're combined, and once linked you can choose where each part comes from.`),
        h("p.ed-hint", "Signing in to both is what proves they're yours: a matching email alone never links accounts."),
        h("div.ed-set-actions", both
          ? button("Link them", busy(async () => {
              await linkNow();
              toast("Linked. GitHub and Google are now one account.");
            }, redraw), "primary")
          : button(`Connect ${s.providers.github ? "Google" : "GitHub"}`, () => connectProvider(s.providers.github ? "google" : "github"), "primary")));

  const accounts = { id: "accounts", title: "Accounts", cards: [
    { name: "link", title: account ? "Linked" : "One account from both", desc: "GitHub and Google as the same you.", body: linkBody },
    providerCard("github"),
    providerCard("google"),
  ] };

  // ---------- Sources (linked only) ----------
  const choice3 = [["auto", "Newest"], ["github", "GitHub"], ["google", "Google"]];
  const sources = account ? { id: "sources", title: "Sources", cards: [
    {
      name: "resume-sources",
      title: "Resume",
      desc: "Where each part comes from. Newest uses whichever was saved last; a fixed choice falls back to the other when it has nothing there.",
      body: h("div.ed-set-body",
        settingRow("Name, title and contact", segmented(choice3, prefs.sources.resume.basics || "auto", (v) => savePrefs({ sources: { resume: { ...prefs.sources.resume, basics: v } } }), "Basics source")),
        ...SECTIONS.map((sec) => settingRow(sec.label, segmented(choice3, prefs.sources.resume[sec.key] || "auto",
          (v) => savePrefs({ sources: { resume: { ...prefs.sources.resume, [sec.key]: v } } }), `${sec.label} source`))),
        settingRow("Site look and settings", segmented(choice3, prefs.sources.resume.config || "auto", (v) => savePrefs({ sources: { resume: { ...prefs.sources.resume, config: v } } }), "Site settings source"))),
    },
    {
      name: "posts-sources",
      title: "Posts and images",
      desc: "Posts show from both by default; the same post in both shows its newer copy.",
      body: h("div.ed-set-body",
        settingRow("Show posts from", segmented([["both", "Both"], ["github", "GitHub"], ["google", "Google"]], prefs.sources.posts, (v) => savePrefs({ sources: { posts: v } }), "Posts source")),
        settingRow("Save new posts to", segmented([["", "Primary"], ["github", "GitHub"], ["google", "Google"]], prefs.newPostsTo, (v) => savePrefs({ newPostsTo: v }), "New posts go to")),
        settingRow("Save uploaded images to", segmented([["", "Primary"], ["github", "GitHub"], ["google", "Google"]], prefs.imagesTo, (v) => savePrefs({ imagesTo: v }), "Images go to"))),
    },
    {
      name: "publish",
      title: "Publishing",
      desc: "Publishing to both keeps the copies you have the same. A new copy is only made when you ask for it below.",
      body: h("div.ed-set-body",
        settingRow("Publish to", segmented([["both", "Both"], ["github", "GitHub only"], ["google", "Google only"]], prefs.publishTo, (v) => savePrefs({ publishTo: v }), "Publish to"),
          "A place you aren't signed in to on this device is skipped, and catches up next time."),
        ...copyRows(account, redraw)),
    },
  ] } : null;

  // ---------- Addresses ----------
  const addresses = [];
  const gh = account?.github?.login || s.providers.github?.login;
  const folder = account?.google?.folderId || "";
  if (gh) addresses.push(["GitHub address", `${location.origin}${BASE_PATH}${encodeURIComponent(gh)}`]);
  if (folder) addresses.push(["Google Drive address", `${location.origin}${BASE_PATH}${folder}`]);
  const addressCard = addresses.length ? { id: "addresses", title: "Addresses", cards: [{
    name: "addresses",
    title: "Your portfolio's addresses",
    desc: account ? "Both show the same combined portfolio." : "",
    body: h("div.ed-set-body", ...addresses.map(([label, url]) => settingRow(label, h("div.ed-set-actions",
      h("a.ed-set-url", { href: url }, url.replace(/^https?:\/\//, "")),
      button("Copy", async () => toast((await copyText(url)) ? "Copied" : "Couldn't copy"), "ghost", "copy"))))),
  }] } : null;

  // ---------- Editing ----------
  const editing = { id: "editing", title: "Editing", cards: [
    s.providers.github || account ? {
      name: "readme",
      title: "README pushes",
      desc: "Editing a project's README pushes a public commit to its repository.",
      body: h("div.ed-set-body",
        settingRow(repoScopeRemembered() ? "Allowed without asking on this device" : "Asks every time", repoScopeRemembered()
          ? button("Ask every time", () => {
              forgetRepoScope();
              toast("You'll be asked before the next README push.");
              redraw();
            })
          : h("span.muted", "")),
        h("p.ed-hint", "To remove the access completely, revoke mz-portfolio in ",
          h("a", { href: "https://github.com/settings/applications", target: "_blank", rel: "noopener" }, "GitHub → Settings → Applications"), ".")),
    } : null,
    {
      name: "drafts",
      title: "Drafts",
      desc: "Unpublished changes, kept automatically on this device, and in your account when you save them there.",
      body: h("div.ed-set-body",
        settingRow("On this device", button("Clear", () => {
          if (!confirm("Clear the unpublished changes kept on this device?")) return;
          for (const k of ["mz-editor-draft", "mz-editor-post-draft"]) {
            try {
              localStorage.removeItem(k);
            } catch {
              /* nothing kept */
            }
          }
          toast("Cleared.");
        })),
        settingRow(`Saved in your account`, button("Delete", busy(async () => {
          if (!confirm("Delete the draft saved in your account?")) return;
          await storage().clearDraft();
          toast("Deleted.");
        }, redraw)))),
    },
  ] };

  // ---------- Following ----------
  if (!follows.loaded) {
    follows.loaded = true;
    Promise.all([syncEnabled().catch(() => null), subs.list()]).then(([sync, list]) => {
      follows = { loaded: true, sync: Boolean(sync), list, ready: true };
      redraw();
    });
  }
  const permission = subs.supported() ? Notification.permission : "unsupported";
  const followingCard = {
    name: "following",
    title: "Blogs you follow",
    desc: "Following needs no account: it's kept in this browser, and new posts arrive as notifications.",
    body: h("div.ed-set-body",
      follows.list.length
        ? h("ul.ed-follow-list", follows.list.map((b) => h("li",
            h("a", { href: b.blogUrl }, b.name),
            button("Unfollow", busy(async () => {
              await subs.unsubscribe(b.feed);
              follows.list = follows.list.filter((x) => x.feed !== b.feed);
            }, redraw)))))
        : h("p.muted", "You don't follow any blogs on this device yet. Use Follow on a blog to get its new posts."),
      permission === "default" && follows.list.length
        ? settingRow("Notifications on this device", button("Allow notifications", busy(async () => {
            if ((await Notification.requestPermission()) === "granted") toast("Notifications allowed on this device.");
          }, redraw), "primary", "bell"), "Needed for followed blogs to notify you here.")
        : permission === "denied"
          ? h("p.ed-set-status", { dataset: { tone: "warn" } }, svgIcon(ICONS.alert), "Notifications are blocked for this site in your browser settings.")
          : null),
  };
  const syncCard = {
    name: "follow-sync",
    title: "Sync followed blogs",
    desc: "Optional. Every device signed in to this account follows the same blogs. The list is a private file in your own GitHub or Google Drive.",
    body: h("div.ed-set-body",
      !follows.ready
        ? h("p.muted", "Checking…")
        : settingRow("Sync through this account", segmented([["off", "Off"], ["on", "On"]], follows.sync ? "on" : "off", (v) => {
            setSync(v === "on")
              .then(async () => {
                follows = { loaded: true, ready: true, sync: v === "on", list: await subs.list() };
                toast(v === "on" ? "Followed blogs now sync with this account." : "Sync is off. Each device keeps its own list.");
                redraw();
              })
              .catch((e) => toast(e.message, "error"));
          }, "Sync followed blogs")),
      follows.sync ? h("div.ed-set-actions", button("Sync now", busy(async () => {
        await syncFollows();
        follows.list = await subs.list();
        toast("Synced.");
      }, redraw))) : null),
  };
  const following = subs.supported() ? { id: "following", title: "Following", cards: [followingCard, syncCard] } : null;

  // ---------- Data ----------
  const data = { id: "data", title: "Data", cards: [{
    name: "data",
    title: "Your data",
    desc: "Everything lives in your own GitHub and Google accounts; this site keeps no copy.",
    body: h("div.ed-set-body",
      settingRow("Your resume, as published", button("Download resume.json", busy(async () => {
        const found = await storage().findResume(getResumeFilename());
        if (!found) throw new Error("Nothing published yet.");
        downloadFile("resume.json", `${JSON.stringify(found.resume, null, 2)}\n`, "application/json");
      }, () => {}), "ghost", "download")),
      settingRow("Sign out of everything on this device", button("Sign out everywhere", () => {
        dialog?.close();
        signOut();
      }, "ghost", "logout")),
      settingRow("Forget this device", button("Forget", () => {
        if (!confirm("Sign out and remove everything this site kept in this browser (drafts, cached portfolios, preferences)?")) return;
        signOutAll();
        try {
          for (const k of Object.keys(localStorage)) if (k.startsWith("mz-")) localStorage.removeItem(k);
          sessionStorage.clear();
        } catch {
          /* nothing kept */
        }
        dialog?.close();
        location.assign(BASE_PATH);
      }, "ghost", "trash"), "Drafts on this device that you haven't published or saved are lost.")),
  }] };

  return [accounts, sources, addressCard, editing, following, data].filter(Boolean);
}
