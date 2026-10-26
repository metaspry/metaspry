import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  GET_HTML,
  getHtmlRequest,
  MODE_KEY,
  parseGetHtmlResponse,
  parseMode,
  POPUP_PATH,
} from './protocol';

describe('getHtmlRequest', () => {
  it('names the asking window when it is known, and only then', () => {
    expect(getHtmlRequest(7)).toEqual({ message: 'getHTML', windowId: 7 });
    expect(getHtmlRequest()).toEqual({ message: 'getHTML' });
    expect('windowId' in getHtmlRequest()).toBe(false);
  });
});

describe('parseGetHtmlResponse', () => {
  it('keeps a well-formed captured reply as is', () => {
    const r = { html: '<html></html>', url: 'https://a.com/', favIconUrl: 'https://a.com/i.png' };
    expect(parseGetHtmlResponse(r)).toEqual(r);
  });

  it('keeps a known failure reason', () => {
    expect(parseGetHtmlResponse({ html: null, url: '', favIconUrl: null, reason: 'no-tab' })).toEqual({ html: null, url: '', favIconUrl: null, reason: 'no-tab' });
  });

  it('turns off-shape fields into their safe defaults', () => {
    expect(parseGetHtmlResponse({ html: 42, url: null, favIconUrl: '', reason: 'gone' })).toEqual({ html: null, url: '', favIconUrl: null });
    expect(parseGetHtmlResponse({ html: '' })).toEqual({ html: null, url: '', favIconUrl: null });
  });

  it('is null when there was no reply object (dead port)', () => {
    for (const raw of [undefined, null, '', 'x', 0]) expect(parseGetHtmlResponse(raw)).toBeNull();
  });
});

describe('parseMode', () => {
  it('reads popup as popup and anything else as the side panel', () => {
    expect(parseMode('popup')).toBe('popup');
    for (const raw of ['sidepanel', undefined, null, 'POPUP', 1]) expect(parseMode(raw)).toBe('sidepanel');
  });
});

// background.js is an unbundled classic worker that repeats these literals; the manifest names the
// page. A rename on one side only must fail here, not in the store build.
describe('the protocol literals match static/scripts/background.js and the manifest', () => {
  const bg = readFileSync('static/scripts/background.js', 'utf8');
  const manifest = JSON.parse(readFileSync('static/manifest.json', 'utf8')) as { side_panel: { default_path: string } };

  it('the getHTML message name', () => {
    expect(bg).toContain(`request.message === '${GET_HTML}'`);
    expect(bg.match(/request\.message === '([^']+)'/g)).toHaveLength(1);
  });

  it('the mode storage key, read, watched and applied', () => {
    expect(bg).toContain(`chrome.storage.local.get('${MODE_KEY}'`);
    expect(bg).toContain(`changes.${MODE_KEY}`);
    expect(bg).toContain(`result.${MODE_KEY}`);
  });

  it('the popup / side panel page', () => {
    expect(bg).toContain(`const POPUP_PATH = '${POPUP_PATH}';`);
    expect(manifest.side_panel.default_path).toBe(POPUP_PATH);
  });

  it('every failure reason the worker sends is a CaptureFailure', () => {
    const reasons = [...bg.matchAll(/reason: '([^']+)'/g)].map((m) => m[1]);
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) {
      expect(parseGetHtmlResponse({ html: null, url: '', favIconUrl: null, reason })?.reason).toBe(reason);
    }
  });

  it('every reply object the worker builds carries the three wire fields', () => {
    const replies = [...bg.matchAll(/sendResponse\(\{([^}]*)\}\)/g)].map((m) => m[1] ?? '');
    expect(replies.length).toBeGreaterThanOrEqual(4);
    for (const body of replies) {
      for (const key of ['html', 'url', 'favIconUrl']) expect(body).toMatch(new RegExp(`\\b${key}\\b`));
    }
  });
});
