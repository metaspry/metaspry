export interface PageHtml {
  html: HTMLElement | null;
  url: string;
  /** Why there is no HTML, when the background script could say. */
  reason?: 'unscriptable' | 'no-tab';
}

/** Pages Chrome refuses to inject into, recognised from the URL alone. */
function restrictedKind(url: string): string | null {
  const u = url.toLowerCase();
  if (u.startsWith('chrome://') || u.startsWith('edge://') || u.startsWith('brave://')) return 'a browser settings page';
  if (u.startsWith('chrome-extension://') || u.startsWith('moz-extension://')) return 'an extension page';
  if (u.startsWith('about:')) return 'the new tab page';
  if (u.startsWith('view-source:')) return 'a view-source page';
  if (u.startsWith('file://')) return 'a local file';
  if (u.includes('chromewebstore.google.com') || u.includes('chrome.google.com/webstore')) return 'the Chrome Web Store';
  if (u.endsWith('.pdf')) return 'a PDF';
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

export async function getHTML(): Promise<PageHtml> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ message: 'getHTML' }, (response) => {
      // A dead message port sets lastError; reading it also stops Chrome logging it as unchecked.
      const lastError = chrome.runtime.lastError;
      if (!response) {
        reject(new Error(lastError?.message ?? 'No response from background script.'));
        return;
      }
      const url = typeof response.url === 'string' ? response.url : '';
      const reason = response.reason === 'unscriptable' || response.reason === 'no-tab' ? response.reason : undefined;
      if (response.html) {
        // DOMParser is guaranteed inert: subresources don't load, scripts
        // don't execute, even when the resulting document is later
        // appended. Safer than innerHTML on a disconnected <html> node
        // even though both are effectively safe with our current usage.
        const doc = new DOMParser().parseFromString(response.html, 'text/html');
        resolve({ html: doc.documentElement, url });
      } else {
        resolve(reason ? { html: null, url, reason } : { html: null, url });
      }
    });
  });
}
