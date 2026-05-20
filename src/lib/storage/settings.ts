import { writable } from 'svelte/store';

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

function writeStorage(next: Settings): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.set({ [STORAGE_KEY]: next });
}

export async function initSettings(): Promise<void> {
  const initial = await readStorage();
  settings.set(initial);
  settings.subscribe(writeStorage);
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
