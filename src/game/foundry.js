import { getCardAffixBonuses, getCardProductionRollCount, rollCoinGenerationReward } from './cards';
import { DEFAULT_RESOURCES, getElementResourceId } from './arcana';
import {
  applyToolPrimaryQuantity,
  getToolAttunementPercent,
  getToolEfficiencyPercent,
  getToolLuckPercent,
  getToolMaterialAffinity,
  normalizeTool,
  rollPercent,
  rollToolElementalDrops,
  toolRollsDiscovery,
  toolRollsRefinement,
} from './tools';
import { DULL_GEMS, GEM_CUTS, GEMSTONES, GEM_RESOURCES_BY_ID } from './gems';
import { GEMDUST_RESOURCE } from './gemdust';
import {
  MINING_SPECIAL_RESOURCES,
  SPECIAL_GATHERED_RESOURCES_BY_ID,
} from './specialResources';
import {
  applySapphireMomentum,
  getTopazWeightMultiplier,
  rollSocketEffect,
} from './cardSockets';

export const ORE_RESOURCE_TIERS = Object.freeze({
  stone: 1,
  coal: 1,
  iron: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  starlit: 5,
});

export const INGOT_RESOURCE_TIERS = Object.freeze({
  steel: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  starsteel: 5,
});

export const ORE_TYPES = [
  { id: 'stone',   name: 'Stone',       ingotId: null,        ingot: null,             family: 'Mineral',   color: '#7a7a7a', glow: 'rgba(122,122,122,0.30)', description: 'Solid bedrock chipped from cave walls, the most fundamental of all building materials.' },
  { id: 'coal',    name: 'Coal',        ingotId: null,        ingot: null,             family: 'Mineral',   color: '#5a5d66', glow: 'rgba(90,93,102,0.30)',   description: 'Dense black mineral fuel that burns hot and long, the lifeblood of forges and furnaces.' },
  { id: 'iron',    name: 'Iron Ore',    ingotId: 'steel',     ingot: 'Steel Ingot',    family: 'Iron',      color: '#8b7355', glow: 'rgba(139,115,85,0.34)',  description: 'Common reddish ore found in abundance, smelted into the iron and steel used for everyday tools and armor.' },
  { id: 'silver',  name: 'Silver Ore',  ingotId: 'silver',    ingot: 'Silver Ingot',   family: 'Silver',    color: '#b4c0d0', glow: 'rgba(180,192,208,0.34)', description: 'Lustrous ore valued for its natural conductivity and purity, sought after for precision instruments and enchanting.' },
  { id: 'gold',    name: 'Gold Ore',    ingotId: 'gold',      ingot: 'Gold Ingot',     family: 'Gold',      color: '#d9ab2b', glow: 'rgba(217,171,43,0.34)',  description: 'Precious metallic ore prized for its resistance to tarnish and essential role in high-value alchemy and crafting.' },
  { id: 'platinum',name: 'Platinum Ore',ingotId: 'platinum',  ingot: 'Platinum Ingot', family: 'Platinum',  color: '#8fd0e2', glow: 'rgba(143,208,226,0.32)', description: 'Rare dense ore requiring intense heat to smelt, sought after for its use in masterwork alloys and enchanted equipment.' },
  { id: 'starlit', name: 'Starlit Ore', ingotId: 'starsteel', ingot: 'Starsteel Ingot',family: 'Starlit',   color: '#8d7cff', glow: 'rgba(141,124,255,0.34)', description: 'Ore veined with trapped starlight, found only in the deepest reaches of ancient mines and prized for arcane forging.' },
].map(resource => Object.freeze({ ...resource, tier: ORE_RESOURCE_TIERS[resource.id] ?? 1 }));

/** Mine-only reagents and gems retain their gathered-inventory identity. */
export const MINING_RESOURCE_TYPES = Object.freeze([
  ...ORE_TYPES.slice(0, 3),
  GEMDUST_RESOURCE,
  SPECIAL_GATHERED_RESOURCES_BY_ID.quartz,
  SPECIAL_GATHERED_RESOURCES_BY_ID.salt,
  ...DULL_GEMS,
  ORE_TYPES[3],
  SPECIAL_GATHERED_RESOURCES_BY_ID.geode,
  SPECIAL_GATHERED_RESOURCES_BY_ID.auricVein,
  ORE_TYPES[4],
  SPECIAL_GATHERED_RESOURCES_BY_ID.obsidian,
  ORE_TYPES[5],
  SPECIAL_GATHERED_RESOURCES_BY_ID.cinnabar,
  SPECIAL_GATHERED_RESOURCES_BY_ID.compassOre,
  ORE_TYPES[6],
]);

const BASE_INGOT_RESOURCES = {
  steel:    { id: 'steel',    name: 'Steel Ingot',    artKey: 'steel',    family: 'Forged Steel',    color: '#5f7486', glow: 'rgba(95,116,134,0.34)',   description: 'Sturdy iron-based alloy refined in the forge, the backbone of weapons and structural crafting.' },
  silver:   { id: 'silver',   name: 'Silver Ingot',   artKey: 'silver',   family: 'Refined Silver',  color: '#c9d5e4', glow: 'rgba(201,213,228,0.34)',  description: 'Refined silver bar prized for its purity and use in precision instruments and enchantment work.' },
  gold:     { id: 'gold',     name: 'Gold Ingot',     artKey: 'gold',     family: 'Refined Gold',    color: '#efbe3d', glow: 'rgba(239,190,61,0.34)',   description: 'Purified gold bar essential for high-value alchemy, fine jewelry, and premium equipment crafting.' },
  platinum: { id: 'platinum', name: 'Platinum Ingot', artKey: 'platinum', family: 'Refined Platinum',color: '#9fd9e9', glow: 'rgba(159,217,233,0.32)',  description: 'Dense, heat-resistant bar smelted from rare platinum ore, used in masterwork and high-grade alloys.' },
  starsteel:{ id: 'starsteel',name: 'Starsteel Ingot',artKey: 'starsteel',family: 'Celestial Alloy', color: '#a68cff', glow: 'rgba(166,140,255,0.34)',  description: 'Celestial alloy forged from starlit ore, radiating faint arcane energy suited for legendary-tier crafting.' },
};

export const INGOT_RESOURCES = Object.freeze(Object.fromEntries(
  Object.entries(BASE_INGOT_RESOURCES).map(([id, resource]) => [
    id,
    Object.freeze({ ...resource, tier: INGOT_RESOURCE_TIERS[id] ?? 1 }),
  ]),
));

export const ORE_TO_INGOT = Object.freeze(
  Object.fromEntries(ORE_TYPES.map(ore => [ore.id, ore.ingotId])),
);

// Recipe per ore type: oreCount = ore needed, ingredient = required ingot ingredient (or null)
const BASE_SMELT_RECIPES = {
  iron:     { oreCount: 4,  ingredient: null },
  silver:   { oreCount: 4,  ingredient: { source: 'ingot', type: 'steel',    count: 1 } },
  gold:     { oreCount: 6,  ingredient: { source: 'ingot', type: 'silver',   count: 1 } },
  platinum: { oreCount: 8,  ingredient: { source: 'ingot', type: 'gold',     count: 1 } },
  starlit:  { oreCount: 10, ingredient: { source: 'ingot', type: 'platinum', count: 1 } },
};

const GEM_ELEMENT_BY_FAMILY = Object.freeze({
  ruby: 'smoldering',
  sapphire: 'flowing',
  topaz: 'jolting',
  emerald: 'blooming',
  diamond: 'gusting',
});
const GEM_CATALYST_TIERS = Object.freeze(['mote', 'wisp', 'essence', 'quintessence']);
const GEM_CATALYST_COUNTS = Object.freeze([10, 10, 10, 5]);

export const GEM_FUSION_RECIPES = Object.freeze(Object.fromEntries(
  GEMSTONES.flatMap(gem => GEM_CUTS.slice(0, -1).map((cut, index) => {
    const inputId = `${cut.prefix}_${gem.id}`;
    const outputId = `${GEM_CUTS[index + 1].prefix}_${gem.id}`;
    return [inputId, Object.freeze({
      kind: 'gemFusion',
      inputSource: 'gathered',
      oreCount: 10,
      ingredient: Object.freeze({
        source: 'arcana',
        type: getElementResourceId(GEM_ELEMENT_BY_FAMILY[gem.id], GEM_CATALYST_TIERS[index]),
        count: GEM_CATALYST_COUNTS[index],
      }),
      outputSource: 'gathered',
      outputId,
      fuelType: 'gemdust',
      cardClass: 'gemcutter',
    })];
  })),
));

export const SMELT_RECIPES = Object.freeze({
  ...Object.fromEntries(Object.entries(BASE_SMELT_RECIPES).map(([id, recipe]) => [id, Object.freeze({
    ...recipe,
    kind: 'smelting',
    inputSource: 'ore',
    outputSource: 'ingot',
    outputId: ORE_TO_INGOT[id],
    fuelType: 'coal',
    cardClass: 'blacksmith',
  })])),
  ...GEM_FUSION_RECIPES,
  wood: Object.freeze({
    kind: 'charcoal', inputSource: 'gathered', oreCount: 2, ingredient: null,
    outputSource: 'crafted', outputId: 'charcoal', fuelType: 'coal', cardClass: 'blacksmith',
  }),
  hardwood: Object.freeze({
    kind: 'charcoal', inputSource: 'gathered', oreCount: 1, ingredient: null,
    outputSource: 'crafted', outputId: 'charcoal', fuelType: 'coal', cardClass: 'blacksmith',
  }),
});

const FORGE_OUTPUT_SOURCES = Object.freeze(Object.fromEntries(
  Object.values(SMELT_RECIPES).map(recipe => [recipe.outputId, recipe.outputSource]),
));

export function getForgeOutputSource(outputId) {
  return FORGE_OUTPUT_SOURCES[outputId]
    ?? (GEM_RESOURCES_BY_ID[outputId] ? 'gathered' : 'ingot');
}

export const DEFAULT_ORE_INVENTORY = Object.freeze(
  Object.fromEntries(ORE_TYPES.map(ore => [ore.id, 0])),
);

export const DEFAULT_MINE_CLAIM_QUEUE = Object.freeze(
  Object.fromEntries(MINING_RESOURCE_TYPES.map(resource => [resource.id, 0])),
);

export const DEFAULT_INGOT_INVENTORY = Object.freeze(
  Object.fromEntries(ORE_TYPES.filter(ore => ore.ingotId != null).map(ore => [ore.ingotId, 0])),
);

export const DEFAULT_MINE_SLOT_CAPACITY = 4;
export const MAX_MINE_SLOT_CAPACITY = 4;
export const MINE_SLOT_COSTS = Object.freeze({
  1: 45,
  2: 110,
  3: 240,
  4: 420,
});
export const FORGE_SLOT_COUNT = 3;
export const FORGE_FUEL_TYPE = 'coal';
export const FORGE_FUEL_COST = 1;
export const FORGE_SMELTS_PER_COAL = 5;
export const GEM_FUSIONS_PER_GEMDUST = 1;

export const FORGE_BOOSTERS = Object.freeze({
  flux: Object.freeze({ id: 'flux', speedPercent: 10, cyclesPerUnit: 5 }),
  arcaneFlux: Object.freeze({ id: 'arcaneFlux', speedPercent: 20, cyclesPerUnit: 15 }),
});

export function getForgeFuelChargesPerUnit(fuelType = 'coal') {
  return fuelType === 'gemdust' ? GEM_FUSIONS_PER_GEMDUST : FORGE_SMELTS_PER_COAL;
}
export const FORGE_SMELTS_PER_MINUTE = 3;
export const FORGE_CYCLE_DURATION_SECONDS = Math.round(60 / FORGE_SMELTS_PER_MINUTE);

export const BASE_MINING_DURATION_SECONDS = 60;
export const BASE_GOLD_PER_PRODUCTION = 0.5;

// Ore drop weights by rarity. Each rarity unlocks the next tier of ore;
// the relative distribution of accessible ores stays proportionally flat.
// Only the affix VALUE RANGES on cards change with rarity — not what drops.
// Hard caps: common=stone/coal/iron only; uncommon+=silver; rare+=gold;
//            epic+=platinum; legendary/mythic+=starlit.
const distributeGemWeight = total => Object.fromEntries(DULL_GEMS.map(gem => [gem.id, total / DULL_GEMS.length]));
// Miners can still make the occasional gemstone discovery, but Prospector is now the dedicated gem class.
const MINER_GEM_WEIGHTS = Object.freeze(distributeGemWeight(1.5));

export const ORE_WEIGHTS_BY_RARITY = {
  common:    { stone: 50, coal: 33, iron: 17, gemdust: 2, quartz: 0, salt: 0, silver: 0, geode: 0, auricVein: 0, gold: 0, obsidian: 0, platinum: 0, cinnabar: 0, compassOre: 0, starlit: 0 },
  uncommon:  { stone: 43, coal: 28, iron: 15, gemdust: 2, quartz: 5, salt: 5, silver: 8, geode: 0, auricVein: 0, gold: 0, obsidian: 0, platinum: 0, cinnabar: 0, compassOre: 0, starlit: 0 },
  rare:      { stone: 40, coal: 26, iron: 14, gemdust: 2, quartz: 5, salt: 5, silver: 8, geode: 0, auricVein: 0, gold: 6, obsidian: 0, platinum: 0, cinnabar: 0, compassOre: 0, starlit: 0, ...MINER_GEM_WEIGHTS },
  epic:      { stone: 37, coal: 24, iron: 13, gemdust: 2, quartz: 5, salt: 5, silver: 8, geode: 0, auricVein: 0, gold: 6, obsidian: 1.5, platinum: 6, cinnabar: 0, compassOre: 0, starlit: 0, ...MINER_GEM_WEIGHTS },
  legendary: { stone: 34, coal: 23, iron: 11, gemdust: 2, quartz: 5, salt: 5, silver: 8, geode: 0, auricVein: 0, gold: 6, obsidian: 1.5, platinum: 6, cinnabar: 0, compassOre: 0.15, starlit: 6, ...MINER_GEM_WEIGHTS },
  mythic:    { stone: 34, coal: 23, iron: 11, gemdust: 2, quartz: 5, salt: 5, silver: 8, geode: 0, auricVein: 0, gold: 6, obsidian: 1.5, platinum: 6, cinnabar: 0, compassOre: 0.15, starlit: 6, ...MINER_GEM_WEIGHTS },
};

/** Prospectors overwhelmingly uncover stone or gems, with richer cards exposing a little more high ore. */
export const PROSPECTOR_WEIGHTS_BY_RARITY = Object.freeze({
  common:    { stone: 58, coal: 7, iron: 7, gemdust: 8, quartz: 0, salt: 0, silver: 0, geode: 0, auricVein: 0, gold: 0, obsidian: 0, platinum: 0, cinnabar: 0, compassOre: 0, starlit: 0, ...distributeGemWeight(20) },
  uncommon:  { stone: 54, coal: 5, iron: 5, gemdust: 8, quartz: 0, salt: 0, silver: 6, geode: 0, auricVein: 0, gold: 0, obsidian: 0, platinum: 0, cinnabar: 0, compassOre: 0, starlit: 0, ...distributeGemWeight(22) },
  rare:      { stone: 45, coal: 4, iron: 4, gemdust: 8, quartz: 0, salt: 0, silver: 5, geode: 4, auricVein: 1.2, gold: 5, obsidian: 0, platinum: 0, cinnabar: 0, compassOre: 0, starlit: 0, ...distributeGemWeight(25) },
  epic:      { stone: 40, coal: 3, iron: 3, gemdust: 8, quartz: 0, salt: 0, silver: 4, geode: 4, auricVein: 1.2, gold: 4, obsidian: 2, platinum: 4, cinnabar: 0, compassOre: 0, starlit: 0, ...distributeGemWeight(30) },
  legendary: { stone: 35, coal: 3, iron: 3, gemdust: 8, quartz: 0, salt: 0, silver: 3, geode: 4, auricVein: 1.2, gold: 3, obsidian: 2, platinum: 3, cinnabar: 0.4, compassOre: 0, starlit: 3, ...distributeGemWeight(35) },
  mythic:    { stone: 31, coal: 3, iron: 3, gemdust: 8, quartz: 0, salt: 0, silver: 3, geode: 4, auricVein: 1.2, gold: 3, obsidian: 2, platinum: 3, cinnabar: 0.4, compassOre: 0, starlit: 3, ...distributeGemWeight(39) },
});

export const MINE_CLASS_TYPES = Object.freeze(['miner', 'prospector']);
export function isMiningCardCompatible(card) {
  return MINE_CLASS_TYPES.includes(card?.classType);
}

// Tier no longer skews ore distribution — tier affects affix value ranges only.
export const ORE_WEIGHT_TIER_ADJUSTMENTS = {
  1: { stone: 0, coal: 0, iron: 0, gemdust: 0, silver: 0, gold: 0, platinum: 0, starlit: 0 },
  2: { stone: 0, coal: 0, iron: 0, gemdust: 0, silver: 0, gold: 0, platinum: 0, starlit: 0 },
  3: { stone: 0, coal: 0, iron: 0, gemdust: 0, silver: 0, gold: 0, platinum: 0, starlit: 0 },
  4: { stone: 0, coal: 0, iron: 0, gemdust: 0, silver: 0, gold: 0, platinum: 0, starlit: 0 },
  5: { stone: 0, coal: 0, iron: 0, gemdust: 0, silver: 0, gold: 0, platinum: 0, starlit: 0 },
};

export function clampMineSlotCapacity(capacity) {
  return Math.max(DEFAULT_MINE_SLOT_CAPACITY, Math.min(capacity ?? DEFAULT_MINE_SLOT_CAPACITY, MAX_MINE_SLOT_CAPACITY));
}

export function getMineSlotUpgradeCost(capacity) {
  return MINE_SLOT_COSTS[capacity] ?? null;
}

export function createMiningSlot(slotId) {
  return {
    slotId,
    card: null,
    tool: null,
    momentumStacks: 0,
    startedAt: null,
    endsAt: null,
    oreType: null,
  };
}

export function createMiningSlots(capacity = DEFAULT_MINE_SLOT_CAPACITY) {
  return Array.from({ length: clampMineSlotCapacity(capacity) }, (_, index) => createMiningSlot(index + 1));
}

export function normalizeMiningSlots(savedSlots = [], capacity = DEFAULT_MINE_SLOT_CAPACITY) {
  const clampedCapacity = clampMineSlotCapacity(capacity);
  return Array.from({ length: clampedCapacity }, (_, index) => {
    const slotId = index + 1;
    const savedSlot = savedSlots.find(slot => Number(slot?.slotId) === slotId);
    if (!savedSlot) return createMiningSlot(slotId);
    return {
      slotId,
      card: savedSlot.card ? { ...savedSlot.card } : null,
      tool: normalizeTool(savedSlot.tool),
      momentumStacks: Math.max(0, Math.min(3, Math.floor(Number(savedSlot.momentumStacks) || 0))),
      startedAt: typeof savedSlot.startedAt === 'number' ? savedSlot.startedAt : null,
      endsAt: typeof savedSlot.endsAt === 'number' ? savedSlot.endsAt : null,
      oreType: typeof savedSlot.oreType === 'string' ? savedSlot.oreType : null,
    };
  });
}

export function getMiningAffixBonusPercent(card, tool = null, momentumStacks = 0) {
  return getToolEfficiencyPercent(card, tool, 'miningSpeed', momentumStacks);
}

export function getSmeltingAffixBonusPercent(card) {
  return getCardAffixBonuses(card).smeltingSpeed ?? 0;
}

export function getForgeCycleDurationSeconds(card, boosterPercent = 0) {
  const bonusPercent = getSmeltingAffixBonusPercent(card) + Math.max(0, Number(boosterPercent) || 0);
  const accelerated = FORGE_CYCLE_DURATION_SECONDS / (1 + bonusPercent / 100);
  return Math.max(3, Math.round(accelerated));
}

export function getMiningDurationSeconds(card, tool = null, momentumStacks = 0) {
  const bonusPercent = getMiningAffixBonusPercent(card, tool, momentumStacks);
  const acceleratedSeconds = BASE_MINING_DURATION_SECONDS / (1 + bonusPercent / 100);
  return Math.max(5, Math.round(acceleratedSeconds));
}

export function resolveOreWeightsForCard(card, tool = null) {
  const classWeights = card?.classType === 'prospector' ? PROSPECTOR_WEIGHTS_BY_RARITY : ORE_WEIGHTS_BY_RARITY;
  const rarityWeights = classWeights[card?.rarity] ?? classWeights.common;
  const tierAdjustments = ORE_WEIGHT_TIER_ADJUSTMENTS[card?.tier] ?? ORE_WEIGHT_TIER_ADJUSTMENTS[1];
  const luckPercent = getToolLuckPercent(card, tool, 'miningLuck');
  const gemFindPercent = getCardAffixBonuses(card).gemFind ?? 0;
  const affinity = getToolMaterialAffinity(tool);
  const accessible = MINING_RESOURCE_TYPES.filter(ore => (rarityWeights[ore.id] ?? 0) > 0);
  return MINING_RESOURCE_TYPES.reduce((acc, ore) => {
    const baseWeight = Math.max(0, (rarityWeights[ore.id] ?? 0) + (tierAdjustments[ore.id] ?? 0));
    const position = Math.max(0, accessible.findIndex(entry => entry.id === ore.id));
    const rarityFraction = position / Math.max(1, accessible.length - 1);
    const luckMultiplier = 1 + (luckPercent / 100) * rarityFraction * 2;
    const affinityMultiplier = affinity?.materialId === ore.id ? 1 + affinity.value / 100 : 1;
    const gemFindMultiplier = GEM_RESOURCES_BY_ID[ore.id] ? 1 + gemFindPercent / 100 : 1;
    const source = getMiningResourceSource(ore.id);
    const topazMultiplier = getTopazWeightMultiplier(card, ore.id, source);
    acc[ore.id] = baseWeight * luckMultiplier * affinityMultiplier * gemFindMultiplier * topazMultiplier;
    return acc;
  }, {});
}

export function rollOreTypeForCard(card, tool = null, random = Math.random) {
  const weights = resolveOreWeightsForCard(card, tool);
  const rollOnce = () => {
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return 'iron';

    let roll = random() * total;
    for (const ore of MINING_RESOURCE_TYPES) {
      roll -= weights[ore.id] ?? 0;
      if (roll <= 0) return ore.id;
    }
    return 'iron';
  };
  const first = rollOnce();
  if (!rollSocketEffect(card, 'emerald', random)) return first;
  const second = rollOnce();
  const firstTier = MINING_RESOURCE_TYPES.find(resource => resource.id === first)?.tier ?? 1;
  const secondTier = MINING_RESOURCE_TYPES.find(resource => resource.id === second)?.tier ?? 1;
  return secondTier > firstTier ? second : first;
}

export function startMiningSlot(slot, now = Date.now()) {
  if (!slot?.card || slot.startedAt || slot.endsAt) return slot;
  const durationSeconds = getMiningDurationSeconds(slot.card, slot.tool, slot.momentumStacks);
  const durationMs = durationSeconds * 1000;
  return {
    ...slot,
    startedAt: now,
    endsAt: now + durationMs,
    oreType: rollOreTypeForCard(slot.card, slot.tool),
  };
}

export function startMiningSlots(slots = [], now = Date.now()) {
  return slots.map(slot => startMiningSlot(slot, now));
}

export function resolveCompletedMiningSlots(slots = [], now = Date.now(), random = Math.random) {
  const completedQueue = { ...DEFAULT_MINE_CLAIM_QUEUE };
  const elementalDrops = { ...DEFAULT_RESOURCES };
  const completedBySlot = [];
  let completedCount = 0;
  let goldEarned = 0;

  const nextSlots = slots.map(slot => {
    if (!slot?.card || !slot.endsAt || slot.endsAt > now || !slot.oreType) return slot;
    const accessible = MINING_RESOURCE_TYPES.filter(ore => resolveOreWeightsForCard(slot.card, slot.tool)[ore.id] > 0);
    const materialRolls = [
      slot.oreType,
      ...Array.from(
        { length: getCardProductionRollCount(slot.card) - 1 },
        () => rollOreTypeForCard(slot.card, slot.tool, random),
      ),
    ];
    const attunementChance = getToolAttunementPercent(slot.card, slot.tool, 'miningAttunement');
    const slotLoot = {};
    const primaryOutputs = {};
    materialRolls.forEach(oreType => {
      const rolledIndex = accessible.findIndex(ore => ore.id === oreType);
      const refinedOreType = toolRollsRefinement(slot.tool, random) && rolledIndex >= 0
        ? accessible[Math.min(accessible.length - 1, rolledIndex + 1)]?.id ?? oreType
        : oreType;
      const baseCount = 1 + (rollPercent(attunementChance, random) ? 1 : 0);
      const primaryCount = applyToolPrimaryQuantity(baseCount, slot.tool, random);
      completedQueue[refinedOreType] += primaryCount;
      slotLoot[refinedOreType] = (slotLoot[refinedOreType] ?? 0) + primaryCount;
      primaryOutputs[refinedOreType] = (primaryOutputs[refinedOreType] ?? 0) + primaryCount;
      if (toolRollsDiscovery(slot.tool, random)) {
        const discoveryOre = rollOreTypeForCard(slot.card, slot.tool, random);
        completedQueue[discoveryOre] += 1;
        slotLoot[discoveryOre] = (slotLoot[discoveryOre] ?? 0) + 1;
      }
    });
    if (rollSocketEffect(slot.card, 'ruby', random)) {
      Object.entries(primaryOutputs).forEach(([resourceId, amount]) => {
        completedQueue[resourceId] += amount;
        slotLoot[resourceId] = (slotLoot[resourceId] ?? 0) + amount;
      });
    }
    const moteDrops = rollToolElementalDrops(slot.card, slot.tool, random);
    Object.entries(moteDrops).forEach(([resourceId, amount]) => {
      elementalDrops[resourceId] = (elementalDrops[resourceId] ?? 0) + amount;
    });
    const coins = rollCoinGenerationReward(slot.card);
    completedBySlot.push({
      slotId: slot.slotId,
      loot: slotLoot,
      rewards: { coins, ...moteDrops },
    });
    completedCount += 1;
    goldEarned += coins;
    const restarted = startMiningSlot({
      ...slot,
      momentumStacks: Math.min(3, (slot.momentumStacks ?? 0) + 1),
      startedAt: null,
      endsAt: null,
      oreType: null,
    }, now);
    return applySapphireMomentum(slot.card, restarted, now);
  });

  return { nextSlots, completedQueue, completedBySlot, completedCount, goldEarned, elementalDrops };
}

export function addOreCounts(left = DEFAULT_ORE_INVENTORY, right = DEFAULT_ORE_INVENTORY) {
  return ORE_TYPES.reduce((acc, ore) => {
    acc[ore.id] = (left?.[ore.id] ?? 0) + (right?.[ore.id] ?? 0);
    return acc;
  }, {});
}

export function hasQueuedOre(queue = DEFAULT_ORE_INVENTORY) {
  return ORE_TYPES.some(ore => (queue?.[ore.id] ?? 0) > 0);
}

export function addMineCounts(left = DEFAULT_MINE_CLAIM_QUEUE, right = DEFAULT_MINE_CLAIM_QUEUE) {
  return MINING_RESOURCE_TYPES.reduce((acc, resource) => {
    acc[resource.id] = (left?.[resource.id] ?? 0) + (right?.[resource.id] ?? 0);
    return acc;
  }, {});
}

export function hasQueuedMineResources(queue = DEFAULT_MINE_CLAIM_QUEUE) {
  return MINING_RESOURCE_TYPES.some(resource => (queue?.[resource.id] ?? 0) > 0);
}

export function splitMinedResources(queue = {}) {
  const ore = {};
  const gathered = {};
  Object.entries(queue).forEach(([id, count]) => {
    const amount = Math.max(0, Math.floor(Number(count) || 0));
    if (!amount) return;
    if (getMiningResourceSource(id) === 'gathered') gathered[id] = amount;
    else ore[id] = amount;
  });
  return { ore, gathered };
}

export function getMiningResourceSource(id) {
  return GEM_RESOURCES_BY_ID[id]
    || id === GEMDUST_RESOURCE.id
    || MINING_SPECIAL_RESOURCES.some(resource => resource.id === id)
    ? 'gathered'
    : 'ore';
}

export function createForgeCardSlot(slotId) {
  return {
    slotId,
    card: null,
  };
}

export function createForgeCardSlots(count = FORGE_SLOT_COUNT) {
  return Array.from({ length: count }, (_, index) => createForgeCardSlot(index + 1));
}

export function normalizeForgeCardSlots(savedSlots = [], count = FORGE_SLOT_COUNT) {
  return Array.from({ length: count }, (_, index) => {
    const slotId = index + 1;
    const savedSlot = savedSlots.find(slot => Number(slot?.slotId) === slotId);
    if (!savedSlot) return createForgeCardSlot(slotId);
    return {
      slotId,
      card: savedSlot.card ? { ...savedSlot.card } : null,
    };
  });
}

export function createForgeOreSlot(slotId) {
  return {
    slotId,
    oreType: null,
    source: null,
    count: 0,
  };
}

export function createForgeOreSlots(count = FORGE_SLOT_COUNT) {
  return Array.from({ length: count }, (_, index) => createForgeOreSlot(index + 1));
}

export function normalizeForgeOreSlots(savedSlots = [], count = FORGE_SLOT_COUNT) {
  return Array.from({ length: count }, (_, index) => {
    const slotId = index + 1;
    const savedSlot = savedSlots.find(slot => Number(slot?.slotId) === slotId);
    if (!savedSlot) return createForgeOreSlot(slotId);
    return {
      slotId,
      oreType: typeof savedSlot.oreType === 'string' ? savedSlot.oreType : null,
      source: typeof savedSlot.source === 'string'
        ? savedSlot.source
        : (GEM_RESOURCES_BY_ID[savedSlot.oreType] ? 'gathered' : (savedSlot.oreType ? 'ore' : null)),
      count: Math.max(0, Math.floor(Number(savedSlot.count) || 0)),
    };
  });
}

export function getSmeltOreRequired(rarity) {
  return ({ common: 4, uncommon: 3, rare: 2, epic: 2, legendary: 1, mythic: 1 }[rarity] ?? 3);
}

export function createForgeIngredientSlot(slotId) {
  return {
    slotId,
    ingotType: null,
    source: null,
    count: 0,
    boosterId: null,
    boosterCount: 0,
    boosterCharges: 0,
  };
}

export function createForgeIngredientSlots(count = FORGE_SLOT_COUNT) {
  return Array.from({ length: count }, (_, index) => createForgeIngredientSlot(index + 1));
}

export function normalizeForgeIngredientSlots(savedSlots = [], count = FORGE_SLOT_COUNT) {
  return Array.from({ length: count }, (_, index) => {
    const slotId = index + 1;
    const savedSlot = Array.isArray(savedSlots) ? savedSlots.find(slot => Number(slot?.slotId) === slotId) : null;
    if (!savedSlot) return createForgeIngredientSlot(slotId);
    const booster = FORGE_BOOSTERS[savedSlot.boosterId] ?? null;
    const boosterCount = booster ? Math.max(0, Math.floor(Number(savedSlot.boosterCount) || 0)) : 0;
    const savedCharges = Math.floor(Number(savedSlot.boosterCharges));
    return {
      slotId,
      ingotType: typeof savedSlot.ingotType === 'string' ? savedSlot.ingotType : null,
      source: typeof savedSlot.source === 'string' ? savedSlot.source : (savedSlot.ingotType ? 'ingot' : null),
      count: Math.max(0, Math.floor(Number(savedSlot.count) || 0)),
      boosterId: booster && boosterCount > 0 ? savedSlot.boosterId : null,
      boosterCount,
      // Saves written before partial charges existed represent a freshly loaded first unit.
      boosterCharges: booster && boosterCount > 0
        ? Math.max(1, Math.min(booster.cyclesPerUnit, Number.isFinite(savedCharges) ? savedCharges : booster.cyclesPerUnit))
        : 0,
    };
  });
}

export function getForgeBoosterSpeedPercent(slot) {
  if (!slot?.boosterCount || !slot?.boosterCharges) return 0;
  return FORGE_BOOSTERS[slot.boosterId]?.speedPercent ?? 0;
}

export function addForgeBooster(slot, boosterId, count) {
  const booster = FORGE_BOOSTERS[boosterId];
  const amount = Math.max(0, Math.floor(Number(count) || 0));
  if (!booster || !amount) return slot;
  if (slot?.boosterId && slot.boosterId !== boosterId && slot.boosterCount > 0) return slot;
  return {
    ...slot,
    boosterId,
    boosterCount: (slot?.boosterCount ?? 0) + amount,
    boosterCharges: slot?.boosterCount > 0 && slot.boosterId === boosterId
      ? (slot.boosterCharges || booster.cyclesPerUnit)
      : booster.cyclesPerUnit,
  };
}

export function consumeForgeBoosterCharge(slot) {
  const booster = FORGE_BOOSTERS[slot?.boosterId];
  if (!booster || !slot.boosterCount || !slot.boosterCharges) return slot;
  if (slot.boosterCharges > 1) return { ...slot, boosterCharges: slot.boosterCharges - 1 };
  if (slot.boosterCount > 1) {
    return { ...slot, boosterCount: slot.boosterCount - 1, boosterCharges: booster.cyclesPerUnit };
  }
  return { ...slot, boosterId: null, boosterCount: 0, boosterCharges: 0 };
}

export function createForgeFuelState() {
  return {
    loadedCoal: 0,
    fuelType: null,
    currentCoalCharges: 0,
    startedAt: null,
    endsAt: null,
    activeSlotId: null,
    sapphireReady: false,
  };
}

export function createForgeFuelSlots(count = FORGE_SLOT_COUNT) {
  return Array.from({ length: count }, (_, index) => ({
    slotId: index + 1,
    ...createForgeFuelState(),
  }));
}

/**
 * Normalize one row's fuel state.
 *
 * **`slotId` is carried through when the input has one**, and that is load-bearing rather than
 * tidiness. `startForgeCycle` and `consumeForgeFuelCharge` both rebuild their result from this
 * function and write it straight back into `forgeFuelSlots` — so if it dropped `slotId`, the first
 * smelt a row ever started would erase that row's identity. `normalizeForgeFuelSlots` matches saved
 * slots *by* `slotId`, so on the next load the slot matched nothing, came back empty, and the
 * player's loaded coal was silently destroyed while still sitting in the save file.
 *
 * The key is omitted entirely rather than set to `undefined` when absent, because callers compose
 * it as `{ slotId, ...normalizeForgeFuelState(saved) }` — an explicit `undefined` in the spread
 * would clobber the id they just supplied.
 */
export function normalizeForgeFuelState(savedState) {
  if (!savedState || typeof savedState !== 'object') return createForgeFuelState();
  const loadedCoal = Math.max(0, Math.floor(Number(savedState.loadedCoal) || 0));
  const fuelType = loadedCoal > 0 ? (savedState.fuelType === 'gemdust' ? 'gemdust' : 'coal') : null;
  const chargesPerUnit = getForgeFuelChargesPerUnit(fuelType);
  const currentCoalCharges = Math.max(
    0,
    Math.min(chargesPerUnit, Math.floor(Number(savedState.currentCoalCharges) || 0)),
  );
  const slotId = Number(savedState.slotId);
  return {
    ...(Number.isFinite(slotId) && slotId > 0 ? { slotId } : null),
    loadedCoal,
    fuelType,
    currentCoalCharges: loadedCoal > 0 ? (currentCoalCharges || chargesPerUnit) : 0,
    startedAt: typeof savedState.startedAt === 'number' ? savedState.startedAt : null,
    endsAt: typeof savedState.endsAt === 'number' ? savedState.endsAt : null,
    activeSlotId: typeof savedState.activeSlotId === 'number' ? savedState.activeSlotId : null,
    sapphireReady: savedState.sapphireReady === true,
  };
}

export function normalizeForgeFuelSlots(savedSlots = [], count = FORGE_SLOT_COUNT, legacyFuelState = null) {
  const normalizedFromSlots = Array.from({ length: count }, (_, index) => {
    const slotId = index + 1;
    // Match by id first. Falling back to POSITION recovers saves written while the bug above was
    // live: those rows are intact apart from a missing `slotId`, so an id-only lookup threw away
    // real coal. The array has always been dense and index-ordered (`createForgeFuelSlots` and
    // every updater map over it in place), so position is a sound identity when the id is gone.
    const byId = Array.isArray(savedSlots)
      ? savedSlots.find(slot => Number(slot?.slotId) === slotId)
      : null;
    const positional = !byId && Array.isArray(savedSlots) && savedSlots[index]
      && savedSlots[index].slotId == null
      ? savedSlots[index]
      : null;
    return {
      slotId,
      ...normalizeForgeFuelState(byId ?? positional),
    };
  });

  const hasSavedSlots = Array.isArray(savedSlots) && savedSlots.some(slot => slot && typeof slot === 'object');
  if (hasSavedSlots) return normalizedFromSlots;

  const legacy = normalizeForgeFuelState(legacyFuelState);
  if (!legacy.loadedCoal) return normalizedFromSlots;

  return normalizedFromSlots.map((slot, index) =>
    index === 0
      ? { slotId: slot.slotId, ...legacy, activeSlotId: slot.slotId }
      : slot
  );
}

export function getForgeFuelChargeFraction(fuelState) {
  if (!fuelState?.loadedCoal || !fuelState?.currentCoalCharges) return 0;
  return fuelState.currentCoalCharges / getForgeFuelChargesPerUnit(fuelState.fuelType);
}

export function addForgeFuel(fuelState, coalCount, fuelType = 'coal') {
  const amount = Math.max(0, Math.floor(Number(coalCount) || 0));
  if (!amount) return fuelState;
  const nextLoadedCoal = (fuelState?.loadedCoal ?? 0) + amount;
  const chargesPerUnit = getForgeFuelChargesPerUnit(fuelType);
  return {
    ...(fuelState ?? createForgeFuelState()),
    loadedCoal: nextLoadedCoal,
    fuelType,
    currentCoalCharges: fuelState?.loadedCoal ? (fuelState.currentCoalCharges || chargesPerUnit) : chargesPerUnit,
  };
}

export function consumeForgeFuelCharge(fuelState) {
  const state = normalizeForgeFuelState(fuelState);
  if (!state.loadedCoal || !state.currentCoalCharges) return state;

  if (state.currentCoalCharges > 1) {
    return { ...state, currentCoalCharges: state.currentCoalCharges - 1 };
  }

  if (state.loadedCoal > 1) {
    return {
      ...state,
      loadedCoal: state.loadedCoal - 1,
      currentCoalCharges: getForgeFuelChargesPerUnit(state.fuelType),
    };
  }

  return {
    ...state,
    loadedCoal: 0,
    fuelType: null,
    currentCoalCharges: 0,
  };
}

export function getReadyForgePairs(cardSlots = [], oreSlots = []) {
  return cardSlots.flatMap((cardSlot, index) => {
    const oreSlot = oreSlots[index];
    if (!cardSlot?.card || !oreSlot?.oreType) return [];
    const required = getSmeltOreRequired(cardSlot.card.rarity);
    if ((oreSlot.count ?? 0) < required) return [];
    return [{
      slotId: cardSlot.slotId,
      oreType: oreSlot.oreType,
      required,
      card: cardSlot.card,
    }];
  });
}

export function startForgeCycle(fuelState, activeSlotId, now = Date.now(), card = null, boosterPercent = 0) {
  const normalized = normalizeForgeFuelState(fuelState);
  if (!normalized.loadedCoal || !normalized.currentCoalCharges || !activeSlotId) {
    return { ...normalized, startedAt: null, endsAt: null, activeSlotId: null };
  }
  const durationSeconds = card ? getForgeCycleDurationSeconds(card, boosterPercent) : FORGE_CYCLE_DURATION_SECONDS;
  const cycle = {
    ...normalized,
    activeSlotId,
    startedAt: now,
    endsAt: now + (durationSeconds * 1000),
    sapphireReady: false,
  };
  return normalized.sapphireReady && card ? applySapphireMomentum(card, cycle, now) : cycle;
}
