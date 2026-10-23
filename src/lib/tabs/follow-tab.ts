/**
 * Keeps the side panel / popup honest about which page its results describe (E-1, E-19). The page
 * listens to its own window's active tab and compares that tab's URL with the URL it scanned; it
 * never scans on its own.
 */
import { normalizeScanUrl } from '../cloud/scan-identity';
import { restrictedKind } from '../scrapers/getHTML';

export type TabState = 'same' | 'other' | 'restricted' | 'unknown';

/**
 * How the window's active tab relates to the scanned page. Both URLs go through `normalizeScanUrl`,
 * so a `#section` jump or a trailing slash is not a page change. No scanned URL = nothing to flag.
 */
export function tabState(scannedUrl: string | null | undefined, activeUrl: string | null | undefined): TabState {
  const scanned = normalizeScanUrl(scannedUrl);
  if (!scanned) return 'same';
  const active = normalizeScanUrl(activeUrl);
  if (!active) return 'unknown';
  if (active === scanned) return 'same';
  if (restrictedKind(active)) return 'restricted';
  return 'other';
}

/** `acme.com/blog/post-1?ref=x`: host, path (bare `/` dropped) and query. Falls back to the input. */
export function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    if (!u.host) return url;
    return `${u.host}${u.pathname === '/' ? '' : u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

/** Hostname for the page icon's letter tile; '' when the URL does not parse. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

let hostWindow: Promise<number | null> | null = null;

/**
 * The window that hosts this extension page (side panel or popup), memoised. `null` outside the
 * extension (dev page) or when the lookup fails; callers then fall back to the last-focused window.
 */
export function getHostWindowId(): Promise<number | null> {
  if (hostWindow) return hostWindow;
  if (typeof chrome === 'undefined' || !chrome.windows?.getCurrent) return Promise.resolve(null);
  hostWindow = (async () => {
    try {
      const win = await chrome.windows.getCurrent();
      return typeof win?.id === 'number' ? win.id : null;
    } catch {
      return null;
    }
  })();
  return hostWindow;
}

/**
 * Reports the URL of `windowId`'s active tab now and after every tab switch, navigation or History
 * API route change in that window ('' when the tab has no readable URL). Each event re-queries the
 * window instead of trusting the payload, and only the newest query's answer is delivered, so
 * events arriving out of order cannot leave an old URL behind. Returns the unsubscribe.
 */
export function followActiveTab(windowId: number, onActiveUrl: (url: string) => void): () => void {
  let seq = 0;
  let stopped = false;

  async function read() {
    const mine = ++seq;
    let url = '';
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      url = tab?.url ?? '';
    } catch {
      url = '';
    }
    if (!stopped && mine === seq) onActiveUrl(url);
  }

  const onActivated = (info: chrome.tabs.TabActiveInfo) => {
    if (info.windowId === windowId) void read();
  };
  const onUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
    if (changeInfo.url && tab.active && tab.windowId === windowId) void read();
  };
  // A prerendered tab swapped in under a new id; the event carries no window, so just re-read ours.
  const onReplaced = () => {
    void read();
  };

  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.tabs.onReplaced.addListener(onReplaced);
  void read();

  return () => {
    stopped = true;
    chrome.tabs.onActivated.removeListener(onActivated);
    chrome.tabs.onUpdated.removeListener(onUpdated);
    chrome.tabs.onReplaced.removeListener(onReplaced);
  };
}
