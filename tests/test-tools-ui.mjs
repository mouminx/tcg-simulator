import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('console', message => {
  if (message.type() === 'error' && !/WebGL|THREE|GPU/i.test(message.text())) errors.push(message.text());
});
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await enterGame(page);
await page.waitForTimeout(2500);

const seeded = await page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('tcg-sim'));
  const miner = {
    id: crypto.randomUUID(), name: 'Tool Test Miner', classType: 'miner', artVariant: 0,
    rarity: 'rare', tier: 3, tag: null, value: 10,
    affixes: [{ id: 'miningEfficiency', label: 'Mining Efficiency', stat: 'miningSpeed', value: 10 }],
  };
  const pickaxe = {
    id: crypto.randomUUID(), itemType: 'tool', toolType: 'pickaxe', name: 'Pickaxe',
    artKey: 'steel_pickaxe', tier: 5, materialQuality: 5,
    affixes: [
      { id: 'efficiency', label: 'Mining Efficiency', value: 25 },
      { id: 'luck', label: 'Mining Luck', value: 22 },
      { id: 'yield', label: 'Yield', value: 20 },
      { id: 'discovery', label: 'Discovery Chance', value: 10 },
      { id: 'refinement', label: 'Refinement Chance', value: 8 },
    ],
  };
  save.collection = [miner];
  save.pocket = [];
  save.mineSlots = save.mineSlots.map((slot, index) => index === 0
    ? { ...slot, card: miner, tool: null, momentumStacks: 0, startedAt: Date.now(), endsAt: Date.now() + 60000, oreType: 'stone' }
    : { ...slot, card: null, tool: null, momentumStacks: 0, startedAt: null, endsAt: null, oreType: null });
  save.toolInventory = [pickaxe];
  localStorage.setItem('tcg-sim', JSON.stringify(save));
  return { toolId: pickaxe.id };
});

await page.reload({ waitUntil: 'networkidle' });
await enterGame(page);
const enter = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
if (await enter.count()) {
  await enter.click();
  await page.waitForTimeout(800);
}
await page.locator('.tab-bar button', { hasText: 'Foundry' }).first().click();
await page.waitForTimeout(900);

check('Bag renders a Tools section with the square Pickaxe card',
  await page.locator('.inventory-section', { hasText: 'Tools' }).locator(`[data-tool-id="${seeded.toolId}"]`).count() === 1);
check('Tier V is visible in the tool card upper-left',
  await page.locator(`[data-tool-id="${seeded.toolId}"] .tool-card__tier`, { hasText: 'V' }).count() === 1);

const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
const source = page.locator(`[data-tool-id="${seeded.toolId}"]`);
const target = page.locator('[data-tool-drop-target="mine"][data-tool-slot-id="1"]');
await source.dispatchEvent('dragstart', { dataTransfer });
await page.waitForTimeout(100);
const payload = await page.evaluate(dt => dt.getData('application/x-cards-of-arcana-tool'), dataTransfer);
await target.dispatchEvent('dragenter', { dataTransfer });
await target.dispatchEvent('dragover', { dataTransfer });
await target.dispatchEvent('drop', { dataTransfer });
await source.dispatchEvent('dragend', { dataTransfer }).catch(() => {});
const dragResult = { ok: true, payload };
check('tool drag writes its unique id and reaches the Mine socket',
  dragResult.ok && dragResult.payload === seeded.toolId, JSON.stringify(dragResult));

await page.waitForTimeout(2600);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')));
check('socketed tool leaves the Bag and persists on its worker',
  saved.toolInventory.length === 0 && saved.mineSlots[0].tool?.id === seeded.toolId,
  `bag=${saved.toolInventory.length} socket=${saved.mineSlots[0].tool?.id}`);
check('equipping restarts the cycle and resets Momentum',
  saved.mineSlots[0].momentumStacks === 0 && saved.mineSlots[0].endsAt > saved.mineSlots[0].startedAt);
check('socket displays the tool art and five-affix tooltip',
  await page.locator('.station-tool-card .foundry-square-resource__art').count() === 1);

await page.locator('.station-tool-card').hover();
check('tool tooltip lists all five rolled affixes',
  await page.locator('.tool-tooltip__affixes li').count() === 5);

await page.locator('.station-tool-card').click({ position: { x: 28, y: 40 } });
await page.waitForTimeout(2600);
const returned = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')));
check('remove returns exactly the same tool to the Bag',
  returned.mineSlots[0].tool == null && returned.toolInventory.length === 1
    && returned.toolInventory[0].id === seeded.toolId);

await page.locator(`[data-tool-id="${seeded.toolId}"]`).click();
await page.locator('[data-tool-drop-target="mine"][data-tool-slot-id="1"]').click();
await page.waitForTimeout(2600);
const clickSocketed = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')));
check('click-to-pick-up remains an alternative to dragging',
  clickSocketed.toolInventory.length === 0 && clickSocketed.mineSlots[0].tool?.id === seeded.toolId);
check('tool flow produced no browser errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(result => !result.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exitCode = 1;
