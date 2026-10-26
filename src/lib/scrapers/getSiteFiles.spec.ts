import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchSiteFiles,
  isPrivateHost,
  MAX_ROBOTS_SITEMAPS,
  BLOCKED_TARGET_ERROR,
  siteFilesForUpload,
} from './getSiteFiles';
import type { SiteFiles } from './SiteFiles';

type Route = { status?: number; body?: string; type?: string; finalUrl?: string };

/** A fake `fetch` serving `routes` by exact URL (404 otherwise); records every requested URL. */
function serve(routes: Record<string, Route>): string[] {
  const requested: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    requested.push(input);
    const r = routes[input] ?? { status: 404 };
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      url: r.finalUrl ?? input,
      headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? r.type ?? 'text/plain' : null) },
      text: async () => r.body ?? '',
    };
  }));
  return requested;
}

const urlset = (...locs: string[]) =>
  `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs.map((l) => `<url><loc>${l}</loc></url>`).join('')}</urlset>`;
const index = (...locs: string[]) =>
  `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs.map((l) => `<sitemap><loc>${l}</loc></sitemap>`).join('')}</sitemapindex>`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('isPrivateHost', () => {
  it.each(['localhost', 'app.localhost', '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '[::1]', '[fd00::1]', '[fe80::1]', '[::ffff:192.168.0.1]', 'printer.local', 'db.internal', 'nas.lan', 'tv.home.arpa'])(
    '%s is private',
    (h) => expect(isPrivateHost(h)).toBe(true)
  );
  it.each(['example.com', '8.8.8.8', '172.32.0.1', '100.128.0.1', '[2606:4700::1111]', 'localhost.example.com'])('%s is public', (h) =>
    expect(isPrivateHost(h)).toBe(false)
  );
});

describe('fetchSiteFiles: sitemap discovery is bounded and stays out of the user network', () => {
  it(`tries at most ${MAX_ROBOTS_SITEMAPS} robots.txt Sitemap: URLs, however many are declared`, async () => {
    const lines = Array.from({ length: 1000 }, (_, i) => `Sitemap: https://example.com/s${i}.xml`).join('\n');
    const requested = serve({ 'https://example.com/robots.txt': { body: `User-agent: *\nDisallow:\n${lines}` } });
    const files = await fetchSiteFiles('https://example.com');
    const declared = requested.filter((u) => /\/s\d+\.xml$/.test(u));
    expect(declared).toHaveLength(MAX_ROBOTS_SITEMAPS);
    expect(files.sitemap.present).toBe(false);
    // Robots still reports every declared line (the Site tab lists them).
    expect(files.robots.sitemaps).toHaveLength(1000);
  });

  it('never requests a LAN, loopback, single-label or non-web Sitemap: URL, and names it in the not-found error', async () => {
    const requested = serve({
      'https://example.com/robots.txt': {
        body: 'Sitemap: http://192.168.1.1/sitemap.xml\nSitemap: http://intranet/s.xml\nSitemap: http://localhost:8080/s.xml\nSitemap: ftp://example.com/s.xml',
      },
    });
    const files = await fetchSiteFiles('https://example.com/page');
    expect(requested.some((u) => /192\.168|intranet|localhost|^ftp:/.test(u))).toBe(false);
    expect(files.sitemap.present).toBe(false);
    expect(files.sitemap.error).toContain('http://192.168.1.1/sitemap.xml');
    expect(files.sitemap.error).toContain('Skipped 4 robots.txt sitemap(s) on a private or local address');
  });

  it('follows a sitemap robots.txt declares on another public host (a CDN, a bucket), as search engines do', async () => {
    serve({
      'https://shop.example.com/robots.txt': { body: 'Sitemap: https://cdn.example-assets.net/sitemaps/shop.xml' },
      'https://cdn.example-assets.net/sitemaps/shop.xml': { body: urlset('https://shop.example.com/1', 'https://shop.example.com/2') },
    });
    const files = await fetchSiteFiles('https://shop.example.com');
    expect(files.sitemap.present).toBe(true);
    expect(files.sitemap.urlCount).toBe(2);
    expect(files.sitemap.error).toBeUndefined();
  });

  it('a sitemap index child in the user network is not fetched and does not spend the budget', async () => {
    const requested = serve({
      'https://example.com/sitemap.xml': { body: index('http://10.0.0.5/s.xml', 'http://169.254.169.254/latest/meta-data', 'https://example.com/a.xml') },
      'https://example.com/a.xml': { body: urlset('https://example.com/1') },
    });
    const files = await fetchSiteFiles('https://example.com');
    expect(requested.some((u) => u.includes('10.0.0.5') || u.includes('169.254'))).toBe(false);
    expect(files.sitemap.isIndex).toBe(true);
    expect(files.sitemap.urlCount).toBe(1);
    expect(files.sitemap.children.map((c) => c.error)).toEqual([BLOCKED_TARGET_ERROR, BLOCKED_TARGET_ERROR, undefined]);
    expect(files.sitemap.budgetExhausted).toBeUndefined();
  });

  it('discards a response that redirected to a private address', async () => {
    serve({
      'https://example.com/robots.txt': { body: 'User-agent: *\nDisallow: /secret', finalUrl: 'http://192.168.0.1/robots.txt' },
      'https://example.com/llms.txt': { body: '# Router admin', finalUrl: 'http://127.0.0.1/llms.txt' },
      'https://example.com/sitemap.xml': { body: urlset('http://192.168.0.1/admin'), finalUrl: 'http://192.168.0.1/sitemap.xml' },
    });
    const files = await fetchSiteFiles('https://example.com');
    expect(files.robots.present).toBe(false);
    expect(files.robots.raw).toBeNull();
    expect(files.robots.error).toBe('Redirected to a private network address.');
    expect(files.llms.present).toBe(false);
    expect(files.sitemap.present).toBe(false);
  });

  it('a page on a local host may read its own local site files (dev servers, the e2e fixture site)', async () => {
    serve({
      'http://127.0.0.1:4319/robots.txt': { body: 'Sitemap: http://127.0.0.1:4319/sitemap.xml' },
      'http://127.0.0.1:4319/sitemap.xml': { body: urlset('http://127.0.0.1:4319/') },
      'http://127.0.0.1:4319/llms.txt': { body: '# Site' },
    });
    const files = await fetchSiteFiles('http://127.0.0.1:4319');
    expect(files.robots.present).toBe(true);
    expect(files.sitemap.present).toBe(true);
    expect(files.llms.present).toBe(true);
  });
});

describe('siteFilesForUpload', () => {
  const files = { robots: { present: true } } as unknown as SiteFiles;

  it('hands over the site files when they arrive in time', async () => {
    await expect(siteFilesForUpload('https://a.com', 101, 50, async () => files)).resolves.toBe(files);
  });

  it('gives up after the deadline so the upload is not held hostage by a slow site', async () => {
    vi.useFakeTimers();
    const pending = siteFilesForUpload('https://b.com', 102, 8000, () => new Promise<SiteFiles>(() => {}));
    await vi.advanceTimersByTimeAsync(8000);
    await expect(pending).resolves.toBeUndefined();
  });

  it('uploads without site files when the fetch fails', async () => {
    await expect(siteFilesForUpload('https://c.com', 103, 50, async () => { throw new Error('x'); })).resolves.toBeUndefined();
  });
});
