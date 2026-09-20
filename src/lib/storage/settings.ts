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

function readStorage(): Promise<Settings> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve(DEFAULT_SETTINGS);
      return;
    }
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY] as Partial<Settings> | undefined;
      if (!stored) {
        resolve(DEFAULT_SETTINGS);
        return;
      }
      resolve({
        ...DEFAULT_SETTINGS,
        ...stored,
        weights: { ...DEFAULT_SETTINGS.weights, ...(stored.weights ?? {}) },
      });
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
    const stored = (raw ?? undefined) as Partial<Settings> | undefined;
    const next: Settings = stored
      ? {
          ...DEFAULT_SETTINGS,
          ...stored,
          weights: { ...DEFAULT_SETTINGS.weights, ...(stored.weights ?? {}) },
        }
      : DEFAULT_SETTINGS;
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
