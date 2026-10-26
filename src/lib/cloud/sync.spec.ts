import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory Firestore: enough of `doc/getDoc/setDoc` for the write path `uploadScan` uses.
const store = new Map<string, Record<string, unknown>>();
// The options `setDoc` was last called with: the write must stay a plain replace (no `merge`).
let lastSetOptions: unknown = 'never-called';

vi.mock('./firebase', () => ({ fbDb: () => ({}) }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  getDoc: async (ref: { path: string }) => {
    const data = store.get(ref.path);
    return { exists: () => data !== undefined, data: () => data };
  },
  setDoc: async (ref: { path: string }, data: Record<string, unknown>, options?: unknown) => {
    store.set(ref.path, data);
    lastSetOptions = options;
  },
  serverTimestamp: () => 'server-time',
  // The transaction runs its body against the same store; `set` records the options like setDoc.
  runTransaction: async (_db: unknown, body: (tx: unknown) => Promise<unknown>) => {
    transactions++;
    return body({
      get: async (ref: { path: string }) => {
        const data = store.get(ref.path);
        return { exists: () => data !== undefined, data: () => data };
      },
      set: (ref: { path: string }, data: Record<string, unknown>, options?: unknown) => {
        store.set(ref.path, data);
        lastSetOptions = options;
      },
    });
  },
}));
let transactions = 0;

import { uploadScan, toScanPayload, TAG_MAX, TAG_VALUE_MAX } from './sync';
import { getMetaTags } from '../scrapers/getMetaTags';
import { audit } from '../audit/rules';

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
    expect(lastSetOptions).toBeUndefined(); // no `{ merge: true }`: undefined fields must drop
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

describe('uploadScan writes atomically (architecture review 2026-10-26, High 5)', () => {
  it('reads the previous document and writes the new one in one transaction', async () => {
    const before = transactions;
    await uploadScan('u1', payload('https://acme.com/tx'));
    expect(transactions).toBe(before + 1);
  });
});

describe('toScanPayload stays under the Firestore document limit', () => {
  it('cuts long tag values and caps the tag list; tagCount stays true', () => {
    const big = 'x'.repeat(TAG_VALUE_MAX + 500);
    const metas = Array.from({ length: TAG_MAX + 50 }, (_, i) => `<meta name="k${i}" content="${big}">`).join('');
    const html = `<html><head><title>T</title>${metas}</head></html>`;
    const meta = getMetaTags(new DOMParser().parseFromString(html, 'text/html').documentElement, 'https://a.com/');
    const p = toScanPayload(meta, audit(meta), 'https://a.com/');
    expect(p.pageMeta.tagCount).toBe(TAG_MAX + 50);
    expect(p.pageMeta.tags).toHaveLength(TAG_MAX);
    expect(p.pageMeta.tags.every((t) => t.value.length <= TAG_VALUE_MAX)).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(p)).length).toBeLessThan(1_000_000);
  });
});
