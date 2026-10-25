import { describe, it, expect } from 'vitest';
import { diffMeta, differenceCount, DIFF_LABEL } from './diff';
import { getMetaTags } from '../../scrapers/getMetaTags';

const meta = (head: string) =>
  getMetaTags(new DOMParser().parseFromString(`<html><head>${head}</head></html>`, 'text/html').documentElement, 'https://a.com/');

describe('diffMeta', () => {
  const rows = diffMeta(
    meta('<title>A</title><meta name="description" content="same"><meta property="og:title" content="only left">'),
    meta('<title>B</title><meta name="description" content="same"><meta name="twitter:card" content="summary">'),
  );
  const status = (key: string) => rows.find((r) => r.key === key)?.status;

  it('classifies each tag', () => {
    expect(status('title')).toBe('different');
    expect(status('description')).toBe('same');
    expect(status('og:title')).toBe('left-only');
    expect(status('twitter:card')).toBe('right-only');
  });

  it('every status has a text label, so colour is never the only signal', () => {
    for (const r of rows) expect(DIFF_LABEL[r.status]).toMatch(/\w/);
    expect(new Set(Object.values(DIFF_LABEL)).size).toBe(4);
  });

  it('counts every row that is not the same', () => {
    expect(differenceCount(rows)).toBe(3);
  });
});
