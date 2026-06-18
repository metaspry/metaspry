#!/usr/bin/env node
/**
 * Render the Metaspry brand mark to all icon sizes Chrome + the Web Store need.
 * The "M" path is identical to src/components/Logo.astro on the website so
 * extension and site stay visually consistent.
 *
 * Outputs (all PNG):
 *   static/icons/icon-16.png    toolbar
 *   static/icons/icon-32.png    toolbar HiDPI / Windows
 *   static/icons/icon-48.png    chrome://extensions card
 *   static/icons/icon-128.png   install screen + Chrome Web Store icon
 *   static/icons/icon-512.png   hi-res master for the listing page
 *   static/icons/promo-440x280.png  Chrome Web Store "small promo tile"
 *
 * Run: `npm run gen-icons`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';

const OUT_DIR = 'static/icons';
mkdirSync(OUT_DIR, { recursive: true });

const ACCENT = '#7c69ef';
const ACCENT_STRONG = '#5b4ed8';
const BG_LIGHT = '#fbfbff';

// Brand-mark M path - same as src/components/Logo.astro on the website.
// Path bounding box: x=4..20 (width 16), y=5..19 (height 14) in 24x24 viewBox.
// Visually centered within the viewBox; nested <svg> with matching viewBox
// guarantees centered placement inside the tile at any tile size.
const M_PATH = 'M4 19V5h2.5L12 13l5.5-8H20v14h-3v-9l-4.2 6h-1.6L7 10v9H4z';

function tileSvg(size) {
  const corner = Math.round(size * 0.22);
  // Glyph occupies the inner 60% of the tile, centered.
  const glyphSize = size * 0.6;
  const glyphOffset = (size - glyphSize) / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${ACCENT}"/>
      <stop offset="100%" stop-color="${ACCENT_STRONG}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${corner}" ry="${corner}" fill="url(#grad)"/>
  <svg x="${glyphOffset}" y="${glyphOffset}" width="${glyphSize}" height="${glyphSize}" viewBox="0 0 24 24">
    <path d="${M_PATH}" fill="#ffffff"/>
  </svg>
</svg>`;
}

function promoSvg() {
  const w = 440, h = 280;
  const tileSize = 100;
  const tileX = 40;
  const tileY = (h - tileSize) / 2;
  const corner = 22;
  const glyphSize = tileSize * 0.6;
  const glyphOffset = (tileSize - glyphSize) / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="ui-sans-serif, Inter, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BG_LIGHT}"/>
      <stop offset="50%" stop-color="#f5f3ff"/>
      <stop offset="100%" stop-color="#eef2ff"/>
    </linearGradient>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${ACCENT}"/>
      <stop offset="100%" stop-color="${ACCENT_STRONG}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect x="${tileX}" y="${tileY}" width="${tileSize}" height="${tileSize}" rx="${corner}" fill="url(#tile)"/>
  <svg x="${tileX + glyphOffset}" y="${tileY + glyphOffset}" width="${glyphSize}" height="${glyphSize}" viewBox="0 0 24 24">
    <path d="${M_PATH}" fill="#ffffff"/>
  </svg>
  <g transform="translate(${tileX + tileSize + 30}, ${tileY + 18})">
    <text x="0" y="0" fill="#0f172a" font-size="34" font-weight="700" letter-spacing="-0.8">Metaspry</text>
    <text x="0" y="32" fill="#475569" font-size="16" font-weight="500">Audit any page's meta tags.</text>
    <text x="0" y="56" fill="#475569" font-size="16" font-weight="500">Free Chrome extension.</text>
  </g>
</svg>`;
}

async function render(svg, file, w, h) {
  const png = await sharp(Buffer.from(svg), { density: 384 })
    .resize(w, h, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, png);
  console.log(`wrote ${file} (${w}x${h})`);
}

const sizes = [16, 32, 48, 128, 512];
for (const s of sizes) {
  await render(tileSvg(s), `${OUT_DIR}/icon-${s}.png`, s, s);
}
await render(promoSvg(), `${OUT_DIR}/promo-440x280.png`, 440, 280);

// Also write the source SVG at 512 for the website to mirror.
writeFileSync(`${OUT_DIR}/icon.svg`, tileSvg(512));
console.log(`wrote ${OUT_DIR}/icon.svg (master)`);
