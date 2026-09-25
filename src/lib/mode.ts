import { get, writable } from 'svelte/store';
import { watchKey } from './storage/watch';

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
  // Mode is written by setMode only, so there is no write to suppress here.
  watchKey(STORAGE_KEY, (raw) => {
    mode.set(raw === 'popup' ? 'popup' : 'sidepanel');
  });
}

export function setMode(next: Mode): void {
  mode.update((current) => {
    if (current === next) return current;
    writeStorage(next);
    return next;
  });
}

/**
 * Switch surfaces from a click handler (Settings -> Preferences, and the popup note). Lives here,
 * not in a component, so more than one control can offer it.
 *
 * The click that fired this is a valid user gesture. `chrome.action.openPopup` and
 * `chrome.sidePanel.open` MUST be called synchronously, before any await, or Chrome drops the
 * gesture and rejects with "must be called in response to a user gesture".
 */
export function switchMode(next: Mode): void {
  if (next === get(mode)) return;

  if (typeof chrome !== 'undefined' && chrome.action) {
    try {
      if (next === 'popup') {
        chrome.action.openPopup().catch((err) => {
          if (import.meta.env.DEV) console.warn('openPopup:', err);
        });
      } else {
        chrome.windows.getCurrent().then((win) => {
          if (win?.id != null) {
            chrome.sidePanel.open({ windowId: win.id }).catch((err) => {
              if (import.meta.env.DEV) console.warn('sidePanel.open:', err);
            });
          }
        });
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn('switchMode open failed:', err);
    }
  }

  // Persist the new mode so the background script updates the action behaviour.
  setMode(next);

  // Close the surface we were in. window.close() works for the popup; the side panel does not
  // always honour it, but it is safe to call.
  setTimeout(() => {
    try {
      window.close();
    } catch {
      /* ignore */
    }
  }, 50);
}
