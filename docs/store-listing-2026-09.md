# Chrome Web Store listing — proposed revision, 2026-09-21

Paste-ready copy for the rename recommended in `app/docs/GROWTH-PLAN-2026-09-21.md` §1.1, written to
survive the **Yellow Argon (Keyword Spam)** filter that rejected this listing twice in May 2026.
Read `chrome-store-resubmit.md` first — it is the record of what got us rejected and what finally
passed.

## The rule this copy follows

The two rejections cited an **enumeration of platform brand names** repeated across fields. They did
not cite generic category words. Four of the five top results for "meta tags" are titled *Meta Tags
Pro*, *SEO META in 1 CLICK*, *Meta Tag Analyzer* and *META SEO inspector* — all carry the category in
the name, all are Featured.

So:

1. **No platform brand name in any field.** Not once. The description that passed review has none,
   and we are not reopening that.
2. **Generic category terms appear once per field**, and no term repeats across name and summary.
3. **Change as little as possible.** Every sentence you edit is a sentence the reviewer re-reads.

---

## Name

**Current:** `Metaspry` — 8 characters of a 75-character budget, containing none of the words a buyer
types.

**Proposed:**

```
Metaspry — Meta Tag & Open Graph Audit
```

38 characters. Brand first (so the brand still earns recall), then two category terms, each once.
"Open Graph" is the deliberate pick: the research found "open graph" and "aeo" to be thin, low-rated,
winnable fields, while "seo" and "meta tags" are not winnable near-term.

**If you want to be more conservative:** `Metaspry — Meta Tag Analyzer` (28 chars) drops "Open
Graph". It is safer and gives up the one term we might actually rank for. I would not.

**If you want to be more aggressive:** `Meta Tag Analyzer & Open Graph Preview — Metaspry` leads with
the query, which is the segment convention. It carries no brand names, so Yellow Argon risk is still
low — but it buries our own name, and with 21 installs brand recall is not something to spend.

---

## Summary (132 character limit)

**Current:** `One-click meta-tag audit and social preview for any page. Free, local-first, no telemetry.`
— accurate, but it opens with the mechanism.

**Proposed:**

```
Find out why your link looks wrong when it's shared — before you publish. Free, no account, nothing leaves your browser.
```

120 characters. Leads with the problem the user actually has. Repeats nothing from the name, names no
platform, and every claim in it is literally true of the shipped extension.

---

## Detailed description

**Change the opening paragraph only. Keep everything from "Open any page" onward byte-identical to
the version that passed review in May.**

Replace the current first line:

> The one-click meta-tag analyzer for modern websites. See how your page renders across major social
> and search platforms - locally, with no account, no telemetry.

with:

> You paste a link into a chat and the preview is blank, or shows last year's title. Metaspry tells
> you why, in one click, before anyone else sees it - locally, with no account and no telemetry.

Then, unchanged:

> Open any page, click the toolbar icon, and the side panel shows:
>
> • TAGS - every <meta> element on the page, categorized for quick scanning. Search, copy, and pin tags across pages.
>
> • PREVIEWS - exact mockups of how your share card renders on the major social and search platforms. Rendered from the page's own tags, with documented fallback chains. Full platform list at metaspry.com/docs/previews.
>
> • AUDIT - weighted 0-100 score across 12+ rules covering required, recommended, and best-practice meta-tag hygiene. Includes live image dimension checking.
>
> • SITE - robots.txt, sitemap.xml (recursive sitemap-index expansion, 7 fallback paths), and llms.txt fetched and parsed from the page's host.
>
> WHY METASPRY
>
> - Free forever. No account, no signup, no card.
> - Local-first. The audit, parsing, and previews all run inside your browser. The only network calls are reading the site files of the page you audit (robots, sitemap, llms.txt). No first-party servers.
> - Privacy-respecting. No telemetry, no analytics, no tracking.
> - Works offline once a page is cached.
> - Open roadmap on metaspry.com.
>
> Built for engineers, SEO specialists, content teams, and indie builders.
>
> Docs and roadmap: https://metaspry.com
> Bug reports: https://github.com/metaspry/metaspry/issues

**Note:** the PREVIEWS bullet links to `metaspry.com/docs/previews`. That page exists
(`metaspry-website/src/pages/docs/previews.mdx`, verified 2026-09-21), so the link is not a broken
claim.

---

## manifest.json description

`static/manifest.json` is scanned by the same filter. Current value:

```
One-click meta-tag audit & social preview — OG, Twitter, robots, sitemap, JSON-LD. Optional sign-in syncs scans to your account.
```

It contains one platform brand name ("Twitter"), used once, which is within the rule — but the store
listing no longer names any platform, and consistency costs nothing. Proposed:

```
One-click meta-tag and Open Graph audit with social previews. Local-first, no account. Optional sign-in syncs your scans.
```

121 characters, against a 132 limit — the version that keeps the old wording lands on exactly 132, with no margin. If you change this, it ships with the version upload (§6 of the runbook), not with
the listing edit (§7) — keep the two submissions separable.

---

## Screenshot captions

Unchanged from `chrome-store-resubmit.md`. They already contain no platform names:

| File | Caption |
|---|---|
| 01-audit.png | Weighted audit score with per-rule severity and plain-English fixes. |
| 02-previews.png | How your page looks across major social platforms - rendered from the page's own tags. |
| 03-tags.png | Every meta element categorized, searchable, and pinnable across pages. |
| 04-site.png | robots.txt, sitemap.xml, and llms.txt parsed automatically from the page's host. |
| 05-compare.png | Side-by-side comparison of two scans. |

---

## Yellow Argon self-audit

Run this before submitting. It is the check that would have caught both previous rejections.

| Field | Platform brand names | Repeated terms |
|---|---|---|
| Name | none | — |
| Summary | none | shares no term with the name |
| Description | none | "meta" appears in distinct compounds, not as a stuffed repeat |
| manifest description | none (after the change above) | — |
| Screenshot captions | none | each caption describes a different feature |
| Promo tiles | pattern decoration, no text | — |

If any cell above becomes non-empty, fix it before submitting rather than arguing it afterwards. We
carry two strikes on this exact policy.

---

## Featured nomination

Submit at <https://support.google.com/chrome_webstore/contact/one_stop_support>, item ID
`kibedpkbadcofhbcpfigjmjanmdkmaji`. Suggested free-text — it argues the criteria Google actually
publishes (policy adherence, best practices, works without credentials), not a feature list:

> Metaspry is a meta-tag and Open Graph auditor that runs entirely in the browser. Every core
> feature — the tag inspector, the social preview rendering, the weighted 0-100 audit, and the
> robots.txt/sitemap.xml parsing — works with no account, no payment and no credentials of any kind.
> Sign-in exists only to sync scan history and is strictly optional.
>
> The extension collects no telemetry and no analytics of any kind. Its network requests are limited
> to the site files of the page being audited (robots.txt, sitemap.xml, llms.txt) — plus the user's
> own account, and only if they choose to sign in.
>
> It follows the Chrome extension best-practice guidelines: side panel UI, Manifest V3, no remote
> code, no background persistence, full keyboard navigation, and a documented single purpose.

Keep it factual. Every sentence above is verifiable by installing the extension, which is what a
reviewer would do.

### Check this before nominating — our permissions are broad

The first draft of the text above claimed "permissions are limited to activeTab and storage". That is
**false**, and a reviewer would have caught it. `static/manifest.json` actually declares:

```json
"permissions": ["tabs", "activeTab", "contextMenus", "storage", "sidePanel", "scripting", "identity"],
"host_permissions": ["*://*/*"]
```

`*://*/*` as a **required** host permission is the strongest access a Chrome extension can ask for,
and it is granted at install time with a scary consent screen. The audit genuinely needs host access
to fetch robots.txt, sitemap.xml and llms.txt from the page's own host — but it does not need it on
every site before the user has ever clicked anything.

**Worth doing before nominating:** move `*://*/*` to `optional_host_permissions` and request it at
first scan, and drop any of `tabs` / `contextMenus` / `identity` that a feature inventory shows is
unused. That is a code change and needs an OpenSpec, but it cuts the install-time consent screen,
removes the single most common reason a Featured nomination is declined, and makes the privacy claim
in the listing match the manifest rather than merely being compatible with it.

Do not write a permissions claim into the nomination until the manifest has been read that day.

---

## What not to change

- **The store URL slug** (`/detail/metagify/…`). A published item's ID cannot be changed; the only
  fix is a new listing, which resets 21 installs and 3 ratings to zero. Leave it.
- **The category.** `chrome-store-resubmit.md` records Developer Tools; the funnel audit on
  2026-09-21 read it as Tools/Productivity from the live listing. Check which it actually is before
  touching anything — but do not change it during the same submission as the rename, or a rejection
  becomes untraceable.
