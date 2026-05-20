// Apply action behavior based on user preference (sidepanel vs popup).
// Source of truth lives in chrome.storage.local under key "mode".
const POPUP_PATH = 'index.html';

function applyMode(mode) {
  const next = mode === 'popup' ? 'popup' : 'sidepanel';
  if (next === 'popup') {
    chrome.action.setPopup({ popup: POPUP_PATH });
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: false })
      .catch((error) => console.error(error));
  } else {
    chrome.action.setPopup({ popup: '' });
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));
  }
}

function readAndApplyMode() {
  chrome.storage.local.get('mode', (result) => {
    applyMode(result.mode);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  readAndApplyMode();
});

chrome.runtime.onStartup.addListener(() => {
  readAndApplyMode();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.mode) {
    return;
  }
  applyMode(changes.mode.newValue);
});

readAndApplyMode();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'getHTML') {
    const queryOptions = { active: true, lastFocusedWindow: true };
    chrome.tabs.query(queryOptions, (tabs) => {
      let [tab] = tabs;
      if (tab) {
        const tabUrl = tab.url || '';
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: () => {
            return document.documentElement.outerHTML;
          }
        }, (result) => {
          const htmlContent = result[0]?.result;
          if (htmlContent) {
            sendResponse({ html: htmlContent, url: tabUrl });
          } else {
            sendResponse({ html: null, url: tabUrl });
          }
        });
      } else {
        sendResponse({ html: null, url: '' });
      }
    });
    return true;
  }
});
