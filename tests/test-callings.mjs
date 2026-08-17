import {
  ARCANA_ITEMS_BY_ID,
  ELEMENTAL_CALLINGS,
  TRAIT_CALLINGS,
  VOCATIONAL_CALLINGS,
  getCallingItemId,
} from '../src/game/arcana.js';
import {
  craftGridRecipe,
  createCraftingGridSlots,
  findCraftingRecipe,
} from '../src/game/crafting.js';
import { SPECIAL_GATHERED_RESOURCES_BY_ID } from '../src/game/specialResources.js';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

function gridWith(entries) {
  const slots = createCraftingGridSlots();
  entries.forEach(({ index, source, id, count = 1 }) => {
    slots[index] = { ...slots[index], source, id, name: id, count };
  });
  return slots;
}

function checkCallingRecipe({ label, callingType, targetId, tier, reagent }) {
  const grid = gridWith([
    { index: 1, source: 'crafted', id: `emptyCallingTier${tier}` },
    { index: 7, ...reagent },
  ]);
  const crafted = craftGridRecipe(grid);
  const expectedId = getCallingItemId(callingType, targetId, tier);
  check(`${label} inherits Empty Calling tier ${tier}`,
    crafted.output?.kind === 'calling'
      && crafted.output?.id === expectedId
      && crafted.output?.tier === tier
      && crafted.slots.every(slot => slot.count === 0),
    `recipe=${crafted.recipe?.id} output=${JSON.stringify(crafted.output)}`);
}

check('only the three implemented Calling families are generated',
  ELEMENTAL_CALLINGS.length === 45
    && VOCATIONAL_CALLINGS.length === 50
    && TRAIT_CALLINGS.length === 35,
  `elemental=${ELEMENTAL_CALLINGS.length} vocational=${VOCATIONAL_CALLINGS.length} trait=${TRAIT_CALLINGS.length}`);

checkCallingRecipe({
  label: 'Smoldering Elemental Calling', callingType: 'elemental', targetId: 'smoldering', tier: 4,
  reagent: { source: 'arcana', id: 'smoldering' },
});
checkCallingRecipe({
  label: 'Prospector Vocational Calling', callingType: 'vocational', targetId: 'prospector', tier: 3,
  reagent: { source: 'gathered', id: 'geode' },
});
checkCallingRecipe({
  label: 'Luck Trait Calling', callingType: 'trait', targetId: 'luck', tier: 5,
  reagent: { source: 'gathered', id: 'rabbitsFoot' },
});
checkCallingRecipe({
  label: 'Efficiency Trait Calling', callingType: 'trait', targetId: 'efficiency', tier: 2,
  reagent: { source: 'gathered', id: 'honeycomb' },
});

const elementalCalling = ARCANA_ITEMS_BY_ID[getCallingItemId('elemental', 'smoldering', 4)];
const prospectorCalling = ARCANA_ITEMS_BY_ID[getCallingItemId('vocational', 'prospector', 3)];
const luckCalling = ARCANA_ITEMS_BY_ID[getCallingItemId('trait', 'luck', 5)];
check('crafted Callings resolve to altar-ready Calling-slot items',
  elementalCalling?.effect?.slot === 'calling'
    && elementalCalling.effect.targetEssenceId === 'smoldering'
    && prospectorCalling?.effect?.targetClassType === 'prospector'
    && luckCalling?.effect?.targetAffixIds?.includes('miningLuck'));

const shapelessCrafts = [
  ['flux', [
    { index: 0, source: 'gathered', id: 'quartz' },
    { index: 4, source: 'crafted', id: 'charcoal' },
    { index: 8, source: 'crafted', id: 'alkahest' },
  ]],
  ['arcaneFlux', [
    { index: 2, source: 'crafted', id: 'flux' },
    { index: 6, source: 'crafted', id: 'arcanicInfusion' },
  ]],
  ['tannin', [
    { index: 1, source: 'gathered', id: 'salt' },
    { index: 3, source: 'gathered', id: 'bark' },
    { index: 7, source: 'crafted', id: 'alkahest' },
  ]],
];
for (const [id, entries] of shapelessCrafts) {
  const result = craftGridRecipe(gridWith(entries));
  check(`${id} recipe is shapeless and consumes its inputs`,
    result.recipe?.id === id && result.output?.id === id && result.slots.every(slot => slot.count === 0));
}

for (const [inputSource, inputId, outputId] of [
  ['ore', 'coal', 'condensedCoal'],
  ['crafted', 'condensedCoal', 'refinedCoal'],
]) {
  const grid = gridWith(Array.from({ length: 9 }, (_, index) => ({ index, source: inputSource, id: inputId })));
  check(`a full 3x3 of ${inputId} creates ${outputId}`,
    findCraftingRecipe(grid)?.id === outputId && craftGridRecipe(grid).output?.id === outputId);
}

check('new Calling reagents retain their requested item tiers',
  SPECIAL_GATHERED_RESOURCES_BY_ID.rabbitsFoot?.tier === 4
    && SPECIAL_GATHERED_RESOURCES_BY_ID.quickroot?.tier === 4
    && SPECIAL_GATHERED_RESOURCES_BY_ID.cornucopiaSeed?.tier === 4
    && SPECIAL_GATHERED_RESOURCES_BY_ID.sproutingAcorn?.tier === 4
    && SPECIAL_GATHERED_RESOURCES_BY_ID.auricVein?.tier === 3
    && SPECIAL_GATHERED_RESOURCES_BY_ID.compassOre?.tier === 5
    && SPECIAL_GATHERED_RESOURCES_BY_ID.geode?.tier === 3
    && SPECIAL_GATHERED_RESOURCES_BY_ID.quartz?.tier === 2);

if (results.some(result => !result.pass)) process.exitCode = 1;
