import { writable } from 'svelte/store';

export interface ToastEntry {
  id: number;
  message: string;
  variant: 'default' | 'success' | 'error';
}

const MAX = 3;
let counter = 0;

export const toasts = writable<ToastEntry[]>([]);

/**
 * How long a toast stays (R2-27). A short confirmation ("Copied") leaves quickly: 2 s + 45 ms per
 * character, capped at 9 s. An error stays at least 6 s, like the web app's `toastDuration`, and every
 * toast has a close control, so nothing important vanishes before it can be read.
 */
export function toastDuration(message: string, variant: ToastEntry['variant']): number {
  const base = Math.min(9000, 2000 + 45 * message.length);
  return variant === 'error' ? Math.max(6000, base) : base;
}

export function dismissToast(id: number): void {
  toasts.update((list) => list.filter((t) => t.id !== id));
}

export function toast(message: string, variant: ToastEntry['variant'] = 'default'): void {
  const id = ++counter;
  toasts.update((list) => {
    const next = [...list, { id, message, variant }];
    return next.slice(-MAX);
  });
  setTimeout(() => dismissToast(id), toastDuration(message, variant));
}
