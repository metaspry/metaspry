import { describe, it, expect, vi, afterEach } from 'vitest';
import { needsAsyncResolution, resolveAsyncRules } from './asyncRules';
import { audit } from './rules';
import type { PageMeta } from '../scrapers/PageMeta';
import type { RobotsInfo } from '../scrapers/getRobots';

const realFetch = globalThis.fetch;

function mockHeader(value: string | null) {
  globalThis.fetch = vi.fn(async (input: unknown) => ({
    ok: true,
    url: String(input),
    headers: { get: () => value },
    body: null,
  })) as unknown as typeof fetch;
}

const NO_ROBOTS: RobotsInfo = {
  robots: null,
  googlebot: null,
  header: null,
  noindex: false,
  nofollow: false,
  source: null,
};

function meta(over: Partial<PageMeta> = {}): PageMeta {
  return {
    pageUrl: 'https://acme.com/post',
    title: 'A title long enough to be realistic',
    canonical: 'https://acme.com/post',
    icon: null,
    tags: [],
    jsonLd: { blocks: [], errors: [] } as unknown as PageMeta['jsonLd'],
    hreflang: [],
    robots: NO_ROBOTS,
    ...over,
  };
}

const noindexRule = (r: { rules: { id: string; status: string; detail: string }[] }) =>
  r.rules.find((x) => x.id === 'noindex');

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('X-Robots-Tag resolution', () => {
  it('fails a page the HTML passed when the header de-indexes it', async () => {
    mockHeader('noindex');
    const m = meta();
    const resolved = await resolveAsyncRules(audit(m), m);
    const rule = noindexRule(resolved);
    expect(rule?.status).toBe('fail');
    expect(rule?.detail).toContain('X-Robots-Tag');
    expect(rule?.detail).toContain('HTTP header');
  });

  it('keeps the DOM verdict when the header request fails', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('blocked');
    }) as unknown as typeof fetch;
    const m = meta();
    const resolved = await resolveAsyncRules(audit(m), m);
    expect(noindexRule(resolved)?.status).toBe('pass');
  });

  it('keeps the DOM verdict when there is no header', async () => {
    mockHeader(null);
    const m = meta();
    const resolved = await resolveAsyncRules(audit(m), m);
    expect(noindexRule(resolved)?.status).toBe('pass');
  });

  it('does not fetch when the meta tag already failed the rule', async () => {
    const spy = vi.fn(async () => ({ ok: true, url: '', headers: { get: () => 'noindex' }, body: null }));
    globalThis.fetch = spy as unknown as typeof fetch;
    const m = meta({ robots: { ...NO_ROBOTS, robots: 'noindex', noindex: true, source: 'meta' } });
    const resolved = await resolveAsyncRules(audit(m), m);
    expect(noindexRule(resolved)?.detail).toContain('meta tag');
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not fetch when the page URL is unknown', async () => {
    const spy = vi.fn(async () => ({ ok: true, url: '', headers: { get: () => 'noindex' }, body: null }));
    globalThis.fetch = spy as unknown as typeof fetch;
    const m = meta({ pageUrl: null });
    await resolveAsyncRules(audit(m), m);
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores a header aimed at another crawler', async () => {
    mockHeader('bingbot: noindex');
    const m = meta();
    const resolved = await resolveAsyncRules(audit(m), m);
    expect(noindexRule(resolved)?.status).toBe('pass');
  });
});

describe('the production gate (E1 path 3)', () => {
  // Extension.svelte and CompareView both skip resolveAsyncRules when this returns false. It used
  // to be `hasPending`, and only og:image-dimensions ever produces `pending` - so a page with no
  // og:image never had its X-Robots-Tag checked, which is precisely the shape of a bare staging
  // site. The unit tests passed because they called resolveAsyncRules directly.
  it('still resolves a page with no og:image at all', async () => {
    const m = meta({ tags: [] });
    expect(needsAsyncResolution(audit(m), m)).toBe(true);

    mockHeader('noindex');
    const resolved = await resolveAsyncRules(audit(m), m);
    expect(noindexRule(resolved)?.status).toBe('fail');
  });

  it('resolves when an og:image needs measuring', () => {
    const m = meta({ tags: [{ key: 'og:image', value: 'https://acme.com/c.png' }] as never });
    expect(needsAsyncResolution(audit(m), m)).toBe(true);
  });

  it('skips the network when the DOM already failed the rule', () => {
    const m = meta({ robots: { ...NO_ROBOTS, robots: 'noindex', noindex: true, source: 'meta' } });
    expect(needsAsyncResolution(audit(m), m)).toBe(false);
  });

  it('skips the network when there is no URL to ask about', () => {
    const m = meta({ pageUrl: null });
    expect(needsAsyncResolution(audit(m), m)).toBe(false);
  });
});
