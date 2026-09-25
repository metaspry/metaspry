/**
 * The header toolbar's shared button style, so the History trigger (its own component) and the
 * buttons in `Extension.svelte` cannot drift apart.
 */
const BASE =
  'flex h-8 w-8 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40';
const IDLE =
  'text-slate-600 hover:bg-slate-900/5 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-indigo-300';
const ACTIVE = 'bg-slate-900/5 text-indigo-600 dark:bg-white/10 dark:text-indigo-300';

/** @param active true while the button's dropdown or sheet is open (or the toggle is on). */
export function toolbarButtonClass(active = false): string {
  return `${BASE} ${active ? ACTIVE : IDLE}`;
}

/** The container that groups the buttons: one border for the whole row instead of one per button. */
export const TOOLBAR_GROUP =
  'inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-slate-200/70 bg-white/70 p-0.5 backdrop-blur-md dark:border-white/10 dark:bg-white/5';
