import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Architecture review Medium 14: logic under src/lib must not depend on the UI folders. Components
// and views may import lib; lib (outside components/ and views/) may not import them.

const LIB = join('src', 'lib');
const UI = new Set(['components', 'views']);
// Do not add exceptions: move the dependency into lib instead.
const ALLOWED: string[] = [];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    // .svelte too: a component file placed under lib/ outside components/ or views/ is still lib.
    return /\.(ts|js|svelte)$/.test(name) && !/\.spec\.ts$/.test(name) ? [p] : [];
  });
}

describe('layering', () => {
  it('no module under src/lib outside components/ and views/ imports from them', () => {
    const offenders: string[] = [];
    for (const f of files(LIB)) {
      const top = relative(LIB, f).split(sep)[0] ?? '';
      if (UI.has(top)) continue;
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)) {
        const spec = m[1] ?? '';
        // Relative imports and SvelteKit's `$lib/` alias (ultra review 2026-10-26, F5: the alias
        // was skipped, so the most common SvelteKit import style passed unchecked).
        let resolved: string;
        if (spec.startsWith('$lib/')) resolved = join(LIB, spec.slice(5));
        else if (spec.startsWith('.')) resolved = join(f, '..', spec);
        else continue;
        const target = relative(LIB, resolved).split(sep)[0] ?? '';
        const hit = `${f.split(sep).join('/')} -> ${spec}`;
        if (UI.has(target) && !ALLOWED.includes(hit)) offenders.push(hit);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('the layering guard itself (ultra review F5)', () => {
  it('sees $lib imports and relative ones alike', () => {
    const resolve = (from: string, spec: string) =>
      relative(LIB, spec.startsWith('$lib/') ? join(LIB, spec.slice(5)) : join(from, '..', spec)).split(sep)[0];
    const from = join(LIB, 'cloud', 'settings.ts');
    expect(resolve(from, '$lib/components/Toast/ToastHost.svelte')).toBe('components');
    expect(resolve(from, '../components/Toast/ToastHost.svelte')).toBe('components');
    expect(resolve(from, '$lib/toast')).toBe('toast');
  });
});
