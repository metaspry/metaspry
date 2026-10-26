import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../storage/settings';

// The personal cloud document goes through the same normaliser as chrome.storage and the workspace
// document (architecture review 2026-10-26, Medium 10): it used to be a bare spread.

let docData: unknown = null;
vi.mock('./sdk', () => ({
  firestoreSdk: async () => ({
    db: {},
    doc: () => ({}),
    getDoc: async () => ({ exists: () => docData !== null, data: () => docData }),
  }),
}));
vi.mock('./auth', async () => {
  const { writable } = await import('svelte/store');
  return { cloudUser: writable(null) };
});

import { loadCloudSettings } from './settings';

describe('loadCloudSettings', () => {
  it('no document: null (the defaults then apply)', async () => {
    docData = null;
    await expect(loadCloudSettings('u')).resolves.toBeNull();
  });

  it('a legacy all-zero document scores with the default weights, not 0', async () => {
    docData = { weights: { required: 0, recommended: 0, 'best-practice': 0 } };
    await expect(loadCloudSettings('u')).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('non-numeric fields fall back; valid ones are kept', async () => {
    docData = { titleMin: '12', titleMax: 70, weights: { required: 15 } };
    await expect(loadCloudSettings('u')).resolves.toMatchObject({ titleMin: 30, titleMax: 70, weights: { required: 15, recommended: 5 } });
  });
});
