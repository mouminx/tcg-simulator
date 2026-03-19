import { getCardAffixBonuses } from './cards';

export const ORE_TYPES = [
  { id: 'stone',   name: 'Stone',       ingotId: null,        ingot: null,             family: 'Mineral',   color: '#7a7a7a', glow: 'rgba(122,122,122,0.30)', description: 'Solid bedrock chipped from cave walls, the most fundamental of all building materials.' },
  { id: 'coal',    name: 'Coal',        ingotId: null,        ingot: null,             family: 'Mineral',   color: '#5a5d66', glow: 'rgba(90,93,102,0.30)',   description: 'Dense black mineral fuel that burns hot and long, the lifeblood of forges and furnaces.' },
  { id: 'iron',    name: 'Iron Ore',    ingotId: 'steel',     ingot: 'Steel Ingot',    family: 'Iron',      color: '#8b7355', glow: 'rgba(139,115,85,0.34)',  description: 'Common reddish ore found in abundance, smelted into the iron and steel used for everyday tools and armor.' },
  { id: 'silver',  name: 'Silver Ore',  ingotId: 'silver',    ingot: 'Silver Ingot',   family: 'Silver',    color: '#b4c0d0', glow: 'rgba(180,192,208,0.34)', description: 'Lustrous ore valued for its natural conductivity and purity, sought after for precision instruments and enchanting.' },
  { id: 'gold',    name: 'Gold Ore',    ingotId: 'gold',      ingot: 'Gold Ingot',     family: 'Gold',      color: '#d9ab2b', glow: 'rgba(217,171,43,0.34)',  description: 'Precious metallic ore prized for its resistance to tarnish and essential role in high-value alchemy and crafting.' },
  { id: 'platinum',name: 'Platinum Ore',ingotId: 'platinum',  ingot: 'Platinum Ingot', family: 'Platinum',  color: '#8fd0e2', glow: 'rgba(143,208,226,0.32)', description: 'Rare dense ore requiring intense heat to smelt, sought after for its use in masterwork alloys and enchanted equipment.' },
  { id: 'starlit', name: 'Starlit Ore', ingotId: 'starsteel', ingot: 'Starsteel Ingot',family: 'Starlit',   color: '#8d7cff', glow: 'rgba(141,124,255,0.34)', description: 'Ore veined with trapped starlight, found only in the deepest reaches of ancient mines and prized for arcane forging.' },
];

export const INGOT_RESOURCES = {
  steel:    { id: 'steel',    name: 'Steel Ingot',    artKey: 'steel',    family: 'Forged Steel',    color: '#5f7486', glow: 'rgba(95,116,134,0.34)',   description: 'Sturdy iron-based alloy refined in the forge, the backbone of weapons and structural crafting.' },
  silver:   { id: 'silver',   name: 'Silver Ingot',   artKey: 'silver',   family: 'Refined Silver',  color: '#c9d5e4', glow: 'rgba(201,213,228,0.34)',  description: 'Refined silver bar prized for its purity and use in precision instruments and enchantment work.' },
  gold:     { id: 'gold',     name: 'Gold Ingot',     artKey: 'gold',     family: 'Refined Gold',    color: '#efbe3d', glow: 'rgba(239,190,61,0.34)',   description: 'Purified gold bar essential for high-value alchemy, fine jewelry, and premium equipment crafting.' },
  platinum: { id: 'platinum', name: 'Platinum Ingot', artKey: 'platinum', family: 'Refined Platinum',color: '#9fd9e9', glow: 'rgba(159,217,233,0.32)',  description: 'Dense, heat-resistant bar smelted from rare platinum ore, used in masterwork and high-grade alloys.' },
  starsteel:{ id: 'starsteel',name: 'Starsteel Ingot',artKey: 'starsteel',family: 'Celestial Alloy', color: '#a68cff', glow: 'rgba(166,140,255,0.34)',  description: 'Celestial alloy forged from starlit ore, radiating faint arcane energy suited for legendary-tier crafting.' },
};

export const ORE_TO_INGOT = Object.freeze(
  Object.fromEntries(ORE_TYPES.map(ore => [ore.id, ore.ingotId])),
);

// Recipe per ore type: oreCount = ore needed, ingredient = required ingot ingredient (or null)
export const SMELT_RECIPES = Object.freeze({
  iron:     { oreCount: 4,  ingredient: null },
  silver:   { oreCount: 4,  ingredient: { type: 'steel',    count: 1 } },
  gold:     { oreCount: 6,  ingredient: { type: 'silver',   count: 1 } },
  platinum: { oreCount: 8,  ingredient: { type: 'gold',     count: 1 } },
  starlit:  { oreCount: 10, ingredient: { type: 'platinum', count: 1 } },
});

export const DEFAULT_ORE_INVENTORY = Object.freeze(
  Object.fromEntries(ORE_TYPES.map(ore => [ore.id, 0])),
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
export const FORGE_SMELTS_PER_MINUTE = 3;
export const FORGE_CYCLE_DURATION_SECONDS = Math.round(60 / FORGE_SMELTS_PER_MINUTE);

export const BASE_MINING_DURATION_SECONDS = 60;
export const BASE_GOLD_PER_PRODUCTION = 0.5;

// Ore drop weights by rarity. Each rarity unlocks the next tier of ore;
// the relative distribution of accessible ores stays proportionally flat.
// Only the affix VALUE RANGES on cards change with rarity — not what drops.
// Hard caps: common=stone/coal/iron only; uncommon+=silver; rare+=gold;
//            epic+=platinum; legendary/mythic+=starlit.
export const ORE_WEIGHTS_BY_RARITY = {
  common:    { stone: 50, coal: 33, iron: 17, silver:  0, gold: 0, platinum: 0, starlit: 0 },
  uncommon:  { stone: 46, coal: 30, iron: 16, silver:  8, gold: 0, platinum: 0, starlit: 0 },
  rare:      { stone: 43, coal: 28, iron: 15, silver:  8, gold: 6, platinum: 0, starlit: 0 },
  epic:      { stone: 40, coal: 26, iron: 14, silver:  8, gold: 6, platinum: 6, starlit: 0 },
  legendary: { stone: 37, coal: 25, iron: 12, silver:  8, gold: 6, platinum: 6, starlit: 6 },
  mythic:    { stone: 37, coal: 25, iron: 12, silver:  8, gold: 6, platinum: 6, starlit: 6 },
};

// Tier no longer skews ore distribution — tier affects affix value ranges only.
export const ORE_WEIGHT_TIER_ADJUSTMENTS = {
  1: { stone: 0, coal: 0, iron: 0, silver: 0, gold: 0, platinum: 0, starlit: 0 },
  2: { stone: 0, coal: 0, iron: 0, silver: 0, gold: 0, platinum: 0, starlit: 0 },
  3: { stone: 0, coal: 0, iron: 0, silver: 0, gold: 0, platinum: 0, starlit: 0 },
  4: { stone: 0, coal: 0, iron: 0, silver: 0, gold: 0, platinum: 0, starlit: 0 },
  5: { stone: 0, coal: 0, iron: 0, silver: 0, gold: 0, platinum: 0, starlit: 0 },
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
      startedAt: typeof savedSlot.startedAt === 'number' ? savedSlot.startedAt : null,
      endsAt: typeof savedSlot.endsAt === 'number' ? savedSlot.endsAt : null,
      oreType: typeof savedSlot.oreType === 'string' ? savedSlot.oreType : null,
    };
  });
}

export function getMiningAffixBonusPercent(card) {
  return getCardAffixBonuses(card).miningSpeed ?? 0;
}

export function getSmeltingAffixBonusPercent(card) {
  return getCardAffixBonuses(card).smeltingSpeed ?? 0;
}

export function getForgeCycleDurationSeconds(card) {
  const bonusPercent = getSmeltingAffixBonusPercent(card);
  const accelerated = FORGE_CYCLE_DURATION_SECONDS / (1 + bonusPercent / 100);
  return Math.max(3, Math.round(accelerated));
}

export function getMiningDurationSeconds(card) {
  const bonusPercent = getMiningAffixBonusPercent(card);
  const acceleratedSeconds = BASE_MINING_DURATION_SECONDS / (1 + bonusPercent / 100);
  return Math.max(5, Math.round(acceleratedSeconds));
}

export function resolveOreWeightsForCard(card) {
  const rarityWeights = ORE_WEIGHTS_BY_RARITY[card?.rarity] ?? ORE_WEIGHTS_BY_RARITY.common;
  const tierAdjustments = ORE_WEIGHT_TIER_ADJUSTMENTS[card?.tier] ?? ORE_WEIGHT_TIER_ADJUSTMENTS[1];
  return ORE_TYPES.reduce((acc, ore) => {
    acc[ore.id] = Math.max(0, (rarityWeights[ore.id] ?? 0) + (tierAdjustments[ore.id] ?? 0));
    return acc;
  }, {});
}

export function rollOreTypeForCard(card) {
  const weights = resolveOreWeightsForCard(card);
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return 'iron';

  let roll = Math.random() * total;
  for (const ore of ORE_TYPES) {
    roll -= weights[ore.id] ?? 0;
    if (roll <= 0) return ore.id;
  }
  return 'iron';
}

export function startMiningSlot(slot, now = Date.now()) {
  if (!slot?.card || slot.startedAt || slot.endsAt) return slot;
  const durationSeconds = getMiningDurationSeconds(slot.card);
  const durationMs = durationSeconds * 1000;
  return {
    ...slot,
    startedAt: now,
    endsAt: now + durationMs,
    oreType: rollOreTypeForCard(slot.card),
  };
}

export function startMiningSlots(slots = [], now = Date.now()) {
  return slots.map(slot => startMiningSlot(slot, now));
}

export function resolveCompletedMiningSlots(slots = [], now = Date.now()) {
  const completedQueue = { ...DEFAULT_ORE_INVENTORY };
  let completedCount = 0;
  let goldEarned = 0;

  const nextSlots = slots.map(slot => {
    if (!slot?.card || !slot.endsAt || slot.endsAt > now || !slot.oreType) return slot;
    completedQueue[slot.oreType] += 1;
    completedCount += 1;
    const coinBonus = getCardAffixBonuses(slot.card).coinGeneration ?? 0;
    goldEarned += BASE_GOLD_PER_PRODUCTION * (1 + coinBonus / 100);
    return startMiningSlot({
      ...slot,
      startedAt: null,
      endsAt: null,
      oreType: null,
    }, now);
  });

  return { nextSlots, completedQueue, completedCount, goldEarned };
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
      count: Math.max(0, Math.floor(Number(savedSlot.count) || 0)),
    };
  });
}

export function getSmeltOreRequired(rarity) {
  return ({ common: 4, uncommon: 3, rare: 2, epic: 2, legendary: 1, mythic: 1 }[rarity] ?? 3);
}

export function createForgeIngredientSlot(slotId) {
  return { slotId, ingotType: null, count: 0 };
}

export function createForgeIngredientSlots(count = FORGE_SLOT_COUNT) {
  return Array.from({ length: count }, (_, index) => createForgeIngredientSlot(index + 1));
}

export function normalizeForgeIngredientSlots(savedSlots = [], count = FORGE_SLOT_COUNT) {
  return Array.from({ length: count }, (_, index) => {
    const slotId = index + 1;
    const savedSlot = Array.isArray(savedSlots) ? savedSlots.find(slot => Number(slot?.slotId) === slotId) : null;
    if (!savedSlot) return createForgeIngredientSlot(slotId);
    return {
      slotId,
      ingotType: typeof savedSlot.ingotType === 'string' ? savedSlot.ingotType : null,
      count: Math.max(0, Math.floor(Number(savedSlot.count) || 0)),
    };
  });
}

export function createForgeFuelState() {
  return {
    loadedCoal: 0,
    currentCoalCharges: 0,
    startedAt: null,
    endsAt: null,
    activeSlotId: null,
  };
}

export function createForgeFuelSlots(count = FORGE_SLOT_COUNT) {
  return Array.from({ length: count }, (_, index) => ({
    slotId: index + 1,
    ...createForgeFuelState(),
  }));
}

export function normalizeForgeFuelState(savedState) {
  if (!savedState || typeof savedState !== 'object') return createForgeFuelState();
  const loadedCoal = Math.max(0, Math.floor(Number(savedState.loadedCoal) || 0));
  const currentCoalCharges = Math.max(
    0,
    Math.min(FORGE_SMELTS_PER_COAL, Math.floor(Number(savedState.currentCoalCharges) || 0)),
  );
  return {
    loadedCoal,
    currentCoalCharges: loadedCoal > 0 ? (currentCoalCharges || FORGE_SMELTS_PER_COAL) : 0,
    startedAt: typeof savedState.startedAt === 'number' ? savedState.startedAt : null,
    endsAt: typeof savedState.endsAt === 'number' ? savedState.endsAt : null,
    activeSlotId: typeof savedState.activeSlotId === 'number' ? savedState.activeSlotId : null,
  };
}

export function normalizeForgeFuelSlots(savedSlots = [], count = FORGE_SLOT_COUNT, legacyFuelState = null) {
  const normalizedFromSlots = Array.from({ length: count }, (_, index) => {
    const slotId = index + 1;
    const savedSlot = Array.isArray(savedSlots)
      ? savedSlots.find(slot => Number(slot?.slotId) === slotId)
      : null;
    return {
      slotId,
      ...normalizeForgeFuelState(savedSlot),
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
  return fuelState.currentCoalCharges / FORGE_SMELTS_PER_COAL;
}

export function addForgeFuel(fuelState, coalCount) {
  const amount = Math.max(0, Math.floor(Number(coalCount) || 0));
  if (!amount) return fuelState;
  const nextLoadedCoal = (fuelState?.loadedCoal ?? 0) + amount;
  return {
    ...(fuelState ?? createForgeFuelState()),
    loadedCoal: nextLoadedCoal,
    currentCoalCharges: fuelState?.loadedCoal ? (fuelState.currentCoalCharges || FORGE_SMELTS_PER_COAL) : FORGE_SMELTS_PER_COAL,
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
      currentCoalCharges: FORGE_SMELTS_PER_COAL,
    };
  }

  return {
    ...state,
    loadedCoal: 0,
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

export function startForgeCycle(fuelState, activeSlotId, now = Date.now(), card = null) {
  const normalized = normalizeForgeFuelState(fuelState);
  if (!normalized.loadedCoal || !normalized.currentCoalCharges || !activeSlotId) {
    return { ...normalized, startedAt: null, endsAt: null, activeSlotId: null };
  }
  const durationSeconds = card ? getForgeCycleDurationSeconds(card) : FORGE_CYCLE_DURATION_SECONDS;
  return {
    ...normalized,
    activeSlotId,
    startedAt: now,
    endsAt: now + (durationSeconds * 1000),
  };
}
