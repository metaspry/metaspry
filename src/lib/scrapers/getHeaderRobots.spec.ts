import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchHeaderRobots } from './getHeaderRobots';

const realFetch = globalThis.fetch;

function mockFetch(impl: (url: string, init: RequestInit) => Promise<Response> | Response) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
}

function response(headers: Record<string, string>, body?: { cancel: () => Promise<void> } | null) {
  return {
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    body: body ?? null,
  } as unknown as Response;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('fetchHeaderRobots', () => {
  it('returns the header when present', async () => {
    mockFetch(async () => response({ 'x-robots-tag': 'noindex' }));
    expect(await fetchHeaderRobots('https://acme.com/')).toBe('noindex');
  });

  it('returns null when the header is absent', async () => {
    mockFetch(async () => response({}));
    expect(await fetchHeaderRobots('https://acme.com/')).toBeNull();
  });

  it('cancels the body instead of downloading the whole page again', async () => {
    const cancel = vi.fn(async () => {});
    mockFetch(async () => response({ 'x-robots-tag': 'noindex' }, { cancel }));
    await fetchHeaderRobots('https://acme.com/');
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('still returns the header when the body cannot be cancelled', async () => {
    const cancel = vi.fn(async () => {
      throw new Error('already consumed');
    });
    mockFetch(async () => response({ 'x-robots-tag': 'none' }, { cancel }));
    expect(await fetchHeaderRobots('https://acme.com/')).toBe('none');
  });

  it('swallows a failed request', async () => {
    mockFetch(async () => {
      throw new Error('network down');
    });
    expect(await fetchHeaderRobots('https://acme.com/')).toBeNull();
  });

  it('requests anonymously and follows redirects', async () => {
    const spy = vi.fn(async (_url: string, _init: RequestInit) => response({}));
    mockFetch(spy);
    await fetchHeaderRobots('https://acme.com/');
    const init = spy.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('omit');
    expect(init?.redirect).toBe('follow');
  });
});
