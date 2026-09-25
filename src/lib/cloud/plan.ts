/**
 * Cloud plan awareness for the extension. Reads the signed-in user's plan from `users/{uid}`
 * (same doc the web app + billing webhook use) and exposes a reactive `cloudIsPro` store.
 * Used to gate Pro-only extension features (custom scoring) + drive the upsell.
 *
 * `cloudIsPro` is the personal plan only: `users/{uid}.plan` is 'free' | 'pro'. Workspace plans
 * reach scoring through `workspaceRules` (workspace-scoring.ts): an entitled sync target scores with
 * that workspace's rules, whatever the personal plan.
 */
import { writable, derived } from "svelte/store";
import { doc, onSnapshot } from "firebase/firestore";
import { fbDb } from "./firebase";
import { cloudUser } from "./auth";
import { settings, DEFAULT_SETTINGS } from "../storage/settings";
import type { Settings } from "../storage/settings";
import { workspaceRules, resolveEffectiveSettings } from "./workspace-scoring";

/** Where the extension sends users to upgrade. */
export const APP_URL = "https://app.metaspry.com";

export const cloudIsPro = writable(false);

/**
 * Settings actually applied to scoring: the sync target workspace's rules when that workspace is
 * entitled (R-39), else the personal custom rules for a personal Pro, else DEFAULT_SETTINGS.
 * Personal custom settings are retained (not deleted) so they re-apply once Pro returns.
 * ALL audit/score call sites MUST read this, never the raw `settings` store.
 */
export const effectiveSettings = derived<[typeof settings, typeof cloudIsPro, typeof workspaceRules], Settings>(
  [settings, cloudIsPro, workspaceRules],
  ([$settings, $isPro, $ws]) => resolveEffectiveSettings($settings, $isPro, $ws),
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
