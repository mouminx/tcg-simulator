/**
 * Class card art map — classType id → array of variant image URLs.
 * Art lives in src/assets/class-cards/{classType}/{classType}{1-5}.png
 * card.artVariant (0-based index) selects which variant to display.
 */

const classVariantFiles = import.meta.glob('../assets/class-cards/*/*.png', { eager: true });

export const CLASS_ART = (() => {
  const byClass = {};
  for (const [path, mod] of Object.entries(classVariantFiles)) {
    const parts = path.split('/');
    const classType = parts[parts.length - 2].toLowerCase();
    if (!byClass[classType]) byClass[classType] = [];
    byClass[classType].push({ path, url: mod.default });
  }
  // Sort by filename for deterministic index ordering (classType1, classType2, ...)
  return Object.fromEntries(
    Object.entries(byClass).map(([classType, variants]) => [
      classType,
      variants.sort((a, b) => a.path.localeCompare(b.path)).map(v => v.url),
    ]),
  );
})();

/**
 * Legacy creature art map — kept for any remaining references but will be empty
 * once old rarity-folder assets are removed.
 */
const artMap = {};

const commonFiles   = import.meta.glob('../assets/cards/common/*.png',   { eager: true });
const uncommonFiles = import.meta.glob('../assets/cards/uncommon/*.png', { eager: true });
const rareFiles     = import.meta.glob('../assets/cards/rare/*.png',     { eager: true });
const epicFiles     = import.meta.glob('../assets/cards/epic/*.png',     { eager: true });

function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

for (const [path, mod] of Object.entries({ ...commonFiles, ...uncommonFiles, ...rareFiles, ...epicFiles })) {
  const name = titleCase(path.split('/').pop().replace('.png', ''));
  artMap[name] = mod.default;
}

export const CARD_ART = artMap;

// No per-class art position overrides needed — class art is designed to fill the frame.
export const CARD_ART_POSITION = {};
