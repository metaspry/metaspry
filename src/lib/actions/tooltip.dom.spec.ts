// Runs in the default happy-dom environment: the real show / hide paths against a real document.
// floating-ui is mocked (happy-dom has no layout); what is under test is the action's own state.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stopAutoUpdate = vi.fn();
vi.mock('@floating-ui/dom', () => ({
  computePosition: vi.fn(async () => ({ x: 10, y: 20, placement: 'top', middlewareData: { arrow: { x: 5 } } })),
  autoUpdate: vi.fn((_ref: unknown, _float: unknown, update: () => void) => {
    update();
    return stopAutoUpdate;
  }),
  offset: vi.fn(() => ({})),
  flip: vi.fn(() => ({})),
  shift: vi.fn(() => ({})),
  arrow: vi.fn(() => ({})),
}));

const { tooltip, TOOLTIP_ID } = await import('./tooltip');

const flush = () => new Promise((r) => setTimeout(r, 0));
const tip = () => document.getElementById(TOOLTIP_ID);

function button(label?: string): HTMLButtonElement {
  const b = document.createElement('button');
  if (label) b.setAttribute('aria-label', label);
  // happy-dom never matches :focus-visible for a synthetic focus event; treat these as keyboard focus.
  const matches = b.matches.bind(b);
  b.matches = (selector: string) => selector === ':focus-visible' || matches(selector);
  document.body.appendChild(b);
  return b;
}

beforeEach(() => {
  document.body.innerHTML = '';
  stopAutoUpdate.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('tooltip action (DOM)', () => {
  it('focus shows one shared role=tooltip element and wires aria-describedby; blur removes both', async () => {
    const b = button();
    const a = tooltip(b, 'Copy every tag on this page as JSON');
    b.dispatchEvent(new Event('focus'));
    await flush();
    const el = tip();
    expect(el?.getAttribute('role')).toBe('tooltip');
    expect(el?.textContent).toBe('Copy every tag on this page as JSON');
    expect(el?.hasAttribute('data-show')).toBe(true);
    expect(el?.style.left).toBe('10px');
    expect(b.getAttribute('aria-describedby')).toBe(TOOLTIP_ID);
    b.dispatchEvent(new Event('blur'));
    expect(el?.hasAttribute('data-show')).toBe(false);
    expect(b.hasAttribute('aria-describedby')).toBe(false);
    expect(stopAutoUpdate).toHaveBeenCalled();
    a.destroy();
  });

  it('a focus that is not :focus-visible (mouse click) does not show', () => {
    const b = document.createElement('button');
    b.matches = (selector: string) => selector !== ':focus-visible';
    document.body.appendChild(b);
    tooltip(b, 'Settings');
    b.dispatchEvent(new Event('focus'));
    expect(b.hasAttribute('aria-describedby')).toBe(false);
    expect(tip()?.hasAttribute('data-show') ?? false).toBe(false);
  });

  it('does not describe a trigger with its own name (announced once)', async () => {
    const b = button('History');
    tooltip(b, 'History');
    b.dispatchEvent(new Event('focus'));
    await flush();
    expect(tip()?.hasAttribute('data-show')).toBe(true);
    expect(b.hasAttribute('aria-describedby')).toBe(false);
  });

  it('keeps existing aria-describedby ids', async () => {
    const b = button();
    b.setAttribute('aria-describedby', 'err-1');
    tooltip(b, 'Save scoring rules');
    b.dispatchEvent(new Event('focus'));
    expect(b.getAttribute('aria-describedby')).toBe(`err-1 ${TOOLTIP_ID}`);
    b.dispatchEvent(new Event('blur'));
    expect(b.getAttribute('aria-describedby')).toBe('err-1');
  });

  it('a second trigger takes over the single element; the first loses aria-describedby', async () => {
    const one = button();
    const two = button();
    tooltip(one, 'One');
    tooltip(two, 'Two');
    one.dispatchEvent(new Event('focus'));
    two.dispatchEvent(new Event('focus'));
    await flush();
    expect(document.querySelectorAll('[role=tooltip]').length).toBe(1);
    expect(tip()?.textContent).toBe('Two');
    expect(one.hasAttribute('aria-describedby')).toBe(false);
    expect(two.getAttribute('aria-describedby')).toBe(TOOLTIP_ID);
  });

  it('Escape on window hides without stopping propagation or preventing default', async () => {
    const b = button();
    tooltip(b, 'Close settings (Esc)');
    b.dispatchEvent(new Event('focus'));
    await flush();
    const later = vi.fn();
    window.addEventListener('keydown', later);
    const ev = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    window.dispatchEvent(ev);
    expect(tip()?.hasAttribute('data-show')).toBe(false);
    expect(later).toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
    window.removeEventListener('keydown', later);
  });

  it('hover waits for the delay; pointerdown hides', async () => {
    vi.useFakeTimers();
    const b = button();
    tooltip(b, { text: 'Settings', delay: 350 });
    b.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    vi.advanceTimersByTime(349);
    expect(b.hasAttribute('aria-describedby')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(b.getAttribute('aria-describedby')).toBe(TOOLTIP_ID);
    b.dispatchEvent(new PointerEvent('pointerdown'));
    expect(b.hasAttribute('aria-describedby')).toBe(false);
  });

  it('a nested trigger cancels its parent pending hover', () => {
    vi.useFakeTimers();
    const row = button();
    const chip = document.createElement('span');
    row.appendChild(chip);
    tooltip(row, 'Open in new tab');
    tooltip(chip, 'Score 64 of 100, needs work');
    row.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    vi.advanceTimersByTime(100);
    chip.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    vi.advanceTimersByTime(300);
    expect(row.hasAttribute('aria-describedby')).toBe(false);
    vi.advanceTimersByTime(100);
    expect(chip.getAttribute('aria-describedby')).toBe(TOOLTIP_ID);
    expect(tip()?.textContent).toBe('Score 64 of 100, needs work');
  });

  it('update() while visible swaps the text; update("") hides; destroy while visible hides', async () => {
    const b = button();
    const a = tooltip(b, 'Switch to dark theme');
    b.dispatchEvent(new Event('focus'));
    a.update('Switch to light theme');
    expect(tip()?.textContent).toBe('Switch to light theme');
    a.update('');
    expect(tip()?.hasAttribute('data-show')).toBe(false);
    a.update('Back');
    b.dispatchEvent(new Event('focus'));
    await flush();
    expect(tip()?.hasAttribute('data-show')).toBe(true);
    a.destroy();
    expect(tip()?.hasAttribute('data-show')).toBe(false);
    expect(b.hasAttribute('aria-describedby')).toBe(false);
  });
});
