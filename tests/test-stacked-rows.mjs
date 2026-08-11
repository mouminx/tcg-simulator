/**
 * Every stacked row: the pack-reveal card queue and the four production collection queues.
 *
 * The load-bearing property is that a row FITS however much it holds — that is the whole reason the overlap
 * is computed rather than fixed, and the reason these replaced wrapping grids. So most of this asserts
 * "no horizontal scroll at N items" and "the half scrolls less than it used to", not appearance.
 *
 * Note the two traps this caught, both of which made the fit silently fail while everything looked laid out:
 * a leftover flex `gap` (added on top of the solved step), and `.stack-line` losing to a same-specificity
 * `display: grid` defined later in the file.
 */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';
const results=[]; const check=(n,p,d='')=>{results.push({n,p,d});console.log(`${p?'PASS':'FAIL'}  ${n}${d?`  — ${d}`:''}`);};
const browser = await chromium.launch();
const errors=[];
const page = await browser.newPage({ viewport:{width:1366,height:768} });
page.on('console',m=>{if(m.type()==='error'&&!/WebGL|THREE|GPU/i.test(m.text()))errors.push(m.text());});
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));

async function boot(mutate={}) {
  await page.waitForTimeout(2600);
  await page.evaluate(m=>{const v=JSON.parse(localStorage.getItem('tcg-sim'));Object.assign(v,m);localStorage.setItem('tcg-sim',JSON.stringify(v));}, mutate);
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2400); await enterGame(page);
  const sp=page.locator('.splash button',{hasText:/^(Enter|Resume)$/}).first();
  if (await sp.count()){await sp.click();await page.waitForTimeout(700);}
  await closeBag();
}
async function closeBag() {
  if (await page.locator('.inventory-panel--open').count()) {
    await page.locator('.drawer-tab.inventory-toggle').click(); await page.waitForTimeout(400);
  }
}

await page.goto('http://localhost:5199/',{waitUntil:'networkidle'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2400); await enterGame(page);
await page.waitForFunction(()=>!!localStorage.getItem('tcg-sim'),null,{timeout:15000});

// ── The production collection queues ──
// Deliberately more entries than the old grid's 5 columns, so a wrapping layout would be several rows.
await boot({
  balance: 9000, packs: [], graphicsSettings:{quality:'low'},
  mineClaimQueue:{stone:12,coal:9,iron:7,silver:4,gold:3,platinum:2,starlit:1},
  mineRewardQueue:{coins:120,smoldering_mote:4,grounding_mote:3,jolting_mote:2},
  gatheringClaimQueue:{wood:9,hardwood:5,resin:4,fiber:7,hide:3,bone:2,mushrooms:6,honey:2,stone:4,coal:3},
  gatheringRewardQueue:{coins:80,blooming_mote:3,gusting_mote:2},
});

for (const [tab, sel, label] of [['Foundry','.foundry-half--mine','mine'],['Wilderness','.wilderness-half--gathering','gathering']]) {
  await page.locator('.tab-bar button',{hasText:tab}).first().click(); await page.waitForTimeout(900);
  await closeBag();
  const m = await page.evaluate(s=>{
    const half=document.querySelector(s);
    const q=half.querySelector('.foundry-queue-slots');
    const kids=[...q.children];
    const cs=getComputedStyle(q);
    return { display:cs.display, gap:cs.gap, tiles:kids.length,
      xscroll:q.scrollWidth-q.clientWidth,
      rowH:Math.round(q.getBoundingClientRect().height),
      halfScroll: half.scrollHeight-half.clientHeight,
      lefts: kids.map(k=>Math.round(k.getBoundingClientRect().left)),
      tops: [...new Set(kids.map(k=>Math.round(k.getBoundingClientRect().top)))],
      widths: [...new Set(kids.map(k=>Math.round(k.getBoundingClientRect().width)))] };
  }, sel);
  check(`${label}: the queue is a single stacked row, not a grid`,
    m.display==='flex' && m.tops.length===1, `display=${m.display} distinct tops=${m.tops.length}`);
  check(`${label}: ${m.tiles} tiles fit with no horizontal scroll`, m.xscroll<=2, `xscroll=${m.xscroll}px`);
  // The leftover grid `gap` was added on top of the solved step and overflowed the row by exactly 104px.
  check(`${label}: no leftover flex gap (it would break the fit)`, parseFloat(m.gap||'0')===0, `gap=${m.gap}`);
  check(`${label}: tiles ascend left to right`,
    m.lefts.every((v,i)=>i===0||v>m.lefts[i-1]), m.lefts.slice(0,5).join(','));
  check(`${label}: every tile is the same width`, m.widths.length===1, m.widths.join('/'));
  // Measure the QUEUE's own height, not the half's total scroll.
  // It used to assert the half scrolled less than a pre-stacking baseline, and that broke the moment the mine
  // and gathering slots were forced to 2x2 — a deliberate product decision that costs ~390px in these halves
  // and has nothing to do with the queue. Conflating the two made a passing change look like a regression.
  // The 5-column grid needed 308px for this many entries; one stacked row of inventory-sized tiles is 72px.
  check(`${label}: the queue is ONE tile tall (${m.rowH}px), not the 308px a 5-column grid needed`,
    m.rowH <= 90, `${m.rowH}px`);
  console.log(`      (half scroll ${m.halfScroll}px — dominated by the forced 2x2 slots, not the queue)`);

  // A large z-index does not escape an overflow-clipping station panel. Collection visuals therefore have
  // to leave the station's DOM subtree altogether. Assert the actual paint-layer contract while the flight
  // is alive, then let it finish before moving to the next station.
  const collect = page.locator(`${sel} .foundry-collect-btn`, { hasText:'Collect' }).first();
  await collect.click(); await page.waitForTimeout(35);
  const flight = await page.evaluate(()=>{
    const ghosts=[...document.querySelectorAll('body > .loot-flight-ghost')];
    return { count:ghosts.length,
      allDirectBody:ghosts.every(g=>g.parentElement===document.body),
      allFixed:ghosts.every(g=>getComputedStyle(g).position==='fixed'),
      minZ:Math.min(...ghosts.map(g=>Number(getComputedStyle(g).zIndex)||0)),
      destinationsInsideViewport:ghosts.every(g=>{
        const end=new DOMMatrix(g.style.transform);
        // Use the declared start box. getBoundingClientRect() is already part-way through the transition,
        // and adding the full destination delta to it would count that movement twice.
        const x=parseFloat(g.style.left)+parseFloat(g.style.width)/2+end.e;
        return x>=0 && x<=window.innerWidth;
      }),
      sourcesHidden:[...document.querySelectorAll('.foundry-queue-slots > *')]
        .some(el=>getComputedStyle(el).visibility==='hidden') };
  });
  check(`${label}: collected loot flies in the viewport layer, outside the clipped station panel`,
    flight.count>0 && flight.allDirectBody && flight.allFixed && flight.minZ>9998 && flight.destinationsInsideViewport,
    JSON.stringify(flight));
  check(`${label}: its source stays hidden in flow while the clone flies`, flight.sourcesHidden,
    `hidden=${flight.sourcesHidden}`);
  await page.waitForTimeout(1100);
}

// ── The collection queue must be ON SCREEN, and the card must not shrink to achieve it ──
// This is the pairing that matters. The slot's `aspect-ratio: 1` used to make its HEIGHT follow its width, so
// a wider display got taller slots and the queue stayed below the fold on every monitor. Removing it works —
// but the tempting way to buy height is to shrink the card, which has been explicitly rejected. So assert
// both: queue visible at 1512x982, AND the card still at its `--station-card-w`-derived size.
{
  const wide = await browser.newPage({ viewport:{width:1512,height:982} });
  await wide.goto('http://localhost:5199/',{waitUntil:'networkidle'});
  await wide.evaluate(()=>localStorage.clear());
  await wide.reload({waitUntil:'networkidle'}); await wide.waitForTimeout(2400); await enterGame(wide);
  await wide.waitForFunction(()=>!!localStorage.getItem('tcg-sim'),null,{timeout:20000});
  await wide.waitForTimeout(2600);
  await wide.evaluate(()=>{const v=JSON.parse(localStorage.getItem('tcg-sim'));
    v.balance=900; v.graphicsSettings={quality:'low'};
    const c=['a','b','c','d'].map((k,i)=>({id:`mm-${k}`,name:`Miner ${k}`,classType:'miner',artVariant:i,rarity:'rare',tier:2,tag:null,value:40,affixes:[{name:'Mining Efficiency',value:14,higher:false}]}));
    v.collection=c; v.pocket=c; v.pocketCapacity=6;
    v.mineSlots=(v.mineSlots||[]).map((s,i)=>({...s,card:c[i]??null,startedAt:c[i]?Date.now()-20000:null,endsAt:c[i]?Date.now()+40000:null}));
    v.mineClaimQueue={stone:12,coal:9,iron:7,silver:4,gold:3};
    v.mineRewardQueue={coins:120,smoldering_mote:4};
    localStorage.setItem('tcg-sim',JSON.stringify(v));});
  await wide.reload({waitUntil:'networkidle'}); await wide.waitForTimeout(2400); await enterGame(wide);
  const wsp=wide.locator('.splash button',{hasText:/^(Enter|Resume)$/}).first();
  if (await wsp.count()){await wsp.click();await wide.waitForTimeout(700);}
  if (await wide.locator('.inventory-panel--open').count()){await wide.locator('.drawer-tab.inventory-toggle').click();await wide.waitForTimeout(400);}
  await wide.locator('.tab-bar button',{hasText:'Foundry'}).first().click(); await wide.waitForTimeout(1100);
  const v = await wide.evaluate(()=>{
    const half=document.querySelector('.foundry-half--mine');
    const row=half.querySelector('.foundry-queue-slots');
    const slot=half.querySelector('.foundry-mine-slot');
    const face=half.querySelector('.foundry-mine-slot .card-face-wrapper');
    const hb=half.getBoundingClientRect(), rb=row.getBoundingClientRect();
    const sb=slot.getBoundingClientRect(), fb=face.getBoundingClientRect();
    return { pastFold: Math.round(rb.bottom - hb.bottom),
      card: `${Math.round(fb.width)}x${Math.round(fb.height)}`,
      slot: `${Math.round(sb.width)}x${Math.round(sb.height)}`,
      // Height must NOT track width any more, which is what `aspect-ratio: 1` did.
      slotIsSquare: Math.abs(sb.width - sb.height) < 4,
      cardInsideSlot: Math.round(fb.bottom - sb.bottom) <= 0 };
  });
  check('at 1512x982 the collection queue is fully on screen without scrolling',
    v.pastFold <= 0, `${v.pastFold}px past the fold`);
  check('...achieved WITHOUT shrinking the card (133x192 at this viewport)',
    v.card === '133x192', `card ${v.card} in slot ${v.slot}`);
  check('...and the slot no longer converts its width into height',
    !v.slotIsSquare, `slot ${v.slot}`);
  check('...with the card still inside its slot, unclipped', v.cardInsideSlot, `${v.card} in ${v.slot}`);
  await wide.close();
}

// ── The pack-reveal card queue ──
await boot({ balance: 9000, packs: [{id:'r1',packTypeId:'primordial'}] });
await page.locator('.unpack-pack-item').first().hover({position:{x:18,y:60}}); await page.waitForTimeout(300);
await page.locator('.unpack-pack-item').first().click({position:{x:18,y:60}}); await page.waitForTimeout(700);
for (const rx of [/^Summon$/i,/^Open/i,/Confirm/i]) {
  const b=page.locator('.shop-summon__altar button',{hasText:rx}).first();
  if (await b.count()) { await b.click(); break; }
}
await page.waitForTimeout(1200);
const qd = page.locator('.quick-draw-btn').first();
if (await qd.count()) { await qd.click(); await page.waitForTimeout(1500); }

// Park the pointer somewhere neutral first. Left where it clicked, it sits over a queued card, which lifts
// it (a different `top`) and pushes its neighbour aside (a bigger `left`) — hover state, not a layout bug.
await page.mouse.move(5, 5);
await page.waitForTimeout(400);
const rev = await page.evaluate(()=>{
  const q=document.querySelector('.cards-queue');
  const alt=document.querySelector('.shop-summon__altar');
  const kids=q?[...q.children]:[];
  const row=document.querySelector('.unpack-pack-row');
  return { cards:kids.length, display:q?getComputedStyle(q).display:null,
    xscroll:q?q.scrollWidth-q.clientWidth:null,
    tops:[...new Set(kids.map(k=>Math.round(k.getBoundingClientRect().top)))],
    lefts:kids.map(k=>Math.round(k.getBoundingClientRect().left)),
    packRowShown: row?getComputedStyle(row).display!=='none':null,
    altarScroll: alt.scrollHeight-alt.clientHeight };
});
check('drawn cards are one stacked row, not a wrapping grid',
  rev.display==='flex' && rev.tops.length===1, `display=${rev.display} distinct tops=${rev.tops.length}`);
check('the drawn stack fits with no horizontal scroll', rev.xscroll<=2, `xscroll=${rev.xscroll}px`);
check('drawn cards ascend left to right', rev.lefts.every((v,i)=>i===0||v>rev.lefts[i-1]), rev.lefts.join(','));
// The row reserves 200px "for layout stability", which is waste once a pack is open.
check('the held-pack row is collapsed during a reveal', rev.packRowShown===false, `shown=${rev.packRowShown}`);
// Baseline on the previous commit, same flow: 357px.
check(`the altar scrolls far less during a reveal (357px -> ${rev.altarScroll}px)`,
  rev.altarScroll < 357 * 0.6, `${rev.altarScroll}px vs 357px`);

// ── The overlap must scale with the count, which is the whole mechanism ──
const steps = await page.evaluate(()=>{
  const q=document.querySelector('.cards-queue');
  const kids=[...q.children];
  if (kids.length<2) return null;
  const a=kids[0].getBoundingClientRect(), b=kids[1].getBoundingClientRect();
  return { step: Math.round(b.left-a.left), cardW: Math.round(a.width),
    gaps: getComputedStyle(q).getPropertyValue('--stack-gaps').trim() };
});
check('the cards overlap rather than sitting side by side',
  steps && steps.step < steps.cardW, JSON.stringify(steps));
check('--stack-gaps matches the number of gaps between cards',
  steps && Number(steps.gaps) === rev.cards - 1, `gaps=${steps?.gaps} cards=${rev.cards}`);

// ── The stated requirement: 20 cards' worth of horizontal space ──
// No pack holds 20, so this exercises the CSS math inside the real reveal container at the altar's real
// width. Asserting the mechanism rather than one pack size is the point: it has to hold for any N.
const twenty = await page.evaluate(()=>{
  const altar=document.querySelector('.shop-summon__altar');
  const host=document.createElement('div');
  host.className='cards-queue stack-line';
  altar.appendChild(host);
  const res=[];
  for (const n of [1,5,10,15,20]) {
    host.innerHTML='';
    host.style.setProperty('--stack-gaps', String(Math.max(1,n-1)));
    for (let i=0;i<n;i++){ const d=document.createElement('div');
      d.className='queued-card-slot'; d.style.zIndex=String(i+1); host.appendChild(d); }
    const kids=[...host.children];
    res.push({ n, xscroll: host.scrollWidth-host.clientWidth,
      rows: new Set(kids.map(k=>Math.round(k.getBoundingClientRect().top))).size,
      step: n>1 ? Math.round(kids[1].getBoundingClientRect().left-kids[0].getBoundingClientRect().left) : null });
  }
  host.remove();
  return res;
});
check('the reveal row fits 1-20 cards on a single line with no scroll',
  twenty.every(r=>r.xscroll<=2 && r.rows===1),
  twenty.map(r=>`${r.n}:${r.xscroll}px/${r.rows}row`).join(' '));
check('...and the step shrinks monotonically as the count grows (the overlap is doing the work)',
  twenty.filter(r=>r.step!==null).every((r,i,a)=>i===0||r.step<=a[i-1].step),
  twenty.filter(r=>r.step!==null).map(r=>`${r.n}:${r.step}px`).join(' '));

// The altar clips both axes in normal play. Claiming must clone the complete rendered card (including its
// artwork) into the same viewport-level flight layer used by production queues.
const claim=page.locator('.collect-btn',{hasText:'Claim Summon'}).first();
await claim.click(); await page.waitForTimeout(35);
const summonFlight=await page.evaluate(()=>{
  const ghosts=[...document.querySelectorAll('body > .loot-flight-ghost')];
  return { count:ghosts.length,
    allDirectBody:ghosts.every(g=>g.parentElement===document.body),
    allFixed:ghosts.every(g=>getComputedStyle(g).position==='fixed'),
    withArtwork:ghosts.filter(g=>g.querySelector('img')).length,
    minZ:Math.min(...ghosts.map(g=>Number(getComputedStyle(g).zIndex)||0)) };
});
check('claimed summon cards fly above, rather than inside, the clipped altar',
  summonFlight.count===rev.cards && summonFlight.allDirectBody && summonFlight.allFixed && summonFlight.minZ>9998,
  JSON.stringify(summonFlight));
check('summon flight clones retain the rendered card artwork',
  summonFlight.withArtwork===summonFlight.count,
  `${summonFlight.withArtwork}/${summonFlight.count}`);
await page.waitForTimeout(1200);
check('viewport flight ghosts are removed after landing',
  await page.locator('body > .loot-flight-ghost').count()===0);

check('no console errors', errors.length===0, errors.slice(0,3).join(' | '));
await browser.close();
const failed=results.filter(r=>!r.p);
console.log(`\n${results.length-failed.length}/${results.length} passed`);
if (failed.length){console.log('FAILURES:');failed.forEach(f=>console.log(`  - ${f.n}: ${f.d}`));process.exit(1);}
