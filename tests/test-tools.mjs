import { createServer } from 'vite';

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
});

const {
  TOOL_AFFIX_IDS,
  TOOL_TYPES,
  applyToolPrimaryQuantity,
  getToolEfficiencyPercent,
  isToolCompatibleWithStation,
  normalizeToolInventory,
  rollTool,
} = await vite.ssrLoadModule('/src/game/tools.js');
const {
  getMiningDurationSeconds,
  normalizeMiningSlots,
  resolveCompletedMiningSlots,
  resolveOreWeightsForCard,
} = await vite.ssrLoadModule('/src/game/foundry.js');
const {
  getGatheringDurationSeconds,
  normalizeGatheringSlots,
  resolveCompletedGatheringSlots,
} = await vite.ssrLoadModule('/src/game/wilderness.js');

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const sequence = values => {
  let index = 0;
  return () => values[index++ % values.length];
};

for (let tier = 1; tier <= 5; tier += 1) {
  const tool = rollTool('pickaxe', tier, { random: sequence([0.01, 0.3, 0.8, 0.55, 0.12, 0.91]) });
  check(`Tier ${tier} tool rolls exactly ${tier} distinct affix${tier === 1 ? '' : 'es'}`,
    tool.affixes.length === tier && new Set(tool.affixes.map(affix => affix.id)).size === tier,
    tool.affixes.map(affix => affix.id).join(','));
}

check('the tool affix pool contains the agreed ten types',
  TOOL_AFFIX_IDS.length === 10 && new Set(TOOL_AFFIX_IDS).size === 10,
  TOOL_AFFIX_IDS.join(','));
check('all four tool types are registered',
  Object.keys(TOOL_TYPES).join(',') === 'pickaxe,axe,sickle,shortbow');

const miner = {
  id: 'miner', classType: 'miner', rarity: 'legendary', tier: 1,
  affixes: [
    { id: 'miningEfficiency', stat: 'miningSpeed', value: 20 },
    { id: 'miningLuck', stat: 'miningLuck', value: 20 },
    { id: 'miningAttunement', stat: 'miningAttunement', value: 20 },
  ],
};
const pickaxe = {
  id: 'pickaxe-id', itemType: 'tool', toolType: 'pickaxe', name: 'Pickaxe', artKey: 'steel_pickaxe', tier: 5, materialQuality: 5,
  affixes: [
    { id: 'efficiency', value: 20 },
    { id: 'artisanSynergy', value: 25 },
    { id: 'yield', value: 100 },
    { id: 'bounty', value: 100 },
    { id: 'refinement', value: 100 },
  ],
};
check('Artisan Synergy amplifies worker Efficiency before tool Efficiency is added',
  getToolEfficiencyPercent(miner, pickaxe, 'miningSpeed') === 45);
check('tool Efficiency shortens a mining cycle',
  getMiningDurationSeconds(miner, pickaxe) < getMiningDurationSeconds(miner));
check('Yield is applied before Bounty', applyToolPrimaryQuantity(1, pickaxe, () => 0) === 4);
check('a Pickaxe is Mine-only and an Axe requires a Lumberjack',
  isToolCompatibleWithStation(pickaxe, 'mine', miner)
    && !isToolCompatibleWithStation(pickaxe, 'gathering', miner)
    && isToolCompatibleWithStation({ toolType: 'axe' }, 'gathering', { classType: 'lumberjack' })
    && !isToolCompatibleWithStation({ toolType: 'axe' }, 'gathering', { classType: 'hunter' }));

const epicMiner = { ...miner, rarity: 'epic' };
const epicLuckyWeights = resolveOreWeightsForCard(epicMiner, {
  ...pickaxe,
  affixes: [{ id: 'luck', value: 30 }, { id: 'materialAffinity', materialId: 'gold', value: 50 }],
});
const baseWeights = resolveOreWeightsForCard(epicMiner, null);
check('Mining Luck and Material Affinity increase rare/target weights without unlocking Mythic ore',
  epicLuckyWeights.gold > baseWeights.gold && epicLuckyWeights.starlit === 0,
  `gold ${baseWeights.gold}->${epicLuckyWeights.gold}, starlit=${epicLuckyWeights.starlit}`);

const finishedMine = {
  slotId: 1, card: miner, tool: pickaxe, momentumStacks: 0,
  startedAt: 1, endsAt: 2, oreType: 'stone',
};
const mined = resolveCompletedMiningSlots([finishedMine], 3, () => 0);
check('Refinement, Yield, and Bounty alter Mine output in the agreed order',
  mined.completedBySlot[0].loot.coal === 6 && mined.nextSlots[0].momentumStacks === 1,
  JSON.stringify(mined.completedBySlot[0].loot));

const forager = {
  id: 'forager', classType: 'forager', rarity: 'uncommon', tier: 1,
  affixes: [{ id: 'foragingEfficiency', stat: 'gatheringSpeed', value: 10 }],
};
const sickle = {
  id: 'sickle-id', itemType: 'tool', toolType: 'sickle', name: 'Sickle', artKey: 'steel_sickle', tier: 3, materialQuality: 2,
  affixes: [{ id: 'refinement', value: 100 }, { id: 'yield', value: 100 }, { id: 'efficiency', value: 20 }],
};
const gathered = resolveCompletedGatheringSlots([{
  slotId: 1, card: forager, tool: sickle, momentumStacks: 0,
  startedAt: 1, endsAt: 2, resourceId: 'wildflowers',
}], 3, () => 0);
check('Gathering Refinement advances only within the rarity-eligible ordered pool',
  gathered.completedBySlot[0].loot.softstem === 2 && gathered.completedBySlot[0].loot.silkgrass == null,
  JSON.stringify(gathered.completedBySlot[0].loot));
check('tool Efficiency shortens a gathering cycle',
  getGatheringDurationSeconds(forager, sickle) < getGatheringDurationSeconds(forager));

const commonTierFiveLumberjack = {
  id: 'common-lumberjack', classType: 'lumberjack', rarity: 'common', tier: 5, affixes: [],
};
const commonMassGather = resolveCompletedGatheringSlots([{
  slotId: 1, card: commonTierFiveLumberjack, tool: null, momentumStacks: 0,
  startedAt: 1, endsAt: 2, resourceId: 'wood',
}], 3, () => 0.999);
check('a Tier V Common gatherer makes five material rolls without bypassing its rarity gate',
  commonMassGather.completedBySlot[0].loot.wood === 1
    && commonMassGather.completedBySlot[0].loot.hardwood === 4
    && Object.values(commonMassGather.completedBySlot[0].loot).reduce((sum, amount) => sum + amount, 0) === 5,
  JSON.stringify(commonMassGather.completedBySlot[0].loot));

const otherTierFiveGatherers = [
  { classType: 'hunter', firstId: 'hide' },
  { classType: 'forager', firstId: 'fiberweed' },
].map(({ classType, firstId }) => resolveCompletedGatheringSlots([{
  slotId: 1,
  card: { id: `${classType}-tier-five`, classType, rarity: 'common', tier: 5, affixes: [] },
  tool: null, momentumStacks: 0, startedAt: 1, endsAt: 2, resourceId: firstId,
}], 3, () => 0.999).completedBySlot[0].loot);
check('Hunters and Foragers use the same one-roll-per-tier gathering rule',
  otherTierFiveGatherers.every(loot => Object.values(loot).reduce((sum, amount) => sum + amount, 0) === 5),
  JSON.stringify(otherTierFiveGatherers));

const legendaryTierFiveLumberjack = {
  id: 'legendary-lumberjack', classType: 'lumberjack', rarity: 'legendary', tier: 5, affixes: [],
};
const rareTargetGather = resolveCompletedGatheringSlots([{
  slotId: 1, card: legendaryTierFiveLumberjack, tool: null, momentumStacks: 0,
  startedAt: 1, endsAt: 2, resourceId: 'voidwood',
}], 3, () => 0.999);
check('a Tier V Legendary gatherer gets five independent chances at its rare material pool',
  rareTargetGather.completedBySlot[0].loot.voidwood === 1
    && rareTargetGather.completedBySlot[0].loot.arcanewood === 4,
  JSON.stringify(rareTargetGather.completedBySlot[0].loot));

const mythicTierFiveMiner = { ...miner, id: 'mythic-tier-five-miner', rarity: 'mythic', tier: 5, affixes: [] };
const rareTargetMine = resolveCompletedMiningSlots([{
  slotId: 1, card: mythicTierFiveMiner, tool: null, momentumStacks: 0,
  startedAt: 1, endsAt: 2, oreType: 'starlit',
}], 3, () => 0.93);
check('Mine also gives a Tier V worker five independently weighted material rolls',
  Object.values(rareTargetMine.completedBySlot[0].loot).reduce((sum, amount) => sum + amount, 0) === 5
    && rareTargetMine.completedBySlot[0].loot.starlit >= 1,
  JSON.stringify(rareTargetMine.completedBySlot[0].loot));

const normalizedMine = normalizeMiningSlots([{ ...finishedMine, tool: pickaxe, momentumStacks: 9 }]);
const normalizedGathering = normalizeGatheringSlots([{ slotId: 1, card: forager, tool: sickle, momentumStacks: 2 }]);
check('slot normalization preserves equipped tools and clamps Momentum',
  normalizedMine[0].tool.id === pickaxe.id && normalizedMine[0].momentumStacks === 3
    && normalizedGathering[0].tool.id === sickle.id && normalizedGathering[0].momentumStacks === 2);
check('tool inventory normalization drops malformed entries',
  normalizeToolInventory([pickaxe, { toolType: 'wand' }, null]).length === 1);

const failed = results.filter(result => !result.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await vite.close();
if (failed.length > 0) process.exitCode = 1;
