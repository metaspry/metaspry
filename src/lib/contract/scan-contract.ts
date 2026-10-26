/**
 * The scan document contract shared with the web app (architecture review 2026-10-26, Critical 1).
 * Same names and bodies as `app/functions/src/scan-contract.ts`; `scan-contract.json` (a byte copy of
 * the app's `functions/test/fixtures/scan-contract.json`) is the table both repos test against, and
 * `npm run contract:check` fails when the copy drifts from the app's. Pure, no imports.
 *
 * Schema rule (the app's): an additive change (a new optional field) needs no version bump; a bump
 * ships every reader first, because the app refuses to render a version it does not know.
 */

export const SCAN_SCHEMA_VERSION = 1;

export type ScoreBand = 'good' | 'warn' | 'fail';

/** Lowest score of each band: 80+ good, 50-79 warn, under 50 fail. */
export const BAND_MIN = { good: 80, warn: 50 } as const;

export function bandForScore(score: number): ScoreBand {
  if (score >= BAND_MIN.good) return 'good';
  if (score >= BAND_MIN.warn) return 'warn';
  return 'fail';
}

/**
 * Cap a score band (founder decision 2026-09-30): a page with a failing `required` rule is never
 * "healthy", whatever its score. `good` becomes `warn`; `warn` and `fail` are unchanged.
 */
export function capBand(band: ScoreBand, requiredFailing: boolean): ScoreBand {
  return requiredFailing && band === 'good' ? 'warn' : band;
}

/** Does any rule with severity `required` have status `fail`? Tolerates untyped stored data. */
export function hasFailingRequired(rules: unknown): boolean {
  return (
    Array.isArray(rules) &&
    rules.some(
      (r) =>
        !!r &&
        typeof r === 'object' &&
        (r as { severity?: unknown }).severity === 'required' &&
        (r as { status?: unknown }).status === 'fail',
    )
  );
}

/** The band to show for a score: `bandForScore`, capped at `warn` when any `required` rule fails. */
export function bandFor(score: number, rules?: unknown): ScoreBand {
  return capBand(bandForScore(score), hasFailingRequired(rules));
}

/**
 * Deterministic scan doc id for a URL (djb2), so a re-scan of the same URL updates one document.
 * The extension hashes `normalizeScanUrl(url)` (`cloud/scan-identity.ts`); `scan-keys.json` publishes
 * that normalisation for the app, whose bulk and monitor paths still hash the raw URL.
 */
export function scanIdFor(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) >>> 0;
  return 's' + h.toString(36);
}
