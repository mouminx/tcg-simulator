/**
 * The shop's rotation deals and its goods catalogue — the game's gold sink.
 *
 * Before this, gold had almost nowhere to go. Only three sinks were reachable: buying packs, and unlocking
 * a hand or mine slot. Everything else (the Lab's grading, fusing and imprinting, the Market's slots, the
 * Expedition's slots) sits behind `COMING_SOON_VIEWS`, so a player producing steadily just accumulated.
 *
 * Everything here is PURE — no browser globals, no React — for the same reason the other rule modules are:
 * it can be reasoned about, tested directly, and eventually run on a server without change.
 */

import { ROTATION_PACK_IDS } from './cards';
import { ORE_TYPES, INGOT_RESOURCES } from './foundry';
import { GATHERED_ONLY_RESOURCES, PROCESSED_RESOURCES } from './wilderness';
import { getElementResourceId } from './arcana';

// ── Rotation deals ───────────────────────────────────────────────────────────

/** How long a rotation window lasts. Four hours: long enough to feel scarce, short enough to come back to. */
export const ROTATION_PERIOD_MS = 4 * 60 * 60 * 1000;

/** How many rotation slots are stocked at once. */
export const ROTATION_SLOTS = 3;

/**
 * The window `now` falls in.
 *
 * **Nothing about the rotation is persisted, and that is deliberate.** The window index is
 * `floor(now / PERIOD)`, so the offers are a pure function of the clock — which means reloading cannot
 * reroll them, and there is no expiry to keep in the save and no migration to write. A stored seed would
 * have needed both, and could drift out of step with the clock it was supposed to describe.
 */
export function getRotationWindow(now) {
  const index = Math.floor(now / ROTATION_PERIOD_MS);
  const startsAt = index * ROTATION_PERIOD_MS;
  return { index, startsAt, endsAt: startsAt + ROTATION_PERIOD_MS, msRemaining: startsAt + ROTATION_PERIOD_MS - now };
}

/**
 * A small integer hash. Deterministic, and mixes adjacent seeds well — consecutive window indices must not
 * produce overlapping picks, or the "new" rotation would look like the old one with a nudge.
 */
function hash(n) {
  let x = (n | 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}

/**
 * The packs on offer this window, with their discount.
 *
 * Picked by walking the pool with a hash-derived stride rather than by shuffling: a stride that is coprime
 * with the pool size visits distinct entries, so the same pack cannot appear twice in one window without a
 * duplicate check. `ROTATION_PACK_IDS.length` is 9, so any stride not divisible by 3 works — hence the
 * `| 1` and the modulo below.
 */
export function getRotationOffers(now, pool = ROTATION_PACK_IDS, slots = ROTATION_SLOTS) {
  const { index, endsAt, msRemaining } = getRotationWindow(now);
  const size = pool.length;
  if (!size) return { offers: [], endsAt, msRemaining };

  const h = hash(index);
  const start = h % size;
  // Coprime with 9 as long as it is not a multiple of 3; `| 1` makes it odd, and stepping past a multiple
  // of 3 keeps it coprime for the sizes this pool takes.
  let stride = ((hash(index + 1) % (size - 1)) + 1) | 1;
  while (size % stride === 0) stride += 2;

  const offers = [];
  for (let i = 0; i < Math.min(slots, size); i++) {
    const packId = pool[(start + i * stride) % size];
    // A discount in fixed 5% steps from 0 to 25 — recognisable numbers rather than arbitrary fractions.
    const discountPct = (hash(index * 31 + i) % 6) * 5;
    offers.push({ packId, discountPct });
  }
  return { offers, endsAt, msRemaining };
}

/** The price of an offer after its discount, rounded to whole gold so the shelf tags stay readable. */
export function discountedCost(cost, discountPct) {
  if (!discountPct) return cost;
  return Math.max(1, Math.round(cost * (100 - discountPct) / 100));
}

// ── Goods: the gold sink ─────────────────────────────────────────────────────

/**
 * Materials for sale. The repeatable sink — coal above all, because the forge burns it continuously and a
 * player who has run dry currently has no option but to go back to the mine.
 *
 * Prices are set well ABOVE what the same material sells for, so buying is a convenience rather than an
 * arbitrage: the shop must not become a way to turn gold into more gold.
 *
 * `inventory` names which map the goods land in, matching the canonical homes in Inventory — see
 * `GATHERED_CANONICAL_TARGET` in wilderness.js for why ores and ingots have exactly one home each.
 */
export const SHOP_MATERIALS = [
  { id: 'coal',       inventory: 'ore',       label: 'Coal',            qty: 10, cost: 18 },
  { id: 'iron',       inventory: 'ore',       label: 'Iron Ore',        qty: 10, cost: 25 },
  { id: 'silver',     inventory: 'ore',       label: 'Silver Ore',      qty: 5,  cost: 45 },
  { id: 'steel',      inventory: 'ingot',     label: 'Steel Ingot',     qty: 5,  cost: 60 },
  { id: 'wood',       inventory: 'gathered',  label: 'Wood',            qty: 10, cost: 20 },
  { id: 'fiber',      inventory: 'gathered',  label: 'Fiber',           qty: 10, cost: 22 },
  { id: 'timber',     inventory: 'processed', label: 'Timber',          qty: 5,  cost: 40 },
  // Built with `getElementResourceId` rather than typed as strings: the real ids are `smoldering_mote`
  // style, and hand-writing them is exactly how a good lands in the shop that can never be delivered.
  { id: getElementResourceId('smoldering', 'mote'), inventory: 'resource', label: 'Smoldering Mote', qty: 5, cost: 40 },
  { id: getElementResourceId('grounding', 'mote'),  inventory: 'resource', label: 'Grounding Mote',  qty: 5, cost: 40 },
];

/**
 * Every material whose id does not exist in the inventory it claims.
 *
 * Worth having because a mistyped id fails SILENTLY in the worst way: the player pays, and the goods land
 * under a key nothing reads. Called at startup, the same idea as `findSilentDefinitions` for audio — a
 * shelf that cannot deliver is indistinguishable from one that can until someone buys from it.
 *
 * All four inventories are checked, not just the two I first thought to: the mote ids were `smolderingMote`
 * in the first draft and the real format is `smoldering_mote`, which only a real check would have caught.
 */
export function findUnsellableMaterials() {
  const known = {
    ore: new Set(ORE_TYPES.map(o => o.id)),
    ingot: new Set(Object.keys(INGOT_RESOURCES)),
    gathered: new Set(GATHERED_ONLY_RESOURCES.map(r => r.id ?? r)),
    processed: new Set(PROCESSED_RESOURCES.map(r => r.id ?? r)),
  };
  return SHOP_MATERIALS.filter(m => {
    // Arcana resources are keyed by element+tier and generated above, so they are correct by construction.
    if (m.inventory === 'resource') return false;
    const set = known[m.inventory];
    return !set || !set.has(m.id);
  });
}
