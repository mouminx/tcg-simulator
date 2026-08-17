import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';
import {
  ELEMENT_UPGRADE_RECIPES,
  craftGridRecipe,
  createCraftingCardSlots,
  createCraftingGridSlots,
  findCraftingRecipe,
  getCraftingResult,
  getMaxCraftableCount,
  normalizeCraftingCardSlots,
} from '../src/game/crafting.js';
import { ESSENCES, getElementResourceId } from '../src/game/arcana.js';

const URL_ = process.env.TEST_URL ?? 'http://localhost:5199/';
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

check('all nine elements receive mote, wisp, and essence upgrade recipes',
  ELEMENT_UPGRADE_RECIPES.length === 27,
  `recipes=${ELEMENT_UPGRADE_RECIPES.length}`);
for (const element of ESSENCES) {
  for (const [inputTier, outputTier] of [['mote', 'wisp'], ['wisp', 'essence'], ['essence', 'quintessence']]) {
    const inputId = getElementResourceId(element.id, inputTier);
    const outputId = getElementResourceId(element.id, outputTier);
    const grid = gridWith(Array.from({ length: 9 }, (_, index) => ({
      index, source: 'arcana', id: inputId,
    })));
    const result = craftGridRecipe(grid);
    check(`${element.id} ${inputTier} upgrades to ${outputTier}`,
      result.output?.kind === 'arcana' && result.output.id === outputId
        && result.output.count === 1 && result.slots.every(slot => slot.count === 0));
  }
}
check('mixed elements do not satisfy an elemental upgrade recipe', (() => {
  const grid = gridWith(Array.from({ length: 9 }, (_, index) => ({
    index,
    source: 'arcana',
    id: getElementResourceId(index === 8 ? 'jolting' : 'smoldering', 'mote'),
  })));
  return findCraftingRecipe(grid) == null;
})());

function gridWith(entries) {
  const slots = createCraftingGridSlots();
  entries.forEach(({ index, source, id, count = 1 }) => {
    slots[index] = { ...slots[index], source, id, name: id, count };
  });
  return slots;
}

const stoneBlockGrid = gridWith(Array.from({ length: 9 }, (_, index) => ({ index, source: 'ore', id: 'stone' })));
const polishedGrid = gridWith(Array.from({ length: 9 }, (_, index) => ({ index, source: 'crafted', id: 'stoneBlock' })));
const linenGrid = gridWith(Array.from({ length: 9 }, (_, index) => ({ index, source: 'crafted', id: 'fiber' })));
const sateenGrid = gridWith(Array.from({ length: 9 }, (_, index) => ({
  index,
  source: index === 4 ? 'crafted' : 'gathered',
  id: index === 4 ? 'linen' : 'softstem',
})));
const silkGrid = gridWith(Array.from({ length: 9 }, (_, index) => ({
  index,
  source: index === 4 ? 'crafted' : 'gathered',
  id: index === 4 ? 'sateen' : 'silkgrass',
})));
const plankGrid = gridWith(Array.from({ length: 9 }, (_, index) => ({
  index,
  source: 'crafted',
  id: index >= 3 && index <= 5 ? 'lumber' : 'timber',
})));
const stickGrid = gridWith([1, 4, 7].map(index => ({ index, source: 'crafted', id: 'plank' })));
const voidwoodStickGrid = gridWith([1, 4, 7].map(index => ({ index, source: 'crafted', id: 'voidwoodPlank' })));
const arcanewoodStickGrid = gridWith([1, 4, 7].map(index => ({ index, source: 'crafted', id: 'arcanewoodPlank' })));
const gemsettersChiselGrid = gridWith([
  { index: 2, source: 'crafted', id: 'stick' },
  { index: 4, source: 'crafted', id: 'stick' },
  { index: 6, source: 'ingot', id: 'starsteel' },
]);
const gemExtractorGrid = gridWith([
  { index: 2, source: 'crafted', id: 'stick' },
  { index: 3, source: 'ingot', id: 'starsteel' },
  { index: 4, source: 'crafted', id: 'stick' },
  { index: 6, source: 'ingot', id: 'starsteel' },
  { index: 7, source: 'ingot', id: 'starsteel' },
]);
const mixedPickaxeGrid = gridWith([
  { index: 0, source: 'ingot', id: 'steel' },
  { index: 1, source: 'ingot', id: 'gold' },
  { index: 2, source: 'ingot', id: 'starsteel' },
  { index: 4, source: 'crafted', id: 'stick' },
  { index: 7, source: 'crafted', id: 'arcanewoodStick' },
]);
const mixedAxeGrid = gridWith([
  { index: 0, source: 'ingot', id: 'silver' },
  { index: 1, source: 'ingot', id: 'platinum' },
  { index: 3, source: 'ingot', id: 'gold' },
  { index: 4, source: 'crafted', id: 'voidwoodStick' },
  { index: 7, source: 'crafted', id: 'stick' },
]);
const mixedSickleGrid = gridWith([
  { index: 1, source: 'ingot', id: 'steel' },
  { index: 2, source: 'ingot', id: 'silver' },
  { index: 5, source: 'ingot', id: 'gold' },
  { index: 7, source: 'crafted', id: 'voidwoodStick' },
]);
const bowGrid = gridWith([
  { index: 0, source: 'crafted', id: 'fiber' },
  { index: 1, source: 'crafted', id: 'stick' },
  { index: 3, source: 'crafted', id: 'fiber' },
  { index: 4, source: 'crafted', id: 'roughLeather' },
  { index: 5, source: 'crafted', id: 'arcanewoodStick' },
  { index: 6, source: 'crafted', id: 'fiber' },
  { index: 7, source: 'crafted', id: 'voidwoodStick' },
]);
const refinedLeatherBowGrid = bowGrid.map((slot, index) => (
  index === 4 ? { ...slot, id: 'refinedLeather', name: 'refinedLeather' } : slot
));
const premiumLeatherBowGrid = bowGrid.map((slot, index) => (
  index === 4 ? { ...slot, id: 'premiumLeather', name: 'premiumLeather' } : slot
));
const voidwoodPlankGrid = gridWith(Array.from({ length: 9 }, (_, index) => ({
  index,
  source: index === 4 ? 'crafted' : 'gathered',
  id: index === 4 ? 'plank' : 'voidwood',
})));
const arcanewoodPlankGrid = gridWith(Array.from({ length: 9 }, (_, index) => ({
  index,
  source: index === 4 ? 'crafted' : 'gathered',
  id: index === 4 ? 'voidwoodPlank' : 'arcanewood',
})));
const reagentRecipes = [
  { inputId: 'mushrooms', outputId: 'mycelialExtract' },
  { inputId: 'resin', outputId: 'sealant' },
  { inputId: 'hyssop', outputId: 'alkahest' },
];
for (const { inputId, outputId } of reagentRecipes) {
  check(`${outputId} is shapeless and creates two from one ${inputId}`, Array.from({ length: 9 }, (_, index) => {
    const result = craftGridRecipe(gridWith([{ index, source: 'gathered', id: inputId }]));
    return result.recipe?.id === outputId && result.output?.count === 2 && result.slots[index].count === 0;
  }).every(Boolean));
}
const infusionLayouts = [
  [0, 4, 8],
  [1, 3, 5],
  [2, 6, 7],
].map(indexes => gridWith([
  { index: indexes[0], source: 'crafted', id: 'sealant' },
  { index: indexes[1], source: 'crafted', id: 'alkahest' },
  { index: indexes[2], source: 'crafted', id: 'mycelialExtract' },
]));
check('Arcanic Infusion accepts its three reagents in any positions', infusionLayouts.every(grid => (
  findCraftingRecipe(grid)?.id === 'arcanicInfusion'
  && craftGridRecipe(grid).output?.id === 'arcanicInfusion'
)));

const dullGemIds = ['dull_ruby', 'dull_sapphire', 'dull_topaz', 'dull_emerald', 'dull_diamond'];
check('Coal, Alkahest, and any Dull gem create one Gemdust in any three squares', dullGemIds.every((gemId, gemIndex) => {
  const indexes = [[0, 4, 8], [8, 1, 5], [3, 7, 2], [6, 0, 4], [2, 5, 7]][gemIndex];
  const result = craftGridRecipe(gridWith([
    { index: indexes[0], source: 'ore', id: 'coal' },
    { index: indexes[1], source: 'crafted', id: 'alkahest' },
    { index: indexes[2], source: 'gathered', id: gemId },
  ]));
  return result.recipe?.id === 'gemdust'
    && result.output?.kind === 'gathered'
    && result.output?.id === 'gemdust'
    && result.output?.count === 1
    && result.slots.every(slot => slot.count === 0);
}));

const advancedReagentRecipes = [
  { inputId: 'alkahest', catalystId: 'wildflowers', outputId: 'advancedAlkahest' },
  { inputId: 'mycelialExtract', catalystId: 'garlic', outputId: 'advancedMycelialExtract' },
  { inputId: 'sealant', catalystId: 'softwoodSap', outputId: 'advancedSealant' },
];
for (const { inputId, catalystId, outputId } of advancedReagentRecipes) {
  const layouts = [[0, 8], [2, 4], [7, 1]];
  check(`${outputId} shapelessly combines its base reagent with two ${catalystId}`, layouts.every(([baseIndex, catalystIndex]) => {
    const result = craftGridRecipe(gridWith([
      { index: baseIndex, source: 'crafted', id: inputId },
      { index: catalystIndex, source: 'gathered', id: catalystId, count: 2 },
    ]));
    return result.recipe?.id === outputId && result.output?.id === outputId
      && result.slots[baseIndex].count === 0 && result.slots[catalystIndex].count === 0;
  }));
}
const advancedInfusionGrid = gridWith([
  { index: 1, source: 'crafted', id: 'advancedAlkahest' },
  { index: 4, source: 'crafted', id: 'advancedMycelialExtract' },
  { index: 6, source: 'crafted', id: 'advancedSealant' },
]);
check('the three advanced reagents create Advanced Arcanic Infusion in any positions',
  findCraftingRecipe(advancedInfusionGrid)?.id === 'advancedArcanicInfusion'
    && craftGridRecipe(advancedInfusionGrid).output?.id === 'advancedArcanicInfusion');

check('two Hide in any single cell creates one Rough Leather', Array.from({ length: 9 }, (_, index) => {
  const result = craftGridRecipe(gridWith([{ index, source: 'gathered', id: 'hide', count: 2 }]));
  return result.recipe?.id === 'roughLeather'
    && result.output?.id === 'roughLeather'
    && result.output.count === 1
    && result.slots[index].count === 0;
}).every(Boolean));
const refinedLeatherGrid = gridWith(Array.from({ length: 9 }, (_, index) => ({
  index,
  source: index === 4 ? 'crafted' : 'gathered',
  id: index === 4 ? 'roughLeather' : 'toughHide',
})));
const premiumLeatherGrid = gridWith(Array.from({ length: 9 }, (_, index) => ({
  index,
  source: index === 4 ? 'gathered' : 'crafted',
  id: index === 4 ? 'toughScales' : 'refinedLeather',
})));
check('eight Tough Hide surrounding Rough Leather creates Refined Leather',
  findCraftingRecipe(refinedLeatherGrid)?.id === 'refinedLeather'
    && craftGridRecipe(refinedLeatherGrid).output?.id === 'refinedLeather');
check('eight Refined Leather surrounding Tough Scales creates Premium Leather',
  findCraftingRecipe(premiumLeatherGrid)?.id === 'premiumLeather'
    && craftGridRecipe(premiumLeatherGrid).output?.id === 'premiumLeather');

function emptyCallingGrid(stoneBlockId, textileId, leatherSource, leatherId) {
  return gridWith([
    { index: 0, source: 'crafted', id: stoneBlockId }, { index: 1, source: 'crafted', id: textileId }, { index: 2, source: 'crafted', id: stoneBlockId },
    { index: 3, source: leatherSource, id: leatherId }, { index: 4, source: 'crafted', id: 'arcanicInfusion' }, { index: 5, source: leatherSource, id: leatherId },
    { index: 6, source: 'crafted', id: stoneBlockId }, { index: 7, source: 'crafted', id: textileId }, { index: 8, source: 'crafted', id: stoneBlockId },
  ]);
}
const basicCalling = getCraftingResult(emptyCallingGrid('stoneBlock', 'linen', 'crafted', 'roughLeather'));
const midpointCalling = getCraftingResult(emptyCallingGrid('polishedStoneBlock', 'sateen', 'crafted', 'refinedLeather'));
const apexCalling = getCraftingResult(emptyCallingGrid('reinforcedStoneBlock', 'silk', 'crafted', 'premiumLeather'));
check('Empty Calling uses every quality-bearing component to span Tier I–V',
  basicCalling?.id === 'emptyCallingTier1' && basicCalling.tier === 1
    && midpointCalling?.id === 'emptyCallingTier3' && midpointCalling.tier === 3
    && apexCalling?.id === 'emptyCallingTier5' && apexCalling.tier === 5,
  `basic=${JSON.stringify(basicCalling)} midpoint=${JSON.stringify(midpointCalling)} apex=${JSON.stringify(apexCalling)}`);
check('Arcanic Infusion stabilizes the recipe but does not alter Empty Calling quality',
  midpointCalling.materialScore === 24 && midpointCalling.minimumMaterialScore === 8 && midpointCalling.maximumMaterialScore === 40,
  JSON.stringify(midpointCalling));

function emptySurgeGrid(stoneBlockId, textileId, leftIngotId, rightIngotId) {
  return gridWith([
    { index: 0, source: 'crafted', id: stoneBlockId }, { index: 1, source: 'crafted', id: textileId }, { index: 2, source: 'crafted', id: stoneBlockId },
    { index: 3, source: 'ingot', id: leftIngotId }, { index: 4, source: 'crafted', id: 'advancedArcanicInfusion' }, { index: 5, source: 'ingot', id: rightIngotId },
    { index: 6, source: 'crafted', id: stoneBlockId }, { index: 7, source: 'crafted', id: textileId }, { index: 8, source: 'crafted', id: stoneBlockId },
  ]);
}
const basicSurge = getCraftingResult(emptySurgeGrid('stoneBlock', 'linen', 'steel', 'steel'));
const midpointSurge = getCraftingResult(emptySurgeGrid('polishedStoneBlock', 'sateen', 'gold', 'gold'));
const apexSurge = getCraftingResult(emptySurgeGrid('reinforcedStoneBlock', 'silk', 'starsteel', 'starsteel'));
check('Empty Surge accepts mixed structural families and spans Tier I–V',
  basicSurge?.id === 'emptySurgeTier1' && basicSurge.tier === 1
    && midpointSurge?.id === 'emptySurgeTier3' && midpointSurge.tier === 3
    && apexSurge?.id === 'emptySurgeTier5' && apexSurge.tier === 5,
  `basic=${JSON.stringify(basicSurge)} midpoint=${JSON.stringify(midpointSurge)} apex=${JSON.stringify(apexSurge)}`);
check('Advanced Arcanic Infusion stabilizes Empty Surge without adding material quality',
  midpointSurge.materialScore === 24 && midpointSurge.minimumMaterialScore === 8 && midpointSurge.maximumMaterialScore === 40,
  JSON.stringify(midpointSurge));
const reinforcedStoneBlockGrid = gridWith(Array.from({ length: 9 }, (_, index) => ({
  index,
  source: index === 4 ? 'crafted' : 'ingot',
  id: index === 4 ? 'polishedStoneBlock' : 'steel',
})));
check('eight Steel Ingots surrounding Polished Stone Block creates Reinforced Stone Block',
  findCraftingRecipe(reinforcedStoneBlockGrid)?.id === 'reinforcedStoneBlock'
    && craftGridRecipe(reinforcedStoneBlockGrid).output?.id === 'reinforcedStoneBlock');
check('starter recipe data matches Stone Block', findCraftingRecipe(stoneBlockGrid)?.id === 'stoneBlock');
check('starter recipe data matches Polished Stone Block', findCraftingRecipe(polishedGrid)?.id === 'polishedStoneBlock');
check('starter recipe data matches Linen', findCraftingRecipe(linenGrid)?.id === 'linen');
check('starter recipe data matches Sateen', findCraftingRecipe(sateenGrid)?.id === 'sateen');
check('starter recipe data matches Silk', findCraftingRecipe(silkGrid)?.id === 'silk');
check('starter recipe data matches Plank', findCraftingRecipe(plankGrid)?.id === 'plank');
check('starter recipe data matches Stick', findCraftingRecipe(stickGrid)?.id === 'stick');
check('Stick recipe creates two sticks', craftGridRecipe(stickGrid).output?.count === 2);
check('recipe data matches Voidwood Stick', findCraftingRecipe(voidwoodStickGrid)?.id === 'voidwoodStick');
check('recipe data matches Arcanewood Stick', findCraftingRecipe(arcanewoodStickGrid)?.id === 'arcanewoodStick');
check("recipe data matches Gemsetter's Chisel", findCraftingRecipe(gemsettersChiselGrid)?.id === 'gemsettersChisel');
check('recipe data matches Gem Extractor', findCraftingRecipe(gemExtractorGrid)?.id === 'gemExtractor');
check('Pickaxe accepts mixed ingots and stick types', findCraftingRecipe(mixedPickaxeGrid)?.id === 'pickaxe');
check('Axe accepts mixed ingots and stick types', findCraftingRecipe(mixedAxeGrid)?.id === 'axe');
check('Sickle accepts mixed ingots and stick types', findCraftingRecipe(mixedSickleGrid)?.id === 'sickle');
check('Shortbow matches Fiber, Rough Leather, and mixed sticks', findCraftingRecipe(bowGrid)?.id === 'shortbow');
check('Shortbow accepts Refined Leather', findCraftingRecipe(refinedLeatherBowGrid)?.id === 'shortbow');
check('Shortbow accepts Premium Leather', findCraftingRecipe(premiumLeatherBowGrid)?.id === 'shortbow');
const pickaxePreview = getCraftingResult(mixedPickaxeGrid);
check('tool material score aggregates every component and determines tier',
  pickaxePreview.materialScore === 15 && pickaxePreview.minimumMaterialScore === 5 && pickaxePreview.maximumMaterialScore === 25
    && pickaxePreview.tier === 3 && pickaxePreview.components.length === 5,
  JSON.stringify(pickaxePreview));
const basicBow = getCraftingResult(gridWith([
  { index: 0, source: 'crafted', id: 'fiber' }, { index: 1, source: 'crafted', id: 'stick' },
  { index: 3, source: 'crafted', id: 'fiber' }, { index: 4, source: 'crafted', id: 'roughLeather' },
  { index: 5, source: 'crafted', id: 'stick' }, { index: 6, source: 'crafted', id: 'fiber' },
  { index: 7, source: 'crafted', id: 'stick' },
]));
const bestBow = getCraftingResult(gridWith([
  { index: 0, source: 'crafted', id: 'fiber' }, { index: 1, source: 'crafted', id: 'arcanewoodStick' },
  { index: 3, source: 'crafted', id: 'fiber' }, { index: 4, source: 'crafted', id: 'premiumLeather' },
  { index: 5, source: 'crafted', id: 'arcanewoodStick' }, { index: 6, source: 'crafted', id: 'fiber' },
  { index: 7, source: 'crafted', id: 'arcanewoodStick' },
]));
check('every tool recipe can span the full Tier I–V range',
  basicBow.tier === 1 && bestBow.tier === 5,
  `basic=${basicBow.tier} best=${bestBow.tier}`);
check('family recipes still reject unrelated crafted items',
  findCraftingRecipe(gridWith([
    { index: 0, source: 'ingot', id: 'steel' },
    { index: 1, source: 'ingot', id: 'gold' },
    { index: 2, source: 'ingot', id: 'starsteel' },
    { index: 4, source: 'crafted', id: 'plank' },
    { index: 7, source: 'crafted', id: 'stick' },
  ])) == null);
check('starter recipe data matches Voidwood Plank', findCraftingRecipe(voidwoodPlankGrid)?.id === 'voidwoodPlank');
check('starter recipe data matches Arcanewood Plank', findCraftingRecipe(arcanewoodPlankGrid)?.id === 'arcanewoodPlank');
check('Fiber is position-independent and consumes two Fiberweed', Array.from({ length: 9 }, (_, index) => {
  const result = craftGridRecipe(gridWith([{ index, source: 'gathered', id: 'fiberweed', count: 2 }]));
  return result.recipe?.id === 'fiber' && result.slots[index].count === 0;
}).every(Boolean));
const stackedStoneGrid = gridWith(Array.from({ length: 9 }, (_, index) => ({
  index,
  source: 'ore',
  id: 'stone',
  count: 3,
})));
const maxStoneResult = craftGridRecipe(stackedStoneGrid, Infinity);
check('max crafting consumes every complete pattern and multiplies its output',
  getMaxCraftableCount(stackedStoneGrid) === 3
    && maxStoneResult.craftCount === 3
    && maxStoneResult.output?.count === 3
    && maxStoneResult.slots.every(slot => slot.count === 0));
const legacyArtisanCard = { id: 'legacy-artisan', name: 'Saved Artisan' };
const legacyArtisanSlots = createCraftingCardSlots().slice(0, 3);
legacyArtisanSlots[2] = { ...legacyArtisanSlots[2], card: legacyArtisanCard };
const expandedArtisanSlots = normalizeCraftingCardSlots(legacyArtisanSlots);
check('three-slot saves preserve artisans while gaining Crafter IV and V',
  expandedArtisanSlots.length === 5
    && expandedArtisanSlots[2].card?.id === legacyArtisanCard.id
    && expandedArtisanSlots[3].card === null
    && expandedArtisanSlots[4].card === null);

async function dismissSplash(page) {
  const splash = page.locator('.splash');
  if (await splash.count()) await splash.getByRole('button', { name: /enter|resume/i }).click();
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

await page.goto(URL_, { waitUntil: 'domcontentloaded' });
await enterGame(page);
await dismissSplash(page);

await page.evaluate(async () => {
  const cards = await import('/src/game/cards.js');
  const save = JSON.parse(localStorage.getItem('tcg-sim'));
  const card = cards.openWelcomePack().find(entry => entry.classType === 'mage');
  save.collection = [card];
  save.pocket = [{ ...card }];
  save.oreInventory = { ...save.oreInventory, iron: 8 };
  save.oreInventory.stone = 27;
  save.gatheredInventory = { ...save.gatheredInventory, fiberweed: 2 };
  save.ingotInventory = { ...save.ingotInventory, steel: 3 };
  localStorage.setItem('tcg-sim', JSON.stringify(save));
});

await page.reload({ waitUntil: 'domcontentloaded' });
await enterGame(page);
await dismissSplash(page);
await page.getByRole('button', { name: 'Crafting' }).click();

check('navigation labels the buying page Shop',
  await page.getByRole('button', { name: 'Shop' }).count() === 1);
await page.getByRole('button', { name: 'Foundry' }).click();
await page.waitForTimeout(300);
const stationBox = await page.locator('.foundry-split').boundingBox();
const stationRightEdge = stationBox.x + stationBox.width;
await page.getByRole('button', { name: 'Crafting' }).click();
check('Crafting renders five artisan slots and a 3x3 grid',
  await page.locator('.crafting-crafter-slot').count() === 5
    && await page.locator('.crafting-material-slot').count() === 9);
check('the redundant Crafting page masthead is removed', await page.locator('.crafting-header').count() === 0);
check('Crafting omits redundant helper and grid-status copy',
  await page.getByText(/cards modify future recipes|drag across cells to divide a held stack|materials placed|grid is empty/i).count() === 0);
const emptyGridRunes = await page.locator('.crafting-material-slot__rune').allTextContents();
check('empty crafting cells use varied runic glyphs instead of diamonds',
  emptyGridRunes.length === 9
    && new Set(emptyGridRunes).size === 9
    && emptyGridRunes.every(rune => rune.trim() !== '◇'));
check('Crafting uses a station-style runic separator between its sections',
  await page.locator('.crafting-rune-divider').count() === 1
    && await page.locator('.crafting-rune-divider__stream span').count() === 12);
await page.waitForTimeout(300);
const initialGeometry = await page.evaluate(() => {
  const rect = selector => {
    const box = document.querySelector(selector)?.getBoundingClientRect();
    return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
  };
  return {
    workbench: rect('.crafting-workbench'),
    page: rect('.crafting-page'),
    artisans: rect('.crafting-crafters'),
    crafting: rect('.crafting-pattern-workspace'),
    separator: rect('.crafting-rune-divider'),
  };
});
const initialWorkbenchBox = initialGeometry.workbench;
const initialCraftingPageBox = initialGeometry.page;
const artisanSectionBox = initialGeometry.artisans;
const craftingSectionBox = initialGeometry.crafting;
const separatorBox = initialGeometry.separator;
const initialArtisanBoxes = await page.locator('.crafting-crafter-slot').evaluateAll(elements => (
  elements.map(element => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  })
));
check('the five artisan sockets form one horizontal station bank',
  Math.max(...initialArtisanBoxes.map(box => box.y)) - Math.min(...initialArtisanBoxes.map(box => box.y)) < 1);
check('Artisans and crafting bench are equal-width stacked sections',
  Math.abs(artisanSectionBox.x - craftingSectionBox.x) < 3
    && Math.abs(artisanSectionBox.width - craftingSectionBox.width) < 1
    && artisanSectionBox.y < separatorBox.y
    && separatorBox.y < craftingSectionBox.y,
  `artisans=${artisanSectionBox.x}/${artisanSectionBox.width} crafting=${craftingSectionBox.x}/${craftingSectionBox.width}`);
check('Crafting panels fill the same horizontal span as Foundry and Wilderness',
  Math.abs(initialWorkbenchBox.x - stationBox.x) < 1
    && Math.abs(initialWorkbenchBox.width - stationBox.width) < 1
    && Math.abs((initialWorkbenchBox.x + initialWorkbenchBox.width) - stationRightEdge) < 1,
  `crafting=${initialWorkbenchBox.x}/${initialWorkbenchBox.width} station=${stationBox.x}/${stationBox.width}`);
check('the Crafting workbench stays within the available screen-height pane',
  initialWorkbenchBox.height <= initialCraftingPageBox.height + 1,
  `workbench=${initialWorkbenchBox.height} page=${initialCraftingPageBox.height}`);

const inventoryToggle = page.locator('.inventory-toggle');
// Let the newly-mounted view finish its font/layout pass before comparing the two stable drawer states.
await page.waitForTimeout(500);
const canvasBeforeBagToggle = await page.locator('.crafting-page').boundingBox();
await inventoryToggle.click();
await page.waitForTimeout(350);
const canvasAfterBagToggle = await page.locator('.crafting-page').boundingBox();
check('toggling the Bag does not resize or shift the Crafting canvas',
  Math.abs(canvasBeforeBagToggle.x - canvasAfterBagToggle.x) < 1
    && Math.abs(canvasBeforeBagToggle.width - canvasAfterBagToggle.width) < 1,
  `before=${canvasBeforeBagToggle.x}/${canvasBeforeBagToggle.width} after=${canvasAfterBagToggle.x}/${canvasAfterBagToggle.width}`);
await inventoryToggle.click();
await page.waitForTimeout(350);

const matrixAlignment = await page.evaluate(() => {
  const frame = document.querySelector('.crafting-matrix-frame')?.getBoundingClientRect();
  const matrix = document.querySelector('.crafting-matrix')?.getBoundingClientRect();
  if (!frame || !matrix) return Infinity;
  return Math.max(
    Math.abs((frame.left + frame.width / 2) - (matrix.left + matrix.width / 2)),
    Math.abs((frame.top + frame.height / 2) - (matrix.top + matrix.height / 2)),
  );
});
check('the pattern grid is centered on its background geometry', matrixAlignment < 1, `delta=${matrixAlignment}px`);
const resultAlignment = await page.evaluate(() => {
  const frame = document.querySelector('.crafting-matrix-frame')?.getBoundingClientRect();
  const result = document.querySelector('.crafting-result-slot')?.getBoundingClientRect();
  if (!frame || !result) return Infinity;
  return Math.abs((frame.top + frame.height / 2) - (result.top + result.height / 2));
});
check('the Result square aligns to the crafting table midpoint', resultAlignment < 1, `delta=${resultAlignment}px`);
const resultLabelAlignment = await page.evaluate(() => {
  const result = document.querySelector('.crafting-result-slot')?.getBoundingClientRect();
  const label = document.querySelector('.crafting-result-label')?.getBoundingClientRect();
  const spacer = document.querySelector('.crafting-result-panel__spacer');
  if (!result || !label || !spacer) return { delta: Infinity, below: false, line: 'missing' };
  return {
    delta: Math.abs((result.left + result.width / 2) - (label.left + label.width / 2)),
    below: label.top >= result.bottom,
    line: getComputedStyle(spacer).borderBottomColor,
  };
});
check('Result label is centered immediately below the output without a visible rule',
  resultLabelAlignment.delta < 1
    && resultLabelAlignment.below
    && resultLabelAlignment.line === 'rgba(0, 0, 0, 0)',
  JSON.stringify(resultLabelAlignment));

const iron = page.locator('[data-resource-drop-target="ore:iron"]');
const firstMaterial = page.locator('.crafting-material-slot').first();
await iron.click();
const distributionCells = page.locator('.crafting-material-slot');
const firstBox = await distributionCells.nth(0).boundingBox();
const secondBox = await distributionCells.nth(1).boundingBox();
const thirdBox = await distributionCells.nth(2).boundingBox();
await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
await page.mouse.down();
await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { steps: 5 });
await page.mouse.move(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2, { steps: 5 });
await page.mouse.up();
check('dragging a held stack distributes it evenly across touched crafting cells',
  (await Promise.all([0, 1, 2].map(index => (
    distributionCells.nth(index).locator('.crafting-material-slot__count').textContent()
  )))).join(',') === '3,3,2');

const splitAnchorBox = await firstMaterial.boundingBox();
await firstMaterial.click({ button: 'right' });
await firstMaterial.click({ button: 'right' });
await firstMaterial.click({ button: 'right' });
check('right-clicking a placed crafting stack opens the shared split menu',
  await page.locator('.resource-quantity-popover').count() === 1);
const splitPopoverBox = await page.locator('.resource-quantity-popover').boundingBox();
check('the split menu opens beside the clicked stack rather than at the screen corner',
  Math.abs(splitPopoverBox.x - (splitAnchorBox.x + splitAnchorBox.width / 2 + 10)) < 2
    && Math.abs(splitPopoverBox.y - (splitAnchorBox.y + splitAnchorBox.height / 2 + 10)) < 2,
  `popover=${splitPopoverBox.x},${splitPopoverBox.y}`);
await page.locator('.resource-quantity-popover__slider').focus();
await page.keyboard.press('ArrowRight');
await page.getByRole('button', { name: 'Confirm' }).click();
const splitCounts = {
  placed: await firstMaterial.locator('.crafting-material-slot__count').textContent(),
  carried: await page.locator('.carried-resource-cursor .foundry-square-resource__count').textContent(),
};
check('the split menu picks up only the selected amount',
  splitCounts.placed === '1' && splitCounts.carried === '2',
  `placed=${splitCounts.placed} carried=${splitCounts.carried}`);
await firstMaterial.click();
check('clicking one crafting cell still places the complete held remainder',
  await firstMaterial.locator('.crafting-material-slot__count').textContent() === '3');

const fourthMaterial = page.locator('.crafting-material-slot').nth(3);
await page.locator('[data-resource-drop-target="ingot:steel"]').dragTo(fourthMaterial);
check('native Bag dragging places materials in another grid cell',
  await fourthMaterial.locator('.crafting-material-slot__count').textContent() === '3');

await page.locator('.hand__slot').first().dragTo(page.locator('.crafting-crafter-slot').first());
check('a Hand card moves into an artisan slot',
  await page.locator('.crafting-crafter-slot--filled').count() === 1
    && await page.locator('.hand__slot').count() === 0);
const artisanCardSize = await page.locator('.crafting-crafter-slot__card > .card-face-wrapper').boundingBox();
check('socketed artisan cards use the standard station card size',
  artisanCardSize.width >= 112
    && Math.abs((artisanCardSize.width / artisanCardSize.height) - (94 / 136)) < 0.01,
  `${artisanCardSize.width}x${artisanCardSize.height}`);

await page.waitForTimeout(2600);
const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')));
check('the crafting setup persists in save 33',
  persisted.version === 33
    && persisted.craftingGridSlots?.[0]?.count === 3
    && persisted.craftingGridSlots?.[1]?.count === 3
    && persisted.craftingGridSlots?.[2]?.count === 2
    && persisted.craftingGridSlots?.[3]?.count === 3
    && persisted.craftingCardSlots?.[0]?.card?.classType === 'mage',
  `version=${persisted.version} material=${persisted.craftingGridSlots?.[0]?.count}`);

await page.reload({ waitUntil: 'domcontentloaded' });
await enterGame(page);
await dismissSplash(page);
await page.getByRole('button', { name: 'Crafting' }).click();
check('the crafting setup survives a reload',
  await page.locator('.crafting-crafter-slot--filled').count() === 1
    && await page.locator('.crafting-material-slot--filled').count() === 4);

await page.getByRole('button', { name: 'Return all' }).click();
check('clearing the grid returns every stack to its source inventory',
  await page.locator('[data-resource-drop-target="ore:iron"] .foundry-square-resource__count').textContent() === '8'
    && await page.locator('[data-resource-drop-target="ingot:steel"] .foundry-square-resource__count').textContent() === '3'
    && await page.locator('.crafting-material-slot--filled').count() === 0);

await page.locator('.crafting-slot-remove').click();
check('removing an artisan clears the station without deleting the collection card',
  await page.locator('.crafting-crafter-slot--filled').count() === 0
    && (await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')).collection.length)) === 1);

// A full 3x3 of Stone matches the starter Stone Block recipe and consumes one from every cell.
const stone = page.locator('[data-resource-drop-target="ore:stone"]');
await stone.click();
const stoneCells = page.locator('.crafting-material-slot');
const stoneBoxes = await Promise.all(Array.from({ length: 9 }, (_, index) => stoneCells.nth(index).boundingBox()));
await page.mouse.move(stoneBoxes[0].x + stoneBoxes[0].width / 2, stoneBoxes[0].y + stoneBoxes[0].height / 2);
await page.mouse.down();
for (const box of stoneBoxes.slice(1)) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 });
}
await page.mouse.up();
check('a full 3x3 Stone pattern resolves to Stone Block',
  await page.getByRole('button', { name: 'Craft Stone Block' }).count() === 1);
check('crafting grid materials and output use framed resource cards without visible names',
  await page.locator('.crafting-material-slot .foundry-square-resource').count() === 9
    && await page.locator('.crafting-result-slot .foundry-square-resource').count() === 1
    && await page.locator('.crafting-material-slot__name').count() === 0
    && await page.locator('.crafting-result-slot strong').count() === 0);
await stoneCells.first().hover();
check('crafting material cards expose the shared item tooltip',
  await page.locator('.resource-tooltip__name', { hasText: 'Stone' }).count() === 1);
await page.getByRole('button', { name: 'Craft Stone Block' }).hover();
check('crafting output cards expose the shared item tooltip and max-craft instruction',
  await page.locator('.resource-tooltip__name', { hasText: 'Stone Block' }).count() === 1
    && await page.locator('.crafting-resource-tooltip__action', { hasText: 'Shift-click to craft all 3' }).count() === 1);
const resultSlotBox = await page.locator('.crafting-result-slot').boundingBox();
check('the Result output remains a compact square card target',
  resultSlotBox.width <= 106
    && Math.abs(resultSlotBox.width - resultSlotBox.height) < 1,
  `${resultSlotBox.width}x${resultSlotBox.height}`);
await page.getByRole('button', { name: 'Craft Stone Block' }).click();
check('normal result click crafts one pattern and leaves remaining stacks in place',
  await page.locator('.crafting-material-slot--filled').count() === 9
    && await page.locator('[data-resource-drop-target="crafted:stoneBlock"] .foundry-square-resource__count').textContent() === '1');
await page.getByRole('button', { name: 'Craft Stone Block' }).click({ modifiers: ['Shift'] });
await page.waitForFunction(() => (
  document.querySelector('[data-resource-drop-target="crafted:stoneBlock"] .foundry-square-resource__count')?.textContent === '3'
));
check('Shift-clicking the result crafts the maximum remaining output',
  await page.locator('.crafting-material-slot--filled').count() === 0
    && await page.locator('[data-resource-drop-target="crafted:stoneBlock"] .foundry-square-resource__count').textContent() === '3');

// Fiberweed's recipe is shapeless: a stack of two in any one cell produces Fiber.
await page.locator('[data-resource-drop-target="gathered:fiberweed"]').click();
await stoneCells.nth(4).click();
check('two Fiberweed in any single cell resolves to Fiber',
  await page.getByRole('button', { name: 'Craft Fiber' }).count() === 1);
await page.getByRole('button', { name: 'Craft Fiber' }).click();
check('crafted Fiber uses the crafted art/inventory category',
  await page.locator('[data-resource-drop-target="crafted:fiber"] .foundry-square-resource__count').textContent() === '1');

// Nine matching elemental resources fill the grid and upgrade into the next Arcana tier.
const elementalSave = await page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('tcg-sim'));
  save.resources = { ...save.resources, smoldering_mote: 9 };
  save.craftingGridSlots = save.craftingGridSlots.map(slot => ({ ...slot, source: null, id: null, name: '', count: 0 }));
  return JSON.stringify(save);
});
await page.addInitScript(serialized => localStorage.setItem('tcg-sim', serialized), elementalSave);
await page.reload({ waitUntil: 'domcontentloaded' });
await enterGame(page);
await dismissSplash(page);
await page.getByRole('button', { name: 'Crafting' }).click();
await page.locator('[data-resource-drop-target="arcana:smoldering_mote"]').click();
const elementalCells = page.locator('.crafting-material-slot');
const elementalBoxes = await Promise.all(Array.from({ length: 9 }, (_, index) => elementalCells.nth(index).boundingBox()));
await page.mouse.move(elementalBoxes[0].x + elementalBoxes[0].width / 2, elementalBoxes[0].y + elementalBoxes[0].height / 2);
await page.mouse.down();
for (const box of elementalBoxes.slice(1)) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 });
}
await page.mouse.up();
const elementalPreview = {
  buttonCount: await page.getByRole('button', { name: 'Craft Smoldering Wisp' }).count(),
  imageSrc: await page.locator('.crafting-result-slot img').getAttribute('src'),
  filled: await page.locator('.crafting-material-slot--filled').count(),
  slots: await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')).craftingGridSlots),
};
check('a full 3x3 of matching Motes previews the corresponding Wisp',
  elementalPreview.buttonCount === 1 && elementalPreview.imageSrc != null,
  JSON.stringify(elementalPreview));
await page.getByRole('button', { name: 'Craft Smoldering Wisp' }).click();
await page.waitForTimeout(2600);
const elementalResult = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')));
check('elemental crafting consumes nine Motes and adds one Wisp to Arcana resources',
  elementalResult.resources.smoldering_mote === 0 && elementalResult.resources.smoldering_wisp === 1
    && elementalResult.craftingGridSlots.every(slot => slot.count === 0));

// Tool crafting consumes a mixed family pattern and mints a unique rolled Tool into the Bag.
const toolRecipeSave = await page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('tcg-sim'));
  save.ingotInventory = { ...save.ingotInventory, steel: 1, gold: 1, starsteel: 1 };
  save.craftedInventory = { ...save.craftedInventory, stick: 1, arcanewoodStick: 1 };
  save.craftingGridSlots = save.craftingGridSlots.map(slot => ({ ...slot, source: null, id: null, name: '', count: 0 }));
  return JSON.stringify(save);
});
await page.addInitScript(serialized => localStorage.setItem('tcg-sim', serialized), toolRecipeSave);
await page.reload({ waitUntil: 'domcontentloaded' });
await enterGame(page);
await dismissSplash(page);
await page.getByRole('button', { name: 'Crafting' }).click();
const placeMaterial = async (selector, cellIndex) => {
  await page.locator(selector).click();
  await page.locator('.crafting-material-slot').nth(cellIndex).click();
};
await placeMaterial('[data-resource-drop-target="ingot:steel"]', 0);
await placeMaterial('[data-resource-drop-target="ingot:gold"]', 1);
await placeMaterial('[data-resource-drop-target="ingot:starsteel"]', 2);
await placeMaterial('[data-resource-drop-target="crafted:stick"]', 4);
await placeMaterial('[data-resource-drop-target="crafted:arcanewoodStick"]', 7);
check('mixed Pickaxe materials preview a Tier III tool card',
  await page.getByRole('button', { name: 'Craft Pickaxe' }).count() === 1
    && await page.locator('.crafting-result-tool-card .foundry-square-resource__tier', { hasText: 'III' }).count() === 1);
await page.getByRole('button', { name: 'Craft Pickaxe' }).click();
await page.waitForTimeout(2600);
const craftedTool = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')).toolInventory.at(-1));
check('crafting the Pickaxe mints one unique Tier III tool with three affixes',
  craftedTool?.toolType === 'pickaxe' && craftedTool.tier === 3 && craftedTool.affixes?.length === 3
    && craftedTool.craftedFrom?.length === 5 && craftedTool.materialScore === 15,
  JSON.stringify(craftedTool));
check('tool crafting consumes only the five occupied recipe materials',
  await page.locator('.crafting-material-slot--filled').count() === 0);

check('the result area omits the old instructional and unmatched-recipe copy',
  await page.getByText(/awaiting recipe|place a pattern in the grid|materials stay in place|no recipe matched/i).count() === 0);

check('no browser errors', errors.length === 0, errors.join(' | '));

await browser.close();
const passed = results.filter(result => result.pass).length;
console.log(`${passed}/${results.length} passed`);
if (passed !== results.length) process.exit(1);
