import { ARCANA_SLOTS, DEFAULT_RESOURCES, ESSENCES, getElementResourceId } from './arcana';
import {
  createEmptyAttunementLoadout,
  consumeSlottedItemsOnPackOpen,
  findArcanaInventoryItem,
  validateAttunementLoadout,
} from './arcanaAttunement';
import { openPack } from './cards';

export const DEFAULT_ATTUNED_PACK_TYPE_ID = 'blankSlate';

/**
 * @typedef {{
 *   inventoryEntryId: string,
 *   itemId: string,
 *   name: string,
 *   category: 'charm' | 'catalyst' | 'sigil',
 *   description?: string,
 *   effect: Record<string, unknown>,
 *   recipe?: Array<{ essenceId: string, amount: number }>,
 *   craftedAt?: string | null,
 * }} ArcanaInventoryItem
 */

/**
 * @typedef {{
 *   slotId: 'calling' | 'surge' | 'inscription',
 *   inventoryEntryId: string,
 *   itemId: string,
 *   name: string,
 *   category: 'charm' | 'catalyst' | 'sigil',
 * }} SlottedAttunementItem
 */

/**
 * @typedef {{
 *   calling: SlottedAttunementItem | null,
 *   surge: SlottedAttunementItem | null,
 *   inscription: SlottedAttunementItem | null,
 * }} AttunementLoadout
 */

/**
 * @typedef {{
 *   callingCharm: ArcanaInventoryItem | null,
 *   surgeCatalyst: ArcanaInventoryItem | null,
 *   inscriptionSigil: ArcanaInventoryItem | null,
 * }} ActiveAttunementItems
 */

/**
 * @typedef {{
 *   selectedCharm: ArcanaInventoryItem | null,
 *   selectedCatalyst: ArcanaInventoryItem | null,
 *   selectedSigil: ArcanaInventoryItem | null,
 * }} PackRollAttunementOptions
 */

/**
 * @typedef {{
 *   packTypeId?: string,
 *   boosted?: boolean,
 *   attunementLoadout?: Partial<AttunementLoadout> | null,
 *   arcanaInventory?: ArcanaInventoryItem[],
 *   resourceBalances?: Partial<Record<string, number>>,
 *   strictLoadoutValidation?: boolean,
 * }} OpenAttunedPackParams
 */

/**
 * @typedef {{
 *   ok: boolean,
 *   reason: 'invalid_attunement' | null,
 *   packTypeId: string,
 *   cards: any[],
 *   essenceDrops: Array<{ essenceId: string, amount: number }>,
 *   loadoutValidation: ReturnType<typeof validateAttunementLoadout>,
 *   activeAttunement: ActiveAttunementItems,
 *   packRollOptions: PackRollAttunementOptions,
 *   consumedArcanaItems: ArcanaInventoryItem[],
 *   consumedInventoryEntryIds: string[],
 *   nextArcanaInventory: ArcanaInventoryItem[],
 *   nextAttunementLoadout: AttunementLoadout,
 *   nextResources: Record<string, number>,
 * }} OpenAttunedPackResult
 */

/**
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * @param {number} count
 * @returns {string[]}
 */
export function rollBlankSlateEssenceTypes(count) {
  const pool = [...ESSENCES];
  const selected = [];

  while (pool.length > 0 && selected.length < count) {
    const index = randomInt(0, pool.length - 1);
    selected.push(pool[index].id);
    pool.splice(index, 1);
  }

  return selected;
}

/**
 * Blank Slate packs grant 2-3 distinct essence types, each in a quantity of 1-3.
 *
 * @returns {Array<{ essenceId: string, amount: number }>}
 */
export function rollBlankSlateEssenceDrops() {
  const typeCount = randomInt(2, 3);
  return rollBlankSlateEssenceTypes(typeCount).map(essenceId => ({
    essenceId: getElementResourceId(essenceId, 'mote'),
    amount: randomInt(1, 3),
  }));
}

/**
 * @param {Partial<Record<string, number>> | null | undefined} resourceBalances
 * @param {Array<{ essenceId: string, amount: number }>} essenceDrops
 * @returns {Record<string, number>}
 */
export function applyEssenceDrops(resourceBalances, essenceDrops) {
  const nextResources = {
    ...DEFAULT_RESOURCES,
    ...(resourceBalances ?? {}),
  };

  for (const drop of essenceDrops ?? []) {
    nextResources[drop.essenceId] = (nextResources[drop.essenceId] ?? 0) + drop.amount;
  }

  return nextResources;
}

/**
 * Normalize partial loadout input into the three canonical attunement slots.
 * This keeps pack opening logic tolerant of empty or partially filled loadouts.
 *
 * @param {Partial<AttunementLoadout> | null | undefined} loadout
 * @returns {AttunementLoadout}
 */
export function normalizeAttunementLoadout(loadout) {
  return {
    ...createEmptyAttunementLoadout(),
    ...(loadout ?? {}),
  };
}

/**
 * Resolve the actual crafted inventory items currently socketed into each slot.
 *
 * @param {Partial<AttunementLoadout> | null | undefined} loadout
 * @param {ArcanaInventoryItem[]} [arcanaInventory]
 * @returns {ActiveAttunementItems}
 */
export function resolveActiveAttunementItems(loadout, arcanaInventory = []) {
  const normalizedLoadout = normalizeAttunementLoadout(loadout);

  return {
    callingCharm: normalizedLoadout[ARCANA_SLOTS.CALLING]
      ? findArcanaInventoryItem(arcanaInventory, normalizedLoadout[ARCANA_SLOTS.CALLING].inventoryEntryId)
      : null,
    surgeCatalyst: normalizedLoadout[ARCANA_SLOTS.SURGE]
      ? findArcanaInventoryItem(arcanaInventory, normalizedLoadout[ARCANA_SLOTS.SURGE].inventoryEntryId)
      : null,
    inscriptionSigil: normalizedLoadout[ARCANA_SLOTS.INSCRIPTION]
      ? findArcanaInventoryItem(arcanaInventory, normalizedLoadout[ARCANA_SLOTS.INSCRIPTION].inventoryEntryId)
      : null,
  };
}

/**
 * Translate the active attunement loadout into the option shape consumed by `openPack`.
 *
 * @param {Partial<AttunementLoadout> | null | undefined} loadout
 * @param {ArcanaInventoryItem[]} [arcanaInventory]
 * @returns {PackRollAttunementOptions}
 */
export function buildPackRollAttunementOptions(loadout, arcanaInventory = []) {
  const activeAttunement = resolveActiveAttunementItems(loadout, arcanaInventory);
  return {
    selectedCharm: activeAttunement.callingCharm,
    selectedCatalyst: activeAttunement.surgeCatalyst,
    selectedSigil: activeAttunement.inscriptionSigil,
  };
}

/**
 * Open a pack with optional Arcana attunement, then consume any slotted Arcana items.
 * Calling biases name selection, Surge biases tier rolls, and Inscription biases tag rolls.
 *
 * @param {OpenAttunedPackParams} params
 * @returns {OpenAttunedPackResult}
 */
export function openAttunedPack(params = {}) {
  const {
    packTypeId = DEFAULT_ATTUNED_PACK_TYPE_ID,
    boosted = false,
    attunementLoadout = null,
    arcanaInventory = [],
    resourceBalances = DEFAULT_RESOURCES,
    strictLoadoutValidation = true,
  } = params;

  const normalizedLoadout = normalizeAttunementLoadout(attunementLoadout);
  const loadoutValidation = validateAttunementLoadout(normalizedLoadout, arcanaInventory, {
    requireAllSlotsFilled: false,
  });

  if (strictLoadoutValidation && !loadoutValidation.ok) {
    return {
      ok: false,
      reason: 'invalid_attunement',
      packTypeId,
      cards: [],
      essenceDrops: [],
      loadoutValidation,
      activeAttunement: resolveActiveAttunementItems(normalizedLoadout, arcanaInventory),
      packRollOptions: buildPackRollAttunementOptions(normalizedLoadout, arcanaInventory),
      consumedArcanaItems: [],
      consumedInventoryEntryIds: [],
      nextArcanaInventory: [...arcanaInventory],
      nextAttunementLoadout: normalizedLoadout,
      nextResources: applyEssenceDrops(resourceBalances, []),
    };
  }

  const activeAttunement = resolveActiveAttunementItems(normalizedLoadout, arcanaInventory);
  const packRollOptions = buildPackRollAttunementOptions(normalizedLoadout, arcanaInventory);
  const cards = openPack(packTypeId, boosted, packRollOptions);
  const essenceDrops = packTypeId === DEFAULT_ATTUNED_PACK_TYPE_ID ? rollBlankSlateEssenceDrops() : [];
  const consumption = consumeSlottedItemsOnPackOpen(normalizedLoadout, arcanaInventory);
  const nextResources = applyEssenceDrops(resourceBalances, essenceDrops);

  return {
    ok: true,
    reason: null,
    packTypeId,
    cards,
    essenceDrops,
    loadoutValidation,
    activeAttunement,
    packRollOptions,
    consumedArcanaItems: consumption.consumedItems,
    consumedInventoryEntryIds: consumption.consumedInventoryEntryIds,
    nextArcanaInventory: consumption.nextInventory,
    nextAttunementLoadout: consumption.nextLoadout,
    nextResources,
  };
}

/**
 * Blank Slate pack orchestration wrapper.
 *
 * @param {OpenAttunedPackParams} params
 * @returns {OpenAttunedPackResult}
 */
export function openBlankSlatePack(params = {}) {
  return openAttunedPack(params);
}
