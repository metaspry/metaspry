import { describe, it, expect, vi } from 'vitest';
import { get, writable } from 'svelte/store';
import { guardUnload, resetSyncFor, syncErrorMessage, trackUpload, type SyncState } from './sync-status';

describe('trackUpload', () => {
  it('goes saving -> saved and returns the value', async () => {
    const store = writable<SyncState>({ kind: 'idle' });
    const seen: SyncState['kind'][] = [];
    store.subscribe((s) => seen.push(s.kind));
    const out = await trackUpload('Personal', async () => 42, store, () => 7);
    expect(out).toEqual({ ok: true, value: 42 });
    expect(get(store)).toEqual({ kind: 'saved', target: 'Personal', at: 7 });
    expect(seen).toEqual(['idle', 'saving', 'saved']);
  });

  it('a rejected upload ends in error with a plain reason, never "saved"', async () => {
    const store = writable<SyncState>({ kind: 'idle' });
    const out = await trackUpload('Acme', async () => Promise.reject({ code: 'permission-denied' }), store);
    expect(out.ok).toBe(false);
    const s = get(store);
    expect(s.kind).toBe('error');
    expect(s.kind === 'error' && s.message).toMatch(/isn't allowed to save/);
    expect(s.kind === 'error' && s.target).toBe('Acme');
  });

  it('a slow earlier upload cannot overwrite a newer result', async () => {
    const store = writable<SyncState>({ kind: 'idle' });
    let releaseFirst: (v: string) => void = () => {};
    const first = trackUpload('Personal', () => new Promise<string>((r) => (releaseFirst = r)), store);
    await trackUpload('Personal', async () => 'second', store, () => 1);
    releaseFirst('first');
    await first;
    expect(get(store)).toEqual({ kind: 'saved', target: 'Personal', at: 1 });
  });
});

describe('resetSyncFor', () => {
  it("an account change clears the previous user's error, and drops their in-flight result", async () => {
    const store = writable<SyncState>({ kind: 'idle' });
    resetSyncFor('a', store);
    await trackUpload('Personal', async () => Promise.reject({ code: 'permission-denied' }), store);
    expect(get(store).kind).toBe('error');

    let release: () => void = () => {};
    const inFlight = trackUpload('Personal', () => new Promise<void>((r) => (release = r)), store);
    resetSyncFor('b', store);
    expect(get(store)).toEqual({ kind: 'idle' });
    release();
    await inFlight;
    expect(get(store)).toEqual({ kind: 'idle' });

    // Same user again: nothing to reset.
    store.set({ kind: 'saved', target: 'Personal', at: 1 });
    resetSyncFor('b', store);
    expect(get(store).kind).toBe('saved');
  });
});

describe('syncErrorMessage', () => {
  it.each([
    ['permission-denied', /isn't allowed/],
    ['firestore/unauthenticated', /sign-in expired/],
    ['resource-exhausted', /limit/],
    ['unavailable', /Check your connection/],
    ['deadline-exceeded', /Check your connection/],
  ])('%s', (code, expected) => {
    expect(syncErrorMessage({ code })).toMatch(expected);
  });

  it('anything else gets a generic sentence, not the raw error', () => {
    expect(syncErrorMessage(new Error('FirebaseError: weird internal thing'))).toBe(
      "Couldn't save this scan to your account. Re-scan to try again.",
    );
  });
});

describe('guardUnload', () => {
  it('asks before unload only while saving', () => {
    const store = writable<SyncState>({ kind: 'idle' });
    const target = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const stop = guardUnload(store, target);
    expect(target.addEventListener).not.toHaveBeenCalled();

    store.set({ kind: 'saving', target: 'Personal' });
    expect(target.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    const handler = target.addEventListener.mock.calls[0]![1] as (e: { preventDefault: () => void; returnValue: string }) => void;
    const event = { preventDefault: vi.fn(), returnValue: 'x' };
    handler(event);
    expect(event.preventDefault).toHaveBeenCalled();

    store.set({ kind: 'saved', target: 'Personal', at: 1 });
    expect(target.removeEventListener).toHaveBeenCalledWith('beforeunload', handler);
    stop();
  });
});
