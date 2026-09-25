import { writable, get } from 'svelte/store';
import { shortcutsEnabled } from '../../storage/shortcuts';

export interface ShortcutEvents {
  focusSearch?: () => void;
  selectTab?: (idx: number) => void;
  rescan?: () => void;
  toggleHelp?: () => void;
}

export const helpOpen = writable(false);

let handlers: ShortcutEvents = {};

export function registerShortcuts(next: ShortcutEvents): void {
  handlers = next;
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export type ShortcutAction = { kind: 'search' } | { kind: 'help' } | { kind: 'rescan' } | { kind: 'tab'; index: number };

/**
 * Which action a key press maps to, or null. With single-key shortcuts turned off (Settings >
 * Preferences, WCAG 2.1.4) only `?` still works; `Esc` is handled by each open layer, not here.
 */
export function shortcutFor(key: string, shiftKey: boolean, enabled: boolean): ShortcutAction | null {
  if (key === '?' || (shiftKey && key === '/')) return { kind: 'help' };
  if (!enabled) return null;
  if (key === '/') return { kind: 'search' };
  if (key === 'r' || key === 'R') return { kind: 'rescan' };
  // Six tabs (Tags, Previews, Audit, Site, AI, Compare).
  if (key.length === 1 && key >= '1' && key <= '6') return { kind: 'tab', index: Number(key) - 1 };
  return null;
}

export function attachShortcuts(): () => void {
  function onKey(event: KeyboardEvent) {
    if (isEditable(event.target)) return;
    // Without this, Ctrl+R rescanned instead of reloading and Ctrl+1 switched OUR tab instead of
    // the browser's — every shortcut fired on the modified chord too.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const action = shortcutFor(event.key, event.shiftKey, get(shortcutsEnabled));
    if (!action) return;
    event.preventDefault();
    if (action.kind === 'help') helpOpen.update((v) => !v);
    else if (action.kind === 'search') handlers.focusSearch?.();
    else if (action.kind === 'rescan') handlers.rescan?.();
    else handlers.selectTab?.(action.index);
  }
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
