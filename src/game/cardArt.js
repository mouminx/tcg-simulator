/**
 * Card art map — title-cased card name → image URL.
 * Uses Vite's import.meta.glob so new images are picked up automatically.
 * Just drop PNGs into src/assets/cards/{rarity}/ matching the card name.
 */

function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

const artMap = {};

const commonFiles = import.meta.glob('../assets/cards/common/*.png', { eager: true });
for (const [path, mod] of Object.entries(commonFiles)) {
  const name = titleCase(path.split('/').pop().replace('.png', ''));
  artMap[name] = mod.default;
}

// Uncomment as you add images for other rarities:
// const uncommonFiles = import.meta.glob('../assets/cards/uncommon/*.png', { eager: true });
// for (const [path, mod] of Object.entries(uncommonFiles)) {
//   artMap[titleCase(path.split('/').pop().replace('.png', ''))] = mod.default;
// }

export const CARD_ART = artMap;

/**
 * Per-card object-position overrides for the 3:2 art window.
 * Default is 'center center'. Add entries here to shift the crop focus.
 * Values: CSS object-position e.g. 'center 70%' (shift toward bottom)
 */
export const CARD_ART_POSITION = {
  'River Eel':   'center 80%',
  'Reed Viper':  'center 80%',
  'Fungal Mole': 'center 75%',
  'Leaf Sprite': 'center 75%',
  'Dusty Crow':  'center 80%',
  'Hollow Owl':  'center 75%',
  'Ash Lizard':  'center 80%',
};
