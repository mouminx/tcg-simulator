/**
 * Generates src/game/cardColors.js — a static map of card name → 4-color
 * palette extracted from the card's artwork PNG (vertical quarters, darkened).
 * Used to create a linear-gradient card background.
 *
 * Run whenever you add new art:
 *   npm run extract-colors
 */

import { readdir, writeFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const ROOT            = fileURLToPath(new URL('..', import.meta.url));
const CARDS_DIR       = join(ROOT, 'src/assets/cards');
const CLASS_CARDS_DIR = join(ROOT, 'src/assets/class-cards');
const OUT_FILE        = join(ROOT, 'src/game/cardColors.js');
const DARKEN       = 0.50;  // multiply to get rich dark background
const PALETTE_SIZE = 7;     // number of gradient stops
const K_ITER       = 12;    // k-means iterations

function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function sqDist([r1, g1, b1], [r2, g2, b2]) {
  return (r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2;
}

function luminance([r, g, b]) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function kMeans(pixels, k) {
  // Seed centroids evenly across the pixel array for stable results
  const step = Math.floor(pixels.length / k);
  let centroids = Array.from({ length: k }, (_, i) => [...pixels[i * step]]);

  for (let iter = 0; iter < K_ITER; iter++) {
    const sums   = Array.from({ length: k }, () => [0, 0, 0]);
    const counts = new Array(k).fill(0);

    for (const p of pixels) {
      let minD = Infinity, minI = 0;
      for (let i = 0; i < k; i++) {
        const d = sqDist(p, centroids[i]);
        if (d < minD) { minD = d; minI = i; }
      }
      sums[minI][0] += p[0];
      sums[minI][1] += p[1];
      sums[minI][2] += p[2];
      counts[minI]++;
    }

    centroids = centroids.map((c, i) =>
      counts[i] ? sums[i].map(v => v / counts[i]) : c
    );
  }

  return centroids;
}

const colors = {};

const rarities = await readdir(CARDS_DIR, { withFileTypes: true })
  .then(entries => entries.filter(e => e.isDirectory()).map(e => e.name));

for (const rarity of rarities) {
  const dir = join(CARDS_DIR, rarity);
  let files;
  try { files = await readdir(dir); } catch { continue; }

  for (const file of files) {
    if (!file.toLowerCase().endsWith('.png')) continue;
    const name = titleCase(basename(file, '.png'));
    try {
      // Sample at 16×16 to get enough pixels for clustering without being slow
      const { data } = await sharp(join(dir, file))
        .resize(16, 16, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixels = [];
      for (let i = 0; i < data.length; i += 3) {
        pixels.push([data[i], data[i + 1], data[i + 2]]);
      }

      // Find PALETTE_SIZE dominant distinct colors via k-means, sort dark→light
      const centroids = kMeans(pixels, PALETTE_SIZE);
      centroids.sort((a, b) => luminance(a) - luminance(b));

      const palette = centroids.map(([r, g, b]) => [
        Math.round(r * DARKEN),
        Math.round(g * DARKEN),
        Math.round(b * DARKEN),
      ]);
      colors[name] = palette;
      console.log(`  ${name.padEnd(24)} → ${palette.map(c => `rgb(${c})`).join(' | ')}`);
    } catch (err) {
      console.warn(`  skipped ${file}: ${err.message}`);
    }
  }
}

// Per-class color bias: blend extracted palette toward a target hue [r, g, b, factor]
const CLASS_COLOR_BIAS = {
  miner:      [85,  85,  90,  0.45], // gray stone
  lumberjack: [25,  65,  10,  0.40], // forest green
  blacksmith: [18,  18,  22,  0.55], // charcoal/black
  mage:       [8,   80,  105, 0.45], // deep cyan
  bard:       [75,  12,  65,  0.45], // maroon/violet
};

function applyColorBias(palette, classType) {
  const bias = CLASS_COLOR_BIAS[classType];
  if (!bias) return palette;
  const [tr, tg, tb, f] = bias;
  return palette.map(([r, g, b]) => [
    Math.round(r * (1 - f) + tr * f),
    Math.round(g * (1 - f) + tg * f),
    Math.round(b * (1 - f) + tb * f),
  ]);
}

// Extract colors for unit class art — scan subdirectories, use first variant per class
let classDirs;
try { classDirs = await readdir(CLASS_CARDS_DIR, { withFileTypes: true }); } catch { classDirs = []; }
for (const entry of classDirs) {
  if (!entry.isDirectory()) continue;
  const classType = entry.name.toLowerCase();
  const classDir = join(CLASS_CARDS_DIR, entry.name);
  let variants;
  try { variants = (await readdir(classDir)).filter(f => f.toLowerCase().endsWith('.png')).sort(); }
  catch { continue; }
  if (!variants.length) continue;
  // Use first variant as representative for the palette
  try {
    const { data } = await sharp(join(classDir, variants[0]))
      .resize(16, 16, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = [];
    for (let i = 0; i < data.length; i += 3) {
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }

    const centroids = kMeans(pixels, PALETTE_SIZE);
    centroids.sort((a, b) => luminance(a) - luminance(b));
    let palette = centroids.map(([r, g, b]) => [
      Math.round(r * DARKEN),
      Math.round(g * DARKEN),
      Math.round(b * DARKEN),
    ]);
    palette = applyColorBias(palette, classType);
    colors[classType] = palette;
    console.log(`  ${classType.padEnd(24)} → ${palette.map(c => `rgb(${c})`).join(' | ')}`);
  } catch (err) {
    console.warn(`  skipped ${classType}: ${err.message}`);
  }
}

const output = `// Auto-generated by scripts/extract-card-colors.mjs
// Run "npm run extract-colors" after adding new card art.
// Do not edit manually.
export const CARD_COLORS = ${JSON.stringify(colors, null, 2)};
`;

await writeFile(OUT_FILE, output, 'utf8');
console.log(`\nWrote ${Object.keys(colors).length} colors → src/game/cardColors.js`);
