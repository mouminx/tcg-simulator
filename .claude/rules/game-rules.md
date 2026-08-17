---
paths:
  - "src/game/cards.js"
  - "src/game/arcana.js"
  - "src/game/expedition.js"
  - "src/game/arcanaAttunement.js"
  - "src/game/arcanaCrafting.js"
  - "src/game/arcanaPackOpening.js"
  - "src/components/Arcana.jsx"
  - "src/components/Expedition.jsx"
---

<!-- Path-scoped rule: loads only when Claude touches the files above. Split out of a single
     3,335-line CLAUDE.md, which was ~45k tokens in every session before any work began. -->

# Game Rules

Rules and data: card identity beyond the seam, affixes, elements, Arcana, Expedition resolution.

> Cross-cutting invariants (scroll ownership, the CSS ordering trap, the save shape, the gold
> seam, card identity, performance) live in the root `CLAUDE.md`, which is always loaded.

## Card System

Core rules live in `src/game/cards.js`.

Cards are now **human unit classes**, not monsters/creatures.

### Card identity

**`mintCard()` is the only place a card comes into existence**, and `newId()` is the only place an id
does. `openPack`, `openWelcomePack` and `makeCard` all route through them. That boundary exists so the
server phase has one function to replace — when the backend mints cards the client stops choosing ids
and starts being handed them — and so anything that must be true of *every* card has a home.

Ids are **UUIDv4 strings**. They replaced `let nextId = Date.now()` incremented per card, which made
identity a function of *when a client started* rather than of the card:

- It re-seeds from the wall clock every page load. Mint more cards in a session than there are
  milliseconds since it began and the counter runs into the future, so the next load hands out ids
  that are already taken.
- **It is not unique across clients at all.** Two players opening a pack in the same millisecond get
  the same ids. Card ids key the collection, the Hand, every station slot and the drag payload, so a
  collision grafts one player's card onto another's slot — this is the one that makes a shared
  backend impossible.

Held **pack** ids are UUIDs too, for the same reason; they were `Date.now() + Math.random()`, a float.
Old float pack ids in existing saves stay valid and need no migration — they are compared with `===`
against a value that came from the same array.

Two things to know before touching this:

- **`newId()` keeps a `getRandomValues` fallback.** `crypto.randomUUID` is only defined in a **secure
  context**. Vercel is https and localhost counts, and the Electron shell registers `app://` as
  `secure` partly for this — verified taking the primary path there, not the fallback. The fallback
  stays because a throw here would break card creation outright.
- **The migration is a *consistent* rename, not just a re-key.** The Hand and all five station slot
  arrays hold *copies* matched back to the collection by id, and an `expeditionRun` in flight carries
  two more copies (`unitSlots` and `unitResults`). A migration that produced valid UUIDs but a
  different one per holder would pass any "are these UUIDs?" check and silently orphan every socketed
  card. `migrateCardIdsToUuid` walks the collection first to build the map, then rewrites every other
  holder through it; it is idempotent, because an id already matching `UUID_RE` is left alone.

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
- weaver
- woodworker
- tanner
- prospector

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

Most original classes have three core affixes:

- efficiency
- attunement
- luck

Some gathering classes also have:

- `Treasure Sense`

Processing specialists use focused pools: Weaver and Woodworker roll Efficiency, Bounty, Luck,
Production Speed, elemental attunements, and Coin Generation; Tanner rolls Tanning Speed plus its
Efficiency/Bounty/Luck set, elemental attunements, and Coin Generation. Prospector shares Miner's
Mining Efficiency/Attunement/Luck and adds Gem Find.

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

## Crafting System

The player-facing Arcana page has been replaced by a Minecraft-style Crafting workspace centered on:

- `src/game/crafting.js`
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

### Crafting Station

The Crafting page uses a workshop layout:

- five horizontally arranged artisan card slots
- a 3x3 material grid
- a reserved result slot

Current behavior:

- all material inventories can feed the grid through the Bag's click-to-carry or drag flow
- matching materials stack in a cell; different materials are rejected
- pressing and dragging a held stack across compatible cells distributes the entire stack evenly on release
- right-clicking a placed material opens the shared quantity popover and carries only the selected amount
- artisan slots use cards from the Hand and surface crafting/luck-related affixes
- socketed artisans use the shared `--station-card-w` / `--station-card-h` dimensions used by Mine,
  Forge, Gathering, and Processing
- desktop Crafting always reserves the Bag's full drawer width, open or closed, so toggling inventory
  never reflows the workbench
- artisan and material slots persist in save 31, alongside dedicated crafted-material and tool inventories
- recipes are exact 3x3 patterns unless declared shapeless; crafting consumes only each pattern's required amounts
- Mushrooms, Resin, and Hyssop are shapeless Crafting refinements that each produce two Mycelial Extract,
  Sealant, or Alkahest; one of each reagent in any three cells produces one Arcanic Infusion
- Empty Callings use the full 3x3 frame of four stone blocks, two textiles, two leathers, and one central Arcanic
  Infusion; the eight structural materials determine Tier I–V, while the Infusion stabilizes but adds no quality
- Advanced Alkahest combines Alkahest with two Wildflowers, Advanced Mycelial Extract combines Mycelial
  Extract with two Garlic, and Advanced Sealant combines Sealant with two Softwood Sap; one of each advanced
  reagent creates an Advanced Arcanic Infusion
- Empty Surges use four stone blocks, two textiles, two ingots, and one central Advanced Arcanic Infusion;
  their eight structural materials determine Tier I–V while the advanced infusion adds no quality
- eight Steel Ingots around a Polished Stone Block produce one Reinforced Stone Block; Stone Block,
  Polished Stone Block, and Reinforced Stone Block contribute quality I, III, and V respectively
- two Hide in any single cell makes Rough Leather; eight Tough Hide around Rough Leather makes Refined
  Leather; eight Refined Leather around Tough Scales makes Premium Leather
- legacy Cloth and Leather no longer exist as item identities; saved Cloth becomes Linen and saved Leather
  becomes Rough Leather
- current grid outputs include Stone Block, Polished Stone Block, Fiber, Linen, Sateen, Silk, Plank,
  Stick, Voidwood/Arcanewood Sticks, Voidwood/Arcanewood Planks, Pickaxe, Axe, Sickle, and Shortbow
- for every element, a full matching 3x3 upgrades 9 Motes → 1 Wisp, 9 Wisps → 1 Essence,
  and 9 Essences → 1 Quintessence; mixed elements never match
- Stick creates two per craft; all three stick recipes use a full vertical column of their plank
- tool recipe slots match material families, so ingots and valid stick types can be mixed within one pattern
- tool tier is the consumed component-quality score normalized across that recipe's attainable score range;
  Steel/basic Stick/Fiber/Rough Leather are quality 1, Silver 2, Gold 3, Platinum/Voidwood Stick 4, and
  Starsteel/Arcanewood Stick 5

### Gathering tools

- Pickaxe → Miner, Axe → Lumberjack, Sickle → Forager, Shortbow → Hunter
- tools are unique square cards with tiers I–V and exactly one affix per tier
- the ten-affix pool is Efficiency, Luck, Yield, Discovery, Elemental Resonance, Bounty, Momentum,
  Material Affinity, Artisan Synergy, and Refinement
- material quality biases affix values within the resulting tool tier; it does not bypass that tier's range
- Refinement and Material Affinity never bypass the worker card's rarity-gated material pool

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
