import { describe, it, expect } from 'vitest';
import { isHttpUrl, resolveIcon } from './icon';

describe('isHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isHttpUrl('https://ex.com/i.png')).toBe(true);
    expect(isHttpUrl('http://ex.com/i.png')).toBe(true);
  });

  it('rejects other schemes, relative paths and empties', () => {
    expect(isHttpUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(isHttpUrl('chrome://favicon/size/16@1x/https://ex.com')).toBe(false);
    expect(isHttpUrl('blob:https://ex.com/abc')).toBe(false);
    expect(isHttpUrl('/favicon.ico')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
    expect(isHttpUrl(undefined)).toBe(false);
  });
});

describe('resolveIcon', () => {
  const page = 'https://ex.com/a/b';

  it('prefers the declared <link rel=icon> regardless of the tab icon', () => {
    expect(resolveIcon('https://ex.com/i.png', 'https://ex.com/favicon.ico', page)).toBe(
      'https://ex.com/i.png'
    );
  });

  it('falls back to the tab icon Chrome resolved (implicit /favicon.ico)', () => {
    expect(resolveIcon(null, 'https://ex.com/favicon.ico', page)).toBe('https://ex.com/favicon.ico');
  });

  it('falls back to /favicon.ico at the page origin when nothing is known', () => {
    expect(resolveIcon(null, null, page)).toBe('https://ex.com/favicon.ico');
    expect(resolveIcon(null, undefined, 'https://ex.com:8443/x?y=1')).toBe(
      'https://ex.com:8443/favicon.ico'
    );
  });

  it('skips a data: tab icon and uses the origin fallback instead', () => {
    expect(resolveIcon(null, 'data:image/png;base64,AAAA', page)).toBe('https://ex.com/favicon.ico');
  });

  it('skips chrome:// and blob: tab icons', () => {
    expect(resolveIcon(null, 'chrome://favicon/https://ex.com', page)).toBe('https://ex.com/favicon.ico');
    expect(resolveIcon(null, 'blob:https://ex.com/abc', page)).toBe('https://ex.com/favicon.ico');
  });

  it('ignores a declared value that is not http(s) (unresolvable relative href)', () => {
    expect(resolveIcon('i.png', null, page)).toBe('https://ex.com/favicon.ico');
  });

  it('returns null when the page itself is not http(s)', () => {
    expect(resolveIcon(null, null, 'file:///C:/x.html')).toBeNull();
    expect(resolveIcon(null, null, '')).toBeNull();
    expect(resolveIcon(null, null, 'chrome://extensions')).toBeNull();
  });
});
