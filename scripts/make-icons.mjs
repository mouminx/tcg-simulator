/**
 * Generates the app icon and the web favicon from art already in the repo.
 *
 *   npm run icons
 *
 * Writes:
 *   build/icon.png   1024x1024 — electron-builder converts this to .icns and .ico itself
 *   public/icon.svg  the browser favicon, replacing Vite's default logo
 *
 * ── This is a PLACEHOLDER, and deliberately a reproducible one ──
 * It composes the mythic rarity gem over a dark tile rather than being drawn from scratch: the gem
 * is real game art, it is a self-contained 128x128 vector with no external font or image references
 * (so it rasterises identically anywhere), and it reads at 16px, which most detailed artwork does
 * not. When there is a proper icon, replace this script's output — or delete the script and commit
 * the artwork directly.
 *
 * Generated rather than committed as a binary so the provenance is visible and the sizes can be
 * regenerated, matching how optimize-assets.mjs and encode-audio.mjs treat every other asset here.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEM = join(ROOT, 'src/assets/rarity-gems/mythic.svg');

/** The tile behind the gem. Colours are lifted from `.app`'s gradient and the gold UI accent. */
const BG_DARK = '#0d0a07';
const BG_LIGHT = '#241708';
const RIM = '#c4893a';

/**
 * Builds the icon as one SVG so both outputs come from the same source.
 *
 * The gem is inlined rather than referenced with `<image href>`: sharp's SVG rasteriser will not
 * follow external references, so a linked file would silently render as a blank tile.
 */
async function buildSvg(size) {
  const gem = await readFile(GEM, 'utf8');
  // Strip the XML prolog and outer <svg> so the paths can be nested in ours.
  const inner = gem
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim();

  // 0.13 rather than 0.19: at 0.19 the gem was ~62% of the tile and collapsed to an unreadable dot
  // at 16-32px, which is where a dock and a taskbar actually render it. 74% holds its facets longer.
  const pad = size * 0.13;
  const gemSize = size - pad * 2;
  const radius = size * 0.22;       // macOS-ish squircle corner
  const rim = Math.max(1, size * 0.012);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${BG_LIGHT}"/>
      <stop offset="1" stop-color="${BG_DARK}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.6">
      <stop offset="0" stop-color="${RIM}" stop-opacity="0.42"/>
      <stop offset="1" stop-color="${RIM}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#tile)"/>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#glow)"/>
  <rect x="${rim / 2}" y="${rim / 2}" width="${size - rim}" height="${size - rim}"
        rx="${radius}" ry="${radius}" fill="none" stroke="${RIM}" stroke-opacity="0.55" stroke-width="${rim}"/>
  <g transform="translate(${pad} ${pad}) scale(${gemSize / 128})">${inner}</g>
</svg>`;
}

const outputs = [
  { path: 'build/icon.png', size: 1024, raster: true },
  { path: 'public/icon.svg', size: 512, raster: false },
];

for (const { path, size, raster } of outputs) {
  const svg = await buildSvg(size);
  const target = join(ROOT, path);
  await mkdir(dirname(target), { recursive: true });
  if (raster) {
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(target);
  } else {
    await writeFile(target, `${svg}\n`);
  }
  console.log(`  ${path}  ${size}x${size}`);
}
console.log('Done. electron-builder converts build/icon.png to .icns and .ico at package time.');
