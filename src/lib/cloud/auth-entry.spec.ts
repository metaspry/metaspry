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

  it.each([
    ['a URL to a remote script', 'a.js', 's.src="https://cdn.example.com/lib/x.min.js"'],
    ['a protocol-relative module URL', 'a.js', 'import("//cdn.example.com/m.mjs?v=2")'],
    ['a remote wasm file', 'a.js', 'fetch("https://cdn.example.com/re2.wasm")'],
    ['importScripts of a URL', 'background.js', "importScripts('https://x.example.com/sw')"],
    ['eval', 'a.js', 'var r=eval("1+1")'],
    ['new Function', 'a.js', 'const f = new Function("return 1")'],
    ['a remote <script src>', 'index.html', '<script src="https://x.example.com/app"></script>'],
    ['an inline <script> the CSP fixer missed', 'index.html', '<body><script>__sveltekit_x = {}</script></body>'],
  ])('fails on %s, naming the file', (_label, file, text) => {
    const r = run({ [file]: text });
    expect(r.ok).toBe(false);
    expect(r.out).toContain(file);
  });

  it.each([
    ['packaged module scripts', 'index.html', '<script type="module" src="/script-1yi006m.js"></script><script type="module" src="./app/a.js"></script>'],
    ['API endpoints and JSON URLs', 'a.js', 'fetch("https://firestore.googleapis.com/v1/x");fetch("https://example.com/data.json")'],
    ['a repo link that merely ends in "js"', 'a.js', '"https://github.com/le0pard/re2js#readme"'],
    ['method names containing eval', 'a.js', 'x.eval(1);retrieval(2);'],
    ['a feature test for importScripts', 'a.js', 'typeof self.importScripts=="function"'],
  ])('passes %s', (_label, file, text) => {
    expect(run({ [file]: text }).ok).toBe(true);
  });

  it('fails on a manifest CSP that allows eval or a remote script host', () => {
    const csp = "script-src 'self' 'unsafe-eval' https://cdn.example.com; object-src 'self'";
    const r = run({ 'manifest.json': JSON.stringify({ content_security_policy: { extension_pages: csp } }) });
    expect(r.ok).toBe(false);
    expect(r.out).toContain("CSP script-src allows 'unsafe-eval'");
    expect(r.out).toContain('CSP script-src allows https://cdn.example.com');
  });

  it('passes a self-only CSP and a manifest without one', () => {
    const csp = "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'";
    expect(run({ 'manifest.json': JSON.stringify({ content_security_policy: { extension_pages: csp } }) }).ok).toBe(true);
    rmSync(dir, { recursive: true, force: true });
    expect(run({ 'manifest.json': '{"manifest_version":3}' }).ok).toBe(true);
  });
});
