import { describe, it, expect, vi, afterEach } from 'vitest';
import { getHTML, restrictedKind, unscriptableMessage } from './getHTML';

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
});
