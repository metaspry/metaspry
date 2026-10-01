import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Store review rejects remotely hosted code; the default `firebase/auth` entry bundles the gapi
// and reCAPTCHA loader URLs. The extension must import `firebase/auth/web-extension` only.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|js|svelte)$/.test(name) && !name.endsWith('.spec.ts') ? [p] : [];
  });
}

describe('firebase auth entry', () => {
  it('no source file imports the default firebase/auth entry', () => {
    const bad = sourceFiles('src').filter((f) =>
      /from\s+['"]firebase\/auth['"]|import\(\s*['"]firebase\/auth['"]\s*\)/.test(readFileSync(f, 'utf8'))
    );
    expect(bad).toEqual([]);
  });
});

describe('scripts/check-remote-code.mjs', () => {
  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  function run(files: Record<string, string>): { ok: boolean; out: string } {
    dir = mkdtempSync(join(tmpdir(), 'ms-remote-'));
    for (const [rel, text] of Object.entries(files)) {
      const p = join(dir, rel);
      mkdirSync(join(p, '..'), { recursive: true });
      writeFileSync(p, text);
    }
    try {
      const out = execFileSync('node', ['scripts/check-remote-code.mjs', dir], { encoding: 'utf8', stdio: 'pipe' });
      return { ok: true, out };
    } catch (e) {
      const err = e as { stderr?: string };
      return { ok: false, out: err.stderr ?? '' };
    }
  }

  it('passes a clean bundle', () => {
    expect(run({ 'app/a.js': 'fetch("https://accounts.google.com/o/oauth2/v2/auth")' }).ok).toBe(true);
  });

  it('fails on the gapi loader, naming the file', () => {
    const r = run({ 'app/nodes/2.js': 'x="https://apis.google.com/js/api.js"' });
    expect(r.ok).toBe(false);
    expect(r.out).toContain('apis.google.com/js/api.js');
    expect(r.out).toContain('2.js');
  });

  it('fails on the reCAPTCHA loaders', () => {
    expect(run({ 'a.js': 'https://www.google.com/recaptcha/api.js' }).ok).toBe(false);
    rmSync(dir, { recursive: true, force: true });
    expect(run({ 'b.js': 'https://www.google.com/recaptcha/enterprise.js?render=' }).ok).toBe(false);
  });
});
