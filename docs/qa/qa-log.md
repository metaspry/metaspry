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

## 2026-10-25 - `e44c66f` + the qa-harness changes (committed next as "test(ext): full-extension QA harness") - PASS (automated part)

- `npm run qa` exit 0. check: svelte-check 0 errors, 1 warning (`Tabs.svelte` `{@html tab.icon}`, pre-existing). unit/integration: 33 files, 277 tests passed. build: remote-code check passed. e2e: 13 passed (~15 s), no page or service-worker errors.
- Mutation checks: forcing `background.js` to return no HTML failed the 8 capture-dependent e2e tests and left the 5 independent ones green; a `console.error` at the top of `background.js` failed `load.e2e.ts`.
- Coverage (Vitest only, all of `src/lib`): lines 30.37 %, branches 81.72 %, functions 57.61 %. `.svelte` files read 0 % in Vitest by design; e2e exercises them.
- Manual list: not walked (harness setup run, no UI change).
- Gaps - `.ts` modules with 0 % unit coverage: `mode.ts`, `theme.ts`, `audit/aeo.ts`, `components/Compare/diff.ts`, `components/Grid/Grid.ts`, `components/button.ts`, `components/toolbar.ts`, `scrapers/getSiteFiles.ts`, `storage/history.ts`, `storage/pinned.ts` (type-only, ignore: `AuditResult.ts`, `PageMeta.ts`, `SiteFiles.ts`, `index.js`). Partial: `storage/settings.ts` 50 %, `storage/shortcuts.ts` 51 %. Untested in e2e: exports, Compare against a URL, AI check results, settings edits, context menu, sign-in. Filed: `openspec/changes/2026-10-25-unit-coverage-gaps` (proposed, awaiting approval).
