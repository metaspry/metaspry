import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeAeo } from '../audit/aeo';

// The extension's half of the golden AEO cases (docs/contract/README.md). Page-level checks only.

type Case = { name: string; url: string; html: string; expect: Record<string, string> };
const golden = JSON.parse(readFileSync(resolve(__dirname, 'aeo-golden.json'), 'utf8')) as { cases: Case[] };

describe('golden AEO cases', () => {
  it.each(golden.cases)('$name', (c) => {
    const root = new DOMParser().parseFromString(c.html, 'text/html').documentElement;
    const states = Object.fromEntries(analyzeAeo(root, null, c.url).checks.map((x) => [x.id, x.state]));
    for (const [id, state] of Object.entries(c.expect)) expect({ id, state: states[id] }).toEqual({ id, state });
  });
});
