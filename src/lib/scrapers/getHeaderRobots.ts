/**
 * Reads the `X-Robots-Tag` response header for the scanned URL.
 *
 * The header is the standard way to de-index a page without touching its HTML, and a scraped DOM
 * cannot see it. Host permissions already cover every site (manifest.json), so the extension context
 * can make this request; it is best-effort and any failure leaves the DOM verdict untouched.
 */

import { sameUrl } from '../audit/url-match';

const TIMEOUT_MS = 4000;

/** `fetch` the URL and return the raw `X-Robots-Tag` header, or null when there is none. */
export async function fetchHeaderRobots(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // GET, not HEAD: a fair number of servers answer HEAD differently, or not at all. `credentials:
    // 'omit'` keeps this an anonymous request so it sees what a crawler would see.
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'follow',
      signal: controller.signal,
    });
    // This request carries no cookies, so an auth-gated page redirects to a login screen — and
    // login screens routinely ship `X-Robots-Tag: noindex`. Reporting that header against the
    // user's own dashboard would fail a `required` rule over a header their page does not have.
    if (!res.ok) return null;
    if (res.url && !sameUrl(res.url, url)) return null;
    const header = res.headers.get('x-robots-tag');
    // Headers are all we want. Without this the body keeps streaming to completion in the
    // background — a second full download of a page we already have in memory.
    try {
      await res.body?.cancel();
    } catch {
      // A body that is already consumed or errored is fine; we have the header.
    }
    return header;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
