import { ARCANA_ITEMS_BY_ID } from './arcana';

/**
 * @typedef {'smoldering' | 'jolting' | 'flowing' | 'blooming' | 'gusting' | 'hollowing' | 'gleaming' | 'ascending'} EssenceId
 */

/**
 * @typedef {{
 *   essenceId: EssenceId,
 *   amount: number,
 * }} ArcanaRecipePart
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   category: 'charm' | 'catalyst' | 'sigil',
 *   recipe: ArcanaRecipePart[],
 *   description: string,
 *   effect: Record<string, unknown>,
 * }} ArcanaItemConfig
 */

/**
 * @typedef {Partial<Record<EssenceId, number>>} EssenceBalances
 */

/**
 * @typedef {{
 *   essenceId: EssenceId,
 *   required: number,
 *   available: number,
 *   missing: number,
 * }} RecipeShortfall
 */

/**
 * @typedef {{
 *   inventoryEntryId: string,
 *   itemId: string,
 *   name: string,
 *   category: 'charm' | 'catalyst' | 'sigil',
 *   description: string,
 *   effect: Record<string, unknown>,
 *   recipe: ArcanaRecipePart[],
 *   craftedAt: string | null,
 * }} ArcanaInventoryItem
 */

/**
 * @typedef {{
 *   itemId?: string,
 *   itemConfig?: ArcanaItemConfig,
 *   essenceBalances: EssenceBalances,
 *   inventory?: ArcanaInventoryItem[],
 *   inventoryEntryId?: string,
 *   craftedAt?: string | null,
 * }} CraftArcanaItemParams
 */

/**
 * @typedef {{
 *   ok: boolean,
 *   reason: 'unknown_item' | 'insufficient_essence' | null,
 *   itemConfig: ArcanaItemConfig | null,
 *   inventoryItem: ArcanaInventoryItem | null,
 *   craftedCount?: number,
 *   nextEssenceBalances: EssenceBalances,
 *   nextInventory: ArcanaInventoryItem[],
 *   missingCosts: RecipeShortfall[],
 * }} CraftArcanaItemResult
 */

/**
 * @param {ArcanaRecipePart[] | ArcanaItemConfig} recipeOrItem
 * @returns {ArcanaRecipePart[]}
 */
function getRecipeParts(recipeOrItem) {
  if (Array.isArray(recipeOrItem)) return recipeOrItem;
  if (recipeOrItem?.recipe) return recipeOrItem.recipe;
  return [];
}

/**
 * @param {string | ArcanaItemConfig | undefined} itemIdOrConfig
 * @returns {ArcanaItemConfig | null}
 */
export function resolveArcanaItem(itemIdOrConfig) {
  if (!itemIdOrConfig) return null;
  if (typeof itemIdOrConfig === 'string') return ARCANA_ITEMS_BY_ID[itemIdOrConfig] ?? null;
  return itemIdOrConfig;
}

/**
 * @param {EssenceBalances} essenceBalances
 * @param {ArcanaRecipePart[] | ArcanaItemConfig} recipeOrItem
 * @returns {RecipeShortfall[]}
 */
export function getRecipeShortfall(essenceBalances, recipeOrItem) {
  const recipe = getRecipeParts(recipeOrItem);
  return recipe
    .map(part => {
      const available = essenceBalances?.[part.essenceId] ?? 0;
      const missing = Math.max(0, part.amount - available);
      return {
        essenceId: part.essenceId,
        required: part.amount,
        available,
        missing,
      };
    })
    .filter(part => part.missing > 0);
}

/**
 * @param {EssenceBalances} essenceBalances
 * @param {ArcanaRecipePart[] | ArcanaItemConfig} recipeOrItem
 * @returns {boolean}
 */
export function canAffordRecipe(essenceBalances, recipeOrItem) {
  return getRecipeShortfall(essenceBalances, recipeOrItem).length === 0;
}

/**
 * @param {EssenceBalances} essenceBalances
 * @param {ArcanaRecipePart[] | ArcanaItemConfig} recipeOrItem
 * @returns {EssenceBalances}
 */
export function subtractEssenceCosts(essenceBalances, recipeOrItem) {
  const recipe = getRecipeParts(recipeOrItem);
  const shortfall = getRecipeShortfall(essenceBalances, recipe);
  if (shortfall.length > 0) {
    const message = shortfall
      .map(part => `${part.essenceId} (${part.available}/${part.required})`)
      .join(', ');
    throw new Error(`Cannot subtract essence costs for an unaffordable recipe: ${message}`);
  }

  const nextBalances = { ...essenceBalances };
  for (const part of recipe) {
    nextBalances[part.essenceId] = (nextBalances[part.essenceId] ?? 0) - part.amount;
  }
  return nextBalances;
}

/**
 * @param {ArcanaInventoryItem[]} inventory
 * @param {string} itemId
 * @returns {string}
 */
export function getNextArcanaInventoryEntryId(inventory, itemId) {
  const prefix = `${itemId}#`;
  let highest = 0;

  for (const entry of inventory ?? []) {
    if (!entry?.inventoryEntryId?.startsWith(prefix)) continue;
    const suffix = Number.parseInt(entry.inventoryEntryId.slice(prefix.length), 10);
    if (Number.isFinite(suffix)) highest = Math.max(highest, suffix);
  }

  return `${itemId}#${highest + 1}`;
}

/**
 * @param {string | ArcanaItemConfig} itemIdOrConfig
 * @param {{ inventoryEntryId?: string, craftedAt?: string | null, inventory?: ArcanaInventoryItem[] }} [options]
 * @returns {ArcanaInventoryItem}
 */
export function createCraftedInventoryItem(itemIdOrConfig, options = {}) {
  const item = resolveArcanaItem(itemIdOrConfig);
  if (!item) throw new Error('Cannot create an inventory item from an unknown Arcana item.');

  const inventory = options.inventory ?? [];
  const inventoryEntryId = options.inventoryEntryId ?? getNextArcanaInventoryEntryId(inventory, item.id);

  return {
    inventoryEntryId,
    itemId: item.id,
    name: item.name,
    category: item.category,
    description: item.description,
    effect: { ...item.effect },
    recipe: item.recipe.map(part => ({ ...part })),
    craftedAt: options.craftedAt ?? null,
  };
}

/**
 * @param {ArcanaInventoryItem[]} inventory
 * @param {ArcanaInventoryItem} inventoryItem
 * @returns {ArcanaInventoryItem[]}
 */
export function addCraftedItemToInventory(inventory, inventoryItem) {
  if (!inventoryItem) throw new Error('Cannot add an empty crafted item to inventory.');
  return [...(inventory ?? []), inventoryItem];
}

/**
 * @param {CraftArcanaItemParams} params
 * @returns {CraftArcanaItemResult}
 */
export function craftArcanaItem(params) {
  const {
    itemId,
    itemConfig,
    essenceBalances,
    inventory = [],
    inventoryEntryId,
    craftedAt = null,
  } = params;

  const resolvedItem = resolveArcanaItem(itemConfig ?? itemId);
  const safeBalances = { ...(essenceBalances ?? {}) };
  const safeInventory = [...inventory];

  if (!resolvedItem) {
    return {
      ok: false,
      reason: 'unknown_item',
      itemConfig: null,
      inventoryItem: null,
      craftedCount: 0,
      nextEssenceBalances: safeBalances,
      nextInventory: safeInventory,
      missingCosts: [],
    };
  }

  const missingCosts = getRecipeShortfall(safeBalances, resolvedItem);
  if (missingCosts.length > 0) {
    return {
      ok: false,
      reason: 'insufficient_essence',
      itemConfig: resolvedItem,
      inventoryItem: null,
      craftedCount: 0,
      nextEssenceBalances: safeBalances,
      nextInventory: safeInventory,
      missingCosts,
    };
  }

  const nextEssenceBalances = subtractEssenceCosts(safeBalances, resolvedItem);
  const inventoryItem = createCraftedInventoryItem(resolvedItem, {
    inventory,
    inventoryEntryId,
    craftedAt,
  });
  const nextInventory = addCraftedItemToInventory(safeInventory, inventoryItem);

  return {
    ok: true,
    reason: null,
    itemConfig: resolvedItem,
    inventoryItem,
    craftedCount: 1,
    nextEssenceBalances,
    nextInventory,
    missingCosts: [],
  };
}
