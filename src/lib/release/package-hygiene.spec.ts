import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Architecture review 2026-10-26, Low "tooling": misfiled and unused dependencies, an ES5 target.
// Also pins the tsconfig strictness flags the repo rules forbid relaxing (AGENTS.md hard rule 7).

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  engines?: { node?: string };
};
// tsconfig.json carries trailing commas; strip them before JSON.parse.
const tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf8').replace(/,(\s*[}\]])/g, '$1')) as {
  compilerOptions: Record<string, unknown>;
};

describe('package.json', () => {
  it('ships only what the bundle imports as runtime dependencies', () => {
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['@floating-ui/dom', 'firebase']);
  });

  it('type packages and dev tools are dev dependencies; removed unused packages stay removed', () => {
    for (const name of ['@types/chrome', 'nodemon']) expect(pkg.devDependencies[name]).toBeDefined();
    for (const name of ['@sveltejs/adapter-auto', 'onchange']) {
      expect(pkg.devDependencies[name]).toBeUndefined();
      expect(pkg.dependencies[name]).toBeUndefined();
    }
  });

  it('declares the Node engine (.npmrc has engine-strict)', () => {
    expect(pkg.engines?.node).toBe('>=20');
  });
});

describe('tsconfig.json', () => {
  it('keeps every strictness flag on', () => {
    const o = tsconfig.compilerOptions;
    for (const flag of ['strict', 'exactOptionalPropertyTypes', 'noUncheckedIndexedAccess', 'noImplicitAny', 'noImplicitOverride', 'noImplicitReturns', 'noImplicitThis', 'noFallthroughCasesInSwitch']) {
      expect(o[flag], flag).toBe(true);
    }
  });

  it('targets ES2020, not ES5', () => {
    expect(tsconfig.compilerOptions.target).toBe('es2020');
  });
});
