#!/usr/bin/env node
/**
 * Zip `build/` into `metaspry-v<version>.zip` for the Chrome Web Store.
 *
 * Reproducible: entries sorted, forward-slash paths, a fixed timestamp and fixed attributes, so
 * the same `build/` gives the same zip bytes on any OS (PowerShell 5.1's Compress-Archive wrote
 * backslash paths). Writes `<zip>.sha256` next to it. Refuses to overwrite an existing zip: old
 * zips are kept (AGENTS.md hard rule 8). Pure Node (`zlib`), no dependency.
 *
 * Run: `npm run package` (builds first), or `node scripts/package-zip.mjs [buildDir] [outFile]`.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { findRemoteCode } from './check-remote-code.mjs';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// DOS date/time for 1980-01-01 00:00:00, the earliest a zip can carry.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

/** Zip bytes for every file under `dir`, paths relative to it. */
export function zipDir(dir) {
  const files = [...walk(dir)]
    .map((p) => ({ path: p, name: relative(dir, p).split(sep).join('/') }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const data = readFileSync(f.path);
    const deflated = deflateRawSync(data, { level: 9 });
    const stored = deflated.length >= data.length;
    const body = stored ? data : deflated;
    const name = Buffer.from(f.name, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // made by (MS-DOS / FAT attributes)
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

/**
 * Check `buildDir`, then write the zip and its `.sha256`. Throws (and writes nothing) when the
 * zip exists, the manifest version is not the package version, or the remote-code check fails.
 */
export function packageZip(buildDir, outFile, version) {
  if (existsSync(outFile)) throw new Error(`${outFile} already exists; old zips are never overwritten (bump the version, or move it yourself)`);
  const manifest = JSON.parse(readFileSync(join(buildDir, 'manifest.json'), 'utf8'));
  if (manifest.version !== version) throw new Error(`${buildDir}/manifest.json version "${manifest.version}" is not package.json "${version}"; run npm run build`);
  const hits = findRemoteCode(buildDir);
  if (hits.length) throw new Error(`remote-code check failed: ${hits.map((h) => `${h.file}: ${h.needle}`).join('; ')}`);
  const zip = zipDir(buildDir);
  const sha = createHash('sha256').update(zip).digest('hex');
  writeFileSync(outFile, zip, { flag: 'wx' });
  writeFileSync(`${outFile}.sha256`, `${sha}  ${outFile.split(/[\\/]/).pop()}\n`);
  return { sha, bytes: zip.length };
}

const isMain = !!process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const buildDir = process.argv[2] ?? 'build';
  const outFile = process.argv[3] ?? `metaspry-v${version}.zip`;
  try {
    const { sha, bytes } = packageZip(buildDir, outFile, version);
    console.log(`Packaged ${outFile} (${bytes} bytes)\nsha256 ${sha}`);
  } catch (e) {
    console.error(`Package FAILED: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}
