/**
 * The wire protocol between the extension pages (side panel / popup) and
 * `static/scripts/background.js`.
 *
 * background.js is a classic service worker that nothing bundles, so it cannot import this module
 * and repeats the literals. `protocol.spec.ts` reads its source (and `static/manifest.json`) and
 * fails when one drifts; change both sides together.
 */

/** `chrome.runtime.sendMessage` request: capture the active tab of `windowId`. */
export const GET_HTML = 'getHTML';

export interface GetHtmlRequest {
  message: typeof GET_HTML;
  /** The window hosting the asking page. Omitted: the background uses the last-focused window. */
  windowId?: number;
}

/** Why a capture produced no HTML. */
export type CaptureFailure = 'unscriptable' | 'no-tab';

/** The background's answer, as sent over the wire. */
export interface GetHtmlResponse {
  /** The page's `outerHTML` (capped at 3,000,000 characters), or `null` when it could not be read. */
  html: string | null;
  /** The captured document's `location.href`, else the tab's URL; `''` when there is no tab. */
  url: string;
  /** Chrome's resolved favicon for the tab; `null` when unknown or the document moved on. */
  favIconUrl: string | null;
  reason?: CaptureFailure;
}

export function getHtmlRequest(windowId?: number): GetHtmlRequest {
  return typeof windowId === 'number' ? { message: GET_HTML, windowId } : { message: GET_HTML };
}

/**
 * A reply as the page may trust it: anything off-shape becomes its safe default (`null` html,
 * `''` url, `null` icon, no reason). `null` when there was no reply object at all.
 */
export function parseGetHtmlResponse(raw: unknown): GetHtmlResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const html = typeof r.html === 'string' && r.html ? r.html : null;
  const url = typeof r.url === 'string' ? r.url : '';
  const favIconUrl = typeof r.favIconUrl === 'string' && r.favIconUrl ? r.favIconUrl : null;
  const reason = r.reason === 'unscriptable' || r.reason === 'no-tab' ? r.reason : undefined;
  // Spread-in only when present: `exactOptionalPropertyTypes` forbids an explicit undefined.
  return reason ? { html, url, favIconUrl, reason } : { html, url, favIconUrl };
}

/** `chrome.storage.local` key the pages write and background.js applies to the toolbar action. */
export const MODE_KEY = 'mode';

export type Mode = 'sidepanel' | 'popup';

/** Anything but `'popup'` is the side panel, the default. */
export function parseMode(raw: unknown): Mode {
  return raw === 'popup' ? 'popup' : 'sidepanel';
}

/** The extension page both surfaces load: the action popup and `side_panel.default_path`. */
export const POPUP_PATH = 'index.html';
