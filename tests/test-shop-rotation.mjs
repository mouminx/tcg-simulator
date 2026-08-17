/** The five-minute shop: 3 packs, 16 goods, escalating prices, and no native browser tooltips. */
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
check('shop has Card Packs, Goods, and Upgrades', tabs.join('|') === 'Card Packs|Goods|Upgrades', tabs.join(' | '));
check('shop category rail has no number badges', await page.locator('.shop-category__count').count() === 0,
  `${await page.locator('.shop-category__count').count()} badges`);

check('Goods opens with 16 rotating items', await page.locator('.goods-card').count() === 16,
  `${await page.locator('.goods-card').count()}`);
const headingLines = await page.locator('.shop-summon__shop > .shop .shop-topbar > .shop-header')
  .evaluate(header => [...header.children].map(node => node.textContent.trim()));
check('shop title is the requested three-line hierarchy', headingLines.length === 3
  && headingLines[0] === 'Shop' && headingLines[1] === 'Goods' && /^New stock in \d+:\d{2}$/.test(headingLines[2]),
  headingLines.join(' | '));
check('native title tooltips are absent', await page.locator('[title]').count() === 0,
  `${await page.locator('[title]').count()} title attributes`);
const cardFaceSource = await page.evaluate(() => fetch('/src/components/CardFace.jsx').then(response => response.text()));
check('playing cards use a rarity-colored frame variable',
  cardFaceSource.includes('#f4f2e8')
    && cardFaceSource.includes('#ef4444')
    && cardFaceSource.includes('#f0c040')
    && cardFaceSource.includes('firstEdition')
    && cardFaceSource.includes('--card-frame-color'));
check('playing cards no longer render a bottom rarity gem', !cardFaceSource.includes('card-art-rarity-tab'));

await page.locator('.shop-category', { hasText: 'Card Packs' }).click();
await page.waitForTimeout(400);
const rotPacks = await page.locator('.shelf-pack__grab').count();
check('Card Packs shows Blank Slate plus 3 rotating packs', rotPacks === 4, `${rotPacks}`);
const packNames = await page.locator('.shelf-pack__tag-name').allTextContents();
check('Blank Slate is always stocked exactly once', packNames.filter(name => name === 'Blank Slate').length === 1,
  packNames.join(' | '));
const stockLine = await page.locator('.shop-header__status').textContent();
check('rotation shows a minute:second countdown', /New stock in \d+:\d{2}/.test(stockLine), stockLine);

const schedule = await page.evaluate(async () => {
  const shop = await import('/src/game/shop.js');
  const tierCounts = Object.fromEntries(Array.from({ length: 5 }, (_, index) => [index + 1, 0]));
  const current = shop.getGoodsRotation(Date.now());
  current.offers.forEach(offer => {
    const material = shop.SHOP_MATERIALS.find(entry => entry.shopId === offer.materialId);
    if (material) tierCounts[material.tier] += 1;
  });
  const covered = new Set();
  for (let window = 0; window < 180; window++) {
    shop.getGoodsRotation(window * shop.ROTATION_PERIOD_MS + 1).offers
      .forEach(offer => covered.add(offer.materialId));
  }
  const byId = Object.fromEntries(shop.SHOP_MATERIALS.map(material => [material.shopId, material]));
  return {
    period: shop.ROTATION_PERIOD_MS,
    catalogueSize: shop.SHOP_MATERIALS.length,
    uniqueIds: new Set(shop.SHOP_MATERIALS.map(material => material.shopId)).size,
    tierCounts,
    covered: covered.size,
    prices: {
      wood: byId.wood?.cost,
      voidwood: byId.voidwood?.cost,
      iron: byId.iron?.cost,
      starlit: byId.starlit?.cost,
      dullRuby: byId.dull_ruby?.cost,
      royalRuby: byId.royal_ruby?.cost,
    },
  };
});
check('goods and packs rotate every five minutes', schedule.period === 5 * 60 * 1000, `${schedule.period}ms`);
check('the goods catalogue is broad and has no duplicate merchant identities',
  schedule.catalogueSize >= 100 && schedule.uniqueIds === schedule.catalogueSize,
  `${schedule.uniqueIds}/${schedule.catalogueSize}`);
check('every shelf deliberately includes Tier IV and Tier V stock',
  JSON.stringify(schedule.tierCounts) === JSON.stringify({ 1: 6, 2: 4, 3: 3, 4: 2, 5: 1 }),
  JSON.stringify(schedule.tierCounts));
check('shuffle bags expose the complete goods catalogue over time',
  schedule.covered === schedule.catalogueSize, `${schedule.covered}/${schedule.catalogueSize}`);
check('rare raw materials and gems begin far above their common counterparts',
  schedule.prices.voidwood > schedule.prices.wood
    && schedule.prices.starlit > schedule.prices.iron
    && schedule.prices.royalRuby > schedule.prices.dullRuby,
  JSON.stringify(schedule.prices));

// Five purchases in one JS turn prove the animation no longer throttles buying. The game handler must
// advance its transaction refs synchronously so every click sees the price produced by the click before.
const before = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')).balance);
const shown = await page.evaluate(() => {
  const tag = document.querySelector('.shelf-pack .gold-amount');
  return Number(tag.textContent.replace(/[^0-9.]/g, ''));
});
await page.locator('.shelf-pack__grab').first().evaluate(button => {
  for (let i = 0; i < 5; i++) button.click();
});
await page.waitForTimeout(100);
check('five rapid buys create five concurrent pack flights', await page.locator('.flying-pack').count() === 5,
  `${await page.locator('.flying-pack').count()} flights`);
const raised = await page.evaluate(() => Number(document.querySelector('.shelf-pack__tag-price')?.textContent.replace(/[^0-9.]/g, '')));
check('the pack price updates immediately through all five purchases', raised > shown, `${shown} -> ${raised}`);
await page.waitForTimeout(2600);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')));
const expectedCharge = Array.from({ length: 5 }, (_, count) => Math.round(shown * (1 + count * 0.15) * 100) / 100)
  .reduce((sum, amount) => sum + amount, 0);
check('all five escalating prices were charged exactly',
  Math.abs((before - after.balance) - expectedCharge) < 0.01,
  `expected=${expectedCharge.toFixed(2)} charged=${(before - after.balance).toFixed(2)}`);
check('all five packs were delivered', after.packs.length === 6, `${after.packs.length} held including Welcome Pack`);
check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
await browser.close();
const failed = results.filter(r => !r.p);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
