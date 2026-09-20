import { describe, it, expect } from 'vitest';
import { getRobots, applyHeaderRobots, parseDirectives } from './getRobots';

interface FakeTag {
  name: string;
  content: string;
}

/**
 * Minimal stand-in for the scraped DOM. It records every selector `getRobots` asks for, so a
 * regression that drops the case-insensitivity flag or goes back to a single-element query is
 * caught here rather than only in a real browser.
 */
function fakeDom(tags: FakeTag[]): { html: HTMLElement; selectors: string[] } {
  const selectors: string[] = [];
  const html = {
    querySelectorAll(sel: string) {
      selectors.push(sel);
      const match = /meta\[name="([^"]+)"/.exec(sel);
      const wanted = match?.[1]?.toLowerCase() ?? '';
      const ci = / i\]\s*$/.test(sel);
      return tags
        .filter((t) => (ci ? t.name.toLowerCase() === wanted : t.name === wanted))
        .map((t) => ({ getAttribute: (a: string) => (a === 'content' ? t.content : null) }));
    },
  } as unknown as HTMLElement;
  return { html, selectors };
}

describe('getRobots selectors', () => {
  it('queries case-insensitively and takes every matching tag', () => {
    const { html, selectors } = fakeDom([]);
    getRobots(html);
    expect(selectors).toContain('meta[name="robots" i]');
    expect(selectors).toContain('meta[name="googlebot" i]');
  });
});

describe('getRobots directives', () => {
  it('detects a capitalised meta name', () => {
    const { html } = fakeDom([{ name: 'Robots', content: 'noindex' }]);
    const info = getRobots(html);
    expect(info.noindex).toBe(true);
    expect(info.source).toBe('meta');
  });

  it('takes the most restrictive of several robots tags, not the first', () => {
    const { html } = fakeDom([
      { name: 'robots', content: 'index,follow' },
      { name: 'robots', content: 'noindex' },
    ]);
    expect(getRobots(html).noindex).toBe(true);
  });

  it('splits space-separated directives', () => {
    const { html } = fakeDom([{ name: 'robots', content: 'noindex nofollow' }]);
    const info = getRobots(html);
    expect(info.noindex).toBe(true);
    expect(info.nofollow).toBe(true);
  });

  it('treats none as both', () => {
    const { html } = fakeDom([{ name: 'googlebot', content: 'NONE' }]);
    const info = getRobots(html);
    expect(info.noindex).toBe(true);
    expect(info.nofollow).toBe(true);
  });

  it('passes a page with no robots tag', () => {
    const { html } = fakeDom([{ name: 'description', content: 'hello' }]);
    const info = getRobots(html);
    expect(info.noindex).toBe(false);
    expect(info.robots).toBeNull();
    expect(info.source).toBeNull();
  });
});

describe('parseDirectives', () => {
  it('handles commas, spaces and mixed case', () => {
    expect(parseDirectives('NoIndex, Nofollow  max-snippet:-1')).toEqual([
      'noindex',
      'nofollow',
      'max-snippet:-1',
    ]);
  });

  it('returns nothing for empty input', () => {
    expect(parseDirectives(null)).toEqual([]);
    expect(parseDirectives('   ')).toEqual([]);
  });
});

describe('applyHeaderRobots', () => {
  const clean = () => getRobots(fakeDom([]).html);

  it('de-indexes on a bare header', () => {
    const info = applyHeaderRobots(clean(), 'noindex');
    expect(info.noindex).toBe(true);
    expect(info.source).toBe('header');
    expect(info.header).toBe('noindex');
  });

  it('honours a googlebot-prefixed header', () => {
    expect(applyHeaderRobots(clean(), 'googlebot: noindex').noindex).toBe(true);
  });

  it('ignores a directive aimed at another named bot', () => {
    expect(applyHeaderRobots(clean(), 'bingbot: noindex').noindex).toBe(false);
  });

  it('is a no-op when the header is absent', () => {
    const before = clean();
    expect(applyHeaderRobots(before, null)).toBe(before);
  });

  it('never relaxes a meta verdict', () => {
    const { html } = fakeDom([{ name: 'robots', content: 'noindex' }]);
    const info = applyHeaderRobots(getRobots(html), 'index, follow');
    expect(info.noindex).toBe(true);
    expect(info.source).toBe('meta');
  });

  it('reads nofollow out of a multi-value header', () => {
    const info = applyHeaderRobots(clean(), 'noarchive, nofollow');
    expect(info.nofollow).toBe(true);
    expect(info.noindex).toBe(false);
  });
});
