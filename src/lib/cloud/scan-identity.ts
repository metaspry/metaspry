/**
 * The URL a scan is filed under: local history, the site-files origin, the uploaded payload and the
 * deterministic cloud document id all derive from this one value.
 *
 * It is the URL that was actually scanned — the active tab. `og:url` must never decide this: a site
 * that hardcodes `og:url` to its homepage on every article is exactly the defect this product
 * exists to find, and using it as the identity collapses every one of those articles into a single
 * history row and a single overwritten cloud document.
 */

/** Drop the fragment so `/post` and `/post#comments` stay one scan. Everything else is kept. */
export function normalizeScanUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    const u = new URL(raw);
    u.hash = '';
    // Trailing slash too, as the approved decision says: `/blog` and `/blog/` are one page, and
    // hashing them separately filed the same page as two cloud documents.
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return raw.trim();
  }
}

/**
 * Scan identity, most trustworthy source first: the tab URL, then the canonical, then nothing.
 * `og:url` is carried in the payload as metadata but is never the identity.
 */
export function scanUrlFor(tabUrl: string | null | undefined, canonical: string | null): string {
  return normalizeScanUrl(tabUrl) || normalizeScanUrl(canonical);
}
