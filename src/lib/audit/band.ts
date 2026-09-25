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
  /** `currentColor` stroke for an SVG ring. */
  stroke: string;
}

const CLASSES: Record<Band, BandClasses> = {
  good: {
    text: 'text-emerald-600 dark:text-emerald-400',
    chip: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    stroke: 'text-emerald-500 dark:text-emerald-400',
  },
  warn: {
    text: 'text-amber-600 dark:text-amber-400',
    chip: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    stroke: 'text-amber-500 dark:text-amber-400',
  },
  fail: {
    text: 'text-rose-600 dark:text-rose-400',
    chip: 'bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
    stroke: 'text-rose-500 dark:text-rose-400',
  },
};

export function bandClasses(band: Band): BandClasses {
  return CLASSES[band];
}
