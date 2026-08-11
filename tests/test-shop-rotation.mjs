/**
 * The trimmed shop, and the one thing that must not go wrong: the price shown is the price charged.
 */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';
const results = [];
const check = (n, p, d = '') => { results.push({ n, p }); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? `  — ${d}` : ''}`); };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(2400); await enterGame(page);
// Wait for the save to exist before mutating it. On a cold vite server the first render is slow enough
// that this ran against `null` and crashed the suite.
await page.waitForFunction(() => !!localStorage.getItem('tcg-sim'), null, { timeout: 15000 });
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('tcg-sim')); s.balance = 5000; localStorage.setItem('tcg-sim', JSON.stringify(s)); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(2400); await enterGame(page);
const sp = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
if (await sp.count()) { await sp.click(); await page.waitForTimeout(700); }

const tabs = await page.locator('.shop-category__label').allTextContents();
// Five now: Core, Arcana, Goods, Upgrades, Rotation. Goods and then Upgrades were each added after this
// expectation was written, and each time it was this line that caught it — which is the point of it.
check('five shelves: Core, Arcana, Goods, Upgrades, Rotation', tabs.length === 5, tabs.join(' | '));
check('no Horizon Set shelf', !tabs.includes('Horizon Set'), tabs.join(' | '));

await page.locator('.shop-category', { hasText: 'Core Set' }).click();
await page.waitForTimeout(400);
const corePacks = await page.locator('.shelf-pack__grab').count();
check('Core Set has exactly 5 packs', corePacks === 5, `${corePacks}`);

await page.locator('.shop-category', { hasText: 'Rotation Deals' }).click();
await page.waitForTimeout(400);
const rotPacks = await page.locator('.shelf-pack__grab').count();
check('Rotation has 3 packs', rotPacks === 3, `${rotPacks}`);
const tagline = await page.locator('.shop-section-tagline').textContent();
check('rotation shows a countdown', /New stock in/.test(tagline), tagline);

// The price shown must be the price charged.
const before = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')).balance);
const shown = await page.evaluate(() => {
  const tag = document.querySelector('.shelf-pack .gold-amount');
  return Number(tag.textContent.replace(/[^0-9.]/g, ''));
});
await page.locator('.shelf-pack__grab').first().click();
await page.waitForTimeout(2600);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')).balance);
check('the price on the tag is exactly what was charged',
  Math.abs((before - after) - shown) < 0.01, `tag=${shown} charged=${(before - after).toFixed(2)}`);
check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close();
const failed = results.filter(r => !r.p);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
