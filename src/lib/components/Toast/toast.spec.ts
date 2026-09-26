import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { dismissToast, toast, toastDuration, toasts } from './toast';

describe('toastDuration', () => {
  it('keeps a short confirmation short and grows with the message', () => {
    expect(toastDuration('Copied', 'success')).toBe(2000 + 45 * 6);
    expect(toastDuration('Copied', 'default')).toBe(2000 + 45 * 6);
    expect(toastDuration('x'.repeat(40), 'success')).toBe(2000 + 45 * 40);
  });

  it('caps at 9 s', () => {
    expect(toastDuration('x'.repeat(500), 'success')).toBe(9000);
    expect(toastDuration('x'.repeat(500), 'error')).toBe(9000);
  });

  it('keeps an error at least 6 s', () => {
    expect(toastDuration('Scan failed', 'error')).toBe(6000);
  });
});

describe('toast queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toasts.set([]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes each toast after its own duration', () => {
    toast('Copied', 'success');
    toast('Scan failed', 'error');
    expect(get(toasts).map((t) => t.message)).toEqual(['Copied', 'Scan failed']);
    vi.advanceTimersByTime(toastDuration('Copied', 'success'));
    expect(get(toasts).map((t) => t.message)).toEqual(['Scan failed']);
    vi.advanceTimersByTime(6000);
    expect(get(toasts)).toEqual([]);
  });

  it('dismisses one toast on demand and keeps at most three', () => {
    for (const m of ['a', 'b', 'c', 'd']) toast(m);
    const list = get(toasts);
    expect(list.map((t) => t.message)).toEqual(['b', 'c', 'd']);
    dismissToast(list[1]!.id);
    expect(get(toasts).map((t) => t.message)).toEqual(['b', 'd']);
  });
});
