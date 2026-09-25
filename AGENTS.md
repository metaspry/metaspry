# AGENTS.md - Metaspry browser extension

Feature map for AI coding agents working in this repo. It describes only what `main` does.

Verified against `origin/main` at `a00ff8f` (extension `1.0.24`) on 2026-09-15. If this file and the code disagree, the code wins: fix this file in the same PR (section 6).

---

## 1. What this repo is

Metaspry is a Manifest V3 Chrome extension that audits the page in the active tab. It shows every `<meta>` tag, social share previews, a weighted 0-100 SEO/meta score, the host's `robots.txt` / `sitemap.xml` / `llms.txt`, JSON-LD, hreflang, and an "AI readiness" (AEO) checklist. It works without an account. Optional sign-in uploads each scan to the Metaspry web app (`app.metaspry.com`) through Firebase.

It is one of three sibling repositories:

| Repo | What | Relationship to this repo |
|---|---|---|
| `metaspry/metaspry` (this repo) | Chrome extension | Writes scans and settings into the shared Firebase project |
| Web app (`app/` next to this repo in the founder's workspace) | SvelteKit + Firebase, `app.metaspry.com` | Shows extension scans, owns plans and billing, runs its own server-side audit and AEO analyzer |
| Marketing site (`metaspry-website/`) | Astro, `metaspry.com` | Docs, privacy policy, roadmap, blog; linked from the extension |

### Stack

| Piece | Detail (from `package.json` and config files) |
|---|---|
| UI | Svelte `^4.0.5`; components use `<script lang="ts">` |
| App shell | SvelteKit `^1.27.4` + `@sveltejs/adapter-static` `^2.0.3`, `appDir: 'app'`, `prerender = true` |
| Build | Vite `^4.4.2`, then `removeInlineScript.cjs` (MV3 CSP fix-up) |
| Styling | Tailwind CSS `^3.3.5` (`darkMode: 'class'`), PostCSS, Autoprefixer |
| Cloud | Firebase JS SDK `^12.15.0` (Auth + Firestore) |
| Tooltips | `@floating-ui/dom` `^1.8.0` (bundled by Vite; positions the `use:tooltip` element, 3.17) |
| Types | `@types/chrome`; `tsconfig.json` is strict (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicit*`) |
| Asset scripts | `sharp` (icons, promo tiles, store screenshots), `tiny-glob` (CSP fixer) |
| Declared but unused | `@sveltejs/adapter-auto` (commented out in `svelte.config.js`), `onchange` |

`.npmrc` sets `engine-strict=true`, but `package.json` has no `engines` field.

### Commands

| Task | Command | Notes |
|---|---|---|
| Build | `npm run build` | `vite build && node removeInlineScript.cjs`; output in `build/` |
| Run it | `chrome://extensions` -> Developer mode -> Load unpacked -> `build/` | The only way to exercise the extension end to end |
| Rebuild on change | `npm run watch-src` | nodemon watches `src` with `--ext svelte` only; editing a `.ts` file does not trigger a rebuild |
| Dev server | `npm run dev` | Runs in a normal tab with no `chrome.*` APIs: scraping fails and storage-backed stores use defaults. Layout work only. |
| Preview | `npm run preview` | Serves the Vite build |
| Icons | `npm run gen-icons` | Regenerates `static/icons/*` |
| Promo tiles | `node scripts/gen-promo-tiles.mjs` | Writes `promo/promo-small-440x280.png`, `promo/promo-marquee-1400x560.png` |
| Store screenshots | `node scripts/process-screenshots.mjs` | `promo/raw-screenshots/*` -> `promo/screenshot-NN.png` (1280x800, no alpha) |
| Lint, format, type-check, test | Not configured | `vite build` transpiles TypeScript but does not type-check. There is no `typescript` or `svelte-check` dependency. |

### Hard rules

These summarise the maintainer's agent instructions in `CLAUDE.md` and `.github/copilot-instructions.md`. Those files, `openspec/` and `.code-graph/` live only in the maintainer's local checkout and are not committed to this repo; this file is the committed summary.

1. **Code-graph first.** Explore with the code-graph MCP tools, then `sqlite3 .code-graph/graph.db` (tables `nodes`, `edges`), and only then Glob/Grep/Read. The local graph currently has no nodes for `.svelte` files, so read components directly after querying it.
2. **OpenSpec or stop.** A change that modifies 2+ files, touches a spec, alters a public interface or adds behaviour needs an OpenSpec in `openspec/changes/<date>-<slug>/` (`.openspec.yaml`, `proposal.md`, `specs/<capability>/spec.md`, `tasks.md`) and user approval before any code. The only exemptions: a typo fix in one file, a comment-only edit, a config value the user dictates, a follow-up fix inside an approved in-progress OpenSpec.
3. **Plan -> Propose -> Apply.** After the tasks: quality gates (`npm run build`), feature inventory of every modified file, then the review gate.
4. **MV3 CSP.** Never bypass `npm run build` or `removeInlineScript.cjs`. No inline `<script>`, no `eval`, no remotely hosted code.
5. **Preserve features.** Before editing a container (`Extension.svelte`, `+page.svelte`), list its features and confirm each one survives.
6. **No new dependencies** without explicit approval. A test framework counts.
7. **Do not relax** the `tsconfig.json` strictness flags.
8. **Never delete or overwrite existing `metaspry-v*.zip` builds** without asking.
9. **No shipped `console.*`.** Gate diagnostics behind `import.meta.env.DEV`. (`static/scripts/background.js` is not bundled and keeps `console.error`/`console.warn` in its error handlers.)
10. **Scraped page content is untrusted.** Never pass it to `{@html}`, `eval` or an unbounded regex.
11. **Keep this file current** (section 6).

### Stale references elsewhere

`CLAUDE.md`, `.github/copilot-instructions.md` and `README.md` mention things that are not on `main`. Trust the code and this file:

- `src/lib/gpt-actions/`, a user-supplied OpenAI key, the `compromise` NLP library, components `KeywordsInfo` / `MetaInfo` / `ScreenInfo`, and scrapers `getKeywords` / `getMostUsedWords` / `getWindow` do not exist.
- The "use `$lib/...` imports" rule is not followed anywhere; every import is relative.
- "Type-check runs during `vite build`" is false.
- `README.md` lists `Component.svelte`, `getWindow.ts` and a `content.js` content script (all deleted), and says there are four tabs (there are six).
- `README.md`'s Chrome Web Store copy predates cloud sync (section 4.4).
- `.github/instructions/testing.instructions.md` and `styling.instructions.md` are unfilled template stubs.

---

## 2. Architecture map

### Extension contexts

```
  Extension page (UI)                          Background service worker
  build/index.html, built from src/            static/scripts/background.js (plain JS, not bundled)
  - same page is the side panel                - applies side panel / popup behaviour
    and the action popup                       - owns the context menu
  - parsing, audit, fetches,                   - handles the 'getHTML' message
    storage, Firebase
        |   runtime.sendMessage({ message: 'getHTML' })  ->
        |   <-  { html: string | null, url: string }
        |
        |   storage.local 'mode' (written by UI)  ->  storage.onChanged in background
        |
        |                                       chrome.scripting.executeScript
        |                                       -> active tab returns document.documentElement.outerHTML
        |
        +-- fetch(credentials: 'omit'): page host /robots.txt, /llms.txt, sitemap paths;
        |   any URL typed into Compare
        +-- <img>: og:image (dimension rule and previews)
        +-- Firebase Auth + Firestore (project "metaspry"); chrome.identity for Google sign-in
```

1. **Background service worker** (`static/scripts/background.js`). Copied verbatim to `build/scripts/background.js`; it is not processed by Vite and is not TypeScript. It applies the action behaviour from the storage key `mode`, owns the context menu, and answers `getHTML` by injecting a one-line function into the active tab. It has no Firebase code and does no parsing.
2. **Extension page** (`build/index.html`, the SvelteKit single page app from `src/`). The same page is the side panel (`side_panel.default_path`) and the action popup (set at runtime with `chrome.action.setPopup`). `html[data-mode="popup"]` switches to a fixed 720px layout. Parsing, auditing, fetching, storage and cloud work all happen here. Each open surface is a separate instance of this page; instances share `chrome.storage.local` and the Firebase IndexedDB session but not in-memory state.
3. **Web page (active tab).** No content scripts are declared. The only code that runs in the page is the injected `outerHTML` function.

### Messaging map

This is the complete inventory. There are no ports (`runtime.connect`), no content-script messages and no external messaging.

| Channel | Direction | Payload | Code |
|---|---|---|---|
| `chrome.runtime.sendMessage` | page -> background | Request `{ message: 'getHTML' }`. Response `{ html: string \| null, url: string, favIconUrl: string \| null, reason?: 'unscriptable' \| 'no-tab' }` (`favIconUrl` = `tab.favIconUrl`, Chrome's resolved favicon) | `src/lib/scrapers/getHTML.ts`; listener in `background.js` returns `true` to answer asynchronously |
| `chrome.storage.onChanged` (`local`, key `mode`) | page -> background | `'sidepanel' \| 'popup'` | `src/lib/mode.ts` writes; `background.js` applies |
| `chrome.contextMenus.onClicked` | Chrome -> background | menu id `metaspry-open` | `background.js` |
| `chrome.runtime.onMessage` in the page | none | No-op listener `onRuntimeMessage` ("reserved for future cross-surface coordination") | `src/lib/views/Extension.svelte` |

### Directory map

| Path | Contents |
|---|---|
| `static/` | Copied verbatim into `build/`: `manifest.json`, `scripts/background.js`, `icons/`, `favicon.png` |
| `src/app.html` | HTML shell. `%sveltekit.body%` sits in `<div style="display: contents">`; the CSP fixer depends on this (4.1) |
| `src/routes/+page.svelte` | Root. Initialises theme, mode, settings, pinned, history and keyboard shortcuts; mounts `Extension`, `ToastHost`, `ShortcutsHelp` |
| `src/routes/+layout.js` | `export const prerender = true` |
| `src/routes/app.css` | Tailwind entry, popup sizing, tooltip (`.ms-tooltip`) and scrollbar styles |
| `src/lib/views/Extension.svelte` | Orchestrator: view state machine, header, tabs, the scrape -> audit -> history -> upload pipeline, mode switching |
| `src/lib/scrapers/` | `getHTML` (messaging), `getMetaTags` (+ `getJsonLd`, `getHreflang`, `getRobots`), `getSiteFiles` (network), types in `PageMeta.ts` and `SiteFiles.ts` |
| `src/lib/audit/` | `rules.ts` (sync rules + scoring), `asyncRules.ts` (og:image dimensions), `AuditResult.ts` (types), `aeo.ts` (AI readiness) |
| `src/lib/storage/` | `settings.ts`, `history.ts`, `pinned.ts`: Svelte stores persisted to `chrome.storage.local` |
| `src/lib/mode.ts`, `src/lib/theme.ts` | Surface mode and theme stores |
| `src/lib/cloud/` | `firebase.ts`, `auth.ts`, `plan.ts`, `settings.ts`, `sync.ts`, `workspaces.ts` |
| `src/lib/actions/` | Svelte actions: `tooltip.ts` (`use:tooltip`, 3.17) |
| `src/lib/categorize.ts` | Tag key -> category |
| `src/lib/exporters/exporters.ts` | JSON and CSV serialisers, blob download |
| `src/lib/components/` | One folder per UI feature: `Aeo`, `Audit`, `Card`, `Categories`, `CloudSync`, `Compare`, `EmptyState`, `ErrorState`, `Exporters`, `Grid`, `History`, `Preview`, `Previews`, `Screen`, `Settings`, `Shortcuts`, `Site`, `SiteIcon`, `Skeleton`, `Tabs`, `Toast` |
| `src/lib/index.js` | Empty `$lib` barrel placeholder |
| `removeInlineScript.cjs` | Post-build CSP fixer |
| `scripts/` | Node asset generators |
| `promo/` | Store promo tiles and screenshots (`raw-screenshots/` holds the unprocessed captures) |
| `docs/` | Store runbooks: `chrome-store-resubmit.md`, `store-screenshots.md` |
| Git-ignored, generated | `build/`, `.svelte-kit/`, `node_modules/`, `metaspry-v*.zip`, `.code-graph/` |

### Startup order

`+page.svelte`'s `onMount` calls `initTheme`, `initMode`, `initSettings`, `initPinned`, `initHistory` and `attachShortcuts`. Svelte runs a child's `onMount` before its parent's, so `CloudSync.svelte` (in `Extension`'s header) calls `initCloudAuth`, `initCloudSettingsSync`, `initCloudPlan` and `initCloudWorkspaces` first. The cloud `init*` functions are guarded by a `started` flag; the storage `init*` functions are not, so call them once only.

### Storage map

`chrome.storage.local` only. No `storage.sync` or `storage.session`. Keys are unprefixed.

| Key | Shape | Default | Written by | Also read by |
|---|---|---|---|---|
| `mode` | `'sidepanel' \| 'popup'` | `'sidepanel'` | `src/lib/mode.ts` | `background.js` (`get` and `onChanged`) |
| `theme` | `'light' \| 'dark'` | OS preference until the first toggle | `src/lib/theme.ts` | - |
| `settings` | `Settings` (6 thresholds + 3 weights) | `DEFAULT_SETTINGS`, merged over the stored value on read | `src/lib/storage/settings.ts` | `src/lib/cloud/settings.ts` (through the store) |
| `history` | `HistoryEntry[]` (`{ url, hostname, title, score, timestamp, icon? }`), newest first, max 10 | `[]` | `src/lib/storage/history.ts` | - |
| `pinnedKeys` | `string[]` of lower-cased tag keys | `[]` | `src/lib/storage/pinned.ts` | - |
| `syncScope__<uid>` | `{ kind: 'personal' } \| { kind: 'workspace', wsId, name }` | personal | `src/lib/cloud/workspaces.ts` (`scopeKeyFor`) | - |
| `popupHintDismissed` | `true` | unset | `src/lib/views/Extension.svelte` | - |

Other storage:

- **IndexedDB (extension origin):** the Firebase Auth session (SDK default persistence), shared by popup and side panel.
- **Firestore:** see section 5. Firestore runs with the default in-memory cache (no offline persistence).

Each store module persists through `store.subscribe(writeStorage)`, which also fires once at init with the value just read. Every storage module is a no-op when `chrome` is undefined (dev server).

**The sync target is namespaced per user.** The key is `syncScope__<uid>` (`scopeKeyFor`), falling
back to the bare `syncScope` when signed out. A single shared key meant that after switching
accounts the extension still showed - and could upload to - the previous user's workspace.

**Cross-surface rehydration (`src/lib/storage/watch.ts`).** The popup and the side panel are separate
documents with separate store instances. Each hydrates once at mount and then writes its **whole**
value on every change, so a scan recorded in one surface was erased the next time the other wrote its
stale copy back. Every persisted key (`history`, `settings`, `pinnedKeys`, `theme`, `mode`) now
re-hydrates through `watchKey`, and `makeWriteGuard` suppresses the store's own writer while an
external change is being applied so the two surfaces cannot echo each other into a loop.

---

## 3. Features

Each feature lists: purpose and user flow, key files, data and storage, permissions, tests, gotchas. Pure modules have Vitest specs (section 3.18); anything needing a real browser is still a manual check in a loaded `build/`.

### 3.1 Manifest and permissions

**Purpose.** `static/manifest.json` declares the extension: MV3, name `Metaspry`, version `1.0.25`, `minimum_chrome_version: "114"`, `offline_enabled: true`.

- `background.service_worker`: `scripts/background.js` (classic script; no `"type": "module"`).
- `side_panel.default_path`: `index.html`.
- `action`: title and 16/32 px icons, no static `default_popup` (set at runtime, 3.2).
- `icons`: 16, 32, 48, 128.
- Absent: `content_scripts`, `oauth2`, `key`, `web_accessible_resources`, `content_security_policy` (the MV3 default CSP applies).

| Permission | Used by | For |
|---|---|---|
| `tabs` | `background.js` `chrome.tabs.query` | Read the active tab's `url` |
| `activeTab` | `background.js` | Inject the `outerHTML` grab into the active tab |
| `scripting` | `background.js` `chrome.scripting.executeScript` | Same |
| `contextMenus` | `background.js` | The "Spy this page with Metaspry" item (3.3) |
| `storage` | Store modules, `background.js` | Keys in the storage map (section 2) |
| `sidePanel` | `background.js`, `Extension.svelte` | `setPanelBehavior`, `sidePanel.open` |
| `identity` | `src/lib/cloud/auth.ts` | `launchWebAuthFlow` and `getRedirectURL` for Google sign-in (3.13) |
| host `*://*/*` | `background.js`, page fetches | Injection on any http(s) page; cross-origin `fetch` of site files (3.9) and Compare URLs (3.12) |

`chrome.tabs.create` (History) and `chrome.windows.getCurrent` (mode switch) need no extra permission.

**Tests.** None. After a manifest change, reload the unpacked extension and check that Chrome shows no manifest errors.

**Gotchas.**
- Every permission needs store justification copy (`README.md` -> "Justification copy (Permissions)"). That table has no `identity` row today.
- There is no `key`, so an unpacked build gets a different extension ID from the store build (`kibedpkbadcofhbcpfigjmjanmdkmaji`). This matters for the Google sign-in redirect URI (3.13).
- The store's keyword-spam filter scans the manifest `description`. Keep platform brand names out of it (`docs/chrome-store-resubmit.md`).

### 3.2 Surfaces: side panel and popup

**Purpose and flow.** Clicking the toolbar icon opens the side panel (default) or a popup. Settings -> **Preferences** -> `Surface` (a two-option radio group, "Side panel" / "Popup", shown to everyone, 3.8) switches between them; the popup note's "Use side panel" link does the same. In popup mode an amber note ("Popup closes when you switch tabs. Use side panel") shows until it is dismissed.

- `setMode()` writes `mode`. `background.js` `applyMode()` then calls `chrome.action.setPopup({ popup: 'index.html' })` or `({ popup: '' })` and `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick })`.
- `switchMode()` opens the other surface inside the click handler (`chrome.action.openPopup()`, or `chrome.windows.getCurrent().then(...)` -> `chrome.sidePanel.open`), saves the mode, then calls `window.close()` after 50 ms.
- `mode.ts` sets `document.documentElement.dataset.mode`; `app.css` gives the popup a 720px width and 600px minimum height and hides the background orbs.

**Key files.** `src/lib/mode.ts` (`switchMode`), `static/scripts/background.js`, `src/lib/components/Settings/SettingsDrawer.svelte` (Surface radio group), `src/lib/views/Extension.svelte` (popup note), `src/routes/app.css`.

**Data.** `mode`, `popupHintDismissed`.

**Permissions.** `sidePanel`, `storage`.

**Tests.** None. Manually switch both ways and reopen from the toolbar.

**Gotchas.**
- `sidePanel.open` and `action.openPopup` only work inside a user gesture. `background.js` mirrors the mode in memory (`currentMode`) so its context-menu handler never awaits storage first.
- In `switchMode`, the side-panel branch calls `sidePanel.open` inside the `.then()` of `chrome.windows.getCurrent()`, although the comment beside it says no await may come first. If Chrome drops the gesture, the panel does not open (the mode is still saved). Check this by hand when you touch it.
- `chrome.action.openPopup()` needs Chrome 127 or later; `background.js` falls back to the side panel when it fails.
- A popup closes as soon as it loses focus, killing in-flight work such as a cloud upload (3.14).
- Renaming the `mode` key means changing `background.js` as well.

### 3.3 Context menu

**Purpose and flow.** Right-click on a page, selection, link, image or frame -> "Spy this page with Metaspry" opens the extension in the current mode.

**Key files.** `static/scripts/background.js` (`ensureContextMenu`, `openExtensionFromGesture`).

**Data.** Reads the in-memory `currentMode` mirror of `mode`.

**Permissions.** `contextMenus`, `sidePanel`.

**Tests.** None.

**Gotchas.**
- It only opens the UI. It does not start a scan; the user still clicks "Get Meta Tags".
- The item is recreated (`removeAll` then `create`) on install, on browser startup and whenever the service worker starts.
- The store justification promises exactly one top-level item.

### 3.4 Page capture and the scan pipeline

**Purpose and flow.** The landing view shows one card, "Get Meta Tags". Clicking it (or pressing `r`) runs `scrape()` in `Extension.svelte`:

1. Sets the view to `loading` (skeleton). A second call while loading is ignored.
2. `getHTML()` sends `getHTML`. The background queries `{ active: true, lastFocusedWindow: true }`, injects a function that returns `document.documentElement.outerHTML`, and replies with the HTML, the tab URL and `tab.favIconUrl` (Chrome's resolved favicon, null until loaded). The page parses the string with `DOMParser` into an inert document.
3. `getMetaTags(html, tabUrl)` builds `PageMeta`: `<title>`; canonical and icon (`rel=icon`, then `shortcut icon`, then `apple-touch-icon`), both resolved to absolute URLs; every `<meta>` with non-empty `content`, keyed by `property` (preferred) or `name` and categorised; plus `jsonLd`, `hreflang` (resolved) and meta `robots`.
   Then `resolveIcon(meta.icon, favIconUrl, tabUrl)` (`src/lib/scrapers/icon.ts`) computes the **page icon** (`pageIcon` in `Extension.svelte`): the first http(s) URL of the declared link, Chrome's tab icon, `/favicon.ico` at the page origin. `data:`/`chrome:`/`blob:` tab icons are skipped so no icon bytes ever enter a scan document. `PageMeta.icon` itself stays the declared link, so the Tags tab (3.5), the exports and the empty-page check only report markup that exists; the page icon feeds the SERP preview (3.6), History (3.10) and the cloud payload (3.14).
4. `pageUrl` = the first `og:url` value, else the canonical, else the tab URL.
5. No tags, title, canonical or declared icon -> `empty` view ("No meta tags found"); the page icon fallback does not count. Any error -> `error` view with the message and Retry.
6. Otherwise the `results` view opens on the Tags tab. `runAudit()` shows the synchronous result at once and the async result when ready.
7. After the final score: `pushHistory()` (3.10), then the cloud upload if signed in (3.14).

A "Re-scrape this page" button sits under the tab content. `scrapeId` and `auditId` counters drop results from superseded runs.

**Unscriptable pages answer honestly.** `chrome://`/`edge://`/`brave://` pages, the New Tab page, the
Chrome Web Store, PDFs and policy-blocked pages cannot be injected into. The background replies
`{ html: null, url, reason: 'unscriptable' | 'no-tab' }` and `unscriptableMessage()` names the surface
("a browser settings page", "the Chrome Web Store"). Before this the injection failure surfaced as a
generic error, or worse as an empty page that scored.

**Scan identity is the tab URL, never `og:url`** (`src/lib/cloud/scan-identity.ts`). Local history,
the site-files origin, the uploaded payload and the deterministic cloud document id all derive from
`scanUrlFor(tabUrl, canonical)`. A site that hardcodes `og:url` to its homepage on every article is
precisely the defect this product exists to find, and using it as the identity collapsed every one of
those articles into one history row and one overwritten cloud document. `normalizeScanUrl` drops the
fragment and a trailing slash so `/blog`, `/blog/` and `/blog#comments` are one scan; `og:url` stays
in the payload as metadata.

**Key files.** `src/lib/views/Extension.svelte`; `src/lib/scrapers/getHTML.ts`, `getMetaTags.ts`, `icon.ts`, `getJsonLd.ts`, `getHreflang.ts`, `getRobots.ts`, `PageMeta.ts`; `src/lib/categorize.ts`; `static/scripts/background.js`; components `Grid`, `Skeleton`, `EmptyState`, `ErrorState`, `Screen`.

**Data.** In memory only (`pageMeta`, `pageHtml`, `auditResult`).

**Permissions.** `tabs`, `activeTab`, `scripting`, host `*://*/*`. `tab.favIconUrl` needs only the host permission.

**Tests.** `src/lib/scrapers/icon.spec.ts` (resolution order, skipped schemes, non-http page); the scrapers listed in 3.18.

**Gotchas.**
- The captured HTML is the rendered DOM after the page's JavaScript ran, not the server HTML a crawler fetches. JavaScript-injected tags count here. Compare (3.12) fetches raw HTML instead.
- There are two page URLs. `PageMeta.pageUrl` is the tab URL (used by the `hreflang-self` rule). `Extension.svelte`'s `pageUrl` prefers `og:url` and the canonical, and it drives Previews, Site, AI, Compare, history and the cloud document ID. If `og:url` points at another host, the Site and AI tabs fetch that host's files.
- `background.js` does not handle a failed injection (`chrome://` pages, the Chrome Web Store, `file://` without access). `result[0]?.result` throws when `result` is undefined, `sendResponse` is never called, and `getHTML()` only settles when Chrome closes the message port (rejecting with "No response from background script.").
- Tag values in `PageMeta.tags` are raw; only title, canonical, icon and hreflang hrefs are resolved. Consumers resolve `og:image` themselves.
- `getRobots.ts` exports a `RobotsInfo` for meta robots that is unrelated to `SiteFiles.ts`'s `RobotsInfo` for robots.txt. Import the right one.
- `categorize.ts`: `og:*` -> `og`, `twitter:*` -> `twitter`, a fixed SEO set (`description`, `keywords`, `robots`, `canonical`, `author`, `googlebot`) -> `seo`, a fixed basic set (`viewport`, `theme-color`, `generator`, ...) -> `basic`, everything else -> `other`.

**Everything scraped belongs to someone else.** URLs out of robots.txt, sitemaps and llms.txt render
through `safeHref` (`src/lib/util/safe-href.ts`): a non-http(s) scheme renders as text, never as a
live link inside the extension's own page, which is a privileged origin. The injected function caps
the DOM at 3 MB before it crosses the message channel, and CSV exports neutralise spreadsheet formula
prefixes.

**Parsing details that were wrong and are now pinned by tests.** `<title>` is read from `<head>`
only, so an inline SVG `<title>` in the body is not a page title. `<base href>` is honoured when
resolving canonical, icon and hreflang. `rel` is matched on the parsed token list, so
`rel="canonical alternate"` and any casing work - a `[rel="canonical" i]` selector did not.
Duplicate `<title>` and `<link rel=canonical>` counts ride on `PageMeta.duplicates`, because the
duplicate-tags rule can only see `<meta>` elements.

### 3.5 Tags tab

**Purpose and flow.** A search box (focus with `/`), category chips (All, Open Graph, Twitter, SEO, Basic, Other; counts follow the search), an export bar, then one card per tag. Synthetic `title`, `canonical` and `icon` cards come first (the `icon` card, like the exports' `icon` field, is the declared `<link>` only; the resolved page icon from 3.4 never appears here). Pinned tags sort to the top. Each card shows the key and value (URL values become links; values over 240 characters collapse behind "Show more"), a pin toggle, and a copy button with a toast.

Export bar: Copy JSON, Copy CSV, Download .json, Download .csv. JSON is `{ title, canonical, icon, tags, hreflang, robots, jsonLd }`. CSV columns are `key,value,source,category`, synthetic rows first. The file name is the canonical's hostname, else `meta`.

**Key files.** `src/lib/components/Categories/TagsView.svelte`, `SearchInput.svelte`, `CategoryChips.svelte`; `src/lib/components/Card/TagCard.svelte`, `PinButton.svelte`, `UrlValue.svelte`; `src/lib/components/Exporters/ExportBar.svelte`; `src/lib/exporters/exporters.ts`; `src/lib/storage/pinned.ts`.

**Data.** `pinnedKeys` (pins apply across all pages).

**Permissions.** None beyond the page: `navigator.clipboard` for copy, a blob `<a download>` for files (no `downloads` permission).

**Tests.** None.

**Gotchas.**
- The search input carries `data-shortcut="search"`, which the `/` shortcut looks up. Keep the attribute.
- The "Pinned to top" explainer toast shows once per card instance, not once per user.

### 3.6 Previews tab

**Purpose and flow.** Mock share cards for Facebook, Twitter, LinkedIn, Discord, Slack, Google search and iMessage/WhatsApp. A warning banner appears when there is no usable `og:image`, or when both `og:description` and `description` are missing. The Twitter card uses the small `summary` layout only when `twitter:card` is `summary`; anything else (default `summary_large_image`) uses the large-image layout.

Fallback chains (`Preview.svelte`):

| Field | Chain |
|---|---|
| Social title | `og:title` -> `<title>` -> `(no title)` |
| Social description | `og:description` -> `description` |
| Social image | `og:image`, resolved against `pageUrl` |
| Twitter title, description | `twitter:title`, `twitter:description` -> the social chain |
| Twitter image | `twitter:image` -> `og:image` |
| Host label | hostname of `og:url` -> canonical -> `pageUrl`, upper-cased |
| Google title, description | `<title>` -> social title; `description` -> social description |
| Google URL line | canonical -> `pageUrl`, shown as `host › path › segments`, with the page icon from 3.4 (`Preview`'s `icon` prop, rendered by `SiteIcon`: the resolved favicon, or a hostname-letter tile when there is none or it fails to load - never a broken image) |

**Key files.** `src/lib/components/Preview/Preview.svelte`; `src/lib/components/Previews/DiscordPreview.svelte`, `SlackPreview.svelte`, `SerpPreview.svelte`, `MessagingPreview.svelte`; `src/lib/components/SiteIcon/SiteIcon.svelte`.

**Data.** None. **Permissions.** None (images load as `<img>`). **Tests.** None.

**Gotchas.**
- These are Tailwind approximations, not platform renderers.
- The store listing must not enumerate these platforms; it was rejected twice for keyword spam (`docs/chrome-store-resubmit.md`).

### 3.7 Audit tab: engine, rules and scoring

**Purpose and flow.** A header card with "SEO Health" and its caption on the left and the score ring (0-100, coloured through `src/lib/audit/band.ts`, `role="img"` "Score 92 of 100, healthy") on the right - identity left, verdict right, the same rule as every list in the web app - then the rules grouped Required / Recommended / Best Practice with pass, warn, fail or spinning pending icons and a length bar for length rules. Below: JSON-LD entities, the hreflang list and duplicate keys.

**"Changed since" row (signed in).** Under the header card, only when the upload of this scan (3.14) reported `hadPrevious: true`: "Changed since {time ago}" on the left (from the previous document's `scannedAt`, or "your last scan" when it had none) and a link-styled button "Open what changed ↗" on the right (`aria-label` names the destination, `use:tooltip`, no `title`). It opens `compareChangedHref(id)` = `https://app.metaspry.com/compare?a=scan:<id>@prev&b=scan:<id>` in a new active tab (`chrome.tabs.create`; `window.open` on the dev page). The extension never diffs versions itself: the app's `onScanWritten` trigger stores the previous document, and `/compare` resolves `@prev` to the newest stored version. The row is absent when signed out, on the first scan of a URL, when the upload threw, and is cleared at the start of every scan and on sign-out (`cloudScan` in `Extension.svelte`). Same on popup and side panel.

**Engine.** `audit(meta, settings)` runs every rule synchronously. `og:image-dimensions` returns `pending`; `resolveAsyncRules()` loads the image (`new Image()`, 5 s timeout, `referrerPolicy = 'no-referrer'`), replaces that rule's result and rescores with `rescoreAfterAsync()`.

**The `noindex` rule returned a false PASS four ways, and all four are now covered.** It parses the
directive list case-insensitively and on any whitespace or comma (`/(^|[\s,])(noindex|none)([\s,]|$)/i`),
reads **every** `robots`/`googlebot` meta tag rather than the first, and names the tag that actually
carries the directive - quoting `robots` blindly reported "robots: index,follow blocks indexing" on a
page whose `googlebot` tag was the restrictive one. The fourth path is the `X-Robots-Tag` **response
header**, which no meta tag can reveal: `scrapers/getHeaderRobots.ts` fetches it and
`resolveAsyncRules` overrides the rule. Until that resolves, the synchronous answer is the honest
"nothing in the HTML blocks it", not "indexable".

**`dup-tags` counts per (name, media) pair.** Two tags sharing a name but scoped to different
media queries - the light/dark `theme-color` pattern - are not duplicates. Counting by name
alone reported the correct markup as a defect, including on metaspry.com itself. `MetaTag`
carries an optional `media`, whitespace in the query is normalised before comparison, and two
tags sharing a query are still a warning. Mirrored in `app/functions/src/audit/engine.ts`.

**`canonical` compares, it does not merely exist.** `audit/url-match.ts` `sameUrl` ignores the
fragment, a trailing slash and http/https, and treats `www.`, query strings and path casing as real
differences - a canonical pointing somewhere else is the common, silent cause of a page not being
indexed, and "a canonical tag is present" passed it.

**Rules** (`src/lib/audit/rules.ts`, 19 rules, in order):

| id | Severity | Passes when | Otherwise |
|---|---|---|---|
| `title` | required | `<title>` present | fail |
| `description` | required | a `description` meta tag | fail |
| `og:title` | required | present | fail |
| `og:description` | required | present | fail |
| `og:image` | required | present | fail |
| `noindex` | required | no `noindex` or `none` in meta `robots` or `googlebot`, **and** no `noindex` in the `X-Robots-Tag` response header | fail |
| `og:url` | recommended | present | warn |
| `og:type` | recommended | present | warn |
| `twitter:card` | recommended | present | warn |
| `canonical` | recommended | canonical link present **and pointing at this page** (`sameUrl`) | warn |
| `article-og` | recommended | `og:type` is not `article`, or `article:author`, `article:published_time` and `article:section` are all present | warn, listing the missing ones |
| `hreflang-self` | recommended | no hreflang links, no page URL to compare, or one alternate equals `canonical ?? PageMeta.pageUrl` | warn |
| `title-length` | best-practice | length within `titleMin`-`titleMax` | warn outside the range; fail with no title |
| `description-length` | best-practice | within `descMin`-`descMax` | warn; fail when absent |
| `og-description-length` | best-practice | within `ogDescMin`-`ogDescMax` | warn; fail when absent |
| `og:image-absolute` | best-practice | absolute http(s) URL | warn when relative; fail when absent |
| `og:image-dimensions` | best-practice | at least 1200x630 | warn at 600x315 or more, or when the image cannot load; fail when smaller or absent |
| `dup-tags` | best-practice | every tag key unique (case-insensitive) | warn, listing `key×count` |
| `jsonld-parse` | best-practice | every `application/ld+json` block parses, or there are none | fail with the count of bad blocks |

**Scoring.** Per rule: `pass` earns the severity weight, `warn` and `pending` earn half, `fail` earns 0. `score = round(earned / possible * 100)`, where `possible` sums the weights of all 19 rules. Bands: 80 or more `success`, 50 or more `warning`, else `danger`. Default weights are required 10, recommended 5, best-practice 3, so `possible` is 111.

**Key files.** `src/lib/audit/rules.ts`, `asyncRules.ts`, `AuditResult.ts`; `src/lib/components/Audit/Audit.svelte`, `CharBar.svelte`, `JsonLdSection.svelte`, `HreflangSection.svelte`, `DupTagsSection.svelte`; the "Changed since" row uses `src/lib/cloud/compare-link.ts` and `src/lib/util/time-ago.ts`.

**Data.** In memory. The score goes into history and the cloud payload.

**Permissions.** None (the image loads as `<img>`).

**Tests.** `src/lib/cloud/compare-link.spec.ts` (the exact link), `src/lib/util/time-ago.spec.ts`. The rules and the row markup: none.

**Gotchas.**
- The "Changed since" row trusts `hadPrevious` only. Documents written before 2026-09-25 have no stored versions, so the app answers `no-version` once; after the next content change the diff works. Unchanged re-scans store no version either, so `@prev` can point further back than the last scan.
- Scoring must always use `$effectiveSettings` (3.8), never the raw `settings` store. `Extension.svelte` re-runs the audit whenever `effectiveSettings` changes.
- Rules that do not apply (`article-og`, `hreflang-self`, `jsonld-parse`) count as passes. Rules score independently, so one missing tag can fail several rules (a missing `og:image` fails three).
- `dup-tags` also warns on repeats the Open Graph protocol allows, such as several `og:image` tags.
- `asyncRules.ts` loads the raw `og:image` value. A relative value resolves against the extension origin, fails to load, and the rule warns "Could not load image to measure."
- The cloud payload maps `pending` to `warn` and the bands to `good` / `warn` / `fail` (3.14).
- The web app also scores scans server-side (`app/functions/src/audit/`). Adding or changing a rule here changes every extension score; check parity with the app in the same change.

### 3.8 Scoring settings, Pro gating and settings sync

**Purpose and flow.** The gear icon opens the Settings drawer, a modal dialog (`aria-modal`, focus moves to the first threshold input on open - or to the close button for non-Pro users; never the Surface radio, where one keypress would switch surface - Tab/Shift+Tab cycle inside, Esc / the close button / the backdrop close it and focus returns to the gear). Everyone first sees a **Preferences** fieldset holding the `Surface` radio group (Side panel / Popup, calling `switchMode`, 3.2); the subtitle reads "Preferences and scoring rules". Pro users then see a sync line ("Synced with your account", "Open in web app" -> `https://app.metaspry.com/settings`), the **Length thresholds (characters)** fieldset (Title, Description, og:description, each a min-max pair), the **Severity weights** fieldset (Required / Recommended / Best practice under the explainer "Each rule earns its weight on pass, half on warn, zero on fail. Score = earned / total × 100."), then **Save**, **Reset to defaults** and an "Unsaved changes" chip. The close button, Save, Reset to defaults and "Open in web app" carry `use:tooltip` (3.17): "Close settings (Esc)", "Save scoring rules", "Restore the default thresholds and weights", "Edit these settings in the Metaspry web app (opens a new tab)". Everyone else sees a "Custom scoring is a Pro feature" card whose "Go Pro" link opens `https://app.metaspry.com/upgrade`. The footer shows "Metaspry v<manifest version>" ("dev" outside the extension) and the links metaspry.com, Docs, Roadmap, Blog, "Report a bug".

- **The form edits a draft; nothing persists until Save.** Save calls `updateSettings(draft)` once (one `chrome.storage` write, one cloud push) and toasts "Scoring rules saved"; it is disabled while the draft equals the stored value or has a validation problem. Closing with unsaved edits discards them. A cloud pull or the other surface refreshes an untouched form only.
- **Validation** (`src/lib/storage/validate-settings.ts`, modelled on the app's `validateAuditSettings` but requiring whole numbers everywhere): every threshold an integer >= 0 ("Enter a whole number of 0 or more."), each max >= its min ("Title max must be at least the min."), weights integers >= 0 ("Weights must be whole numbers of 0 or more."), not all zero ("At least one weight must be above 0, or nothing can score."). A cleared box is NaN and is reported, not ignored. Invalid inputs get `aria-invalid` and `aria-describedby` pointing at the message under the row.
- **Reset** is two-step and inline ("Reset? Yes, reset / Cancel", auto-cancels after 5 s); focus follows the swap (to "Yes, reset" on arming, back to Reset on cancel or timeout when it was still on the confirm controls, to the first input after confirming). Confirming calls `resetSettings()` and toasts "Scoring rules reset to defaults". Disabled when the stored value is already the defaults and the form is untouched.
- The open/close reset of the draft lives inside the `$:` statement that watches `open`, not in a helper: Svelte 4 orders reactive statements by the assignments it can see, and a reset hidden in a function ran after `dirty`/`problems` were computed, so a reopen after a dirty close showed stale state.

- `DEFAULT_SETTINGS`: title 30-60, description 70-160, og:description 50-200, weights 10 / 5 / 3. These equal the web app's `DEFAULT_AUDIT_SETTINGS`.
- `effectiveSettings` (`cloud/plan.ts`) is `settings` when `cloudIsPro`, otherwise `DEFAULT_SETTINGS`. Custom values are kept while not Pro and apply again when Pro returns.
- `cloudIsPro` is a live `onSnapshot` of `users/{uid}`: `plan === 'pro'`. It resets to `false` on every auth change.
- Settings sync (`cloud/settings.ts`): on sign-in it reads `users/{uid}/settings/audit` and overwrites the local settings (cloud wins). After that, every local change is written back with `merge: true`. Writes are blocked until the read for the current user finishes (`pulledUid`), and a `suppress` flag stops the pulled value from being written straight back.

**Key files.** `src/lib/components/Settings/SettingsDrawer.svelte`, `src/lib/storage/settings.ts`, `src/lib/storage/validate-settings.ts`, `src/lib/cloud/plan.ts`, `src/lib/cloud/settings.ts`.

**Data.** `settings` (local). Firestore `users/{uid}` (read) and `users/{uid}/settings/audit` (read and write).

**Permissions.** `storage`.

**Tests.** `src/lib/storage/validate-settings.spec.ts` (every rule and message), `src/lib/cloud/settings.spec.ts` (sync). Manually check that a free account scores with defaults and a Pro account with custom values.

**Gotchas.**
- Only a personal `plan: 'pro'` unlocks custom scoring. Team workspace plans do not (stated in `plan.ts`).
- The extension always syncs the personal settings document, even when scans upload to a workspace. The app keeps separate `workspaces/{wsId}/settings/audit` documents, so the extension and the app agree only in the app's Personal scope.
- The validator is stricter than both the store and the app: `storage/settings.ts` accepts any finite number >= 0 on read and the app's `validateAuditSettings` accepts decimals, so a decimal saved in the app (or stored earlier) opens the drawer already invalid with Save blocked until it is corrected.
- "Reset to defaults" also writes the defaults to the cloud when signed in.
- `initCloudSettingsSync` runs before `initSettings` (section 2, startup order). The `pulledUid` guard exists because an early local write once overwrote saved cloud settings (commit `42402d0`).

### 3.9 Site tab: robots.txt, sitemap.xml, llms.txt

**Purpose and flow.** Opening the tab fetches the three files from `pageUrl`'s host and shows one card for each:
- robots.txt: group and sitemap-directive counts, sitemap links, the first 5 user-agent groups (allow and disallow counts), a raw-text toggle.
- sitemap.xml: for an index, the child sitemaps with URL counts or errors, "~N total URLs" and "(showing first 20)" when truncated; for a URL set, the first 10 URLs.
- llms.txt: sections with their links, a raw-text toggle, and a link to llmstxt.org when absent.

`fetchSiteFiles(baseUrl)` in `src/lib/scrapers/getSiteFiles.ts`:
- Fetches robots.txt and llms.txt in parallel, then the sitemap.
- Sitemap candidates: every `Sitemap:` line from robots.txt, then `/sitemap.xml`, `/sitemap_index.xml`, `/sitemap-index.xml`, `/wp-sitemap.xml`, `/sitemaps.xml`, `/sitemap/sitemap.xml`, `/sitemaps/sitemap.xml`. It tries them one at a time until one parses.
- A sitemap index resolves up to 20 children in parallel; nested indexes recurse to depth 2, 20 children per level.
- Limits: 4 s timeout per request, body cut at 2,000,000 characters, `credentials: 'omit'`, redirects followed. An HTML response (a single-page-app fallback) counts as missing.
- robots.txt parser: consecutive `User-agent` lines form a group; `Allow` and `Disallow` values are collected; `Crawl-delay` is accepted but not stored; `#` comments are stripped.
- llms.txt parser: `#` to `###` headings start sections; `- [label](url)` lines become links.

**Key files.** `src/lib/scrapers/getSiteFiles.ts`, `src/lib/scrapers/SiteFiles.ts`; `src/lib/components/Site/SiteView.svelte`, `RobotsCard.svelte`, `SitemapCard.svelte`, `LlmsCard.svelte`.

**Data.** In memory. A trimmed summary goes to the cloud (3.14).

**Permissions.** Host `*://*/*`.

**Tests.** None.

**Gotchas.**
- Nothing is cached. The Site tab, the AI tab and the cloud upload each call `fetchSiteFiles` separately, and leaving a tab and coming back fetches again.
- `SitemapInfo.error` doubles as a notice: a sitemap found at a fallback path has `present: true` and `error: 'Found at fallback location: ...'`.
- The parser helpers are module-private (not exported).

### 3.10 History

**Purpose and flow.** The History button in the header toolbar (3.17; `aria-expanded` while open) opens "Recent scrapes": the last 10 scans, each row left to right: site favicon (`SiteIcon`, 16 px; letter tile when missing or broken), title (or hostname) over hostname, relative time, then the score chip last (`bandClasses(...).chip` from `src/lib/audit/band.ts`, `role="img"` with the "Score N of 100, band" label and the same text as a hover tooltip). Each row button has the tooltip "Open in new tab" (hover and keyboard focus). Clicking an entry opens its URL in a background tab (`active: false`, so a popup stays open). "Clear" empties the list.

**Key files.** `src/lib/components/History/HistoryDropdown.svelte`, `src/lib/storage/history.ts`, `src/lib/components/SiteIcon/SiteIcon.svelte`.

**Data.** `history`: `{ url, hostname, title, score, timestamp, icon? }`, one entry per URL, max 10. `icon` is the resolved favicon (3.4); entries written before it existed have none and render the tile.

**Permissions.** `storage`.

**Tests.** None.

**Gotchas.**
- Local only and unrelated to cloud history.
- An entry is added after the async audit finishes, so a scan abandoned mid-audit is not recorded.
- The list is keyed by `timestamp`.

### 3.11 AI tab (AEO checks)

**Purpose and flow.** The fifth tab, labelled "AI". It fetches the site files, runs `analyzeAeo(html, siteFiles, pageUrl)` on the rendered DOM, and shows a chip ("AI-ready" when no check is warn or fail, otherwise "Needs work") plus Page and Site groups. The copy says this is readiness, "not a guarantee of citations".

Checks in `src/lib/audit/aeo.ts`:

| id | Scope | Logic | States |
|---|---|---|---|
| `aeo-indexable` | page | `meta[name=robots]` contains `noindex`, `nosnippet` or `max-snippet:0` | warn, else pass |
| `aeo-headings` | page | Exactly one `<h1>`; a question-style h1-h3 (contains `?` or starts with how, what, why, when, where, who, which, can, do, is, are) | pass (one H1 and a question heading), info (one H1), warn (not exactly one H1) |
| `aeo-geo-levers` | page | Counts statistics, quotation marks, and outbound links to another host | always info (`n/3`) |
| `aeo-jsonld` | page | At least one JSON-LD block parses | pass, else info |
| `aeo-author-date` | page | Author (`meta author`, JSON-LD `author` or a Person) and date (`time[datetime]`, `datePublished`/`dateModified`, `article:published_time`) | pass, else warn |
| `aeo-ai-retrieval` | site | Only when robots.txt exists: is any of `OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot`, `Googlebot` fully blocked | warn, else pass |
| `aeo-ai-training` | site | Only when robots.txt exists: lists blocked `GPTBot`, `ClaudeBot`, `CCBot`, `Google-Extended`, `Applebot-Extended`, `Bytespider`, `Meta-ExternalAgent` | always info |
| `aeo-llms-txt` | site | Whether llms.txt exists; "well-formed" means it has a `# ` heading and a `## ` section | always info |
| `aeo-raw-html` | page | Cannot be checked on a rendered DOM; suggests a cloud scan | always info |

"Fully blocked" means the most specific matching user-agent group (exact token, case-insensitive, else `*`) has `Disallow: /` and no `Allow: /`.

**Key files.** `src/lib/audit/aeo.ts`, `src/lib/components/Aeo/AeoView.svelte`.

**Data.** In memory only. AEO results are not part of the 0-100 score, the history or the cloud payload.

**Permissions.** Host `*://*/*` (site files).

**Tests.** None.

**Gotchas.**
- `aeo.ts` mirrors the web app's server analyzer `app/functions/src/aeo.ts` and says "Keep aligned". Change `AI_BOTS` or any check's meaning in both repos.
- No check currently returns `fail`, although the type allows it.
- The quotation regex is `/["""]/`: three straight ASCII quotes. Typographic quotes (“ ”) are not detected.
- `aeo-indexable` reads only `meta[name=robots]`; the Audit `noindex` rule also reads `googlebot`.

### 3.12 Compare tab

**Purpose and flow.** A URL field pre-filled with `pageUrl`. Input like `example.com` gets `https://` added, and the hostname must contain a dot. The tab re-fetches the current page and fetches the compared URL as served HTML (both sides without cookies; the rendered DOM is used for the left side only when that fetch fails, with a warning), requires a `text/html` content type, parses it, then shows the Current and Compared cards (label and URL on the left, the coloured score on the right of the same line, `role="img"` labelled - the Current score is the rendered-page audit from the Audit tab, the Compared score is an audit of the served HTML, so on a JavaScript-rendered site the two scores measure different things while the diff rows below compare served HTML on both sides) and one row per key: same (green), different (amber) or present on one side only (grey). Priority keys come first (title, description, canonical, `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`), then the rest alphabetically.

**Key files.** `src/lib/components/Compare/CompareView.svelte`, `src/lib/components/Compare/diff.ts`.

**Data.** In memory only: no history entry, no upload.

**Permissions.** Host `*://*/*` (cross-origin fetch with `credentials: 'omit'`).

**Tests.** None.

**Gotchas.**
- The left side is the rendered DOM; the right side is raw server HTML with no JavaScript. Tags that JavaScript injects show as left-only.
- The right score uses `$effectiveSettings` and waits for the async image rule.
- `diffMeta` keeps the first value of each key.
- `localhost` and other dotless hosts are rejected.
- Both fetches abort after 6 s (`FETCH_TIMEOUT_MS`; `fetchServedHtml` for the compared URL, `fetchSourceMeta` for the current page). The compared-URL timeout reads "Timed out after 6 s - the site did not answer."; the current-page one falls back to the rendered DOM with the mixed-sources warning.

### 3.13 Cloud sign-in

**Purpose and flow.** The header's account control (`CloudSync.svelte`) is a primary "Sign in" button when signed out, and, when signed in, an initials circle (`initialsFor(email)`, `src/lib/cloud/initials.ts`) with a green dot, the sync target's name (hidden below 460 px) and a chevron; both expose `aria-expanded`. Its dropdown (and History's) is positioned against the header's right-hand block in `Extension.svelte`, not against its own button, so it stays inside a narrow side panel. Signed out, its dropdown offers an email and password form ("Same login as the web app") and "Continue with Google". Signed in, it shows the email, "Open Metaspry web app" (new tab, `app.metaspry.com/dashboard`), the sync target picker (3.14) and "Sign out".

- `cloud/firebase.ts` initialises Firebase from the public web config (project `metaspry`). Firestore uses `ignoreUndefinedProperties: true`.
- Email and password: `signInWithEmailAndPassword`.
- Google: `chrome.identity.launchWebAuthFlow` against Google's OAuth endpoint (`response_type=id_token`, `scope=openid email profile`, a random nonce, `prompt=select_account`) with the Web application OAuth client `540366408211-dgqe276vt9j1b9oin5i27orh30q0js4d.apps.googleusercontent.com`. The returned `id_token` becomes a Firebase `GoogleAuthProvider` credential.
- `cloudUser` and `cloudReady` stores follow `onAuthStateChanged`.
- There is no auth handoff between the web app and the extension. The user signs in separately in each, with the same account.

**Key files.** `src/lib/cloud/firebase.ts`, `src/lib/cloud/auth.ts`, `src/lib/cloud/initials.ts`, `src/lib/components/CloudSync/CloudSync.svelte`.

**Data.** Firebase Auth session in IndexedDB.

**Permissions.** `identity`.

**Tests.** `src/lib/cloud/initials.spec.ts` (initials from the email). Sign-in itself: none.

**Gotchas.**
- The redirect URI is `https://<extension-id>.chromiumapp.org/`, and it must be listed in that OAuth client's authorised redirect URIs. Unpacked builds have their own extension ID, so each needs its own entry. A "Chrome Extension" OAuth client type does not work here (comment in `auth.ts`; history in commits `77cd51f` to `9703b91`).
- Email and password errors are replaced with one generic message.
- The bundle imports the default `firebase/auth` entry (see the store-review note in 4.4).
- **Settings reset on every auth change, sign-out included** (`src/lib/cloud/settings.ts`
  `resolveSettingsForAuth`). The reset happens FIRST, before any cloud load, mirroring what
  `cloud/plan.ts` does for the plan: without it, signing out of account A and into account B left A's
  custom scoring weights applied to B's scans, and a sign-out left them applied to an anonymous user.
  The reset is `persist: false` - an in-memory isolation step, not a user edit, so it never writes
  the other account's values into `chrome.storage`.

### 3.14 Scan upload and sync target

**Purpose and flow.** When signed in, every successful scan uploads after its final audit. The dropdown sets where new scans go: "Personal history" or any workspace where the user's role is `owner` or `member`.

- `toScanPayload(meta, auditResult, pageUrl, siteFiles)` builds the web app's scan document: `schemaVersion: 1`, `url`, `hostname`, `scannedAt`, `title`, `source: 'extension'`, `starred: false`, `workspaceId`, `score`, `band`, `pageMeta` (`title`, `description`, `canonical`, `ogImage` from `og:image` then `twitter:image`, `favicon` = the page icon from 3.4 (`Extension.svelte` passes `{ ...meta, icon: pageIcon }`), so it is set for every http(s) page, `tagCount`, `tags`), `audit` (`score`, `band`, and `rules` of `{ id, label, status, severity, message, meta }`), and an optional `siteFiles` summary.
- Site-files summary caps: 8 robots groups (counts only), 10 sitemap directives, 20 sitemap children, 10 sample URLs, 15 llms sections with 15 links each. No raw file text.
- Document ID: `'s'` + a djb2 hash of the URL in base 36, so scanning the same URL again overwrites its document.
- Target: `users/{uid}/scans/{id}` or `workspaces/{wsId}/scans/{id}`, with `workspaceId` set to match and `createdAt: serverTimestamp()`.
- Workspaces: `workspaces` where `memberUids` array-contains the uid, filtered to role `owner` or `member`. If the saved workspace is no longer in that list, the target falls back to personal. Signing out resets it to personal.
- Upload errors are swallowed (a DEV-only console warning).
- `uploadScan` resolves to `UploadResult` `{ id, hadPrevious, previousScannedAt }` from the `getDoc` it already does before writing (no extra read). `Extension.svelte` keeps it as `cloudScan` (null at the start of every scan, on sign-out, and when the upload threw) for the Audit tab's "Changed since" row (3.7).

**Key files.** `src/lib/cloud/sync.ts`, `src/lib/cloud/workspaces.ts`, `src/lib/components/CloudSync/CloudSync.svelte`, `src/lib/views/Extension.svelte` (the upload call).

**Data.** `syncScope`; the Firestore paths above.

**Permissions.** `storage`; host `*://*/*` (site files).

**Tests.** `src/lib/cloud/sync.spec.ts` (`uploadScan`: first scan vs re-scan, `starred`/`createdAt` carry-over, workspace path, non-numeric `scannedAt`). Manually scan while signed in and confirm the scan appears in the app's history for the chosen target.

**Gotchas.**
- The payload must stay compatible with the app's `ScanPayload` (`app/src/lib/scan/types.ts`) and `app/firestore.rules`. Change `SCAN_SCHEMA_VERSION` only together with the app.
- `setDoc` without `merge` replaces the whole document on a re-scan, including `createdAt` and any field another client added.
- The upload waits for the image check (up to 5 s) and a fresh `fetchSiteFiles` (several 4 s timeouts are possible). Closing the popup before it finishes drops the upload without any message.
- From reading the code (not tested at runtime): `initCloudWorkspaces()` subscribes to `cloudUser` while it is still `null`, which immediately calls `setSyncScope({ kind: 'personal' })` and stores `personal` over the saved choice. The earlier storage read still restores the workspace in memory for that session, but the stored value is now `personal`, so a workspace choice does not survive the next reopen.
- Links into the app: "Open Metaspry web app" in the signed-in account dropdown (3.13), "Open in web app" on the Settings sync line and the Pro upsell (3.8).

### 3.15 Theme

**Purpose and flow.** The sun/moon button toggles light and dark. On start the theme is the stored choice, or the OS preference if there is none.

**Key files.** `src/lib/theme.ts`, `tailwind.config.js` (`darkMode: 'class'`).

**Data.** `theme`. **Permissions.** `storage`. **Tests.** None.

**Gotchas.**
- After the first toggle there is no way back to following the OS.
- Components use `dark:` variants throughout; new UI needs them too.

### 3.16 Keyboard shortcuts

**Purpose and flow.** Keys are ignored while typing in an input, textarea, select or contenteditable element:
- `/` focuses the tag search (switching to Tags).
- `?` toggles the help modal.
- `r` re-scrapes.
- `1` to `5` select tabs by position: Tags, Previews, Audit, Site, AI. Compare (sixth) has no key.

In the tab strip, Arrow Left/Right, Home and End move between tabs. `Esc` closes the Settings drawer and the help modal (not the History or Cloud sync dropdowns). `Esc` also hides a visible tooltip (3.17); the tooltip's handler never calls `preventDefault` / `stopPropagation`, so one press both hides it and closes the drawer. While the Settings drawer is open, Tab and Shift+Tab cycle inside it (3.8).

**Key files.** `src/lib/components/Shortcuts/keyboard.ts`, `src/lib/components/Shortcuts/ShortcutsHelp.svelte`, `src/lib/components/Tabs/Tabs.svelte`, `src/lib/views/Extension.svelte` (`registerShortcuts`).

**Data.** None. **Permissions.** None. **Tests.** None.

**Gotchas.**
- The help modal still says "1 / 2 / 3 / 4: Switch to Tags / Previews / Audit / Compare", which no longer matches the key handler.
- The `?` button is always visible in the header toolbar (3.17) and reports `aria-expanded` while the sheet is open.
- The marketing site documents shortcuts in `docs/keyboard-shortcuts`.

### 3.17 UI shell and shared components

- `+page.svelte`: gradient background and two blurred decorative orbs (`data-bg-orb`, hidden in popup mode).
- Header, left to right, one line at every width from 320 px: logo (wordmark hidden below 400 px); the account control (3.13); one `role="toolbar"` group styled by `src/lib/components/toolbar.ts` (`toolbarButtonClass(active)`, `TOOLBAR_GROUP`) holding History, Settings, theme toggle (`aria-pressed` in dark mode) and shortcuts `?`. Every button has a `use:tooltip` equal to its `aria-label` (theme: "Switch to light/dark theme", following the state); the account control's tooltip is "Sign in to sync scans to your account" or "Signed in as <email> - saving scans to <target>". Arrow Left/Right, Home and End move focus inside the toolbar. The surface toggle lives in Settings (3.2).
- Both header menus anchor to the header's right-hand block (`relative` in `Extension.svelte`). Nothing between that block and a menu may carry `backdrop-blur`, `filter` or `transform`: that element would become the menu's containing block and stacking context, re-anchoring it and painting it under later glass cards (this bit the toolbar group once).
- Views: `landing` (Grid card "Get Meta Tags"), `loading` (`Skeleton`), `error` (`ErrorState`: "Couldn't scrape this page", Retry, links to docs and GitHub issues), `empty` (`EmptyState`: "No meta tags found", Try again, docs link), `results` (`Tabs` with Tags, Previews, Audit, Site, AI, Compare).
- `Screen`: glass card wrapper. `Grid`: landing action cards (`GridProps` in `Grid.ts`).
- Toasts: `toast(message, variant)`; at most 3 visible, 1.5 s each.
- Tooltips: `use:tooltip={text | { text, placement?, delay? }}` (`src/lib/actions/tooltip.ts`, same API and behaviour as the web app's action). One shared body-level element (`role="tooltip"`, `id="ms-tooltip"`, class `.ms-tooltip` + `.ms-tooltip-arrow` in `src/routes/app.css`, `fixed z-[60]` so it clears the drawer and dropdowns; dark-aware; `invisible` while idle so it stays out of the accessibility tree; no transition under `prefers-reduced-motion`). Shows after `delay` (350 ms) on `pointerenter` (not touch), at once on keyboard focus (`:focus-visible` only, so a mouse click never pops it), hides on `pointerleave`, `blur`, `pointerdown`, `Escape`; `aria-describedby="ms-tooltip"` is on the trigger only while visible, and not at all when the text repeats its `aria-label` (so it is announced once). A newer hover cancels any pending one (the History chip inside its row). Tooltip text wraps (`break-words`), so long URLs stay in the box. floating-ui `computePosition` (`strategy: 'fixed'`, `offset(8)`, `flip()`, `shift({ padding: 8 })`, `arrow`) + `autoUpdate` keep it inside a 320 px side panel. Empty text never shows. Used by: header toolbar, account control, History rows and score chip, Audit ring, Compare URL and scores, `PinButton`, `TagCard` copy, `ExportBar`, Site cards' "Not an http(s) URL" spans (hover-only, so each also carries an `sr-only` " (not an http(s) URL)"), Settings drawer buttons. Controls use the action, never a native `title` (a title beside it doubles up); the one remaining `title` is the truncated href text in `Audit/HreflangSection.svelte`.
- Scores: `src/lib/audit/band.ts` (`bandFor`, `bandLabel`, `scoreLabel`, `bandClasses`) is the only place a score turns into a band, a label or colour classes; the History chip, the Audit ring, the Compare numbers and the cloud payload's `band` all use it. Placement rule shared with the web app: identity left, score last on the right. Tailwind 3 gotcha: `bg-*/15` compiles to nothing (no 15 in the opacity scale) - use `/20`.

**Gotchas.**
- `Tabs` renders `tab.icon` with `{@html}`. Pass only static trusted markup there, never page data. No tab uses an icon today.
- Tabs are keyed by id in `Extension.svelte` (`ActiveTab` union and `isActiveTab`). Adding a tab means updating the `tabs` array, the union, the guard, the `{#if}` chain and the shortcut help.

### 3.18 Tests and quality gates

| Command | What |
| --- | --- |
| `npm test` | Vitest, co-located `*.spec.ts` (`--run` for one pass, `npm run test:watch` to watch). |
| `npm run check` | `svelte-check` against `tsconfig.json`. |
| `npm run build` | `vite build` + `removeInlineScript.cjs`. Does not type-check on its own. |

- Covered by unit tests: `cloud/sync.ts` (`sync.spec.ts`, in-memory Firestore mock), `cloud/compare-link.ts`, `util/time-ago.ts`, `actions/tooltip.ts` (`tooltip.spec.ts`: options and listener wiring in node with a fake element; `tooltip.dom.spec.ts`: show/hide, owner hand-off, `aria-describedby`, Escape propagation, nested hover, update/destroy in happy-dom with floating-ui mocked), `audit/rules.ts`, `audit/asyncRules.ts`, `audit/url-match.ts`,
  `cloud/scan-identity.ts`, `cloud/settings.ts`, `scrapers/getHTML.ts`, `scrapers/getRobots.ts`,
  `scrapers/getHeaderRobots.ts`, `storage/watch.ts` and its key helper.
- Manual verification is still required for anything that needs a real browser: `npm run build`, load
  `build/` unpacked, then check all six tabs, both surfaces, the context menu, sign-in (email and
  Google), a signed-in scan landing in the app, and free versus Pro scoring.

---

## 4. Build, release and versioning

### 4.1 Build pipeline

1. `vite build`: SvelteKit with `adapter-static` prerenders `src/routes/+page.svelte` into `build/index.html`, emits JS and CSS under `build/app/immutable/`, and copies `static/` into `build/`.
2. `node removeInlineScript.cjs`: MV3 extension pages forbid inline scripts, so for every `build/**/*.html` it moves the first inline `<script>` (SvelteKit's bootstrap) into `build/script-<hash>.js` and replaces it with `<script type="module" src="/script-<hash>.js">`. While moving it, it rewrites `__sveltekit` to `const __sveltekit` and `document.currentScript.parentElement` to `document.body.firstElementChild`, which is the `display: contents` wrapper in `src/app.html`.

**Gotchas.**
- Keep the wrapper `<div>` as the first element child of `<body>` in `src/app.html`, or the app mounts into the wrong node.
- The glob option is spelled `aboslute: true` deliberately. "Fixing" it to `absolute: true` breaks the build (see the comment in the file).
- The regex handles one inline script per HTML file.
- Vite prints a chunk-size warning: the page chunk is about 0.9 MB, mostly Firebase. This is expected.
- TypeScript is transpiled, not type-checked.

### 4.2 Versioning

- The version lives in two files that must match: `version` in `static/manifest.json` and in `package.json` (both `1.0.25` on `main`, which is what the store serves; `main` carries unreleased fixes for v1.0.26). No script syncs them.
- Convention from the git history: each shipped change bumps the patch version and gets a new zip (commit messages like "v1.0.22 + zip").
- The repo has no git tags, although the README checklist ends with "tag the commit `vX.Y.Z`".

### 4.3 Packaging: `metaspry-v*.zip`

- Zips are named `metaspry-v<version>.zip`, live at the repo root and are git-ignored (`.gitignore`: "regenerable from build/ via Compress-Archive"). Every earlier zip is kept locally. Never delete or overwrite one without asking.
- Zip the contents of a fresh `build/`, so that `manifest.json` sits at the zip root. No script automates this. The PowerShell equivalent:

  ```powershell
  npm run build
  Compress-Archive -Path build\* -DestinationPath metaspry-v1.0.24.zip   # use the manifest version
  ```

  `Compress-Archive` refuses to overwrite an existing file unless you pass `-Force`; that refusal is the safety net for the rule above.
- Expected contents: `manifest.json`, `index.html`, `script-<hash>.js`, `app/version.json`, `app/immutable/**`, `scripts/background.js`, `icons/*`, `favicon.png`. The v1.0.24 zip has 25 entries.
- Windows PowerShell 5.1's `Compress-Archive` writes backslash path separators (visible in the v1.0.24 zip). PowerShell 7+ writes forward slashes.
- The zip also carries `icons/icon-512.png`, `icons/icon.svg` and `icons/promo-440x280.png`, which the manifest does not reference.

### 4.4 Release checklist and store submission

The README's "Version bump checklist": bump the version, build, load unpacked and smoke-test every tab, zip the contents of `build/`, upload in the Developer Dashboard (Package -> Upload new package), refresh screenshots if the UI changed, submit (1-3 business days), then tag.

| Where | What |
|---|---|
| `README.md` -> "Chrome Web Store listing" | Name, summary, category, description, permission justifications, single purpose, privacy answers, distribution, asset checklist |
| `docs/chrome-store-resubmit.md` | The two "Yellow Argon" keyword-spam rejections (May 2026), the platform-free description, and the rule that each brand name appears at most once per listing field |
| `docs/store-screenshots.md` | Screenshot capture runbook: five shots, 1280x800, 24-bit PNG |
| `scripts/gen-icons.mjs`, `scripts/gen-promo-tiles.mjs`, `scripts/process-screenshots.mjs` | Asset generation with `sharp` |
| `promo/` | Current tiles and screenshots |

Store item ID: `kibedpkbadcofhbcpfigjmjanmdkmaji`. Privacy policy URL: `https://metaspry.com/docs/privacy/`.

**Before the next submission.**
- The README's listing copy and privacy answers predate cloud sync. They say there is no account, no first-party servers and nothing is synced, answer "Authentication info: No", and the permission table has no `identity` row. The manifest description was already corrected (commit `41ef21d`). Reconcile the listing with the Firebase sign-in and upload before submitting.
- The shipped bundle contains the strings `https://apis.google.com/js/api.js` and `https://www.google.com/recaptcha/api.js`, which come from the default `firebase/auth` entry. Store review for MV3 checks for remotely hosted code, and these URLs are a commonly reported rejection trigger for extensions that use `firebase/auth`. The installed Firebase version also ships a `firebase/auth/web-extension` entry intended for extensions.
- `docs/chrome-store-resubmit.md` is a record from the v1.0.5 era; its version numbers are historical.

---

## 5. How it connects to the web app and the marketing site

### Web app (`app.metaspry.com`)

- Same Firebase project (`metaspry`) and the same user accounts. `APP_URL = 'https://app.metaspry.com'` is defined in `src/lib/cloud/plan.ts`.
- Firestore contract:

| Path | What the extension does | Extension file | App side |
|---|---|---|---|
| `users/{uid}` | Live read of `plan` | `cloud/plan.ts` | Written only by the server (rules deny client writes) |
| `users/{uid}/settings/audit` | Read at sign-in; merge-write on local change | `cloud/settings.ts` | The app's personal scoring settings; its server scorer reads `<scope>/settings/audit` |
| `users/{uid}/scans/{id}` | Whole-document write per scan | `cloud/sync.ts` | Rendered from `ScanPayload` (`app/src/lib/scan/types.ts`) |
| `workspaces` (query `memberUids` array-contains uid) | Read | `cloud/workspaces.ts` | Workspace documents with `name`, `memberUids`, `roles` |
| `workspaces/{wsId}/scans/{id}` | Whole-document write per scan | `cloud/sync.ts` | Writable by owners and members under `app/firestore.rules` |

- Links into the app: only "Go Pro" -> `${APP_URL}/upgrade` in the Settings drawer. The sign-in copy tells users their scans go to "your history at app.metaspry.com".
- Kept in sync by hand across the two repos: `DEFAULT_SETTINGS` and the app's `DEFAULT_AUDIT_SETTINGS`; `aeo.ts` and `app/functions/src/aeo.ts`; `toScanPayload` and the app's `ScanPayload`. A change to any of these is a two-repo change.
- The app's `ScanPayload` also has optional `note`, `tags` and `aeo` fields. The extension sends none of them.

### Marketing site (`metaspry.com`)

- Linked from the Settings drawer (metaspry.com, `/docs/`, `/roadmap/`, `/blog/`), `EmptyState` and `ErrorState` (`/docs/`), and the store listing (`/docs/privacy/`, `/docs/previews`).
- The site's docs describe extension behaviour, for example `docs/audit-rules`, `docs/keyboard-shortcuts`, `docs/site-files`, `docs/ai-crawler-signals`, `docs/previews`, `docs/cloud-sync`, `docs/custom-rules` and `docs/privacy`. When you change the matching feature here, flag the page for an update in that repo.
- Brand mark: `scripts/gen-icons.mjs` uses the same "M" path as the site's `src/components/Logo.astro`.
- Bug reports go to GitHub issues on `metaspry/metaspry` (linked from Settings and `ErrorState`).

---

## 6. Keeping this file current

**Rule.** Any change that adds, changes or removes a feature, permission, message type, storage key, audit rule, AEO check, Firestore path or payload field, or build or release step MUST update the matching section of this file in the same commit or PR. The OpenSpec's `tasks.md` MUST include an "Update AGENTS.md" task, and the review gate checks that it was done.

| If you change | Update |
|---|---|
| `static/manifest.json` (permissions, keys, version) | 3.1, 4.2 |
| `background.js`, or any `chrome.runtime` or `chrome.storage.onChanged` channel | Section 2 (messaging map), 3.2, 3.3, 3.4 |
| A `chrome.storage` key, IndexedDB use, or Firestore path | Section 2 (storage map), the feature section, section 5 |
| A tab, header control or view | Section 2, the feature section, 3.16, 3.17 |
| `audit/rules.ts`, `audit/asyncRules.ts`, default settings or weights | 3.7, 3.8 |
| `audit/aeo.ts` | 3.11 |
| Anything in `src/lib/cloud/` | 3.8, 3.13, 3.14, section 5 |
| Keyboard shortcuts | 3.16 |
| `removeInlineScript.cjs`, npm scripts, packaging, store docs or assets | Section 4 |
| Test or lint tooling | 1 (commands), 3.18 |

Also:
- Update the "Verified against" line at the top with the commit you checked.
- If you find this file wrong, fix it in the same PR.
- Describe only what `main` does. Plans and unmerged branches do not belong here.
