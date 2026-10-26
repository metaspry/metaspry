import { describe, it, expect, beforeEach } from 'vitest';
import { clearDiagnostics, diagnosticEntries, diagnosticsText, report } from './diagnostics';

beforeEach(() => clearDiagnostics());

describe('report', () => {
  it('records the context and the error message', () => {
    report(new TypeError('Failed to fetch'), 'scan.site-files', () => 1000);
    expect(diagnosticEntries()).toEqual([{ at: 1000, context: 'scan.site-files', message: 'Failed to fetch', name: 'TypeError' }]);
  });

  it('accepts anything thrown without throwing itself', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => {
      report('plain string', 'a');
      report({ code: 'permission-denied' }, 'b');
      report(undefined, 'c');
      report(cyclic, 'd');
    }).not.toThrow();
    expect(diagnosticEntries().map((e) => e.message)).toEqual(['plain string', 'permission-denied', 'undefined', '[object Object]']);
  });

  it('keeps only the last 50 entries and cuts long messages', () => {
    for (let i = 0; i < 60; i++) report(new Error(`e${i}`), 'loop');
    const list = diagnosticEntries();
    expect(list).toHaveLength(50);
    expect(list[0]!.message).toBe('e10');
    report(new Error('x'.repeat(2000)), 'long');
    const all = diagnosticEntries();
    expect(all[all.length - 1]!.message).toHaveLength(500);
  });
});

describe('diagnosticsText', () => {
  it('starts with version, browser and surface, then one line per entry', () => {
    report(new Error('boom'), 'compare.left-fetch', () => Date.UTC(2026, 9, 26));
    const text = diagnosticsText({ version: '1.0.31', userAgent: 'UA', mode: 'sidepanel' });
    expect(text.split('\n')).toEqual([
      'Metaspry 1.0.31',
      'Browser: UA',
      'Surface: sidepanel',
      'Entries: 1',
      '2026-10-26T00:00:00.000Z compare.left-fetch: Error: boom',
    ]);
  });
});
