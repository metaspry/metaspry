import { getHtmlRequest, parseGetHtmlResponse, type CaptureFailure } from '../messaging/protocol';

export interface PageHtml {
  html: HTMLElement | null;
  url: string;
  /** Why there is no HTML, when the background script could say. */
  reason?: CaptureFailure;
  /** `chrome.tabs.Tab.favIconUrl` for the scanned tab, when Chrome had resolved one. */
  favIconUrl?: string;
}

/** Pages Chrome refuses to inject into, recognised from the URL alone. */
export function restrictedKind(url: string): string | null {
  const u = url.toLowerCase();
  if (u.startsWith('chrome://newtab') || u.startsWith('edge://newtab')) return 'the new tab page';
  if (u.startsWith('chrome://') || u.startsWith('edge://') || u.startsWith('brave://')) return 'a browser settings page';
  if (u.startsWith('chrome-extension://') || u.startsWith('moz-extension://')) return 'an extension page';
  if (u.startsWith('about:')) return 'the new tab page';
  if (u.startsWith('view-source:')) return 'a view-source page';
  if (u.startsWith('file://')) return 'a local file';
  // Host and path come from the parsed URL: a substring match also caught a search for
  // "chromewebstore.google.com" or a query ending in ".pdf", and the panel blocks re-scan there.
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return null;
  }
  const host = parsed.hostname;
  if (host === 'chromewebstore.google.com' || (host === 'chrome.google.com' && parsed.pathname.startsWith('/webstore'))) {
    return 'the Chrome Web Store';
  }
  if (parsed.pathname.endsWith('.pdf')) return 'a PDF';
  return null;
}

/**
 * User-facing explanation for a page that produced no HTML. Chrome blocks script injection on its
 * own pages, the Web Store, PDFs and policy-blocked sites; saying so beats the old
 * "No response from background script", which described our plumbing rather than their page.
 */
export function unscriptableMessage(url: string, reason?: PageHtml['reason']): string {
  if (reason === 'no-tab') return 'No active tab to scan. Open a web page and try again.';
  const kind = restrictedKind(url);
  if (kind) return `This page can't be scanned — Chrome blocks extensions on ${kind}.`;
  if (!url) return "This page can't be scanned. Open a normal web page and try again.";
  return "This page can't be scanned. Chrome blocked access to it, or it hadn't finished loading. Open a normal web page and try again.";
}

/** How long a capture may take. A tab with an open alert() / confirm() never runs the injection. */
export const CAPTURE_TIMEOUT_MS = 15_000;

/**
 * Captures the active tab of `windowId` (the window hosting this side panel / popup, E-19). Without
 * it the background falls back to the last-focused window. `url` is the captured document's own URL.
 * Rejects after `timeoutMs` so a page that never answers cannot leave the scan loading forever.
 */
export async function getHTML(windowId?: number, timeoutMs = CAPTURE_TIMEOUT_MS): Promise<PageHtml> {
  const request = getHtmlRequest(windowId);
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(new Error(`Timed out waiting for the page after ${Math.round(timeoutMs / 1000)} s.`));
    }, timeoutMs);
    const onResponse = (raw: unknown) => {
      // A dead message port sets lastError; reading it also stops Chrome logging it as unchecked.
      const lastError = chrome.runtime.lastError;
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const response = parseGetHtmlResponse(raw);
      if (!response) {
        reject(new Error(lastError?.message ?? 'No response from background script.'));
        return;
      }
      const { url, reason } = response;
      // Spread-in only when present: `exactOptionalPropertyTypes` forbids an explicit undefined.
      const icon = response.favIconUrl ? { favIconUrl: response.favIconUrl } : {};
      if (response.html) {
        // DOMParser is guaranteed inert: subresources don't load, scripts
        // don't execute, even when the resulting document is later
        // appended. Safer than innerHTML on a disconnected <html> node
        // even though both are effectively safe with our current usage.
        const doc = new DOMParser().parseFromString(response.html, 'text/html');
        resolve({ html: doc.documentElement, url, ...icon });
      } else {
        resolve(reason ? { html: null, url, reason, ...icon } : { html: null, url, ...icon });
      }
    };
    try {
      chrome.runtime.sendMessage(request, onResponse);
    } catch (err) {
      // No extension context (dev page, reloaded extension): fail now and drop the pending timer.
      settled = true;
      clearTimeout(timer);
      reject(err);
    }
  });
}
