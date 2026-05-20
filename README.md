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
