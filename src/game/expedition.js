import { getElementResourceId } from './arcana';
import { ORE_TYPES, INGOT_RESOURCES } from './foundry';
import { ALL_GATHERING_RESOURCES, PROCESSED_RESOURCES } from './wilderness';

export const EXPEDITION_STATES = Object.freeze({
  IDLE: 'idle',
  SETUP: 'setup',
  IN_PROGRESS: 'inProgress',
  REVEAL: 'reveal',
  COLLECT: 'collect',
});

export const EXPEDITION_DIFFICULTIES = Object.freeze([
  {
    id: 'trail',
    label: 'Trail I',
    title: 'Trail Run',
    difficulty: 85,
    durationSeconds: 90,
    rewardTier: 1,
    danger: 12,
    rewardScale: 1,
  },
  {
    id: 'frontier',
    label: 'Frontier II',
    title: 'Frontier Run',
    difficulty: 125,
    durationSeconds: 150,
    rewardTier: 2,
    danger: 18,
    rewardScale: 1.2,
  },
  {
    id: 'wilds',
    label: 'Wilds III',
    title: 'Wilds Run',
    difficulty: 170,
    durationSeconds: 210,
    rewardTier: 3,
    danger: 24,
    rewardScale: 1.5,
  },
  {
    id: 'ruin',
    label: 'Ruin IV',
    title: 'Ruin Delve',
    difficulty: 220,
    durationSeconds: 285,
    rewardTier: 4,
    danger: 31,
    rewardScale: 1.9,
  },
  {
    id: 'mythic',
    label: 'Mythic V',
    title: 'Mythic March',
    difficulty: 285,
    durationSeconds: 360,
    rewardTier: 5,
    danger: 39,
    rewardScale: 2.4,
  },
]);

export const EXPEDITION_DIFFICULTIES_BY_ID = Object.freeze(
  Object.fromEntries(EXPEDITION_DIFFICULTIES.map(entry => [entry.id, entry])),
);

export const EXPEDITION_SLOT_LIMITS = Object.freeze({
  unit: {
    initial: 2,
    max: 5,
    costs: Object.freeze({ 2: 35, 3: 90, 4: 175, 5: 310 }),
  },
  supply: {
    initial: 1,
    max: 5,
    costs: Object.freeze({ 1: 25, 2: 75, 3: 155, 4: 260 }),
  },
  arcana: {
    initial: 1,
    max: 5,
    costs: Object.freeze({ 1: 60, 2: 140, 3: 240, 4: 360 }),
  },
});

export const EXPEDITION_CLASS_ICONS = Object.freeze({
  miner: '⛏',
  blacksmith: '⚒',
  lumberjack: '🪓',
  hunter: '🏹',
  merchant: '✦',
  warrior: '⚔',
  mage: '✧',
  bard: '♫',
  forager: '❀',
});

const RARITY_POWER = Object.freeze({
  common: 14,
  uncommon: 22,
  rare: 34,
  epic: 48,
  legendary: 66,
  mythic: 86,
});

const RESOURCE_DEFINITIONS = Object.freeze({
  ore: Object.fromEntries(ORE_TYPES.map(entry => [entry.id, entry])),
  ingot: INGOT_RESOURCES,
  gathered: Object.fromEntries(ALL_GATHERING_RESOURCES.map(entry => [entry.id, entry])),
  processed: Object.fromEntries(PROCESSED_RESOURCES.map(entry => [entry.id, entry])),
});

const EXPEDITION_REWARD_POOLS = Object.freeze({
  miner: [
    { source: 'ore', id: 'iron', min: 2, max: 5, weight: 36, rarityMultiplier: 0.05 },
    { source: 'ore', id: 'silver', min: 1, max: 3, weight: 24, rarityMultiplier: 0.18 },
    { source: 'ore', id: 'gold', min: 1, max: 2, weight: 14, rarityMultiplier: 0.34 },
    { source: 'ore', id: 'platinum', min: 1, max: 2, weight: 8, rarityMultiplier: 0.54 },
    { source: 'ore', id: 'starlit', min: 1, max: 1, weight: 4, rarityMultiplier: 0.82 },
  ],
  blacksmith: [
    { source: 'ingot', id: 'steel', min: 1, max: 3, weight: 32, rarityMultiplier: 0.06 },
    { source: 'ingot', id: 'silver', min: 1, max: 2, weight: 18, rarityMultiplier: 0.22 },
    { source: 'ingot', id: 'gold', min: 1, max: 2, weight: 14, rarityMultiplier: 0.4 },
    { source: 'ingot', id: 'platinum', min: 1, max: 1, weight: 7, rarityMultiplier: 0.62 },
    { source: 'ingot', id: 'starsteel', min: 1, max: 1, weight: 3, rarityMultiplier: 0.9 },
  ],
  lumberjack: [
    { source: 'gathered', id: 'wood', min: 2, max: 5, weight: 28, rarityMultiplier: 0.06 },
    { source: 'gathered', id: 'hardwood', min: 1, max: 3, weight: 18, rarityMultiplier: 0.24 },
    { source: 'gathered', id: 'resin', min: 1, max: 3, weight: 16, rarityMultiplier: 0.34 },
    { source: 'processed', id: 'timber', min: 1, max: 2, weight: 10, rarityMultiplier: 0.48 },
  ],
  hunter: [
    { source: 'gathered', id: 'hide', min: 2, max: 4, weight: 30, rarityMultiplier: 0.06 },
    { source: 'gathered', id: 'fine fur', min: 1, max: 3, weight: 16, rarityMultiplier: 0.26 },
    { source: 'gathered', id: 'fierce fang', min: 1, max: 2, weight: 14, rarityMultiplier: 0.42 },
    { source: 'processed', id: 'leather', min: 1, max: 2, weight: 10, rarityMultiplier: 0.52 },
  ],
  forager: [
    { source: 'gathered', id: 'fiber', min: 2, max: 5, weight: 28, rarityMultiplier: 0.06 },
    { source: 'gathered', id: 'hyssop', min: 1, max: 3, weight: 18, rarityMultiplier: 0.24 },
    { source: 'gathered', id: 'mushrooms', min: 1, max: 2, weight: 14, rarityMultiplier: 0.42 },
    { source: 'processed', id: 'alkahest', min: 1, max: 1, weight: 8, rarityMultiplier: 0.66 },
  ],
  mage: [
    { source: 'arcana', id: getElementResourceId('ascending', 'mote'), min: 1, max: 2, weight: 12, rarityMultiplier: 0.5 },
    { source: 'arcana', id: getElementResourceId('gleaming', 'mote'), min: 1, max: 2, weight: 12, rarityMultiplier: 0.5 },
    { source: 'arcana', id: getElementResourceId('hollowing', 'mote'), min: 1, max: 2, weight: 12, rarityMultiplier: 0.5 },
    { source: 'coins', id: 'coins', min: 18, max: 55, weight: 14, rarityMultiplier: 0.18 },
  ],
  merchant: [
    { source: 'coins', id: 'coins', min: 30, max: 80, weight: 40, rarityMultiplier: 0.1 },
    { source: 'processed', id: 'cloth', min: 1, max: 3, weight: 8, rarityMultiplier: 0.4 },
    { source: 'processed', id: 'sealant', min: 1, max: 2, weight: 6, rarityMultiplier: 0.55 },
  ],
  warrior: [
    { source: 'ore', id: 'iron', min: 1, max: 3, weight: 16, rarityMultiplier: 0.08 },
    { source: 'gathered', id: 'stone', min: 2, max: 4, weight: 16, rarityMultiplier: 0.12 },
    { source: 'coins', id: 'coins', min: 12, max: 36, weight: 18, rarityMultiplier: 0.16 },
    { source: 'ingot', id: 'steel', min: 1, max: 1, weight: 8, rarityMultiplier: 0.44 },
  ],
  bard: [
    { source: 'coins', id: 'coins', min: 22, max: 65, weight: 28, rarityMultiplier: 0.14 },
    { source: 'arcana', id: getElementResourceId('blooming', 'mote'), min: 1, max: 2, weight: 9, rarityMultiplier: 0.5 },
    { source: 'arcana', id: getElementResourceId('jolting', 'mote'), min: 1, max: 2, weight: 9, rarityMultiplier: 0.5 },
    { source: 'processed', id: 'cloth', min: 1, max: 2, weight: 8, rarityMultiplier: 0.42 },
  ],
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scaleStat(stat, difficulty) {
  const safeStat = Math.max(0, Number(stat) || 0);
  const safeDifficulty = Math.max(0, Number(difficulty) || 0);
  if (safeStat <= 0 && safeDifficulty <= 0) return 0;
  return safeStat / (safeStat + safeDifficulty);
}

function rollInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedPick(entries, luck = 0) {
  const normalizedLuck = Math.max(0, Number(luck) || 0);
  const weightedEntries = entries.map(entry => ({
    ...entry,
    adjustedWeight: (entry.weight ?? 0) * (1 + normalizedLuck * (entry.rarityMultiplier ?? 0)),
  }));
  const total = weightedEntries.reduce((sum, entry) => sum + (entry.adjustedWeight ?? 0), 0);
  if (total <= 0) return entries[0] ?? null;
  let roll = Math.random() * total;
  for (const entry of weightedEntries) {
    roll -= entry.adjustedWeight ?? 0;
    if (roll <= 0) return entry;
  }
  return weightedEntries[weightedEntries.length - 1] ?? null;
}

function sumAffixStats(card, keys) {
  if (!card?.affixes?.length) return 0;
  return card.affixes.reduce((sum, affix) => sum + (keys.includes(affix.stat) ? (affix.value ?? 0) : 0), 0);
}

function getSupplySupportStats(slot) {
  if (!slot?.id || !(slot.count > 0)) return { power: 0, survival: 0, utility: 0 };
  const count = slot.count ?? 0;
  if (slot.source === 'processed') {
    return {
      power: 4 + count * 2,
      survival: 10 + count * 5,
      utility: 6 + count * 3,
    };
  }
  if (slot.source === 'gathered') {
    return {
      power: 2 + count,
      survival: 8 + count * 4,
      utility: 4 + count * 2,
    };
  }
  return { power: 0, survival: 0, utility: 0 };
}

function getArcanaSupportStats(slot) {
  if (!slot?.itemId) return { power: 0, survival: 0, utility: 0 };
  if (slot.category === 'catalyst') return { power: 18, survival: 4, utility: 8 };
  if (slot.category === 'sigil') return { power: 4, survival: 12, utility: 10 };
  if (slot.category === 'charm') return { power: 8, survival: 4, utility: 14 };
  return { power: 0, survival: 0, utility: 0 };
}

export function createExpeditionUnitSlots(capacity = EXPEDITION_SLOT_LIMITS.unit.initial) {
  return Array.from({ length: capacity }, (_, index) => ({
    slotId: `unit-${index + 1}`,
    card: null,
  }));
}

export function createExpeditionSupplySlots(capacity = EXPEDITION_SLOT_LIMITS.supply.initial) {
  return Array.from({ length: capacity }, (_, index) => ({
    slotId: `supply-${index + 1}`,
    source: null,
    id: null,
    name: '',
    description: '',
    artKey: null,
    count: 0,
  }));
}

export function createExpeditionArcanaSlots(capacity = EXPEDITION_SLOT_LIMITS.arcana.initial) {
  return Array.from({ length: capacity }, (_, index) => ({
    slotId: `arcana-${index + 1}`,
    inventoryEntryId: null,
    itemId: null,
    name: '',
    category: '',
    description: '',
    effect: null,
    artKey: null,
  }));
}

export function normalizeExpeditionUnitSlots(slots, capacity = EXPEDITION_SLOT_LIMITS.unit.initial) {
  const next = createExpeditionUnitSlots(capacity);
  (Array.isArray(slots) ? slots : []).slice(0, capacity).forEach((slot, index) => {
    next[index] = { ...next[index], ...slot, slotId: next[index].slotId };
  });
  return next;
}

export function normalizeExpeditionSupplySlots(slots, capacity = EXPEDITION_SLOT_LIMITS.supply.initial) {
  const next = createExpeditionSupplySlots(capacity);
  (Array.isArray(slots) ? slots : []).slice(0, capacity).forEach((slot, index) => {
    next[index] = { ...next[index], ...slot, slotId: next[index].slotId };
  });
  return next;
}

export function normalizeExpeditionArcanaSlots(slots, capacity = EXPEDITION_SLOT_LIMITS.arcana.initial) {
  const next = createExpeditionArcanaSlots(capacity);
  (Array.isArray(slots) ? slots : []).slice(0, capacity).forEach((slot, index) => {
    next[index] = { ...next[index], ...slot, slotId: next[index].slotId };
  });
  return next;
}

export function getExpeditionUpgradeCost(type, capacity) {
  return EXPEDITION_SLOT_LIMITS[type]?.costs?.[capacity] ?? null;
}

export function getExpeditionClassIcon(classType) {
  return EXPEDITION_CLASS_ICONS[classType] ?? '✦';
}

export function getCardExpeditionPower(card) {
  if (!card) return 0;
  const rarityPower = RARITY_POWER[card.rarity] ?? RARITY_POWER.common;
  const tierPower = (card.tier ?? 1) * 10;
  const efficiency = sumAffixStats(card, [
    'miningSpeed',
    'smeltingSpeed',
    'gatheringSpeed',
    'huntingSpeed',
    'tradeEfficiency',
    'combatEfficiency',
    'arcaneEfficiency',
    'inspirationEfficiency',
    'productionSpeed',
  ]);
  const luck = sumAffixStats(card, [
    'miningLuck',
    'smeltingLuck',
    'loggingLuck',
    'huntingLuck',
    'foragingLuck',
    'tradeLuck',
    'combatLuck',
    'arcaneLuck',
    'inspirationLuck',
    'coinGeneration',
    'treasureSense',
  ]);
  const attunement = sumAffixStats(card, [
    'miningAttunement',
    'smeltingAttunement',
    'loggingAttunement',
    'huntingAttunement',
    'foragingAttunement',
    'tradeAttunement',
    'combatAttunement',
    'arcaneAttunement',
    'inspirationAttunement',
    'emberAttunement',
    'stormAttunement',
    'tideAttunement',
    'bloomAttunement',
    'galeAttunement',
    'voidAttunement',
    'radianceAttunement',
    'celestialAttunement',
    'stoneAttunement',
  ]);
  return rarityPower + tierPower + efficiency * 0.65 + luck * 0.35 + attunement * 0.3;
}

function getCardExpeditionMetrics(card) {
  if (!card) {
    return { power: 0, survival: 0, utility: 0, luck: 0 };
  }
  const rarityPower = RARITY_POWER[card.rarity] ?? RARITY_POWER.common;
  const tierValue = (card.tier ?? 1) * 9;
  const efficiency = sumAffixStats(card, [
    'miningSpeed',
    'smeltingSpeed',
    'gatheringSpeed',
    'huntingSpeed',
    'tradeEfficiency',
    'combatEfficiency',
    'arcaneEfficiency',
    'inspirationEfficiency',
    'productionSpeed',
  ]);
  const luck = sumAffixStats(card, [
    'miningLuck',
    'smeltingLuck',
    'loggingLuck',
    'huntingLuck',
    'foragingLuck',
    'tradeLuck',
    'combatLuck',
    'arcaneLuck',
    'inspirationLuck',
    'coinGeneration',
    'treasureSense',
    'craftsmanship',
    'overflow',
    'prosperity',
  ]);
  const attunement = sumAffixStats(card, [
    'miningAttunement',
    'smeltingAttunement',
    'loggingAttunement',
    'huntingAttunement',
    'foragingAttunement',
    'tradeAttunement',
    'combatAttunement',
    'arcaneAttunement',
    'inspirationAttunement',
    'emberAttunement',
    'stormAttunement',
    'tideAttunement',
    'bloomAttunement',
    'galeAttunement',
    'voidAttunement',
    'radianceAttunement',
    'celestialAttunement',
    'stoneAttunement',
  ]);
  return {
    power: Math.round(rarityPower + tierValue + efficiency * 0.75 + attunement * 0.22),
    survival: Math.round(rarityPower * 0.72 + tierValue * 0.85 + attunement * 0.58 + luck * 0.22 + efficiency * 0.18),
    utility: Math.round(rarityPower * 0.45 + tierValue * 0.52 + luck * 0.72 + attunement * 0.24 + efficiency * 0.12),
    luck: Math.max(0, luck / 100),
  };
}

export function calculateExpeditionStats({ difficultyId, unitSlots, supplySlots, arcanaSlots }) {
  const difficulty = EXPEDITION_DIFFICULTIES_BY_ID[difficultyId] ?? EXPEDITION_DIFFICULTIES[0];
  const filledUnits = unitSlots.filter(slot => slot.card);
  const partyTotals = {
    power: 0,
    survival: 0,
    utility: 0,
    luck: 0,
  };

  const unitResults = unitSlots.map(slot => {
    if (!slot.card) {
      return { slotId: slot.slotId, card: null, survivalChance: 0, power: 0, survival: 0, utility: 0, luck: 0 };
    }
    const metrics = getCardExpeditionMetrics(slot.card);
    partyTotals.power += metrics.power;
    partyTotals.survival += metrics.survival;
    partyTotals.utility += metrics.utility;
    partyTotals.luck += metrics.luck;
    return {
      slotId: slot.slotId,
      card: slot.card,
      power: metrics.power,
      survival: metrics.survival,
      utility: metrics.utility,
      luck: metrics.luck,
      survivalChance: Math.round(scaleStat(metrics.survival, difficulty.danger) * 100),
    };
  });

  supplySlots.forEach(slot => {
    const stats = getSupplySupportStats(slot);
    partyTotals.power += stats.power;
    partyTotals.survival += stats.survival;
    partyTotals.utility += stats.utility;
  });

  arcanaSlots.forEach(slot => {
    const stats = getArcanaSupportStats(slot);
    partyTotals.power += stats.power;
    partyTotals.survival += stats.survival;
    partyTotals.utility += stats.utility;
  });

  partyTotals.power = Math.round(partyTotals.power);
  partyTotals.survival = Math.round(partyTotals.survival);
  partyTotals.utility = Math.round(partyTotals.utility);

  const successChance = scaleStat(partyTotals.power, difficulty.difficulty);
  const bonusRewardChance = scaleStat(partyTotals.utility, difficulty.rewardTier * 100);
  const averageUnitSurvival = filledUnits.length > 0
    ? unitResults.filter(entry => entry.card).reduce((sum, entry) => sum + entry.survivalChance, 0) / filledUnits.length
    : 0;

  const ratio = successChance;
  const expeditionPower =
    ratio < 0.4 ? 'Low' :
    ratio < 0.72 ? 'Medium' :
    'High';
  const riskLevel =
    averageUnitSurvival >= 74 ? 'Safe' :
    averageUnitSurvival >= 45 ? 'Risky' :
    'Deadly';
  const rewardPotential =
    bonusRewardChance >= 0.42 ? 'Exceptional' :
    bonusRewardChance >= 0.2 ? 'High' :
    'Low';

  return {
    difficulty,
    party: partyTotals,
    totalPower: partyTotals.power,
    supportBonus: Math.round((partyTotals.utility + partyTotals.survival) * 0.1),
    successChance: Math.round(successChance * 100),
    bonusRewardChance: Math.round(bonusRewardChance * 100),
    expeditionPower,
    riskLevel,
    rewardPotential,
    unitResults,
  };
}

function resolveRewardDefinition(source, id) {
  if (source === 'coins') {
    return {
      name: id === 'coins' ? 'Coins' : id,
      description: 'Gold earned during expedition travel.',
      artKey: id,
    };
  }
  const entry = RESOURCE_DEFINITIONS[source]?.[id];
  return {
    name: entry?.name ?? id,
    description: entry?.description ?? '',
    artKey: entry?.artKey ?? id,
  };
}

function rollRewardBundle(card, difficulty, scaleMultiplier = 1, luck = 0, rewardCount = null) {
  const pool = EXPEDITION_REWARD_POOLS[card.classType] ?? EXPEDITION_REWARD_POOLS.warrior;
  const pickCount = rewardCount ?? clamp(1 + Math.floor((card.tier ?? 1) / 2), 1, 3);
  const results = [];

  for (let index = 0; index < pickCount; index += 1) {
    const reward = weightedPick(pool, luck);
    if (!reward) continue;
    const amount = Math.max(
      1,
      Math.round(rollInt(reward.min, reward.max) * scaleMultiplier * difficulty.rewardScale),
    );
    const meta = resolveRewardDefinition(reward.source, reward.id);
    results.push({
      source: reward.source,
      id: reward.id,
      amount,
      ...meta,
    });
  }

  return results;
}

function mergeRewardEntries(entries) {
  const merged = new Map();
  entries.forEach(entry => {
    const key = `${entry.source}:${entry.id}`;
    const current = merged.get(key);
    if (current) {
      current.amount += entry.amount;
    } else {
      merged.set(key, { ...entry });
    }
  });
  return [...merged.values()];
}

export function startExpeditionRun({ difficultyId, unitSlots, supplySlots, arcanaSlots, now = Date.now() }) {
  const stats = calculateExpeditionStats({ difficultyId, unitSlots, supplySlots, arcanaSlots });
  return {
    state: EXPEDITION_STATES.IN_PROGRESS,
    difficultyId,
    startedAt: now,
    endsAt: now + stats.difficulty.durationSeconds * 1000,
    stats,
    unitSlots: unitSlots.map(slot => ({ ...slot, card: slot.card ? { ...slot.card } : null })),
    supplySlots: supplySlots.map(slot => ({ ...slot })),
    arcanaSlots: arcanaSlots.map(slot => ({ ...slot })),
    revealIndex: 0,
    unitResults: [],
    rewardEntries: [],
  };
}

export function resolveExpeditionRun(run) {
  if (!run) return null;
  const difficulty = EXPEDITION_DIFFICULTIES_BY_ID[run.difficultyId] ?? EXPEDITION_DIFFICULTIES[0];
  const stats = run.stats ?? calculateExpeditionStats(run);
  const results = [];
  const rewardEntries = [];
  const expeditionSuccess = Math.random() <= scaleStat(stats.party?.power ?? 0, difficulty.difficulty);
  const deathAllowed = difficulty.rewardTier >= 3;
  const bonusChance = scaleStat(stats.party?.utility ?? 0, difficulty.rewardTier * 100);

  stats.unitResults.forEach(unit => {
    if (!unit.card) return;
    const survivalChance = scaleStat(unit.survival ?? 0, difficulty.danger);
    const survivalRoll = Math.random();
    let outcome = 'survived';
    let status = 'alive';
    if (survivalRoll > survivalChance) {
      if (survivalRoll <= survivalChance + 0.25 || !deathAllowed) {
        outcome = 'injured';
        status = 'injured';
      } else {
        outcome = 'dead';
        status = 'dead';
      }
    }
    const baseRewards = !expeditionSuccess || outcome === 'dead'
      ? []
      : rollRewardBundle(unit.card, difficulty, 1, unit.luck ?? 0);
    const bonusRewards = !expeditionSuccess || outcome === 'dead'
      ? []
      : mergeRewardEntries(
          baseRewards.filter(() => Math.random() <= bonusChance).flatMap(entry => {
            const bonusRolls = rollRewardBundle(unit.card, difficulty, 0.55, unit.luck ?? 0, 1);
            return bonusRolls.map(bonus => ({
              ...bonus,
              source: bonus.source,
              id: bonus.id,
            }));
          })
        );
    const unitResult = {
      slotId: unit.slotId,
      card: { ...unit.card },
      survivalChance: Math.round(survivalChance * 100),
      success: expeditionSuccess,
      status,
      outcome,
      rewards: mergeRewardEntries(baseRewards),
      bonusRewards,
    };
    results.push(unitResult);
    rewardEntries.push(...unitResult.rewards, ...unitResult.bonusRewards);
  });

  return {
    ...run,
    state: EXPEDITION_STATES.REVEAL,
    resolvedAt: Date.now(),
    revealIndex: 0,
    result: expeditionSuccess ? 'success' : 'failure',
    success: expeditionSuccess,
    stats,
    unitResults: results,
    rewardEntries: mergeRewardEntries(rewardEntries),
  };
}
