import { describe, it, expect } from 'vitest';
import { shortcutFor } from './keyboard';
import { parseShortcutsPref } from '../../storage/shortcuts';

describe('shortcutFor', () => {
  it('maps every single-key shortcut when enabled', () => {
    expect(shortcutFor('/', false, true)).toEqual({ kind: 'search' });
    expect(shortcutFor('r', false, true)).toEqual({ kind: 'rescan' });
    expect(shortcutFor('R', true, true)).toEqual({ kind: 'rescan' });
    expect(shortcutFor('1', false, true)).toEqual({ kind: 'tab', index: 0 });
    expect(shortcutFor('6', false, true)).toEqual({ kind: 'tab', index: 5 });
    expect(shortcutFor('7', false, true)).toBeNull();
    expect(shortcutFor('?', true, true)).toEqual({ kind: 'help' });
  });

  it('leaves only ? when single-key shortcuts are off', () => {
    for (const k of ['/', 'r', 'R', '1', '3', '6']) expect(shortcutFor(k, false, false)).toBeNull();
    expect(shortcutFor('?', true, false)).toEqual({ kind: 'help' });
    expect(shortcutFor('/', true, false)).toEqual({ kind: 'help' });
  });

  it('ignores multi-character keys', () => {
    expect(shortcutFor('Enter', false, true)).toBeNull();
    expect(shortcutFor('Escape', false, true)).toBeNull();
  });
});

describe('parseShortcutsPref', () => {
  it('is on unless explicitly false', () => {
    expect(parseShortcutsPref(undefined)).toBe(true);
    expect(parseShortcutsPref(true)).toBe(true);
    expect(parseShortcutsPref('no')).toBe(true);
    expect(parseShortcutsPref(false)).toBe(false);
  });
});
