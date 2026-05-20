// Apply action behavior based on user preference (sidepanel vs popup).
// Source of truth lives in chrome.storage.local under key "mode".
const POPUP_PATH = 'index.html';
const CONTEXT_MENU_ID = 'metaspry-open';

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

// --- Context menu: "Open Metaspry" on any page right-click -----------------

function ensureContextMenu() {
  // Remove first then create, so re-installs on update don't throw
  // "duplicate id" errors when the menu already exists from a prior install.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Open Metaspry',
      contexts: ['page', 'selection', 'link', 'image', 'frame'],
    });
  });
}

async function openExtension(tab) {
  const { mode } = await chrome.storage.local.get('mode');
  const isPopup = mode === 'popup';

  if (isPopup) {
    // openPopup() is restricted to user-gesture contexts. contextMenus.onClicked
    // qualifies. Chrome 127+.
    try {
      await chrome.action.openPopup();
      return;
    } catch (err) {
      console.warn('action.openPopup failed, falling back to side panel:', err);
    }
  }

  if (!tab) {
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    tab = active;
  }
  if (tab?.windowId != null) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (err) {
      console.error('sidePanel.open failed:', err);
    }
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
  if (area !== 'local' || !changes.mode) {
    return;
  }
  applyMode(changes.mode.newValue);
  // Tell any open extension surfaces to close themselves so the next icon
  // click reopens cleanly in the new mode rather than reusing the orphaned UI.
  chrome.runtime.sendMessage({ message: 'mode-changed', mode: changes.mode.newValue })
    .catch(() => { /* no listeners is fine */ });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  openExtension(tab);
});

readAndApplyMode();
ensureContextMenu();

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
