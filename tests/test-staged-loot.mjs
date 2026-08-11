/** Mine/Gathering workspaces, progress bars, and the staged-loot hand-off into collection queues. */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';

const results=[]; const check=(n,p,d='')=>{results.push({n,p,d});console.log(`${p?'PASS':'FAIL'}  ${n}${d?`  — ${d}`:''}`);};
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1512,height:982}});
const errors=[];
page.on('console',m=>{if(m.type()==='error'&&!/WebGL|THREE|GPU/i.test(m.text()))errors.push(m.text());});
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));

const worker=(id,cls)=>({id,name:`Worker ${id}`,classType:cls,artVariant:0,rarity:'rare',tier:2,tag:null,value:40,affixes:[]});

async function boot(seed) {
  await page.waitForTimeout(2600);
  await page.evaluate(data=>{
    const save=JSON.parse(localStorage.getItem('tcg-sim'));
    Object.assign(save,data);
    localStorage.setItem('tcg-sim',JSON.stringify(save));
  },seed);
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2400); await enterGame(page);
  const splash=page.locator('.splash button',{hasText:/^(Enter|Resume)$/}).first();
  if(await splash.count()){await splash.click();await page.waitForTimeout(700);}
  if(await page.locator('.inventory-panel--open').count()){await page.locator('.drawer-tab.inventory-toggle').click();await page.waitForTimeout(400);}
}

async function inspectStation({tab,half,stageKey,queueSelector}) {
  await page.locator('.tab-bar button',{hasText:tab}).first().click(); await page.waitForTimeout(900);
  const ui=await page.evaluate(sel=>{
    const host=document.querySelector(sel);
    const slot=host.querySelector('.foundry-mine-slot--filled');
    const progress=slot.querySelector('.station-cycle-progress');
    const tool=slot.querySelector('.station-tool-slot');
    const stage=slot.querySelector('.station-loot-stage');
    const items=[...stage.querySelectorAll('.station-loot-stage__item')];
    const sb=slot.getBoundingClientRect(),pb=progress.getBoundingClientRect();
    const tb=tool.getBoundingClientRect(),lb=stage.getBoundingClientRect();
    return {
      rings:host.querySelectorAll('.foundry-mine-slot__timer').length,
      progressBottom:Math.round(sb.bottom-pb.bottom), progressWidth:Math.round(pb.width), slotWidth:Math.round(sb.width),
      progressValue:Number(progress.getAttribute('aria-valuenow')),
      toolText:tool.textContent.replace(/\s+/g,' ').trim(), toolAboveLoot:tb.bottom<=lb.top+1,
      stageItems:items.length, itemTops:[...new Set(items.map(item=>Math.round(item.getBoundingClientRect().top)))],
      itemWidths:items.map(item=>Math.round(item.getBoundingClientRect().width)),
      itemLefts:items.map(item=>Math.round(item.getBoundingClientRect().left)),
    };
  },half);
  check(`${stageKey}: circular progress ring is gone`,ui.rings===0,JSON.stringify(ui));
  check(`${stageKey}: progress is a full-width bar anchored to the slot bottom`,
    Math.abs(ui.progressBottom)<=1&&Math.abs(ui.progressWidth-ui.slotWidth)<=2&&ui.progressValue>0&&ui.progressValue<100,JSON.stringify(ui));
  check(`${stageKey}: Tool/Buff socket occupies the upper workspace without empty-state copy`,
    /Tool\/Buff/.test(ui.toolText)&&!/Empty slot/.test(ui.toolText)&&ui.toolAboveLoot,ui.toolText);
  check(`${stageKey}: staged rewards form one horizontally overlapping row`,
    ui.stageItems===2&&ui.itemTops.length===1&&ui.itemLefts[1]>ui.itemLefts[0]
      &&ui.itemLefts[1]-ui.itemLefts[0]<ui.itemWidths[0],JSON.stringify(ui));
  check(`${stageKey}: staged loot is not in the collection queue yet`,
    (await page.locator(queueSelector).count())===0);

  await page.waitForSelector('body > .loot-flight-ghost',{timeout:10000});
  const flight=await page.evaluate(()=>{
    const ghosts=[...document.querySelectorAll('body > .loot-flight-ghost')];
    return {count:ghosts.length,direct:ghosts.every(g=>g.parentElement===document.body),
      downward:ghosts.every(g=>new DOMMatrix(g.style.transform).f>0),art:ghosts.filter(g=>g.querySelector('img')).length};
  });
  check(`${stageKey}: staged artwork transitions downward in the viewport layer`,
    flight.count===2&&flight.direct&&flight.downward&&flight.art===2,JSON.stringify(flight));
  await page.waitForFunction(sel=>document.querySelectorAll(sel).length>=2,queueSelector,{timeout:5000});
  check(`${stageKey}: rewards join the collection queue only after staging`,
    (await page.locator(`${half} .station-loot-stage__item`).count())===0
      &&(await page.locator(queueSelector).count())>=2);
}

await page.goto('http://localhost:5199/',{waitUntil:'networkidle'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2400); await enterGame(page);
await page.waitForFunction(()=>!!localStorage.getItem('tcg-sim'),null,{timeout:15000});

const miner=worker('mine-stage-worker','miner');
let now=Date.now();
await boot({
  collection:[miner],pocket:[miner],graphicsSettings:{quality:'high'},
  mineSlots:[{slotId:1,card:miner,startedAt:now-30000,endsAt:now+30000,oreType:'iron'}],
  mineClaimQueue:{},mineRewardQueue:{},
  mineLootStages:[{id:'mine-stage-test',slotId:1,loot:{iron:2},rewards:{coins:3},releaseAt:now+14000}],
});
await inspectStation({tab:'Foundry',half:'.foundry-half--mine',stageKey:'mine',queueSelector:'.foundry-half--mine .foundry-queue-slots > .foundry-queue-slot'});

const gatherer=worker('gather-stage-worker','lumberjack');
now=Date.now();
await boot({
  collection:[gatherer],pocket:[gatherer],graphicsSettings:{quality:'high'},
  gatheringSlots:[{slotId:1,card:gatherer,startedAt:now-30000,endsAt:now+30000,resourceId:'wood'}],
  gatheringClaimQueue:{},gatheringRewardQueue:{},
  gatheringLootStages:[{id:'gather-stage-test',slotId:1,loot:{wood:2},rewards:{coins:4},releaseAt:now+14000}],
});
await inspectStation({tab:'Wilderness',half:'.wilderness-half--gathering',stageKey:'gathering',queueSelector:'.wilderness-half--gathering .foundry-queue-slots > .foundry-queue-slot'});

const helper=await page.evaluate(async()=>{
  const m=await import('/src/game/stagedLoot.js');
  const restored=m.normalizeStagedLootEvents([{slotId:2,loot:{wood:3,bad:0},rewards:{coins:2},releaseAt:100}]);
  const split=m.partitionStagedLoot(restored,100);
  return {duration:m.LOOT_STAGE_DURATION_MS,restored,due:split.due.length,
    loot:m.aggregateStagedCounts(split.due,'loot'),rewards:m.aggregateStagedCounts(split.due,'rewards')};
});
check('staged rewards normalize and aggregate losslessly across save/reload',
  helper.duration===2400&&helper.due===1&&helper.loot.wood===3&&helper.rewards.coins===2,JSON.stringify(helper));
check('no console errors',errors.length===0,errors.slice(0,3).join(' | '));

await browser.close();
const failed=results.filter(r=>!r.p);
console.log(`\n${results.length-failed.length}/${results.length} passed`);
if(failed.length){console.log('FAILURES:');failed.forEach(f=>console.log(`  - ${f.n}: ${f.d}`));process.exit(1);}
