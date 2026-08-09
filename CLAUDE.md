# Cards of Arcana — Claude Code Context

React + Vite collectible card game simulator. No backend. Persistent state lives in `localStorage`, and nearly all orchestration/state mutation flows through `src/App.jsx`.

This file is the current handoff snapshot for the codebase as of `SAVE_VERSION = 22`.

**Version `0.7.5`, beta.** The header shows it next to the wordmark. `__APP_VERSION__` is a
build-time define in `vite.config.js` read straight from `package.json`, so the badge cannot
drift from what is actually running. Note this is the *product* version and is deliberately
separate from `SAVE_VERSION`, which tracks the persisted shape and moves for different reasons —
a pure save-format migration is not a release.

---

## Stack

- React 18 + Vite 5
- CSS-only styling in `src/App.css`
- Self-hosted fonts via `@fontsource` — **three families only** (see Typography)
- `three` for optional WebGL scene backdrops (lazily loaded, see Scene Backdrops)
- No external state library
- Native Web Audio scaffold in `src/game/audio/*`
- `sharp` is only used by `scripts/extract-card-colors.mjs`

---

## Key Commands

```bash
npm run dev
npm run build
npm run extract-colors
```

---

## Project Structure

```text
src/
  App.jsx
  App.css
  fonts.css
  game/
    graphics.js
    cards.js
    arcana.js
    arcanaCrafting.js
    arcanaAttunement.js
    arcanaPackOpening.js
    foundry.js
    wilderness.js
    expedition.js
    audio/
      audioEngine.js
      audioLibrary.js
      audioPlaceholders.js
      audioSynth.js
    cardArt.js
    cardColors.js
  scenes/
    backdrop.js
    wildernessScene.js
    cavernScene.js
    splashScene.js
  components/
    Arcana.jsx
    AudioSettings.jsx
    AttunementStage.jsx
    CardFace.jsx
    CardPocket.jsx
    Collection.jsx
    EssenceCard.jsx
    Expedition.jsx
    FXEditor.jsx
    Foundry.jsx
    FusionAnimation.jsx
    Gold.jsx
    HoverCardPreview.jsx
    Inventory.jsx
    Lab.jsx
    Market.jsx
    PackCard.jsx
    PackOpening.jsx
    Packs.jsx
    ResourceCard.jsx
    ResourcePocket.jsx
    ResourceQuantityPopover.jsx
    SceneBackdrop.jsx
    Shop.jsx
    StationMerge.jsx
    UnpackPage.jsx
    Wilderness.jsx
```

Notes:

- `ResourcePocket.jsx` still exists on disk but the feature is no longer active in the app shell.
- `arcanaCrafting.js` is legacy helper logic. The live Arcana station uses the ring/recipe system in `Arcana.jsx` + `arcana.js`.

---

## Layout / Scrolling

**The window never scrolls.** `html`, `body` and `#root` are all `height: 100%; overflow:
hidden`, and `.app` is a fixed-height flex column. Everything below is about who owns
scrolling instead.

```text
html/body/#root  overflow: hidden
+- .app          height: 100vh, flex column, overflow: hidden
   +- .header    flex: 0 0 auto
   +- .tab-bar   flex: 0 0 auto
   +- .main      flex: 1, min-height: 0, overflow-y: auto   <- default scroll owner
      +- .main--fit  overflow: hidden                       <- converted views
```

`FIT_VIEWS` in `App.jsx` lists the views laid out to fit exactly — Shop, Collection,
Foundry, Wilderness. Those get `.main--fit` and manage their own internal scroll regions.
**Any view not in that set keeps the pane's own scroll**, so what used to be a page scroll
is now a pane scroll — same behaviour, no regression. Arcana, Summon, Lab, Market and
Expedition are all in that category.

### Three things that bite in this layout

1. **`flex: 0 0 auto` on the header and tab bar.** Without it they are shrinkable flex
   children, and any view whose content overflows *compresses the masthead* instead of
   overflowing. The symptom looks exactly like a scrolled page.
2. **`min-height: 0` on every flex/grid child in the chain.** A flex child will not shrink
   below its content size without it, so the pane grows and the shell scrolls anyway.
3. **`align-items: start` on a grid defeats all of it.** `.collection-shell` had it, so its
   row sized to content and `.collection-main`'s `overflow: auto` never engaged. It now
   uses an explicit `grid-template-rows: minmax(0, 1fr)` with `align-items: stretch`.

### The dock gutter

`--dock-gutter` is set on `.app` from `App.jsx` and is the Hand fan's visible height —
**`7rem` expanded, `2.6rem` collapsed**, tracking `pocketExpanded`, which is persisted. Two
things consume it: `.main`'s bottom padding, and `.inventory-panel`'s `bottom` inset.

**The Hand is the one floating surface that reserves space instead of overlaying**, and that
asymmetry is deliberate. A right-edge drawer covers content only while it happens to be open,
and only at one edge; the fan spans the bottom of *every* view permanently, so anything running
under it would be unreachable rather than momentarily hidden. Collapsing the fan is how a player
buys the height back.

The gutter is the **resting** height only. A hovered card lifts well past it, which is fine —
that is a transient overlay, the same as a hover preview.

### Per-view notes

- **Shop** — was ten stacked shelf sections, roughly 3600px of scroll. The six single-pack
  Edition sections are merged into one `Tag Editions` shelf, leaving five categories behind
  a tab rail with **one shelf visible at a time**. Fits any viewport.
  Centred rather than left-aligned, with no standing subtitle — explanatory prose under a
  heading reads as a web page rather than a game, and the one line that remains is functional
  (why buying stopped working at the pack cap).
  Pack width is `clamp(126px, 12.4vw, 202px)` and the shelf furniture scales with it. It has
  to be responsive: five packs at a fixed size plus furniture is wide enough that the
  right-edge drawers, which **overlay** the pane without reserving space, hid the last pack.
  The shop does **not** shift when a drawer opens. An earlier version translated it by half the
  drawer width to keep it centred in the visible area, but the Hand drawer does not do that and
  the inconsistency reads as a bug — a screen that jumps sideways when you open your bag. The
  width bound above is what keeps the shelf clear instead; below ~1100px the floor wins and the
  last pack can tuck under an open drawer, the same trade every view makes at that width.
- **Collection** — the sidebar is a fixed-height flex column: title fixed,
  `.collection-sidebar__scroll` takes the filters, and `.mass-sell-bar` sits *outside* that
  scroll region as a pinned footer. It used to be the sidebar's last child, so a long
  filter stack pushed the Sell button off-screen exactly when it was needed. The binder is
  32 cards per spread and intrinsically taller than a short viewport, so
  `.collection-main` scrolls on its own.
- **Foundry / Wilderness** — `.foundry-half` (which Wilderness reuses via
  `class="foundry-half wilderness-half"`) scrolls internally, so accumulating loot no
  longer lengthens the page. Both `-split` rules carried `min-height: 560px`, which
  *guaranteed* overflow on any window shorter than that.
- **Inventory sidebar** keeps its own scroll, by design.

---

## Navigation

Current view order:

```text
Cards → Summon → Collection → Arcana → Foundry → Wilderness → Expedition → Lab → Market
```

Notes:

- `Cards` is the shop page (`VIEWS.SHOP`), laid out as **shelves**: each section is a
  plank with packs standing on it and price tags hanging from its front edge. The pack
  itself is the buy button. Each pack keeps its `shop-pack-card--{id}` modifier class
  so the pre-existing per-pack glow and hover-colour rules still apply. `PackCard`
  takes `size="shelf"` (134x195).
- `Summon` is the pack opening page (`VIEWS.UNPACK`)
- `Expedition`, `Lab` and `Market` are **held back from players**. `COMING_SOON_VIEWS` in
  `App.jsx` greys their tabs, adds a `Soon` tag, sets `disabled` and carries a
  `Coming soon` tooltip. The components are fully implemented and still build — this gates
  access, it does not remove the feature. An effect also bounces `view` back to Shop if one
  of them somehow becomes active. Because the buttons are `disabled`, the delegated click
  sound skips them automatically (that listener already bails on `el.disabled`)
- navbar tabs use glowing rune/glyph particle effects

### The tab bar has almost no width to spare

Nine tabs sized in Cinzel leave **~6px of slack at 1024px** and ~135px at 1280px. Anything
added inside a tab has to be measured, not eyeballed. The three `Soon` tags cost 155px at
full size and overflowed the row at every width up to 1365px, so they degrade in two steps:
trimmed (no border or background, smaller) below 1365px, and hidden entirely below 1100px
where the greyed label and the tooltip carry the signal alone.

The loot indicator below is **absolutely positioned** for the same reason — it must not
participate in layout at all.

### The nav is a shell wrapping the bar

`.nav-shell` owns the sticky position and stacking; `.tab-bar` inside it owns the horizontal
scrolling. They are split because **CSS forces the cross axis to non-visible when one axis
scrolls** — `overflow-x: auto` on the bar meant `overflow-y` could not be visible, so the rune
particles rising out of the active tab were clipped at the bar's edge with no way to opt out.

`.nav-rune-layer` is a sibling of the bar inside the shell, so runes now rise ~27px clear of
it. The shell sits above the header in the stack for the same reason; `.tab-bar` carries an
inset top shadow to stand in for the header's drop shadow, which no longer lands on it.

Rune groups are React state (`runeGroups`), one per emitting tab. When the view changes the
outgoing group is kept for 900ms with a `--leaving` class so its runes **fade out** instead of
blinking away mid-arc. Positions come from `tab.offsetLeft` minus the bar's `scrollLeft`,
because the layer is not inside the scrolled content.

#### Anything popping out of the header must be PORTALED

`.nav-shell` (201) deliberately outranks `.header` (200), so the header is a stacking context that
the nav paints over. **A z-index on a descendant of the header cannot escape it** — the audio
mixer popover carried `z-index: 12100` and was still covered by the tab bar, because 12100 only
orders it *within* the header.

`AudioSettings` therefore renders its panel through `createPortal` to `document.body`, positioned
`fixed` from the trigger's measured box. Raising `.header` above the nav instead is the wrong fix:
it would hide the runes, which is the whole reason the shell is above it. Any future header popover
needs the same treatment, and its outside-click handler needs to test **both** the trigger box and
the portaled panel, since the panel is no longer a descendant of the trigger.

### The selection indicator is open-topped

It does **not** transition between tabs — sliding the highlight made every page switch feel like
it was catching up with the click.

**It declares `transition-property: none`, and that is required rather than tidy.** Simply *not*
declaring a transition is not enough: the initial value of `transition-property` is `all`, and the
LOW tier applies `html[data-quality="low"] * { transition-duration: 0.1s !important }` to make the
UI feel snappier — which handed this element a 100ms slide on `left` and `width`. Measured 11
intermediate positions across a tab switch at low quality and none at high, which is why "get rid of
the slide" came back after it had already been fixed: the first fix was only ever tested at high.
Killing the *property* cannot be undone by a rule that only sets a duration.

The same trap applies to anything else that must snap: check it at **low**, not just high.

`.nav-selection` replaced a 2px underline. Three sides only: a bright base line, side rails
that fade out going up, and no top edge — a closed rectangle reads as a button, an open one
reads as the tab being lit from below. Its glow is offset **downward** rather than spread
evenly, because a symmetric glow haloed the open edge and put a bright line exactly where the
missing side is supposed to be. `--sel-accent` is set inline from the active view's accent.

### Uncollected-loot indicator

A completion sound says loot arrived but not *where*, so `Foundry` and `Wilderness` tabs
carry a small diamond driven by their pending queue totals:

| State | Appearance |
|---|---|
| nothing pending | no diamond |
| pending, not visited since it arrived | diamond + glow + echo bursts, in the tab's accent |
| pending, visited | diamond, no glow |
| collected | no diamond |

**The diamonds are rendered into `.nav-rune-layer`, not into the tab buttons**, and measured per tab
in their own effect. They used to be children of the button, which put them inside `.tab-bar` — and
the bar sets `overflow-y: hidden`, which it has to, because `overflow-x` is `auto` and CSS forces the
cross axis to non-visible once one axis scrolls. So the diamond could not sit *on* the bar's bottom
line (it was inset 5px to stay inside it) and its echo rings were clipped at the bar's edge, which is
why the scale was capped at 2.6.

The rune layer is a sibling of the bar inside `.nav-shell` with visible overflow, and it comes after
the bar in DOM order so it paints above it — exactly the arrangement the nav runes already use for the
same reason. `bottom: 0` in that layer *is* the bar's bottom line, and a negative margin sits the
diamond astride it. Positions come from `offsetLeft` minus the bar's `scrollLeft`, since the layer is
not inside the scrolled content; tab widths change with their labels, so the pack and collection
counts are effect dependencies.

Centring uses negative margins rather than `translate`, because `transform` already carries the 45°
rotation that makes the square a diamond.

While glowing it emits two echo outlines (`::before` / `::after`, staggered) that burst outward to
pull the eye to a tab the player is not looking at. **Now that they are unclipped the echo runs to
scale 5**, and the diamond itself is larger (10px new / 8px seen).

`lootPending` sums every positive entry across a view's claim *and* reward queues (so coins
and motes count, not just ore). An effect compares that total against the previous render's
and, on any increase, marks the view unseen — **totals rather than a boolean**, so a second
batch arriving while the first is still uncollected re-lights the glow. Loot arriving while
you are already on that page counts as seen.

`lootSeen` is persisted, so the distinction survives a reload. `LOOT_TAB_VIEWS` is the list
to extend if Summon or Arcana should ever get one.

Both differences between `new` and `seen` (brightness/size and the halo) are **static** as
well as animated, because `animation` is switched off at low and medium quality. The glow is
a gameplay signal, so it has to survive that — the same reasoning as Collection's grayscale
on locked cards.

---

## Save State

- `localStorage` key: `tcg-sim`
- current save version: `22`

Current persisted state includes:

```js
{
  balance,
  collection,
  packs,
  market,
  resources,
  arcanaInventory,
  oreInventory,
  ingotInventory,
  mineSlots,
  mineSlotCapacity,
  mineClaimQueue,
  mineRewardQueue,
  forgeCardSlots,
  forgeOreSlots,
  forgeIngredientSlots,
  forgeFuelSlots,
  ingotClaimQueue,
  forgeRewardQueue,
  gatheredInventory,
  processedInventory,
  gatheringSlots,
  gatheringClaimQueue,
  gatheringRewardQueue,
  processingSlots,
  processedClaimQueue,
  processingRewardQueue,
  expeditionDifficultyId,
  expeditionUnitSlots,
  expeditionSupplySlots,
  expeditionArcanaSlots,
  expeditionRun,
  packsOpened,
  audioSettings,
  graphicsSettings,
  pocket,
  pocketCapacity,
  lootSeen,
  version,
  pocketSystemVersion,
}
```

Important details:

- `pocket` stores full card objects, not IDs
- active resource pocket state is gone from the save shape
- `resources` stores all Arcana element tiers using Arcana resource ids
- `audioSettings` is persisted but there is not yet a UI to edit it
- **22** folded gathered ores and ingots into `oreInventory` / `ingotInventory` (and the pending
  claim queues) — see Inventory. Nothing was added to the save shape; entries moved between existing
  maps
- `lootSeen` (added in 21) records whether each loot-bearing view has been looked at since
  its last delivery. Absent on older saves means "seen", so existing loot shows a calm
  diamond instead of glowing on first load
- old Expedition saves are migrated so support slots collapse back to the new defaults (`1` supply, `1` arcana)
- legacy creature-card saves are migrated into the newer class/unit card model

---

## Card System

Core rules live in `src/game/cards.js`.

Cards are now **human unit classes**, not monsters/creatures.

### Unit classes

- miner
- blacksmith
- lumberjack
- hunter
- merchant
- warrior
- mage
- bard
- forager

Each card stores:

- `classType`
- `rarity`
- `tier`
- `name`
- `value`
- `tags`
- `affixes`
- optional progression state like grade / fuse metadata / injury timer

Display names are generated from:

- class rarity title ladder
- tier prefix

Example:

- `Veteran Forgemaster`
- `Grandmaster Worldbreaker`

### Rarity and tier

Rarity drives:

- card value range
- affix value range
- title ladder

Tier drives:

- affix count
- some system weighting / prestige display

Current rarity affix ranges:

| Rarity | Range |
|---|---|
| common | 1–5% |
| uncommon | 6–11% |
| rare | 12–17% |
| epic | 18–23% |
| legendary | 24–29% |
| mythic | 30–40% |

Higher affixes:

- 50% chance
- render as `★`
- gold/bold styling
- value multiplier: `2x`

Regular affixes render as `◆`.

### Tags

Base tag chance is still 14%.

Supported tags:

- `holo`
- `foil`
- `reverse`
- `shadow`
- `nexus`
- `prismatic`
- `firstEdition`

---

## Affixes

Affixes are generated in `cards.js` from:

- class-specific pools
- general affix pool
- element-specific attunement affixes

### Class-specific affixes

Each class has three core affixes:

- efficiency
- attunement
- luck

Some gathering classes also have:

- `Treasure Sense`

Examples:

- `Mining Efficiency`
- `Smelting Attunement`
- `Logging Luck`
- `Treasure Sense`

### General affixes

Current general affixes include:

- `Coin Generation`
- `Production Speed`
- `Craftsmanship`
- `Overflow`
- `Prosperity`

### Elemental attunement affixes

Generic essence-attunement was replaced with element-specific attunements:

- `Ember Attunement`
- `Storm Attunement`
- `Tide Attunement`
- `Bloom Attunement`
- `Gale Attunement`
- `Void Attunement`
- `Radiance Attunement`
- `Celestial Attunement`
- `Stone Attunement`

These give a percent chance to generate an extra **mote** of that specific element on production completion.

### Current affix semantics

- Efficiency: speed up the relevant system
- Attunement: chance to produce an additional copy of the same output
- Elemental Attunement: chance to queue an extra mote of the specific element
- Luck: biases weighted result tables toward rarer outcomes
- Coin Generation: proc chance to generate coins from production/completion events
- Treasure Sense: chance for gatherers/lumberjacks/hunters/foragers to discover treasure packs

### Coin Generation

Coin generation is no longer a multiplier. It works as:

- affix value = proc chance
- on proc, roll coins from a rarity-based bracket
- those coins are queued, not instantly awarded

### Treasure Sense

Treasure Sense is only on:

- lumberjack
- hunter
- forager

Treasure Sense can generate a `Treasure Pack` into the gathering queue.

---

## Money formatting

`fmt()` in `cards.js` is the single formatter: grouped thousands, always two decimals, so
`10000` reads as `10,000.00`. `Gold.jsx` and every other money render route through it rather
than calling `toFixed(2)` themselves.

---

## Title screen / main menu

`SplashScreen.jsx` is **one screen**, opened on load and reopenable from the wordmark. `titleScreen`
in `App.jsx` is a plain boolean; `hasEntered` exists only to pick the button's label
(`Enter` / `Resume`).

There used to be two modes — an `intro` that auto-advanced after 6s and dismissed on any click or
key, and a `menu` carrying the release notes. Two variants of the same screen meant the thing a
player saw first was not the thing they could get back to, and it threw them into the game whether
they were ready or not.

| | Behaviour |
|---|---|
| Auto-advance | **none.** The player enters deliberately |
| Dismissal | Escape, or the Enter/Resume button. **Not** click-anywhere, **not** any-key |
| Release notes | always available, behind the toggle |

Both dismissal shortcuts are off because both would fire while the player is reading or
arrow-scrolling the notes. `.splash` therefore uses `cursor: default` — a pointer over the scenery
would promise something that does nothing.

The wordmark is a `<button>` inside `.header h1`; it inherits the gradient-clipped text
treatment rather than bringing button chrome of its own.

### The title resizes with the notes

Collapsed, this is a title card: the wordmark at full size, vertically centred. Expanded, the three
note cards need the middle of the screen, so `.splash--notes-open` shrinks the wordmark to `0.56`
and the content column anchors to `flex-start`, raising it to the top.

**The shrink is `transform: scale()`, not `font-size`.** Font size is a layout property, so
animating it reflows the column every frame and drags the rule, the build line and the toggle around
with it. A scale is a composited repaint and the box stays put — which is why the box then needs a
negative `margin-bottom` to give back the height a scaled element still reserves, or everything
below floats in a gap where the full-size title used to be.

The release notes. Click-anywhere and any-key dismissal are **off** there on
purpose — both would fire while the player is reading or arrow-scrolling the notes. The intro
keeps them, because a splash that traps you is worse than no splash.

Notes live in `src/game/changelog.js` as data (`RELEASE`), in three sections — **Changelog**,
**Known Issues**, **Planned** — rendered as **three equal-width cards**, each scrolling
independently, behind a toggle that is **closed by default**. Three cards fill the middle of the
screen, which is exactly where the mountains and the drifting stream are; expanded, the menu is a
changelog with some scenery at the edges rather than a title screen. Three shorter
lists read far faster than one long column, and it lets the type sit at a comfortable 1rem instead
of being shrunk to fit one panel. Columns are `repeat(3, minmax(0, 1fr))`: an earlier `1.25fr 1fr
1fr` gave the longest list more room, but three different widths read as a layout accident —
better that the long lines wrap. Below 1000px they stack.

### The drifting stream

Motes and runes crossing the title screen from lower-left to upper-right. **DOM, not part of the
3D scene**, for two reasons: the runes are real glyphs in the game's runic face, which would
otherwise need a texture atlas baked per glyph; and it composites over the WebGL canvas so it
still works when the scene falls back to its CSS gradient.

Three nested elements per particle — the outer travels the diagonal, the middle sways, the inner
is the glyph or dot. Splitting them is what allows two independent animations without either
fighting the other's `transform`.

The field is built once with a seeded generator (`makeStream`). The menu re-renders when the notes
are collapsed, and particles jumping at that moment would be very obvious. Delays are **negative**
so the stream is already mid-flight when the screen opens rather than filling in over half a
minute. Every third particle is a rune; all runes would read as a spell effect rather than as
drifting air. 92 particles, with durations squared toward the slow end (20-82s, measured
24-52px/s across the field) — most drift and a few move noticeably faster, because a uniform
speed reads as a scrolling texture rather than as air.

Gated on `runeParticles` (high only), the same as the nav runes: at low and medium the CSS quality
overrides switch off always-on animations, so these would sit frozen on screen as a scatter of
static dots. The wording is the author's, verbatim; keep it that way rather
than paraphrasing. **Only list what a player can notice** — refactors, build changes and internal
invariants belong in this file, not there. The version comes from the same `__APP_VERSION__`
define as the header badge, so the two cannot disagree.

The wordmark is set in mixed case via `.header h1.app-title`, and the compound selector is
required: `.header h1` (specificity 0,1,1) sets `text-transform: uppercase` on every header title,
so a plain `.app-title` rule (0,1,0) silently loses and the header stays in caps. This was
"fixed" once without the specificity and stayed broken.

The wordmark button carries its own gradient rather than inheriting it, and **must not use a
`filter` on hover**. A filter creates a new rendering context, and in Chromium that breaks
`background-clip: text` mid-transition: the clip drops for a frame and the solid text flashes
through, which reads as a second title flickering behind the first. Hover changes the gradient
stops instead, which is a plain repaint. The native `title` attribute is also gone — it was the
literal second title appearing under the cursor.

The intro deliberately does **not** show the notes: it auto-advances in 6 seconds, which is not
long enough to read them.

---

## Card placement echo

`PlacementEcho.jsx`, spawned into a fixed layer by `signalCardPlaced()` in `App.jsx`. A ring of
eight runes (the same set the Arcana table uses) flares outward and rotates, with two plain rings
expanding past it.

- **The drop listener is delegated**, one capture-phase `drop` on `window`, for the same reason
  the interface click is: there are card slots in Foundry, Wilderness, Arcana, Expedition and the
  Hand, and wiring an effect into each would drift the moment a new station appears.
- **It climbs to the first card-or-slot-sized ancestor** (44–340px wide, 44–440px tall) rather
  than trusting `event.target`, which can be a tiny inner label, or the pointer position, which
  puts the ring wherever the cursor happened to land inside the slot.
- **Measured from the CARD, two frames after the drop**, not from the slot. A slot is not the
  shape of the card it holds — a mine slot is roughly square because it also carries the speed
  dial, so its centre sits 57px right of the card's, and centring on it put the ring visibly off
  to one side. `signalCardPlaced` waits two `requestAnimationFrame`s so React has committed the
  card, then measures it; the slot box is only a fallback. The sound stays immediate.
- **Centred on the card's midpoint, both axes.** Anchoring at the bottom edge made the rings look
  like they were being emitted from the card's base rather than from the card.
- **Clipped out of the card's footprint**, which is what makes it read as passing *underneath*.
  `clip-path: path(evenodd, ...)` with a huge outer subpath and the card's rect as the inner one.
  This is the only practical way: a fixed overlay cannot be slotted between a panel's background
  and the cards inside it, because it is in a different stacking context — so the overlap is
  removed rather than reordered. The outer rect is oversized rather than measured from `window`,
  to avoid reading layout during render and to survive a resize mid-animation.
- **Rings are sized to their FINAL diameter and animated from small up to their own end scale**,
  not sized small and scaled past 1. That makes `--echo-size` literally how big the outermost ring
  ends up, which is the only way to keep it reliably larger than the card across every slot size in
  the game. Rune radius and glyph size are fractions of the same variable.

### The card drives its shape

Placing a good card should look like placing a good card:

| Card property | Drives |
|---|---|
| affix count | number of plain rings — 1 per affix, 2 minimum, 6 cap |
| rarity | runes in the runic circle (6 common → 14 mythic) **and** the accent colour, from `RARITIES` |
| tier | reach and glow — tier I is 1.0x, tier V is 1.4x |

Rings stagger by 105ms each and stop progressively shorter, so they read as one wavefront rather
than as concentric decoration.

Note when testing: **affix count is normally driven by tier**, so overriding `tier` on a generated
card leaves its affixes untouched and the ring mapping unexercised. Seed explicit affix arrays.

`signalCardPlaced()` exists rather than two calls at each site so a future placement path gets
both the sound and the effect for free.

**No card, no ring.** There used to be a fallback that spawned the effect at the drop point with
`hole: null` when the card could not be measured, and that fallback is what made the rings
occasionally "render outside and in front of the card": with no hole there is no clip path, so they
paint straight over the card's face instead of passing under it, and the drop point is the slot's
bottom edge rather than the card's centre, so they sat below it too. It fired whenever the climbed
drop target was not an ancestor of the card that landed — a drop onto the Hand's catch band, or a
station whose card renders outside the element the climb stopped on. The effect is decoration; an
unclipped ring across the artwork is worse than no ring. `PlacementEcho` also returns `null` without
a hole, so a future call site cannot reintroduce it.

---

## Typography

`src/fonts.css`. **Three families, self-hosted via `@fontsource`** — no CDN, because managed/school
Chrome installs block `fonts.googleapis.com` and the packaged build has no network at all.

| Variable | Family | Used for |
|---|---|---|
| `--font-title` | Uncial Antiqua | the wordmark, nothing else |
| `--font-caps` | Metamorphous | navigation and menu chrome — tab labels, section heads, shelf tags |
| `--font-ui` / `--font-display` / `--font-body` / `--font-mono` | Quattrocento (400/700) | everything else |
| `--font-runic` | Noto Sans Runic | rune glyphs only |

Every rule in `App.css` goes through these variables, which is why swapping four families out was a
change to `fonts.css` alone.

**Noto Sans Runic is not a fourth UI face.** The runic glyphs the game draws (ᚱ ᛟ ᛜ ᛞ ᛠ) exist in
almost no other font, so dropping it renders them as empty boxes on any machine without a runic
fallback. It is only ever applied to spans containing nothing but those glyphs.

### Two gaps that let unapproved fonts through

Both were found by auditing computed `font-family` on every visible element, not by reading CSS:

1. **Form controls do not inherit `font-family`.** The UA stylesheet gives `button`, `input`,
   `select`, `textarea` the system default, so every button that did not name a font rendered in
   Arial — and so did everything nested inside it. That was 48 elements: the shop's pack buttons and
   all their inner layers, the Bag tab, the hand's buy-slot button. A base rule now sets
   `font-family: inherit` on them. **Not** the `font` shorthand, which would also pull size and
   weight and resize every control in the game.
2. **The base font has to be on `body`, not only on `.app`.** A lot of UI is portaled to
   `document.body` — resource tooltips, the audio mixer popover, the hover card preview, the gold
   bursts — so it sits outside `.app` entirely and inherited the UA serif default.

Audit result after both: 371 elements Quattrocento, 32 Metamorphous, 2 Uncial Antiqua, zero others.

## Gold burst

`GoldBurst.jsx`, spawned from the same effect in `App.jsx` that animates the balance counter and
plays the coin sound — hooking the balance change rather than each of the seven places that award
gold, for the same reason the sound is wired there.

**The curve comes from two nested elements, not from easing.** The outer carries the horizontal
travel on `linear`; the inner carries the vertical travel on an ease-in. Two axes covering their
distance at different rates over one duration *is* a curve — the motes leave fast and flat, then
sweep up into the counter. A single element animating `translate(x, y)` can only move in a straight
line however it is eased, because one timing function governs the whole transform.

- **Origin is the last pointer press**, so the motes appear to come out of whatever you just did —
  the Collect button, the card you sold. Falls back to the middle of the pane for gold with no press
  behind it, such as a production coin proc resolving on the ticker. A press older than 1.2s does not
  count.
- **The target is measured at spawn**, not stored: the counter lives in a sticky header whose position
  depends on the window, and a stale target would fling the motes at empty space.
- **It renders at every quality tier**, unlike the ambient particle fields. It is one ~700ms burst in
  direct response to earning something, and it is the feedback that says where the gold went. The
  tier scales the mote count instead (0.45 / 0.7 / 1), and App.css exempts `.gold-burst` from the
  blanket `animation: none` that Low and Medium apply.
- Motes are seeded per burst so a re-render cannot reshuffle them mid-flight.

### Two modes, five sizes

| Mode | Sizes | Used for |
|---|---|---|
| `stream` | small / medium / large, from the amount (`streamSizeForAmount`: <20, <100, 100+) | any gold gain |
| `pop` | small / large | treasure-pack coins, and the flourish on the counter when a stream lands |

A pop reuses the same two nested elements with the **same** easing on both axes, which is what makes
its travel straight and radial — a burst has no destination to sweep into.

### The counter counts up on arrival, not in flight

`displayBalance`'s tween is delayed by `GOLD_STREAM_ARRIVAL_MS` (780ms). It used to start the moment
`balance` changed, so the number had finished climbing before the motes got there and the two read as
unrelated events. `balance` itself still changes immediately — only the display waits. A small pop
fires on the counter at the same moment, so the number and the effect agree.

### Treasure-pack coins pop where they sit

Treasure packs reveal gold cards, and those used to **fly to the Bag** like resource cards do — wrong
twice over: the coins do not enter the Bag, they go onto your balance, and watching five identical
gold cards travel to an inventory they never reach reads as a bug. `PackOpening` now bursts each one
in place (staggered 110ms, size from the card's amount) and fades the card on the spot.

`skipGoldStreamRef` then suppresses the streaming burst for that balance change — the gold has
already been shown arriving, and streaming it into the corner as well would show the same gold twice.
It is a one-shot flag read and cleared by the balance-gain effect.

## Card Presentation

`src/components/CardFace.jsx` is the shared renderer.

Current visual rules:

- top nameplate
- art frame with larger embedded tab treatment
- rarity gems use custom SVGs from `src/assets/rarity-gems`
- tier stars use custom SVGs from `src/assets/tier stars`
- affixes render in the lower text body
- rarity/tier presentation is custom and no longer the old text-chip system
- **no tag pill on the face.** A holo/foil/first-edition finish announces itself through the
  card's own treatment (the `has-tag-*` wrapper class and the `tag-vfx` layer), so naming it in
  text was redundant — and the row it needed was the main reason small cards ran out of
  vertical space and clipped their affixes
- the nameplate is **not bold** (500, not 700) and **wraps to two lines** via
  `-webkit-line-clamp: 2`. Generated names run long — "Seasoned Verdant Sovereign" is 26
  characters — and no readable size fits that on one line in a 132px binder cell, so
  `nowrap` + ellipsis was throwing away the part that identifies the card
- collection hover uses magnify, not a turn animation
- pocketed/unavailable cards are greyed out and visually locked in Collection

Hover previews:

- `HoverCardPreview.jsx` renders the large floating preview used by collection, pocket, foundry, and expedition interactions

---

## Packs

Pack data lives in `PACK_TYPES` in `cards.js`.

Notable pack types:

- `welcome`
- standard packs like `iron`, `dusk`, etc.
- `blankSlate`
- `treasure`

### Welcome Pack

- starts the game in `packs`
- labeled and styled distinctly from normal packs
- no longer falls back visually to `iron`

### Blank Slate

- Arcana-aware pack
- can open with Calling / Surge / Inscription loadout
- yields normal cards
- also yields **mote** rewards after the main card reveal
- Blank Slate resource rewards are shown in a separate rewards panel in the summon flow

### Held-pack cap

`MAX_HELD_PACKS` (20) in `App.jsx` blocks **purchases** once that many packs are unopened.
The Shop reflects it rather than swallowing the click: every buy button goes `disabled`, the
price tags dim, and the subtitle changes to say why.

The cap is deliberately **not** applied to treasure packs earned from Treasure Sense — those
are still granted past 20, because silently destroying loot a player worked for is a worse
bug than a long stack. So the held count can exceed the cap; it just cannot be pushed over
it at the till.

### Quick Draw

`PackOpening` reveals card by card on tap. **Quick Draw** puts every card in the queue strip
at once, and works from the unopened pack as well as mid-reveal, so a stack can be cleared in
two clicks.

The machinery already existed as `handleSkip` behind a `.skip-anim-btn` that was
`display: none` outside a ≤640px media query — reachable only on mobile. It is now
`handleQuickDraw` on a themed button shown during `INTRO` and `REVEALING` (not `SPLITTING`,
mid-animation, nor `ESSENCE`, which lasts under a second), and only when a pack holds more
than one card.

It plays the **rapid-cards** pool, by the same rule as claiming a summon: many cards moving
at once rather than a single flip. It also scrolls the queue strip into view — five cards fall
past the fold on a short window, which would defeat a button whose whole job is showing you
everything at once.

### Treasure Pack

- generated by `Treasure Sense`
- first appears in Wilderness queue
- when claimed, it flies to `Summon`
- opening uses the normal reveal flow
- instead of cards, it reveals 5 square gold-resource cards
- no mote drop phase

---

## Arcana System

Arcana is data-driven and centered on:

- `src/game/arcana.js`
- `src/components/Arcana.jsx`

Related files:

- `arcanaAttunement.js` for Blank Slate slot/loadout logic
- `arcanaPackOpening.js` for Blank Slate orchestration
- `arcanaCrafting.js` for older helper logic

### Elements

There are 9 elements:

- smoldering
- jolting
- flowing
- blooming
- gusting
- hollowing
- gleaming
- ascending
- grounding

Each exists in 4 tiers:

- mote
- wisp
- essence
- quintessence

Helpers:

- `getElementResourceId(elementId, tier)`
- `parseElementResourceId(resourceId)`
- `getElementResourceDescription(resourceId)`

### Arcana Station

The Arcana page uses a ring crafting layout:

- outer element slots
- inner element slots
- mage card corner slots
- center result display

Current behavior:

- Arcana resources are pulled from the main inventory, not a separate picker modal
- dropped resources in slots render as inventory-style square resource cards
- mage corner slots use cards from pocket
- crafted items are appended into `arcanaInventory`

### Arcana inventory

`arcanaInventory` stores crafted:

- charms
- catalysts
- sigils

Inventory UI shows:

- Arcana resources from `resources`
- crafted Arcana items from `arcanaInventory`

### Element descriptions

Tooltip copy for motes/wisps/essences/quintessences is now fully tier-specific and lives in `arcana.js`.

---

## Collection

`src/components/Collection.jsx`

Current behavior:

- left sidebar filters
- binder layout takes the main space
- filters include:
  - search
  - sort
  - rarity
  - tier
  - affix
  - card type/tag
- rarity filters use gem SVGs
- large viewer modal uses enlarged card sizing
- cards in pocket / active systems render as unavailable

---

## Pocket

`src/components/CardPocket.jsx`

> **Naming:** the UI calls this the **Hand**. The persisted save keys and the component
> filename still say `pocket` — `pocket`, `pocketCapacity` and `pocketExpanded` are save-state
> keys, and renaming them would need a save migration for no player-visible gain. Read `pocket`
> in code as meaning "hand". The **CSS classes are `hand__*`**, since the fan below is all new
> markup and there was nothing to migrate.

A **fan of cards across the bottom edge**, roughly half showing, with hovering a card lifting
it fully into view.

This replaced a right-edge slide-out drawer, for reach: a side drawer is close to whatever
happens to be on that side and far from everything else, whereas the bottom edge is roughly
**equidistant from every station** — which is what matters for a surface whose only job is
dragging cards into slots scattered across the view. It also hands the Bag the whole right
edge back (see Inventory).

Current rules:

- stores full card objects, order is meaningful (it drives left-to-right order in the fan)
- default capacity 3, expandable to **6** (`MAX_POCKET_CAPACITY`). It was 10; `POCKET_SLOT_COSTS`
  stops at the `5 -> 6` step accordingly. A save written under the old ceiling is trimmed to 6 on
  load — `clampPocketCapacity` already lowered the *capacity*, but nothing trimmed the cards, so a
  10-card hand kept rendering in a six-slot fan. The overflow is simply dropped, since the hand holds
  copies and the Collection still has every one of them
- **only the cards you hold are drawn.** The old drawer rendered `capacity` numbered slots
  including empties; a fan of mostly-empty ghost cards reads as an unfinished layout rather
  than a hand. Capacity lives in the rail's `filled/capacity` readout instead
- **the fan is always out. There is no show/hide toggle**, and `--dock-gutter` is therefore a
  constant `14rem`. A carrier that feeds every station should not be something you open first, and a
  control that can hide it is one more state where a drag has nowhere to land. `pocketExpanded` is
  still read from the save and still written back, but nothing changes it — kept so an older build
  reading this save finds the key it expects, and so a future collapsible hand needs no migration

### Fan geometry

**A card carries only an ANGLE.** The sideways spread and the lower sit of the outer cards fall
out of rotating about `--hand-pivot`, a point ~500px below the card's bottom edge. Composing
separate x / y / rotate transforms per card was the alternative, and it needs all three kept in
agreement as the count changes; one angle cannot fall out of step with itself.

`PIVOT_PX` lives in `CardPocket.jsx` and is fed to CSS as `--hand-pivot`, because the arc maths
needs the same number — two copies would drift.

| Constant | Value | Why |
|---|---|---|
| `--station-card-w` / `-h` | 170 × 246 | the standard card, shared with every station slot |
| `MAX_STEP_DEG` | 6 | degrees between neighbours; `pivot × sin θ` ≈ 69px of spread |
| `MAX_SPREAD_DEG` | 34 | total fan width. See below — this is not a look preference |
| `ARC_DEPTH_PX` | 20 | **exact** arc depth; also fed to CSS as `--hand-arc` |
| `--hand-hidden` | `h × 0.2 − arc` | how much of a card sits below the viewport edge at rest |

- **The hand card is the standard station card**, so a card does not change size when you drag it
  out of your hand into a slot. See "One card size everywhere" under Foundry.
- **`MAX_SPREAD_DEG` is capped tight because the outer angle is what buries the outer cards.**
  Rotating about a pivot 660px down sags a card by `pivot × (1 - cos θ)` — 52px at ±23°, which
  left a full hand's end cards 72% below the edge showing neither nameplate nor art. At ±17° it
  is 29px.
- **`ARC_DEPTH_PX` is exact, not additive.** The per-card drop *subtracts the pivot's own sag back
  off* and substitutes this value, so the drop goes negative for a wide fan — it is cancelling
  curvature the rotation already produced. The pivot sag is ~4px for three cards and ~29px for ten,
  so anything additive made the arc grow with the hand and pushed the end cards below the target
  no matter what the resting offset was. Being exact is what lets the resting height be *pinned*.
- **`--hand-hidden` is derived from the arc, and the two are coupled.** The target is
  **80% of every card showing**, and the binding case is the outermost card, which the arc leaves
  lowest by exactly `--hand-arc`. So `hidden = 20% of the height − arc`. Measured 83–88% showing at
  rest. Raising one without lowering the other drops the end cards below the target.
  It was 60% showing first, which still read as "too low and barely visible" — at this card size 40%
  hidden is ~98px, which buries the affix lines and most of the art.
- Hover reveals **100%**: verified fully on screen, upright, and remove button reachable, for every
  card at every hand size.

### Two rules this layout breaks if you undo them

1. **The hit box does not move; only the art does.** `.hand__slot` is rotated into place and then
   stays put. The lift lives on `.hand__lift` inside it. Transforming the slot slides the hover
   target out from under the pointer, which drops the hover, snaps back and re-triggers — chatter
   that reads as several cards reacting at once. The old drawer's sideways peek hit the same trap.
2. **`:hover` survives onto the lifted card because `.hand__lift` is a DESCENDANT of the slot.**
   An ancestor stays `:hover` while the pointer is over a descendant even when that descendant is
   transformed outside the ancestor's box, so the revealed card and its remove button are
   reachable. Hoist the lift out of the slot and the card becomes untouchable.

#### The lift is half a card, and the revealed card stays tucked

`--hand-lift` is `50%` of the card height. It was a full card height, chosen so the revealed card
cleared every resting card and no restacking was needed — but that read as too much travel.

At a half lift the revealed card still overlaps the cards fanned on top of it, and **that overlap
cannot be fixed by raising the art.** `.hand__slot` carries a `transform`, and a transformed element
always establishes a stacking context whatever its `z-index` — so a `z-index` on `.hand__lift` is
confined to its own slot and cannot paint above later slots. Tried, measured, no effect.

Raising the **slot** would work for paint and break interaction: a slot's hit box is a whole card
wide while the strip it *exposes* is one fan step wide, so a raised slot covers its neighbours'
strips and you cannot slide sideways onto the next card without leaving the fan and coming back.
That was the original reason the bump was removed.

So the lower portion of a revealed card stays behind its neighbours — which is what a card pulled up
out of a real fanned hand looks like. Measured 60–100% of the card unoccluded depending on how many
cards sit on top of it; the nameplate, art and affixes are always clear, which is what has to be
readable. Verified sliding from card 0 to card 1 still works.

The reveal also **counter-rotates** (`rotate(calc(var(--hand-angle) * -1))`) so the card reads
upright — in the fan the tilt makes the arc, but on its own a tilted card just looks crooked. The
`translateY` after it travels along the card's own axis, not straight up the screen, because this
element's containing frame is the rotated slot: an outer card drifts ~30px outward as it rises,
which reads as pulling it out of the fan, and lands ~3px lower than a middle one. Not worth
composing sin/cos terms in CSS to remove.

**There is no separate `HoverCardPreview` here** — the lift scales to 1.22 and *is* the preview. A
floating panel on top of an already-revealed card is redundant.

**The remove button sits INSIDE the card's top-right corner** (`top/right: 6px`, 24px, so 29px once
the reveal scale is applied). Hanging off the corner at `-7px` it was a small target floating in
empty space beside fanned, rotated artwork — easy to miss and easy to slide off. Inside the corner
the pointer is already on the hover target when it arrives.

### The catch band

`.hand__band` spans the full width so "drag to the bottom of the screen" needs no aim, and it is
**`pointer-events: none` until a drag is actually in flight** — a permanently live strip across the
bottom of every view would swallow clicks meant for the page underneath. A window-level
`dragstart` / `dragend` pair drives `dragActive`.

`dragend` is the authoritative reset: it always fires on the drag source however the operation
ended. The `drop` listener is a bubble-phase backstop and **must not be capture-phase** — capture
runs window-first, so it would clear `dragOverIndex` before the slot's own drop handler could read
it.

### Drag payload

`text/plain` carries the bare card id, because **every station slot's drop handler already
reads that format** and must keep working. Source information rides in a second MIME type,
`CARD_SOURCE_MIME` (`application/x-card-source`), valued `pocket:<index>` or `collection`.
Unlabelled drags are treated as coming from the Collection, so any drop source that predates
this metadata still works.

### Swapping

Station slots used to **reject** a drop when occupied. They now swap, and all of that logic
lives in `App.jsx` — the station components needed no changes, because their `onDrop` was
already wired unconditionally.

| Drag | Drop target | Result |
|---|---|---|
| Hand card | occupied station slot | true swap — displaced card takes the hand index just vacated |
| Hand card | empty station slot | moves, leaves the hand (unchanged) |
| Hand card | another card in the fan | swap |
| Collection card | anywhere on the Hand, room to spare | **appends** |
| Collection card | a card in the fan, hand full | swap — displaced card leaves the hand |

**A card from outside is ADDED while there is room, even when it lands on top of a card.** It used
to always swap by position, which was defensible for the drawer — its slots were discrete numbered
positions you aimed at. In a fan the cards overlap and cover most of the band, so "drag to the
bottom to add" landed on a card far more often than not, and quietly evicted whatever was under
the pointer back to the Collection instead of adding.

**`handlePocketAdd` appends; it used to prepend.** Prepending was right for the vertical drawer,
where index 0 rendered at the top of the stack and a new card wanted to land on top. Index 0 is the
fan's *left end*, so prepending shoved every card you already held one position right — the whole
fan shifted under the pointer each time you added one.

The helpers are `resolveSlotSwap`, `handlePocketReorder` and
`handlePocketPlaceFromCollection`. All three do their work **inside the `setPocket` updater**
so `prev` is the single source of truth — reading `pocket` from the closure would be stale
if two drops landed in the same tick. The displaced card is read from the target slot
*before* any state update, keeping the swap pure.

### Cards can be dragged OUT of a station, and ✕ releases to the Collection

- **`socketedCardDragProps(card)`** (exported from `CardPocket.jsx`) is spread onto the wrapper around
  a socketed `CardFace` — never onto `CardFace` itself, which is memoized and deliberately gets no
  callbacks from slots so it stops re-rendering on every production tick. Wired into the Foundry's
  mine and forge slots and Wilderness's gathering and processing slots.
- The payload is just `station` with **no slot id**: `handleAddToHandFromStation` finds the card by id
  across every slot array and clears it there. All four call sites are identical, and a new station is
  one line in that handler rather than an identifier threaded through its component.
- **It must not call `stopPropagation`.** The Hand's catch band is only `pointer-events: auto` while a
  drag is in flight, and the flag arming it comes from a window `dragstart` listener — which a stopped
  event never reaches, so the card lifted and nothing could receive it. That listener is now
  capture-phase, making the hazard structurally impossible rather than remembered.
- **✕ releases to the COLLECTION, not the Hand.** Slots hold copies and `collection` always still has
  the original, so clearing the slot *is* returning it. Three stations used to push the card into the
  Hand when there was room, so the same button did two different things depending on how full your
  hand was, and silently filled a hand you were about to drag something else into.

**Still not implemented: station-to-station drag.** The hand remains the hub — to move a card from a
mine slot to a forge slot, drag it to the Hand and then to the forge.

### The rail

Bottom-left: the collapse toggle with a `filled/capacity` count, and the buy-a-slot button. Off to
the side rather than centred above the fan, because a hovered card rises straight up through the
middle and would pass behind — or fight with — anything sitting there.

`.main` keeps `padding-right: 3.4rem` so content clears the Bag's tab rail.

**Known limit:** the Collection binder needs roughly 1450px of width for its 8-column
spread plus the 290px sidebar. Below that it clips on the right regardless of the Bag,
and its tab sits over the last column.

## Inventory

`src/components/Inventory.jsx`

Current sections:

- Ores
- Ingots
- Gathered
- Processed
- Arcana

### One canonical inventory per item

**The gathering pools duplicate every ore and every ingot under their own ids.** A `miner` card
socketed in a *gathering* slot rolls `stone`, `coal`, `ironOre`, `silverOre`, `goldOre`,
`platinumOre`, `starlitOre`; a `blacksmith` rolls `steelIngot` … `starlitIngot`. The Foundry's mine
and forge use `iron` and `steel` in separate `oreInventory` / `ingotInventory` maps.

Left alone that gave the game two of everything: a Steel Ingot you gathered and one you smelted were
different objects in different inventories, and the Bag filed the gathered one under **Gathered**
while dedicated Ingots and Ores sections sat right above it. `stone` and `coal` were worse — the
*same id* in two different maps, so one name appeared in two sections with two counts.

- `GATHERED_CANONICAL_TARGET` in `wilderness.js` maps each duplicated gathered id to its real
  inventory and id. Anything absent has no Foundry equivalent and stays gathered — `starstoneChunk`
  included, since `ORE_TYPES` has no starstone.
- `splitGatheredByInventory()` splits a claim queue three ways; `handleCollectGatheredResources`
  routes each part to `gatheredInventory` / `oreInventory` / `ingotInventory`.
- The Bag's Gathered section lists `GATHERED_ONLY_RESOURCES`, not `ALL_GATHERING_RESOURCES`.
- **Save 22** folds existing `gatheredInventory` and `gatheringClaimQueue` ore/ingot entries into the
  canonical inventories and queues, so nothing a player already owns disappears from the section it
  moved to.

Processing recipes only consume `wood`, `fiber`, `resin`, `hyssop`, `mushrooms` and `hide`, so none
of them depended on ores or ingots living in `gatheredInventory` — worth re-checking before adding a
recipe that does.

**Forge fuel returns to the Ores inventory**, matching coal's canonical home. Pick-up hardcoded
`source: 'gathered'` and unload wrote to `gatheredInventory`, so coal that came out of the Ores
section reappeared under Gathered — visibly moving sections just for having passed through the forge,
and differently depending on whether you used the ✕ or picked it up.

Important interactions:

- right-click split-stack / carry flow is implemented for resource inventories
- Arcana resources and Arcana crafted items use the same split-stack carry flow
- counts animate upward when collected amounts increase

### The Bag owns the whole right edge

It used to stop at `bottom: 50%` because the Hand shared this edge in the lower band. The Hand is
a bottom fan now, so the resource grid gets twice the height and no longer needs to scroll on a
normal window.

It stops at `calc(var(--dock-gutter) + 0.6rem)` rather than at the viewport bottom, to keep its
tab clear of the fan — the tab hangs off the panel's **bottom-left** corner, which would otherwise
land right where a fanned card sits on a narrow window.

`--drawer-width` (248px) is still on `:root` and still shared with `.drawer-tab`, but the Bag is
now the only consumer of both: the Hand's tab went with the drawer.

The tab is a **two-pointed bookmark** — a V notched into its left edge leaving a point at each
corner, so it reads as a ribbon end pointing away from the screen edge it hangs off. The shape is a
`clip-path`, which means **the outline cannot be a `border`**: a border is painted on the element's
box and then clipped away, so the notch would have no edge at all while the top and bottom borders
got sliced off at an angle near the points. Instead the element's own `background` is the 1px edge
and `::before` — inset 1px, same shape a pixel shallower — carries the fill gradient. The tab's
children need `position: relative` to sit above that fill layer. There is no `border-radius` to set
any more; it would be clipped away unseen.

### Panel behaviour

The panel keeps its full 272px width at all times and slides on `transform`
(`translateX(272px)` parked → `translateX(0)` open). It used to animate `width` from
30px, which reflowed the body every frame and made the contents squash and spring —
reading as a swing rather than a slide.

The toggle tab sits at `left: -46px` relative to the panel, so when the panel is
parked off-screen the tab is the only part still visible, and it rides along with the
slide. It carries an inline drawstring-sack icon (`SackIcon` in `Inventory.jsx`, inline
so it inherits `currentColor`), a "Bag" label, and the total item count.

Contents are not mounted while collapsed — the panel holds ~80 resource icons.

The older separate `resource pocket` gameplay is removed from the main app flow. Carry placement is now direct from inventory into valid targets.

---

## Foundry

Helpers: `src/game/foundry.js`
UI: `src/components/Foundry.jsx`

### Mine

- cards from pocket can be socketed
- mining starts automatically
- mine queue must be collected manually
- ore weights are driven by rarity tables in `foundry.js`
- mining rewards can also queue:
  - coins
  - elemental motes

### Forge

Each forge row is **two panels side by side**: a card panel at a fixed 190px, and a process panel
taking all the remaining width.

The process panel is a centred vertical flow, ruled apart by hairlines with a diamond set into
each:

```text
FUEL             [coal]
────────◇────────
SMELT    [ingredient] [ore] [aux]
              └───┬───┘             <- merge connector, one stem per slot
                  ▼
────────◇────────
OUTPUT           [ingot]
                 [Collect]
```

- **Cards are 158x230, the same as a mine slot's.** They were 100x144 — the old layout was five
  columns across one row, ~630px of content inside a 666px half, so the card had to shrink and the
  output column was pushed off the end. The slot fills its grid column rather than carrying its own
  width; at a fixed 132px it clipped the 158px card on both sides.
- The card slot's duplicate name label is hidden; the full-size card carries its own nameplate.

#### One card size everywhere

`--station-card-w` / `--station-card-h` on `:root` (**170 × 246**, height derived from the card art's
94/136 aspect) is *the* socketed-card size, used by mine slots, forge rows, gathering slots,
processing rows and the Hand fan alike. Taken from the Wilderness gathering slot, which is the size
that was signed off.

They had drifted, because each site resolved `width: 100%` or `width: 60%` against a **different
container**: a Wilderness gathering slot is 304px wide and a Foundry mine slot 284px, so the same
socketed worker rendered at 170px in one and 158px in the other. Every rule now takes the standard
explicitly:

- `.foundry-mine-slot__card` — `width: var(--station-card-w)` with `max-width: 70%` as the
  narrow-window safety valve, replacing `width: 60%`.
- `.foundry-forge-row .foundry-card-slot__card-face` — explicit lengths, and it covers Wilderness's
  processing rows too since those carry `foundry-forge-row`. `width: 100%` collapses to zero here;
  the slot's inner wrapper gives no definite width to resolve a percentage against.
- The forge's card column is `calc(var(--station-card-w) + 34px)`, derived so widening the card
  cannot leave it clipped. At a hard 190px the 170px card had only 162px of inner width.
- `.hand__card-face` uses explicit lengths **and** the same `--card-detail-scale: 0.82`, not a
  `scale()` transform. Scaling changes apparent type size, so the same card looked different either
  side of a drag.

#### One rail sizes every tile

`.foundry-forge-row__rail` is a **three-column grid, and every band uses it**: Fuel and Output take
the middle column, the three smelt inputs take one each. That is the whole mechanism by which all
five tiles are the same size and centred on one axis — a tile is one column wide, so none of them
carries a width of its own and none can drift. They were 108 and 112 before, with Fuel 8px left of
everything else.

- **The rail has NO grid gap.** Spacing is inset inside each column instead
  (`width: calc(100% - var(--forge-rail-gap))`), which puts a tile's centre exactly on its column's
  centre — 1/6, 1/2, 5/6 of the rail. With a real gap those fractions are only approximate *and they
  drift with panel width*, because the gap is a fixed rem while the tiles are fluid: the connector's
  stems came out 3-4px off the slots they feed, by a margin that changed on resize.
- **`align-items: start`, not `stretch`.** Stretch sets an item's used height from the grid row,
  which overrides `aspect-ratio` — tiles would take their height from the tallest sibling and stop
  being square.
- **`align-self: stretch` on `--cell--output` is load-bearing.** Without it that cell is a
  content-sized flex item, so its rail resolved to 71px columns while Fuel's and Smelt's resolved to
  110px, and Output came out visibly smaller than everything feeding it.
- **The fixed-size overrides are scoped to the rail or the stem host, never to
  `.foundry-forge-row`.** Wilderness's processing rows reuse `.foundry-forge-ore-slot`,
  `__output-card` and `__output-placeholder` **outside** any rail and must keep their fixed 72/112px
  tiles. Several of the base rules sit at specificity 0,2,0 and 0,3,0
  (`.foundry-forge-row .foundry-forge-ore-slot`, `.foundry-forge-row .…__output-card.card-face-wrapper`),
  so the rail-scoped variants match that specificity and **must stay after them in the file**.
- Measured 1100-1920px: all five tiles equal, centred, stems dead on centre, no horizontal overflow.

#### The connector is one stem per slot

`StationMerge.jsx` — inline SVG, not CSS borders, because the lines have to meet exactly. **Shared
with Wilderness's processing rows**, so its stems are keyed by POSITION (`left` / `middle` / `right`)
rather than by what the slot holds: the connector has no opinion about ore versus raw material, and
naming them after the forge's slots would have made Wilderness import forge vocabulary to describe its
own recipes. Each caller maps its own slots onto positions.

- **Each stem is its own part, lit independently**, because a single merged shape could only say
  "this row is working", never *which* input is feeding it. `stems` carries a state per slot:
  `off` (plays no part in this recipe — iron needs no ingredient), `idle` (needed, not satisfied
  yet), `live` (loaded and feeding). Only `live` glows, and the matching slot tile gets a lit border
  via `__stem-host--live`.
- **Stems say what is feeding, the trunk says how far along.** The trunk's lit copy is driven by
  `--forge-progress`; the stems are binary.
- **Right-angle elbows, not diagonals**, and that is forced. The svg carries
  `preserveAspectRatio="none"` so it can stretch to whatever width the process panel is, which
  scales x and y by different factors (~3.5:1). A diagonal would be squashed almost flat and would
  change angle on every resize; verticals and horizontals are immune. The same stretch is why the
  arrowhead is only 16 viewBox units wide — at 30 it rendered ~104px across, wider than the trunk.
- **The lit copy uses `opacity`, not a dash reveal.** Dash lengths are measured in the SCALED
  coordinate space, so `vector-effect: non-scaling-stroke` — which the thick even stroke needs —
  breaks `pathLength` normalisation and the fill draws solid whatever the offset. Two attempts at
  dashes (including `pathLength` as an attribute, which is the correct form; it is not a CSS
  property) both left a bright channel sitting on an idle row.

#### Collecting must not change any bounding size

"The UI briefly collapses when I collect" turned out to be **four independent layout dependencies**,
all found by sampling element heights at 40ms through a collect rather than by reading the code:

1. **`flyToTarget` re-pinned the original tile as `position: fixed`**, taking it out of flow — the
   box it occupied vanished for the length of the animation. Measured as the output cell dropping
   154px → 48px at 241ms and springing back at 843ms (the 600ms callback timer plus a frame). It now
   flies a **clone appended to `<body>`** and leaves the original in place at `visibility: hidden`,
   which unlike `display: none` keeps the box. `clearFlyGhosts()` removes the clones and un-hides
   anything still mounted; the unmount effect does the same, since ghosts live outside React's tree
   and navigating away mid-flight would otherwise strand them.
2. **`.foundry-queue-slots` collapses when its tiles unmount** — and a `min-height` reserve is the
   WRONG fix, which was tried and reverted. A grid distributes leftover space into its rows
   (`align-content` defaults to `normal`, i.e. `stretch`), so a single row of loot stretched to fill
   the reserve and the tiles rendered 109x188 instead of 109x109; they only looked square once a
   second row pushed the content past it. The strip now carries `align-content: start` and no
   reserve. The panel does still shrink when the queue empties, but that is honest — the loot is
   gone — and it no longer drags the forge rows with it, because point 4 below is fixed at the
   source. Holding its height properly would need a reserve derived from the resolved column width,
   which CSS cannot express here.
3. **`.foundry-split` used a bare `1fr`**, whose track minimum is `auto` — so one half's min-content
   width could take space from the other. Now `minmax(0, 1fr)`.
4. **`.foundry-page` was content-sized.** `.main--fit` is a column flex container, so the page is a
   flex item whose cross axis is horizontal; `align-items: stretch` would give it the full pane, but
   **an `auto` cross-axis margin overrides stretch**, and `margin: 0 auto` was there for centring.
   So its width tracked its contents: 1414px → 1334px on one Collect, shrinking both halves by 40px
   and resizing every card, fuel box and output tile in every forge row. `width: 100%` pins it.
   `.wilderness-page` had the identical shape and the identical bug.

Also `scrollbar-gutter: stable` on `.foundry-half`: a forge tile is sized from its rail column, so
the pane's scrollbar appearing or vanishing moved every tile by the scrollbar's 13px. That fired
whenever content crossed the scroll threshold, collect or not.

The lesson worth keeping: **anything sized from a resolved container width is a reflow amplifier.**
A 13px change at the pane became a 40px change in the row.

### The drawer tab rail overlaps the Foundry, and padding cannot fix it

The Bag and Hand tabs are **112px wide** and sit entirely to the LEFT of the drawer panel, so the
obstructed strip is `viewport - 248 - 112` rightwards — present whether the drawers are open or
shut. The forge's right end sits under it on any window below roughly 1900px.

`.main`'s `padding-right` cannot solve this, and raising it was tried and reverted: the drawers are
anchored to the **viewport's** right edge while `.main` is centred inside a 1500px `max-width`, so
the gap between that padding and the rail changes with the window. At 1560px, 7rem of padding still
left content 218px past the rail while narrowing every other view for nothing.

Real fixes, if it ever needs one: stack the Foundry vertically (Mine above Forge) so each uses the
full pane width, or have the drawers reserve space instead of overlaying. Measuring clearance
against `.inventory-panel` rather than `.drawer-tab` overstates it by 112px — a mistake worth not
repeating.

Key rules:

- fuel is per-row, not shared
- coal must be loaded manually
- forge outputs go to `ingotClaimQueue`
- extra rewards go to `forgeRewardQueue`
- **the ingredient slot does not care about load order.** It used to require the row's ore to be
  loaded first, since that is what resolves the recipe and names the requirement — so reaching for
  the ingot first was silently refused and every recipe needing a secondary ingredient (silver,
  gold, platinum, starlit) read as broken. An empty row now accepts **any** ingot; `ingredientOk`
  in the ticker is what actually gates the smelt, so a row holding the wrong one simply is not
  ready. Once a recipe *is* known the type is still enforced, and a refusal restores the carried
  stack to the Bag rather than swallowing it
- **ingots can only be picked up from the Bag.** The Foundry's own rail is the Collection Queue,
  not an inventory — there is no ingot tile anywhere on the page. Worth revisiting: the player is
  standing on the Foundry when they need one

#### `normalizeForgeFuelState` must carry `slotId` through

This destroyed real player resources, so it is worth stating plainly. `startForgeCycle` and
`consumeForgeFuelCharge` both **rebuild their result from `normalizeForgeFuelState` and write it
straight back into `forgeFuelSlots`**. That normalizer used to return only the five fuel fields, so
the first smelt a row ever started erased that row's `slotId` — in state, and therefore in the save.
`normalizeForgeFuelSlots` matches saved slots *by* `slotId`, found nothing, and handed back an empty
slot: on every reload the player's loaded coal was discarded while still sitting in the save file.
This is the reported "coal disappears from the Forge after refreshing", and almost certainly the
"forge becomes unusable after fuel runs out" alongside it.

Two things hold the fix:

- The normalizer **carries `slotId` when the input has one**, and **omits the key entirely rather
  than setting `undefined`** when it does not — callers compose it as
  `{ slotId, ...normalizeForgeFuelState(saved) }`, and an explicit `undefined` in the spread would
  clobber the id they just supplied.
- `normalizeForgeFuelSlots` falls back to **positional index** when the id is missing, which
  *recovers* coal from saves written while the bug was live. The array has always been dense and
  index-ordered, so position is a sound identity when the id is gone.

The forge fuel path was the only one at risk: mining, gathering and processing all spread `...slot`
in their updaters, so those ids survive. **Anything that rebuilds a slot from a normalizer rather
than spreading the slot needs this check.**

Foundry right rail shows:

- ore inventory
- ingot inventory

These use square resource-card styling.

---

## Wilderness

Helpers: `src/game/wilderness.js`
UI: `src/components/Wilderness.jsx`

### Gathering

- cards from pocket socket into gathering slots
- gathering starts automatically
- queue must be collected manually
- gathering can produce:
  - gathered resources
  - coins
  - motes
  - treasure packs

Current gathering resources include:

- wood
- hardwood
- resin
- softwood sap
- petrified wood
- voidwood
- arcanewood
- starwood
- stone
- coal
- iron ore
- silver ore
- gold ore
- platinum ore
- starstone
- starlit ore
- hide / fur / fang / bone / scales
- fiber / hyssop / wildflowers / garlic / wild onion / mushrooms / honey

### Processing

**Processing rows are the same layout as forge rows**, and share the implementation rather than
imitating it: `.foundry-forge-row` for the two-panel grid, `.foundry-forge-row__rail` for the
three-column tile rail, `.foundry-forge-row__stem-host` for the lit-when-feeding slots, and
`StationMerge` for the connector. Measured identical at 1280–1920px: same card size (170×246), same
tile size, stems dead on the slot centres, no horizontal overflow.

```text
        MATERIAL   [aux] [material] [aux]
                     └───────┬───────┘
                             ▼
                     Ready to process
        ────────◇────────
        OUTPUT           [processed]
                         [Collect]
```

Three deliberate differences from the forge:

- **No Fuel band** — processing burns nothing, so there is one ruled divider instead of two and the
  row is ~135px shorter.
- **The real slot takes the MIDDLE column**, with the two unimplemented aux slots either side. The
  forge puts ore in the middle for the same reason: the primary input belongs on the trunk's axis.
- **A status line under the connector.** The forge shows remaining time on its fuel ring; a processing
  row has no fuel box, so without this the countdown existed only in a `title` tooltip.

`--materials` is reused for the input band and the label overridden to `Material`, rather than adding
a parallel cell class — the band is structurally the same thing.

The four-across layout this replaced left `__body`, `__materials-stack`, `__aux` and the whole
`__arrow` progress bar behind; all of that CSS is deleted.

Processed outputs currently include:

- timber
- cloth
- sealant
- alkahest
- mycelial extract
- leather

Wilderness right rail shows:

- collected resources
- processed stock

Queue cards use the same square card treatment as Foundry.

---

## Expedition

Helpers: `src/game/expedition.js`
UI: `src/components/Expedition.jsx`

### State machine

Expedition uses explicit states:

- `idle`
- `setup`
- `inProgress`
- `reveal`
- `collect`

`idle` and `setup` are both editable wagon states.

### Wagon

Main wagon contains:

- unit slots
- supply slots
- arcana slots

Defaults:

- unit slots: 2 base, up to 5
- supply slots: 1 base, up to 5
- arcana slots: 1 base, up to 5

Supply and Arcana unlocks are inline/paywalled slot tiles.

### Top status UI

The redundant status text was replaced with a mini caravan travel strip:

- travel line in the Expedition header
- mini caravan moves left → right while expedition is in progress
- progress is synchronized to `startedAt` / `endsAt`

### Resolution model

Current expedition resolution uses:

- party `power`
- party `survival`
- party `utility`

Scaling function:

```js
scale(stat, difficulty) = stat / (stat + difficulty)
```

Resolution:

- success chance from party power vs expedition difficulty
- per-unit survival from unit survival vs expedition danger
- bonus reward chance from party utility vs reward tier
- weighted loot with luck-adjusted weights

Return values include:

- expedition success/failure
- per-unit outcomes:
  - survived
  - injured
  - dead
- rewards
- bonus rewards

### Reveal phase

Reveal mode shows unit result cards one by one with:

- unit card
- outcome
- survival chance
- reward tiles
- bonus reward tiles

Then `Confirm & Collect` applies outcomes and rewards.

---

## Scene Backdrops

Optional WebGL backdrops behind certain views. `three` is the largest dependency in the
project, so the whole subsystem is built to be **absent** rather than degraded.

```text
src/components/SceneBackdrop.jsx   host; decides whether to mount anything at all
src/scenes/backdrop.js             the ONLY module importing three; renderer + loop
src/scenes/wildernessScene.js      conifer forest, day/night cycle       (Wilderness)
src/scenes/cavernScene.js          worked mine shaft, forge-lit          (Foundry)
src/scenes/splashScene.js          title card
```

### How a view gets one

`BACKDROP_SCENES` in `App.jsx` maps a view to a scene id:

```js
const BACKDROP_SCENES = {
  [VIEWS.WILDERNESS]: 'wilderness',
  [VIEWS.FOUNDRY]: 'cavern',
};
```

A mapped view also gets the `app--scene` class, which makes that view's panels
translucent so the scene reads through them.

### Layers, and why the fallback is never "nothing"

`SceneBackdrop` always renders a **CSS gradient** keyed to the scene, and only lays a
canvas over it when the tier allows:

| Situation | Result |
|---|---|
| quality low / medium | gradient only — three is never downloaded |
| quality high | gradient + canvas, three loaded via dynamic `import()` |
| high but GL refused | gradient only |

A **veil** sits on top of both to keep UI contrast predictable regardless of what the scene
is doing underneath. Its opacity is per-scene and matters more than it looks: the wilderness
is a lit sunset and can lose half its brightness, while the cavern is dark to begin with —
the wilderness veil applied to the cavern took it to a mean luminance of 17 against the
wilderness's 41, which is present in a screenshot and invisible in practice.

### The builder contract

Each scene exports `build(THREE)` and returns:

```js
{ scene, camera, update(elapsedSeconds), dispose(),
  bloom?: { strength, radius, threshold },        // opt in to UnrealBloomPass
  toneMapping?: { type, exposure } }              // opt in to tone mapping
```

`camera` may be perspective **or** orthographic. An orthographic camera has no `aspect` — its
frustum is set by explicit edges — so it must carry `camera.userData.viewHeight`, the world
height it wants in view. `resize()` in `backdrop.js` rebuilds `left/right/top/bottom` from
that and the viewport aspect, which is what keeps pixels square. Forget it and the scene
stretches on every window that is not the size you developed at.

`THREE` is **passed in, never imported** by a scene module — that is what keeps three out
of the main bundle. `bloom` and `toneMapping` are opt-in per scene so one scene's needs
cannot silently change another's look.

The loop runs at a capped 30 fps, pauses on `visibilitychange`, and anchors elapsed time
across pauses so a cycle does not jump on resume.

### `failIfMajorPerformanceCaveat: true` must stay

In `backdrop.js`. It makes the context request **fail** on a software rasteriser instead of
handing back a renderer that would run at single-digit fps — which is precisely the
school-Chrome case this work started from, and is not detectable by sniffing CPU or memory.
`mountBackdrop` returns `null` and the gradient stands in.

Note for anyone capturing headlessly: this flag is exactly what turns SwiftShader away, so
a headless browser cannot mount a scene without temporarily relaxing it. Revert it.

### Orthographic bird's-eye, and what it drags along with it

**Wilderness and Foundry are both angled orthographic bird's-eye.** The splash scene is
deliberately still perspective — it is a title card, not a place.

Switching projection is not a camera swap. Four things had to change with it, and each was
invisible until the view moved:

- **Content distribution follows the frustum.** The forest placed everything in a *wedge*
  (`spread = 130 + depth * 330`) because a perspective frustum widens with depth, so a wedge
  is exactly what fills the frame. An orthographic frustum is a box, and that same wedge
  renders as a triangular clearing with bare ground at the near corners. Trees, grass, bushes
  and rocks now share one rectangle — `AREA_X` / `AREA_Z_NEAR` / `AREA_Z_FAR`, with `depthAt(z)`
  supplying the haze and thinning that `depth` used to.
- **`FogExp2` stops working the way you expect.** It attenuates by *absolute distance from the
  camera*. An orthographic rig stands well back from its target — the standoff is a free
  parameter that only fog and clipping notice — so every surface sits at a similar distance
  and the whole frame fogs uniformly. At the cavern's original density the result was a flat
  brown veil with no depth information in it at all. The cavern now uses **ranged
  `THREE.Fog`** (`FOG_NEAR` / `FOG_FAR`); the wilderness kept `FogExp2` but cut its densities
  by a third and pulled the standoff from 210 to 150.
- **Elevation angle decides whether you see the ground.** The forest at 38 degrees looked
  *through* the rows: the canopy occluded the floor completely and it read as a flat side-on
  wall of trees. 52 degrees, with the tree count down from 260 to 185, shows the ground —
  which is half the point.
- **Detail sized for one viewing angle can be wrong at another.** Grass was 1600 thin
  9-unit cones. Correct from a camera standing in the field; from above, 1600 vertical
  scratches over the ground. They are squat tufts now (`BLADE_H` 4.5, radius 0.85, less wind
  sway), which is what a clump of growth looks like from overhead.

Both veils were re-tuned **in opposite directions** afterwards, measured against the UI
rather than guessed: the wilderness got heavier (it now shows far more sunlit ground) and the
cavern lighter. See the veil note above — this is exactly the job it exists to do.

### Splash scene notes

Layered ridge silhouettes behind the title and the main menu. Three things decide whether it
reads as mountains or as moorland:

- **Peaks, not sines.** The profile is a set of overlapping triangular summits with randomised
  height and half-width (`makePeaks` / `peakProfile`), giving sharp tops and deep saddles. Two
  summed sines give evenly spaced rounded humps, which is a moor.
- **Peak size is specified in WORLD units, not as a fraction of ridge width.** Sizing them
  relatively made them scale with the ridge: a 1700-unit ridge got 250-unit-wide summits against
  a 76-unit rise — a hill. Steepness is the whole effect, so it is set independently of width.
- **Ridge widths are sized to the visible frame plus parallax margin.** The old 1700-unit ridges
  put only two or three summits on screen, so the range read as a couple of broad humps.

Each ridge is positioned by `baseY` / `saddleY` / `summitY` — where its silhouette should land in
frame — rather than by an abstract amplitude, and the profile is normalised against its own
maximum so `summitY` means what it says whatever the random peaks came out as. An earlier version
scaled displacement as a fraction of body height; because the profile maximum varies, the near
ridge's summits reached 469 units and filled the frame with flat dark purple, which looked
exactly like an empty scene.

Summits step **down** toward the viewer, which is how a real range reads — far peaks sit highest
in frame. Rows are displaced in proportion to their height up the plane, not just the top edge,
which is what leaves room for a snowline; with a single row there is nowhere to put one and the
mountains look like cut paper. Material colour is white and the vertex colours carry the hue,
for the usual reason.

The sky's bands are compressed toward the horizon. Spread evenly, the warm dawn colour sat at the
bottom of the sphere, entirely behind the ridges — so the sky read as flat night with the one
thing that made it dawn permanently hidden.

**Nothing moves in this scene but the camera.** It used to carry its own field of rising motes as
well as the DOM rune stream, and two unrelated drifts crossing each other read as noise rather
than as one effect. The screen's only particles are the diagonal stream in SplashScreen.jsx.

### Cavern scene notes

A cave is defined by what is lit, so the priorities are close to the inverse of the forest:

- **An open-roofed arc built from `shaftPoint` over an (angle, z) grid**, not a cylinder. The
  roof is cut away between `ARC_START` and `ARC_END` so a camera above can see in at all — a
  tunnel viewed from inside has nothing to offer a bird's-eye view. `shaftRadius(z)` and
  `wallOffset(angle, z)` are shared by the shell, the ore, the spurs, the floor and the
  surrounding surface, so every feature agrees on where the rock is.
- **The surrounding rock surface is what makes it read as a mine.** Two strips running out
  from the open lips (`rimPoint`, `SURFACE_OUT`). Without them the cutaway floats in haze with
  flat fog in the corners of the frame; with them, the same geometry is a trench driven into
  solid rock. `SURFACE_SEGS` is 50 rather than a handful because the strip reuses `LEN_SEGS`
  rows to match the rim exactly — at 7 columns the facets were 1.9 x 13.6 units, and flat
  shading turned those ribbons into a corduroy texture that read as rope.
- **A non-attenuating top fill exists for a layout reason.** The surface is beyond every
  lamp's reach and renders at a third of the trench's brightness. Fine for a picture — but
  the UI panels cover the middle where the lit trench is, so the regions a player sees
  through are the dark corners. A `DirectionalLight` lifts them without touching the lamps'
  falloff.
- **The floor is width-matched to the shaft** via `floorHalfWidth`. It began as a fixed
  76-wide plane, which overhung the rock; because the shell renders `BackSide`, that apron
  was plainly visible outside the tunnel as a large flat surface.
- **Three lamps receding** (forge, hung mid-shaft lamp, far lantern). Two left an unlit gap
  in the middle, and unlit rock reads as absence rather than distance.
- **Ore is lit by baked proximity** to those lamps (`lightReach`), not uniformly. Ore uses
  an unlit material so it survives the dark; applied uniformly it read as confetti hanging
  in mid-air, because a bright speck in front of black rock has nothing to belong to.
- **The shell is flat-shaded** — the rock exception the forest already makes for boulders —
  and carries a facet-scale noise term. Without a term at facet scale the fire-lit wall was
  one smooth gradient.

---

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

## Asset Notes

**All raster art is WebP.** There are no PNGs under `src/assets/`. Anything that
globs or imports art must use `.webp`.

Important asset folders:

- `src/assets/class-cards/`        768x1152 card art (detail)
- `src/assets/class-cards-thumb/`  320x480 card art (thumb)
- `src/assets/elements/`           384px square icons
- `src/assets/ores/`               384px square icons
- `src/assets/ingots/`             384px long edge
- `src/assets/resources/`          384px square icons
- `src/assets/cards/charms/`       384px square icons
- `src/assets/rarity-gems/`        SVG
- `src/assets/tier-stars/`         SVG

### Asset pipeline

`npm run optimize-assets` (`scripts/optimize-assets.mjs`) reads originals from
`src/assets-original/` (gitignored) and writes sized WebP into `src/assets/`.
It always reads originals, never its own output, so it is safe to re-run with
different targets. Sizes are derived from the largest size each asset renders at,
doubled for 2x DPR:

- card art at 330px in the viewer modal → 768x1152 detail
- card art at 132px in the binder cell → 320x480 thumb
- square icons at ~110px in sidebars → 384px long edge

`src/assets-original/` is not in git. To regenerate it, `git checkout` an older
commit's `src/assets` or re-export from source art.

### Two card art sizes

`src/game/cardArt.js` exports `CLASS_ART` (detail), `CLASS_ART_THUMB`, and
`getClassArt(classType, artVariant, detail)`. `CardFace` takes an `artDetail` prop
defaulting to `'thumb'`. Only three call sites pass `'full'`: the Collection viewer
modal, `HoverCardPreview`, and the pack-reveal `center-card`. Everything else is
110-160px and the thumb is ample. This matters — the binder renders 32 cards at
once, and thumbs are 0.59 MiB decoded against 3.38 MiB for detail.

### Removed

`src/assets/cards/{common,uncommon,rare,epic}` held 296 MB of legacy creature art
that no live code referenced. It and the dead `CARD_ART` glob in `cardArt.js` are
gone. Recoverable from git history if ever needed.

Known filename oddity:

- `blooming quitessence.webp` is misspelled in assets and handled in code

Coin reward art:

- `few coins.webp`
- `lots of coins.webp`

---

## Current Handoff Warnings

- `CLAUDE.md` was previously stale; this version is intended to replace it fully.
- `ResourcePocket.jsx` still exists but is not the active gameplay path.
- `arcanaCrafting.js` is mostly legacy/secondary versus the current ring-craft UI.
- audio architecture exists, but no sounds are mapped yet.
- build passes. The remaining chunk-size warning is the JS bundle (~497 kB), not
  images — the image payload is now 11 MB total.

## Performance Invariants

Undoing any of these reintroduces a measured regression:

- **Never import card art without picking a size.** Use `getClassArt(...)` or
  `CardFace`'s `artDetail`. A 1024x1536 source is 6.0 MiB decoded; the binder
  shows 32 at once.
- **One production ticker.** `App.jsx` has a single 1s interval driving forge,
  mine, gathering and processing, each guarded by an `anyDue()` check so idle
  ticks allocate nothing. It reads state through refs (`mineSlotsRef`,
  `forgeFuelSlotsRef`, ...) so it is created once with `[]` deps. Do not add a
  second interval.
- **Forge start is event-driven, completion is polled.** Starting a smelt runs in
  its own effect keyed on forge state so loading coal starts a cycle immediately;
  only completion waits for the tick.
- **The save is debounced** (`SAVE_DEBOUNCE_MS`, 2s) and flushed on `pagehide` /
  hidden `visibilitychange`. It used to run a full `JSON.stringify` of the entire
  save on every one of ~35 dependencies changing.
- **`CardFace` is memoized.** Slot-socketed cards pass no callbacks, so they hit
  the memo and stop re-rendering on every tick. Passing a fresh inline callback to
  a slot-rendered `CardFace` silently defeats this.
- **The Inventory panel does not mount its contents while collapsed.** It holds
  ~80 icons.
- **`failIfMajorPerformanceCaveat: true`** in `src/scenes/backdrop.js`. See Scene
  Backdrops — it is the only thing that turns away software rasterisers.
- **Scenes never import `three`.** They receive it as an argument. A single static
  import anywhere in `src/scenes/*Scene.js` pulls three into the main bundle and
  low/medium tiers start paying for it.

---

## three.js gotchas that produced hours of wrong diagnosis

All three make geometry render *black*, which looks identical to a lighting problem:

- **Lights are physically based** (three >= r155). `PointLight.intensity` is in candela and
  falls off as `1/d^decay`. The cavern's fire began at `2.6`, which delivered `0.015` to a
  wall 20 units away — the entire shaft rendered black. It needs ~`210`. Directional and
  hemisphere lights do not attenuate, which is why the wilderness scene never hit this.
- **`instanceColor` and vertex colours MULTIPLY the material colour.** Supplying a dark rock
  tone in both places squares it: `0x463d35 x 0x2f2a25` is about 0.2% reflectance. Where
  per-instance or per-vertex colour carries the real hue, **the material must be white**;
  where it carries variation, it must be a multiplier centred on 1.0. Note colours are
  converted to *linear* space, so components land near 0.03-0.08, not the ~0.28 an
  sRGB-shaped normalisation would assume.
- **Fog is applied after lighting and dominates an enclosed scene.** In the cavern, fog
  covers most of the frame, so `FOG_COLOR` effectively *is* the mid-tone. At near-black
  everything past ~40 units collapsed and raising ambient fivefold barely moved the
  histogram.

When a scene looks wrong, **raycast the pixel** before adjusting anything. The cavern's
"featureless smooth wall" turned out to be the fire's glow **sprite** — sprite scale is in
world units, and at 20 units across, 18 units from the camera, one additive quad covered a
third of the frame and hid everything behind it. Two rounds of lighting and shading changes
went into a surface that was not there.

---

## Current Source of Truth

If docs and code disagree, trust these files first:

- `src/App.jsx`
- `src/game/cards.js`
- `src/game/arcana.js`
- `src/game/foundry.js`
- `src/game/wilderness.js`
- `src/game/expedition.js`
- `src/game/audio/audioEngine.js`

