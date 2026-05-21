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
    if (event.key === '/') {
      handlers.focusSearch?.();
      event.preventDefault();
    } else if (event.key === '?' || (event.shiftKey && event.key === '/')) {
      helpOpen.update((v) => !v);
      event.preventDefault();
    } else if (event.key === 'r' || event.key === 'R') {
      handlers.rescrape?.();
      event.preventDefault();
    } else if (event.key >= '1' && event.key <= '5') {
      const idx = Number(event.key) - 1;
      handlers.selectTab?.(idx);
      event.preventDefault();
    }
  }
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
