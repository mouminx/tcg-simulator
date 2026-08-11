# Cards of Arcana

React 18 + Vite 5 collectible card game simulator. Persistent state in `localStorage` (web), a JSON file
(desktop) or a Supabase row (online); nearly all orchestration and state mutation flows through
`src/App.jsx`. Version `0.7.5` beta, `SAVE_VERSION` 25 — both live in source, never trust this file for them.

```bash
npm run dev              # vite
npm run build            # web  → Vercel (dev/playtest channel)
npm run build:desktop    # THE STEAM RELEASE — online-capable
npm run build:ssf        # online compiled out; kept for a "cannot phone home" build
npm test                 # 23 suites, ~410 assertions — see tests/README.md
npm run optimize-assets  # src/assets-original → sized WebP in src/assets
npm run encode-audio     # WAV masters → Opus/WebM  (needs ffmpeg)
npm run verify-audio     # asserts the synthesised specs are audible and click-free
```

<!-- Deliberately short. This was 3,335 lines (~45k tokens) loaded into every session before any work began.
     Area detail now lives in .claude/rules/*.md, which load only when Claude touches matching files. Keep
     this under ~200 lines: root CLAUDE.md is the only memory re-injected after /compact, so it must hold
     what is expensive to rediscover and nothing else. -->

## Where the detail lives

`.claude/rules/*.md` are path-scoped — each loads only when files matching its `paths:` are touched. Before
working in one of these areas, read its rule: it exists because something there has already cost real
debugging time.

| Rule | Covers |
|---|---|
| `layout.md` | scroll ownership, the dock gutter, short-viewport fitting |
| `stations.md` | Foundry and Wilderness: mine, forge, gathering, processing, queues |
| `hand-and-inventory.md` | the Hand fan, the Bag, the Collection binder |
| `shop-and-summon.md` | the Cards page: shelves, goods, upgrades, altar, pack and cache opening |
| `game-rules.md` | affixes, elements, Arcana, Expedition resolution |
| `backend.md` | the save's location, slots, accounts, the RLS security model |
| `audio.md` | the engine, the encode pipeline, and why sounds go silently missing |
| `scenes.md` | WebGL backdrops and three.js gotchas |
| `assets.md` | art sizing and the WebP pipeline |
| `app-shell.md` | nav and its indicators, title screen, typography, gold and placement effects |

**Trust source over prose.** If a doc disagrees with the code, the code wins and the doc is the bug. The
load-bearing modules: `src/App.jsx`, `src/game/{cards,foundry,wilderness,expedition,arcana}.js`,
`src/game/{storage,account,slots}.js`, `src/game/audio/audioEngine.js`, `supabase/migrations/`,
`electron/main.cjs`.

## The CSS trap that keeps recurring

**At equal specificity, source order decides — and this codebase has bitten on it five times.** `App.css` is
~16,000 lines, so a rule added beside a related block can lose to one defined thousands of lines later.

Each of these looked correct and silently did nothing:

- `.shop-category { width: auto }` in a media query, placed above the base rule's `width: 100%`
- a `@container` query above `.summon-field`'s `flex-direction: row` — container queries add **no** specificity
- `.stack-line`'s `display: flex` and `gap: 0` versus `.foundry-queue-slots`, defined ~5,000 lines later
- `.nav-selection` needing `transition-property: none`, because the initial value is `all` and the LOW tier's
  blanket `transition-duration: 0.1s !important` then animated it
- `.held-loot--sm`'s width losing to `.card-face-wrapper.foundry-square-resource` (0,2,0)

**Use a compound selector when overriding a shared class, and verify against the render, not the CSS.**

A related trap: **a percentage width resolved against a container with no definite width** collapses to zero
or to a clamp floor. That has produced a 12px loot tile, five invisible shelf packs, and a one-column goods
grid — each of which looked laid out and was not.

**Verify anything visual at LOW quality too.** Low and medium apply a blanket `animation: none`, so a signal
that is only animated vanishes. Gameplay signals are declared statically *and* animated: the nav loot diamond,
the hand arc, the forge tabs, the gold glow. One-off earned effects (`.gold-burst`, the treasure shatter) are
explicitly exempted from that blanket.

## Invariants that hold everywhere

**The window never scrolls.** `html`, `body`, `#root` are `overflow: hidden`; `.main` is the single scroll
owner. Views in `FIT_VIEWS` get `.main--fit` and own their internal scrolling. Every flex/grid child in the
chain needs `min-height: 0`, and the header and tab bar need `flex: 0 0 auto` or content compresses the
masthead instead of overflowing. Detail in `layout.md`.

**`fmt()` in `cards.js` is the single money formatter** — grouped thousands, always two decimals. Never call
`toFixed(2)` at a render site.

**`applyGoldDelta(reason, amount)` is the only way the balance moves.** Signed; negative to spend. Rounding
happens once, there, so no call site can drift the balance into float dust. Each spend site checks
affordability itself — it deliberately does *not* clamp at zero, because clamping would hide a missing check
and turn it into free money. `window.__gold()` returns the last 50 movements in dev. The coin sound and the
gold burst hang off an effect watching `balance`, not off the callers, so a new gold source cannot forget them.

**`mintCard()` is the only place a card comes into existence; `newId()` the only place an id does.** Ids are
UUIDv4 strings, replacing a wall-clock counter that was not unique across clients — a collision grafts one
player's card onto another's slot, which makes a shared backend impossible. `newId()` keeps a
`getRandomValues` fallback because `crypto.randomUUID` exists only in a secure context.

**One production ticker.** A single 1s interval in `App.jsx` drives forge, mine, gathering and processing,
each guarded by an `anyDue()` check so idle ticks allocate nothing. It reads state through refs, so it is
created once with `[]` deps. Do not add a second interval.

**The save is debounced (2s) and flushed on `pagehide`/hidden.** `App.jsx` owns the save's *shape*;
`src/game/storage.js` owns its *location*, and neither knows about the other. Adapters move **raw strings** —
parsing, migrating and defaulting stay in `parseSave`/`serializeSave`. That is why a format change is one
function in one file instead of a change to three adapters and the server.

**`CardFace` is memoized.** Slot-socketed cards pass no callbacks, so they hit the memo and stop re-rendering
every tick. Passing a fresh inline callback to a slot-rendered `CardFace` silently defeats it.

**The Inventory panel does not mount its contents while collapsed.** It holds ~80 resource icons.

**Never import card art without picking a size.** Use `getClassArt(...)` or `CardFace`'s `artDetail`. A
1024×1536 source is 6.0 MiB decoded and the binder shows 32 at once.

**Never decode long audio.** An `AudioBuffer` is float32 PCM — 384 KB/sec stereo. Music and long ambience go
through `playStream()`; only short SFX are decoded.

**`failIfMajorPerformanceCaveat: true`** in `src/scenes/backdrop.js` is the only thing that turns away a
software rasteriser, and scenes never import `three` — they receive it as an argument.

**Expedition, Lab and Market are held back from players** by `COMING_SOON_VIEWS`. The components are complete
and still build; this gates access. There is no multiplayer yet, which is why the online slot badge reads
"Cloud" rather than "Online".

## Security: RLS proves WHO you are, not that your data is legitimate

Stated here because the wrong version looks *more* secure than the right one. Clients hold **no
INSERT/UPDATE/DELETE on `saves`** — the absence of those policies IS the security model, not an oversight. The
only write path is `save_game()`, a `SECURITY DEFINER` function that takes no user id and reads `auth.uid()`
itself. A future migration that *adds* a write policy to `saves` is the thing to be suspicious of.

**The service-role key bypasses RLS entirely and must never appear in a `VITE_` var or in this repo.** `.env*`
is gitignored except `.env.example`. Full model, including the four load-bearing details in the SQL, in
`backend.md`.

**Tests must never point at the hosted project** — the online suites create accounts and write saves. See
`tests/README.md`.

## Known gaps

- The forge and processing halves scroll internally (~256px / ~265px at 1366×768). Closing that needs the row
  to get shorter, which is a design change. The mine and gathering halves scroll ~390px because 2×2 slots were
  chosen deliberately over a row of four that fits — that was tried and rejected; do not restore it.
- `MINE_SLOT_COSTS` is unreachable dead data: the default mine capacity already equals the max.
- `ResourcePocket.jsx` exists but is not the active gameplay path; `arcanaCrafting.js` is legacy beside the
  live ring-craft UI.
- `src/game/resourceArt.js` uses `import.meta.glob`, so it is Vite-only — never import it from code that must
  run under plain Node. Same constraint `audioLibrary.js` carries.
- **`src/assets-original/` is gitignored and holds every master** — art PNGs *and* the audio WAVs. So
  `optimize-assets` and `encode-audio` cannot be re-run from a clean clone: they read masters that are not in
  the repo, and will quietly produce nothing. The shipped `src/assets/**` output IS committed, so the game
  builds and runs fine; only re-encoding needs the masters. Recover them from an older commit's `src/assets`
  or from the source art.
- **`encode-audio` rewrites every entry**, and Opus output is not byte-stable — a run shows all ~40 audio
  files as modified even when their content is unchanged. Revert the ones you did not intend to touch, or the
  diff hides what actually changed.
- Server-side save validation and pack minting are not built; they are prerequisites for any marketplace.
- The remaining build warning is the JS bundle (~580 kB), not images.
