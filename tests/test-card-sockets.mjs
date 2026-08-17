import { createServer } from 'vite';

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
});

const sockets = await vite.ssrLoadModule('/src/game/cardSockets.js');
const cards = await vite.ssrLoadModule('/src/game/cards.js');
const foundry = await vite.ssrLoadModule('/src/game/foundry.js');

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const sequence = values => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};

check('ordinary rarities can roll at most two sockets',
  sockets.rollCardSocketCount('common', () => 0.999999) === 2);
check('only Legendary and Mythic cards can retain the almost-never three-socket roll',
  sockets.rollCardSocketCount('legendary', () => 0.999999) === 3
    && sockets.rollCardSocketCount('mythic', () => 0.999999) === 3
    && sockets.rollCardSocketCount('epic', () => 0.999999) === 2);
check('zero sockets occupies the large majority of the roll table',
  sockets.CARD_SOCKET_WEIGHTS[0] > sockets.CARD_SOCKET_WEIGHTS[1] + sockets.CARD_SOCKET_WEIGHTS[2] + sockets.CARD_SOCKET_WEIGHTS[3]);

const cutCard = sockets.addCardSocket({ id: 'cut-test', rarity: 'rare', socketCount: 0 });
const cutAgain = sockets.addCardSocket(cutCard);
check('Chisels add permanent sockets up to the card rarity cap',
  cutCard?.socketCount === 1
    && cutAgain?.socketCount === 2
    && sockets.addCardSocket(cutAgain) === null);

const baseCard = {
  id: 'socket-test', classType: 'miner', rarity: 'legendary', tier: 1, socketCount: 3,
  gemSockets: [null, null, null],
  affixes: [{ id: 'miningLuck', stat: 'miningLuck', value: 20 }],
};
const rubyCard = sockets.socketGemOnCard(baseCard, 'royal_ruby');
const diamondCard = sockets.socketGemOnCard(rubyCard, 'royal_diamond', { boundAffixId: 'miningLuck' });
const topazCard = sockets.socketGemOnCard(diamondCard, 'royal_topaz', {
  boundResourceId: 'gold', boundSource: 'ore', boundName: 'Gold Ore',
});

check('socketing fills the next empty socket and preserves bindings',
  topazCard.gemSockets.length === 3
    && topazCard.gemSockets[0].gemId === 'royal_ruby'
    && topazCard.gemSockets[1].boundAffixId === 'miningLuck'
    && topazCard.gemSockets[2].boundResourceId === 'gold');
const extractedRuby = sockets.extractSocketedGem(topazCard, 0);
check('Extractors return the selected gem while preserving the empty socket',
  extractedRuby?.gemId === 'royal_ruby'
    && extractedRuby.card.socketCount === 3
    && extractedRuby.card.gemSockets[0] === null);
check('Diamond Resonance amplifies only its bound affix',
  cards.getCardAffixBonuses(diamondCard).miningLuck === 24);
check('Topaz Focus applies its tier value to the imprinted resource weight',
  sockets.getTopazWeightMultiplier(topazCard, 'gold', 'ore') === 2.1);

const finishedMine = {
  slotId: 1,
  card: rubyCard,
  tool: null,
  momentumStacks: 0,
  startedAt: 0,
  endsAt: 1,
  oreType: 'stone',
};
const overflow = foundry.resolveCompletedMiningSlots([finishedMine], 2, () => 0);
check('Ruby Overflow repeats base production without needing another card roll',
  overflow.completedQueue.stone === 2,
  JSON.stringify(overflow.completedQueue));

const emeraldCard = sockets.socketGemOnCard(baseCard, 'royal_emerald');
const fortunate = foundry.rollOreTypeForCard(emeraldCard, null, sequence([0, 0, 0.9]));
const fortunateTier = foundry.MINING_RESOURCE_TYPES.find(resource => resource.id === fortunate)?.tier ?? 1;
check('Emerald Fortune rolls twice and keeps the higher-tier result', fortunateTier > 1, fortunate);

const sapphireCard = sockets.socketGemOnCard(baseCard, 'royal_sapphire');
const momentum = sockets.applySapphireMomentum(sapphireCard, { startedAt: 1000, endsAt: 11000 }, 1000);
check('Sapphire Momentum starts the next cycle partially complete',
  momentum.startedAt < 1000 && momentum.endsAt < 11000,
  `${momentum.startedAt}-${momentum.endsAt}`);

const legacyGemdustFuel = foundry.normalizeForgeFuelState({
  slotId: 1,
  fuelType: 'gemdust',
  loadedCoal: 1,
  currentCoalCharges: foundry.FORGE_SMELTS_PER_COAL,
});
const spentGemdustFuel = foundry.consumeForgeFuelCharge(legacyGemdustFuel);
check('one Gemdust always powers exactly one fusion, including legacy five-charge saves',
  legacyGemdustFuel.currentCoalCharges === 1
    && spentGemdustFuel.loadedCoal === 0
    && spentGemdustFuel.currentCoalCharges === 0);
const coalFuel = foundry.addForgeFuel(foundry.createForgeFuelState(), 1, 'coal');
check('Coal retains its five-smelt charge behavior',
  coalFuel.currentCoalCharges === foundry.FORGE_SMELTS_PER_COAL
    && foundry.consumeForgeFuelCharge(coalFuel).currentCoalCharges === foundry.FORGE_SMELTS_PER_COAL - 1);

await vite.close();
const passed = results.filter(result => result.pass).length;
console.log(`\n${passed}/${results.length} passed`);
if (passed !== results.length) process.exit(1);
