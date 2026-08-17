/** Rotating goods: distinct stock, one-unit delivery, price escalation, flight, and persistence. */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

const enter = async () => {
  await enterGame(page);
  const splash = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
  if (await splash.count()) { await splash.click(); await page.waitForTimeout(700); }
};
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')));
const inventoryTotal = save => ['oreInventory', 'ingotInventory', 'gatheredInventory', 'processedInventory', 'craftedInventory', 'resources']
  .flatMap(key => Object.values(save[key] ?? {}))
  .reduce((sum, value) => sum + (Number(value) || 0), 0);
const price = locator => locator.textContent().then(text => Number(text.replace(/[^0-9.]/g, '')));

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await enter();
await page.waitForFunction(() => !!localStorage.getItem('tcg-sim'));
await page.evaluate(() => {
  const value = JSON.parse(localStorage.getItem('tcg-sim'));
  value.balance = 5000;
  value.graphicsSettings = { quality: 'low' };
  localStorage.setItem('tcg-sim', JSON.stringify(value));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await enter();

const cards = page.locator('.goods-card');
const names = await cards.locator('.goods-card__buy').evaluateAll(buttons => (
  buttons.map(button => button.getAttribute('aria-label')?.replace(/^Buy one | for [\d.]+$/g, '') ?? '')
));
check('exactly 16 goods rotate into stock', names.length === 16, `${names.length}`);
check('all 16 goods are distinct', new Set(names).size === 16, names.join(', '));
check('every good sells exactly one unit',
  await cards.locator('.foundry-square-resource__count').allTextContents().then(values => values.every(value => value.trim() === '1')));

const first = cards.first();
const before = await saved();
const beforePrice = await price(first.locator('.goods-card__buy'));
// Five clicks in one JS turn is deliberately harsher than a human can click. Every transaction must see
// the count and balance advanced by the one immediately before it, without waiting for React to repaint.
await first.locator('.goods-card__buy').evaluate(button => {
  for (let i = 0; i < 5; i++) button.click();
});
await page.waitForTimeout(100);
check('rapid purchases create concurrent flights to Inventory', await page.locator('.flying-good').count() === 5,
  `${await page.locator('.flying-good').count()} flights`);
const afterPrice = await price(first.locator('.goods-card__buy'));
check('the price updates immediately through all five purchases', afterPrice > beforePrice, `${beforePrice} -> ${afterPrice}`);
await page.waitForTimeout(2600);
const after = await saved();
check('all five materials were delivered', inventoryTotal(after) - inventoryTotal(before) === 5,
  `${inventoryTotal(before)} -> ${inventoryTotal(after)}`);
check('all five purchases persisted', Object.values(after.shopPurchases?.goods ?? {}).reduce((a, b) => a + b, 0) === 5);

// Do not call a legitimate five-minute turnover a reload reroll. If this run began in the final seconds of
// a window, wait for the new shelf and establish that as the reload baseline.
const countdownText = await page.locator('.shop-header__status').textContent();
const countdownMatch = countdownText.match(/(\d+):(\d{2})/);
const secondsRemaining = countdownMatch ? Number(countdownMatch[1]) * 60 + Number(countdownMatch[2]) : 60;
if (secondsRemaining < 5) {
  await page.waitForTimeout((secondsRemaining + 1) * 1000);
}
const stableNames = await page.locator('.goods-card .goods-card__buy').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')));
const stablePrice = await price(page.locator('.goods-card .goods-card__buy').first());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await enter();
const reloadedNames = await page.locator('.goods-card .goods-card__buy').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')));
const reloadedPrice = await price(page.locator('.goods-card .goods-card__buy').first());
check('reloading does not reroll the current shelf', reloadedNames.join('|') === stableNames.join('|'));
check('reloading preserves the current price', reloadedPrice === stablePrice, `${stablePrice} -> ${reloadedPrice}`);
check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const failed = results.filter(result => !result.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
