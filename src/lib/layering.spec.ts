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

/**
 * The imports in `text` (the file at `path`, under src/lib) that reach components/ or views/.
 * Relative imports and SvelteKit's `$lib/` alias (ultra review 2026-10-26, F5). One function for
 * the guard below and its own fixture tests, so the tests fail when the guard regresses.
 */
export function offendersIn(path: string, text: string): string[] {
  const top = relative(LIB, path).split(sep)[0] ?? '';
  if (UI.has(top)) return [];
  const out: string[] = [];
  for (const m of text.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1] ?? '';
    let resolved: string;
    if (spec.startsWith('$lib/')) resolved = join(LIB, spec.slice(5));
    else if (spec.startsWith('.')) resolved = join(path, '..', spec);
    else continue;
    const target = relative(LIB, resolved).split(sep)[0] ?? '';
    const hit = `${path.split(sep).join('/')} -> ${spec}`;
    if (UI.has(target) && !ALLOWED.includes(hit)) out.push(hit);
  }
  return out;
}

describe('layering', () => {
  it('no module under src/lib outside components/ and views/ imports from them', () => {
    const offenders = files(LIB).flatMap((f) => offendersIn(f, readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('the guard walks .svelte files under lib (ultra review delta 1)', () => {
    // A lib .svelte file would be skipped by a walk that only reads .ts/.js.
    expect(/\.(ts|js|svelte)$/.test('x.svelte')).toBe(true);
    expect(files(LIB).some((f) => f.endsWith('.svelte'))).toBe(true);
  });
});

describe('offendersIn (the guard itself)', () => {
  const at = (p: string) => join(LIB, ...p.split('/'));

  it.each([
    ['cloud/a.ts', "import { t } from '$lib/components/Toast/ToastHost.svelte';"],
    ['cloud/a.ts', "import { t } from '../components/Toast/ToastHost.svelte';"],
    ['cloud/a.svelte', "<script>import X from '$lib/views/Extension.svelte';</script>"],
    ['storage/b.ts', "const m = await import('../views/Extension.svelte');"],
  ])('%s importing UI code is reported (%s)', (file, text) => {
    expect(offendersIn(at(file), text)).toHaveLength(1);
  });

  it.each([
    ['cloud/a.ts', "import { toast } from '$lib/toast';"],
    ['cloud/a.ts', "import { get } from 'svelte/store';"],
    ['components/Toast/ToastHost.svelte', "import { toast } from '../../toast';"],
    ['views/Extension.svelte', "import Tabs from '../components/Tabs/Tabs.svelte';"],
  ])('%s is fine (%s)', (file, text) => {
    expect(offendersIn(at(file), text)).toEqual([]);
  });
});
