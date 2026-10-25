import { describe, it, expect, vi, afterEach } from 'vitest';
import { displayUrl, followActiveTab, tabState } from './follow-tab';

describe('tabState', () => {
  it('is same for the identical URL', () => {
    expect(tabState('https://a.com/x', 'https://a.com/x')).toBe('same');
  });

  it('ignores fragment-only and trailing-slash differences', () => {
    expect(tabState('https://a.com/doc', 'https://a.com/doc#install')).toBe('same');
    expect(tabState('https://a.com/blog', 'https://a.com/blog/')).toBe('same');
  });

  it('is other for a different hash route, same for the same route', () => {
    expect(tabState('https://app.com/#/pricing', 'https://app.com/#/blog')).toBe('other');
    expect(tabState('https://app.com/#!/pricing', 'https://app.com/#!/blog')).toBe('other');
    expect(tabState('https://app.com/', 'https://app.com/#/blog')).toBe('other');
    expect(tabState('https://app.com/#/blog', 'https://app.com/#/blog/')).toBe('same');
    expect(tabState('https://app.com/#/blog', 'https://app.com/#/blog')).toBe('same');
    expect(tabState('https://app.com/#/blog', 'https://app.com/#top')).toBe('other');
    expect(tabState('https://app.com/doc#a', 'https://app.com/doc#b')).toBe('same');
    expect(tabState('https://app.com/', 'https://app.com/#/')).toBe('same');
    expect(tabState('https://app.com/#!/', 'https://app.com/')).toBe('same');
  });

  it('is other for a different path or host', () => {
    expect(tabState('https://a.com/x', 'https://a.com/z')).toBe('other');
    expect(tabState('https://a.com/x', 'https://b.com/y')).toBe('other');
  });

  it('is restricted for pages Chrome blocks extensions on', () => {
    expect(tabState('https://a.com/x', 'chrome://settings')).toBe('restricted');
    expect(tabState('https://a.com/x', 'about:newtab')).toBe('restricted');
    expect(tabState('https://a.com/x', 'https://a.com/report.pdf')).toBe('restricted');
  });

  it('is unknown when the active tab has no readable URL', () => {
    expect(tabState('https://a.com/x', '')).toBe('unknown');
    expect(tabState('https://a.com/x', undefined)).toBe('unknown');
  });

  it('flags nothing without a scanned URL', () => {
    expect(tabState('', 'https://b.com/y')).toBe('same');
    expect(tabState(null, 'chrome://settings')).toBe('same');
  });
});

describe('displayUrl', () => {
  it('shows host, path and query', () => {
    expect(displayUrl('https://acme.com/blog/post-1?ref=x')).toBe('acme.com/blog/post-1?ref=x');
  });

  it('drops a bare root path', () => {
    expect(displayUrl('https://acme.com/')).toBe('acme.com');
  });

  it('returns the input when it does not parse', () => {
    expect(displayUrl('not a url')).toBe('not a url');
  });
});

type Listener = (...args: never[]) => void;

function fakeEvent() {
  const listeners = new Set<Listener>();
  return {
    listeners,
    addListener: (fn: Listener) => listeners.add(fn),
    removeListener: (fn: Listener) => listeners.delete(fn),
    fire: (...args: unknown[]) => {
      for (const fn of listeners) (fn as (...a: unknown[]) => void)(...args);
    },
  };
}

function stubTabs(activeUrl: { value: string | undefined }) {
  const onActivated = fakeEvent();
  const onUpdated = fakeEvent();
  const onReplaced = fakeEvent();
  const query = vi.fn(async () => [{ url: activeUrl.value }]);
  vi.stubGlobal('chrome', { tabs: { onActivated, onUpdated, onReplaced, query } });
  return { onActivated, onUpdated, onReplaced, query };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('followActiveTab', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the active tab on start, scoped to its window', async () => {
    const url = { value: 'https://a.com/x' as string | undefined };
    const { query } = stubTabs(url);
    const seen: string[] = [];
    followActiveTab(7, (u) => seen.push(u));
    await flush();
    expect(query).toHaveBeenCalledWith({ active: true, windowId: 7 });
    expect(seen).toEqual(['https://a.com/x']);
  });

  it('re-reads on activation in its own window and ignores other windows', async () => {
    const url = { value: 'https://a.com/x' as string | undefined };
    const { onActivated, query } = stubTabs(url);
    const seen: string[] = [];
    followActiveTab(7, (u) => seen.push(u));
    await flush();
    query.mockClear();
    onActivated.fire({ tabId: 1, windowId: 8 });
    await flush();
    expect(query).not.toHaveBeenCalled();
    url.value = 'https://b.com/y';
    onActivated.fire({ tabId: 2, windowId: 7 });
    await flush();
    expect(seen).toEqual(['https://a.com/x', 'https://b.com/y']);
  });

  it('ignores onUpdated without a url, for an inactive tab, or in another window', async () => {
    const { onUpdated, query } = stubTabs({ value: 'https://a.com/x' });
    followActiveTab(7, () => {});
    await flush();
    query.mockClear();
    onUpdated.fire(1, { status: 'complete' }, { active: true, windowId: 7 });
    onUpdated.fire(1, { url: 'https://a.com/z' }, { active: false, windowId: 7 });
    onUpdated.fire(1, { url: 'https://a.com/z' }, { active: true, windowId: 8 });
    await flush();
    expect(query).not.toHaveBeenCalled();
    onUpdated.fire(1, { url: 'https://a.com/z' }, { active: true, windowId: 7 });
    await flush();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('re-reads on onReplaced', async () => {
    const { onReplaced, query } = stubTabs({ value: 'https://a.com/x' });
    followActiveTab(7, () => {});
    await flush();
    query.mockClear();
    onReplaced.fire(10, 9);
    await flush();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('reports an empty string when the tab has no readable URL', async () => {
    stubTabs({ value: undefined });
    const seen: string[] = [];
    followActiveTab(7, (u) => seen.push(u));
    await flush();
    expect(seen).toEqual(['']);
  });

  it('delivers only the newest answer when queries resolve out of order', async () => {
    const { onActivated, query } = stubTabs({ value: 'https://a.com/x' });
    const seen: string[] = [];
    followActiveTab(7, (u) => seen.push(u));
    await flush();
    seen.length = 0;
    let releaseSlow: (v: { url: string | undefined }[]) => void = () => {};
    query.mockImplementationOnce(
      () => new Promise<{ url: string | undefined }[]>((r) => {
        releaseSlow = r;
      }),
    );
    query.mockImplementationOnce(async () => [{ url: 'https://c.com/new' }]);
    onActivated.fire({ tabId: 1, windowId: 7 });
    onActivated.fire({ tabId: 2, windowId: 7 });
    await flush();
    releaseSlow([{ url: 'https://b.com/old' }]);
    await flush();
    expect(seen).toEqual(['https://c.com/new']);
  });

  it('unsubscribe removes every listener and drops pending answers', async () => {
    const { onActivated, onUpdated, onReplaced } = stubTabs({ value: 'https://a.com/x' });
    const seen: string[] = [];
    const stop = followActiveTab(7, (u) => seen.push(u));
    stop();
    await flush();
    expect(onActivated.listeners.size).toBe(0);
    expect(onUpdated.listeners.size).toBe(0);
    expect(onReplaced.listeners.size).toBe(0);
    expect(seen).toEqual([]);
  });
});
