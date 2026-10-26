import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
import { DEFAULT_SETTINGS, type Settings } from '../storage/settings';

// Cloud-layer races and duplicate writes (architecture review 2026-10-26, High 5).

vi.mock('./auth', async () => {
  const { writable: w } = await import('svelte/store');
  return { cloudUser: w<{ uid: string } | null>(null) };
});

let pendingWorkspaceFetches: Array<(docs: unknown[]) => void> = [];
vi.mock('./sdk', () => ({
  firestoreSdk: async () => ({
    db: {},
    collection: () => ({}),
    where: () => ({}),
    query: () => ({}),
    getDocs: () => new Promise((r) => pendingWorkspaceFetches.push((docs) => r({ docs }))),
  }),
}));

import { cloudUser } from './auth';
import { makeUserFollower } from './settings';
import { fetchWorkspaces, workspaces } from './workspaces';
import { settingsChangeIsExternal, applySettingsWithoutPersisting, settings } from '../storage/settings';

const tagged = (tag: string) => ({ ...DEFAULT_SETTINGS, titleMin: tag.length } as Settings);

describe('settings pull across a fast account switch', () => {
  it("drops user A's late pull: B keeps B's rules and pushes are allowed for B only", async () => {
    const resolvers: Record<string, (s: Settings | null) => void> = {};
    const applied: Settings[] = [];
    const allowed: Array<string | null> = [];
    const follow = makeUserFollower({
      load: (uid) => new Promise((r) => (resolvers[uid] = r)),
      apply: (s) => applied.push(s),
      onAllowed: (uid) => allowed.push(uid),
    });
    const a = follow({ uid: 'a' });
    const b = follow({ uid: 'b' });
    resolvers.b!(tagged('bb'));
    await b;
    resolvers.a!(tagged('aaaa'));
    await a;
    expect(applied[applied.length - 1]?.titleMin).toBe(2);
    expect(applied.some((s) => s.titleMin === 4)).toBe(false);
    expect(allowed[allowed.length - 1]).toBe('b');
    expect(allowed).not.toContain('a');
  });

  it('a failed load keeps pushes off and reports it, without an unhandled rejection', async () => {
    const onLoadError = vi.fn();
    const allowed: Array<string | null> = [];
    const follow = makeUserFollower({
      load: async () => Promise.reject(new Error('offline')),
      apply: () => {},
      onAllowed: (uid) => allowed.push(uid),
      onLoadError,
    });
    await follow({ uid: 'a' });
    expect(onLoadError).toHaveBeenCalledTimes(1);
    expect(allowed).toEqual([null]);
  });
});

describe('a settings change from elsewhere is marked external', () => {
  it('the cloud push can tell a pulled or watched value from a local edit', () => {
    const seen: boolean[] = [];
    const stop = settings.subscribe(() => seen.push(settingsChangeIsExternal()));
    applySettingsWithoutPersisting({ ...DEFAULT_SETTINGS, titleMin: 11 });
    settings.set({ ...DEFAULT_SETTINGS, titleMin: 12 });
    stop();
    expect(seen.slice(-2)).toEqual([true, false]);
  });
});

describe('workspaces across a fast account switch', () => {
  it("user A's late workspace list never lands for user B", async () => {
    pendingWorkspaceFetches = [];
    cloudUser.set({ uid: 'a' } as never);
    const forA = fetchWorkspaces('a');
    cloudUser.set({ uid: 'b' } as never);
    const forB = fetchWorkspaces('b');
    await new Promise((r) => setTimeout(r, 0));
    const [resolveA, resolveB] = pendingWorkspaceFetches;
    resolveB!([{ id: 'wb', data: () => ({ name: 'B team', roles: { b: 'owner' }, plan: 'team' }) }]);
    await forB;
    resolveA!([{ id: 'wa', data: () => ({ name: 'A team', roles: { a: 'owner' }, plan: 'team' }) }]);
    await forA;
    expect(get(workspaces).map((w) => w.id)).toEqual(['wb']);
  });
});
