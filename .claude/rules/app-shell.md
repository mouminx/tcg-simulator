---
paths:
  - "src/App.jsx"
  - "src/components/SplashScreen.jsx"
  - "src/components/Gold.jsx"
  - "src/components/GoldBurst.jsx"
  - "src/components/PlacementEcho.jsx"
---

<!-- Path-scoped rule: loads only when Claude touches the files above. Split out of a single
     3,335-line CLAUDE.md, which was ~45k tokens in every session before any work began. -->

# App Shell

The chrome around the views: nav and its indicators, the title screen, typography, and the gold and placement effects.

> Cross-cutting invariants (scroll ownership, the CSS ordering trap, the save shape, the gold
> seam, card identity, performance) live in the root `CLAUDE.md`, which is always loaded.

## Navigation

Current view order:

```text
Cards → Collection → Arcana → Foundry → Wilderness → Expedition → Lab → Market
```

**Eight tabs, not nine — `VIEWS.UNPACK` is deliberately absent from `VIEW_ORDER`.** Buying a pack and
opening it are one activity and they were two pages, so every purchase ended in a tab switch. See
**The Cards page** below. The `VIEWS.UNPACK` constant itself stays: `TAB_ACCENTS` and older saves'
`lootSeen` keys are written against it, so removing it would be a rename with a migration attached.

Notes:

- `Cards` is the shop page (`VIEWS.SHOP`), laid out as **shelves**: each section is a
  plank with packs standing on it and price tags hanging from its front edge. The pack
  itself is the buy button. Each pack keeps its `shop-pack-card--{id}` modifier class
  so the pre-existing per-pack glow and hover-colour rules still apply. `PackCard`
  takes `size="shelf"` (134x195). It also carries the summoning altar in its right column.
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
to extend if Arcana should ever get one — it currently holds Foundry, Wilderness, Collection
and **Shop**. Shop's diamond is the unopened-pack count, which moved there with the Summon
page (see **The Cards page**); its semantics are unchanged — pending while packs are held,
gone when the last one is opened.

### Collection's diamond means something different

Foundry and Wilderness have a **pending queue**, so their diamond persists until the loot is collected.
Nothing is pending in the Collection — a new card is simply there — so its diamond means "cards arrived
since you last looked" and clears on the visit itself.

That difference lives entirely in `collectionSeen` (the collection size as of the last visit), not in a
special case in the indicator code: `lootPending[COLLECTION]` is `collection.length - collectionSeen`, so
visiting takes it to zero and the diamond disappears through the same path the others use.

- **Clamped at zero.** Selling cards drops the collection below the seen count, which would otherwise be
  a negative "pending".
- **The visit effect depends on `collection.length`, not just `view`.** Without that, a card arriving
  while the binder is open would light the tab the player is already looking at.
- **Absent on an older save means "all seen"** — the same graceful default `lootSeen` uses, and the reason
  this needed no migration. A player loading an existing save should not be told their whole collection
  is new.

**No tab label carries a count any more.** The diamond says "something new is in here", which is the part a
player acts on; a running total is noise on a bar with ~6px of slack at 1024px. Summon's `(N)` went with the
Summon tab — an unopened pack count is a to-do rather than a total, and the Shop's diamond now carries it
with exactly that meaning.

Both differences between `new` and `seen` (brightness/size and the halo) are **static** as
well as animated, because `animation` is switched off at low and medium quality. The glow is
a gameplay signal, so it has to survive that — the same reasoning as Collection's grayscale
on locked cards.

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
