/** Per-row Forge/Processing output ownership and independent bonus collection. */
import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';
import { normalizeProductionOutputQueues } from '../src/game/productionOutputQueues.js';

const results=[];
const check=(name,pass,detail='')=>{results.push({name,pass,detail});console.log(`${pass?'PASS':'FAIL'}  ${name}${detail?`  — ${detail}`:''}`);};

const migrated=normalizeProductionOutputQueues({
  slotIds:[1,2,3], validOutputIds:['steel','gold'], legacyQueue:{steel:4,gold:2},
  legacySlotOutputs:{1:'steel',2:'gold',3:null},
});
check('legacy aggregate outputs migrate without loss',
  migrated['1'].steel===4 && migrated['2'].gold===2,
  JSON.stringify(migrated));

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[];
page.on('console',m=>{if(m.type()==='error'&&!/WebGL|THREE|GPU/i.test(m.text()))errors.push(m.text());});
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));

async function closeBag(){
  if(await page.locator('.inventory-panel--open').count()){
    await page.locator('.drawer-tab.inventory-toggle').click();
    await page.waitForTimeout(350);
  }
}

async function boot(mutate={}){
  await page.waitForTimeout(2400);
  await page.evaluate(m=>{const save=JSON.parse(localStorage.getItem('tcg-sim'));Object.assign(save,m);localStorage.setItem('tcg-sim',JSON.stringify(save));},mutate);
  await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2200); await enterGame(page);
  const splash=page.locator('.splash button',{hasText:/^(Enter|Resume)$/}).first();
  if(await splash.count()){await splash.click();await page.waitForTimeout(650);}
  await closeBag();
}

async function saved(){
  await page.waitForTimeout(2500);
  return page.evaluate(()=>JSON.parse(localStorage.getItem('tcg-sim')));
}

async function rowCounts(tabSelector,rowCardSelector){
  const counts=[];
  for(let i=0;i<3;i++){
    await page.locator(tabSelector).nth(i).click(); await page.waitForTimeout(120);
    counts.push(Number((await page.locator(`${rowCardSelector} .foundry-square-resource__count`).textContent())?.replace(/\D/g,'')));
  }
  return counts;
}

await page.goto('http://localhost:5199/',{waitUntil:'networkidle'});
await page.evaluate(()=>localStorage.clear());
await page.reload({waitUntil:'networkidle'}); await page.waitForTimeout(2200); await enterGame(page);
await page.waitForFunction(()=>!!localStorage.getItem('tcg-sim'),null,{timeout:15000});

await boot({
  graphicsSettings:{quality:'low'},
  ingotInventory:{steel:0,silver:0,gold:0,platinum:0,starsteel:0},
  forgeOutputQueues:{1:{steel:1},2:{steel:4},3:{gold:2}},
  forgeRewardQueue:{coins:7,smoldering_mote:2},
});
await page.locator('.tab-bar button',{hasText:'Foundry'}).first().click(); await page.waitForTimeout(700); await closeBag();
const forgeCounts=await rowCounts('.forge-selector__tab','.foundry-forge-row__output-card');
check('Forge rows display their own output counts, including identical ingot types',
  JSON.stringify(forgeCounts)===JSON.stringify([1,4,2]),forgeCounts.join('/'));

await page.locator('.forge-selector__tab').nth(1).click(); await page.waitForTimeout(120);
await page.locator('.foundry-forge-row .foundry-collect-btn--row').click();
await page.waitForTimeout(900);
const forgeAfter=await saved();
check('collecting Forge II transfers only Forge II output',
  forgeAfter.ingotInventory.steel===4 && !forgeAfter.forgeOutputQueues['2'].steel,
  JSON.stringify({inventory:forgeAfter.ingotInventory,queues:forgeAfter.forgeOutputQueues}));
check('other Forge outputs remain waiting',
  forgeAfter.forgeOutputQueues['1'].steel===1 && forgeAfter.forgeOutputQueues['3'].gold===2,
  JSON.stringify(forgeAfter.forgeOutputQueues));
check('row-level ingot collection leaves the Forge bonus queue untouched',
  forgeAfter.forgeRewardQueue.coins===7 && forgeAfter.forgeRewardQueue.smoldering_mote===2,
  JSON.stringify(forgeAfter.forgeRewardQueue));

await boot({
  processedInventory:{},
  craftedInventory:{timber:0,lumber:0},
  processingSlots:[
    {slotId:1,card:null,inputId:null,inputCount:0,startedAt:null,endsAt:null,outputId:'timber'},
    {slotId:2,card:null,inputId:null,inputCount:0,startedAt:null,endsAt:null,outputId:'timber'},
    {slotId:3,card:null,inputId:null,inputCount:0,startedAt:null,endsAt:null,outputId:'lumber'},
  ],
  processingOutputQueues:{1:{timber:1},2:{timber:5},3:{lumber:2}},
  processingRewardQueue:{coins:11,blooming_mote:3},
});
await page.locator('.tab-bar button',{hasText:'Wilderness'}).first().click(); await page.waitForTimeout(700); await closeBag();
const processingCounts=await rowCounts('.wilderness-half--processing .forge-selector__tab','.wilderness-processing-row .foundry-forge-row__output-card');
check('Processing benches display independent output counts',
  JSON.stringify(processingCounts)===JSON.stringify([1,5,2]),processingCounts.join('/'));

await page.locator('.wilderness-half--processing .forge-selector__tab').nth(1).click(); await page.waitForTimeout(120);
await page.locator('.wilderness-processing-row .foundry-collect-btn--row').click();
await page.waitForTimeout(1050);
const processingAfter=await saved();
check('collecting Bench II transfers Timber to Crafted and only from Bench II',
  processingAfter.craftedInventory.timber===5 && processingAfter.processedInventory.timber==null
    && !processingAfter.processingOutputQueues['2'].timber,
  JSON.stringify({crafted:processingAfter.craftedInventory,processed:processingAfter.processedInventory,queues:processingAfter.processingOutputQueues}));
check('other Processing outputs remain waiting',
  processingAfter.processingOutputQueues['1'].timber===1 && processingAfter.processingOutputQueues['3'].lumber===2,
  JSON.stringify(processingAfter.processingOutputQueues));
check('row-level Processing collection leaves its bonus queue untouched',
  processingAfter.processingRewardQueue.coins===11 && processingAfter.processingRewardQueue.blooming_mote===3,
  JSON.stringify(processingAfter.processingRewardQueue));

await page.locator('.wilderness-queue--processing-bonus .wilderness-collect-btn').click();
await page.waitForTimeout(1050);
const bonusAfter=await saved();
check('the Processing bonus button collects only bonuses',
  bonusAfter.processingRewardQueue.coins===0 && bonusAfter.processingRewardQueue.blooming_mote===0
    && bonusAfter.processingOutputQueues['1'].timber===1 && bonusAfter.processingOutputQueues['3'].lumber===2,
  JSON.stringify({rewards:bonusAfter.processingRewardQueue,queues:bonusAfter.processingOutputQueues}));

check('no console errors',errors.length===0,errors.slice(0,3).join(' | '));
await browser.close();
const failed=results.filter(r=>!r.pass);
console.log(`\n${results.length-failed.length}/${results.length} passed`);
if(failed.length){console.log('FAILURES:');failed.forEach(f=>console.log(`  - ${f.name}: ${f.detail}`));process.exit(1);}
