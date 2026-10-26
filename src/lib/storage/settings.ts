import { writable } from 'svelte/store';
import { makeWriteGuard, watchKey } from './watch';

export interface RuleWeights {
  required: number;
  recommended: number;
  'best-practice': number;
}

export interface Settings {
  titleMin: number;
  titleMax: number;
  descMin: number;
  descMax: number;
  ogDescMin: number;
  ogDescMax: number;
  weights: RuleWeights;
}

export const DEFAULT_SETTINGS: Settings = {
  titleMin: 30,
  titleMax: 60,
  descMin: 70,
  descMax: 160,
  ogDescMin: 50,
  ogDescMax: 200,
  weights: { required: 10, recommended: 5, 'best-practice': 3 },
};

const STORAGE_KEY = 'settings';

export const settings = writable<Settings>(DEFAULT_SETTINGS);

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);

/**
 * The one way a stored settings value (chrome.storage, the personal or a workspace cloud document)
 * becomes `Settings` (architecture review 2026-10-26, Medium 10). It used to be four different
 * spreads, and only the workspace path checked the values: an all-zero or non-numeric legacy
 * document scored every page 0 here and normally in the app. Anything non-numeric or negative falls
 * back to the default; all-zero weights fall back to the default weights, like the app's
 * `mergeAuditSettings` and the server's `sanitizeSettings` (`contract/settings-normalize.json`).
 */
export function normalizeAuditSettings(raw: unknown): Settings {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const w = (d.weights && typeof d.weights === 'object' ? d.weights : {}) as Record<string, unknown>;
  const weights = {
    required: num(w.required, DEFAULT_SETTINGS.weights.required),
    recommended: num(w.recommended, DEFAULT_SETTINGS.weights.recommended),
    'best-practice': num(w['best-practice'], DEFAULT_SETTINGS.weights['best-practice']),
  };
  const allZero = weights.required + weights.recommended + weights['best-practice'] <= 0;
  return {
    titleMin: num(d.titleMin, DEFAULT_SETTINGS.titleMin),
    titleMax: num(d.titleMax, DEFAULT_SETTINGS.titleMax),
    descMin: num(d.descMin, DEFAULT_SETTINGS.descMin),
    descMax: num(d.descMax, DEFAULT_SETTINGS.descMax),
    ogDescMin: num(d.ogDescMin, DEFAULT_SETTINGS.ogDescMin),
    ogDescMax: num(d.ogDescMax, DEFAULT_SETTINGS.ogDescMax),
    weights: allZero ? { ...DEFAULT_SETTINGS.weights } : weights,
  };
}

function readStorage(): Promise<Settings> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve(DEFAULT_SETTINGS);
      return;
    }
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY];
      resolve(stored ? normalizeAuditSettings(stored) : DEFAULT_SETTINGS);
    });
  });
}

const guard = makeWriteGuard();

/**
 * Apply a value to the settings store WITHOUT persisting it to chrome.storage.
 *
 * The cloud sync resets the store to the defaults on every auth change so one account's scoring
 * rules can never score another's. That reset must not reach storage: a free user who customised
 * locally and then signed in for the first time had their local copy overwritten with the defaults
 * before the (absent) cloud document could restore anything, losing the customisation from both
 * sides.
 */
export function applySettingsWithoutPersisting(next: Settings): void {
  guard.applyExternal(() => settings.set(next));
}

/**
 * True while the store is being set from outside this surface's own edits: another surface's
 * write (the watch) or the cloud pull. The cloud push must not fire then (architecture review
 * 2026-10-26, High 5): every open surface used to re-upload the edit the other surface had already
 * pushed.
 */
export function settingsChangeIsExternal(): boolean {
  return guard.suppressed;
}

function writeStorage(next: Settings): void {
  if (guard.suppressed) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.set({ [STORAGE_KEY]: next });
}

export async function initSettings(): Promise<void> {
  const initial = await readStorage();
  settings.set(initial);
  settings.subscribe(writeStorage);
  watchKey(STORAGE_KEY, (raw) => {
    const next = raw ? normalizeAuditSettings(raw) : DEFAULT_SETTINGS;
    guard.applyExternal(() => settings.set(next));
  });
}

export function updateSettings(patch: Partial<Settings>): void {
  settings.update((current) => ({
    ...current,
    ...patch,
    weights: { ...current.weights, ...(patch.weights ?? {}) },
  }));
}

export function resetSettings(): void {
  settings.set(DEFAULT_SETTINGS);
}
