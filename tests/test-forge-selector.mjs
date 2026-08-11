/**
 * The forge row selector: does it fit, and does a hidden row still report itself?
 *
 * The fit is the whole reason it exists — a `.foundry-half` gets 395px at 1366x768 and three stacked
 * 558px rows needed 1844px. But the thing that would make the selector a REGRESSION rather than a fix is
 * a hidden row going dark: a smelt that finished on row II, with the player on row I, must still be
 * visible or it will never be collected. That is what most of this checks.
 */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const errors = [];

const card = (id, cls) => ({
  id, name: `Smith ${id}`, classType: cls, artVariant: 0, rarity: 'rare', tier: 2,
  tag: null, value: 40, affixes: [],
});


/** The Bag is an overlay anchored to the viewport's right edge, so it covers the forge's right end on any
 *  window below ~1900px — a documented, pre-existing limit. Close it before reaching for a tab, the same
 *  as a player would, and check clearance against the closed state separately. */
async function closeBag(page) {
  const open = await page.locator('.inventory-panel--open').count();
  if (open) { await page.locator('.drawer-tab.inventory-toggle').click(); await page.waitForTimeout(450); }
}

async function boot(page, mutate) {
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
  await page.waitForTimeout(400);
}

// ── Fit at the viewport the report came from ──
for (const vp of [{ w: 1366, h: 768 }, { w: 1280, h: 800 }, { w: 1512, h: 982 }]) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  page.on('console', m => { if (m.type() === 'error' && !/WebGL|THREE|GPU/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));

  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  await enterGame(page);

  const smiths = [card('bs-1', 'blacksmith'), card('bs-2', 'blacksmith'), card('bs-3', 'blacksmith')];
  await boot(page, {
    collection: smiths, pocket: smiths, pocketCapacity: 6, balance: 500,
    oreInventory: { coal: 40, iron: 40, stone: 20 },
    forgeOreSlots: [
      { slotId: 1, oreType: 'iron', count: 2 },
      { slotId: 2, oreType: 'gold', count: 5 },
      { slotId: 3, oreType: 'starlit', count: 9 },
    ],
    forgeIngredientSlots: [
      { slotId: 1, ingotType: null, count: 0 },
      { slotId: 2, ingotType: null, count: 0 },
      { slotId: 3, ingotType: 'platinum', count: 1 },
    ],
    graphicsSettings: { quality: 'low' },
  });

  await page.locator('.tab-bar button', { hasText: 'Foundry' }).first().click();
  await page.waitForTimeout(900);
  await closeBag(page);

  const m = await page.evaluate(() => {
    const half = document.querySelector('.foundry-half--forge');
    const tabs = [...document.querySelectorAll('.forge-selector__tab')];
    const rows = document.querySelectorAll('.foundry-forge-row').length;
    return {
      tabs: tabs.length,
      rows,
      halfScroll: half ? half.scrollHeight - half.clientHeight : null,
      halfH: half ? Math.round(half.clientHeight) : null,
      tabWidths: tabs.map(t => Math.round(t.getBoundingClientRect().width)),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      // The drawer's tab rail is 112px wide and sits left of the (closed) panel, so it obstructs from
      // `viewport - 248 - 112` rightwards whether the panel is open or not.
      tabsRight: tabs.length ? Math.round(Math.max(...tabs.map(t => t.getBoundingClientRect().right))) : 0,
      railLeft: (() => { const t = document.querySelector('.drawer-tab.inventory-toggle');
        return t ? Math.round(t.getBoundingClientRect().left) : null; })(),
    };
  });
  const label = `${vp.w}x${vp.h}`;
  check(`${label}: one row rendered, three tabs`, m.rows === 1 && m.tabs === 3, `rows=${m.rows} tabs=${m.tabs}`);
  check(`${label}: tabs are equal width (no 1fr auto-minimum blowout)`,
    new Set(m.tabWidths).size === 1, `${m.tabWidths.join('/')}`);
  check(`${label}: no horizontal page overflow`, m.overflowX === 0, `${m.overflowX}px`);
  check(`${label}: the selector tabs clear the Bag's tab rail`, m.railLeft === null || m.tabsRight <= m.railLeft,
    `tabs right ${m.tabsRight} vs rail left ${m.railLeft}`);
  check(`${label}: the active iron slot shows its recipe-specific placed / required amount`,
    (await page.locator('[data-material-requirement="2/4"]').count()) === 1);
  console.log(`      forge half ${m.halfH}px, inner scroll ${m.halfScroll}px`);

  if (vp.w === 1366) {
    // ── A hidden row must still report itself ──
    // Load coal into row I only, then switch to row II. Row I should keep showing its state on its tab.
    const tabState = () => page.evaluate(() => [...document.querySelectorAll('.forge-selector__tab')].map(t => ({
      name: t.querySelector('.forge-selector__name')?.textContent,
      state: t.querySelector('.forge-selector__state')?.textContent,
      active: t.getAttribute('aria-selected') === 'true',
      cls: [...t.classList].filter(c => c.startsWith('forge-selector__tab--')).join(' '),
      loot: !!t.querySelector('.forge-selector__loot'),
      fill: !!t.querySelector('.forge-selector__fill'),
    })));

    await closeBag(page);
    const before = await tabState();
    check('1366: tab I is active by default', before[0].active && !before[1].active, JSON.stringify(before.map(t => t.active)));
    check('1366: every tab names a next action rather than going blank',
      before.every(t => /Empty|Needs|Ready|%/.test(t.state)), before.map(t => t.state).join(' | '));

    await page.locator('.forge-selector__tab').nth(1).click();
    await page.waitForTimeout(400);
    const after = await tabState();
    check('1366: clicking a tab switches the visible row',
      after[1].active && !after[0].active, JSON.stringify(after.map(t => t.active)));
    check('1366: still exactly one row mounted after switching',
      (await page.locator('.foundry-forge-row').count()) === 1);
    check('1366: the now-hidden row I still reports its state on its tab',
      /Empty|Needs|Ready|%/.test(after[0].state), `"${after[0].state}"`);
    const goldRequirements = await page.locator('[data-material-requirement]').evaluateAll(nodes =>
      nodes.map(node => ({ value: node.dataset.materialRequirement, text: node.textContent.trim() })));
    check('1366: a different Forge recipe shows its own ore cost and its empty ingredient cost',
      goldRequirements.some(entry => entry.value === '5/6' && entry.text === '5 / 6')
        && goldRequirements.some(entry => entry.value === '0/1' && entry.text === '0 / 1'),
      JSON.stringify(goldRequirements));

    // A running row's progress must be legible from its tab while hidden.
    await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('tcg-sim'));
      const now = Date.now();
      // Row 0 mid-smelt; row 1 holding finished output.
      save.forgeFuelSlots[0] = { ...save.forgeFuelSlots[0], loadedCoal: 3, startedAt: now - 10000, endsAt: now + 10000 };
      save.forgeOutputQueues = { ...(save.forgeOutputQueues ?? {}), 2: { steel: 4 } };
      save.forgeOreSlots[1] = { ...save.forgeOreSlots[1], oreType: 'iron', count: 8 };
      localStorage.setItem('tcg-sim', JSON.stringify(save));
    });
    await boot(page, {});
    await page.locator('.tab-bar button', { hasText: 'Foundry' }).first().click();
    await page.waitForTimeout(900);
    await closeBag(page);
    // Sit on row III so both interesting rows are hidden.
    await page.locator('.forge-selector__tab').nth(2).click();
    await page.waitForTimeout(500);
    const hidden = await tabState();
    check('a mid-smelt HIDDEN row shows a progress percentage on its tab',
      /%/.test(hidden[0].state) && hidden[0].fill, `state="${hidden[0].state}" fill=${hidden[0].fill}`);
    check('...and is marked running', hidden[0].cls.includes('--running'), hidden[0].cls);
    check('a HIDDEN row with output waiting shows the loot diamond',
      hidden.some(t => !t.active && t.loot), JSON.stringify(hidden.map(t => [t.name, t.loot])));

    // The loot diamond is a gameplay signal, so it must survive the low/medium `animation: none`.
    const lootStatic = await page.evaluate(() => {
      const d = document.querySelector('.forge-selector__loot');
      if (!d) return null;
      const cs = getComputedStyle(d);
      return { quality: document.documentElement.getAttribute('data-quality'), anim: cs.animationName, shadow: cs.boxShadow, bg: cs.backgroundColor };
    });
    check('the loot diamond is visible WITHOUT animation (low quality)',
      lootStatic && lootStatic.anim === 'none' && lootStatic.shadow !== 'none',
      JSON.stringify(lootStatic));
  }
  await page.close();
}

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) { console.log('FAILURES:'); failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`)); process.exit(1); }
