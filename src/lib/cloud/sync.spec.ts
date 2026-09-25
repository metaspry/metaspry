import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory Firestore: enough of `doc/getDoc/setDoc` for the write path `uploadScan` uses.
const store = new Map<string, Record<string, unknown>>();

vi.mock('./firebase', () => ({ fbDb: () => ({}) }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  getDoc: async (ref: { path: string }) => {
    const data = store.get(ref.path);
    return { exists: () => data !== undefined, data: () => data };
  },
  setDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
    store.set(ref.path, data);
  },
  serverTimestamp: () => 'server-time',
}));

import { uploadScan, type toScanPayload } from './sync';

const payload = (url: string) =>
  ({ url, scannedAt: 2_000, starred: false }) as unknown as ReturnType<typeof toScanPayload>;

beforeEach(() => store.clear());

describe('uploadScan', () => {
  it('first scan of a URL: no previous document', async () => {
    const r = await uploadScan('u1', payload('https://acme.com/'));
    expect(r.hadPrevious).toBe(false);
    expect(r.previousScannedAt).toBeNull();
    expect(r.id).toMatch(/^s[0-9a-z]+$/);
    const written = store.get(`users/u1/scans/${r.id}`);
    expect(written).toMatchObject({ url: 'https://acme.com/', workspaceId: null, starred: false });
    expect(written?.createdAt).toBe('server-time');
  });

  it('re-scan: reports the previous scannedAt and carries starred + createdAt forward', async () => {
    const first = await uploadScan('u1', payload('https://acme.com/'));
    store.set(`users/u1/scans/${first.id}`, {
      ...store.get(`users/u1/scans/${first.id}`),
      scannedAt: 1_000,
      starred: true,
      createdAt: 'first-time',
    });
    const r = await uploadScan('u1', payload('https://acme.com/'));
    expect(r.id).toBe(first.id);
    expect(r.hadPrevious).toBe(true);
    expect(r.previousScannedAt).toBe(1_000);
    expect(store.get(`users/u1/scans/${r.id}`)).toMatchObject({
      scannedAt: 2_000,
      starred: true,
      createdAt: 'first-time',
    });
  });

  it('workspace scope writes under the workspace and stamps workspaceId', async () => {
    const r = await uploadScan('u1', payload('https://acme.com/'), {
      kind: 'workspace',
      wsId: 'ws1',
      name: 'Acme',
    });
    expect(store.get(`workspaces/ws1/scans/${r.id}`)).toMatchObject({ workspaceId: 'ws1' });
    expect(r.hadPrevious).toBe(false);
  });

  it('a previous document without a numeric scannedAt yields null', async () => {
    const first = await uploadScan('u1', payload('https://acme.com/'));
    store.set(`users/u1/scans/${first.id}`, { url: 'https://acme.com/' });
    const r = await uploadScan('u1', payload('https://acme.com/'));
    expect(r.hadPrevious).toBe(true);
    expect(r.previousScannedAt).toBeNull();
  });
});
