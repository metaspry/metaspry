import { describe, it, expect } from 'vitest';
import { timeAgo } from './time-ago';

const NOW = 1_700_000_000_000;

describe('timeAgo', () => {
  it('steps through seconds, minutes, hours and days', () => {
    expect(timeAgo(NOW - 5_000, NOW)).toBe('5s ago');
    expect(timeAgo(NOW - 3 * 60_000, NOW)).toBe('3m ago');
    expect(timeAgo(NOW - 2 * 3_600_000, NOW)).toBe('2h ago');
    expect(timeAgo(NOW - 4 * 86_400_000, NOW)).toBe('4d ago');
  });

  it('never goes negative for a timestamp in the future (clock skew)', () => {
    expect(timeAgo(NOW + 60_000, NOW)).toBe('0s ago');
  });
});
