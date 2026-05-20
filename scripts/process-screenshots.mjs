// Normalize raw store screenshots into branded hero shots:
//   - 1280 x 800 canvas, brand pastel gradient + soft glow orbs
//   - Screenshot embedded inside a rounded faux-browser card with a chrome
//     strip (traffic lights + URL pill), 1 px border, drop shadow
//   - Output PNG flattened to RGB (no alpha) for the Chrome Web Store
//
// Reads:   promo/raw-screenshots/*.png
// Writes:  promo/screenshot-NN.png  (numeric order based on filename sort)
//
// Run with:  node scripts/process-screenshots.mjs

import sharp from 'sharp';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const inDir = path.join(repoRoot, 'promo', 'raw-screenshots');
const outDir = path.join(repoRoot, 'promo');

// Canvas
const CW = 1280;
const CH = 800;

// Card geometry (faux browser window)
const CARD_W = 1120;
const CARD_H = 680;
const CARD_X = Math.round((CW - CARD_W) / 2); // 80
const CARD_Y = 60;
const CHROME_H = 44;
const RADIUS = 18;

// Trim N pixels from each edge of the raw capture before fitting it into the
// card. Strips OS window shadow / border artifacts from Win+Shift+S snips.
const EDGE_TRIM_PX = 2;

// Brand palette - matches the website + promo tiles in promo/.
const ACCENT = '#7c69ef';
const ACCENT_STRONG = '#5b4ed8';
const FG_MUTED = '#475569';
const BG_RGB = { r: 251, g: 251, b: 255 };
const FONT_MONO = "Consolas, 'Cascadia Code', Menlo, monospace";

// URL pill content - shown identically across all 5 shots since the user is
// auditing coograph.com in every screenshot.
const URL_TEXT = 'coograph.com';

function frameSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#eef2ff"/>
        <stop offset=".5" stop-color="#f5f3ff"/>
        <stop offset="1" stop-color="#ecfeff"/>
      </linearGradient>
      <radialGradient id="orbA" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="${ACCENT}" stop-opacity=".32"/>
        <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="orbB" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="${ACCENT_STRONG}" stop-opacity=".26"/>
        <stop offset="1" stop-color="${ACCENT_STRONG}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${CW}" height="${CH}" fill="#fbfbff"/>
    <rect width="${CW}" height="${CH}" fill="url(#bg)"/>
    <circle cx="60" cy="60" r="320" fill="url(#orbA)"/>
    <circle cx="${CW - 80}" cy="${CH - 40}" r="380" fill="url(#orbB)"/>
    <!-- soft drop-shadow under the card -->
    <rect x="${CARD_X + 4}" y="${CARD_Y + 18}" width="${CARD_W}" height="${CARD_H}"
      rx="${RADIUS + 2}" fill="${ACCENT}" opacity="0.20"/>
    <rect x="${CARD_X}" y="${CARD_Y + 8}" width="${CARD_W}" height="${CARD_H}"
      rx="${RADIUS + 1}" fill="${ACCENT_STRONG}" opacity="0.10"/>
  </svg>`;
}

function chromeSvg(width) {
  const cy = Math.round(CHROME_H / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${CHROME_H}">
    <rect width="${width}" height="${CHROME_H}" fill="#f7f7fb"/>
    <circle cx="22" cy="${cy}" r="6" fill="#ff5f57"/>
    <circle cx="44" cy="${cy}" r="6" fill="#febc2e"/>
    <circle cx="66" cy="${cy}" r="6" fill="#28c840"/>
    <rect x="${Math.round(width / 2) - 180}" y="${cy - 13}" width="360" height="26"
      rx="9" fill="white" stroke="#e5e7eb"/>
    <text x="${Math.round(width / 2)}" y="${cy + 4}" text-anchor="middle"
      font-family="${FONT_MONO}" font-size="12" fill="${FG_MUTED}">${URL_TEXT}</text>
    <line x1="0" y1="${CHROME_H - 0.5}" x2="${width}" y2="${CHROME_H - 0.5}"
      stroke="#e5e7eb" stroke-width="1"/>
  </svg>`;
}

function borderSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}">
    <rect x="0.5" y="0.5" width="${CARD_W - 1}" height="${CARD_H - 1}"
      rx="${RADIUS}" fill="none" stroke="rgba(15, 23, 42, 0.08)" stroke-width="1"/>
  </svg>`;
}

function maskSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}">
    <rect width="${CARD_W}" height="${CARD_H}" rx="${RADIUS}" fill="white"/>
  </svg>`;
}

async function renderHero(rawPath, outPath) {
  // 1. Strip OS window-border artifacts from the raw snip.
  const src = sharp(rawPath);
  const { width: srcW = 0, height: srcH = 0 } = await src.metadata();
  const trim = Math.max(0, EDGE_TRIM_PX);
  const canTrim = srcW > trim * 2 + 10 && srcH > trim * 2 + 10;

  const trimmed = canTrim
    ? sharp(rawPath).extract({
        left: trim,
        top: trim,
        width: srcW - trim * 2,
        height: srcH - trim * 2,
      })
    : sharp(rawPath);

  // 2. Cover-fit the screenshot into the card's content area (under the chrome
  //    strip). Anchor to the top so the header of the side panel + page is
  //    always preserved when aspect ratios don't match.
  const screenshotBuf = await trimmed
    .resize(CARD_W, CARD_H - CHROME_H, { fit: 'cover', position: 'top' })
    .png()
    .toBuffer();

  // 3. Build the card content layer (chrome strip on top, screenshot below).
  const chromeBuf = await sharp(Buffer.from(chromeSvg(CARD_W))).png().toBuffer();
  const cardContent = await sharp({
    create: {
      width: CARD_W,
      height: CARD_H,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      { input: chromeBuf, left: 0, top: 0 },
      { input: screenshotBuf, left: 0, top: CHROME_H },
    ])
    .png()
    .toBuffer();

  // 4. Round the card's corners (dest-in mask).
  const cardRounded = await sharp(cardContent)
    .composite([{ input: Buffer.from(maskSvg()), blend: 'dest-in' }])
    .png()
    .toBuffer();

  // 5. Composite everything onto the gradient frame, then flatten to 24-bit RGB.
  const borderBuf = await sharp(Buffer.from(borderSvg())).png().toBuffer();
  const finalBuf = await sharp(Buffer.from(frameSvg()))
    .composite([
      { input: cardRounded, left: CARD_X, top: CARD_Y },
      { input: borderBuf, left: CARD_X, top: CARD_Y },
    ])
    .flatten({ background: BG_RGB })
    .removeAlpha()
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

  await writeFile(outPath, finalBuf);
}

await mkdir(inDir, { recursive: true });
await mkdir(outDir, { recursive: true });

let entries;
try {
  entries = (await readdir(inDir))
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort();
} catch (err) {
  console.error(`Could not read ${inDir}:`, err.message);
  process.exit(1);
}

if (entries.length === 0) {
  console.error(`No screenshots found in ${inDir}`);
  console.error('Save your raw captures there as 01-audit.png, 02-previews.png, etc.');
  process.exit(1);
}

console.log(`Processing ${entries.length} screenshot(s):`);

let i = 0;
for (const name of entries) {
  i += 1;
  const srcPath = path.join(inDir, name);
  const outName = `screenshot-${String(i).padStart(2, '0')}.png`;
  const outPath = path.join(outDir, outName);

  await renderHero(srcPath, outPath);

  const meta = await sharp(outPath).metadata();
  console.log(
    `  ${name}  ->  ${outName}  (${meta.width}x${meta.height}, ${meta.channels}ch, alpha:${meta.hasAlpha})`,
  );
}

console.log(`Done. Output: ${outDir}`);
console.log('Upload screenshot-01.png ... in numeric order in the Developer Dashboard.');
