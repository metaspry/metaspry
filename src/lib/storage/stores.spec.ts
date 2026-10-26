import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { fakeStorage, type FakeStorage } from '../../test/fake-storage';

// The chrome.storage-backed stores (architecture review Medium 11: history, pinned and shortcuts had
// no unit tests). Each test loads fresh module instances against a fresh fake storage.

let fake: FakeStorage;

function useStorage(initial: Record<string, unknown> = {}): FakeStorage {
  fake = fakeStorage(initial);
  vi.stubGlobal('chrome', fake.chrome);
  return fake;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const entry = (url: string, timestamp = 1) => ({ url, hostname: new URL(url).hostname, title: url, score: 80, timestamp });

describe('history', () => {
  it('hydrates, capped at 10; a corrupt value is an empty history', async () => {
    useStorage({ history: Array.from({ length: 14 }, (_, i) => entry(`https://a.com/${i}`)) });
    const h = await import('./history');
    await h.initHistory();
    expect(get(h.history)).toHaveLength(10);
    expect(h.parseHistory('nope')).toEqual([]);
    expect(h.parseHistory(undefined)).toEqual([]);
  });

  it('pushHistory puts the newest first, replaces the same URL, keeps 10, and persists', async () => {
    useStorage({ history: [] });
    const h = await import('./history');
    await h.initHistory();
    for (let i = 0; i < 11; i++) h.pushHistory(entry(`https://a.com/${i}`, i));
    h.pushHistory(entry('https://a.com/5', 99));
    const list = get(h.history);
    expect(list).toHaveLength(10);
    expect(list[0]).toMatchObject({ url: 'https://a.com/5', timestamp: 99 });
    expect(list.filter((e) => e.url === 'https://a.com/5')).toHaveLength(1);
    await fake.flush();
    expect((fake.data.history as unknown[]).length).toBe(10);
  });

  it('a scan recorded in the other surface shows here and is not written back', async () => {
    useStorage({ history: [] });
    const h = await import('./history');
    await h.initHistory();
    fake.sets.length = 0;
    await fake.external('history', [entry('https://popup.com/')]);
    expect(get(h.history).map((e) => e.url)).toEqual(['https://popup.com/']);
    expect(fake.sets).toEqual([]);
  });

  it('a second initHistory does not double the writes', async () => {
    useStorage({ history: [] });
    const h = await import('./history');
    await h.initHistory();
    await h.initHistory();
    fake.sets.length = 0;
    h.clearHistory();
    await fake.flush();
    expect(fake.sets).toEqual([{ history: [] }]);
  });
});

describe('pinned', () => {
  it('stores keys lower-cased, toggles case-insensitively, persists as an array', async () => {
    useStorage({ pinnedKeys: ['OG:Title'] });
    const p = await import('./pinned');
    await p.initPinned();
    expect(p.isPinned(get(p.pinned), 'og:title')).toBe(true);
    p.togglePinned('OG:TITLE');
    expect(get(p.pinned).size).toBe(0);
    p.togglePinned('Twitter:Card');
    await fake.flush();
    expect(fake.data.pinnedKeys).toEqual(['twitter:card']);
  });

  it('a corrupt value is no pins', async () => {
    useStorage({ pinnedKeys: { a: 1 } });
    const p = await import('./pinned');
    await p.initPinned();
    expect(get(p.pinned).size).toBe(0);
  });
});

describe('shortcuts preference', () => {
  it('only an explicit false turns single-key shortcuts off', async () => {
    useStorage({});
    const s = await import('./shortcuts');
    await s.initShortcutsPref();
    expect(get(s.shortcutsEnabled)).toBe(true);
    for (const raw of [undefined, null, 'false', 0, true]) expect(s.parseShortcutsPref(raw)).toBe(true);
    expect(s.parseShortcutsPref(false)).toBe(false);
  });

  it('persists a change and follows the other surface', async () => {
    useStorage({ shortcuts: true });
    const s = await import('./shortcuts');
    await s.initShortcutsPref();
    s.setShortcutsEnabled(false);
    await fake.flush();
    expect(fake.data.shortcuts).toBe(false);
    await fake.external('shortcuts', true);
    expect(get(s.shortcutsEnabled)).toBe(true);
  });
});

describe('theme', () => {
  afterEach(() => document.documentElement.classList.remove('dark'));

  it('applies the stored theme to <html> and toggling persists it', async () => {
    useStorage({ theme: 'dark' });
    const t = await import('../theme');
    await t.initTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    t.toggleTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    await fake.flush();
    expect(fake.data.theme).toBe('light');
  });

  it('with no stored choice it follows the OS, and an invalid external value is ignored', async () => {
    useStorage({});
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const t = await import('../theme');
    await t.initTheme();
    expect(get(t.theme)).toBe('dark');
    await fake.external('theme', 'purple');
    expect(get(t.theme)).toBe('dark');
    expect(fake.sets).toEqual([]);
  });
});

describe('mode', () => {
  it('hydrates the stored surface, marks <html>, and follows the other surface', async () => {
    useStorage({ mode: 'popup' });
    const m = await import('../mode');
    await m.initMode();
    expect(get(m.mode)).toBe('popup');
    expect(document.documentElement.dataset.mode).toBe('popup');
    await fake.external('mode', 'sidepanel');
    expect(get(m.mode)).toBe('sidepanel');
    expect(fake.sets).toEqual([]);
  });
});
