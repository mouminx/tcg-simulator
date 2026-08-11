/**
 * Save-25 migration test.
 *
 * The migration's whole job is a CONSISTENT rename: one legacy id maps to exactly one UUID
 * everywhere it appears. A migration that merely produced valid UUIDs — but a different one per
 * holder — would pass a naive "are they UUIDs?" check and silently orphan every socketed card,
 * because the Hand and all five station slots resolve back to the collection *by id*.
 *
 * So this seeds a v22 save with the same card duplicated across all seven holders, reloads, and
 * asserts the copies still agree with the collection.
 */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';

const URL_ = 'http://localhost:5199/';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// ── 1. Load once so the origin exists and we can read the real default slot shapes ──
await page.goto(URL_, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500); // debounced save is 2s
await enterGame(page);   // slots: no save is written until one is opened
await page.waitForTimeout(2600);

const fresh = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')));
check('fresh save is at version 25', fresh.version === 25, `got ${fresh.version}`);
check('fresh save has empty staged-loot arrays',
  Array.isArray(fresh.mineLootStages) && fresh.mineLootStages.length === 0
    && Array.isArray(fresh.gatheringLootStages) && fresh.gatheringLootStages.length === 0,
  `mine=${JSON.stringify(fresh.mineLootStages)} gathering=${JSON.stringify(fresh.gatheringLootStages)}`);
check('fresh save has real slot arrays', Array.isArray(fresh.mineSlots) && fresh.mineSlots.length > 0,
  `mineSlots=${fresh.mineSlots?.length} forge=${fresh.forgeCardSlots?.length} gather=${fresh.gatheringSlots?.length} proc=${fresh.processingSlots?.length} exped=${fresh.expeditionUnitSlots?.length}`);

// ── 2. Build a v22 save with legacy counter ids, one card duplicated into every holder ──
const seeded = await page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('tcg-sim'));

  // Legacy ids: exactly what `let nextId = Date.now(); id: nextId++` produced.
  const base = 1754000000000;
  const mk = (n, cls, rarity) => ({
    id: base + n, name: `Test ${cls} ${n}`, classType: cls, artVariant: 0,
    rarity, tier: 2, tag: null, value: 12.5,
    affixes: [{ id: 'miningEfficiency', label: 'Mining Efficiency', stat: 'miningSpeed', value: 4, higher: false }],
  });

  const A = mk(0, 'miner', 'common');       // -> collection, pocket, mineSlots
  const B = mk(1, 'lumberjack', 'rare');    // -> collection, pocket, gatheringSlots
  const C = mk(2, 'blacksmith', 'epic');    // -> collection, forgeCardSlots, processingSlots
  const D = mk(3, 'warrior', 'legendary');  // -> collection, expeditionUnitSlots, expeditionRun x2

  save.version = 22;
  save.collection = [A, B, C, D];
  // Copies, as the app stores them — structurally separate objects sharing only the id.
  save.pocket = [{ ...A }, { ...B }];
  save.mineSlots = save.mineSlots.map((s, i) => (i === 0 ? { ...s, card: { ...A } } : s));
  save.gatheringSlots = save.gatheringSlots.map((s, i) => (i === 0 ? { ...s, card: { ...B } } : s));
  save.forgeCardSlots = save.forgeCardSlots.map((s, i) => (i === 0 ? { ...s, card: { ...C } } : s));
  save.processingSlots = save.processingSlots.map((s, i) => (i === 0 ? { ...s, card: { ...C } } : s));
  // v23 and older stored production output globally by resource type. v24 attributes it to rows.
  delete save.forgeOutputQueues;
  save.ingotClaimQueue = { ...(save.ingotClaimQueue ?? {}), steel: 3 };
  save.forgeOreSlots = save.forgeOreSlots.map((s, i) => (i === 0 ? { ...s, oreType: 'iron', count: 4 } : s));
  delete save.processingOutputQueues;
  save.processedClaimQueue = { ...(save.processedClaimQueue ?? {}), timber: 2 };
  save.processingSlots = save.processingSlots.map((s, i) => (i === 0 ? { ...s, outputId: 'timber' } : s));
  save.expeditionUnitSlots = save.expeditionUnitSlots.map((s, i) => (i === 0 ? { ...s, card: { ...D } } : s));

  // A run mid-reveal carries a third and fourth copy of the same card.
  save.expeditionRun = {
    state: 'reveal', difficultyId: 'shallows', revealIndex: 0, result: 'success', success: true,
    startedAt: 1, endsAt: 2, resolvedAt: 3,
    unitSlots: [{ slotId: 1, card: { ...D } }],
    unitResults: [{ slotId: 1, card: { ...D }, outcome: 'survived', survivalChance: 0.8, rewards: [], bonusRewards: [] }],
    rewardEntries: [],
  };

  localStorage.setItem('tcg-sim', JSON.stringify(save));
  return { legacyIds: [A.id, B.id, C.id, D.id] };
});
console.log(`\nseeded v22 save with legacy ids: ${seeded.legacyIds.join(', ')}\n`);

// ── 3. Reload — the migration runs on load ──
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
await enterGame(page);

const after = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')));

check('migrated save is at version 25', after.version === 25, `got ${after.version}`);
check('older saves receive empty staged-loot arrays without disturbing their queues',
  Array.isArray(after.mineLootStages) && after.mineLootStages.length === 0
    && Array.isArray(after.gatheringLootStages) && after.gatheringLootStages.length === 0,
  `mine=${JSON.stringify(after.mineLootStages)} gathering=${JSON.stringify(after.gatheringLootStages)}`);
check('legacy Forge output migrated onto its matching row',
  after.forgeOutputQueues?.['1']?.steel === 3, JSON.stringify(after.forgeOutputQueues));
check('legacy Processing output migrated onto its matching bench',
  after.processingOutputQueues?.['1']?.timber === 2, JSON.stringify(after.processingOutputQueues));
check('collection kept all 4 cards', after.collection.length === 4, `got ${after.collection.length}`);

const ids = after.collection.map(c => c.id);
check('every collection id is a UUID', ids.every(id => UUID_RE.test(id)), ids.join(' '));
check('collection ids are distinct', new Set(ids).size === 4, `${new Set(ids).size} unique`);
check('no legacy id survives anywhere',
  !JSON.stringify(after).includes('1754000000000'), 'searched whole save');

const [ida, idb, idc, idd] = ids;

// The heart of it: every copy must still resolve to its collection entry.
check('pocket[0] still matches collection[0]', after.pocket[0].id === ida, `${after.pocket[0].id} vs ${ida}`);
check('pocket[1] still matches collection[1]', after.pocket[1].id === idb, `${after.pocket[1].id} vs ${idb}`);
check('mineSlots[0].card matches collection[0]', after.mineSlots[0].card.id === ida, `${after.mineSlots[0].card.id} vs ${ida}`);
check('gatheringSlots[0].card matches collection[1]', after.gatheringSlots[0].card.id === idb, `${after.gatheringSlots[0].card.id} vs ${idb}`);
check('forgeCardSlots[0].card matches collection[2]', after.forgeCardSlots[0].card.id === idc, `${after.forgeCardSlots[0].card.id} vs ${idc}`);
check('processingSlots[0].card matches collection[2]', after.processingSlots[0].card.id === idc, `${after.processingSlots[0].card.id} vs ${idc}`);
check('expeditionUnitSlots[0].card matches collection[3]', after.expeditionUnitSlots[0].card.id === idd, `${after.expeditionUnitSlots[0].card.id} vs ${idd}`);
check('expeditionRun.unitSlots[0].card matches collection[3]', after.expeditionRun.unitSlots[0].card.id === idd, `${after.expeditionRun.unitSlots[0].card.id} vs ${idd}`);
check('expeditionRun.unitResults[0].card matches collection[3]', after.expeditionRun.unitResults[0].card.id === idd, `${after.expeditionRun.unitResults[0].card.id} vs ${idd}`);

// Card payload other than the id must be untouched.
const a = after.collection[0];
check('card fields survive the rename',
  a.name === 'Test miner 0' && a.classType === 'miner' && a.rarity === 'common' && a.tier === 2 && a.affixes.length === 1,
  `${a.name} / ${a.classType} / ${a.rarity} / tier ${a.tier} / ${a.affixes.length} affix`);

// ── 4. Idempotency: a second load must not re-key anything ──
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
await enterGame(page);
const twice = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')));
check('ids are stable across a second load',
  JSON.stringify(twice.collection.map(c => c.id)) === JSON.stringify(ids),
  twice.collection.map(c => c.id).join(' '));
check('slot copies still match after second load',
  twice.mineSlots[0].card.id === twice.collection[0].id
  && twice.expeditionRun.unitResults[0].card.id === twice.collection[3].id, '');

// ── 5. New cards mint UUIDs, and pack ids too ──
const minted = await page.evaluate(async () => {
  const mod = await import('/src/game/cards.js');
  const pack = mod.openPack('iron');
  const welcome = mod.openWelcomePack();
  const made = mod.makeCard('rare');
  return {
    packIds: pack.map(c => c.id),
    welcomeIds: welcome.map(c => c.id),
    madeId: made.id,
    twoCallsDiffer: mod.newId() !== mod.newId(),
    mintedHasId: !!mod.mintCard({ name: 'x' }).id,
  };
});
check('openPack mints UUIDs', minted.packIds.every(id => UUID_RE.test(id)) && new Set(minted.packIds).size === minted.packIds.length, `${minted.packIds.length} cards`);
check('openWelcomePack mints UUIDs', minted.welcomeIds.every(id => UUID_RE.test(id)) && new Set(minted.welcomeIds).size === 9, `${minted.welcomeIds.length} cards`);
check('makeCard mints a UUID', UUID_RE.test(minted.madeId), minted.madeId);
check('newId() is unique per call', minted.twoCallsDiffer);
check('mintCard stamps an id', minted.mintedHasId);

check('no console errors during any load', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILURES:');
  failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
  process.exit(1);
}
