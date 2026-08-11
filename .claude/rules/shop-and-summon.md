---
paths:
  - "src/components/Shop.jsx"
  - "src/components/UnpackPage.jsx"
  - "src/components/PackOpening.jsx"
  - "src/components/PackCard.jsx"
  - "src/components/CardFace.jsx"
  - "src/components/LootTile.jsx"
  - "src/game/shop.js"
---

<!-- Path-scoped rule: loads only when Claude touches the files above. Split out of a single
     3,335-line CLAUDE.md, which was ~45k tokens in every session before any work began. -->

# Shop And Summon

The merged Cards page: shelves, goods, upgrades, the summoning altar, pack and cache opening.

> Cross-cutting invariants (scroll ownership, the CSS ordering trap, the save shape, the gold
> seam, card identity, performance) live in the root `CLAUDE.md`, which is always loaded.

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

### The Cards page: shelves left, summoning altar right

`.shop-summon` in App.css; composed in `App.jsx`'s `VIEWS.SHOP` branch from `<Shop>` and `<UnpackPage>`.
Buying a pack and opening it are one activity and they were two pages, so every purchase ended in a tab
switch.

**The altar is a RAIL, not an equal half, and that came from measurement.** An even split at 1366x768 gave
each column ~650px, which pinned the shelf packs at 76px with unreadable descriptions. The shelf needs
~700px for five legible packs; the altar's fan and summoning field are comfortable much narrower.
`clamp(300px, 27%, 420px)` gives the shelf 849–1010px and packs of 109–141px, against 145px before the merge.

**A reveal happens IN PLACE, inside the altar column.** `.shop-summon--opening` dims the shop side to 0.32
and sets `pointer-events: none`; it does **not** hide it, and the grid does **not** re-proportion. It used to
do both. Two reasons it no longer does: a pack opening on a page that briefly becomes a different page is
the separate screen this merge existed to remove, and re-proportioning the columns mid-reveal would resize
every shelf pack at the moment the player's attention is elsewhere. A layout that jumps when the payoff
starts is worse than one that is merely narrow.

That is why the altar rail is sized for a **card**, not for a pack row — nothing expands to accommodate the
reveal, so its resting width has to hold one. The drawn cards are a `.stack-line` too, and the held-pack row
is **collapsed** (`display: none`) while a reveal is in flight: it reserves 200px "for layout stability",
which is right while choosing a pack and pure waste once one is open — measured 200px holding nothing but a
16px hint. Together those took the altar's scroll during a reveal from 357px to 157px. The class is still driven by the `opening` flag App already
derives for the tab lockout, **not** by CSS `:has()`, so there is one source of that truth rather than two
that can disagree.

**The altar column owns its own scrolling**, since `.main--fit` gives this page none. Its heading is plain and
`static`, matching "SHOP" exactly. It was briefly `position: sticky` with a dark gradient behind it, so it
would survive the column scrolling during a reveal — and that gradient was a dark band under one heading and
not the other, which read as a mistake. The reveal is short enough now (see below) that neither is needed.
**If the altar ever scrolls badly again, shorten it rather than reinstating the sticky.**

### Both halves are titled, each centred on its own column

`.shop` and `.unpack-page` each carry `align-items: center`, so "SHOP" and "SUMMON" centre on their own
content. Centring them on the *page* would put "SUMMON" over the border between the halves. Measured: Shop
0px off its column centre, Summon 11px — the offset is the altar's left border and padding, and it is
correct, because the label is centred over its contents rather than its column box.

### `.stack-line` — one overlapping horizontal row, sized to fit whatever it holds

**Five consumers**: the held packs, the pack-reveal card queue, and all four production collection queues.
Each of them was previously either a wrapping grid or an arc, and each grew until its container had to scroll.

```css
margin-left: min(
  calc(var(--stack-overlap) * -1),                                     /* baseline bite */
  calc((100% - var(--stack-w)) / var(--stack-gaps) - var(--stack-w))    /* exact fit */
);
```

The second term is the step that makes N items span the row exactly; `min()` picks the more negative, i.e.
the *larger* overlap, so the baseline holds for a short row and the computed value takes over once it is
needed. **Percentage margins resolve against the container's inline size**, which is what lets this work with
no measurement, no `ResizeObserver` and no geometry — the arc it replaced needed all three.

`--stack-gaps` is the only thing React supplies, because CSS cannot know the count. Always pass
`max(1, length - 1)`; `length - 1` divides by zero at a single item.

**The rules target `> *`, not a `stack-line__item` class.** The class is opt-in on the *container*, so every
direct child is a stack item by definition — and that is what lets four different components (queue tiles,
card faces, pack items, the pack-count tile) render into these rows without each needing to cooperate.

#### Four things that break this, all of which look fine until measured

1. **Any leftover flex `gap` is added on top of the solved step.** `.foundry-queue-slots` carried
   `gap: 0.65rem` from its grid days: 10 gaps × 10.4px = *exactly* the 104px by which the queue overflowed.
   `.stack-line` resets it, but see the next point.
2. **`.stack-line` is specificity 0,1,0 and loses to anything equal defined later in the file.**
   `.foundry-queue-slots` sets `display: grid` **and** that gap, and is defined ~5000 lines further down — so
   the stack silently never engaged. The override is the compound `.foundry-queue-slots.stack-line`, which
   wins on specificity regardless of order. Third time this exact trap has appeared (the shop's category
   media query, the summon field's container query).
3. **A hovered item must become fully CLICKABLE, not just fully painted.** The item after a hovered one steps
   aside to `margin-left: 0`. At a partial step the hovered item's own centre stayed under its neighbour, so
   it was painted on top (`z-index: 100 !important`, needed to beat the inline ascending `zIndex`) while a
   pointer at its middle still hit the neighbour. Note when testing: **Playwright clicks an element's
   centre**, so an item in a stack must be clicked at its visible strip (`position: {x: 18, y: 60}`) or
   hovered first — and the pointer must be *parked away* before measuring positions, or the hover lift shows
   up as a second distinct `top`.
4. **Reserved padding for the hover lift is real height.** A box that scrolls on one axis forces the cross
   axis to non-visible, so the lift has to be absorbed by the element's own padding — 22px of it. The
   collection queues instead take `overflow: visible`, trading a scrollbar that measurement says never
   appears for 22px of permanent height in a half that has none to spare. The reveal queue keeps its padding,
   because the altar column around it does scroll.

Per-consumer sizing: packs 110px wide / 58px bite; reveal cards 110px / 78px (twice the pack cap in a
narrower column, so a tighter grouping); **collection-queue tiles 72px / 38px**.

The queue tiles are 72px because that is exactly `.inventory-tile`'s size. A queued loot tile and the same
resource sitting in the Bag are the same object and should read at the same scale; they were 112px here
against 72px there, which made the queue look like a heavier, separate thing from the inventory it feeds.
Matching also takes 40px off the row, which is 40px back in a half that scrolls — 112px -> 72px, and the whole
queue is now one tile tall where a 5-column grid needed 308px for the same haul.

The cap on held packs came down to 10 with this — see **Held-pack cap**.

**Both things that fly at "where packs go" were re-aimed, and they go to different places:**

| Flight | Target | Why |
|---|---|---|
| shelf purchase | the altar's pack fan (`summonAltarRef`) | it is on screen at the moment of purchase |
| treasure pack claimed in Wilderness | the **Cards tab** (`shopBtnRef`) | the altar is only mounted on the shop page, so on the Wilderness that ref is null — and `animateGroup` bails on a null target, which would have silently dropped the animation rather than failing loudly |

**`--shelf-pack-w` is gone.** It was `clamp(100px, calc(20vw - 161px), 210px)`, a viewport formula already
recalibrated by hand twice — once when the section rail moved left, and it would have needed it again here.
Pack width is now `flex: 1 1 0` sharing of the shelf row, capped at 210px, which cannot leave the packs and
their gaps summing past the row and needs no recalibration when the columns move.

Four sizing traps this uncovered, all found by looking at the render rather than the CSS:

1. **`.shop-shelf` was `width: fit-content`**, so a percentage pack width had no definite width to resolve
   against. Every pack pinned at its clamp floor, the row total then exceeded 100%, and `flex-wrap` silently
   broke five packs onto four rows — making the section 1196px tall inside a 424px box, which `.main--fit`
   then **clipped** rather than scrolled. Now `width: 100%`, and `.shop-shelf__packs` is `nowrap` so a wrap
   can no longer hide a sizing bug.
2. **`.shelf-pack__grab` and `.shop-pack-preview` had no definite width** — a bare block and an inline box.
   Once the pack asked them for `100%` the resolution was circular and both collapsed to **zero**, rendering
   five invisible packs with only their price tags showing.
3. **The summoning field's three columns stack below 620px.** At the rail's 345px they were ~110px each and
   the ATTUNEMENT and EFFECT panels were clipped. This is a **container query**, not a media query: the rail
   is a clamp, so its width and the window's are not proportional. It also **must sit below**
   `.summon-field` — a container query adds no specificity, so placed above it `flex-direction: row` simply
   won and the block did nothing. Same trap as the shop's category media query.
4. **The fan's arc radius is solved from its container**, not a flat 600px, which put the outer pack 300px
   off centre and straight out of the column: `(width − PACK_W) / (2·sin(spread/2))`, capped at 600 so a
   wide window is unchanged. Fed by a `ResizeObserver` with an equality guard.

At 1024px the packs reach 62px, smaller than the old 100px floor — that width previously put the last pack
under the Bag drawer instead, so it is a trade rather than a regression.

### The roster: 5 permanent, 9 on rotation

`PERMANENT_PACK_IDS` in cards.js is the always-stocked ladder — dusk 3, iron 5, arcane 10, void 18,
primordial 30 — plus Blank Slate on its own shelf. `ROTATION_PACK_IDS` (the 3 Vault and 6 Tag Edition
packs) is stocked a few at a time.

**The Horizon Set was deleted outright** (dawn, steel, mystic, abyss, eternal): five 10-card
near-duplicates of the Core ladder at overlapping prices. The shop had 21 purchasable packs across five
shelves, most of them permanently ignored.

`RETIRED_PACK_REPLACEMENTS` remaps a HELD pack of a deleted type on load, and it is **not version-gated** —
the retirement happened without a save bump, so a player can be holding one at any version.
`PACK_TYPES[id] ?? PACK_TYPES.iron` already stopped such a save crashing, but silently: a 10-card Mystic
(18g) would have opened as a 5-card Iron (5g).

Note when deleting a pack: **`steel` is also an ingot id** in foundry.js, with 9 references. A blind
string removal would have taken those with it.

### Rotation deals persist nothing

`src/game/shop.js`. The window index is `floor(now / ROTATION_PERIOD_MS)` (4 hours), so the offers are a
**pure function of the clock** — reloading cannot reroll them, there is no expiry to keep in the save, and
no migration was needed. A stored seed would have required both and could drift out of step with the clock
it described.

Packs are picked by walking the pool with a hash-derived **stride coprime with the pool size**, so a pack
cannot appear twice in one window without a duplicate check. Discounts are 0–25% in 5% steps.

**The price is computed where the gold is taken.** `handleBuyPack` recomputes the discount from the same
pure function the shelf uses, rather than accepting a price from the UI — otherwise the tag shows one
number and the balance moves by another, and the client gets to name its own price. Verified: tag 29,
charged 29.00.

### The gold sink

Only three sinks were reachable before this: buying packs, and unlocking a hand or mine slot. Everything
else (Lab grading/fusing/imprinting, Market slots, Expedition slots) sits behind `COMING_SOON_VIEWS`, so a
producing player just accumulated.

`SHOP_MATERIALS` is the repeatable half — coal above all, since the forge burns it continuously and a
player who runs dry has no option but to go back to the mine. Prices sit well **above** what the same
material sells for, so buying is convenience and not arbitrage.

**Goods render as the resource cards themselves**, reusing the `foundry-square-resource` tile the Bag and
the production queues draw — so what you are buying looks like what lands in your Bag. It was a list of text
rows with a price button, which read as a spreadsheet. The count badge is the quantity **sold** (`×10`), not
a quantity owned, hence the leading multiplier.

Artwork comes from **`src/game/resourceArt.js`**, extracted from `Inventory.jsx` so both draw from one
lookup. Two things there are load-bearing:

- **Ore and ingot art must stay in separate maps.** `silver`, `gold` and `platinum` exist as both, with the
  same filename, so a single merged map silently resolves one to the other's art.
- **`getShopMaterialArt` dispatches on `material.inventory`**, never on the id — the same rule
  `handleBuyMaterial` follows when routing the purchase, and required for the same reason: `silver` alone
  cannot tell you which one is meant.

That module calls `import.meta.glob`, so it is Vite-only. Do not import it from anything that has to run
under plain Node — the same constraint `audioLibrary.js` carries, for the same reason.

**`.goods-grid` needs an explicit `width: 100%`.** `.shop-section` is `display: flex; align-items: center`,
which shrink-wraps its children, so `auto-fill` resolved against the grid's own min-content and produced a
**single 115px column** running off the bottom of the page. The text list this replaced escaped that only by
accident — its rows were wide enough that content-sizing looked like full width. `.goods-shelf` (the Upgrades
list) carries the same fix for the same reason.

`findUnsellableMaterials()` exists because a mistyped id fails in the worst way: the player pays and the
goods land under a key nothing reads. It caught exactly that — the mote ids were written `smolderingMote`
when the real format is `smoldering_mote`, so those are now built with `getElementResourceId` rather than
typed. It runs at startup beside `findSilentDefinitions`, and `handleBuyMaterial` refuses the sale outright
if a material has no inventory route, so an unroutable good cannot cost the player anything.

**`handleBuyMaterial` takes an id, never a price or a quantity**, both of which come from `SHOP_MATERIALS` —
the same reason `handleBuyPack` recomputes its own discount. A handler that accepts an amount from the UI is
a handler that can be told to charge nothing.

**Routing is by `inventory`, not inferred from the id.** Ores and ingots have exactly one canonical home
each (see `GATHERED_CANONICAL_TARGET` in wilderness.js), and the shop has to respect it or bought coal shows
up under Gathered — which is precisely the bug save 22 existed to fix. Verified: coal lands in Ores, +10,
and the Gathered count does not move.

### The Upgrades shelf is the one-off half

Hand and Mine slot unlocks are also sold here. They already existed as a button in the Hand's rail and
another inside the Mine — findable while standing on those pages, invisible to a player with gold looking
for something to spend it on. **The originals stay**; buying a hand slot while looking at your hand is the
right thing to be able to do.

- **`onBuyUpgrade` takes an id**, and both targets are the *pre-existing* `handleUnlockPocketSlot` /
  `handleUnlockMineSlot`, which already check affordability and the cap and move gold through
  `applyGoldDelta`. A second route to a purchase adds no second place it can be paid for and no second copy
  of the price. Same discipline as `handleBuyMaterial`.
- **Rows show `current → next`, not a bare cost.** "45 gold" says nothing about what you get.
- **Maxed rows stay visible**, greyed, reading `Maxed`. A shelf that silently loses rows as you buy them
  reads as things going missing. The rail's count excludes them, so the number matches what is purchasable.
- **Hand Slot is the only entry.** Gathering slots are a fixed `GATHERING_SLOT_COUNT` of 4 with no cost
  table, and Expedition's and Market's slots sit behind `COMING_SOON_VIEWS`.

**Mine Slot was listed and has been pulled.** `DEFAULT_MINE_SLOT_CAPACITY` and `MAX_MINE_SLOT_CAPACITY` are
**both 4**, so a new game starts at the cap and the `MINE_SLOT_COSTS` ladder (45/110/240/420) is unreachable —
the row read `Maxed` for every player. Removed at the author's request pending a rework of how mine slots
work. `handleUnlockMineSlot` and the Mine's own button are untouched, so re-listing it is one entry in
`shopUpgrades`.

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

`MAX_HELD_PACKS` (**10**, was 20) in `App.jsx` blocks **purchases** once that many packs are unopened.
The Shop reflects it rather than swallowing the click: every buy button goes `disabled`, the
price tags dim, and the subtitle changes to say why.

The cap is deliberately **not** applied to treasure packs earned from Treasure Sense — those
are still granted past 10, because silently destroying loot a player worked for is a worse
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

### The altar's group tabs

`PACK_GROUPS` in cards.js; tabs rendered by `UnpackPage`. **Packs** is the default; **Treasure** is separate
because a cache is not a card pack — it opens into gold, has its own artwork and its own opening animation, so
putting it in the same row as boosters mixed two different things.

A pack type opts into a group with `group: '<id>'`; anything without one is `packs`, which is why no existing
type needed changing. Adding a group is one entry in `PACK_GROUPS` plus a `group` on the types that belong to
it — the extension point for more treasure tiers or other openable loot.

- **`getPackGroup` falls back to the default for an unknown id.** A save can hold a retired pack type (see
  `RETIRED_PACK_REPLACEMENTS`), and a pack belonging to no group would be held, invisible in every tab, and
  unopenable. The suite asserts the tab counts sum to the number of packs held.
- **Empty groups keep their tab**, dimmed. A tab that vanished with its last cache would take the only mention
  of Treasure with it, so a player would never learn the category exists. The empty line says where the
  contents *come from*, which is the only useful thing to tell someone looking at an empty tab.
- **`getNextPack`, the `u` hotkey, "N remaining" and `handlePackDone` are all scoped to the visible tab.**
  Against every held pack, finishing your last cache would offer "Open Next" and then open a card pack from
  the other tab — something you cannot see and did not choose.

**Held caches draw as LOOT tiles, not packs.** `PACK_GROUPS[].tile` is `'pack'` or `'loot'`, and
`HeldOpenable` in UnpackPage branches on it once for both the altar row and the staged view. A cache is the
same object the Wilderness queue showed pending, so it uses the same square `foundry-square-resource` tile and
the same chest art; as a booster wrapper it looked like something that opens into cards.

Its size rule must be a **compound** selector (`.card-face-wrapper.held-loot--sm`):
`.card-face-wrapper.foundry-square-resource` is 0,2,0 and sets `width: 100%`, which a single class cannot beat
— and 100% of a content-sized parent is circular, so the tile collapsed to 12px. Third instance of that shape,
after the shelf packs and the goods grid.

### A treasure cache breaking open

`TreasureCache` in PackOpening.jsx, `.treasure-cache` in App.css. Treasure has no foil to tear, and running it
through `SplitPack` opened a chest of gold with a paper-tearing animation. Three beats over
**`TREASURE_BURST_MS` (1200ms)**:

| Window | What |
|---|---|
| 0–520ms | CHARGE: the card grows and floods to pure white |
| 250–800ms | rays grow out from behind it, rotating |
| 520–1320ms | the card is **replaced by 27 random triangular fragments** that fly apart |

**A cache reveals its whole contents at once** — no card-by-card tap. The chest has already burst, so tapping
five gold cards afterwards is ceremony for a reward already shown arriving. `revealAll` is extracted from
`handleQuickDraw` and shared: the burst calls it silently, Quick Draw calls it with a sound. Quick Draw is
hidden for treasure, where the only thing it could do during INTRO is skip the burst.

- **An `<img>` cannot break apart**, which is why the card is *substituted* at the top of the white-out. The two
  stages are real React state, not just CSS timing, because that swap has to land on the frame where there is
  nothing recognisable on screen to give it away.
- **The crack pattern is RADIAL, not a grid**, because that is how things break: cracks run outward from an
  impact point and are crossed by a concentric fracture. One off-centre impact, nine random spoke angles, one
  jittered ring. Inside the ring each wedge is a triangle from the impact point; outside it each wedge is a
  quad split in two — so every fragment is a triangle. Adjacent pieces share spoke endpoints *by
  construction*, which is what tiles them with no seams. The wrapping wedge must take the long way round or
  the last piece is drawn inside-out and leaves a gap.
- **Regenerated per opening**, so no two caches break alike, with per-piece travel, spin, delay and duration
  randomised — that is what makes them fade at different moments rather than in lockstep. Pieces fly along the
  line from the impact point to their own centroid, inner ones first, so the break propagates outward.
- **The fragments are WHITE and carry no artwork.** The charge ends with the card flooded to pure white, so the
  thing on screen at that instant *is* a white rounded square and that is what must break; fragments showing
  the chest again would announce the substitution. The intact card is unmounted, so no frame has both.
- **Two elements per fragment, and it must be two.** A fragment is `triangle ∩ rounded-square`, which one
  element cannot express: the outer carries the triangle and the motion, the inner the corner radius
  (`--loot-card-radius`, shared with the card so they cannot drift). Clipping is in the outer's own
  coordinates and the transform applies after, so a piece keeps its shape rigidly as it flies. Without it a
  shattering card briefly grows square corners it never had.
- **Each triangle carries a warm drop-shadow**, which is what separates one white fragment from the next. A
  mass of white triangles with no edges reads as a single blob.
- **`LootTile` is shared** by the held row, the flight, the staged view and the cache itself. It was rebuilt ad
  hoc in some of those and a bare `<img>` in others, so a cache turned back into a pack mid-flight and lost its
  gold border once opening began. The white-out sits *inside* the frame so the border whitens with the art.
- **The phase timeout reads the same constant the CSS is written against.** `handleSplit` waits
  `TREASURE_BURST_MS` before `REVEALING`; if the two drift the loot appears over a chest that is still
  bursting. The suite asserts the reveal is absent at 700ms and present after.
- **`isTreasure` comes from the pack's GROUP, not from `isResourceReveal`.** They coincide today, but the
  group is the declared fact and the reveal shape is a consequence — so a future card pack that happened to
  yield resources would not get the chest.
- **Rays are one `conic-gradient` behind the chest**, masked radially so the beams fade at the tips instead of
  ending on a hard circle. No SVG and no per-ray element.
- **The shard field is built once per mount from a seeded generator.** Inline it would reshuffle on any
  re-render — and this component re-renders on the very phase change that starts the animation, so the shards
  would jump at the moment they became visible. Same reason `GoldBurst` seeds its motes.
- **Exempted from the low/medium `animation: none` blanket**, like `.gold-burst`: one 1200ms sequence fired
  when the player opens something they earned, and without it the chest would simply vanish. Asserted at low.

### Treasure Pack

- generated by `Treasure Sense`
- first appears in Wilderness queue
- when claimed, it flies to the **Cards tab** — not to the altar, which is not mounted while you are
  standing in the Wilderness. See the flight table under **The Cards page**
- opening uses the normal reveal flow
- instead of cards, it reveals 5 square gold-resource cards
- no mote drop phase

---
