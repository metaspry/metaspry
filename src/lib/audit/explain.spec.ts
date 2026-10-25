import { describe, it, expect } from 'vitest';
import { formulaText, pointsLost, possiblePoints, verdictLabel } from './explain';
import { audit } from './rules';
import { DEFAULT_SETTINGS } from '../storage/settings';
import { getMetaTags } from '../scrapers/getMetaTags';

const W = { required: 10, recommended: 5, 'best-practice': 2 };

describe('verdictLabel', () => {
  it.each([
    [{ status: 'pass' as const }, 'Pass'],
    [{ status: 'warn' as const }, 'Needs work'],
    [{ status: 'fail' as const }, 'Fail'],
    [{ status: 'pending' as const }, 'Checking'],
    [{ status: 'pass' as const, skipped: true as const }, 'Not applicable'],
  ])('%o -> %s', (rule, label) => {
    expect(verdictLabel(rule)).toBe(label);
  });
});

describe('pointsLost', () => {
  it('a fail costs the full weight, a warn half, a pass nothing (out of 100)', () => {
    expect(pointsLost({ status: 'fail', severity: 'required' }, W, 50)).toBe(20);
    expect(pointsLost({ status: 'warn', severity: 'required' }, W, 50)).toBe(10);
    expect(pointsLost({ status: 'pass', severity: 'required' }, W, 50)).toBe(0);
    expect(pointsLost({ status: 'fail', severity: 'best-practice' }, W, 30)).toBe(6.7);
  });
  it('is 0 when nothing can be earned', () => {
    expect(pointsLost({ status: 'fail', severity: 'required' }, W, 0)).toBe(0);
  });
  it('the points lost by every rule add up to 100 - score', () => {
    const html = '<html><head><title>A title that is long enough to pass the check</title><meta property="og:title" content="x"></head><body></body></html>';
    const meta = getMetaTags(new DOMParser().parseFromString(html, 'text/html').documentElement, 'https://example.com/');
    const result = audit(meta, DEFAULT_SETTINGS);
    const possible = possiblePoints(result.rules, DEFAULT_SETTINGS.weights);
    const lost = result.rules.reduce((s, r) => s + pointsLost(r, DEFAULT_SETTINGS.weights, possible), 0);
    expect(Math.abs(100 - lost - result.score)).toBeLessThanOrEqual(1);
  });
});

describe('formulaText', () => {
  it('names the weights in effect and the not-applicable rule', () => {
    const t = formulaText(W);
    expect(t).toContain('required 10, recommended 5, best-practice 2');
    expect(t).toContain('do not apply to this page count as passed');
  });
});
