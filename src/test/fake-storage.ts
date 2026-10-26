/**
 * Test helper: an in-memory `chrome.storage.local` with `onChanged`, the way Chrome behaves:
 * `set` fires `onChanged` (asynchronously) in every listener, including the writer's own document.
 * Not shipped (imported by specs only).
 */
type Change = { oldValue?: unknown; newValue?: unknown };
type Listener = (changes: Record<string, Change>, area: string) => void;

export interface FakeStorage {
  data: Record<string, unknown>;
  sets: Record<string, unknown>[];
  listeners: Set<Listener>;
  /** Another surface writes `key` (fires onChanged like Chrome). */
  external: (key: string, value: unknown) => Promise<void>;
  /** Let queued onChanged events run. */
  flush: () => Promise<void>;
  chrome: unknown;
}

export function fakeStorage(initial: Record<string, unknown> = {}): FakeStorage {
  const data: Record<string, unknown> = structuredClone(initial);
  const sets: Record<string, unknown>[] = [];
  const listeners = new Set<Listener>();
  const fire = (changes: Record<string, Change>) =>
    new Promise<void>((resolve) =>
      queueMicrotask(() => {
        for (const l of [...listeners]) l(changes, 'local');
        resolve();
      }),
    );
  const write = (items: Record<string, unknown>) => {
    const changes: Record<string, Change> = {};
    for (const [k, v] of Object.entries(items)) {
      changes[k] = { oldValue: data[k], newValue: structuredClone(v) };
      data[k] = structuredClone(v);
    }
    return fire(changes);
  };
  const chrome = {
    storage: {
      local: {
        get: (key: string, cb: (r: Record<string, unknown>) => void) =>
          queueMicrotask(() => cb(key in data ? { [key]: structuredClone(data[key]) } : {})),
        set: (items: Record<string, unknown>) => {
          sets.push(structuredClone(items));
          void write(items);
          return Promise.resolve();
        },
      },
      onChanged: {
        addListener: (l: Listener) => void listeners.add(l),
        removeListener: (l: Listener) => void listeners.delete(l),
      },
    },
  };
  return {
    data,
    sets,
    listeners,
    external: (key, value) => write({ [key]: value }),
    flush: () => new Promise((r) => setTimeout(r, 0)),
    chrome,
  };
}
