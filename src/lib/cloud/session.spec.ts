import { describe, it, expect, vi } from 'vitest';
import { hasStoredSession, maySignedIn } from './session';

type Handlers = Partial<Record<'onsuccess' | 'onerror' | 'onupgradeneeded' | 'onblocked', () => void>>;

/** A minimal IndexedDB: `stores` maps store name -> keys; null = the database does not exist. */
function fakeIdb(stores: Record<string, string[]> | null, opts: { listDatabases?: boolean } = {}) {
  const abort = vi.fn();
  const open = vi.fn(() => {
    const req: Handlers & { result?: unknown; transaction?: { abort: () => void } } = {};
    queueMicrotask(() => {
      if (stores === null) {
        req.transaction = { abort };
        req.onupgradeneeded?.();
        return;
      }
      req.result = {
        objectStoreNames: { contains: (n: string) => n in stores },
        close: vi.fn(),
        transaction: (name: string) => ({
          objectStore: () => {
            const keysReq: Handlers & { result?: string[] } = {};
            queueMicrotask(() => {
              keysReq.result = stores[name] ?? [];
              keysReq.onsuccess?.();
            });
            return { getAllKeys: () => keysReq };
          },
        }),
      };
      req.onsuccess?.();
    });
    return req;
  });
  const idb = {
    open,
    ...(opts.listDatabases === false
      ? {}
      : { databases: async () => (stores === null ? [] : [{ name: 'firebaseLocalStorageDb' }]) }),
  };
  return { idb: idb as unknown as Parameters<typeof hasStoredSession>[0], open, abort };
}

describe('hasStoredSession', () => {
  it('true when Firebase persisted a user', async () => {
    const { idb } = fakeIdb({ firebaseLocalStorage: ['firebase:authUser:KEY:[DEFAULT]'] });
    await expect(hasStoredSession(idb)).resolves.toBe(true);
  });

  it('false when the store holds no user (signed out)', async () => {
    const { idb } = fakeIdb({ firebaseLocalStorage: ['__sak'] });
    await expect(hasStoredSession(idb)).resolves.toBe(false);
  });

  it('false without opening anything when the database is not listed', async () => {
    const { idb, open } = fakeIdb(null);
    await expect(hasStoredSession(idb)).resolves.toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('never creates the database while probing (aborts the upgrade)', async () => {
    const { idb, abort } = fakeIdb(null, { listDatabases: false });
    await expect(hasStoredSession(idb)).resolves.toBe(false);
    expect(abort).toHaveBeenCalled();
  });

  it('answers "maybe" (true) when IndexedDB errors, so a signed-in user is never shown signed out', async () => {
    const idb = { databases: async () => Promise.reject(new Error('blocked')), open: vi.fn() };
    await expect(hasStoredSession(idb as unknown as Parameters<typeof hasStoredSession>[0])).resolves.toBe(true);
  });

  it('false when there is no IndexedDB at all', async () => {
    await expect(hasStoredSession(undefined)).resolves.toBe(false);
  });
});

describe('maySignedIn', () => {
  it('trusts the stored hint and skips the probe', async () => {
    const probe = vi.fn(async () => true);
    await expect(maySignedIn(async () => false, probe)).resolves.toBe(false);
    await expect(maySignedIn(async () => true, probe)).resolves.toBe(true);
    expect(probe).not.toHaveBeenCalled();
  });

  it('probes IndexedDB when there is no hint yet (installs from before it existed)', async () => {
    const probe = vi.fn(async () => true);
    await expect(maySignedIn(async () => null, probe)).resolves.toBe(true);
    expect(probe).toHaveBeenCalledTimes(1);
  });
});
