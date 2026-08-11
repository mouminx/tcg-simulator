/** The processing selector, and the after-vs-before scroll for every short viewport in the report. */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';
const results=[]; const check=(n,p,d='')=>{results.push({n,p,d});console.log(`${p?'PASS':'FAIL'}  ${n}${d?`  — ${d}`:''}`);};
const browser = await chromium.launch(); const errors=[];
const cards = ['a','b','c'].map(id => ({ id:`w-${id}`, name:`W${id}`, classType:'lumberjack', artVariant:0, rarity:'rare', tier:2, tag:null, value:40, affixes:[] }));

for (const vp of [{w:1366,h:768},{w:1280,h:800},{w:1440,h:900}]) {
  const page = await browser.newPage({ viewport:{width:vp.w,height:vp.h} });
  page.on('console', m=>{ if(m.type()==='error' && !/WebGL|THREE|GPU/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e=>errors.push(`pageerror: ${e.message}`));
  await page.goto('http://localhost:5199/', { waitUntil:'networkidle' });
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2000); await enterGame(page);
  await page.evaluate(s=>{ const v=JSON.parse(localStorage.getItem('tcg-sim'));
    v.collection=s; v.pocket=s; v.pocketCapacity=6; v.balance=500;
    v.gatheredInventory={wood:40,fiber:40,hide:20}; v.graphicsSettings={quality:'low'};
    localStorage.setItem('tcg-sim', JSON.stringify(v)); }, cards);
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2000); await enterGame(page);
  const sp = page.locator('.splash button',{hasText:/^(Enter|Resume)$/}).first();
  if (await sp.count()) { await sp.click(); await page.waitForTimeout(600); }

  for (const [view, halfSel, label] of [['Wilderness','.wilderness-half--processing','processing'],['Foundry','.foundry-half--forge','forge']]) {
    await page.locator('.tab-bar button',{hasText:view}).first().click(); await page.waitForTimeout(900);
    if (await page.locator('.inventory-panel--open').count()) { await page.locator('.drawer-tab.inventory-toggle').click(); await page.waitForTimeout(400); }
    const m = await page.evaluate(sel=>{
      const half=document.querySelector(sel);
      const tabs=[...document.querySelectorAll('.forge-selector__tab')];
      const rail=document.querySelector('.drawer-tab.inventory-toggle');
      return { rows: document.querySelectorAll('.foundry-forge-row').length, tabs: tabs.length,
        scroll: half? half.scrollHeight-half.clientHeight : null, halfH: half?Math.round(half.clientHeight):null,
        widths: tabs.map(t=>Math.round(t.getBoundingClientRect().width)),
        tabsRight: tabs.length?Math.round(Math.max(...tabs.map(t=>t.getBoundingClientRect().right))):0,
        railLeft: rail?Math.round(rail.getBoundingClientRect().left):null,
        states: tabs.map(t=>t.querySelector('.forge-selector__state')?.textContent) };
    }, halfSel);
    const tag=`${vp.w}x${vp.h} ${label}`;
    check(`${tag}: one row, three tabs`, m.rows===1 && m.tabs===3, `rows=${m.rows} tabs=${m.tabs}`);
    check(`${tag}: tabs equal width`, new Set(m.widths).size===1, m.widths.join('/'));
    check(`${tag}: tabs clear the Bag rail`, m.tabsRight<=m.railLeft, `${m.tabsRight} vs ${m.railLeft}`);
    check(`${tag}: every tab names a next action`, m.states.every(s=>/Empty|Needs|Ready|%/.test(s)), m.states.join(' | '));
    console.log(`      half ${m.halfH}px, inner scroll ${m.scroll}px`);
    if (label==='processing') {
      await page.locator('.forge-selector__tab').nth(1).click(); await page.waitForTimeout(400);
      const sw = await page.evaluate(()=>({ active:[...document.querySelectorAll('.forge-selector__tab')].map(t=>t.getAttribute('aria-selected')==='true'), rows:document.querySelectorAll('.foundry-forge-row').length }));
      check(`${tag}: switching benches shows exactly one row`, sw.active[1]&&!sw.active[0]&&sw.rows===1, JSON.stringify(sw));
    }
  }
  await page.close();
}
check('no console errors', errors.length===0, errors.slice(0,3).join(' | '));
await browser.close();
const failed=results.filter(r=>!r.p);
console.log(`\n${results.length-failed.length}/${results.length} passed`);
if (failed.length){console.log('FAILURES:');failed.forEach(f=>console.log(`  - ${f.n}: ${f.d}`));process.exit(1);}
