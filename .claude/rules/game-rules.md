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
