/**
 * Turns a failed scan into what the error card shows: a plain reason, plus the raw text for the
 * "Details" disclosure. The raw exception ("Cannot read properties of undefined (reading
 * 'sendMessage')") is never the headline.
 */
export interface ScanError {
  /** One or two plain sentences: what happened and what to do. */
  reason: string;
  /** The raw message, shown only behind "Details". Null when there is nothing more to show. */
  detail: string | null;
}

export const BLOCKED_PAGE_REASON =
  "This page can't be scanned (browser or store page). Open a normal web page and try again.";

export function describeScanError(error: unknown): ScanError {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const detail = raw.trim() ? raw.trim() : null;
  const m = raw.toLowerCase();
  // The runtime message channel to the background script: missing (dev page, extension reloaded)
  // or answered by nobody (a page Chrome would not inject into).
  if (
    m.includes('sendmessage') ||
    m.includes('receiving end does not exist') ||
    m.includes('could not establish connection') ||
    m.includes('no response from background') ||
    m.includes('message port closed') ||
    m.includes('extension context invalidated')
  ) {
    return { reason: BLOCKED_PAGE_REASON, detail };
  }
  if (m.includes('cannot access') || m.includes('permission') || m.includes('cannot be scripted')) {
    return { reason: "Metaspry doesn't have permission to read this page. Reload the page, then scan it again.", detail };
  }
  if (m.includes('invalid url') || m.includes('unsupported')) {
    return { reason: "This address isn't a web page Metaspry can scan. Open an http(s) page and try again.", detail };
  }
  return {
    reason: 'Something went wrong while reading this page. Try again; if it keeps happening, report a bug with the details below.',
    detail,
  };
}
