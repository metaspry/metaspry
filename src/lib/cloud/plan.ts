/**
 * Cloud plan awareness for the extension. Reads the signed-in user's plan from `users/{uid}`
 * (same doc the web app + billing webhook use) and exposes a reactive `cloudIsPro` store.
 * Used to gate Pro-only extension features (custom scoring) + drive the upsell.
 *
 * Personal Pro only: `users/{uid}.plan` is 'free' | 'pro' (Team is workspace-scoped, not here).
 */
import { writable, derived } from "svelte/store";
import { doc, onSnapshot } from "firebase/firestore";
import { fbDb } from "./firebase";
import { cloudUser } from "./auth";
import { settings, DEFAULT_SETTINGS } from "../storage/settings";
import type { Settings } from "../storage/settings";

/** Where the extension sends users to upgrade. */
export const APP_URL = "https://app.metaspry.com";

export const cloudIsPro = writable(false);

/**
 * Settings actually applied to scoring. Custom scoring is Pro-only: non-Pro users (and downgraded
 * users) always score with DEFAULT_SETTINGS regardless of any persisted custom thresholds/weights.
 * The custom settings are retained (not deleted) so they re-apply automatically once Pro returns.
 * ALL audit/score call sites MUST read this, never the raw `settings` store.
 */
export const effectiveSettings = derived<[typeof settings, typeof cloudIsPro], Settings>(
  [settings, cloudIsPro],
  ([$settings, $isPro]) => ($isPro ? $settings : DEFAULT_SETTINGS),
);

let started = false;
let unsub: (() => void) | null = null;

export function initCloudPlan(): void {
  if (started) return;
  started = true;
  cloudUser.subscribe((u) => {
    unsub?.();
    unsub = null;
    // Reset on ANY auth change (incl. switching directly from one account to another) so a previous
    // user's Pro status never lingers; re-set to true only when the new user's snapshot resolves.
    cloudIsPro.set(false);
    if (!u) return;
    unsub = onSnapshot(
      doc(fbDb(), "users", u.uid),
      (snap) => cloudIsPro.set(snap.data()?.plan === "pro"),
      () => cloudIsPro.set(false),
    );
  });
}
