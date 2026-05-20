import { writable } from 'svelte/store';

export interface HistoryEntry {
  url: string;
  hostname: string;
  title: string;
  score: number;
  timestamp: number;
}

const STORAGE_KEY = 'history';
const CAP = 10;

export const history = writable<HistoryEntry[]>([]);

function readStorage(): Promise<HistoryEntry[]> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      resolve([]);
      return;
    }
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY];
      resolve(Array.isArray(stored) ? (stored as HistoryEntry[]).slice(0, CAP) : []);
    });
  });
}

function writeStorage(next: HistoryEntry[]): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.set({ [STORAGE_KEY]: next.slice(0, CAP) });
}

export async function initHistory(): Promise<void> {
  const initial = await readStorage();
  history.set(initial);
  history.subscribe(writeStorage);
}

export function pushHistory(entry: HistoryEntry): void {
  history.update((list) => {
    const filtered = list.filter((e) => e.url !== entry.url);
    const next = [entry, ...filtered].slice(0, CAP);
    return next;
  });
}

export function clearHistory(): void {
  history.set([]);
}
