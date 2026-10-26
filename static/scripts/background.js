// Apply action behavior based on user preference (sidepanel vs popup).
// Source of truth lives in chrome.storage.local under key "mode".
//
// Wire protocol: the literals here ('getHTML', the reply shape, 'mode', 'index.html') are defined
// for the pages in src/lib/messaging/protocol.ts. This file is not bundled and cannot import it;
// src/lib/messaging/protocol.spec.ts fails when the two drift. Change both together.
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

// The service worker is killed and restarted constantly, and `currentMode` resets to its default
// each time; these three listeners plus the top-level readAndApplyMode() below are what keep the
// right-click action from opening the surface the user did not choose.
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

// A fragment change keeps the same document (and favicon); anything else is another page.
function stripHash(url) {
  const i = url.indexOf('#');
  return i === -1 ? url : url.slice(0, i);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'getHTML') {
    // The window that hosts the asking side panel / popup (E-19). Without it (dev page, or the
    // page's windows.getCurrent failed) fall back to the last-focused window, as before.
    const queryOptions = typeof request.windowId === 'number'
      ? { active: true, windowId: request.windowId }
      : { active: true, lastFocusedWindow: true };
    chrome.tabs.query(queryOptions, (tabs) => {
      let [tab] = tabs ?? [];
      if (tab && tab.id != null) {
        const tabUrl = tab.url || '';
        // Chrome's own resolution of the page's favicon (covers the implicit /favicon.ico that
        // `getMetaTags` cannot see). Readable through the host permission; null until loaded.
        const favIconUrl = typeof tab.favIconUrl === 'string' && tab.favIconUrl ? tab.favIconUrl : null;
        try {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
              // Cap what crosses the message channel. A page with a huge inline payload could
              // otherwise push tens of megabytes through it; the audit only needs <head> and the
              // start of <body>, and DOMParser copes with a truncated document.
              const MAX_HTML = 3_000_000;
              const html = document.documentElement.outerHTML;
              // The document's own URL labels the result: a navigation that commits between the tab
              // query and this injection would otherwise file B's DOM under A's URL.
              return { html: html.length > MAX_HTML ? html.slice(0, MAX_HTML) : html, href: location.href };
            }
          }, (result) => {
            // On chrome:// pages, the New Tab page, the Web Store, PDFs and policy-blocked pages the
            // injection fails: `result` itself is undefined and lastError is set. Reading lastError
            // and always answering keeps the popup from hanging on a promise that never settles.
            void chrome.runtime.lastError;
            const captured = Array.isArray(result) ? result[0]?.result : undefined;
            const htmlContent = captured && typeof captured.html === 'string' ? captured.html : '';
            if (htmlContent) {
              const href = typeof captured.href === 'string' ? captured.href : '';
              // The favicon was read with the tab, before the injection. If the document moved on
              // since, it belongs to the previous page: drop it rather than file it under B.
              const sameDoc = !href || stripHash(href) === stripHash(tabUrl);
              sendResponse({ html: htmlContent, url: href || tabUrl, favIconUrl: sameDoc ? favIconUrl : null });
            } else {
              sendResponse({ html: null, url: tabUrl, favIconUrl, reason: 'unscriptable' });
            }
          });
        } catch (err) {
          // executeScript validates its arguments synchronously. Without this the throw escaped,
          // sendResponse never ran, the port closed, and the popup showed the very message E4
          // exists to remove: "No response from background script."
          console.warn('executeScript failed', err);
          sendResponse({ html: null, url: tabUrl, favIconUrl, reason: 'unscriptable' });
        }
      } else {
        sendResponse({ html: null, url: tab?.url || '', favIconUrl: null, reason: 'no-tab' });
      }
    });
    return true;
  }
});
