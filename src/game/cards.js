import { ARCANA_ITEMS_BY_ID, ARCANA_SLOTS, getElementResourceId } from './arcana';

export { ESSENCES as ESSENCE_TYPES, DEFAULT_RESOURCES } from './arcana';

export const RARITIES = {
  common:    { name: 'Common',    color: '#9ca3af', weight: 55, valueMin: 0.10,  valueMax: 1.00  },
  uncommon:  { name: 'Uncommon',  color: '#17d968', weight: 25, valueMin: 1.00,  valueMax: 4.00  },
  rare:      { name: 'Rare',      color: '#1f7dff', weight: 12, valueMin: 4.00,  valueMax: 18.00 },
  epic:      { name: 'Epic',      color: '#b04bff', weight: 5,  valueMin: 18.00, valueMax: 65.00 },
  legendary: { name: 'Legendary', color: '#ffb200', weight: 1,  valueMin: 65.00, valueMax: 200.00 },
  mythic:    { name: 'Mythic',    color: '#ff4268', weight: 0.5,  valueMin: 200.00, valueMax: 500.00 },
};

// Tier I–V: progressively rarer visual effects + value multiplier
export const TIERS = {
  1: { name: 'I',   weight: 45, multiplier: 1.0 },
  2: { name: 'II',  weight: 28, multiplier: 1.4 },
  3: { name: 'III', weight: 16, multiplier: 2.0 },
  4: { name: 'IV',  weight: 8,  multiplier: 3.2 },
  5: { name: 'V',   weight: 3,  multiplier: 5.5 },
};

export const AFFIX_VALUE_RANGES = {
  common:    [1, 5],
  uncommon:  [6, 11],
  rare:      [12, 17],
  epic:      [18, 23],
  legendary: [24, 29],
  mythic:    [30, 40],
};

export const HIGHER_AFFIX_CHANCE = 0.5;
export const HIGHER_AFFIX_MULTIPLIER = 2;
export const COIN_GENERATION_REWARD_RANGES = {
  common:    [1, 12],
  uncommon:  [8, 24],
  rare:      [18, 50],
  epic:      [40, 85],
  legendary: [70, 140],
  mythic:    [120, 220],
};
export const ELEMENTAL_ATTUNEMENT_AFFIXES = [
  { id: 'emberAttunement',     label: 'Ember Attunement',     stat: 'emberAttunement',     elementId: 'smoldering' },
  { id: 'stormAttunement',     label: 'Storm Attunement',     stat: 'stormAttunement',     elementId: 'jolting' },
  { id: 'tideAttunement',      label: 'Tide Attunement',      stat: 'tideAttunement',      elementId: 'flowing' },
  { id: 'bloomAttunement',     label: 'Bloom Attunement',     stat: 'bloomAttunement',     elementId: 'blooming' },
  { id: 'galeAttunement',      label: 'Gale Attunement',      stat: 'galeAttunement',      elementId: 'gusting' },
  { id: 'voidAttunement',      label: 'Void Attunement',      stat: 'voidAttunement',      elementId: 'hollowing' },
  { id: 'radianceAttunement',  label: 'Radiance Attunement',  stat: 'radianceAttunement',  elementId: 'gleaming' },
  { id: 'celestialAttunement', label: 'Celestial Attunement', stat: 'celestialAttunement', elementId: 'ascending' },
  { id: 'stoneAttunement',     label: 'Stone Attunement',     stat: 'stoneAttunement',     elementId: 'grounding' },
];

// ── Unit Class Definitions ─────────────────────────────────────────────────────

// Rarity title ladders: each class has a distinct title per rarity.
// card.name = resolveCardName(classKey, rarity, tier)  e.g. "Veteran Forgemaster"
// card.classType = classKey                             e.g. "blacksmith"
export const CLASS_REGISTRY = {
  miner: {
    id: 'miner',
    label: 'Miner',
    rarityTitles: {
      common:    'Laborer',
      uncommon:  'Miner',
      rare:      'Delver',
      epic:      'Deepdelver',
      legendary: 'Earthseeker',
      mythic:    'Worldbreaker',
    },
  },
  blacksmith: {
    id: 'blacksmith',
    label: 'Blacksmith',
    rarityTitles: {
      common:    'Smith',
      uncommon:  'Blacksmith',
      rare:      'Forgemaster',
      epic:      'Master Smith',
      legendary: 'Runesmith',
      mythic:    'Worldforger',
    },
  },
  lumberjack: {
    id: 'lumberjack',
    label: 'Lumberjack',
    rarityTitles: {
      common:    'Woodsman',
      uncommon:  'Lumberjack',
      rare:      'Timberwright',
      epic:      'Treecaller',
      legendary: 'Ironbark Warden',
      mythic:    'Elderwood Reaper',
    },
  },
  hunter: {
    id: 'hunter',
    label: 'Hunter',
    rarityTitles: {
      common:    'Tracker',
      uncommon:  'Hunter',
      rare:      'Stalker',
      epic:      'Beaststalker',
      legendary: 'Wildswarden',
      mythic:    'Apex Huntsman',
    },
  },
  merchant: {
    id: 'merchant',
    label: 'Merchant',
    rarityTitles: {
      common:    'Peddler',
      uncommon:  'Merchant',
      rare:      'Trader',
      epic:      'Guildmaster',
      legendary: 'Magnate',
      mythic:    'Golden Sovereign',
    },
  },
  warrior: {
    id: 'warrior',
    label: 'Warrior',
    rarityTitles: {
      common:    'Fighter',
      uncommon:  'Warrior',
      rare:      'Veteran',
      epic:      'Champion',
      legendary: 'Warlord',
      mythic:    'Godslayer',
    },
  },
  mage: {
    id: 'mage',
    label: 'Mage',
    rarityTitles: {
      common:    'Adept',
      uncommon:  'Mage',
      rare:      'Spellbinder',
      epic:      'Arcanist',
      legendary: 'Archmage',
      mythic:    'Star Sage',
    },
  },
  bard: {
    id: 'bard',
    label: 'Bard',
    rarityTitles: {
      common:    'Minstrel',
      uncommon:  'Bard',
      rare:      'Skald',
      epic:      'Virtuoso',
      legendary: 'Songweaver',
      mythic:    'Mythcaller',
    },
  },
  forager: {
    id: 'forager',
    label: 'Forager',
    rarityTitles: {
      common:    'Gatherer',
      uncommon:  'Forager',
      rare:      'Herbseeker',
      epic:      'Wildspeaker',
      legendary: 'Greenwarden',
      mythic:    'Verdant Sovereign',
    },
  },
};

export const UNIT_CLASSES = Object.values(CLASS_REGISTRY);
export const UNIT_CLASSES_BY_ID = CLASS_REGISTRY;

// Tier title prefixes — combined with rarity title to form the full card name.
export const TIER_TITLES = {
  1: 'Novice',
  2: 'Seasoned',
  3: 'Veteran',
  4: 'Master',
  5: 'Grandmaster',
};

/**
 * Resolve the full display name for a unit card.
 * e.g. resolveCardName('blacksmith', 'rare', 3) → "Veteran Forgemaster"
 */
export function resolveCardName(classKey, rarity, tier) {
  const classDef = CLASS_REGISTRY[classKey];
  const rarityTitle = classDef?.rarityTitles[rarity] ?? (classDef?.label ?? classKey);
  const tierTitle   = TIER_TITLES[tier] ?? TIER_TITLES[1];
  return `${tierTitle} ${rarityTitle}`;
}

// ── Class-Specific Affix Pools ────────────────────────────────────────────────
// Each class has efficiency / attunement / luck affixes, and some gathering
// classes can also roll treasure sense.
//   Efficiency → speed of resource generation
//   Attunement → output quantity bonus
//   Luck       → chance for bonus / rare items

export const CLASS_AFFIX_POOLS = {
  miner: [
    { id: 'miningEfficiency',  label: 'Mining Efficiency',  stat: 'miningSpeed'        },
    { id: 'miningAttunement',  label: 'Mining Attunement',  stat: 'miningAttunement'   },
    { id: 'miningLuck',        label: 'Mining Luck',        stat: 'miningLuck'         },
  ],
  blacksmith: [
    { id: 'smeltingEfficiency',  label: 'Smelting Efficiency',  stat: 'smeltingSpeed'       },
    { id: 'smeltingAttunement',  label: 'Smelting Attunement',  stat: 'smeltingAttunement'  },
    { id: 'smeltingLuck',        label: 'Smelting Luck',        stat: 'smeltingLuck'        },
  ],
  lumberjack: [
    { id: 'loggingEfficiency',  label: 'Logging Efficiency',  stat: 'gatheringSpeed'      },
    { id: 'loggingAttunement',  label: 'Logging Attunement',  stat: 'loggingAttunement'   },
    { id: 'loggingLuck',        label: 'Logging Luck',        stat: 'loggingLuck'         },
    { id: 'treasureSense',      label: 'Treasure Sense',      stat: 'treasureSense'       },
  ],
  hunter: [
    { id: 'huntingEfficiency',  label: 'Hunting Efficiency',  stat: 'huntingSpeed'       },
    { id: 'huntingAttunement',  label: 'Hunting Attunement',  stat: 'huntingAttunement'  },
    { id: 'huntingLuck',        label: 'Hunting Luck',        stat: 'huntingLuck'        },
    { id: 'treasureSense',      label: 'Treasure Sense',      stat: 'treasureSense'      },
  ],
  merchant: [
    { id: 'tradeEfficiency',  label: 'Trade Efficiency',  stat: 'tradeEfficiency'  },
    { id: 'tradeAttunement',  label: 'Trade Attunement',  stat: 'tradeAttunement'  },
    { id: 'tradeLuck',        label: 'Trade Luck',        stat: 'tradeLuck'        },
  ],
  warrior: [
    { id: 'combatEfficiency',  label: 'Combat Efficiency',  stat: 'combatEfficiency'  },
    { id: 'combatAttunement',  label: 'Combat Attunement',  stat: 'combatAttunement'  },
    { id: 'combatLuck',        label: 'Combat Luck',        stat: 'combatLuck'        },
  ],
  mage: [
    { id: 'arcaneEfficiency',  label: 'Arcane Efficiency',  stat: 'arcaneEfficiency'  },
    { id: 'arcaneAttunement',  label: 'Arcane Attunement',  stat: 'arcaneAttunement'  },
    { id: 'arcaneLuck',        label: 'Arcane Luck',        stat: 'arcaneLuck'        },
  ],
  bard: [
    { id: 'inspirationEfficiency',  label: 'Inspiration Efficiency',  stat: 'inspirationEfficiency'  },
    { id: 'inspirationAttunement',  label: 'Inspiration Attunement',  stat: 'inspirationAttunement'  },
    { id: 'inspirationLuck',        label: 'Inspiration Luck',        stat: 'inspirationLuck'        },
  ],
  forager: [
    { id: 'foragingEfficiency',  label: 'Foraging Efficiency',  stat: 'gatheringSpeed'      },
    { id: 'foragingAttunement',  label: 'Foraging Attunement',  stat: 'foragingAttunement'  },
    { id: 'foragingLuck',        label: 'Foraging Luck',        stat: 'foragingLuck'        },
    { id: 'treasureSense',       label: 'Treasure Sense',       stat: 'treasureSense'       },
  ],
};

// ── General Affix Pool (any class can roll these) ──────────────────────────────

export const GENERAL_AFFIXES = [
  { id: 'coinGeneration',     label: 'Coin Generation',     stat: 'coinGeneration',     minTier: 1 },
  ...ELEMENTAL_ATTUNEMENT_AFFIXES.map(affix => ({ ...affix, minTier: 1 })),
  { id: 'resourceGeneration', label: 'Resource Generation', stat: 'resourceGeneration', minTier: 1 },
  { id: 'productionSpeed',    label: 'Production Speed',    stat: 'productionSpeed',    minTier: 1 },
  { id: 'craftsmanship',      label: 'Craftsmanship',       stat: 'craftsmanship',      minTier: 2 },
  { id: 'overflow',           label: 'Overflow',            stat: 'overflow',           minTier: 2 },
  { id: 'prosperity',         label: 'Prosperity',          stat: 'prosperity',         minTier: 3 },
];

// Flat map of all affix definitions keyed by id — used for label lookup, display, etc.
export const CARD_AFFIXES = Object.fromEntries([
  ...Object.values(CLASS_AFFIX_POOLS).flat(),
  ...GENERAL_AFFIXES,
].map(affix => [affix.id, affix]));

// All unique stat keys across all affixes
const ALL_AFFIX_STATS = [...new Set([
  ...Object.values(CLASS_AFFIX_POOLS).flat().map(a => a.stat),
  ...GENERAL_AFFIXES.map(a => a.stat),
])];

export const DEFAULT_ACTIVE_AFFIX_BONUSES = Object.freeze(
  Object.fromEntries(ALL_AFFIX_STATS.map(stat => [stat, 0])),
);

// ── Pack Types (unchanged) ────────────────────────────────────────────────────

export const BASE_PACK_TIER_DISTRIBUTION = {
  1: 78,
  2: 15,
  3: 5,
  4: 1.7,
  5: 0.3,
};

export const CATALYST_TIER_DISTRIBUTIONS = {
  'emberstep-catalyst': {
    1: 70,
    2: 22,
    3: 6,
    4: 1.8,
    5: 0.2,
  },
  'crestforge-catalyst': {
    1: 68,
    2: 16,
    3: 12,
    4: 3.5,
    5: 0.5,
  },
  'mythrise-catalyst': {
    1: 66,
    2: 15,
    3: 8,
    4: 9,
    5: 2,
  },
  'zenith-catalyst': {
    1: 63,
    2: 14,
    3: 8,
    4: 10,
    5: 5,
  },
};

export const INSCRIPTION_SIGIL_TAG_BOOSTS = {
  'tideglow-sigil': {
    tag: 'holo',
    weightMultiplier: 3.5,
  },
  'windluster-sigil': {
    tag: 'foil',
    weightMultiplier: 3.5,
  },
  'ashmirror-sigil': {
    tag: 'reverse',
    weightMultiplier: 3.5,
  },
  'cinderveil-sigil': {
    tag: 'shadow',
    weightMultiplier: 4.0,
  },
  'riftheart-sigil': {
    tag: 'nexus',
    weightMultiplier: 4.0,
  },
  'starprism-sigil': {
    tag: 'prismatic',
    weightMultiplier: 5.0,
  },
  'dawnmark-sigil': {
    tag: 'firstEdition',
    weightMultiplier: 5.0,
  },
};

// Tags — rolled independently, stack on top of rarity+tier
// multiplier applies to the final (rarity × tier) value
export const TAGS = {
  holo:         { name: 'Holo',         multiplier: 1.45, weight: 35 },
  foil:         { name: 'Foil',         multiplier: 1.25, weight: 30 },
  reverse:      { name: 'Reverse',      multiplier: 1.30, weight: 15 },
  shadow:       { name: 'Shadow',       multiplier: 1.80, weight: 8  },
  nexus:        { name: 'Nexus',        multiplier: 2.10, weight: 6  },
  prismatic:    { name: 'Prismatic',    multiplier: 1.75, weight: 4  },
  firstEdition: { name: '1st Edition',  multiplier: 3.50, weight: 2  },
};

// Base probability that any card receives a tag at all
const TAG_CHANCE = 0.14;

/**
 * The permanently-stocked packs — a clean cheap-to-expensive ladder. Everything else is a rotation deal.
 *
 * The shop carried 21 purchasable packs across five shelves, which is more choices than a player can hold
 * in mind and left most of them permanently ignored. The Horizon Set (dawn / steel / mystic / abyss /
 * eternal) was deleted outright: it was five 10-card near-duplicates of this ladder at overlapping prices.
 */
export const PERMANENT_PACK_IDS = ['dusk', 'iron', 'arcane', 'void', 'primordial'];

/** Stocked a few at a time by the rotation. See `src/game/shop.js`. */
export const ROTATION_PACK_IDS = [
  'vault1', 'vault2', 'vault3',
  'holoEd', 'foilEd', 'reverseEd', 'shadowEd', 'nexusEd', 'prismaticEd',
];

/**
 * Where a HELD pack of a deleted type goes when an old save is loaded.
 *
 * `PACK_TYPES[id] ?? PACK_TYPES.iron` already keeps such a save from crashing, but silently — a 10-card
 * Mystic (18g) would open as a 5-card Iron (5g), which is a real loss for something the player paid for.
 * These map to the nearest survivor by price instead, so the value roughly holds.
 */
export const RETIRED_PACK_REPLACEMENTS = {
  dawn: 'iron',        // 5.50 -> 5.00
  steel: 'arcane',     // 9.00 -> 10.00
  mystic: 'void',      // 18.00 -> 18.00
  abyss: 'primordial', // 33.00 -> 30.00
  eternal: 'primordial', // 55.00 -> 30.00, the closest that still exists
};

export const PACK_TYPES = {
  // ── Set 1: Classic (5 cards) ────────────────────────────────────────
  dusk: {
    id: 'dusk', name: 'Dusk', subtitle: 'Pack', cardCount: 5,
    cost: 3.00, stars: '✦',
    description: 'Mostly commons · Good for grinding',
    rarityWeights: { common: 70, uncommon: 22, rare: 6,  epic: 1.75, legendary: 0.25, mythic: 0   },
    tierWeights:   { 1: 68,  2: 22, 3: 8,  4: 2,  5: 0  },
  },
  iron: {
    id: 'iron', name: 'Iron', subtitle: 'Pack', cardCount: 5,
    cost: 5.00, stars: '✦ ✦ ✦',
    description: 'Balanced odds · The reliable pick',
    rarityWeights: { common: 57, uncommon: 26, rare: 13, epic: 3,   legendary: 0.75, mythic: 0.25 },
    tierWeights:   { 1: 45,  2: 28, 3: 16, 4: 8,  5: 3  },
  },
  blankSlate: {
    id: 'blankSlate', name: 'Blank Slate', subtitle: 'Pack', cardCount: 5,
    cost: 6.00, stars: '◌ ◌ ◌',
    description: 'Attunement-ready · Arcana slots optional',
    rarityWeights: { common: 57, uncommon: 26, rare: 13, epic: 3, legendary: 0.75, mythic: 0.25 },
    tierWeights:   { 1: 78, 2: 15, 3: 5, 4: 1.7, 5: 0.3 },
  },
  treasure: {
    id: 'treasure', name: 'Treasure', subtitle: 'Pack', cardCount: 5,
    cost: 0, stars: '✦ ✦',
    description: 'Gold caches only · Found through Treasure Sense',
    rarityWeights: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 },
    tierWeights:   { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  },
  arcane: {
    id: 'arcane', name: 'Arcane', subtitle: 'Pack', cardCount: 5,
    cost: 10.00, stars: '✦ ✦ ✦ ✦ ✦',
    description: 'Rare+ boosted · Tier III common',
    rarityWeights: { common: 37, uncommon: 30, rare: 24, epic: 7,   legendary: 1.5,  mythic: 0.5  },
    tierWeights:   { 1: 28,  2: 30, 3: 25, 4: 13, 5: 4  },
  },
  void: {
    id: 'void', name: 'Void', subtitle: 'Pack', cardCount: 5,
    cost: 18.00, stars: '✦ ✦ ✦ ✦ ✦ ✦ ✦',
    description: 'Epic & Legendary frequent · Tier IV pulls',
    rarityWeights: { common: 15, uncommon: 23, rare: 33, epic: 22,  legendary: 2.5,  mythic: 1    },
    tierWeights:   { 1: 12,  2: 20, 3: 30, 4: 25, 5: 13 },
  },
  primordial: {
    id: 'primordial', name: 'Primordial', subtitle: 'Pack', cardCount: 5,
    cost: 30.00, stars: '✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦',
    description: 'Legendary & Mythic accessible · Tier V likely',
    rarityWeights: { common: 7,  uncommon: 14, rare: 30, epic: 34,  legendary: 5.5,  mythic: 2    },
    tierWeights:   { 1: 5,   2: 12, 3: 25, 4: 33, 5: 25 },
  },

  // ── Set 2: Expanded (10 cards) ───────────────────────────────────────
// ── Set 3: Vault (20 cards) ──────────────────────────────────────────
  vault1: {
    id: 'vault1', name: 'Bastion', subtitle: 'Vault', cardCount: 20,
    cost: 120.00, stars: '◆ ◆ ◆',
    description: '20 cards · Rare guaranteed',
    rarityWeights: { common: 13, uncommon: 23, rare: 40, epic: 18,  legendary: 2,   mythic: 0.75 },
    tierWeights:   { 1: 15,  2: 24, 3: 30, 4: 22, 5: 9  },
  },
  vault2: {
    id: 'vault2', name: 'Aurum', subtitle: 'Vault', cardCount: 20,
    cost: 260.00, stars: '◆ ◆ ◆ ◆ ◆',
    description: '20 cards · Epic dominant',
    rarityWeights: { common: 4,  uncommon: 10, rare: 24, epic: 44,  legendary: 3.25, mythic: 1.25 },
    tierWeights:   { 1: 4,   2: 12, 3: 26, 4: 34, 5: 24 },
  },
  vault3: {
    id: 'vault3', name: 'Nexus', subtitle: 'Vault', cardCount: 20,
    cost: 520.00, stars: '◆ ◆ ◆ ◆ ◆ ◆ ◆',
    description: '20 cards · Mythic accessible',
    rarityWeights: { common: 0,  uncommon: 2,  rare: 10, epic: 30,  legendary: 5,   mythic: 2.25 },
    tierWeights:   { 1: 0,   2: 4,  3: 16, 4: 34, 5: 46 },
  },

  // ── Set 4: Tag Editions (15 cards, boosted tag odds) ────────────────
  holoEd: {
    id: 'holoEd', name: 'Chromatic', subtitle: 'Edition', cardCount: 15,
    cost: 35.00, stars: '◈ ◈ ◈ ◈',
    description: '15 cards · 1.2× Holo odds',
    tagBoost: { tag: 'holo', multiplier: 1.2, exclusive: true },
    rarityWeights: { common: 27, uncommon: 32, rare: 27, epic: 10, legendary: 3,  mythic: 1 },
    tierWeights:   { 1: 22,  2: 28, 3: 26, 4: 16, 5: 8  },
  },
  foilEd: {
    id: 'foilEd', name: 'Sterling', subtitle: 'Edition', cardCount: 15,
    cost: 28.00, stars: '◈ ◈ ◈',
    description: '15 cards · 1.2× Foil odds',
    tagBoost: { tag: 'foil', multiplier: 1.2, exclusive: true },
    rarityWeights: { common: 27, uncommon: 32, rare: 27, epic: 10, legendary: 3,  mythic: 1 },
    tierWeights:   { 1: 22,  2: 28, 3: 26, 4: 16, 5: 8  },
  },
  reverseEd: {
    id: 'reverseEd', name: 'Mirror', subtitle: 'Edition', cardCount: 15,
    cost: 30.00, stars: '◈ ◈ ◈',
    description: '15 cards · 1.2× Reverse odds',
    tagBoost: { tag: 'reverse', multiplier: 1.2, exclusive: true },
    rarityWeights: { common: 27, uncommon: 32, rare: 27, epic: 10, legendary: 3,  mythic: 1 },
    tierWeights:   { 1: 22,  2: 28, 3: 26, 4: 16, 5: 8  },
  },
  shadowEd: {
    id: 'shadowEd', name: 'Umbra', subtitle: 'Edition', cardCount: 15,
    cost: 48.00, stars: '◈ ◈ ◈ ◈ ◈',
    description: '15 cards · 1.2× Shadow odds',
    tagBoost: { tag: 'shadow', multiplier: 1.2, exclusive: true },
    rarityWeights: { common: 27, uncommon: 32, rare: 27, epic: 10, legendary: 3,  mythic: 1 },
    tierWeights:   { 1: 22,  2: 28, 3: 26, 4: 16, 5: 8  },
  },
  nexusEd: {
    id: 'nexusEd', name: 'Rift', subtitle: 'Edition', cardCount: 15,
    cost: 58.00, stars: '◈ ◈ ◈ ◈ ◈ ◈',
    description: '15 cards · 1.2× Nexus odds',
    tagBoost: { tag: 'nexus', multiplier: 1.2, exclusive: true },
    rarityWeights: { common: 27, uncommon: 32, rare: 27, epic: 10, legendary: 3,  mythic: 1 },
    tierWeights:   { 1: 22,  2: 28, 3: 26, 4: 16, 5: 8  },
  },
  prismaticEd: {
    id: 'prismaticEd', name: 'Spectrum', subtitle: 'Edition', cardCount: 15,
    cost: 45.00, stars: '◈ ◈ ◈ ◈ ◈',
    description: '15 cards · 1.2× Prismatic odds',
    tagBoost: { tag: 'prismatic', multiplier: 1.2, exclusive: true },
    rarityWeights: { common: 27, uncommon: 32, rare: 27, epic: 10, legendary: 3,  mythic: 1 },
    tierWeights:   { 1: 22,  2: 28, 3: 26, 4: 16, 5: 8  },
  },
};

export const WELCOME_PACK_TYPE = {
  id: 'welcome',
  name: 'Welcome Pack',
  subtitle: 'Initiate Bundle',
  cardCount: 9,
  cost: 0,
  stars: '✧ ✧ ✧',
  description: 'One of every class · Tier I commons · First steps',
  rarityWeights: { common: 100 },
  tierWeights: { 1: 100 },
};

export function getPackTypeById(packTypeId) {
  return packTypeId === 'welcome'
    ? WELCOME_PACK_TYPE
    : (PACK_TYPES[packTypeId] ?? PACK_TYPES.iron);
}

export function openTreasurePack() {
  return Array.from({ length: 5 }, (_, index) => {
    const amount = rollIntInRange(10, 250);
    const artKey = amount >= 50 ? 'lots of coins' : 'few coins';
    return {
      id: `treasure-reward-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      type: 'coins',
      name: amount >= 50 ? 'Lots of Coins' : 'Few Coins',
      amount,
      artKey,
      description: 'A treasure cache of claimable gold pulled from a discovered treasure pack.',
    };
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * The project's single money formatter: grouped thousands, always two decimals.
 * `10000` reads as `10,000.00`, which is legible at a glance where `10000.00` is not.
 */
export function fmt(amount) {
  return Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtStr(amount) {
  return `⬡ ${fmt(amount)}`;
}

function rollPercentInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollDecimalInRange(min, max) {
  const raw = min + Math.random() * (max - min);
  return Math.round(raw * 100) / 100;
}

function rollIntInRange(min, max) {
  const floorMin = Math.ceil(min);
  const floorMax = Math.floor(max);
  return Math.floor(Math.random() * (floorMax - floorMin + 1)) + floorMin;
}

function resolveAffixDefinition(affix) {
  const affixId = typeof affix === 'string' ? affix : affix?.id;
  if (!affixId) return null;
  // Legacy migration: old miningSpeed / gatheringSpeed / ingotSmelting IDs map directly
  return CARD_AFFIXES[affixId] ?? null;
}

function resolveAffixStat(affix) {
  return affix?.stat ?? resolveAffixDefinition(affix)?.stat ?? null;
}

export function formatAffixText(affix) {
  const affixDef = resolveAffixDefinition(affix);
  const label = affixDef?.label ?? affix?.id ?? '';
  return `+${affix.value}% ${label}`;
}

export function getCardAffixBonuses(card) {
  const bonuses = { ...DEFAULT_ACTIVE_AFFIX_BONUSES };
  for (const affix of card?.affixes ?? []) {
    const stat = resolveAffixStat(affix);
    if (!stat || bonuses[stat] == null) continue;
    bonuses[stat] += affix.value ?? 0;
  }
  return bonuses;
}

export function getActiveAffixBonuses(activeCards = []) {
  const totals = { ...DEFAULT_ACTIVE_AFFIX_BONUSES };
  for (const card of activeCards ?? []) {
    for (const affix of card?.affixes ?? []) {
      const stat = resolveAffixStat(affix);
      if (!stat || totals[stat] == null) continue;
      totals[stat] += affix.value ?? 0;
    }
  }
  return totals;
}

export function rollAffixProcChance(percent) {
  const chance = Math.max(0, Number(percent) || 0);
  if (chance <= 0) return false;
  return Math.random() * 100 < chance;
}

export function rollAttunementBonus(card, stat) {
  const chance = getCardAffixBonuses(card)?.[stat] ?? 0;
  return rollAffixProcChance(chance) ? 1 : 0;
}

export function rollCoinGenerationReward(card) {
  const bonuses = getCardAffixBonuses(card);
  const procChance = bonuses.coinGeneration ?? 0;
  if (!rollAffixProcChance(procChance)) return 0;
  const [minReward, maxReward] = COIN_GENERATION_REWARD_RANGES[card?.rarity] ?? COIN_GENERATION_REWARD_RANGES.common;
  return rollIntInRange(minReward, maxReward);
}

export function rollElementalAttunementDrops(card) {
  const bonuses = getCardAffixBonuses(card);
  const drops = {};
  for (const affix of ELEMENTAL_ATTUNEMENT_AFFIXES) {
    const procChance = bonuses[affix.stat] ?? 0;
    if (!rollAffixProcChance(procChance)) continue;
    const resourceId = getElementResourceId(affix.elementId, 'mote');
    drops[resourceId] = (drops[resourceId] ?? 0) + 1;
  }
  return drops;
}

// ── Rolling ───────────────────────────────────────────────────────────────────

function rollRarity(weights) {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [key, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return 'common';
}

function rollTier(weights) {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [key, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return Number(key);
  }
  return 1;
}

export function rollUnitClass() {
  return UNIT_CLASSES[Math.floor(Math.random() * UNIT_CLASSES.length)];
}

// ── Affixes ───────────────────────────────────────────────────────────────────

/**
 * Roll affixes for a unit card.
 * Tier = affix count (1–5).
 * Pool = class-specific affixes (3) + general affixes filtered by minTier.
 * Drawn without replacement — no duplicate affixes.
 */
export function rollCardAffixes(classType, rarity, tier = 1) {
  const affixCount = Math.max(1, Math.min(Number(tier) || 1, 5));
  const [minValue, maxValue] = AFFIX_VALUE_RANGES[rarity] ?? AFFIX_VALUE_RANGES.common;

  const classPool = (CLASS_AFFIX_POOLS[classType] ?? []).map(a => ({ ...a }));
  const generalPool = GENERAL_AFFIXES.filter(a => tier >= (a.minTier ?? 1)).map(a => ({ ...a }));
  const combined = [...classPool, ...generalPool];

  const rolledAffixes = [];
  const remaining = [...combined];

  for (let i = 0; i < affixCount && remaining.length > 0; i++) {
    const index = Math.floor(Math.random() * remaining.length);
    const affixDef = remaining.splice(index, 1)[0];
    const baseValue = rollPercentInRange(minValue, maxValue);
    const isHigher = Math.random() < HIGHER_AFFIX_CHANCE;
    rolledAffixes.push({
      id: affixDef.id,
      stat: affixDef.stat,
      value: isHigher ? baseValue * HIGHER_AFFIX_MULTIPLIER : baseValue,
      isHigher,
    });
  }

  return rolledAffixes;
}

// ── Arcana slot resolution (unchanged) ────────────────────────────────────────

function resolveCatalystConfig(selectedCatalyst = null) {
  if (!selectedCatalyst) return null;
  if (typeof selectedCatalyst === 'string') return ARCANA_ITEMS_BY_ID[selectedCatalyst] ?? null;
  if (selectedCatalyst.itemId) return ARCANA_ITEMS_BY_ID[selectedCatalyst.itemId] ?? null;
  if (selectedCatalyst.id) return ARCANA_ITEMS_BY_ID[selectedCatalyst.id] ?? null;
  return null;
}

function resolveSigilConfig(selectedSigil = null) {
  if (!selectedSigil) return null;
  if (typeof selectedSigil === 'string') return ARCANA_ITEMS_BY_ID[selectedSigil] ?? null;
  if (selectedSigil.itemId) return ARCANA_ITEMS_BY_ID[selectedSigil.itemId] ?? null;
  if (selectedSigil.id) return ARCANA_ITEMS_BY_ID[selectedSigil.id] ?? null;
  return null;
}

export function resolveActiveTierDistribution(selectedCatalyst = null) {
  const catalystConfig = resolveCatalystConfig(selectedCatalyst);
  if (!catalystConfig) return BASE_PACK_TIER_DISTRIBUTION;
  if (catalystConfig.category !== 'catalyst') return BASE_PACK_TIER_DISTRIBUTION;
  if (catalystConfig.effect?.slot !== ARCANA_SLOTS.SURGE) return BASE_PACK_TIER_DISTRIBUTION;
  return CATALYST_TIER_DISTRIBUTIONS[catalystConfig.id] ?? BASE_PACK_TIER_DISTRIBUTION;
}

export function rollTierFromDistribution(selectedCatalyst = null) {
  return rollTier(resolveActiveTierDistribution(selectedCatalyst));
}

export function resolveModifiedTagWeights(selectedSigil = null, packBoost = null) {
  const weights = Object.fromEntries(
    Object.entries(TAGS).map(([tagId, tagData]) => [tagId, tagData.weight]),
  );

  const sigilConfig = resolveSigilConfig(selectedSigil);
  if (
    sigilConfig?.category === 'sigil' &&
    sigilConfig.effect?.slot === ARCANA_SLOTS.INSCRIPTION
  ) {
    const sigilBoost = INSCRIPTION_SIGIL_TAG_BOOSTS[sigilConfig.id];
    if (sigilBoost && weights[sigilBoost.tag] != null) {
      weights[sigilBoost.tag] *= sigilBoost.weightMultiplier;
    }
  }

  if (packBoost?.tag && weights[packBoost.tag] != null) {
    weights[packBoost.tag] *= packBoost.multiplier;
  }

  return weights;
}

function rollTag(packBoost = null, selectedSigil = null) {
  if (Math.random() > TAG_CHANCE) return null;
  if (packBoost?.exclusive) return packBoost.tag;
  const weights = resolveModifiedTagWeights(selectedSigil, packBoost);
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [key, w] of Object.entries(weights)) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return null;
}

function rollValue(rarity, tier, tag) {
  const { valueMin, valueMax } = RARITIES[rarity];
  const base = valueMin + Math.random() * (valueMax - valueMin);
  const tagMult = tag ? TAGS[tag].multiplier : 1;
  const raw = base * TIERS[tier].multiplier * tagMult;
  return Math.round(raw * 100) / 100;
}

// ── Identity ──────────────────────────────────────────────────────────────────

/**
 * The id primitive — UUIDv4 — used for cards and for held packs. The reason is worth stating because
 * the counter it replaced looked perfectly serviceable.
 *
 * It was `let nextId = Date.now()` incremented per card, which makes identity a function of *when a
 * client started* rather than of the card. Two consequences:
 *
 *   1. It re-seeds from the wall clock on every page load. Mint more cards in one session than there
 *      are milliseconds since it began and the counter runs into the future, so the next reload hands
 *      out ids that are already taken. Reachable, if only barely, from the Lab's fusion loop.
 *   2. It is not unique across clients at all. Two players opening a pack in the same millisecond get
 *      the same ids — so the moment a server holds both collections, or one save is imported into
 *      another, cards silently collide and overwrite. Card ids key the collection, the hand, every
 *      station slot and the drag payload, so a collision is not a cosmetic clash: it grafts one
 *      player's card onto another's slot.
 *
 * A UUID is unique without coordination, which is the property a distributed system needs and a
 * counter cannot have. It also survives JSON, `String()` and use as a React key unchanged, which a
 * float id (`Date.now() + Math.random()`) does not reliably do.
 *
 * `crypto.randomUUID` needs a secure context. Vercel is https, localhost counts, and the Electron
 * shell registers `app://` as `secure` precisely so this kind of API works — but the fallback stays,
 * because a silent throw here would break card creation entirely, and `getRandomValues` has no such
 * requirement.
 */
export function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 from raw random bytes: set the version nibble to 4 and the variant bits to 10.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The one place a card comes into existence. Every generator below routes through it.
 *
 * Worth the indirection over three inline `id: newCardId()` calls because this is the seam a server
 * eventually replaces: when the backend mints cards, the client stops choosing ids and starts being
 * handed them, and that is a change to this function rather than a hunt through the generators. It is
 * also the natural home for anything else that must be true of *every* card — a provenance stamp, a
 * schema version — none of which exists yet, which is exactly why the boundary should exist first.
 */
export function mintCard(fields) {
  return { id: newId(), ...fields };
}

const NEW_PLAYER_BOOST = 10;

// ── Pack Opening ──────────────────────────────────────────────────────────────

export function openPack(packTypeId = 'iron', boosted = false, options = {}) {
  const packType = PACK_TYPES[packTypeId] ?? PACK_TYPES.iron;
  const size = packType.cardCount ?? 5;
  const tierDistribution = resolveActiveTierDistribution(options.selectedCatalyst ?? options.surgeCatalyst ?? null);
  const selectedSigil = options.selectedSigil ?? options.inscriptionSigil ?? null;
  const weights = boosted
    ? {
        ...packType.rarityWeights,
        legendary: (packType.rarityWeights.legendary || 1) * NEW_PLAYER_BOOST,
        mythic:    (packType.rarityWeights.mythic    || 0.5) * NEW_PLAYER_BOOST,
      }
    : packType.rarityWeights;

  return Array.from({ length: size }, () => {
    const rarity    = rollRarity(weights);
    const tier      = rollTier(tierDistribution);
    const tag       = rollTag(packType.tagBoost ?? null, selectedSigil);
    const unitClass = rollUnitClass();
    const value     = rollValue(rarity, tier, tag);
    const affixes   = rollCardAffixes(unitClass.id, rarity, tier);
    return mintCard({
      name: resolveCardName(unitClass.id, rarity, tier),
      classType: unitClass.id,
      artVariant: Math.floor(Math.random() * 5),
      rarity,
      tier,
      tag,
      value,
      affixes,
    });
  });
}

// Welcome pack — one tier-1 common for every class, given free on first launch.
export function openWelcomePack() {
  return UNIT_CLASSES.map(unitClass => {
    const rarity  = 'common';
    const tier    = 1;
    const value   = rollValue(rarity, tier, null);
    const affixes = rollCardAffixes(unitClass.id, rarity, tier);
    return mintCard({
      name: resolveCardName(unitClass.id, rarity, tier),
      classType: unitClass.id,
      artVariant: Math.floor(Math.random() * 5),
      rarity,
      tier,
      tag: null,
      value,
      affixes,
    });
  });
}

export const STARTING_BALANCE = 25.00;
export const CARDS_PER_PACK = 5;

// ── Lab: Card Grading ─────────────────────────────────────────────────────────

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export const GRADE_COSTS = {
  common: 3, uncommon: 8, rare: 20, epic: 50, legendary: 125, mythic: 300,
};

export const GRADE_MULTIPLIERS = {
  1: 0.50, 2: 0.65, 3: 0.80, 4: 0.95, 5: 1.10,
  6: 1.35, 7: 1.65, 8: 2.20, 9: 3.00, 10: 5.00,
};

export const GRADE_FLOOR = {
  common: 1, uncommon: 1, rare: 1, epic: 2, legendary: 3, mythic: 5,
};

export function rollGrade(rarity = 'common') {
  const floor = GRADE_FLOOR[rarity] ?? 1;
  const weights = [2, 4, 6, 10, 16, 22, 20, 12, 6, 2];
  for (let i = 0; i < floor - 1; i++) weights[i] = 0;
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return i + 1;
  }
  return Math.max(7, floor);
}

export function getCardSellValue(card) {
  if (!card.grade) return card.value;
  return Math.round(card.value * GRADE_MULTIPLIERS[card.grade] * 100) / 100;
}

// ── Lab: Fusion ───────────────────────────────────────────────────────────────

export const FUSION_RECIPES = {
  common:    { count: 3, cost: 3.00,   successRate: 0.75, result: 'uncommon'  },
  uncommon:  { count: 4, cost: 8.00,   successRate: 0.55, result: 'rare'      },
  rare:      { count: 5, cost: 20.00,  successRate: 0.30, result: 'epic'      },
  epic:      { count: 6, cost: 60.00,  successRate: 0.18, result: 'legendary' },
  legendary: { count: 7, cost: 150.00, successRate: 0.06, result: 'mythic'    },
};

export function makeCard(rarity, classType = null) {
  const tier       = rollTier({ 1: 45, 2: 28, 3: 16, 4: 8, 5: 3 });
  const unitClass  = classType
    ? (UNIT_CLASSES_BY_ID[classType] ?? rollUnitClass())
    : rollUnitClass();
  const value      = rollValue(rarity, tier, null);
  const affixes    = rollCardAffixes(unitClass.id, rarity, tier);
  return mintCard({
    name: resolveCardName(unitClass.id, rarity, tier),
    classType: unitClass.id,
    artVariant: Math.floor(Math.random() * 5),
    rarity,
    tier,
    tag: null,
    value,
    affixes,
  });
}

// ── Lab: Tag Imprinting ───────────────────────────────────────────────────────

export const IMPRINT_DATA = {
  holo:         { baseCost: 25,  failRate: 0.20 },
  foil:         { baseCost: 20,  failRate: 0.25 },
  reverse:      { baseCost: 22,  failRate: 0.22 },
  shadow:       { baseCost: 45,  failRate: 0.38 },
  nexus:        { baseCost: 65,  failRate: 0.50 },
  prismatic:    { baseCost: 55,  failRate: 0.45 },
  firstEdition: { baseCost: 130, failRate: 0.70 },
};

export const IMPRINT_RARITY_MULT = {
  common: 1.0, uncommon: 1.6, rare: 2.8, epic: 5.0, legendary: 9.0, mythic: 18.0,
};

export function getImprintCost(tag, rarity) {
  const base = IMPRINT_DATA[tag]?.baseCost ?? 0;
  const mult = IMPRINT_RARITY_MULT[rarity] ?? 1;
  return Math.round(base * mult);
}

// ── Lab: Fuse Score ───────────────────────────────────────────────────────────

export function computeFuseScore(inputCards) {
  return inputCards.length + inputCards.reduce((sum, c) => sum + (c.fuseScore ?? 0), 0);
}

export function getFuseSuccessRate(recipe, fuseScore) {
  const bonus = Math.min((fuseScore ?? 0) * 0.015, 0.20);
  return Math.min(recipe.successRate + bonus, 0.95);
}

export function rollTagInheritance(inputCards, fuseScore) {
  const tagged = inputCards.filter(c => c.tag);
  if (tagged.length === 0) return null;

  const tagCounts = {};
  for (const c of tagged) tagCounts[c.tag] = (tagCounts[c.tag] ?? 0) + 1;

  const maxDupes = Math.max(...Object.values(tagCounts));
  const dupeBonus = (maxDupes - 1) * 0.12;

  const chance = Math.min(0.10 + (fuseScore ?? 0) * 0.025 + dupeBonus, 0.90);
  if (Math.random() > chance) return null;

  const weights = {};
  for (const c of tagged) {
    const w = tagCounts[c.tag] * (1 + (c.fuseScore ?? 0) * 0.15);
    weights[c.tag] = (weights[c.tag] ?? 0) + w;
  }
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  let roll = Math.random() * total;
  for (const [tag, w] of Object.entries(weights)) {
    roll -= w;
    if (roll <= 0) return tag;
  }
  return tagged[0].tag;
}

export function getImprintSuccessChance(tag, _rarity, fuseScore) {
  const base = 1 - IMPRINT_DATA[tag].failRate;
  const bonus = Math.min((fuseScore ?? 0) * 0.02, 0.25);
  return Math.min(base + bonus, 0.96);
}

export const GRADEABLE_RARITIES = new Set(['legendary', 'mythic']);

export function getGradeCost(card) {
  const base = GRADE_COSTS[card.rarity];
  const attempts = card.gradeAttempts ?? 0;
  return attempts === 0 ? base : Math.round(base * Math.pow(2, attempts));
}

// ── Save Migration Helper ─────────────────────────────────────────────────────

/**
 * Migrate a legacy creature card (no classType) to a unit card.
 * Preserves id, rarity, tier, tag, value, grade, fuseScore.
 * Assigns a random class and re-rolls affixes from that class's pool.
 */
export function migrateCreatureCard(card) {
  if (card.classType) return card; // already migrated
  const unitClass = rollUnitClass();
  const tier = card.tier ?? 1;
  const affixes = rollCardAffixes(unitClass.id, card.rarity, tier);
  return {
    ...card,
    name: resolveCardName(unitClass.id, card.rarity, tier),
    classType: unitClass.id,
    affixes,
    elements: undefined, // remove legacy field
  };
}
