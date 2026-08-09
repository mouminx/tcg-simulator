/**
 * Re-encode source art into web-sized WebP.
 *
 * Reads from src/assets-original/ (gitignored, created on first run) and writes
 * WebP into src/assets/, deleting the PNG it replaces. Always reads originals,
 * never its own output, so it is safe to re-run with different targets.
 *
 * Targets are driven by the largest size each asset actually renders at,
 * doubled for 2x DPR displays:
 *   - class card art  → 330px viewer modal  → 768x1152 detail
 *                     → 132px binder cell   → 320x480  thumb
 *   - square icons    → ~110px sidebar tile → 384px long edge
 *
 * Usage: npm run optimize-assets
 */

import sharp from 'sharp';
import { readdir, mkdir, stat, rm, writeFile } from 'node:fs/promises';
import { join, relative, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src/assets-original');
const OUT = join(ROOT, 'src/assets');

// Card art renders at two very different sizes, so it gets two encodes. Every
// other asset is a small square tile and needs only one.
const JOBS = [
  {
    from: 'class-cards',
    to: 'class-cards',
    resize: { width: 768, height: 1152 },
    quality: 82,
    label: 'class cards (detail)',
  },
  {
    from: 'class-cards',
    to: 'class-cards-thumb',
    resize: { width: 320, height: 480 },
    quality: 78,
    label: 'class cards (thumb)',
  },
  { from: 'cards/charms', to: 'cards/charms', icon: true, label: 'charms' },
  { from: 'resources', to: 'resources', icon: true, label: 'resources' },
  { from: 'elements', to: 'elements', icon: true, label: 'elements' },
  { from: 'ores', to: 'ores', icon: true, label: 'ores' },
  { from: 'ingots', to: 'ingots', icon: true, label: 'ingots' },
];

const ICON_LONG_EDGE = 384;
const ICON_QUALITY = 80;

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (extname(entry.name).toLowerCase() === '.png') out.push(full);
  }
  return out;
}

async function sizeOf(path) {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

function fmtMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const rows = [];
let totalBefore = 0;
let totalAfter = 0;

for (const job of JOBS) {
  const fromDir = join(SRC, job.from);
  const files = await walk(fromDir);
  if (files.length === 0) {
    console.warn(`  ! no PNGs found in src/assets-original/${job.from} — skipped`);
    continue;
  }

  let before = 0;
  let after = 0;

  for (const file of files) {
    const rel = relative(fromDir, file);
    const outPath = join(OUT, job.to, rel).replace(/\.png$/i, '.webp');
    await mkdir(dirname(outPath), { recursive: true });

    before += await sizeOf(file);

    const pipeline = sharp(file);
    if (job.icon) {
      // Preserve aspect; fit inside a square box so tall icons (ingots) stay tall.
      pipeline.resize(ICON_LONG_EDGE, ICON_LONG_EDGE, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    } else {
      pipeline.resize(job.resize.width, job.resize.height, {
        fit: 'cover',
        withoutEnlargement: true,
      });
    }

    await pipeline
      .webp({ quality: job.quality ?? ICON_QUALITY, effort: 6 })
      .toFile(outPath);

    after += await sizeOf(outPath);

    // Drop the PNG this WebP replaces. Only when writing back into the same
    // folder we read from — the thumb job writes to a new folder and must not
    // delete the detail PNGs it shares a source with.
    if (job.to === job.from) {
      const stale = join(OUT, job.to, rel);
      await rm(stale, { force: true });
    }
  }

  rows.push({ label: job.label, count: files.length, before, after });
  totalBefore += before;
  totalAfter += after;
}

// The thumb job double-counts its source PNGs in `before`; report the honest
// on-disk delta separately so the summary is not misleading.
const onDiskBefore = rows
  .filter(r => r.label !== 'class cards (thumb)')
  .reduce((sum, r) => sum + r.before, 0);

console.log('\n  asset                     files      before       after   saved');
console.log('  ' + '─'.repeat(62));
for (const r of rows) {
  const pct = r.before > 0 ? `${Math.round((1 - r.after / r.before) * 100)}%` : '—';
  console.log(
    `  ${r.label.padEnd(24)} ${String(r.count).padStart(5)}  ${fmtMB(r.before).padStart(10)}  ${fmtMB(r.after).padStart(10)}  ${pct.padStart(6)}`,
  );
}
console.log('  ' + '─'.repeat(62));
console.log(
  `  ${'live assets on disk'.padEnd(24)} ${String(rows.reduce((s, r) => s + r.count, 0)).padStart(5)}  ${fmtMB(onDiskBefore).padStart(10)}  ${fmtMB(totalAfter).padStart(10)}  ${String(Math.round((1 - totalAfter / onDiskBefore) * 100) + '%').padStart(6)}`,
);

// Decoded-bitmap footprint is what actually drives browser memory: it is always
// width * height * 4 bytes regardless of file size.
const decoded = (w, h) => (w * h * 4) / 1024 / 1024;
console.log(`
  decoded RAM per image (the number that drives browser memory):
    card in binder   ${decoded(1024, 1536).toFixed(1)} MiB → ${decoded(320, 480).toFixed(2)} MiB   (${Math.round(decoded(1024, 1536) / decoded(320, 480))}x less)
    card in viewer   ${decoded(1024, 1536).toFixed(1)} MiB → ${decoded(768, 1152).toFixed(2)} MiB   (${(decoded(1024, 1536) / decoded(768, 1152)).toFixed(1)}x less)
    square icon      ${decoded(1024, 1024).toFixed(1)} MiB → ${decoded(384, 384).toFixed(2)} MiB   (${Math.round(decoded(1024, 1024) / decoded(384, 384))}x less)
`);

await writeFile(
  join(ROOT, 'src/assets/.optimized'),
  `${new Date().toISOString()}\n`,
  'utf8',
);
