import { get, writable } from 'svelte/store';
import { watchKey } from './storage/watch';
import { toast } from './components/Toast/toast';

export type Mode = 'sidepanel' | 'popup';

const STORAGE_KEY = 'mode';
const DEFAULT_MODE: Mode = 'sidepanel';

/** Read synchronously by static/scripts/boot.js before first paint. */
export const MODE_MIRROR_KEY = 'metaspry:mode';

export const mode = writable<Mode>(
  typeof document !== 'undefined' && document.documentElement.dataset.mode === 'popup' ? 'popup' : DEFAULT_MODE,
);

function applyAttr(next: Mode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.mode = next;
  try {
    localStorage.setItem(MODE_MIRROR_KEY, next);
  } catch {
    /* storage blocked: boot.js uses the side-panel layout until this runs */
  }
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

function openSurface(next: Mode): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.action) return Promise.reject(new Error('no chrome.action'));
  try {
    // `openPopup` is called synchronously inside the click, as it must be ("in response to a user
    // gesture"): not after an await. The action has no popup in side-panel mode (background.js sets
    // it on the `mode` change, which lands later), so `setPopup` goes first; extension API calls
    // reach the browser in order, so the popup is set by the time `openPopup` runs. The side-panel
    // branch awaits `windows.getCurrent()` first; Chrome has honoured the gesture across that one hop
    // in practice (AGENTS 3.2 gotcha). Either way a failure is handled by `switchMode`.
    if (next === 'popup') {
      void chrome.action.setPopup({ popup: 'index.html' }).catch(() => undefined);
      return Promise.resolve(chrome.action.openPopup());
    }
    return chrome.windows.getCurrent().then((win) => {
      if (win?.id == null) throw new Error('no window');
      return chrome.sidePanel.open({ windowId: win.id });
    });
  } catch (err) {
    return Promise.reject(err);
  }
}

/**
 * Switch surfaces from an explicit button (Settings -> Preferences "Switch to ...", the popup note).
 * Lives here, not in a component, so more than one control can offer it.
 *
 * The current window closes ONLY once the other surface has opened (UX review item 4): it used to
 * close after 50 ms regardless, and when Chrome refused the open (popup before Chrome 127, a lost
 * gesture) the user was left with no Metaspry at all and their results gone. On failure the mode is
 * put back, a toast says why, and the window stays. Resolves true when it switched.
 */
export async function switchMode(next: Mode, closeWindow: () => void = () => window.close()): Promise<boolean> {
  const prev = get(mode);
  if (next === prev) return true;
  const opened = openSurface(next);
  // Persist the new mode so the background script updates the action behaviour.
  setMode(next);
  try {
    await opened;
  } catch (err) {
    if (import.meta.env.DEV) console.warn('switchMode open failed:', err);
    setMode(prev);
    toast(
      next === 'popup'
        ? "Couldn't open the popup (it needs Chrome 127 or later). You're still in the side panel."
        : "Couldn't open the side panel. You're still in the popup.",
      'error',
    );
    return false;
  }
  try {
    closeWindow();
  } catch {
    /* the side panel does not always honour window.close(); harmless */
  }
  return true;
}
