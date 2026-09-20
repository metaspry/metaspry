import { describe, it, expect } from 'vitest';
import { sameUrl, urlKey } from './url-match';

describe('sameUrl', () => {
  it('ignores the fragment', () => {
    expect(sameUrl('https://acme.com/a#top', 'https://acme.com/a')).toBe(true);
  });

  it('ignores a trailing slash', () => {
    expect(sameUrl('https://acme.com/blog/', 'https://acme.com/blog')).toBe(true);
  });

  it('ignores the scheme', () => {
    expect(sameUrl('http://acme.com/a', 'https://acme.com/a')).toBe(true);
  });

  it('ignores host case', () => {
    expect(sameUrl('https://ACME.com/a', 'https://acme.com/a')).toBe(true);
  });

  it('separates a deep page from the homepage', () => {
    expect(sameUrl('https://acme.com/', 'https://acme.com/blog/post')).toBe(false);
  });

  it('keeps www and apex apart', () => {
    expect(sameUrl('https://www.acme.com/a', 'https://acme.com/a')).toBe(false);
  });

  it('keeps the query string significant', () => {
    expect(sameUrl('https://acme.com/a?p=1', 'https://acme.com/a')).toBe(false);
  });

  it('is false for unparseable or missing input', () => {
    expect(sameUrl('not a url', 'https://acme.com/')).toBe(false);
    expect(sameUrl(null, 'https://acme.com/')).toBe(false);
    expect(urlKey('nope')).toBeNull();
  });

  it('keeps the root path stable', () => {
    expect(sameUrl('https://acme.com', 'https://acme.com/')).toBe(true);
  });
});
