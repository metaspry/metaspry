import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { isTop, layerOpen, modalOpen, pushLayer, resetLayers, topLayer } from './layers';
import { attachShortcuts, registerShortcuts, helpOpen } from './components/Shortcuts/keyboard';
import { popover } from './actions/popover';

beforeEach(() => {
  resetLayers();
  helpOpen.set(false);
});

describe('layer stack', () => {
  it('tracks the top layer and whether any / a modal layer is open', () => {
    expect(get(layerOpen)).toBe(false);
    const menu = pushLayer(false, 'menu');
    expect(get(layerOpen)).toBe(true);
    expect(get(modalOpen)).toBe(false);
    const dialog = pushLayer(true, 'dialog');
    expect(get(modalOpen)).toBe(true);
    expect(isTop(dialog.layer)).toBe(true);
    expect(isTop(menu.layer)).toBe(false);
    dialog.release();
    expect(get(topLayer)).toBe(menu.layer);
    menu.release();
    expect(get(layerOpen)).toBe(false);
  });
});

describe('single-key shortcuts behind a layer', () => {
  function press(key: string, init: KeyboardEventInit = {}) {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  }

  it('r and digits are ignored while a dialog is open; ? still toggles help', () => {
    const rescan = vi.fn();
    const selectTab = vi.fn();
    registerShortcuts({ rescan, selectTab });
    const detach = attachShortcuts();

    press('r');
    expect(rescan).toHaveBeenCalledTimes(1);

    const { release } = pushLayer(true, 'settings');
    press('r');
    press('3');
    expect(rescan).toHaveBeenCalledTimes(1);
    expect(selectTab).not.toHaveBeenCalled();
    press('?', { shiftKey: true });
    expect(get(helpOpen)).toBe(true);

    release();
    press('3');
    expect(selectTab).toHaveBeenCalledWith(2);
    detach();
  });
});

describe('stacked popovers', () => {
  it('Escape closes only the top panel', () => {
    const lower = document.createElement('div');
    const upper = document.createElement('div');
    lower.innerHTML = '<button>a</button>';
    upper.innerHTML = '<button>b</button>';
    document.body.append(lower, upper);
    const closeLower = vi.fn();
    const closeUpper = vi.fn();
    const a = popover(lower, { onClose: closeLower });
    const b = popover(upper, { onClose: closeUpper, modal: true });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(closeUpper).toHaveBeenCalledTimes(1);
    expect(closeLower).not.toHaveBeenCalled();

    b.destroy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(closeLower).toHaveBeenCalledTimes(1);
    a.destroy();
    lower.remove();
    upper.remove();
  });
});
