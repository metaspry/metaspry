import { writable } from 'svelte/store';

export interface ToastEntry {
  id: number;
  message: string;
  variant: 'default' | 'success' | 'error';
}

const MAX = 3;
const TTL = 1500;
let counter = 0;

export const toasts = writable<ToastEntry[]>([]);

export function toast(message: string, variant: ToastEntry['variant'] = 'default'): void {
  const id = ++counter;
  toasts.update((list) => {
    const next = [...list, { id, message, variant }];
    return next.slice(-MAX);
  });
  setTimeout(() => {
    toasts.update((list) => list.filter((t) => t.id !== id));
  }, TTL);
}
