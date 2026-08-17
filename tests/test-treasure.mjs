/**
 * The altar's group tabs and the treasure-cache opening.
 *
 * Two things here are worth more than the visuals: that a pack only ever appears under its own group (a pack
 * in no tab is held, unopenable and undiagnosable), and that the reveal waits for the burst — the phase
 * machine's timeout and the CSS durations are separate numbers that must agree.
 */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';
const results=[]; const check=(n,p,d='')=>{results.push({n,p,d});console.log(`${p?'PASS':'FAIL'}  ${n}${d?`  — ${d}`:''}`);};
const browser = await chromium.launch();
const errors=[];
let stagedLook = null;
const page = await browser.newPage({ viewport:{width:1512,height:982} });
page.on('console',m=>{if(m.type()==='error'&&!/WebGL|THREE|GPU/i.test(m.text()))errors.push(m.text());});
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));

async function boot(mutate={}) {
  await page.waitForTimeout(2600);
  await page.evaluate(m=>{const v=JSON.parse(localStorage.getItem('tcg-sim'));Object.assign(v,m);localStorage.setItem('tcg-sim',JSON.stringify(v));}, mutate);
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2400); await enterGame(page);
  const sp=page.locator('.splash button',{hasText:/^(Enter|Resume)$/}).first();
  if (await sp.count()){await sp.click();await page.waitForTimeout(700);}
  if (await page.locator('.inventory-panel--open').count()){await page.locator('.drawer-tab.inventory-toggle').click();await page.waitForTimeout(400);}
}
const tabState = () => page.evaluate(()=>[...document.querySelectorAll('.unpack-group-tab')].map(t=>({
  label: t.querySelector('.unpack-group-tab__label')?.textContent,
  count: t.querySelector('.unpack-group-tab__count')?.textContent,
  active: t.getAttribute('aria-selected')==='true',
  empty: t.className.includes('--empty'),
})));
// Staging + confirming, which is how a held item reaches the opening flow.
async function openFirstItem({ inspectStaged = false, afterConfirmWait = 900 } = {}) {
  await page.locator('.unpack-pack-item').first().hover({position:{x:18,y:60}});
  await page.waitForTimeout(300);
  // The neighbouring stack item steps aside on hover. At dense/short layouts the pointer can sit exactly
  // on that moving boundary and Playwright's stability wait chases the transition indefinitely; the visible
  // strip is already explicitly targeted, so force only bypasses that synthetic stability loop.
  await page.locator('.unpack-pack-item').first().click({position:{x:18,y:60}, force:true});
  if (inspectStaged) {
    // Selection is intentionally direct (no flight). The staged cache must retain the same square loot
    // geometry rather than inheriting the foil pack's 1:1.5 stage box.
    await page.waitForTimeout(180);
    stagedLook = await page.evaluate(()=>{
      const f=document.querySelector('.unpack-flying-pack');
      const stage=document.querySelector('.summon-pack-wrap');
      const tile=stage?.querySelector('.held-loot');
      const a=stage?.getBoundingClientRect();
      const b=tile?.getBoundingClientRect();
      return { flight: !!f, loot: !!tile, pack: !!stage?.querySelector('.pack-display'),
        stage: a ? [a.width,a.height] : null, tile: b ? [b.width,b.height] : null };
    });
  }
  await page.waitForTimeout(700);
  for (const rx of [/^Summon$/i,/^Open/i,/Confirm/i]) {
    const b=page.locator('.shop-summon__altar button',{hasText:rx}).first();
    if (await b.count()) { await b.click(); break; }
  }
  await page.waitForTimeout(afterConfirmWait);
}

await page.goto(process.env.TEST_URL ?? 'http://localhost:5199/',{waitUntil:'networkidle'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2400); await enterGame(page);
await page.waitForFunction(()=>!!localStorage.getItem('tcg-sim'),null,{timeout:20000});

// ── Grouping ──
await boot({ balance: 900, graphicsSettings:{quality:'high'},
  packs: [{id:'p1',packTypeId:'iron'},{id:'p2',packTypeId:'dusk'},{id:'p3',packTypeId:'blankSlate'},
          {id:'t1',packTypeId:'treasure'},{id:'t2',packTypeId:'treasure'}] });

let tabs = await tabState();
check('two tabs: Packs and Treasure', tabs.map(t=>t.label).join('+')==='Packs+Treasure', JSON.stringify(tabs.map(t=>t.label)));
check('Packs is the default tab', tabs[0].active && !tabs[1].active, JSON.stringify(tabs.map(t=>t.active)));
check('each tab counts only its own group (3 packs / 2 treasure)',
  tabs[0].count==='3' && tabs[1].count==='2', `${tabs[0].count} / ${tabs[1].count}`);
check('the Packs row shows 3 items, excluding the treasure',
  (await page.locator('.unpack-pack-item').count())===3, `${await page.locator('.unpack-pack-item').count()}`);

await page.locator('.unpack-group-tab',{hasText:'Treasure'}).click(); await page.waitForTimeout(450);
check('the Treasure row shows only the 2 caches',
  (await page.locator('.unpack-pack-item').count())===2, `${await page.locator('.unpack-pack-item').count()}`);

// Every pack must be reachable in exactly one tab — a pack in none is invisible and unopenable.
const reachable = await page.evaluate(()=>{
  const held = JSON.parse(localStorage.getItem('tcg-sim')).packs.length;
  const sum = [...document.querySelectorAll('.unpack-group-tab__count')]
    .reduce((t,el)=>t+Number(el.textContent||0),0);
  return { held, sum };
});
check('the tab counts account for every held pack', reachable.held === reachable.sum,
  `held ${reachable.held}, tabs total ${reachable.sum}`);

// ── An empty group keeps its tab, and says where its contents come from ──
await boot({ packs: [{id:'p1',packTypeId:'iron'}] });
tabs = await tabState();
check('an empty group keeps its tab rather than disappearing',
  tabs.length===2 && tabs[1].count==='0' && tabs[1].empty, JSON.stringify(tabs[1]));
await page.locator('.unpack-group-tab',{hasText:'Treasure'}).click(); await page.waitForTimeout(450);
const emptyMsg = await page.evaluate(()=>document.querySelector('.unpack-pack-row-empty-hint')?.textContent?.trim());
check('...and its empty state says where they come from', /Treasure Sense/i.test(emptyMsg??''), `"${emptyMsg}"`);

// ── A card pack still opens as a pack ──
await boot({ packs: [{id:'p1',packTypeId:'iron'}] });
await openFirstItem();
check('a card pack opens with the pack-tearing animation',
  (await page.locator('.split-pack').count())===1 && (await page.locator('.treasure-cache').count())===0,
  `split-pack=${await page.locator('.split-pack').count()} cache=${await page.locator('.treasure-cache').count()}`);

// ── A treasure cache opens with the burst ──
await boot({ packs: [{id:'t1',packTypeId:'treasure'}] });
await page.locator('.unpack-group-tab',{hasText:'Treasure'}).click(); await page.waitForTimeout(400);

const heldLook = await page.evaluate(()=>{
  const item=document.querySelector('.unpack-pack-item');
  const row=document.querySelector('.unpack-pack-row');
  const tile=item?.querySelector('.held-loot');
  const itemBox=item?.getBoundingClientRect();
  const tileBox=tile?.getBoundingClientRect();
  const rowBox=row?.getBoundingClientRect();
  return { loot: !!item?.querySelector('.held-loot'), pack: !!item?.querySelector('.pack-display'),
    art: item?.querySelector('.foundry-square-resource__art')?.getAttribute('src')?.includes('treasure_chest') ?? false,
    item: itemBox ? [itemBox.width,itemBox.height] : null,
    tile: tileBox ? [tileBox.width,tileBox.height] : null,
    contained: !!(itemBox && tileBox && rowBox && tileBox.left >= itemBox.left - 1 && tileBox.right <= itemBox.right + 1
      && tileBox.right <= rowBox.right + 1) };
});
check('a held cache is drawn as a square LOOT tile, not a pack graphic',
  heldLook.loot && !heldLook.pack, JSON.stringify(heldLook));
check('...with square wrapper and artwork fully contained at the right edge', heldLook.art && heldLook.contained
  && Math.abs(heldLook.item[0]-heldLook.item[1]) <= 1 && Math.abs(heldLook.tile[0]-heldLook.tile[1]) <= 1
  && Math.abs(heldLook.item[0]-heldLook.tile[0]) <= 1, JSON.stringify(heldLook));


await openFirstItem({ inspectStaged: true, afterConfirmWait: 80 });
check('the cache keeps its square loot look when staged, with no movement portal',
  stagedLook?.loot && !stagedLook.pack && !stagedLook.flight
  && Math.abs(stagedLook.stage[0]-stagedLook.stage[1]) <= 1
  && Math.abs(stagedLook.tile[0]-stagedLook.tile[1]) <= 1, JSON.stringify(stagedLook));
check('a treasure cache opens with the chest, not a pack',
  (await page.locator('.treasure-cache').count())===1 && (await page.locator('.split-pack').count())===0,
  `cache=${await page.locator('.treasure-cache').count()} split-pack=${await page.locator('.split-pack').count()}`);
check('the chest artwork resolves (not the fallback glyph)',
  (await page.locator('.treasure-cache .foundry-square-resource__art').count())===1
  && (await page.locator('.held-loot__fallback').count())===0);
check('Open Pack immediately starts the treasure animation without a second cache click',
  (await page.locator('.treasure-cache--bursting').count())===1,
  `bursting=${await page.locator('.treasure-cache--bursting').count()}`);

// ── CHARGE (0-520ms): still a framed loot card, flooding to white ──
await page.waitForTimeout(300);
const charge = await page.evaluate(()=>{
  const card=document.querySelector('.treasure-cache__card');
  const tile=document.querySelector('.treasure-cache .held-loot');
  const white=document.querySelector('.treasure-cache__whiteout');
  return { tile: !!tile,
    // The gold frame must survive into the opening — it used to become a bare <img>.
    framed: !!tile && getComputedStyle(tile).borderTopWidth !== '0px' || !!document.querySelector('.treasure-cache .foundry-square-resource__front'),
    cardAnim: card?getComputedStyle(card).animationName:null,
    whiteAnim: white?getComputedStyle(white).animationName:null,
    pieces: document.querySelectorAll('.treasure-piece').length };
});
check('during the charge it is still the framed loot card, not a bare image',
  charge.tile && charge.framed, JSON.stringify(charge));
check('...whitening and growing, with no fragments yet',
  charge.cardAnim==='treasure-charge' && charge.whiteAnim==='treasure-whiteout' && charge.pieces===0,
  JSON.stringify(charge));

// ── SHATTER (from 520ms): the card is replaced by its fragments ──
await page.waitForTimeout(400);
const burst = await page.evaluate(()=>{
  const shards=[...document.querySelectorAll('.treasure-shard')];
  const g=el=>el?getComputedStyle(el):null;
  const pieces=[...document.querySelectorAll('.treasure-piece')];
  return { count: shards.length,
    shardAnim: shards[0]?g(shards[0]).animationName:null,
    pieceCount: pieces.length,
    pieceAnim: pieces[0]?g(pieces[0]).animationName:null,
    // Every fragment is clipped differently — that is what makes it one card in pieces rather than N copies.
    distinctClips: new Set(pieces.map(p=>g(p).clipPath)).size,
    // Three points per clip = a triangle. Counted from the polygon's comma-separated coordinate pairs.
    allTriangles: pieces.every(p=>{
      const m=g(p).clipPath.match(/polygon\((.*)\)/);
      return !!m && m[1].split(',').length === 3;
    }),
    // Randomised per piece, which is what makes them fade at different moments instead of in lockstep.
    distinctDurations: new Set(pieces.map(p=>g(p).animationDuration)).size,
    // WHITE, and carrying no artwork: the charge ends with the card flooded to pure white, so that is what
    // must break. A fragment showing the chest again would announce the substitution.
    fillColour: (()=>{const f=pieces[0]?.querySelector('.treasure-piece__fill');
      return f?getComputedStyle(f).backgroundColor:null;})(),
    fillHasArt: (()=>{const f=pieces[0]?.querySelector('.treasure-piece__fill');
      return f?getComputedStyle(f).backgroundImage!=='none':null;})(),
    // The card is a ROUNDED square, so a fragment must be cut from that shape, not from a square.
    fillRadius: (()=>{const f=pieces[0]?.querySelector('.treasure-piece__fill');
      return f?getComputedStyle(f).borderTopLeftRadius:null;})(),
    // Nothing of the intact card may remain on screen once it has broken.
    originalGone: !document.querySelector('.treasure-cache .held-loot')
      && !document.querySelector('.treasure-cache__whiteout'),
    clips: pieces.map(p=>g(p).clipPath),
    tileGone: !document.querySelector('.treasure-cache .held-loot'),
    raysAnim: g(document.querySelector('.treasure-cache__rays'))?.animationName,
    flareAnim: g(document.querySelector('.treasure-cache__flare'))?.animationName,
    // Distinct destinations prove the field was generated, not one value reused.
    distinctOffsets: new Set(shards.map(s=>getComputedStyle(s).getPropertyValue('--sx'))).size,
    revealShowing: !!document.querySelector('.opening-resource-card--reveal'),
    quality: document.documentElement.getAttribute('data-quality') };
});
check('the card is replaced by its fragments once it is fully white',
  burst.pieceCount===27 && burst.tileGone, `${burst.pieceCount} pieces, tile gone: ${burst.tileGone}`);
check('...every fragment is a TRIANGLE, each clipped differently',
  burst.allTriangles && burst.distinctClips===27,
  `triangles=${burst.allTriangles} distinct clips=${burst.distinctClips}`);
check('...pure WHITE, matching the state the card ended on, with no artwork showing',
  burst.fillColour==='rgb(255, 255, 255)' && burst.fillHasArt===false,
  `fill=${burst.fillColour} hasArt=${burst.fillHasArt}`);
check('...cut from the card\'s ROUNDED square, not a square',
  parseFloat(burst.fillRadius)>0, `radius=${burst.fillRadius}`);
check('...and the intact card is gone, so the substitution cannot be seen',
  burst.originalGone, `originalGone=${burst.originalGone}`);
check('...with per-fragment durations, so they do not fade in lockstep',
  burst.distinctDurations>10, `${burst.distinctDurations} distinct durations across 27 pieces`);
check('...animating outward, with the rays and particles still running',
  burst.pieceAnim==='treasure-piece' && burst.raysAnim==='treasure-rays'
  && burst.flareAnim==='treasure-flare' && burst.shardAnim==='treasure-shard',
  JSON.stringify({piece:burst.pieceAnim,rays:burst.raysAnim,flare:burst.flareAnim,shard:burst.shardAnim}));
check('30 shards, each with its own destination', burst.count===30 && burst.distinctOffsets>25,
  `${burst.count} shards, ${burst.distinctOffsets} distinct offsets`);
// The whole point of TREASURE_BURST_MS: the loot must not appear while the chest is still bursting.
check('the loot is NOT revealed mid-burst', burst.revealShowing===false, `reveal=${burst.revealShowing}`);
await page.waitForTimeout(1900);
const afterBurst = await page.evaluate(()=>({
  queued: document.querySelectorAll('.cards-queue > *').length,
  centreReveal: document.querySelectorAll('.opening-resource-card--reveal').length,
  mainGeometry: [...document.querySelectorAll('.treasure-reward-reveal--visible')].map(slot=>{
    const slotBox=slot.getBoundingClientRect();
    const card=slot.querySelector('.opening-resource-card--treasure');
    const cardBox=card?.getBoundingClientRect();
    return { left:slotBox.left, right:slotBox.right, slot:[slotBox.width,slotBox.height], card:cardBox?[cardBox.width,cardBox.height]:null };
  }),
  mainContained: (()=>{
    const stage=document.querySelector('.opening-stage')?.getBoundingClientRect();
    const cards=[...document.querySelectorAll('.treasure-reward-reveal--visible')].map(card=>card.getBoundingClientRect());
    return !!stage && cards.every(card=>card.left >= stage.left-1 && card.right <= stage.right+1
      && card.top >= stage.top-1 && card.bottom <= stage.bottom+1);
  })(),
  queueTray: document.querySelectorAll('.pack-opening__queue-tray').length,
  claim: !!document.querySelector('.collect-btn'),
  quickDraw: !!document.querySelector('.quick-draw-btn'),
  hint: document.querySelector('.hint')?.textContent?.trim(),
}));
// A cache populates the altar itself from left to right, never the playing-card strip.
check('...and all five rewards appear in the main altar rather than the card strip',
  afterBurst.mainGeometry.length === 5 && afterBurst.queued === 0 && afterBurst.queueTray === 0 && afterBurst.centreReveal === 0,
  JSON.stringify(afterBurst));
check('...as square loot cards, never forced into playing-card proportions',
  afterBurst.mainContained && afterBurst.mainGeometry.length===5
  && afterBurst.mainGeometry.every(({slot,card})=>card && Math.abs(slot[0]-slot[1])<=1
    && Math.abs(card[0]-card[1])<=1 && Math.abs(slot[0]-card[0])<=1),
  JSON.stringify(afterBurst.mainGeometry));
check('...laid left-to-right with no horizontal overlap',
  afterBurst.mainGeometry.every((card,index,list)=>index===0 || card.left >= list[index-1].right-1),
  JSON.stringify(afterBurst.mainGeometry.map(card=>[card.left,card.right])));
check('...with the Claim button ready and no card-by-card step',
  afterBurst.claim && !afterBurst.quickDraw, JSON.stringify(afterBurst));

// ── Every cache breaks differently ──
// The whole point of generating the pattern per opening. A fixed field would make the second cache shatter
// along exactly the same cracks as the first.
const firstClips = burst.clips.join('|');
await page.waitForTimeout(900);
await boot({ packs: [{id:'t1',packTypeId:'treasure'},{id:'t2',packTypeId:'treasure'}], graphicsSettings:{quality:'high'} });
await page.locator('.unpack-group-tab',{hasText:'Treasure'}).click(); await page.waitForTimeout(400);
await openFirstItem({ afterConfirmWait: 80 });
await page.waitForTimeout(700);
const secondClips = await page.evaluate(()=>[...document.querySelectorAll('.treasure-piece')]
  .map(p=>getComputedStyle(p).clipPath).join('|'));
check('a second cache shatters along different cracks',
  secondClips.length > 0 && secondClips !== firstClips,
  secondClips === firstClips ? 'identical pattern — the field is not being regenerated' : 'differs');

// ── The burst must survive the low/medium `animation: none` blanket ──
await boot({ packs: [{id:'t1',packTypeId:'treasure'}], graphicsSettings:{quality:'low'} });
await page.locator('.unpack-group-tab',{hasText:'Treasure'}).click(); await page.waitForTimeout(400);
await openFirstItem({ afterConfirmWait: 80 });
await page.waitForTimeout(700);
const low = await page.evaluate(()=>{
  const s=document.querySelector('.treasure-shard');
  const p=document.querySelector('.treasure-piece');
  return { quality: document.documentElement.getAttribute('data-quality'),
    shard: s?getComputedStyle(s).animationName:null,
    piece: p?getComputedStyle(p).animationName:null };
});
check('at LOW quality the shatter still animates (earned one-off, like the gold burst)',
  low.quality==='low' && low.shard==='treasure-shard' && low.piece==='treasure-piece', JSON.stringify(low));

// ── The cache's own sound, and the gold that follows ──
// `window.__audio` is the dev-only engine handle. Asserting the definition is REACHABLE is the point: a
// definition with no `src`, `variants` or `synth` is silent and indistinguishable from working audio, which is
// exactly how 11 real sounds once shipped unreferenced.
// The definitions live in the engine's `registry`. A definition with no `src`, `variants` or `synth` is
// SILENT and indistinguishable from working audio — which is exactly how 11 real sounds once shipped
// unreferenced — so this asserts the three encoded takes are actually wired to the id.
const audio = await page.evaluate(async ()=>{
  const eng = window.__audio;
  const def = eng?.registry?.get?.('treasure.open') ?? null;
  const variants = def?.variants ?? [];
  // And that the files really resolve, not just that the array is populated.
  const statuses = await Promise.all(variants.map(async src => {
    try { const r = await fetch(src, { method: 'GET' }); return r.status; } catch { return 0; }
  }));
  return { def: def ? { variants: variants.length, maxVoices: def.maxVoices } : null, statuses };
});
check('the treasure.open definition is wired to its three takes',
  audio.def?.variants === 3, JSON.stringify(audio.def));
check('...and all three encoded files actually resolve',
  audio.statuses.length === 3 && audio.statuses.every(s => s === 200), JSON.stringify(audio.statuses));

// A cache must not also make a paper-tearing sound: `pack.open` fires in App when a pack is committed, and a
// cache is deliberately silent there because its own sound belongs to the press that breaks it.
const heard = await page.evaluate(()=>{
  const played = [];
  const eng = window.__audio;
  const real = eng.play.bind(eng);
  eng.play = (id, ...rest) => { played.push(id); return real(id, ...rest); };
  window.__played = played;
  return true;
});
await boot({ packs: [{id:'t1',packTypeId:'treasure'}], graphicsSettings:{quality:'high'} });
await page.evaluate(()=>{
  const eng = window.__audio; const played = [];
  const real = eng.play.bind(eng);
  eng.play = (id, ...rest) => { played.push(id); return real(id, ...rest); };
  window.__played = played;
});
await page.locator('.unpack-group-tab',{hasText:'Treasure'}).click(); await page.waitForTimeout(400);
const beforeOpen = await page.evaluate(()=>window.__played.slice());
await openFirstItem({ afterConfirmWait: 80 });
await page.waitForTimeout(250);
const afterOpen = await page.evaluate(()=>window.__played.slice());
const newIds = afterOpen.slice(beforeOpen.length);
check('pressing Open Pack plays treasure.open exactly once',
  newIds.filter(id=>id==='treasure.open').length===1, newIds.join(', ') || 'nothing');
check('...and a cache never plays the pack-tearing sound',
  !beforeOpen.includes('pack.open') && !newIds.includes('pack.open'),
  `before=[${beforeOpen.join(', ')}] after=[${newIds.join(', ')}]`);

// ── The gold total glows and bursts, even though treasure pops its coins in place ──
await page.waitForTimeout(2600);
// Sample the peak of the burst rather than guessing when it happens: the coins pop in place first, then the
// balance changes, then the count-up starts 260ms later. Poll instead of picking a timeout.
const goldPeak = { pumping:false, glow:'none', bursts:0 };
const claim = page.locator('.collect-btn').first();
if (await claim.count()) { await claim.click(); }
for (let i = 0; i < 60; i++) {
  const snap = await page.evaluate(()=>{
    const el=document.querySelector('.balance');
    return { pumping: el?.className.includes('balance--pumping') ?? false,
      glow: el?getComputedStyle(el).textShadow:'none',
      bursts: document.querySelectorAll('.gold-burst').length };
  });
  if (snap.bursts > goldPeak.bursts) goldPeak.bursts = snap.bursts;
  if (snap.pumping) { goldPeak.pumping = true; goldPeak.glow = snap.glow; break; }
  await page.waitForTimeout(80);
}
check('the gold total glows while the coins arrive',
  goldPeak.pumping && goldPeak.glow !== 'none' && goldPeak.glow.length > 5, JSON.stringify(goldPeak));
check('...and a burst fires at the counter despite the in-place coin pops',
  goldPeak.bursts > 0, `${goldPeak.bursts} bursts seen`);

check('no console errors', errors.length===0, errors.slice(0,3).join(' | '));
await browser.close();
const failed=results.filter(r=>!r.p);
console.log(`\n${results.length-failed.length}/${results.length} passed`);
if (failed.length){console.log('FAILURES:');failed.forEach(f=>console.log(`  - ${f.n}: ${f.d}`));process.exit(1);}
