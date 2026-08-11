---
paths:
  - "src/components/CardPocket.jsx"
  - "src/components/Inventory.jsx"
  - "src/components/Collection.jsx"
  - "src/components/HoverCardPreview.jsx"
  - "src/components/ResourceQuantityPopover.jsx"
---

<!-- Path-scoped rule: loads only when Claude touches the files above. Split out of a single
     3,335-line CLAUDE.md, which was ~45k tokens in every session before any work began. -->

# Hand And Inventory

The Hand (persisted as `pocket`), the Bag, and the Collection binder.

> Cross-cutting invariants (scroll ownership, the CSS ordering trap, the save shape, the gold
> seam, card identity, performance) live in the root `CLAUDE.md`, which is always loaded.

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

### The rune arc

A persistent half-ring of runes across the bottom of the screen, behind the cards. It is the standing
answer to "where do cards go?" — before it, the only hint was the catch band, which appeared *only once a
drag had already started*, so a player who did not know cards were draggable had nothing to discover, and
the band's full-width tinted slab read as a layout glitch when it flashed in. **The band now draws nothing
and is a pure hit area.**

**Parameterised by APEX and RADIUS, not by centre.** The first attempt set centre and radius directly and
produced a 1520px circle whose top half filled the screen, with one of seven runes visible. Apex (how far
above the screen edge the crown sits) and radius (how flat the curve is) are the two things that matter;
the centre is derived as `radius - apex` below the edge, in CSS, so the ring and the runes cannot decouple.

**The numbers are constrained, not chosen.** A rune at angle θ sags `radius × (1 - cos θ)` below the crown,
so the outermost rune sits `apex - sag` above the screen edge and goes *off screen* if that is negative. At
the ±38° spread: radius 980 puts it 8px below the edge; radius 860 with a 250px apex puts it 68px above,
and lands the centre at 610px. Currently **radius 602, apex 175** (30% smaller than that first pass), which
keeps the outermost rune 47px above the edge and gives a 741px-wide arc.

**Each rune is two elements.** The outer is a zero-size point on the crown that rotates about the circle's
centre; the inner carries the glyph. One element cannot do both, because `transform-origin` is measured
against the element's own box, so a sized element's origin drifts from the true centre by half its height.

| State | Appearance |
|---|---|
| empty hand | dim, **no animation at all** — inert by design |
| holding | brighter ring and runes, glow, pulse, and **the ring rotates** — see below. Runes 7 → 15 visible with `filled / capacity` |
| drag in flight, room to spare | `--inviting`: ring border 0.26 → 0.6 alpha, runes near-white |
| drag in flight, hand full | `--refusing`: red, and the label becomes `Hand full — N/M` |

**The spin is seamless with ~17 runes, not 72.** Runes are spaced by a fixed angular *step* rather than
spread to fit a count, so the ring looks identical after rotating by exactly one step — the animation
travels one step and loops. That is why the whole circle does not have to be populated to keep runes
entering the visible crown; one step of overscan at each end is enough (9 rendered at an empty hand,
17 at a full one, for 7 and 15 visible).

Speed scales with fill and is **zero when empty** — an idle hand does not move at all. `ARC_SPIN_MAX_DEG_PER_SEC`
is 5, reached at a full hand; measured 0.83°/s at one card and 4.98°/s at six.

**A full hand is not a warning.** Red was initially the resting appearance of a full hand, which made the
state the player was working towards look like an error. It is now only shown while a drag is actually
being refused.

**The brightness change is static as well as animated**, because `animation` is switched off at low and
medium quality — the same rule the loot diamond follows. Verified at low: ring border and rune colour both
still change, and the glow is a `box-shadow`, not a keyframe. The pulse is the bonus; the glow is the signal.

**The label sits above the fan** (`z-index: 3`, anchored to the apex). It was inside the fan's band at
`--dock-gutter`, which put it behind the cards — so "Hand full" was hidden by the very cards that made the
hand full. It also replaced the old `.hand__empty` line, which said the same thing a few pixels lower.

**No placement echo for a drop into the hand.** `signalCardPlaced(card, { echo: false })` — the sound still
plays, since the card did move, but the shockwave is reserved for committing a card to a station. Firing it
here made picking a card up look as consequential as socketing one, and it fought the arc, which is already
lighting up for the same event.

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

- every owned Bag tile supports both **click-to-carry** and native **drag-and-drop**. Native drags reserve
  the stack through the same `handleBeginCarry` path, then `App.jsx` routes the drop to the existing station
  placement handlers; a rejected/cancelled drag restores the reservation exactly once
- `RESOURCE_DRAG_MIME` distinguishes Bag drags from card drags. The browser drag ghost is transparent;
  `carried-resource-cursor` is the single held visual and resolves the same artwork as the source tile
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

The Bag's `inventoryRef` is attached to the always-visible **Bag tab**, not the drawer header. The closed
drawer translates its header completely beyond the viewport; using that hidden header as a collection-flight
target sent gathered cards through the Wilderness panel's right edge and offscreen. The tab stays onscreen in
both drawer states and is the stable landing point for Foundry, Wilderness and summon resource flights.

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
