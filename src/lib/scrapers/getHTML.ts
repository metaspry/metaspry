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
        const tempElement = document.createElement('html');
        tempElement.innerHTML = response.html;
        resolve({ html: tempElement, url });
      } else {
        resolve({ html: null, url });
      }
    });
  });
}
