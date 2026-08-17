import { ELEMENTAL_ATTUNEMENT_AFFIXES, getCardAffixBonuses, newId } from './cards';
import { getElementResourceId } from './arcana';

export const TOOL_TIERS = Object.freeze([1, 2, 3, 4, 5]);
export const TOOL_TIER_LABELS = Object.freeze(['', 'I', 'II', 'III', 'IV', 'V']);

export const TOOL_TYPES = Object.freeze({
  pickaxe: Object.freeze({
    id: 'pickaxe', name: 'Pickaxe', artKey: 'steel_pickaxe', activity: 'Mining', classType: 'miner',
  }),
  axe: Object.freeze({
    id: 'axe', name: 'Axe', artKey: 'steel_axe', activity: 'Logging', classType: 'lumberjack',
  }),
  sickle: Object.freeze({
    id: 'sickle', name: 'Sickle', artKey: 'steel_sickle', activity: 'Gathering', classType: 'forager',
  }),
  shortbow: Object.freeze({
    id: 'shortbow', name: 'Shortbow', artKey: 'shortbow', activity: 'Hunting', classType: 'hunter',
  }),
});

export const TOOL_TYPE_BY_CLASS = Object.freeze(
  Object.fromEntries(Object.values(TOOL_TYPES).map(tool => [tool.classType, tool.id])),
);

export const TOOL_ELEMENT_IDS = Object.freeze([
  'smoldering', 'jolting', 'flowing', 'blooming', 'gusting',
  'hollowing', 'gleaming', 'ascending', 'grounding',
]);

/** Kept here rather than importing Wilderness, which would create a tools ↔ wilderness cycle. */
export const TOOL_AFFINITY_MATERIALS = Object.freeze({
  pickaxe: Object.freeze(['stone', 'coal', 'iron', 'silver', 'gold', 'platinum', 'starlit']),
  axe: Object.freeze(['wood', 'hardwood', 'resin', 'softwoodSap', 'petrifiedWood', 'voidwood', 'arcanewood', 'starwood']),
  sickle: Object.freeze(['fiberweed', 'hyssop', 'wildflowers', 'softstem', 'garlic', 'wildOnion', 'silkgrass', 'mushrooms', 'honeycomb']),
  shortbow: Object.freeze(['hide', 'toughHide', 'fineFur', 'infusedBone', 'fierceFang', 'toughScales', 'mightyHide']),
});

const MATERIAL_NAMES = Object.freeze({
  softwoodSap: 'Softwood Sap', petrifiedWood: 'Petrified Wood', voidwood: 'Voidwood',
  arcanewood: 'Arcanewood', starwood: 'Starwood', toughHide: 'Tough Hide', fineFur: 'Fine Fur',
  infusedBone: 'Infused Bone', fierceFang: 'Fierce Fang', toughScales: 'Tough Scales',
  mightyHide: 'Mighty Hide', fiberweed: 'Fiberweed', softstem: 'Softstem', silkgrass: 'Silkgrass',
  wildflowers: 'Wildflowers', wildOnion: 'Wild Onion', mushrooms: 'Mushrooms', honeycomb: 'Honeycomb',
  stone: 'Stone', coal: 'Coal', iron: 'Iron Ore', silver: 'Silver Ore', gold: 'Gold Ore',
  platinum: 'Platinum Ore', starlit: 'Starlit Ore', wood: 'Wood', hardwood: 'Hardwood',
  resin: 'Resin', hide: 'Hide', hyssop: 'Hyssop', garlic: 'Garlic',
});

const ELEMENT_NAMES = Object.freeze({
  smoldering: 'Smoldering', jolting: 'Jolting', flowing: 'Flowing', blooming: 'Blooming',
  gusting: 'Gusting', hollowing: 'Hollowing', gleaming: 'Gleaming', ascending: 'Ascending',
  grounding: 'Grounding',
});

const STANDARD_RANGES = Object.freeze({
  1: [2, 6], 2: [5, 10], 3: [9, 15], 4: [14, 22], 5: [20, 30],
});

const TOOL_AFFIX_DEFINITIONS = Object.freeze([
  { id: 'efficiency', label: tool => `${tool.activity} Efficiency`, scale: 1 },
  { id: 'luck', label: tool => `${tool.activity} Luck`, scale: 1 },
  { id: 'yield', label: () => 'Yield', scale: 1 },
  { id: 'discovery', label: () => 'Discovery Chance', scale: 0.5 },
  { id: 'elementalResonance', label: (_tool, variant) => `${ELEMENT_NAMES[variant]} Resonance`, scale: 0.5, variant: 'element' },
  { id: 'bounty', label: () => 'Bounty Chance', scale: 0.5 },
  { id: 'momentum', label: () => 'Momentum', scale: 0.4 },
  { id: 'materialAffinity', label: (_tool, variant) => `${MATERIAL_NAMES[variant] ?? variant} Affinity`, scale: 1, variant: 'material' },
  { id: 'artisanSynergy', label: () => 'Artisan Synergy', scale: 0.5 },
  { id: 'refinement', label: () => 'Refinement Chance', scale: 0.35 },
]);

export const TOOL_AFFIX_IDS = Object.freeze(TOOL_AFFIX_DEFINITIONS.map(affix => affix.id));

function clampTier(value) {
  return Math.max(1, Math.min(5, Math.floor(Number(value) || 1)));
}

function pick(values, random) {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))];
}

function rollAffixValue(tier, scale, materialQuality, random) {
  const [baseMin, baseMax] = STANDARD_RANGES[tier];
  const quality = Math.max(1, Math.min(5, Number(materialQuality) || tier));
  // Material quality controls where the roll tends to land inside the tier's legal range. It never
  // permits a Tier-II recipe to roll Tier-V values; that boundary remains the recipe/tool tier.
  const qualityBias = (quality - 1) / 4;
  const sampled = Math.pow(random(), 1.65 - qualityBias * 1.15);
  const min = Math.max(1, Math.round(baseMin * scale));
  const max = Math.max(min, Math.round(baseMax * scale));
  return min + Math.floor(sampled * (max - min + 1));
}

export function rollToolAffixes(toolType, tier = 1, options = {}) {
  const tool = TOOL_TYPES[toolType];
  if (!tool) return [];
  const safeTier = clampTier(tier);
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const remaining = [...TOOL_AFFIX_DEFINITIONS];
  const affixes = [];

  for (let index = 0; index < safeTier && remaining.length > 0; index += 1) {
    const definition = remaining.splice(Math.floor(random() * remaining.length), 1)[0];
    let variant = null;
    if (definition.variant === 'element') variant = pick(TOOL_ELEMENT_IDS, random);
    if (definition.variant === 'material') variant = pick(TOOL_AFFINITY_MATERIALS[toolType], random);
    affixes.push({
      id: definition.id,
      stat: definition.id,
      label: definition.label(tool, variant),
      value: rollAffixValue(safeTier, definition.scale, options.materialQuality ?? safeTier, random),
      ...(definition.variant === 'element' ? { elementId: variant } : null),
      ...(definition.variant === 'material' ? { materialId: variant } : null),
    });
  }
  return affixes;
}

export function rollTool(toolType, tier = 1, options = {}) {
  const definition = TOOL_TYPES[toolType];
  if (!definition) return null;
  const safeTier = clampTier(tier);
  return {
    id: options.id ?? newId(),
    itemType: 'tool',
    toolType,
    name: definition.name,
    artKey: definition.artKey,
    tier: safeTier,
    materialQuality: Math.max(1, Math.min(5, Number(options.materialQuality) || safeTier)),
    ...(Number.isFinite(Number(options.materialScore)) ? { materialScore: Number(options.materialScore) } : null),
    ...(Array.isArray(options.components) ? { craftedFrom: options.components.map(component => ({ ...component })) } : null),
    affixes: rollToolAffixes(toolType, safeTier, options),
  };
}

export function normalizeTool(savedTool) {
  if (!savedTool || typeof savedTool !== 'object' || !TOOL_TYPES[savedTool.toolType]) return null;
  const definition = TOOL_TYPES[savedTool.toolType];
  const tier = clampTier(savedTool.tier);
  const affixes = Array.isArray(savedTool.affixes)
    ? savedTool.affixes.slice(0, tier).filter(affix => TOOL_AFFIX_IDS.includes(affix?.id)).map(affix => ({ ...affix }))
    : [];
  return {
    ...savedTool,
    id: typeof savedTool.id === 'string' ? savedTool.id : newId(),
    itemType: 'tool',
    name: definition.name,
    artKey: definition.artKey,
    tier,
    materialQuality: Math.max(1, Math.min(5, Number(savedTool.materialQuality) || tier)),
    affixes,
  };
}

export function normalizeToolInventory(savedTools = []) {
  return (Array.isArray(savedTools) ? savedTools : []).map(normalizeTool).filter(Boolean);
}

export function getToolAffix(tool, affixId) {
  return tool?.affixes?.find(affix => affix.id === affixId) ?? null;
}

export function getToolAffixValue(tool, affixId) {
  return Number(getToolAffix(tool, affixId)?.value) || 0;
}

export function getToolAdjustedCardAffix(card, tool, stat) {
  const base = getCardAffixBonuses(card)?.[stat] ?? 0;
  return base * (1 + getToolAffixValue(tool, 'artisanSynergy') / 100);
}

export function getToolEfficiencyPercent(card, tool, cardEfficiencyStat, momentumStacks = 0) {
  const workerEfficiency = getToolAdjustedCardAffix(card, tool, cardEfficiencyStat);
  const toolEfficiency = getToolAffixValue(tool, 'efficiency');
  const momentum = getToolAffixValue(tool, 'momentum') * Math.max(0, Math.min(3, Number(momentumStacks) || 0));
  return workerEfficiency + toolEfficiency + momentum;
}

export function getToolLuckPercent(card, tool, cardLuckStat) {
  return getToolAdjustedCardAffix(card, tool, cardLuckStat) + getToolAffixValue(tool, 'luck');
}

export function getToolAttunementPercent(card, tool, cardAttunementStat) {
  return getToolAdjustedCardAffix(card, tool, cardAttunementStat);
}

export function getToolMaterialAffinity(tool) {
  const affix = getToolAffix(tool, 'materialAffinity');
  return affix?.materialId ? { materialId: affix.materialId, value: Number(affix.value) || 0 } : null;
}

export function getToolElementalResonance(tool) {
  const affix = getToolAffix(tool, 'elementalResonance');
  return affix?.elementId ? { elementId: affix.elementId, value: Number(affix.value) || 0 } : null;
}

export function rollToolElementalDrops(card, tool, random = Math.random) {
  const drops = {};
  const synergy = 1 + getToolAffixValue(tool, 'artisanSynergy') / 100;
  for (const affix of ELEMENTAL_ATTUNEMENT_AFFIXES) {
    const chance = (getCardAffixBonuses(card)?.[affix.stat] ?? 0) * synergy;
    if (!rollPercent(chance, random)) continue;
    const resourceId = getElementResourceId(affix.elementId, 'mote');
    drops[resourceId] = (drops[resourceId] ?? 0) + 1;
  }
  const resonance = getToolElementalResonance(tool);
  if (resonance && rollPercent(resonance.value, random)) {
    const resourceId = getElementResourceId(resonance.elementId, 'mote');
    drops[resourceId] = (drops[resourceId] ?? 0) + 1;
  }
  return drops;
}

export function rollPercent(percent, random = Math.random) {
  return random() * 100 < Math.max(0, Number(percent) || 0);
}

export function applyToolPrimaryQuantity(baseCount, tool, random = Math.random) {
  let count = Math.max(0, Math.floor(Number(baseCount) || 0));
  const yieldPercent = getToolAffixValue(tool, 'yield');
  count += Math.floor(yieldPercent / 100);
  if (rollPercent(yieldPercent % 100, random)) count += 1;
  if (rollPercent(getToolAffixValue(tool, 'bounty'), random)) count *= 2;
  return count;
}

export function toolRollsDiscovery(tool, random = Math.random) {
  return rollPercent(getToolAffixValue(tool, 'discovery'), random);
}

export function toolRollsRefinement(tool, random = Math.random) {
  return rollPercent(getToolAffixValue(tool, 'refinement'), random);
}

export function isToolCompatibleWithStation(tool, station, card = null) {
  if (!tool) return false;
  if (station === 'mine') return tool.toolType === 'pickaxe';
  if (station === 'gathering') {
    return ['axe', 'sickle', 'shortbow'].includes(tool.toolType)
      && TOOL_TYPE_BY_CLASS[card?.classType] === tool.toolType;
  }
  return false;
}

export function formatToolAffix(affix) {
  if (!affix) return '';
  if (affix.id === 'momentum') return `+${affix.value}% ${affix.label} per cycle`;
  return `+${affix.value}% ${affix.label}`;
}
