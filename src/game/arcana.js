export const ARCANA_CATEGORIES = {
  ESSENCE: 'essence',
  CHARM: 'charm',
  CATALYST: 'catalyst',
  SIGIL: 'sigil',
};

export const ARCANA_SLOTS = {
  CALLING: 'calling',
  SURGE: 'surge',
  INSCRIPTION: 'inscription',
};

export const ATTUNEMENT_FAMILIES = {
  charms: {
    category: ARCANA_CATEGORIES.CHARM,
    label: 'Charms',
    slot: ARCANA_SLOTS.CALLING,
    bias: 'element',
    description: 'Calling-slot attunements that bias card outcomes toward a creature family or element.',
  },
  catalysts: {
    category: ARCANA_CATEGORIES.CATALYST,
    label: 'Catalysts',
    slot: ARCANA_SLOTS.SURGE,
    bias: 'tier',
    description: 'Surge-slot attunements that bias results toward higher target tiers.',
  },
  sigils: {
    category: ARCANA_CATEGORIES.SIGIL,
    label: 'Sigils',
    slot: ARCANA_SLOTS.INSCRIPTION,
    bias: 'tag',
    description: 'Inscription-slot attunements that bias special card tags and treatments.',
  },
};

/**
 * @typedef {'smoldering' | 'jolting' | 'flowing' | 'blooming' | 'gusting' | 'hollowing' | 'gleaming' | 'ascending' | 'grounding'} EssenceId
 */

/** @type {('mote'|'wisp'|'essence'|'quintessence')[]} */
export const ELEMENT_TIERS = ['mote', 'wisp', 'essence', 'quintessence'];

/**
 * @param {EssenceId} elementId
 * @param {'mote'|'wisp'|'essence'|'quintessence'} [tier]
 * @returns {string}
 */
export function getElementResourceId(elementId, tier = 'essence') {
  if (tier === 'essence') return elementId;
  return `${elementId}_${tier}`;
}

/**
 * @param {string} resourceId
 * @returns {{ elementId: string, tier: 'mote'|'wisp'|'essence'|'quintessence' }}
 */
export function parseElementResourceId(resourceId) {
  for (const tier of ['mote', 'wisp', 'quintessence']) {
    const suffix = `_${tier}`;
    if (resourceId.endsWith(suffix)) {
      return { elementId: resourceId.slice(0, -suffix.length), tier };
    }
  }
  return { elementId: resourceId, tier: 'essence' };
}

export const ELEMENT_RESOURCE_DESCRIPTIONS = {
  smoldering: {
    mote: 'A faint ember flickers with barely contained heat.',
    wisp: 'A restless spark dances with growing warmth.',
    essence: 'A concentrated flame pulses with volatile energy.',
    quintessence: 'A blazing core of fire radiates overwhelming infernal power.',
  },
  jolting: {
    mote: 'A tiny charge hums with static potential.',
    wisp: 'A flicker of lightning snaps with erratic energy.',
    essence: 'A focused current crackles with sharp intensity.',
    quintessence: 'A storm-forged heart unleashes relentless electric fury.',
  },
  flowing: {
    mote: 'A single droplet sways with gentle motion.',
    wisp: 'A swirling bead flows with quiet momentum.',
    essence: 'A living current churns with fluid strength.',
    quintessence: 'A tidal core surges with boundless oceanic force.',
  },
  blooming: {
    mote: 'A fragile seed glows with latent vitality.',
    wisp: 'A budding sprout pulses with growing life.',
    essence: 'A thriving core radiates fertile energy.',
    quintessence: 'A verdant heart overflows with unstoppable natural growth.',
  },
  gusting: {
    mote: 'A faint breath drifts with subtle motion.',
    wisp: 'A curling breeze moves with playful speed.',
    essence: 'A spiraling current flows with precise force.',
    quintessence: 'A raging vortex surges with untamed aerial power.',
  },
  hollowing: {
    mote: 'A dim fragment hums with quiet emptiness.',
    wisp: 'A shadow coil twists with unsettling pull.',
    essence: 'A dark core devours light with silent hunger.',
    quintessence: 'An abyssal singularity consumes all into nothingness.',
  },
  gleaming: {
    mote: 'A soft glimmer shines with gentle purity.',
    wisp: 'A radiant spark flickers with guiding brilliance.',
    essence: 'A luminous core burns with cleansing light.',
    quintessence: 'A divine beacon blazes with transcendent radiance.',
  },
  ascending: {
    mote: 'A faint starlet twinkles with distant energy.',
    wisp: 'A drifting spark carries a trace of the cosmos.',
    essence: 'A stellar core hums with astral power.',
    quintessence: 'A cosmic heart radiates infinite celestial brilliance.',
  },
  grounding: {
    mote: 'A small shard rests with quiet stability.',
    wisp: 'A weighted fragment hums with steady force.',
    essence: 'A dense core anchors with unyielding strength.',
    quintessence: 'A primordial stone pulses with eternal, immovable power.',
  },
};

/**
 * @param {string} resourceId
 * @returns {string}
 */
export function getElementResourceDescription(resourceId) {
  const { elementId, tier } = parseElementResourceId(resourceId);
  return ELEMENT_RESOURCE_DESCRIPTIONS[elementId]?.[tier] ?? '';
}

/**
 * @typedef {'holo' | 'foil' | 'reverse' | 'shadow' | 'nexus' | 'prismatic' | 'firstEdition'} TagId
 */

/**
 * @typedef {{
 *   essenceId: EssenceId,
 *   amount: number,
 * }} ArcanaRecipePart
 */

/**
 * @typedef {{
 *   id: EssenceId,
 *   name: string,
 *   category: 'essence',
 *   family: string,
 *   color: string,
 *   glow: string,
 *   description: string,
 * }} EssenceConfig
 */

/**
 * @typedef {{
 *   slot: 'calling',
 *   bias: 'element',
 *   targetEssenceId: EssenceId,
 *   targetFamily: string,
 * }} CharmEffectMetadata
 */

/**
 * @typedef {{
 *   slot: 'surge',
 *   bias: 'tier',
 *   targetTier: 2 | 3 | 4 | 5,
 * }} CatalystEffectMetadata
 */

/**
 * @typedef {{
 *   slot: 'inscription',
 *   bias: 'tag',
 *   targetTag: TagId,
 * }} SigilEffectMetadata
 */

/**
 * @typedef {CharmEffectMetadata | CatalystEffectMetadata | SigilEffectMetadata} ArcanaEffectMetadata
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   category: 'charm' | 'catalyst' | 'sigil',
 *   recipe: ArcanaRecipePart[],
 *   description: string,
 *   effect: ArcanaEffectMetadata,
 * }} ArcanaCraftedItem
 */

/**
 * @param {Partial<Record<EssenceId, number>>} parts
 * @returns {ArcanaRecipePart[]}
 */
function makeRecipe(parts) {
  return Object.entries(parts).map(([essenceId, amount]) => ({
    essenceId,
    amount,
  }));
}

/** @type {EssenceConfig[]} */
export const ESSENCES = [
  {
    id: 'smoldering',
    name: 'Smoldering Essence',
    category: ARCANA_CATEGORIES.ESSENCE,
    family: 'Fire',
    color: '#ff7a18',
    glow: 'rgba(255,122,24,0.38)',
    description: ELEMENT_RESOURCE_DESCRIPTIONS.smoldering.essence,
  },
  {
    id: 'jolting',
    name: 'Jolting Essence',
    category: ARCANA_CATEGORIES.ESSENCE,
    family: 'Lightning',
    color: '#facc15',
    glow: 'rgba(250,204,21,0.34)',
    description: ELEMENT_RESOURCE_DESCRIPTIONS.jolting.essence,
  },
  {
    id: 'flowing',
    name: 'Flowing Essence',
    category: ARCANA_CATEGORIES.ESSENCE,
    family: 'Water',
    color: '#38bdf8',
    glow: 'rgba(56,189,248,0.34)',
    description: ELEMENT_RESOURCE_DESCRIPTIONS.flowing.essence,
  },
  {
    id: 'blooming',
    name: 'Blooming Essence',
    category: ARCANA_CATEGORIES.ESSENCE,
    family: 'Nature',
    color: '#4ade80',
    glow: 'rgba(74,222,128,0.32)',
    description: ELEMENT_RESOURCE_DESCRIPTIONS.blooming.essence,
  },
  {
    id: 'gusting',
    name: 'Gusting Essence',
    category: ARCANA_CATEGORIES.ESSENCE,
    family: 'Wind',
    color: '#7dd3fc',
    glow: 'rgba(125,211,252,0.32)',
    description: ELEMENT_RESOURCE_DESCRIPTIONS.gusting.essence,
  },
  {
    id: 'hollowing',
    name: 'Hollowing Essence',
    category: ARCANA_CATEGORIES.ESSENCE,
    family: 'Void',
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.34)',
    description: ELEMENT_RESOURCE_DESCRIPTIONS.hollowing.essence,
  },
  {
    id: 'gleaming',
    name: 'Gleaming Essence',
    category: ARCANA_CATEGORIES.ESSENCE,
    family: 'Light',
    color: '#fde68a',
    glow: 'rgba(253,230,138,0.30)',
    description: ELEMENT_RESOURCE_DESCRIPTIONS.gleaming.essence,
  },
  {
    id: 'ascending',
    name: 'Ascending Essence',
    category: ARCANA_CATEGORIES.ESSENCE,
    family: 'Celestial',
    color: '#f0abfc',
    glow: 'rgba(240,171,252,0.32)',
    description: ELEMENT_RESOURCE_DESCRIPTIONS.ascending.essence,
  },
  {
    id: 'grounding',
    name: 'Grounding Essence',
    category: ARCANA_CATEGORIES.ESSENCE,
    family: 'Earth',
    color: '#a16207',
    glow: 'rgba(161,98,7,0.34)',
    description: ELEMENT_RESOURCE_DESCRIPTIONS.grounding.essence,
  },
];

/** @type {ArcanaCraftedItem[]} */
const LEGACY_CHARMS = [
  {
    id: 'smoldering-charm',
    tier: 1,
    artKey: 'cindergust',
    name: 'Cindergust Charm',
    category: ARCANA_CATEGORIES.CHARM,
    recipe: makeRecipe({ smoldering: 8, gusting: 4 }),
    description: 'Calling-slot attunement that leans outcomes toward fire-aligned creatures and effects.',
    effect: {
      slot: ARCANA_SLOTS.CALLING,
      bias: 'element',
      targetEssenceId: 'smoldering',
      targetFamily: 'Fire',
    },
  },
  {
    id: 'jolting-charm',
    tier: 1,
    artKey: 'stormlash',
    name: 'Stormlash Charm',
    category: ARCANA_CATEGORIES.CHARM,
    recipe: makeRecipe({ jolting: 8, gusting: 4 }),
    description: 'Calling-slot attunement that biases rolls toward storm-charged and lightning families.',
    effect: {
      slot: ARCANA_SLOTS.CALLING,
      bias: 'element',
      targetEssenceId: 'jolting',
      targetFamily: 'Lightning',
    },
  },
  {
    id: 'flowing-charm',
    tier: 1,
    artKey: 'tidereed',
    name: 'Tidereed Charm',
    category: ARCANA_CATEGORIES.CHARM,
    recipe: makeRecipe({ flowing: 8, blooming: 4 }),
    description: 'Calling-slot attunement that favors waterborne, tidal, and abyssal creature lines.',
    effect: {
      slot: ARCANA_SLOTS.CALLING,
      bias: 'element',
      targetEssenceId: 'flowing',
      targetFamily: 'Water',
    },
  },
  {
    id: 'blooming-charm',
    tier: 1,
    artKey: 'bloomtide',
    name: 'Bloomtide Charm',
    category: ARCANA_CATEGORIES.CHARM,
    recipe: makeRecipe({ blooming: 8, flowing: 4 }),
    description: 'Calling-slot attunement that steers outcomes toward growth, beasts, flora, and spores.',
    effect: {
      slot: ARCANA_SLOTS.CALLING,
      bias: 'element',
      targetEssenceId: 'blooming',
      targetFamily: 'Nature',
    },
  },
  {
    id: 'gusting-charm',
    tier: 1,
    artKey: 'galebolt',
    name: 'Galebolt Charm',
    category: ARCANA_CATEGORIES.CHARM,
    recipe: makeRecipe({ gusting: 8, jolting: 4 }),
    description: 'Calling-slot attunement that favors airborne packs, skirmishers, and wind predators.',
    effect: {
      slot: ARCANA_SLOTS.CALLING,
      bias: 'element',
      targetEssenceId: 'gusting',
      targetFamily: 'Wind',
    },
  },
  {
    id: 'hollowing-charm',
    tier: 1,
    artKey: 'voidtide',
    name: 'Voidtide Charm',
    category: ARCANA_CATEGORIES.CHARM,
    recipe: makeRecipe({ hollowing: 8, flowing: 4 }),
    description: 'Calling-slot attunement that tilts the pool toward void-touched, ruinous, and shadow forms.',
    effect: {
      slot: ARCANA_SLOTS.CALLING,
      bias: 'element',
      targetEssenceId: 'hollowing',
      targetFamily: 'Void',
    },
  },
  {
    id: 'gleaming-charm',
    tier: 1,
    artKey: 'dawnseal',
    name: 'Dawnseal Charm',
    category: ARCANA_CATEGORIES.CHARM,
    recipe: makeRecipe({ gleaming: 8, ascending: 4 }),
    description: 'Calling-slot attunement that favors radiant, sanctified, and restoration-themed lines.',
    effect: {
      slot: ARCANA_SLOTS.CALLING,
      bias: 'element',
      targetEssenceId: 'gleaming',
      targetFamily: 'Light',
    },
  },
  {
    id: 'ascending-charm',
    tier: 1,
    artKey: 'starveil',
    name: 'Starveil Charm',
    category: ARCANA_CATEGORIES.CHARM,
    recipe: makeRecipe({ ascending: 8, gleaming: 4 }),
    description: 'Calling-slot attunement that biases toward celestial, astral, and mythic-aligned cards.',
    effect: {
      slot: ARCANA_SLOTS.CALLING,
      bias: 'element',
      targetEssenceId: 'ascending',
      targetFamily: 'Celestial',
    },
  },
];

export const CALLING_TIER_LABELS = Object.freeze(['I', 'II', 'III', 'IV', 'V']);

export function getCallingItemId(callingType, targetId, tier) {
  const safeTier = Math.max(1, Math.min(5, Math.floor(Number(tier) || 1)));
  return `${callingType}-${targetId}-calling-tier-${safeTier}`;
}

const ELEMENTAL_CALLING_TARGETS = Object.freeze(ESSENCES.map(element => Object.freeze({
  id: element.id,
  label: element.name.replace(/\s+Essence$/i, ''),
  artKey: ({
    smoldering: 'smoldered_calling',
    jolting: 'jolted_calling',
    flowing: 'flowed_calling',
    blooming: 'bloomed_calling',
    gusting: 'gusted_calling',
    hollowing: 'hollowed_calling',
    gleaming: 'gleamed_calling',
    ascending: 'ascended_calling',
    grounding: 'grounded_calling',
  })[element.id],
})));

export const VOCATIONAL_CALLING_TARGETS = Object.freeze([
  Object.freeze({ id: 'miner', label: 'Miner', artKey: "miner's_calling" }),
  Object.freeze({ id: 'prospector', label: 'Prospector', artKey: "prospector's_calling" }),
  Object.freeze({ id: 'lumberjack', label: 'Lumberjack', artKey: "lumberjack's_calling" }),
  Object.freeze({ id: 'forager', label: 'Forager', artKey: "forager's_calling" }),
  Object.freeze({ id: 'blacksmith', label: 'Blacksmith', artKey: "blacksmith's_calling" }),
  Object.freeze({ id: 'hunter', label: 'Hunter', artKey: "hunter's_calling" }),
  Object.freeze({ id: 'weaver', label: 'Weaver', artKey: "weaver's_calling" }),
  Object.freeze({ id: 'woodworker', label: 'Woodworker', artKey: "woodworker's_calling" }),
  Object.freeze({ id: 'tanner', label: 'Tanner', artKey: "tanner's_calling" }),
  Object.freeze({ id: 'gemcutter', label: 'Gemcutter', artKey: "gemcutter's_calling" }),
]);

export const TRAIT_CALLING_TARGETS = Object.freeze([
  Object.freeze({ id: 'luck', label: 'Luck', artKey: 'lucky_calling', targetAffixIds: Object.freeze([
    'miningLuck', 'smeltingLuck', 'loggingLuck', 'huntingLuck', 'tradeLuck', 'combatLuck',
    'arcaneLuck', 'inspirationLuck', 'foragingLuck', 'weavingLuck', 'woodworkingLuck',
    'tanningLuck', 'gemcuttingLuck',
  ]) }),
  Object.freeze({ id: 'efficiency', label: 'Efficiency', artKey: 'efficient_calling', targetAffixIds: Object.freeze([
    'miningEfficiency', 'smeltingEfficiency', 'loggingEfficiency', 'huntingEfficiency',
    'tradeEfficiency', 'combatEfficiency', 'arcaneEfficiency', 'inspirationEfficiency',
    'foragingEfficiency', 'weavingEfficiency', 'woodworkingEfficiency', 'tanningEfficiency',
    'gemcuttingEfficiency',
  ]) }),
  Object.freeze({ id: 'production-speed', label: 'Production Speed', artKey: 'quick_production_calling', targetAffixIds: Object.freeze(['productionSpeed', 'tanningSpeed']) }),
  Object.freeze({ id: 'bounty', label: 'Bounty', artKey: 'bountiful_calling', targetAffixIds: Object.freeze(['weavingBounty', 'woodworkingBounty', 'tanningBounty', 'gemcuttingBounty']) }),
  Object.freeze({ id: 'resource-generation', label: 'Resource Generation', artKey: 'resourceful_calling', targetAffixIds: Object.freeze(['resourceGeneration']) }),
  Object.freeze({ id: 'coin-generation', label: 'Coin Generation', artKey: "coin's_calling", targetAffixIds: Object.freeze(['coinGeneration']) }),
  Object.freeze({ id: 'treasure-sense', label: 'Treasure Sense', artKey: 'treasured_calling', targetAffixIds: Object.freeze(['treasureSense']) }),
]);

const makeTieredCallings = (callingType, targets, makeEffect, describe) => targets.flatMap(target => (
  CALLING_TIER_LABELS.map((tierLabel, index) => {
    const tier = index + 1;
    return Object.freeze({
      id: getCallingItemId(callingType, target.id, tier),
      tier,
      artKey: target.artKey ?? 'empty_calling',
      name: `${target.label} Calling ${tierLabel}`,
      category: ARCANA_CATEGORIES.CHARM,
      recipe: Object.freeze([]),
      description: describe(target, tierLabel),
      effect: Object.freeze({
        slot: ARCANA_SLOTS.CALLING,
        callingType,
        tier,
        ...makeEffect(target),
      }),
    });
  })
));

export const ELEMENTAL_CALLINGS = Object.freeze(makeTieredCallings(
  'elemental',
  ELEMENTAL_CALLING_TARGETS,
  target => ({ bias: 'element', targetEssenceId: target.id }),
  (target, tierLabel) => `Tier ${tierLabel} Calling that biases card affixes toward the ${target.label} element.`,
));

export const VOCATIONAL_CALLINGS = Object.freeze(makeTieredCallings(
  'vocational',
  VOCATIONAL_CALLING_TARGETS,
  target => ({ bias: 'class', targetClassType: target.id }),
  (target, tierLabel) => `Tier ${tierLabel} Calling that biases summoned cards toward the ${target.label} vocation.`,
));

export const TRAIT_CALLINGS = Object.freeze(makeTieredCallings(
  'trait',
  TRAIT_CALLING_TARGETS,
  target => ({ bias: 'trait', targetAffixIds: target.targetAffixIds }),
  (target, tierLabel) => `Tier ${tierLabel} Calling that biases compatible cards toward ${target.label} affixes.`,
));

/** Legacy Charms remain resolvable so existing saves do not lose already-crafted items. */
export const CHARMS = Object.freeze([
  ...LEGACY_CHARMS,
  ...ELEMENTAL_CALLINGS,
  ...VOCATIONAL_CALLINGS,
  ...TRAIT_CALLINGS,
]);

/** @type {ArcanaCraftedItem[]} */
export const CATALYSTS = [
  {
    id: 'emberstep-catalyst',
    tier: 2,
    name: 'Emberstep Catalyst',
    category: ARCANA_CATEGORIES.CATALYST,
    recipe: makeRecipe({ smoldering: 12, blooming: 8, flowing: 4 }),
    description: 'Surge-slot catalyst that pushes outcomes upward toward Tier II.',
    effect: {
      slot: ARCANA_SLOTS.SURGE,
      bias: 'tier',
      targetTier: 2,
    },
  },
  {
    id: 'crestforge-catalyst',
    tier: 3,
    name: 'Crestforge Catalyst',
    category: ARCANA_CATEGORIES.CATALYST,
    recipe: makeRecipe({ jolting: 16, gusting: 12, gleaming: 8 }),
    description: 'Surge-slot catalyst tuned for stronger mid-high pulls and a Tier III bias.',
    effect: {
      slot: ARCANA_SLOTS.SURGE,
      bias: 'tier',
      targetTier: 3,
    },
  },
  {
    id: 'mythrise-catalyst',
    tier: 4,
    name: 'Mythrise Catalyst',
    category: ARCANA_CATEGORIES.CATALYST,
    recipe: makeRecipe({ hollowing: 20, gleaming: 16, ascending: 12 }),
    description: 'Surge-slot catalyst that bends the curve toward premium Tier IV outcomes.',
    effect: {
      slot: ARCANA_SLOTS.SURGE,
      bias: 'tier',
      targetTier: 4,
    },
  },
  {
    id: 'zenith-catalyst',
    tier: 5,
    name: 'Zenith Catalyst',
    category: ARCANA_CATEGORIES.CATALYST,
    recipe: makeRecipe({ ascending: 28, gleaming: 20, hollowing: 16, jolting: 10 }),
    description: 'Surge-slot catalyst for the highest refinement path, with a direct Tier V bias.',
    effect: {
      slot: ARCANA_SLOTS.SURGE,
      bias: 'tier',
      targetTier: 5,
    },
  },
];

/** @type {ArcanaCraftedItem[]} */
export const SIGILS = [
  {
    id: 'tideglow-sigil',
    tier: 1,
    name: 'Tideglow Sigil',
    category: ARCANA_CATEGORIES.SIGIL,
    recipe: makeRecipe({ gleaming: 20, flowing: 16, blooming: 10 }),
    description: 'Inscription-slot sigil that biases tag rolls toward Holo treatments.',
    effect: {
      slot: ARCANA_SLOTS.INSCRIPTION,
      bias: 'tag',
      targetTag: 'holo',
    },
  },
  {
    id: 'windluster-sigil',
    tier: 2,
    name: 'Windluster Sigil',
    category: ARCANA_CATEGORIES.SIGIL,
    recipe: makeRecipe({ gleaming: 20, gusting: 16, smoldering: 10 }),
    description: 'Inscription-slot sigil that leans rolls toward Foil treatment outcomes.',
    effect: {
      slot: ARCANA_SLOTS.INSCRIPTION,
      bias: 'tag',
      targetTag: 'foil',
    },
  },
  {
    id: 'ashmirror-sigil',
    tier: 2,
    name: 'Ashmirror Sigil',
    category: ARCANA_CATEGORIES.SIGIL,
    recipe: makeRecipe({ gusting: 18, jolting: 18, flowing: 12 }),
    description: 'Inscription-slot sigil that biases crafted results toward Reverse tags.',
    effect: {
      slot: ARCANA_SLOTS.INSCRIPTION,
      bias: 'tag',
      targetTag: 'reverse',
    },
  },
  {
    id: 'cinderveil-sigil',
    tier: 3,
    name: 'Cinderveil Sigil',
    category: ARCANA_CATEGORIES.SIGIL,
    recipe: makeRecipe({ hollowing: 22, smoldering: 16, gusting: 10 }),
    description: 'Inscription-slot sigil that increases affinity for Shadow-tagged outcomes.',
    effect: {
      slot: ARCANA_SLOTS.INSCRIPTION,
      bias: 'tag',
      targetTag: 'shadow',
    },
  },
  {
    id: 'riftheart-sigil',
    tier: 4,
    name: 'Riftheart Sigil',
    category: ARCANA_CATEGORIES.SIGIL,
    recipe: makeRecipe({ hollowing: 24, ascending: 18, jolting: 12 }),
    description: 'Inscription-slot sigil for rare nexus-linked inscriptions and spatial anomalies.',
    effect: {
      slot: ARCANA_SLOTS.INSCRIPTION,
      bias: 'tag',
      targetTag: 'nexus',
    },
  },
  {
    id: 'starprism-sigil',
    tier: 5,
    name: 'Starprism Sigil',
    category: ARCANA_CATEGORIES.SIGIL,
    recipe: makeRecipe({ gleaming: 24, ascending: 18, gusting: 12, jolting: 8 }),
    description: 'Inscription-slot sigil tuned for dazzling prismatic outcomes and multicolor treatment.',
    effect: {
      slot: ARCANA_SLOTS.INSCRIPTION,
      bias: 'tag',
      targetTag: 'prismatic',
    },
  },
  {
    id: 'dawnmark-sigil',
    tier: 5,
    name: 'Dawnmark Sigil',
    category: ARCANA_CATEGORIES.SIGIL,
    recipe: makeRecipe({ gleaming: 26, ascending: 20, flowing: 14 }),
    description: 'Inscription-slot sigil reserved for first-edition style inscriptions and premium stamps.',
    effect: {
      slot: ARCANA_SLOTS.INSCRIPTION,
      bias: 'tag',
      targetTag: 'firstEdition',
    },
  },
];

export const DEFAULT_RESOURCES = Object.fromEntries(
  ESSENCES.flatMap(essence =>
    ELEMENT_TIERS.map(tier => [getElementResourceId(essence.id, tier), 0]),
  ),
);

export const ARCANA_ITEMS = [...CHARMS, ...CATALYSTS, ...SIGILS];

export const ESSENCES_BY_ID = Object.fromEntries(
  ESSENCES.map(essence => [essence.id, essence]),
);

export const ARCANA_ITEMS_BY_ID = Object.fromEntries(
  ARCANA_ITEMS.map(item => [item.id, item]),
);
