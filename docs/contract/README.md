# The scan contract between the extension and the web app

The extension and `app/` (Cloud Functions + SvelteKit) both produce scan documents in the same Firestore collections and render each other's scores. There is no shared package (Paul has not chosen package vs contract tests yet). Parity is held by **fixture files that both repos test against**. Architecture review 2026-10-26, Critical 1 and High 3.

| File (this repo) | Owner | What it pins | Status |
|---|---|---|---|
| `src/lib/contract/scan-contract.json` | **app** (`functions/test/fixtures/scan-contract.json`) | schema version, score bands + required-fail cap, `scanIdFor` (djb2) | Vendored byte copy. `npm run contract:check` fails on drift when `../app` is checked out (CI has no sibling: it skips). Point it elsewhere with `-- --theirs <path>`. |
| `src/lib/contract/audit-golden.json` | **extension** | rule statuses for the behaviours the review found divergent | The extension passes all cases (`audit-golden.spec.ts`). `serverToday` = what `app/functions/src/audit/engine.ts` returned on 2026-10-26 (`app` 6dc6172), verified by running that engine on each case. |
| `src/lib/contract/settings-normalize.json` | **extension** | stored scoring settings -> the settings scoring uses (non-numbers, negatives, all-zero weights) | The extension's `normalizeAuditSettings` passes (`storage/settings.spec.ts`). The app's `mergeAuditSettings` and the server's `sanitizeSettings` should adopt it. |
| `src/lib/contract/aeo-golden.json` | **extension** | AI-readiness page-level check states (author/date scoping, indexable, headings, JSON-LD) | The extension passes (`aeo-golden.spec.ts`); the server analyzer (`app/functions/src/aeo.ts`, 6dc6172) matches all 9 cases after the extension ported its article scoping and curly quotes. Site-level checks (robots / llms) not covered yet. |
| `src/lib/contract/scan-keys.json` | **extension** | the URL a scan is filed under (`normalizeScanUrl`) and its id | The extension passes (`contract.spec.ts`). `rawId` = what the app's `bulk-audit.ts:207` and `monitor-rescan.ts:288` compute today (they hash the raw URL). |

`src/lib/contract/scan-contract.ts` mirrors `app/functions/src/scan-contract.ts` (same names and bodies); `audit/band.ts` and `cloud/sync.ts` read it.

## What the app needs to do (handoff)

1. **Rules (Critical 1).** Copy `audit-golden.json` into `functions/test/fixtures/` and run each case through `auditHtml(html, url)` (merge `xRobotsTag` the way the engine merges a response header). Every case with a `serverToday` entry fails today:
   - `noindex`: honour `content="none"`, every robots / googlebot tag (not the first), and `X-Robots-Tag`.
   - `canonical`: warn when it points at another page (`sameUrl`, not string equality).
   - `hreflang-self`: match with `sameUrl` (trailing slash, scheme, fragment ignored).
   - `dup-tags`: count duplicate `<title>` and `<link rel=canonical>`.
   - `description` (and every tag): an empty `content=""` is missing.
   - `title`: the `<head>` title only, never an SVG `<title>`.
   Not in the golden file yet (needs network or images): og:image dimensions (the server always passes), `<base href>`.
2. **Scan identity (High 3).** File scans under `normalizeScanUrl(url)` before `scanIdFor`, in bulk and monitor, so a page the extension and a bulk run both scanned is one document and one history. Existing documents keyed by a raw URL with a trailing slash or fragment need a one-off merge (Paul's call: migration vs letting old docs age out).
3. **Collision risk (High 3, open).** `scanIdFor` is 32-bit. Moving to a longer hash changes every id: a joint migration in both repos, Paul's call. Until then the contract keeps djb2.

## Changing the contract

- App-owned fixture: change it in the app, then copy it here and run `npm test` (`contract:check` tells you when).
- Extension-owned fixtures: a new case documents current extension behaviour; if the server differs, add `serverToday`. Changing an expectation is a scoring change: it needs parity in the app in the same release.
