/**
 * Class card art maps — classType id → array of variant image URLs.
 * card.artVariant (0-based index) selects which variant to display.
 *
 * Art is encoded at two sizes by scripts/optimize-assets.mjs, because card art
 * renders at two very different scales:
 *
 *   CLASS_ART_THUMB  320x480   src/assets/class-cards-thumb/{classType}/
 *     Used everywhere a card appears in a grid or slot (~110-132px wide).
 *     0.59 MiB decoded. The binder shows 32 of these at once, so this is the
 *     size that actually governs memory use.
 *
 *   CLASS_ART        768x1152  src/assets/class-cards/{classType}/
 *     Used only by the 330px viewer modal and hover preview, where a thumb
 *     would look soft on a 2x DPR display. 3.38 MiB decoded, but at most one
 *     or two are ever on screen.
 *
 * CardFace picks between them from its `visualMode` prop.
 */

function buildVariantMap(globResult) {
  const byClass = {};
  for (const [path, url] of Object.entries(globResult)) {
    const parts = path.split('/');
    const classType = parts[parts.length - 2].toLowerCase();
    if (!byClass[classType]) byClass[classType] = [];
    byClass[classType].push({ path, url });
  }
  // Sort by filename for deterministic index ordering (classType1, classType2, ...)
  return Object.fromEntries(
    Object.entries(byClass).map(([classType, variants]) => [
      classType,
      variants.sort((a, b) => a.path.localeCompare(b.path)).map(v => v.url),
    ]),
  );
}

export const CLASS_ART = buildVariantMap(
  import.meta.glob('../assets/class-cards/*/*.webp', { eager: true, import: 'default' }),
);

export const CLASS_ART_THUMB = buildVariantMap(
  import.meta.glob('../assets/class-cards-thumb/*/*.webp', { eager: true, import: 'default' }),
);

/**
 * Resolve the art URL for a card at the given detail level.
 * Falls back to variant 0, then to the other size, then null.
 */
export function getClassArt(classType, artVariant = 0, detail = 'thumb') {
  const primary = detail === 'full' ? CLASS_ART : CLASS_ART_THUMB;
  const fallback = detail === 'full' ? CLASS_ART_THUMB : CLASS_ART;
  const variants = primary[classType] ?? fallback[classType];
  if (!variants) return null;
  return variants[artVariant] ?? variants[0] ?? null;
}

// No per-class art position overrides needed — class art is designed to fill the frame.
export const CARD_ART_POSITION = {};
