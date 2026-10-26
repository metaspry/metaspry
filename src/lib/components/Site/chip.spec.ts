import { describe, it, expect } from 'vitest';
import { couldNotCheck, fileChip, robotsChip } from './chip';

const group = (userAgents: string[], disallow: string[], allow: string[] = []) => ({ userAgents, disallow, allow });

describe('Site card chips (UX review 2026-10-25, Medium 17)', () => {
  it('a 404 or an HTML fallback is a real "missing"; a timeout or 5xx is "could not check"', () => {
    expect(couldNotCheck('HTTP 404')).toBe(false);
    expect(couldNotCheck('Server returned HTML (likely SPA fallback or missing route).')).toBe(false);
    expect(couldNotCheck('Request failed or timed out.')).toBe(true);
    expect(couldNotCheck('HTTP 503')).toBe(true);
    expect(couldNotCheck(undefined)).toBe(false);
  });

  it('robots.txt that closes the whole site to every crawler is not a green "Found"', () => {
    expect(robotsChip({ present: true, groups: [group(['*'], ['/'])] })).toEqual({ label: 'Blocks all', tone: 'warn' });
    expect(robotsChip({ present: true, groups: [group(['*'], ['/'], ['/'])] })).toEqual({ label: 'Found', tone: 'good' });
    expect(robotsChip({ present: true, groups: [group(['*'], ['/private/'])] })).toEqual({ label: 'Found', tone: 'good' });
    expect(robotsChip({ present: true, groups: [group(['GPTBot'], ['/'])] })).toEqual({ label: 'Found', tone: 'good' });
  });

  it('robots.txt that timed out reads "Couldn\'t check", one that 404s reads "Missing"', () => {
    expect(robotsChip({ present: false, groups: [], error: 'Request failed or timed out.' })).toEqual({ label: "Couldn't check", tone: 'neutral' });
    expect(robotsChip({ present: false, groups: [], error: 'HTTP 404' })).toEqual({ label: 'Missing', tone: 'fail' });
  });

  it('other files keep their own "absent" chip but a failed fetch reads "Couldn\'t check"', () => {
    const absent = { label: 'Not present', tone: 'neutral' } as const;
    expect(fileChip({ present: true }, absent)).toEqual({ label: 'Found', tone: 'good' });
    expect(fileChip({ present: false, error: 'HTTP 404' }, absent)).toBe(absent);
    expect(fileChip({ present: false, error: 'Request failed or timed out.' }, absent)).toEqual({ label: "Couldn't check", tone: 'neutral' });
  });
});
