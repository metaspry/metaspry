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

const { tooltip, TOOLTIP_ID, HIDE_GRACE_MS } = await import('./tooltip');

const flush = () => new Promise((r) => setTimeout(r, 0));
/** Real-timer wait past the hide grace (for the tests that also await floating-ui's promise). */
const grace = () => new Promise((r) => setTimeout(r, HIDE_GRACE_MS + 10));
const hover = (el: Element) => el.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
const leave = (el: Element) => el.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
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
    // Blur schedules the hide (the same grace as pointerleave), so a pointer already on the bubble holds it.
    expect(el?.hasAttribute('data-show')).toBe(true);
    await grace();
    expect(el?.hasAttribute('data-show')).toBe(false);
    expect(el?.classList.contains('is-open')).toBe(false);
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
    await grace();
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

  it('is hoverable: leaving the trigger keeps it for the grace, the bubble holds it, leaving the bubble hides it', async () => {
    vi.useFakeTimers();
    const b = button();
    tooltip(b, 'Settings');
    hover(b);
    await vi.advanceTimersByTimeAsync(350);
    const el = tip()!;
    expect(el.hasAttribute('data-show')).toBe(true);
    expect(el.classList.contains('is-open')).toBe(true);
    leave(b);
    await vi.advanceTimersByTimeAsync(HIDE_GRACE_MS - 1);
    expect(el.hasAttribute('data-show')).toBe(true);
    hover(el);
    await vi.advanceTimersByTimeAsync(1000);
    expect(el.hasAttribute('data-show')).toBe(true);
    expect(b.getAttribute('aria-describedby')).toBe(TOOLTIP_ID);
    leave(el);
    await vi.advanceTimersByTimeAsync(HIDE_GRACE_MS - 1);
    expect(el.hasAttribute('data-show')).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(el.hasAttribute('data-show')).toBe(false);
    expect(el.classList.contains('is-open')).toBe(false);
    expect(b.hasAttribute('aria-describedby')).toBe(false);
  });

  it('leaving the trigger without reaching the bubble hides after the grace', async () => {
    vi.useFakeTimers();
    const b = button();
    tooltip(b, 'Settings');
    hover(b);
    await vi.advanceTimersByTimeAsync(350);
    leave(b);
    await vi.advanceTimersByTimeAsync(HIDE_GRACE_MS);
    expect(tip()?.hasAttribute('data-show')).toBe(false);
  });

  it('coming back from the bubble to the trigger keeps it, with no new delay', async () => {
    vi.useFakeTimers();
    const b = button();
    tooltip(b, 'Settings');
    hover(b);
    await vi.advanceTimersByTimeAsync(350);
    const el = tip()!;
    leave(b);
    hover(el);
    leave(el);
    hover(b);
    // Past the grace, before a fresh 350 ms delay could have re-shown it: it must never have hidden.
    await vi.advanceTimersByTimeAsync(HIDE_GRACE_MS + 1);
    expect(el.hasAttribute('data-show')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(el.textContent).toBe('Settings');
  });

  it('Escape hides at once, even inside the grace period', async () => {
    vi.useFakeTimers();
    const b = button();
    tooltip(b, 'Settings');
    hover(b);
    await vi.advanceTimersByTimeAsync(350);
    leave(b);
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(tip()?.hasAttribute('data-show')).toBe(false);
    expect(b.hasAttribute('aria-describedby')).toBe(false);
    await vi.advanceTimersByTimeAsync(HIDE_GRACE_MS);
    expect(tip()?.hasAttribute('data-show')).toBe(false);
  });

  it('nested hand-off: the chip takes over the row, and the row leaving does not hide the chip', async () => {
    vi.useFakeTimers();
    const row = button();
    const chip = document.createElement('span');
    row.appendChild(chip);
    tooltip(row, 'Open in new tab');
    tooltip(chip, 'Score 64 of 100, needs work');
    hover(row);
    await vi.advanceTimersByTimeAsync(350);
    expect(tip()?.textContent).toBe('Open in new tab');
    hover(chip);
    await vi.advanceTimersByTimeAsync(350);
    expect(tip()?.textContent).toBe('Score 64 of 100, needs work');
    expect(tip()?.hasAttribute('data-show')).toBe(true);
    expect(row.hasAttribute('aria-describedby')).toBe(false);
    expect(chip.getAttribute('aria-describedby')).toBe(TOOLTIP_ID);
    leave(row);
    await vi.advanceTimersByTimeAsync(HIDE_GRACE_MS);
    expect(tip()?.hasAttribute('data-show')).toBe(true);
    leave(chip);
    await vi.advanceTimersByTimeAsync(HIDE_GRACE_MS);
    expect(tip()?.hasAttribute('data-show')).toBe(false);
    expect(chip.hasAttribute('aria-describedby')).toBe(false);
  });
});
