import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { validateSettings } from './validate-settings';

function withSettings(patch: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...patch, weights: { ...DEFAULT_SETTINGS.weights, ...(patch.weights ?? {}) } };
}

describe('validateSettings', () => {
  it('accepts the defaults', () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual([]);
  });

  it('rejects a negative threshold on that field', () => {
    expect(validateSettings(withSettings({ descMin: -5 }))).toEqual([
      { field: 'descMin', message: 'Enter a whole number of 0 or more.' },
    ]);
  });

  it('rejects NaN (a cleared number input) and decimals', () => {
    expect(validateSettings(withSettings({ titleMax: Number.NaN })).map((p) => p.field)).toEqual(['titleMax']);
    expect(validateSettings(withSettings({ ogDescMax: 120.5 })).map((p) => p.field)).toEqual(['ogDescMax']);
  });

  it('rejects min > max on the max field of each pair, with the pair name', () => {
    expect(validateSettings(withSettings({ titleMin: 70, titleMax: 60 }))).toEqual([
      { field: 'titleMax', message: 'Title max must be at least the min.' },
    ]);
    expect(validateSettings(withSettings({ descMin: 200 }))).toEqual([
      { field: 'descMax', message: 'Description max must be at least the min.' },
    ]);
    expect(validateSettings(withSettings({ ogDescMin: 201 }))).toEqual([
      { field: 'ogDescMax', message: 'og:description max must be at least the min.' },
    ]);
  });

  it('allows min == max', () => {
    expect(validateSettings(withSettings({ titleMin: 60, titleMax: 60 }))).toEqual([]);
  });

  it('does not report the pair rule while one side is itself invalid', () => {
    const problems = validateSettings(withSettings({ titleMin: -1, titleMax: 0 }));
    expect(problems).toEqual([{ field: 'titleMin', message: 'Enter a whole number of 0 or more.' }]);
  });

  it('rejects a negative, NaN or decimal weight with one message', () => {
    const msg = { field: 'weights', message: 'Weights must be whole numbers of 0 or more.' };
    expect(validateSettings(withSettings({ weights: { required: -1 } as Settings['weights'] }))).toEqual([msg]);
    expect(validateSettings(withSettings({ weights: { recommended: Number.NaN } as Settings['weights'] }))).toEqual([
      msg,
    ]);
    expect(validateSettings(withSettings({ weights: { 'best-practice': 2.5 } as Settings['weights'] }))).toEqual([
      msg,
    ]);
  });

  it('allows a single zero weight but not all three', () => {
    expect(validateSettings(withSettings({ weights: { 'best-practice': 0 } as Settings['weights'] }))).toEqual([]);
    expect(
      validateSettings(withSettings({ weights: { required: 0, recommended: 0, 'best-practice': 0 } }))
    ).toEqual([{ field: 'weights', message: 'At least one weight must be above 0, or nothing can score.' }]);
  });

  it('reports several problems at once, thresholds first', () => {
    const problems = validateSettings(
      withSettings({ titleMin: -1, weights: { required: 0, recommended: 0, 'best-practice': 0 } })
    );
    expect(problems.map((p) => p.field)).toEqual(['titleMin', 'weights']);
  });
});
