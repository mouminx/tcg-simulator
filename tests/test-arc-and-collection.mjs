/**
 * The rune arc's states, and the Collection tab's diamond.
 *
 * Two things this checks that a screenshot cannot:
 *  - that the "holding" difference is visible at LOW quality too. The blanket `animation: none` at low and
 *    medium would erase a purely animated glow, so the brightness change has to be a static property as
 *    well — the same rule the loot diamond follows.
 *  - that the Collection diamond appears on new cards and clears on a visit, rather than being a permanent
 *    fixture keyed to collection size.
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
page.on('console', m => { if (m.type() === 'error' && !/WebGL|THREE|GPU/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));

const mkCards = n => Array.from({ length: n }, (_, i) => ({
  id: `seed-${i}-${Math.random().toString(36).slice(2)}`,
  name: `Seed ${i}`, classType: 'miner', artVariant: 0, rarity: 'common', tier: 1,
  tag: null, value: 10, affixes: [],
}));

async function seed(mutate) {
  await page.evaluate(m => {
    const save = JSON.parse(localStorage.getItem('tcg-sim'));
    Object.assign(save, m);
    localStorage.setItem('tcg-sim', JSON.stringify(save));
  }, mutate);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  await enterGame(page);
  const splash = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
  if (await splash.count()) { await splash.click(); await page.waitForTimeout(700); }
  await page.waitForTimeout(500);
}

const arcState = () => page.evaluate(() => {
  const ring = document.querySelector('.hand__arc-ring');
  const glyph = document.querySelector('.hand__arc-rune__glyph');
  return {
    runes: document.querySelectorAll('.hand__arc-rune').length,
    ringBorder: ring ? getComputedStyle(ring).borderTopColor : null,
    ringShadow: ring ? getComputedStyle(ring).boxShadow : null,
    glyphColor: glyph ? getComputedStyle(glyph).color : null,
    ringAnim: ring ? getComputedStyle(ring).animationName : null,
    label: document.querySelector('.hand__arc-label')?.textContent ?? null,
    quality: document.documentElement.getAttribute('data-quality'),
  };
});

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await enterGame(page);

const cards = mkCards(6);

// ── The arc at rest, empty vs holding, at LOW quality ──
await seed({ collection: cards, pocket: [], pocketCapacity: 6, graphicsSettings: { quality: 'low' } });
const empty = await arcState();
check('empty hand: 9 runes rendered (7 visible + overscan for the spin)', empty.runes === 9, `${empty.runes}`);
check('empty hand: no animation (inert, as specified)', empty.ringAnim === 'none', `${empty.ringAnim}`);
check('empty hand: label invites', empty.label === 'Drag cards here', `${empty.label}`);

await seed({ collection: cards, pocket: cards.slice(0, 6), pocketCapacity: 6, graphicsSettings: { quality: 'low' } });
const full = await arcState();
check('full hand: 17 runes rendered (15 visible + overscan)', full.runes === 17, `${full.runes}`);
check('full hand: no label (cannot add more)', full.label === null, `${full.label}`);
check('AT LOW QUALITY the holding state is still visibly brighter than empty',
  full.glyphColor !== empty.glyphColor && full.ringBorder !== empty.ringBorder,
  `glyph ${empty.glyphColor} -> ${full.glyphColor}; ring ${empty.ringBorder} -> ${full.ringBorder}`);
check('...and the ring gained a glow that does not depend on animation',
  full.ringShadow !== 'none' && full.ringShadow !== empty.ringShadow,
  `${empty.ringShadow} -> ${full.ringShadow}`);

// ── The pulse exists at HIGH quality ──
await seed({ collection: cards, pocket: cards.slice(0, 3), pocketCapacity: 6, graphicsSettings: { quality: 'high' } });
const high = await arcState();
check('at HIGH quality the holding ring pulses', high.quality === 'high' && high.ringAnim === 'hand-arc-pulse',
  `quality=${high.quality} anim=${high.ringAnim}`);
// 3 of 6 cards -> 11 visible, step 7.6deg, 13 rendered with the overscan. Derived, not guessed.
check('rune count scales with the hand (3 of 6 -> 13 rendered)', high.runes === 13, `${high.runes}`);

// ── The spin: still when empty, faster as the hand fills ──
const spinAt = () => page.evaluate(() => {
  const el = document.querySelector('.hand__arc-spin');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { name: cs.animationName, duration: cs.animationDuration, step: cs.getPropertyValue('--arc-step').trim() };
});
await seed({ collection: cards, pocket: [], pocketCapacity: 6, graphicsSettings: { quality: 'high' } });
const spinEmpty = await spinAt();
check('empty hand: the ring does NOT rotate', spinEmpty.duration === '0s',
  `duration=${spinEmpty.duration} name=${spinEmpty.name}`);

await seed({ collection: cards, pocket: cards.slice(0, 1), pocketCapacity: 6, graphicsSettings: { quality: 'high' } });
const spin1 = await spinAt();
await seed({ collection: cards, pocket: cards.slice(0, 6), pocketCapacity: 6, graphicsSettings: { quality: 'high' } });
const spin6 = await spinAt();
const secs = v => parseFloat(v);
const speed = s => parseFloat(s.step) / secs(s.duration);   // deg per second
check('1 card: the ring rotates', secs(spin1.duration) > 0, `duration=${spin1.duration} step=${spin1.step}`);
check('a full hand spins FASTER than one card',
  speed(spin6) > speed(spin1),
  `${speed(spin1).toFixed(2)} deg/s -> ${speed(spin6).toFixed(2)} deg/s`);
check('max speed at max cards is ~5 deg/s as specified',
  Math.abs(speed(spin6) - 5) < 0.2, `${speed(spin6).toFixed(2)} deg/s`);

// ── The Collection tab: no number, and a diamond for new cards ──
const collectionTab = () => page.evaluate(() => {
  const tab = [...document.querySelectorAll('.tab-bar button')].find(b => /Collection/.test(b.textContent));
  const idx = [...document.querySelectorAll('.tab-bar button')].indexOf(tab);
  const diamonds = [...document.querySelectorAll('.tab-loot')];
  const bar = tab?.parentElement;
  const centre = tab ? tab.offsetLeft - (bar?.scrollLeft ?? 0) + tab.offsetWidth / 2 : null;
  const mine = diamonds.find(d => Math.abs(parseFloat(d.style.left) - centre) < 2);
  return {
    label: tab?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    hasNumber: /\d/.test(tab?.textContent ?? ''),
    diamond: !!mine,
    glowing: mine?.className.includes('tab-loot--new') ?? false,
    idx,
  };
});

// Seeded so 6 cards are owned but only 2 were "seen" — four arrived while away.
await seed({ collection: cards, pocket: [], collectionSeen: 2, graphicsSettings: { quality: 'high' } });
let tab = await collectionTab();
check('the Collection tab has no number in its label', !tab.hasNumber, `"${tab.label}"`);
check('a diamond appears when cards arrived since the last visit', tab.diamond, `diamond=${tab.diamond}`);
check('and it is glowing (unseen)', tab.glowing, `glowing=${tab.glowing}`);

// Visiting clears it — there is nothing to collect, so it should go away entirely.
await page.locator('.tab-bar button', { hasText: 'Collection' }).click();
await page.waitForTimeout(1200);
tab = await collectionTab();
check('visiting the Collection removes the diamond', !tab.diamond, `diamond=${tab.diamond}`);

// It must stay gone across a reload, i.e. collectionSeen persisted.
await page.waitForTimeout(2400);
const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')).collectionSeen);
check('collectionSeen was persisted', persisted === 6, `collectionSeen=${persisted}`);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await enterGame(page);
tab = await collectionTab();
check('still no diamond after a reload', !tab.diamond, `diamond=${tab.diamond}`);

// Selling cards must not produce a negative pending and resurrect the diamond.
await seed({ collection: cards.slice(0, 3), pocket: [], collectionSeen: 6, graphicsSettings: { quality: 'high' } });
tab = await collectionTab();
check('selling below the seen count shows no diamond', !tab.diamond, `diamond=${tab.diamond}`);

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILURES:');
  failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
  process.exit(1);
}
