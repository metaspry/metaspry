# Full-extension QA log

One entry per full QA pass, newest first (`AGENTS.md` hard rule 13). A pass is `npm run qa`
(`check` + `test` + `test:e2e`), `npm run test:coverage`, then the manual list in `AGENTS.md` 3.18.
Gaps found become OpenSpecs; link them here.

Template:

```
## YYYY-MM-DD - <commit> - PASS | FAIL
- check: ... | unit/integration: N files, N tests | build: ... | e2e: N passed
- coverage (lines / branches / functions): ...
- manual list: done | skipped (why) | issues
- gaps / follow-ups: ...
```

---

## 2026-10-26 - `ef931b1` (backlog stack head: architecture Critical 1 / High 3 / High 5 / Mediums 9, 10, 13, 15, 16 + tab registry, and the 2026-10-25 UX review Mediums 13-25 and Lows 27-33) - PASS (automated part)

- `npm run qa` exit 0: check 0 errors (1 pre-existing warning, `Tabs.svelte` tablist tabindex); contract:check skipped against `../app` (its checkout is on a branch without the contract) and passed against `../app-backlog` (`--theirs`); unit/integration 66 files, 570 tests; build with the remote-code guard; e2e 44 passed (~1 min).
- Coverage (Vitest): lines 50.17 % (was 49.24 % at `03058bb`), branches 83.80 %, functions 76.90 %.
- Cross-repo evidence: the 10 golden audit cases and 9 golden AEO cases were run through the app's own engine and analyzer (app `6dc6172`, bundled to a temp dir): audit 8 cases differ today (recorded as `serverToday`), AEO all 9 agree.
- Mutation checks: the curly-quote AEO test fails with the old regex; the workspace-scoring race test fails without its token guard; the UX `ux.e2e.ts` tests and `toast.e2e.ts` fail against the pre-fix code.
- Manual list: not walked. Needs a real browser before release: popup <-> side panel switch, signed-in sync states and the settings race fixes against a live account, and a light/dark visual pass of the UX changes.
- Gaps / follow-ups (need Paul or the app): the app adopting `src/lib/contract/*.json` (golden audit, scan keys, settings vectors, golden AEO); scan-id hash length (32-bit) and the raw-URL bulk/monitor ids; the scan-session extraction from `Extension.svelte`; Kit -> Vite; a dev Firebase project.

## 2026-10-26 - `03058bb` (architecture-review backlog stack: both backlog branches combined) - PASS (automated part)

- `npm run qa` exit 0 on `78d2030` (check + contract:check + test + test:e2e), re-run green after the tooling commit on a clean `npm ci`. check: 0 errors, 1 warning (`Tabs.svelte` tablist tabindex, pre-existing). unit/integration: 61 files, 540 tests. build: manifest version stamped from `package.json` (1.0.31), remote-code check (now pattern-based) passed. e2e: 31 passed (~35 s). `contract:check` skipped in this worktree (no `../app` fixture beside it).
- Mutation checks: renaming the getHTML literal in `background.js` fails `protocol.spec.ts`; an `import` of `components/` from `mode.ts` fails `layering.spec.ts`; the new `getSiteFiles.spec.ts` failed against the pre-fix module; the unpacked `metaspry-v1.0.27.zip` fails `check-remote-code.mjs` on all three loader URLs.
- `npm run package` (to a temp name): byte-identical zip on two runs, round-trips through `tar` and `Expand-Archive` to the same 30 files as `build/`.
- Coverage (Vitest): lines 49.24 % (was 37.92 %), branches 82.93 %, functions 75.51 %. `storage/history.ts`, `pinned.ts`, `shortcuts.ts`, `persisted.ts`, `theme.ts`, `toast.ts`, `messaging/protocol.ts`, `tabs/open-tab.ts` 100 % lines; `mode.ts` 96 %; `scrapers/getSiteFiles.ts` 88 %.
- E2E caveat: two worktrees ran Playwright against the shared fixture port 4319 with `reuseExistingServer`; runs were serialised by hand. A run can be served by the other checkout's `e2e/server.mjs` (filed below).
- Manual list: not walked. Needs a real browser: signed-in scan on a site with a large sitemap index (upload no longer waits more than 8 s on site files), Site tab on a site whose robots.txt declares an off-site sitemap (the not-found error names it), History click opens a background tab, popup <-> side panel switch.
- Gaps / follow-ups: the CI workflows have not run yet (first push); `playwright.config.ts` could pick a free port per checkout; High #6 (scan-session module / tab registry), #7 (Kit -> plain Vite, typed background), #8 (dev Firebase project) open.

---

## 2026-10-25 - `cff4df7` + the ux-critical-high changes (committed next as "fix(ext): critical and high UI/UX review findings") - PASS (automated part)

- `npm run qa` exit 0. check: 0 errors, 1 warning (`Tabs.svelte` tablist tabindex, pre-existing). unit/integration: 44 files, 331 tests. build: remote-code check passed. e2e: 25 passed (~44 s).
- Mutation checks: the 11 new `ux.e2e.ts` tests (at the time) all failed against the pre-fix source and passed after; reverting the workspace-scoring counter guard fails `workspace-scoring.race.spec.ts`; the two focus-return asserts failed before the inert/focus fix.
- Coverage (Vitest): lines 37.92 % (was 30.37 %), branches 81.38 %, functions 60.46 %.
- Main chunk: 963 KB -> 318 KB (Firebase in lazy chunks, never requested on a signed-out open).
- Manual list: not walked. Needs a real browser: popup <-> side panel switch (`openPopup` gesture), signed-in sync states (Saving / Saved / error), sign-in from a fresh install with an existing session (IndexedDB probe), light/dark visual pass after the blur removal.
- Gaps / follow-ups: scoring weights for skipped rules and the og:image triple penalty need a joint ext + app OpenSpec (scores must match the web app); Medium/Low review items not started.

---

## 2026-10-25 - `e44c66f` + the qa-harness changes (committed next as "test(ext): full-extension QA harness") - PASS (automated part)

- `npm run qa` exit 0. check: svelte-check 0 errors, 1 warning (`Tabs.svelte` `{@html tab.icon}`, pre-existing). unit/integration: 33 files, 277 tests passed. build: remote-code check passed. e2e: 13 passed (~15 s), no page or service-worker errors.
- Mutation checks: forcing `background.js` to return no HTML failed the 8 capture-dependent e2e tests and left the 5 independent ones green; a `console.error` at the top of `background.js` failed `load.e2e.ts`.
- Coverage (Vitest only, all of `src/lib`): lines 30.37 %, branches 81.72 %, functions 57.61 %. `.svelte` files read 0 % in Vitest by design; e2e exercises them.
- Manual list: not walked (harness setup run, no UI change).
- Gaps - `.ts` modules with 0 % unit coverage: `mode.ts`, `theme.ts`, `audit/aeo.ts`, `components/Compare/diff.ts`, `components/Grid/Grid.ts`, `components/button.ts`, `components/toolbar.ts`, `scrapers/getSiteFiles.ts`, `storage/history.ts`, `storage/pinned.ts` (type-only, ignore: `AuditResult.ts`, `PageMeta.ts`, `SiteFiles.ts`, `index.js`). Partial: `storage/settings.ts` 50 %, `storage/shortcuts.ts` 51 %. Untested in e2e: exports, Compare against a URL, AI check results, settings edits, context menu, sign-in. Filed: `openspec/changes/2026-10-25-unit-coverage-gaps` (proposed, awaiting approval).
