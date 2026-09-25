// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dur, reducedMotion } from './motion';

function stubMatchMedia(matches: boolean) {
  const matchMedia = vi.fn((query: string) => ({ matches, media: query }));
  vi.stubGlobal('window', { matchMedia });
  return matchMedia;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reducedMotion', () => {
  it('is false without a window (SSR, node tests)', () => {
    expect(typeof window).toBe('undefined');
    expect(reducedMotion()).toBe(false);
  });

  it('is false when matchMedia is missing', () => {
    vi.stubGlobal('window', {});
    expect(reducedMotion()).toBe(false);
  });

  it('follows the prefers-reduced-motion query', () => {
    const matchMedia = stubMatchMedia(true);
    expect(reducedMotion()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    stubMatchMedia(false);
    expect(reducedMotion()).toBe(false);
  });
});

describe('dur', () => {
  it('returns the duration unless motion is reduced, then 0', () => {
    stubMatchMedia(false);
    expect(dur(220)).toBe(220);
    stubMatchMedia(true);
    expect(dur(220)).toBe(0);
  });

  it('returns the duration when there is no window at all', () => {
    expect(dur(100)).toBe(100);
  });
});
