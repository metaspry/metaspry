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
