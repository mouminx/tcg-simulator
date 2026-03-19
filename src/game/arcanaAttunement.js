import { ARCANA_SLOTS, ATTUNEMENT_FAMILIES } from './arcana';
import { resolveArcanaItem } from './arcanaCrafting';

export const ATTUNEMENT_SLOT_RULES = {
  [ARCANA_SLOTS.CALLING]: {
    slotId: ARCANA_SLOTS.CALLING,
    label: 'Calling slot',
    acceptedCategory: ATTUNEMENT_FAMILIES.charms.category,
  },
  [ARCANA_SLOTS.SURGE]: {
    slotId: ARCANA_SLOTS.SURGE,
    label: 'Surge slot',
    acceptedCategory: ATTUNEMENT_FAMILIES.catalysts.category,
  },
  [ARCANA_SLOTS.INSCRIPTION]: {
    slotId: ARCANA_SLOTS.INSCRIPTION,
    label: 'Inscription slot',
    acceptedCategory: ATTUNEMENT_FAMILIES.sigils.category,
  },
};

/**
 * @typedef {'calling' | 'surge' | 'inscription'} AttunementSlotId
 */

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
 *   id: string,
 *   name: string,
 *   category: 'charm' | 'catalyst' | 'sigil',
 *   description: string,
 *   effect: Record<string, unknown>,
 *   recipe: Array<{ essenceId: string, amount: number }>,
 * }} ArcanaItemConfig
 */

/**
 * @typedef {{
 *   slotId: AttunementSlotId,
 *   inventoryEntryId: string,
 *   itemId: string,
 *   name: string,
 *   category: 'charm' | 'catalyst' | 'sigil',
 * }} SlottedAttunementItem
 */

/**
 * @typedef {Record<AttunementSlotId, SlottedAttunementItem | null>} AttunementLoadout
 */

/**
 * @typedef {{
 *   ok: boolean,
 *   reason: 'unknown_slot' | 'missing_item' | 'category_mismatch' | 'slot_mismatch' | null,
 *   slotId: AttunementSlotId,
 *   expectedCategory: 'charm' | 'catalyst' | 'sigil' | null,
 *   itemConfig: ArcanaItemConfig | null,
 * }} ValidateSlotItemResult
 */

/**
 * @typedef {{
 *   ok: boolean,
 *   reason: 'unknown_slot' | 'missing_item' | 'category_mismatch' | 'slot_mismatch' | null,
 *   slotId: AttunementSlotId | null,
 *   assignedItem: SlottedAttunementItem | null,
 *   replacedItem: SlottedAttunementItem | null,
 *   nextLoadout: AttunementLoadout,
 * }} AssignSlotItemResult
 */

/**
 * @typedef {{
 *   ok: boolean,
 *   isComplete: boolean,
 *   occupiedSlots: AttunementSlotId[],
 *   emptySlots: AttunementSlotId[],
 *   duplicateInventoryEntryIds: string[],
 *   invalidSlots: Array<{
 *     slotId: AttunementSlotId,
 *     reason: string,
 *     inventoryEntryId?: string,
 *   }>,
 *   slotChecks: Record<AttunementSlotId, {
 *     ok: boolean,
 *     isEmpty: boolean,
 *     assignedItem: SlottedAttunementItem | null,
 *     reason: string | null,
 *   }>,
 * }} ValidateAttunementLoadoutResult
 */

/**
 * @typedef {{
 *   consumedItems: ArcanaInventoryItem[],
 *   consumedInventoryEntryIds: string[],
 *   missingInventoryEntryIds: string[],
 *   nextInventory: ArcanaInventoryItem[],
 *   nextLoadout: AttunementLoadout,
 * }} ConsumeSlottedItemsResult
 */

export const DEFAULT_ATTUNEMENT_LOADOUT = Object.freeze({
  [ARCANA_SLOTS.CALLING]: null,
  [ARCANA_SLOTS.SURGE]: null,
  [ARCANA_SLOTS.INSCRIPTION]: null,
});

/**
 * @returns {AttunementLoadout}
 */
export function createEmptyAttunementLoadout() {
  return {
    [ARCANA_SLOTS.CALLING]: null,
    [ARCANA_SLOTS.SURGE]: null,
    [ARCANA_SLOTS.INSCRIPTION]: null,
  };
}

/**
 * @param {Partial<AttunementLoadout> | null | undefined} loadout
 * @returns {AttunementLoadout}
 */
function normalizeLoadout(loadout) {
  return {
    ...createEmptyAttunementLoadout(),
    ...(loadout ?? {}),
  };
}

/**
 * @param {ArcanaInventoryItem[] | undefined} inventory
 * @param {string | undefined} inventoryEntryId
 * @returns {ArcanaInventoryItem | null}
 */
export function findArcanaInventoryItem(inventory, inventoryEntryId) {
  if (!inventoryEntryId) return null;
  return (inventory ?? []).find(item => item.inventoryEntryId === inventoryEntryId) ?? null;
}

/**
 * @param {ArcanaInventoryItem | ArcanaItemConfig | null | undefined} itemOrInventoryItem
 * @returns {ArcanaItemConfig | null}
 */
function resolveItemConfigFromEntry(itemOrInventoryItem) {
  if (!itemOrInventoryItem) return null;
  if ('inventoryEntryId' in itemOrInventoryItem) return resolveArcanaItem(itemOrInventoryItem.itemId);
  return resolveArcanaItem(itemOrInventoryItem);
}

/**
 * @param {ArcanaInventoryItem | ArcanaItemConfig | null | undefined} itemOrInventoryItem
 * @returns {AttunementSlotId | null}
 */
export function getCorrectAttunementSlot(itemOrInventoryItem) {
  const config = resolveItemConfigFromEntry(itemOrInventoryItem);
  const slot = config?.effect?.slot;
  return typeof slot === 'string' && slot in ATTUNEMENT_SLOT_RULES ? slot : null;
}

/**
 * @param {AttunementSlotId} slotId
 * @param {ArcanaInventoryItem | ArcanaItemConfig | null | undefined} itemOrInventoryItem
 * @returns {ValidateSlotItemResult}
 */
export function validateItemForSlot(slotId, itemOrInventoryItem) {
  const slotRule = ATTUNEMENT_SLOT_RULES[slotId];
  const itemConfig = resolveItemConfigFromEntry(itemOrInventoryItem);

  if (!slotRule) {
    return {
      ok: false,
      reason: 'unknown_slot',
      slotId,
      expectedCategory: null,
      itemConfig: null,
    };
  }

  if (!itemConfig) {
    return {
      ok: false,
      reason: 'missing_item',
      slotId,
      expectedCategory: slotRule.acceptedCategory,
      itemConfig: null,
    };
  }

  if (itemConfig.category !== slotRule.acceptedCategory) {
    return {
      ok: false,
      reason: 'category_mismatch',
      slotId,
      expectedCategory: slotRule.acceptedCategory,
      itemConfig,
    };
  }

  if (itemConfig.effect?.slot !== slotId) {
    return {
      ok: false,
      reason: 'slot_mismatch',
      slotId,
      expectedCategory: slotRule.acceptedCategory,
      itemConfig,
    };
  }

  return {
    ok: true,
    reason: null,
    slotId,
    expectedCategory: slotRule.acceptedCategory,
    itemConfig,
  };
}

/**
 * @param {ArcanaInventoryItem} inventoryItem
 * @param {AttunementSlotId} slotId
 * @returns {SlottedAttunementItem}
 */
function createSlottedItem(inventoryItem, slotId) {
  return {
    slotId,
    inventoryEntryId: inventoryItem.inventoryEntryId,
    itemId: inventoryItem.itemId,
    name: inventoryItem.name,
    category: inventoryItem.category,
  };
}

/**
 * @param {Partial<AttunementLoadout> | null | undefined} loadout
 * @param {ArcanaInventoryItem} inventoryItem
 * @param {AttunementSlotId | undefined} slotId
 * @returns {AssignSlotItemResult}
 */
export function assignInventoryItemToSlot(loadout, inventoryItem, slotId = undefined) {
  const nextLoadout = normalizeLoadout(loadout);
  const resolvedSlotId = slotId ?? getCorrectAttunementSlot(inventoryItem);

  if (!resolvedSlotId) {
    return {
      ok: false,
      reason: 'unknown_slot',
      slotId: null,
      assignedItem: null,
      replacedItem: null,
      nextLoadout,
    };
  }

  const validation = validateItemForSlot(resolvedSlotId, inventoryItem);
  if (!validation.ok) {
    return {
      ok: false,
      reason: validation.reason,
      slotId: resolvedSlotId,
      assignedItem: null,
      replacedItem: null,
      nextLoadout,
    };
  }

  for (const candidateSlotId of Object.keys(nextLoadout)) {
    if (nextLoadout[candidateSlotId]?.inventoryEntryId === inventoryItem.inventoryEntryId) {
      nextLoadout[candidateSlotId] = null;
    }
  }

  const replacedItem = nextLoadout[resolvedSlotId] ?? null;
  const assignedItem = createSlottedItem(inventoryItem, resolvedSlotId);
  nextLoadout[resolvedSlotId] = assignedItem;

  return {
    ok: true,
    reason: null,
    slotId: resolvedSlotId,
    assignedItem,
    replacedItem,
    nextLoadout,
  };
}

/**
 * @param {Partial<AttunementLoadout> | null | undefined} loadout
 * @param {AttunementSlotId} slotId
 * @param {ArcanaInventoryItem} inventoryItem
 * @returns {AssignSlotItemResult}
 */
export function replaceSlottedItem(loadout, slotId, inventoryItem) {
  return assignInventoryItemToSlot(loadout, inventoryItem, slotId);
}

/**
 * @param {Partial<AttunementLoadout> | null | undefined} loadout
 * @param {AttunementSlotId} slotId
 * @returns {{ removedItem: SlottedAttunementItem | null, nextLoadout: AttunementLoadout }}
 */
export function removeSlottedItem(loadout, slotId) {
  const nextLoadout = normalizeLoadout(loadout);
  const removedItem = nextLoadout[slotId] ?? null;
  if (slotId in nextLoadout) nextLoadout[slotId] = null;
  return { removedItem, nextLoadout };
}

/**
 * @param {Partial<AttunementLoadout> | null | undefined} loadout
 * @returns {string[]}
 */
export function getSlottedInventoryEntryIds(loadout) {
  return Object.values(normalizeLoadout(loadout))
    .filter(Boolean)
    .map(item => item.inventoryEntryId);
}

/**
 * @param {Partial<AttunementLoadout> | null | undefined} loadout
 * @param {ArcanaInventoryItem[] | undefined} [inventory]
 * @param {{ requireAllSlotsFilled?: boolean }} [options]
 * @returns {ValidateAttunementLoadoutResult}
 */
export function validateAttunementLoadout(loadout, inventory, options = {}) {
  const normalizedLoadout = normalizeLoadout(loadout);
  const requireAllSlotsFilled = options.requireAllSlotsFilled ?? false;
  const occupiedSlots = [];
  const emptySlots = [];
  const invalidSlots = [];
  const slotChecks = {};
  const seenEntryIds = new Map();
  const duplicateInventoryEntryIds = [];

  for (const slotId of Object.keys(ATTUNEMENT_SLOT_RULES)) {
    const assignedItem = normalizedLoadout[slotId];

    if (!assignedItem) {
      emptySlots.push(slotId);
      slotChecks[slotId] = {
        ok: !requireAllSlotsFilled,
        isEmpty: true,
        assignedItem: null,
        reason: requireAllSlotsFilled ? 'empty_slot' : null,
      };
      if (requireAllSlotsFilled) {
        invalidSlots.push({ slotId, reason: 'empty_slot' });
      }
      continue;
    }

    occupiedSlots.push(slotId);
    seenEntryIds.set(
      assignedItem.inventoryEntryId,
      [...(seenEntryIds.get(assignedItem.inventoryEntryId) ?? []), slotId],
    );

    const inventoryItem = Array.isArray(inventory)
      ? findArcanaInventoryItem(inventory, assignedItem.inventoryEntryId)
      : null;

    if (Array.isArray(inventory) && !inventoryItem) {
      slotChecks[slotId] = {
        ok: false,
        isEmpty: false,
        assignedItem,
        reason: 'missing_inventory_item',
      };
      invalidSlots.push({
        slotId,
        reason: 'missing_inventory_item',
        inventoryEntryId: assignedItem.inventoryEntryId,
      });
      continue;
    }

    const validation = validateItemForSlot(slotId, inventoryItem ?? assignedItem);
    slotChecks[slotId] = {
      ok: validation.ok,
      isEmpty: false,
      assignedItem,
      reason: validation.reason,
    };
    if (!validation.ok) {
      invalidSlots.push({
        slotId,
        reason: validation.reason ?? 'invalid_item',
        inventoryEntryId: assignedItem.inventoryEntryId,
      });
    }
  }

  for (const [inventoryEntryId, slots] of seenEntryIds.entries()) {
    if (slots.length > 1) {
      duplicateInventoryEntryIds.push(inventoryEntryId);
      for (const slotId of slots) {
        if (!slotChecks[slotId]) continue;
        slotChecks[slotId] = {
          ...slotChecks[slotId],
          ok: false,
          reason: 'duplicate_item',
        };
        invalidSlots.push({
          slotId,
          reason: 'duplicate_item',
          inventoryEntryId,
        });
      }
    }
  }

  return {
    ok: invalidSlots.length === 0,
    isComplete: emptySlots.length === 0,
    occupiedSlots,
    emptySlots,
    duplicateInventoryEntryIds,
    invalidSlots,
    slotChecks,
  };
}

/**
 * @param {Partial<AttunementLoadout> | null | undefined} loadout
 * @param {ArcanaInventoryItem[]} inventory
 * @returns {ConsumeSlottedItemsResult}
 */
export function consumeSlottedItemsOnPackOpen(loadout, inventory) {
  const normalizedLoadout = normalizeLoadout(loadout);
  const slottedEntryIds = new Set(getSlottedInventoryEntryIds(normalizedLoadout));
  const consumedItems = [];
  const nextInventory = [];

  for (const item of inventory ?? []) {
    if (slottedEntryIds.has(item.inventoryEntryId)) consumedItems.push(item);
    else nextInventory.push(item);
  }

  const consumedInventoryEntryIds = consumedItems.map(item => item.inventoryEntryId);
  const consumedEntryIdSet = new Set(consumedInventoryEntryIds);
  const missingInventoryEntryIds = [...slottedEntryIds].filter(id => !consumedEntryIdSet.has(id));

  return {
    consumedItems,
    consumedInventoryEntryIds,
    missingInventoryEntryIds,
    nextInventory,
    nextLoadout: createEmptyAttunementLoadout(),
  };
}
