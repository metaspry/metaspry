import { get, writable } from 'svelte/store';

export interface ToastEntry {
  id: number;
  message: string;
  variant: 'default' | 'success' | 'error';
}

const MAX = 3;
let counter = 0;

export const toasts = writable<ToastEntry[]>([]);

/**
 * How long a toast stays (R2-27): the web app's `toastDuration` (V3-12), 3.5 s + 45 ms per character,
 * capped at 9 s. An error stays at least 6 s, and every toast has a close control, so nothing
 * important vanishes before it can be read.
 */
export function toastDuration(message: string, variant: ToastEntry['variant']): number {
  const base = Math.min(9000, 3500 + 45 * message.length);
  return variant === 'error' ? Math.max(6000, base) : base;
}

// Each toast's timer, so it can be held while the pointer or keyboard focus is on the toasts
// (UX review 2026-10-25, Medium 13: they vanished mid-read, WCAG 2.2.1).
interface Timer {
  remaining: number;
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | null;
}
const timers = new Map<number, Timer>();
let held = false;

function start(id: number, t: Timer): void {
  t.startedAt = Date.now();
  t.handle = setTimeout(() => dismissToast(id), t.remaining);
}

export function dismissToast(id: number): void {
  const t = timers.get(id);
  if (t?.handle) clearTimeout(t.handle);
  timers.delete(id);
  toasts.update((list) => list.filter((x) => x.id !== id));
}

/** Holds every toast while true (pointer over or focus inside them); the countdown resumes after. */
export function holdToasts(hold: boolean): void {
  if (hold === held) return;
  held = hold;
  for (const [id, t] of timers) {
    if (hold) {
      if (t.handle) clearTimeout(t.handle);
      t.handle = null;
      t.remaining = Math.max(0, t.remaining - (Date.now() - t.startedAt));
    } else {
      start(id, t);
    }
  }
}

export function toast(message: string, variant: ToastEntry['variant'] = 'default'): void {
  const id = ++counter;
  const next = [...get(toasts), { id, message, variant }];
  // Dropped past MAX: their timers go with them.
  for (const gone of next.slice(0, Math.max(0, next.length - MAX))) {
    const t = timers.get(gone.id);
    if (t?.handle) clearTimeout(t.handle);
    timers.delete(gone.id);
  }
  toasts.set(next.slice(-MAX));
  const t: Timer = { remaining: toastDuration(message, variant), startedAt: Date.now(), handle: null };
  timers.set(id, t);
  if (!held) start(id, t);
}
