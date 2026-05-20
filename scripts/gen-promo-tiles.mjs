// Generates Chrome Web Store promo tiles as 24-bit PNG (no alpha).
//
//   small:    440 x 280   promo/promo-small-440x280.png
//   marquee: 1400 x 560   promo/promo-marquee-1400x560.png
//
// Run with:  node scripts/gen-promo-tiles.mjs
//
// Output is flattened against a solid background so the PNG is RGB (no
// alpha), which is what the Chrome Web Store accepts.

import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'promo');
await mkdir(outDir, { recursive: true });

const ACCENT = '#7c69ef';
const ACCENT_STRONG = '#5b4ed8';
const ACCENT_SOFT = '#eee9ff';
const FG = '#0f172a';
const FG_MUTED = '#475569';
const BG_RGB = { r: 251, g: 251, b: 255 };

const FONT_DISPLAY = "Georgia, 'Times New Roman', serif";
const FONT_BODY = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const FONT_MONO = "Consolas, 'Cascadia Code', Menlo, monospace";

function bgLayers(w, h) {
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#eef2ff"/>
        <stop offset=".5" stop-color="#f5f3ff"/>
        <stop offset="1" stop-color="#ecfeff"/>
      </linearGradient>
      <linearGradient id="logo" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${ACCENT}"/>
        <stop offset="1" stop-color="${ACCENT_STRONG}"/>
      </linearGradient>
      <radialGradient id="orbA" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="${ACCENT}" stop-opacity=".28"/>
        <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="orbB" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="${ACCENT_STRONG}" stop-opacity=".22"/>
        <stop offset="1" stop-color="${ACCENT_STRONG}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="#fbfbff"/>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
  `;
}

function checkIcon(x, y, color) {
  return `<path d="M${x + 2} ${y + 10} L${x + 8} ${y + 16} L${x + 18} ${y + 4}"
    stroke="${color}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function warnIcon(x, y, color) {
  const cx = x + 9;
  const cy = y + 10;
  return `
    <circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="${color}" stroke-width="1.8"/>
    <line x1="${cx}" y1="${cy - 4}" x2="${cx}" y2="${cy + 1}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy + 4}" r="1.2" fill="${color}"/>
  `;
}

function rulesGroup(x, y, rows, rowGap, labelFontSize, valWidth) {
  return rows
    .map((row, i) => {
      const [label, val, status] = row;
      const yy = y + i * rowGap;
      const color = status === 'warn' ? '#d97706' : ACCENT;
      const icon = status === 'warn' ? warnIcon(x, yy, color) : checkIcon(x, yy, color);
      const valColor = status === 'warn' ? color : FG_MUTED;
      return `
        ${icon}
        <text x="${x + 32}" y="${yy + 15}" font-family="${FONT_MONO}" font-size="${labelFontSize}" fill="${FG}">${label}</text>
        <text x="${x + valWidth}" y="${yy + 15}" text-anchor="end" font-family="${FONT_MONO}" font-size="${labelFontSize - 1}" fill="${valColor}">${val}</text>
      `;
    })
    .join('');
}

function smallTile() {
  const w = 440;
  const h = 280;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${bgLayers(w, h)}
    <circle cx="0" cy="0" r="160" fill="url(#orbA)"/>
    <circle cx="${w}" cy="${h}" r="180" fill="url(#orbB)"/>

    <!-- brand mark -->
    <g transform="translate(28, 30)">
      <rect width="44" height="44" rx="11" fill="url(#logo)"/>
      <text x="22" y="32" text-anchor="middle" font-family="${FONT_DISPLAY}"
        font-size="28" font-weight="700" font-style="italic" fill="white">M</text>
      <text x="58" y="30" font-family="${FONT_BODY}" font-size="22" font-weight="700" fill="${FG}">Metaspry</text>
    </g>

    <!-- tagline -->
    <text x="28" y="128" font-family="${FONT_DISPLAY}" font-style="italic"
      font-size="30" font-weight="600" fill="${FG}">See what crawlers</text>
    <text x="28" y="164" font-family="${FONT_DISPLAY}" font-style="italic"
      font-size="30" font-weight="600" fill="${ACCENT}">actually see.</text>

    <!-- sub -->
    <text x="28" y="196" font-family="${FONT_BODY}" font-size="13" fill="${FG_MUTED}">
      Audit OG, Twitter, robots, sitemap, JSON-LD.
    </text>

    <!-- pill: free chrome extension -->
    <g transform="translate(28, 226)">
      <rect width="178" height="30" rx="15" fill="${ACCENT}"/>
      <text x="89" y="20" text-anchor="middle" font-family="${FONT_BODY}"
        font-size="12" font-weight="600" fill="white">Free Chrome extension</text>
    </g>

    <!-- url -->
    <text x="${w - 22}" y="246" text-anchor="end" font-family="${FONT_BODY}"
      font-size="12" font-weight="600" fill="${FG_MUTED}">metaspry.com</text>
  </svg>`;
}

function marqueeTile() {
  const w = 1400;
  const h = 560;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${bgLayers(w, h)}
    <circle cx="120" cy="100" r="320" fill="url(#orbA)"/>
    <circle cx="${w - 80}" cy="${h - 60}" r="380" fill="url(#orbB)"/>

    <!-- LEFT: brand block -->
    <g transform="translate(90, 110)">
      <rect width="84" height="84" rx="20" fill="url(#logo)"/>
      <text x="42" y="62" text-anchor="middle" font-family="${FONT_DISPLAY}"
        font-size="54" font-weight="700" font-style="italic" fill="white">M</text>
      <text x="106" y="60" font-family="${FONT_BODY}" font-size="40" font-weight="700" fill="${FG}">Metaspry</text>
    </g>

    <text x="90" y="290" font-family="${FONT_DISPLAY}" font-style="italic"
      font-size="64" font-weight="600" fill="${FG}">See what crawlers</text>
    <text x="90" y="368" font-family="${FONT_DISPLAY}" font-style="italic"
      font-size="64" font-weight="600" fill="${ACCENT}">actually see.</text>

    <text x="90" y="416" font-family="${FONT_BODY}" font-size="20" fill="${FG_MUTED}">
      One-click audit of OG, Twitter, robots, sitemap, llms.txt, JSON-LD.
    </text>

    <!-- CTA pill + url -->
    <g transform="translate(90, 458)">
      <rect width="244" height="52" rx="26" fill="${ACCENT}"/>
      <text x="122" y="34" text-anchor="middle" font-family="${FONT_BODY}"
        font-size="18" font-weight="600" fill="white">Add to Chrome - free</text>
    </g>
    <text x="354" y="492" font-family="${FONT_BODY}" font-size="16"
      font-weight="600" fill="${FG_MUTED}">metaspry.com</text>

    <!-- RIGHT: audit card mockup -->
    <g transform="translate(800, 80)">
      <!-- soft shadow -->
      <rect x="8" y="18" width="520" height="400" rx="22" fill="${ACCENT}" opacity=".16"/>
      <!-- card -->
      <rect width="520" height="400" rx="22" fill="white" stroke="${ACCENT_SOFT}" stroke-width="1"/>
      <!-- chrome strip -->
      <path d="M0 0 H520 V44 H0 Z" fill="#f7f7fb"/>
      <circle cx="22" cy="22" r="5.5" fill="#ff5f57"/>
      <circle cx="42" cy="22" r="5.5" fill="#febc2e"/>
      <circle cx="62" cy="22" r="5.5" fill="#28c840"/>
      <rect x="88" y="11" width="220" height="22" rx="6" fill="white"/>
      <text x="100" y="26" font-family="${FONT_MONO}" font-size="11" fill="${FG_MUTED}">example.com - Metaspry Audit</text>

      <!-- score -->
      <text x="28" y="90" font-family="${FONT_BODY}" font-size="11"
        font-weight="700" fill="${FG_MUTED}" letter-spacing="2">AUDIT SCORE</text>
      <text x="452" y="98" text-anchor="end" font-family="${FONT_DISPLAY}"
        font-style="italic" font-size="42" font-weight="700" fill="${ACCENT}">92</text>
      <text x="492" y="98" text-anchor="end" font-family="${FONT_BODY}"
        font-size="14" fill="${FG_MUTED}">/100</text>

      <!-- progress -->
      <rect x="28" y="114" width="464" height="8" rx="4" fill="${ACCENT_SOFT}"/>
      <rect x="28" y="114" width="427" height="8" rx="4" fill="${ACCENT}"/>

      <!-- rules -->
      ${rulesGroup(
        28,
        150,
        [
          ['og:title', '"The meta-tag analyzer..."', 'ok'],
          ['og:image', '1200 x 630', 'ok'],
          ['canonical', 'https://example.com/', 'ok'],
          ['twitter:card', 'missing', 'warn'],
          ['robots.txt', 'allow: /', 'ok'],
          ['sitemap.xml', 'found - 47 URLs', 'ok'],
        ],
        38,
        14,
        470,
      )}
    </g>
  </svg>`;
}

async function render(svg, outPath) {
  const buf = await sharp(Buffer.from(svg))
    .flatten({ background: BG_RGB })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  await writeFile(outPath, buf);
  const stat = (await import('node:fs/promises')).stat;
  const s = await stat(outPath);
  console.log(`  ${path.basename(outPath)}  ${(s.size / 1024).toFixed(1)} KB`);
}

console.log('Generating Chrome Web Store promo tiles:');
await render(smallTile(), path.join(outDir, 'promo-small-440x280.png'));
await render(marqueeTile(), path.join(outDir, 'promo-marquee-1400x560.png'));
console.log(`Done. Output: ${outDir}`);
