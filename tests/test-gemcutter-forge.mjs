import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';

const URL = process.env.TEST_URL ?? 'http://localhost:5199/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await enterGame(page);

await page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('tcg-sim'));
  const gemcutter = {
    id: 'gemcutter-forge-test', name: 'Jewelwright', classType: 'gemcutter', artVariant: 0,
    rarity: 'rare', tier: 1, tag: null, value: 50, affixes: [], socketCount: 0, gemSockets: [],
  };
  save.collection = [gemcutter];
  save.pocket = [];
  save.gatheredInventory = {
    ...(save.gatheredInventory ?? {}),
    gemdust: 0,
    dull_ruby: 0,
    cut_ruby: 0,
  };
  save.resources = { ...(save.resources ?? {}), smoldering_mote: 0 };
  save.forgeCardSlots = [{ slotId: 1, card: gemcutter }, { slotId: 2, card: null }, { slotId: 3, card: null }];
  save.forgeOreSlots = [
    { slotId: 1, source: 'gathered', oreType: 'dull_ruby', count: 10 },
    { slotId: 2, source: null, oreType: null, count: 0 },
    { slotId: 3, source: null, oreType: null, count: 0 },
  ];
  save.forgeIngredientSlots = [
    { slotId: 1, source: 'arcana', ingotType: 'smoldering_mote', count: 10 },
    { slotId: 2, source: null, ingotType: null, count: 0 },
    { slotId: 3, source: null, ingotType: null, count: 0 },
  ];
  save.forgeFuelSlots = [
    // A pre-fix save may still say one Gemdust has Coal's five charges. Normalization must
    // clamp that legacy state to one fusion instead of preserving the apparent infinite fuel.
    { slotId: 1, fuelType: 'gemdust', loadedCoal: 1, currentCoalCharges: 5, activeSlotId: 1, startedAt: Date.now() - 1000, endsAt: Date.now() - 1 },
    { slotId: 2, loadedCoal: 0, currentCoalCharges: 0 },
    { slotId: 3, loadedCoal: 0, currentCoalCharges: 0 },
  ];
  save.forgeOutputQueues = { 1: {}, 2: {}, 3: {} };
  save.graphicsSettings = { quality: 'low' };
  localStorage.setItem('tcg-sim', JSON.stringify(save));
});

await page.reload({ waitUntil: 'networkidle' });
await enterGame(page);
const splash = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
if (await splash.count()) await splash.click();
await page.locator('.tab-bar button', { hasText: 'Foundry' }).first().click();
await page.waitForTimeout(1800);

const checks = [];
const check = async (name, condition, detail = '') => {
  const pass = Boolean(await condition);
  checks.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

await check('Gemcutter row consumes ten gems and its matching ten motes', page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('tcg-sim'));
  return save.forgeOreSlots[0].count === 0
    && save.forgeIngredientSlots[0].count === 0
    && save.forgeFuelSlots[0].loadedCoal === 0
    && save.forgeFuelSlots[0].fuelType === null
    && save.forgeFuelSlots[0].currentCoalCharges === 0;
}));
await check('Dull Ruby fusion creates one Cut Ruby in that row output', page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('tcg-sim'));
  return save.forgeOutputQueues['1']?.cut_ruby === 1;
}));
await check('the Forge renders fused gems as square loot output cards',
  page.locator('.foundry-forge-row__output-card .foundry-square-resource__art').count().then(count => count === 1));

if (await page.locator('.inventory-panel--open').count()) {
  await page.locator('.drawer-tab.inventory-toggle').click();
  await page.waitForTimeout(400);
}
await page.locator('.foundry-forge-row .foundry-collect-btn--row').click();
await page.waitForTimeout(3500);
await check('collecting the row returns its fused gem to Gathered inventory', page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('tcg-sim'));
  return save.gatheredInventory.cut_ruby === 1 && !save.forgeOutputQueues['1']?.cut_ruby;
}));
await check('Gemcutter fusion produces no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(`\n${checks.filter(Boolean).length}/${checks.length} passed`);
if (checks.some(pass => !pass)) process.exit(1);
