import { persisted } from './persisted';

/** Stored as a lower-cased array; anything else is no pins. */
export function parsePinned(raw: unknown): Set<string> {
  return Array.isArray(raw) ? new Set(raw.map((s) => String(s).toLowerCase())) : new Set<string>();
}

const backing = persisted<Set<string>>({
  key: 'pinnedKeys',
  fallback: () => new Set(),
  parse: parsePinned,
  serialize: (set) => Array.from(set),
  write: 'on-change',
});

export const pinned = backing.store;

export const initPinned = backing.init;

export function togglePinned(key: string): void {
  const lower = key.toLowerCase();
  pinned.update((set) => {
    const next = new Set(set);
    if (next.has(lower)) next.delete(lower);
    else next.add(lower);
    return next;
  });
}

export function isPinned(set: Set<string>, key: string): boolean {
  return set.has(key.toLowerCase());
}
