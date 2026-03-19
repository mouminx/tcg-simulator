# Cards of Arcana — Claude Code Context

React + Vite collectible card game simulator. No backend; persistent state lives in `localStorage`, with gameplay/state orchestration centralized in `src/App.jsx`.

---

## Stack

- React 18 + Vite 5
- CSS-only styling in `src/App.css`
- No external state library
- `sharp` is used only by `scripts/extract-card-colors.mjs`

---

## Project Structure

```text
src/
  App.jsx
  App.css
  game/
    cards.js
    arcana.js
    arcanaCrafting.js
    arcanaAttunement.js
    arcanaPackOpening.js
    foundry.js
    wilderness.js
    cardArt.js
    cardColors.js
  components/
    CardFace.jsx
    HoverCardPreview.jsx
    CardPocket.jsx
    ResourcePocket.jsx
    ResourceQuantityPopover.jsx
    Shop.jsx
    UnpackPage.jsx
    AttunementStage.jsx
    PackOpening.jsx
    Collection.jsx
    Arcana.jsx
    EssenceCard.jsx
    ResourceCard.jsx
    Foundry.jsx
    Wilderness.jsx
    Lab.jsx
    Market.jsx
```

---

## Key Commands

```bash
npm run dev
npm run build
npm run extract-colors
```

Class card art lives in `src/assets/class-cards/{classType}.png` and is loaded automatically.

---

## Navigation

Current view order:

```text
Cards → Summon → Collection → Arcana → Foundry → Wilderness → Lab → Market
```

Notes:

- `Cards` is the nav label for `VIEWS.SHOP`
- `Summon` is the pack opening tab (`VIEWS.UNPACK`)
- `Foundry` and `Wilderness` are both production gameplay pages, not placeholders
- Active navbar tabs emit glowing rune/glyph particles

---

## Save State

**localStorage key:** `tcg-sim`
**Current save version:** `10`

Current persisted shape:

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
  forgeCardSlots,
  forgeOreSlots,
  forgeFuelSlots,
  ingotClaimQueue,
  gatheredInventory,
  processedInventory,
  gatheringSlots,
  gatheringClaimQueue,
  pocket,
  resourcePocket,
  pocketCapacity,
  packsOpened,
  version,
  pocketSystemVersion,
}
```

Important details:

- `pocket` stores full card objects, not IDs
- `resourcePocket` is a separate left-side pocket for resource stacks
- `resources` is keyed by element resource IDs covering all 9 elements × 4 tiers (36 keys total)
- `forgeFuelSlots` is per-row forge fuel state; older shared `forgeFuel` saves are migrated into slot 1
- `collection` remains the source of truth for cards; slotted/pocketed cards are still actual card objects mirrored from it
- Save version 9 → 10 migration (`migrateCards`) assigns a random class and re-rolls affixes for legacy creature cards

---

## Card System

Core game rules live in `src/game/cards.js`.

Cards represent **human unit classes**, not creatures.

### Unit Classes

| Class       | Efficiency Affix         | Attunement Affix         | Luck Affix         |
|-------------|--------------------------|--------------------------|---------------------|
| Miner       | Mining Efficiency        | Mining Attunement        | Mining Luck         |
| Blacksmith  | Smelting Efficiency      | Smelting Attunement      | Smelting Luck       |
| Lumberjack  | Logging Efficiency       | Logging Attunement       | Logging Luck        |
| Hunter      | Hunting Efficiency       | Hunting Attunement       | Hunting Luck        |
| Merchant    | Trade Efficiency         | Trade Attunement         | Trade Luck          |
| Warrior     | Combat Efficiency        | Combat Attunement        | Combat Luck         |
| Mage        | Arcane Efficiency        | Arcane Attunement        | Arcane Luck         |
| Bard        | Inspiration Efficiency   | Inspiration Attunement   | Inspiration Luck    |

Class is stored as `card.classType` (lowercase id). `card.name` is the display name (e.g. `'Miner'`).

Art lives in `src/assets/class-cards/{classType}.png`, loaded via `CLASS_ART` in `cardArt.js`.

### Rarities

| Rarity    | Weight | Value Range      | Accent |
|-----------|--------|------------------|--------|
| common    | 55     | $0.10 – $1.00    | white  |
| uncommon  | 25     | $1.00 – $4.00    | green  |
| rare      | 12     | $4.00 – $18.00   | blue   |
| epic      | 5      | $18.00 – $65.00  | purple |
| legendary | 1      | $65.00 – $200.00 | gold   |
| mythic    | 0.5    | $200.00 – $500.00| red    |

### Tier

- Tier drives affix count (tier 1 = 1 affix … tier 5 = 5 affixes)
- Rarity drives affix value range

### Tags

Base tag chance is 14%.

`holo`, `foil`, `reverse`, `shadow`, `nexus`, `prismatic`, `firstEdition`

### Affixes

Each card draws affixes without replacement from a combined pool:
- **3 class-specific affixes** (always available): Efficiency / Attunement / Luck
- **7 general affixes** (filtered by `minTier`):
  - Coin Generation (tier 1+)
  - Essence Attunement (tier 1+)
  - Resource Generation (tier 1+)
  - Production Speed (tier 1+)
  - Craftsmanship (tier 2+)
  - Overflow (tier 2+)
  - Prosperity (tier 3+)

Affix semantics:
- **Efficiency** → speed of resource generation (e.g. `miningSpeed`, `gatheringSpeed`, `smeltingSpeed`)
- **Attunement** → output quantity bonus
- **Luck** → chance for bonus / rare items
- **Craftsmanship** → chance to produce a higher-level material
- **Overflow** → chance to double production output
- **Prosperity** → stacking gold + resource generation bonus

Rules:
- no duplicate affixes on the same card
- higher affixes roll as `★`, are bold/gold, 50% chance
- regular affixes render with `◆`

Affixes are passive until the card is placed into an active system (mine, forge, gathering, etc.).

---

## Card Presentation

`src/components/CardFace.jsx` is the single card renderer.

Current visual layout:

- top: card name
- art frame with tier gem/rarity tab treatment attached to the frame
- metadata tag rail for special tags only (`holo`, `foil`, etc.)
- affix text in the body area

Current notable visual systems:

- custom rarity gem SVGs loaded from `src/assets/rarity-gems`
- custom tier star SVGs loaded from `src/assets/tier stars`
- full viewer cards use rich gradients/VFX
- compact cards use cheaper rendering for Collection/Pocket/slot UIs
- collection hover uses magnify, not turn
- pocketed/slotted/unavailable collection cards are greyed out and non-hoverable

---

## Page Header Convention

All production pages (Foundry, Wilderness, Arcana) share the same header markup pattern:

```jsx
<div className="foundry-header [page]-header">
  <h2 className="foundry-title">[Page Name]</h2>
  <p className="foundry-subtitle">[Description]</p>
</div>
```

- `foundry-header` → `text-align: center`
- `foundry-title` → serif gradient heading
- `foundry-subtitle` → muted serif subheading
- Page-specific wrapper class (e.g. `arcana-page-header`, `wilderness-header`) adds only positional overrides (e.g. `position: relative` for absolutely-positioned action buttons)

---

## Pack Types

Pack definitions live in `PACK_TYPES` in `cards.js`.

Notable pack:

### Blank Slate

- Arcana-ready pack
- can open normally or with Calling/Surge/Inscription attunement
- drops normal cards plus element mote rewards

Blank Slate element rewards:

- rolls 2–3 distinct element types
- each rolled element gives 1–3 motes (lowest tier)
- rewards are persisted into `resources` keyed by `{elementId}_mote`
- reward cards appear after the main card reveal, then fly to the Arcana tab on collect

---

## Arcana System

Arcana is fully data-driven.

Modules:

- `src/game/arcana.js` — element/essence definitions, ELEMENT_TIERS, ID helpers, RING_RECIPES, ARCANA_ITEMS_BY_ID
- `src/game/arcanaCrafting.js` — legacy crafting helpers (not used by ring craft)
- `src/game/arcanaAttunement.js` — pure slot/loadout logic for pack opening attunement
- `src/game/arcanaPackOpening.js` — Blank Slate orchestration + element mote rewards

### Elements (9 total)

| Element    | Family  |
|------------|---------|
| Smoldering | Fire    |
| Jolting    | Storm   |
| Flowing    | Water   |
| Blooming   | Nature  |
| Gusting    | Wind    |
| Hollowing  | Void    |
| Gleaming   | Light   |
| Ascending  | Aether  |
| Grounding  | Earth   |

### Element Tiers

Each element exists in 4 tiers:

| Tier          | Resource ID format          |
|---------------|-----------------------------|
| Mote          | `{elementId}_mote`          |
| Wisp          | `{elementId}_wisp`          |
| Essence       | `{elementId}` (bare id)     |
| Quintessence  | `{elementId}_quintessence`  |

Helpers in `arcana.js`:
- `getElementResourceId(elementId, tier)` → resource ID string
- `parseElementResourceId(resourceId)` → `{ elementId, tier }`
- `ELEMENT_TIERS` → `['mote', 'wisp', 'essence', 'quintessence']`

`DEFAULT_RESOURCES` covers all 36 resource IDs (9 elements × 4 tiers), initialised to `0`.

### Arcana Families

- **Charms** → Calling slot → creature/type bias
- **Catalysts** → Surge slot → tier bias
- **Sigils** → Inscription slot → tag bias

### Ring Crafting System

The Arcana Station uses a Minecraft-style ring crafting UI defined in `Arcana.jsx`.

**Layout** — a 5×5 grid with named grid areas:

```
.    .       outer-n   .       .
.    card-NW inner-n   card-NE .
outer-W inner-W center inner-E outer-E
.    card-SW inner-s   card-SE .
.    .       outer-s   .       .
```

- **Outer ring** (4 slots): element resource slots at N, E, S, W
- **Inner ring** (4 slots): element resource slots at N, E, S, W
- **Corner slots** (4 slots): mage class card slots at NW, NE, SW, SE
- **Center cell**: idle hexagon glyph → matched item art + name when recipe is recognized

**Recipes** — defined in `RING_RECIPES` in `arcana.js` (19 total):
- Charms use N–S axis (outer-n/s + inner-n/s)
- Catalysts use E–W axis (outer-e/w + inner-e/w)
- Sigils use mixed patterns
- Pattern matching is **family-based, tier-agnostic**: a smoldering mote satisfies `smoldering` in a slot
- Match requires all pattern slots filled AND no extra slots filled

**Crafting cost**: placing elements in the ring is the cost — 1 of each placed element resource is consumed on craft.

**Mage requirement**: recipes with `mages: N` require N mage-class cards in the corner slots.

**State in `Arcana.jsx`**:
- `ringSlots` — `{ [slotKey]: elementId | null }` for element slots
- `cardSlots` — `{ [cornerKey]: cardObject | null }` for mage card slots
- `pickerSlot` — which element slot is currently open for picking

**Handler in `App.jsx`**: `handleRingCraft(itemId, placedResourceIds)` — consumes resources and appends to `arcanaInventory`.

### Arcana Inventory

Right side of the Arcana page shows crafted items using the same square inventory-card style as Foundry/Wilderness.

### EssenceCard Component

`src/components/EssenceCard.jsx` renders a square resource card for any element at any tier.

- Accepts `essence` (object from ESSENCES), `count`, `tier` (default `'essence'`), `className`
- Art is loaded via `import.meta.glob` from four folders:
  - `src/assets/elements/motes/`
  - `src/assets/elements/wisps/`
  - `src/assets/elements/essences/`
  - `src/assets/elements/quintessences/`
- Filename key is the element id (e.g. `blooming`). Note: `blooming quintessence.png` has a typo (`quitessence`) — handled via `/quin?tessence/` regex.

---

## Collection

`src/components/Collection.jsx`

Current behavior:

- left sidebar filters
- binder takes remaining content width
- filters include search, sort, rarity, tier, affix, and card type/tag
- rarity filters show gem SVGs
- large viewer modal uses a bigger card scale
- cards can be pocketed
- cards unavailable because they are in Pocket / Foundry / Wilderness are visibly locked out

---

## Card Pocket

`src/components/CardPocket.jsx`

Persistent card pocket. Positioned bottom-right by default; bottom-left when `positionLeft={true}`.

```jsx
<CardPocket positionLeft={view === VIEWS.ARCANA} ... />
```

- `card-pocket--left` CSS class is added when `positionLeft` is true
- On the Arcana view the pocket sits on the left so it doesn't overlap the ring workspace

Current rules:

- default capacity: 3
- expandable with gold up to 10
- stores full card objects
- cards overlap side-by-side and raise on hover
- remove `X` appears only on hover
- slotted cards disappear from Pocket and become unavailable in Collection

Purpose:

- transport cards into Mine, Forge, Wilderness gathering, and other slot-based systems

---

## Resource Pocket

`src/components/ResourcePocket.jsx`

Mirrored left-side pocket for resource stacks.

Current interaction:

- right-clicking an inventory resource opens a quantity slider starting at half the available stack
- confirm moves that amount into the resource pocket
- right-clicking a resource already in the pocket opens a carry slider
- confirming carry puts a floating resource stack on the cursor
- valid targets currently include resource inventories, forge fuel slots, and forge ore slots
- invalid placement returns the carried stack back to the pocket

This is the main path for loading forge fuel and forge ores.

Art maps use `import.meta.glob` with suffix stripping:
- Ore files named `{name} ore.png` → key `{name}` (strips `" ore"`)
- Ingot files named `{name}.png` → key `{name}`

---

## Foundry

Gameplay helpers: `src/game/foundry.js`
UI: `src/components/Foundry.jsx`

### The Mine

- cards from Pocket can be socketed into mine slots
- default mine slot count is 1, expandable up to 5
- mining starts automatically when a card is placed
- base rate is 1 ore per minute
- `Mining Speed` affix reduces cycle time
- completed ore goes into `mineClaimQueue`
- user presses `Collect` to move queued ore into `oreInventory`

Ore rolling uses:

- `ORE_WEIGHTS_BY_RARITY`
- `ORE_WEIGHT_TIER_ADJUSTMENTS`

### The Forge

Current forge is row-based.

Each row runs left-to-right as:

- slotted card
- individual fuel slot
- materials block:
  - two optional small ingredient slots
  - one smaller square ore slot beneath them
- smelting arrow
- square ingot output card

Rules:

- forge card slots: 3
- fuel is per-row, not shared
- fuel must be loaded manually from the resource pocket
- coal provides 9 smelts at 3 smelts/minute
- each row tracks its own fuel charges and timer ring
- fuel is removable
- ore is loaded from the resource pocket
- completed ingots go to `ingotClaimQueue`
- `Collect` moves queued ingots into `ingotInventory`

Current forge simplification:

- the two extra ingredient slots are UI-only placeholders; they do not have gameplay logic yet

### Foundry Inventories

Right sidebar:

- Ore Inventory
- Ingot Inventory

Both use square resource cards with full image fill.

---

## Wilderness

Gameplay helpers: `src/game/wilderness.js`
UI: `src/components/Wilderness.jsx`

Uses the same general split layout language as Foundry.

### Gathering

Cards from Pocket can be slotted to gather:

- wood
- fiber
- resin
- hyssop
- mushrooms
- hide
- coal

Rules:

- gathering starts automatically when card is placed
- uses a ring timer like Mine
- `Gathering Speed` affix reduces cycle time
- output goes to `gatheringClaimQueue`
- user presses `Collect` to move queued resources into `gatheredInventory`

### Processing

Layout exists on the right side for:

- timber
- cloth
- sealant
- alkahest
- mycelial extract
- leather

Processing is currently layout/UI only.

Wilderness inventories also support right-click → quantity slider → resource pocket flow.

---

## Pack Opening Presentation

`src/components/PackOpening.jsx`

Sequence:

- cards reveal sequentially
- Blank Slate element mote rewards appear after all trading cards have been shown
- element cards animate into a stack
- reward text snaps in one by one (`+N [Family] Mote`)
- on collect:
  - cards fly to Collection
  - element motes fly to Arcana

Uses `parseElementResourceId` to resolve `{elementId}_mote` IDs into `{ elementId, tier }` for display.

---

## Art System

### Unit Class Art

Drop PNG named `{classType}.png` into `src/assets/class-cards/` (e.g. `miner.png`).
Art is loaded automatically via `CLASS_ART` in `src/game/cardArt.js` — no script needed.
All 8 class PNGs are already present.

### Resource Art

Foundry ores/ingots and Wilderness resources use square resource-card shells with full-bleed masked artwork.

Relevant asset folders:

- `src/assets/ores/` — ore PNGs named `{name} ore.png`
- `src/assets/ingots/` — ingot PNGs named `{name}.png`
- `src/assets/resources/` — wilderness resource PNGs

Art is loaded via `import.meta.glob` in the respective component files; keys strip the `" ore"` suffix for ores so IDs like `"iron"` resolve correctly.

### Element Art

Element resource cards use art from:

- `src/assets/elements/motes/`
- `src/assets/elements/wisps/`
- `src/assets/elements/essences/`
- `src/assets/elements/quintessences/`

### Rarity / Tier Assets

- rarity gems: `src/assets/rarity-gems/`
- tier stars: `src/assets/tier stars/`

---

## Drag / Drop / Interaction Notes

- card drag sources use `text/plain` / `card-id`
- resource carry uses `data-resource-drop-target`
- forge fuel target is `forge-fuel-slot`
- forge ore target is `forge-ore-slot`
- arcana ring card slots accept card drops directly from the pocket (mage cards only)

Large hover previews are used instead of tiny text tooltips for:

- collection cards
- pocket cards
- foundry/wilderness slotted cards

---

## Performance Notes

- compact card rendering is used in collection/pocket/slot-heavy views
- mobile collection performance was improved by suppressing expensive gradients/VFX in compact mode
- full effects return in expanded/viewer contexts
- arcana ring slots use `cqi` (container query inline) units so the entire ring scales proportionally with viewport

---

## Known Patterns / Gotchas

- Read the current file before editing; this project changes fast.
- `App.jsx` is the orchestration layer; pure business logic should stay in `src/game/*`.
- If a card is consumed or removed from `collection`, also clear it from dependent systems:
  - pocket
  - mine
  - forge
  - wilderness gathering
- `SAVE_VERSION` (currently `10`) and save migration in `App.jsx` must be reviewed when persisted schema changes.
- Cards always have both `card.classType` (id) and `card.name` (display). Art lookup uses `CLASS_ART[card.classType]`.
- Element resource IDs: bare `elementId` = essence tier; `{elementId}_mote/wisp/quintessence` for other tiers. Always use `getElementResourceId` / `parseElementResourceId` from `arcana.js` — never construct IDs manually.
- `blooming quintessence.png` has a typo in the filename (`quitessence`). EssenceCard handles this via regex. Do not rename the file without updating the regex.
- The Arcana ring crafting does NOT use `arcanaCrafting.js`'s `craftArcanaItem`. That module is retained for attunement logic only.
