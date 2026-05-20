import { writable } from 'svelte/store';

export type Mode = 'sidepanel' | 'popup';

const STORAGE_KEY = 'mode';
const DEFAULT_MODE: Mode = 'sidepanel';

export const mode = writable<Mode>(DEFAULT_MODE);

function applyAttr(next: Mode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.mode = next;
}

function readStorage(): Promise<Mode> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve(DEFAULT_MODE);
      return;
    }
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY];
      resolve(stored === 'popup' ? 'popup' : 'sidepanel');
    });
  });
}

function writeStorage(next: Mode): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.set({ [STORAGE_KEY]: next });
}

export async function initMode(): Promise<void> {
  const initial = await readStorage();
  applyAttr(initial);
  mode.set(initial);
  mode.subscribe(applyAttr);
}

export function setMode(next: Mode): void {
  mode.update((current) => {
    if (current === next) return current;
    writeStorage(next);
    return next;
  });
}
