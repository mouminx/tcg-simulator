/**
 * Storage adapter — web build.
 *
 * The refactor moved the save read out of render and behind an async adapter, and split `App` into a
 * boot gate plus `GameApp`. On the web the adapter is still `localStorage`, so the observable behaviour
 * must be *identical* to before: existing saves load, new state persists, nothing about the boot is
 * visible. That "no change" is the thing worth testing, because it is what a regression would break.
 */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';

const URL_ = 'http://localhost:5199/';
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => {
  if (m.type() === 'error' && !/WebGL|THREE|GPU/i.test(m.text())) consoleErrors.push(m.text());
});
page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`));

// ── 1. Adapter selection ──
await page.goto(URL_, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await enterGame(page);

const adapter = await page.evaluate(async () => {
  const m = await import('/src/game/storage.js');
  const active = m.getStorage();          // whatever the opened slot resolved to
  const slot1 = m.getLocalAdapter(1);
  return {
    activeName: active?.name ?? null,
    activeSlot: active?.slot ?? null,
    slot1Key: m.localKeyForSlot(1),
    slot2Key: m.localKeyForSlot(2),
    describe: slot1.describe(),
    memoized: m.getLocalAdapter(1) === slot1,
    slotCount: m.SLOT_COUNT,
  };
});
check('the web build resolves the localStorage adapter', adapter.activeName === 'localStorage', adapter.describe);
check('the opened slot is slot 1', adapter.activeSlot === 1, `slot=${adapter.activeSlot}`);
check('slot 1 keeps the original save key', adapter.slot1Key === 'tcg-sim', adapter.slot1Key);
check('other slots get their own keys', adapter.slot2Key === 'tcg-sim:slot:2', adapter.slot2Key);
check('getLocalAdapter() is memoized per slot', adapter.memoized);
check('there are three slots', adapter.slotCount === 3, `${adapter.slotCount}`);

// ── 2. The boot gate clears and the game mounts ──
check('boot placeholder is gone', await page.locator('.app-booting').count() === 0);
check('game mounted', await page.locator('.app').count() === 1);
check('a fresh save was written', await page.evaluate(() => !!localStorage.getItem('tcg-sim')));

// ── 3. Round-trip: state written by the adapter is read back by it ──
const enter = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
if (await enter.count()) { await enter.click(); await page.waitForTimeout(800); }

const before = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('tcg-sim'));
  return { balance: s.balance, packs: s.packs.length };
});
await page.locator('.shelf-pack__grab.shop-pack-card--iron').first().click();
await page.waitForTimeout(2600);
const mid = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('tcg-sim'));
  return { balance: s.balance, packs: s.packs.length };
});
check('buying a pack persisted', mid.packs === before.packs + 1 && mid.balance < before.balance,
  `packs ${before.packs}->${mid.packs}, balance ${before.balance}->${mid.balance}`);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await enterGame(page);
const after = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('tcg-sim'));
  return { balance: s.balance, packs: s.packs.length };
});
check('state survived a reload through the adapter',
  after.packs === mid.packs && after.balance === mid.balance,
  `packs=${after.packs} balance=${after.balance}`);

// ── 4. A pre-existing save (written before this refactor) still loads ──
await page.evaluate(() => {
  localStorage.setItem('tcg-sim', JSON.stringify({
    version: 23, balance: 777.25,
    collection: [{ id: crypto.randomUUID(), name: 'Legacy Miner', classType: 'miner', artVariant: 0, rarity: 'rare', tier: 3, tag: null, value: 40, affixes: [] }],
    packs: [], pocket: [],
  }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await enterGame(page);
const legacy = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('tcg-sim'));
  return { balance: s.balance, cards: s.collection.length, name: s.collection[0]?.name, version: s.version };
});
check('a partial existing save loads and is filled in',
  legacy.balance === 777.25 && legacy.cards === 1 && legacy.name === 'Legacy Miner',
  `balance=${legacy.balance} cards=${legacy.cards} v=${legacy.version}`);

// ── 5. A corrupt save falls back to a new game rather than a crash ──
await page.evaluate(() => localStorage.setItem('tcg-sim', '{ this is not json'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await enterGame(page);
check('corrupt save boots into a fresh game', await page.locator('.app').count() === 1);
const recovered = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')).balance);
check('corrupt save produced starting balance', recovered === 25, `balance=${recovered}`);

// ── 6. Flush on hide writes immediately, without waiting for the debounce ──
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await enterGame(page);
const enter2 = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
if (await enter2.count()) { await enter2.click(); await page.waitForTimeout(700); }
await page.locator('.shelf-pack__grab.shop-pack-card--iron').first().click();
await page.waitForTimeout(150); // well inside the 2s debounce
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(250);
const flushed = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')).packs.length);
check('hiding the page flushed before the debounce elapsed', flushed === 2, `packs=${flushed}`);

check('no console errors across every boot', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILURES:');
  failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
  process.exit(1);
}
