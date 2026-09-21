import { describe, it, expect } from 'vitest';
import { makeWriteGuard } from './watch';

describe('makeWriteGuard', () => {
  it('is not suppressed at rest', () => {
    expect(makeWriteGuard().suppressed).toBe(false);
  });

  it('suppresses writes while applying an external value', () => {
    const guard = makeWriteGuard();
    const writes: string[] = [];
    const write = (v: string) => {
      if (guard.suppressed) return;
      writes.push(v);
    };

    write('local edit');
    guard.applyExternal(() => write('from the other surface'));
    write('another local edit');

    expect(writes).toEqual(['local edit', 'another local edit']);
  });

  it('lifts suppression again after the callback throws', () => {
    const guard = makeWriteGuard();
    expect(() =>
      guard.applyExternal(() => {
        throw new Error('boom');
      })
    ).toThrow('boom');
    expect(guard.suppressed).toBe(false);
  });

  it('handles nesting', () => {
    const guard = makeWriteGuard();
    guard.applyExternal(() => {
      guard.applyExternal(() => {
        expect(guard.suppressed).toBe(true);
      });
      expect(guard.suppressed).toBe(true);
    });
    expect(guard.suppressed).toBe(false);
  });
});
