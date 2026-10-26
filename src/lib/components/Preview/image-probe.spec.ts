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
