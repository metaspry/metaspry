# Chrome Web Store - resubmit after Yellow Argon rejection (round 2)

## The rejection (round 2 - 2026-05-22)

Item: Metaspry (`kibedpkbadcofhbcpfigjmjanmdkmaji`)
Violation reference: **Yellow Argon - Keyword Spam**
Cited content:

> "Facebook, X (formerly Twitter), LinkedIn, Discord, Slack, Google search results, and iMessage."

Round 1 fix (single-enumeration PREVIEWS bullet) was **also rejected**. Reviewer is treating any 7-platform enumeration as keyword stuffing, regardless of repetition count. The fallback plan from the prior round (line 107 below) is now the required path: **drop platform names from the description entirely**.

## Round-1 history (context)

First rejection cited the description listing each platform twice (intro + PREVIEWS bullet). Round-1 fix collapsed to a single enumeration. That was still over the threshold.

## Round-2 fix - platform-free description (copy-paste ready)

Zero platform brand names. PREVIEWS bullet describes the feature generically and points to metaspry.com for the platform list (no Chrome Store keyword filter on your own site).

> The one-click meta-tag analyzer for modern websites. See how your page renders across major social and search platforms - locally, with no account, no telemetry.
>
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

## Prerequisite - publish the platform list page on metaspry.com

The PREVIEWS bullet now points to `metaspry.com/docs/previews`. That page MUST exist before resubmit, otherwise the link is a broken claim. Verify or create it.

## Other listing fields - verify before resubmit

The keyword-spam check sweeps the **entire listing**, not just the description. Before resubmitting, audit these for repeated brand-name pile-up:

| Field | Action |
|---|---|
| **Name** | "Metaspry" - fine, no change. |
| **Summary (132 chars)** | Replace with: `One-click meta-tag audit and social preview for any page. Free, local-first, no telemetry.` (95 chars). Do NOT enumerate platforms here. |
| **Category** | Developer Tools - unchanged. |
| **Promotional images** | Make sure any text overlays on promo tiles don't repeat platform names. The current `promo-small-440x280.png` and `promo-marquee-1400x560.png` are pattern-decoration only - no platform text. Safe. |
| **Screenshots (5)** | Captions added at upload time. **DO NOT** repeat platforms across captions. Suggested set: |

### Screenshot captions (one platform list at most, spread across distinct features)

| File | Caption |
|---|---|
| 01-audit.png | Weighted audit score with per-rule severity and plain-English fixes. |
| 02-previews.png | How your page looks across major social platforms - rendered from the page's own tags. |
| 03-tags.png | Every meta element categorized, searchable, and pinnable across pages. |
| 04-site.png | robots.txt, sitemap.xml, and llms.txt parsed automatically from the page's host. |
| 05-compare.png | Side-by-side comparison of two scans. |

Note: avoid listing platform names ("Facebook", "X", "LinkedIn", etc.) in captions. The audit covers them - let the screenshot do the visual work.

## Resubmit steps

1. **Rebuild + repack** - `npm run build` then zip the `build/` directory as `metaspry-v1.0.5.zip`. The manifest `description` field was also a keyword-spam vector (round-2 fix below).
2. Open https://chrome.google.com/webstore/devconsole/
3. Select **Metaspry** (`kibedpkbadcofhbcpfigjmjanmdkmaji`)
4. **Package** tab: upload `metaspry-v1.0.5.zip`.
5. **Store listing** tab:
   - Replace the **Detailed description** with the block above.
   - Replace the **Short summary (132)** with the 95-char version above.
   - Verify screenshot captions per the table above. Re-upload any that repeat platforms.
6. Save draft. Verify the description renders the same line breaks you pasted.
7. **Submit for review.**

## Manifest description fix (round 2)

The `description` field in `static/manifest.json` is also scanned by Chrome's keyword-spam filter. Round-1 manifest had:

> "See exactly what Google, Twitter, LinkedIn, and Slack see when they crawl your page. Audit OG, Twitter, robots, sitemap, JSON-LD."

Replaced with platform-free version (under 132 chars):

> "One-click meta-tag audit and social preview for any page. Local-first, no account, no telemetry. OG, robots, sitemap, JSON-LD."

`package.json` and `static/manifest.json` version bumped 1.0.4 → 1.0.5.

## Prior 1.0.3 → 1.0.4 changes (carried forward in 1.0.5)

- Removed the empty `<all_urls>` content_script declaration from the manifest (granted broad scope for zero functionality).
- Removed `static/scripts/content.js` (was 0-byte stub).
- Switched `getHTML.ts` from `innerHTML` on a disconnected node to `DOMParser.parseFromString` (functionally equivalent, optically cleaner for security review).
- Extended keyboard tab shortcut to cover tab 5 (Compare) - was 1-4 only.
- Synced `package.json` version (was stuck at 0.0.1).
- Deleted dead `getWindow.ts` (referenced a `chrome.runtime.sendMessage('getWindow')` the background never handled).
- Added MIT LICENSE (was missing - README implied open source but license file absent).
- Reworded "three HTTPS fetches per scan" → honest "robots, sitemap (up to 7 paths + recursive index, capped 20 children / depth 2), llms.txt; plus user-triggered Compare and og:image image load."
- Reworded "no cross-host fetches" → "same-host by default; cross-host only on Compare or off-host og:image."

Expected review turnaround: 1-3 business days.

## What to do if round-2 also gets rejected

If even the platform-free description gets flagged:

- Audit the **Summary** field - confirm it does not mention any platform.
- Audit **screenshot captions** - re-upload any caption that mentions a platform brand.
- Audit **promo tile text overlays** for platform brand names.
- File an appeal at this point - the description is now generic; further rejection would be a reviewer error.

## Future-proofing

Chrome Web Store now actively enforces keyword spam on every metadata field. New rules for any future revision:

1. Each external brand or platform name appears **at most once** per field.
2. No repetition across description ↔ summary ↔ screenshot captions.
3. If you need to enumerate platforms more than once, do it **on metaspry.com** (no platform-level enforcement on your own site) and link there from the description.
4. Resist the urge to "SEO-pack" the listing - Chrome Web Store ranks by installs + ratings + recency, not by keyword density. There's no upside.
