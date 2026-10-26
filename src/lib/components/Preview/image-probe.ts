/**
 * Does a preview image actually load (UX review 2026-10-25, Medium 21)? A dead og:image used to
 * render as the empty gradient placeholder, which looks like "no image yet" rather than the broken
 * link it is, and every preview card requested the same URL again. One probe per URL, without a
 * referrer (the image host learns nothing about the page the user is on), shared by every card.
 *
 * Only a load is remembered (ultra review 2026-10-26, F1): a failure (offline, a 5xx, an image
 * uploaded after the first scan) is probed again by the next scan instead of being stuck for the
 * life of the panel, and a host that never answers counts as failed after PROBE_TIMEOUT_MS.
 */
export type ImageState = 'loading' | 'ok' | 'failed';

export interface ProbeImage {
  referrerPolicy: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
}

export const PROBE_TIMEOUT_MS = 10_000;

const cache = new Map<string, Promise<'ok' | 'failed'>>();

export function probeImage(
  url: string,
  make: () => ProbeImage = () => new Image() as unknown as ProbeImage,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<'ok' | 'failed'> {
  const hit = cache.get(url);
  if (hit) return hit;
  const p = new Promise<'ok' | 'failed'>((resolve) => {
    const img = make();
    const timer = setTimeout(() => done('failed'), timeoutMs);
    function done(state: 'ok' | 'failed') {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(state);
    }
    img.referrerPolicy = 'no-referrer';
    img.onload = () => done('ok');
    img.onerror = () => done('failed');
    img.src = url;
  });
  cache.set(url, p);
  // Shared while in flight; once it settles, only a success stays cached.
  void p.then((state) => {
    if (state === 'failed' && cache.get(url) === p) cache.delete(url);
  });
  return p;
}

/** For tests. */
export function clearImageProbes(): void {
  cache.clear();
}
