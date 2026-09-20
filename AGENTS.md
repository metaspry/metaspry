# AGENTS.md — Metaspry browser extension

Feature map for this repo. Every change that adds, changes, or removes a feature, permission,
message type, storage key, audit rule, or build step updates the matching section here, in the same
commit.

Stack: Svelte 4 + SvelteKit 1 (static adapter) + Tailwind 3, built by Vite 4 into `build/` and loaded
as an unpacked MV3 extension. TypeScript strict; `tsconfig.json` strictness is not negotiable.

---

## 1. Surfaces

| Surface | Entry | Notes |
| --- | --- | --- |
| Side panel | `static/manifest.json` → `side_panel.default_path: index.html` | Default surface (`mode: 'sidepanel'`). |
| Popup | same document, opened as the action popup | `mode: 'popup'`. Both surfaces run the same `Extension.svelte`. |
| Service worker | `static/scripts/background.js` | Scrapes the active tab, owns the context menu and the mode switch. |

Both surfaces can be open at once. They are separate documents with separate store instances, so
every `chrome.storage`-backed store re-hydrates through `src/lib/storage/watch.ts` (`watchKey`) and
suppresses its own writer while applying an external value (`makeWriteGuard`). Without that, the
last surface to write erases what the other recorded.

## 2. Scan flow

1. `Extension.svelte:scrape()` asks the service worker for the active tab's HTML
   (`chrome.runtime.sendMessage({ message: 'getHTML' })`).
2. `background.js` runs `chrome.scripting.executeScript` and always answers. When injection is not
   possible (`chrome://`, New Tab, Web Store, PDFs, policy-blocked pages) it answers
   `{ html: null, url, reason: 'unscriptable' }`; `getHTML.unscriptableMessage()` turns that into a
   message naming the page kind. Popup code never touches the user's `document` directly.
3. `getMetaTags(html, tabUrl)` builds `PageMeta` (tags, title, canonical, icon, JSON-LD, hreflang,
   robots).
4. **Scan identity** is `scanUrlFor(tabUrl, canonical)` (`src/lib/cloud/scan-identity.ts`): the URL
   actually scanned, fragment dropped. `og:url` is payload metadata only — a site that hardcodes it
   would otherwise collapse every page into one history row and one cloud document.
5. `audit()` scores the page synchronously; `resolveAsyncRules()` then resolves everything that
   needs the network (og:image dimensions, `X-Robots-Tag`) and rescores.
6. Signed in: `fetchSiteFiles(origin)` + `uploadScan()` write `users/{uid}/scans/{id}`, id hashed
   from the scan identity.

## 3. Audit rules

`src/lib/audit/rules.ts` — `required` | `recommended` | `best-practice`, weights from settings:

`title`, `description`, `og:title`, `og:description`, `og:image`, `noindex`, `og:url`, `og:type`,
`twitter:card`, `canonical`, `article-og`, `hreflang-self`, `title-length`, `description-length`,
`og-description-length`, `og:image-absolute`, `og:image-dimensions`, `dup-tags`, `jsonld-parse`.

Rules with behaviour worth knowing:

- **`noindex`** (`required`) — the product's core claim. Detection covers: `robots` and `googlebot`
  meta tags in any letter case (`meta[name="robots" i]`), *every* such tag on the page (most
  restrictive wins, not the first), directives split on whitespace as well as commas, and the
  `X-Robots-Tag` response header, fetched in `resolveAsyncRules` via
  `src/lib/scrapers/getHeaderRobots.ts`. A failed header fetch leaves the DOM verdict untouched.
- **Title** comes from `<head>` only: an inline SVG `<title>` in the body is not a page title.
- **`<base href>`** is honoured when resolving canonical, icon and hreflang; `rel` is matched on the
  parsed token list, so `rel="canonical alternate"` and any casing work.
- **Duplicate `<title>` / `<link rel=canonical>`** counts ride on `PageMeta.duplicates`, because the
  dup-tags rule can only see `<meta>` elements.
- **`canonical`** — compares the canonical to the page URL (`src/lib/audit/url-match.ts`: fragment,
  trailing slash, scheme and host case ignored). A canonical pointing elsewhere warns rather than
  fails, because pagination and syndication use that legitimately.
- **`og:image-dimensions`** — async; measures the image, 5 s timeout.
- AEO rules live separately in `src/lib/audit/aeo.ts` and read `SiteFiles` (robots.txt groups,
  sitemaps, llms.txt).

Custom scoring is Pro-only: **all** scoring call sites read `effectiveSettings` (`cloud/plan.ts`),
never the raw `settings` store.

## 4. Storage keys (`chrome.storage.local`)

| Key | Module | Contents |
| --- | --- | --- |
| `history` | `src/lib/storage/history.ts` | Last 10 scans (url, hostname, title, score, timestamp). |
| `settings` | `src/lib/storage/settings.ts` | Thresholds + rule weights. |
| `pinnedKeys` | `src/lib/storage/pinned.ts` | Pinned meta-tag keys, lowercased. |
| `syncScope__<uid>` | `src/lib/cloud/workspaces.ts` | Chosen upload target, namespaced per user. |
| `theme` | `src/lib/theme.ts` | `light` \| `dark`; falls back to the system preference. |
| `mode` | `src/lib/mode.ts` | `sidepanel` \| `popup`. |

Every one of these re-hydrates on `chrome.storage.onChanged` (§1).

## 5. Cloud

- `cloud/auth.ts` — `chrome.identity` sign-in, exposes `cloudUser`.
- `cloud/plan.ts` — `users/{uid}.plan` → `cloudIsPro`, reset on **every** auth change; derives
  `effectiveSettings`. `APP_URL` is where upgrade and dashboard links point.
- `cloud/settings.ts` — two-way sync of audit settings with `users/{uid}/settings/audit`.
  `syncSettingsForUser` resets the store to defaults on every auth change *before* pulling, so one
  account's rules can never score, or overwrite, another's. Pushes are blocked until that user's
  own pull resolves.
- `cloud/sync.ts` — maps a scan to the web app's `ScanPayload`; deterministic doc id from the scan
  identity, so re-scanning a URL overwrites rather than duplicates.
- `cloud/workspaces.ts` — workspace scope for uploaded scans.

## 6. Permissions

`tabs`, `contextMenus`, `storage`, `sidePanel`, `scripting`, `identity`, plus host
permissions for all sites. Host access is what lets the extension read `robots.txt`, sitemaps,
`llms.txt` and the `X-Robots-Tag` header for the scanned origin. Adding a permission means
justifying it to a store reviewer — do not add one without an explicit decision recorded here.

## 7. Untrusted input from the audited site

Everything scraped belongs to someone else. URLs from robots.txt, sitemaps and llms.txt are rendered
through `safeHref` (`src/lib/util/safe-href.ts`) — non-http(s) schemes render as text, never as a
link inside the extension's own page. The scraped DOM is capped at 3 MB in the injected function
before it crosses the message channel, and CSV exports neutralise spreadsheet formula prefixes.

## 8. Message types

| Message | From → To | Response |
| --- | --- | --- |
| `getHTML` | popup/side panel → service worker | `{ html, url }`, or `{ html: null, url, reason: 'unscriptable' \| 'no-tab' }`. Always answers. |

## 10. Build and gates

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server. |
| `npm run build` | `vite build` then `node removeInlineScript.cjs` — the CSP fixer is part of the build; MV3 forbids inline scripts, `eval` and remote code. |
| `npm test` | Vitest, `src/**/*.spec.ts`. |
| `npm run check` | `svelte-check` against `tsconfig.json`. |
| `npm run gen-icons` | Regenerates `static/icons/` from the source icon. |

## 9. Site files

`getSiteFiles.ts` reads robots.txt, sitemaps and llms.txt for the scanned origin. It judges
robots.txt on its **content** (a `text/html` content type alone does not mean missing), reports a
body cut at the 2 MB cap as "too large to read here" rather than invalid, and bounds sitemap index
recursion with a fetch budget (`MAX_SITEMAP_FETCHES`) and a concurrency cap — an unbounded nested
index used to fire hundreds of requests and a popup-mode scan never finished syncing.

`uploadScan` merges and writes `starred`/`createdAt` only on first write, so re-scanning never
clears a star or re-dates a scan.

Release: bump `package.json` **and** `static/manifest.json` together, build, zip `build/` as
`metaspry-v<version>.zip`. Never delete previous zips without asking.
