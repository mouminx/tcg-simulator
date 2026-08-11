/**
 * The merged Cards page.
 *
 * The layout is measured elsewhere; this checks the things a merge can break that a screenshot cannot:
 * that Summon is gone as a tab but everything it did still works, that a purchase flies to the altar
 * rather than at a tab that no longer exists, that a reveal takes the whole page, and that the pack
 * diamond moved to the Cards tab with its semantics intact.
 */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';
const results=[]; const check=(n,p,d='')=>{results.push({n,p,d});console.log(`${p?'PASS':'FAIL'}  ${n}${d?`  — ${d}`:''}`);};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1512,height:982} });
const errors=[];
page.on('console',m=>{if(m.type()==='error'&&!/WebGL|THREE|GPU/i.test(m.text()))errors.push(m.text());});
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));

async function boot(mutate={}) {
  await page.evaluate(m=>{const v=JSON.parse(localStorage.getItem('tcg-sim'));Object.assign(v,m);localStorage.setItem('tcg-sim',JSON.stringify(v));}, mutate);
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2200); await enterGame(page);
  const sp=page.locator('.splash button',{hasText:/^(Enter|Resume)$/}).first();
  if (await sp.count()){await sp.click();await page.waitForTimeout(700);}
  if (await page.locator('.inventory-panel--open').count()){await page.locator('.drawer-tab.inventory-toggle').click();await page.waitForTimeout(400);}
}

await page.goto('http://localhost:5199/',{waitUntil:'networkidle'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2200); await enterGame(page);
await boot({ balance: 5000, packs: [], graphicsSettings:{quality:'high'} });

// ── The tab is gone, the page carries both halves ──
const tabs = await page.evaluate(()=>[...document.querySelectorAll('.tab-bar button')].map(b=>b.textContent.replace(/\s+/g,' ').trim()));
check('there is no Summon tab', !tabs.some(t=>/Summon/i.test(t)), tabs.join(' / '));
check('there are 8 tabs (was 9)', tabs.length===8, `${tabs.length}`);
check('no tab label contains a digit', !tabs.some(t=>/\d/.test(t)), tabs.filter(t=>/\d/.test(t)).join(',') || 'none');
check('the Cards page shows the shop AND the altar',
  (await page.locator('.shop-summon__shop .shop').count())===1 && (await page.locator('.shop-summon__altar .unpack-page').count())===1);

// ── A purchase flies to the altar, not at a vanished tab ──
// Read the RENDERED balance, not localStorage: the save is debounced 2s, so localStorage lags the
// state by up to that long and a read right after a click reports the old number.
const readBalance = () => page.evaluate(()=>{
  const el=document.querySelector('.gold-display, .header .gold-amount');
  return el ? parseFloat(el.textContent.replace(/[^0-9.]/g,'')) : null;
});
const before = await readBalance();
await page.locator('.shelf-pack__grab').first().click();
// Sampled late in the flight, not at the start: at 120ms the pack has barely left the shelf, so
// "is it near the fan" is meaningless there.
await page.waitForTimeout(520);
const fly = await page.evaluate(()=>{
  const f=document.querySelector('.flying-pack');
  const fan=document.querySelector('.shop-summon__altar .unpack-pack-row');
  if(!f||!fan) return { flying: !!f, fan: !!fan };
  const fb=f.getBoundingClientRect(), nb=fan.getBoundingClientRect();
  return { flying:true, fan:true,
    // The flight ENDS at the fan, so the target must be inside the fan's box horizontally.
    endsInFan: fb.left+fb.width/2 > nb.left-40 && fb.left+fb.width/2 < nb.right+40,
    fanX: Math.round(nb.left+nb.width/2) };
});
check('buying a pack flies a pack toward the altar fan, not at a vanished tab',
  fly.flying && fly.fan && fly.endsInFan, JSON.stringify(fly));
await page.waitForTimeout(1200);
const after = await readBalance();
check('the purchase was charged', after < before, `${before} -> ${after}`);
check('the pack landed in the fan', (await page.locator('.unpack-pack-item').count())>=1,
  `${await page.locator('.unpack-pack-item').count()} in fan`);

// ── The Cards tab carries the pack diamond ──
const diamond = await page.evaluate(()=>{
  const tab=[...document.querySelectorAll('.tab-bar button')].find(b=>/Cards/.test(b.textContent));
  const bar=tab?.parentElement;
  const centre = tab.offsetLeft-(bar?.scrollLeft??0)+tab.offsetWidth/2;
  const d=[...document.querySelectorAll('.tab-loot')].find(el=>Math.abs(parseFloat(el.style.left)-centre)<2);
  return { present: !!d };
});
check('holding a pack puts a diamond on the Cards tab', diamond.present);

// ── A reveal takes the whole page ──
// The packs are a stacked line, so a pack's centre sits under its neighbour until hover lifts it.
await page.locator('.unpack-pack-item').first().hover({ position: { x: 18, y: 60 } });
await page.waitForTimeout(350);
await page.locator('.unpack-pack-item').first().click({ position: { x: 18, y: 60 } });
await page.waitForTimeout(900);
const staged = await page.evaluate(()=>({
  confirm: !!document.querySelector('.summon-field--active, .summon-confirm-btn, .summon-btn'),
}));
// Confirm/summon to get into the reveal.
for (const rx of [/^Summon$/i, /^Open/i, /Confirm/i]) {
  const b = page.locator('.shop-summon__altar button', { hasText: rx }).first();
  if (await b.count()) { await b.click(); break; }
}
await page.waitForTimeout(1400);
const reveal = await page.evaluate(()=>{
  const g=document.querySelector('.shop-summon');
  const shop=document.querySelector('.shop-summon__shop');
  const cs = shop ? getComputedStyle(shop) : null;
  return {
    opening: g?.className.includes('shop-summon--opening') ?? false,
    shopVisible: shop ? cs.display !== 'none' : null,
    shopDisplay: cs?cs.display:null,
    shopOpacity: cs?cs.opacity:null,
    shopPointer: cs?cs.pointerEvents:null,
    shopWidth: shop?Math.round(shop.getBoundingClientRect().width):null,
    cols: g?getComputedStyle(g).gridTemplateColumns:null,
    hasOpening: !!document.querySelector('.pack-opening'),
  };
});
check('a reveal puts the page in the opening state', reveal.opening || reveal.hasOpening, JSON.stringify(reveal));
if (reveal.opening) {
  // IN PLACE now. The shop column keeps its box and stays faintly visible; it is dimmed and locked, not
  // removed, and the grid does not re-proportion — a layout that jumps when the payoff starts is worse
  // than one that is merely narrow.
  check('...and the shop column is still laid out (reveal happens in place)',
    reveal.shopVisible !== false && reveal.shopWidth > 0, `display=${reveal.shopDisplay} w=${reveal.shopWidth}`);
  check('...dimmed and click-locked rather than hidden',
    Number(reveal.shopOpacity) < 0.5 && reveal.shopPointer === 'none',
    `opacity=${reveal.shopOpacity} pointer-events=${reveal.shopPointer}`);
  check('...and the grid still has two columns', /\s/.test(reveal.cols.trim()), reveal.cols);
}

check('no console errors', errors.length===0, errors.slice(0,3).join(' | '));
await browser.close();
const failed=results.filter(r=>!r.p);
console.log(`\n${results.length-failed.length}/${results.length} passed`);
if (failed.length){console.log('FAILURES:');failed.forEach(f=>console.log(`  - ${f.n}: ${f.d}`));process.exit(1);}
