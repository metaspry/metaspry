import { writable } from 'svelte/store';

export interface ShortcutEvents {
  focusSearch?: () => void;
  selectTab?: (idx: number) => void;
  rescrape?: () => void;
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

export function attachShortcuts(): () => void {
  function onKey(event: KeyboardEvent) {
    if (isEditable(event.target)) return;
    // Without this, Ctrl+R re-scraped instead of reloading and Ctrl+1 switched OUR tab instead of
    // the browser's — every shortcut fired on the modified chord too.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === '/') {
      handlers.focusSearch?.();
      event.preventDefault();
    } else if (event.key === '?' || (event.shiftKey && event.key === '/')) {
      helpOpen.update((v) => !v);
      event.preventDefault();
    } else if (event.key === 'r' || event.key === 'R') {
      handlers.rescrape?.();
      event.preventDefault();
    } else if (event.key >= '1' && event.key <= '6') {
      // Six tabs (Tags, Previews, Audit, Site, AI, Compare): the range stopped at 5, so Compare
      // was the one view with no shortcut.
      const idx = Number(event.key) - 1;
      handlers.selectTab?.(idx);
      event.preventDefault();
    }
  }
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
