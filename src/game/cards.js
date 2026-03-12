export const RARITIES = {
  common:    { name: 'Common',    color: '#9ca3af', weight: 55, valueMin: 0.10,  valueMax: 1.00  },
  uncommon:  { name: 'Uncommon',  color: '#22c55e', weight: 25, valueMin: 1.00,  valueMax: 4.00  },
  rare:      { name: 'Rare',      color: '#3b82f6', weight: 12, valueMin: 4.00,  valueMax: 18.00 },
  epic:      { name: 'Epic',      color: '#a855f7', weight: 5,  valueMin: 18.00, valueMax: 65.00 },
  legendary: { name: 'Legendary', color: '#eab308', weight: 1,  valueMin: 65.00, valueMax: 200.00 },
  mythic:    { name: 'Mythic',    color: '#ef4444', weight: 0.5,  valueMin: 200.00, valueMax: 500.00 },
};

// Tier I–V: progressively rarer visual effects + value multiplier
export const TIERS = {
  1: { name: 'I',   weight: 45, multiplier: 1.0 },
  2: { name: 'II',  weight: 28, multiplier: 1.4 },
  3: { name: 'III', weight: 16, multiplier: 2.0 },
  4: { name: 'IV',  weight: 8,  multiplier: 3.2 },
  5: { name: 'V',   weight: 3,  multiplier: 5.5 },
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
    rarityWeights: { common: 15, uncommon: 23, rare: 33, epic: 22,  legendary: 5,    mythic: 2    },
    tierWeights:   { 1: 12,  2: 20, 3: 30, 4: 25, 5: 13 },
  },
  primordial: {
    id: 'primordial', name: 'Primordial', subtitle: 'Pack', cardCount: 5,
    cost: 30.00, stars: '✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦',
    description: 'Legendary & Mythic accessible · Tier V likely',
    rarityWeights: { common: 7,  uncommon: 14, rare: 30, epic: 34,  legendary: 11,   mythic: 4    },
    tierWeights:   { 1: 5,   2: 12, 3: 25, 4: 33, 5: 25 },
  },

  // ── Set 2: Expanded (10 cards) ───────────────────────────────────────
  dawn: {
    id: 'dawn', name: 'Dawn', subtitle: 'Pack', cardCount: 10,
    cost: 5.50, stars: '✦ ✦',
    description: '10 cards · Beginner friendly',
    rarityWeights: { common: 70, uncommon: 22, rare: 6,  epic: 1.75, legendary: 0.25, mythic: 0   },
    tierWeights:   { 1: 68,  2: 22, 3: 8,  4: 2,  5: 0  },
  },
  steel: {
    id: 'steel', name: 'Steel', subtitle: 'Pack', cardCount: 10,
    cost: 9.00, stars: '✦ ✦ ✦ ✦',
    description: '10 cards · Balanced draws',
    rarityWeights: { common: 57, uncommon: 26, rare: 13, epic: 3,   legendary: 0.75, mythic: 0.25 },
    tierWeights:   { 1: 45,  2: 28, 3: 16, 4: 8,  5: 3  },
  },
  mystic: {
    id: 'mystic', name: 'Mystic', subtitle: 'Pack', cardCount: 10,
    cost: 18.00, stars: '✦ ✦ ✦ ✦ ✦ ✦',
    description: '10 cards · Rare+ focused',
    rarityWeights: { common: 37, uncommon: 30, rare: 24, epic: 7,   legendary: 1.5,  mythic: 0.5  },
    tierWeights:   { 1: 28,  2: 30, 3: 25, 4: 13, 5: 4  },
  },
  abyss: {
    id: 'abyss', name: 'Abyss', subtitle: 'Pack', cardCount: 10,
    cost: 33.00, stars: '✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦',
    description: '10 cards · Epic & Legendary surge',
    rarityWeights: { common: 15, uncommon: 23, rare: 33, epic: 22,  legendary: 5,    mythic: 2    },
    tierWeights:   { 1: 12,  2: 20, 3: 30, 4: 25, 5: 13 },
  },
  eternal: {
    id: 'eternal', name: 'Eternal', subtitle: 'Pack', cardCount: 10,
    cost: 55.00, stars: '✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦',
    description: '10 cards · Near-mythic odds',
    rarityWeights: { common: 7,  uncommon: 14, rare: 30, epic: 34,  legendary: 11,   mythic: 4    },
    tierWeights:   { 1: 5,   2: 12, 3: 25, 4: 33, 5: 25 },
  },

  // ── Set 3: Vault (20 cards) ──────────────────────────────────────────
  vault1: {
    id: 'vault1', name: 'Bastion', subtitle: 'Vault', cardCount: 20,
    cost: 120.00, stars: '◆ ◆ ◆',
    description: '20 cards · Rare guaranteed',
    rarityWeights: { common: 13, uncommon: 23, rare: 40, epic: 18,  legendary: 4.5, mythic: 1.5 },
    tierWeights:   { 1: 15,  2: 24, 3: 30, 4: 22, 5: 9  },
  },
  vault2: {
    id: 'vault2', name: 'Aurum', subtitle: 'Vault', cardCount: 20,
    cost: 260.00, stars: '◆ ◆ ◆ ◆ ◆',
    description: '20 cards · Epic dominant',
    rarityWeights: { common: 4,  uncommon: 10, rare: 24, epic: 44,  legendary: 13,  mythic: 5   },
    tierWeights:   { 1: 4,   2: 12, 3: 26, 4: 34, 5: 24 },
  },
  vault3: {
    id: 'vault3', name: 'Nexus', subtitle: 'Vault', cardCount: 20,
    cost: 520.00, stars: '◆ ◆ ◆ ◆ ◆ ◆ ◆',
    description: '20 cards · Mythic accessible',
    rarityWeights: { common: 0,  uncommon: 2,  rare: 10, epic: 30,  legendary: 40,  mythic: 18  },
    tierWeights:   { 1: 0,   2: 4,  3: 16, 4: 34, 5: 46 },
  },

  // ── Set 4: Tag Editions (15 cards, 1.2× boosted tag odds) ────────────
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

const CARD_NAMES = {
  common: [
    // original 18
    'Stone Golem', 'Forest Sprite', 'River Eel', 'Cave Bat', 'Mud Toad', 'Thorn Bush', 'Dusty Crow', 'Marsh Rat',
    'Ember Beetle', 'Pond Skipper', 'Bramble Hare', 'Ash Lizard', 'Moss Turtle', 'Hollow Owl', 'Pebble Ram', 'Dune Scorpion',
    'Fungal Mole', 'Reed Viper',
    // 20 new
    'Bog Newt', 'Crag Spider', 'Leaf Sprite', 'Rustle Bat', 'Shore Crab', 'Gust Robin', 'Pale Moth', 'Briar Cat',
    'Flint Hog', 'Silt Frog', 'Candle Bug', 'Drift Seal', 'Cobble Imp', 'Burrow Rat', 'Snag Heron', 'Gravel Wyrm',
    'Tidal Shrimp', 'Cinderfly', 'Dusk Sparrow', 'Slack Mole',
  ],
  uncommon: [
    // original 16
    'Ironhorn Beetle', 'Gale Stag', 'Shadow Fox', 'Frostfang Lynx', 'Vine Viper', 'Storm Hawk',
    'Ashen Stag', 'Moonfang Wolf', 'Copper Scarab', 'Tide Runner', 'Blight Lynx', 'Runetail Gecko',
    'Sunscale Cobra', 'Gale Hound', 'Thicket Maw', 'Grave Jackal',
    // 20 new
    'Obsidian Moth', 'Sparktail Fox', 'Glacial Stag', 'Swamp Basilisk', 'Dusk Serpent', 'Ember Falcon',
    'Tide Prowler', 'Bone Raptor', 'Gilded Gecko', 'Crystal Hound', 'Hollow Stalker', 'Marsh Drake',
    'Thornback Lynx', 'Cinder Wraith', 'Wind Razorback', 'Nether Mink',
    'Coral Scythe', 'Bloodmoon Wolf', 'Veil Moth', 'Storm Beetle',
  ],
  rare: [
    // original 15
    'Sea Serpent', 'Lava Drake', 'Crystal Elemental', 'Void Panther', 'Thunder Bear',
    'Dread Antler', 'Frostfang Yeti', 'Sunforged Lion', 'Mist Leviathan', 'Grim Maw', 'Bloom Hydra', 'Storm Ram',
    'Obsidian Widow', 'Ironroot Behemoth', 'Cinder Roc',
    // 20 new
    'Frost Colossus', 'Plague Leviathan', 'Sun Hydra', 'Ashen Wyrm', 'Stormcaller Roc',
    'Deep Basilisk', 'Bone Titan', 'Void Chimera', 'Emberlord Fox', 'Glacial Sphinx',
    'Thornwall Golem', 'Abyssal Ray', 'Shiver Drake', 'Dusk Behemoth', 'Hollow Phoenix',
    'Ember Colossus', 'Void Serpent', 'Iron Revenant', 'Tempest Golem', 'Cinder Leviathan',
  ],
  epic: [
    // original 14
    'Ancient Dragon', 'Celestial Phoenix', 'Abyssal Titan', 'Arcane Behemoth',
    'Moonveil Serpent', 'Ember Tyrant', 'Storm Hydra', 'Verdant Leviathan', 'Duskwing Roc', 'Ivory Mammoth',
    'Runebound Chimera', 'Ashen Colossus', 'Void Reaver', 'Glacier Wyrm',
    // 20 new
    'Starfire Drake', 'Bone Leviathan', 'Dawnbreaker Titan', 'Shadow Colossus', 'Eternal Phoenix',
    'Plague Chimera', 'Iron Seraph', 'Voidborn Behemoth', 'Sundering Wyrm', 'Frostborn Titan',
    'Hollow Colossus', 'Tempest Chimera', 'Ashen Seraph', 'Crimson Leviathan', 'Storm Reaver',
    'Twilight Hydra', 'Cinder Colossus', 'Abyssal Seraph', 'Bone Chimera', 'Starborn Wyrm',
  ],
  legendary: [
    // original 13
    'The Undying Wyrm', 'World Eater', 'Eclipse Serpent',
    'First Behemoth', 'Starfall Drake', 'Hollow Mammoth', 'Tempest Leviathan', 'Ashen Roc', 'Nightfang Alpha',
    'Last Colossus', 'Dawnscale Seraph', 'Black Stag', 'Crownmaw',
    // 20 new
    'The First Dragon', 'Void Ascendant', 'Starborn Colossus', 'Ancient Nightmare', 'The Pale Leviathan',
    'Ember Crown', 'Dawnbreaker Wyrm', 'The Last Seraph', 'Frozen King', 'Blood Sovereign',
    'Hollow Titan', 'The Iron Revenant', 'Sundering Behemoth', 'The Void Shepherd', 'Celestial Warden',
    'Twilight Sovereign', 'Stormborn Titan', 'The Undying Colossus', 'Ashen Monarch', 'Bone Sovereign',
  ],
  mythic: [
    // original 12
    'Primordial Titan', 'Chaos Incarnate',
    'World Serpent', 'First Flame', 'Aether Warden', 'Final Horizon', 'Dream Devourer', 'Shatterhorn',
    'Astral Behemoth', 'Veilwyrm', 'Heart of the Abyss', 'Eclipsed Chimera',
    // 20 new
    'The Eternal Flame', 'Void Incarnate', 'World Breaker', 'The Last Light', 'Abyss Sovereign',
    'Cosmic Revenant', 'The Unborn', 'Starfall Titan', 'Heaven Eater', 'The Pale King',
    'Twilight Sovereign', 'The Shattered Crown', 'Abyssal Monarch', 'Void Pantheon', 'The Forgotten One',
    'Celestial Destroyer', 'Time Devourer', 'The Boundless', 'Fracture Incarnate', 'The Nameless One',
  ],
};

export function fmt(amount) {
  return `$${amount.toFixed(2)}`;
}

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

function rollTag(boost = null) {
  if (Math.random() > TAG_CHANCE) return null;
  if (boost?.exclusive) return boost.tag;
  const weights = {};
  for (const [key, t] of Object.entries(TAGS)) {
    weights[key] = (boost?.tag === key) ? t.weight * boost.multiplier : t.weight;
  }
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

let nextId = Date.now();

export function openPack(packTypeId = 'iron') {
  const packType = PACK_TYPES[packTypeId] ?? PACK_TYPES.iron;
  const size = packType.cardCount ?? 5;
  return Array.from({ length: size }, () => {
    const rarity = rollRarity(packType.rarityWeights);
    const tier   = rollTier(packType.tierWeights);
    const tag    = rollTag(packType.tagBoost ?? null);
    const names  = CARD_NAMES[rarity];
    const name   = names[Math.floor(Math.random() * names.length)];
    const value  = rollValue(rarity, tier, tag);
    return { id: nextId++, name, rarity, tier, tag, value };
  });
}

export const STARTING_BALANCE = 25.00;
export const CARDS_PER_PACK = 5;

// ── Lab: Card Grading ────────────────────────────────────────────────────────

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export const GRADE_COSTS = {
  common: 3, uncommon: 8, rare: 20, epic: 50, legendary: 125, mythic: 300,
};

// Value multiplier applied to base card value when graded
export const GRADE_MULTIPLIERS = {
  1: 0.50, 2: 0.65, 3: 0.80, 4: 0.95, 5: 1.10,
  6: 1.35, 7: 1.65, 8: 2.20, 9: 3.00, 10: 5.00,
};

// Minimum possible grade per rarity — higher rarity cards can't roll very low
export const GRADE_FLOOR = {
  common: 1, uncommon: 1, rare: 1, epic: 2, legendary: 3, mythic: 5,
};

export function rollGrade(rarity = 'common') {
  const floor = GRADE_FLOOR[rarity] ?? 1;
  // Bell curve weighted toward 6-7, rare 9-10 (indices 0-9 = grades 1-10)
  const weights = [2, 4, 6, 10, 16, 22, 20, 12, 6, 2];
  for (let i = 0; i < floor - 1; i++) weights[i] = 0; // zero out below floor
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

// ── Lab: Fusion ──────────────────────────────────────────────────────────────

export const FUSION_RECIPES = {
  common:    { count: 3, cost: 3.00,   successRate: 0.75, result: 'uncommon'  },
  uncommon:  { count: 4, cost: 8.00,   successRate: 0.55, result: 'rare'      },
  rare:      { count: 5, cost: 20.00,  successRate: 0.30, result: 'epic'      },
  epic:      { count: 6, cost: 60.00,  successRate: 0.18, result: 'legendary' },
  legendary: { count: 7, cost: 150.00, successRate: 0.06, result: 'mythic'    },
};

export function makeCard(rarity) {
  const tier  = rollTier({ 1: 45, 2: 28, 3: 16, 4: 8, 5: 3 });
  const names = CARD_NAMES[rarity];
  const name  = names[Math.floor(Math.random() * names.length)];
  const value = rollValue(rarity, tier, null);
  return { id: nextId++, name, rarity, tier, tag: null, value };
}

// ── Lab: Tag Imprinting ──────────────────────────────────────────────────────

// Base imprint cost (Common) — scales up with card rarity via IMPRINT_RARITY_MULT
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

// ── Lab: Fuse Score ──────────────────────────────────────────────────────────

// New card's fuse score = number of input cards + sum of their existing fuse scores
export function computeFuseScore(inputCards) {
  return inputCards.length + inputCards.reduce((sum, c) => sum + (c.fuseScore ?? 0), 0);
}

// Base success rate boosted by fuse score (capped at +20%)
export function getFuseSuccessRate(recipe, fuseScore) {
  const bonus = Math.min((fuseScore ?? 0) * 0.015, 0.20);
  return Math.min(recipe.successRate + bonus, 0.95);
}

// Tag inheritance: chance scales with fuse score and duplicate tag count;
// weighted toward tags that appear on more input cards
export function rollTagInheritance(inputCards, fuseScore) {
  const tagged = inputCards.filter(c => c.tag);
  if (tagged.length === 0) return null;

  // Count how many inputs share each tag
  const tagCounts = {};
  for (const c of tagged) tagCounts[c.tag] = (tagCounts[c.tag] ?? 0) + 1;

  // Bonus for the most-duplicated tag: +12% per extra copy beyond the first
  const maxDupes = Math.max(...Object.values(tagCounts));
  const dupeBonus = (maxDupes - 1) * 0.12;

  const chance = Math.min(0.10 + (fuseScore ?? 0) * 0.025 + dupeBonus, 0.90);
  if (Math.random() > chance) return null;

  // Weight = (count of cards with that tag) * (1 + fuseScore contribution)
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

// Imprint success chance boosted by fuse score (high-score cards are easier to imprint)
export function getImprintSuccessChance(tag, _rarity, fuseScore) {
  const base = 1 - IMPRINT_DATA[tag].failRate;
  const bonus = Math.min((fuseScore ?? 0) * 0.02, 0.25);
  return Math.min(base + bonus, 0.96);
}

// ── Lab: Grading (Legendary / Mythic only) ───────────────────────────────────

export const GRADEABLE_RARITIES = new Set(['legendary', 'mythic']);

// Re-grade cost doubles with each attempt: base, base×2, base×4, base×8 …
export function getGradeCost(card) {
  const base = GRADE_COSTS[card.rarity];
  const attempts = card.gradeAttempts ?? 0;
  return attempts === 0 ? base : Math.round(base * Math.pow(2, attempts));
}
