import { useState, useEffect, useMemo, useRef } from 'react';
import Shop from './components/Shop';
import UnpackPage from './components/UnpackPage';
import Collection from './components/Collection';
import Market, { LEGENDARY_SLOT_PRICES, MYTHIC_SLOT_PRICES } from './components/Market';
import Lab from './components/Lab';
import Arcana from './components/Arcana';
import Foundry from './components/Foundry';
import Wilderness from './components/Wilderness';
import Expedition from './components/Expedition';
import CardPocket from './components/CardPocket';
import GoldBurst, { streamSizeForAmount } from './components/GoldBurst';
import Inventory from './components/Inventory';
import SceneBackdrop from './components/SceneBackdrop';
import SplashScreen from './components/SplashScreen';
import AudioSettings from './components/AudioSettings';
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
} from './game/foundry';
import {
  ALL_GATHERING_RESOURCES,
  GATHERED_CANONICAL_TARGET,
  splitGatheredByInventory,
  DEFAULT_GATHERING_INVENTORY,
  DEFAULT_PROCESSED_INVENTORY,
  PROCESSED_RESOURCES,
  TREASURE_PACK_RESOURCE,
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
import { openPack, openTreasurePack, openWelcomePack, PACK_TYPES, STARTING_BALANCE, getGradeCost, getImprintCost, getCardSellValue, getPackTypeById, migrateCreatureCard, resolveCardName, rollAttunementBonus, rollCoinGenerationReward, rollElementalAttunementDrops } from './game/cards';
import {
  EXPEDITION_STATES,
  EXPEDITION_DIFFICULTIES,
  EXPEDITION_SLOT_LIMITS,
  createExpeditionUnitSlots,
  createExpeditionSupplySlots,
  createExpeditionArcanaSlots,
  normalizeExpeditionUnitSlots,
  normalizeExpeditionSupplySlots,
  normalizeExpeditionArcanaSlots,
  getExpeditionUpgradeCost,
  calculateExpeditionStats,
  startExpeditionRun,
  resolveExpeditionRun,
} from './game/expedition';
import { audioEngine } from './game/audio/audioEngine';
import { AUDIO_DEFINITIONS, DEFAULT_AUDIO_SETTINGS, SOUND_IDS, findSilentDefinitions, normalizeAudioSettings } from './game/audio/audioLibrary';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  GraphicsContext,
  QUALITY_FEATURES,
  QUALITY_LABELS,
  QUALITY_LEVELS,
  normalizeGraphicsSettings,
  resolveQuality,
} from './game/graphics';
import Gold from './components/Gold';
import PlacementEcho from './components/PlacementEcho';
import './App.css';

const VIEWS = { SHOP: 'shop', UNPACK: 'unpack', COLLECTION: 'collection', ARCANA: 'arcana', FOUNDRY: 'foundry', WILDERNESS: 'wilderness', EXPEDITION: 'expedition', LAB: 'lab', MARKET: 'market' };
const TAB_ICONS = { shop: '⊙', unpack: '✦', collection: '⊞', arcana: '◌', foundry: '⚒', wilderness: '❈', expedition: '▣', market: '↗', lab: '⚗' };
const VIEW_ORDER = [VIEWS.SHOP, VIEWS.UNPACK, VIEWS.COLLECTION, VIEWS.ARCANA, VIEWS.FOUNDRY, VIEWS.WILDERNESS, VIEWS.EXPEDITION, VIEWS.LAB, VIEWS.MARKET];

/**
 * Views held back from players. Their tabs render greyed with a `Soon` tag and are
 * `disabled`, which also means the delegated click sound skips them (that listener already
 * bails on `el.disabled`). The components themselves are untouched and still build — this
 * gates access, it does not remove the feature.
 */
const COMING_SOON_VIEWS = new Set([VIEWS.EXPEDITION, VIEWS.LAB, VIEWS.MARKET]);

/**
 * Views whose tab carries a loot indicator, and the default "already seen" state.
 *
 * Three states, driven by pending-queue totals crossing zero and by navigation:
 *
 *   nothing pending          no diamond
 *   pending, not yet visited diamond + glow  ("there is loot you have not looked at")
 *   pending, visited         diamond, no glow ("you know about it, it is still there")
 *
 * The point is that a completion sound alone does not say *where* the loot landed.
 */
const LOOT_TAB_VIEWS = [VIEWS.FOUNDRY, VIEWS.WILDERNESS];

/**
 * Ceiling on packs a player can *buy* while already holding a stack.
 *
 * Deliberately only applied to purchases. Treasure packs earned from Treasure Sense are
 * still granted past the cap — silently destroying loot a player worked for would be a far
 * worse bug than a long stack. So the held count can exceed this; it just cannot be pushed
 * over it at the till.
 */
const MAX_HELD_PACKS = 20;
const DEFAULT_LOOT_SEEN = Object.freeze({ [VIEWS.FOUNDRY]: true, [VIEWS.WILDERNESS]: true });

/** Sum of every positive entry across some claim/reward queues. */
function queueTotal(...queues) {
  let total = 0;
  for (const queue of queues) {
    if (!queue) continue;
    for (const amount of Object.values(queue)) {
      if (typeof amount === 'number' && amount > 0) total += amount;
    }
  }
  return total;
}
const TAB_ACCENTS = {
  [VIEWS.SHOP]: '#f5f5f5',
  [VIEWS.UNPACK]: '#e8c97a',
  [VIEWS.COLLECTION]: '#d4a44c',
  [VIEWS.ARCANA]: '#9cc9ff',
  [VIEWS.FOUNDRY]: '#ff9a36',
  [VIEWS.WILDERNESS]: '#7fb86d',
  [VIEWS.EXPEDITION]: '#d5b678',
  [VIEWS.LAB]: '#c58cff',
  [VIEWS.MARKET]: '#7dd3a7',
};

// 20 adds `graphicsSettings`. No migration needed — absent on older saves, and the
// state initializer falls back to auto-detection.
// 21 adds `lootSeen`. Also no migration: absent means "seen", so an existing save with
// loot already sitting in its queues shows a calm diamond rather than glowing on first load.
// Views laid out to fit the viewport without page scrolling. Anything not listed here
// still gets a scrolling pane, which is the pre-existing behaviour.
const FIT_VIEWS = new Set([VIEWS.SHOP, VIEWS.COLLECTION, VIEWS.FOUNDRY, VIEWS.WILDERNESS]);

const SAVE_VERSION = 22;
const POCKET_SYSTEM_VERSION = 1;
const DEFAULT_MARKET = { legendarySlots: 0, mythicSlots: 0 };
const DEFAULT_POCKET_CAPACITY = 3;
const MAX_POCKET_CAPACITY = 6;
/* Cost to unlock the NEXT slot, keyed by current capacity. Stops at 5 -> 6, since
   MAX_POCKET_CAPACITY is 6; the entries past it were for the old 10-slot ceiling. */
const POCKET_SLOT_COSTS = {
  3: 20,
  4: 45,
  5: 90,
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

function mergeResourceCounts(left = DEFAULT_RESOURCES, right = {}) {
  const next = { ...left };
  Object.entries(right).forEach(([resourceId, amount]) => {
    if (!amount) return;
    next[resourceId] = (next[resourceId] ?? 0) + amount;
  });
  return next;
}

const DEFAULT_BONUS_REWARD_QUEUE = Object.freeze({
  coins: 0,
  ...DEFAULT_RESOURCES,
});

function mergeBonusRewardQueue(left = DEFAULT_BONUS_REWARD_QUEUE, right = {}) {
  const next = { ...left };
  Object.entries(right).forEach(([key, amount]) => {
    if (!amount) return;
    next[key] = (next[key] ?? 0) + amount;
  });
  return next;
}

function hasQueuedBonusRewards(queue = DEFAULT_BONUS_REWARD_QUEUE) {
  return Object.entries(queue).some(([key, amount]) => key !== 'coins' ? amount > 0 : amount > 0);
}

function collapseLegacyExpeditionSupportSlots(parsed) {
  const next = { ...parsed };
  const defaultGathered = { ...DEFAULT_GATHERING_INVENTORY, ...(next.gatheredInventory ?? {}) };
  const defaultProcessed = { ...DEFAULT_PROCESSED_INVENTORY, ...(next.processedInventory ?? {}) };
  const defaultArcanaInventory = [...(next.arcanaInventory ?? [])];

  if (Array.isArray(next.expeditionSupplySlots) && next.expeditionSupplySlots.length > EXPEDITION_SLOT_LIMITS.supply.initial) {
    next.expeditionSupplySlots
      .slice(EXPEDITION_SLOT_LIMITS.supply.initial)
      .forEach(slot => {
        if (!slot?.id || !(slot.count > 0)) return;
        if (slot.source === 'processed') {
          defaultProcessed[slot.id] = (defaultProcessed[slot.id] ?? 0) + slot.count;
          return;
        }
        defaultGathered[slot.id] = (defaultGathered[slot.id] ?? 0) + slot.count;
      });
    next.expeditionSupplySlots = normalizeExpeditionSupplySlots(
      next.expeditionSupplySlots,
      EXPEDITION_SLOT_LIMITS.supply.initial,
    );
  }

  if (Array.isArray(next.expeditionArcanaSlots) && next.expeditionArcanaSlots.length > EXPEDITION_SLOT_LIMITS.arcana.initial) {
    next.expeditionArcanaSlots
      .slice(EXPEDITION_SLOT_LIMITS.arcana.initial)
      .forEach(slot => {
        if (!slot?.itemId) return;
        defaultArcanaInventory.push({
          inventoryEntryId: slot.inventoryEntryId,
          itemId: slot.itemId,
          name: slot.name,
          category: slot.category,
          description: slot.description,
          effect: slot.effect,
        });
      });
    next.expeditionArcanaSlots = normalizeExpeditionArcanaSlots(
      next.expeditionArcanaSlots,
      EXPEDITION_SLOT_LIMITS.arcana.initial,
    );
  }

  next.gatheredInventory = defaultGathered;
  next.processedInventory = defaultProcessed;
  next.arcanaInventory = defaultArcanaInventory;
  return next;
}


function migrateCards(cards = []) {
  return cards.map(card => migrateCreatureCard(card));
}

/**
 * Save 22: folds ores and ingots out of `gatheredInventory` into the inventories that actually own
 * them, and does the same to the pending gathering claim queue.
 *
 * Gathering pools duplicate every ore and ingot under their own ids, so a miner or blacksmith card
 * socketed in a *gathering* slot filled `gatheredInventory` with things the Bag then filed under
 * "Gathered" instead of "Ores"/"Ingots" — and, for `stone` and `coal`, showed a second stack under
 * the same name. Production now routes to the canonical inventory; this brings existing saves along
 * so nothing a player already owns goes missing from the section it moved to.
 */
function migrateGatheredOresAndIngots(parsed) {
  ['gatheredInventory', 'gatheringClaimQueue'].forEach(key => {
    const source = parsed[key];
    if (!source || typeof source !== 'object') return;
    // The claim queue is still gathering-shaped, so its ore/ingot entries move to the matching
    // pending queues rather than straight into the inventories.
    const oreTarget = key === 'gatheredInventory' ? 'oreInventory' : 'mineClaimQueue';
    const ingotTarget = key === 'gatheredInventory' ? 'ingotInventory' : 'ingotClaimQueue';
    Object.entries(GATHERED_CANONICAL_TARGET).forEach(([gatheredId, target]) => {
      const amount = Math.max(0, Math.floor(Number(source[gatheredId]) || 0));
      if (!amount) return;
      const destKey = target.inventory === 'ore' ? oreTarget : ingotTarget;
      const dest = parsed[destKey] && typeof parsed[destKey] === 'object' ? { ...parsed[destKey] } : {};
      dest[target.id] = (dest[target.id] ?? 0) + amount;
      parsed[destKey] = dest;
      source[gatheredId] = 0;
    });
  });
  return parsed;
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
        if ((parsed.version ?? 0) < 22) {
          migrateGatheredOresAndIngots(parsed);
        }
        if ((parsed.version ?? 0) < 18) {
          return collapseLegacyExpeditionSupportSlots(parsed);
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
    mineRewardQueue: DEFAULT_BONUS_REWARD_QUEUE,
    forgeCardSlots: createForgeCardSlots(),
    forgeOreSlots: createForgeOreSlots(),
    forgeIngredientSlots: createForgeIngredientSlots(),
    forgeFuelSlots: createForgeFuelSlots(),
    ingotClaimQueue: DEFAULT_INGOT_INVENTORY,
    forgeRewardQueue: DEFAULT_BONUS_REWARD_QUEUE,
    gatheredInventory: DEFAULT_GATHERING_INVENTORY,
    processedInventory: DEFAULT_PROCESSED_INVENTORY,
    gatheringSlots: createGatheringSlots(),
    gatheringClaimQueue: DEFAULT_GATHERING_INVENTORY,
    gatheringRewardQueue: DEFAULT_BONUS_REWARD_QUEUE,
    processingSlots: createProcessingSlots(),
    processedClaimQueue: DEFAULT_PROCESSED_INVENTORY,
    processingRewardQueue: DEFAULT_BONUS_REWARD_QUEUE,
    expeditionDifficultyId: EXPEDITION_DIFFICULTIES[0].id,
    expeditionUnitSlots: createExpeditionUnitSlots(),
    expeditionSupplySlots: createExpeditionSupplySlots(),
    expeditionArcanaSlots: createExpeditionArcanaSlots(),
    expeditionRun: null,
    pocket: [],
    audioSettings: DEFAULT_AUDIO_SETTINGS,
    graphicsSettings: DEFAULT_GRAPHICS_SETTINGS,

    pocketCapacity: DEFAULT_POCKET_CAPACITY,
    pocketExpanded: true,
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

// Serializing the whole save (collection, pocket, and every slot array with its
// embedded card objects) then writing it synchronously is the single most
// expensive thing this app does outside of rendering. It used to run on every
// state change, which during active production meant a full stringify every time
// a timer resolved. Coalescing to one write per SAVE_DEBOUNCE_MS keeps the same
// durability in practice, and the flush handlers below guarantee no loss on exit.
const SAVE_DEBOUNCE_MS = 2000;

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
  const [mineRewardQueue, setMineRewardQueue] = useState(() => ({ ...DEFAULT_BONUS_REWARD_QUEUE, ...(savedState.mineRewardQueue ?? {}) }));
  const [forgeCardSlots, setForgeCardSlots] = useState(() => normalizeForgeCardSlots(savedState.forgeCardSlots));
  const [forgeOreSlots, setForgeOreSlots] = useState(() => normalizeForgeOreSlots(savedState.forgeOreSlots));
  const [forgeIngredientSlots, setForgeIngredientSlots] = useState(() => normalizeForgeIngredientSlots(savedState.forgeIngredientSlots));
  const [forgeFuelSlots, setForgeFuelSlots] = useState(() => normalizeForgeFuelSlots(savedState.forgeFuelSlots, undefined, savedState.forgeFuel));
  const [ingotClaimQueue, setIngotClaimQueue] = useState(() => ({ ...DEFAULT_INGOT_INVENTORY, ...(savedState.ingotClaimQueue ?? {}) }));
  const [forgeRewardQueue, setForgeRewardQueue] = useState(() => ({ ...DEFAULT_BONUS_REWARD_QUEUE, ...(savedState.forgeRewardQueue ?? {}) }));


  const [gatheredInventory, setGatheredInventory] = useState(() => ({ ...DEFAULT_GATHERING_INVENTORY, ...(savedState.gatheredInventory ?? {}) }));
  const [processedInventory, setProcessedInventory] = useState(() => ({ ...DEFAULT_PROCESSED_INVENTORY, ...(savedState.processedInventory ?? {}) }));
  const [gatheringSlots, setGatheringSlots] = useState(() => normalizeGatheringSlots(savedState.gatheringSlots));
  const [gatheringClaimQueue, setGatheringClaimQueue] = useState(() => ({ ...DEFAULT_GATHERING_INVENTORY, ...(savedState.gatheringClaimQueue ?? {}) }));
  const [gatheringRewardQueue, setGatheringRewardQueue] = useState(() => ({ ...DEFAULT_BONUS_REWARD_QUEUE, ...(savedState.gatheringRewardQueue ?? {}) }));
  const [processingSlots, setProcessingSlots] = useState(() => normalizeProcessingSlots(savedState.processingSlots));
  const [processedClaimQueue, setProcessedClaimQueue] = useState(() => ({ ...DEFAULT_PROCESSED_INVENTORY, ...(savedState.processedClaimQueue ?? {}) }));
  const [processingRewardQueue, setProcessingRewardQueue] = useState(() => ({ ...DEFAULT_BONUS_REWARD_QUEUE, ...(savedState.processingRewardQueue ?? {}) }));
  const [lootSeen, setLootSeen] = useState(() => ({ ...DEFAULT_LOOT_SEEN, ...(savedState.lootSeen ?? {}) }));
  const [expeditionDifficultyId, setExpeditionDifficultyId] = useState(() => savedState.expeditionDifficultyId ?? EXPEDITION_DIFFICULTIES[0].id);
  const [expeditionUnitSlots, setExpeditionUnitSlots] = useState(() => normalizeExpeditionUnitSlots(savedState.expeditionUnitSlots, savedState.expeditionUnitSlots?.length ?? EXPEDITION_SLOT_LIMITS.unit.initial));
  const [expeditionSupplySlots, setExpeditionSupplySlots] = useState(() => normalizeExpeditionSupplySlots(savedState.expeditionSupplySlots, savedState.expeditionSupplySlots?.length ?? EXPEDITION_SLOT_LIMITS.supply.initial));
  const [expeditionArcanaSlots, setExpeditionArcanaSlots] = useState(() => normalizeExpeditionArcanaSlots(savedState.expeditionArcanaSlots, savedState.expeditionArcanaSlots?.length ?? EXPEDITION_SLOT_LIMITS.arcana.initial));
  const [expeditionRun, setExpeditionRun] = useState(() => savedState.expeditionRun ?? null);
  const [packsOpened, setPacksOpened] = useState(() => savedState.packsOpened ?? 0);
  const [audioSettings, setAudioSettings] = useState(() => normalizeAudioSettings(savedState.audioSettings ?? DEFAULT_AUDIO_SETTINGS));
  // Resolved once on mount: an explicit saved choice, otherwise a hardware guess.
  const [graphicsSettings, setGraphicsSettings] = useState(() => {
    const normalized = normalizeGraphicsSettings(savedState.graphicsSettings ?? DEFAULT_GRAPHICS_SETTINGS);
    return { ...normalized, quality: resolveQuality(normalized) };
  });
  const graphicsQuality = graphicsSettings.quality;
  const graphicsFeatures = QUALITY_FEATURES[graphicsQuality] ?? QUALITY_FEATURES.high;
  /**
   * How much of a gold burst's mote count to actually draw, by tier. The burst renders at EVERY tier,
   * unlike the ambient particle fields — it is a single short response to earning something, not
   * continuous motion, and it is the feedback that tells you where the gold went. The tier only thins
   * it. App.css exempts `.gold-burst` from the blanket `animation: none` that Low and Medium apply.
   */
  const goldBurstScale = graphicsQuality === 'low' ? 0.45 : graphicsQuality === 'medium' ? 0.7 : 1;
  const [pocket, setPocket] = useState(() => {
    const savedPocket = savedState.pocket ?? [];
    if (!Array.isArray(savedPocket) || savedPocket.length === 0) return [];
    const normalizedPocket = typeof savedPocket[0] === 'object'
      ? savedPocket.map(card => ({ ...card }))
      : (savedState.collection ?? [])
      .filter(card => savedPocket.some(cardId => sameCardId(card.id, cardId)))
      .map(card => ({ ...card }));

    const legacyTrimmed = isLegacyPocketState && savedState.pocketCapacity === 10
      ? normalizedPocket.slice(0, DEFAULT_POCKET_CAPACITY)
      : normalizedPocket;
    // Also trim to the CURRENT ceiling. `clampPocketCapacity` lowers a save's capacity to
    // MAX_POCKET_CAPACITY, but nothing trimmed the cards themselves — a save made while the cap was
    // 10 would keep rendering ten cards in a six-slot hand. The overflow goes back to the
    // Collection, which still holds every one of them (the hand stores copies).
    return legacyTrimmed.slice(0, MAX_POCKET_CAPACITY);
  });
  const [carriedResource, setCarriedResource] = useState(null);
  const [carriedResourceCursor, setCarriedResourceCursor] = useState({ x: 0, y: 0 });
  const [pocketCapacity, setPocketCapacity] = useState(() => migratedPocketCapacity);
  // Persisted: whether the pocket drawer is slid out. Kept in the save so the choice
  // survives a reload, matching how a player expects a HUD panel to behave.
  // Read but never changed: the Hand fan is always out, so there is no open/closed state left. Kept
  // in the save shape rather than dropped, so an older build reading this save still finds the key
  // it expects and a future collapsible hand needs no migration.
  const pocketExpanded = savedState.pocketExpanded !== false;
  const [view, setView] = useState(VIEWS.SHOP);
  const [pendingCards, setPendingCards] = useState([]);
  const [pendingResourceCards, setPendingResourceCards] = useState([]);
  const [pendingEssenceDrops, setPendingEssenceDrops] = useState([]);
  const [pendingPackType, setPendingPackType] = useState(null);

  // Session-scoped, not persisted — the splash shows once per page load, and is not
  // something a save should be able to re-trigger or permanently suppress.
  // ONE screen now, not an intro variant plus a menu variant — see SplashScreen.jsx. Open on load
  // and reopenable from the wordmark; `hasEntered` only picks the button's label.
  const [titleScreen, setTitleScreen] = useState(true);
  const [hasEntered, setHasEntered] = useState(false);

  const [inventoryOpen, setInventoryOpen] = useState(true);
  const inventoryHeaderRef = useRef(null);

  const tabRefs = useRef([]);
  const unpackBtnRef = useRef(null);
  const collectionBtnRef = useRef(null);
  const arcanaBtnRef = useRef(null);
  const [underline, setUnderline] = useState({ left: 0, width: 0 });
  const [lootMarkers, setLootMarkers] = useState([]);

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
  // Forge state is read by the production ticker below. Held in refs so the
  // ticker can be created once with [] deps instead of being torn down and
  // rebuilt on every forge state change.
  const forgeCardSlotsRef = useRef(forgeCardSlots);
  forgeCardSlotsRef.current = forgeCardSlots;
  const forgeOreSlotsRef = useRef(forgeOreSlots);
  forgeOreSlotsRef.current = forgeOreSlots;
  const forgeIngredientSlotsRef = useRef(forgeIngredientSlots);
  forgeIngredientSlotsRef.current = forgeIngredientSlots;
  const forgeFuelSlotsRef = useRef(forgeFuelSlots);
  forgeFuelSlotsRef.current = forgeFuelSlots;

  useEffect(() => {
    const prev = prevBalanceRef.current;
    prevBalanceRef.current = balance;
    if (balance <= prev) { setDisplayBalance(balance); return; }
    // Any gain, from any source. Wired here rather than at each call site because there are
    // seven places that award gold — selling cards, mass-selling, mine/forge/gathering/
    // processing coin procs, expedition payouts — and only one of them had the sound. Hooking
    // the state change instead of the callers means it cannot be forgotten by the next one.
    audioEngine.play(SOUND_IDS.coin);

    // Gold whose arrival has already been shown some other way — treasure-pack coins popping where
    // their cards sat — skips the stream. Streaming into the corner as well would show it twice.
    const skipStream = skipGoldStreamRef.current;
    skipGoldStreamRef.current = false;
    const counter = skipStream ? null : spawnGoldStream(balance - prev);

    /**
     * **The counter counts up when the gold gets there, not while it is in flight.** It used to start
     * the moment the balance changed, so the number had already finished climbing before the motes
     * arrived and the two read as unrelated. The delay is the stream's flight time; a suppressed
     * stream still waits, but only for the pops that replaced it.
     */
    if (balanceAnimRef.current) cancelAnimationFrame(balanceAnimRef.current);
    if (countUpTimerRef.current) window.clearTimeout(countUpTimerRef.current);
    const from = prev, to = balance, duration = 700;
    const arrival = skipStream ? 260 : GOLD_STREAM_ARRIVAL_MS;

    function startCountUp() {
      // A flourish on the counter itself as the motes land, so the number and the effect agree.
      if (counter) spawnGoldPop({ x: counter.x, y: counter.y, size: 'small' });
      const t0 = performance.now();
      setBalancePumping(true);
      function step(now) {
        const t = Math.min((now - t0) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplayBalance(from + (to - from) * eased);
        if (t < 1) { balanceAnimRef.current = requestAnimationFrame(step); }
        else { setDisplayBalance(to); setBalancePumping(false); }
      }
      balanceAnimRef.current = requestAnimationFrame(step);
    }

    countUpTimerRef.current = window.setTimeout(startCountUp, arrival);
    return () => {
      if (balanceAnimRef.current) cancelAnimationFrame(balanceAnimRef.current);
      if (countUpTimerRef.current) window.clearTimeout(countUpTimerRef.current);
    };
  }, [balance]);

  // Latest snapshot to persist, kept in a ref so the flush handlers below can
  // write the current state without re-subscribing on every change.
  const pendingSaveRef = useRef(null);
  const saveTimerRef = useRef(null);

  const flushSave = useRef(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!pendingSaveRef.current) return;
    saveState(pendingSaveRef.current);
    pendingSaveRef.current = null;
  }).current;

  // Write on the way out. `pagehide` and a hidden `visibilitychange` are the two
  // events that reliably fire before a tab is closed or discarded on mobile and
  // desktop; `beforeunload` alone is not dependable.
  useEffect(() => {
    function handleHide() {
      if (document.visibilityState === 'hidden') flushSave();
    }
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', handleHide);
    return () => {
      window.removeEventListener('pagehide', flushSave);
      document.removeEventListener('visibilitychange', handleHide);
      flushSave();
    };
  }, [flushSave]);

  useEffect(() => {
    pendingSaveRef.current = {
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
      mineRewardQueue,
      forgeCardSlots,
      forgeOreSlots,
      forgeIngredientSlots,
      forgeFuelSlots,
      ingotClaimQueue,
      forgeRewardQueue,
      gatheredInventory,
      processedInventory,
      gatheringSlots,
      gatheringClaimQueue,
      gatheringRewardQueue,
      processingSlots,
      processedClaimQueue,
      processingRewardQueue,
      expeditionDifficultyId,
      expeditionUnitSlots,
      expeditionSupplySlots,
      expeditionArcanaSlots,
      expeditionRun,
      packsOpened,
      audioSettings,
      graphicsSettings,
      pocket,
      pocketCapacity,
      pocketExpanded,
      lootSeen,
    };
    if (saveTimerRef.current !== null) return; // a write is already scheduled
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      if (!pendingSaveRef.current) return;
      saveState(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }, SAVE_DEBOUNCE_MS);
  }, [balance, collection, packs, market, resources, arcanaInventory, oreInventory, ingotInventory, mineSlots, mineSlotCapacity, mineClaimQueue, mineRewardQueue, forgeCardSlots, forgeOreSlots, forgeIngredientSlots, forgeFuelSlots, ingotClaimQueue, forgeRewardQueue, gatheredInventory, processedInventory, gatheringSlots, gatheringClaimQueue, gatheringRewardQueue, processingSlots, processedClaimQueue, processingRewardQueue, expeditionDifficultyId, expeditionUnitSlots, expeditionSupplySlots, expeditionArcanaSlots, expeditionRun, packsOpened, audioSettings, graphicsSettings, pocket, pocketCapacity, pocketExpanded, lootSeen]);

  // Drives every CSS quality override in App.css. Set on <html> rather than a
  // wrapper div so fixed/portaled elements (tooltips, hover previews, the carried
  // resource cursor) are covered too.
  useEffect(() => {
    document.documentElement.setAttribute('data-quality', graphicsQuality);
  }, [graphicsQuality]);

  useEffect(() => {
    audioEngine.registerMany(AUDIO_DEFINITIONS);
    void audioEngine.preload();
    // A definition with no source produces silence with no error, which is exactly how the
    // import.meta.glob guard bug stayed invisible. Surface it instead.
    const silent = findSilentDefinitions();
    if (silent.length > 0) {
      console.warn(`[audio] ${silent.length} sound(s) have no source and will be silent:`, silent);
    }
  }, []);

  useEffect(() => {
    audioEngine.configure(audioSettings);
  }, [audioSettings]);

  useEffect(() => {
    async function unlockAudio() {
      const ok = await audioEngine.unlock();
      // Browsers refuse media playback until a gesture, so this is the earliest point the
      // theme can actually start. Guarded so it only ever starts once.
      // playMusicPlaylist is idempotent, so repeated unlock attempts are harmless.
      // Starts on blacksmith and rotates through the rest, wrapping back.
      if (ok) audioEngine.playMusicPlaylist();
    }

    window.addEventListener('pointerdown', unlockAudio, true);
    window.addEventListener('keydown', unlockAudio, true);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio, true);
      window.removeEventListener('keydown', unlockAudio, true);
    };
  }, []);

  // Delegated interface click. One listener beats adding a play() call to every button in
  // the app, and it cannot drift out of sync as components change. Capture phase so it
  // still fires when a handler stops propagation; pointerdown rather than click so the
  // sound lands on press, which is what makes a UI feel responsive.
  useEffect(() => {
    function handlePointerDown(event) {
      if (event.button !== 0) return;
      const el = event.target instanceof Element
        ? event.target.closest('button, [role="tab"], [role="button"]')
        : null;
      if (!el || el.disabled) return;
      // Range inputs fire their own audition tone from the mixer.
      if (el.closest('.audio-settings__panel')) return;
      // Buttons that play their own sound opt out, so a collect press is the rapid-cards
      // sound alone rather than that plus a generic interface blip on top of it.
      if (el.matches('[class*="collect-btn"], .quick-draw-btn')) return;
      // Page switches get their own, louder sound — they are the most consequential thing a
      // player clicks, and they should not sound like any other button.
      if (el.closest('.tab-bar')) {
        audioEngine.play(SOUND_IDS.uiNav);
        return;
      }
      const isToggle = el.getAttribute('aria-expanded') !== null
        || el.getAttribute('aria-pressed') !== null;
      audioEngine.play(isToggle ? SOUND_IDS.uiToggle : SOUND_IDS.uiClick);
    }
    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, []);

  /**
   * Where the last card drop landed, and the echoes currently playing.
   *
   * The drop listener is delegated for the same reason the interface click is: there are card
   * slots in Foundry, Wilderness, Arcana, Expedition and the Hand, and wiring an effect into
   * each one would drift the moment a new station appears. One capture-phase listener sees
   * every drop.
   */
  const lastDropPointRef = useRef(null);
  const [placementEchoes, setPlacementEchoes] = useState([]);
  const echoKeyRef = useRef(0);

  /**
   * Gold bursts in flight, the counter they fly to, and where the player last pressed.
   *
   * The origin is the last pointer press rather than a fixed point, so the motes appear to come out
   * of whatever you just did — the Collect button, the card you sold — which is the only thing that
   * ties the burst to its cause. It falls back to the middle of the pane for gold that arrives with
   * no press behind it, such as a production coin proc resolving on the ticker.
   */
  const balanceTargetRef = useRef(null);
  const lastPressRef = useRef(null);
  const [goldBursts, setGoldBursts] = useState([]);
  const burstKeyRef = useRef(0);
  /**
   * Set immediately before a `setBalance` whose gold has already been shown arriving some other way,
   * so the balance-gain effect skips the stream. Treasure-pack coins pop in place where their cards
   * sat; streaming a second effect into the corner afterwards would show the same gold twice.
   */
  const skipGoldStreamRef = useRef(false);
  const countUpTimerRef = useRef(null);

  useEffect(() => {
    function handlePress(event) {
      lastPressRef.current = { x: event.clientX, y: event.clientY, at: Date.now() };
    }
    window.addEventListener('pointerdown', handlePress, true);
    return () => window.removeEventListener('pointerdown', handlePress, true);
  }, []);

  useEffect(() => {
    function handleDrop(event) {
      // Climb to the first ancestor that is card-or-slot sized. Using the pointer position
      // alone puts the ring wherever the cursor happened to be inside the slot, which reads as
      // sloppy; using the event target directly can catch a tiny inner label or the whole pane.
      let el = event.target instanceof Element ? event.target : null;
      let box = null;
      while (el && el !== document.body) {
        const rect = el.getBoundingClientRect();
        if (rect.width >= 44 && rect.width <= 340 && rect.height >= 44 && rect.height <= 440) {
          box = rect;
          break;
        }
        el = el.parentElement;
      }
      lastDropPointRef.current = {
        // The element is kept as well as the box: the box is only a fallback. A slot is not the
        // same shape as the card it holds — a mine slot is roughly square because it also
        // carries the speed dial, so its centre sits well to the right of the card's — and
        // centring on the slot put the ring visibly off to one side. signalCardPlaced re-measures
        // the card itself once React has put it there.
        el,
        x: box ? box.left + box.width / 2 : event.clientX,
        y: box ? box.bottom : event.clientY,
        size: box ? Math.max(box.width, box.height) * 1.25 : 150,
        at: Date.now(),
      };
    }
    window.addEventListener('drop', handleDrop, true);
    return () => window.removeEventListener('drop', handleDrop, true);
  }, []);

  /**
   * A card landed somewhere. Plays the placement sound and spawns the shockwave.
   *
   * Both signals belong together, which is why this exists rather than two calls at each site —
   * a future placement path gets the effect for free by using this.
   */
  function signalCardPlaced(card = null) {
    // The sound is immediate. Only the ring waits, and only for one paint.
    audioEngine.play(SOUND_IDS.cardPlace);
    // Gated on the same flag as the nav runes and the title-screen stream: `runeParticles` is
    // high-only, so Low and Medium get the sound alone. Verified rendering at high — 8 runes and 2
    // rings on a common card.
    if (!graphicsFeatures.runeParticles) return;
    const drop = lastDropPointRef.current;
    // Only for placements that came from an actual drop, and only a fresh one — a stale
    // coordinate would put the ring somewhere the player is no longer looking.
    if (!drop || Date.now() - drop.at > 1500) return;

    // Two frames, so React has committed the card into the slot and laid it out. Measuring the
    // card rather than the slot is what actually centres the ring: the slot's box includes
    // whatever else the station puts beside the card.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const cardEl = drop.el?.isConnected
        ? drop.el.querySelector('.card-face-wrapper, .card-face-front')
        : null;
      const box = cardEl?.getBoundingClientRect() ?? null;
      const usable = box && box.width > 8 && box.height > 8;
      /**
       * **No card, no ring.** There used to be a fallback here that placed the effect at the drop
       * point with `hole: null`, and that fallback is what made the ring "render outside and in
       * front of the card": with no hole there is no clip path, so the rings paint straight over the
       * card's face instead of passing under it, and the drop point is the slot's bottom edge rather
       * than the card's centre, so they also sat below it.
       *
       * It fires whenever the climbed drop target is not an ancestor of the card that landed — a
       * drop onto the Hand's catch band, or a station whose card renders outside the element the
       * climb stopped on. The effect is decoration; an unclipped ring across the card's artwork is
       * worse than no ring at all.
       */
      if (!usable) return;
      const key = echoKeyRef.current += 1;
      setPlacementEchoes(prev => [...prev, {
        key,
        // The CENTRE of the card, both axes. Anchoring at the bottom edge made the rings look
        // like they were being emitted from the card's base rather than from the card.
        x: box.left + box.width / 2,
        y: box.top + box.height / 2,
        size: Math.max(box.width, box.height) * 1.25,
        // The card's own footprint, so the effect can be clipped out of it and read as passing
        // underneath rather than across.
        hole: { left: box.left, top: box.top, width: box.width, height: box.height },
        rarity: card?.rarity ?? 'common',
        tier: card?.tier ?? 1,
        affixes: Array.isArray(card?.affixes) ? card.affixes.length : 0,
      }]);
      window.setTimeout(() => {
        setPlacementEchoes(prev => prev.filter(echo => echo.key !== key));
      }, 950);
    }));
  }

  /** Duration a stream takes to reach the counter, in ms. The count-up waits for it. */
  const GOLD_STREAM_ARRIVAL_MS = 780;

  /** Queues a burst and schedules its own removal. */
  function pushGoldBurst(burst, lifetimeMs) {
    const key = burstKeyRef.current += 1;
    setGoldBursts(prev => [...prev, { key, seed: key * 7919 + Math.round(burst.from.x), ...burst }]);
    window.setTimeout(() => {
      setGoldBursts(prev => prev.filter(entry => entry.key !== key));
    }, lifetimeMs);
  }

  /**
   * A radial burst of coins in place. Used for the gold cards in a treasure pack, which should read
   * as bursting where they sit, and for the small flourish on the counter when a stream lands.
   */
  function spawnGoldPop({ x, y, size = 'small' }) {
    pushGoldBurst({ mode: 'pop', size, from: { x, y }, countScale: goldBurstScale }, 900);
  }

  /**
   * Sends a spray of gold motes arcing up to the balance counter.
   *
   * The counter is measured at spawn rather than stored: it lives in a sticky header whose position
   * depends on the window, and a stale target would fling the motes at empty space. Returns the
   * counter's centre so the caller can pop a flourish there on arrival.
   */
  function spawnGoldStream(amount) {
    const target = balanceTargetRef.current;
    if (!target) return null;
    const box = target.getBoundingClientRect();
    if (box.width === 0) return null;
    const to = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const press = lastPressRef.current;
    // Only a press from the last moment or so counts as the cause of this gold.
    const fresh = press && Date.now() - press.at < 1200;
    const from = fresh
      ? { x: press.x, y: press.y }
      : { x: window.innerWidth / 2, y: window.innerHeight * 0.55 };
    pushGoldBurst({
      mode: 'stream',
      // Three sizes off the amount, so a big payout looks like one.
      size: streamSizeForAmount(amount),
      from,
      to,
      countScale: goldBurstScale,
    }, GOLD_STREAM_ARRIVAL_MS + 500);
    return to;
  }

  /**
   * Rune groups rendered over the nav. One per tab that should be emitting: the active tab,
   * plus whichever tab was just left, kept alive briefly with `leaving` so its runes fade out
   * instead of vanishing the instant you click elsewhere.
   *
   * They live in a layer beside `.tab-bar` rather than inside the buttons because the bar sets
   * `overflow-x: auto`, and CSS forces the cross axis to non-visible when one axis scrolls —
   * so anything rising out of a button was clipped at the bar's edge with no way to opt out.
   */
  const [runeGroups, setRuneGroups] = useState([]);
  const runeKeyRef = useRef(0);

  useEffect(() => {
    if (!graphicsFeatures.runeParticles) {
      setRuneGroups([]);
      return undefined;
    }
    const tab = tabRefs.current[VIEW_ORDER.indexOf(view)];
    if (!tab) return undefined;
    const key = runeKeyRef.current += 1;
    const bar = tab.parentElement;
    setRuneGroups(prev => [
      ...prev.map(group => ({ ...group, leaving: true })),
      {
        key,
        view,
        // offsetLeft is in the bar's scrolled content space; the layer is not, so compensate.
        left: tab.offsetLeft - (bar?.scrollLeft ?? 0),
        width: tab.offsetWidth,
        leaving: false,
      },
    ]);
    const timer = window.setTimeout(() => {
      setRuneGroups(prev => prev.filter(group => group.key === key));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [view, graphicsFeatures.runeParticles]);

  // ── Loot indicators ───────────────────────────────────────────────────────
  // Totals rather than booleans, so a second batch arriving while the first is still
  // uncollected still counts as new loot and re-lights the glow.
  const lootPending = useMemo(() => ({
    [VIEWS.FOUNDRY]: queueTotal(mineClaimQueue, mineRewardQueue, ingotClaimQueue, forgeRewardQueue),
    [VIEWS.WILDERNESS]: queueTotal(
      gatheringClaimQueue, gatheringRewardQueue, processedClaimQueue, processingRewardQueue,
    ),
  }), [
    mineClaimQueue, mineRewardQueue, ingotClaimQueue, forgeRewardQueue,
    gatheringClaimQueue, gatheringRewardQueue, processedClaimQueue, processingRewardQueue,
  ]);

  // Seeded from the first render so loot already in the queues does not register as newly
  // arrived and glow the moment the game loads.
  const lootPendingRef = useRef(lootPending);

  useEffect(() => {
    const previous = lootPendingRef.current;
    lootPendingRef.current = lootPending;
    const arrived = LOOT_TAB_VIEWS.filter(v => lootPending[v] > (previous[v] ?? 0));
    if (arrived.length === 0) return;
    setLootSeen(prev => {
      const next = { ...prev };
      // Loot landing on the page you are already looking at counts as seen — a tab should
      // not demand attention for the view in front of you.
      for (const v of arrived) next[v] = v === view;
      return next;
    });
  }, [lootPending, view]);

  // Visiting a view clears its glow. The diamond stays until the loot is actually collected.
  useEffect(() => {
    if (!LOOT_TAB_VIEWS.includes(view)) return;
    setLootSeen(prev => (prev[view] ? prev : { ...prev, [view]: true }));
  }, [view]);

  // A held-back view must never end up active, whatever set it.
  useEffect(() => {
    if (COMING_SOON_VIEWS.has(view)) setView(VIEWS.SHOP);
  }, [view]);

  // View ambience. `setAmbience` is idempotent and crossfades, so it can be driven
  // straight from the view without guarding against repeat calls.
  useEffect(() => {
    const bed = view === VIEWS.WILDERNESS
      ? SOUND_IDS.ambientWilderness
      : view === VIEWS.FOUNDRY
        ? SOUND_IDS.ambientFoundry
        : null;
    void audioEngine.setAmbience(bed);
  }, [view]);

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
      const isExpeditionSupplyTarget = targetKey === 'expedition-supply-slot' && ['gathered', 'processed'].includes(carriedResource.source);
      const isExpeditionArcanaTarget = targetKey === 'expedition-arcana-slot' && carriedResource.source === 'arcana-item';
      // Allow the event through — the slot's onPointerDown will handle placement
      if (isExactMatch || isArcanaRingTarget || isForgeFuelTarget || isForgeOreTarget || isForgeIngredientTarget || isWildernessProcessingTarget || isExpeditionSupplyTarget || isExpeditionArcanaTarget) return;
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
    setExpeditionUnitSlots(prev =>
      prev.map(slot => {
        if (!slot.card) return slot;
        const updatedCard = collection.find(card => sameCardId(card.id, slot.card.id));
        if (!updatedCard) {
          return { ...slot, card: null };
        }
        return { ...slot, card: { ...updatedCard } };
      })
    );
  }, [collection]);

  useEffect(() => {
    if (expeditionRun?.state !== EXPEDITION_STATES.IN_PROGRESS) return undefined;
    const remaining = Math.max(0, expeditionRun.endsAt - Date.now());
    const timer = window.setTimeout(() => {
      setExpeditionRun(current => (
        current?.state === EXPEDITION_STATES.IN_PROGRESS
          ? resolveExpeditionRun(current)
          : current
      ));
    }, remaining + 40);
    return () => window.clearTimeout(timer);
  }, [expeditionRun]);

  // ── Production ticker ───────────────────────────────────────────────────────
  // One interval drives forge, mine, gathering and processing. Previously these
  // were four separate 1s intervals; the forge one also tore itself down and
  // rebuilt on every forge state change. Each section below exits before doing
  // any allocation when nothing is actually due, so an idle tick is a few
  // comparisons rather than four passes that each rebuilt a 36-key resource map.
  // Row eligibility depends only on the forge's own inputs, so it is shared by
  // the start effect and the completion pass rather than duplicated.
  function getForgeRowState(slotIndex) {
    const cardSlot = forgeCardSlotsRef.current[slotIndex];
    const fuelSlot = forgeFuelSlotsRef.current[slotIndex];
    const oreSlot = forgeOreSlotsRef.current[slotIndex];
    const ingredientSlot = forgeIngredientSlotsRef.current[slotIndex];
    if (!fuelSlot) return null;

    const recipe = oreSlot?.oreType ? SMELT_RECIPES[oreSlot.oreType] : null;
    const oreRequired = recipe?.oreCount ?? 4;
    const ingredientRequired = recipe?.ingredient ?? null;
    const ingredientOk = !ingredientRequired || (
      ingredientSlot?.ingotType === ingredientRequired.type &&
      (ingredientSlot?.count ?? 0) >= ingredientRequired.count
    );
    const inputsOk = Boolean(
      cardSlot?.card &&
      oreSlot?.oreType &&
      (oreSlot.count ?? 0) >= oreRequired &&
      ingredientOk
    );

    return {
      cardSlot,
      fuelSlot,
      oreSlot,
      oreRequired,
      ingredientRequired,
      ingredientOk,
      inputsOk,
      hasFuel: fuelSlot.loadedCoal > 0 && fuelSlot.currentCoalCharges > 0,
    };
  }

  // Starting a cycle is event-driven, not polled: it fires the moment coal or ore
  // lands in a row, and again the moment a cycle completes and clears endsAt.
  // Idempotent — the `!fuelSlot.endsAt` guard makes re-runs no-ops, so it is safe
  // to run on every forge state change.
  useEffect(() => {
    const now = Date.now();
    forgeCardSlotsRef.current.forEach((cardSlot, slotIndex) => {
      const row = getForgeRowState(slotIndex);
      if (!row || row.fuelSlot.endsAt) return;
      if (!row.inputsOk || !row.hasFuel) return;
      setForgeFuelSlots(prev =>
        prev.map((slot, index) => index === slotIndex ? startForgeCycle(slot, cardSlot.slotId, now, cardSlot.card) : slot)
      );
    });
  }, [forgeCardSlots, forgeOreSlots, forgeIngredientSlots, forgeFuelSlots]);

  useEffect(() => {
    function tickForge(now) {
      forgeCardSlotsRef.current.forEach((cardSlot, slotIndex) => {
        const row = getForgeRowState(slotIndex);
        if (!row) return;
        const { fuelSlot, oreSlot, oreRequired, ingredientRequired, inputsOk } = row;

        if (!fuelSlot.endsAt || fuelSlot.endsAt > now) return;
        if (!inputsOk) {
          setForgeFuelSlots(prev =>
            prev.map((slot, index) => index === slotIndex ? { ...slot, activeSlotId: null, startedAt: null, endsAt: null } : slot)
          );
          return;
        }

        const ingotId = ORE_TO_INGOT[oreSlot.oreType];
        const nextOreCount = Math.max(0, (oreSlot.count ?? 0) - oreRequired);

        const attunementBonus = rollAttunementBonus(cardSlot.card, 'smeltingAttunement');
        const elementalDrops = rollElementalAttunementDrops(cardSlot.card);
        const goldFromSmelt = rollCoinGenerationReward(cardSlot.card);
        if (goldFromSmelt > 0 || Object.values(elementalDrops).some(amount => amount > 0)) {
          setForgeRewardQueue(prev => mergeBonusRewardQueue(prev, { coins: goldFromSmelt, ...elementalDrops }));
        }

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

        setIngotClaimQueue(prev => ({ ...prev, [ingotId]: (prev[ingotId] ?? 0) + 1 + attunementBonus }));
        audioEngine.play(SOUND_IDS.smeltComplete);

        setForgeFuelSlots(prev =>
          prev.map((slot, index) => {
            if (index !== slotIndex) return slot;
            const consumed = consumeForgeFuelCharge({ ...slot, activeSlotId: null, startedAt: null, endsAt: null });
            return { ...consumed, activeSlotId: null, startedAt: null, endsAt: null };
          })
        );
      });
    }

    // A slot only needs resolving once its timer has elapsed. Checking that up
    // front avoids resolve*() rebuilding its queue and elemental-drop maps on
    // every tick just to discover nothing finished.
    function anyDue(slots, now) {
      for (const slot of slots) {
        if (slot?.card && slot.endsAt && slot.endsAt <= now) return true;
      }
      return false;
    }

    function tickMining(now) {
      if (!anyDue(mineSlotsRef.current, now)) return;
      const { nextSlots, completedQueue, completedCount, goldEarned, elementalDrops } = resolveCompletedMiningSlots(mineSlotsRef.current, now);
      if (!completedCount) return;
      setMineSlots(nextSlots);
      audioEngine.play(SOUND_IDS.mineComplete);
      setMineClaimQueue(prev => addOreCounts(prev, completedQueue));
      if (goldEarned > 0 || Object.values(elementalDrops).some(amount => amount > 0)) {
        setMineRewardQueue(prev => mergeBonusRewardQueue(prev, { coins: goldEarned, ...elementalDrops }));
      }
    }

    function tickGathering(now) {
      if (!anyDue(gatheringSlotsRef.current, now)) return;
      // Captured before resolving, because resolve*() restarts the slots and clears endsAt.
      const completedCards = gatheringSlotsRef.current
        .filter(slot => slot?.card && slot.endsAt && slot.endsAt <= now)
        .map(slot => slot.card);
      const { nextSlots, completedQueue, completedCount, goldEarned, elementalDrops } = resolveCompletedGatheringSlots(gatheringSlotsRef.current, now);
      if (!completedCount) return;
      setGatheringSlots(nextSlots);
      // Lumberjacks chop, everyone else rustles. `completedCards` tells us which classes
      // finished this tick, so the Wilderness sounds like the work actually being done.
      const chopped = completedCards.some(card => card?.classType === 'lumberjack');
      audioEngine.play(chopped ? SOUND_IDS.gatherChop : SOUND_IDS.gatherComplete);
      setGatheringClaimQueue(prev => addGatheredCounts(prev, completedQueue));
      if (goldEarned > 0 || Object.values(elementalDrops).some(amount => amount > 0)) {
        setGatheringRewardQueue(prev => mergeBonusRewardQueue(prev, { coins: goldEarned, ...elementalDrops }));
      }
    }

    function tickProcessing(now) {
      if (!anyDue(processingSlotsRef.current, now)) return;
      const { nextSlots, completedQueue, completedCount, goldEarned, elementalDrops } = resolveCompletedProcessingSlots(processingSlotsRef.current, now);
      if (!completedCount) return;
      setProcessingSlots(nextSlots);
      audioEngine.play(SOUND_IDS.smeltComplete);
      setProcessedClaimQueue(prev => addProcessedCounts(prev, completedQueue));
      if (goldEarned > 0 || Object.values(elementalDrops).some(amount => amount > 0)) {
        setProcessingRewardQueue(prev => mergeBonusRewardQueue(prev, { coins: goldEarned, ...elementalDrops }));
      }
    }

    const interval = window.setInterval(() => {
      const now = Date.now();
      tickForge(now);
      tickMining(now);
      tickGathering(now);
      tickProcessing(now);
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const tabIndex = VIEW_ORDER.indexOf(view);
    if (tabIndex === -1) return;
    const tab = tabRefs.current[tabIndex];
    if (tab) setUnderline({ left: tab.offsetLeft, width: tab.offsetWidth });
  }, [view]);

  /**
   * Loot diamonds, measured per tab and rendered into `.nav-rune-layer` rather than inside the tab
   * button they belong to.
   *
   * They used to be children of the button, which put them inside `.tab-bar` — and the bar sets
   * `overflow-y: hidden`, which it has to, because `overflow-x` is `auto` and CSS forces the cross
   * axis to non-visible once one axis scrolls. So the diamond could not sit ON the bar's bottom line
   * (it was inset 5px to stay inside it) and its echo rings were clipped at the bar's edge, which is
   * why the scale was capped at 2.6. The rune layer is a SIBLING of the bar inside `.nav-shell` with
   * visible overflow, and it comes after the bar in DOM order so it paints above it — exactly the
   * arrangement the nav runes already use for the same reason.
   *
   * Positions come from `offsetLeft` minus the bar's `scrollLeft`, since the layer is not inside the
   * scrolled content. Tab widths change with their labels, so the pack and collection counts are
   * dependencies.
   */
  useEffect(() => {
    const bar = tabRefs.current.find(Boolean)?.parentElement ?? null;
    const scrollLeft = bar?.scrollLeft ?? 0;
    const next = [];
    LOOT_TAB_VIEWS.forEach(v => {
      if ((lootPending[v] ?? 0) <= 0) return;
      const tab = tabRefs.current[VIEW_ORDER.indexOf(v)];
      if (!tab) return;
      next.push({
        view: v,
        centre: tab.offsetLeft - scrollLeft + tab.offsetWidth / 2,
        state: lootSeen[v] ? 'seen' : 'new',
      });
    });
    setLootMarkers(next);
  }, [lootPending, lootSeen, view, packs.length, collection.length]);

  function handleBuyPack(packTypeId) {
    const pt = PACK_TYPES[packTypeId];
    if (!pt || balance < pt.cost) return;
    if (packs.length >= MAX_HELD_PACKS) return;
    setBalance(b => Math.round((b - pt.cost) * 100) / 100);
    setPacks(prev => [...prev, { id: Date.now() + Math.random(), packTypeId }]);
    audioEngine.play(SOUND_IDS.packBuy);
  }

  function handleOpenPack(packId, options = {}) {
    const pack = packs.find(p => p.id === packId);
    if (!pack) return false;
    const boosted = packsOpened < 3;
    let cards = [];
    let resourceCards = [];

    if (pack.packTypeId === 'welcome') {
      cards = openWelcomePack();
      setPendingResourceCards([]);
      setPendingEssenceDrops([]);
    } else if (pack.packTypeId === 'treasure') {
      resourceCards = openTreasurePack();
      setPendingResourceCards(resourceCards);
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
      setPendingResourceCards([]);
      setArcanaInventory(result.nextArcanaInventory);
      setResources(result.nextResources);
      setPendingEssenceDrops(result.essenceDrops);
    } else {
      cards = openPack(pack.packTypeId ?? 'iron', boosted);
      setPendingResourceCards([]);
      setPendingEssenceDrops([]);
    }

    setPacks(prev => prev.filter(p => p.id !== packId));
    audioEngine.play(SOUND_IDS.packOpen);
    setPendingCards(cards);
    setPendingPackType(getPackTypeById(pack.packTypeId));
    setPacksOpened(n => n + 1);
    return true;
  }

  function handlePackDone() {
    setCollection(prev => [...prev, ...pendingCards]);
    const goldFromRewards = pendingResourceCards.reduce((sum, reward) => sum + ((reward?.type === 'coins') ? (reward.amount ?? 0) : 0), 0);
    if (goldFromRewards > 0) {
      // The coins already burst where their cards sat (see onCoinPop), so the balance effect must not
      // also stream them into the corner — that would show the same gold arriving twice.
      skipGoldStreamRef.current = true;
      setBalance(prev => Math.round((prev + goldFromRewards) * 100) / 100);
    }
    setPendingCards([]);
    setPendingResourceCards([]);
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

  function clearExpeditionCards(cardIds) {
    const ids = Array.isArray(cardIds) ? cardIds : [cardIds];
    setExpeditionUnitSlots(prev =>
      prev.map(slot =>
        slot.card && ids.some(cardId => sameCardId(slot.card.id, cardId))
          ? { ...slot, card: null }
          : slot
      )
    );
  }

  /**
   * Pulls a card out of whatever station holds it and into the Hand.
   *
   * Clears it from EVERY slot array rather than the one the drag came from, which is why the drag
   * payload carries only `station` and no slot id: the card is in exactly one slot, the clear helpers
   * are already no-ops everywhere else, and a new station is covered by adding one line here instead
   * of threading an identifier through the component that renders it.
   */
  function handleAddToHandFromStation(cardId) {
    if (pocket.length >= pocketCapacity) return false;
    if (pocket.some(card => sameCardId(card.id, cardId))) return false;
    const card = collection.find(entry => sameCardId(entry.id, cardId));
    if (!card) return false;
    clearMiningCards(cardId);
    clearForgeCards(cardId);
    clearGatheringCards(cardId);
    clearProcessingCards(cardId);
    clearExpeditionCards(cardId);
    setPocket(prev => [...prev, { ...card }]);
    signalCardPlaced(card);
    return true;
  }

  function handlePocketAdd(cardId) {
    if (pocket.length >= pocketCapacity) return;
    if (pocket.some(card => sameCardId(card.id, cardId))) return;
    const card = collection.find(c => sameCardId(c.id, cardId));
    if (!card) return;
    // Appended. It used to be prepended, which was right for the old vertical drawer where index 0
    // rendered at the TOP of the stack and a new card wanted to land on top. The hand is a bottom
    // fan now and index 0 is its LEFT end, so prepending pushed every card you already held one
    // position right — the whole fan shifted under the pointer each time you added one. Appending
    // puts a drawn card at the near end and leaves the rest where they were.
    setPocket(prev => [...prev, { ...card }]);
    signalCardPlaced(card);
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
    // `ore`, not `gathered`. Coal is canonically an ore now (see GATHERED_CANONICAL_TARGET), and
    // hardcoding `gathered` here is what made coal visibly jump from the Ores section to the
    // Gathered section just for having passed through the forge.
    setCarriedResource({ key: 'ore:coal', source: 'ore', id: FORGE_FUEL_TYPE, name: 'Coal', count: requested });
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
    /**
     * **An empty row accepts any ingot.** This used to require `required` — a recipe already
     * resolved from ore sitting in the row — so loading the ingredient first was silently refused
     * and every recipe needing a secondary ingredient (silver, gold, platinum, starlit) read as
     * broken. Load order is not something the forge needs to care about: `ingredientOk` in the
     * ticker is what actually gates the smelt, so a row holding the wrong ingot simply is not ready
     * and the player can pick it back up.
     * Once a recipe IS known the type is still enforced, so a wrong ingot cannot be pushed into a
     * row whose requirement is already visible on the slot.
     */
    if (required && required.type !== carriedResource.id) return false;
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

  // ── Card movement / swapping ────────────────────────────────────────────────
  // Station slots used to reject a drop when already occupied. They now swap: the
  // incoming card takes the slot and the card it displaces goes back to the pocket.
  //
  // Everything runs inside the setPocket updater so `prev` is the single source of
  // truth — reading `pocket` from the closure would be stale if two drops land in the
  // same tick.
  function resolveSlotSwap(cardId, displaced) {
    // The card being socketed drives the effect's shape — affix count, rarity and tier. It is
    // still in the pocket at this point; the collection is the fallback for a direct drag.
    signalCardPlaced(
      pocket.find(entry => sameCardId(entry.id, cardId))
      ?? collection.find(entry => sameCardId(entry.id, cardId))
      ?? null,
    );
    setPocket(prev => {
      const next = [...prev];
      const index = next.findIndex(entry => sameCardId(entry.id, cardId));
      if (index >= 0) {
        // A true swap: the displaced card lands in the slot the dragged card vacated,
        // so the pocket's ordering is preserved.
        if (displaced) next[index] = displaced;
        else next.splice(index, 1);
        return next;
      }
      // The card came from outside the pocket (e.g. Collection → Forge). Park the
      // displaced card at the top if there is room; otherwise it simply returns to the
      // Collection, which is where every pocketed card already lives.
      if (displaced && next.length < pocketCapacity) next.unshift(displaced);
      return next;
    });
  }

  /** Reorder within the pocket by swapping two slots. */
  function handlePocketReorder(fromIndex, toIndex) {
    setPocket(prev => {
      if (fromIndex === toIndex) return prev;
      if (fromIndex < 0 || fromIndex >= prev.length) return prev;
      const next = [...prev];
      if (toIndex >= next.length) {
        // Dropped on a trailing empty slot: move rather than swap.
        const [moved] = next.splice(fromIndex, 1);
        next.push(moved);
        return next;
      }
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
  }

  /**
   * A Collection card dropped onto a specific pocket slot. If the slot is occupied the
   * two trade places — the displaced card just leaves the pocket, since pocketed cards
   * are always still in the Collection.
   */
  function handlePocketPlaceFromCollection(cardId, targetIndex) {
    const card = collection.find(entry => sameCardId(entry.id, cardId));
    if (!card) return false;
    setPocket(prev => {
      // Already pocketed elsewhere: treat it as a reorder instead of duplicating it.
      const existing = prev.findIndex(entry => sameCardId(entry.id, cardId));
      const next = [...prev];
      if (existing >= 0) {
        if (existing === targetIndex) return prev;
        if (targetIndex < next.length) {
          [next[existing], next[targetIndex]] = [next[targetIndex], next[existing]];
        } else {
          const [moved] = next.splice(existing, 1);
          next.push(moved);
        }
        return next;
      }
      if (targetIndex < next.length) next[targetIndex] = { ...card };
      else if (next.length < pocketCapacity) next.push({ ...card });
      return next;
    });
    return true;
  }

  function handleSocketPocketCardToMine(cardId, slotId) {
    const card = pocket.find(entry => sameCardId(entry.id, cardId));
    if (!card) return false;
    const target = mineSlots.find(slot => slot.slotId === slotId);
    if (!target) return false;
    if (sameCardId(target.card?.id, cardId)) return false;
    // Read the outgoing card before mutating, so the swap stays pure.
    const displaced = target.card ? { ...target.card } : null;
    const now = Date.now();

    setMineSlots(prev =>
      prev.map(slot => slot.slotId === slotId
        ? startMiningSlots([{
            ...slot,
            card: { ...card },
            startedAt: null,
            endsAt: null,
            oreType: null,
          }], now)[0]
        : slot)
    );
    resolveSlotSwap(cardId, displaced);
    return true;
  }

  function handleUnsocketMineCard(slotId) {
    let removedCard = null;
    setMineSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || !slot.card) return slot;
        removedCard = { ...slot.card };
        return { ...slot, card: null, startedAt: null, endsAt: null, oreType: null };
      })
    );
    if (!removedCard) return false;
    /**
     * Released to the COLLECTION, not the Hand. Station slots hold copies of collection cards and
     * `collection` always still has the original, so clearing the slot IS returning it — no state to
     * move. It used to push the card into the Hand when there was room, which meant the same button
     * did two different things depending on how full your hand was, and silently filled a hand you
     * were about to drag something else into. Drag a card out of a slot onto the Hand when that is
     * what you want; see handleAddToHandFromStation.
     */
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

  // Collection sounds are played by the components at the moment the button is pressed, not
  // here — these callbacks run after the fly animation, which put the sound a full second
  // behind the click. See handleCollectQueue in Foundry.jsx.
  function handleCollectMinedOre() {
    const queue = mineClaimQueueRef.current;
    if (!hasQueuedOre(queue) && !hasQueuedBonusRewards(mineRewardQueue)) return;
    setOreInventory(prev => addOreCounts(prev, queue));
    if (hasQueuedBonusRewards(mineRewardQueue)) {
      const { coins = 0, ...elementalDrops } = mineRewardQueue;
      if (coins > 0) {
        setBalance(prev => Math.round((prev + coins) * 100) / 100);
        audioEngine.play(SOUND_IDS.coin);
      }
      setResources(prev => mergeResourceCounts(prev, elementalDrops));
    }
    setMineClaimQueue({ ...DEFAULT_ORE_INVENTORY });
    setMineRewardQueue({ ...DEFAULT_BONUS_REWARD_QUEUE });
  }

  function handleSocketForgeCard(cardId, slotId) {
    const card = collection.find(entry => sameCardId(entry.id, cardId));
    if (!card) return false;
    const target = forgeCardSlots.find(slot => slot.slotId === slotId);
    if (!target) return false;
    if (sameCardId(target.card?.id, cardId)) return false;
    const displaced = target.card ? { ...target.card } : null;

    setForgeCardSlots(prev =>
      prev.map(slot => slot.slotId === slotId ? { ...slot, card: { ...card } } : slot)
    );
    resolveSlotSwap(cardId, displaced);
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
    // Ore inventory, matching where a carried pick-up returns it. Unloading used to put coal into
    // `gatheredInventory` while loading could take it from either, so the same coal moved sections
    // depending on which button you used.
    setOreInventory(prev => ({ ...prev, [FORGE_FUEL_TYPE]: (prev[FORGE_FUEL_TYPE] ?? 0) + returnedCount }));
    return true;
  }

  function handleCollectIngots() {
    const hasQueuedIngots = Object.values(ingotClaimQueue).some(count => (count ?? 0) > 0);
    if (!hasQueuedIngots && !hasQueuedBonusRewards(forgeRewardQueue)) return;
    setIngotInventory(prev => Object.fromEntries(
      Object.keys({ ...DEFAULT_INGOT_INVENTORY, ...ingotClaimQueue }).map(key => [
        key,
        (prev[key] ?? 0) + (ingotClaimQueue[key] ?? 0),
      ]),
    ));
    if (hasQueuedBonusRewards(forgeRewardQueue)) {
      const { coins = 0, ...elementalDrops } = forgeRewardQueue;
      if (coins > 0) {
        setBalance(prev => Math.round((prev + coins) * 100) / 100);
      }
      setResources(prev => mergeResourceCounts(prev, elementalDrops));
    }
    setIngotClaimQueue({ ...DEFAULT_INGOT_INVENTORY });
    setForgeRewardQueue({ ...DEFAULT_BONUS_REWARD_QUEUE });
  }

  function handleSocketPocketCardToGathering(cardId, slotId) {
    const card = pocket.find(entry => sameCardId(entry.id, cardId));
    if (!card) return false;
    const target = gatheringSlots.find(slot => slot.slotId === slotId);
    if (!target) return false;
    if (sameCardId(target.card?.id, cardId)) return false;
    const displaced = target.card ? { ...target.card } : null;
    const now = Date.now();

    setGatheringSlots(prev =>
      prev.map(slot => slot.slotId === slotId
        ? startGatheringSlots([{
            ...slot,
            card: { ...card },
            startedAt: null,
            endsAt: null,
            resourceId: null,
          }], now)[0]
        : slot)
    );
    resolveSlotSwap(cardId, displaced);
    return true;
  }

  function handleUnsocketGatheringCard(slotId) {
    let removedCard = null;
    setGatheringSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || !slot.card) return slot;
        removedCard = { ...slot.card };
        return { ...slot, card: null, startedAt: null, endsAt: null, resourceId: null };
      })
    );
    if (!removedCard) return false;
    /**
     * Released to the COLLECTION, not the Hand. Station slots hold copies of collection cards and
     * `collection` always still has the original, so clearing the slot IS returning it — no state to
     * move. It used to push the card into the Hand when there was room, which meant the same button
     * did two different things depending on how full your hand was, and silently filled a hand you
     * were about to drag something else into. Drag a card out of a slot onto the Hand when that is
     * what you want; see handleAddToHandFromStation.
     */
    return true;
  }

  function handleCollectGatheredResources() {
    if (!hasQueuedGatheredResources(gatheringClaimQueue) && !hasQueuedBonusRewards(gatheringRewardQueue)) return false;
    const treasurePacks = gatheringClaimQueue[TREASURE_PACK_RESOURCE.id] ?? 0;
    const { coins: rewardCoins = 0, ...elementalDrops } = gatheringRewardQueue;
    if (rewardCoins > 0) {
      setBalance(prev => Math.round((prev + rewardCoins) * 100) / 100);
    }
    /**
     * Split by canonical inventory. A miner card in a gathering slot rolls ores and a blacksmith
     * rolls ingots, and those are the same real items the Foundry's mine and forge produce — so they
     * go to `oreInventory` / `ingotInventory` rather than piling into `gatheredInventory`, where the
     * Bag filed Steel Ingots under "Gathered" and showed a second, separate stack of Coal.
     */
    const split = splitGatheredByInventory({
      ...gatheringClaimQueue,
      [TREASURE_PACK_RESOURCE.id]: 0,
    });
    setGatheredInventory(prev => addGatheredCounts(prev, split.gathered));
    if (Object.keys(split.ore).length > 0) {
      setOreInventory(prev => addOreCounts(prev, split.ore));
    }
    if (Object.keys(split.ingot).length > 0) {
      setIngotInventory(prev => {
        const next = { ...prev };
        Object.entries(split.ingot).forEach(([id, count]) => {
          next[id] = (next[id] ?? 0) + count;
        });
        return next;
      });
    }
    if (treasurePacks > 0) {
      setPacks(prev => [
        ...prev,
        ...Array.from({ length: treasurePacks }, (_, index) => ({
          id: `treasure-pack-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
          packTypeId: 'treasure',
        })),
      ]);
    }
    if (hasQueuedBonusRewards(gatheringRewardQueue)) {
      setResources(prev => mergeResourceCounts(prev, elementalDrops));
    }
    setGatheringClaimQueue({ ...DEFAULT_GATHERING_INVENTORY });
    setGatheringRewardQueue({ ...DEFAULT_BONUS_REWARD_QUEUE });
    return true;
  }

  function handleSocketPocketCardToProcessing(cardId, slotId) {
    const card = pocket.find(entry => sameCardId(entry.id, cardId));
    if (!card) return false;
    const target = processingSlots.find(slot => slot.slotId === slotId);
    if (!target) return false;
    if (sameCardId(target.card?.id, cardId)) return false;
    const displaced = target.card ? { ...target.card } : null;

    setProcessingSlots(prev =>
      prev.map(slot => slot.slotId === slotId
        ? startProcessingSlot({
            ...slot,
            card: { ...card },
            startedAt: null,
            endsAt: null,
          })
        : slot)
    );
    resolveSlotSwap(cardId, displaced);
    return true;
  }

  function handleUnsocketProcessingCard(slotId) {
    let removedCard = null;
    setProcessingSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || !slot.card) return slot;
        removedCard = { ...slot.card };
        return { ...slot, card: null, startedAt: null, endsAt: null };
      })
    );
    if (!removedCard) return false;
    /**
     * Released to the COLLECTION, not the Hand. Station slots hold copies of collection cards and
     * `collection` always still has the original, so clearing the slot IS returning it — no state to
     * move. It used to push the card into the Hand when there was room, which meant the same button
     * did two different things depending on how full your hand was, and silently filled a hand you
     * were about to drag something else into. Drag a card out of a slot onto the Hand when that is
     * what you want; see handleAddToHandFromStation.
     */
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
    if (!hasQueuedProcessedResources(processedClaimQueue) && !hasQueuedBonusRewards(processingRewardQueue)) return false;
    setProcessedInventory(prev => addProcessedCounts(prev, processedClaimQueue));
    if (hasQueuedBonusRewards(processingRewardQueue)) {
      const { coins = 0, ...elementalDrops } = processingRewardQueue;
      if (coins > 0) {
        setBalance(prev => Math.round((prev + coins) * 100) / 100);
      }
      setResources(prev => mergeResourceCounts(prev, elementalDrops));
    }
    setProcessedClaimQueue({ ...DEFAULT_PROCESSED_INVENTORY });
    setProcessingRewardQueue({ ...DEFAULT_BONUS_REWARD_QUEUE });
    return true;
  }

  function handleSocketPocketCardToExpedition(cardId, slotId) {
    if (expeditionRun?.state && expeditionRun.state !== EXPEDITION_STATES.SETUP) return false;
    const card = pocket.find(entry => sameCardId(entry.id, cardId));
    if (!card) return false;
    const target = expeditionUnitSlots.find(slot => slot.slotId === slotId);
    if (!target) return false;
    if (sameCardId(target.card?.id, cardId)) return false;
    const displaced = target.card ? { ...target.card } : null;

    setExpeditionUnitSlots(prev =>
      prev.map(slot => slot.slotId === slotId ? { ...slot, card: { ...card } } : slot)
    );
    resolveSlotSwap(cardId, displaced);
    return true;
  }

  function handleUnsocketExpeditionCard(slotId) {
    let removedCard = null;
    setExpeditionUnitSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || !slot.card) return slot;
        removedCard = { ...slot.card };
        return { ...slot, card: null };
      })
    );
    if (!removedCard) return false;
    /**
     * Released to the COLLECTION, not the Hand. Station slots hold copies of collection cards and
     * `collection` always still has the original, so clearing the slot IS returning it — no state to
     * move. It used to push the card into the Hand when there was room, which meant the same button
     * did two different things depending on how full your hand was, and silently filled a hand you
     * were about to drag something else into. Drag a card out of a slot onto the Hand when that is
     * what you want; see handleAddToHandFromStation.
     */
    return true;
  }

  function handleLoadExpeditionSupplyFromCarry(slotId) {
    if (!carriedResource || !['gathered', 'processed'].includes(carriedResource.source)) return false;
    const slot = expeditionSupplySlots.find(entry => entry.slotId === slotId);
    if (!slot) return false;
    if (slot.id && slot.id !== carriedResource.id) return false;
    const count = carriedResource.count;
    const description =
      carriedResource.source === 'gathered'
        ? DEFAULT_GATHERING_INVENTORY[carriedResource.id] != null
          ? ALL_GATHERING_RESOURCES.find(entry => entry.id === carriedResource.id)?.description ?? ''
          : ''
        : PROCESSED_RESOURCES.find(entry => entry.id === carriedResource.id)?.description ?? '';
    setExpeditionSupplySlots(prev =>
      prev.map(entry =>
        entry.slotId === slotId
          ? {
              ...entry,
              source: carriedResource.source,
              id: carriedResource.id,
              name: carriedResource.name,
              description,
              artKey: carriedResource.id,
              count: (entry.count ?? 0) + count,
            }
          : entry
      )
    );
    setCarriedResource(null);
    return true;
  }

  function handleUnsocketExpeditionSupply(slotId) {
    let removed = null;
    setExpeditionSupplySlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || !slot.id || !(slot.count > 0)) return slot;
        removed = { source: slot.source, id: slot.id, count: slot.count };
        return { ...slot, source: null, id: null, name: '', description: '', artKey: null, count: 0 };
      })
    );
    if (!removed) return false;
    setInventoryResourceCount(removed.source, removed.id, getAvailableResourceCount(removed.source, removed.id) + removed.count);
    return true;
  }

  function handleLoadExpeditionArcanaFromCarry(slotId) {
    if (!carriedResource || carriedResource.source !== 'arcana-item') return false;
    const slot = expeditionArcanaSlots.find(entry => entry.slotId === slotId);
    if (!slot || slot.itemId) return false;
    const [entry] = carriedResource.entries ?? [];
    if (!entry) return false;

    setExpeditionArcanaSlots(prev =>
      prev.map(current =>
        current.slotId === slotId
          ? {
              ...current,
              inventoryEntryId: entry.inventoryEntryId,
              itemId: entry.itemId,
              name: entry.name,
              category: entry.category,
              description: entry.description,
              effect: entry.effect,
              artKey: ARCANA_ITEMS_BY_ID[entry.itemId]?.artKey ?? null,
            }
          : current
      )
    );

    if ((carriedResource.count ?? 0) > 1) {
      setCarriedResource(current => {
        if (!current || current.source !== 'arcana-item') return current;
        const remainingEntries = (current.entries ?? []).slice(1);
        return {
          ...current,
          count: current.count - 1,
          entries: remainingEntries,
        };
      });
    } else {
      setCarriedResource(null);
    }
    return true;
  }

  function handleUnsocketExpeditionArcana(slotId) {
    let removedEntry = null;
    setExpeditionArcanaSlots(prev =>
      prev.map(slot => {
        if (slot.slotId !== slotId || !slot.itemId) return slot;
        removedEntry = {
          inventoryEntryId: slot.inventoryEntryId,
          itemId: slot.itemId,
          name: slot.name,
          category: slot.category,
          description: slot.description,
          effect: slot.effect,
        };
        return { ...slot, inventoryEntryId: null, itemId: null, name: '', category: '', description: '', effect: null, artKey: null };
      })
    );
    if (!removedEntry) return false;
    setArcanaInventory(prev => [...prev, removedEntry]);
    return true;
  }

  function handleUnlockExpeditionSlot(type) {
    const slots = type === 'unit'
      ? expeditionUnitSlots
      : type === 'supply'
        ? expeditionSupplySlots
        : expeditionArcanaSlots;
    const limits = EXPEDITION_SLOT_LIMITS[type];
    const currentCapacity = slots.length;
    if (!limits || currentCapacity >= limits.max) return false;
    const cost = getExpeditionUpgradeCost(type, currentCapacity);
    if (!cost || balance < cost) return false;
    setBalance(prev => Math.round((prev - cost) * 100) / 100);
    if (type === 'unit') setExpeditionUnitSlots(prev => normalizeExpeditionUnitSlots(prev, prev.length + 1));
    if (type === 'supply') setExpeditionSupplySlots(prev => normalizeExpeditionSupplySlots(prev, prev.length + 1));
    if (type === 'arcana') setExpeditionArcanaSlots(prev => normalizeExpeditionArcanaSlots(prev, prev.length + 1));
    return true;
  }

  function handleSendExpedition() {
    if (expeditionRun?.state && expeditionRun.state !== EXPEDITION_STATES.SETUP) return false;
    const nextRun = startExpeditionRun({
      difficultyId: expeditionDifficultyId,
      unitSlots: expeditionUnitSlots,
      supplySlots: expeditionSupplySlots,
      arcanaSlots: expeditionArcanaSlots,
    });
    if (!nextRun.stats.unitResults.some(entry => entry.card)) return false;
    audioEngine.play(SOUND_IDS.expeditionSend);
    setExpeditionRun(nextRun);
    return true;
  }

  function handleAdvanceExpeditionReveal() {
    audioEngine.play(SOUND_IDS.expeditionReveal);
    setExpeditionRun(current => {
      if (current?.state !== EXPEDITION_STATES.REVEAL) return current;
      const totalResults = current.unitResults?.length ?? 0;
      if ((current.revealIndex ?? 0) >= totalResults) {
        return { ...current, state: EXPEDITION_STATES.COLLECT };
      }
      const nextRevealIndex = (current.revealIndex ?? 0) + 1;
      if (nextRevealIndex >= totalResults) {
        return {
          ...current,
          revealIndex: totalResults,
          state: EXPEDITION_STATES.COLLECT,
        };
      }
      return { ...current, revealIndex: nextRevealIndex };
    });
  }

  function handleConfirmExpeditionCollect() {
    if (![EXPEDITION_STATES.REVEAL, EXPEDITION_STATES.COLLECT].includes(expeditionRun?.state)) return false;
    audioEngine.play(SOUND_IDS.expeditionCollect);

    const rewardEntries = expeditionRun.rewardEntries ?? [];
    let coinDelta = 0;
    const oreAdds = {};
    const ingotAdds = {};
    const gatheredAdds = {};
    const processedAdds = {};
    const arcanaAdds = {};

    rewardEntries.forEach(entry => {
      if (entry.source === 'coins') coinDelta += entry.amount ?? 0;
      if (entry.source === 'ore') oreAdds[entry.id] = (oreAdds[entry.id] ?? 0) + (entry.amount ?? 0);
      if (entry.source === 'ingot') ingotAdds[entry.id] = (ingotAdds[entry.id] ?? 0) + (entry.amount ?? 0);
      if (entry.source === 'gathered') gatheredAdds[entry.id] = (gatheredAdds[entry.id] ?? 0) + (entry.amount ?? 0);
      if (entry.source === 'processed') processedAdds[entry.id] = (processedAdds[entry.id] ?? 0) + (entry.amount ?? 0);
      if (entry.source === 'arcana') arcanaAdds[entry.id] = (arcanaAdds[entry.id] ?? 0) + (entry.amount ?? 0);
    });

    if (coinDelta > 0) {
      setBalance(prev => Math.round((prev + coinDelta) * 100) / 100);
    }
    if (Object.keys(oreAdds).length > 0) setOreInventory(prev => addOreCounts(prev, oreAdds));
    if (Object.keys(ingotAdds).length > 0) {
      setIngotInventory(prev => {
        const next = { ...prev };
        Object.entries(ingotAdds).forEach(([id, count]) => {
          next[id] = (next[id] ?? 0) + count;
        });
        return next;
      });
    }
    if (Object.keys(gatheredAdds).length > 0) setGatheredInventory(prev => addGatheredCounts(prev, gatheredAdds));
    if (Object.keys(processedAdds).length > 0) setProcessedInventory(prev => addProcessedCounts(prev, processedAdds));
    if (Object.keys(arcanaAdds).length > 0) setResources(prev => mergeResourceCounts(prev, arcanaAdds));

    const deadIds = [];
    const survivorsToPocket = [];
    const injuredUpdates = new Map();

    (expeditionRun.unitResults ?? []).forEach(result => {
      if (!result.card) return;
      if (result.outcome === 'dead') {
        deadIds.push(result.card.id);
        return;
      }
      if (result.outcome === 'injured') {
        injuredUpdates.set(String(result.card.id), Date.now() + 30 * 60 * 1000);
        return;
      }
      survivorsToPocket.push({ ...result.card });
    });

    if (injuredUpdates.size > 0) {
      setCollection(prev => prev.map(card => injuredUpdates.has(String(card.id)) ? { ...card, injuredUntil: injuredUpdates.get(String(card.id)) } : card));
    }
    if (deadIds.length > 0) {
      setCollection(prev => prev.filter(card => !deadIds.some(id => sameCardId(card.id, id))));
      setPocket(prev => prev.filter(card => !deadIds.some(id => sameCardId(card.id, id))));
      clearMiningCards(deadIds);
      clearGatheringCards(deadIds);
      clearProcessingCards(deadIds);
      clearForgeCards(deadIds);
      clearExpeditionCards(deadIds);
    }

    setPocket(prev => {
      const next = [...prev];
      survivorsToPocket.forEach(card => {
        if (next.some(existing => sameCardId(existing.id, card.id))) return;
        if (next.length < pocketCapacity) next.push(card);
      });
      return next;
    });

    setExpeditionUnitSlots(prev => prev.map(slot => ({ ...slot, card: null })));
    setExpeditionSupplySlots(prev => prev.map(slot => ({ ...slot, source: null, id: null, name: '', description: '', artKey: null, count: 0 })));
    setExpeditionArcanaSlots(prev => prev.map(slot => ({ ...slot, inventoryEntryId: null, itemId: null, name: '', category: '', description: '', effect: null, artKey: null })));
    setExpeditionRun(null);
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
    clearExpeditionCards(cardId);
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

  const opening = pendingCards.length > 0 || pendingResourceCards.length > 0;
  const expeditionStats = calculateExpeditionStats({
    difficultyId: expeditionRun?.difficultyId ?? expeditionDifficultyId,
    unitSlots: expeditionRun?.unitSlots ?? expeditionUnitSlots,
    supplySlots: expeditionRun?.supplySlots ?? expeditionSupplySlots,
    arcanaSlots: expeditionRun?.arcanaSlots ?? expeditionArcanaSlots,
  });
  const unavailableCardIds = [
    ...mineSlots.filter(slot => slot.card).map(slot => slot.card.id),
    ...gatheringSlots.filter(slot => slot.card).map(slot => slot.card.id),
    ...processingSlots.filter(slot => slot.card).map(slot => slot.card.id),
    ...forgeCardSlots.filter(slot => slot.card).map(slot => slot.card.id),
    ...expeditionUnitSlots.filter(slot => slot.card).map(slot => slot.card.id),
  ];

  // Views that get scenery behind them. Add an entry to give another view a backdrop.
  const BACKDROP_SCENES = {
    [VIEWS.WILDERNESS]: 'wilderness',
    [VIEWS.FOUNDRY]: 'cavern',
  };
  const backdropScene = BACKDROP_SCENES[view] ?? null;

  function handleSetQuality(nextQuality) {
    if (!QUALITY_LEVELS.includes(nextQuality)) return;
    // Recording the choice as non-auto stops the hardware guess from ever
    // overriding it on a later launch.
    setGraphicsSettings({ quality: nextQuality, autoDetected: false });
  }

  return (
    <GraphicsContext.Provider value={graphicsFeatures}>
    {titleScreen && (
      <SplashScreen
        resumable={hasEntered}
        onDismiss={() => { setTitleScreen(false); setHasEntered(true); }}
      />
    )}
    {/* `--dock-gutter` is the Hand fan's visible height, and it is `.main`'s bottom padding plus
        the Bag's bottom inset. The Hand is the one floating surface that reserves space rather
        than overlaying: it spans the bottom of every view, so content running under it would be
        permanently unreachable, not just covered while a drawer happens to be open.
        A constant now — the fan has no hidden state. It used to shrink to 3rem when the hand was
        tucked away, but a carrier that feeds every station should not be something you open first,
        and a control that can hide it is one more state where a drag has nowhere to land. */}
    <div
      className={`app${backdropScene ? ' app--scene' : ''}`}
      style={{ '--dock-gutter': '14rem' }}
    >
      {/* Full-viewport scenery behind the entire page, not just the panel. The
          `app--scene` class above makes that view's panels translucent so the
          landscape actually reads through — without it the backdrop is hidden behind
          opaque containers. Tied to "this view has a backdrop" rather than to the
          quality tier, so the gradient fallback shows through as well. */}
      {backdropScene && (
        <SceneBackdrop scene={backdropScene} className="scene-backdrop--fixed" />
      )}
      <header className="header">
        <h1 className="app-title">
          <button
            type="button"
            className="app-title__button"
            onClick={() => setTitleScreen(true)}
            aria-label="Open the main menu"
          >
            Cards of Arcana
          </button>
        </h1>
        {/* __APP_VERSION__ is replaced at build time from package.json — see vite.config.js. */}
        <span className="app-build" title={`Cards of Arcana ${__APP_VERSION__} — beta`}>
          <span className="app-build__stage">beta</span>
          <span className="app-build__version">{__APP_VERSION__}</span>
        </span>
        <div className="header-right">
          <AudioSettings settings={audioSettings} onChange={setAudioSettings} />
          <div
            className="quality-picker"
            role="group"
            aria-label="Graphics quality"
            title="Graphics quality — lower this if the game feels slow"
          >
            <span className="quality-picker__icon" aria-hidden="true">◐</span>
            {QUALITY_LEVELS.map(level => (
              <button
                key={level}
                type="button"
                className={`quality-picker__btn${graphicsQuality === level ? ' quality-picker__btn--active' : ''}`}
                aria-pressed={graphicsQuality === level}
                onClick={() => handleSetQuality(level)}
              >
                {QUALITY_LABELS[level]}
              </button>
            ))}
          </div>
          <div
            className={`balance${balancePumping ? ' balance--pumping' : ''}`}
            ref={balanceTargetRef}
          >
            <Gold amount={displayBalance} />
          </div>
        </div>
      </header>

      {/* Wrapper so the rune layer can sit beside the scrolling bar and overflow freely. */}
      <div className="nav-shell">
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
          else if (v === VIEWS.EXPEDITION) label = 'Expedition';
          else if (v === VIEWS.LAB) label = 'Lab';
          else label = 'Market';
          const soon = COMING_SOON_VIEWS.has(v);
          return (
            <button
              key={v}
              ref={el => {
                tabRefs.current[i] = el;
                if (v === VIEWS.UNPACK) unpackBtnRef.current = el;
                if (v === VIEWS.COLLECTION) collectionBtnRef.current = el;
                if (v === VIEWS.ARCANA) arcanaBtnRef.current = el;
              }}
              className={`${view === v ? 'active' : ''}${soon ? ' tab--soon' : ''}`.trim()}
              style={{ '--tab-accent': TAB_ACCENTS[v] }}
              onClick={() => setView(v)}
              disabled={opening || soon}
              title={soon ? 'Coming soon' : undefined}
            >
              <span className="tab-icon">{TAB_ICONS[v]}</span>
              {label}
              {soon && <span className="tab-soon-tag">Soon</span>}
            </button>
          );
        })}
        <div
          className="nav-selection"
          style={{
            left: `${underline.left}px`,
            width: `${underline.width}px`,
            '--sel-accent': TAB_ACCENTS[view] ?? '#d4a44c',
          }}
        />
      </nav>

      <div className="nav-rune-layer" aria-hidden="true">
        {runeGroups.map(group => (
          <span
            key={group.key}
            className={`tab-rune-stream${group.leaving ? ' tab-rune-stream--leaving' : ''}`}
            style={{
              left: `${group.left}px`,
              width: `${group.width}px`,
              '--tab-accent': TAB_ACCENTS[group.view] ?? '#d4a44c',
            }}
          >
            <span className="tab-rune-particle">ᚱ</span>
            <span className="tab-rune-particle">ᛟ</span>
            <span className="tab-rune-particle">⩔</span>
            <span className="tab-rune-particle">𐌘</span>
            <span className="tab-rune-particle">ᛠ</span>
            <span className="tab-rune-particle">𐋐</span>
          </span>
        ))}

        {lootMarkers.map(marker => (
          <span
            key={marker.view}
            className={`tab-loot${marker.state === 'new' ? ' tab-loot--new' : ''}`}
            style={{ left: `${marker.centre}px`, '--tab-accent': TAB_ACCENTS[marker.view] ?? '#d4a44c' }}
            role="img"
            aria-label={marker.state === 'new' ? 'New uncollected loot' : 'Uncollected loot'}
          />
        ))}
      </div>
      </div>

      {/* `main--fit` marks views laid out to fit the viewport exactly: they own their
          internal scroll regions and the pane itself never scrolls. Views absent from
          this set keep the pane's own scroll, so they behave as they always did. */}
      <main
        className={[
          'main',
          FIT_VIEWS.has(view) ? 'main--fit' : '',
          view === VIEWS.COLLECTION ? 'main--collection' : '',
          view === VIEWS.ARCANA ? 'main--arcana' : '',
          view === VIEWS.EXPEDITION ? 'main--expedition' : '',
        ].filter(Boolean).join(' ')}
      >
        {view === VIEWS.SHOP && (
          <Shop
            balance={balance}
            onBuyPack={handleBuyPack}
            packsNavRef={unpackBtnRef}
            packsHeld={packs.length}
            maxPacks={MAX_HELD_PACKS}
          />
        )}
        {view === VIEWS.UNPACK && (
          <UnpackPage
            packs={packs}
            arcanaInventory={arcanaInventory}
            pendingCards={pendingCards}
            pendingResourceCards={pendingResourceCards}
            onCoinPop={spawnGoldPop}
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
            lockedCardIds={unavailableCardIds}
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
            mineRewardQueue={mineRewardQueue}
            forgeCardSlots={forgeCardSlots}
            forgeOreSlots={forgeOreSlots}
            forgeIngredientSlots={forgeIngredientSlots}
            forgeFuelSlots={forgeFuelSlots}
            ingotClaimQueue={ingotClaimQueue}
            forgeRewardQueue={forgeRewardQueue}
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
            gatheringRewardQueue={gatheringRewardQueue}
            processingSlots={processingSlots}
            processedClaimQueue={processedClaimQueue}
            processingRewardQueue={processingRewardQueue}
            returnsGatheringCardsToPocket={pocket.length < pocketCapacity}
            returnsProcessingCardsToPocket={pocket.length < pocketCapacity}
            collectTargetRef={inventoryHeaderRef}
            summonTargetRef={unpackBtnRef}
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
        {view === VIEWS.EXPEDITION && (
          <Expedition
            balance={balance}
            pocket={pocket}
            carriedResource={carriedResource}
            difficultyId={expeditionDifficultyId}
            unitSlots={expeditionUnitSlots}
            supplySlots={expeditionSupplySlots}
            arcanaSlots={expeditionArcanaSlots}
            expeditionRun={expeditionRun}
            stats={expeditionStats}
            nextUnitSlotCost={getExpeditionUpgradeCost('unit', expeditionUnitSlots.length)}
            nextSupplySlotCost={getExpeditionUpgradeCost('supply', expeditionSupplySlots.length)}
            nextArcanaSlotCost={getExpeditionUpgradeCost('arcana', expeditionArcanaSlots.length)}
            onSetDifficulty={setExpeditionDifficultyId}
            onSocketUnit={handleSocketPocketCardToExpedition}
            onUnsocketUnit={handleUnsocketExpeditionCard}
            onLoadSupply={handleLoadExpeditionSupplyFromCarry}
            onUnsocketSupply={handleUnsocketExpeditionSupply}
            onLoadArcana={handleLoadExpeditionArcanaFromCarry}
            onUnsocketArcana={handleUnsocketExpeditionArcana}
            onUnlockSlot={handleUnlockExpeditionSlot}
            onSend={handleSendExpedition}
            onAdvanceReveal={handleAdvanceExpeditionReveal}
            onConfirmCollect={handleConfirmExpeditionCollect}
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
        onReorder={handlePocketReorder}
        onPlaceFromCollection={handlePocketPlaceFromCollection}
        onAddFromStation={handleAddToHandFromStation}
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
      <div className="placement-echo-layer" aria-hidden="true">
        {placementEchoes.map(echo => (
          <PlacementEcho
            key={echo.key}
            x={echo.x}
            y={echo.y}
            size={echo.size}
            hole={echo.hole}
            rarity={echo.rarity}
            tier={echo.tier}
            affixes={echo.affixes}
          />
        ))}
      </div>

      {goldBursts.map(burst => (
        <GoldBurst
          key={burst.key}
          mode={burst.mode}
          size={burst.size}
          from={burst.from}
          to={burst.to}
          countScale={burst.countScale}
          seed={burst.seed}
        />
      ))}
    </div>
    </GraphicsContext.Provider>
  );
}
