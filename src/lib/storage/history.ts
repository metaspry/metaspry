import { persisted } from './persisted';

export interface HistoryEntry {
  url: string;
  hostname: string;
  title: string;
  score: number;
  timestamp: number;
  /** Resolved favicon URL (see `scrapers/icon.ts`). Absent on entries written before it existed. */
  icon?: string;
  /** A required rule failed, so the band is capped at warn (band.ts). Absent = none or older entry. */
  requiredFailing?: boolean;
}

const CAP = 10;

/** A stored list, capped; anything else (missing, corrupt, cleared) is an empty history. */
export function parseHistory(raw: unknown): HistoryEntry[] {
  return Array.isArray(raw) ? (raw as HistoryEntry[]).slice(0, CAP) : [];
}

const backing = persisted<HistoryEntry[]>({
  key: 'history',
  fallback: () => [],
  parse: parseHistory,
  serialize: (list) => list.slice(0, CAP),
  write: 'on-change',
});

export const history = backing.store;

export const initHistory = backing.init;

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
