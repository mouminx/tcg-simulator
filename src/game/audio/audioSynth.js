/**
 * Procedural sound generation.
 *
 * Every placeholder sound in `audioLibrary.js` is rendered into a real `AudioBuffer` by
 * this module rather than played through a one-off oscillator. That matters: a synthesised
 * buffer goes through the exact same path a shipped `.webm` will — the same voice limiting,
 * retrigger throttle, pitch jitter, bus routing and cache. So replacing a placeholder with
 * a real asset is a one-line change in the definition (`synth:` → `src:`) with no other
 * behaviour difference to discover later.
 *
 * Buffers are mono. Stereo would double the decoded footprint for no benefit on short
 * SFX — see the storage notes in CLAUDE.md.
 *
 * Layer types:
 *   tone   pitched oscillator with optional frequency glide
 *   noise  white noise through a one-pole low-pass, for impacts and texture
 *
 * Each layer carries its own envelope, so a sound is built by stacking a few layers —
 * e.g. a coin is two tones a fifth apart, a pack tear is noise with a slow attack.
 */

/** Deterministic noise, so a rendered buffer is identical every run. */
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return (s / 4294967296) * 2 - 1;
  };
}

function waveform(type, phase) {
  switch (type) {
    case 'square': return phase < 0.5 ? 1 : -1;
    case 'saw': return phase * 2 - 1;
    case 'triangle': return 1 - 4 * Math.abs(Math.round(phase) - phase);
    default: return Math.sin(phase * Math.PI * 2);
  }
}

/**
 * Percussive envelope: linear attack then exponential decay. `curve` above 1 tightens the
 * decay, which is what separates a click from a bell.
 */
function envelopeAt(t, duration, attack, curve) {
  if (t < attack) return attack > 0 ? t / attack : 1;
  const rest = duration - attack;
  if (rest <= 0) return 0;
  const x = (t - attack) / rest;
  return Math.pow(Math.max(0, 1 - x), curve);
}

function renderLayer(out, sampleRate, layer, rngSeed) {
  const {
    type = 'tone',
    startMs = 0,
    durationMs = 200,
    gain = 0.5,
    attackMs = 1,
    curve = 3,
    freq = 440,
    freqEnd = null,
    wave = 'sine',
    // One-pole low-pass cutoff in Hz. Lower values make noise read as a thud rather than
    // a hiss, which is most of the difference between "impact" and "static".
    cutoff = 8000,
  } = layer;

  const start = Math.floor((startMs / 1000) * sampleRate);
  const count = Math.floor((durationMs / 1000) * sampleRate);
  const dur = durationMs / 1000;
  const attack = attackMs / 1000;
  const rng = makeRng(rngSeed);

  // One-pole coefficient for the noise low-pass.
  const rc = 1 - Math.exp(-2 * Math.PI * cutoff / sampleRate);
  let lp = 0;
  let phase = 0;

  for (let i = 0; i < count; i += 1) {
    const index = start + i;
    if (index < 0 || index >= out.length) continue;
    const t = i / sampleRate;
    const env = envelopeAt(t, dur, attack, curve);
    if (env <= 0) continue;

    let sample;
    if (type === 'noise') {
      lp += rc * (rng() - lp);
      sample = lp;
    } else {
      const f = freqEnd === null ? freq : freq + (freqEnd - freq) * (t / dur);
      phase += f / sampleRate;
      phase -= Math.floor(phase);
      sample = waveform(wave, phase);
    }
    out[index] += sample * env * gain;
  }
}

/** Peak-normalise, matching the -1 dBTP target real assets should be authored to. */
function normalize(out, peak = 0.89) {
  let max = 0;
  for (let i = 0; i < out.length; i += 1) {
    const v = Math.abs(out[i]);
    if (v > max) max = v;
  }
  if (max <= 0) return;
  const scale = peak / max;
  for (let i = 0; i < out.length; i += 1) out[i] *= scale;
}

/**
 * Render a synth spec into a mono AudioBuffer.
 *
 * @param {BaseAudioContext} context
 * @param {{ layers: object[], seed?: number, loop?: boolean, normalizeTo?: number }} spec
 */
export function renderSynthBuffer(context, spec) {
  const layers = spec?.layers ?? [];
  if (layers.length === 0) return null;

  const totalMs = layers.reduce(
    (max, layer) => Math.max(max, (layer.startMs ?? 0) + (layer.durationMs ?? 200)),
    0,
  );
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.ceil((totalMs / 1000) * sampleRate));
  const buffer = context.createBuffer(1, length, sampleRate);
  const out = buffer.getChannelData(0);

  layers.forEach((layer, i) => {
    renderLayer(out, sampleRate, layer, (spec.seed ?? 1) * 7919 + i * 104729);
  });

  // Loops must not click at the seam. A short cosine fade at both ends is crude but
  // inaudible on texture beds, and it is the only thing standing between a loop and a
  // periodic tick.
  if (spec.loop) {
    const fade = Math.min(Math.floor(sampleRate * 0.04), Math.floor(length / 4));
    for (let i = 0; i < fade; i += 1) {
      const w = 0.5 - 0.5 * Math.cos((i / fade) * Math.PI);
      out[i] *= w;
      out[length - 1 - i] *= w;
    }
  }

  normalize(out, spec.normalizeTo ?? 0.89);
  return buffer;
}
