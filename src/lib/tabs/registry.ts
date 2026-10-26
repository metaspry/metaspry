/**
 * The results tabs, in order: the one list the tab strip, the digit shortcuts, the shortcuts help
 * and the Settings hint read (architecture review 2026-10-26, High 6). It was written out in six
 * places (the `tabs` array, the `ActiveTab` union and its guard in Extension.svelte, `key <= '6'`
 * in keyboard.ts, the help row, the Settings hint), so adding a tab meant finding them all.
 *
 * Adding a tab: add it here, then render its panel in Extension.svelte (the `{#if visited.has(...)}`
 * blocks; a panel's component and props differ per tab, so they stay there).
 */
export const RESULT_TABS = [
  { id: 'tags', label: 'Tags' },
  { id: 'previews', label: 'Previews' },
  { id: 'audit', label: 'Audit' },
  { id: 'site', label: 'Site' },
  { id: 'aeo', label: 'AI' },
  { id: 'compare', label: 'Compare' },
] as const;

export type ResultTabId = (typeof RESULT_TABS)[number]['id'];

export function isResultTab(v: string): v is ResultTabId {
  return RESULT_TABS.some((t) => t.id === v);
}

/** Digit shortcuts reach the first nine tabs at most (`1`-`9`). */
export const DIGIT_TABS = Math.min(9, RESULT_TABS.length);

/** "1 – 6" for the shortcuts help. */
export const DIGIT_RANGE = `1 – ${DIGIT_TABS}`;

/** "Tags / Previews / Audit / Site / AI / Compare". */
export const TAB_NAMES = RESULT_TABS.slice(0, DIGIT_TABS)
  .map((t) => t.label)
  .join(' / ');
