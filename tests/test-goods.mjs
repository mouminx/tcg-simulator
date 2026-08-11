/**
 * The goods shelf — the gold sink.
 *
 * The failure that matters is not a button that does nothing; it is a button that takes the gold and puts
 * the goods somewhere the player never looks. Ores and ingots have exactly one canonical inventory each, so
 * every purchase is checked against the map it should have landed in AND against the maps it should not.
 */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';
const results = [];
const check = (n, p, d = '') => { results.push({ n, p, d }); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`); };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const warns = [], errs = [];
page.on('console', m => { if (/\[shop\]/.test(m.text())) warns.push(m.text()); });
page.on('pageerror', e => errs.push(e.message));

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1800); await enterGame(page);
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('tcg-sim')); s.balance = 5000; localStorage.setItem('tcg-sim', JSON.stringify(s)); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1800); await enterGame(page);
const sp = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
if (await sp.count()) { await sp.click(); await page.waitForTimeout(700); }

check('no startup warning about undeliverable goods', warns.length === 0, warns.join(' | '));

const tabs = await page.locator('.shop-category__label').allTextContents();
check('a Goods shelf exists', tabs.includes('Goods'), tabs.join(' | '));
await page.locator('.shop-category', { hasText: 'Goods' }).click();
await page.waitForTimeout(500);
const items = await page.locator('.goods-card').count();
check('all 9 materials are listed', items === 9, `${items}`);

const snap = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('tcg-sim'));
  return { balance: s.balance, ore: s.oreInventory, ingot: s.ingotInventory,
           gathered: s.gatheredInventory, processed: s.processedInventory, resources: s.resources };
});

// Coal -> the ORE inventory, and nowhere else.
let before = await snap();
await page.locator('.goods-card', { hasText: 'Coal' }).locator('.goods-item__buy').click();
await page.waitForTimeout(2600);
let after = await snap();
check('buying coal charged exactly 18', Math.abs((before.balance - after.balance) - 18) < 0.01,
  `${before.balance} -> ${after.balance}`);
check('coal landed in the ORE inventory (+10)', (after.ore.coal ?? 0) - (before.ore.coal ?? 0) === 10,
  `${before.ore.coal ?? 0} -> ${after.ore.coal ?? 0}`);
check('coal did NOT also land in Gathered',
  (after.gathered.coal ?? 0) === (before.gathered.coal ?? 0),
  `gathered coal ${before.gathered.coal ?? 0} -> ${after.gathered.coal ?? 0}`);

// Steel Ingot -> the INGOT inventory.
before = await snap();
await page.locator('.goods-card', { hasText: 'Steel Ingot' }).locator('.goods-item__buy').click();
await page.waitForTimeout(2600);
after = await snap();
check('steel ingot landed in the INGOT inventory (+5)',
  (after.ingot.steel ?? 0) - (before.ingot.steel ?? 0) === 5,
  `${before.ingot.steel ?? 0} -> ${after.ingot.steel ?? 0}`);
check('...and charged 60', Math.abs((before.balance - after.balance) - 60) < 0.01,
  `${(before.balance - after.balance).toFixed(2)}`);

// A mote -> the Arcana resources map, under its real id.
before = await snap();
await page.locator('.goods-card', { hasText: 'Smoldering Mote' }).locator('.goods-item__buy').click();
await page.waitForTimeout(2600);
after = await snap();
check('the mote landed under its real id smoldering_mote (+5)',
  (after.resources.smoldering_mote ?? 0) - (before.resources.smoldering_mote ?? 0) === 5,
  `${before.resources.smoldering_mote ?? 0} -> ${after.resources.smoldering_mote ?? 0}`);

// Affordability is enforced, and no gold moves when it is not.
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('tcg-sim')); s.balance = 5; localStorage.setItem('tcg-sim', JSON.stringify(s)); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1800); await enterGame(page);
const sp2 = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
if (await sp2.count()) { await sp2.click(); await page.waitForTimeout(600); }
await page.locator('.shop-category', { hasText: 'Goods' }).click();
await page.waitForTimeout(500);
const disabled = await page.locator('.goods-card', { hasText: 'Steel Ingot' }).locator('.goods-item__buy').isDisabled();
check('an unaffordable good is disabled', disabled === true, `disabled=${disabled}`);
before = await snap();
await page.locator('.goods-card', { hasText: 'Steel Ingot' }).locator('.goods-item__buy').click({ force: true });
await page.waitForTimeout(2400);
after = await snap();
check('forcing the click on an unaffordable good takes no gold',
  after.balance === before.balance, `${before.balance} -> ${after.balance}`);

check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close();
const failed = results.filter(r => !r.p);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) { failed.forEach(f => console.log(`  - ${f.n}: ${f.d}`)); process.exit(1); }
