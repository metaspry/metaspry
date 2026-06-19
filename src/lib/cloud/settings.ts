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

export function initCloudSettingsSync(): void {
  if (started) return;
  started = true;

  cloudUser.subscribe(async (u) => {
    if (!u) {
      pulledUid = null;
      return;
    }
    pulledUid = null; // block pushes until this user's pull resolves
    const cloud = await loadCloudSettings(u.uid);
    if (cloud) {
      suppress = true;
      settings.set(cloud);
      suppress = false;
    }
    pulledUid = u.uid;
  });

  settings.subscribe((s) => {
    const u = get(cloudUser);
    if (u && !suppress && pulledUid === u.uid) void saveCloudSettings(u.uid, s).catch(() => {});
  });
}
