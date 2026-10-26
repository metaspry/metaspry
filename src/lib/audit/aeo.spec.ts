import { describe, it, expect } from 'vitest';
import { analyzeAeo } from './aeo';

function page(head: string): HTMLElement {
  return new DOMParser().parseFromString(`<html><head>${head}</head><body><h1>Hi</h1><p>Body</p></body></html>`, 'text/html')
    .documentElement;
}

const indexable = (r: ReturnType<typeof analyzeAeo>) => r.checks.find((c) => c.id === 'aeo-indexable')!;

describe('analyzeAeo indexability', () => {
  it('without an Audit verdict it reads the robots meta tag (as before)', () => {
    expect(indexable(analyzeAeo(page('<meta name="robots" content="noindex">'), null, 'https://a.com/')).state).toBe('warn');
    expect(indexable(analyzeAeo(page(''), null, 'https://a.com/')).state).toBe('pass');
  });

  it('a page de-indexed by X-Robots-Tag or googlebot (Audit fail) is not reported indexable', () => {
    const r = analyzeAeo(page(''), null, 'https://a.com/', { blocked: true, detail: 'X-Robots-Tag: noindex' });
    const c = indexable(r);
    expect(c.state).toBe('warn');
    expect(c.detail).toContain('X-Robots-Tag: noindex');
    expect(c.detail).toContain('Audit > Indexable by search engines');
    expect(r.chip).toBe('needs-work');
  });

  it('the Audit verdict also clears a false alarm, but nosnippet still warns', () => {
    expect(indexable(analyzeAeo(page(''), null, 'https://a.com/', { blocked: false, detail: 'ok' })).state).toBe('pass');
    const snip = analyzeAeo(page('<meta name="robots" content="nosnippet">'), null, 'https://a.com/', { blocked: false, detail: 'ok' });
    expect(indexable(snip).state).toBe('warn');
  });
});

function doc(head: string, body: string): HTMLElement {
  return new DOMParser().parseFromString(`<html><head>${head}</head><body>${body}</body></html>`, 'text/html').documentElement;
}
const check = (r: ReturnType<typeof analyzeAeo>, id: string) => r.checks.find((c) => c.id === id)!;

describe('analyzeAeo parity with the server analyzer (architecture review 2026-10-26)', () => {
  it('author and date are not asked of a page that is not an article', () => {
    const c = check(analyzeAeo(doc('<meta property="og:type" content="website">', '<h1>Home</h1>'), null, 'https://a.com/'), 'aeo-author-date');
    expect(c.state).toBe('info');
    expect(c.detail).toContain('Not an article page');
  });

  it('an article without them still needs work, and with them passes', () => {
    const art = '<meta property="og:type" content="article">';
    expect(check(analyzeAeo(doc(art, '<h1>Post</h1>'), null, 'https://a.com/p'), 'aeo-author-date').state).toBe('warn');
    const full = `${art}<meta name="author" content="Ada"><meta property="article:published_time" content="2026-10-01">`;
    expect(check(analyzeAeo(doc(full, '<h1>Post</h1>'), null, 'https://a.com/p'), 'aeo-author-date').state).toBe('pass');
  });

  it('a JSON-LD BlogPosting counts as an article', () => {
    const ld = '<script type="application/ld+json">{"@type": "BlogPosting", "headline": "x"}</script>';
    expect(check(analyzeAeo(doc(ld, '<h1>Post</h1>'), null, 'https://a.com/p'), 'aeo-author-date').state).toBe('warn');
  });

  it('curly quotes count as a quotation lever, like straight ones', () => {
    const levers = (body: string) => check(analyzeAeo(doc('', body), null, 'https://a.com/'), 'aeo-geo-levers').detail;
    expect(levers('<p>No quotes here at all</p>')).toMatch(/^0\/3/);
    expect(levers('<p>She said \u201Cship it\u201D today</p>')).toMatch(/^1\/3/);
    expect(levers('<p>She said "ship it" today</p>')).toMatch(/^1\/3/);
  });
});
