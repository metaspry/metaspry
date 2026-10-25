import { describe, it, expect, vi } from 'vitest';

// The SDK loads lazily (sdk.ts). A target that goes A -> none -> A while the first load is pending
// must end with ONE listener on A, not two (one of which nobody could unsubscribe).

const resolvers: Array<(v: unknown) => void> = [];
const onSnapshot = vi.fn(() => vi.fn());
vi.mock('./sdk', () => ({
  firestoreSdk: () => new Promise((r) => resolvers.push(r)),
}));
vi.mock('./auth', async () => {
  const { writable } = await import('svelte/store');
  return { cloudUser: writable(null) };
});

import { initWorkspaceScoring } from './workspace-scoring';
import { syncScope, workspaces } from './workspaces';

describe('initWorkspaceScoring with a slow SDK', () => {
  it('attaches a single snapshot listener after A -> none -> A', async () => {
    workspaces.set([{ id: 'A', name: 'Acme', role: 'member', entitled: true }]);
    initWorkspaceScoring();
    syncScope.set({ kind: 'workspace', wsId: 'A', name: 'Acme' });
    syncScope.set({ kind: 'personal' });
    syncScope.set({ kind: 'workspace', wsId: 'A', name: 'Acme' });
    expect(resolvers).toHaveLength(2);
    const sdk = { db: {}, doc: vi.fn(() => ({})), onSnapshot };
    for (const r of resolvers) r(sdk);
    await new Promise((r) => setTimeout(r, 0));
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });
});
