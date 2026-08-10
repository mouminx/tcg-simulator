/**
 * Artwork lookup for every kind of resource, in one place.
 *
 * These resolvers lived inside `Inventory.jsx`, which was fine while the Bag was the only thing that had to
 * draw an arbitrary resource id. The shop's Goods shelf now shows the actual resource cards rather than
 * plain buy buttons, so it needs the same lookups — and a second copy of "which folder does a `silver` id
 * mean, the ore or the ingot?" is a copy that will answer differently one day.
 *
 * **The separate maps are load-bearing.** `silver`, `gold` and `platinum` exist as BOTH an ore and an ingot
 * with the same filename, so a single merged map silently resolves one to the other's art. Keep them apart
 * and let each resolver name the folder it means.
 *
 * This module holds `import.meta.glob` calls, so it is Vite-only — do not import it from anything that has
 * to run under plain Node. That is the same constraint `audioLibrary.js` carries, and for the same reason.
 */
import { ESSENCES_BY_ID, parseElementResourceId } from './arcana';

const makeArtMap = (files) => {
  const map = {};
  for (const [path, src] of Object.entries(files)) {
    map[path.split('/').pop().replace(/\.webp$/i, '').toLowerCase()] = src;
  }
  return map;
};

const ORE_ART = makeArtMap(import.meta.glob('../assets/ores/*.webp', { eager: true, import: 'default' }));
const INGOT_ART = makeArtMap(import.meta.glob('../assets/ingots/*.webp', { eager: true, import: 'default' }));
const RESOURCE_ART = makeArtMap(import.meta.glob('../assets/resources/*.webp', { eager: true, import: 'default' }));
const CHARM_ART = makeArtMap(import.meta.glob('../assets/cards/charms/*.webp', { eager: true, import: 'default' }));
const ELEMENT_ART = makeArtMap({
  ...import.meta.glob('../assets/elements/essences/*.webp', { eager: true, import: 'default' }),
  ...import.meta.glob('../assets/elements/motes/*.webp', { eager: true, import: 'default' }),
  ...import.meta.glob('../assets/elements/wisps/*.webp', { eager: true, import: 'default' }),
  ...import.meta.glob('../assets/elements/quintessences/*.webp', { eager: true, import: 'default' }),
});

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getResourceArt(key) {
  if (!key) return null;
  const k = key.toLowerCase();
  return RESOURCE_ART[k] ?? CHARM_ART[k] ?? null;
}

export function getArcanaResourceArt(resourceId) {
  if (!resourceId) return null;
  const { elementId, tier } = parseElementResourceId(resourceId);
  const baseName = ESSENCES_BY_ID[elementId]?.name.replace(/ Essence$/i, '') ?? titleCase(elementId);
  const label = tier === 'essence' ? `${baseName} Essence` : `${baseName} ${titleCase(tier)}`;
  const key = label.toLowerCase();

  return ELEMENT_ART[key]
    // `blooming quitessence.webp` is misspelled in the assets; handled here rather than renamed, since the
    // file is referenced by its real name elsewhere.
    ?? ELEMENT_ART[key.replace('quintessence', 'quitessence')]
    ?? RESOURCE_ART[elementId]
    ?? null;
}

export function getOreArt(oreId) {
  if (!oreId) return null;
  const key = oreId.toLowerCase();
  return ORE_ART[key] ?? ORE_ART[`${key} ore`] ?? RESOURCE_ART[key] ?? null;
}

export function getIngotArt(artKey) {
  if (!artKey) return null;
  const key = artKey.toLowerCase();
  return INGOT_ART[key] ?? RESOURCE_ART[key] ?? null;
}

/**
 * Art for a shop good, dispatched on the inventory it is declared to land in.
 *
 * Dispatching on `inventory` rather than guessing from the id is the same rule `handleBuyMaterial` follows
 * when routing the purchase — and it is required for the same reason: `silver` alone cannot tell you whether
 * it means the ore or the ingot.
 */
export function getShopMaterialArt(material) {
  if (!material) return null;
  switch (material.inventory) {
    case 'ore': return getOreArt(material.id);
    case 'ingot': return getIngotArt(material.id);
    case 'resource': return getArcanaResourceArt(material.id);
    case 'gathered':
    case 'processed':
    default: return getResourceArt(material.id);
  }
}
