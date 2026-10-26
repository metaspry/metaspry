import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { get } from 'svelte/store';
import { DEFAULT_SETTINGS, normalizeAuditSettings, type Settings } from './settings';

// One normaliser for every stored settings value (architecture review 2026-10-26, Medium 10).

type Vector = { name: string; raw: unknown; expected: Settings | 'defaults' };
const fixture = JSON.parse(readFileSync(resolve(__dirname, '../contract/settings-normalize.json'), 'utf8')) as {
  defaults: Settings;
  vectors: Vector[];
};

describe('normalizeAuditSettings (contract/settings-normalize.json)', () => {
  it('the fixture defaults are the extension defaults', () => {
    expect(fixture.defaults).toEqual(DEFAULT_SETTINGS);
  });

  it.each(fixture.vectors)('$name', (v) => {
    expect(normalizeAuditSettings(v.raw)).toEqual(v.expected === 'defaults' ? DEFAULT_SETTINGS : v.expected);
  });
});

describe('every read path goes through it', () => {
  let stored: Record<string, unknown>;
  let changed: ((changes: Record<string, { newValue: unknown }>, area: string) => void) | null;

  beforeEach(() => {
    vi.resetModules();
    stored = {};
    changed = null;
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: (key: string, cb: (r: Record<string, unknown>) => void) => cb({ [key]: stored[key] }),
          set: vi.fn((v: Record<string, unknown>) => Object.assign(stored, v)),
        },
        onChanged: { addListener: (fn: typeof changed) => (changed = fn) },
      },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('chrome.storage: a legacy all-zero value loads as the defaults, not a 0 score', async () => {
    stored.settings = { ...DEFAULT_SETTINGS, weights: { required: 0, recommended: 0, 'best-practice': 0 } };
    const mod = await import('./settings');
    await mod.initSettings();
    expect(get(mod.settings).weights).toEqual(DEFAULT_SETTINGS.weights);
  });

  it('another surface writing a malformed value is normalised too', async () => {
    const mod = await import('./settings');
    await mod.initSettings();
    changed?.({ settings: { newValue: { titleMin: 'oops', weights: { required: 12 } } } }, 'local');
    expect(get(mod.settings)).toMatchObject({ titleMin: 30, weights: { required: 12, recommended: 5 } });
  });
});
