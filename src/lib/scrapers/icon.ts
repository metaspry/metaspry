/**
 * Best-known icon for a scanned page.
 *
 * `getMetaTags` only sees a declared `<link rel="icon">`. Most sites that rely on the implicit
 * `/favicon.ico` declare nothing, so the SERP preview showed a grey circle and the uploaded scan
 * carried no icon at all. Chrome has already resolved the tab's effective favicon
 * (`tab.favIconUrl`), and `/favicon.ico` at the origin is the browser's own last resort, so the
 * scan uses the same order: declared -> tab -> origin.
 */

export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * @param declared  the `<link rel>` icon `getMetaTags` found (already absolutised), or null
 * @param tabIcon   `chrome.tabs.Tab.favIconUrl` as the background script reported it
 * @param pageUrl   the scanned page's URL (the fallback origin)
 */
export function resolveIcon(
  declared: string | null,
  tabIcon: string | null | undefined,
  pageUrl: string
): string | null {
  if (isHttpUrl(declared)) return declared;
  // A `data:` tab icon would be uploaded verbatim into the scan document (tens of KB per scan);
  // `chrome://` and `blob:` icons are unreachable outside the browser. Only http(s) travels.
  if (isHttpUrl(tabIcon)) return tabIcon;
  if (!isHttpUrl(pageUrl)) return null;
  return new URL('/favicon.ico', pageUrl).toString();
}
