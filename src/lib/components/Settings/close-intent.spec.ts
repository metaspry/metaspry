import { describe, it, expect } from 'vitest';
import { closeIntent } from './close-intent';

describe('closeIntent (UX review 2026-10-25, Medium 19)', () => {
  it.each(['escape', 'backdrop', 'button'] as const)('an untouched form closes on %s', (via) => {
    expect(closeIntent(false, false, via)).toBe('close');
  });

  it.each(['escape', 'backdrop', 'button'] as const)('unsaved edits ask first on %s', (via) => {
    expect(closeIntent(true, false, via)).toBe('confirm');
  });

  it('Esc on the question keeps editing; it never discards', () => {
    expect(closeIntent(true, true, 'escape')).toBe('keep-editing');
  });

  it('another backdrop or close press keeps the question up', () => {
    expect(closeIntent(true, true, 'backdrop')).toBe('confirm');
    expect(closeIntent(true, true, 'button')).toBe('confirm');
  });
});
