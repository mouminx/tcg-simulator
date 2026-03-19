import { useState, useEffect, useRef } from 'react';
import Shop from './components/Shop';
import UnpackPage from './components/UnpackPage';
import Collection from './components/Collection';
import Market, { LEGENDARY_SLOT_PRICES, MYTHIC_SLOT_PRICES } from './components/Market';
import Lab from './components/Lab';
import Arcana from './components/Arcana';
import Foundry from './components/Foundry';
import Wilderness from './components/Wilderness';
import CardPocket from './components/CardPocket';
import Inventory from './components/Inventory';
import { ARCANA_ITEMS_BY_ID, DEFAULT_RESOURCES } from './game/arcana';
import { openBlankSlatePack } from './game/arcanaPackOpening';
import {
  ORE_TYPES,
  DEFAULT_ORE_INVENTORY,
  DEFAULT_INGOT_INVENTORY,
  DEFAULT_MINE_SLOT_CAPACITY,
  FORGE_FUEL_TYPE,
  MAX_MINE_SLOT_CAPACITY,
  ORE_TO_INGOT,
  SMELT_RECIPES,
  INGOT_RESOURCES,
  addOreCounts,
  addForgeFuel,
  clampMineSlotCapacity,
  createForgeCardSlots,
  createForgeFuelState,
  createForgeFuelSlots,
  createForgeIngredientSlots,
  createForgeOreSlots,
  createMiningSlots,
  getMineSlotUpgradeCost,
  normalizeForgeCardSlots,
  normalizeForgeIngredientSlots,
  normalizeForgeFuelSlots,
  normalizeForgeOreSlots,
  normalizeMiningSlots,
  resolveCompletedMiningSlots,
  consumeForgeFuelCharge,
  startForgeCycle,
  startMiningSlots,
  hasQueuedOre,
  BASE_GOLD_PER_PRODUCTION,
} from './game/foundry';
import {
  DEFAULT_GATHERING_INVENTORY,
  DEFAULT_PROCESSED_INVENTORY,
  addGatheredCounts,
  addProcessedCounts,
  createGatheringSlots,
  createProcessingSlots,
  hasQueuedGatheredResources,
  hasQueuedProcessedResources,
  normalizeProcessingSlots,
  PROCESSING_RECIPES,
  normalizeGatheringSlots,
  resolveCompletedProcessingSlots,
  resolveCompletedGatheringSlots,
  startProcessingSlot,
  startGatheringSlots,
} from './game/wilderness';
import { openPack, openWelcomePack, PACK_TYPES, STARTING_BALANCE, getGradeCost, getImprintCost, getCardSellValue, migrateCreatureCard, resolveCardName, getCardAffixBonuses } from './game/cards';
import Gold from './components/Gold';
import './App.css';

const VIEWS = { SHOP: 'shop', UNPACK: 'unpack', COLLECTION: 'collection', ARCANA: 'arcana', FOUNDRY: 'foundry', WILDERNESS: 'wilderness', LAB: 'lab', MARKET: 'market' };
const TAB_ICONS = { shop: '⊙', unpack: '✦', collection: '⊞', arcana: '◌', foundry: '⚒', wilderness: '❈', market: '↗', lab: '⚗' };
const VIEW_ORDER = [VIEWS.SHOP, VIEWS.UNPACK, VIEWS.COLLECTION, VIEWS.ARCANA, VIEWS.FOUNDRY, VIEWS.WILDERNESS, VIEWS.LAB, VIEWS.MARKET];
const TAB_ACCENTS = {
  [VIEWS.SHOP]: '#f5f5f5',
  [VIEWS.UNPACK]: '#e8c97a',
  [VIEWS.COLLECTION]: '#d4a44c',
  [VIEWS.ARCANA]: '#9cc9ff',
  [VIEWS.FOUNDRY]: '#ff9a36',
  [VIEWS.WILDERNESS]: '#7fb86d',
  [VIEWS.LAB]: '#c58cff',
  [VIEWS.MARKET]: '#7dd3a7',
};

const SAVE_VERSION = 15;
const POCKET_SYSTEM_VERSION = 1;
const WELCOME_PACK_TYPE = {
  id: 'welcome', name: 'Welcome Pack', subtitle: 'Pack', cardCount: 9,
  cost: 0, stars: '✦',
  description: 'One of every class · Tier I commons · Free',
  rarityWeights: { common: 100 },
  tierWeights: { 1: 100 },
};
const DEFAULT_MARKET = { legendarySlots: 0, mythicSlots: 0 };
const DEFAULT_POCKET_CAPACITY = 3;
const MAX_POCKET_CAPACITY = 10;
const POCKET_SLOT_COSTS = {
  3: 20,
  4: 45,
  5: 90,
  6: 160,
  7: 275,
  8: 440,
  9: 680,
};

function sameCardId(left, right) {
  return String(left) === String(right);
}

function clampPocketCapacity(capacity) {
  return Math.max(DEFAULT_POCKET_CAPACITY, Math.min(capacity ?? DEFAULT_POCKET_CAPACITY, MAX_POCKET_CAPACITY));
}

function getPocketUpgradeCost(capacity) {
  return POCKET_SLOT_COSTS[capacity] ?? null;
}


function migrateCards(cards = []) {
  return cards.map(card => migrateCreatureCard(card));
}

function loadState() {
  try {
    const saved = localStorage.getItem('tcg-sim');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Accept saves from version 9 (creature cards) through current version
      if ((parsed.version ?? 0) <= SAVE_VERSION) {
        const needsCardMigration = (parsed.version ?? 0) < 10;
        if (needsCardMigration) {
          parsed.collection  = migrateCards(parsed.collection ?? []);
          parsed.pocket      = migrateCards(parsed.pocket ?? []);
          // Migrate cards slotted in active systems
          if (Array.isArray(parsed.mineSlots)) {
            parsed.mineSlots = parsed.mineSlots.map(slot =>
              slot?.card ? { ...slot, card: migrateCreatureCard(slot.card) } : slot,
            );
          }
          if (Array.isArray(parsed.forgeCardSlots)) {
            parsed.forgeCardSlots = parsed.forgeCardSlots.map(slot =>
              slot?.card ? { ...slot, card: migrateCreatureCard(slot.card) } : slot,
            );
          }
          if (Array.isArray(parsed.gatheringSlots)) {
            parsed.gatheringSlots = parsed.gatheringSlots.map(slot =>
              slot?.card ? { ...slot, card: migrateCreatureCard(slot.card) } : slot,
            );
          }
          if (Array.isArray(parsed.processingSlots)) {
            parsed.processingSlots = parsed.processingSlots.map(slot =>
              slot?.card ? { ...slot, card: migrateCreatureCard(slot.card) } : slot,
            );
          }
        }
        const needsNameResolution = (parsed.version ?? 0) < 11;
        if (needsNameResolution) {
          const resolveNames = cards => (cards ?? []).map(card =>
            card.classType
              ? { ...card, name: resolveCardName(card.classType, card.rarity, card.tier ?? 1) }
              : card,
          );
          parsed.collection = resolveNames(parsed.collection);
          parsed.pocket     = resolveNames(parsed.pocket);
          if (Array.isArray(parsed.mineSlots)) {
            parsed.mineSlots = parsed.mineSlots.map(slot =>
              slot?.card?.classType ? { ...slot, card: { ...slot.card, name: resolveCardName(slot.card.classType, slot.card.rarity, slot.card.tier ?? 1) } } : slot,
            );
          }
          if (Array.isArray(parsed.forgeCardSlots)) {
            parsed.forgeCardSlots = parsed.forgeCardSlots.map(slot =>
              slot?.card?.classType ? { ...slot, card: { ...slot.card, name: resolveCardName(slot.card.classType, slot.card.rarity, slot.card.tier ?? 1) } } : slot,
            );
          }
          if (Array.isArray(parsed.gatheringSlots)) {
            parsed.gatheringSlots = parsed.gatheringSlots.map(slot =>
              slot?.card?.classType ? { ...slot, card: { ...slot.card, name: resolveCardName(slot.card.classType, slot.card.rarity, slot.card.tier ?? 1) } } : slot,
            );
          }
          if (Array.isArray(parsed.processingSlots)) {
            parsed.processingSlots = parsed.processingSlots.map(slot =>
              slot?.card?.classType ? { ...slot, card: { ...slot.card, name: resolveCardName(slot.card.classType, slot.card.rarity, slot.card.tier ?? 1) } } : slot,
            );
          }
        }
        return parsed;
      }
    }
  } catch {}
  return {
    balance: STARTING_BALANCE,
    collection: [],
    packs: [{ id: 'welcome-pack', packTypeId: 'welcome' }],
    market: DEFAULT_MARKET,
    resources: DEFAULT_RESOURCES,
    arcanaInventory: [],
    oreInventory: DEFAULT_ORE_INVENTORY,
    ingotInventory: DEFAULT_INGOT_INVENTORY,
    mineSlots: createMiningSlots(DEFAULT_MINE_SLOT_CAPACITY),
    mineSlotCapacity: DEFAULT_MINE_SLOT_CAPACITY,
    mineClaimQueue: DEFAULT_ORE_INVENTORY,
    forgeCardSlots: createForgeCardSlots(),
    forgeOreSlots: createForgeOreSlots(),
    forgeIngredientSlots: createForgeIngredientSlots(),
    forgeFuelSlots: createForgeFuelSlots(),
    ingotClaimQueue: DEFAULT_INGOT_INVENTORY,
    gatheredInventory: DEFAULT_GATHERING_INVENTORY,
    processedInventory: DEFAULT_PROCESSED_INVENTORY,
    gatheringSlots: createGatheringSlots(),
    gatheringClaimQueue: DEFAULT_GATHERING_INVENTORY,
    processingSlots: createProcessingSlots(),
    processedClaimQueue: DEFAULT_PROCESSED_INVENTORY,
    pocket: [],

    pocketCapacity: DEFAULT_POCKET_CAPACITY,
    pocketSystemVersion: POCKET_SYSTEM_VERSION,
  };
}

function saveState(state) {
  localStorage.setItem('tcg-sim', JSON.stringify({
    ...state,
    version: SAVE_VERSION,
    pocketSystemVersion: POCKET_SYSTEM_VERSION,
  }));
}

export default function App() {
  const initialState = useRef(null);
  if (initialState.current === null) initialState.current = loadState();
  const savedState = initialState.current;
  const isLegacyPocketState = savedState.pocketSystemVersion == null;
  const migratedPocketCapacity = (() => {
    const savedCapacity = savedState.pocketCapacity;
    if (isLegacyPocketState && savedCapacity === 10) return DEFAULT_POCKET_CAPACITY;
    return clampPocketCapacity(savedCapacity);
  })();

  const [balance, setBalance] = useState(() => savedState.balance);
  const [collection, setCollection] = useState(() => savedState.collection);
  const [packs, setPacks] = useState(() => savedState.packs ?? []);
  const [market, setMarket] = useState(() => ({ ...DEFAULT_MARKET, ...(savedState.market ?? {}) }));
  const [resources, setResources] = useState(() => ({ ...DEFAULT_RESOURCES, ...(savedState.resources ?? {}) }));
  const [arcanaInventory, setArcanaInventory] = useState(() => savedState.arcanaInventory ?? []);
  const [oreInventory, setOreInventory] = useState(() => ({ ...DEFAULT_ORE_INVENTORY, ...(savedState.oreInventory ?? {}) }));
  const [ingotInventory, setIngotInventory] = useState(() => ({ ...DEFAULT_INGOT_INVENTORY, ...(savedState.ingotInventory ?? {}) }));
  const [mineSlotCapacity, setMineSlotCapacity] = useState(() => clampMineSlotCapacity(savedState.mineSlotCapacity));
  const [mineSlots, setMineSlots] = useState(() => normalizeMiningSlots(savedState.mineSlots, savedState.mineSlotCapacity));
  const [mineClaimQueue, setMineClaimQueue] = useState(() => ({ ...DEFAULT_ORE_INVENTORY, ...(savedState.mineClaimQueue ?? {}) }));
  const [forgeCardSlots, setForgeCardSlots] = useState(() => normalizeForgeCardSlots(savedState.forgeCardSlots));
  const [forgeOreSlots, setForgeOreSlots] = useState(() => normalizeForgeOreSlots(savedState.forgeOreSlots));
  const [forgeIngredientSlots, setForgeIngredientSlots] = useState(() => normalizeForgeIngredientSlots(savedState.forgeIngredientSlots));
  const [forgeFuelSlots, setForgeFuelSlots] = useState(() => normalizeForgeFuelSlots(savedState.forgeFuelSlots, undefined, savedState.forgeFuel));
  const [ingotClaimQueue, setIngotClaimQueue] = useState(() => ({ ...DEFAULT_INGOT_INVENTORY, ...(savedState.ingotClaimQueue ?? {}) }));


  const [gatheredInventory, setGatheredInventory] = useState(() => ({ ...DEFAULT_GATHERING_INVENTORY, ...(savedState.gatheredInventory ?? {}) }));
  const [processedInventory, setProcessedInventory] = useState(() => ({ ...DEFAULT_PROCESSED_INVENTORY, ...(savedState.processedInventory ?? {}) }));
  const [gatheringSlots, setGatheringSlots] = useState(() => normalizeGatheringSlots(savedState.gatheringSlots));
  const [gatheringClaimQueue, setGatheringClaimQueue] = useState(() => ({ ...DEFAULT_GATHERING_INVENTORY, ...(savedState.gatheringClaimQueue ?? {}) }));
  const [processingSlots, setProcessingSlots] = useState(() => normalizeProcessingSlots(savedState.processingSlots));
  const [processedClaimQueue, setProcessedClaimQueue] = useState(() => ({ ...DEFAULT_PROCESSED_INVENTORY, ...(savedState.processedClaimQueue ?? {}) }));
  const [packsOpened, setPacksOpened] = useState(() => savedState.packsOpened ?? 0);
  const [pocket, setPocket] = useState(() => {
    const savedPocket = savedState.pocket ?? [];
    if (!Array.isArray(savedPocket) || savedPocket.length === 0) return [];
    const normalizedPocket = typeof savedPocket[0] === 'object'
      ? savedPocket.map(card => ({ ...card }))
      : (savedState.collection ?? [])
      .filter(card => savedPocket.some(cardId => sameCardId(card.id, cardId)))
      .map(card => ({ ...card }));

    return isLegacyPocketState && savedState.pocketCapacity === 10
      ? normalizedPocket.slice(0, DEFAULT_POCKET_CAPACITY)
      : normalizedPocket;
  });
  const [carriedResource, setCarriedResource] = useState(null);
  const [carriedResourceCursor, setCarriedResourceCursor] = useState({ x: 0, y: 0 });
  const [pocketCapacity, setPocketCapacity] = useState(() => migratedPocketCapacity);
  const [view, setView] = useState(VIEWS.SHOP);
  const [pendingCards, setPendingCards] = useState([]);
  const [pendingEssenceDrops, setPendingEssenceDrops] = useState([]);
  const [pendingPackType, setPendingPackType] = useState(null);

  const [inventoryOpen, setInventoryOpen] = useState(true);
  const inventoryHeaderRef = useRef(null);

  const tabRefs = useRef([]);
  const unpackBtnRef = useRef(null);
  const collectionBtnRef = useRef(null);
  const arcanaBtnRef = useRef(null);
  const [underline, setUnderline] = useState({ left: 0, width: 0 });

  const [displayBalance, setDisplayBalance] = useState(balance);
  const [balancePumping, setBalancePumping] = useState(false);
  const prevBalanceRef = useRef(balance);
  const balanceAnimRef = useRef(null);

  const mineSlotsRef = useRef(mineSlots);
  mineSlotsRef.current = mineSlots;
  const gatheringSlotsRef = useRef(gatheringSlots);
  gatheringSlotsRef.current = gatheringSlots;
  const processingSlotsRef = useRef(processingSlots);
  processingSlotsRef.current = processingSlots;
  const mineClaimQueueRef = useRef(mineClaimQueue);
  mineClaimQueueRef.current = mineClaimQueue;

  useEffect(() => {
    const prev = prevBalanceRef.current;
    prevBalanceRef.current = balance;
    if (balance <= prev) { setDisplayBalance(balance); return; }
    if (balanceAnimRef.current) cancelAnimationFrame(balanceAnimRef.current);
    const from = prev, to = balance, duration = 700, t0 = performance.now();
    setBalancePumping(true);
    function step(now) {
      const t = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayBalance(from + (to - from) * eased);
      if (t < 1) { balanceAnimRef.current = requestAnimationFrame(step); }
      else { setDisplayBalance(to); setBalancePumping(false); }
    }
    balanceAnimRef.current = requestAnimationFrame(step);
    return () => { if (balanceAnimRef.current) cancelAnimationFrame(balanceAnimRef.current); };
  }, [balance]);

  useEffect(() => {
    saveState({
      balance,
      collection,
      packs,
      market,
      resources,
      arcanaInventory,
      oreInventory,
      ingotInventory,
      mineSlots,
      mineSlotCapacity,
      mineClaimQueue,
      forgeCardSlots,
      forgeOreSlots,
      forgeIngredientSlots,
      forgeFuelSlots,
      ingotClaimQueue,
      gatheredInventory,
      processedInventory,
      gatheringSlots,
      gatheringClaimQueue,
      processingSlots,
      processedClaimQueue,
      packsOpened,
      pocket,
      pocketCapacity,
    });
  }, [balance, collection, packs, market, resources, arcanaInventory, oreInventory, ingotInventory, mineSlots, mineSlotCapacity, mineClaimQueue, forgeCardSlots, forgeOreSlots, forgeIngredientSlots, forgeFuelSlots, ingotClaimQueue, gatheredInventory, processedInventory, gatheringSlots, gatheringClaimQueue, processingSlots, processedClaimQueue, packsOpened, pocket, pocketCapacity]);

  useEffect(() => {
    setPocket(prev =>
      prev
        .map(pocketCard => collection.find(card => sameCardId(card.id, pocketCard.id)) ?? null)
        .filter(Boolean)
        .map(card => ({ ...card }))
    );
  }, [collection]);

  useEffect(() => {
    if (!carriedResource) return undefined;

    function handleMouseMove(event) {
      setCarriedResourceCursor({ x: event.clientX, y: event.clientY });
    }

    function handlePointerDown(event) {
      const target = event.target instanceof Element ? event.target.closest('[data-resource-drop-target]') : null;
      const expectedTarget = `${carriedResource.source}:${carriedResource.id}`;
      const targetKey = target?.getAttribute('data-resource-drop-target');
      const isExactMatch = targetKey === expectedTarget;
      const isArcanaRingTarget = targetKey === 'arcana-ring-slot' && carriedResource.source === 'arcana';
      const isForgeFuelTarget = targetKey === 'forge-fuel-slot' && carriedResource.id === FORGE_FUEL_TYPE;
      const isForgeOreTarget = targetKey === 'forge-ore-slot' && carriedResource.source === 'ore';
      const isForgeIngredientTarget = targetKey === 'forge-ingredient-slot' && carriedResource.source === 'ingot';
      const isWildernessProcessingTarget = targetKey === 'wilderness-processing-input-slot' && carriedResource.source === 'gathered';
      // Allow the event through — the slot's onPointerDown will handle placement
      if (isExactMatch || isArcanaRingTarget || isForgeFuelTarget || isForgeOreTarget || isForgeIngredientTarget || isWildernessProcessingTarget) return;
      // Clicked elsewhere — cancel carry
      restoreCarriedStack(carriedResource);
      setCarriedResource(null);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [carriedResource, arcanaInventory, gatheredInventory, ingotInventory, oreInventory, processedInventory]);

  useEffect(() => {
    setMineSlots(prev =>
      prev.map(slot => {
        if (!slot.card) return slot;
        const updatedCard = collection.find(card => sameCardId(card.id, slot.card.id));
        if (!updatedCard) {
          return { ...slot, card: null, startedAt: null, endsAt: null, oreType: null };
        }
        return { ...slot, card: { ...updatedCard } };
      })
    );
  }, [collection]);

  useEffect(() => {
    setForgeCardSlots(prev =>
      prev.map(slot => {
        if (!slot.card) return slot;
        const updatedCard = collection.find(card => sameCardId(card.id, slot.card.id));
        if (!updatedCard) return { ...slot, card: null };
        return { ...slot, card: { ...updatedCard } };
      })
    );
  }, [collection]);

  useEffect(() => {
    setGatheringSlots(prev =>
      prev.map(slot => {
        if (!slot.card) return slot;
        const updatedCard = collection.find(card => sameCardId(card.id, slot.card.id));
        if (!updatedCard) {
          return { ...slot, card: null, startedAt: null, endsAt: null, resourceId: null };
        }
        return { ...slot, card: { ...updatedCard } };
      })
    );
  }, [collection]);

  useEffect(() => {
    setProcessingSlots(prev =>
      prev.map(slot => {
        if (!slot.card) return slot;
        const updatedCard = collection.find(card => sameCardId(card.id, slot.card.id));
        if (!updatedCard) {
          return { ...slot, card: null, startedAt: null, endsAt: null };
        }
        return { ...slot, card: { ...updatedCard } };
      })
    );
  }, [collection]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      forgeCardSlots.forEach((cardSlot, slotIndex) => {
        const fuelSlot = forgeFuelSlots[slotIndex];
        const oreSlot = forgeOreSlots[slotIndex];
        const ingredientSlot = forgeIngredientSlots[slotIndex];
        if (!fuelSlot) return;

        const recipe = oreSlot?.oreType ? SMELT_RECIPES[oreSlot.oreType] : null;
        const oreRequired = recipe?.oreCount ?? 4;
        const ingredientRequired = recipe?.ingredient ?? null;
        const ingredientOk = !ingredientRequired || (
          ingredientSlot?.ingotType === ingredientRequired.type &&
          (ingredientSlot?.count ?? 0) >= ingredientRequired.count
        );

        const rowReady = Boolean(
          cardSlot?.card &&
          oreSlot?.oreType &&
          (oreSlot.count ?? 0) >= oreRequired &&
          ingredientOk &&
          fuelSlot.loadedCoal > 0 &&
          fuelSlot.currentCoalCharges > 0
        );

        if (rowReady && !fuelSlot.endsAt) {
          setForgeFuelSlots(prev =>
            prev.map((slot, index) => index === slotIndex ? startForgeCycle(slot, cardSlot.slotId, now, cardSlot.card) : slot)
          );
          return;
        }

        if (!fuelSlot.endsAt || fuelSlot.endsAt > now) return;
        if (!cardSlot?.card || !oreSlot?.oreType || (oreSlot.count ?? 0) < oreRequired || !ingredientOk) {
          setForgeFuelSlots(prev =>
            prev.map((slot, index) => index === slotIndex ? { ...slot, activeSlotId: null, startedAt: null, endsAt: null } : slot)
          );
          return;
        }

        const ingotId = ORE_TO_INGOT[oreSlot.oreType];
        const nextOreCount = Math.max(0, (oreSlot.count ?? 0) - oreRequired);

        const coinBonus = getCardAffixBonuses(cardSlot.card).coinGeneration ?? 0;
        const goldFromSmelt = BASE_GOLD_PER_PRODUCTION * (1 + coinBonus / 100);
        setBalance(b => Math.round((b + goldFromSmelt) * 100) / 100);

        setForgeOreSlots(prev => prev.map((slot, index) => {
          if (index !== slotIndex) return slot;
          return {
            ...slot,
            oreType: nextOreCount > 0 ? slot.oreType : null,
            count: nextOreCount,
          };
        }));

        if (ingredientRequired) {
          setForgeIngredientSlots(prev => prev.map((slot, index) => {
            if (index !== slotIndex) return slot;
            const remaining = (slot.count ?? 0) - ingredientRequired.count;
            return remaining > 0 ? { ...slot, count: remaining } : { ...slot, ingotType: null, count: 0 };
          }));
        }

        setIngotClaimQueue(prev => ({ ...prev, [ingotId]: (prev[ingotId] ?? 0) + 1 }));

        setForgeFuelSlots(prev =>
          prev.map((slot, index) => {
            if (index !== slotIndex) return slot;
            const consumed = consumeForgeFuelCharge({ ...slot, activeSlotId: null, startedAt: null, endsAt: null });
            return { ...consumed, activeSlotId: null, startedAt: null, endsAt: null };
          })
        );
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [forgeCardSlots, forgeOreSlots, forgeIngredientSlots, forgeFuelSlots]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      const { nextSlots, completedQueue, completedCount, goldEarned } = resolveCompletedMiningSlots(mineSlotsRef.current, now);
      if (!completedCount) return;
      setMineSlots(nextSlots);
      setMineClaimQueue(prev => addOreCounts(prev, completedQueue));
      if (goldEarned > 0) setBalance(b => Math.round((b + goldEarned) * 100) / 100);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      const { nextSlots, completedQueue, completedCount, goldEarned } = resolveCompletedGatheringSlots(gatheringSlotsRef.current, now);
      if (!completedCount) return;
      setGatheringSlots(nextSlots);
      setGatheringClaimQueue(prev => addGatheredCounts(prev, completedQueue));
      if (goldEarned > 0) setBalance(b => Math.round((b + goldEarned) * 100) / 100);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      const { nextSlots, completedQueue, completedCount, goldEarned } = resolveCompletedProcessingSlots(processingSlotsRef.current, now);
      if (!completedCount) return;
      setProcessingSlots(nextSlots);
      setProcessedClaimQueue(prev => addProcessedCounts(prev, completedQueue));
      if (goldEarned > 0) setBalance(b => Math.round((b + goldEarned) * 100) / 100);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const tabIndex = VIEW_ORDER.indexOf(view);
    if (tabIndex === -1) return;
    const tab = tabRefs.current[tabIndex];
    if (tab) setUnderline({ left: tab.offsetLeft, width: tab.offsetWidth });
  }, [view]);

  function handleBuyPack(packTypeId) {
    const pt = PACK_TYPES[packTypeId];
    if (!pt || balance < pt.cost) return;
    setBalance(b => Math.round((b - pt.cost) * 100) / 100);
    setPacks(prev => [...prev, { id: Date.now() + Math.random(), packTypeId }]);
  }

  function handleOpenPack(packId, options = {}) {
    const pack = packs.find(p => p.id === packId);
    if (!pack) return false;
    const boosted = packsOpened < 3;
    let cards;

    if (pack.packTypeId === 'welcome') {
      cards = openWelcomePack();
      setPendingEssenceDrops([]);
    } else if (pack.packTypeId === 'blankSlate') {
      const result = openBlankSlatePack({
        packTypeId: pack.packTypeId,
        boosted,
        attunementLoadout: options.attunementLoadout ?? null,
        arcanaInventory,
        resourceBalances: resources,
      });
      if (!result.ok) return false;
      cards = result.cards;
      setArcanaInventory(result.nextArcanaInventory);
      setResources(result.nextResources);
      setPendingEssenceDrops(result.essenceDrops);
    } else {
      cards = openPack(pack.packTypeId ?? 'iron', boosted);
      setPendingEssenceDrops([]);
    }

    setPacks(prev => prev.filter(p => p.id !== packId));
    setPendingCards(cards);
    setPendingPackType(PACK_TYPES[pack.packTypeId] ?? WELCOME_PACK_TYPE);
    setPacksOpened(n => n + 1);
    return true;
  }

  function handlePackDone() {
    setCollection(prev => [...prev, ...pendingCards]);
    setPendingCards([]);
    setPendingEssenceDrops([]);
    setPendingPackType(null);
  }

  function handleRingCraft(itemId, placedResourceIds = []) {
    const item = ARCANA_ITEMS_BY_ID[itemId];
    if (!item) return { ok: false, reason: 'unknown_item' };

    const nextResources = { ...resources };
    for (const resourceId of placedResourceIds) {
      const have = nextResources[resourceId] ?? 0;
      if (have < 1) return { ok: false, reason: 'insufficient_resources' };
      nextResources[resourceId] = have - 1;
    }

    const newEntry = {
      inventoryEntryId: `arcana-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      itemId,
      name: item.name,
      category: item.category,
      description: item.description,
      effect: item.effect,
      craftedAt: new Date().toISOString(),
    };

    setResources({ ...DEFAULT_RESOURCES, ...nextResources });
    setArcanaInventory(prev => [...prev, newEntry]);
    return { ok: true, craftedCount: 1 };
  }

  function removeFromPocket(cardId) {
    setPocket(prev => prev.filter(card => !sameCardId(card.id, cardId)));
  }

  function clearMiningCards(cardIds) {
    const ids = Array.isArray(cardIds) ? cardIds : [cardIds];
    setMineSlots(prev =>
      prev.map(slot =>
        slot.card && ids.some(cardId => sameCardId(slot.card.id, cardId))
          ? { ...slot, card: null, startedAt: null, endsAt: null, oreType: null }
          : slot
      )
    );
  }

  function clearGatheringCards(cardIds) {
    const ids = Array.isArray(cardIds) ? cardIds : [cardIds];
    setGatheringSlots(prev =>
      prev.map(slot =>
        slot.card && ids.some(cardId => sameCardId(slot.card.id, cardId))
          ? { ...slot, card: null, startedAt: null, endsAt: null, resourceId: null }
          : slot
      )
    );
  }

  function clearProcessingCards(cardIds) {
    const ids = Array.isArray(cardIds) ? cardIds : [cardIds];
    setProcessingSlots(prev =>
      prev.map(slot =>
        slot.card && ids.some(cardId => sameCardId(slot.card.id, cardId))
          ? { ...slot, card: null, startedAt: null, endsAt: null }
          : slot
      )
    );
  }

  function clearForgeCards(cardIds) {
    const ids = Array.isArray(cardIds) ? cardIds : [cardIds];
    setForgeCardSlots(prev =>
      prev.map(slot =>
        slot.card && ids.some(cardId => sameCardId(slot.card.id, cardId))
          ? { ...slot, card: null }
          : slot
      )
    );
  }

  function handlePocketAdd(cardId) {
    if (pocket.length >= pocketCapacity) return;
    if (pocket.some(card => sameCardId(card.id, cardId))) return;
    const card = collection.find(c => sameCardId(c.id, cardId));
    if (!card) return;
    setPocket(prev => [...prev, { ...card }]);
  }

  function handleUnlockPocketSlot() {
    const cost = getPocketUpgradeCost(pocketCapacity);
    if (!cost || balance < cost || pocketCapacity >= MAX_POCKET_CAPACITY) return false;
    setBalance(b => Math.round((b - cost) * 100) / 100);
    setPocketCapacity(prev => clampPocketCapacity(prev + 1));
    return true;
  }

  function handlePocketRemove(cardId) {
    removeFromPocket(cardId);
  }

  function getAvailableResourceCount(source, id) {
    if (source === 'ore') return oreInventory[id] ?? 0;
    if (source === 'ingot') return ingotInventory[id] ?? 0;
    if (source === 'gathered') return gatheredInventory[id] ?? 0;
    if (source === 'processed') return processedInventory[id] ?? 0;
    if (source === 'arcana') return resources[id] ?? 0;
    if (source === 'arcana-item') return arcanaInventory.filter(item => item.itemId === id).length;
    return 0;
  }

  function setInventoryResourceCount(source, id, nextCount) {
    const safeCount = Math.max(0, Math.floor(Number(nextCount) || 0));
    if (source === 'ore') {
      setOreInventory(prev => ({ ...prev, [id]: safeCount }));
      return;
    }
    if (source === 'ingot') {
      setIngotInventory(prev => ({ ...prev, [id]: safeCount }));
      return;
    }
    if (source === 'gathered') {
      setGatheredInventory(prev => ({ ...prev, [id]: safeCount }));
      return;
    }
    if (source === 'processed') {
      setProcessedInventory(prev => ({ ...prev, [id]: safeCount }));
      return;
    }
    if (source === 'arcana') {
      setResources(prev => ({ ...prev, [id]: safeCount }));
    }
  }

  function restoreCarriedStack(stack) {
    if (!stack) return;
    if (stack.source === 'arcana-item') {
      if (!Array.isArray(stack.entries) || stack.entries.length === 0) return;
      setArcanaInventory(prev => [...prev, ...stack.entries]);
      return;
    }
    setInventoryResourceCount(
      stack.source,
      stack.id,
      getAvailableResourceCount(stack.source, stack.id) + stack.count,
    );
  }

  function handleBeginCarry({ source, id, name, amount }) {
    const requested = Math.max(1, Math.floor(Number(amount) || 0));
    const available = getAvailableResourceCount(source, id);
    if (!requested || available < requested) return false;
    if (source === 'arcana-item') {
      const matchingEntries = arcanaInventory.filter(item => item.itemId === id);
      const selectedEntries = matchingEntries.slice(0, requested);
      if (selectedEntries.length < requested) return false;
      const selectedIds = new Set(selectedEntries.map(item => item.inventoryEntryId));
      setArcanaInventory(prev => prev.filter(item => !selectedIds.has(item.inventoryEntryId)));
      setCarriedResource({
        key: `${source}:${id}`,
        source,
        id,
        name,
        count: requested,
        entries: selectedEntries,
      });
      return true;
    }
    setInventoryResourceCount(source, id, available - requested);
    setCarriedResource({ key: `${source}:${id}`, source, id, name, count: requested });
    return true;
  }

  function handlePickUpForgeFuel(slotId, amount) {
    const requested = Math.max(1, Math.floor(Number(amount) || 0));
    if (!requested) return false;
    const slot = forgeFuelSlots.find(s => s.slotId === slotId);
    if (!slot || slot.loadedCoal < requested) return false;
    setForgeFuelSlots(prev => prev.map(s =>
      s.slotId === slotId ? { ...s, loadedCoal: s.loadedCoal - requested } : s
    ));
    setCarriedResource({ key: 'gathered:coal', source: 'gathered', id: FORGE_FUEL_TYPE, name: 'Coal', count: requested });
    return true;
  }

  function handlePickUpForgeOre(slotId, amount) {
    const requested = Math.max(1, Math.floor(Number(amount) || 0));
    if (!requested) return false;
    const slot = forgeOreSlots.find(s => s.slotId === slotId);
    if (!slot || !slot.oreType || slot.count < requested) return false;
    const remaining = slot.count - requested;
    setForgeOreSlots(prev => prev.map(s =>
      s.slotId === slotId
        ? remaining > 0 ? { ...s, count: remaining } : { ...s, oreType: null, count: 0 }
        : s
    ));
    const ore = ORE_TYPES.find(o => o.id === slot.oreType);
    setCarriedResource({ key: `ore:${slot.oreType}`, source: 'ore', id: slot.oreType, name: ore?.name ?? slot.oreType, count: requested });
    return true;
  }

  function handleLoadForgeIngredientFromCarry(slotId) {
    if (!carriedResource || carriedResource.source !== 'ingot') return false;
    const slotIndex = forgeIngredientSlots.findIndex(s => s.slotId === slotId);
    if (slotIndex < 0) return false;
    const oreSlot = forgeOreSlots[slotIndex];
    const recipe = oreSlot?.oreType ? SMELT_RECIPES[oreSlot.oreType] : null;
    const required = recipe?.ingredient;
    if (!required || required.type !== carriedResource.id) return false;
    const ingSlot = forgeIngredientSlots[slotIndex];
    if (ingSlot.ingotType && ingSlot.ingotType !== carriedResource.id) return false;
    setForgeIngredientSlots(prev =>
      prev.map(s =>
        s.slotId === slotId
          ? { ...s, ingotType: carriedResource.id, count: (s.count ?? 0) + carriedResource.count }
          : s
      )
    );
    setCarriedResource(null);
    return true;
  }

  function handleUnsocketForgeIngredient(slotId) {
    let removed = null;
    setForgeIngredientSlots(prev =>
      prev.map(s => {
        if (s.slotId !== slotId || !s.ingotType || !(s.count > 0)) return s;
        removed = { id: s.ingotType, count: s.count };
        return { ...s, ingotType: null, count: 0 };
      })
    );
    if (removed) setIngotInventory(prev => ({ ...prev, [removed.id]: (prev[removed.id] ?? 0) + removed.count }));
    return Boolean(removed);
  }

  function handlePickUpForgeIngredient(slotId, amount) {
    const requested = Math.max(1, Math.floor(Number(amount) || 0));
    if (!requested) return false;
    const slot = forgeIngredientSlots.find(s => s.slotId === slotId);
    if (!slot || !slot.ingotType || slot.count < requested) return false;
    const remaining = slot.count - requested;
    setForgeIngredientSlots(prev => prev.map(s =>
      s.slotId === slotId
        ? remaining > 0 ? { ...s, count: remaining } : { ...s, ingotType: null, count: 0 }
        : s
    ));
    const ingot = INGOT_RESOURCES[slot.ingotType];
    setCarriedResource({ key: `ingot:${slot.ingotType}`, source: 'ingot', id: slot.ingotType, name: ingot?.name ?? slot.ingotType, count: requested });
    return true;
  }

  function handlePlaceCarriedResource(target) {
    if (!carriedResource) return false;
    if (target.source !== carriedResource.source || target.id !== carriedResource.id) return false;
    restoreCarriedStack(carriedResource);
    setCarriedResource(null);
    return true;
  }

  function handleLoadForgeFuelFromCarry(slotId) {
    if (!carriedResource || carriedResource.id !== FORGE_FUEL_TYPE) return false;
    const slot = forgeFuelSlots.find(s => s.slotId === slotId);
    if (!slot) return false;
    setForgeFuelSlots(prev =>
      prev.map(s =>
        s.slotId === slotId
          ? { slotId: s.slotId, ...addForgeFuel(s, carriedResource.count), activeSlotId: s.slotId }
          : s
      )
    );
    setCarriedResource(null);
    return true;
  }

  function handleSocketPocketCardToMine(cardId, slotId) {
    const card = pocket.find(entry => sameCardId(entry.id, cardId));
    if (!card) return false;
    const now = Date.now();

    let moved = false;
    setMineSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || slot.card) return slot;
        moved = true;
        return startMiningSlots([{
          ...slot,
          card: { ...card },
          startedAt: null,
          endsAt: null,
          oreType: null,
        }], now)[0];
      })
    );
    if (!moved) return false;
    removeFromPocket(cardId);
    return true;
  }

  function handleUnsocketMineCard(slotId) {
    let removedCard = null;
    const canReturnToPocket = pocket.length < pocketCapacity;
    setMineSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || !slot.card) return slot;
        removedCard = { ...slot.card };
        return { ...slot, card: null, startedAt: null, endsAt: null, oreType: null };
      })
    );
    if (!removedCard) return false;
    if (canReturnToPocket) {
      setPocket(prev => prev.some(card => sameCardId(card.id, removedCard.id)) ? prev : [...prev, removedCard]);
    }
    return true;
  }

  function handleUnlockMineSlot() {
    const cost = getMineSlotUpgradeCost(mineSlotCapacity);
    if (!cost || balance < cost || mineSlotCapacity >= MAX_MINE_SLOT_CAPACITY) return false;
    setBalance(b => Math.round((b - cost) * 100) / 100);
    setMineSlotCapacity(prevCapacity => {
      const nextCapacity = clampMineSlotCapacity(prevCapacity + 1);
      setMineSlots(prevSlots => normalizeMiningSlots(prevSlots, nextCapacity));
      return nextCapacity;
    });
    return true;
  }

  function handleCollectMinedOre() {
    const queue = mineClaimQueueRef.current;
    if (!hasQueuedOre(queue)) return;
    setOreInventory(prev => addOreCounts(prev, queue));
    setMineClaimQueue({ ...DEFAULT_ORE_INVENTORY });
  }

  function handleSocketForgeCard(cardId, slotId) {
    const card = collection.find(entry => sameCardId(entry.id, cardId));
    if (!card) return false;
    let moved = false;
    setForgeCardSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || slot.card) return slot;
        moved = true;
        return { ...slot, card: { ...card } };
      })
    );
    if (!moved) return false;
    removeFromPocket(cardId);
    return true;
  }

  function handleUnsocketForgeCard(slotId) {
    let removed = false;
    setForgeCardSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || !slot.card) return slot;
        removed = true;
        return { ...slot, card: null };
      })
    );
    return removed;
  }

  function handleSocketForgeOre(oreType, slotId) {
    if (!ORE_TO_INGOT[oreType]) return false;
    let changed = false;
    setForgeOreSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId) return slot;
        changed = true;
        return { ...slot, oreType, count: Math.max(1, slot.count ?? 0) };
      })
    );
    return changed;
  }

  function handleLoadForgeOreFromCarry(slotId) {
    if (!carriedResource || carriedResource.source !== 'ore') return false;
    if (!SMELT_RECIPES[carriedResource.id]) return false; // stone/coal are not smeltable
    const slot = forgeOreSlots.find(s => s.slotId === slotId);
    if (!slot) return false;
    if (slot.oreType && slot.oreType !== carriedResource.id) return false;
    setForgeOreSlots(prev =>
      prev.map(s =>
        s.slotId === slotId
          ? { ...s, oreType: carriedResource.id, count: (s.count ?? 0) + carriedResource.count }
          : s
      )
    );
    setCarriedResource(null);
    return true;
  }

  function handleUnsocketForgeOre(slotId) {
    let removedOre = null;
    setForgeOreSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || !slot.oreType || !(slot.count > 0)) return slot;
        removedOre = { id: slot.oreType, count: slot.count };
        return { ...slot, oreType: null, count: 0 };
      })
    );
    if (removedOre) {
      setOreInventory(prev => ({ ...prev, [removedOre.id]: (prev[removedOre.id] ?? 0) + removedOre.count }));
    }
    return Boolean(removedOre);
  }

  function handleUnloadForgeFuel(slotId) {
    const slot = forgeFuelSlots.find(entry => entry.slotId === slotId);
    if (!slot?.loadedCoal) return false;
    const returnedCount = slot.loadedCoal;
    setForgeFuelSlots(prev =>
      prev.map(entry => entry.slotId === slotId ? { slotId: entry.slotId, ...createForgeFuelState() } : entry)
    );
    setGatheredInventory(prev => ({ ...prev, [FORGE_FUEL_TYPE]: (prev[FORGE_FUEL_TYPE] ?? 0) + returnedCount }));
    return true;
  }

  function handleCollectIngots() {
    const hasQueuedIngots = Object.values(ingotClaimQueue).some(count => (count ?? 0) > 0);
    if (!hasQueuedIngots) return;
    setIngotInventory(prev => Object.fromEntries(
      Object.keys({ ...DEFAULT_INGOT_INVENTORY, ...ingotClaimQueue }).map(key => [
        key,
        (prev[key] ?? 0) + (ingotClaimQueue[key] ?? 0),
      ]),
    ));
    setIngotClaimQueue({ ...DEFAULT_INGOT_INVENTORY });
  }

  function handleSocketPocketCardToGathering(cardId, slotId) {
    const card = pocket.find(entry => sameCardId(entry.id, cardId));
    if (!card) return false;
    const now = Date.now();

    let moved = false;
    setGatheringSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || slot.card) return slot;
        moved = true;
        return startGatheringSlots([{
          ...slot,
          card: { ...card },
          startedAt: null,
          endsAt: null,
          resourceId: null,
        }], now)[0];
      })
    );
    if (!moved) return false;
    removeFromPocket(cardId);
    return true;
  }

  function handleUnsocketGatheringCard(slotId) {
    let removedCard = null;
    const canReturnToPocket = pocket.length < pocketCapacity;
    setGatheringSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || !slot.card) return slot;
        removedCard = { ...slot.card };
        return { ...slot, card: null, startedAt: null, endsAt: null, resourceId: null };
      })
    );
    if (!removedCard) return false;
    if (canReturnToPocket) {
      setPocket(prev => prev.some(card => sameCardId(card.id, removedCard.id)) ? prev : [...prev, removedCard]);
    }
    return true;
  }

  function handleCollectGatheredResources() {
    if (!hasQueuedGatheredResources(gatheringClaimQueue)) return false;
    setGatheredInventory(prev => addGatheredCounts(prev, gatheringClaimQueue));
    setGatheringClaimQueue({ ...DEFAULT_GATHERING_INVENTORY });
    return true;
  }

  function handleSocketPocketCardToProcessing(cardId, slotId) {
    const card = pocket.find(entry => sameCardId(entry.id, cardId));
    if (!card) return false;

    let moved = false;
    setProcessingSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || slot.card) return slot;
        moved = true;
        return startProcessingSlot({
          ...slot,
          card: { ...card },
          startedAt: null,
          endsAt: null,
        });
      })
    );
    if (!moved) return false;
    removeFromPocket(cardId);
    return true;
  }

  function handleUnsocketProcessingCard(slotId) {
    let removedCard = null;
    const canReturnToPocket = pocket.length < pocketCapacity;
    setProcessingSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || !slot.card) return slot;
        removedCard = { ...slot.card };
        return { ...slot, card: null, startedAt: null, endsAt: null };
      })
    );
    if (!removedCard) return false;
    if (canReturnToPocket) {
      setPocket(prev => prev.some(card => sameCardId(card.id, removedCard.id)) ? prev : [...prev, removedCard]);
    }
    return true;
  }

  function handleLoadProcessingInputFromCarry(slotId) {
    if (!carriedResource || carriedResource.source !== 'gathered') return false;
    const recipe = PROCESSING_RECIPES[carriedResource.id];
    if (!recipe) return false;
    const slot = processingSlots.find(entry => entry.slotId === slotId);
    if (!slot) return false;
    if (slot.inputId && slot.inputId !== carriedResource.id) return false;
    setProcessingSlots(prev =>
      prev.map(entry =>
        entry.slotId === slotId
          ? startProcessingSlot({
              ...entry,
              inputId: carriedResource.id,
              inputCount: (entry.inputCount ?? 0) + carriedResource.count,
              outputId: recipe.outputId,
              startedAt: null,
              endsAt: null,
            })
          : entry
      )
    );
    setCarriedResource(null);
    return true;
  }

  function handleUnsocketProcessingInput(slotId) {
    let removed = null;
    setProcessingSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || !slot.inputId || !(slot.inputCount > 0)) return slot;
        removed = { id: slot.inputId, count: slot.inputCount };
        return { ...slot, inputId: null, inputCount: 0, outputId: null, startedAt: null, endsAt: null };
      })
    );
    if (!removed) return false;
    setGatheredInventory(prev => ({ ...prev, [removed.id]: (prev[removed.id] ?? 0) + removed.count }));
    return true;
  }

  function handlePickUpProcessingInput(slotId, amount) {
    const requested = Math.max(1, Math.floor(Number(amount) || 0));
    if (!requested) return false;
    const slot = processingSlots.find(entry => entry.slotId === slotId);
    if (!slot || !slot.inputId || slot.inputCount < requested) return false;
    const remaining = slot.inputCount - requested;
    setProcessingSlots(prev =>
      prev.map(entry =>
        entry.slotId === slotId
          ? {
              ...entry,
              inputId: remaining > 0 ? entry.inputId : null,
              inputCount: remaining,
              outputId: remaining > 0 ? entry.outputId : null,
              startedAt: null,
              endsAt: null,
            }
          : entry
      )
    );
    const resourceName = Object.values(PROCESSING_RECIPES).find(recipe => recipe.inputId === slot.inputId)?.inputId ?? slot.inputId;
    setCarriedResource({ key: `gathered:${slot.inputId}`, source: 'gathered', id: slot.inputId, name: resourceName, count: requested });
    return true;
  }

  function handleCollectProcessedResources() {
    if (!hasQueuedProcessedResources(processedClaimQueue)) return false;
    setProcessedInventory(prev => addProcessedCounts(prev, processedClaimQueue));
    setProcessedClaimQueue({ ...DEFAULT_PROCESSED_INVENTORY });
    return true;
  }

  function handleSell(cardId) {
    const card = collection.find(c => c.id === cardId);
    if (!card) return;
    setBalance(b => Math.round((b + getCardSellValue(card)) * 100) / 100);
    setCollection(prev => prev.filter(c => c.id !== cardId));
    removeFromPocket(cardId);
    clearMiningCards(cardId);
    clearGatheringCards(cardId);
    clearProcessingCards(cardId);
    clearForgeCards(cardId);
  }

  function handleGrade(cardId, grade) {
    const card = collection.find(c => c.id === cardId);
    if (!card) return;
    const cost = getGradeCost(card);
    if (balance < cost) return;
    setBalance(b => Math.round((b - cost) * 100) / 100);
    setCollection(prev => prev.map(c =>
      c.id === cardId
        ? { ...c, grade, gradeAttempts: (c.gradeAttempts ?? 0) + 1 }
        : c
    ));
  }

  function handleFuse(cardIds, cost, newCard) {
    if (balance < cost) return;
    setBalance(b => Math.round((b - cost) * 100) / 100);
    setCollection(prev => {
      const filtered = prev.filter(c => !cardIds.includes(c.id));
      return newCard ? [...filtered, newCard] : filtered;
    });
    setPocket(prev => prev.filter(card => !cardIds.some(cardId => sameCardId(card.id, cardId))));
    clearMiningCards(cardIds);
    clearGatheringCards(cardIds);
    clearProcessingCards(cardIds);
    clearForgeCards(cardIds);
  }

  function handleImprint(cardId, tag, success, newValue) {
    const card = collection.find(c => c.id === cardId);
    if (!card || card.tag) return;
    const cost = getImprintCost(tag, card.rarity);
    if (!cost || balance < cost) return;
    setBalance(b => Math.round((b - cost) * 100) / 100);
    if (success) {
      setCollection(prev => prev.map(c => c.id === cardId ? { ...c, tag, value: newValue } : c));
    } else {
      setCollection(prev => prev.filter(c => c.id !== cardId));
      removeFromPocket(cardId);
      clearMiningCards(cardId);
      clearGatheringCards(cardId);
      clearProcessingCards(cardId);
      clearForgeCards(cardId);
    }
  }

  function handleSmelt(cardId, oreType) {
    const card = collection.find(c => c.id === cardId);
    if (!card) return;
    const required = { common: 4, uncommon: 3, rare: 2, epic: 2, legendary: 1, mythic: 1 }[card.rarity] ?? 3;
    if ((oreInventory[oreType] ?? 0) < required) return;
    const ingotType = ORE_TO_INGOT[oreType];
    setCollection(prev => prev.filter(c => c.id !== cardId));
    setOreInventory(prev => ({ ...prev, [oreType]: prev[oreType] - required }));
    setIngotInventory(prev => ({ ...prev, [ingotType]: (prev[ingotType] ?? 0) + 1 }));
    removeFromPocket(cardId);
    clearMiningCards(cardId);
    clearGatheringCards(cardId);
    clearProcessingCards(cardId);
    clearForgeCards(cardId);
  }

  function handleMarketSell(cardId, marketPrice) {
    if (!collection.find(c => c.id === cardId)) return;
    setBalance(b => Math.round((b + marketPrice) * 100) / 100);
    setCollection(prev => prev.filter(c => c.id !== cardId));
    removeFromPocket(cardId);
    clearMiningCards(cardId);
    clearGatheringCards(cardId);
    clearProcessingCards(cardId);
    clearForgeCards(cardId);
  }

  function handleBuyLegendarySlot() {
    const cost = LEGENDARY_SLOT_PRICES[market.legendarySlots];
    if (!cost || balance < cost || market.legendarySlots >= 5) return;
    setBalance(b => Math.round((b - cost) * 100) / 100);
    setMarket(m => ({ ...m, legendarySlots: m.legendarySlots + 1 }));
  }

  function handleBuyMythicSlot() {
    const cost = MYTHIC_SLOT_PRICES[market.mythicSlots];
    if (!cost || balance < cost || market.mythicSlots >= 5) return;
    setBalance(b => Math.round((b - cost) * 100) / 100);
    setMarket(m => ({ ...m, mythicSlots: m.mythicSlots + 1 }));
  }

  const opening = pendingCards.length > 0;
  const unavailableFoundryCardIds = [
    ...mineSlots.filter(slot => slot.card).map(slot => slot.card.id),
    ...gatheringSlots.filter(slot => slot.card).map(slot => slot.card.id),
    ...processingSlots.filter(slot => slot.card).map(slot => slot.card.id),
    ...forgeCardSlots.filter(slot => slot.card).map(slot => slot.card.id),
  ];

  return (
    <div className="app">
      <header className="header">
        <h1>Cards of Arcana</h1>
        <div className={`balance${balancePumping ? ' balance--pumping' : ''}`}>
          <Gold amount={displayBalance} />
        </div>
      </header>

      <nav className="tab-bar">
        {VIEW_ORDER.map((v, i) => {
          let label;
          if (v === VIEWS.SHOP) label = 'Cards';
          else if (v === VIEWS.UNPACK) label = packs.length > 0 ? `Summon (${packs.length})` : 'Summon';
          else if (v === VIEWS.COLLECTION) label = `Collection (${collection.length})`;
          else if (v === VIEWS.ARCANA) label = 'Arcana';
          else if (v === VIEWS.MARKET) label = 'Market';
          else if (v === VIEWS.FOUNDRY) label = 'Foundry';
          else if (v === VIEWS.WILDERNESS) label = 'Wilderness';
          else if (v === VIEWS.LAB) label = 'Lab';
          else label = 'Market';
          return (
            <button
              key={v}
              ref={el => {
                tabRefs.current[i] = el;
                if (v === VIEWS.UNPACK) unpackBtnRef.current = el;
                if (v === VIEWS.COLLECTION) collectionBtnRef.current = el;
                if (v === VIEWS.ARCANA) arcanaBtnRef.current = el;
              }}
              className={view === v ? 'active' : ''}
              style={{ '--tab-accent': TAB_ACCENTS[v] }}
              onClick={() => setView(v)}
              disabled={opening}
            >
              {view === v && (
                <span className="tab-rune-stream" aria-hidden="true">
                  <span className="tab-rune-particle">ᚱ</span>
                  <span className="tab-rune-particle">ᛟ</span>
                  <span className="tab-rune-particle">⩔</span>
                  <span className="tab-rune-particle">𐌘</span>
                  <span className="tab-rune-particle">ᛠ</span>
                  <span className="tab-rune-particle">𐋐</span>
                </span>
              )}
              <span className="tab-icon">{TAB_ICONS[v]}</span>
              {label}
            </button>
          );
        })}
        <div
          className="nav-underline"
          style={{ left: `${underline.left}px`, width: `${underline.width}px` }}
        />
      </nav>

      <main className={`main${view === VIEWS.COLLECTION ? ' main--collection' : ''}${view === VIEWS.ARCANA ? ' main--arcana' : ''}`}>
        {view === VIEWS.SHOP && (
          <Shop balance={balance} onBuyPack={handleBuyPack} packsNavRef={unpackBtnRef} />
        )}
        {view === VIEWS.UNPACK && (
          <UnpackPage
            packs={packs}
            arcanaInventory={arcanaInventory}
            pendingCards={pendingCards}
            pendingEssenceDrops={pendingEssenceDrops}
            pendingPackType={pendingPackType}
            onOpenPack={handleOpenPack}
            onPackDone={handlePackDone}
            collectionBtnRef={collectionBtnRef}
            inventoryTargetRef={inventoryHeaderRef}
          />
        )}
        {view === VIEWS.COLLECTION && (
          <Collection
            cards={collection}
            onSell={handleSell}
            pocket={pocket}
            lockedCardIds={unavailableFoundryCardIds}
            onPocketAdd={handlePocketAdd}
          />
        )}
        {view === VIEWS.ARCANA && (
          <Arcana
            resources={resources}
            pocket={pocket}
            onRingCraft={handleRingCraft}
            carriedResource={carriedResource}
            onPlaceCarriedResource={handlePlaceCarriedResource}
          />
        )}
        {view === VIEWS.FOUNDRY && (
          <Foundry
            collection={collection}
            pocket={pocket}
            balance={balance}
            mineSlots={mineSlots}
            mineSlotCapacity={mineSlotCapacity}
            mineClaimQueue={mineClaimQueue}
            forgeCardSlots={forgeCardSlots}
            forgeOreSlots={forgeOreSlots}
            forgeIngredientSlots={forgeIngredientSlots}
            forgeFuelSlots={forgeFuelSlots}
            ingotClaimQueue={ingotClaimQueue}
            returnsMineCardsToPocket={pocket.length < pocketCapacity}
            nextMineSlotCost={getMineSlotUpgradeCost(mineSlotCapacity)}
            collectTargetRef={inventoryHeaderRef}
            onSocketMineCard={handleSocketPocketCardToMine}
            onUnsocketMineCard={handleUnsocketMineCard}
            onUnlockMineSlot={handleUnlockMineSlot}
            onCollectMinedOre={handleCollectMinedOre}
            onSocketForgeCard={handleSocketForgeCard}
            onUnsocketForgeCard={handleUnsocketForgeCard}
            onSocketForgeOre={handleSocketForgeOre}
            onUnsocketForgeOre={handleUnsocketForgeOre}
            onLoadForgeFuel={handleLoadForgeFuelFromCarry}
            onUnloadForgeFuel={handleUnloadForgeFuel}
            onLoadForgeOre={handleLoadForgeOreFromCarry}
            onLoadForgeIngredient={handleLoadForgeIngredientFromCarry}
            onUnsocketForgeIngredient={handleUnsocketForgeIngredient}
            onPickUpForgeFuel={handlePickUpForgeFuel}
            onPickUpForgeOre={handlePickUpForgeOre}
            onPickUpForgeIngredient={handlePickUpForgeIngredient}
            onCollectIngots={handleCollectIngots}
            carriedResource={carriedResource}
            onPlaceCarriedResource={handlePlaceCarriedResource}
          />
        )}
        {view === VIEWS.WILDERNESS && (
          <Wilderness
            pocket={pocket}
            processedInventory={processedInventory}
            gatheringSlots={gatheringSlots}
            gatheringClaimQueue={gatheringClaimQueue}
            processingSlots={processingSlots}
            processedClaimQueue={processedClaimQueue}
            returnsGatheringCardsToPocket={pocket.length < pocketCapacity}
            returnsProcessingCardsToPocket={pocket.length < pocketCapacity}
            collectTargetRef={inventoryHeaderRef}
            onSocketGatheringCard={handleSocketPocketCardToGathering}
            onUnsocketGatheringCard={handleUnsocketGatheringCard}
            onCollectGatheredResources={handleCollectGatheredResources}
            onSocketProcessingCard={handleSocketPocketCardToProcessing}
            onUnsocketProcessingCard={handleUnsocketProcessingCard}
            onLoadProcessingInput={handleLoadProcessingInputFromCarry}
            onUnsocketProcessingInput={handleUnsocketProcessingInput}
            onPickUpProcessingInput={handlePickUpProcessingInput}
            onCollectProcessedResources={handleCollectProcessedResources}
            carriedResource={carriedResource}
            onPlaceCarriedResource={handlePlaceCarriedResource}
          />
        )}
        {view === VIEWS.LAB && (
          <Lab
            cards={collection}
            balance={balance}
            onGrade={handleGrade}
            onFuse={handleFuse}
            onImprint={handleImprint}
          />
        )}
        {view === VIEWS.MARKET && (
          <Market
            cards={collection}
            onSell={handleMarketSell}
            market={market}
            onBuyLegendarySlot={handleBuyLegendarySlot}
            onBuyMythicSlot={handleBuyMythicSlot}
            balance={balance}
          />
        )}
      </main>

      <Inventory
        inventoryRef={inventoryHeaderRef}
        resources={resources}
        oreInventory={oreInventory}
        ingotInventory={ingotInventory}
        gatheredInventory={gatheredInventory}
        processedInventory={processedInventory}
        arcanaInventory={arcanaInventory}
        onBeginCarry={handleBeginCarry}
        onPlaceCarriedResource={handlePlaceCarriedResource}
        carriedResource={carriedResource}
        open={inventoryOpen}
        onToggle={() => setInventoryOpen(prev => !prev)}
      />

      <CardPocket
        pocket={pocket}
        capacity={pocketCapacity}
        balance={balance}
        nextUnlockCost={getPocketUpgradeCost(pocketCapacity)}
        onAdd={handlePocketAdd}
        onRemove={handlePocketRemove}
        onUnlock={handleUnlockPocketSlot}
        positionLeft={view === VIEWS.ARCANA}
      />

      {carriedResource ? (
        <div
          className="carried-resource-cursor card-face-wrapper no-twirl foundry-square-resource foundry-square-resource--owned"
          style={{ left: carriedResourceCursor.x + 18, top: carriedResourceCursor.y + 18 }}
        >
          <div className="card-face-inner">
            <div className="card-face-front foundry-square-resource__front">
              <div className="foundry-square-resource__header">
                <span className="foundry-square-resource__name">{carriedResource.name}</span>
                <span className="foundry-square-resource__count">{carriedResource.count}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
