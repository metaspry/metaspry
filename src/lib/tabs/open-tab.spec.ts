import { describe, it, expect, vi, afterEach } from 'vitest';
import { openTab } from './open-tab';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('openTab', () => {
  it('opens a web URL through chrome.tabs with the requested focus', () => {
    const create = vi.fn(() => Promise.resolve({}));
    vi.stubGlobal('chrome', { tabs: { create } });
    expect(openTab('https://a.com/x', { active: false })).toBe(true);
    expect(create).toHaveBeenCalledWith({ url: 'https://a.com/x', active: false });
    openTab('https://app.metaspry.com/dashboard', { active: true });
    expect(create).toHaveBeenLastCalledWith({ url: 'https://app.metaspry.com/dashboard', active: true });
  });

  it('falls back to window.open without chrome.tabs (the dev page), and does not throw', () => {
    vi.stubGlobal('chrome', undefined);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    expect(openTab('https://a.com/', { active: false })).toBe(true);
    expect(open).toHaveBeenCalledWith('https://a.com/', '_blank', 'noopener');
  });

  it.each(['(unknown)', 'javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', ''])('opens nothing for %j', (url) => {
    const create = vi.fn();
    vi.stubGlobal('chrome', { tabs: { create } });
    expect(openTab(url, { active: true })).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('swallows a create that throws', () => {
    vi.stubGlobal('chrome', { tabs: { create: () => { throw new Error('No window'); } } });
    expect(openTab('https://a.com/', { active: true })).toBe(false);
  });

  it('a create that rejects leaves no unhandled rejection (ultra review F4)', async () => {
    // The rejecting promise is made inside the stub and observed only by openTab: if openTab did
    // not attach a handler, the process would report it as unhandled.
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      vi.stubGlobal('chrome', { tabs: { create: () => Promise.reject(new Error('closing')) } });
      expect(openTab('https://a.com/', { active: true })).toBe(true);
      await new Promise((r) => setTimeout(r, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
