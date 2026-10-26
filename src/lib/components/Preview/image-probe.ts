/**
 * Does a preview image actually load (UX review 2026-10-25, Medium 21)? A dead og:image used to
 * render as the empty gradient placeholder, which looks like "no image yet" rather than the broken
 * link it is, and every preview card requested the same URL again. One probe per URL, without a
 * referrer (the image host learns nothing about the page the user is on), shared by every card.
 */
export type ImageState = 'loading' | 'ok' | 'failed';

export interface ProbeImage {
  referrerPolicy: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
}

const cache = new Map<string, Promise<'ok' | 'failed'>>();

export function probeImage(url: string, make: () => ProbeImage = () => new Image() as unknown as ProbeImage): Promise<'ok' | 'failed'> {
  const hit = cache.get(url);
  if (hit) return hit;
  const p = new Promise<'ok' | 'failed'>((resolve) => {
    const img = make();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolve('ok');
    img.onerror = () => resolve('failed');
    img.src = url;
  });
  cache.set(url, p);
  return p;
}

/** For tests. */
export function clearImageProbes(): void {
  cache.clear();
}
