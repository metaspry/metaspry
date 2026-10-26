import { describe, it, expect, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { persisted } from './persisted';
import { fakeStorage } from '../../test/fake-storage';

afterEach(() => {
  vi.unstubAllGlobals();
});

const list = (raw: unknown) => (Array.isArray(raw) ? (raw as string[]) : undefined);

function setup(initial: Record<string, unknown> = {}, write: 'on-change' | 'explicit' = 'on-change') {
  const fake = fakeStorage(initial);
  vi.stubGlobal('chrome', fake.chrome);
  const p = persisted<string[]>({ key: 'k', fallback: () => ['default'], parse: list, write });
  return { fake, p };
}

describe('persisted', () => {
  it('hydrates from storage', async () => {
    const { p } = setup({ k: ['a'] });
    await p.init();
    expect(get(p.store)).toEqual(['a']);
  });

  it('uses the fallback when nothing usable is stored', async () => {
    const { p } = setup({ k: 'corrupt' });
    await p.init();
    expect(get(p.store)).toEqual(['default']);
  });

  it('uses the fallback outside the extension runtime and does not throw', async () => {
    vi.stubGlobal('chrome', undefined);
    const p = persisted<string[]>({ key: 'k', fallback: () => ['default'], parse: list, write: 'on-change' });
    await p.init();
    p.store.set(['x']);
    expect(get(p.store)).toEqual(['x']);
  });

  it('writes each local change once', async () => {
    const { fake, p } = setup({ k: [] });
    await p.init();
    fake.sets.length = 0;
    p.store.set(['b']);
    await fake.flush();
    expect(fake.sets).toEqual([{ k: ['b'] }]);
  });

  it('init is idempotent: one subscription, one listener, one write per change', async () => {
    const { fake, p } = setup({ k: [] });
    const first = p.init();
    expect(p.init()).toBe(first);
    await first;
    await p.init();
    expect(fake.listeners.size).toBe(1);
    fake.sets.length = 0;
    p.store.set(['c']);
    await fake.flush();
    expect(fake.sets).toHaveLength(1);
  });

  it("applies another surface's change without writing it back", async () => {
    const { fake, p } = setup({ k: [] });
    await p.init();
    fake.sets.length = 0;
    await fake.external('k', ['from-popup']);
    expect(get(p.store)).toEqual(['from-popup']);
    expect(fake.sets).toEqual([]);
  });

  it('ignores an external change that does not parse', async () => {
    const { fake, p } = setup({ k: ['a'] });
    await p.init();
    await fake.external('k', 42);
    expect(get(p.store)).toEqual(['a']);
  });

  it("'explicit' stores persist only through write()", async () => {
    const { fake, p } = setup({ k: ['a'] }, 'explicit');
    await p.init();
    fake.sets.length = 0;
    p.store.set(['local only']);
    await fake.flush();
    expect(fake.sets).toEqual([]);
    p.write(['saved']);
    await fake.flush();
    expect(fake.sets).toEqual([{ k: ['saved'] }]);
  });

  it('applyWithoutPersisting sets the store and writes nothing', async () => {
    const { fake, p } = setup({ k: [] });
    await p.init();
    fake.sets.length = 0;
    p.applyWithoutPersisting(['reset']);
    await fake.flush();
    expect(get(p.store)).toEqual(['reset']);
    expect(fake.sets).toEqual([]);
  });

  it('dispose removes the listener and the writer, and init can run again', async () => {
    const { fake, p } = setup({ k: [] });
    await p.init();
    p.dispose();
    expect(fake.listeners.size).toBe(0);
    fake.sets.length = 0;
    p.store.set(['after dispose']);
    await fake.flush();
    expect(fake.sets).toEqual([]);
    await p.init();
    expect(fake.listeners.size).toBe(1);
  });

  it('a dispose during the first read stops that hydration from syncing', async () => {
    const { fake, p } = setup({ k: ['a'] });
    const pending = p.init();
    p.dispose();
    await pending;
    expect(fake.listeners.size).toBe(0);
  });

  it('runs onInit once after hydration, and its cleanup on dispose', async () => {
    const fake = fakeStorage({ k: ['a'] });
    vi.stubGlobal('chrome', fake.chrome);
    const cleanup = vi.fn();
    const onInit = vi.fn(() => cleanup);
    const p = persisted<string[]>({ key: 'k', fallback: () => [], parse: list, write: 'explicit', onInit });
    await p.init();
    await p.init();
    expect(onInit).toHaveBeenCalledTimes(1);
    p.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
