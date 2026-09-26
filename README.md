# Metaspry

The free Chrome extension that scans the page you are on: every meta tag, social share previews, a weighted 0-100 score across 19 rules, `robots.txt` / `sitemap.xml` / `llms.txt`, JSON-LD and an AI-readiness checklist - in one click. No account needed. Sign in (optional) to save your scans to the Metaspry web app.

[**Add to Chrome ->**](https://metaspry.com)

Marketing site, docs, blog, roadmap: **[metaspry.com](https://metaspry.com)**

## What it does

Open any web page, click the toolbar icon and **Scan this page**. The side panel shows six tabs:

- **Tags** - every `<meta>` element on the page, categorized (Open Graph / Twitter / SEO / basic / other), searchable, copyable, pinnable across pages, and exportable as JSON or CSV.
- **Previews** - share-card mockups for the major social platforms, messaging apps and the search results page, rendered from the page's own tags with documented fallback chains.
- **Audit** - a weighted 0-100 score across 19 rules (required, recommended, best practice), including a live `og:image` dimension check and the `X-Robots-Tag` header. Signed in, a re-scan of a URL you scanned before shows **Last scan** with an **Open what changed** link into the web app's compare view.
- **Site** - `robots.txt`, `sitemap.xml` (sitemap-index expansion, 7 fallback paths) and `llms.txt`, fetched and parsed from the page's host.
- **AI** - AI-readiness checks: indexability, headings, structured data, author and date, AI crawler access in `robots.txt`, `llms.txt`.
- **Compare** - the current page against any URL you type, tag by tag, with both scores.

Keyboard: `1`-`6` switch tabs, `/` focuses the tag search, `r` re-scans, `?` shows the shortcuts. Single-key shortcuts can be turned off in **Settings > Preferences**, which is also where you choose the surface (side panel or popup).

Local-first by design. Outbound fetches per scan: `robots.txt`, `llms.txt`, up to 7 sitemap fallback paths and sitemap-index children (capped at 20 per level, depth 2) - all to the page's own host - plus one request for the page itself to read its `X-Robots-Tag` header. The Compare tab fetches the URL you type, and the `og:image` rule loads the page's declared share image to measure it. No telemetry, no analytics.

### Optional cloud sync

Signing in (same account as [app.metaspry.com](https://app.metaspry.com), email and password or Google) uploads each scan to your account or to a team workspace you choose in the account menu. Re-scanning a URL replaces that URL's entry. On the Free plan the web app lists your 10 most recent cloud scans; Pro lists your 50 most recent and keeps up to 20 earlier versions of a page when it changes, so you can compare them. The extension works fully without an account.

Full docs: **[metaspry.com/docs](https://metaspry.com/docs/)**

## Tech stack

- [SvelteKit](https://kit.svelte.dev/) + `adapter-static`, Svelte 4
- [Tailwind CSS v3](https://tailwindcss.com)
- [Vite](https://vitejs.dev), [Vitest](https://vitest.dev)
- Firebase Auth + Firestore (optional sign-in and sync)
- Manifest V3: background service worker + side panel / popup. No content scripts; the page HTML is read with a one-shot `chrome.scripting` injection when you scan.

## Local development

```bash
npm install
npm run dev          # vite dev server (layout work only: no chrome.* APIs, scanning is inert)
npm run build        # production bundle -> build/
npm test             # Vitest
npm run check        # svelte-check
npm run watch-src    # rebuild on Svelte file change
```

### Load as an unpacked extension

1. Run `npm run build`.
2. Open `chrome://extensions/` in Chrome.
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select the `build/` directory in this repo.

The extension shows up as **Metaspry**. Pin it to your toolbar, then click the icon to open the side panel.

## Project layout

```
src/
  app.html
  routes/
    +page.svelte            Root: initialises stores and shortcuts, mounts Extension
    app.css                 Tailwind entry, muted token, tooltip, forced-colors focus
  lib/
    views/Extension.svelte  Orchestrator: views, tabs, the scan pipeline
    components/             One folder per UI feature (Audit, Previews, Site, Aeo, Compare, ...)
    audit/                  rules.ts (19 rules), asyncRules.ts, aeo.ts, band.ts
    scrapers/               getHTML, getMetaTags, getSiteFiles, ... (parse the scanned page)
    cloud/                  Firebase auth, plan, settings sync, scan upload, workspaces
    storage/                chrome.storage.local stores (history, settings, pinned, shortcuts)
    actions/                use:tooltip, use:popover
    exporters/              JSON + CSV serializers
static/
  manifest.json             MV3 manifest
  scripts/background.js     Service worker (not bundled)
```

`AGENTS.md` is the full feature map.

## Manifest

Manifest V3, minimum Chrome 114. Permissions:

- `tabs` + `scripting` - read the active page's HTML when you scan it.
- `sidePanel` - render the UI as a side panel.
- `storage` - local history, settings, pinned tags, preferences.
- `contextMenus` - one "Spy this page with Metaspry" entry.
- `identity` - Google sign-in (optional).
- `host_permissions: ["*://*/*"]` - fetch `robots.txt`, `sitemap.xml`, `llms.txt` from the page's host, and the Compare URL.

## Privacy

Local-first; optional sign-in uploads scans to your own Metaspry account. See [metaspry.com/docs/privacy](https://metaspry.com/docs/privacy/) for the full breakdown.

## Roadmap

Public roadmap: **[metaspry.com/roadmap](https://metaspry.com/roadmap/)**

Issues live in this repo. Vote with a thumbs-up to bump priority. Labels:

- `roadmap:now | next | later | shipped`
- `area:extension | website | pro | infra`
- `type:feature | bug | chore | docs`

## Contributing

Bug reports and feature requests: [open an issue](https://github.com/metaspry/metaspry/issues/new/choose).

Questions or partnership pitches: [hello@metaspry.com](mailto:hello@metaspry.com).

---

## Chrome Web Store listing

Reference copy + asset checklist for the [Developer Dashboard](https://chrome.google.com/webstore/devconsole/) submission. Paste these fields when publishing a new version. Rules that keep it past the keyword-spam filter ("Yellow Argon", rejected twice in May 2026): **no platform brand names in any field**, each generic term once per field. See [`docs/chrome-store-resubmit.md`](docs/chrome-store-resubmit.md) and the rename proposal in [`docs/store-listing-2026-09.md`](docs/store-listing-2026-09.md).

### Identity

| Field | Value |
|---|---|
| **Name** | `Metaspry` (max 75 chars; rename proposal in `docs/store-listing-2026-09.md`) |
| **Summary** | `Scan any page's meta tags and social previews, scored 0-100 in one click. Free, no account needed.` (max 132 chars) |
| **Category** | Developer Tools |
| **Language** | English (United States) |

### Detailed description

> Updated 2026-09-26 for v1.0.27 (1.0.26 was built but never submitted - its changes ship in 1.0.27): six tabs, 19 rules, honest cloud wording, "scan" vocabulary. Still names no platform.

> The one-click meta-tag scanner for modern websites. See how your page renders across the major social and search platforms - locally, with no account and no telemetry.
>
> Open any page, click the toolbar icon, choose "Scan this page", and the side panel shows six tabs:
>
> • TAGS - every <meta> element on the page, categorized for quick scanning. Search, copy, pin tags across pages, export JSON or CSV.
>
> • PREVIEWS - mockups of how your share card renders on the major social and search platforms, built from the page's own tags with documented fallback chains. Full list at metaspry.com/docs/previews.
>
> • AUDIT - a weighted 0-100 score across 19 rules covering required, recommended and best-practice meta-tag hygiene, including live image dimension checking and the X-Robots-Tag header.
>
> • SITE - robots.txt, sitemap.xml (sitemap-index expansion, 7 fallback paths) and llms.txt, fetched and parsed from the page's host.
>
> • AI - AI-readiness checks: indexability, headings, structured data, author and date, AI crawler access, llms.txt.
>
> • COMPARE - the current page against any URL, tag by tag, with both scores.
>
> Keyboard shortcuts 1-6, /, r and ? (single-key shortcuts can be turned off in Settings > Preferences, where you also pick side panel or popup).
>
> WHY METASPRY
>
> - Free. Every tab works with no account, no signup and no card.
> - Local-first. Parsing, the audit and the previews run inside your browser. The only network calls are the site files of the page you scan (robots.txt, sitemap, llms.txt), the page itself and its share image, and a URL you choose to compare.
> - Optional sign-in saves your scans to your Metaspry account (same login as the web app). Free lists your 10 most recent cloud scans; Pro lists 50 and keeps up to 20 earlier versions of a page when it changes. A re-scan shows when you last scanned the page, with a link to what changed.
> - No telemetry, no analytics, no tracking.
> - Open roadmap on metaspry.com.
>
> Built for engineers, SEO specialists, content teams and indie builders.
>
> Docs and roadmap: https://metaspry.com
> Bug reports: https://github.com/metaspry/metaspry/issues

### Justification copy (Permissions)

The Chrome Web Store review form asks "why does the extension need this?" for each declared permission. Paste these into the matching fields. Read `static/manifest.json` the day you submit; this table matches v1.0.26.

| Permission | Justification |
|---|---|
| `tabs` | Look up the active tab's URL and favicon so the scan and its history entry name the page the user scanned. No content of other tabs is read. |
| `scripting` | When the user clicks "Scan this page", inject a one-shot function into the active tab that returns the page's HTML, from which the extension reads the `<meta>` tags, `<title>` and `<link rel="canonical">`. Nothing is injected until the user asks. |
| `sidePanel` | Render the UI as a side panel (the default surface). Users can switch to a popup in Settings > Preferences. |
| `storage` | Save scan history, scoring settings, pinned tags, the side-panel-vs-popup and keyboard-shortcut preferences locally via `chrome.storage.local`. |
| `contextMenus` | Add a single "Spy this page with Metaspry" entry to the right-click menu, which opens the extension's side panel (or popup, per the user's preference). Only one top-level item; no other menu entries are read or changed. |
| `identity` | Optional Google sign-in through `chrome.identity.launchWebAuthFlow`, so a user can save scans to their Metaspry account. Unused unless the user chooses "Continue with Google". |
| `host_permissions: *://*/*` | Fetch `robots.txt`, `sitemap.xml` and `llms.txt` from the host of the page the user scans (these live at the host root), and the page itself to read its `X-Robots-Tag` header. Cross-host fetches happen only when the user uses the **Compare** tab or when the scanned page declares an off-host `og:image` (loaded to measure its dimensions). |

### Single purpose

> Metaspry has one purpose: scan a web page's meta tags and crawler-facing signals (Open Graph, Twitter Card, robots.txt, sitemap.xml, llms.txt, JSON-LD) and show how those signals render in social previews. Optional sign-in saves those scans to the user's account. All features serve this single scan workflow.

### Privacy practices

| Question | Answer |
|---|---|
| Does the extension handle user data? | **Yes.** |
| Personally identifiable information? | **Yes, only when the user signs in:** the account email, handled by Firebase Authentication. |
| Health information? | No. |
| Financial / payment info? | No (billing happens on the web app, not in the extension). |
| Authentication info? | **Yes, only when the user signs in:** the sign-in session (Firebase Authentication, stored in the extension's IndexedDB). Passwords are sent to Firebase Authentication and never stored by the extension. |
| Personal communications? | No. |
| Location? | No. |
| Web history? | **Yes** - the user's own scan history (URL, title, score, timestamp, favicon URL) in `chrome.storage.local`. When signed in, each scan is also saved to the user's Metaspry account. |
| Website content? | **Yes** - the meta tags of the page the user explicitly scans. Processed in memory; the scan result (tags, audit, site-file summary) is saved to the user's account only when signed in. |
| Remote code execution? | No. The bundle is fully local. `removeInlineScript.cjs` strips inline scripts post-build for MV3 CSP compliance. |
| Data shared with third parties? | **No.** Firebase (Google Cloud) stores signed-in users' data as Metaspry's service provider. |
| Data sold? | **No.** |

### Required certifications

- ☑ I do not sell or transfer user data to third parties.
- ☑ I do not use or transfer user data for purposes unrelated to the extension's single purpose.
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes.

### Distribution

- **Visibility:** Public
- **Geography:** All regions
- **Pricing:** Free
- **Mature content:** No
- **Privacy policy URL:** `https://metaspry.com/docs/privacy/`
- **Homepage URL:** `https://metaspry.com`
- **Support email:** `hello@metaspry.com`
- **Support site URL:** `https://metaspry.com/docs/` (or GitHub issues)

### Assets checklist

Chrome Web Store requires PNG only. JPEG / SVG / WebP are rejected.

| Asset | Spec | Required | Source |
|---|---|---|---|
| Store icon | 128 × 128 px, PNG | ✔ | `static/icons/icon-128.png` |
| Small promo tile | 440 × 280 px, PNG | ✔ | `promo/promo-small-440x280.png` |
| Marquee promo tile | 1400 × 560 px, PNG | optional but boosts placement | `promo/promo-marquee-1400x560.png` |
| Screenshots | 1280 × 800 px **or** 640 × 400 px, PNG, 1-5 images | ✔ (at least 1) | See list below |

Suggested screenshots (in order). The new landing (v1.0.26 + 1.0.27) ("Scan this page's meta tags") changed the first frame, so refresh them with this release:

1. **Audit tab** - the 0-100 score with the rule list (and the "Last scan" row when signed in).
2. **Previews tab** - share-card mockups.
3. **Tags tab** - filtered to `og:` with the search input populated.
4. **Site tab** - robots.txt + sitemap-index expanded.
5. **Compare tab** - two pages side by side.

Full capture runbook in [`docs/store-screenshots.md`](docs/store-screenshots.md). It walks through Chrome window sizing, side-panel framing, what to show per tab, and how to normalize raw snips to exact 1280x800 PNG via `scripts/process-screenshots.mjs`.

```powershell
# After saving raw captures into promo/raw-screenshots/
node scripts/process-screenshots.mjs
# -> promo/screenshot-01.png ... screenshot-05.png  (1280x800, 24-bit, no alpha)
```

### Version bump checklist (every release)

1. Bump `version` in `static/manifest.json` **and** `package.json` (semver; they must match).
2. `npm test`, `npm run check`, `npm run build`, then load `build/` as unpacked. Smoke-test all six tabs, both surfaces, sign-in, and one scan on a `chrome://` page (the error card).
3. Zip the contents of `build/` (not the folder itself) to `metaspry-v<version>.zip`; keep every earlier zip.
4. Upload zip in Developer Dashboard → Package → "Upload new package".
5. Update screenshots if the UI changed.
6. Submit for review. Typical turnaround: 1-3 business days.
7. After approval, tag the commit `vX.Y.Z` and push.
