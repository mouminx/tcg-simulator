import { AUDIO_BUSES, AUDIO_DEFINITIONS, DEFAULT_AUDIO_SETTINGS, MUSIC_PLAYLIST, STREAMED_AUDIO, normalizeAudioSettings } from './audioLibrary';
import { renderSynthBuffer } from './audioSynth';

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function createAudioContext() {
  const AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return AudioContextCtor ? new AudioContextCtor() : null;
}

class AudioEngine {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.busGains = new Map();
    this.outputCompressor = null;
    this.registry = new Map();
    this.bufferCache = new Map();
    this.pendingBufferLoads = new Map();
    this.activeVoices = new Map();
    this.settings = normalizeAudioSettings(DEFAULT_AUDIO_SETTINGS);
    this.unlocked = false;
    this.voiceSeed = 0;
    // soundId -> last start timestamp, for the retrigger throttle.
    this.lastTriggerAt = new Map();
    // soundId -> Set of live voiceIds, for the per-sound polyphony cap.
    this.voicesBySound = new Map();
    // Streaming sources (music / long ambience) keyed by id.
    this.streams = new Map();
    this.currentAmbienceId = null;
    this.currentAmbienceVoice = null;
    this.playlist = null;
  }

  isSupported() {
    return Boolean(globalThis.AudioContext ?? globalThis.webkitAudioContext);
  }

  register(definition) {
    if (!definition?.id) return;
    this.registry.set(definition.id, {
      bus: AUDIO_BUSES.sfx,
      volume: 1,
      loop: false,
      playbackRate: 1,
      preload: 'manual',
      variants: [],
      // Limiter defaults. Generous enough not to interfere with one-off sounds, but
      // present on every sound so nothing can machine-gun by omission.
      maxVoices: 4,
      minRetriggerMs: 0,
      detuneJitter: 0,
      ...definition,
    });
  }

  registerMany(definitions = AUDIO_DEFINITIONS) {
    definitions.forEach(definition => this.register(definition));
  }

  getSettings() {
    return this.settings;
  }

  configure(nextSettings) {
    this.settings = normalizeAudioSettings(nextSettings);
    this.#applyVolumes();
  }

  setMuted(muted) {
    this.configure({ ...this.settings, muted });
  }

  setBusVolume(bus, volume) {
    this.configure({
      ...this.settings,
      buses: {
        ...this.settings.buses,
        [bus]: volume,
      },
    });
  }

  async unlock() {
    const context = this.#ensureContext();
    if (!context) return false;
    if (context.state === 'suspended') {
      await context.resume();
    }
    this.unlocked = context.state === 'running';
    return this.unlocked;
  }

  async suspend() {
    if (!this.context || this.context.state !== 'running') return false;
    await this.context.suspend();
    return true;
  }

  async preload(ids = null) {
    const targetIds = ids ?? [...this.registry.entries()]
      .filter(([, definition]) => definition.preload === 'auto')
      .map(([id]) => id);

    // Every variant of every target. Loading only `definition.src` silently skipped all
    // pooled sounds, since those carry `variants` instead — so their first press was always
    // dropped, which is how "the nav makes no sound" got reported.
    const jobs = [];
    for (const id of targetIds) {
      const definition = this.registry.get(id);
      if (!definition) continue;
      const variants = definition.variants ?? [];
      if (variants.length > 0) {
        for (const variant of variants) jobs.push(this.#loadBuffer(id, variant.src));
      } else {
        jobs.push(this.#loadBuffer(id));
      }
    }
    await Promise.all(jobs.map(job => job.catch(() => null)));
  }

  /**
   * Fire a sound. Returns a voice id, or null if the sound was suppressed.
   *
   * Suppression is deliberate and silent. A request can be dropped because the sound
   * retriggered too soon, because it is already at its voice cap, or because its buffer is
   * not loaded yet. That last case matters for UI: a click sound that arrives 200ms late is
   * worse than no click sound, so we drop it and kick off the load for next time.
   */
  play(id, options = {}) {
    const definition = this.registry.get(id);
    if (!definition) return null;
    if (this.settings.muted && !options.ignoreMute) return null;

    const context = this.#ensureContext();
    if (!context) return null;

    const variant = this.#resolveVariant(definition);

    // ── Retrigger throttle ──────────────────────────────────────────────────
    const minRetrigger = options.minRetriggerMs ?? definition.minRetriggerMs ?? 0;
    const now = nowMs();
    if (minRetrigger > 0) {
      const last = this.lastTriggerAt.get(id) ?? -Infinity;
      if (now - last < minRetrigger) return null;
    }

    // ── Polyphony cap ───────────────────────────────────────────────────────
    // Oldest-wins would cut the sound the player just triggered, so newest is dropped.
    const maxVoices = options.maxVoices ?? definition.maxVoices ?? 4;
    const live = this.voicesBySound.get(id);
    if (live && live.size >= maxVoices) return null;

    const buffer = this.bufferCache.get(this.#bufferKey(id, variant.src ?? definition.src ?? null));
    if (!buffer) {
      // Not resident yet. Start the load so the next request lands, and drop this one.
      void this.#loadBuffer(id, variant.src ?? definition.src);
      return null;
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    const busName = options.bus ?? variant.bus ?? definition.bus ?? AUDIO_BUSES.sfx;
    const busGain = this.busGains.get(busName) ?? this.masterGain;
    if (!busGain) return null;

    const playbackRate = options.playbackRate ?? variant.playbackRate ?? definition.playbackRate ?? 1;
    const volume = this.#resolveVoiceVolume(definition, variant, options);
    const loop = options.loop ?? variant.loop ?? definition.loop ?? false;
    const fadeInMs = Math.max(0, options.fadeInMs ?? 0);
    const offset = Math.max(0, options.offset ?? 0);

    source.buffer = buffer;
    source.loop = loop;
    source.playbackRate.value = playbackRate;

    // Small random detune per voice. This is the cheapest defence against repeated sounds
    // reading as mechanical — five card flips in a reveal with identical pitch sound like
    // one machine; +/- a few dozen cents and they sound like five cards.
    const jitter = options.detuneJitter ?? definition.detuneJitter ?? 0;
    const detune = Number.isFinite(options.detune)
      ? options.detune
      : (jitter > 0 ? (Math.random() * 2 - 1) * jitter : 0);
    if (detune !== 0) source.detune.value = detune;

    const voiceId = `voice-${++this.voiceSeed}`;
    const startAt = context.currentTime + Math.max(0, (options.delayMs ?? 0) / 1000);

    source.connect(gain);
    gain.connect(busGain);

    if (fadeInMs > 0) {
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(volume, startAt + fadeInMs / 1000);
    } else {
      gain.gain.setValueAtTime(volume, startAt);
    }

    const cleanup = () => {
      this.activeVoices.delete(voiceId);
      this.voicesBySound.get(id)?.delete(voiceId);
      source.onended = null;
      try { source.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
      options.onEnded?.();
    };

    source.onended = cleanup;

    this.activeVoices.set(voiceId, {
      id: voiceId,
      soundId: id,
      source,
      gain,
      bus: busName,
      startedAt: nowMs(),
      loop,
    });

    if (!this.voicesBySound.has(id)) this.voicesBySound.set(id, new Set());
    this.voicesBySound.get(id).add(voiceId);
    this.lastTriggerAt.set(id, now);

    // `duration` is what makes audio sprites work: without it an offset into an atlas
    // plays to the end of the whole atlas rather than just its slice.
    const duration = options.duration ?? variant.duration ?? definition.duration ?? null;
    if (duration !== null) source.start(startAt, offset, duration);
    else source.start(startAt, offset);

    return voiceId;
  }

  /**
   * Streamed playback for music and long ambience.
   *
   * These must never go through `play()`. An AudioBuffer holds decoded float32 PCM at
   * sampleRate x channels x 4 bytes per second — a 3-minute stereo 48kHz track is ~69 MB
   * resident, which is worse than any image in the game. A MediaElementAudioSourceNode
   * streams instead, while still routing through the bus mixer so volume control and the
   * output compressor apply exactly as they do to buffered sounds.
   */
  playStream(id, { src, bus = AUDIO_BUSES.music, volume = 1, loop = true, fadeInMs = 600, onEnded = null } = {}) {
    const context = this.#ensureContext();
    if (!context || !src) return null;

    this.stopStream(id, { fadeOutMs: 200 });

    const element = new Audio();
    element.src = src;
    element.loop = loop;
    // Deliberately NOT setting crossOrigin: these assets are same-origin, and requesting a
    // CORS fetch would break the packaged Electron build, which serves over file://.
    element.preload = 'auto';

    const node = context.createMediaElementSource(element);
    const gain = context.createGain();
    const busGain = this.busGains.get(bus) ?? this.masterGain;
    if (!busGain) return null;

    node.connect(gain);
    gain.connect(busGain);

    const start = context.currentTime;
    if (fadeInMs > 0) {
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + fadeInMs / 1000);
    } else {
      gain.gain.setValueAtTime(volume, start);
    }

    if (onEnded) {
      element.addEventListener('ended', onEnded, { once: true });
    }

    this.streams.set(id, { element, node, gain, bus, onEnded });
    void element.play().catch(() => {
      // Autoplay refused until the context is unlocked; the caller can retry after unlock.
    });
    return id;
  }

  stopStream(id, { fadeOutMs = 400 } = {}) {
    const stream = this.streams.get(id);
    if (!stream || !this.context) return false;
    this.streams.delete(id);

    const teardown = () => {
      // Detach first: a paused/reset element can still emit `ended`, which would advance the
      // playlist a second time.
      if (stream.onEnded) stream.element.removeEventListener('ended', stream.onEnded);
      try { stream.element.pause(); } catch {}
      try { stream.node.disconnect(); } catch {}
      try { stream.gain.disconnect(); } catch {}
      stream.element.src = '';
    };

    if (fadeOutMs > 0) {
      const end = this.context.currentTime + fadeOutMs / 1000;
      stream.gain.gain.cancelScheduledValues(this.context.currentTime);
      stream.gain.gain.setValueAtTime(stream.gain.gain.value, this.context.currentTime);
      stream.gain.gain.linearRampToValueAtTime(0, end);
      window.setTimeout(teardown, fadeOutMs + 60);
    } else {
      teardown();
    }
    return true;
  }

  /**
   * Crossfade the ambience bed.
   *
   * Ambience is **streamed**, not buffered — the three beds total 103 seconds of stereo,
   * which as AudioBuffers would be 32 MB resident. `playStream` and `stopStream` each fade,
   * so calling both crossfades.
   *
   * Idempotent, so it can be driven straight from a view-change effect with no guarding.
   * Pass null to fade out to silence.
   */
  setAmbience(id, { fadeMs = 900 } = {}) {
    if (id === this.currentAmbienceId) return;

    const previous = this.currentAmbienceId;
    this.currentAmbienceId = id;
    if (previous) this.stopStream(previous, { fadeOutMs: fadeMs });
    if (!id) return;

    const config = STREAMED_AUDIO[id];
    if (!config?.sources?.length) return;
    // Pick among takes so revisiting a view is not identical every time.
    const src = config.sources[Math.floor(Math.random() * config.sources.length)];
    this.playStream(id, {
      src,
      bus: config.bus,
      volume: config.volume ?? 1,
      loop: true,
      fadeInMs: fadeMs,
    });
  }

  /** Start one streamed music track by its SOUND_IDS key. */
  playMusic(id, { fadeInMs = 1200, loop = true, onEnded = null } = {}) {
    const config = STREAMED_AUDIO[id];
    if (!config?.sources?.length) return null;
    // The one-track invariant lives here rather than in #playPlaylistEntry, so it holds for
    // *any* caller. `playStream` only replaces the same id, so nothing else stops two
    // different music ids coexisting.
    this.#stopBus(AUDIO_BUSES.music, { except: id, fadeOutMs: 600 });
    return this.playStream(id, {
      src: config.sources[0],
      bus: config.bus,
      volume: config.volume ?? 1,
      loop,
      fadeInMs,
      onEnded,
    });
  }

  /**
   * Play through the music playlist, wrapping at the end.
   *
   * Each track streams with `loop: false` and advances on its `ended` event, so the
   * rotation is driven by actual playback rather than a timer — no drift, and no need to
   * know track durations. Wrapping is just modulo, so it returns to the first track
   * (blacksmith) after the last.
   */
  playMusicPlaylist(tracks = MUSIC_PLAYLIST, { startAt = 0, fadeInMs = 1600, restart = false } = {}) {
    const list = tracks.filter(id => STREAMED_AUDIO[id]?.sources?.length > 0);
    if (list.length === 0) return false;
    // Idempotent: a playlist already running is left alone. Callers race — `unlockAudio` is
    // async, so two quick pointer events can both reach here before either finishes, and a
    // StrictMode remount rebuilds any caller-side guard from scratch. Making the engine
    // authoritative means no caller can start a second playlist by accident.
    if (this.playlist && !restart) return false;

    this.playlist = { list, index: ((startAt % list.length) + list.length) % list.length };
    this.#playPlaylistEntry(fadeInMs);
    return true;
  }

  /** Skip to the next track immediately. */
  nextTrack({ fadeMs = 900 } = {}) {
    if (!this.playlist) return false;
    this.stopStream(this.playlist.list[this.playlist.index], { fadeOutMs: fadeMs });
    this.playlist.index = (this.playlist.index + 1) % this.playlist.list.length;
    this.#playPlaylistEntry(fadeMs);
    return true;
  }

  stopMusic({ fadeOutMs = 1200 } = {}) {
    const had = this.playlist !== null;
    this.playlist = null;
    // Clear the bus rather than the one id we believe is current, so this cannot leave a
    // stream behind if bookkeeping and reality ever disagree.
    this.#stopBus(AUDIO_BUSES.music, { fadeOutMs });
    return had;
  }

  /** Stop every stream on one bus. `except` spares a single id. */
  #stopBus(bus, { except = null, fadeOutMs = 400 } = {}) {
    for (const [id, stream] of [...this.streams] ) {
      if (stream.bus === bus && id !== except) this.stopStream(id, { fadeOutMs });
    }
  }

  #playPlaylistEntry(fadeInMs) {
    const playlist = this.playlist;
    if (!playlist) return;
    const id = playlist.list[playlist.index];
    this.playMusic(id, {
      fadeInMs,
      loop: false,
      onEnded: () => {
        // Discard the finished stream. Nothing else does: it stopped on its own, so
        // stopStream was never called, and a dead element sitting in `this.streams` gets
        // revived by the unmute sweep in updateSettings — audibly, under the next track.
        this.stopStream(id, { fadeOutMs: 0 });
        // Ignore a stale callback from a track we already moved past.
        if (this.playlist !== playlist) return;
        if (playlist.list[playlist.index] !== id) return;
        playlist.index = (playlist.index + 1) % playlist.list.length;
        this.#playPlaylistEntry(1200);
      },
    });
  }

  stop(voiceId, options = {}) {
    const voice = this.activeVoices.get(voiceId);
    if (!voice || !this.context) return false;

    const fadeOutMs = Math.max(0, options.fadeOutMs ?? 0);
    if (fadeOutMs > 0) {
      const stopAt = this.context.currentTime + fadeOutMs / 1000;
      voice.gain.gain.cancelScheduledValues(this.context.currentTime);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, this.context.currentTime);
      voice.gain.gain.linearRampToValueAtTime(0, stopAt);
      voice.source.stop(stopAt);
    } else {
      voice.source.stop();
    }
    return true;
  }

  stopBus(busName, options = {}) {
    [...this.activeVoices.values()]
      .filter(voice => voice.bus === busName)
      .forEach(voice => this.stop(voice.id, options));
  }

  stopAll(options = {}) {
    [...this.activeVoices.keys()].forEach(voiceId => this.stop(voiceId, options));
  }

  /**
   * Tear down every stream and voice. `stopAll` only ever covered buffered voices, so music
   * and ambience survived it — which mattered for HMR (see the dispose hook at the bottom of
   * this file), because a hot module swap left the previous engine's <audio> elements playing.
   */
  destroy() {
    this.playlist = null;
    this.stopAll({ fadeOutMs: 0 });
    for (const id of [...this.streams.keys()]) this.stopStream(id, { fadeOutMs: 0 });
    this.currentAmbienceId = null;
    try { void this.context?.close(); } catch { /* already closed */ }
  }

  async playTone({
    frequency = 440,
    type = 'sine',
    durationMs = 120,
    bus = AUDIO_BUSES.ui,
    volume = 0.15,
  } = {}) {
    const context = this.#ensureContext();
    if (!context) return null;

    const busGain = this.busGains.get(bus) ?? this.masterGain;
    if (!busGain) return null;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const voiceId = `tone-${++this.voiceSeed}`;
    const startAt = context.currentTime;
    const stopAt = startAt + durationMs / 1000;

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(volume, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    oscillator.connect(gain);
    gain.connect(busGain);
    oscillator.onended = () => {
      this.activeVoices.delete(voiceId);
      try { oscillator.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };

    this.activeVoices.set(voiceId, {
      id: voiceId,
      soundId: 'tone',
      source: oscillator,
      gain,
      bus,
      startedAt: nowMs(),
      loop: false,
    });

    oscillator.start(startAt);
    oscillator.stop(stopAt);
    return voiceId;
  }

  #ensureContext() {
    if (this.context) return this.context;
    this.context = createAudioContext();
    if (!this.context) return null;

    this.outputCompressor = this.context.createDynamicsCompressor();
    this.outputCompressor.threshold.value = -10;
    this.outputCompressor.knee.value = 14;
    this.outputCompressor.ratio.value = 8;
    this.outputCompressor.attack.value = 0.003;
    this.outputCompressor.release.value = 0.2;

    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.outputCompressor);
    this.outputCompressor.connect(this.context.destination);

    Object.values(AUDIO_BUSES).forEach(bus => {
      if (bus === AUDIO_BUSES.master) return;
      const gain = this.context.createGain();
      gain.connect(this.masterGain);
      this.busGains.set(bus, gain);
    });

    this.#applyVolumes();
    return this.context;
  }

  /** Live voice count, for diagnostics and tests. */
  getVoiceCount(soundId = null) {
    if (soundId) return this.voicesBySound.get(soundId)?.size ?? 0;
    return this.activeVoices.size;
  }

  #applyVolumes() {
    if (!this.masterGain) return;
    const settings = this.settings;
    const masterVolume = settings.muted ? 0 : settings.buses[AUDIO_BUSES.master];
    this.masterGain.gain.setValueAtTime(masterVolume, this.context.currentTime);

    this.busGains.forEach((gain, bus) => {
      const value = settings.muted ? 0 : (settings.buses[bus] ?? 1);
      gain.gain.setValueAtTime(value, this.context.currentTime);
    });

    // Streams route through the same bus gains, so they are already covered — but a
    // suspended context would keep a <audio> element decoding in the background, so pause
    // them explicitly when muted.
    this.streams.forEach(stream => {
      if (settings.muted) stream.element.pause();
      // `ended` elements restart from zero when played, which would stack a finished track on
      // top of the current one. Only resume something that was actually mid-playback.
      else if (!stream.element.ended) void stream.element.play().catch(() => {});
    });
  }

  #resolveVariant(definition) {
    const variants = definition.variants ?? [];
    if (variants.length === 0) return definition;
    const index = Math.floor(Math.random() * variants.length);
    return { ...definition, ...variants[index] };
  }

  #resolveVoiceVolume(definition, variant, options) {
    const base = options.volume ?? variant.volume ?? definition.volume ?? 1;
    return Math.max(0, Math.min(2, base));
  }

  /**
   * Cache key for one playable buffer.
   *
   * Keyed by SOURCE, not by sound id, and that distinction is load-bearing. Keyed by id, a
   * multi-variant sound could only ever hold one buffer: `play()` picked a random variant,
   * found the single cached entry and used it, so every card flip after the first played the
   * same file for the rest of the session — the variant recordings were fetched and then
   * ignored. It also made `preload()` a no-op for those sounds, because they carry `variants`
   * and no `src`, so the first press of each was always dropped and silent.
   *
   * Two sound ids sharing a pool (see the CARD_FLIP / CARDS_RAPID / UI pools) now also share
   * the decoded buffers, which is a free win.
   */
  #bufferKey(id, src) {
    return src ?? `synth:${id}`;
  }

  async #loadBuffer(id, explicitSrc = null) {
    const key = this.#bufferKey(id, explicitSrc ?? this.registry.get(id)?.src ?? null);
    if (this.bufferCache.has(key)) return this.bufferCache.get(key);
    if (this.pendingBufferLoads.has(key)) return this.pendingBufferLoads.get(key);

    const definition = this.registry.get(id);
    const src = explicitSrc ?? definition?.src;

    const context = this.#ensureContext();
    if (!context) return null;

    // Placeholder sounds are rendered rather than fetched. The result is a normal
    // AudioBuffer cached under the same key, so every downstream path — limiter, jitter,
    // bus routing, sprites — behaves identically to a shipped asset.
    if (!src && definition?.synth) {
      const rendered = renderSynthBuffer(context, definition.synth);
      if (rendered) this.bufferCache.set(key, rendered);
      return rendered;
    }

    if (!src) return null;

    const loadPromise = fetch(src)
      .then(response => {
        if (!response.ok) throw new Error(`Failed to load audio asset: ${src}`);
        return response.arrayBuffer();
      })
      .then(arrayBuffer => context.decodeAudioData(arrayBuffer.slice(0)))
      .then(buffer => {
        this.bufferCache.set(key, buffer);
        this.pendingBufferLoads.delete(key);
        return buffer;
      })
      .catch(error => {
        this.pendingBufferLoads.delete(key);
        console.error(error);
        return null;
      });

    this.pendingBufferLoads.set(key, loadPromise);
    return loadPromise;
  }
}

/**
 * ONE engine per page, held on `globalThis` rather than in module scope.
 *
 * This is not defensive style — it fixes a reproducible bug. Editing anything in the audio
 * graph makes Vite hot-replace the module, and because neither this module nor audioLibrary
 * calls `import.meta.hot.accept`, Vite propagates the update *past* them to the nearest
 * boundary (App.jsx, via react-refresh) and re-imports the whole subtree. That produces a
 * second AudioEngine with a second AudioContext, while the first one's `<audio>` elements
 * carry on playing because nothing holds a reference that could stop them. The new engine then
 * starts the playlist from its own unlock handler and you hear **two theme tracks at once**,
 * stacking one more with every edit — measured going 1 -> 2 -> 3.
 *
 * An `import.meta.hot.dispose` hook here does NOT help: dispose only runs for modules that are
 * themselves the update boundary, and this one never is.
 *
 * Keying the instance on globalThis means a re-evaluated module reuses the engine that is
 * already playing, so a duplicate cannot exist. The trade-off is that changes to the engine's
 * own *logic* need a full page reload to take effect, since the singleton keeps the class it
 * was built from. That is the normal cost of a stateful singleton under HMR, and far cheaper
 * than audio that silently doubles while you work.
 */
const ENGINE_KEY = '__cardsOfArcanaAudioEngine';

export const audioEngine = globalThis[ENGINE_KEY]
  ?? (globalThis[ENGINE_KEY] = new AudioEngine());

// Dev-only handle. Audio state is otherwise unreachable from the console — the streams are
// `new Audio()` elements that never enter the DOM — which makes "is anything playing, and
// what?" impossible to answer while debugging. Stripped from production builds.
if (import.meta.env.DEV) {
  window.__audio = audioEngine;
}
