/**
 * Confirms a failed persist is reported rather than swallowed, and that the game keeps running.
 *
 * Simulated by making `localStorage.setItem` throw the way a quota-exceeded browser does. The
 * localStorage adapter catches it and returns false; `reportWriteFailure` is what turns that into
 * something visible.
 */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage();
const saveErrors = [];
page.on('console', m => { if (/\[save\]/.test(m.text())) saveErrors.push(m.text()); });
page.on('pageerror', e => saveErrors.push(`pageerror: ${e.message}`));

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await enterGame(page);

const enter = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
if (await enter.count()) { await enter.click(); await page.waitForTimeout(800); }

check('no save errors while storage is healthy', saveErrors.length === 0, saveErrors.join(' | '));

// Break persistence the way a full quota does.
await page.evaluate(() => {
  localStorage.setItem = () => { throw new DOMException('QuotaExceededError'); };
});
await page.locator('.shelf-pack__grab.shop-pack-card--iron').first().click();
await page.waitForTimeout(2800); // past the debounce

check('the failed write was reported', saveErrors.some(t => /could not write the save/.test(t)),
  saveErrors.join(' | ') || 'nothing logged');
check('the game is still running after a failed write', await page.locator('.app').count() === 1);
check('the UI still reflects the purchase',
  await page.evaluate(() => {
    const el = document.querySelector('.header .gold-amount');
    return el ? Number(el.textContent.replace(/[^0-9.]/g, '')) : null;
  }) === 20,
  'balance should still be 20 in memory even though it could not be saved');

await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) { failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`)); process.exit(1); }
