import { safeHref } from '../util/safe-href';

/**
 * Open `url` in a new browser tab: the one way components do it (architecture review Medium 14;
 * History used to call `chrome.tabs.create` unguarded). Only http(s) URLs open, so a stored
 * `(unknown)` or a `javascript:` value never becomes an extension-relative or script URL. Uses
 * `chrome.tabs.create` when the page has it, else `window.open` (the `npm run dev` page). Never
 * throws out of a click handler. Returns whether a tab was asked for.
 */
export function openTab(url: string, { active }: { active: boolean }): boolean {
  const href = safeHref(url);
  if (!href) return false;
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      // A rejected create (window closing, policy) is not the click's problem.
      void Promise.resolve(chrome.tabs.create({ url: href, active })).catch(() => undefined);
      return true;
    }
    if (typeof window !== 'undefined') {
      window.open(href, '_blank', 'noopener');
      return true;
    }
  } catch {
    /* no extension context, or the browser refused synchronously */
  }
  return false;
}
