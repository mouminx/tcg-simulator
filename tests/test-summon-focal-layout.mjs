import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';

const browser = await chromium.launch();
const shortViewport = process.argv.includes('--short');
const densePack = process.argv.includes('--dense');
const page = await browser.newPage({ viewport: shortViewport
  ? { width: 1366, height: 768 }
  : { width: 1600, height: 1000 } });
const failures = [];
const check = (name, pass, detail = '') => {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures.push(name);
};

await page.goto(process.env.SUMMON_TEST_URL ?? 'http://127.0.0.1:5199/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2400);
await enterGame(page);
await page.waitForFunction(() => Boolean(localStorage.getItem('tcg-sim')));
await page.waitForTimeout(2600);
await page.evaluate(useDensePack => {
  const save = JSON.parse(localStorage.getItem('tcg-sim'));
  save.packs = Array.from({ length: 3 }, (_, index) => ({
    id: `layout-pack-${index}`,
    packTypeId: useDensePack && index === 0 ? 'vault3' : 'blankSlate',
  }));
  save.graphicsSettings = { ...(save.graphicsSettings ?? {}), quality: 'high' };
  localStorage.setItem('tcg-sim', JSON.stringify(save));
}, densePack);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2400);
await enterGame(page);
const splash = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
if (await splash.count()) await splash.click();

const centre = locator => locator.evaluate(element => {
  const rect = element.getBoundingClientRect();
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height };
});

const lineup = await centre(page.locator('.unpack-pack-item').first());
check('held-pack lineup is larger than the old miniature row', lineup.width >= (shortViewport ? 54 : 60),
  `${Math.round(lineup.width)}×${Math.round(lineup.height)}`);
const lineupAlignment = await page.evaluate(() => {
  const title = document.querySelector('.unpack-header h2').getBoundingClientRect();
  const packs = [...document.querySelectorAll('.unpack-pack-item')].map(pack => pack.getBoundingClientRect());
  const left = Math.min(...packs.map(pack => pack.left));
  return left - title.right;
});
check('held packs remain in the title band to the right of Summon', lineupAlignment > 0,
  `${lineupAlignment.toFixed(1)}px separation`);

await page.locator('.unpack-pack-item').first().hover({ position: { x: 8, y: 45 } });
const heldPackFilter = await page.locator('.unpack-pack-item').first().locator('.pack-display').evaluate(element => getComputedStyle(element).filter);
check('held-pack queue has no hover glow', heldPackFilter === 'none', heldPackFilter);

await page.locator('.unpack-pack-item').first().click({ position: { x: 8, y: 45 } });
await page.locator('.summon-pack-wrap').waitFor();
check('pack is placed directly with no flight portal', await page.locator('.unpack-flying-pack').count() === 0);
const shellMetrics = await page.evaluate(() => {
  const inventory = document.querySelector('.inventory-panel').getBoundingClientRect();
  const shop = document.querySelector('.shop-summon__shop').getBoundingClientRect();
  const altar = document.querySelector('.shop-summon__altar').getBoundingClientRect();
  const slots = [...document.querySelectorAll('.summon-slot')];
  return {
    inventoryWidth: inventory.width,
    shopWidth: shop.width,
    altarWidth: altar.width,
    slotCount: slots.length,
    lockedSlots: slots.filter(slot => slot.getAttribute('aria-disabled') === 'true').length,
  };
});
check('inventory keeps the standard Bag width', Math.abs(shellMetrics.inventoryWidth - 248) <= 1,
  `${Math.round(shellMetrics.inventoryWidth)}px`);
check('summon receives more width than Shop', shellMetrics.altarWidth > shellMetrics.shopWidth,
  `shop ${Math.round(shellMetrics.shopWidth)}px; summon ${Math.round(shellMetrics.altarWidth)}px`);
check('attunement apparatus remains visible', shellMetrics.slotCount === 3, `${shellMetrics.slotCount} sockets`);
if (densePack) {
  check('non-Blank-Slate sockets are visibly and semantically locked', shellMetrics.lockedSlots === 3,
    `${shellMetrics.lockedSlots}/3 locked`);
}
const slotAlignment = await page.evaluate(() => {
  const slots = document.querySelector('.summon-slots').getBoundingClientRect();
  const band = document.querySelector('.summon-col--left').getBoundingClientRect();
  return Math.abs((slots.left + slots.width / 2) - (band.left + band.width / 2));
});
check('attunement sockets are centred in their band', slotAlignment <= 1, `${slotAlignment.toFixed(1)}px offset`);
const staged = await centre(page.locator('.summon-pack-wrap'));
check('staged pack is visibly larger than the old thumbnail', staged.width >= (shortViewport ? 108 : 150), `${Math.round(staged.width)}×${Math.round(staged.height)}`);

const actionButtons = [];
const recordAction = async (name, locator) => {
  const metrics = await centre(locator);
  const context = await locator.evaluate(element => {
    const button = element.getBoundingClientRect();
    const parent = element.parentElement?.getBoundingClientRect();
    const center = element.closest('.summon-col--center')?.getBoundingClientRect();
    return {
      localX: center ? button.x + button.width / 2 - center.x : null,
      localY: center ? button.y + button.height / 2 - center.y : null,
    };
  });
  actionButtons.push({ name, ...metrics, context });
  check(`${name} action has a deliberately large target`,
    metrics.width >= (shortViewport ? 174 : 210) && metrics.height >= (shortViewport ? 40 : 48),
    `${Math.round(metrics.width)}×${Math.round(metrics.height)}`);
};
await recordAction('Summon Pack', page.locator('.summon-actions .summon-btn--primary'));

await page.locator('.summon-actions button', { hasText: /Open Pack|Summon Pack/i }).click();
await page.waitForTimeout(100);
await recordAction('Quick Draw', page.locator('.quick-draw-btn'));
const opening = await centre(page.locator('.opening-stage-main'));
check('opening pack keeps the staged focal point', Math.abs(staged.x - opening.x) <= 1 && Math.abs(staged.y - opening.y) <= 1,
  `staged ${Math.round(staged.x)},${Math.round(staged.y)}; opening ${Math.round(opening.x)},${Math.round(opening.y)}`);

await page.locator('.pack-model-opening').click();
await page.waitForTimeout(1700);
const revealed = await centre(page.locator('.center-card'));
const revealScale = await page.locator('.center-card').evaluate(element => getComputedStyle(element).getPropertyValue('--card-detail-scale').trim());
check('revealed card keeps the pack focal point', Math.abs(staged.x - revealed.x) <= 1 && Math.abs(staged.y - revealed.y) <= 1,
  `staged ${Math.round(staged.x)},${Math.round(staged.y)}; card ${Math.round(revealed.x)},${Math.round(revealed.y)}`);
check('revealed card retains readable full-card proportions', revealed.width >= (shortViewport ? 108 : 150)
  && Math.abs(revealed.height / revealed.width - 1.5) < 0.02
  && Number(revealScale) >= (shortViewport ? 0.7 : 1),
  `${Math.round(revealed.width)}×${Math.round(revealed.height)}, detail scale ${revealScale}`);

if (process.argv.includes('--screenshot')) {
  await page.screenshot({ path: '/tmp/summon-readable-reveal.png', fullPage: true });
}

await page.locator('.center-card').click();
await page.waitForTimeout(450);
const queued = await centre(page.locator('.queued-card-slot').first());
const queuedScale = await page.locator('.cards-queue .card-face-wrapper').first().evaluate(element => getComputedStyle(element).getPropertyValue('--card-detail-scale').trim());
check('queued card is not vertically compressed', Math.abs(queued.height / queued.width - 160 / 110) < 0.02,
  `${Math.round(queued.width)}×${Math.round(queued.height)}`);
check('queued card internals scale with its card box', Number(queuedScale) > 0 && Number(queuedScale) <= 0.7, `detail scale ${queuedScale}`);

if (!densePack) {
  await page.locator('.quick-draw-btn').click();
  const claimButton = page.locator('.collect-btn');
  await claimButton.waitFor({ state: 'visible', timeout: 8000 });
  await recordAction('Claim Summon', claimButton);
  await claimButton.click();
  const nextButton = page.locator('.unpack-next-btn');
  await nextButton.waitFor({ state: 'visible', timeout: 8000 });
  await recordAction('Open Next Pack', nextButton);

  const anchor = actionButtons[0];
  const aligned = actionButtons.every(button => Math.abs(button.context.localX - anchor.context.localX) <= 1
    && Math.abs(button.context.localY - anchor.context.localY) <= 1);
  check('all four pack actions occupy one fixed position', aligned,
    actionButtons.map(button => `${button.name} ${button.context.localX.toFixed(1)},${button.context.localY.toFixed(1)}`).join(' | '));

  const lift = await page.evaluate(() => {
    const action = document.querySelector('.unpack-next-btn').getBoundingClientRect();
    const queue = document.querySelector('.summon-card-tray').getBoundingClientRect();
    return queue.top - action.bottom;
  });
  check('the shared action line is raised clearly above Revealed Cards', lift >= (shortViewport ? 20 : 34),
    `${lift.toFixed(1)}px clearance`);
}

if (densePack) {
  const quickDraw = page.locator('.quick-draw-btn');
  if (await quickDraw.count()) await quickDraw.click();
  await page.waitForTimeout(500);
  const queueAlignment = await page.evaluate(() => {
    const tray = document.querySelector('.pack-opening__queue-tray').getBoundingClientRect();
    const cards = [...document.querySelectorAll('.queued-card-slot')].map(card => card.getBoundingClientRect());
    const left = Math.min(...cards.map(card => card.left));
    const right = Math.max(...cards.map(card => card.right));
    return {
      count: cards.length,
      offset: Math.abs((left + right) / 2 - (tray.left + tray.width / 2)),
      overflow: Math.max(0, tray.left - left, right - tray.right),
    };
  });
  check('dense revealed-card line is centred as a group', queueAlignment.count === 20 && queueAlignment.offset <= 2,
    `${queueAlignment.count} cards, ${queueAlignment.offset.toFixed(1)}px offset`);
  check('dense revealed-card line fits inside its tray', queueAlignment.overflow <= 2,
    `${queueAlignment.overflow.toFixed(1)}px overflow`);
  if (process.argv.includes('--screenshot')) {
    await page.screenshot({ path: '/tmp/summon-dense-centered.png', fullPage: true });
  }
}

await browser.close();
if (failures.length) process.exit(1);
