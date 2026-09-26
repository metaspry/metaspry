/**
 * The header toolbar's shared button style, so the History trigger (its own component) and the
 * buttons in `Extension.svelte` cannot drift apart. `FOCUS_RING` is the one keyboard focus ring for
 * every button and link in the shell.
 */

/**
 * Forced colors (R-26): the ring is a box-shadow, which Windows contrast themes drop. `focus:outline-none`
 * is Tailwind 3's `outline: 2px solid transparent; outline-offset: 2px`, which forced colors repaints
 * in a system colour, and `app.css` makes it explicit (`outline: 2px solid Highlight` on
 * `:focus-visible` under `@media (forced-colors: active)`). Never swap it for `outline: none`.
 *
 * `:focus-visible` ring for standalone controls: solid indigo-600 (indigo-300 in dark), 2 px, with a
 * transparent 2 px offset so it reads as a 4 px ring flush to the control on any surface. Both
 * measure well over the 3:1 WCAG 2.4.13 minimum (the old `ring-indigo-500/40` blended to ~1.7:1).
 * Mirrors the web app's `focus-visible:ring-2 … ring-offset-2 ring-offset-transparent`.
 */
const RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:focus-visible:ring-indigo-300';

export const FOCUS_RING = `${RING} focus-visible:ring-offset-transparent`;

/**
 * The ring for a control with a brand (or danger) FILL: "Scan this page", Re-scan, Retry, Compare,
 * `BUTTON_PRIMARY` / `BUTTON_DANGER`, the category chips (the picked one is a fill). With a transparent offset the
 * indigo-600 ring touched the indigo-600 fill and read as a 4 px bigger button (1.00:1, R3-22), so
 * here the 2 px offset band is page-coloured - white in light, slate-950 in dark - and fill, gap and
 * ring stay three shapes. Mirrors the web app's brand-fill rule (`ring-offset-white
 * dark:ring-offset-slate-950`). Never combine it with `FOCUS_RING` on one element.
 */
export const FOCUS_RING_ON_FILL = `${RING} focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950`;

/** The same ring drawn inside the edge, for full-bleed rows inside a clipped panel (History rows). */
export const FOCUS_RING_INSET =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 dark:focus-visible:ring-indigo-300';

const BASE = `flex h-8 w-8 items-center justify-center rounded-lg transition ${FOCUS_RING}`;
// Hover and "open / on" must not look alike (V2-08): hover is a neutral wash with darker ink, the active
// state is a brand tint with brand ink. They were the same classes, so a button still under the pointer
// after its menu closed looked open.
const IDLE =
  'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white';
const ACTIVE = 'bg-indigo-600/10 text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-200';

/** @param active true while the button's dropdown or sheet is open (or the toggle is on). */
export function toolbarButtonClass(active = false): string {
  return `${BASE} ${active ? ACTIVE : IDLE}`;
}

/**
 * The container that groups the buttons: one border for the whole row instead of one per button.
 * It may wrap (R2-16): at 200 % text in a 320 px panel four 64 px buttons do not fit on one line, and
 * a control pushed past the edge cannot be reached (nothing scrolls sideways).
 *
 * No `backdrop-blur` / `filter` / `transform` here: any of them makes this element the containing
 * block and a stacking context for the History menu inside it, so the menu anchors to the group
 * instead of the header block and is painted under later glass cards (the landing tile, Tabs).
 */
export const TOOLBAR_GROUP =
  'inline-flex max-w-full flex-wrap items-center justify-end gap-0.5 rounded-xl border border-slate-200/70 bg-white/70 p-0.5 dark:border-white/10 dark:bg-white/5';
