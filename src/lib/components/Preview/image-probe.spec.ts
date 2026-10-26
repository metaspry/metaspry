import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearImageProbes, probeImage, type ProbeImage } from './image-probe';

beforeEach(() => clearImageProbes());

function fakeImage(outcome: 'ok' | 'failed') {
  const img: ProbeImage = { referrerPolicy: '', onload: null, onerror: null, src: '' };
  Object.defineProperty(img, 'src', {
    set(v: string) {
      (img as unknown as { _src: string })._src = v;
      queueMicrotask(() => (outcome === 'ok' ? img.onload?.() : img.onerror?.()));
    },
    get() {
      return (img as unknown as { _src: string })._src;
    },
  });
  return img;
}

describe('probeImage (UX review 2026-10-25, Medium 21)', () => {
  it('reports a loading image as ok and a dead one as failed', async () => {
    await expect(probeImage('https://a.com/ok.png', () => fakeImage('ok'))).resolves.toBe('ok');
    await expect(probeImage('https://a.com/404.png', () => fakeImage('failed'))).resolves.toBe('failed');
  });

  it('loads without a referrer', async () => {
    const img = fakeImage('ok');
    await probeImage('https://a.com/x.png', () => img);
    expect(img.referrerPolicy).toBe('no-referrer');
  });

  it('probes each URL once, however many cards ask', async () => {
    const make = vi.fn(() => fakeImage('ok'));
    await Promise.all([probeImage('https://a.com/same.png', make), probeImage('https://a.com/same.png', make)]);
    expect(make).toHaveBeenCalledTimes(1);
  });
});

describe('probeImage does not remember a failure (ultra review F1)', () => {
  it('a failed URL is probed again later; a loaded one is not', async () => {
    const failing = vi.fn(() => fakeImage('failed'));
    await probeImage('https://a.com/late.png', failing);
    await Promise.resolve();
    await expect(probeImage('https://a.com/late.png', () => fakeImage('ok'))).resolves.toBe('ok');
    expect(failing).toHaveBeenCalledTimes(1);
    const again = vi.fn(() => fakeImage('failed'));
    await expect(probeImage('https://a.com/late.png', again)).resolves.toBe('ok');
    expect(again).not.toHaveBeenCalled();
  });

  it('a host that never answers counts as failed after the timeout', async () => {
    vi.useFakeTimers();
    const img = { referrerPolicy: '', onload: null, onerror: null, src: '' };
    const p = probeImage('https://a.com/hang.png', () => img, 1000);
    expect(img.src).toBe('https://a.com/hang.png');
    vi.advanceTimersByTime(1000);
    await expect(p).resolves.toBe('failed');
    expect(img.src).toBe('');
    vi.useRealTimers();
  });
});
