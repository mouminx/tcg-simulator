/**
 * Encode source WAVs into shipping audio.
 *
 * Reads from src/assets-original/audio/ (gitignored masters) and writes Opus/WebM into
 * src/assets/audio/. Mirrors how scripts/optimize-assets.mjs handles images: always reads
 * the masters, never its own output, so it is safe to re-run with different settings.
 *
 * Requires ffmpeg:  brew install ffmpeg
 *
 * What it does per category, and why:
 *
 *   loudnorm   EBU R128 two-pass loudness normalisation. This is the reason you can hand
 *              over rough recordings without mastering them — every sound lands at a
 *              consistent level, so per-sound `volume` values in audioLibrary stay near 1
 *              and the output compressor is not doing corrective work.
 *   mono       Short SFX are downmixed. An AudioBuffer costs
 *              sampleRate x channels x 4 bytes/sec, so stereo doubles resident memory for
 *              a sound nobody localises. Ambience stays stereo — width is the point there.
 *   silence    Leading silence on a short SFX is perceived as input lag, and trailing
 *              silence is pure memory. Several source files are ~5s of padding around a
 *              ~0.4s sound.
 *   clip       Cuts a short excerpt. Distinct from `trim`: several sources are 5s of
 *              continuous multi-strike content rather than a padded one-shot, so there is
 *              no silence to remove — a single strike has to be excerpted instead.
 *   measure    Optional: measure loudness over a SHORTER window than the one encoded. For a
 *              percussive one-shot with a long decay, including the tail in the measurement
 *              drags the mean down and loudnorm over-boosts the attack to compensate.
 *   loop       Ambience beds get an equal-power crossfade wrapped around the seam so the
 *              wrap is inaudible, and are cut to a fixed length.
 *   stream     Music is encoded but never decoded at runtime; see playStream().
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, stat, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src/assets-original/audio');
const OUT = join(ROOT, 'src/assets/audio');

/**
 * Category presets. `target` is integrated loudness in LUFS — SFX sit hotter than ambience
 * so they cut through the bed without needing per-sound volume tweaks.
 */
const PRESETS = {
  // 48000 is not a free choice: libopus only accepts 8/12/16/24/48 kHz. The 32000 that used
  // to be here failed outright — it went unnoticed because no entry used this preset until
  // the interface pools arrived. Opus narrows bandwidth by bitrate, not by input rate, so
  // 48k in at 40k/s costs nothing and keeps a snappy click snappy.
  ui:       { channels: 1, rate: 48000, bitrate: '40k',  target: -14, trim: true },
  sfx:      { channels: 1, rate: 48000, bitrate: '56k',  target: -14, trim: true },
  ambience: { channels: 2, rate: 48000, bitrate: '72k',  target: -20, trim: false },
  music:    { channels: 2, rate: 48000, bitrate: '112k', target: -16, trim: false },
};

/**
 * Source → sound mapping.
 *
 * `files` are matched by prefix, and multiple matches become numbered variants that the
 * engine picks between at random. `loopSeconds` cuts a seamless region for ambience beds;
 * `clipSeconds` excerpts a one-shot from a longer continuous recording. `perFile` overrides
 * either of those for a single source, which some variants need because their loud moment
 * lands at a different time.
 */
const MAP = [
  // The two card pools are emitted once each under a `pool.*` id, then referenced by
  // several sound ids in audioLibrary. Encoding them per-sound would duplicate the same
  // seven files across six definitions.
  //   cardFlip   — cards clicked, dragged and dropped; packs bought and placed
  //   cardsRapid — cards collected from a pack; resource cards collected
  { id: 'pool.cardFlip',             preset: 'sfx',      files: 'card_sfx_' },
  // These recordings BUILD UP rather than starting on a transient — cards_rapid_2 opens at
  // -18dB and does not peak (-0.6dB) until 1.7s. Played whole, the click registers and the
  // actual riffle arrives ~1.8s later, which reads as lag. Each variant is excerpted around
  // its own loudest moment so the sound lands immediately.
  // Placing a card into a slot. Both takes RAMP to their impact rather than opening on it —
  // loadsoftexturw peaks at 0.30s, thunker at 0.45s — so played whole the thud would arrive a third
  // of a second after the drop. Each is excerpted to start just before its own peak, which puts the
  // impact ~50ms in and reads as immediate. Same trap as cards_rapid below.
  { id: 'pool.cardPlace', preset: 'sfx', files: 'card_place_', perFile: {
      // Long enough to let the whole thud ring out. At 0.66s/0.72s these cut while still at
      // -20 dB and -14.5 dB respectively — audibly chopped, which is what "the sound gets cut off
      // early" was. Measured decay: take 1 reaches -45 dB by 1.85s, take 2 only -37 dB by 2.59s
      // (it is far more resonant). `clipSeconds` already applies an 80ms fade at the tail, so
      // neither ends on a discontinuity.
      // `measureSeconds` is the OLD clip length, so the level lands exactly where it did before the
      // tail was extended — the thud rings out without getting louder. See regionArgs.
      'card_place_1.wav': { startSeconds: 0.25, clipSeconds: 1.60, measureSeconds: 0.66 },
      'card_place_2.wav': { startSeconds: 0.39, clipSeconds: 2.20, measureSeconds: 0.72 },
    } },
  { id: 'pool.cardsRapid', preset: 'sfx', files: 'cards_rapid_', perFile: {
      'cards_rapid_1.wav': { startSeconds: 1.15, clipSeconds: 0.62 },
      'cards_rapid_2.wav': { startSeconds: 1.36, clipSeconds: 0.74 },
      'cards_rapid_3.wav': { startSeconds: 1.06, clipSeconds: 0.86 },
    } },
  { id: 'reward.coin',               preset: 'sfx',      files: 'sack_of_coins_clinking_' },
  // ── Interface ────────────────────────────────────────────────────────────────
  // Also pools, for the same reason. The source folder names record the intent:
  //   pageTurn  pack-sfx/            — opening a pack
  //   uiBlip    ui-clicks/menu-nav/  — navigating and pressing buttons
  //   uiPaper   ui-clicks/inventory-hand/ — the Inventory and Hand drawers
  // The page turn is a swoosh that peaks at 0.30s; only its inaudible first 100ms is cut,
  // since the build-up *is* the sound. The blips and paper clicks already peak at sample 0.
  { id: 'pool.pageTurn',             preset: 'sfx',      files: 'pageturn_', startSeconds: 0.1 },
  { id: 'pool.uiBlip',               preset: 'ui',       files: 'ui_blip_' },
  { id: 'pool.uiPaper',              preset: 'ui',       files: 'ui_paper_' },
  // 5s of continuous rustling; one completion wants a short handful, not the whole take.
  { id: 'wilderness.gatherComplete', preset: 'sfx',      files: 'rustling_in_a_bush_', clipSeconds: 1.3 },
  // 5s containing several strikes. Excerpt one; the four source files supply the variety.
  { id: 'wilderness.chop',           preset: 'sfx',      files: 'axe_chopping_a_tree_', clipSeconds: 0.9 },
  // Ambience is STREAMED, not decoded. Three beds at 28-30s stereo would be 32 MB resident
  // — the exact trap this whole pipeline exists to avoid. Streaming also means the foundry
  // bed can keep a generous length from its 5-minute master at no memory cost.
  { id: 'ambient.wilderness',        preset: 'ambience', files: 'ambient_forest_sound_', loopSeconds: 30 },
  { id: 'ambient.foundry',           preset: 'ambience', files: 'Blacksmith_Forge_Ambience',
    loopSeconds: 45, startSeconds: 60 },
  // ── Music ────────────────────────────────────────────────────────────────────
  // Order here is not the play order — that lives in MUSIC_PLAYLIST in audioLibrary, which
  // starts on blacksmith and rotates. All streamed, so their length costs no memory.
  { id: 'music.blacksmith',    preset: 'music', files: 'theme_blacksmith' },
  { id: 'music.bonfire',       preset: 'music', files: 'theme_bonfire' },
  { id: 'music.celebration',   preset: 'music', files: 'theme_celebration' },
  { id: 'music.entertainment', preset: 'music', files: 'theme_entertainment' },
  { id: 'music.marked',        preset: 'music', files: 'theme_marked' },
];

/**
 * Sources that are deliberately not encoded. Listing them keeps the "unmapped sources"
 * report meaningful instead of noisy.
 */
const IGNORED = ['Main Theme SFX'];

function fmtMB(bytes) { return `${(bytes / 1024 / 1024).toFixed(2)} MB`; }

async function ffmpegAvailable() {
  try { await run('ffmpeg', ['-version']); return true; } catch { return false; }
}

/**
 * Input/output args selecting a region.
 *
 * `forMeasurement` picks the LOUDNESS-MEASUREMENT window instead of the encoded one, which differ
 * only when `measureSeconds` is given. They have to be allowed to differ for percussive one-shots
 * with a long decay: loudnorm targets *integrated* (mean) loudness, so the more quiet tail you
 * include the harder it boosts the attack to hit the target. Extending the placement thuds from
 * 0.7s to 1.6-2.2s so they could ring out pushed their peaks from about -2 dB to 0.0 dB — clipped,
 * and audibly louder than every other sound.
 *
 * So: measure over the attack and body, encode the whole decay. `measureSeconds` defaults to the
 * encoded length, which is what every other entry wants — measuring a region you are NOT encoding
 * mis-levels it badly when the excerpt is deliberately the loudest part of a take, which is the
 * `cards_rapid` lesson and still holds.
 */
function regionArgs(opts, forMeasurement = false) {
  const pre = opts.startSeconds ? ['-ss', String(opts.startSeconds)] : [];
  const encodedLength = opts.loopSeconds ?? opts.clipSeconds ?? null;
  const length = forMeasurement ? (opts.measureSeconds ?? encodedLength) : encodedLength;
  const post = length ? ['-t', String(length)] : [];
  return { pre, post };
}

/**
 * Pass 1 of loudnorm: measure. Returns the params pass 2 needs.
 *
 * Measures the *same region* that will be encoded. Measuring the whole source and applying
 * the result to a short excerpt mis-levels it — badly, when the excerpt is deliberately the
 * loudest part of the take.
 */
async function measureLoudness(input, target, opts = {}) {
  const { pre, post } = regionArgs(opts, true);
  const args = [
    '-hide_banner', '-nostats', ...pre, '-i', input, ...post,
    '-af', `loudnorm=I=${target}:TP=-1.0:LRA=11:print_format=json`,
    '-f', 'null', '-',
  ];
  let stderr = '';
  try {
    const res = await run('ffmpeg', args, { maxBuffer: 1024 * 1024 * 32 });
    stderr = res.stderr;
  } catch (e) {
    stderr = e.stderr ?? '';
  }
  const match = stderr.match(/\{[\s\S]*?\}/g);
  if (!match) return null;
  try { return JSON.parse(match[match.length - 1]); } catch { return null; }
}

async function encodeOne(inputPath, outputPath, preset, opts = {}) {
  const p = PRESETS[preset];
  const filters = [];

  // Measured two-pass loudnorm is materially better than the single-pass estimate,
  // especially on short files where the estimate has little to work with.
  const measured = await measureLoudness(inputPath, p.target, opts);
  if (measured) {
    filters.push(
      `loudnorm=I=${p.target}:TP=-1.0:LRA=11` +
      `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
      `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
      `:offset=${measured.target_offset}:linear=true`,
    );
  } else {
    filters.push(`loudnorm=I=${p.target}:TP=-1.0:LRA=11`);
  }

  if (p.trim) {
    // Strip silence from both ends. -50dB is low enough to keep quiet tails intact.
    filters.push('silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.01');
    filters.push('areverse');
    filters.push('silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05');
    filters.push('areverse');
  }

  if (opts.clipSeconds) {
    const fade = Math.min(0.08, opts.clipSeconds / 4);
    filters.push(`afade=t=out:st=${opts.clipSeconds - fade}:d=${fade}:curve=qsin`);
  }

  if (opts.loopSeconds) {
    // Equal-power crossfade at the seam: fade the head in and the tail out over the same
    // window, so looping the region has no discontinuity.
    const fade = 1.2;
    filters.push(`afade=t=in:st=0:d=${fade}:curve=qsin`);
    filters.push(`afade=t=out:st=${opts.loopSeconds - fade}:d=${fade}:curve=qsin`);
  }

  const { pre, post } = regionArgs(opts);
  const args = ['-hide_banner', '-loglevel', 'error', '-y', ...pre, '-i', inputPath, ...post];
  args.push(
    '-ac', String(p.channels),
    '-ar', String(p.rate),
    '-af', filters.join(','),
    '-c:a', 'libopus', '-b:a', p.bitrate, '-vbr', 'on', '-application', 'audio',
    outputPath,
  );

  await run('ffmpeg', args, { maxBuffer: 1024 * 1024 * 32 });
  return (await stat(outputPath)).size;
}

async function main() {
  if (!await ffmpegAvailable()) {
    console.error('\n  ffmpeg not found. Install it first:\n\n    brew install ffmpeg\n');
    process.exit(1);
  }

  let sources;
  try {
    sources = (await readdir(SRC)).filter(f => f.toLowerCase().endsWith('.wav'));
  } catch {
    console.error(`\n  No source folder at ${SRC}\n  Put your WAV masters there.\n`);
    process.exit(1);
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const rows = [];
  const unmatched = new Set(sources);

  for (const entry of MAP) {
    const matches = sources
      .filter(f => f.startsWith(entry.files))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (matches.length === 0) {
      rows.push({ id: entry.id, variants: 0, bytes: 0, note: 'NO SOURCE' });
      continue;
    }
    matches.forEach(m => unmatched.delete(m));

    let total = 0;
    for (let i = 0; i < matches.length; i += 1) {
      const suffix = matches.length > 1 ? `.${i + 1}` : '';
      const outName = `${entry.id}${suffix}.webm`;
      const before = (await stat(join(SRC, matches[i]))).size;
      const opts = { ...entry, ...(entry.perFile?.[matches[i]] ?? {}) };
      const after = await encodeOne(join(SRC, matches[i]), join(OUT, outName), entry.preset, opts);
      total += after;
      console.log(`  ${outName.padEnd(36)} ${fmtMB(before).padStart(10)} -> ${fmtMB(after).padStart(9)}`);
    }
    rows.push({ id: entry.id, variants: matches.length, bytes: total, preset: entry.preset });
  }

  console.log('\n  sound                          variants   shipped');
  console.log('  ' + '-'.repeat(52));
  let shipped = 0;
  for (const r of rows) {
    shipped += r.bytes;
    console.log(
      `  ${r.id.padEnd(30)} ${String(r.variants).padStart(5)}   ${(r.note ?? fmtMB(r.bytes)).padStart(10)}`,
    );
  }
  console.log('  ' + '-'.repeat(52));
  console.log(`  ${'TOTAL'.padEnd(30)}         ${fmtMB(shipped).padStart(10)}`);

  const ignored = [...unmatched].filter(f => IGNORED.some(i => f.startsWith(i)));
  ignored.forEach(f => unmatched.delete(f));
  if (ignored.length > 0) {
    console.log(`\n  Intentionally not encoded (see IGNORED):`);
    ignored.forEach(f => console.log(`    ${f}`));
  }
  if (unmatched.size > 0) {
    console.log(`\n  Unmapped sources (add them to MAP in this script):`);
    [...unmatched].forEach(f => console.log(`    ${f}`));
  }
  console.log('');
}

await main();
