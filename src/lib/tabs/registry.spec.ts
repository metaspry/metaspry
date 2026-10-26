import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DIGIT_RANGE, DIGIT_TABS, RESULT_TABS, TAB_NAMES, isResultTab } from './registry';
import { shortcutFor } from '../components/Shortcuts/keyboard';

// Architecture review 2026-10-26, High 6: one tab list for the strip, the digits and the help.

describe('results tab registry', () => {
  it('lists the six tabs in order with unique ids', () => {
    expect(RESULT_TABS.map((t) => t.id)).toEqual(['tags', 'previews', 'audit', 'site', 'aeo', 'compare']);
    expect(new Set(RESULT_TABS.map((t) => t.id)).size).toBe(RESULT_TABS.length);
  });

  it('the guard accepts exactly the registered ids', () => {
    for (const t of RESULT_TABS) expect(isResultTab(t.id)).toBe(true);
    expect(isResultTab('settings')).toBe(false);
  });

  it('digit shortcuts cover exactly the registered tabs', () => {
    for (let i = 1; i <= DIGIT_TABS; i++) expect(shortcutFor(String(i), false, true)).toEqual({ kind: 'tab', index: i - 1 });
    expect(shortcutFor(String(DIGIT_TABS + 1), false, true)).toBeNull();
    expect(DIGIT_RANGE).toBe('1 – 6');
    expect(TAB_NAMES).toBe('Tags / Previews / Audit / Site / AI / Compare');
  });

  it('every registered tab has a panel in Extension.svelte', () => {
    const src = readFileSync('src/lib/views/Extension.svelte', 'utf8');
    for (const t of RESULT_TABS) expect(src, t.id).toContain(`id="panel-${t.id}"`);
  });
});
