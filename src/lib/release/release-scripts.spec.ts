import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';

// The release scripts (scripts/stamp-manifest.mjs, scripts/package-zip.mjs) run as `npm run build`
// and `npm run package` steps; tested through their CLIs, like check-remote-code in auth-entry.spec.

const STAMP = resolve('scripts/stamp-manifest.mjs');
const PACKAGE = resolve('scripts/package-zip.mjs');

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

function tree(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'ms-release-'));
  dirs.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, text);
  }
  return dir;
}

function node(script: string, args: string[], cwd: string): { ok: boolean; out: string } {
  try {
    return { ok: true, out: execFileSync('node', [script, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (e) {
    return { ok: false, out: (e as { stderr?: string }).stderr ?? '' };
  }
}

type Entry = { name: string; data: Buffer; method: number };

/** Entries of a zip (name, method, inflated bytes), read through its central directory. */
function unzip(buf: Buffer): Entry[] {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out: Entry[] = [];
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + size);
    out.push({ name, method, data: method === 8 ? inflateRawSync(body) : Buffer.from(body) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const MANIFEST = JSON.stringify({ manifest_version: 3, name: 'Metaspry', description: 'd', icons: {} });

describe('scripts/stamp-manifest.mjs', () => {
  it('writes the package.json version into build/manifest.json', () => {
    const dir = tree({ 'package.json': '{"version":"1.2.3"}', 'build/manifest.json': MANIFEST });
    expect(node(STAMP, [], dir).ok).toBe(true);
    const m = JSON.parse(readFileSync(join(dir, 'build/manifest.json'), 'utf8'));
    expect(m.version).toBe('1.2.3');
    expect(Object.keys(m).slice(0, 4)).toEqual(['manifest_version', 'name', 'description', 'version']);
    expect(m.icons).toEqual({});
  });

  it('replaces a stale version left in the manifest', () => {
    const stale = JSON.stringify({ manifest_version: 3, name: 'n', description: 'd', version: '1.0.0' });
    const dir = tree({ 'package.json': '{"version":"2.0.0"}', 'build/manifest.json': stale });
    expect(node(STAMP, [], dir).ok).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, 'build/manifest.json'), 'utf8')).version).toBe('2.0.0');
  });

  it.each(['1.2.3-beta', '01.2', '1.2.3.4.5', '70000.0', ''])('fails on a version Chrome rejects: "%s"', (v) => {
    const dir = tree({ 'package.json': JSON.stringify({ version: v }), 'build/manifest.json': MANIFEST });
    const r = node(STAMP, [], dir);
    expect(r.ok).toBe(false);
    expect(r.out).toContain('not a valid Chrome extension version');
  });

  it('the source manifest has no version of its own (package.json is the only source)', () => {
    expect(JSON.parse(readFileSync('static/manifest.json', 'utf8')).version).toBeUndefined();
  });
});

describe('scripts/package-zip.mjs', () => {
  const build: Record<string, string> = {
    'build/manifest.json': JSON.stringify({ manifest_version: 3, name: 'n', description: 'd', version: '1.0.0' }),
    'build/index.html': '<!doctype html><script type="module" src="/s.js"></script>',
    'build/app/immutable/a.js': 'console.log("x");'.repeat(50),
    'build/icons/i.png': 'PNG',
    'package.json': '{"version":"1.0.0"}',
  };

  it('zips build/ with manifest.json at the root and forward-slash paths, content intact', () => {
    const dir = tree(build);
    expect(node(PACKAGE, [], dir).ok).toBe(true);
    const entries = unzip(readFileSync(join(dir, 'metaspry-v1.0.0.zip')));
    expect(entries.map((e) => e.name)).toEqual(['app/immutable/a.js', 'icons/i.png', 'index.html', 'manifest.json']);
    for (const e of entries) expect(e.data.toString('utf8')).toBe(readFileSync(join(dir, 'build', e.name), 'utf8'));
    expect(entries.find((e) => e.name === 'app/immutable/a.js')?.method).toBe(8);
  });

  it('is reproducible: the same build gives the same bytes and sha256', () => {
    const dir = tree(build);
    expect(node(PACKAGE, ['build', 'a.zip'], dir).ok).toBe(true);
    expect(node(PACKAGE, ['build', 'b.zip'], dir).ok).toBe(true);
    expect(readFileSync(join(dir, 'a.zip')).equals(readFileSync(join(dir, 'b.zip')))).toBe(true);
    const sha = (f: string) => readFileSync(join(dir, f), 'utf8').split(' ')[0];
    expect(sha('a.zip.sha256')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha('a.zip.sha256')).toBe(sha('b.zip.sha256'));
  });

  it('never overwrites an existing zip', () => {
    const dir = tree({ ...build, 'metaspry-v1.0.0.zip': 'old' });
    const r = node(PACKAGE, [], dir);
    expect(r.ok).toBe(false);
    expect(r.out).toContain('already exists');
    expect(readFileSync(join(dir, 'metaspry-v1.0.0.zip'), 'utf8')).toBe('old');
  });

  it('refuses a build whose manifest version is not the package version', () => {
    const dir = tree({ ...build, 'package.json': '{"version":"1.0.1"}' });
    const r = node(PACKAGE, [], dir);
    expect(r.ok).toBe(false);
    expect(r.out).toContain('run npm run build');
    expect(existsSync(join(dir, 'metaspry-v1.0.1.zip'))).toBe(false);
  });

  it('refuses a build with remote code and writes no zip', () => {
    const dir = tree({ ...build, 'build/app/immutable/a.js': 'x="https://apis.google.com/js/api.js"' });
    const r = node(PACKAGE, [], dir);
    expect(r.ok).toBe(false);
    expect(r.out).toContain('remote-code check failed');
    expect(existsSync(join(dir, 'metaspry-v1.0.0.zip'))).toBe(false);
  });
});
