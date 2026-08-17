import { createServer } from 'vite';

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
});

const {
  CLASS_AFFIX_POOLS,
  CLASS_REGISTRY,
} = await vite.ssrLoadModule('/src/game/cards.js');
const {
  addProcessingMaterial,
  addProcessingBooster,
  consumeProcessingBoosterCharge,
  createProcessingSlot,
  getProcessingBoosterSpeedPercent,
  getProcessingDurationSeconds,
  getProcessingRecipe,
  isProcessingCardCompatible,
  isProcessingSlotReady,
  resolveCompletedProcessingSlots,
  startProcessingSlot,
} = await vite.ssrLoadModule('/src/game/wilderness.js');
const {
  addForgeBooster,
  consumeForgeBoosterCharge,
  GEM_FUSION_RECIPES,
  getForgeBoosterSpeedPercent,
  getForgeCycleDurationSeconds,
  isMiningCardCompatible,
  resolveOreWeightsForCard,
} = await vite.ssrLoadModule('/src/game/foundry.js');
const { DULL_GEMS } = await vite.ssrLoadModule('/src/game/gems.js');

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const worker = (classType, affixes = []) => ({
  id: `${classType}-test`, classType, rarity: 'rare', tier: 3, affixes,
});

check('all specialist classes are registered',
  ['weaver', 'woodworker', 'tanner', 'prospector', 'gemcutter'].every(id => CLASS_REGISTRY[id]));
check('specialist affix pools contain their unique mechanics',
  ['weavingEfficiency', 'weavingBounty', 'weavingLuck'].every(id => CLASS_AFFIX_POOLS.weaver.some(affix => affix.id === id))
  && ['woodworkingEfficiency', 'woodworkingBounty', 'woodworkingLuck'].every(id => CLASS_AFFIX_POOLS.woodworker.some(affix => affix.id === id))
  && ['tanningSpeed', 'tanningEfficiency', 'tanningBounty', 'tanningLuck'].every(id => CLASS_AFFIX_POOLS.tanner.some(affix => affix.id === id))
  && CLASS_AFFIX_POOLS.prospector.some(affix => affix.id === 'gemFind')
  && CLASS_AFFIX_POOLS.gemcutter.some(affix => affix.id === 'gemcuttingLuck'));
check('station compatibility separates processing specialists and mine workers',
  isProcessingCardCompatible(worker('weaver'))
  && !isProcessingCardCompatible(worker('miner'))
  && isMiningCardCompatible(worker('miner'))
  && isMiningCardCompatible(worker('prospector'))
  && !isMiningCardCompatible(worker('woodworker')));

function loadedSlot(classType, materials) {
  let slot = { ...createProcessingSlot(1), card: worker(classType) };
  materials.forEach(({ source, id, count }) => { slot = addProcessingMaterial(slot, source, id, count); });
  return startProcessingSlot(slot, 10);
}

const woven = loadedSlot('weaver', [{ source: 'crafted', id: 'fiber', count: 1 }]);
const wovenResult = resolveCompletedProcessingSlots([woven], woven.endsAt, () => 0.99);
check('Weaver converts one Fiber into two Linen',
  isProcessingSlotReady(woven)
  && wovenResult.completedBySlot['1']?.linen === 2
  && wovenResult.nextSlots[0].inputCount === 0,
  JSON.stringify(wovenResult.completedBySlot));

const woodResults = [
  ['wood', 'timber'],
  ['hardwood', 'lumber'],
].map(([id, outputId], index) => {
  const slot = loadedSlot('woodworker', [{ source: 'gathered', id, count: 1 }]);
  const result = resolveCompletedProcessingSlots([{ ...slot, slotId: index + 1 }], slot.endsAt, () => 0.99);
  return result.completedBySlot[String(index + 1)]?.[outputId];
});
check('Woodworker converts Wood and Hardwood at 1:2', woodResults.every(count => count === 2), woodResults.join(','));

const tanning = loadedSlot('tanner', [
  { source: 'crafted', id: 'roughLeather', count: 1 },
  { source: 'gathered', id: 'toughHide', count: 2 },
]);
const tanningResult = resolveCompletedProcessingSlots([tanning], tanning.endsAt, () => 0.99);
check('Tanner reserves and consumes the complete two-material refined-leather recipe',
  getProcessingRecipe(tanning)?.outputId === 'refinedLeather'
  && tanningResult.completedBySlot['1']?.refinedLeather === 1
  && tanningResult.nextSlots[0].inputCount === 0
  && tanningResult.nextSlots[0].ingredientCount === 0,
  JSON.stringify(tanningResult.completedBySlot));

const tanner = worker('tanner');
let tanninSlot = addProcessingBooster({ ...createProcessingSlot(1), card: tanner }, 'tannin', 2);
check('Tannin grants 15% Tanner speed and carries five cycles per unit',
  getProcessingBoosterSpeedPercent(tanninSlot) === 15
  && getProcessingDurationSeconds(tanner, 15) < getProcessingDurationSeconds(tanner)
  && tanninSlot.boosterCount === 2
  && tanninSlot.boosterCharges === 5);
for (let cycle = 0; cycle < 5; cycle += 1) tanninSlot = consumeProcessingBoosterCharge(tanninSlot);
check('one Tannin is consumed only after five completed cycles',
  tanninSlot.boosterCount === 1 && tanninSlot.boosterCharges === 5);
let boostedTanningCycle = { ...createProcessingSlot(1), card: tanner };
boostedTanningCycle = addProcessingMaterial(boostedTanningCycle, 'gathered', 'hide', 1);
boostedTanningCycle = addProcessingBooster(boostedTanningCycle, 'tannin', 1);
boostedTanningCycle = startProcessingSlot(boostedTanningCycle, 10);
const boostedTanningResult = resolveCompletedProcessingSlots(
  [boostedTanningCycle],
  boostedTanningCycle.endsAt,
  () => 0.99,
);
check('a completed Tanner cycle consumes one Tannin charge and keeps the remaining four active',
  boostedTanningResult.nextSlots[0].boosterCount === 1
  && boostedTanningResult.nextSlots[0].boosterCharges === 4);
check('non-Tanner processing cards cannot load Tannin',
  addProcessingBooster({ ...createProcessingSlot(1), card: worker('weaver') }, 'tannin', 1).boosterCount === 0);

let fluxSlot = addForgeBooster({ slotId: 1 }, 'flux', 2);
check('Flux grants 10% smelting speed and carries five cycles per unit',
  getForgeBoosterSpeedPercent(fluxSlot) === 10
  && getForgeCycleDurationSeconds(worker('blacksmith'), 10) < getForgeCycleDurationSeconds(worker('blacksmith'))
  && fluxSlot.boosterCount === 2
  && fluxSlot.boosterCharges === 5);
for (let cycle = 0; cycle < 5; cycle += 1) fluxSlot = consumeForgeBoosterCharge(fluxSlot);
check('one Flux is consumed only after five completed smelts',
  fluxSlot.boosterCount === 1 && fluxSlot.boosterCharges === 5);

let arcaneFluxSlot = addForgeBooster({ slotId: 1 }, 'arcaneFlux', 1);
for (let cycle = 0; cycle < 14; cycle += 1) arcaneFluxSlot = consumeForgeBoosterCharge(arcaneFluxSlot);
check('Arcane Flux grants 20% speed and lasts fifteen completed smelts',
  getForgeCycleDurationSeconds(worker('blacksmith'), 20) < getForgeCycleDurationSeconds(worker('blacksmith'), 10)
  && arcaneFluxSlot.boosterCount === 1
  && arcaneFluxSlot.boosterCharges === 1
  && consumeForgeBoosterCharge(arcaneFluxSlot).boosterCount === 0);

let luckySlot = { ...createProcessingSlot(1), card: worker('weaver', [
  { id: 'weavingEfficiency', stat: 'weavingEfficiency', value: 100 },
  { id: 'weavingBounty', stat: 'weavingBounty', value: 100 },
  { id: 'weavingLuck', stat: 'weavingLuck', value: 100 },
]) };
luckySlot = addProcessingMaterial(luckySlot, 'crafted', 'fiber', 1);
luckySlot = startProcessingSlot(luckySlot, 10);
const luckyResult = resolveCompletedProcessingSlots([luckySlot], luckySlot.endsAt, () => 0);
check('Efficiency preserves inputs, Bounty adds primary output, and Luck enters the bonus queue',
  luckyResult.completedBySlot['1']?.linen === 3
  && luckyResult.nextSlots[0].inputCount === 1
  && luckyResult.bonusOutputs.sateen === 1,
  JSON.stringify({ output: luckyResult.completedBySlot, bonus: luckyResult.bonusOutputs }));

const miner = worker('miner');
const prospector = worker('prospector');
const minerWeights = resolveOreWeightsForCard(miner);
const prospectorWeights = resolveOreWeightsForCard(prospector);
const gemWeight = weights => DULL_GEMS.reduce((sum, gem) => sum + (weights[gem.id] ?? 0), 0);
check('Prospector has a substantially higher gem share than Miner',
  gemWeight(prospectorWeights) > gemWeight(minerWeights) * 10,
  `${gemWeight(minerWeights).toFixed(2)} -> ${gemWeight(prospectorWeights).toFixed(2)}`);
const gemfinderWeights = resolveOreWeightsForCard(worker('prospector', [{ id: 'gemFind', stat: 'gemFind', value: 50 }]));
check('Gem Find boosts gems without boosting stone',
  gemWeight(gemfinderWeights) > gemWeight(prospectorWeights)
  && gemfinderWeights.stone === prospectorWeights.stone);
check('Prospectors find Gemdust substantially more often than Miners',
  prospectorWeights.gemdust >= minerWeights.gemdust * 4,
  `${minerWeights.gemdust} -> ${prospectorWeights.gemdust}`);

const fusionExpectations = [
  ['dull_ruby', 'cut_ruby', 'smoldering_mote', 10],
  ['cut_sapphire', 'brilliant_sapphire', 'flowing_wisp', 10],
  ['brilliant_topaz', 'exalted_topaz', 'jolting', 10],
  ['exalted_emerald', 'royal_emerald', 'blooming_quintessence', 5],
  ['exalted_diamond', 'royal_diamond', 'gusting_quintessence', 5],
];
check('Gemcutter fusion maps gem families and cut tiers to the requested catalysts',
  fusionExpectations.every(([input, output, catalyst, count]) => {
    const recipe = GEM_FUSION_RECIPES[input];
    return recipe?.outputId === output
      && recipe?.oreCount === 10
      && recipe?.ingredient?.type === catalyst
      && recipe?.ingredient?.count === count
      && recipe?.fuelType === 'gemdust'
      && recipe?.cardClass === 'gemcutter';
  }));

const failed = results.filter(result => !result.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await vite.close();
if (failed.length > 0) process.exitCode = 1;
