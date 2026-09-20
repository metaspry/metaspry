/**
 * URL equivalence for "does this point at the page we scanned?" checks.
 *
 * Deliberately narrow: the fragment, a trailing slash and an http/https difference are ignored,
 * because none of them make it a different page. Host case is ignored. Everything else — `www.`,
 * query strings, casing in the path — is a real difference and is reported as one.
 */
export function sameUrl(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ka = urlKey(a);
  const kb = urlKey(b);
  return ka !== null && ka === kb;
}

export function urlKey(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const path = u.pathname.length > 1 && u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname;
  return `${u.hostname.toLowerCase()}${path}${u.search}`;
}
