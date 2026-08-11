---
paths:
  - "src/components/Foundry.jsx"
  - "src/components/Wilderness.jsx"
  - "src/components/StationMerge.jsx"
  - "src/game/foundry.js"
  - "src/game/wilderness.js"
---

<!-- Path-scoped rule: loads only when Claude touches the files above. Split out of a single
     3,335-line CLAUDE.md, which was ~45k tokens in every session before any work began. -->

# Stations

The Foundry and the Wilderness: mine, forge, gathering, processing, the row selector and the collection queues.

> Cross-cutting invariants (scroll ownership, the CSS ordering trap, the save shape, the gold
> seam, card identity, performance) live in the root `CLAUDE.md`, which is always loaded.

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

1. **Collection code re-pinned original tiles as `position: fixed`**, taking them out of flow — the
   box it occupied vanished for the length of the animation. Measured as the output cell dropping
   154px → 48px at 241ms and springing back at 843ms (the 600ms callback timer plus a frame). It now
   flies a **clone appended to `<body>`** through `src/game/lootFlight.js` and leaves the original in place
   at `visibility: hidden`, which unlike `display: none` keeps the box. This is also required for paint
   order: z-index cannot escape the Foundry/Wilderness halves' overflow clipping. The shared cleanup
   removes clones and un-hides anything still mounted; every consumer also cleans up on unmount, since
   ghosts live outside React's tree and navigating away mid-flight would otherwise strand them.
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
- forge outputs go to `forgeOutputQueues[slotId]`; ownership is per row, even when two rows make the
  same ingot. A row's Collect subtracts only its press-time snapshot, so output completed during the
  flight remains waiting
- extra rewards go to `forgeRewardQueue`
- the Forge output button and Bonus Queue button are independent. Neither may collect the other's state
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

### Mine and Gathering worker workspace

Mine and Gathering cards share the same worker-slot treatment:

- the old circular countdown is gone; `.station-cycle-progress` is a full-width, bottom-anchored bar
  whose fill grows from elapsed progress, matching the Forge/Processing selector convention
- the card's right-hand workspace is split vertically. The top half is a deliberately empty
  `Tool / Buff` socket reserved for future roll-modifying equipment; the bottom half is `Loot`
- a completed cycle creates a persisted per-slot staging event instead of writing directly into the
  collection queue. Its loot and bonus rewards appear as one compact horizontal stack beside the card
- near `releaseAt`, those rendered tiles are cloned into the body-level loot-flight layer and travel
  downward to the queue. Only when the flight completes does GameApp merge the event into
  `mineClaimQueue` / `mineRewardQueue` or `gatheringClaimQueue` / `gatheringRewardQueue`
- staging is owned by GameApp, not the mounted page. It therefore settles while another tab is open,
  and saved `mineLootStages` / `gatheringLootStages` make a reload during the hand-off lossless

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

Pending processed output is stored in `processingOutputQueues[slotId]`, not one resource-wide map. Bench
buttons collect only their own output; the Processing Bonus Queue has its own callback and cannot be swept
up by a bench-level Collect. Loading a different recipe into a row is refused while that row still owns a
different output type, keeping the single output tile truthful.

Material sockets display their live load as `placed / required`, using the selected recipe's actual cost.
Forge ore, required secondary ingots (including `0 / required` while empty), and Processing inputs all use
the same compact counter treatment. Inventory and output cards continue to show a plain owned count.

Wilderness right rail shows:

- collected resources
- processed stock

Queue cards use the same square card treatment as Foundry.

---
