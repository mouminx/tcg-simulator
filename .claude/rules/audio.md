---
paths:
  - "src/game/audio/**"
  - "scripts/encode-audio.mjs"
  - "scripts/verify-audio.mjs"
  - "src/components/AudioSettings.jsx"
---

<!-- Path-scoped rule: loads only when Claude touches the files above. Split out of a single
     3,335-line CLAUDE.md, which was ~45k tokens in every session before any work began. -->

# Audio

The audio engine, the encode pipeline, and the traps that have made sounds silently not play.

> Cross-cutting invariants (scroll ownership, the CSS ordering trap, the save shape, the gold
> seam, card identity, performance) live in the root `CLAUDE.md`, which is always loaded.

## Audio

```text
src/game/audio/
  audioEngine.js    mixer, voice management, buffer cache, streaming
  audioLibrary.js   buses, settings, SOUND_IDS, AUDIO_DEFINITIONS
  audioSynth.js     procedural buffer rendering (placeholders)
src/components/AudioSettings.jsx   header mixer popover
scripts/verify-audio.mjs           npm run verify-audio
```

Native Web Audio, no library. Five buses (master / music / sfx / ui / ambient) into a
`DynamicsCompressor` into `destination` — the compressor is what stops level spiking when
many voices stack. Lazy `AudioContext`, unlocked on first interaction. Settings persist in
`audioSettings`.

**Target is Chromium only** (Chrome, Edge, Electron). Opus-in-WebM with no AAC fallback.
Adding Safari means dual-encoding and a runtime `canPlayType` pick.

### Real assets vs placeholders

**11 of 17 sounds are real files**; the rest are still synthesised. Both kinds coexist in
`AUDIO_DEFINITIONS` and behave identically downstream.

| Real (from `SFX/` masters) | Still synthesised |
|---|---|
| `card.flip`, `card.place`, `pack.buy`, `pack.open`, `pack.collect`, `reward.claim`, `reward.coin` ×3, `wilderness.gatherComplete` ×3, `wilderness.chop` ×4 | the three `ui.*`, `foundry.mineComplete`, `foundry.smeltComplete`, the three `expedition.*` |
| `ambient.wilderness` ×2, `ambient.foundry`, 5 music tracks — **streamed**, in `STREAMED_AUDIO` | |

### The two card pools

Card audio comes from two pools, each encoded **once** under a `pool.*` id and referenced by
several sound ids. Encoding per-sound would duplicate the same seven files six times.

| Pool | Files | Used for |
|---|---|---|
| `CARD_FLIP_POOL` | `pool.cardFlip` ×4 | a **single card** moving — clicked, picked up, dropped — and a pack being bought or placed. Sound ids: `card.flip`, `card.place`, `pack.buy`, `pack.open` |
| `CARDS_RAPID_POOL` | `pool.cardsRapid` ×3 | **many cards at once** — claiming a summon, collecting resource cards. Sound ids: `pack.collect`, `reward.claim` |

Sharing a pool keeps related events audibly consistent while still allowing per-event volume,
voice caps and retrigger windows.

**Cards are `div`s, not `button`s**, so the delegated click listener in `App.jsx` never sees
them. Card click and drag-pickup sounds are wired explicitly in `Collection.jsx` and
`CardPocket.jsx`. Anything new that should click needs the same treatment or a `button`.

### Music playlist

`MUSIC_PLAYLIST` in `audioLibrary.js` defines the order: **blacksmith** first, then bonfire,
celebration, entertainment, marked, wrapping back to blacksmith.

`playMusicPlaylist()` streams each track with `loop: false` and advances on its **`ended`
event** — driven by real playback rather than a timer, so there is no drift and no need to
know track durations. It starts from the audio-unlock handler, since browsers refuse media
playback before a user gesture.

`nextTrack()` skips; `stopMusic()` fades out and clears the playlist. `stopStream` detaches
the `ended` listener before pausing, because a paused element can still emit `ended` and
would otherwise advance the playlist twice.

#### One track at a time is an enforced invariant

Two tracks were audible at once, and it took three separate faults to allow it. `playStream`
only replaces the *same* id, so nothing stopped two different music ids coexisting. The fix
is structural rather than a guard at each call site:

1. **`playMusicPlaylist` is idempotent.** A playlist already running is left alone. Callers
   race — `unlockAudio` is `await`ed, so two quick pointer events can both pass a caller-side
   flag before either sets it, and a React StrictMode remount rebuilds any such flag from
   scratch. The engine is authoritative; `App.jsx` holds no flag.
2. **Every track start clears the music bus** via `#stopBus(AUDIO_BUSES.music, {except: id})`,
   so the invariant is enforced in the one place tracks begin.
3. **A finished stream is discarded in its own `onEnded`.** Nothing else did: it stopped on
   its own, so `stopStream` was never called, and a dead element left in `this.streams` got
   **revived by the unmute sweep** in `configure` — audibly, underneath the next track. That
   sweep now skips elements whose `ended` is true, since playing an ended element restarts it
   from zero.

`stopMusic` clears the bus rather than the one id it believes is current, so it cannot leave
a stream behind if bookkeeping and reality disagree.

#### `window.__audio` in dev

`audioEngine.js` exposes the engine on `window.__audio` under `import.meta.env.DEV`. Streams
are `new Audio()` elements that never enter the DOM, so "is anything playing, and what?" is
otherwise unanswerable from the console. Stripped from production builds.

`Main Theme SFX.wav` is **not** encoded — it is listed in `IGNORED` in the encode script,
since blacksmith is now the main theme. Its purpose is unresolved.

`wilderness.chop` is chosen over `gatherComplete` when a **lumberjack** completes a
gathering cycle — the ticker already knows which card finished, so the Wilderness sounds
like the work being done.

### The asset pipeline

```bash
brew install ffmpeg      # required
npm run encode-audio     # src/assets-original/audio/*.wav -> src/assets/audio/*.webm
npm run verify-audio     # checks the synthesised specs
```

`scripts/encode-audio.mjs` reads gitignored WAV masters and writes Opus/WebM, mirroring how
`optimize-assets.mjs` handles images — always from masters, never its own output. **109 MB of
WAV becomes 4.04 MB shipped.**

Per category it applies two-pass EBU R128 `loudnorm` (which is why rough recordings need no
mastering — every sound lands at a consistent level so per-sound `volume` stays near 1),
mono downmix for SFX, and silence trimming. Add new sounds by extending `MAP` in that script;
prefix-matched files become numbered variants automatically.

**`measureSeconds` decouples the loudness window from the encoded one.** Only needed for a
percussive one-shot with a long decay: loudnorm targets *integrated* (mean) loudness, so the more
quiet tail you include the harder it boosts the attack to hit the target. Extending the placement
thuds from ~0.7s to 1.6s/2.2s so they could ring out pushed their peaks from about -2 dB to 0.0 dB —
clipped, and audibly louder than everything else. Setting `measureSeconds` to the *old* clip length
measures the attack and body, encodes the whole decay, and lands the level exactly where it was.
It defaults to the encoded length, which is what every other entry wants — measuring a region you
are NOT encoding mis-levels it badly when the excerpt is deliberately the loudest part of the take,
which is the `cards_rapid` lesson and still holds.

Note the shipped `pool.cardPlace.*` and `wilderness.chop.1` both peak at **0.0 dB** rather than the
project's stated -1 dBTP. That predates the tail change (identical measurement window means identical
loudnorm gain) and comes from Opus overshoot on percussive content past a -1.0 dBTP source ceiling.
Fixing it properly means lowering `TP` in the loudnorm calls, which re-levels every sound in the
game — worth doing deliberately, not as a side effect.

**`clipSeconds` vs `trim`** — these solve different problems and the distinction matters.
`trim` removes silence, which worked on `card_sfx` (1.14s → 0.22s, it had 0.49s of leading
silence). But the axe and bush masters are **5 seconds of continuous multi-strike content**
with no silence to find, so a single strike has to be *excerpted* with `clipSeconds`. Check
a source's actual envelope before assuming it is a padded one-shot.

### Encoding gotchas that cost real time

- **libopus only accepts 8/12/16/24/48 kHz.** The `ui` preset carried `rate: 32000` and
  failed outright; it went unnoticed because no MAP entry used that preset until the
  interface pools arrived.
- **Loudness must be measured over the region that gets encoded.** `regionArgs` builds the
  `-ss`/`-t` pair once and both loudnorm passes use it. Measuring a whole 2.4s take and
  applying the result to a 0.7s excerpt mis-levels it badly — especially when the excerpt is
  deliberately the loudest part.
- **A recording that builds up needs excerpting, not trimming.** `silenceremove` only removes
  what is below its threshold; it cannot help a take that opens at -18 dB and peaks at 1.7s.
  `cards_rapid` did exactly that, so pressing Collect gave a faint sound with the actual
  riffle arriving ~1.8s later, which read as lag. `perFile` overrides give each variant its
  own window around its own loudest moment.

### Vite inlines small assets — audio must opt out

`vite.config.js` sets `assetsInlineLimit` to return `false` for audio extensions. Vite
inlines assets under 4 KB as base64, which silently swallowed four encoded SFX into the JS
bundle. Base64 inflates ~33% and moves bytes into the eagerly-parsed bundle. Without that
opt-out those sounds still work, but they are in the wrong place.

### The synthesised placeholders

`AUDIO_DEFINITIONS` entries carry a `synth: {...}` spec instead of `src`/`variants`,
rendered by `audioSynth.js` into a real mono `AudioBuffer`. That is deliberate: a synthesised
buffer takes the **same path a shipped file does** — same limiter, jitter, bus routing,
cache, sprite handling. Swapping one for a real asset is a one-line change to
`variants: variantsOf(id, n)`, which is exactly how the 11 real sounds landed.

### Do not guard `import.meta.glob`

`audioLibrary.js` calls `import.meta.glob` **unconditionally**, and it has to stay that way.

An earlier version wrapped it in `typeof import.meta.glob === 'function' ? … : {}` so plain
Node could import the module for `verify-audio`. That silently killed **every asset-backed
sound** — ambience, music and all 11 real SFX. Vite replaces the *call* with the file map at
build time but leaves the surrounding expression alone, and `import.meta.glob` does not exist
at runtime, so the guard was always false and the map was always `{}`. The build still emitted
all 21 files; nothing ever referenced them.

Node-safety is instead solved structurally: the placeholder specs live in
`audioPlaceholders.js`, which has **zero imports**, and `verify-audio` imports that plus
`audioSynth.js` — never `audioLibrary.js`.

Two things guard against a repeat:

- **`findSilentDefinitions()`** runs at startup and warns for any definition with no `src`,
  `variants` or `synth`, and any `STREAMED_AUDIO` entry with no sources. Silence is otherwise
  indistinguishable from working audio, which is how the bug survived a whole round of
  "verification".
- The lesson: checking that assets are **emitted into `dist`** does not prove they are
  **reachable at runtime**. Verify the shipped bundle contains no `typeof import.meta.glob`,
  and that the startup warning is absent.

`npm run verify-audio` renders every spec and asserts it is audible, peak-normalised to
−1 dBTP, non-clipping, and (for loops) click-free at the seams. Run it after touching
`audioSynth.js` or any spec.

### One engine per page, held on `globalThis`

`audioEngine.js` exports `globalThis.__cardsOfArcanaAudioEngine ?? (… = new AudioEngine())`.
This is not defensive style — it fixes a measured bug.

Editing anything in the audio graph makes Vite hot-replace the module. Neither this module nor
`audioLibrary.js` calls `import.meta.hot.accept`, so Vite propagates the update **past** them to
the nearest boundary (`App.jsx`, via react-refresh) and re-imports the whole subtree. That
produces a second `AudioEngine` with a second `AudioContext`, while the first one's `<audio>`
elements carry on playing — nothing holds a reference that could stop them. The new engine then
starts the playlist from its own unlock handler and **two theme tracks play at once**, stacking
one more with every edit. Measured going 1 → 2 → 3 instances of the same track, seconds apart.

An `import.meta.hot.dispose` hook does **not** help, and it was the first thing tried: dispose
only runs for modules that are themselves the update boundary, and this one never is.

Trade-off: changes to the engine's own *logic* need a full page reload, since the singleton
keeps the class it was built from. Cheap next to audio that silently doubles while you work.

### The buffer cache is keyed by SOURCE, not by sound id

This is load-bearing and easy to get wrong. Keyed by id, a multi-variant sound can only ever
hold one buffer: `play()` picks a random variant, finds the single cached entry and uses it —
so every card flip after the first plays the same file for the rest of the session, and the
other recordings are fetched and then ignored. Variant randomisation looks wired and does
nothing.

The same bug made `preload()` a no-op for every pooled sound, because those carry `variants`
and no `src`, so `#loadBuffer(id)` had nothing to fetch. The first press of each was therefore
always dropped and silent — which is how "the nav bar plays no sound" got reported.

`#bufferKey(id, src)` returns the src, or `synth:<id>` for placeholders. Two sound ids sharing
a pool now share the decoded buffers, which is a free win.

### Sound levels are relative to the music bed

`ui.click` sat at `volume: 0.5` on a 0.85 bus — 0.43 against music at 0.8 x 0.7 = 0.56. A
100ms blip under a continuous bed is inaudible in practice, not just quiet. `ui.nav` (page
switches, the most consequential thing a player clicks) is 0.92 and shares the menu-nav pool
with `ui.click`, which came up to 0.68.

### Collection sounds fire on the press, not in the state callback

Every collect flow animates its rewards flying to a target and only *then* invokes the App
callback that mutates state. The sound used to live in that callback, which put it 600ms behind
the click in Foundry and `750ms + 70ms per item` in Wilderness — up to ~1.5s with a full queue.
That was reported as "a 1-2 second delay", and the sound was never at fault: it was waiting for
an animation.

`handleCollectQueue` / `handleCollectIngots` (Foundry), `handleCollectGathered` /
`handleCollectProcessed` (Wilderness) and `handleCollect` / `handleQuickDraw` (PackOpening) now
play it themselves, on the press. Measured 11-22ms from click. App's callbacks play nothing.

Buttons matching `[class*="collect-btn"], .quick-draw-btn` are **excluded from the delegated
interface click** in `App.jsx`, so a collect press is the rapid-cards sound alone rather than
that plus a generic blip on top.

### Coin is wired to the balance, not to the callers

Seven places award gold — selling, mass-selling, the four production coin procs, expedition
payouts — and only one played `reward.coin`. It now fires from the effect that already watches
`balance` for the counter animation, on any increase. Hooking the state change rather than each
call site means the next thing to award gold cannot forget it.

### Voice limiting exists because of the production ticker

The ticker resolves **4 mine + 4 gathering + 3 processing + 3 forge slots in a single
frame**, so a completion sound can be requested 14 times at once. Every definition therefore
carries:

| field | purpose |
|---|---|
| `maxVoices` | hard cap on simultaneous voices of that sound |
| `minRetriggerMs` | requests inside this window are **dropped, not queued** |
| `detuneJitter` | random ± cents per voice, so repeats are not mechanical |

`play()` is **synchronous** and returns `null` when it suppresses a request. It also drops
sounds whose buffer is not yet resident, kicking off the load for next time — a click that
arrives 200ms late is worse than no click. Preload UI sounds (`preload: 'auto'`) so this
never bites in practice.

### Never decode long audio

An `AudioBuffer` is decoded float32 PCM: `sampleRate × channels × 4 bytes × seconds`.

- 48 kHz stereo → **384 KB/sec**
- 48 kHz mono → **192 KB/sec**

A 3-minute stereo track as a buffer is **~69 MB resident** — worse than any image in the
game. Music and long ambience must go through **`playStream()`**, which uses a
`MediaElementAudioSourceNode`: it streams, while still routing through the bus mixer so
volume and the compressor apply normally.

**All three ambience beds and the music are streamed.** As buffers the beds alone would be
32 MB resident (103s of stereo) and the theme 71 MB. Streaming makes their length free — it
is why the foundry bed can afford 45s from its 5-minute master rather than being cut to fit
memory. Only short SFX are decoded, totalling a few MB.

### Ambience

`setAmbience(id)` crossfades and is **idempotent**, so it is driven straight from a
view-change effect with no guarding. `null` fades to silence. Wilderness and Foundry have
beds; other views are silent. It uses `playStream`/`stopStream` (each of which fades), not
the buffered voice path. Wilderness has two takes and picks one per visit.

`playMusic(id)` starts a streamed track. `music.mainTheme` starts from the **audio unlock
handler**, not at mount: browsers refuse media playback before a user gesture, so the first
successful `unlock()` is the earliest moment it can begin. Guarded to start only once.

### Storage targets for real assets

| Category | Channels | Rate | Bitrate | Delivery |
|---|---|---|---|---|
| UI, short SFX | mono | 24–32 kHz | 32–40 kbps | sprite, decoded |
| Impact SFX | mono | 48 kHz | 56–64 kbps | own buffer |
| Ambience loops | stereo | 48 kHz | 64–80 kbps | own buffer, ≤20s |
| Music | stereo | 48 kHz | 96–128 kbps | **streamed** |

```bash
ffmpeg -i in.wav -ac 1 -ar 32000 -c:a libopus -b:a 40k -vbr on -application audio out.webm
```

Author SFX peak-normalised to −1 dBTP and music to ~−16 LUFS, so per-sound `volume` stays
near 1.0 and the compressor is not doing corrective work.

**Sprites are supported**: pass `offset` + `duration` to `play()`, or put `duration` on the
definition. Without `duration` an offset plays to the end of the whole atlas — that third
argument to `source.start()` is the whole mechanism.

### Wiring

UI clicks come from **one delegated `pointerdown` listener** in `App.jsx` (capture phase,
matching `button, [role=tab], [role=button]`) rather than a `play()` call in every
component — it cannot drift out of sync as components change. Elements with `aria-expanded`
or `aria-pressed` get the toggle sound instead of the click.

Game events are wired in `App.jsx` where the state changes live: pack buy/open, reward
collection, coins, all three production completions, card placement, and the full expedition
flow. Card flip is wired in `PackOpening.jsx`.

---
