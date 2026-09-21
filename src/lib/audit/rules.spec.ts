import { describe, it, expect } from 'vitest';
import { audit } from './rules';
import type { PageMeta } from '../scrapers/PageMeta';
import type { RobotsInfo } from '../scrapers/getRobots';

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
    pageUrl: 'https://acme.com/blog/post',
    title: 'A title that is long enough to look real',
    canonical: null,
    icon: null,
    tags: [],
    duplicates: { title: 1, canonical: 1 },
    jsonLd: { blocks: [], errors: [] } as unknown as PageMeta['jsonLd'],
    hreflang: [],
    robots: NO_ROBOTS,
    ...over,
  };
}

const ruleById = (m: PageMeta, id: string) => audit(m).rules.find((r) => r.id === id);

describe('noindex rule', () => {
  it('fails when the DOM says noindex and names the meta tag', () => {
    const r = ruleById(meta({ robots: { ...NO_ROBOTS, robots: 'noindex', noindex: true, source: 'meta' } }), 'noindex');
    expect(r?.status).toBe('fail');
    expect(r?.detail).toContain('meta tag');
  });

  it('passes when nothing in the HTML blocks indexing, and says so', () => {
    const r = ruleById(meta(), 'noindex');
    expect(r?.status).toBe('pass');
    expect(r?.detail).toContain('HTML');
  });
});

describe('canonical rule', () => {
  it('warns when every page canonicalises to the homepage', () => {
    const r = ruleById(meta({ canonical: 'https://acme.com/' }), 'canonical');
    expect(r?.status).toBe('warn');
    expect(r?.detail).toContain('not this page');
  });

  it('passes a self-canonical that differs only by a trailing slash', () => {
    const r = ruleById(
      meta({ pageUrl: 'https://acme.com/blog/', canonical: 'https://acme.com/blog' }),
      'canonical'
    );
    expect(r?.status).toBe('pass');
  });

  it('warns when there is no canonical at all', () => {
    const r = ruleById(meta(), 'canonical');
    expect(r?.status).toBe('warn');
    expect(r?.detail).toContain('No canonical');
  });

  it('passes without judging when the page URL is unknown', () => {
    const r = ruleById(meta({ pageUrl: null, canonical: 'https://acme.com/other' }), 'canonical');
    expect(r?.status).toBe('pass');
  });
});

describe('dup-tags and media-scoped duplicates', () => {
  const tag = (key: string, value: string, media?: string) => ({
    key,
    value,
    source: 'name' as const,
    category: 'basic' as const,
    ...(media ? { media } : {}),
  });

  const run = (tags: ReturnType<typeof tag>[]) => ruleById(meta({ tags }), 'dup-tags');

  it('does not flag light/dark theme-color as a duplicate', () => {
    // The documented pattern, and what metaspry.com itself ships. Counting by name alone
    // reported our own correct markup as "theme-color×2".
    const r = run([
      tag('theme-color', '#fbfbff', '(prefers-color-scheme: light)'),
      tag('theme-color', '#0b1020', '(prefers-color-scheme: dark)'),
    ]);
    expect(r?.status).toBe('pass');
  });

  it('still flags a genuine duplicate with no media', () => {
    const r = run([tag('description', 'one'), tag('description', 'two')]);
    expect(r?.status).toBe('warn');
    expect(r?.detail).toContain('description');
  });

  it('flags two tags that share the same media query', () => {
    const r = run([
      tag('theme-color', '#aaa', '(prefers-color-scheme: dark)'),
      tag('theme-color', '#bbb', '(prefers-color-scheme: dark)'),
    ]);
    expect(r?.status).toBe('warn');
  });

  it('treats whitespace differences in a media query as the same scope', () => {
    const r = run([
      tag('theme-color', '#aaa', '(prefers-color-scheme:  dark)'),
      tag('theme-color', '#bbb', '(prefers-color-scheme: dark)'),
    ]);
    expect(r?.status).toBe('warn');
  });
});
