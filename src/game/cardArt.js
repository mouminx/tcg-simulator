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

const epicFiles = import.meta.glob('../assets/cards/epic/*.png', { eager: true });
for (const [path, mod] of Object.entries(epicFiles)) {
  const name = titleCase(path.split('/').pop().replace('.png', ''));
  artMap[name] = mod.default;
}

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
  'Pebble Ram': 'center 30%',
  'Gust Robin': 'center 20%',
  'Pale Moth': 'center 30%',
  'Moss Turtle': 'center 35%',
  'Cinderfly': 'center 20%',
  'Tidal Shrimp': 'center 40%',
  'Dusk Sparrow': 'center 35%',
  'Snag Heron': 'center 10%',
  'Cobble Imp': 'center 35%',
  'Blight Lynx': 'center 20%',
  'Swamp Basilisk': 'center 25%',
  'Glacial Stag': 'center 20%',
  'Ashen Stag': 'center 20%',
  'Gale Hound': 'center 20%',
  'Ancient Dragon': 'center 10%',
  'Moonveil Serpent': 'center 20%',
  'Abyssal Titan': 'center 20%',
  'Arcane Behemoth': 'center 20%',
  'Celestial Phoenix': 'center 5%',
  'Frost Colossus': 'center 20%',
  'Lava Drake': 'center 20%',
  'Frostfang Yeti': 'center 20%',
  'Deep Basilisk': 'center 45%',
  'Dread Antler': 'center 20%',
  'Sea Serpent': 'center 10%',
  'Iron Revenant': 'center 10%',
  'Crystal Elemental': 'center 20%',
  'Cinder Roc': 'center 20%',
  'Sunforged Lion': 'center 20%',
  'Obsidian Widow': 'center 20%',
  'Sun Hydra': 'center 20%',
  'Plague Leviathan': 'center 20%',
  'Bloom Hydra': 'center 20%',
  'Ember Colossus': 'center 20%',
  'Shiver Drake': 'center 35%',
  'Abyssal Ray': 'center 20%',
  'Cinder Leviathan': 'center 20%',
  'Stormcaller Roc': 'center 20%',
  'Thunder Bear': 'center 10%',
  'Hollow Phoenix': 'center 20%',
  'Mist Leviathan': 'center 10%',
  'Glacial Sphinx': 'center 20%',
  'Bone Titan': 'center 20%',
  'Thornwall Golem': 'center 30%',
  'Void Serpent': 'center 20%',
  'Bloodmoon Wolf': 'center 10%',
  'Moonfang Wolf': 'center 20%',
  'Marsh Drake': 'center 20%',
  'Dusk Behemoth': 'center 20%',
  'Grave Jackal': 'center 20%',
  'Tide Runner': 'center 20%',
  'Gale Stag': 'center 20%',
  'Hollow Stalker': 'center 30%',
  'Void Chimera': 'center 30%',
  'Ember Falcon': 'center 35%',
  'Shadow Fox': 'center 35%',
  'Coral Scythe': 'center 65%',
  'Frostfang Lynx': 'center 40%',
  'Sunscale Cobra': 'center 15%',
  'Vine Viper': 'center 20%',
  'Storm Hawk': 'center 35%',
  'Ironhorn Beetle': 'center 30%',
  'Dusk Serpent': 'center 10%',
  'Emberlord Fox': 'center 30%',
  'Tempest Golem': 'center 15%',
  'Obsidian Moth': 'center 30%',
  'Tide Prowler': 'center 65%',
  'Gilded Gecko': 'center 10%',
  'Veil Moth': 'center 10%',
  'Crystal Hound': 'center 60%',
  'Nether Mink': 'center 55%',
  'Runetail Gecko': 'center 20%',
};
