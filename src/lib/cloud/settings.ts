/**
 * Two-way sync of the extension's audit settings with the signed-in user's cloud personal
 * settings doc (users/{uid}/settings/audit), so scoring rules match the web app.
 * Cloud wins on sign-in (pull); local edits push. A suppress flag avoids the pull echo.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { get } from 'svelte/store';
import { fbDb } from './firebase';
import { cloudUser } from './auth';
import { settings, DEFAULT_SETTINGS, type Settings } from '../storage/settings';

export async function loadCloudSettings(uid: string): Promise<Settings | null> {
  const snap = await getDoc(doc(fbDb(), 'users', uid, 'settings', 'audit'));
  if (!snap.exists()) return null;
  const d = snap.data() as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...d,
    weights: { ...DEFAULT_SETTINGS.weights, ...(d.weights ?? {}) },
  };
}

export async function saveCloudSettings(uid: string, s: Settings): Promise<void> {
  await setDoc(doc(fbDb(), 'users', uid, 'settings', 'audit'), s, { merge: true });
}

let started = false;
let suppress = false;
// Only push local edits AFTER the cloud settings for the current user have been pulled, so a
// local/default `settings.set` during startup can't clobber the user's saved cloud rules.
let pulledUid: string | null = null;

export interface SettingsSyncDeps {
  /** Read the user's cloud settings doc; null when they have none yet. */
  load: (uid: string) => Promise<Settings | null>;
  /** Write the store without triggering a push back to the cloud. */
  apply: (s: Settings) => void;
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
  deps.apply(DEFAULT_SETTINGS);
  if (!u) return null;
  const cloud = await deps.load(u.uid);
  if (cloud) deps.apply(cloud);
  // No cloud doc: the defaults applied above stand. Never the previous user's values.
  return u.uid;
}

export function initCloudSettingsSync(): void {
  if (started) return;
  started = true;

  const apply = (s: Settings): void => {
    suppress = true;
    settings.set(s);
    suppress = false;
  };

  cloudUser.subscribe(async (u) => {
    pulledUid = null; // block pushes until this user's pull resolves
    pulledUid = await syncSettingsForUser(u, { load: loadCloudSettings, apply });
  });

  settings.subscribe((s) => {
    const u = get(cloudUser);
    if (u && !suppress && pulledUid === u.uid) void saveCloudSettings(u.uid, s).catch(() => {});
  });
}
