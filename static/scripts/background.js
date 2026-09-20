// Apply action behavior based on user preference (sidepanel vs popup).
// Source of truth lives in chrome.storage.local under key "mode".
const POPUP_PATH = 'index.html';
const CONTEXT_MENU_ID = 'metaspry-open';
const CONTEXT_MENU_TITLE = 'Spy this page with Metaspry';

// In-memory mirror of the stored mode. Reading from chrome.storage in the
// contextMenus.onClicked handler is async, and the user-gesture window for
// chrome.action.openPopup / chrome.sidePanel.open is short. Keep it hot.
let currentMode = 'sidepanel';

function applyMode(mode) {
  currentMode = mode === 'popup' ? 'popup' : 'sidepanel';
  if (currentMode === 'popup') {
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

// --- Context menu: page right-click ----------------------------------------

function ensureContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: CONTEXT_MENU_TITLE,
      contexts: ['page', 'selection', 'link', 'image', 'frame'],
    });
  });
}

function openExtensionFromGesture(tab) {
  // Called synchronously inside a user-gesture handler so chrome.sidePanel.open
  // / chrome.action.openPopup retain gesture context. NO awaits before the
  // open() call.
  if (currentMode === 'popup') {
    chrome.action.openPopup().catch((err) => {
      // Older Chrome (<127) or non-popup-allowed context - fall back to
      // side panel so the right-click never feels broken.
      console.warn('action.openPopup unavailable, falling back to side panel:', err);
      if (tab?.windowId != null) {
        chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
      }
    });
    return;
  }
  if (tab?.windowId != null) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  readAndApplyMode();
  ensureContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  readAndApplyMode();
  ensureContextMenu();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.mode) return;
  applyMode(changes.mode.newValue);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  openExtensionFromGesture(tab);
});

readAndApplyMode();
ensureContextMenu();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'getHTML') {
    const queryOptions = { active: true, lastFocusedWindow: true };
    chrome.tabs.query(queryOptions, (tabs) => {
      let [tab] = tabs;
      if (tab && tab.id != null) {
        const tabUrl = tab.url || '';
        try {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
              return document.documentElement.outerHTML;
            }
          }, (result) => {
            // On chrome:// pages, the New Tab page, the Web Store, PDFs and policy-blocked pages the
            // injection fails: `result` itself is undefined and lastError is set. Reading lastError
            // and always answering keeps the popup from hanging on a promise that never settles.
            // Reading lastError also stops Chrome logging it as unchecked.
            void chrome.runtime.lastError;
            const htmlContent = Array.isArray(result) ? result[0]?.result : undefined;
            if (htmlContent) {
              sendResponse({ html: htmlContent, url: tabUrl });
            } else {
              sendResponse({ html: null, url: tabUrl, reason: 'unscriptable' });
            }
          });
        } catch (err) {
          // executeScript validates its arguments synchronously. Without this the throw escaped,
          // sendResponse never ran, the port closed, and the popup showed the very message E4
          // exists to remove: "No response from background script."
          console.warn('executeScript failed', err);
          sendResponse({ html: null, url: tabUrl, reason: 'unscriptable' });
        }
      } else {
        sendResponse({ html: null, url: tab?.url || '', reason: 'no-tab' });
      }
    });
    return true;
  }
});
