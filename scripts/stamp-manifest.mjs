#!/usr/bin/env node
/**
 * Write the extension version into the built manifest.
 *
 * `package.json` is the only place the version lives; `static/manifest.json` has no `version`
 * and this step adds it to `build/manifest.json`, so the two can never disagree.
 *
 * Run: `node scripts/stamp-manifest.mjs [dir]` (default `build`). Part of `npm run build`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Chrome accepts 1-4 dot-separated integers, each 0-65535, no leading zeros. */
export function isChromeVersion(v) {
  if (typeof v !== 'string') return false;
  const parts = v.split('.');
  if (parts.length < 1 || parts.length > 4) return false;
  return parts.every((p) => /^(0|[1-9]\d{0,4})$/.test(p) && Number(p) <= 65535);
}

/** Stamp `version` into `<dir>/manifest.json`; returns the version written. */
export function stampManifest(dir, pkgPath = 'package.json') {
  const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (!isChromeVersion(version)) {
    throw new Error(`package.json version "${version}" is not a valid Chrome extension version (1-4 dot-separated integers, each 0-65535)`);
  }
  const file = join(dir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  // Keep `version` next to `name`/`description` where Chrome's docs and the store show it.
  const { manifest_version, name, description, ...rest } = manifest;
  delete rest.version;
  const out = { manifest_version, name, description, version, ...rest };
  writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
  return version;
}

const isMain = !!process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const dir = process.argv[2] ?? 'build';
  try {
    const v = stampManifest(dir);
    console.log(`Manifest version stamped: ${v} (${dir}/manifest.json)`);
  } catch (e) {
    console.error(`Manifest stamp FAILED: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}
