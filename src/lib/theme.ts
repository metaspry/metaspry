import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const DEFAULT_THEME: Theme = 'light';

export const theme = writable<Theme>(DEFAULT_THEME);

function applyClass(next: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (next === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return DEFAULT_THEME;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStorage(): Promise<Theme> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve(systemTheme());
      return;
    }
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY];
      if (stored === 'dark') resolve('dark');
      else if (stored === 'light') resolve('light');
      else resolve(systemTheme());
    });
  });
}

function writeStorage(next: Theme): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.set({ [STORAGE_KEY]: next });
}

export async function initTheme(): Promise<void> {
  const initial = await readStorage();
  applyClass(initial);
  theme.set(initial);
  theme.subscribe(applyClass);
}

export function toggleTheme(): void {
  theme.update((current) => {
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    writeStorage(next);
    return next;
  });
}
