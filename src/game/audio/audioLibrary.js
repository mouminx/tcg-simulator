/**
 * Real assets are imported so Vite hashes and fingerprints them. Encoded by
 * `npm run encode-audio` from the WAV masters in src/assets-original/audio/ — see
 * scripts/encode-audio.mjs for the per-category settings.
 */
// UNCONDITIONAL, and it must stay that way.
//
// A previous version wrapped this in `typeof import.meta.glob === 'function' ? ... : {}` so
// plain Node could import this module. That silently broke every asset-backed sound: Vite
// replaces the *call* with the file map at build time but leaves surrounding code alone, and
// `import.meta.glob` does not exist at runtime — so the guard was always false and the map
// was always `{}`. The build still emitted all the files; nothing ever referenced them.
//
// Node-safety is solved by keeping the placeholder specs in ./audioPlaceholders.js, which
// scripts/verify-audio.mjs imports directly without touching this module.
const AUDIO_FILES = import.meta.glob('../../assets/audio/*.webm', {
  eager: true,
  import: 'default',
});

/** Resolve one encoded file by its sound id, e.g. asset('card.flip', 2). */
function asset(id, variant = null) {
  const name = variant === null ? `${id}.webm` : `${id}.${variant}.webm`;
  const key = Object.keys(AUDIO_FILES).find(k => k.endsWith(`/${name}`));
  return key ? AUDIO_FILES[key] : null;
}

/** Build a `variants` array from however many numbered files actually exist. */
function variantsOf(id, count) {
  return Array.from({ length: count }, (_, i) => asset(id, i + 1))
    .filter(Boolean)
    .map(src => ({ src }));
}

import { SYNTH_SPECS } from './audioPlaceholders';

export const AUDIO_BUSES = Object.freeze({
  master: 'master',
  music: 'music',
  sfx: 'sfx',
  ui: 'ui',
  ambient: 'ambient',
});

export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  muted: false,
  buses: Object.freeze({
    [AUDIO_BUSES.master]: 1,
    [AUDIO_BUSES.music]: 0.8,
    [AUDIO_BUSES.sfx]: 0.9,
    [AUDIO_BUSES.ui]: 0.85,
    [AUDIO_BUSES.ambient]: 0.7,
  }),
});

export const SOUND_IDS = Object.freeze({
  uiClick: 'ui.click',
  uiNav: 'ui.nav',
  uiHover: 'ui.hover',
  uiToggle: 'ui.toggle',
  packBuy: 'pack.buy',
  packOpen: 'pack.open',
  packCollect: 'pack.collect',
  cardFlip: 'card.flip',
  cardPlace: 'card.place',
  rewardClaim: 'reward.claim',
  treasureOpen: 'treasure.open',
  coin: 'reward.coin',
  mineComplete: 'foundry.mineComplete',
  smeltComplete: 'foundry.smeltComplete',
  gatherComplete: 'wilderness.gatherComplete',
  expeditionSend: 'expedition.send',
  expeditionReveal: 'expedition.reveal',
  expeditionCollect: 'expedition.collect',
  gatherChop: 'wilderness.chop',
  ambientWilderness: 'ambient.wilderness',
  ambientFoundry: 'ambient.foundry',
  musicBlacksmith: 'music.blacksmith',
  musicBonfire: 'music.bonfire',
  musicCelebration: 'music.celebration',
  musicEntertainment: 'music.entertainment',
  musicMarked: 'music.marked',
});

/**
 * The two card pools, each encoded once and shared by several sound ids.
 *
 *   CARD_FLIP    single-card handling — a card clicked, picked up, or dropped, and a pack
 *                being bought or placed.
 *   CARDS_RAPID  many cards moving at once — claiming a summon, collecting resource cards.
 *
 * Sharing one pool across ids keeps them audibly related while still allowing per-event
 * volume, voice caps and retrigger windows.
 */
const CARD_FLIP_POOL = variantsOf('pool.cardFlip', 4);
const CARDS_RAPID_POOL = variantsOf('pool.cardsRapid', 3);

/**
 * Interface pools, same one-encode-many-ids arrangement as the card pools.
 *
 *   PAGE_TURN  opening a pack — paper being turned over
 *   UI_BLIP    navigating between views, and pressing buttons generally
 *   UI_PAPER   the Inventory and Hand drawers sliding open and shut
 *
 * `pack.buy` stays on CARD_FLIP (a pack being handled), while `pack.open` is the page turn.
 */
/**
 * Placing a card into a slot. Its own recordings rather than a shared card-handling sound: a card
 * being socketed lands with weight, where a flip is a lighter movement.
 */
const CARD_PLACE_POOL = variantsOf('pool.cardPlace', 2);

const PAGE_TURN_POOL = variantsOf('pool.pageTurn', 4);
const UI_BLIP_POOL = variantsOf('pool.uiBlip', 6);
const UI_PAPER_POOL = variantsOf('pool.uiPaper', 2);

/**
 * Music play order. Starts on **blacksmith**, then rotates through the rest and wraps back
 * to blacksmith. Advanced by the engine on each track's `ended` event — see
 * `playMusicPlaylist`.
 */
export const MUSIC_PLAYLIST = Object.freeze([
  SOUND_IDS.musicBlacksmith,
  SOUND_IDS.musicBonfire,
  SOUND_IDS.musicCelebration,
  SOUND_IDS.musicEntertainment,
  SOUND_IDS.musicMarked,
]);

/**
 * Streamed audio never enters `AUDIO_DEFINITIONS` — it is played through
 * `audioEngine.playStream()`, which uses a MediaElementAudioSourceNode instead of decoding
 * into an AudioBuffer.
 *
 * These are here because they are long: the three ambience beds total 103s of stereo, which
 * as buffers would be **32 MB resident**, and the theme alone would be 71 MB. Streaming
 * makes their length free, which is why the foundry bed can afford 45s from its 5-minute
 * master rather than being cut to fit memory.
 */
export const STREAMED_AUDIO = Object.freeze({
  [SOUND_IDS.ambientWilderness]: {
    bus: AUDIO_BUSES.ambient,
    volume: 0.55,
    // Two 30s takes; one is picked per visit so the bed is not identical every time.
    sources: [asset('ambient.wilderness', 1), asset('ambient.wilderness', 2)].filter(Boolean),
  },
  [SOUND_IDS.ambientFoundry]: {
    bus: AUDIO_BUSES.ambient,
    volume: 0.5,
    sources: [asset('ambient.foundry')].filter(Boolean),
  },
  ...Object.fromEntries(
    ['blacksmith', 'bonfire', 'celebration', 'entertainment', 'marked'].map(name => [
      `music.${name}`,
      {
        bus: AUDIO_BUSES.music,
        volume: 0.7,
        sources: [asset(`music.${name}`)].filter(Boolean),
      },
    ]),
  ),
});

/**
 * ── Sound definitions ─────────────────────────────────────────────────────────
 *
 * Every entry here is a **placeholder**, synthesised at runtime by `audioSynth.js` into a
 * real AudioBuffer. To swap in a shipped asset, replace `synth: {...}` with
 * `src: <imported url>` — nothing else about the definition needs to change, because the
 * engine treats both identically from that point on.
 *
 * Per-sound limits exist because of how this game ticks. The production loop resolves 4
 * mine + 4 gathering + 3 processing + 3 forge slots in a **single frame**, so a completion
 * sound can be asked to fire 14 times at once. Without `maxVoices` and `minRetriggerMs`
 * that is a machine-gun burst plus a level spike the compressor has to duck the whole mix
 * to absorb.
 *
 *   maxVoices        hard cap on simultaneous voices of this sound
 *   minRetriggerMs   requests arriving inside this window are dropped, not queued
 *   detuneJitter     random ± cents per voice, so repeats do not sound mechanical
 */
export const AUDIO_DEFINITIONS = Object.freeze([
  // ── UI ──────────────────────────────────────────────────────────────────────
  {
    id: SOUND_IDS.uiClick,
    bus: AUDIO_BUSES.ui,
    volume: 0.68,
    preload: 'auto',
    maxVoices: 3,
    minRetriggerMs: 40,
    detuneJitter: 60,
    variants: UI_BLIP_POOL,
  },
  {
    // Switching pages. Same menu-nav pool as ui.click but noticeably louder: at 0.5 x the
    // 0.85 ui bus a 100ms blip lands under the music bed (0.8 x 0.7) and reads as silence,
    // which is exactly how this got reported as "nav plays no sound".
    id: SOUND_IDS.uiNav,
    bus: AUDIO_BUSES.ui,
    volume: 0.92,
    preload: 'auto',
    maxVoices: 2,
    minRetriggerMs: 60,
    detuneJitter: 45,
    variants: UI_BLIP_POOL,
  },
  {
    id: SOUND_IDS.uiHover,
    bus: AUDIO_BUSES.ui,
    volume: 0.22,
    preload: 'auto',
    // Sweeping a mouse across the 32-card binder would otherwise fire this continuously.
    maxVoices: 2,
    minRetriggerMs: 70,
    detuneJitter: 90,
    synth: SYNTH_SPECS[SOUND_IDS.uiHover],
  },
  {
    id: SOUND_IDS.uiToggle,
    bus: AUDIO_BUSES.ui,
    volume: 0.45,
    preload: 'auto',
    maxVoices: 2,
    minRetriggerMs: 60,
    detuneJitter: 40,
    variants: UI_PAPER_POOL,
  },

  // ── Packs and cards ─────────────────────────────────────────────────────────
  {
    id: SOUND_IDS.packBuy,
    bus: AUDIO_BUSES.sfx,
    volume: 0.6,
    preload: 'auto',
    maxVoices: 2,
    minRetriggerMs: 90,
    detuneJitter: 30,
    variants: CARD_FLIP_POOL,
  },
  {
    id: SOUND_IDS.packOpen,
    bus: AUDIO_BUSES.sfx,
    volume: 0.7,
    preload: 'auto',
    maxVoices: 1,
    minRetriggerMs: 200,
    variants: PAGE_TURN_POOL,
  },
  {
    id: SOUND_IDS.cardFlip,
    bus: AUDIO_BUSES.sfx,
    volume: 0.4,
    preload: 'auto',
    // Five cards reveal in sequence; without jitter they sound like one machine.
    maxVoices: 4,
    minRetriggerMs: 45,
    detuneJitter: 120,
    variants: CARD_FLIP_POOL,
  },
  {
    id: SOUND_IDS.cardPlace,
    bus: AUDIO_BUSES.sfx,
    volume: 0.5,
    preload: 'auto',
    maxVoices: 3,
    // Raised from 50ms now that the takes run 1.6s and 2.2s rather than being cut at ~0.7s. Two
    // placements 50ms apart would overlap almost entirely and read as mush; you cannot drag cards
    // into slots faster than this anyway.
    minRetriggerMs: 120,
    // Only two takes, so the jitter matters more than usual for keeping repeats from sounding
    // mechanical.
    detuneJitter: 130,
    variants: CARD_PLACE_POOL,
  },

  {
    // Claiming the cards out of an opened pack: many cards at once, so the rapid pool.
    id: SOUND_IDS.packCollect,
    bus: AUDIO_BUSES.sfx,
    volume: 0.62,
    preload: 'auto',
    maxVoices: 1,
    minRetriggerMs: 200,
    variants: CARDS_RAPID_POOL,
  },

  // ── Rewards ─────────────────────────────────────────────────────────────────
  {
    id: SOUND_IDS.coin,
    bus: AUDIO_BUSES.sfx,
    volume: 0.4,
    preload: 'auto',
    maxVoices: 3,
    minRetriggerMs: 55,
    detuneJitter: 150,
    variants: variantsOf(SOUND_IDS.coin, 3),
  },
  {
    id: SOUND_IDS.rewardClaim,
    bus: AUDIO_BUSES.sfx,
    volume: 0.6,
    preload: 'auto',
    maxVoices: 2,
    minRetriggerMs: 120,
    detuneJitter: 40,
    variants: CARDS_RAPID_POOL,
  },
  {
    // Breaking open a treasure cache. Three takes, one picked at random.
    //
    // `maxVoices: 1` and a long retrigger window because this is a 1.7s shimmer under a 1320ms animation —
    // two of them overlapping would be mud, and there is no way to open two caches at once anyway.
    // No `detuneJitter`: the three takes already supply the variety, and pitch-shifting a long tonal
    // shimmer is audible as a wobble rather than as variation (unlike a short percussive click).
    id: SOUND_IDS.treasureOpen,
    bus: AUDIO_BUSES.sfx,
    volume: 0.85,
    preload: 'auto',
    maxVoices: 1,
    minRetriggerMs: 900,
    variants: variantsOf(SOUND_IDS.treasureOpen, 3),
  },

  // ── Production ──────────────────────────────────────────────────────────────
  // Tight caps: the ticker can request these ~14 times in one frame.
  {
    id: SOUND_IDS.mineComplete,
    bus: AUDIO_BUSES.sfx,
    volume: 0.42,
    preload: 'auto',
    maxVoices: 2,
    minRetriggerMs: 140,
    detuneJitter: 140,
    synth: SYNTH_SPECS[SOUND_IDS.mineComplete],
  },
  {
    id: SOUND_IDS.smeltComplete,
    bus: AUDIO_BUSES.sfx,
    volume: 0.44,
    preload: 'auto',
    maxVoices: 2,
    minRetriggerMs: 140,
    detuneJitter: 120,
    synth: SYNTH_SPECS[SOUND_IDS.smeltComplete],
  },
  {
    id: SOUND_IDS.gatherComplete,
    bus: AUDIO_BUSES.sfx,
    volume: 0.4,
    preload: 'manual',
    maxVoices: 2,
    minRetriggerMs: 140,
    detuneJitter: 160,
    variants: variantsOf(SOUND_IDS.gatherComplete, 3),
  },
  {
    // Lumberjacks chop; foragers and hunters rustle. The ticker already knows which class
    // completed, so the Wilderness can sound like the work being done.
    id: SOUND_IDS.gatherChop,
    bus: AUDIO_BUSES.sfx,
    volume: 0.42,
    preload: 'manual',
    maxVoices: 2,
    minRetriggerMs: 140,
    detuneJitter: 130,
    variants: variantsOf(SOUND_IDS.gatherChop, 4),
  },

  // ── Expedition ──────────────────────────────────────────────────────────────
  {
    id: SOUND_IDS.expeditionSend,
    bus: AUDIO_BUSES.sfx,
    volume: 0.62,
    preload: 'manual',
    maxVoices: 1,
    minRetriggerMs: 300,
    synth: SYNTH_SPECS[SOUND_IDS.expeditionSend],
  },
  {
    id: SOUND_IDS.expeditionReveal,
    bus: AUDIO_BUSES.sfx,
    volume: 0.5,
    preload: 'manual',
    maxVoices: 2,
    minRetriggerMs: 90,
    detuneJitter: 90,
    synth: SYNTH_SPECS[SOUND_IDS.expeditionReveal],
  },
  {
    id: SOUND_IDS.expeditionCollect,
    bus: AUDIO_BUSES.sfx,
    volume: 0.62,
    preload: 'manual',
    maxVoices: 1,
    minRetriggerMs: 220,
    synth: SYNTH_SPECS[SOUND_IDS.expeditionCollect],
  },

  // Ambience and music are NOT defined here — they are streamed. See STREAMED_AUDIO above.
]);

/**
 * A definition with no `src`, no `variants` and no `synth` produces silence with no error —
 * which is exactly how the `import.meta.glob` guard bug hid for a whole round. Surfacing it
 * at startup turns that class of mistake into a visible warning.
 */
export function findSilentDefinitions(definitions = AUDIO_DEFINITIONS) {
  const silent = definitions
    .filter(d => !d.src && !d.synth && !(d.variants?.length > 0))
    .map(d => d.id);
  // Streamed entries are not in AUDIO_DEFINITIONS, so they need checking separately —
  // ambience and music going silent is precisely the failure this guard exists to catch.
  const silentStreams = Object.entries(STREAMED_AUDIO)
    .filter(([, config]) => !(config.sources?.length > 0))
    .map(([id]) => id);
  return [...silent, ...silentStreams];
}

export function normalizeAudioSettings(input = {}) {
  const buses = {
    ...DEFAULT_AUDIO_SETTINGS.buses,
    ...(input.buses ?? {}),
  };

  const clampedBuses = Object.fromEntries(
    Object.entries(buses).map(([bus, value]) => [bus, clampUnitVolume(value)]),
  );

  return {
    muted: Boolean(input.muted),
    buses: clampedBuses,
  };
}

function clampUnitVolume(value) {
  const numeric = Number.isFinite(value) ? value : 1;
  return Math.max(0, Math.min(1, numeric));
}
