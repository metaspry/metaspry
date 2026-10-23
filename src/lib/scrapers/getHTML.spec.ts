import { describe, it, expect, vi, afterEach } from 'vitest';
import { CAPTURE_TIMEOUT_MS, getHTML, restrictedKind, unscriptableMessage } from './getHTML';

describe('unscriptableMessage', () => {
  it('names a browser settings page', () => {
    expect(unscriptableMessage('chrome://extensions')).toContain('browser settings page');
  });

  it('names the Web Store', () => {
    expect(unscriptableMessage('https://chromewebstore.google.com/detail/x')).toContain('Chrome Web Store');
  });

  it('names a PDF', () => {
    expect(unscriptableMessage('https://acme.com/report.pdf')).toContain('PDF');
  });

  it('names the new tab page for an about: URL', () => {
    expect(unscriptableMessage('about:newtab')).toContain('new tab page');
  });

  it('says there is no tab, rather than blaming the new tab page', () => {
    const msg = unscriptableMessage('', 'no-tab');
    expect(msg).toContain('No active tab');
    expect(msg).not.toContain('new tab page');
  });

  it('stays generic for an unknown page with no URL', () => {
    const msg = unscriptableMessage('');
    expect(msg).toContain("can't be scanned");
    expect(msg).not.toContain('new tab page');
  });

  it('falls back to a plain explanation for a normal URL', () => {
    const msg = unscriptableMessage('https://acme.com/');
    expect(msg).toContain("can't be scanned");
    expect(msg).not.toContain('background script');
  });

  it('never mentions our plumbing', () => {
    for (const u of ['chrome://newtab', 'file:///c:/x.html', 'https://acme.com/']) {
      expect(unscriptableMessage(u)).not.toMatch(/background script|sendResponse/);
    }
  });
});

describe('restrictedKind', () => {
  it('recognises the pages Chrome blocks extensions on', () => {
    expect(restrictedKind('chrome://settings')).toBe('a browser settings page');
    expect(restrictedKind('about:newtab')).toBe('the new tab page');
    expect(restrictedKind('chrome://newtab/')).toBe('the new tab page');
    expect(restrictedKind('https://chromewebstore.google.com/detail/x')).toBe('the Chrome Web Store');
    expect(restrictedKind('https://acme.com/report.pdf')).toBe('a PDF');
    expect(restrictedKind('view-source:https://acme.com/')).toBe('a view-source page');
  });

  it('returns null for a normal web page', () => {
    expect(restrictedKind('https://acme.com/')).toBeNull();
  });

  it('matches the Web Store and PDFs on host and path, not anywhere in the URL', () => {
    expect(restrictedKind('https://chrome.google.com/webstore/detail/x')).toBe('the Chrome Web Store');
    expect(restrictedKind('https://acme.com/report.PDF?dl=1')).toBe('a PDF');
    expect(restrictedKind('https://www.google.com/search?q=chromewebstore.google.com')).toBeNull();
    expect(restrictedKind('https://acme.com/?ref=chromewebstore.google.com')).toBeNull();
    expect(restrictedKind('https://www.google.com/search?q=annual+report.pdf')).toBeNull();
    expect(restrictedKind('not a url')).toBeNull();
    expect(restrictedKind('https://chrome.google.com/intl/en/chrome/')).toBeNull();
    expect(restrictedKind('https://evil-chromewebstore.google.com.example/detail/x')).toBeNull();
  });
});

describe('getHTML request', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubChrome(response: unknown) {
    const sendMessage = vi.fn((_msg: unknown, cb: (r: unknown) => void) => cb(response));
    vi.stubGlobal('chrome', { runtime: { sendMessage, lastError: undefined } });
    return sendMessage;
  }

  it('sends the hosting window id when given', async () => {
    const sendMessage = stubChrome({ html: '<html><head><title>x</title></head></html>', url: 'https://a.com/z' });
    const page = await getHTML(42);
    expect(sendMessage.mock.calls[0]?.[0]).toEqual({ message: 'getHTML', windowId: 42 });
    expect(page.url).toBe('https://a.com/z');
    expect(page.html).not.toBeNull();
  });

  it('omits windowId when there is none', async () => {
    const sendMessage = stubChrome({ html: null, url: '', reason: 'no-tab' });
    const page = await getHTML();
    expect(sendMessage.mock.calls[0]?.[0]).toEqual({ message: 'getHTML' });
    expect(Object.keys(sendMessage.mock.calls[0]?.[0] as object)).not.toContain('windowId');
    expect(page.reason).toBe('no-tab');
  });

  describe('capture timeout', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('rejects when the background never answers', async () => {
      vi.useFakeTimers();
      vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn(), lastError: undefined } });
      const page = getHTML(1);
      const settled = expect(page).rejects.toThrow('Timed out waiting for the page after 15 s.');
      await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);
      await settled;
    });

    it('ignores an answer that arrives after the timeout', async () => {
      vi.useFakeTimers();
      let answer: ((r: unknown) => void) | undefined;
      const sendMessage = vi.fn((_msg: unknown, cb: (r: unknown) => void) => {
        answer = cb;
      });
      vi.stubGlobal('chrome', { runtime: { sendMessage, lastError: undefined } });
      const parse = vi.spyOn(DOMParser.prototype, 'parseFromString');
      const page = getHTML(1, 1000);
      const settled = expect(page).rejects.toThrow('Timed out');
      await vi.advanceTimersByTimeAsync(1000);
      await settled;
      answer?.({ html: '<html></html>', url: 'https://a.com/' });
      expect(parse).not.toHaveBeenCalled();
      parse.mockRestore();
    });

    it('rejects at once and clears the timer when sendMessage throws', async () => {
      vi.useFakeTimers();
      vi.stubGlobal('chrome', { runtime: { sendMessage: () => { throw new TypeError('no context'); }, lastError: undefined } });
      await expect(getHTML(1)).rejects.toThrow('no context');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not fire after a prompt answer', async () => {
      vi.useFakeTimers();
      stubChrome({ html: null, url: 'https://a.com/', reason: 'unscriptable' });
      const page = await getHTML(1);
      expect(page.reason).toBe('unscriptable');
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
