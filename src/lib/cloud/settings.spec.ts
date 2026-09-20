import { describe, it, expect, vi } from 'vitest';
import { syncSettingsForUser } from './settings';
import { DEFAULT_SETTINGS, type Settings } from '../storage/settings';

const custom = (tag: string): Settings => ({
  ...DEFAULT_SETTINGS,
  weights: { ...DEFAULT_SETTINGS.weights },
  __tag: tag,
} as unknown as Settings);

function harness(clouds: Record<string, Settings | null>) {
  const applied: Settings[] = [];
  return {
    applied,
    deps: {
      load: vi.fn(async (uid: string) => clouds[uid] ?? null),
      apply: (s: Settings) => void applied.push(s),
    },
  };
}

describe('syncSettingsForUser', () => {
  it('resets to defaults before pulling', async () => {
    const h = harness({ a: custom('A') });
    await syncSettingsForUser({ uid: 'a' }, h.deps);
    expect(h.applied[0]).toBe(DEFAULT_SETTINGS);
    expect(h.applied[1]).toEqual(custom('A'));
  });

  it('leaves the defaults in place for a user with no cloud doc', async () => {
    const h = harness({});
    const pulled = await syncSettingsForUser({ uid: 'b' }, h.deps);
    expect(h.applied).toEqual([DEFAULT_SETTINGS]);
    expect(pulled).toBe('b');
  });

  it('does not carry user A settings into user B on a direct switch', async () => {
    const h = harness({ a: custom('A') });
    await syncSettingsForUser({ uid: 'a' }, h.deps);
    h.applied.length = 0;
    await syncSettingsForUser({ uid: 'b' }, h.deps);
    expect(h.applied).toEqual([DEFAULT_SETTINGS]);
    expect(h.applied).not.toContainEqual(custom('A'));
  });

  it('resets on sign-out and blocks pushes', async () => {
    const h = harness({ a: custom('A') });
    await syncSettingsForUser({ uid: 'a' }, h.deps);
    h.applied.length = 0;
    const pulled = await syncSettingsForUser(null, h.deps);
    expect(pulled).toBeNull();
    expect(h.applied).toEqual([DEFAULT_SETTINGS]);
    expect(h.deps.load).toHaveBeenCalledTimes(1);
  });
});
