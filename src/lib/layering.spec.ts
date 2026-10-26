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
    return /\.(ts|js)$/.test(name) && !/\.spec\.ts$/.test(name) ? [p] : [];
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
        if (!spec.startsWith('.')) continue;
        const target = relative(LIB, join(f, '..', spec)).split(sep)[0] ?? '';
        const hit = `${f.split(sep).join('/')} -> ${spec}`;
        if (UI.has(target) && !ALLOWED.includes(hit)) offenders.push(hit);
      }
    }
    expect(offenders).toEqual([]);
  });
});
