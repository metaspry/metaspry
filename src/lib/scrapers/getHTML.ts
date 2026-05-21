export interface PageHtml {
  html: HTMLElement | null;
  url: string;
}

export async function getHTML(): Promise<PageHtml> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ message: 'getHTML' }, (response) => {
      if (!response) {
        reject(new Error('No response from background script.'));
        return;
      }
      const url = typeof response.url === 'string' ? response.url : '';
      if (response.html) {
        // DOMParser is guaranteed inert: subresources don't load, scripts
        // don't execute, even when the resulting document is later
        // appended. Safer than innerHTML on a disconnected <html> node
        // even though both are effectively safe with our current usage.
        const doc = new DOMParser().parseFromString(response.html, 'text/html');
        resolve({ html: doc.documentElement, url });
      } else {
        resolve({ html: null, url });
      }
    });
  });
}
