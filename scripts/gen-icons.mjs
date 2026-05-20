#!/usr/bin/env node
/**
 * Render the Metaspry brand mark to all icon sizes Chrome + the Web Store need.
 *
 * Outputs (all PNG):
 *   static/icons/icon-16.png    toolbar
 *   static/icons/icon-32.png    toolbar HiDPI / Windows
 *   static/icons/icon-48.png    chrome://extensions card
 *   static/icons/icon-128.png   install screen + Chrome Web Store icon
 *   static/icons/icon-512.png   Web Store hero (uploads as 128 by store, but
 *                               keep a hi-res master for the listing page)
 *   static/icons/promo-440x280.png  Chrome Web Store "small promo tile"
 *
 * Run from this repo's root: `node scripts/gen-icons.mjs`
 * Requires sharp (already a peer of @sveltejs adapter).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';

const OUT_DIR = 'static/icons';
mkdirSync(OUT_DIR, { recursive: true });

const ACCENT = '#7c69ef';
const ACCENT_STRONG = '#5b4ed8';
const BG_LIGHT = '#fbfbff';

// Square brand-mark SVG. Rounded purple tile with a stylized "M" mark that
// reads at 16px (most-zoomed-out usage in Chrome's toolbar).
function tileSvg(size) {
  const corner = Math.round(size * 0.22); // ~22% radius matches the website logo
  // Path is a clean angular "M" — chosen for readability at small sizes
  // rather than the more decorative version on the marketing site.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${ACCENT}"/>
      <stop offset="100%" stop-color="${ACCENT_STRONG}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${corner}" ry="${corner}" fill="url(#grad)"/>
  <g transform="translate(${size * 0.21}, ${size * 0.27}) scale(${size * 0.012})">
    <path d="M0 40V0h6l13 20L32 0h6v40h-8V14l-9 13h-4l-9-13v26z" fill="#ffffff"/>
  </g>
</svg>`;
}

// Promo tile (440x280) for the Chrome Web Store small promo slot. Centered
// brand mark on the same pastel gradient the marketing site uses, plus
// product name and 1-line benefit copy.
function promoSvg() {
  const w = 440, h = 280;
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
  <g transform="translate(40, 95)">
    <rect width="90" height="90" rx="22" fill="url(#tile)"/>
    <g transform="translate(19, 25) scale(1.3)">
      <path d="M0 40V0h6l13 20L32 0h6v40h-8V14l-9 13h-4l-9-13v26z" fill="#ffffff"/>
    </g>
  </g>
  <g transform="translate(160, 110)">
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

console.log('\nAdd to manifest.json:\n');
console.log(JSON.stringify({
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: { default_icon: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' } },
}, null, 2));
