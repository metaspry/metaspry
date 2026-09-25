import { describe, it, expect } from 'vitest';
import { compareChangedHref } from './compare-link';

describe('compareChangedHref', () => {
  it('pairs the previous stored version with the current document', () => {
    expect(compareChangedHref('abc')).toBe(
      'https://app.metaspry.com/compare?a=scan%3Aabc%40prev&b=scan%3Aabc'
    );
  });

  it('passes ids with _ and - through untouched', () => {
    expect(compareChangedHref('s1_x-9')).toBe(
      'https://app.metaspry.com/compare?a=scan%3As1_x-9%40prev&b=scan%3As1_x-9'
    );
  });
});
