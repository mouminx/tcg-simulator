/**
 * The shop's Upgrades shelf.
 *
 * The thing worth testing here is not that a button renders — it is that the money moves exactly once and
 * only through the existing handler, that the shelf cannot offer an upgrade that is already maxed, and that
 * the ORIGINAL controls in the Hand rail and the Mine still work. A second route to a purchase is how you
 * end up with two code paths that disagree about the price.
 */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';
const results=[]; const check=(n,p,d='')=>{results.push({n,p,d});console.log(`${p?'PASS':'FAIL'}  ${n}${d?`  — ${d}`:''}`);};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1512,height:982} });
const errors=[];
page.on('console',m=>{if(m.type()==='error'&&!/WebGL|THREE|GPU/i.test(m.text()))errors.push(m.text());});
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));

const readBalance = () => page.evaluate(()=>{
  const el=document.querySelector('.gold-display, .header .gold-amount');
  return el?parseFloat(el.textContent.replace(/[^0-9.]/g,'')):null;
});

async function boot(mutate={}) {
  // Settle past SAVE_DEBOUNCE_MS (2s) BEFORE writing. The app flushes its own state on `pagehide`, so a
  // seed written while the save is still dirty gets overwritten by that flush during the reload — which
  // looked exactly like the shelf ignoring an unaffordable balance.
  await page.waitForTimeout(2600);
  await page.evaluate(m=>{const v=JSON.parse(localStorage.getItem('tcg-sim'));Object.assign(v,m);localStorage.setItem('tcg-sim',JSON.stringify(v));}, mutate);
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2200); await enterGame(page);
  const sp=page.locator('.splash button',{hasText:/^(Enter|Resume)$/}).first();
  if (await sp.count()){await sp.click();await page.waitForTimeout(700);}
  if (await page.locator('.inventory-panel--open').count()){await page.locator('.drawer-tab.inventory-toggle').click();await page.waitForTimeout(400);}
}
const openUpgrades = async () => {
  await page.locator('.tab-bar button',{hasText:'Cards'}).first().click(); await page.waitForTimeout(500);
  await page.locator('.shop-category', {hasText:'Upgrades'}).click(); await page.waitForTimeout(400);
};

await page.goto('http://localhost:5199/',{waitUntil:'networkidle'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2200); await enterGame(page);

// Fresh save: hand 3/6 (buyable at 20), mine 4/4 (already maxed by DEFAULT_MINE_SLOT_CAPACITY).
await boot({ balance: 1000, pocketCapacity: 3, mineSlotCapacity: 4, graphicsSettings:{quality:'low'} });
await openUpgrades();

const rows = () => page.evaluate(()=>[...document.querySelectorAll('.upgrade-item')].map(li=>({
  level: li.querySelector('.upgrade-item__level')?.textContent.replace(/\s+/g,''),
  label: li.querySelector('.goods-item__label')?.textContent,
  price: li.querySelector('.goods-item__buy')?.textContent.replace(/[^0-9.]/g,'') ?? null,
  maxed: li.className.includes('upgrade-item--maxed'),
  disabled: li.querySelector('.goods-item__buy')?.disabled ?? null,
})));

let r = await rows();
// Hand Slot only. Mine Slot was pulled — DEFAULT_MINE_SLOT_CAPACITY equals MAX_MINE_SLOT_CAPACITY, so it
// read "Maxed" for every player, and mine slots are being reworked.
check('the shelf lists the hand slot upgrade only', r.length===1, JSON.stringify(r.map(x=>x.label)));
check('Mine Slot is no longer offered', !r.some(x=>/Mine/i.test(x.label ?? '')), JSON.stringify(r.map(x=>x.label)));
check('the hand slot shows current -> next and its price', r[0].level==='3→4' && Number(r[0].price)===20,
  `${r[0].level} @ ${r[0].price}`);
const railCount = await page.evaluate(()=>[...document.querySelectorAll('.shop-category')]
  .find(b=>/Upgrades/.test(b.textContent))?.querySelector('.shop-category__count')?.textContent);
check('the rail count matches what is purchasable', railCount==='1', `count=${railCount}`);

// ── Buying it moves exactly the listed price, once ──
const before = await readBalance();
await page.locator('.upgrade-item .goods-item__buy').first().click();
await page.waitForTimeout(700);
const after = await readBalance();
check('buying charges exactly the tagged price', Math.abs((before-after)-20)<0.005, `${before} -> ${after}`);
r = await rows();
check('the hand capacity advanced and the next price is showing', r[0].level==='4→5' && Number(r[0].price)===45,
  `${r[0].level} @ ${r[0].price}`);
const handRail = await page.evaluate(()=>document.querySelector('.hand__rail-count, .hand__count')?.textContent
  ?? [...document.querySelectorAll('*')].map(e=>e.textContent).find(t=>/^\s*\d\/\d\s*$/.test(t||'')));
check('the Hand rail reflects the new capacity', /\/\s*4/.test(handRail??''), `rail="${(handRail??'').trim()}"`);

// ── Affordability is enforced, not just styled ──
await boot({ balance: 5, pocketCapacity: 3 });
await openUpgrades();
r = await rows();
check('an unaffordable upgrade is disabled', r[0].disabled===true, `disabled=${r[0].disabled}`);
const poor = await readBalance();
await page.locator('.upgrade-item .goods-item__buy').first().click({ force: true }).catch(()=>{});
await page.waitForTimeout(500);
check('...and clicking it anyway charges nothing', Math.abs((await readBalance())-poor)<0.005, `${poor} -> ${await readBalance()}`);

// ── Everything maxed ──
await boot({ balance: 1000, pocketCapacity: 6 });
await openUpgrades();
r = await rows();
check('with everything maxed, the row says Maxed and nothing is buyable',
  r.length===1 && r.every(x=>x.maxed && x.price===null), JSON.stringify(r));

// ── The ORIGINAL control still works ──
await boot({ balance: 1000, pocketCapacity: 3 });
const handBtn = page.locator('.hand__buy-slot, .hand__rail button').first();
if (await handBtn.count()) {
  const b4 = await readBalance();
  await handBtn.click(); await page.waitForTimeout(700);
  const b5 = await readBalance();
  check('the original Hand-rail buy button still charges the same 20',
    Math.abs((b4-b5)-20)<0.005, `${b4} -> ${b5}`);
} else {
  check('the original Hand-rail buy button is still present', false, 'not found');
}

check('no console errors', errors.length===0, errors.slice(0,3).join(' | '));
await browser.close();
const failed=results.filter(r=>!r.p);
console.log(`\n${results.length-failed.length}/${results.length} passed`);
if (failed.length){console.log('FAILURES:');failed.forEach(f=>console.log(`  - ${f.n}: ${f.d}`));process.exit(1);}
