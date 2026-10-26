import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// scripts/check-contract.mjs: the guard that keeps the vendored scan contract equal to the app's.

let dir = '';
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

function run(ours: string, theirs: string | null, opts: { explicit?: boolean; required?: boolean } = { explicit: true }) {
  dir = mkdtempSync(join(tmpdir(), 'ms-contract-'));
  const o = join(dir, 'ours.json');
  writeFileSync(o, ours);
  const t = join(dir, 'theirs.json');
  if (theirs !== null) writeFileSync(t, theirs);
  const argv = ['scripts/check-contract.mjs', '--ours', o, ...(opts.explicit ? ['--theirs', t] : [])];
  const env = { ...process.env, CONTRACT_REQUIRED: opts.required ? '1' : '' };
  // Without --theirs it looks for ../app beside the cwd: run from the temp dir, where there is none.
  const r = spawnSync(process.execPath, [join(process.cwd(), argv[0]!), ...argv.slice(1)], { encoding: 'utf8', env, cwd: dir });
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

  it('skips (exit 0) when there is no app checkout beside the repo and none was asked for', () => {
    const r = run('{"a":1}', null, { explicit: false });
    expect(r.code).toBe(0);
    expect(r.out).toContain('skipped');
  });

  it('an explicit --theirs that does not exist fails (ultra review F6)', () => {
    const r = run('{"a":1}', null, { explicit: true });
    expect(r.code).toBe(1);
    expect(r.out).toContain('the comparison was required');
  });

  it('CONTRACT_REQUIRED=1 fails without an app checkout (for a CI job that checks it out)', () => {
    const r = run('{"a":1}', null, { explicit: false, required: true });
    expect(r.code).toBe(1);
  });
});

describe('CI runs the comparison when the app token is configured (ultra review delta 1)', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');

  it('checks out the app fixture and requires the comparison, gated on the secret existing', () => {
    expect(ci).toContain('repository: metaspry/app');
    expect(ci).toContain("CONTRACT_REQUIRED: '1'");
    expect(ci).toContain('--theirs .app-contract/functions/test/fixtures/scan-contract.json');
    expect(ci.match(/if: steps\.contract\.outputs\.enabled == 'true'/g)).toHaveLength(2);
  });

  it('the token never lands in a step environment (npm ci runs install scripts)', () => {
    const uses = ci.split(String.fromCharCode(10)).filter((l) => l.includes('secrets.APP_CONTRACT_TOKEN'));
    expect(uses).toHaveLength(2);
    expect(uses.some((l) => /enabled=\$\{\{ secrets\.APP_CONTRACT_TOKEN != '' \}\}/.test(l))).toBe(true);
    expect(uses.some((l) => /^\s+token: \$\{\{ secrets\.APP_CONTRACT_TOKEN \}\}/.test(l))).toBe(true);
  });
});
