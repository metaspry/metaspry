import { describe, it, expect, vi } from 'vitest';

vi.mock('./firebase', () => ({ fbDb: () => ({}) }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), onSnapshot: vi.fn() }));
vi.mock('./auth', async () => {
  const { writable } = await import('svelte/store');
  return { cloudUser: writable(null) };
});

import { normalizeAuditSettings, resolveEffectiveSettings, workspacePlanEntitled } from './workspace-scoring';
import { DEFAULT_SETTINGS, type Settings } from '../storage/settings';

const custom: Settings = { ...DEFAULT_SETTINGS, titleMin: 10, weights: { required: 20, recommended: 1, 'best-practice': 1 } };

describe('workspacePlanEntitled', () => {
  it('locks only an explicit inactive plan, like the app', () => {
    expect(workspacePlanEntitled('team')).toBe(true);
    expect(workspacePlanEntitled('pro')).toBe(true);
    expect(workspacePlanEntitled('team-preview')).toBe(true);
    expect(workspacePlanEntitled(undefined)).toBe(true);
    expect(workspacePlanEntitled('inactive')).toBe(false);
  });
});

describe('resolveEffectiveSettings', () => {
  it('uses the workspace rules for an entitled workspace target, even for a free member', () => {
    expect(resolveEffectiveSettings(DEFAULT_SETTINGS, false, { wsId: 'w', name: 'Team', settings: custom })).toBe(custom);
  });

  it('uses personal rules for a personal Pro and the defaults otherwise', () => {
    expect(resolveEffectiveSettings(custom, true, null)).toBe(custom);
    expect(resolveEffectiveSettings(custom, false, null)).toBe(DEFAULT_SETTINGS);
  });
});

describe('normalizeAuditSettings', () => {
  it('merges over the defaults and drops non-numbers', () => {
    const s = normalizeAuditSettings({ titleMin: 5, descMax: 'x', weights: { required: 7, recommended: -1 } });
    expect(s.titleMin).toBe(5);
    expect(s.descMax).toBe(DEFAULT_SETTINGS.descMax);
    expect(s.weights.required).toBe(7);
    expect(s.weights.recommended).toBe(DEFAULT_SETTINGS.weights.recommended);
  });

  it('falls back to the default weights when all three are zero, like the app', () => {
    expect(normalizeAuditSettings({ weights: { required: 0, recommended: 0, 'best-practice': 0 } }).weights).toEqual(
      DEFAULT_SETTINGS.weights,
    );
  });

  it('is the defaults for a missing document', () => {
    expect(normalizeAuditSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
});
