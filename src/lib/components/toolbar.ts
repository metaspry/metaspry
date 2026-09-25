/**
 * The header toolbar's shared button style, so the History trigger (its own component) and the
 * buttons in `Extension.svelte` cannot drift apart. `FOCUS_RING` is the one keyboard focus ring for
 * every button and link in the shell.
 */

/**
 * `:focus-visible` ring for standalone controls: solid indigo-600 (indigo-300 in dark), 2 px, with a
 * transparent 2 px offset so it reads as a 4 px ring flush to the control on any surface. Both
 * measure well over the 3:1 WCAG 2.4.13 minimum (the old `ring-indigo-500/40` blended to ~1.7:1).
 * Mirrors the web app's `focus-visible:ring-2 … ring-offset-2 ring-offset-transparent`.
 */
export const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:focus-visible:ring-indigo-300';

/** The same ring drawn inside the edge, for full-bleed rows inside a clipped panel (History rows). */
export const FOCUS_RING_INSET =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-300';

const BASE = `flex h-8 w-8 items-center justify-center rounded-lg transition ${FOCUS_RING}`;
const IDLE =
  'text-slate-600 hover:bg-slate-900/5 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-indigo-300';
const ACTIVE = 'bg-slate-900/5 text-indigo-600 dark:bg-white/10 dark:text-indigo-300';

/** @param active true while the button's dropdown or sheet is open (or the toggle is on). */
export function toolbarButtonClass(active = false): string {
  return `${BASE} ${active ? ACTIVE : IDLE}`;
}

/**
 * The container that groups the buttons: one border for the whole row instead of one per button.
 *
 * No `backdrop-blur` / `filter` / `transform` here: any of them makes this element the containing
 * block and a stacking context for the History menu inside it, so the menu anchors to the group
 * instead of the header block and is painted under later glass cards (the landing tile, Tabs).
 */
export const TOOLBAR_GROUP =
  'inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-slate-200/70 bg-white/70 p-0.5 dark:border-white/10 dark:bg-white/5';
