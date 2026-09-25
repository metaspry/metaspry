/**
 * What the Settings drawer must refuse before saving.
 *
 * Modelled on the web app's `validateAuditSettings` (`app/src/lib/firebase/auditSettings.ts`);
 * the two repos cannot share code. Same pair and all-zero rules and the same messages, with one
 * deliberate difference: every value must be a whole number (character counts and points), where
 * the app only requires a finite number >= 0. A decimal saved in the app therefore opens here as
 * invalid until corrected. The old drawer dropped bad values silently, which left a cleared box
 * looking empty while the previous value still scored, and accepted `min > max`. Pure, so the
 * tests cover it without a DOM.
 */
import type { RuleWeights, Settings } from './settings';

export type SettingsField = Exclude<keyof Settings, 'weights'>;

export interface SettingsProblem {
  /** The field to mark, or `weights` for a bad or all-zero weight set. */
  field: SettingsField | 'weights';
  message: string;
}

const LENGTHS: SettingsField[] = ['titleMin', 'titleMax', 'descMin', 'descMax', 'ogDescMin', 'ogDescMax'];

const PAIRS: [SettingsField, SettingsField, string][] = [
  ['titleMin', 'titleMax', 'Title'],
  ['descMin', 'descMax', 'Description'],
  ['ogDescMin', 'ogDescMax', 'og:description'],
];

const WEIGHT_KEYS: (keyof RuleWeights)[] = ['required', 'recommended', 'best-practice'];

/** Thresholds and weights are character counts and points: whole numbers, never negative. */
const bad = (v: unknown): boolean => typeof v !== 'number' || !Number.isInteger(v) || v < 0;

/** Empty array = valid. */
export function validateSettings(s: Settings): SettingsProblem[] {
  const problems: SettingsProblem[] = [];
  for (const k of LENGTHS) {
    if (bad(s[k])) problems.push({ field: k, message: 'Enter a whole number of 0 or more.' });
  }
  for (const [lo, hi, label] of PAIRS) {
    if (!bad(s[lo]) && !bad(s[hi]) && s[lo] > s[hi]) {
      problems.push({ field: hi, message: `${label} max must be at least the min.` });
    }
  }
  const w: Partial<RuleWeights> = s.weights ?? {};
  if (WEIGHT_KEYS.some((k) => bad(w[k]))) {
    problems.push({ field: 'weights', message: 'Weights must be whole numbers of 0 or more.' });
  } else if ((w.required ?? 0) + (w.recommended ?? 0) + (w['best-practice'] ?? 0) <= 0) {
    // Muting one severity is legitimate; muting all three makes the score divisor zero.
    problems.push({ field: 'weights', message: 'At least one weight must be above 0, or nothing can score.' });
  }
  return problems;
}
