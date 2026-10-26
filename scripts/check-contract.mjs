// Fails when the vendored scan contract fixture drifts from the web app's (architecture review
// 2026-10-26, Critical 1). src/lib/contract/scan-contract.json is a byte copy of
// app/functions/test/fixtures/scan-contract.json; contract.spec.ts runs it through the extension.
// Without a sibling `app` checkout (CI) there is nothing to compare: it says so and exits 0.
//
//   node scripts/check-contract.mjs [--ours <file>] [--theirs <file>]
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? resolve(args[i + 1]) : fallback;
};
const ours = arg('--ours', resolve('src/lib/contract/scan-contract.json'));
const theirs = arg('--theirs', resolve('../app/functions/test/fixtures/scan-contract.json'));

if (!existsSync(theirs)) {
  console.log(`Contract check skipped: ${theirs} not found (no app checkout beside this repo, or its branch has no contract yet).`);
  process.exit(0);
}

// Line endings differ between checkouts on Windows; content must not.
const norm = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').trim();
if (norm(ours) !== norm(theirs)) {
  console.error(`Scan contract drift: ${ours} differs from ${theirs}.`);
  console.error('Copy the app fixture over the vendored one, then run npm test (contract.spec.ts).');
  process.exit(1);
}
console.log('Contract check passed: the vendored scan contract matches the app.');
