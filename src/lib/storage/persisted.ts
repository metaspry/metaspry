import { writable, type Writable } from 'svelte/store';
import { makeWriteGuard, watchKey } from './watch';

export interface PersistedOptions<T> {
  /** `chrome.storage.local` key. */
  key: string;
  /** The value when there is no extension storage, or nothing usable is stored. */
  fallback: () => T;
  /**
   * Stored value -> store value. `undefined` means "not a value": hydration uses `fallback()`, and
   * an external change is ignored. Normalise here (caps, case), never trust the stored shape.
   */
  parse: (raw: unknown) => T | undefined;
  /** Store value -> stored value (default: as is). */
  serialize?: (value: T) => unknown;
  /**
   * `'on-change'`: every store change is written (another surface's change is applied without
   * being echoed back). `'explicit'`: only `write(next)` persists, for stores whose writes are
   * user actions (theme toggle, mode switch).
   */
  write: 'on-change' | 'explicit';
  /**
   * Runs once after the first hydration (apply a DOM class, mirror to localStorage, ...). A returned
   * function runs on `dispose()`.
   */
  onInit?: (store: Writable<T>) => void | (() => void);
}

export interface Persisted<T> {
  store: Writable<T>;
  /** Hydrate, then keep in sync. Idempotent: later calls return the first call's promise. */
  init: () => Promise<void>;
  /** Persist `next` (the store is not changed). */
  write: (next: T) => void;
  /** Set the store without persisting it (a value that must not reach storage). */
  applyWithoutPersisting: (next: T) => void;
  /** Drop the subscription and the storage listener; `init()` may run again. Tests and teardown. */
  dispose: () => void;
}

function storageLocal(): chrome.storage.LocalStorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null;
}

/**
 * A Svelte store backed by one `chrome.storage.local` key, kept in step across the popup and the
 * side panel (see `watch.ts`). Replaces the read / subscribe-write / watchKey / guard block every
 * storage module used to repeat (architecture review Medium 11).
 */
export function persisted<T>(opts: PersistedOptions<T>, store: Writable<T> = writable(opts.fallback())): Persisted<T> {
  const guard = makeWriteGuard();
  const serialize = opts.serialize ?? ((v: T) => v);
  let started: Promise<void> | null = null;
  // Bumped by dispose(): a hydration still reading from a disposed generation must not start syncing.
  let generation = 0;
  let stops: (() => void)[] = [];

  function write(next: T): void {
    const local = storageLocal();
    if (!local) return;
    local.set({ [opts.key]: serialize(next) });
  }

  function read(): Promise<T> {
    return new Promise((resolve) => {
      const local = storageLocal();
      if (!local) {
        resolve(opts.fallback());
        return;
      }
      local.get(opts.key, (result) => resolve(opts.parse(result?.[opts.key]) ?? opts.fallback()));
    });
  }

  async function hydrate(): Promise<void> {
    const gen = generation;
    const initial = await read();
    if (gen !== generation) return;
    store.set(initial);
    const cleanup = opts.onInit?.(store);
    if (typeof cleanup === 'function') stops.push(cleanup);
    if (opts.write === 'on-change') {
      // Don't echo a value another surface just wrote back at it.
      stops.push(store.subscribe((v) => !guard.suppressed && write(v)));
    }
    stops.push(
      watchKey(opts.key, (raw) => {
        const next = opts.parse(raw);
        if (next === undefined) return;
        guard.applyExternal(() => store.set(next));
      }),
    );
  }

  return {
    store,
    init() {
      started ??= hydrate();
      return started;
    },
    write,
    applyWithoutPersisting(next: T) {
      guard.applyExternal(() => store.set(next));
    },
    dispose() {
      for (const stop of stops) stop();
      stops = [];
      started = null;
      generation += 1;
    },
  };
}
