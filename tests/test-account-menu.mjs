/**
 * The in-game account menu.
 *
 * The risk being tested is not "does a popover open" — it is that **switching saves must not lose
 * progress and must not cross-contaminate slots**. `GameApp` reads its entire state from `savedState` in
 * initializers that run once, so a stale object handed to a remount would silently resurrect the previous
 * save. So this earns and spends distinct amounts in two slots and checks each keeps its own number
 * across a switch, with no reload anywhere.
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
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/WebGL|THREE|GPU/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));

const balance = () => page.evaluate(() => {
  const el = document.querySelector('.header .gold-amount');
  return el ? Number(el.textContent.replace(/[^0-9.]/g, '')) : null;
});
const dismissSplash = async () => {
  const b = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
  if (await b.count()) { await b.click(); await page.waitForTimeout(700); }
};
const row = i => page.locator('.slots__item').nth(i - 1);
const openMenu = async () => { await page.locator('.account-menu__trigger').click(); await page.waitForTimeout(350); };
const createIn = async (i, mode) => {
  await row(i).locator('.slots__new').click();
  await page.waitForTimeout(250);
  await row(i).locator('.slots__btn', { hasText: mode }).click();
  await page.waitForTimeout(3200);
};

await page.goto(URL_, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await enterGame(page);          // creates an SSF save in slot 1
await dismissSplash();

// ── 1. The trigger exists and the panel escapes the header ──
check('the account menu is in the header', await page.locator('.header .account-menu__trigger').count() === 1);
check('it reads "Offline" when not signed in',
  /offline/i.test(await page.locator('.account-menu__name').textContent()),
  await page.locator('.account-menu__name').textContent());

await openMenu();
check('the panel opened', await page.locator('.account-menu__panel').count() === 1);
check('the panel is portaled OUT of the header (or the nav would cover it)',
  await page.evaluate(() => {
    const p = document.querySelector('.account-menu__panel');
    return !!p && !document.querySelector('.header')?.contains(p) && p.parentElement === document.body;
  }));
check('it names the slot being played',
  /Slot 1/.test(await page.locator('.account-menu__slot').textContent()),
  await page.locator('.account-menu__slot').textContent());
check('the SSF slot is labelled SSF, not Cloud',
  (await page.locator('.account-menu__panel .slots__badge').textContent()).trim() === 'SSF',
  await page.locator('.account-menu__panel .slots__badge').textContent());
check('signed out, it offers no Sign Out',
  await page.locator('.account-menu__action', { hasText: /^Sign Out$/ }).count() === 0);

// Escape closes it, and an outside click closes it.
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
check('Escape closes the panel', await page.locator('.account-menu__panel').count() === 0);
await openMenu();
await page.locator('.header .app-build').click({ force: true });
await page.waitForTimeout(250);
check('an outside click closes the panel', await page.locator('.account-menu__panel').count() === 0);

// ── 2. Spend, then switch away WITHOUT reloading, well inside the 2s debounce ──
await page.locator('.shelf-pack__grab.shop-pack-card--iron').first().click();
await page.waitForTimeout(200);   // deliberately inside SAVE_DEBOUNCE_MS
check('slot 1 is at 20 in memory', await balance() === 20, `balance=${await balance()}`);

await openMenu();
await page.locator('.account-menu__action', { hasText: 'Switch Save' }).click();
await page.waitForTimeout(2500);
check('Switch Save returns to the picker with no reload',
  await page.locator('.slots__list').count() === 1);
check('the purchase was flushed before leaving (picker shows 20.00)',
  /20\.00 gold/.test((await row(1).textContent()).replace(/\s+/g, ' ')),
  (await row(1).textContent()).replace(/\s+/g, ' ').trim());

// ── 3. A second slot keeps its own state across switches ──
await createIn(2, 'SSF');
check('the new slot starts fresh, not from slot 1', await balance() === 25, `balance=${await balance()}`);
await dismissSplash();
await page.locator('.shelf-pack__grab.shop-pack-card--iron').first().click();
await page.locator('.shelf-pack__grab.shop-pack-card--iron').first().click();
await page.waitForTimeout(200);
check('slot 2 is at 15', await balance() === 15, `balance=${await balance()}`);

await openMenu();
check('the menu now names slot 2',
  /Slot 2/.test(await page.locator('.account-menu__slot').textContent()),
  await page.locator('.account-menu__slot').textContent());
await page.locator('.account-menu__action', { hasText: 'Switch Save' }).click();
await page.waitForTimeout(2500);

// Back into slot 1 — it must still be 20, not 15.
await row(1).locator('.slots__btn', { hasText: 'Play' }).click();
await page.waitForTimeout(3000);
await dismissSplash();
check('slot 1 still holds its own 20 after playing slot 2',
  await balance() === 20, `balance=${await balance()} (slot 2 had 15)`);

await openMenu();
await page.locator('.account-menu__action', { hasText: 'Switch Save' }).click();
await page.waitForTimeout(2500);
await row(2).locator('.slots__btn', { hasText: 'Play' }).click();
await page.waitForTimeout(3000);
await dismissSplash();
check('slot 2 still holds its own 15', await balance() === 15, `balance=${await balance()}`);

// The title screen must NOT reappear on a switch — the player just came from the picker.
check('switching saves does not show the title screen again',
  await page.locator('.splash').count() === 0);

// ── 4. Multiplayer is barred ──
const barred = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('.tab-bar button')];
  const market = tabs.find(t => /market/i.test(t.textContent));
  return { found: !!market, disabled: market?.disabled ?? null, label: market?.textContent?.trim() ?? null };
});
check('the Market tab exists but is disabled', barred.found && barred.disabled === true,
  `found=${barred.found} disabled=${barred.disabled} label=${barred.label}`);

check('no console errors across the whole flow', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILURES:');
  failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
  process.exit(1);
}
