/**
 * Drag-path identity test under UUID ids.
 *
 * A card id round-trips through `dataTransfer.setData('text/plain', ...)`, which stringifies. Under
 * the old numeric ids that string had to be coerced back for every comparison (`sameCardId`); under
 * UUIDs it is already a string. Either way this is the one path where identity leaves the object graph
 * and comes back, so it is worth exercising rather than reasoning about.
 *
 * Playwright's mouse primitives do not trigger HTML5 drag-and-drop, so the events are dispatched with
 * a shared real `DataTransfer` — which is exactly what the browser does, and it means the app's own
 * dragstart handler is the thing writing the payload.
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

await page.goto(URL_, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await enterGame(page);

// Seed three real miner cards so the Foundry has something to accept.
const seededIds = await page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('tcg-sim'));
  save.balance = 500;
  save.collection = [0, 1, 2].map(n => ({
    id: crypto.randomUUID(), name: `Drag Miner ${n}`, classType: 'miner', artVariant: 0,
    rarity: 'common', tier: 1, tag: null, value: 10,
    affixes: [{ id: 'miningEfficiency', label: 'Mining Efficiency', stat: 'miningSpeed', value: 3, higher: false }],
  }));
  localStorage.setItem('tcg-sim', JSON.stringify(save));
  return save.collection.map(c => c.id);
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await enterGame(page);
const enter = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
if (await enter.count()) { await enter.click(); await page.waitForTimeout(900); }

check('seeded 3 UUID cards', seededIds.length === 3 && seededIds.every(id => /^[0-9a-f-]{36}$/i.test(id)));

/** Dispatches a full HTML5 drag with one shared DataTransfer, the way the browser does. */
const dragTo = (fromSel, toSel) => page.evaluate(({ fromSel, toSel }) => {
  const src = document.querySelector(fromSel);
  const dst = document.querySelector(toSel);
  if (!src) return { ok: false, why: `no source for ${fromSel}` };
  if (!dst) return { ok: false, why: `no target for ${toSel}` };
  const dt = new DataTransfer();
  const ev = (el, type) => el.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
  ev(src, 'dragstart');
  const payload = dt.getData('text/plain');
  ev(dst, 'dragenter');
  ev(dst, 'dragover');
  ev(dst, 'drop');
  ev(src, 'dragend');
  return { ok: true, payload };
}, { fromSel, toSel });

// ── 1. Collection -> Hand ──
await page.locator('.tab-bar button', { hasText: 'Collection' }).first().click();
await page.waitForTimeout(900);

const toHand = await dragTo('[draggable="true"]', '.hand__band');
check('dragstart wrote a UUID into the payload',
  toHand.ok && seededIds.includes(toHand.payload),
  toHand.ok ? `payload=${toHand.payload}` : toHand.why);

await page.waitForTimeout(2600);
const handState = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('tcg-sim'));
  return { pocket: s.pocket.map(c => c.id), collection: s.collection.length };
});
check('card landed in the Hand', handState.pocket.length === 1, `pocket=${handState.pocket.length}`);
check('the Hand card is the dragged card',
  handState.pocket[0] === toHand.payload, `${handState.pocket[0]} vs ${toHand.payload}`);
check('the collection still holds it (Hand holds copies)', handState.collection === 3, `${handState.collection}`);

// ── 2. Hand -> mine slot ──
await page.locator('.tab-bar button', { hasText: 'Foundry' }).first().click();
await page.waitForTimeout(1200);

const toMine = await dragTo('.hand__slot [draggable="true"], .hand__slot', '.foundry-mine-slot');
check('hand -> mine drag dispatched', toMine.ok, toMine.ok ? `payload=${toMine.payload}` : toMine.why);

await page.waitForTimeout(2600);
const mineState = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('tcg-sim'));
  return {
    socketed: s.mineSlots.filter(sl => sl.card).map(sl => sl.card.id),
    pocket: s.pocket.map(c => c.id),
    running: s.mineSlots.filter(sl => sl.card && sl.endsAt).length,
  };
});
check('card is socketed into a mine slot', mineState.socketed.length === 1, `socketed=${mineState.socketed.length}`);
check('the socketed card is the same UUID',
  mineState.socketed[0] === toHand.payload, `${mineState.socketed[0]} vs ${toHand.payload}`);
check('it left the Hand', mineState.pocket.length === 0, `pocket=${mineState.pocket.length}`);
check('mining started automatically', mineState.running === 1, `running=${mineState.running}`);

// ── 3. The socketed card still resolves back to its collection entry ──
const resolves = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('tcg-sim'));
  const socketed = s.mineSlots.find(sl => sl.card)?.card;
  return {
    found: !!s.collection.find(c => String(c.id) === String(socketed.id)),
    name: socketed.name,
  };
});
check('socketed card resolves to a collection entry', resolves.found, resolves.name);

check('no console errors during the drag flow', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILURES:');
  failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
  process.exit(1);
}
