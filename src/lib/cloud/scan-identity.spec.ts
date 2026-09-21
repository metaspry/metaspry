import { describe, it, expect } from 'vitest';
import { normalizeScanUrl, scanUrlFor } from './scan-identity';

describe('normalizeScanUrl', () => {
  it('drops the fragment', () => {
    expect(normalizeScanUrl('https://acme.com/post#comments')).toBe('https://acme.com/post');
  });

  it('keeps the query string', () => {
    expect(normalizeScanUrl('https://acme.com/p?id=2')).toBe('https://acme.com/p?id=2');
  });

  it('returns an empty string for nothing', () => {
    expect(normalizeScanUrl(null)).toBe('');
    expect(normalizeScanUrl(undefined)).toBe('');
  });

  it('passes through an unparseable value', () => {
    expect(normalizeScanUrl(' weird ')).toBe('weird');
  });
});

describe('scanUrlFor', () => {
  it('uses the tab URL, never og:url', () => {
    expect(scanUrlFor('https://acme.com/blog/post-1', 'https://acme.com/')).toBe(
      'https://acme.com/blog/post-1'
    );
  });

  it('gives five articles five identities even when og:url is hardcoded', () => {
    const tabs = [1, 2, 3, 4, 5].map((n) => `https://acme.com/a${n}`);
    const ids = new Set(tabs.map((t) => scanUrlFor(t, 'https://acme.com/')));
    expect(ids.size).toBe(5);
  });

  it('files a re-scan with a different fragment under the same identity', () => {
    expect(scanUrlFor('https://acme.com/a#x', null)).toBe(scanUrlFor('https://acme.com/a#y', null));
  });

  it('falls back to the canonical when there is no tab URL', () => {
    expect(scanUrlFor('', 'https://acme.com/c')).toBe('https://acme.com/c');
  });

  it('is empty when neither is known', () => {
    expect(scanUrlFor(null, null)).toBe('');
  });
});

describe('trailing slash (approved Decision 3)', () => {
  it('files /blog and /blog/ as one scan', () => {
    expect(normalizeScanUrl('https://acme.com/blog/')).toBe('https://acme.com/blog');
    expect(scanUrlFor('https://acme.com/blog/', null)).toBe(scanUrlFor('https://acme.com/blog', null));
  });

  it('keeps the root slash', () => {
    expect(normalizeScanUrl('https://acme.com/')).toBe('https://acme.com/');
  });

  it('does not touch a query string', () => {
    expect(normalizeScanUrl('https://acme.com/a/?p=1')).toBe('https://acme.com/a?p=1');
  });
});
