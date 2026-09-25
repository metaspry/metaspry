// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOOLTIP_DELAY, normalizeTooltipOptions, tooltip, withDescribedBy } from './tooltip';

/** Just enough of an element for the action: records listeners and attributes, no DOM needed. */
function fakeNode() {
  const listeners = new Map<string, (event: Event) => void>();
  const attrs = new Map<string, string>();
  const node = {
    addEventListener: (type: string, fn: (event: Event) => void) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
    getAttribute: (name: string) => attrs.get(name) ?? null,
    setAttribute: (name: string, value: string) => attrs.set(name, value),
    removeAttribute: (name: string) => attrs.delete(name),
    matches: () => true,
  };
  const fire = (type: string, event: Partial<PointerEvent & KeyboardEvent> = {}) => listeners.get(type)?.(event as Event);
  return { node: node as unknown as HTMLElement, listeners, attrs, fire };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('normalizeTooltipOptions', () => {
  it('expands the string shorthand with the defaults', () => {
    expect(normalizeTooltipOptions('History')).toEqual({ text: 'History', placement: 'top', delay: TOOLTIP_DELAY });
    expect(TOOLTIP_DELAY).toBe(350);
  });

  it('keeps valid placement and delay', () => {
    expect(normalizeTooltipOptions({ text: 'Pin', placement: 'left', delay: 0 })).toEqual({ text: 'Pin', placement: 'left', delay: 0 });
  });

  it('falls back on junk placement or delay', () => {
    const bad = { text: 'x', placement: 'middle', delay: -5 } as unknown as Parameters<typeof normalizeTooltipOptions>[0];
    expect(normalizeTooltipOptions(bad)).toEqual({ text: 'x', placement: 'top', delay: TOOLTIP_DELAY });
    expect(normalizeTooltipOptions({ text: 'x', delay: Number.NaN }).delay).toBe(TOOLTIP_DELAY);
  });

  it('treats missing or whitespace text as empty', () => {
    expect(normalizeTooltipOptions('   ').text).toBe('');
    expect(normalizeTooltipOptions(null).text).toBe('');
    expect(normalizeTooltipOptions({ text: '  Save  ' }).text).toBe('Save');
  });
});

describe('withDescribedBy', () => {
  it('adds once and keeps existing ids', () => {
    expect(withDescribedBy(null, 'ms-tooltip', true)).toBe('ms-tooltip');
    expect(withDescribedBy('err-1', 'ms-tooltip', true)).toBe('err-1 ms-tooltip');
    expect(withDescribedBy('err-1 ms-tooltip', 'ms-tooltip', true)).toBe('err-1 ms-tooltip');
  });

  it('removes only its own id, and returns null when nothing is left', () => {
    expect(withDescribedBy('err-1 ms-tooltip', 'ms-tooltip', false)).toBe('err-1');
    expect(withDescribedBy('ms-tooltip', 'ms-tooltip', false)).toBeNull();
  });
});

describe('tooltip action', () => {
  it('wires hover, focus, blur, Escape and pointerdown, and unwires them on destroy', () => {
    const { node, listeners } = fakeNode();
    const action = tooltip(node, 'History');
    expect([...listeners.keys()].sort()).toEqual(['blur', 'focus', 'keydown', 'pointerdown', 'pointerenter', 'pointerleave']);
    action.destroy();
    expect(listeners.size).toBe(0);
  });

  it('never shows for empty text: no timer is scheduled and no aria-describedby is set', () => {
    vi.useFakeTimers();
    const { node, attrs, fire } = fakeNode();
    tooltip(node, '');
    fire('pointerenter', { pointerType: 'mouse' });
    fire('focus');
    expect(vi.getTimerCount()).toBe(0);
    expect(attrs.has('aria-describedby')).toBe(false);
  });

  it('schedules hover with the configured delay, ignores touch, and cancels on leave', () => {
    vi.useFakeTimers();
    const { node, fire } = fakeNode();
    tooltip(node, { text: 'Settings', delay: 50 });
    fire('pointerenter', { pointerType: 'touch' });
    expect(vi.getTimerCount()).toBe(0);
    fire('pointerenter', { pointerType: 'mouse' });
    expect(vi.getTimerCount()).toBe(1);
    fire('pointerleave');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('update() swaps the options: emptied text stops hover, new text re-enables it', () => {
    vi.useFakeTimers();
    const { node, fire } = fakeNode();
    const action = tooltip(node, 'Switch to dark theme');
    action.update('');
    fire('pointerenter', { pointerType: 'mouse' });
    expect(vi.getTimerCount()).toBe(0);
    action.update({ text: 'Switch to light theme', delay: 10 });
    fire('pointerenter', { pointerType: 'mouse' });
    expect(vi.getTimerCount()).toBe(1);
    // With no document (node env) the show is a safe no-op.
    expect(() => vi.runAllTimers()).not.toThrow();
  });

  it('is import- and call-safe without a DOM', () => {
    expect(typeof document).toBe('undefined');
    const { node, attrs, fire } = fakeNode();
    tooltip(node, 'Keyboard shortcuts');
    expect(() => fire('focus')).not.toThrow();
    expect(attrs.has('aria-describedby')).toBe(false);
  });
});
