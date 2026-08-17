/**
 * The joint Cards page after the second pass: in-place opening, the stacked pack line, the two centred
 * headings, and the 10-pack cap.
 *
 * The interesting checks are the ones a screenshot cannot make: that the stack FITS at every count without
 * scrolling (the whole reason the overlap is computed rather than fixed), that a hovered pack becomes fully
 * clickable rather than just fully painted, and that the cap is enforced where the gold moves.
 */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';
const results=[]; const check=(n,p,d='')=>{results.push({n,p,d});console.log(`${p?'PASS':'FAIL'}  ${n}${d?`  — ${d}`:''}`);};
const browser = await chromium.launch();
const errors=[];

const readBalance = page => page.evaluate(()=>{
  const el=document.querySelector('.gold-display, .header .gold-amount');
  return el?parseFloat(el.textContent.replace(/[^0-9.]/g,'')):null;
});
const mkPacks = n => Array.from({length:n},(_,i)=>({id:`p${i}`,packTypeId:['iron','dusk','arcane','void','primordial'][i%5]}));

async function boot(page, mutate={}) {
  await page.waitForTimeout(2600);   // past SAVE_DEBOUNCE_MS, or the pagehide flush overwrites the seed
  await page.evaluate(m=>{const v=JSON.parse(localStorage.getItem('tcg-sim'));Object.assign(v,m);localStorage.setItem('tcg-sim',JSON.stringify(v));}, mutate);
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2400); await enterGame(page);
  const sp=page.locator('.splash button',{hasText:/^(Enter|Resume)$/}).first();
  if (await sp.count()){await sp.click();await page.waitForTimeout(700);}
  if (await page.locator('.inventory-panel--open').count()){await page.locator('.drawer-tab.inventory-toggle').click();await page.waitForTimeout(400);}
}

const page = await browser.newPage({ viewport:{width:1366,height:768} });
page.on('console',m=>{if(m.type()==='error'&&!/WebGL|THREE|GPU/i.test(m.text()))errors.push(m.text());});
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
await page.goto('http://localhost:5199/',{waitUntil:'networkidle'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2400); await enterGame(page);
await page.waitForFunction(()=>!!localStorage.getItem('tcg-sim'),null,{timeout:15000});

// ── Two matching composed header bands ──
await boot(page, { balance: 5000, packs: mkPacks(3), graphicsSettings:{quality:'low'} });
const heads = await page.evaluate(()=>[...document.querySelectorAll('.shop-summon h2')].map(h=>{
  const b=h.getBoundingClientRect();
  return { text:h.textContent.trim(), x:Math.round(b.left+b.width/2), y:Math.round(b.top+b.height/2) };
}));
check('both halves are titled', heads.map(h=>h.text).join('+') === 'Shop+Summon', JSON.stringify(heads.map(h=>h.text)));
check('SHOP and SUMMON share one title baseline', Math.abs(heads[0].y-heads[1].y)<=1, JSON.stringify(heads));
const topBand = await page.evaluate(()=>{
  const shop=document.querySelector('.shop-topbar').getBoundingClientRect();
  const summon=document.querySelector('.unpack-topbar').getBoundingClientRect();
  const groups=document.querySelector('.unpack-groups').getBoundingClientRect();
  const title=document.querySelector('.unpack-header').getBoundingClientRect();
  const packItems=[...document.querySelectorAll('.unpack-pack-item')].map(item=>item.getBoundingClientRect());
  const firstPackLeft=packItems.length ? Math.min(...packItems.map(item=>item.left)) : Infinity;
  return {bottomOffset:Math.abs(shop.bottom-summon.bottom), ordered:groups.right<title.left && firstPackLeft>title.right};
});
check('Shop and Summon top bands end on the same line', topBand.bottomOffset<=1, `${topBand.bottomOffset}px`);
check('Summon navigation, title, and packs occupy left/centre/right zones', topBand.ordered, JSON.stringify(topBand));

// ── The stack fits at every count, with no scrolling ──
const rowMetrics = () => page.evaluate(()=>{
  const row=document.querySelector('.unpack-pack-row--line');
  const items=[...document.querySelectorAll('.unpack-pack-item')];
  return { display:getComputedStyle(row).display, count:items.length,
    scroll: row.scrollWidth-row.clientWidth,
    gaps: getComputedStyle(row).getPropertyValue('--pack-gaps').trim(),
    absolutePositioned: items.filter(i=>getComputedStyle(i).position==='absolute').length,
    lefts: items.map(i=>Math.round(i.getBoundingClientRect().left)) };
});
for (const n of [1,3,6,10]) {
  await boot(page, { balance: 5000, packs: mkPacks(n) });
  const m = await rowMetrics();
  check(`${n} pack${n===1?'':'s'}: laid out as a horizontal line, not an arc`,
    m.display==='flex' && m.absolutePositioned===0 && m.count===n,
    `display=${m.display} absolute=${m.absolutePositioned} count=${m.count}`);
  check(`${n} pack${n===1?'':'s'}: the whole stack fits without scrolling`, m.scroll<=2, `scroll=${m.scroll}px`);
  if (n>1) {
    // Strictly increasing lefts is what "horizontal line" means, and it also proves the overlap is not so
    // large that packs land on top of each other.
    const ascending = m.lefts.every((v,i)=>i===0||v>m.lefts[i-1]);
    check(`${n} packs: each sits to the right of the last`, ascending, m.lefts.join(','));
  }
}

// ── A hovered pack must become fully CLICKABLE, not just fully painted ──
await boot(page, { balance: 5000, packs: mkPacks(6) });
await page.locator('.unpack-pack-item').first().hover({ position: { x: 18, y: 60 } });
await page.waitForTimeout(400);
const hitTest = await page.evaluate(()=>{
  const first=document.querySelector('.unpack-pack-item');
  const b=first.getBoundingClientRect();
  const mid=document.elementFromPoint(Math.round(b.left+b.width/2), Math.round(b.top+b.height/2));
  return { ownsItsMiddle: first.contains(mid), got: mid?.className?.toString().slice(0,40) };
});
check('a hovered pack owns its own middle (no dead centre under a neighbour)',
  hitTest.ownsItsMiddle, `elementFromPoint -> ${hitTest.got}`);

// ── Opening happens IN PLACE ──
await page.locator('.unpack-pack-item').first().click({ position: { x: 18, y: 60 } });
await page.waitForTimeout(800);
for (const rx of [/^Summon$/i,/^Open/i,/Confirm/i]) {
  const b=page.locator('.shop-summon__altar button',{hasText:rx}).first();
  if (await b.count()) { await b.click(); break; }
}
await page.waitForTimeout(1500);
const inPlace = await page.evaluate(()=>{
  const shop=document.querySelector('.shop-summon__shop');
  const altar=document.querySelector('.shop-summon__altar');
  const po=document.querySelector('.pack-opening');
  const cs=getComputedStyle(shop);
  const hdr=document.querySelector('.unpack-header');
  return {
    revealPresent: !!po,
    revealInsideAltar: !!(po && altar.contains(po)),
    shopDisplay: cs.display, shopOpacity: Number(cs.opacity), shopPointer: cs.pointerEvents,
    shopWidth: Math.round(shop.getBoundingClientRect().width),
    // The heading must look EXACTLY like the shop's: no background of its own. It briefly had a sticky
    // position with a dark gradient behind it (to survive the altar scrolling during a reveal), and that
    // gradient was a dark band under one heading and not the other.
    headerBg: hdr ? getComputedStyle(hdr).backgroundImage : null,
    headerBgColor: hdr ? getComputedStyle(hdr).backgroundColor : null,
    shopHeaderBg: (()=>{const h=document.querySelector('.shop .shop-header');
      return h?getComputedStyle(h).backgroundImage:null;})(),
    overflowX: document.documentElement.scrollWidth-document.documentElement.clientWidth,
  };
});
check('the reveal renders INSIDE the altar column, not as a separate screen',
  inPlace.revealPresent && inPlace.revealInsideAltar, JSON.stringify(inPlace));
check('the shop column keeps its box during the reveal',
  inPlace.shopDisplay!=='none' && inPlace.shopWidth>0, `display=${inPlace.shopDisplay} w=${inPlace.shopWidth}`);
check('...dimmed and click-locked rather than removed',
  inPlace.shopOpacity<0.5 && inPlace.shopPointer==='none', `opacity=${inPlace.shopOpacity} pe=${inPlace.shopPointer}`);
check('the SUMMON heading has no background of its own, same as SHOP',
  inPlace.headerBg==='none' && inPlace.headerBg===inPlace.shopHeaderBg
    && /rgba\(0, 0, 0, 0\)|transparent/.test(inPlace.headerBgColor),
  JSON.stringify({summon:inPlace.headerBg, shop:inPlace.shopHeaderBg, color:inPlace.headerBgColor}));
check('no horizontal page overflow during a reveal', inPlace.overflowX===0, `${inPlace.overflowX}px`);

// ── The 10-pack cap ──
await boot(page, { balance: 5000, packs: mkPacks(10) });
await page.locator('.shop-category',{hasText:'Card Packs'}).click(); await page.waitForTimeout(300);
const capped = await page.evaluate(()=>({
  buysDisabled: [...document.querySelectorAll('.shelf-pack__grab')].every(b=>b.disabled),
  headerLines: [...document.querySelector('.shop-summon__shop > .shop .shop-topbar > .shop-header').children]
    .map(node=>node.textContent.trim()),
}));
check('at 10 packs every buy button is disabled', capped.buysDisabled, `${capped.buysDisabled}`);
check('the compact shop header gains no extra cap warning line', capped.headerLines.length===3,
  capped.headerLines.join(' | '));
const b4 = await readBalance(page);
await page.locator('.shelf-pack__grab').first().click({ force: true }).catch(()=>{});
await page.waitForTimeout(600);
check('forcing a buy at the cap charges nothing', Math.abs((await readBalance(page))-b4)<0.005, `${b4} -> ${await readBalance(page)}`);
check('...and no 11th pack appeared', (await page.locator('.unpack-pack-item').count())===10,
  `${await page.locator('.unpack-pack-item').count()}`);

// ── Goods are resource cards ──
await boot(page, { balance: 5000, packs: [] });
await page.locator('.shop-category',{hasText:'Goods'}).click(); await page.waitForTimeout(500);
const goods = await page.evaluate(()=>{
  const cards=[...document.querySelectorAll('.goods-card')];
  const grid=document.querySelector('.goods-grid');
  const cols=getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  return { count:cards.length, withArt:cards.filter(c=>c.querySelector('img')).length, cols,
    noArt: cards.filter(c=>!c.querySelector('img')).map(c=>c.querySelector('.goods-card__buy')?.getAttribute('aria-label')),
    qtyBadges: cards.filter(c=>c.querySelector('.foundry-square-resource__count')?.textContent?.trim() === '1').length };
});
check('16 rotating goods render as resource cards', goods.count===16, `${goods.count}`);
check('every good resolved its artwork', goods.withArt===16, `missing: ${goods.noArt.join(', ') || 'none'}`);
check('each card shows one unit for sale', goods.qtyBadges===16, `${goods.qtyBadges}/16`);
check('goods names are tooltip-only, not standing labels', await page.locator('.goods-card__label').count()===0,
  `${await page.locator('.goods-card__label').count()} labels`);
check('each price is an interactive overlay inside its loot card', await page.locator('.goods-card__tile .goods-card__buy').count()===16,
  `${await page.locator('.goods-card__tile .goods-card__buy').count()}/16 overlays`);
// The single-column collapse was the bug: `.shop-section` centres its flex children, shrink-wrapping the grid.
check('the grid lays out in multiple columns', goods.cols>=4, `${goods.cols} columns`);

check('no console errors', errors.length===0, errors.slice(0,3).join(' | '));
await browser.close();
const failed=results.filter(r=>!r.p);
console.log(`\n${results.length-failed.length}/${results.length} passed`);
if (failed.length){console.log('FAILURES:');failed.forEach(f=>console.log(`  - ${f.n}: ${f.d}`));process.exit(1);}
