import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// scripts/check-contract.mjs: the guard that keeps the vendored scan contract equal to the app's.

let dir = '';
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

function run(ours: string, theirs: string | null) {
  dir = mkdtempSync(join(tmpdir(), 'ms-contract-'));
  const o = join(dir, 'ours.json');
  writeFileSync(o, ours);
  const t = join(dir, 'theirs.json');
  if (theirs !== null) writeFileSync(t, theirs);
  const r = spawnSync(process.execPath, ['scripts/check-contract.mjs', '--ours', o, '--theirs', t], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('scripts/check-contract.mjs', () => {
  it('passes when the files match (line endings aside)', () => {
    expect(run('{"a":1}\n', '{"a":1}\r\n')).toMatchObject({ code: 0 });
  });

  it('fails and names both files when they differ', () => {
    const r = run('{"a":1}', '{"a":2}');
    expect(r.code).toBe(1);
    expect(r.out).toContain('Scan contract drift');
  });

  it('skips (exit 0) when there is no app checkout to compare with', () => {
    const r = run('{"a":1}', null);
    expect(r.code).toBe(0);
    expect(r.out).toContain('skipped');
  });
});
