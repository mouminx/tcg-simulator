/**
 * Renders every synthesised sound in audioLibrary and asserts it is audible, peak-correct
 * and click-free. Run after touching audioSynth.js or any synth spec:  npm run verify-audio
 *
 * Imports audioPlaceholders directly, never audioLibrary — the latter uses import.meta.glob
 * and only loads under Vite. Uses a stub context because renderSynthBuffer needs only
 * sampleRate + createBuffer, so no browser or Web Audio implementation is required.
 */
import { renderSynthBuffer } from '../src/game/audio/audioSynth.js';
import { SYNTH_SPECS } from '../src/game/audio/audioPlaceholders.js';

// Minimal stand-in for BaseAudioContext: renderSynthBuffer only needs sampleRate and
// createBuffer, so the real Web Audio API is not required to exercise the DSP.
const ctx = {
  sampleRate: 48000,
  createBuffer(channels, length, sampleRate) {
    const data = new Float32Array(length);
    return { numberOfChannels: channels, length, sampleRate, getChannelData: () => data };
  },
};

let fail = 0;
console.log('sound'.padEnd(30), 'secs'.padStart(6), 'peak'.padStart(7), 'rms'.padStart(8), '  verdict');
console.log('-'.repeat(72));

for (const [id, spec] of Object.entries(SYNTH_SPECS)) {
  const def = { id, synth: spec };
  const buf = renderSynthBuffer(ctx, spec);
  if (!buf) { console.log(id.padEnd(30), '  RENDER RETURNED NULL'); fail++; continue; }
  const d = buf.getChannelData();
  let peak = 0, sum = 0, nonZero = 0;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]);
    if (a > peak) peak = a;
    sum += d[i] * d[i];
    if (a > 1e-6) nonZero++;
  }
  const rms = Math.sqrt(sum / d.length);
  const secs = buf.length / buf.sampleRate;
  const target = def.synth.normalizeTo ?? 0.89;

  const problems = [];
  if (peak > 1.0) problems.push('CLIPS');
  if (Math.abs(peak - target) > 0.02) problems.push(`peak!=${target}`);
  if (rms < 0.001) problems.push('SILENT');
  if (nonZero / d.length < 0.05) problems.push('mostly-empty');
  if (!Number.isFinite(rms)) problems.push('NaN');
  if (problems.length) fail++;

  console.log(
    def.id.padEnd(30),
    secs.toFixed(3).padStart(6),
    peak.toFixed(4).padStart(7),
    rms.toFixed(5).padStart(8),
    '  ' + (problems.length ? '✗ ' + problems.join(', ') : 'ok'),
  );
}

// Loop beds must fade to near-silence at both seams or the wrap ticks audibly.
console.log('\n--- loop seam check ---');
for (const [id, spec] of Object.entries(SYNTH_SPECS).filter(([, sp]) => sp.loop)) {
  const def = { id };
  const d = renderSynthBuffer(ctx, spec).getChannelData();
  const head = Math.abs(d[0]), tail = Math.abs(d[d.length - 1]);
  const ok = head < 0.02 && tail < 0.02;
  if (!ok) fail++;
  console.log(`  ${def.id.padEnd(28)} head=${head.toFixed(5)} tail=${tail.toFixed(5)}  ${ok ? 'ok' : '✗ would click'}`);
}

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
