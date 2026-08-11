/**
 * End-to-end slots, in a real browser against the real local Supabase stack.
 *
 * Every assertion pins a *balance* rather than checking that a screen appeared, because the failure worth
 * fearing is not "the picker looks wrong" — it is a slot loading the wrong save. Three saves are given
 * three distinct balances and then chased through offline play, online play, sign-out and a forced slot
 * collision. If any of them ever shows another's number, the slot model is broken.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';

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
// Records WHICH request failed. A bare "ERR_CONNECTION_REFUSED" in the console names nothing, and the
// difference between a dev-server blip and the app talking to the wrong host matters.
/**
 * Records WHICH request failed. A bare "ERR_CONNECTION_REFUSED" in the console names nothing, and the
 * difference between a dev-server blip and the app talking to the wrong host matters.
 *
 * `/auth/v1/logout` is excluded because supabase-js fires it and discards the response once it has
 * cleared the local session, which Chromium reports as ERR_ABORTED. Verified with probe-signout.mjs that
 * the logout still takes effect server-side: reusing the refresh token afterwards returns
 * `400 Invalid Refresh Token: Refresh Token Not Found`. So the session really is revoked and this is
 * noise, not a missed request.
 */
page.on('requestfailed', req => {
  if (/\/auth\/v1\/logout/.test(req.url())) return;
  errors.push(`requestfailed: ${req.failure()?.errorText} ${req.url().slice(0, 110)}`);
});

const T = 2600;
const balance = () => page.evaluate(() => {
  const el = document.querySelector('.header .gold-amount');
  return el ? Number(el.textContent.replace(/[^0-9.]/g, '')) : null;
});
const dismissSplash = async () => {
  const b = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
  if (await b.count()) { await b.click(); await page.waitForTimeout(700); }
};
const buyPacks = async n => {
  await dismissSplash();
  for (let i = 0; i < n; i++) {
    await page.locator('.shelf-pack__grab.shop-pack-card--iron').first().click();
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(T);
};
const row = i => page.locator('.slots__item').nth(i - 1);
const rowText = async i => (await row(i).textContent()).replace(/\s+/g, ' ').trim();
const playOffline = async () => { await page.locator('.gate__offline').click(); await page.waitForTimeout(1600); };
/** Creates a save in an empty slot: reveal the choice, then pick a mode. */
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

// ── 1. Login page, then offline ──────────────────────────────────────────────
check('the login page is shown first', await page.locator('.gate__tab').count() === 2);
check('the game has not mounted behind it', await page.locator('.app').count() === 0);
await playOffline();
check('offline goes to the slot picker', await page.locator('.slots__list').count() === 1);
check('three slots are shown', await page.locator('.slots__item').count() === 3);
check('all three start empty', await page.locator('.slots__new').count() === 3);
check('the picker says it is offline', /offline/i.test(await page.locator('.slots__account').textContent()));

// ── 2. An SSF save in slot 1 → balance 20 ───────────────────────────────────
await createIn(1, 'SSF');
check('creating an SSF save mounts the game', await page.locator('.app').count() === 1);
check('a new SSF save starts at 25', await balance() === 25, `balance=${await balance()}`);
await buyPacks(1);
check('SSF slot 1 is now at 20', await balance() === 20, `balance=${await balance()}`);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await playOffline();
check('slot 1 now shows an SSF badge', /SSF/.test(await rowText(1)), await rowText(1));
check('slot 1 shows its balance in the summary', /20\.00 gold/.test(await rowText(1)), await rowText(1));
check('slots 2 and 3 are still empty', await page.locator('.slots__new').count() === 2);

// ── 3. A second, independent SSF save in slot 3 → balance 25 ────────────────
await createIn(3, 'SSF');
check('a second SSF save starts fresh, not from slot 1',
  await balance() === 25, `balance=${await balance()} (slot 1 had 20)`);
const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('tcg-sim')).sort());
check('the two SSF saves use separate local keys',
  keys.includes('tcg-sim') && keys.includes('tcg-sim:slot:3'), keys.join(', '));

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await playOffline();
check('both SSF saves are listed', (await page.locator('.slots__badge--ssf').count()) === 2);

// Deleting frees the slot, and asks first.
await row(3).locator('.slots__btn', { hasText: 'Delete' }).click();
await page.waitForTimeout(300);
check('deleting asks for confirmation first', await row(3).locator('.slots__confirm-text').count() === 1);
await row(3).locator('.slots__btn--danger').click();
await page.waitForTimeout(1500);
check('the deleted slot is empty again', await row(3).locator('.slots__new').count() === 1);
check('slot 1 survived the deletion', /SSF/.test(await rowText(1)), await rowText(1));

// ── 4. Create an account ────────────────────────────────────────────────────
const stamp = Date.now();
const email = `slotui-${stamp}@example.test`;
const name = `Mouminx${stamp % 100000}`;
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.locator('.gate__tab', { hasText: 'Create Account' }).click();
await page.waitForTimeout(200);
await page.locator('.gate__input[type="text"]').fill(name);
await page.waitForTimeout(1400); // debounced availability check
check('a free player name reports as available',
  /available/i.test(await page.locator('.gate__name-state').first().textContent()),
  await page.locator('.gate__name-state').first().textContent());
await page.locator('.gate__input[type="email"]').fill(email);
await page.locator('.gate__input[type="password"]').fill('a-good-long-password');
await page.locator('.gate__submit').click();
await page.waitForTimeout(5000);

check('sign-up lands on the slot picker', await page.locator('.slots__list').count() === 1,
  (await page.locator('.gate__error').textContent().catch(() => '')) || '');
check('the picker names the signed-in player',
  (await page.locator('.slots__account').textContent()).includes(name),
  await page.locator('.slots__account').textContent());
check('the local SSF save is still listed while signed in', /SSF/.test(await rowText(1)), await rowText(1));

// ── 5. An online save in slot 2 → balance 15 ────────────────────────────────
await createIn(2, 'Cloud');
check('creating an online save mounts the game', await page.locator('.app').count() === 1);
check('a new online save starts at 25', await balance() === 25, `balance=${await balance()}`);
await buyPacks(2);
check('online slot 2 is now at 15', await balance() === 15, `balance=${await balance()}`);

const dbRows = () => {
  const c = execFileSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' })
    .split('\n').find(n => n.startsWith('supabase_db'));
  return execFileSync('docker', ['exec', '-i', c, 'psql', '-U', 'postgres', '-d', 'postgres', '-qAt', '-c',
    `select slot||':'||(data->>'balance') from public.saves
     where user_id = (select id from auth.users where email = '${email}') order by slot;`],
    { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
};
check('Postgres holds exactly one row, slot 2, balance 15',
  JSON.stringify(dbRows()) === JSON.stringify(['2:15']), dbRows().join(' '));

// ── 6. Both saves coexist and load independently ────────────────────────────
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(4500);
check('a reload skips the login page (session persisted)', await page.locator('.gate__tab').count() === 0);
check('slot 1 is SSF and slot 2 is Cloud',
  /SSF/.test(await rowText(1)) && /Cloud/.test(await rowText(2)),
  `${await rowText(1)} || ${await rowText(2)}`);

await row(1).locator('.slots__btn', { hasText: 'Play' }).click();
await page.waitForTimeout(3200);
check('playing the SSF slot loads the LOCAL save (20)', await balance() === 20, `balance=${await balance()}`);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(4500);
await row(2).locator('.slots__btn', { hasText: 'Play' }).click();
await page.waitForTimeout(3500);
check('playing the online slot loads the ACCOUNT save (15)', await balance() === 15, `balance=${await balance()}`);

// ── 7. Slot collision: the server claims position 1, the local save relocates ──
const forced = await page.evaluate(async () => {
  const acc = await import('/src/game/account.js');
  const c = await acc.getClient();
  const { error } = await c.rpc('save_game', {
    p_slot: 1, p_data: { version: 23, balance: 999 }, p_save_version: 23, p_revision: 0,
    p_meta: { balance: 999, cards: 0 },
  });
  return error?.message ?? 'ok';
});
check('an online save was forced into position 1 (which the SSF save occupies)', forced === 'ok', forced);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
check('position 1 is now the CLOUD save', /Cloud/.test(await rowText(1)), await rowText(1));
check('the local SSF save moved to position 3', /SSF/.test(await rowText(3)), await rowText(3));
check('nothing was lost — three saves in three positions',
  await page.locator('.slots__badge').count() === 3, `${await page.locator('.slots__badge').count()} badges`);
check('no overflow warning, because a position was free',
  await page.locator('.slots__overflow').count() === 0);

await row(3).locator('.slots__btn', { hasText: 'Play' }).click();
await page.waitForTimeout(3200);
check('the relocated SSF save still has its own data (20)', await balance() === 20, `balance=${await balance()}`);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
await row(1).locator('.slots__btn', { hasText: 'Play' }).click();
await page.waitForTimeout(3500);
check('the forced online save in position 1 loads its own data (999)',
  await balance() === 999, `balance=${await balance()}`);

check('zero console errors across every success path', errors.length === 0, errors.slice(0, 3).join(' | '));
const errorsBefore = errors.length;

// ── 8. Sign out, and the taken name is refused ──────────────────────────────
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
await page.locator('.gate__offline', { hasText: /Sign Out/i }).click();
await page.waitForTimeout(2500);
check('signing out returns to the login page', await page.locator('.gate__tab').count() === 2);

await page.locator('.gate__tab', { hasText: 'Create Account' }).click();
await page.waitForTimeout(200);
await page.locator('.gate__input[type="text"]').fill(name);
await page.waitForTimeout(1500);
check('a taken player name reports as taken',
  /taken/i.test(await page.locator('.gate__name-state').first().textContent()),
  await page.locator('.gate__name-state').first().textContent());

await page.locator('.gate__input[type="email"]').fill(`other-${stamp}@example.test`);
await page.locator('.gate__input[type="password"]').fill('another-good-password');
await page.locator('.gate__submit').click();
await page.waitForTimeout(1200);
check('submitting a taken name is refused with a clear message',
  /already taken/i.test(await page.locator('.gate__error').textContent()),
  await page.locator('.gate__error').textContent());
check('the game did not mount', await page.locator('.app').count() === 0);

// Signed out, the local SSF save is still reachable.
await playOffline();
check('offline still lists the SSF save after signing out',
  (await page.locator('.slots__badge--ssf').count()) === 1,
  `${await page.locator('.slots__badge--ssf').count()} ssf badges`);
check('the cloud saves are hidden while signed out',
  (await page.locator('.slots__badge--online').count()) === 0);

const newErrors = errors.slice(errorsBefore);
check('the only new console errors are the deliberate failed sign-up',
  newErrors.every(e => /400 \(Bad Request\)|already taken/i.test(e)),
  `${newErrors.length} new: ${newErrors.slice(0, 3).join(' | ')}`);

await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILURES:');
  failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
  process.exit(1);
}
