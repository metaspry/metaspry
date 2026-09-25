import { writable } from 'svelte/store';
import { makeWriteGuard, watchKey } from './watch';

/**
 * Settings > Preferences > "Single-key shortcuts" (WCAG 2.1.4). `true` (the default) keeps `/`,
 * `r` and `1`-`6` live; `false` leaves only `?` (help) and `Esc`, so speech input or a stray key
 * cannot rescan or switch tabs.
 */
const STORAGE_KEY = 'shortcuts';

export const shortcutsEnabled = writable<boolean>(true);

/** Anything but an explicit `false` means on: a missing or corrupt value keeps today's behaviour. */
export function parseShortcutsPref(raw: unknown): boolean {
  return raw !== false;
}

function readStorage(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve(true);
      return;
    }
    chrome.storage.local.get(STORAGE_KEY, (result) => resolve(parseShortcutsPref(result[STORAGE_KEY])));
  });
}

const guard = makeWriteGuard();

function writeStorage(next: boolean): void {
  if (guard.suppressed) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.set({ [STORAGE_KEY]: next });
}

export async function initShortcutsPref(): Promise<void> {
  const initial = await readStorage();
  shortcutsEnabled.set(initial);
  shortcutsEnabled.subscribe(writeStorage);
  watchKey(STORAGE_KEY, (raw) => guard.applyExternal(() => shortcutsEnabled.set(parseShortcutsPref(raw))));
}

export function setShortcutsEnabled(on: boolean): void {
  shortcutsEnabled.set(on);
}
