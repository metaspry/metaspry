export async function getWindow(): Promise<Window | null> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ message: 'getWindow' }, (response) => {
      if (response && response.window) {
        // Resolve with the received window object
        resolve(response.window);
      } else {
        reject(new Error('No response or window object found'));
      }
    });
  });
}