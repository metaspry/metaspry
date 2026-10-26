/**
 * Two-way sync of the extension's audit settings with the signed-in user's cloud personal
 * settings doc (users/{uid}/settings/audit), so scoring rules match the web app.
 * Cloud wins on sign-in (pull); local edits push. A suppress flag avoids the pull echo.
 */
import { get } from 'svelte/store';
import { firestoreSdk } from './sdk';
import { cloudUser } from './auth';
import { toast } from '../toast';
import { report } from '../diagnostics';
import {
  settings,
  applySettingsWithoutPersisting,
  DEFAULT_SETTINGS,
  normalizeAuditSettings,
  settingsChangeIsExternal,
  type Settings,
} from '../storage/settings';

export async function loadCloudSettings(uid: string): Promise<Settings | null> {
  const { db, doc, getDoc } = await firestoreSdk();
  const snap = await getDoc(doc(db, 'users', uid, 'settings', 'audit'));
  if (!snap.exists()) return null;
  // The same normaliser as the workspace document and chrome.storage: a legacy all-zero or
  // non-numeric document scored every page 0 here, and normally in the app.
  return normalizeAuditSettings(snap.data());
}

export async function saveCloudSettings(uid: string, s: Settings): Promise<void> {
  const { db, doc, setDoc } = await firestoreSdk();
  await setDoc(doc(db, 'users', uid, 'settings', 'audit'), s, { merge: true });
}

let started = false;
let suppress = false;
// Only push local edits AFTER the cloud settings for the current user have been pulled, so a
// local/default `settings.set` during startup can't clobber the user's saved cloud rules.
let pulledUid: string | null = null;

export interface SettingsSyncDeps {
  /** Read the user's cloud settings doc; null when they have none yet. */
  load: (uid: string) => Promise<Settings | null>;
  /**
   * Write the store without triggering a push back to the cloud. `persist: false` additionally
   * keeps the value out of chrome.storage, for the isolation reset.
   */
  apply: (s: Settings, opts?: { persist?: boolean }) => void;
}

/**
 * Resolve the settings store for an auth change, and report the uid that pushes are now allowed
 * for (null = push nothing).
 *
 * Reset FIRST, on every auth change including sign-out, exactly as `cloud/plan.ts` does for
 * `cloudIsPro`: without it, user A's scoring rules stay in the store when user B signs in, B's
 * pages are scored with A's rules, and B's first settings edit writes A's whole object into B's
 * cloud doc. Custom scoring is Pro-only and Pro requires sign-in, so a signed-out user loses
 * nothing that was in effect.
 */
export async function syncSettingsForUser(
  u: { uid: string } | null,
  deps: SettingsSyncDeps
): Promise<string | null> {
  // `persist: false` — the reset is an in-memory isolation step, not a user edit. Persisting it
  // destroyed a free user's locally customised rules the first time they signed in.
  deps.apply(DEFAULT_SETTINGS, { persist: false });
  if (!u) return null;
  const cloud = await deps.load(u.uid);
  if (cloud) deps.apply(cloud);
  // No cloud doc: the defaults applied above stand. Never the previous user's values.
  return u.uid;
}

/**
 * Follows auth changes and reports, per change, the uid pushes are allowed for. A pull that lands
 * after a newer auth change is dropped entirely (architecture review 2026-10-26, High 5): an A -> B
 * switch where A's slow load resolved last applied A's rules to B and unlocked pushes for B with
 * them. A failed load leaves pushes off and says so, instead of an unhandled rejection.
 */
export function makeUserFollower(
  deps: SettingsSyncDeps & { onAllowed: (uid: string | null) => void; onLoadError?: (err: unknown) => void },
): (u: { uid: string } | null) => Promise<void> {
  let generation = 0;
  return async (u) => {
    const mine = ++generation;
    deps.onAllowed(null); // block pushes until this user's pull resolves
    try {
      const uid = await syncSettingsForUser(u, {
        load: deps.load,
        apply: (s, opts) => {
          if (mine === generation) deps.apply(s, opts);
        },
      });
      if (mine === generation) deps.onAllowed(uid);
    } catch (err) {
      if (mine === generation) deps.onLoadError?.(err);
    }
  };
}

export function initCloudSettingsSync(): void {
  if (started) return;
  started = true;

  const apply = (s: Settings, opts: { persist?: boolean } = {}): void => {
    suppress = true;
    try {
      if (opts.persist === false) applySettingsWithoutPersisting(s);
      else settings.set(s);
    } finally {
      // try/finally, not bare assignment: a throwing subscriber used to latch pushes off for the
      // rest of the session.
      suppress = false;
    }
  };

  const follow = makeUserFollower({
    load: loadCloudSettings,
    apply,
    onAllowed: (uid) => (pulledUid = uid),
    onLoadError: (err) => {
      report(err, 'cloud.settings-load');
      toast("Couldn't load your scoring rules from your account. Edits stay on this device until you reopen Metaspry.", 'error');
    },
  });
  cloudUser.subscribe((u) => void follow(u));

  settings.subscribe((s) => {
    const u = get(cloudUser);
    // A failed push used to be swallowed while the drawer said "saved" (UX review item 1). A change
    // that came from another surface was already pushed there.
    if (u && !suppress && !settingsChangeIsExternal() && pulledUid === u.uid) {
      void saveCloudSettings(u.uid, s).catch((err) => {
        report(err, 'cloud.settings-save');
        toast("Scoring rules saved on this device, but couldn't sync to your account. Save again to retry.", 'error');
      });
    }
  });
}
