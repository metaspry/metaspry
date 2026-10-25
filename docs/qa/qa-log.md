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
