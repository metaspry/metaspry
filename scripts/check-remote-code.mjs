#!/usr/bin/env node
/**
 * Fail the build if the bundle references a remotely hosted script loader.
 *
 * Chrome Web Store review rejects MV3 extensions that load remote code, and these URLs (from the
 * default `firebase/auth` entry's gapi / reCAPTCHA loaders) are a commonly reported trigger.
 * The extension imports `firebase/auth/web-extension`, which ships without them; this check keeps
 * a stray `firebase/auth` import from bringing them back.
 *
 * Run: `node scripts/check-remote-code.mjs [dir]` (default `build`). Part of `npm run build`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const FORBIDDEN = [
  'apis.google.com/js/api.js',
  'google.com/recaptcha/api.js',
  'google.com/recaptcha/enterprise.js',
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

/** Every `{ file, needle }` hit under `dir`. */
export function findRemoteCode(dir) {
  const hits = [];
  for (const file of walk(dir)) {
    const text = readFileSync(file, 'latin1');
    for (const needle of FORBIDDEN) {
      if (text.includes(needle)) hits.push({ file: relative(dir, file), needle });
    }
  }
  return hits;
}

const isMain = !!process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const dir = process.argv[2] ?? 'build';
  const hits = findRemoteCode(dir);
  if (hits.length) {
    console.error(`Remote-code check FAILED: ${hits.length} hit(s) in ${dir}/`);
    for (const h of hits) console.error(`  ${h.file}: ${h.needle}`);
    console.error('Import auth from firebase/auth/web-extension, never firebase/auth.');
    process.exit(1);
  }
  console.log(`Remote-code check passed: no remote script loaders in ${dir}/`);
}
