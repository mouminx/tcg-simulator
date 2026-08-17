import { CATALYSTS, CHARMS, SIGILS, parseElementResourceId } from './arcana';
import { CRAFTED_RESOURCES_BY_ID, CRAFTED_RESOURCE_TIERS } from './crafting';
import { INGOT_RESOURCES, INGOT_RESOURCE_TIERS, ORE_RESOURCE_TIERS, ORE_TYPES } from './foundry';
import { ALL_GATHERING_RESOURCES, PROCESSED_RESOURCES_BY_ID } from './wilderness';

export const LOOT_TIER_LABELS = Object.freeze(['', 'I', 'II', 'III', 'IV', 'V']);

export const RARITY_LOOT_TIERS = Object.freeze({
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  mythic: 5,
});

const ARCANA_RESOURCE_TIERS = Object.freeze({ mote: 1, wisp: 2, essence: 3, quintessence: 4 });
const KNOWN_ORES = new Set(ORE_TYPES.map(resource => resource.id));
const KNOWN_INGOTS = new Set(Object.keys(INGOT_RESOURCES));
const GATHERED_BY_ID = Object.freeze(Object.fromEntries(ALL_GATHERING_RESOURCES.map(resource => [resource.id, resource])));
const ARCANA_ITEMS_BY_ID = Object.freeze(Object.fromEntries(
  [...CHARMS, ...CATALYSTS, ...SIGILS].map(item => [item.id, item]),
));

export function normalizeLootTier(tier, fallback = 1) {
  const numeric = Number(tier);
  return Number.isFinite(numeric) ? Math.max(1, Math.min(5, Math.round(numeric))) : fallback;
}

export function getArcanaResourceTier(resourceId) {
  const { tier } = parseElementResourceId(resourceId ?? '');
  return ARCANA_RESOURCE_TIERS[tier] ?? 1;
}

/** One tier source for every square loot-card surface. */
export function getLootTier(source, id, definition = null) {
  if (Number.isFinite(definition?.tier)) return normalizeLootTier(definition.tier);
  if (definition?.minRarity) return RARITY_LOOT_TIERS[definition.minRarity] ?? 1;

  if (source === 'resource' || source === 'arcana') return getArcanaResourceTier(id);
  if (source === 'ore') return normalizeLootTier(ORE_RESOURCE_TIERS[id]);
  if (source === 'ingot') return normalizeLootTier(INGOT_RESOURCE_TIERS[id]);
  if (source === 'gathered') return normalizeLootTier(RARITY_LOOT_TIERS[GATHERED_BY_ID[id]?.minRarity]);
  if (source === 'processed') return normalizeLootTier(PROCESSED_RESOURCES_BY_ID[id]?.tier);
  if (source === 'crafted') return normalizeLootTier(CRAFTED_RESOURCES_BY_ID[id]?.tier ?? CRAFTED_RESOURCE_TIERS[id]);
  if (source === 'arcana-item') {
    const item = ARCANA_ITEMS_BY_ID[id];
    return normalizeLootTier(item?.tier ?? item?.effect?.targetTier);
  }
  if (source === 'tool') return normalizeLootTier(definition?.tier);

  if (source === 'currency' || source === 'coins' || id === 'coins' || id === 'treasurePack') return 1;

  return normalizeLootTier(
    CRAFTED_RESOURCES_BY_ID[id]?.tier
      ?? CRAFTED_RESOURCE_TIERS[id]
      ?? RARITY_LOOT_TIERS[GATHERED_BY_ID[id]?.minRarity]
      ?? (KNOWN_INGOTS.has(id) ? INGOT_RESOURCE_TIERS[id] : null)
      ?? (KNOWN_ORES.has(id) ? ORE_RESOURCE_TIERS[id] : null),
  );
}
