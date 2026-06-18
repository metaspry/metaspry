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
export function initCloudSettingsSync(): void {
  if (started) return;
  started = true;

  cloudUser.subscribe(async (u) => {
    if (!u) return;
    const cloud = await loadCloudSettings(u.uid);
    if (cloud) {
      suppress = true;
      settings.set(cloud);
      suppress = false;
    }
  });

  settings.subscribe((s) => {
    const u = get(cloudUser);
    if (u && !suppress) void saveCloudSettings(u.uid, s).catch(() => {});
  });
}
