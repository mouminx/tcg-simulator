import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const results = [];
const errors = [];
const check = (name, pass, detail = '') => {
  results.push(Boolean(pass));
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

page.on('pageerror', error => errors.push(error.message));
await page.goto(process.env.TEST_URL ?? 'http://localhost:5199/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await enterGame(page);

await page.getByRole('button', { name: 'Show release notes' }).click();
await page.waitForTimeout(450);

check('the title screen identifies 0.7.6 as the latest update',
  await page.locator('.splash__release-heading', { hasText: 'Version 0.7.6' }).count() === 1);
check('the latest release renders Changelog, Known Issues, and Planned columns',
  await page.locator('.splash__notes > .splash__note-columns > .splash__note-card').count() === 3);
if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH, fullPage: false });

const previous = page.locator('.splash__release-history', { hasText: 'Version 0.7.5' });
check('0.7.5 is preserved as a collapsed previous release',
  await previous.count() === 1 && !(await previous.evaluate(node => node.open)));

await previous.locator('summary').evaluate(node => node.scrollIntoView({ block: 'end' }));
const historyAtBottom = await page.evaluate(() => {
  const notes = document.querySelector('.splash__notes');
  const history = document.querySelector('.splash__release-history');
  if (!notes || !history) return false;
  const notesBox = notes.getBoundingClientRect();
  const historyBox = history.getBoundingClientRect();
  return notes.scrollTop > 0 && historyBox.top < notesBox.bottom && historyBox.bottom <= notesBox.bottom + 2;
});
check('scrolling to the bottom of 0.7.6 reveals the previous-release control', historyAtBottom);

await previous.locator('summary').click();
await page.waitForTimeout(180);
check('expanding 0.7.5 restores all three of its original note sections',
  await previous.locator('.splash__note-card').count() === 3
  && await previous.getByText('New UI for Shop', { exact: true }).count() === 1);
check('release notes produce no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
if (results.some(pass => !pass)) process.exit(1);
