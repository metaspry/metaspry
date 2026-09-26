import { FOCUS_RING } from './toolbar';

/**
 * The shell's two text-button looks (K-18), so the header, the sign-in popover, Settings and the
 * landing states stop re-rolling their own (a 36 px rounded-xl here, a 28 px pill there). 36 px tall at
 * 100 % text, grows with the text (`min-h`, never a fixed `h`), 12 px semibold, `rounded-xl`.
 *
 * Primary is the brand fill: white on indigo-600 6.3:1, and hover goes DARKER (indigo-700), because
 * white 12 px text on the old indigo-500 hover measured 4.47:1. Use one primary per view.
 */
const SHAPE = `inline-flex min-h-[2.25rem] items-center justify-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;

export const BUTTON_PRIMARY = `${SHAPE} bg-indigo-600 text-white shadow-sm shadow-indigo-500/30 hover:bg-indigo-700 disabled:hover:bg-indigo-600`;

/** Neutral outline: slate-500 edge (4.76:1 on white) so it reads as a button on the glass. */
export const BUTTON_SECONDARY = `${SHAPE} border border-slate-500 bg-white/70 text-slate-800 hover:bg-white disabled:hover:bg-white/70 dark:border-slate-400 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10 dark:disabled:hover:bg-white/5`;

/** Destructive confirm ("Yes, reset"): white on rose-600 4.7:1, hover rose-700 (rose-500 was 3.67:1). */
export const BUTTON_DANGER = `${SHAPE} bg-rose-600 text-white hover:bg-rose-700`;
