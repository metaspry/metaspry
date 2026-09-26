/**
 * The one place a score becomes a band, a label and colour classes. `rules.ts` keeps its internal
 * `success | warning | danger` names for rule results; every score DISPLAY (History chip, Audit
 * ring, Compare numbers) goes through here so the hues and the 80 / 50 cut-offs cannot drift, and
 * so they match the web app's `bandForScore` / `bandLabel`.
 */
export type Band = 'good' | 'warn' | 'fail';

export function bandFor(score: number): Band {
  if (score >= 80) return 'good';
  if (score >= 50) return 'warn';
  return 'fail';
}

/** The legend words, shared with the web app. */
export function bandLabel(band: Band): 'healthy' | 'needs work' | 'failing' {
  return band === 'good' ? 'healthy' : band === 'warn' ? 'needs work' : 'failing';
}

/** Accessible name for any rendered score. Band and number come from the same rounded value. */
export function scoreLabel(score: number): string {
  const n = Math.max(0, Math.min(100, Math.round(score)));
  return `Score ${n} of 100, ${bandLabel(bandFor(n))}`;
}

export interface BandClasses {
  /** Coloured text, e.g. a number. */
  text: string;
  /** Pill background + text for a chip. */
  chip: string;
  /** `currentColor` stroke for an SVG ring or a status icon (graphics, 3:1). */
  stroke: string;
  /** Background of a status mark: a length bar, an AI-check dot (graphics, 3:1). */
  fill: string;
  /** Small status text (12 px notes like the sitemap warnings, 4.5:1). */
  ink: string;
}

/** A rule or check result that carries a verdict (not `pending` / `info`). */
export type Verdict = 'pass' | 'warn' | 'fail';

/** The band a rule or check result is drawn in: pass -> good, warn -> warn, fail -> fail. */
export function bandForVerdict(verdict: Verdict): Band {
  return verdict === 'pass' ? 'good' : verdict;
}

// Light mode uses -600 / -700 hues, matching the web app: on the light Screen (#ecf1ff) the old -500
// strokes measured emerald 2.25, amber 1.90, rose 3.25 (WCAG 1.4.11 needs 3:1); emerald-600 3.34,
// amber-700 4.45, rose-600 4.16. Dark keeps -400 / -300. `text` is only used for the 18 px bold
// Compare numbers (large text, 3:1). `stroke` / `fill` are the result views' marks (Audit rule icons,
// CharBar, AI dots, the pin): the -500 steps they used measured 1.90-2.25:1 on the light card (R2-29).
// `ink` is small text: -700 (-800 for amber: amber-700 is 4.45 on the card).
// `chip` is the web app's `ms-badge-*` (R3-23): the band's own fill at 15 % with -800 text in light,
// because 10-11 px -700 text on a -500/20 pill measured 4.09 / 3.88 / 4.33 on the light Screen.
// Amber takes -900: -800 read 5.76 at rest but 4.30 on a hovered History row (indigo-500/25 under it).
// `/[.15]`, never `/15`: Tailwind 3's default opacity scale has no 15, so `bg-*/15` silently
// compiles to nothing (the chips once rendered with no pill in light mode).
const CLASSES: Record<Band, BandClasses> = {
  good: {
    text: 'text-emerald-600 dark:text-emerald-400',
    chip: 'bg-emerald-600/[.15] text-emerald-800 dark:bg-emerald-400/[.15] dark:text-emerald-300',
    stroke: 'text-emerald-600 dark:text-emerald-400',
    fill: 'bg-emerald-600 dark:bg-emerald-400',
    ink: 'text-emerald-700 dark:text-emerald-300',
  },
  warn: {
    text: 'text-amber-700 dark:text-amber-400',
    chip: 'bg-amber-700/[.15] text-amber-900 dark:bg-amber-400/[.15] dark:text-amber-300',
    stroke: 'text-amber-700 dark:text-amber-400',
    fill: 'bg-amber-700 dark:bg-amber-400',
    ink: 'text-amber-800 dark:text-amber-300',
  },
  fail: {
    text: 'text-rose-600 dark:text-rose-400',
    chip: 'bg-rose-600/[.15] text-rose-800 dark:bg-rose-400/[.15] dark:text-rose-300',
    stroke: 'text-rose-600 dark:text-rose-400',
    fill: 'bg-rose-600 dark:bg-rose-400',
    ink: 'text-rose-700 dark:text-rose-300',
  },
};

/** A chip with no verdict ("Not present"): the web app's `ms-badge-neutral`. */
export const CHIP_NEUTRAL = 'bg-slate-500/10 text-slate-600 dark:bg-white/10 dark:text-slate-300';

export function bandClasses(band: Band): BandClasses {
  return CLASSES[band];
}
