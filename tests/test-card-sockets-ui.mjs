import { chromium } from 'playwright';
import { enterGame } from './enter.mjs';

const URL_ = process.env.TEST_URL ?? 'http://localhost:5199/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

await page.goto(URL_, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await enterGame(page);

const enter = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
if (await enter.count()) await enter.click();

await page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('tcg-sim'));
  const card = {
    id: 'socket-ui-card',
    name: 'Socket Test Prospector',
    classType: 'prospector',
    artVariant: 0,
    rarity: 'legendary',
    tier: 1,
    tag: null,
    value: 100,
    affixes: [{ id: 'miningLuck', stat: 'miningLuck', value: 20 }],
    socketCount: 2,
    gemSockets: [null, null],
  };
  save.collection = [card];
  save.pocket = [{ ...card }];
  save.gatheredInventory = {
    ...(save.gatheredInventory ?? {}),
    dull_ruby: 1,
    dull_topaz: 1,
    dull_diamond: 1,
  };
  save.oreInventory = { ...(save.oreInventory ?? {}), stone: 5, coal: 5 };
  save.craftedInventory = {
    ...(save.craftedInventory ?? {}),
    gemsettersChisel: 1,
    gemExtractor: 1,
  };
  localStorage.setItem('tcg-sim', JSON.stringify(save));
});

await page.reload({ waitUntil: 'networkidle' });
await enterGame(page);
const resume = page.locator('.splash button', { hasText: /^(Enter|Resume)$/ }).first();
if (await resume.count()) await resume.click();

await page.locator('.hand__lift').click();
await page.locator('.card-crafting-modal').waitFor();

const checks = [];
const check = async (name, condition, detail = '') => {
  const pass = Boolean(await condition);
  checks.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

await check('pressing a Hand card opens the full card-crafting view', page.locator('.card-crafting-modal__face').count().then(count => count === 1));
await check('the Bag remains open and above the crafting view', page.locator('.inventory-panel--open.inventory-panel--crafting').count().then(count => count === 1));
await check('the enlarged card begins with its two rolled sockets', page.locator('.card-crafting-modal__face .card-socket').count().then(count => count === 2));
await check('inspection view contains only the enlarged card', page.locator('.card-crafting-modal__panel, .card-crafting-modal__workbench, .card-crafting-modal__eyebrow').count().then(count => count === 0));
const cardBounds = await page.locator('.card-crafting-modal__face').boundingBox();
await check('the inspected card is centered against the full viewport',
  cardBounds && Math.abs((cardBounds.x + cardBounds.width / 2) - 720) <= 2,
  cardBounds ? `center=${cardBounds.x + cardBounds.width / 2}` : 'missing card');

await page.locator('.card-crafting-modal').click({ position: { x: 10, y: 10 } });
await page.locator('.card-crafting-modal').waitFor({ state: 'detached' });
await page.locator('.hand__lift').click();
await page.locator('.card-crafting-modal').waitFor();
await check('the same Hand card can be closed and reopened reliably',
  page.locator('.card-crafting-modal__face').count().then(count => count === 1));

await page.locator('[data-resource-drop-target="crafted:gemsettersChisel"]').click();
await check('clicking a Chisel picks up one unit without consuming or applying it', page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('tcg-sim'));
  return document.querySelector('.carried-resource-cursor')
    && document.querySelectorAll('.card-crafting-modal__face .card-socket').length === 2
    && save.craftedInventory.gemsettersChisel === 1;
}));
await page.locator('.card-crafting-modal__face').click();
await check('clicking the enlarged card consumes the held Chisel and cuts the socket',
  page.locator('.card-crafting-modal__face .card-socket').count().then(async count => count === 3
    && await page.locator('.carried-resource-cursor').count() === 0));

const socketGeometry = await page.locator('.card-crafting-modal__face .card-socket').evaluateAll((nodes, card) => ({
  card: card.getBoundingClientRect().toJSON(),
  sockets: nodes.map(node => ({
    rect: node.getBoundingClientRect().toJSON(),
    background: getComputedStyle(node).backgroundImage,
    shadow: getComputedStyle(node).boxShadow,
  })),
}), await page.locator('.card-crafting-modal__face').elementHandle());
await check('socket one occupies the inset bottom-right corner and later sockets stack upward with space', (() => {
  const [first, second, third] = socketGeometry.sockets;
  if (!first || !second || !third) return false;
  const firstInsetRight = socketGeometry.card.right - first.rect.right;
  const firstInsetBottom = socketGeometry.card.bottom - first.rect.bottom;
  return first.rect.width >= 38
    && firstInsetRight >= 12
    && firstInsetBottom >= 12
    && first.rect.y > second.rect.y
    && second.rect.y > third.rect.y
    && first.rect.y - second.rect.bottom >= 8;
})());
await check('empty sockets use an inset radial treatment that reads as concave',
  socketGeometry.sockets.every(socket => socket.background.includes('radial-gradient') && socket.shadow.includes('inset')));

await page.locator('[data-resource-drop-target="gathered:dull_ruby"]').click();
await check('clicking a Bag gem picks up one unit without filling a socket', page.evaluate(() => (
  Boolean(document.querySelector('.carried-resource-cursor'))
    && document.querySelectorAll('.card-crafting-modal__face .card-socket--filled').length === 0
)));
await page.locator('.card-crafting-modal__face').click();
await check('clicking the displayed card commits and consumes the held gem',
  page.locator('.card-crafting-modal__face .card-socket--filled').count().then(async count => count === 1
    && await page.locator('.carried-resource-cursor').count() === 0));
await page.locator('.card-crafting-modal__face .card-socket--filled').hover();
await check('hovering a socketed gem in inspection shows its in-game effect tooltip',
  page.locator('.card-socket-tooltip').evaluate(node => (
    node.textContent.includes('Dull Ruby') && node.textContent.includes('Overflow')
  )));

await page.locator('[data-resource-drop-target="crafted:gemExtractor"]').click();
await page.locator('.card-crafting-modal__face .card-socket--filled').click();
await check('an Extractor removes the selected gem without removing its socket',
  page.locator('.card-crafting-modal__face .card-socket').count().then(async count => count === 3
    && await page.locator('.card-crafting-modal__face .card-socket--filled').count() === 0));

await page.locator('[data-resource-drop-target="gathered:dull_ruby"]').click();
await page.locator('.card-crafting-modal__face').click();

await page.locator('[data-resource-drop-target="gathered:dull_topaz"]').click();
await page.locator('[data-resource-drop-target="ore:stone"]').click();
await check('a selected Topaz imprint appears side by side above the crafting Bag', page.evaluate(() => {
  const preview = document.querySelector('.carried-resource-cursor-group--linked');
  const bag = document.querySelector('.inventory-panel--crafting');
  const names = [...(preview?.querySelectorAll('.carried-resource-cursor__name') ?? [])].map(node => node.textContent);
  return preview
    && preview.querySelectorAll('.carried-resource-cursor').length === 2
    && names[0] === 'Dull Topaz'
    && names[1] === 'Stone'
    && Number(getComputedStyle(preview).zIndex) > Number(getComputedStyle(bag).zIndex);
}));
await page.locator('[data-resource-drop-target="ore:coal"]').click();
await check('clicking another eligible imprint replaces the preview without committing it', page.evaluate(() => {
  const names = [...document.querySelectorAll('.carried-resource-cursor-group--linked .carried-resource-cursor__name')]
    .map(node => node.textContent);
  return names[0] === 'Dull Topaz'
    && names[1] === 'Coal'
    && document.querySelectorAll('.card-crafting-modal__face .card-socket--filled').length === 1;
}));
await page.locator('[data-resource-drop-target="ore:stone"]').click();
await check('choosing a Topaz imprint does not consume or socket the held gem yet', page.evaluate(() => (
  Boolean(document.querySelector('.carried-resource-cursor'))
    && document.querySelectorAll('.card-crafting-modal__face .card-socket--filled').length === 1
)));
await page.locator('.card-crafting-modal__face').click();
await check('Topaz consumes an eligible Bag target and records its imprint', page.locator('.card-crafting-modal__face .card-socket--filled').count().then(count => count === 2));

await page.locator('[data-resource-drop-target="gathered:dull_diamond"]').click();
await page.locator('.card-crafting-modal__face .card-affix-line').first().click();
await check('choosing a Diamond affix does not consume or socket the held gem yet', page.evaluate(() => (
  Boolean(document.querySelector('.carried-resource-cursor'))
    && document.querySelectorAll('.card-crafting-modal__face .card-socket--filled').length === 2
)));
await page.locator('.card-crafting-modal__face').click();
await check('Diamond binds directly to an existing affix on the card', page.locator('.card-crafting-modal__face .card-socket--filled').count().then(count => count === 3));

await page.waitForTimeout(2300);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tcg-sim')));
const savedCard = saved.collection.find(card => card.id === 'socket-ui-card');
await check('socket bindings persist in the save',
  savedCard?.gemSockets?.[1]?.boundResourceId === 'stone' && savedCard?.gemSockets?.[2]?.boundAffixId === 'miningLuck');
await check('socketing consumes the three gems and Topaz imprint material',
  saved.gatheredInventory.dull_ruby === 0
    && saved.gatheredInventory.dull_topaz === 0
    && saved.gatheredInventory.dull_diamond === 0
    && saved.oreInventory.stone === 4
    && saved.craftedInventory.gemsettersChisel === 0
    && saved.craftedInventory.gemExtractor === 0);
await check('the socketing flow produces no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(`\n${checks.filter(Boolean).length}/${checks.length} passed`);
if (checks.some(pass => !pass)) process.exit(1);
