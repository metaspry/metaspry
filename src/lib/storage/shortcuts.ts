import { persisted } from './persisted';

/**
 * Settings > Preferences > "Single-key shortcuts" (WCAG 2.1.4). `true` (the default) keeps `/`,
 * `r` and `1`-`6` live; `false` leaves only `?` (help) and `Esc`, so speech input or a stray key
 * cannot rescan or switch tabs.
 */

/** Anything but an explicit `false` means on: a missing or corrupt value keeps today's behaviour. */
export function parseShortcutsPref(raw: unknown): boolean {
  return raw !== false;
}

const backing = persisted<boolean>({
  key: 'shortcuts',
  fallback: () => true,
  parse: parseShortcutsPref,
  write: 'on-change',
});

export const shortcutsEnabled = backing.store;

export const initShortcutsPref = backing.init;

export function setShortcutsEnabled(on: boolean): void {
  shortcutsEnabled.set(on);
}
