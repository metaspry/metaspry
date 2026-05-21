# Chrome Web Store — resubmit after Yellow Argon rejection

## The rejection

Item: Metaspry (`kibedpkbadcofhbcpfigjmjanmdkmaji`)
Violation reference: **Yellow Argon — Keyword Spam**
Cited content:

> "Facebook, Twitter (summary + large image), LinkedIn, Discord, Slack, Google SERP, and iMessage. Facebook, Twitter (summary + large image), LinkedIn, Discord, Slack, Google SERP, and iMessage"

The reviewer joined two near-identical platform enumerations from different paragraphs of the description and flagged the combined text as keyword stuffing. Specifically:

- Intro paragraph: "See exactly what Google, Twitter, LinkedIn, Discord, Slack, and iMessage see..."
- PREVIEWS bullet: "exact mockups for Facebook, Twitter (summary + large image), LinkedIn, Discord, Slack, Google SERP, and iMessage..."

Each platform name appeared 2x in the listing, totaling ~12 brand-name repetitions. That's the trigger.

## Appeal vs resubmit — pick resubmit

| Option | Pros | Cons |
|---|---|---|
| Appeal | Faster if reviewer mis-flagged. Free. | They didn't mis-flag — the description literally enumerated platforms twice. Likely-denied appeal. |
| **Resubmit** | Fixes the actual issue, low review cycle time. | Need to wait the normal review queue. |

Recommendation: **resubmit with the cleaned description below**. Skip the appeal.

## New description (copy-paste ready)

Each platform name appears at most once. Intro uses generic "social platforms and search engines" language. PREVIEWS bullet enumerates each platform exactly once, naturally phrased. WHY METASPRY no longer mentions platforms.

> The one-click meta-tag analyzer for modern websites. See how social platforms and search engines will render your page - locally, with no account, no telemetry.
>
> Open any page, click the toolbar icon, and the side panel shows:
>
> • TAGS - every <meta> element on the page, categorized for quick scanning. Search, copy, and pin tags across pages.
>
> • PREVIEWS - exact mockups of how your share card looks on Facebook, X (formerly Twitter), LinkedIn, Discord, Slack, Google search results, and iMessage. Rendered from the page's own tags, with documented fallback chains.
>
> • AUDIT - weighted 0-100 score across 12+ rules covering required, recommended, and best-practice meta-tag hygiene. Includes live image dimension checking.
>
> • SITE - robots.txt, sitemap.xml (recursive sitemap-index expansion, 7 fallback paths), and llms.txt fetched and parsed from the page's host.
>
> WHY METASPRY
>
> - Free forever. No account, no signup, no card.
> - Local-first. Three HTTPS fetches per scan (the three site files above) issued from your browser to the page's own host. No third-party calls.
> - Privacy-respecting. No telemetry, no analytics, no tracking.
> - Works offline once a page is cached.
> - Open roadmap on metaspry.com.
>
> Built for engineers, SEO specialists, content teams, and indie builders.
>
> Docs and roadmap: https://metaspry.com
> Bug reports: https://github.com/metaspry/metaspry/issues

## Other listing fields — verify before resubmit

The keyword-spam check sweeps the **entire listing**, not just the description. Before resubmitting, audit these for repeated brand-name pile-up:

| Field | Action |
|---|---|
| **Name** | "Metaspry" — fine, no change. |
| **Summary (132 chars)** | Replace with: `One-click meta-tag audit and social preview for any page. Free, local-first, no telemetry.` (95 chars). Do NOT enumerate platforms here. |
| **Category** | Developer Tools — unchanged. |
| **Promotional images** | Make sure any text overlays on promo tiles don't repeat platform names. The current `promo-small-440x280.png` and `promo-marquee-1400x560.png` are pattern-decoration only — no platform text. Safe. |
| **Screenshots (5)** | Captions added at upload time. **DO NOT** repeat platforms across captions. Suggested set: |

### Screenshot captions (one platform list at most, spread across distinct features)

| File | Caption |
|---|---|
| 01-audit.png | Weighted audit score with per-rule severity and plain-English fixes. |
| 02-previews.png | How your page looks across major social platforms — rendered from the page's own tags. |
| 03-tags.png | Every meta element categorized, searchable, and pinnable across pages. |
| 04-site.png | robots.txt, sitemap.xml, and llms.txt parsed automatically from the page's host. |
| 05-compare.png | Side-by-side comparison of two scans. |

Note: avoid listing platform names ("Facebook", "X", "LinkedIn", etc.) in captions. The audit covers them — let the screenshot do the visual work.

## Resubmit steps

1. Open https://chrome.google.com/webstore/devconsole/
2. Select **Metaspry** (`kibedpkbadcofhbcpfigjmjanmdkmaji`)
3. **Store listing** tab:
   - Replace the **Detailed description** with the block above.
   - Replace the **Short summary (132)** with the 95-char version above.
   - Verify screenshot captions per the table above. Re-upload any that repeat platforms.
4. Save draft. Verify the description renders the same line breaks you pasted.
5. **Submit for review.**

Build / package itself is unchanged. No need to bump manifest version (still 1.0.3).

Expected review turnaround: 1-3 business days.

## What to do if the resubmit also gets rejected

Possibility: reviewer flags any platform enumeration even at the new count. If that happens:

- Drop platform names entirely from the description. Replace the PREVIEWS bullet with: "PREVIEWS - exact mockups of how your share card renders on the major social and search platforms. All seven supported platforms documented at metaspry.com/docs/previews."
- That keeps the feature claim, moves the enumeration to docs (where the keyword filter doesn't run).
- Re-resubmit.

## Future-proofing

Chrome Web Store now actively enforces keyword spam on every metadata field. New rules for any future revision:

1. Each external brand or platform name appears **at most once** per field.
2. No repetition across description ↔ summary ↔ screenshot captions.
3. If you need to enumerate platforms more than once, do it **on metaspry.com** (no platform-level enforcement on your own site) and link there from the description.
4. Resist the urge to "SEO-pack" the listing — Chrome Web Store ranks by installs + ratings + recency, not by keyword density. There's no upside.
