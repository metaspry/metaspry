import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getHtmlRequest, parseGetHtmlResponse } from '../messaging/protocol';

// static/scripts/background.js is a classic service worker that nothing bundles, so the test
// runs its source against a fake `chrome` and drives the getHTML message handler it registers.
const source = readFileSync(join(process.cwd(), 'static/scripts/background.js'), 'utf8');

type Tab = { id?: number; url?: string; favIconUrl?: string };
type Listener = (request: unknown, sender: unknown, sendResponse: (r: unknown) => void) => unknown;

function loadBackground(tabs: Tab[] | undefined, injected: unknown, opts: { throwSync?: boolean } = {}) {
  let onMessage: Listener | undefined;
  const noopEvent = { addListener: () => {} };
  // Chrome runs the completion callback later, outside the handler's try/catch; so does this fake,
  // or a throw in the callback would be caught and passed off as the `unscriptable` answer.
  const executeScript = vi.fn((_opts: unknown, cb: (r: unknown) => void) => {
    if (opts.throwSync) throw new Error('bad arguments');
    queueMicrotask(() => cb(injected));
  });
  const query = vi.fn((_q: unknown, cb: (t: Tab[] | undefined) => void) => cb(tabs));
  const chrome = {
    action: { setPopup: () => {}, openPopup: () => Promise.resolve() },
    sidePanel: { setPanelBehavior: () => Promise.resolve(), open: () => Promise.resolve() },
    storage: { local: { get: () => {} }, onChanged: noopEvent },
    contextMenus: { removeAll: () => {}, create: () => {}, onClicked: noopEvent },
    runtime: {
      lastError: undefined,
      onInstalled: noopEvent,
      onStartup: noopEvent,
      onMessage: { addListener: (fn: Listener) => { onMessage = fn; } },
    },
    tabs: { query },
    scripting: { executeScript },
  };
  new Function('chrome', source)(chrome);
  return {
    executeScript,
    query,
    ask(request: object = getHtmlRequest(7)): Promise<Record<string, unknown>> {
      return new Promise((resolve) => {
        onMessage?.(request, {}, (r) => {
          // Every reply on every path is already a canonical GetHtmlResponse (the typed protocol).
          expect(parseGetHtmlResponse(r)).toEqual(r);
          resolve(r as Record<string, unknown>);
        });
      });
    },
  };
}

const tabA: Tab = { id: 1, url: 'https://a.com/', favIconUrl: 'https://a.com/icon.png' };

describe('background getHTML handler', () => {
  it('labels the result with the injected document URL, not the queried tab URL', async () => {
    const bg = loadBackground([tabA], [{ result: { html: '<html></html>', href: 'https://b.com/page' } }]);
    const r = await bg.ask();
    expect(r.url).toBe('https://b.com/page');
    expect(r.html).toBe('<html></html>');
  });

  it('drops the tab favicon when the document is no longer the queried page', async () => {
    const bg = loadBackground([tabA], [{ result: { html: '<html></html>', href: 'https://b.com/page' } }]);
    expect((await bg.ask()).favIconUrl).toBeNull();
  });

  it('keeps the tab favicon for the same document, fragment aside', async () => {
    const bg = loadBackground([tabA], [{ result: { html: '<html></html>', href: 'https://a.com/#top' } }]);
    const r = await bg.ask();
    expect(r.url).toBe('https://a.com/#top');
    expect(r.favIconUrl).toBe('https://a.com/icon.png');
  });

  it('falls back to the tab URL when the document reports no href', async () => {
    const bg = loadBackground([tabA], [{ result: { html: '<html></html>' } }]);
    const r = await bg.ask();
    expect(r.url).toBe('https://a.com/');
    expect(r.favIconUrl).toBe('https://a.com/icon.png');
  });

  it('answers unscriptable when the injection returns nothing', async () => {
    const bg = loadBackground([tabA], undefined);
    expect(await bg.ask()).toMatchObject({ html: null, url: 'https://a.com/', reason: 'unscriptable' });
  });

  it('answers unscriptable when executeScript throws synchronously', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bg = loadBackground([tabA], undefined, { throwSync: true });
    expect(await bg.ask()).toMatchObject({ html: null, url: 'https://a.com/', reason: 'unscriptable' });
    warn.mockRestore();
  });

  it("queries the asking page's window, else the last-focused window", async () => {
    const bg = loadBackground([tabA], [{ result: { html: '<html></html>' } }]);
    await bg.ask();
    expect(bg.query.mock.calls[0]?.[0]).toEqual({ active: true, windowId: 7 });
    await bg.ask(getHtmlRequest());
    expect(bg.query.mock.calls[1]?.[0]).toEqual({ active: true, lastFocusedWindow: true });
  });

  it('answers no-tab when tabs.query yields undefined', async () => {
    const bg = loadBackground(undefined, undefined);
    expect(await bg.ask()).toMatchObject({ html: null, url: '', reason: 'no-tab' });
    expect(bg.executeScript).not.toHaveBeenCalled();
  });
});
