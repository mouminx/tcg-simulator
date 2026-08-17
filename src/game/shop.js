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

import { PERMANENT_PACK_IDS, ROTATION_PACK_IDS } from './cards';
import { ORE_TYPES, INGOT_RESOURCES, ORE_RESOURCE_TIERS, INGOT_RESOURCE_TIERS } from './foundry';
import { GATHERED_ONLY_RESOURCES, PROCESSED_RESOURCES } from './wilderness';
import { CRAFTED_RESOURCES } from './crafting';
import { ELEMENT_TIERS, ESSENCES, getElementResourceId } from './arcana';

// ── Rotation deals ───────────────────────────────────────────────────────────

/** One compact merchant visit: stock changes often enough to feel alive while the player is crafting. */
export const ROTATION_PERIOD_MS = 5 * 60 * 1000;

/** How many rotation slots are stocked at once. */
export const ROTATION_SLOTS = 3;
export const GOODS_ROTATION_SLOTS = 16;
export const SHOP_PRICE_STEP = 0.15;

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

/** The complete pack catalogue eligible for the three rotating shelf positions. */
export const SHOP_PACK_IDS = Object.freeze(
  // Blank Slate has its own permanent fourth shelf position. Keeping it out of this pool guarantees the
  // other three positions are genuinely rotating stock and can never duplicate the permanent offer.
  [...new Set([...PERMANENT_PACK_IDS, ...ROTATION_PACK_IDS])],
);

export function getRotationOffers(now, pool = SHOP_PACK_IDS, slots = ROTATION_SLOTS) {
  const { index, endsAt, msRemaining } = getRotationWindow(now);
  const picks = takeFromShuffleBag(pool, index, slots, 0x13a5ba1d);
  const rotation = { picks, index, endsAt, msRemaining };
  return {
    ...rotation,
    offers: rotation.picks.map(packId => ({ packId })),
  };
}

export function getGoodsRotation(now, pool = SHOP_MATERIALS, slots = GOODS_ROTATION_SLOTS) {
  const { index, endsAt, msRemaining } = getRotationWindow(now);
  const count = Math.min(Math.max(0, slots), pool.length);

  if (!count) return { picks: [], index, endsAt, msRemaining, offers: [] };

  /*
   * Sixteen cards are divided into rarity lanes: useful basics remain available, while every shelf also
   * contains genuinely rare stock. Each lane is its own deterministic shuffle bag. That means an item is
   * not eligible to repeat until the rest of its tier has been walked, and every catalogue entry eventually
   * reaches the shelf. The last shuffle mixes the lanes visually so rarity does not reveal a fixed grid cell.
   */
  const baseQuotas = [6, 4, 3, 2, 1];
  const scaledQuotas = baseQuotas.map(quota => Math.floor((quota * count) / GOODS_ROTATION_SLOTS));
  let unassigned = count - scaledQuotas.reduce((sum, quota) => sum + quota, 0);
  for (let tierIndex = 0; unassigned > 0; tierIndex = (tierIndex + 1) % 5) {
    scaledQuotas[tierIndex] += 1;
    unassigned -= 1;
  }

  const selected = [];
  const selectedIds = new Set();
  for (let tier = 1; tier <= 5; tier++) {
    const tierPool = pool.filter(material => material.tier === tier);
    const tierPicks = takeFromShuffleBag(tierPool, index, scaledQuotas[tier - 1], 0x5f3759df + tier)
      .map(material => material.shopId);
    tierPicks.forEach(id => {
      if (!selectedIds.has(id)) {
        selected.push(id);
        selectedIds.add(id);
      }
    });
  }

  // A custom/test pool can be missing a tier. Fill those unused lanes from the complete catalogue.
  if (selected.length < count) {
    const fallback = takeFromShuffleBag(pool, index, pool.length, 0x41c6ce57);
    for (const material of fallback) {
      if (selected.length >= count) break;
      if (selectedIds.has(material.shopId)) continue;
      selected.push(material.shopId);
      selectedIds.add(material.shopId);
    }
  }

  const picks = seededShuffle(selected, index + 0x2c1b3c6d);
  const rotation = { picks, index, endsAt, msRemaining };
  return {
    ...rotation,
    offers: rotation.picks.map(materialId => ({ materialId })),
  };
}

function seededShuffle(values, seed) {
  const shuffled = [...values];
  let state = hash(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    state = hash(state + i + 0x9e3779b9);
    const j = state % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Draw contiguous entries from a seeded sequence of shuffled catalogues. */
function takeFromShuffleBag(values, windowIndex, requested, seed) {
  const source = [...values];
  const count = Math.min(Math.max(0, requested), source.length);
  if (!count || !source.length) return [];

  const absoluteStart = Math.max(0, windowIndex) * count;
  const picks = [];
  const pickedKeys = new Set();
  let cursor = absoluteStart;
  // Crossing the end of a bag can put the same item at the next bag's beginning. Skip that duplicate;
  // a shelf should never show the same merchant item twice.
  while (picks.length < count && cursor < absoluteStart + source.length * 3) {
    const cycle = Math.floor(cursor / source.length);
    const offset = cursor % source.length;
    const bag = seededShuffle(source, seed + cycle * 0x45d9f3b);
    const value = bag[offset];
    const key = typeof value === 'object' ? value.shopId : value;
    if (!pickedKeys.has(key)) {
      picks.push(value);
      pickedKeys.add(key);
    }
    cursor += 1;
  }
  return picks;
}

/**
 * A predictable linear rise: each unit costs 15% more than the base price.
 *
 * Keep cents instead of rounding to whole gold. Whole-number rounding made a 2-gold item cost 2 again
 * after its first purchase, contradicting the promise that EVERY unit raises the next price.
 */
export function getEscalatingShopPrice(baseCost, purchased = 0) {
  const count = Math.max(0, Math.floor(Number(purchased) || 0));
  return Math.max(0.01, Math.round(Number(baseCost) * (1 + count * SHOP_PRICE_STEP) * 100) / 100);
}

export function normalizeShopPurchases(saved, now = Date.now()) {
  const { index } = getRotationWindow(now);
  if (saved?.windowIndex !== index) return { windowIndex: index, packs: {}, goods: {} };
  return {
    windowIndex: index,
    packs: { ...(saved.packs ?? {}) },
    goods: { ...(saved.goods ?? {}) },
  };
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
const PRICE_BY_INVENTORY_AND_TIER = Object.freeze({
  ore: Object.freeze([0, 3, 12, 36, 110, 360]),
  ingot: Object.freeze([0, 12, 30, 85, 260, 850]),
  gathered: Object.freeze([0, 6, 24, 95, 420, 1800]),
  processed: Object.freeze([0, 8, 28, 105, 440, 1850]),
  crafted: Object.freeze([0, 12, 38, 140, 560, 2200]),
  resource: Object.freeze([0, 9, 45, 220, 1100, 3600]),
});

const LEGACY_PRICE_OVERRIDES = Object.freeze({
  'ore:stone': 2,
  'ore:coal': 3,
  'ore:iron': 4,
  'ore:silver': 9,
  'ore:gold': 16,
  'ingot:steel': 12,
  'ingot:silver': 20,
  'gathered:wood': 3,
  'gathered:hardwood': 7,
  'gathered:fiberweed': 3,
  'gathered:softstem': 7,
  'gathered:silkgrass': 14,
  'gathered:hide': 5,
  'gathered:resin': 6,
  'gathered:mushrooms': 8,
  'crafted:timber': 8,
  'crafted:lumber': 14,
  'crafted:linen': 10,
  'crafted:roughLeather': 12,
});

function makeShopMaterial(definition, inventory, tier) {
  const normalizedTier = Math.max(1, Math.min(5, Number(tier) || 1));
  const duplicateIngotId = inventory === 'ingot' && ORE_TYPES.some(ore => ore.id === definition.id);
  const shopId = duplicateIngotId ? `${definition.id}Ingot` : definition.id;
  return {
    id: definition.id,
    shopId,
    inventory,
    label: definition.name ?? definition.label ?? definition.id,
    artKey: definition.artKey,
    qty: 1,
    tier: normalizedTier,
    cost: LEGACY_PRICE_OVERRIDES[`${inventory}:${definition.id}`]
      ?? PRICE_BY_INVENTORY_AND_TIER[inventory][normalizedTier],
  };
}

const ARCANA_SHOP_RESOURCES = ESSENCES.flatMap(essence => ELEMENT_TIERS.map((elementTier, index) => ({
  id: getElementResourceId(essence.id, elementTier),
  name: `${essence.name.replace(/ Essence$/i, '')} ${elementTier.charAt(0).toUpperCase()}${elementTier.slice(1)}`,
  tier: index + 1,
})));

/**
 * The full material catalogue, split into rarity lanes by `tier` when stocked. Treasure packs are opened
 * at the Summoning altar rather than sold as a one-unit material, so they are the sole gathered exclusion.
 */
export const SHOP_MATERIALS = [
  ...ORE_TYPES.map(resource => makeShopMaterial(resource, 'ore', ORE_RESOURCE_TIERS[resource.id])),
  ...Object.values(INGOT_RESOURCES).map(resource => makeShopMaterial(resource, 'ingot', INGOT_RESOURCE_TIERS[resource.id])),
  ...GATHERED_ONLY_RESOURCES
    .filter(resource => resource.id !== 'treasurePack')
    .map(resource => makeShopMaterial(resource, 'gathered', Math.max(
      resource.tier ?? 1,
      { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 5 }[resource.minRarity] ?? 1,
    ))),
  ...PROCESSED_RESOURCES.map(resource => makeShopMaterial(resource, 'processed', resource.tier)),
  ...CRAFTED_RESOURCES.map(resource => makeShopMaterial(resource, 'crafted', resource.tier)),
  ...ARCANA_SHOP_RESOURCES.map(resource => makeShopMaterial(resource, 'resource', resource.tier)),
];

/** Stable merchant identity; inventory ids are not globally unique (ore/ingot silver). */
SHOP_MATERIALS.forEach(material => { if (!material.shopId) material.shopId = material.id; });

/**
 * Every material whose id does not exist in the inventory it claims.
 *
 * Worth having because a mistyped id fails SILENTLY in the worst way: the player pays, and the goods land
 * under a key nothing reads. Called at startup, the same idea as `findSilentDefinitions` for audio — a
 * shelf that cannot deliver is indistinguishable from one that can until someone buys from it.
 *
 * Every concrete inventory is checked. Arcana resources are generated from the canonical id helper below.
 */
export function findUnsellableMaterials() {
  const known = {
    ore: new Set(ORE_TYPES.map(o => o.id)),
    ingot: new Set(Object.keys(INGOT_RESOURCES)),
    gathered: new Set(GATHERED_ONLY_RESOURCES.map(r => r.id ?? r)),
    processed: new Set(PROCESSED_RESOURCES.map(r => r.id ?? r)),
    crafted: new Set(CRAFTED_RESOURCES.map(r => r.id ?? r)),
  };
  return SHOP_MATERIALS.filter(m => {
    // Arcana resources are keyed by element+tier and generated above, so they are correct by construction.
    if (m.inventory === 'resource') return false;
    const set = known[m.inventory];
    return !set || !set.has(m.id);
  });
}
