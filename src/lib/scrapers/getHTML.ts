export async function getHTML(): Promise<HTMLElement | null> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ message: 'getHTML' }, (response) => {
      if (response && response.html) {
        // Parse the received HTML string to create an HTMLElement
        const tempElement = document.createElement('html');
        tempElement.innerHTML = response.html;
        
        // Check if the element exists
        if (tempElement) {
          resolve(tempElement);
        
        } else {
          reject(new Error('HTML element not found'));
        }
      } else {
        reject(new Error('No response or HTML content found'));
      }
    });
  });
}