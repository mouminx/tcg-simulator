/**
 * Placeholder synth specs, rendered by audioSynth.js into real AudioBuffers.
 *
 * Kept in their own module for two reasons:
 *
 *  1. **Node-safety.** scripts/verify-audio.mjs imports this and audioSynth.js directly,
 *     without touching audioLibrary.js — which uses `import.meta.glob` and therefore only
 *     loads under Vite. An earlier attempt to guard that glob with a `typeof` check silently
 *     disabled every asset-backed sound, because Vite replaces the call but leaves the guard
 *     in the runtime bundle where `import.meta.glob` does not exist.
 *  2. This file shrinks toward empty as real recordings land. Nothing else has to move.
 *
 * Keyed by the dotted sound id. Deliberately **no imports at all** — importing SOUND_IDS from
 * audioLibrary would make this module transitively depend on `import.meta.glob` again, which
 * is the whole thing this split exists to avoid.
 */
export const SYNTH_SPECS = Object.freeze({
  'ui.click': {
        seed: 11,
        layers: [
          { type: 'noise', durationMs: 45, gain: 0.5, attackMs: 0.5, curve: 6, cutoff: 3600 },
          { type: 'tone', wave: 'triangle', freq: 880, freqEnd: 620, durationMs: 55, gain: 0.3, curve: 5 },
        ],
      },
  'ui.hover': {
        seed: 23,
        layers: [
          { type: 'tone', wave: 'sine', freq: 1500, freqEnd: 1900, durationMs: 38, gain: 0.34, curve: 4 },
        ],
      },
  'ui.toggle': {
        seed: 31,
        layers: [
          { type: 'tone', wave: 'square', freq: 420, freqEnd: 700, durationMs: 70, gain: 0.2, curve: 4 },
          { type: 'noise', durationMs: 40, gain: 0.25, curve: 6, cutoff: 2600 },
        ],
      },
  'pack.buy': {
        seed: 41,
        layers: [
          { type: 'tone', wave: 'sine', freq: 660, durationMs: 180, gain: 0.3, curve: 3 },
          { type: 'tone', wave: 'sine', freq: 990, startMs: 55, durationMs: 200, gain: 0.24, curve: 3 },
          { type: 'noise', durationMs: 60, gain: 0.18, curve: 5, cutoff: 5200 },
        ],
      },
  'card.place': {
        seed: 71,
        layers: [
          { type: 'noise', durationMs: 70, gain: 0.45, attackMs: 2, curve: 4, cutoff: 2200 },
          { type: 'tone', wave: 'sine', freq: 240, freqEnd: 170, durationMs: 90, gain: 0.24, curve: 4 },
        ],
      },
  'reward.claim': {
        seed: 97,
        layers: [
          { type: 'tone', wave: 'sine', freq: 523, durationMs: 260, gain: 0.26, curve: 2.6 },
          { type: 'tone', wave: 'sine', freq: 659, startMs: 70, durationMs: 260, gain: 0.24, curve: 2.6 },
          { type: 'tone', wave: 'sine', freq: 784, startMs: 140, durationMs: 280, gain: 0.22, curve: 2.6 },
        ],
      },
  'foundry.mineComplete': {
        seed: 103,
        layers: [
          { type: 'noise', durationMs: 130, gain: 0.5, attackMs: 2, curve: 3.4, cutoff: 1500 },
          { type: 'tone', wave: 'triangle', freq: 180, freqEnd: 120, durationMs: 150, gain: 0.3, curve: 3 },
        ],
      },
  'foundry.smeltComplete': {
        seed: 109,
        layers: [
          { type: 'tone', wave: 'triangle', freq: 1480, durationMs: 240, gain: 0.24, curve: 3.4 },
          { type: 'tone', wave: 'sine', freq: 2220, startMs: 18, durationMs: 200, gain: 0.14, curve: 4 },
          { type: 'noise', durationMs: 60, gain: 0.3, curve: 5, cutoff: 6000 },
        ],
      },
  'expedition.send': {
        seed: 131,
        layers: [
          { type: 'tone', wave: 'sine', freq: 200, freqEnd: 320, durationMs: 480, gain: 0.3, attackMs: 40, curve: 2 },
          { type: 'noise', durationMs: 300, gain: 0.2, attackMs: 60, curve: 2, cutoff: 1800 },
        ],
      },
  'expedition.reveal': {
        seed: 137,
        layers: [
          { type: 'tone', wave: 'triangle', freq: 440, freqEnd: 880, durationMs: 200, gain: 0.28, curve: 3 },
          { type: 'noise', durationMs: 90, gain: 0.2, curve: 4, cutoff: 5000 },
        ],
      },
  'expedition.collect': {
        seed: 149,
        layers: [
          { type: 'tone', wave: 'sine', freq: 392, durationMs: 340, gain: 0.26, curve: 2.4 },
          { type: 'tone', wave: 'sine', freq: 587, startMs: 90, durationMs: 340, gain: 0.24, curve: 2.4 },
          { type: 'tone', wave: 'sine', freq: 784, startMs: 180, durationMs: 380, gain: 0.22, curve: 2.2 },
        ],
      },
});
