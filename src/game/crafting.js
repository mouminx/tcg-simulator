import {
  ESSENCES,
  TRAIT_CALLING_TARGETS,
  VOCATIONAL_CALLING_TARGETS,
  getCallingItemId,
  getElementResourceId,
} from './arcana.js';
import { DULL_GEMS } from './gems.js';

export const CRAFTING_CARD_SLOT_COUNT = 5;
export const CRAFTING_GRID_SLOT_COUNT = 9;

export const CRAFTING_RESOURCE_SOURCES = Object.freeze([
  'ore',
  'ingot',
  'gathered',
  'processed',
  'crafted',
  'arcana',
]);

export const CRAFTED_RESOURCE_TIERS = Object.freeze({
  advancedAlkahest: 2,
  advancedArcanicInfusion: 2,
  advancedMycelialExtract: 2,
  advancedSealant: 2,
  alkahest: 1,
  arcanewoodPlank: 5,
  arcanewoodStick: 5,
  arcanicInfusion: 1,
  arcaneFlux: 4,
  charcoal: 2,
  condensedCoal: 3,
  fiber: 1,
  gemExtractor: 3,
  gemsettersChisel: 2,
  linen: 1,
  lumber: 1,
  mycelialExtract: 1,
  plank: 1,
  polishedStoneBlock: 3,
  premiumLeather: 5,
  refinedLeather: 3,
  reinforcedStoneBlock: 5,
  refinedCoal: 5,
  roughLeather: 1,
  sateen: 3,
  sealant: 1,
  silk: 5,
  starlitPlank: 5,
  stick: 1,
  stoneBlock: 1,
  timber: 1,
  tannin: 2,
  voidwoodPlank: 4,
  voidwoodStick: 4,
});

export const CRAFTED_RESOURCES = Object.freeze([
  { id: 'advancedAlkahest', name: 'Advanced Alkahest', artKey: 'advanced_alkahest', color: '#68c7bd', description: 'Alkahest strengthened with wildflowers into a more discerning arcane solvent.' },
  { id: 'advancedArcanicInfusion', name: 'Advanced Arcanic Infusion', artKey: 'advanced_arcanic_infusion', color: '#9b72cf', description: 'A concentrated binding medium capable of stabilizing an Empty Surge.' },
  { id: 'advancedMycelialExtract', name: 'Advanced Mycelial Extract', artKey: 'advanced_mycelial_extract', color: '#8871c2', description: 'Mycelial extract deepened with garlic into a potent magical carrier.' },
  { id: 'advancedSealant', name: 'Advanced Sealant', artKey: 'advanced_sealant', color: '#c5843f', description: 'Sealant reinforced with softwood sap to contain stronger arcane forces.' },
  { id: 'alkahest', name: 'Alkahest', artKey: 'alkahest', color: '#89d2c9', description: 'A universal solvent distilled from hyssop and used to bind advanced arcane constructions.' },
  { id: 'arcanewoodPlank', name: 'Arcanewood Plank', artKey: 'arcanewood_plank', color: '#8466c7', description: 'A plank cut from magic-suffused arcanewood.' },
  { id: 'arcanewoodStick', name: 'Arcanewood Stick', artKey: 'arcanewood_stick', color: '#8466c7', description: 'A slender crafting component shaped from arcanewood.' },
  { id: 'arcanicInfusion', name: 'Arcanic Infusion', artKey: 'arcanic_infusion', color: '#b38ad8', description: 'An alchemical binding medium that lets mundane materials hold an arcane purpose.' },
  { id: 'arcaneFlux', name: 'Arcane Flux', artKey: 'arcane_flux', color: '#8b69c8', description: 'Flux saturated with an Arcanic Infusion for high-order magical metallurgy.' },
  { id: 'charcoal', name: 'Charcoal', artKey: 'charcoal', color: '#514f50', description: 'Wood carbonized in a forge into a clean, dependable crafting fuel.' },
  { id: 'condensedCoal', name: 'Condensed Coal', artKey: 'condensed_coal', color: '#555761', description: 'Coal compressed into a dense, long-burning fuel.' },
  { id: 'fiber', name: 'Fiber', artKey: 'fiber', color: '#b9c088', description: 'Plant fiber separated from harvested fiberweed and ready for weaving.' },
  { id: 'flux', name: 'Flux', artKey: 'flux', color: '#b7a788', description: 'A cleansing blend of quartz, charcoal, and alkahest used to accelerate smelting.' },
  { id: 'gemExtractor', name: 'Gem Extractor', artKey: 'gem_extractor', color: '#8ec9db', description: 'A precision arcane implement made to remove socketed gemstones from cards.' },
  { id: 'gemsettersChisel', name: "Gemsetter's Chisel", artKey: 'gemsetters_chisel', color: '#cfaa5b', description: 'A starsteel-edged chisel made to cut a new gemstone socket into a card.' },
  { id: 'linen', name: 'Linen', artKey: 'linen', color: '#d9d2b8', description: 'A sturdy textile woven from prepared plant fiber.' },
  { id: 'lumber', name: 'Lumber', artKey: 'lumber', color: '#88613f', description: 'Hardwood refined into sturdy structural lumber.' },
  { id: 'mycelialExtract', name: 'Mycelial Extract', artKey: 'mycelial extract', color: '#9f8ed2', description: 'A concentrated fungal extract used to carry and multiply magical reactions.' },
  { id: 'plank', name: 'Plank', artKey: 'plank', color: '#a57745', description: 'A shaped wooden board used in construction and carpentry.' },
  { id: 'polishedStoneBlock', name: 'Polished Stone Block', artKey: 'polished_stone_block', color: '#8d8b87', description: 'A stone block finished into a smooth building material.' },
  { id: 'premiumLeather', name: 'Premium Leather', artKey: 'premium_leather', color: '#8f593e', description: 'Exceptionally supple leather prepared for fine equipment.' },
  { id: 'refinedLeather', name: 'Refined Leather', artKey: 'refined_leather', color: '#9f6848', description: 'Leather cleaned, treated, and readied for skilled crafting.' },
  { id: 'reinforcedStoneBlock', name: 'Reinforced Stone Block', artKey: 'reinforced_stone_block', color: '#777c82', description: 'Polished stone bound within a steel reinforcement, suitable for demanding arcane structures.' },
  { id: 'refinedCoal', name: 'Refined Coal', artKey: 'refined_coal', color: '#34343b', description: 'Exceptionally pure coal refined from a full matrix of condensed fuel.' },
  { id: 'roughLeather', name: 'Rough Leather', artKey: 'rough_leather', color: '#76503c', description: 'Basic leather with a coarse finish.' },
  { id: 'sateen', name: 'Sateen', artKey: 'sateen', color: '#c9b98f', description: 'A smooth, lustrous woven textile.' },
  { id: 'sealant', name: 'Sealant', artKey: 'sealant', color: '#d29c58', description: 'A resinous coating that seals an arcane mixture into a stable form.' },
  { id: 'silk', name: 'Silk', artKey: 'silk', color: '#e1d9cd', description: 'A fine, lightweight textile used for delicate crafts.' },
  { id: 'starlitPlank', name: 'Starlit Plank', artKey: 'starlit_plank', color: '#aa96df', description: 'A plank shaped from rare starwood.' },
  { id: 'stick', name: 'Stick', artKey: 'stick', color: '#94704b', description: 'A simple wooden crafting component.' },
  { id: 'stoneBlock', name: 'Stone Block', artKey: 'stone_block', color: '#777875', description: 'Stone assembled into a solid building block.' },
  { id: 'tannin', name: 'Tannin', artKey: 'tannin', color: '#825b3e', description: 'A concentrated bark extract used to preserve and refine hides.' },
  { id: 'timber', name: 'Timber', artKey: 'timber', color: '#a57745', description: 'Rough-cut timber milled from harvested wood.' },
  { id: 'voidwoodPlank', name: 'Voidwood Plank', artKey: 'voidwood_plank', color: '#594064', description: 'A plank cut from shadow-saturated voidwood.' },
  { id: 'voidwoodStick', name: 'Voidwood Stick', artKey: 'voidwood_stick', color: '#594064', description: 'A slender crafting component shaped from voidwood.' },
  ...Array.from({ length: 5 }, (_, index) => {
    const tier = index + 1;
    return Object.freeze({
      id: `emptyCallingTier${tier}`,
      name: `Empty Calling ${['I', 'II', 'III', 'IV', 'V'][index]}`,
      artKey: 'empty_calling',
      color: '#8d6aae',
      tier,
      description: `A Tier ${['I', 'II', 'III', 'IV', 'V'][index]} unaligned Calling ready to be specialized. Its tier is preserved through later modifications.`,
    });
  }),
  ...Array.from({ length: 5 }, (_, index) => {
    const tier = index + 1;
    return Object.freeze({
      id: `emptySurgeTier${tier}`,
      name: `Empty Surge ${['I', 'II', 'III', 'IV', 'V'][index]}`,
      artKey: 'empty_surge',
      color: '#6f62bd',
      tier,
      description: `A Tier ${['I', 'II', 'III', 'IV', 'V'][index]} unaligned Surge ready to be specialized. Its tier is preserved through later modifications.`,
    });
  }),
].map(resource => Object.freeze({
  ...resource,
  tier: resource.tier ?? CRAFTED_RESOURCE_TIERS[resource.id] ?? 1,
})));

export const CRAFTED_RESOURCES_BY_ID = Object.freeze(
  Object.fromEntries(CRAFTED_RESOURCES.map(resource => [resource.id, resource])),
);

export const DEFAULT_CRAFTED_INVENTORY = Object.freeze(
  Object.fromEntries(CRAFTED_RESOURCES.map(resource => [resource.id, 0])),
);

const ingredient = (source, id, count = 1) => Object.freeze({ source, id, count });
const ingredientFamily = (source, family, acceptedIds, count = 1) => Object.freeze({
  source,
  family,
  acceptedIds: Object.freeze([...acceptedIds]),
  count,
});
const ingredientOptions = (family, acceptedItems, count = 1) => Object.freeze({
  family,
  acceptedItems: Object.freeze(acceptedItems.map(item => Object.freeze({ ...item }))),
  count,
});

export const CRAFTING_INGOT_IDS = Object.freeze(['steel', 'silver', 'gold', 'platinum', 'starsteel']);
export const CRAFTING_STICK_IDS = Object.freeze(['stick', 'voidwoodStick', 'arcanewoodStick']);
export const CRAFTING_CALLING_STONE_IDS = Object.freeze(['stoneBlock', 'polishedStoneBlock', 'reinforcedStoneBlock']);
export const CRAFTING_CALLING_TEXTILE_IDS = Object.freeze(['linen', 'sateen', 'silk']);
export const EMPTY_CALLING_IDS = Object.freeze(Array.from({ length: 5 }, (_, index) => `emptyCallingTier${index + 1}`));
/** Every recipe that asks for Leather accepts the material's full quality ladder. */
export const CRAFTING_LEATHER_ITEMS = Object.freeze([
  Object.freeze({ source: 'crafted', id: 'roughLeather' }),
  Object.freeze({ source: 'crafted', id: 'refinedLeather' }),
  Object.freeze({ source: 'crafted', id: 'premiumLeather' }),
]);

// Preserve the older export name for any external recipe tooling that already imports it.
export const CRAFTING_CALLING_LEATHER_ITEMS = CRAFTING_LEATHER_ITEMS;

/** Quality points used by tool recipes. Every consumed component contributes independently. */
export const CRAFTING_MATERIAL_QUALITY = Object.freeze({
  steel: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  starsteel: 5,
  stick: 1,
  voidwoodStick: 4,
  arcanewoodStick: 5,
  fiber: 1,
  linen: 1,
  sateen: 3,
  silk: 5,
  roughLeather: 1,
  refinedLeather: 3,
  premiumLeather: 5,
  stoneBlock: 1,
  polishedStoneBlock: 3,
  reinforcedStoneBlock: 5,
});

const ELEMENT_TIER_UPGRADES = Object.freeze([
  ['mote', 'wisp'],
  ['wisp', 'essence'],
  ['essence', 'quintessence'],
]);

export const ELEMENT_UPGRADE_RECIPES = Object.freeze(
  ESSENCES.flatMap(element => ELEMENT_TIER_UPGRADES.map(([inputTier, outputTier]) => {
    const inputId = getElementResourceId(element.id, inputTier);
    const outputId = getElementResourceId(element.id, outputTier);
    return Object.freeze({
      id: `${element.id}-${inputTier}-to-${outputTier}`,
      name: `${element.name.replace(/ Essence$/i, '')} ${outputTier.charAt(0).toUpperCase()}${outputTier.slice(1)}`,
      output: Object.freeze({ kind: 'arcana', id: outputId, count: 1 }),
      pattern: Object.freeze(Array.from({ length: 9 }, () => ingredient('arcana', inputId))),
    });
  })),
);

const makeCallingRecipe = ({ id, name, callingType, targetId, reagent }) => Object.freeze({
  id,
  name,
  output: Object.freeze({ kind: 'calling', callingType, targetId, count: 1 }),
  inheritedTierIngredientPrefix: 'emptyCallingTier',
  shapeless: Object.freeze([
    ingredientFamily('crafted', 'Empty Calling', EMPTY_CALLING_IDS),
    reagent,
  ]),
});

export const ELEMENTAL_CALLING_RECIPES = Object.freeze(ESSENCES.map(element => makeCallingRecipe({
  id: `elementalCalling-${element.id}`,
  name: `${element.name.replace(/\s+Essence$/i, '')} Calling`,
  callingType: 'elemental',
  targetId: element.id,
  // The base id is the Essence tier. Motes, Wisps, and Quintessences remain separate resources.
  reagent: ingredient('arcana', element.id),
})));

const VOCATIONAL_CALLING_REAGENTS = Object.freeze({
  miner: ingredient('gathered', 'quartz'),
  prospector: ingredient('gathered', 'geode'),
  lumberjack: ingredient('gathered', 'softwoodSap'),
  forager: ingredient('gathered', 'mushrooms'),
  blacksmith: ingredient('ore', 'coal'),
  hunter: ingredient('gathered', 'fierceFang'),
  weaver: ingredient('crafted', 'fiber'),
  woodworker: ingredient('gathered', 'petrifiedWood'),
  tanner: ingredient('crafted', 'tannin'),
  gemcutter: ingredient('gathered', 'gemdust'),
});

export const VOCATIONAL_CALLING_RECIPES = Object.freeze(VOCATIONAL_CALLING_TARGETS.map(target => (
  makeCallingRecipe({
    id: `vocationalCalling-${target.id}`,
    name: `${target.label} Calling`,
    callingType: 'vocational',
    targetId: target.id,
    reagent: VOCATIONAL_CALLING_REAGENTS[target.id],
  })
)));

const TRAIT_CALLING_REAGENTS = Object.freeze({
  luck: ingredient('gathered', 'rabbitsFoot'),
  efficiency: ingredient('gathered', 'honeycomb'),
  'production-speed': ingredient('gathered', 'quickroot'),
  bounty: ingredient('gathered', 'cornucopiaSeed'),
  'resource-generation': ingredient('gathered', 'sproutingAcorn'),
  'coin-generation': ingredient('gathered', 'auricVein'),
  'treasure-sense': ingredient('gathered', 'compassOre'),
});

export const TRAIT_CALLING_RECIPES = Object.freeze(TRAIT_CALLING_TARGETS.map(target => (
  makeCallingRecipe({
    id: `traitCalling-${target.id}`,
    name: `${target.label} Calling`,
    callingType: 'trait',
    targetId: target.id,
    reagent: TRAIT_CALLING_REAGENTS[target.id],
  })
)));

/**
 * Recipes are deliberately data-only. `pattern` is the literal 3x3 grid, row-major; `anySingleCell`
 * handles recipes whose only ingredient may sit anywhere. This keeps future recipe batches reviewable
 * without putting recipe-specific branches into the matcher.
 */
export const CRAFTING_RECIPES = Object.freeze([
  ...ELEMENT_UPGRADE_RECIPES,
  ...ELEMENTAL_CALLING_RECIPES,
  ...VOCATIONAL_CALLING_RECIPES,
  ...TRAIT_CALLING_RECIPES,
  {
    id: 'mycelialExtract',
    name: 'Mycelial Extract',
    output: Object.freeze({ id: 'mycelialExtract', count: 2 }),
    anySingleCell: ingredient('gathered', 'mushrooms'),
  },
  {
    id: 'sealant',
    name: 'Sealant',
    output: Object.freeze({ id: 'sealant', count: 2 }),
    anySingleCell: ingredient('gathered', 'resin'),
  },
  {
    id: 'alkahest',
    name: 'Alkahest',
    output: Object.freeze({ id: 'alkahest', count: 2 }),
    anySingleCell: ingredient('gathered', 'hyssop'),
  },
  {
    id: 'arcanicInfusion',
    name: 'Arcanic Infusion',
    output: Object.freeze({ id: 'arcanicInfusion', count: 1 }),
    shapeless: Object.freeze([
      ingredient('crafted', 'sealant'),
      ingredient('crafted', 'alkahest'),
      ingredient('crafted', 'mycelialExtract'),
    ]),
  },
  {
    id: 'gemdust',
    name: 'Gemdust',
    output: Object.freeze({ kind: 'gathered', id: 'gemdust', count: 1 }),
    shapeless: Object.freeze([
      ingredient('ore', 'coal'),
      ingredient('crafted', 'alkahest'),
      ingredientFamily('gathered', 'Dull Gem', DULL_GEMS.map(gem => gem.id)),
    ]),
  },
  {
    id: 'flux',
    name: 'Flux',
    output: Object.freeze({ id: 'flux', count: 1 }),
    shapeless: Object.freeze([
      ingredient('gathered', 'quartz'),
      ingredient('crafted', 'charcoal'),
      ingredient('crafted', 'alkahest'),
    ]),
  },
  {
    id: 'arcaneFlux',
    name: 'Arcane Flux',
    output: Object.freeze({ id: 'arcaneFlux', count: 1 }),
    shapeless: Object.freeze([
      ingredient('crafted', 'flux'),
      ingredient('crafted', 'arcanicInfusion'),
    ]),
  },
  {
    id: 'tannin',
    name: 'Tannin',
    output: Object.freeze({ id: 'tannin', count: 1 }),
    shapeless: Object.freeze([
      ingredient('gathered', 'salt'),
      ingredient('gathered', 'bark'),
      ingredient('crafted', 'alkahest'),
    ]),
  },
  {
    id: 'condensedCoal',
    name: 'Condensed Coal',
    output: Object.freeze({ id: 'condensedCoal', count: 1 }),
    pattern: Object.freeze(Array.from({ length: 9 }, () => ingredient('ore', 'coal'))),
  },
  {
    id: 'refinedCoal',
    name: 'Refined Coal',
    output: Object.freeze({ id: 'refinedCoal', count: 1 }),
    pattern: Object.freeze(Array.from({ length: 9 }, () => ingredient('crafted', 'condensedCoal'))),
  },
  {
    id: 'advancedAlkahest',
    name: 'Advanced Alkahest',
    output: Object.freeze({ id: 'advancedAlkahest', count: 1 }),
    shapeless: Object.freeze([
      ingredient('crafted', 'alkahest'),
      ingredient('gathered', 'wildflowers', 2),
    ]),
  },
  {
    id: 'advancedMycelialExtract',
    name: 'Advanced Mycelial Extract',
    output: Object.freeze({ id: 'advancedMycelialExtract', count: 1 }),
    shapeless: Object.freeze([
      ingredient('crafted', 'mycelialExtract'),
      ingredient('gathered', 'garlic', 2),
    ]),
  },
  {
    id: 'advancedSealant',
    name: 'Advanced Sealant',
    output: Object.freeze({ id: 'advancedSealant', count: 1 }),
    shapeless: Object.freeze([
      ingredient('crafted', 'sealant'),
      ingredient('gathered', 'softwoodSap', 2),
    ]),
  },
  {
    id: 'advancedArcanicInfusion',
    name: 'Advanced Arcanic Infusion',
    output: Object.freeze({ id: 'advancedArcanicInfusion', count: 1 }),
    shapeless: Object.freeze([
      ingredient('crafted', 'advancedAlkahest'),
      ingredient('crafted', 'advancedMycelialExtract'),
      ingredient('crafted', 'advancedSealant'),
    ]),
  },
  {
    id: 'roughLeather',
    name: 'Rough Leather',
    output: Object.freeze({ id: 'roughLeather', count: 1 }),
    anySingleCell: ingredient('gathered', 'hide', 2),
  },
  {
    id: 'refinedLeather',
    name: 'Refined Leather',
    output: Object.freeze({ id: 'refinedLeather', count: 1 }),
    pattern: Object.freeze([
      ingredient('gathered', 'toughHide'), ingredient('gathered', 'toughHide'), ingredient('gathered', 'toughHide'),
      ingredient('gathered', 'toughHide'), ingredient('crafted', 'roughLeather'), ingredient('gathered', 'toughHide'),
      ingredient('gathered', 'toughHide'), ingredient('gathered', 'toughHide'), ingredient('gathered', 'toughHide'),
    ]),
  },
  {
    id: 'premiumLeather',
    name: 'Premium Leather',
    output: Object.freeze({ id: 'premiumLeather', count: 1 }),
    pattern: Object.freeze([
      ingredient('crafted', 'refinedLeather'), ingredient('crafted', 'refinedLeather'), ingredient('crafted', 'refinedLeather'),
      ingredient('crafted', 'refinedLeather'), ingredient('gathered', 'toughScales'), ingredient('crafted', 'refinedLeather'),
      ingredient('crafted', 'refinedLeather'), ingredient('crafted', 'refinedLeather'), ingredient('crafted', 'refinedLeather'),
    ]),
  },
  {
    id: 'reinforcedStoneBlock',
    name: 'Reinforced Stone Block',
    output: Object.freeze({ id: 'reinforcedStoneBlock', count: 1 }),
    pattern: Object.freeze([
      ingredient('ingot', 'steel'), ingredient('ingot', 'steel'), ingredient('ingot', 'steel'),
      ingredient('ingot', 'steel'), ingredient('crafted', 'polishedStoneBlock'), ingredient('ingot', 'steel'),
      ingredient('ingot', 'steel'), ingredient('ingot', 'steel'), ingredient('ingot', 'steel'),
    ]),
  },
  {
    id: 'emptyCalling',
    name: 'Empty Calling',
    output: Object.freeze({ kind: 'tieredCrafted', idPrefix: 'emptyCallingTier', count: 1 }),
    qualityFromMaterials: true,
    qualityIngredientIndexes: Object.freeze([0, 1, 2, 3, 5, 6, 7, 8]),
    pattern: Object.freeze([
      ingredientFamily('crafted', 'Stone Block', CRAFTING_CALLING_STONE_IDS), ingredientFamily('crafted', 'Linen weave', CRAFTING_CALLING_TEXTILE_IDS), ingredientFamily('crafted', 'Stone Block', CRAFTING_CALLING_STONE_IDS),
      ingredientOptions('Leather', CRAFTING_LEATHER_ITEMS), ingredient('crafted', 'arcanicInfusion'), ingredientOptions('Leather', CRAFTING_LEATHER_ITEMS),
      ingredientFamily('crafted', 'Stone Block', CRAFTING_CALLING_STONE_IDS), ingredientFamily('crafted', 'Linen weave', CRAFTING_CALLING_TEXTILE_IDS), ingredientFamily('crafted', 'Stone Block', CRAFTING_CALLING_STONE_IDS),
    ]),
  },
  {
    id: 'emptySurge',
    name: 'Empty Surge',
    output: Object.freeze({ kind: 'tieredCrafted', idPrefix: 'emptySurgeTier', count: 1 }),
    qualityFromMaterials: true,
    qualityIngredientIndexes: Object.freeze([0, 1, 2, 3, 5, 6, 7, 8]),
    pattern: Object.freeze([
      ingredientFamily('crafted', 'Stone Block', CRAFTING_CALLING_STONE_IDS), ingredientFamily('crafted', 'Linen weave', CRAFTING_CALLING_TEXTILE_IDS), ingredientFamily('crafted', 'Stone Block', CRAFTING_CALLING_STONE_IDS),
      ingredientFamily('ingot', 'Ingot', CRAFTING_INGOT_IDS), ingredient('crafted', 'advancedArcanicInfusion'), ingredientFamily('ingot', 'Ingot', CRAFTING_INGOT_IDS),
      ingredientFamily('crafted', 'Stone Block', CRAFTING_CALLING_STONE_IDS), ingredientFamily('crafted', 'Linen weave', CRAFTING_CALLING_TEXTILE_IDS), ingredientFamily('crafted', 'Stone Block', CRAFTING_CALLING_STONE_IDS),
    ]),
  },
  {
    id: 'stoneBlock',
    name: 'Stone Block',
    output: Object.freeze({ id: 'stoneBlock', count: 1 }),
    pattern: Object.freeze(Array.from({ length: 9 }, () => ingredient('ore', 'stone'))),
  },
  {
    id: 'polishedStoneBlock',
    name: 'Polished Stone Block',
    output: Object.freeze({ id: 'polishedStoneBlock', count: 1 }),
    pattern: Object.freeze(Array.from({ length: 9 }, () => ingredient('crafted', 'stoneBlock'))),
  },
  {
    id: 'fiber',
    name: 'Fiber',
    output: Object.freeze({ id: 'fiber', count: 1 }),
    anySingleCell: ingredient('gathered', 'fiberweed', 2),
  },
  {
    id: 'linen',
    name: 'Linen',
    output: Object.freeze({ id: 'linen', count: 1 }),
    pattern: Object.freeze([
      ...Array.from({ length: 9 }, () => ingredient('crafted', 'fiber')),
    ]),
  },
  {
    id: 'sateen',
    name: 'Sateen',
    output: Object.freeze({ id: 'sateen', count: 1 }),
    pattern: Object.freeze([
      ingredient('gathered', 'softstem'), ingredient('gathered', 'softstem'), ingredient('gathered', 'softstem'),
      ingredient('gathered', 'softstem'), ingredient('crafted', 'linen'), ingredient('gathered', 'softstem'),
      ingredient('gathered', 'softstem'), ingredient('gathered', 'softstem'), ingredient('gathered', 'softstem'),
    ]),
  },
  {
    id: 'silk',
    name: 'Silk',
    output: Object.freeze({ id: 'silk', count: 1 }),
    pattern: Object.freeze([
      ingredient('gathered', 'silkgrass'), ingredient('gathered', 'silkgrass'), ingredient('gathered', 'silkgrass'),
      ingredient('gathered', 'silkgrass'), ingredient('crafted', 'sateen'), ingredient('gathered', 'silkgrass'),
      ingredient('gathered', 'silkgrass'), ingredient('gathered', 'silkgrass'), ingredient('gathered', 'silkgrass'),
    ]),
  },
  {
    id: 'plank',
    name: 'Plank',
    output: Object.freeze({ id: 'plank', count: 1 }),
    pattern: Object.freeze([
      ingredient('crafted', 'timber'), ingredient('crafted', 'timber'), ingredient('crafted', 'timber'),
      ingredient('crafted', 'lumber'), ingredient('crafted', 'lumber'), ingredient('crafted', 'lumber'),
      ingredient('crafted', 'timber'), ingredient('crafted', 'timber'), ingredient('crafted', 'timber'),
    ]),
  },
  {
    id: 'stick',
    name: 'Stick',
    output: Object.freeze({ id: 'stick', count: 2 }),
    pattern: Object.freeze([
      null, ingredient('crafted', 'plank'), null,
      null, ingredient('crafted', 'plank'), null,
      null, ingredient('crafted', 'plank'), null,
    ]),
  },
  {
    id: 'voidwoodStick',
    name: 'Voidwood Stick',
    output: Object.freeze({ id: 'voidwoodStick', count: 1 }),
    pattern: Object.freeze([
      null, ingredient('crafted', 'voidwoodPlank'), null,
      null, ingredient('crafted', 'voidwoodPlank'), null,
      null, ingredient('crafted', 'voidwoodPlank'), null,
    ]),
  },
  {
    id: 'arcanewoodStick',
    name: 'Arcanewood Stick',
    output: Object.freeze({ id: 'arcanewoodStick', count: 1 }),
    pattern: Object.freeze([
      null, ingredient('crafted', 'arcanewoodPlank'), null,
      null, ingredient('crafted', 'arcanewoodPlank'), null,
      null, ingredient('crafted', 'arcanewoodPlank'), null,
    ]),
  },
  {
    id: 'gemsettersChisel',
    name: "Gemsetter's Chisel",
    output: Object.freeze({ id: 'gemsettersChisel', count: 1 }),
    pattern: Object.freeze([
      null, null, ingredient('crafted', 'stick'),
      null, ingredient('crafted', 'stick'), null,
      ingredient('ingot', 'starsteel'), null, null,
    ]),
  },
  {
    id: 'gemExtractor',
    name: 'Gem Extractor',
    output: Object.freeze({ id: 'gemExtractor', count: 1 }),
    pattern: Object.freeze([
      null, null, ingredient('crafted', 'stick'),
      ingredient('ingot', 'starsteel'), ingredient('crafted', 'stick'), null,
      ingredient('ingot', 'starsteel'), ingredient('ingot', 'starsteel'), null,
    ]),
  },
  {
    id: 'pickaxe',
    name: 'Pickaxe',
    output: Object.freeze({ kind: 'tool', toolType: 'pickaxe', id: 'pickaxe', count: 1 }),
    pattern: Object.freeze([
      ingredientFamily('ingot', 'Ingot', CRAFTING_INGOT_IDS), ingredientFamily('ingot', 'Ingot', CRAFTING_INGOT_IDS), ingredientFamily('ingot', 'Ingot', CRAFTING_INGOT_IDS),
      null, ingredientFamily('crafted', 'Stick', CRAFTING_STICK_IDS), null,
      null, ingredientFamily('crafted', 'Stick', CRAFTING_STICK_IDS), null,
    ]),
  },
  {
    id: 'axe',
    name: 'Axe',
    output: Object.freeze({ kind: 'tool', toolType: 'axe', id: 'axe', count: 1 }),
    pattern: Object.freeze([
      ingredientFamily('ingot', 'Ingot', CRAFTING_INGOT_IDS), ingredientFamily('ingot', 'Ingot', CRAFTING_INGOT_IDS), null,
      ingredientFamily('ingot', 'Ingot', CRAFTING_INGOT_IDS), ingredientFamily('crafted', 'Stick', CRAFTING_STICK_IDS), null,
      null, ingredientFamily('crafted', 'Stick', CRAFTING_STICK_IDS), null,
    ]),
  },
  {
    id: 'sickle',
    name: 'Sickle',
    output: Object.freeze({ kind: 'tool', toolType: 'sickle', id: 'sickle', count: 1 }),
    pattern: Object.freeze([
      null, ingredientFamily('ingot', 'Ingot', CRAFTING_INGOT_IDS), ingredientFamily('ingot', 'Ingot', CRAFTING_INGOT_IDS),
      null, null, ingredientFamily('ingot', 'Ingot', CRAFTING_INGOT_IDS),
      null, ingredientFamily('crafted', 'Stick', CRAFTING_STICK_IDS), null,
    ]),
  },
  {
    id: 'shortbow',
    name: 'Shortbow',
    output: Object.freeze({ kind: 'tool', toolType: 'shortbow', id: 'shortbow', count: 1 }),
    pattern: Object.freeze([
      ingredient('crafted', 'fiber'), ingredientFamily('crafted', 'Stick', CRAFTING_STICK_IDS), null,
      ingredient('crafted', 'fiber'), ingredientOptions('Leather', CRAFTING_LEATHER_ITEMS), ingredientFamily('crafted', 'Stick', CRAFTING_STICK_IDS),
      ingredient('crafted', 'fiber'), ingredientFamily('crafted', 'Stick', CRAFTING_STICK_IDS), null,
    ]),
  },
  {
    id: 'voidwoodPlank',
    name: 'Voidwood Plank',
    output: Object.freeze({ id: 'voidwoodPlank', count: 1 }),
    pattern: Object.freeze([
      ingredient('gathered', 'voidwood'), ingredient('gathered', 'voidwood'), ingredient('gathered', 'voidwood'),
      ingredient('gathered', 'voidwood'), ingredient('crafted', 'plank'), ingredient('gathered', 'voidwood'),
      ingredient('gathered', 'voidwood'), ingredient('gathered', 'voidwood'), ingredient('gathered', 'voidwood'),
    ]),
  },
  {
    id: 'arcanewoodPlank',
    name: 'Arcanewood Plank',
    output: Object.freeze({ id: 'arcanewoodPlank', count: 1 }),
    pattern: Object.freeze([
      ingredient('gathered', 'arcanewood'), ingredient('gathered', 'arcanewood'), ingredient('gathered', 'arcanewood'),
      ingredient('gathered', 'arcanewood'), ingredient('crafted', 'voidwoodPlank'), ingredient('gathered', 'arcanewood'),
      ingredient('gathered', 'arcanewood'), ingredient('gathered', 'arcanewood'), ingredient('gathered', 'arcanewood'),
    ]),
  },
]);

function matchesIngredient(slot, required) {
  if (!required) return !slot?.id || !(slot.count > 0);
  const matchesIdentity = required.acceptedItems
    ? required.acceptedItems.some(item => item.source === slot?.source && item.id === slot?.id)
    : slot?.source === required.source
      && (required.acceptedIds ? required.acceptedIds.includes(slot?.id) : slot?.id === required.id);
  return matchesIdentity
    && (slot.count ?? 0) >= required.count;
}

function getShapelessAssignments(slots, requirements = []) {
  const filledIndexes = slots
    .map((slot, index) => (slot?.id && slot.count > 0 ? index : null))
    .filter(index => index != null);
  if (filledIndexes.length !== requirements.length) return null;

  const assign = (requirementIndex, availableIndexes, assignments) => {
    if (requirementIndex >= requirements.length) return assignments;
    const required = requirements[requirementIndex];
    for (const index of availableIndexes) {
      if (!matchesIngredient(slots[index], required)) continue;
      const result = assign(
        requirementIndex + 1,
        availableIndexes.filter(candidate => candidate !== index),
        [...assignments, { index, required }],
      );
      if (result) return result;
    }
    return null;
  };

  return assign(0, filledIndexes, []);
}

function acceptedMaterials(required) {
  if (required.acceptedItems) return required.acceptedItems;
  return (required.acceptedIds ?? [required.id]).map(id => ({ source: required.source, id }));
}

function getRecipeMaterialQuality(savedSlots, recipe) {
  if (!recipe || (recipe.output?.kind !== 'tool' && !recipe.qualityFromMaterials)) return null;
  const slots = normalizeCraftingGridSlots(savedSlots);
  const qualityIndexes = recipe.qualityIngredientIndexes ? new Set(recipe.qualityIngredientIndexes) : null;
  const components = recipe.pattern.flatMap((required, index) => {
    if (!required || (qualityIndexes && !qualityIndexes.has(index))) return [];
    const quality = Math.max(1, Math.min(5, CRAFTING_MATERIAL_QUALITY[slots[index].id] ?? 1));
    return Array.from({ length: required.count }, () => ({
      source: slots[index].source,
      id: slots[index].id,
      quality,
    }));
  });
  const score = components.reduce((sum, component) => sum + component.quality, 0);
  const scoreBounds = recipe.pattern.reduce((bounds, required, index) => {
    if (!required || (qualityIndexes && !qualityIndexes.has(index))) return bounds;
    const qualities = acceptedMaterials(required)
      .map(item => Math.max(1, Math.min(5, CRAFTING_MATERIAL_QUALITY[item.id] ?? 1)));
    return {
      minimum: bounds.minimum + (Math.min(...qualities) * required.count),
      maximum: bounds.maximum + (Math.max(...qualities) * required.count),
    };
  }, { minimum: 0, maximum: 0 });
  const range = scoreBounds.maximum - scoreBounds.minimum;
  const normalizedQuality = range > 0 ? 1 + ((score - scoreBounds.minimum) / range) * 4 : 1;
  return {
    score,
    minimumScore: scoreBounds.minimum,
    maximumScore: scoreBounds.maximum,
    normalizedQuality,
    tier: Math.max(1, Math.min(5, Math.round(normalizedQuality))),
    components,
  };
}

export function getToolRecipeQuality(savedSlots, recipe = findCraftingRecipe(savedSlots)) {
  if (recipe?.output?.kind !== 'tool') return null;
  return getRecipeMaterialQuality(savedSlots, recipe);
}

export function findCraftingRecipe(savedSlots) {
  const slots = normalizeCraftingGridSlots(savedSlots);
  return CRAFTING_RECIPES.find(recipe => {
    if (recipe.anySingleCell) {
      const filled = slots.filter(slot => slot.id && slot.count > 0);
      return filled.length === 1 && matchesIngredient(filled[0], recipe.anySingleCell);
    }
    if (recipe.shapeless) return Boolean(getShapelessAssignments(slots, recipe.shapeless));
    return recipe.pattern.every((required, index) => matchesIngredient(slots[index], required));
  }) ?? null;
}

export function getCraftingResult(savedSlots) {
  const slots = normalizeCraftingGridSlots(savedSlots);
  const recipe = findCraftingRecipe(slots);
  if (!recipe) return null;
  const quality = getRecipeMaterialQuality(slots, recipe);
  const inheritedTierSlot = recipe.inheritedTierIngredientPrefix
    ? slots.find(slot => slot.source === 'crafted' && slot.id?.startsWith(recipe.inheritedTierIngredientPrefix))
    : null;
  const inheritedTier = inheritedTierSlot
    ? Math.max(1, Math.min(5, Number.parseInt(inheritedTierSlot.id.slice(recipe.inheritedTierIngredientPrefix.length), 10) || 1))
    : null;
  return {
    ...recipe.output,
    ...(recipe.output.kind === 'tieredCrafted' && quality
      ? { id: `${recipe.output.idPrefix}${quality.tier}` }
      : null),
    ...(recipe.output.kind === 'calling' && inheritedTier
      ? {
          id: getCallingItemId(recipe.output.callingType, recipe.output.targetId, inheritedTier),
          tier: inheritedTier,
        }
      : null),
    ...(quality ? {
      tier: quality.tier,
      materialQuality: quality.tier,
      materialScore: quality.score,
      minimumMaterialScore: quality.minimumScore,
      maximumMaterialScore: quality.maximumScore,
      components: quality.components,
    } : null),
  };
}

/** Return how many complete copies of the currently matched pattern can be made. */
export function getMaxCraftableCount(savedSlots) {
  const slots = normalizeCraftingGridSlots(savedSlots);
  const recipe = findCraftingRecipe(slots);
  if (!recipe) return 0;

  if (recipe.anySingleCell) {
    const slot = slots.find(entry => matchesIngredient(entry, recipe.anySingleCell));
    return slot ? Math.floor(slot.count / recipe.anySingleCell.count) : 0;
  }

  if (recipe.shapeless) {
    const assignments = getShapelessAssignments(slots, recipe.shapeless);
    if (!assignments) return 0;
    return assignments.reduce((maximum, { index, required }) => (
      Math.min(maximum, Math.floor(slots[index].count / required.count))
    ), Infinity);
  }

  return recipe.pattern.reduce((maximum, required, index) => {
    if (!required) return maximum;
    return Math.min(maximum, Math.floor(slots[index].count / required.count));
  }, Infinity);
}

export function craftGridRecipe(savedSlots, requestedCraftCount = 1) {
  const slots = normalizeCraftingGridSlots(savedSlots);
  const recipe = findCraftingRecipe(slots);
  if (!recipe) return { recipe: null, slots, output: null };

  const maxCraftable = getMaxCraftableCount(slots);
  const requested = requestedCraftCount === Infinity
    ? maxCraftable
    : Math.max(1, Math.floor(Number(requestedCraftCount) || 1));
  const craftCount = Math.min(requested, maxCraftable);
  const previewOutput = getCraftingResult(slots);

  let singleCellConsumed = false;
  const shapelessRequirements = new Map(
    (recipe.shapeless ? getShapelessAssignments(slots, recipe.shapeless) ?? [] : [])
      .map(({ index, required }) => [index, required]),
  );
  const nextSlots = slots.map((slot, index) => {
    let required = recipe.pattern?.[index] ?? shapelessRequirements.get(index) ?? null;
    if (recipe.anySingleCell && !singleCellConsumed && matchesIngredient(slot, recipe.anySingleCell)) {
      required = recipe.anySingleCell;
      singleCellConsumed = true;
    }
    if (!required) return slot;
    const count = slot.count - (required.count * craftCount);
    return count > 0
      ? { ...slot, count }
      : { ...slot, source: null, id: null, name: '', count: 0 };
  });

  return {
    recipe,
    slots: nextSlots,
    output: {
      ...previewOutput,
      count: recipe.output.count * craftCount,
    },
    craftCount,
    maxCraftable,
  };
}

export function createCraftingCardSlots() {
  return Array.from({ length: CRAFTING_CARD_SLOT_COUNT }, (_, index) => ({
    slotId: index + 1,
    card: null,
  }));
}

export function normalizeCraftingCardSlots(savedSlots = []) {
  const slots = Array.isArray(savedSlots) ? savedSlots : [];
  return createCraftingCardSlots().map(slot => {
    const saved = slots.find(entry => Number(entry?.slotId) === slot.slotId);
    return saved?.card ? { ...slot, card: { ...saved.card } } : slot;
  });
}

export function createCraftingGridSlots() {
  return Array.from({ length: CRAFTING_GRID_SLOT_COUNT }, (_, index) => ({
    slotId: index + 1,
    source: null,
    id: null,
    name: '',
    count: 0,
  }));
}

export function normalizeCraftingGridSlots(savedSlots = []) {
  const slots = Array.isArray(savedSlots) ? savedSlots : [];
  return createCraftingGridSlots().map(slot => {
    const saved = slots.find(entry => Number(entry?.slotId) === slot.slotId);
    if (!saved || !CRAFTING_RESOURCE_SOURCES.includes(saved.source) || typeof saved.id !== 'string') {
      return slot;
    }
    const count = Math.max(0, Math.floor(Number(saved.count) || 0));
    if (!count) return slot;
    return {
      ...slot,
      source: saved.source,
      id: saved.id,
      name: typeof saved.name === 'string' ? saved.name : saved.id,
      count,
    };
  });
}

/**
 * Add a held stack to every compatible crafting cell in a single balanced pass.
 *
 * The caller supplies cells in touch order. Duplicate and incompatible cells are ignored, and no more
 * cells are used than there are items to place, so every highlighted cell receives at least one item.
 * Any indivisible remainder is assigned from the start of the gesture; allocations therefore differ by
 * at most one while preserving the complete held stack.
 */
export function distributeCraftingStack(savedSlots, stack, touchedSlotIds = []) {
  const slots = normalizeCraftingGridSlots(savedSlots);
  const count = Math.max(0, Math.floor(Number(stack?.count) || 0));
  if (!count || !CRAFTING_RESOURCE_SOURCES.includes(stack?.source) || typeof stack?.id !== 'string') {
    return { slots, placed: 0, targetSlotIds: [] };
  }

  const uniqueIds = [...new Set(touchedSlotIds.map(Number).filter(Number.isFinite))];
  const targetSlotIds = uniqueIds.filter(slotId => {
    const slot = slots.find(entry => entry.slotId === slotId);
    return slot && (!slot.id || (slot.source === stack.source && slot.id === stack.id));
  }).slice(0, count);
  if (targetSlotIds.length === 0) return { slots, placed: 0, targetSlotIds: [] };

  const amountPerSlot = Math.floor(count / targetSlotIds.length);
  const remainder = count % targetSlotIds.length;
  const allocations = new Map(targetSlotIds.map((slotId, index) => [
    slotId,
    amountPerSlot + (index < remainder ? 1 : 0),
  ]));

  return {
    placed: count,
    targetSlotIds,
    slots: slots.map(slot => {
      const amount = allocations.get(slot.slotId) ?? 0;
      if (!amount) return slot;
      return {
        ...slot,
        source: stack.source,
        id: stack.id,
        name: stack.name ?? stack.id,
        count: (slot.count ?? 0) + amount,
      };
    }),
  };
}
