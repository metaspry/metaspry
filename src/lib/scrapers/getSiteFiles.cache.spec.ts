import { describe, it, expect, vi } from 'vitest';
import { fetchSiteFilesCached } from './getSiteFiles';
import type { SiteFiles } from './SiteFiles';

const files = { robots: { present: false }, sitemap: { present: false }, llms: { present: false } } as unknown as SiteFiles;

describe('fetchSiteFilesCached', () => {
  it('Site, AI and the upload share one fetch per origin per scan', async () => {
    const fetcher = vi.fn(async () => files);
    const a = fetchSiteFilesCached('https://acme.com/blog/post', 1, fetcher);
    const b = fetchSiteFilesCached('https://acme.com/', 1, fetcher);
    expect(await a).toBe(await b);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('a new scan fetches again', async () => {
    const fetcher = vi.fn(async () => files);
    await fetchSiteFilesCached('https://acme.com/', 2, fetcher);
    await fetchSiteFilesCached('https://acme.com/', 3, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('another origin in the same scan is its own fetch', async () => {
    const fetcher = vi.fn(async () => files);
    await fetchSiteFilesCached('https://acme.com/', 4, fetcher);
    await fetchSiteFilesCached('https://other.org/', 4, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('a failed fetch is not cached, so the next caller retries', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(files);
    await expect(fetchSiteFilesCached('https://acme.com/', 5, fetcher)).rejects.toThrow('timeout');
    await expect(fetchSiteFilesCached('https://acme.com/', 5, fetcher)).resolves.toBe(files);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
