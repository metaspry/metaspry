import { describe, it, expect } from 'vitest';
import { FetchPageError, failureMessage, fetchServedHtml } from './fetch-page';

// UX review 2026-10-25, Medium 18: Compare explains a failed fetch in words, not "HTTP 403 Forbidden".

const response = (status: number, type = 'text/html; charset=utf-8', body = '<html></html>') =>
  new Response(body, { status, headers: { 'content-type': type } });

async function failureOf(fetcher: typeof fetch) {
  try {
    await fetchServedHtml('https://a.com/', fetcher);
  } catch (err) {
    expect(err).toBeInstanceOf(FetchPageError);
    return (err as FetchPageError).failure;
  }
  throw new Error('expected a failure');
}

describe('fetchServedHtml', () => {
  it('returns the served HTML and fetches without cookies', async () => {
    let init: RequestInit | undefined;
    const out = await fetchServedHtml('https://a.com/', (async (_u: RequestInfo | URL, i?: RequestInit) => {
      init = i;
      return response(200);
    }) as typeof fetch);
    expect(out.text).toBe('<html></html>');
    expect(init?.credentials).toBe('omit');
  });

  it.each([
    [401, 'http'],
    [404, 'http'],
    [503, 'http'],
  ])('HTTP %i is a typed failure', async (status, kind) => {
    expect(await failureOf((async () => response(status)) as typeof fetch)).toMatchObject({ kind, status });
  });

  it('a non-HTML response is a typed failure', async () => {
    expect(await failureOf((async () => response(200, 'application/pdf')) as typeof fetch)).toEqual({ kind: 'not-html', contentType: 'application/pdf' });
  });

  it('a network error and an abort are told apart', async () => {
    expect(await failureOf((async () => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch)).toEqual({ kind: 'network' });
    expect(await failureOf((async () => Promise.reject(new DOMException('aborted', 'AbortError'))) as typeof fetch)).toEqual({ kind: 'timeout' });
  });
});

describe('failureMessage', () => {
  it('speaks plainly for every case and never shows a raw status text', () => {
    expect(failureMessage({ kind: 'http', status: 403 })).toContain('needs a sign-in');
    expect(failureMessage({ kind: 'http', status: 404 })).toBe('Page not found (HTTP 404). Check the URL.');
    expect(failureMessage({ kind: 'http', status: 502 })).toContain('server error');
    expect(failureMessage({ kind: 'http', status: 429 })).toContain('rate-limiting');
    expect(failureMessage({ kind: 'network' })).toContain("Couldn't reach this site");
    expect(failureMessage({ kind: 'timeout' })).toContain('did not answer within 6 seconds');
    expect(failureMessage({ kind: 'not-html', contentType: '' })).toContain('an unknown type');
  });
});
