import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

// UX review item 11: Firebase is ~1 MB and must load only on demand (`sdk.ts`). One static import
// anywhere pulls it back into the chunk every open parses. Type-only imports are erased, so allowed.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|js|svelte)$/.test(name) && !name.endsWith('.spec.ts') ? [p] : [];
  });
}

const STATIC_SDK = /^\s*import\s+(?!type\b)[^;]*?from\s+['"](firebase\/[^'"]+|(\.\.?\/)+(cloud\/)?firebase)['"]/m;

describe('Firebase stays lazy', () => {
  it('only cloud/firebase.ts imports the SDK statically; everything else goes through sdk.ts', () => {
    const offenders = sourceFiles('src').filter(
      (f) => !f.endsWith(`cloud${sep}firebase.ts`) && STATIC_SDK.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('the pattern catches a static import and ignores a type-only one', () => {
    expect(STATIC_SDK.test("import { doc } from 'firebase/firestore';")).toBe(true);
    expect(STATIC_SDK.test("import { fbDb } from './firebase';")).toBe(true);
    expect(STATIC_SDK.test("import type { User } from './firebase';")).toBe(false);
  });
});
