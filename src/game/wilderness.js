import {
  getCardAffixBonuses,
  getCardProductionRollCount,
  rollAffixProcChance,
  rollCoinGenerationReward,
  rollElementalAttunementDrops,
} from './cards';
import { DEFAULT_RESOURCES } from './arcana';
import { CRAFTED_RESOURCES_BY_ID } from './crafting';
import { GEM_RESOURCES } from './gems';
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

// ─── Class-specific gathering pools ──────────────────────────────────────────
// Each pool is ordered common → rarest. The `weight` drives base drop chance;
// the class `Luck` affix shifts weight toward rarer entries at runtime.
// `minRarity` hard-caps which materials are accessible: lower-rarity cards
// cannot roll materials above their rarity regardless of luck. Card tier controls
// how many independent rolls occur within that eligible pool each cycle.
// `artKey` is the filename key used for art lookup (without .webp extension).
// ─────────────────────────────────────────────────────────────────────────────

const BASE_GATHERING_POOLS = {
  lumberjack: [
    { id: 'wood',          name: 'Wood',          artKey: 'wood',          weight: 60,   minRarity: 'common',    color: '#8f6b42', glow: 'rgba(143,107,66,0.32)', description: 'Basic timber harvested from common woodland trees, essential for construction and crafting.' },
    { id: 'hardwood',      name: 'Hardwood',       artKey: 'hardwood',      weight: 22,   minRarity: 'common',    color: '#6b4c2a', glow: 'rgba(107,76,42,0.34)',  description: 'Dense, durable wood from mature forest trees, prized for its strength and longevity.' },
    { ...SPECIAL_GATHERED_RESOURCES_BY_ID.bark, weight: 8, minRarity: 'uncommon' },
    { id: 'resin',         name: 'Resin',          artKey: 'resin',         weight: 10,   minRarity: 'uncommon',  color: '#c68734', glow: 'rgba(198,135,52,0.32)', description: 'Sticky amber sap tapped from conifers, used in varnishes, adhesives, and alchemical preparations.' },
    { id: 'softwoodSap',   name: 'Softwood Sap',   artKey: 'softwood sap',  weight: 5,    minRarity: 'rare',      color: '#d4a83a', glow: 'rgba(212,168,58,0.30)', description: 'Light, watery sap drawn from young saplings, useful in basic potions and preservatives.' },
    { id: 'petrifiedWood', name: 'Petrified Wood', artKey: 'petrified wood',weight: 2,    minRarity: 'epic',      color: '#9c8c7a', glow: 'rgba(156,140,122,0.30)', description: 'Ancient wood turned to stone over millennia, prized for its hardness and mystical resonance.' },
    { ...SPECIAL_GATHERED_RESOURCES_BY_ID.sproutingAcorn, weight: 0.8, minRarity: 'epic' },
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
    { ...SPECIAL_GATHERED_RESOURCES_BY_ID.smallGameMeat, weight: 24, minRarity: 'common' },
    { ...SPECIAL_GATHERED_RESOURCES_BY_ID.tallow, weight: 16, minRarity: 'common' },
    { id: 'hide',        name: 'Hide',        artKey: 'hide',        weight: 45, minRarity: 'common',    color: '#9b6b53', glow: 'rgba(155,107,83,0.32)',  description: 'Rough animal hide stripped and dried, used for basic leather goods and padding.' },
    { id: 'toughHide',   name: 'Tough Hide',  artKey: 'tough hide',  weight: 25, minRarity: 'common',    color: '#7a5038', glow: 'rgba(122,80,56,0.34)',   description: 'Thick, resilient hide from hardened beasts, providing superior protection against wear.' },
    { id: 'fineFur',     name: 'Fine Fur',    artKey: 'fine fur',    weight: 15, minRarity: 'uncommon',  color: '#c8a87a', glow: 'rgba(200,168,122,0.30)', description: 'Soft, lustrous fur from elusive forest creatures, traded for its warmth and beauty.' },
    { id: 'infusedBone', name: 'Infused Bone',artKey: 'infused bone',weight: 8,  minRarity: 'rare',      color: '#e8e4d0', glow: 'rgba(232,228,208,0.28)', description: 'Bones from magical beasts that have absorbed arcane energy over their lifetime.' },
    { id: 'fierceFang',  name: 'Fierce Fang', artKey: 'fierce fang', weight: 4,  minRarity: 'rare',      color: '#ffe0a0', glow: 'rgba(255,224,160,0.32)', description: 'A razor-sharp tooth pried from a dangerous predator, symbolizing ferocity and kill.' },
    { id: 'toughScales', name: 'Tough Scales',artKey: 'tough scales',weight: 2,  minRarity: 'epic',      color: '#5a8060', glow: 'rgba(90,128,96,0.34)',   description: 'Overlapping scales harvested from reptilian beasts, as durable as plate armor.' },
    { ...SPECIAL_GATHERED_RESOURCES_BY_ID.rabbitsFoot, weight: 0.7, minRarity: 'epic' },
    { id: 'mightyHide',  name: 'Mighty Hide', artKey: 'mighty hide', weight: 1,  minRarity: 'legendary', color: '#7a4030', glow: 'rgba(122,64,48,0.36)',   description: 'The pelt of an apex predator, imbued with the beast\'s tremendous vitality.' },
  ],
  forager: [
    { id: 'fiberweed',   name: 'Fiberweed',   artKey: 'fiberweed',   weight: 35, minRarity: 'common',   color: '#8fae72', glow: 'rgba(143,174,114,0.30)', description: 'Long-stemmed wild growth harvested for the strong fibers hidden beneath its outer skin.' },
    { id: 'hyssop',      name: 'Hyssop',      artKey: 'hyssop',      weight: 25, minRarity: 'common',   color: '#7cb56c', glow: 'rgba(124,181,108,0.32)', description: 'A fragrant medicinal herb from rocky clearings, used in tinctures and purification rituals.' },
    { id: 'wildflowers', name: 'Wildflowers', artKey: 'wildflowers', weight: 15, minRarity: 'common',   color: '#e89ccc', glow: 'rgba(232,156,204,0.30)', description: 'Colorful blooms gathered from untamed meadows, used in dyes, perfumes, and sacred offerings.' },
    { id: 'softstem',    name: 'Softstem',    artKey: 'softstem',    weight: 8,  minRarity: 'uncommon', color: '#a7b978', glow: 'rgba(167,185,120,0.30)', description: 'Supple meadow stems prized for producing smooth, lustrous cloth.' },
    { id: 'garlic',      name: 'Garlic',      artKey: 'garlic',      weight: 10, minRarity: 'uncommon', color: '#f0ece0', glow: 'rgba(240,236,224,0.28)', description: 'Pungent wild bulbs dug from forest clearings, valuable in cooking and alchemical wards.' },
    { id: 'wildOnion',   name: 'Wild Onion',  artKey: 'spring onion',weight: 8,  minRarity: 'uncommon', color: '#a0d080', glow: 'rgba(160,208,128,0.30)', description: 'Sharp-tasting wild alliums found near streams, a reliable seasoning and minor reagent.' },
    { ...SPECIAL_GATHERED_RESOURCES_BY_ID.bark, weight: 6, minRarity: 'uncommon' },
    { id: 'silkgrass',   name: 'Silkgrass',   artKey: 'silkgrass',   weight: 3,  minRarity: 'rare',     color: '#c7d5a2', glow: 'rgba(199,213,162,0.30)', description: 'Fine, shimmering grass whose strands can be woven into silk.' },
    { id: 'mushrooms',   name: 'Mushrooms',   artKey: 'mushrooms',   weight: 5,  minRarity: 'rare',     color: '#8c786f', glow: 'rgba(140,120,111,0.30)', description: 'Diverse fungi harvested from shaded logs and damp earth, both edible and alchemically potent.' },
    { id: 'honeycomb',   name: 'Honeycomb',   artKey: 'honey',       weight: 2,  minRarity: 'epic',     color: '#f0b840', glow: 'rgba(240,184,64,0.32)',  description: 'Waxen comb heavy with wild honey, used to focus Efficiency Callings.' },
    { ...SPECIAL_GATHERED_RESOURCES_BY_ID.quickroot, weight: 0.8, minRarity: 'epic' },
    { ...SPECIAL_GATHERED_RESOURCES_BY_ID.cornucopiaSeed, weight: 0.35, minRarity: 'epic' },
  ],
};

export const GATHERING_RARITY_TIERS = Object.freeze({
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  mythic: 5,
});

export const GATHERING_POOLS = Object.freeze(Object.fromEntries(
  Object.entries(BASE_GATHERING_POOLS).map(([classType, pool]) => [
    classType,
    Object.freeze(pool.map(resource => Object.freeze({
      ...resource,
      tier: GATHERING_RARITY_TIERS[resource.minRarity] ?? 1,
    }))),
  ]),
));

export const TREASURE_PACK_RESOURCE = Object.freeze({
  id: 'treasurePack',
  name: 'Treasure Pack',
  // `treasure_chest.webp`. The previous key was `treasure pack`, for which no art has ever existed — it
  // resolved to null, which is why this rendered as a pack mock-up in the queue instead of a loot tile.
  artKey: 'treasure_chest',
  weight: 0,
  minRarity: 'common',
  tier: 1,
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
  .concat(
    MINING_SPECIAL_RESOURCES.filter(resource => !_seenIds.has(resource.id)),
    TREASURE_PACK_RESOURCE,
    GEMDUST_RESOURCE,
    GEM_RESOURCES,
  );

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

// Processing currently routes all of its outputs into the Crafted inventory. Keep this exported
// collection as the canonical (empty) processed-material registry until a genuinely processed-only
// item is introduced; legacy Cloth and Leather saves are migrated to Linen and Rough Leather.
export const PROCESSED_RESOURCES = [];

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

/** Processing can produce items whose canonical Bag home is Crafted. */
export const PROCESSING_OUTPUT_RESOURCES_BY_ID = Object.freeze({
  ...PROCESSED_RESOURCES_BY_ID,
  ...Object.fromEntries(
    ['linen', 'sateen', 'timber', 'lumber', 'plank', 'roughLeather', 'refinedLeather', 'premiumLeather']
      .map(id => [id, CRAFTED_RESOURCES_BY_ID[id]])
      .filter(([, resource]) => Boolean(resource)),
  ),
});

export const PROCESSING_RECIPES = Object.freeze({
  fiberToLinen: {
    classType: 'weaver', inputSource: 'crafted', inputId: 'fiber', inputCount: 1,
    outputId: 'linen', outputCount: 2, bonusOutputId: 'sateen',
    efficiencyStat: 'weavingEfficiency', bountyStat: 'weavingBounty', luckStat: 'weavingLuck',
  },
  woodToTimber: {
    classType: 'woodworker', inputSource: 'gathered', inputId: 'wood', inputCount: 1,
    outputId: 'timber', outputCount: 2, bonusOutputId: 'lumber',
    efficiencyStat: 'woodworkingEfficiency', bountyStat: 'woodworkingBounty', luckStat: 'woodworkingLuck',
  },
  hardwoodToLumber: {
    classType: 'woodworker', inputSource: 'gathered', inputId: 'hardwood', inputCount: 1,
    outputId: 'lumber', outputCount: 2, bonusOutputId: 'plank',
    efficiencyStat: 'woodworkingEfficiency', bountyStat: 'woodworkingBounty', luckStat: 'woodworkingLuck',
  },
  hideToRoughLeather: {
    classType: 'tanner', inputSource: 'gathered', inputId: 'hide', inputCount: 1,
    outputId: 'roughLeather', outputCount: 2, bonusOutputId: 'refinedLeather',
    efficiencyStat: 'tanningEfficiency', bountyStat: 'tanningBounty', luckStat: 'tanningLuck',
  },
  toughHideToRefinedLeather: {
    classType: 'tanner', inputSource: 'gathered', inputId: 'toughHide', inputCount: 2,
    ingredientSource: 'crafted', ingredientId: 'roughLeather', ingredientCount: 1,
    outputId: 'refinedLeather', outputCount: 1, bonusOutputId: 'premiumLeather',
    efficiencyStat: 'tanningEfficiency', bountyStat: 'tanningBounty', luckStat: 'tanningLuck',
  },
});

export const PROCESSING_CLASS_TYPES = Object.freeze(['weaver', 'woodworker', 'tanner']);

export const PROCESSING_BOOSTERS = Object.freeze({
  tannin: Object.freeze({ id: 'tannin', classType: 'tanner', speedPercent: 15, cyclesPerUnit: 5 }),
});
export function isProcessingCardCompatible(card) {
  return PROCESSING_CLASS_TYPES.includes(card?.classType);
}

function recipeMatchesFilledMaterials(recipe, slot) {
  if (slot?.card && recipe.classType !== slot.card.classType) return false;
  if (slot?.inputId && (recipe.inputId !== slot.inputId || recipe.inputSource !== slot.inputSource)) return false;
  if (slot?.ingredientId && (recipe.ingredientId !== slot.ingredientId || recipe.ingredientSource !== slot.ingredientSource)) return false;
  return true;
}

/** Returns the recipe selected by the worker plus whatever materials are already visible on its bench. */
export function getProcessingRecipe(slot) {
  if (!slot?.card && !slot?.inputId && !slot?.ingredientId) return null;
  return Object.values(PROCESSING_RECIPES).find(recipe => recipeMatchesFilledMaterials(recipe, slot)) ?? null;
}

export function isProcessingSlotReady(slot) {
  const recipe = getProcessingRecipe(slot);
  return Boolean(
    slot?.card
    && recipe
    && slot.inputId === recipe.inputId
    && (slot.inputCount ?? 0) >= recipe.inputCount
    && (!recipe.ingredientId || (
      slot.ingredientId === recipe.ingredientId
      && (slot.ingredientCount ?? 0) >= recipe.ingredientCount
    )),
  );
}

export function processingSlotAcceptsMaterial(slot, source, id) {
  if (!['gathered', 'crafted'].includes(source) || !id) return false;
  return Object.values(PROCESSING_RECIPES).some(recipe => {
    if (!recipeMatchesFilledMaterials(recipe, slot)) return false;
    const primaryMatch = recipe.inputSource === source && recipe.inputId === id
      && (!slot?.inputId || (slot.inputSource === source && slot.inputId === id));
    const ingredientMatch = recipe.ingredientSource === source && recipe.ingredientId === id
      && (!slot?.ingredientId || (slot.ingredientSource === source && slot.ingredientId === id));
    return primaryMatch || ingredientMatch;
  });
}

export function addProcessingMaterial(slot, source, id, count) {
  const amount = Math.max(0, Math.floor(Number(count) || 0));
  if (!amount || !processingSlotAcceptsMaterial(slot, source, id)) return slot;
  const recipe = Object.values(PROCESSING_RECIPES).find(candidate => {
    if (!recipeMatchesFilledMaterials(candidate, slot)) return false;
    return (candidate.inputSource === source && candidate.inputId === id)
      || (candidate.ingredientSource === source && candidate.ingredientId === id);
  });
  if (!recipe) return slot;
  if (recipe.inputSource === source && recipe.inputId === id) {
    return { ...slot, inputSource: source, inputId: id, inputCount: (slot.inputCount ?? 0) + amount, outputId: recipe.outputId };
  }
  return { ...slot, ingredientSource: source, ingredientId: id, ingredientCount: (slot.ingredientCount ?? 0) + amount, outputId: recipe.outputId };
}

export function createGatheringSlot(slotId) {
  return {
    slotId,
    card: null,
    tool: null,
    momentumStacks: 0,
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
      tool: normalizeTool(savedSlot.tool),
      momentumStacks: Math.max(0, Math.min(3, Math.floor(Number(savedSlot.momentumStacks) || 0))),
      startedAt: typeof savedSlot.startedAt === 'number' ? savedSlot.startedAt : null,
      endsAt: typeof savedSlot.endsAt === 'number' ? savedSlot.endsAt : null,
      resourceId: typeof savedSlot.resourceId === 'string' ? savedSlot.resourceId : null,
    };
  });
}

const CLASS_TOOL_STATS = Object.freeze({
  lumberjack: { efficiency: 'gatheringSpeed', luck: 'loggingLuck', attunement: 'loggingAttunement' },
  hunter: { efficiency: 'huntingSpeed', luck: 'huntingLuck', attunement: 'huntingAttunement' },
  forager: { efficiency: 'gatheringSpeed', luck: 'foragingLuck', attunement: 'foragingAttunement' },
  blacksmith: { efficiency: 'smeltingSpeed', luck: 'smeltingLuck', attunement: 'smeltingAttunement' },
  miner: { efficiency: 'miningSpeed', luck: 'miningLuck', attunement: 'miningAttunement' },
});

export function getGatheringAffixBonusPercent(card, tool = null, momentumStacks = 0) {
  const stats = CLASS_TOOL_STATS[card?.classType] ?? CLASS_TOOL_STATS.forager;
  return getToolEfficiencyPercent(card, tool, stats.efficiency, momentumStacks);
}

export function getGatheringDurationSeconds(card, tool = null, momentumStacks = 0) {
  const bonusPercent = getGatheringAffixBonusPercent(card, tool, momentumStacks);
  const acceleratedSeconds = BASE_GATHERING_DURATION_SECONDS / (1 + bonusPercent / 100);
  return Math.max(5, Math.round(acceleratedSeconds));
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

// Roll a resource from the card's class pool, applying luck weighting.
// Items with minRarity above the card's rarity are excluded entirely.
// Luck shifts probability toward rarer entries: the rarest item gains up to
// 2× weight per 100% luck; the most common item is unaffected.
export function rollGatheredResourceId(card, tool = null, random = Math.random) {
  const fullPool = GATHERING_POOLS[card?.classType] ?? FALLBACK_POOL;
  const cardRarityIdx = RARITY_ORDER.indexOf(card?.rarity ?? 'common');
  const pool = fullPool.filter(item => {
    const minIdx = RARITY_ORDER.indexOf(item.minRarity ?? 'common');
    return minIdx <= cardRarityIdx;
  });
  const activePool = pool.length > 0 ? pool : fullPool.slice(0, 1);

  const luckStat = CLASS_LUCK_STAT[card?.classType];
  const luckPercent = luckStat ? getToolLuckPercent(card, tool, luckStat) : 0;
  const affinity = getToolMaterialAffinity(tool);

  const n = activePool.length;
  const weights = activePool.map((item, i) => {
    const rarityFraction = i / Math.max(n - 1, 1); // 0 = most common, 1 = rarest
    const multiplier = 1 + (luckPercent / 100) * rarityFraction * 2;
    const affinityMultiplier = affinity?.materialId === item.id ? 1 + affinity.value / 100 : 1;
    const canonical = GATHERED_CANONICAL_TARGET[item.id];
    const source = canonical?.inventory ?? 'gathered';
    const targetId = canonical?.id ?? item.id;
    return item.weight * multiplier * affinityMultiplier * getTopazWeightMultiplier(card, targetId, source);
  });
  const rollOnce = () => {
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = random() * total;
    for (let i = 0; i < activePool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return activePool[i];
    }
    return activePool[activePool.length - 1];
  };
  const first = rollOnce();
  if (!rollSocketEffect(card, 'emerald', random)) return first.id;
  const second = rollOnce();
  return (second.tier ?? 1) > (first.tier ?? 1) ? second.id : first.id;
}

export function startGatheringSlot(slot, now = Date.now()) {
  if (!slot?.card || slot.startedAt || slot.endsAt) return slot;
  const durationSeconds = getGatheringDurationSeconds(slot.card, slot.tool, slot.momentumStacks);
  const durationMs = durationSeconds * 1000;
  return {
    ...slot,
    startedAt: now,
    endsAt: now + durationMs,
    resourceId: rollGatheredResourceId(slot.card, slot.tool),
  };
}

export function startGatheringSlots(slots = [], now = Date.now()) {
  return slots.map(slot => startGatheringSlot(slot, now));
}

export function resolveCompletedGatheringSlots(slots = [], now = Date.now(), random = Math.random) {
  const completedQueue = { ...DEFAULT_GATHERING_INVENTORY };
  const elementalDrops = { ...DEFAULT_RESOURCES };
  const completedBySlot = [];
  let completedCount = 0;
  let goldEarned = 0;

  const nextSlots = slots.map(slot => {
    if (!slot?.card || !slot.endsAt || slot.endsAt > now || !slot.resourceId) return slot;
    const slotLoot = {};
    const materialRolls = [
      slot.resourceId,
      ...Array.from(
        { length: getCardProductionRollCount(slot.card) - 1 },
        () => rollGatheredResourceId(slot.card, slot.tool, random),
      ),
    ];
    const pool = GATHERING_POOLS[slot.card.classType] ?? FALLBACK_POOL;
    const eligible = pool.filter(item => RARITY_ORDER.indexOf(item.minRarity ?? 'common') <= RARITY_ORDER.indexOf(slot.card.rarity ?? 'common'));
    const attunementStat = CLASS_ATTUNEMENT_STAT[slot.card.classType];
    const attunementChance = attunementStat ? getToolAttunementPercent(slot.card, slot.tool, attunementStat) : 0;
    const primaryOutputs = {};

    materialRolls.forEach(resourceId => {
      if (completedQueue[resourceId] === undefined) return;
      const rolledIndex = eligible.findIndex(item => item.id === resourceId);
      const primaryId = toolRollsRefinement(slot.tool, random) && rolledIndex >= 0
        ? eligible[Math.min(eligible.length - 1, rolledIndex + 1)]?.id ?? resourceId
        : resourceId;
      const baseCount = 1 + (rollPercent(attunementChance, random) ? 1 : 0);
      const primaryCount = applyToolPrimaryQuantity(baseCount, slot.tool, random);
      completedQueue[primaryId] += primaryCount;
      slotLoot[primaryId] = (slotLoot[primaryId] ?? 0) + primaryCount;
      primaryOutputs[primaryId] = (primaryOutputs[primaryId] ?? 0) + primaryCount;
      if (toolRollsDiscovery(slot.tool, random)) {
        const discoveryId = rollGatheredResourceId(slot.card, slot.tool, random);
        completedQueue[discoveryId] += 1;
        slotLoot[discoveryId] = (slotLoot[discoveryId] ?? 0) + 1;
      }
    });
    if (rollSocketEffect(slot.card, 'ruby', random)) {
      Object.entries(primaryOutputs).forEach(([resourceId, amount]) => {
        completedQueue[resourceId] += amount;
        slotLoot[resourceId] = (slotLoot[resourceId] ?? 0) + amount;
      });
    }
    if (TREASURE_SENSE_CLASSES.has(slot.card.classType)) {
      const treasureSense = getCardAffixBonuses(slot.card)?.treasureSense ?? 0;
      if (rollAffixProcChance(treasureSense)) {
        completedQueue[TREASURE_PACK_RESOURCE.id] += 1;
        slotLoot[TREASURE_PACK_RESOURCE.id] = (slotLoot[TREASURE_PACK_RESOURCE.id] ?? 0) + 1;
      }
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
    const restarted = startGatheringSlot(
      { ...slot, momentumStacks: Math.min(3, (slot.momentumStacks ?? 0) + 1), startedAt: null, endsAt: null, resourceId: null },
      now,
    );
    return applySapphireMomentum(slot.card, restarted, now);
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
    inputSource: null,
    inputId: null,
    inputCount: 0,
    ingredientSource: null,
    ingredientId: null,
    ingredientCount: 0,
    boosterId: null,
    boosterCount: 0,
    boosterCharges: 0,
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
    const booster = PROCESSING_BOOSTERS[savedSlot.boosterId] ?? null;
    const boosterCount = booster ? Math.max(0, Math.floor(Number(savedSlot.boosterCount) || 0)) : 0;
    const savedCharges = Math.floor(Number(savedSlot.boosterCharges));
    return {
      slotId,
      card: savedSlot.card ? { ...savedSlot.card } : null,
      inputSource: typeof savedSlot.inputSource === 'string'
        ? savedSlot.inputSource
        : (savedSlot.inputId === 'fiber' ? 'crafted' : (savedSlot.inputId ? 'gathered' : null)),
      inputId: typeof savedSlot.inputId === 'string' ? savedSlot.inputId : null,
      inputCount: Math.max(0, Math.floor(Number(savedSlot.inputCount) || 0)),
      ingredientSource: typeof savedSlot.ingredientSource === 'string' ? savedSlot.ingredientSource : null,
      ingredientId: typeof savedSlot.ingredientId === 'string' ? savedSlot.ingredientId : null,
      ingredientCount: Math.max(0, Math.floor(Number(savedSlot.ingredientCount) || 0)),
      boosterId: booster && boosterCount > 0 ? savedSlot.boosterId : null,
      boosterCount,
      boosterCharges: booster && boosterCount > 0
        ? Math.max(1, Math.min(booster.cyclesPerUnit, Number.isFinite(savedCharges) ? savedCharges : booster.cyclesPerUnit))
        : 0,
      startedAt: typeof savedSlot.startedAt === 'number' ? savedSlot.startedAt : null,
      endsAt: typeof savedSlot.endsAt === 'number' ? savedSlot.endsAt : null,
      outputId: typeof savedSlot.outputId === 'string' ? savedSlot.outputId : null,
    };
  });
}

export function getProcessingAffixBonusPercent(card) {
  const bonuses = getCardAffixBonuses(card);
  const specialistSpeed = card?.classType === 'tanner' ? (bonuses.tanningSpeed ?? 0) : 0;
  return (bonuses.productionSpeed ?? 0) + specialistSpeed;
}

export function getProcessingBoosterSpeedPercent(slot) {
  const booster = PROCESSING_BOOSTERS[slot?.boosterId];
  if (!booster || !slot?.boosterCount || !slot?.boosterCharges) return 0;
  return slot?.card?.classType === booster.classType ? booster.speedPercent : 0;
}

export function addProcessingBooster(slot, boosterId, count) {
  const booster = PROCESSING_BOOSTERS[boosterId];
  const amount = Math.max(0, Math.floor(Number(count) || 0));
  if (!booster || !amount || slot?.card?.classType !== booster.classType) return slot;
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

export function consumeProcessingBoosterCharge(slot) {
  const booster = PROCESSING_BOOSTERS[slot?.boosterId];
  if (!booster || !slot?.boosterCount || !slot?.boosterCharges) return slot;
  if (slot.boosterCharges > 1) return { ...slot, boosterCharges: slot.boosterCharges - 1 };
  if (slot.boosterCount > 1) {
    return { ...slot, boosterCount: slot.boosterCount - 1, boosterCharges: booster.cyclesPerUnit };
  }
  return { ...slot, boosterId: null, boosterCount: 0, boosterCharges: 0 };
}

export function getProcessingDurationSeconds(card, boosterPercent = 0) {
  const bonusPercent = getProcessingAffixBonusPercent(card) + Math.max(0, Number(boosterPercent) || 0);
  const acceleratedSeconds = BASE_PROCESSING_DURATION_SECONDS / (1 + bonusPercent / 100);
  return Math.max(5, Math.round(acceleratedSeconds));
}

export function startProcessingSlot(slot, now = Date.now()) {
  const recipe = getProcessingRecipe(slot);
  if (!isProcessingSlotReady(slot)) return {
    ...slot,
    startedAt: null,
    endsAt: null,
    outputId: (slot?.inputId || slot?.ingredientId) ? (recipe?.outputId ?? slot?.outputId ?? null) : null,
  };
  if (slot.startedAt && slot.endsAt) return slot;
  const durationSeconds = getProcessingDurationSeconds(slot.card, getProcessingBoosterSpeedPercent(slot));
  return {
    ...slot,
    startedAt: now,
    endsAt: now + (durationSeconds * 1000),
    outputId: recipe.outputId,
  };
}

export function resolveCompletedProcessingSlots(slots = [], now = Date.now(), random = Math.random) {
  const completedQueue = { ...DEFAULT_PROCESSED_INVENTORY };
  const completedBySlot = {};
  const elementalDrops = { ...DEFAULT_RESOURCES };
  const bonusOutputs = {};
  let completedCount = 0;
  let goldEarned = 0;

  const nextSlots = slots.map(slot => {
    const recipe = getProcessingRecipe(slot);
    if (!recipe || !isProcessingSlotReady(slot) || !slot.endsAt || slot.endsAt > now) {
      return slot;
    }

    const bonuses = getCardAffixBonuses(slot.card);
    const preservedInputs = rollPercent(bonuses[recipe.efficiencyStat] ?? 0, random);
    const bountyCount = rollPercent(bonuses[recipe.bountyStat] ?? 0, random) ? 1 : 0;
    const overflowCount = rollSocketEffect(slot.card, 'ruby', random) ? recipe.outputCount : 0;
    const outputCount = recipe.outputCount + bountyCount + overflowCount;
    completedQueue[recipe.outputId] = (completedQueue[recipe.outputId] ?? 0) + outputCount;
    completedBySlot[String(slot.slotId)] = {
      ...(completedBySlot[String(slot.slotId)] ?? {}),
      [recipe.outputId]: (completedBySlot[String(slot.slotId)]?.[recipe.outputId] ?? 0) + outputCount,
    };
    const moteDrops = rollElementalAttunementDrops(slot.card);
    Object.entries(moteDrops).forEach(([resourceId, amount]) => {
      elementalDrops[resourceId] = (elementalDrops[resourceId] ?? 0) + amount;
    });
    if (recipe.bonusOutputId && rollPercent(bonuses[recipe.luckStat] ?? 0, random)) {
      bonusOutputs[recipe.bonusOutputId] = (bonusOutputs[recipe.bonusOutputId] ?? 0) + 1;
    }
    completedCount += 1;
    goldEarned += rollCoinGenerationReward(slot.card);

    const remainingInputCount = preservedInputs
      ? (slot.inputCount ?? 0)
      : Math.max(0, (slot.inputCount ?? 0) - recipe.inputCount);
    const remainingIngredientCount = preservedInputs
      ? (slot.ingredientCount ?? 0)
      : Math.max(0, (slot.ingredientCount ?? 0) - (recipe.ingredientCount ?? 0));
    const restarted = startProcessingSlot(
      {
        ...consumeProcessingBoosterCharge(slot),
        inputSource: remainingInputCount > 0 ? slot.inputSource : null,
        inputId: remainingInputCount > 0 ? slot.inputId : null,
        inputCount: remainingInputCount,
        ingredientSource: remainingIngredientCount > 0 ? slot.ingredientSource : null,
        ingredientId: remainingIngredientCount > 0 ? slot.ingredientId : null,
        ingredientCount: remainingIngredientCount,
        outputId: recipe.outputId,
        startedAt: null,
        endsAt: null,
      },
      now,
    );
    return applySapphireMomentum(slot.card, restarted, now);
  });

  return { nextSlots, completedQueue, completedBySlot, completedCount, goldEarned, elementalDrops, bonusOutputs };
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
