/**
 * The placement echo must fire for a STATION placement and not for a drop into the hand.
 *
 * The hand is a carrier, not a destination, so the shockwave there made picking a card up look as
 * consequential as socketing one — and it fought the rune arc, which is already lighting up behind the fan
 * for the same event. The sound still plays either way; only the ring is scoped.
 *
 * Requires HIGH quality: the echo is gated on `runeParticles`, which is high-only.
 */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));

const cards = Array.from({ length: 3 }, (_, i) => ({
  id: `echo-${i}-${Math.random().toString(36).slice(2)}`,
  name: `Echo Miner ${i}`, classType: 'miner', artVariant: 0, rarity: 'mythic', tier: 5, tag: null, value: 50,
  affixes: [
    { id: 'miningEfficiency', label: 'Mining Efficiency', stat: 'miningSpeed', value: 30, higher: true },
    { id: 'miningLuck', label: 'Mining Luck', stat: 'miningLuck', value: 22, higher: false },
  ],
}));

/** Dispatches a full HTML5 drag with one shared DataTransfer, as the browser does. */
const dragTo = (fromSel, toSel) => page.evaluate(({ fromSel, toSel }) => {
  const src = document.querySelector(fromSel);
  const dst = document.querySelector(toSel);
  if (!src || !dst) return { ok: false, why: `missing ${!src ? fromSel : toSel}` };
  const dt = new DataTransfer();
  const ev = (el, type) => el.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
  ev(src, 'dragstart');
  ev(dst, 'dragenter'); ev(dst, 'dragover'); ev(dst, 'drop');
  ev(src, 'dragend');
  return { ok: true };
}, { fromSel, toSel });

/** The echo lives ~1s; sampling repeatedly avoids missing it between frames. */
async function sawEcho(ms = 1400) {
  const deadline = Date.now() + ms;
  let seen = 0;
  while (Date.now() < deadline) {
    seen = Math.max(seen, await page.evaluate(() => document.querySelectorAll('.placement-echo').length));
    if (seen > 0) break;
    await page.waitForTimeout(60);
  }
  return seen;
}

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await enterGame(page);

await page.evaluate(c => {
  const save = JSON.parse(localStorage.getItem('tcg-sim'));
  save.collection = c;
  save.pocket = [];
  save.pocketCapacity = 6;
  save.balance = 500;
  save.graphicsSettings = { quality: 'high' };
  localStorage.setItem('tcg-sim', JSON.stringify(save));
}, cards);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2400);
await enterGame(page);
const splash = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
if (await splash.count()) { await splash.click(); await page.waitForTimeout(800); }

check('quality is high, so the echo is enabled at all',
  await page.evaluate(() => document.documentElement.getAttribute('data-quality')) === 'high');

// ── Collection -> hand: NO echo ──
await page.locator('.tab-bar button', { hasText: 'Collection' }).click();
await page.waitForTimeout(900);
let drag = await dragTo('[draggable="true"]', '.hand__band');
check('collection -> hand drag dispatched', drag.ok, drag.why ?? '');
const handEchoes = await sawEcho();
check('NO placement echo when a card is dropped into the hand', handEchoes === 0, `saw ${handEchoes}`);
await page.waitForTimeout(1200);
check('...and the card did land in the hand',
  await page.evaluate(() => document.querySelectorAll('.hand__slot').length) === 1,
  `${await page.evaluate(() => document.querySelectorAll('.hand__slot').length)} in hand`);

// ── Hand -> mine slot: echo MUST still fire ──
await page.locator('.tab-bar button', { hasText: 'Foundry' }).click();
await page.waitForTimeout(1300);
drag = await dragTo('.hand__slot [draggable="true"], .hand__slot', '.foundry-mine-slot');
check('hand -> mine drag dispatched', drag.ok, drag.why ?? '');
const stationEchoes = await sawEcho();
check('the placement echo DOES still fire for a station placement', stationEchoes > 0, `saw ${stationEchoes}`);
check('the card socketed into the mine',
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('tcg-sim'));
    return s.mineSlots.filter(x => x.card).length;
  }) >= 0);

check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILURES:');
  failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
  process.exit(1);
}
