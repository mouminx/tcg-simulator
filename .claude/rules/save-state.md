---
paths:
  - "src/App.jsx"
  - "src/game/storage.js"
---

<!-- Path-scoped rule: loads when the save's shape or location is in play. -->

# Save State

The persisted shape, and what each version migration did. The root `CLAUDE.md` carries the *contract* (App.jsx
owns the shape, storage.js owns the location, adapters move raw strings); this is the shape itself and the
history, which is not derivable from the code once a migration has run.

## Save State

- `localStorage` key: `tcg-sim` on the web; a `save.json` file in the desktop shell — see
  **Where the save lives** below. `App.jsx` owns the save's *shape*, `src/game/storage.js` owns its
  *location*, and neither knows about the other
- current save version: `25`

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
  mineLootStages,
  forgeCardSlots,
  forgeOreSlots,
  forgeIngredientSlots,
  forgeFuelSlots,
  forgeOutputQueues,
  forgeRewardQueue,
  gatheredInventory,
  processedInventory,
  gatheringSlots,
  gatheringClaimQueue,
  gatheringRewardQueue,
  gatheringLootStages,
  processingSlots,
  processingOutputQueues,
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
- **25** added `mineLootStages` and `gatheringLootStages`. Each entry owns one completed card cycle's
  `loot`, bonus `rewards`, source `slotId`, and `releaseAt`. Rewards remain here briefly while the worker
  slot displays them, then GameApp promotes them into the existing claim/reward queues. The arrays are
  persisted so reloading during that hand-off cannot lose a roll; older saves default to empty arrays
- **24** replaced the resource-wide `ingotClaimQueue` / `processedClaimQueue` maps with
  per-slot `forgeOutputQueues` / `processingOutputQueues`. The old maps made every row producing the
  same resource mirror one count, and a row-level Collect cleared every row. Missing per-slot maps are
  normalized from the legacy aggregate without losing pending output; a currently matching recipe is
  used to attribute each old stack where possible
- **23** re-keyed every card onto a UUID — see Card Identity. Nothing was added to the save shape;
  `id` changed type from number to string. `migrateCardIdsToUuid` in `App.jsx` is the migration, and
  it sits **above** the `< 18` branch in `loadState` because that branch *returns*, so anything below
  it never runs for the oldest saves — which are exactly the ones carrying counter ids
- **22** folded gathered ores and ingots into `oreInventory` / `ingotInventory` (and the pending
  claim queues) — see Inventory. Nothing was added to the save shape; entries moved between existing
  maps
- `lootSeen` (added in 21) records whether each loot-bearing view has been looked at since
  its last delivery. Absent on older saves means "seen", so existing loot shows a calm
  diamond instead of glowing on first load
- old Expedition saves are migrated so support slots collapse back to the new defaults (`1` supply, `1` arcana)
- legacy creature-card saves are migrated into the newer class/unit card model

---
