import { writable } from 'svelte/store';

const STORAGE_KEY = 'pinnedKeys';

export const pinned = writable<Set<string>>(new Set());

function readStorage(): Promise<Set<string>> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve(new Set());
      return;
    }
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY];
      if (Array.isArray(stored)) {
        resolve(new Set(stored.map((s) => String(s).toLowerCase())));
      } else {
        resolve(new Set());
      }
    });
  });
}

function writeStorage(next: Set<string>): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.set({ [STORAGE_KEY]: Array.from(next) });
}

export async function initPinned(): Promise<void> {
  const initial = await readStorage();
  pinned.set(initial);
  pinned.subscribe(writeStorage);
}

export function togglePinned(key: string): void {
  const lower = key.toLowerCase();
  pinned.update((set) => {
    const next = new Set(set);
    if (next.has(lower)) next.delete(lower);
    else next.add(lower);
    return next;
  });
}

export function isPinned(set: Set<string>, key: string): boolean {
  return set.has(key.toLowerCase());
}
