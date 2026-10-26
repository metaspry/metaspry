import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getMetaTags } from '../scrapers/getMetaTags';
import { applyHeaderRobots } from '../scrapers/getRobots';
import { audit } from '../audit/rules';

// The extension's half of the golden audit cases (docs/contract/README.md). `xRobotsTag` stands in
// for the header fetch `resolveAsyncRules` makes: it merges the header the same way.

type Case = { name: string; url: string; html: string; xRobotsTag?: string; expect: Record<string, string> };
const golden = JSON.parse(readFileSync(resolve(__dirname, 'audit-golden.json'), 'utf8')) as { cases: Case[] };

describe('golden audit cases', () => {
  it.each(golden.cases)('$name', (c) => {
    const meta = getMetaTags(new DOMParser().parseFromString(c.html, 'text/html').documentElement, c.url);
    if (c.xRobotsTag) meta.robots = applyHeaderRobots(meta.robots, c.xRobotsTag);
    const statuses = Object.fromEntries(audit(meta).rules.map((r) => [r.id, r.status]));
    for (const [id, status] of Object.entries(c.expect)) expect({ id, status: statuses[id] }).toEqual({ id, status });
  });

  it('every expectation names a real rule', () => {
    const ids = new Set(audit(getMetaTags(document.documentElement, 'https://a.com/')).rules.map((r) => r.id));
    for (const c of golden.cases) for (const id of Object.keys(c.expect)) expect(ids.has(id), id).toBe(true);
  });
});
