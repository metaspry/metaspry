#!/usr/bin/env node
/**
 * Fail the build if the bundle could load or run code that is not in the package.
 *
 * Chrome Web Store review rejects MV3 extensions that load remote code. The literal URLs below
 * (from the default `firebase/auth` entry's gapi / reCAPTCHA loaders) are a commonly reported
 * trigger; the extension imports `firebase/auth/web-extension`, which ships without them. The
 * pattern checks catch the same class of problem from any other dependency:
 * - an absolute or protocol-relative URL to a `.js` / `.mjs` / `.wasm` file,
 * - a `<script src>` pointing off-package, or an inline `<script>` the CSP fixer missed,
 * - `import(` or `importScripts(` of a URL, `eval(` (bare, `window.` / `globalThis.` / `self.`, indirect
 *   `(0,eval)`), `new Function(` and `Function("...")`,
 * - a manifest `content_security_policy` that allows `unsafe-eval`, `unsafe-inline` or a remote host.
 *
 * Run: `node scripts/check-remote-code.mjs [dir]` (default `build`). Part of `npm run build` and
 * `npm run package`; point it at an unpacked zip to check one already built.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const FORBIDDEN = [
  'apis.google.com/js/api.js',
  'google.com/recaptcha/api.js',
  'google.com/recaptcha/enterprise.js',
];

/**
 * `[label, regex]` checked in every .js/.mjs/.html file. Regexes are linear (no nested quantifiers).
 * URLs count only inside a string literal (right after a quote), so a licence banner naming a repo
 * like `github.com/x/chart.js` in a comment does not fail the build.
 */
export const PATTERNS = [
  ['remote script URL', /["'`](?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?\/[^\s"'`<>()]*\.(?:m?js|wasm)(?=[?#"'`\s)])/gi],
  // A dynamic import of a URL loads remote code whatever its extension (esm.sh, unpkg, /+esm).
  ['import() of a URL', /\bimport\(\s*["'`](?:https?:)?\/\//g],
  ['importScripts of a URL', /importScripts\(\s*["'`](?:https?:)?\/\//g],
  // eval( as a call: bare, through window/globalThis/self, or indirect (0,eval)(.
  ['eval(', /(?:(?<![\w$.])|\b(?:window|globalThis|self)\.)eval\s*\(|\(\s*0\s*,\s*eval\s*\)/g],
  ['Function(', /\bnew\s+Function\s*\(|(?<![\w$.])Function\(\s*["'`]/g],
];

/** HTML only: a remote `<script src>`, or an inline `<script>` (MV3 CSP blocks it; removeInlineScript.cjs should have moved it). */
export const HTML_PATTERNS = [
  ['remote <script src>', /<script\b[^>]*\bsrc\s*=\s*["']?(?:https?:)?\/\//gi],
  // Data blocks (JSON-LD, import maps) are not executed and CSP allows them.
  ['inline <script>', /<script\b(?![^>]*\bsrc\s*=)(?![^>]*\btype\s*=\s*["']?(?:application\/(?:ld\+)?json|importmap))[^>]*>\s*[^<\s]/gi],
];

const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.html', '.htm']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

/** Problems with the manifest's CSP, as `{ file, needle }`. */
export function checkManifestCsp(manifest, file = 'manifest.json') {
  const csp = manifest?.content_security_policy;
  if (!csp) return [];
  // `sandbox` pages may use 'unsafe-eval' in MV3 (no extension APIs there); check the rest.
  const policies = typeof csp === 'string'
    ? [csp]
    : Object.entries(csp).filter(([k, v]) => k !== 'sandbox' && typeof v === 'string').map(([, v]) => v);
  const hits = [];
  for (const policy of policies) {
    for (const directive of policy.split(';')) {
      const [name, ...sources] = directive.trim().split(/\s+/);
      if (!name || !/^(script-src|object-src|worker-src|default-src)$/.test(name)) continue;
      for (const s of sources) {
        if (/^'unsafe-(eval|inline)'$/.test(s) || /^(https?:|\*|\/\/)/.test(s) || /^[a-z0-9.-]+\.[a-z]{2,}/i.test(s)) {
          hits.push({ file, needle: `CSP ${name} allows ${s}` });
        }
      }
    }
  }
  return hits;
}

/** Every `{ file, needle }` hit under `dir`. */
export function findRemoteCode(dir) {
  const hits = [];
  for (const file of walk(dir)) {
    const rel = relative(dir, file);
    const text = readFileSync(file, 'latin1');
    for (const needle of FORBIDDEN) {
      if (text.includes(needle)) hits.push({ file: rel, needle });
    }
    const ext = extname(file).toLowerCase();
    if (!CODE_EXT.has(ext)) continue;
    const patterns = ext.startsWith('.htm') ? [...PATTERNS, ...HTML_PATTERNS] : PATTERNS;
    for (const [label, re] of patterns) {
      // First match the literal list has not already reported; one hit per pattern per file.
      for (const m of text.matchAll(re)) {
        if (FORBIDDEN.some((f) => m[0].includes(f))) continue;
        hits.push({ file: rel, needle: `${label}: ${m[0].slice(0, 120)}` });
        break;
      }
    }
  }
  const manifest = join(dir, 'manifest.json');
  if (existsSync(manifest)) hits.push(...checkManifestCsp(JSON.parse(readFileSync(manifest, 'utf8'))));
  return hits;
}

const isMain = !!process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const dir = process.argv[2] ?? 'build';
  const hits = findRemoteCode(dir);
  if (hits.length) {
    console.error(`Remote-code check FAILED: ${hits.length} hit(s) in ${dir}/`);
    for (const h of hits) console.error(`  ${h.file}: ${h.needle}`);
    console.error('Import auth from firebase/auth/web-extension, never firebase/auth; bundle every script; no eval.');
    process.exit(1);
  }
  console.log(`Remote-code check passed: no remote or dynamic code in ${dir}/`);
}
