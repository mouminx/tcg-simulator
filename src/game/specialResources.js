/**
 * Gathered reagents shared by the Mine, Wilderness, Crafting, and Shop.
 *
 * Keeping these definitions outside either station prevents the Bag from needing to guess which
 * station owns a material. `artKey` is the optimized filename without `.webp`.
 */
export const SPECIAL_GATHERED_RESOURCES = Object.freeze([
  Object.freeze({ id: 'rabbitsFoot', name: "Rabbit's Foot", artKey: 'rabbits_foot', tier: 4, color: '#d7c49c', glow: 'rgba(215,196,156,0.32)', description: 'A remarkably fortunate hunting trophy used to focus Luck Callings.' }),
  Object.freeze({ id: 'quickroot', name: 'Quickroot', artKey: 'quickroot', tier: 4, color: '#9fcf72', glow: 'rgba(159,207,114,0.32)', description: 'A restless root that seems to grow between heartbeats, used to focus Production Speed Callings.' }),
  Object.freeze({ id: 'cornucopiaSeed', name: 'Cornucopia Seed', artKey: 'cornucopia_seed', tier: 4, color: '#d4a94f', glow: 'rgba(212,169,79,0.34)', description: 'A rare seed associated with inexhaustible harvests, used to focus Bounty Callings.' }),
  Object.freeze({ id: 'sproutingAcorn', name: 'Sprouting Acorn', artKey: 'sprouting_acorn', tier: 4, color: '#82b862', glow: 'rgba(130,184,98,0.34)', description: 'An acorn alive with persistent growth, used to focus Resource Generation Callings.' }),
  Object.freeze({ id: 'auricVein', name: 'Auric Vein', artKey: 'auric_vein', tier: 3, color: '#e6b84d', glow: 'rgba(230,184,77,0.36)', description: 'A gold-laced mineral seam used to focus Coin Generation Callings.' }),
  Object.freeze({ id: 'compassOre', name: 'Compass Ore', artKey: 'compass_ore', tier: 5, color: '#7dc4cb', glow: 'rgba(125,196,203,0.38)', description: 'A vanishingly rare ore that turns toward hidden wealth, used to focus Treasure Sense Callings.' }),
  Object.freeze({ id: 'cinnabar', name: 'Cinnabar', artKey: 'cinnabar', tier: 5, color: '#bd493e', glow: 'rgba(189,73,62,0.38)', description: 'A brilliant crimson mineral prized by master prospectors and alchemists.' }),
  Object.freeze({ id: 'geode', name: 'Geode', artKey: 'geode', tier: 3, color: '#9978be', glow: 'rgba(153,120,190,0.36)', description: 'An unassuming stone whose crystalline heart marks the vocation of a Prospector.' }),
  Object.freeze({ id: 'obsidian', name: 'Obsidian', artKey: 'obsidian', tier: 4, color: '#554461', glow: 'rgba(85,68,97,0.38)', description: 'Volcanic glass uncovered by skilled miners and prospectors.' }),
  Object.freeze({ id: 'quartz', name: 'Quartz', artKey: 'quartz', tier: 2, color: '#d9cce3', glow: 'rgba(217,204,227,0.32)', description: 'A common crystalline mineral used to focus Miner Callings.' }),
  Object.freeze({ id: 'salt', name: 'Salt', artKey: 'salt', tier: 2, color: '#e2ddd1', glow: 'rgba(226,221,209,0.28)', description: 'Mineral salt used in fluxes, tanning agents, and alchemical preparations.' }),
  Object.freeze({ id: 'smallGameMeat', name: 'Small Game Meat', artKey: 'small_game_meat', tier: 1, color: '#a95f4e', glow: 'rgba(169,95,78,0.30)', description: 'Fresh meat gathered by hunters from common woodland game.' }),
  Object.freeze({ id: 'tallow', name: 'Tallow', artKey: 'tallow', tier: 1, color: '#d2c19c', glow: 'rgba(210,193,156,0.28)', description: 'Rendered animal fat used in practical crafting and preservation.' }),
  Object.freeze({ id: 'bark', name: 'Bark', artKey: 'bark', tier: 2, color: '#8b6642', glow: 'rgba(139,102,66,0.30)', description: 'Tannin-rich bark gathered from forest floors and harvested trees.' }),
]);

export const SPECIAL_GATHERED_RESOURCES_BY_ID = Object.freeze(
  Object.fromEntries(SPECIAL_GATHERED_RESOURCES.map(resource => [resource.id, resource])),
);

export const MINING_SPECIAL_RESOURCE_IDS = Object.freeze([
  'auricVein',
  'compassOre',
  'cinnabar',
  'geode',
  'obsidian',
  'quartz',
  'salt',
]);

export const MINING_SPECIAL_RESOURCES = Object.freeze(
  MINING_SPECIAL_RESOURCE_IDS.map(id => SPECIAL_GATHERED_RESOURCES_BY_ID[id]),
);
