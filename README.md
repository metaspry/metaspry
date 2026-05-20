# Metaspry

The free Chrome extension that audits **Open Graph**, **Twitter**, **robots.txt**, **sitemap.xml**, **llms.txt**, and **JSON-LD** on any page - in one click, locally, with no account.

> See exactly what Google, Twitter, LinkedIn, Discord, Slack, and iMessage see when they crawl your page.

[**Add to Chrome ->**](https://chromewebstore.google.com/detail/metagify/kibedpkbadcofhbcpfigjmjanmdkmaji)

Marketing site, docs, blog, roadmap: **[metaspry.com](https://metaspry.com)**

## What it does

Open any web page, click the toolbar icon, and the side panel shows four tabs:

- **Tags** - every `<meta>` element on the page, categorized (OG / Twitter / SEO / basic / other), searchable, copyable, and pinnable across pages.
- **Previews** - exact mockups for Facebook, Twitter (summary + summary_large_image), LinkedIn, Discord, Slack, Google SERP, and iMessage - rendered from the page's own tags with fallback chains documented.
- **Audit** - weighted 0-100 score across 12+ rules covering required, recommended, and best-practice meta-tag hygiene. Live image dimension checking included.
- **Site** - `robots.txt`, `sitemap.xml` (recursive sitemap-index expansion, 7 fallback paths), and `llms.txt` fetched and parsed from the page's host.

Local-first by design. Three HTTPS fetches per scan (`robots.txt`, `sitemap.xml`, `llms.txt`) issued from your browser to the page's own host. No telemetry, no analytics, no third-party calls.

Full docs: **[metaspry.com/docs](https://metaspry.com/docs/)**

## Tech stack

- [SvelteKit](https://kit.svelte.dev/) + `adapter-static`
- [Tailwind CSS v3](https://tailwindcss.com)
- [Vite](https://vitejs.dev)
- Manifest V3 (background service worker + side panel + content script)

## Local development

```bash
npm install
npm run dev          # vite dev server (for component preview)
npm run build        # production bundle -> build/
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
    +page.svelte            Main side-panel UI
    app.css
  lib/
    Component.svelte        Top-level component (orchestrates views)
    mode.ts                 Side-panel vs popup mode toggle
    theme.ts                Light / dark theme
    audit/
      rules.ts              Synchronous audit rules
      asyncRules.ts         Async rules (e.g. og:image dimensions)
      AuditResult.ts        Result + score types
    scrapers/
      getMetaTags.ts        Parse <meta> + <title> + <link>
      getJsonLd.ts          Parse application/ld+json
      getHreflang.ts        Parse hreflang alternates
      getRobots.ts          Parse robots meta
      getHTML.ts            Pull page HTML via chrome.scripting
      getSiteFiles.ts       Fetch robots.txt + sitemap.xml + llms.txt
      getWindow.ts          Browser window data
      PageMeta.ts           Type definitions
      SiteFiles.ts          Type definitions
    exporters/
      exporters.ts          JSON + CSV serializers
    storage/                chrome.storage abstraction (history, settings, prefs)
    components/             Reusable UI bits
    views/
      Extension.svelte      Side-panel root
    index.js                lib barrel
static/
  manifest.json             MV3 manifest
  favicon.png
  scripts/                  background.js, content.js (post-build)
```

## Manifest

Manifest V3, minimum Chrome 114. Permissions:

- `tabs` + `activeTab` + `scripting` - read the active page DOM.
- `sidePanel` - render the audit UI as a side panel.
- `storage` - local history, settings, pinned tags.
- `contextMenus` - right-click integrations.
- `host_permissions: ["*://*/*"]` - fetch `robots.txt`, `sitemap.xml`, `llms.txt` from the page's host.

## Privacy

Local-first. See [metaspry.com/docs/privacy](https://metaspry.com/docs/privacy/) for the full breakdown.

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

Reference copy + asset checklist for the [Developer Dashboard](https://chrome.google.com/webstore/devconsole/) submission. Paste these fields when publishing a new version.

### Identity

| Field | Value |
|---|---|
| **Name** | `Metaspry` (max 75 chars) |
| **Summary** | `One-click audit of OG, Twitter, robots, sitemap, JSON-LD - see what crawlers see.` (max 132 chars) |
| **Category** | Developer Tools |
| **Language** | English (United States) |

### Detailed description

> The one-click meta-tag analyzer for modern websites. See exactly what Google, Twitter, LinkedIn, Discord, Slack, and iMessage see when they crawl your page - locally, with no account, no telemetry.
>
> Open any page, click the toolbar icon, and the side panel shows:
>
> • TAGS - every <meta> element on the page, categorized into OG / Twitter / SEO / basic / other. Search, copy, and pin tags across pages.
>
> • PREVIEWS - exact mockups for Facebook, Twitter (summary + large image), LinkedIn, Discord, Slack, Google SERP, and iMessage. Rendered from the page's own tags, fallback chains documented.
>
> • AUDIT - weighted 0-100 score across 12+ rules covering required, recommended, and best-practice meta-tag hygiene. Includes live og:image dimension checking.
>
> • SITE - robots.txt, sitemap.xml (recursive sitemap-index expansion, 7 fallback paths), and llms.txt fetched and parsed from the page's host.
>
> WHY METASPRY
>
> - Free forever. No account, no signup, no card.
> - Local-first. Three HTTPS fetches per scan (robots / sitemap / llms) issued from your browser to the page's own host. No third-party calls.
> - Privacy-respecting. No telemetry, no analytics, no tracking.
> - Works offline (cached page meta).
> - Open roadmap. Vote on features at https://metaspry.com/roadmap
>
> Built for engineers, SEO specialists, content teams, and indie builders who care what crawlers actually see.
>
> Full docs: https://metaspry.com/docs
> Roadmap + changelog: https://metaspry.com/roadmap
> Blog: https://metaspry.com/blog
>
> Found a bug or have a feature request? https://github.com/metaspry/metaspry/issues

### Justification copy (Permissions)

The Chrome Web Store review form asks "why does the extension need this?" for each declared permission. Paste these into the matching fields.

| Permission | Justification |
|---|---|
| `activeTab` | Read the current tab's URL and HTML so we can extract the page's `<meta>` tags, `<title>`, and `<link rel="canonical">` for the audit. The user must click the toolbar icon to trigger this. |
| `tabs` | Look up the active tab's URL and title to label history entries and the side-panel header. No content of other tabs is read. |
| `scripting` | Inject a one-shot DOM scraper into the active tab to capture meta tags from the page the user is viewing. Required because `chrome.tabs.executeScript` was removed in MV3. |
| `sidePanel` | Render the audit UI as a side panel (the default surface). Users can switch to a popup in settings. |
| `storage` | Save scan history, settings (length thresholds, rule weights), pinned tags, and side-panel-vs-popup preference locally via `chrome.storage.local`. Nothing is synced or transmitted. |
| `contextMenus` | Add a right-click "Audit this page with Metaspry" entry to launch a scan from the page context. |
| `host_permissions: *://*/*` | Fetch `robots.txt`, `sitemap.xml`, and `llms.txt` from the same host as the page the user is auditing. Required because these files live at the host root, not necessarily the page URL. No cross-host fetches are made. |

### Single purpose

> Metaspry has one purpose: audit a web page's meta tags and crawler-facing signals (Open Graph, Twitter Card, robots.txt, sitemap.xml, llms.txt, JSON-LD) and show how those signals render in social previews. All features serve this single audit workflow.

### Privacy practices

| Question | Answer |
|---|---|
| Does the extension handle user data? | **Yes** - locally only. |
| Personally identifiable information? | No. |
| Health information? | No. |
| Financial / payment info? | No. |
| Authentication info? | No. |
| Personal communications? | No. |
| Location? | No. |
| Web history? | **Yes** - we store the user's own scan history (URL, title, score, timestamp) in `chrome.storage.local`. It never leaves the device. |
| Website content? | **Yes** - the page HTML / meta tags the user explicitly audits. Processed in-memory; only the derived audit score + URL is persisted to local history. |
| Remote code execution? | No. The bundle is fully local. `removeInlineScript.cjs` strips inline scripts post-build for MV3 CSP compliance. |
| Data shared with third parties? | **No.** |
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
| Small promo tile | 440 × 280 px, PNG | ✔ | Create from website hero |
| Marquee promo tile | 1400 × 560 px, PNG | optional but boosts placement | Create from website hero |
| Screenshots | 1280 × 800 px **or** 640 × 400 px, PNG, 1-5 images | ✔ (at least 1) | See list below |

Suggested screenshots (in order):

1. **Audit tab** - the 0-100 score with rule list. Use `example.com` or `vercel.com`.
2. **Previews tab** - Twitter / Facebook / LinkedIn / iMessage mockups side-by-side.
3. **Tags tab** - filtered to `og:` with the search input populated.
4. **Site tab** - robots.txt + sitemap-index expanded.
5. **Compare tab** - two scans side-by-side.

### Version bump checklist (every release)

1. Bump `version` in `static/manifest.json` (semver).
2. `npm run build` and load `build/` as unpacked. Smoke-test all four tabs.
3. Zip the contents of `build/` (not the folder itself).
4. Upload zip in Developer Dashboard → Package → "Upload new package".
5. Update screenshots only if UI changed.
6. Submit for review. Typical turnaround: 1-3 business days.
7. After approval, tag the commit `vX.Y.Z` and push.
