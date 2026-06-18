# Chrome Web Store screenshots - capture runbook

Goal: 5 real workflow screenshots of Metaspry auditing **coograph.com**, each saved as a 24-bit PNG (no alpha) at exactly **1280 × 800**.

The five shots you ship (in order):

1. **Audit** tab - score + rule list
2. **Previews** tab - Twitter / Facebook / LinkedIn mockups
3. **Tags** tab - filtered + searchable meta tags
4. **Site** tab - robots.txt + sitemap.xml panel
5. **Compare** tab - coograph.com vs metaspry.com side-by-side

If you ship fewer than 5, drop **Compare** first (it needs two scans).

---

## 1. Build + load the extension

```powershell
cd C:\paul\code\metaspry\metaspry
npm run build
```

Then in Chrome:

1. `chrome://extensions/` → toggle **Developer mode** (top right).
2. **Load unpacked** → select the `build/` folder.
3. Pin the **Metaspry** icon to the toolbar (puzzle icon → pin).

---

## 2. Size the Chrome window

Chrome Web Store wants 1280 × 800. The cleanest result is to capture the **entire Chrome window** at that size, including the URL bar - it reads as authentic to reviewers.

Open Chrome DevTools (F12) on any tab → Console → paste:

```js
window.resizeTo(1296, 856);  // outer window - leaves ~1280x800 inner
window.moveTo(40, 40);
```

(Numbers account for Windows 11 title bar + small shadows; tweak if your DPI scaling differs.)

Close DevTools.

---

## 3. Open coograph.com + start a scan

1. Navigate to `https://coograph.com` in the active tab.
2. Wait for the page to fully load.
3. Click the **Metaspry** toolbar icon → side panel opens on the right.
4. In the side panel: click **Get Meta Tags**.

The side panel now shows the **Tags** tab with coograph's meta filled in. The audit has run in the background.

---

## 4. Capture each tab

For each of the five tabs, do this loop:

1. Click the tab name in the side panel header (Tags / Previews / Audit / Site / Compare).
2. Make sure the side panel is scrolled to the top of the section.
3. Press **`Win` + `Shift` + `S`** → choose **rectangular snip**.
4. Drag from the top-left corner of the Chrome window to the bottom-right corner of its visible content area. Aim for ~1280 × 800 - exact size doesn't matter yet, the helper below fixes it.
5. Snipping Tool auto-copies to clipboard. Click the toast → **Save As** → save into:

   ```
   C:\paul\code\metaspry\metaspry\promo\raw-screenshots\
   ```

   File names (use these - the processor script reads them in this order):

   - `01-audit.png`
   - `02-previews.png`
   - `03-tags.png`
   - `04-site.png`
   - `05-compare.png`

### Per-tab capture tips

**01-audit.png** - the money shot. Hits first in the store listing.
- Make sure the score is visible at the top (`80–95` reads as believable; perfect 100 reads as fake).
- Show 4–6 rule rows. Mix of green checks + at least one warn/fail.

**02-previews.png** - visual variety.
- Scroll to the **Twitter (summary_large_image)** preview if it renders well for coograph.com.
- Or show Facebook + LinkedIn stacked.

**03-tags.png** - show search.
- Click the tags search input, type `og:` → tags filter to ~6 OG entries.
- Capture with the search input still focused so the filter context is obvious.

**04-site.png** - robots + sitemap.
- Scroll so both `robots.txt` and `sitemap.xml` sections are visible.
- If coograph.com's sitemap-index expands recursively, all the better - that's a marquee feature.

**05-compare.png** - optional but strong.
- Before capturing, scan `https://metaspry.com` (open it in a new tab, click the extension, **Get Meta Tags**).
- Open the **Compare** tab → side-by-side view of coograph vs metaspry.
- Capture both columns visible.

---

## 5. Normalize to exactly 1280 × 800

The Chrome Web Store rejects screenshots that aren't 1280 × 800 (or 640 × 400). Don't eyeball it - run the helper:

```powershell
cd C:\paul\code\metaspry\metaspry
node scripts/process-screenshots.mjs
```

The script reads everything in `promo/raw-screenshots/`, fits each image into a 1280 × 800 canvas (preserving aspect ratio, light pastel padding to match the brand), strips alpha so the PNGs are 24-bit, and writes to `promo/screenshot-01.png` … `promo/screenshot-05.png`.

---

## 6. Upload

In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole/) → **Store listing** → **Graphic Assets** → **Screenshots** → upload the five `promo/screenshot-*.png` files **in numeric order**. The first file is what appears as the lead tile.

---

## Re-shoot checklist

If a reviewer rejects screenshots ("does not represent the extension functionality"):

- [ ] Real page visible behind / next to side panel?
- [ ] No mocked / fake data?
- [ ] Extension UI takes ≥30% of the frame?
- [ ] Resolution exactly 1280 × 800?
- [ ] PNG is 24-bit (no alpha channel)? `node -e "require('sharp')('promo/screenshot-01.png').metadata().then(m=>console.log(m))"`
