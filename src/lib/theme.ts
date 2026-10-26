import { writable } from 'svelte/store';
import { persisted } from './storage/persisted';

export type Theme = 'light' | 'dark';

const DEFAULT_THEME: Theme = 'light';

/** Read synchronously by static/scripts/boot.js before first paint. */
export const THEME_MIRROR_KEY = 'metaspry:theme';

// Starts from what boot.js already applied, so the toggle is right on the first frame too.
export const theme = writable<Theme>(
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : DEFAULT_THEME,
);

function applyClass(next: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (next === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  try {
    localStorage.setItem(THEME_MIRROR_KEY, next);
  } catch {
    /* storage blocked: boot.js falls back to the OS preference */
  }
}

function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return DEFAULT_THEME;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** A stored choice; anything else is "no choice" (follow the OS on load, ignore as a change). */
export function parseTheme(raw: unknown): Theme | undefined {
  return raw === 'dark' || raw === 'light' ? raw : undefined;
}

// Theme is written by toggleTheme only (a user action), so there is no store write to suppress.
const backing = persisted<Theme>(
  {
    key: 'theme',
    fallback: systemTheme,
    parse: parseTheme,
    write: 'explicit',
    onInit: (store) => store.subscribe(applyClass),
  },
  theme,
);

export const initTheme = backing.init;

export function toggleTheme(): void {
  theme.update((current) => {
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    backing.write(next);
    return next;
  });
}
