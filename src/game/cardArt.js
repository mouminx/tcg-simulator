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

const uncommonFiles = import.meta.glob('../assets/cards/uncommon/*.png', { eager: true });
for (const [path, mod] of Object.entries(uncommonFiles)) {
  const name = titleCase(path.split('/').pop().replace('.png', ''));
  artMap[name] = mod.default;
}

const rareFiles = import.meta.glob('../assets/cards/rare/*.png', { eager: true });
for (const [path, mod] of Object.entries(rareFiles)) {
  const name = titleCase(path.split('/').pop().replace('.png', ''));
  artMap[name] = mod.default;
}

// Add more rarities here as you add folders:
// const epicFiles = import.meta.glob('../assets/cards/epic/*.png', { eager: true });
// ...

export const CARD_ART = artMap;

/**
 * Per-card object-position overrides for the 3:2 art window.
 * Default is 'center center'. Add entries here to shift the crop focus.
 * Values: CSS object-position e.g. 'center 70%' (shift toward bottom)
 */
export const CARD_ART_POSITION = {
  'River Eel': 'center 10%',
  'Reed Viper': 'center 20%',
  'Fungal Mole': 'center 25%',
  'Leaf Sprite': 'center 25%',
  'Dusty Crow': 'center 20%',
  'Hollow Owl': 'center 25%',
  'Ash Lizard': 'center 20%',
  'Pebble Ram': 'center 20%',
  'Gust Robin': 'center 20%',
  'Pale Moth': 'center 20%',
  'Moss Turtle': 'center 35%',
  'Cinderfly': 'center 20%',
  'Tidal Shrimp': 'center 40%',
  'Dusk Sparrow': 'center 35%',
  'Snag Heron': 'center 10%',
  'Cobble Imp': 'center 35%',
};
