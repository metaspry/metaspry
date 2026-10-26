/**
 * Compare's served-HTML fetch and the sentence a failure becomes (UX review 2026-10-25, Medium 18).
 * The tab used to print the raw error: "HTTP 403 Forbidden", "Failed to fetch".
 */

/** Every fetch in the Compare tab is bounded; a host that never answers used to hang it forever. */
export const FETCH_TIMEOUT_MS = 6000;

export type FetchPageFailure =
  | { kind: 'http'; status: number }
  | { kind: 'not-html'; contentType: string }
  | { kind: 'timeout' }
  | { kind: 'network' };

export class FetchPageError extends Error {
  constructor(readonly failure: FetchPageFailure) {
    super(failureMessage(failure));
    this.name = 'FetchPageError';
  }
}

export function failureMessage(f: FetchPageFailure): string {
  switch (f.kind) {
    case 'http':
      if (f.status === 401 || f.status === 403) {
        return `This page needs a sign-in (HTTP ${f.status}). Compare fetches pages without your cookies, so it can't see what you see.`;
      }
      if (f.status === 404 || f.status === 410) return `Page not found (HTTP ${f.status}). Check the URL.`;
      if (f.status === 429) return 'The site is rate-limiting requests (HTTP 429). Try again in a minute.';
      if (f.status >= 500) return `The site returned a server error (HTTP ${f.status}). Try again later.`;
      return `The site refused the request (HTTP ${f.status}).`;
    case 'not-html':
      return `That URL is not a web page (it returned ${f.contentType || 'an unknown type'}).`;
    case 'timeout':
      return `The site did not answer within ${FETCH_TIMEOUT_MS / 1000} seconds.`;
    case 'network':
      return "Couldn't reach this site. Check the URL; some sites also block requests from extensions.";
  }
}

/** GET as served HTML, bounded by `FETCH_TIMEOUT_MS` (the body read included). Throws FetchPageError. */
export async function fetchServedHtml(
  target: string,
  fetcher: typeof fetch = fetch,
): Promise<{ res: Response; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetcher(target, { credentials: 'omit', redirect: 'follow', signal: controller.signal });
    } catch (err) {
      throw new FetchPageError(err instanceof DOMException && err.name === 'AbortError' ? { kind: 'timeout' } : { kind: 'network' });
    }
    if (!res.ok) throw new FetchPageError({ kind: 'http', status: res.status });
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.toLowerCase().includes('text/html')) throw new FetchPageError({ kind: 'not-html', contentType: ct });
    try {
      return { res, text: await res.text() };
    } catch (err) {
      throw new FetchPageError(err instanceof DOMException && err.name === 'AbortError' ? { kind: 'timeout' } : { kind: 'network' });
    }
  } finally {
    clearTimeout(timer);
  }
}
