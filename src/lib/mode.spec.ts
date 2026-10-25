import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

const toastSpy = vi.fn();
vi.mock('./components/Toast/toast', () => ({ toast: (...a: unknown[]) => toastSpy(...a) }));

import { mode, switchMode, setMode } from './mode';

type ChromeFake = {
  action: { openPopup: ReturnType<typeof vi.fn>; setPopup: ReturnType<typeof vi.fn> };
  windows: { getCurrent: ReturnType<typeof vi.fn> };
  sidePanel: { open: ReturnType<typeof vi.fn> };
  storage: { local: { set: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> } };
};

let fake: ChromeFake;

beforeEach(() => {
  toastSpy.mockReset();
  fake = {
    action: { openPopup: vi.fn(async () => undefined), setPopup: vi.fn(async () => undefined) },
    windows: { getCurrent: vi.fn(async () => ({ id: 3 })) },
    sidePanel: { open: vi.fn(async () => undefined) },
    storage: { local: { set: vi.fn(), get: vi.fn() } },
  };
  vi.stubGlobal('chrome', fake);
  mode.set('sidepanel');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('switchMode', () => {
  it('opens the popup, saves the mode, then closes this window', async () => {
    const close = vi.fn();
    await expect(switchMode('popup', close)).resolves.toBe(true);
    expect(fake.action.setPopup).toHaveBeenCalledWith({ popup: 'index.html' });
    expect(fake.action.openPopup).toHaveBeenCalled();
    expect(fake.storage.local.set).toHaveBeenCalledWith({ mode: 'popup' });
    expect(get(mode)).toBe('popup');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('when the popup cannot open: the window stays, the mode is put back, a toast says why', async () => {
    fake.action.openPopup.mockRejectedValueOnce(new Error('no gesture'));
    const close = vi.fn();
    await expect(switchMode('popup', close)).resolves.toBe(false);
    expect(close).not.toHaveBeenCalled();
    expect(get(mode)).toBe('sidepanel');
    expect(fake.storage.local.set).toHaveBeenLastCalledWith({ mode: 'sidepanel' });
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining("You're still in the side panel"), 'error');
  });

  it('popup -> side panel opens the panel in this window before closing', async () => {
    setMode('popup');
    const close = vi.fn();
    await expect(switchMode('sidepanel', close)).resolves.toBe(true);
    expect(fake.sidePanel.open).toHaveBeenCalledWith({ windowId: 3 });
    expect(close).toHaveBeenCalled();
  });

  it('a side panel that fails to open keeps the popup open', async () => {
    setMode('popup');
    fake.sidePanel.open.mockRejectedValueOnce(new Error('denied'));
    const close = vi.fn();
    await expect(switchMode('sidepanel', close)).resolves.toBe(false);
    expect(close).not.toHaveBeenCalled();
    expect(get(mode)).toBe('popup');
  });

  it('choosing the current surface does nothing', async () => {
    const close = vi.fn();
    await expect(switchMode('sidepanel', close)).resolves.toBe(true);
    expect(close).not.toHaveBeenCalled();
    expect(fake.sidePanel.open).not.toHaveBeenCalled();
  });
});
