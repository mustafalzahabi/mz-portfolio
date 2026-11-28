// ============================================================================
// FOLLOW SYNC — optional. Following never needs an account; a signed-in person
// can turn on "Sync followed blogs" in Account settings, and the list is kept
// in a private file in their own GitHub or Drive (storage.js readFollows /
// writeFollows). Every device signed in to that account then follows the same
// blogs. Unfollows are remembered with a time, so they spread too.
// ============================================================================

import { session, readFollows, writeFollows } from "./storage.js";
import * as subs from "./subscriptions.js";

const signedIn = () => Boolean(session()?.providers?.github || session()?.providers?.google);

/** Whether sync is on for this account (null when nobody is signed in). */
export async function syncEnabled() {
  if (!signedIn()) return null;
  return Boolean((await readFollows())?.enabled);
}

/** Brings this device and the account's list together (both directions). */
export async function syncFollows() {
  if (!signedIn() || !subs.supported()) return;
  const remote = await readFollows();
  if (!remote?.enabled) return;
  const local = await subs.list();
  const blogs = new Map(remote.blogs.map((b) => [b.feed, b]));
  const removed = { ...remote.removed };
  let dirty = false;
  for (const l of local) {
    if (removed[l.feed] && removed[l.feed] > l.added) await subs.removeLocal(l.feed); // unfollowed elsewhere later
    else if (!blogs.has(l.feed)) {
      blogs.set(l.feed, { feed: l.feed, name: l.name, blogUrl: l.blogUrl, added: l.added });
      delete removed[l.feed];
      dirty = true;
    }
  }
  for (const b of blogs.values()) {
    if (!local.some((l) => l.feed === b.feed) && !(removed[b.feed] > b.added)) await subs.addLocal(b);
  }
  if (dirty) await writeFollows({ enabled: true, blogs: [...blogs.values()], removed });
}

/** Turns sync on or off for the account (on: this device's follows join the list). */
export async function setSync(on) {
  const remote = (await readFollows()) || { blogs: [], removed: {} };
  await writeFollows({ ...remote, enabled: on });
  if (on) await syncFollows();
}

// Follows and unfollows made on this device go to the account's list, when sync is on
addEventListener("mz-follows-changed", async ({ detail }) => {
  try {
    if (!signedIn()) return;
    const remote = await readFollows();
    if (!remote?.enabled) return;
    const blogs = remote.blogs.filter((b) => b.feed !== detail.feed);
    const removed = { ...remote.removed };
    const now = new Date().toISOString();
    if (detail.action === "follow") {
      blogs.push({ ...detail.blog, added: now });
      delete removed[detail.feed];
    } else removed[detail.feed] = now;
    await writeFollows({ enabled: true, blogs, removed });
  } catch {
    /* offline: the next sync catches up */
  }
});
