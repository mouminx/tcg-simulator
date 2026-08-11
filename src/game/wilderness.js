import { getCardAffixBonuses, rollAffixProcChance, rollAttunementBonus, rollCoinGenerationReward, rollElementalAttunementDrops } from './cards';
import { DEFAULT_RESOURCES } from './arcana';

// ─── Class-specific gathering pools ──────────────────────────────────────────
// Each pool is ordered common → rarest. The `weight` drives base drop chance;
// the class `Luck` affix shifts weight toward rarer entries at runtime.
// `minRarity` hard-caps which materials are accessible: lower-rarity cards
// cannot roll materials above their tier regardless of luck.
// Only affix VALUE RANGES scale with card rarity — not which items can drop.
// `artKey` is the filename key used for art lookup (without .webp extension).
// ─────────────────────────────────────────────────────────────────────────────

export const GATHERING_POOLS = {
  lumberjack: [
    { id: 'wood',          name: 'Wood',          artKey: 'wood',          weight: 60,   minRarity: 'common',    color: '#8f6b42', glow: 'rgba(143,107,66,0.32)', description: 'Basic timber harvested from common woodland trees, essential for construction and crafting.' },
    { id: 'hardwood',      name: 'Hardwood',       artKey: 'hardwood',      weight: 22,   minRarity: 'common',    color: '#6b4c2a', glow: 'rgba(107,76,42,0.34)',  description: 'Dense, durable wood from mature forest trees, prized for its strength and longevity.' },
    { id: 'resin',         name: 'Resin',          artKey: 'resin',         weight: 10,   minRarity: 'uncommon',  color: '#c68734', glow: 'rgba(198,135,52,0.32)', description: 'Sticky amber sap tapped from conifers, used in varnishes, adhesives, and alchemical preparations.' },
    { id: 'softwoodSap',   name: 'Softwood Sap',   artKey: 'softwood sap',  weight: 5,    minRarity: 'rare',      color: '#d4a83a', glow: 'rgba(212,168,58,0.30)', description: 'Light, watery sap drawn from young saplings, useful in basic potions and preservatives.' },
    { id: 'petrifiedWood', name: 'Petrified Wood', artKey: 'petrified wood',weight: 2,    minRarity: 'epic',      color: '#9c8c7a', glow: 'rgba(156,140,122,0.30)', description: 'Ancient wood turned to stone over millennia, prized for its hardness and mystical resonance.' },
    { id: 'voidwood',      name: 'Voidwood',       artKey: 'voidwood',      weight: 0.7,  minRarity: 'legendary', color: '#4a3060', glow: 'rgba(74,48,96,0.40)',   description: 'Wood from trees that grow in lightless hollows, its grain saturated with shadow energy.' },
    { id: 'arcanewood',    name: 'Arcanewood',     artKey: 'arcanewood',    weight: 0.25, minRarity: 'legendary', color: '#7b5ccc', glow: 'rgba(123,92,204,0.38)', description: 'Timber suffused with raw magical energy, glowing faintly and sought by enchanters.' },
    { id: 'starwood',      name: 'Starwood',       artKey: 'starwood',      weight: 0.05, minRarity: 'mythic',    color: '#c0a8ff', glow: 'rgba(192,168,255,0.36)', description: 'Extraordinarily rare wood from trees that bloom only under falling stars, radiating cosmic power.' },
  ],
  miner: [
    { id: 'stone',          name: 'Stone',          artKey: 'stone',     weight: 50,   minRarity: 'common',    color: '#7a7a7a', glow: 'rgba(122,122,122,0.30)', description: 'Solid bedrock chipped from cave walls, the most fundamental of all building materials.' },
    { id: 'coal',           name: 'Coal',           artKey: 'coal',      weight: 25,   minRarity: 'common',    color: '#5a5d66', glow: 'rgba(90,93,102,0.30)',   description: 'Dense black mineral fuel that burns hot and long, the lifeblood of forges and furnaces.' },
    { id: 'ironOre',        name: 'Iron Ore',       artKey: 'iron',      weight: 15,   minRarity: 'common',    color: '#8b7355', glow: 'rgba(139,115,85,0.34)',  description: 'Common metallic ore smelted into steel, the backbone of weapons, tools, and armor.' },
    { id: 'silverOre',      name: 'Silver Ore',     artKey: 'silver',    weight: 6,    minRarity: 'uncommon',  color: '#b4c0d0', glow: 'rgba(180,192,208,0.34)', description: 'Lustrous precious ore with natural magical conductivity, refined into silver ingots.' },
    { id: 'goldOre',        name: 'Gold Ore',       artKey: 'gold',      weight: 2.5,  minRarity: 'rare',      color: '#d9ab2b', glow: 'rgba(217,171,43,0.34)',  description: 'Rare, gleaming ore of immense market value, refined into gold ingots for the finest crafts.' },
    { id: 'platinumOre',    name: 'Platinum Ore',   artKey: 'platinum',  weight: 1,    minRarity: 'epic',      color: '#8fd0e2', glow: 'rgba(143,208,226,0.32)', description: 'An exceptionally rare noble metal ore, nearly indestructible once refined into ingots.' },
    { id: 'starstoneChunk', name: 'Starstone Chunk',artKey: 'starstone', weight: 0.3,  minRarity: 'legendary', color: '#d0c0ff', glow: 'rgba(208,192,255,0.36)', description: 'A fragment of fallen celestial matter, crackling faintly with otherworldly energy.' },
    { id: 'starlitOre',     name: 'Starlit Ore',    artKey: 'starlit',   weight: 0.2,  minRarity: 'mythic',    color: '#8d7cff', glow: 'rgba(141,124,255,0.36)', description: 'Ore veined with trapped starlight, found only in the deepest reaches of ancient mines.' },
  ],
  blacksmith: [
    { id: 'steelIngot',    name: 'Steel Ingot',    artKey: 'steel',    weight: 50, minRarity: 'common',    color: '#8b7355', glow: 'rgba(139,115,85,0.34)',  description: 'A refined iron ingot tempered for maximum hardness, the standard of all bladecraft.' },
    { id: 'silverIngot',   name: 'Silver Ingot',   artKey: 'silver',   weight: 25, minRarity: 'uncommon',  color: '#b4c0d0', glow: 'rgba(180,192,208,0.34)', description: 'A pure silver bar with natural enchantment affinity, used in warding implements.' },
    { id: 'goldIngot',     name: 'Gold Ingot',     artKey: 'gold',     weight: 15, minRarity: 'rare',      color: '#d9ab2b', glow: 'rgba(217,171,43,0.34)',  description: 'A gleaming gold bar of immense value, indispensable to master craftsmen and alchemists.' },
    { id: 'platinumIngot', name: 'Platinum Ingot', artKey: 'platinum', weight: 7,  minRarity: 'epic',      color: '#8fd0e2', glow: 'rgba(143,208,226,0.32)', description: 'A dense, immaculate platinum bar capable of holding the strongest enchantments.' },
    { id: 'starlitIngot',  name: 'Starsteel Ingot',artKey: 'starsteel',weight: 3,  minRarity: 'legendary', color: '#8d7cff', glow: 'rgba(141,124,255,0.36)', description: 'A cosmic ingot forged from starlit ore, pulsing with celestial energy and nearly weightless.' },
  ],
  hunter: [
    { id: 'hide',        name: 'Hide',        artKey: 'hide',        weight: 45, minRarity: 'common',    color: '#9b6b53', glow: 'rgba(155,107,83,0.32)',  description: 'Rough animal hide stripped and dried, used for basic leather goods and padding.' },
    { id: 'toughHide',   name: 'Tough Hide',  artKey: 'tough hide',  weight: 25, minRarity: 'common',    color: '#7a5038', glow: 'rgba(122,80,56,0.34)',   description: 'Thick, resilient hide from hardened beasts, providing superior protection against wear.' },
    { id: 'fineFur',     name: 'Fine Fur',    artKey: 'fine fur',    weight: 15, minRarity: 'uncommon',  color: '#c8a87a', glow: 'rgba(200,168,122,0.30)', description: 'Soft, lustrous fur from elusive forest creatures, traded for its warmth and beauty.' },
    { id: 'infusedBone', name: 'Infused Bone',artKey: 'infused bone',weight: 8,  minRarity: 'rare',      color: '#e8e4d0', glow: 'rgba(232,228,208,0.28)', description: 'Bones from magical beasts that have absorbed arcane energy over their lifetime.' },
    { id: 'fierceFang',  name: 'Fierce Fang', artKey: 'fierce fang', weight: 4,  minRarity: 'rare',      color: '#ffe0a0', glow: 'rgba(255,224,160,0.32)', description: 'A razor-sharp tooth pried from a dangerous predator, symbolizing ferocity and kill.' },
    { id: 'toughScales', name: 'Tough Scales',artKey: 'tough scales',weight: 2,  minRarity: 'epic',      color: '#5a8060', glow: 'rgba(90,128,96,0.34)',   description: 'Overlapping scales harvested from reptilian beasts, as durable as plate armor.' },
    { id: 'mightyHide',  name: 'Mighty Hide', artKey: 'mighty hide', weight: 1,  minRarity: 'legendary', color: '#7a4030', glow: 'rgba(122,64,48,0.36)',   description: 'The pelt of an apex predator, imbued with the beast\'s tremendous vitality.' },
  ],
  forager: [
    { id: 'fiber',       name: 'Fiber',       artKey: 'fiber',       weight: 35, minRarity: 'common',   color: '#b9c088', glow: 'rgba(185,192,136,0.30)', description: 'Rough plant fibers pulled from tall grasses and stems, woven into cloth and rope.' },
    { id: 'hyssop',      name: 'Hyssop',      artKey: 'hyssop',      weight: 25, minRarity: 'common',   color: '#7cb56c', glow: 'rgba(124,181,108,0.32)', description: 'A fragrant medicinal herb from rocky clearings, used in tinctures and purification rituals.' },
    { id: 'wildflowers', name: 'Wildflowers', artKey: 'wildflowers', weight: 15, minRarity: 'common',   color: '#e89ccc', glow: 'rgba(232,156,204,0.30)', description: 'Colorful blooms gathered from untamed meadows, used in dyes, perfumes, and sacred offerings.' },
    { id: 'garlic',      name: 'Garlic',      artKey: 'garlic',      weight: 10, minRarity: 'uncommon', color: '#f0ece0', glow: 'rgba(240,236,224,0.28)', description: 'Pungent wild bulbs dug from forest clearings, valuable in cooking and alchemical wards.' },
    { id: 'wildOnion',   name: 'Wild Onion',  artKey: 'spring onion',weight: 8,  minRarity: 'uncommon', color: '#a0d080', glow: 'rgba(160,208,128,0.30)', description: 'Sharp-tasting wild alliums found near streams, a reliable seasoning and minor reagent.' },
    { id: 'mushrooms',   name: 'Mushrooms',   artKey: 'mushrooms',   weight: 5,  minRarity: 'rare',     color: '#8c786f', glow: 'rgba(140,120,111,0.30)', description: 'Diverse fungi harvested from shaded logs and damp earth, both edible and alchemically potent.' },
    { id: 'honey',       name: 'Honey',       artKey: 'honey',       weight: 2,  minRarity: 'epic',     color: '#f0b840', glow: 'rgba(240,184,64,0.32)',  description: 'Sweet golden nectar collected from wild beehives hidden deep in flowering groves.' },
  ],
};

export const TREASURE_PACK_RESOURCE = Object.freeze({
  id: 'treasurePack',
  name: 'Treasure Pack',
  // `treasure_chest.webp`. The previous key was `treasure pack`, for which no art has ever existed — it
  // resolved to null, which is why this rendered as a pack mock-up in the queue instead of a loot tile.
  artKey: 'treasure_chest',
  weight: 0,
  minRarity: 'common',
  color: '#d9ab2b',
  glow: 'rgba(217,171,43,0.34)',
  description: 'A hidden cache uncovered by Treasure Sense. Claim it to add a Treasure Pack to Summon.',
});

// Fallback pool for classes without a specific gathering pool
const FALLBACK_POOL = GATHERING_POOLS.forager;

// Luck affix stat name per class
const CLASS_LUCK_STAT = {
  lumberjack: 'loggingLuck',
  miner:      'miningLuck',
  blacksmith: 'smeltingLuck',
  hunter:     'huntingLuck',
  forager:    'foragingLuck',
};

const CLASS_ATTUNEMENT_STAT = {
  lumberjack: 'loggingAttunement',
  hunter: 'huntingAttunement',
  forager: 'foragingAttunement',
  blacksmith: 'smeltingAttunement',
  miner: 'miningAttunement',
};

const TREASURE_SENSE_CLASSES = new Set(['lumberjack', 'hunter', 'forager']);

// Flat list of all unique resources across all pools (deduplicated by id)
const _seenIds = new Set();
export const ALL_GATHERING_RESOURCES = Object.values(GATHERING_POOLS)
  .flat()
  .filter(r => {
    if (_seenIds.has(r.id)) return false;
    _seenIds.add(r.id);
    return true;
  })
  .concat(TREASURE_PACK_RESOURCE);

// Backwards-compat alias — code that imports GATHERING_RESOURCES still works
export const GATHERING_RESOURCES = ALL_GATHERING_RESOURCES;

/**
 * Where a gathered resource actually belongs, for the resources that are **the same real item as
 * something the Foundry already tracks**.
 *
 * The gathering pools duplicate every ore and every ingot under their own ids — a miner card in a
 * gathering slot rolls `ironOre`, a blacksmith rolls `steelIngot` — while the Foundry's mine and
 * forge use `iron` and `steel` in separate `oreInventory` / `ingotInventory` maps. Left alone, the
 * two id spaces mean a Steel Ingot you gathered and a Steel Ingot you smelted are different objects
 * in different inventories, and the Bag files the gathered one under "Gathered" rather than
 * "Ingots". `stone` and `coal` are worse still: identical ids in two different maps, so the same
 * name appears in two sections with two counts.
 *
 * So gathering output is folded into the canonical inventory at collection time, and there is one
 * Coal and one Steel Ingot in the game. Anything absent from this table has no Foundry equivalent
 * (`starstoneChunk` included — `ORE_TYPES` has no starstone) and stays a gathered resource.
 */
export const GATHERED_CANONICAL_TARGET = Object.freeze({
  stone:         { inventory: 'ore',   id: 'stone' },
  coal:          { inventory: 'ore',   id: 'coal' },
  ironOre:       { inventory: 'ore',   id: 'iron' },
  silverOre:     { inventory: 'ore',   id: 'silver' },
  goldOre:       { inventory: 'ore',   id: 'gold' },
  platinumOre:   { inventory: 'ore',   id: 'platinum' },
  starlitOre:    { inventory: 'ore',   id: 'starlit' },
  steelIngot:    { inventory: 'ingot', id: 'steel' },
  silverIngot:   { inventory: 'ingot', id: 'silver' },
  goldIngot:     { inventory: 'ingot', id: 'gold' },
  platinumIngot: { inventory: 'ingot', id: 'platinum' },
  starlitIngot:  { inventory: 'ingot', id: 'starsteel' },
});

/** Gathered resources that stay gathered — everything the Foundry has no equivalent for. */
export const GATHERED_ONLY_RESOURCES = ALL_GATHERING_RESOURCES
  .filter(r => !GATHERED_CANONICAL_TARGET[r.id]);

/**
 * Splits a gathering claim queue into the three inventories it should land in.
 * Returns `{ gathered, ore, ingot }`, each a plain id -> count map of only the non-zero entries.
 */
export function splitGatheredByInventory(queue = {}) {
  const out = { gathered: {}, ore: {}, ingot: {} };
  Object.entries(queue).forEach(([id, count]) => {
    const amount = Math.max(0, Math.floor(Number(count) || 0));
    if (!amount) return;
    const target = GATHERED_CANONICAL_TARGET[id];
    if (!target) {
      out.gathered[id] = (out.gathered[id] ?? 0) + amount;
      return;
    }
    out[target.inventory][target.id] = (out[target.inventory][target.id] ?? 0) + amount;
  });
  return out;
}

export const PROCESSED_RESOURCES = [
  { id: 'timber',          name: 'Timber',          family: 'Lumber',   color: '#a57745', glow: 'rgba(165,119,69,0.32)',  description: 'Rough-cut planks milled from harvested wood, ready for use in construction and carpentry.' },
  { id: 'cloth',           name: 'Cloth',            family: 'Weave',    color: '#d6d2bb', glow: 'rgba(214,210,187,0.28)', description: 'Woven textile produced from plant fibers, the foundation of garments and carrying bags.' },
  { id: 'sealant',         name: 'Sealant',          family: 'Coating',  color: '#d29c58', glow: 'rgba(210,156,88,0.30)',  description: 'A water-resistant coating refined from resin, used to protect wood and leather from the elements.' },
  { id: 'alkahest',        name: 'Alkahest',         family: 'Solvent',  color: '#89d2c9', glow: 'rgba(137,210,201,0.28)', description: 'A universal solvent distilled through careful alchemy, capable of breaking down most substances.' },
  { id: 'mycelialExtract', name: 'Mycelial Extract', family: 'Extract',  color: '#9f8ed2', glow: 'rgba(159,142,210,0.30)', description: 'A potent reagent extracted from rare mushrooms, essential in advanced alchemical recipes.' },
  { id: 'leather',         name: 'Leather',          family: 'Hidework', color: '#b77b57', glow: 'rgba(183,123,87,0.30)',  description: 'Treated and tanned animal hide, supple and durable, used throughout crafting and armor work.' },
];

export const DEFAULT_GATHERING_INVENTORY = Object.freeze(
  Object.fromEntries(ALL_GATHERING_RESOURCES.map(r => [r.id, 0])),
);

export const DEFAULT_PROCESSED_INVENTORY = Object.freeze(
  Object.fromEntries(PROCESSED_RESOURCES.map(r => [r.id, 0])),
);

export const GATHERING_SLOT_COUNT = 4;
export const BASE_GOLD_PER_PRODUCTION = 0.5;
export const PROCESSING_SLOT_COUNT = 3;
export const BASE_GATHERING_DURATION_SECONDS = 60;
export const BASE_PROCESSING_DURATION_SECONDS = 30;

export const PROCESSED_RESOURCES_BY_ID = Object.freeze(
  Object.fromEntries(PROCESSED_RESOURCES.map(resource => [resource.id, resource])),
);

export const PROCESSING_RECIPES = Object.freeze({
  wood: { inputId: 'wood', inputCount: 4, outputId: 'timber' },
  fiber: { inputId: 'fiber', inputCount: 4, outputId: 'cloth' },
  resin: { inputId: 'resin', inputCount: 3, outputId: 'sealant' },
  hyssop: { inputId: 'hyssop', inputCount: 3, outputId: 'alkahest' },
  mushrooms: { inputId: 'mushrooms', inputCount: 3, outputId: 'mycelialExtract' },
  hide: { inputId: 'hide', inputCount: 4, outputId: 'leather' },
});

export function createGatheringSlot(slotId) {
  return {
    slotId,
    card: null,
    startedAt: null,
    endsAt: null,
    resourceId: null,
  };
}

export function createGatheringSlots(count = GATHERING_SLOT_COUNT) {
  return Array.from({ length: count }, (_, index) => createGatheringSlot(index + 1));
}

export function normalizeGatheringSlots(savedSlots = [], count = GATHERING_SLOT_COUNT) {
  return Array.from({ length: count }, (_, index) => {
    const slotId = index + 1;
    const savedSlot = savedSlots.find(slot => Number(slot?.slotId) === slotId);
    if (!savedSlot) return createGatheringSlot(slotId);
    return {
      slotId,
      card: savedSlot.card ? { ...savedSlot.card } : null,
      startedAt: typeof savedSlot.startedAt === 'number' ? savedSlot.startedAt : null,
      endsAt: typeof savedSlot.endsAt === 'number' ? savedSlot.endsAt : null,
      resourceId: typeof savedSlot.resourceId === 'string' ? savedSlot.resourceId : null,
    };
  });
}

export function getGatheringAffixBonusPercent(card) {
  return getCardAffixBonuses(card).gatheringSpeed ?? 0;
}

export function getGatheringDurationSeconds(card) {
  const bonusPercent = getGatheringAffixBonusPercent(card);
  const acceleratedSeconds = BASE_GATHERING_DURATION_SECONDS / (1 + bonusPercent / 100);
  return Math.max(5, Math.round(acceleratedSeconds));
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

// Roll a resource from the card's class pool, applying luck weighting.
// Items with minRarity above the card's rarity are excluded entirely.
// Luck shifts probability toward rarer entries: the rarest item gains up to
// 2× weight per 100% luck; the most common item is unaffected.
export function rollGatheredResourceId(card) {
  const fullPool = GATHERING_POOLS[card?.classType] ?? FALLBACK_POOL;
  const cardRarityIdx = RARITY_ORDER.indexOf(card?.rarity ?? 'common');
  const pool = fullPool.filter(item => {
    const minIdx = RARITY_ORDER.indexOf(item.minRarity ?? 'common');
    return minIdx <= cardRarityIdx;
  });
  const activePool = pool.length > 0 ? pool : fullPool.slice(0, 1);

  const luckStat = CLASS_LUCK_STAT[card?.classType];
  const luckPercent = luckStat ? (getCardAffixBonuses(card)?.[luckStat] ?? 0) : 0;

  const n = activePool.length;
  const weights = activePool.map((item, i) => {
    const rarityFraction = i / Math.max(n - 1, 1); // 0 = most common, 1 = rarest
    const multiplier = 1 + (luckPercent / 100) * rarityFraction * 2;
    return item.weight * multiplier;
  });

  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < activePool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return activePool[i].id;
  }
  return activePool[activePool.length - 1].id;
}

export function startGatheringSlot(slot, now = Date.now()) {
  if (!slot?.card || slot.startedAt || slot.endsAt) return slot;
  const durationSeconds = getGatheringDurationSeconds(slot.card);
  const durationMs = durationSeconds * 1000;
  return {
    ...slot,
    startedAt: now,
    endsAt: now + durationMs,
    resourceId: rollGatheredResourceId(slot.card),
  };
}

export function startGatheringSlots(slots = [], now = Date.now()) {
  return slots.map(slot => startGatheringSlot(slot, now));
}

export function resolveCompletedGatheringSlots(slots = [], now = Date.now()) {
  const completedQueue = { ...DEFAULT_GATHERING_INVENTORY };
  const elementalDrops = { ...DEFAULT_RESOURCES };
  const completedBySlot = [];
  let completedCount = 0;
  let goldEarned = 0;

  const nextSlots = slots.map(slot => {
    if (!slot?.card || !slot.endsAt || slot.endsAt > now || !slot.resourceId) return slot;
    const slotLoot = {};
    if (completedQueue[slot.resourceId] !== undefined) {
      const attunementStat = CLASS_ATTUNEMENT_STAT[slot.card.classType];
      const attunementBonus = attunementStat ? rollAttunementBonus(slot.card, attunementStat) : 0;
      completedQueue[slot.resourceId] += 1 + attunementBonus;
      slotLoot[slot.resourceId] = 1 + attunementBonus;
    }
    if (TREASURE_SENSE_CLASSES.has(slot.card.classType)) {
      const treasureSense = getCardAffixBonuses(slot.card)?.treasureSense ?? 0;
      if (rollAffixProcChance(treasureSense)) {
        completedQueue[TREASURE_PACK_RESOURCE.id] += 1;
        slotLoot[TREASURE_PACK_RESOURCE.id] = (slotLoot[TREASURE_PACK_RESOURCE.id] ?? 0) + 1;
      }
    }
    const moteDrops = rollElementalAttunementDrops(slot.card);
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
    return startGatheringSlot(
      { ...slot, startedAt: null, endsAt: null, resourceId: null },
      now,
    );
  });

  return { nextSlots, completedQueue, completedBySlot, completedCount, goldEarned, elementalDrops };
}

export function addGatheredCounts(left = {}, right = {}) {
  return ALL_GATHERING_RESOURCES.reduce((acc, resource) => {
    acc[resource.id] = (left?.[resource.id] ?? 0) + (right?.[resource.id] ?? 0);
    return acc;
  }, {});
}

export function hasQueuedGatheredResources(queue = {}) {
  return ALL_GATHERING_RESOURCES.some(resource => (queue?.[resource.id] ?? 0) > 0);
}

export function createProcessingSlot(slotId) {
  return {
    slotId,
    card: null,
    inputId: null,
    inputCount: 0,
    startedAt: null,
    endsAt: null,
    outputId: null,
  };
}

export function createProcessingSlots(count = PROCESSING_SLOT_COUNT) {
  return Array.from({ length: count }, (_, index) => createProcessingSlot(index + 1));
}

export function normalizeProcessingSlots(savedSlots = [], count = PROCESSING_SLOT_COUNT) {
  return Array.from({ length: count }, (_, index) => {
    const slotId = index + 1;
    const savedSlot = savedSlots.find(slot => Number(slot?.slotId) === slotId);
    if (!savedSlot) return createProcessingSlot(slotId);
    return {
      slotId,
      card: savedSlot.card ? { ...savedSlot.card } : null,
      inputId: typeof savedSlot.inputId === 'string' ? savedSlot.inputId : null,
      inputCount: Math.max(0, Math.floor(Number(savedSlot.inputCount) || 0)),
      startedAt: typeof savedSlot.startedAt === 'number' ? savedSlot.startedAt : null,
      endsAt: typeof savedSlot.endsAt === 'number' ? savedSlot.endsAt : null,
      outputId: typeof savedSlot.outputId === 'string' ? savedSlot.outputId : null,
    };
  });
}

export function getProcessingAffixBonusPercent(card) {
  const bonuses = getCardAffixBonuses(card);
  return (bonuses.productionSpeed ?? 0) + (bonuses.smeltingSpeed ?? 0);
}

export function getProcessingDurationSeconds(card) {
  const bonusPercent = getProcessingAffixBonusPercent(card);
  const acceleratedSeconds = BASE_PROCESSING_DURATION_SECONDS / (1 + bonusPercent / 100);
  return Math.max(5, Math.round(acceleratedSeconds));
}

export function startProcessingSlot(slot, now = Date.now()) {
  const recipe = PROCESSING_RECIPES[slot?.inputId];
  if (!slot?.card || !recipe || (slot.inputCount ?? 0) < recipe.inputCount) return {
    ...slot,
    startedAt: null,
    endsAt: null,
    outputId: recipe?.outputId ?? slot?.outputId ?? null,
  };
  if (slot.startedAt && slot.endsAt) return slot;
  const durationSeconds = getProcessingDurationSeconds(slot.card);
  return {
    ...slot,
    startedAt: now,
    endsAt: now + (durationSeconds * 1000),
    outputId: recipe.outputId,
  };
}

export function resolveCompletedProcessingSlots(slots = [], now = Date.now()) {
  const completedQueue = { ...DEFAULT_PROCESSED_INVENTORY };
  const completedBySlot = {};
  const elementalDrops = { ...DEFAULT_RESOURCES };
  let completedCount = 0;
  let goldEarned = 0;

  const nextSlots = slots.map(slot => {
    const recipe = PROCESSING_RECIPES[slot?.inputId];
    if (!slot?.card || !recipe || !slot.endsAt || slot.endsAt > now || (slot.inputCount ?? 0) < recipe.inputCount) {
      return slot;
    }

    const attunementBonus = rollAttunementBonus(slot.card, 'smeltingAttunement');
    const outputCount = 1 + attunementBonus;
    completedQueue[recipe.outputId] += outputCount;
    completedBySlot[String(slot.slotId)] = {
      ...(completedBySlot[String(slot.slotId)] ?? {}),
      [recipe.outputId]: (completedBySlot[String(slot.slotId)]?.[recipe.outputId] ?? 0) + outputCount,
    };
    const moteDrops = rollElementalAttunementDrops(slot.card);
    Object.entries(moteDrops).forEach(([resourceId, amount]) => {
      elementalDrops[resourceId] = (elementalDrops[resourceId] ?? 0) + amount;
    });
    completedCount += 1;
    goldEarned += rollCoinGenerationReward(slot.card);

    const remainingInputCount = Math.max(0, (slot.inputCount ?? 0) - recipe.inputCount);
    return startProcessingSlot(
      {
        ...slot,
        inputId: remainingInputCount > 0 ? slot.inputId : null,
        inputCount: remainingInputCount,
        outputId: recipe.outputId,
        startedAt: null,
        endsAt: null,
      },
      now,
    );
  });

  return { nextSlots, completedQueue, completedBySlot, completedCount, goldEarned, elementalDrops };
}

export function addProcessedCounts(left = {}, right = {}) {
  return PROCESSED_RESOURCES.reduce((acc, resource) => {
    acc[resource.id] = (left?.[resource.id] ?? 0) + (right?.[resource.id] ?? 0);
    return acc;
  }, {});
}

export function hasQueuedProcessedResources(queue = {}) {
  return PROCESSED_RESOURCES.some(resource => (queue?.[resource.id] ?? 0) > 0);
}
