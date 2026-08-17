/**
 * Canonical gemstone catalogue.
 *
 * Gems are stored in the gathered-material inventory even when a Mine produces them. That gives treasure
 * rewards and mined gems one identity instead of creating a second, incompatible copy under Ores.
 */

export const GEM_CUTS = Object.freeze([
  { tier: 1, prefix: 'dull',      label: 'Dull',      minRarity: 'rare' },
  { tier: 2, prefix: 'cut',       label: 'Cut',       minRarity: 'uncommon' },
  { tier: 3, prefix: 'brilliant', label: 'Brilliant', minRarity: 'rare' },
  { tier: 4, prefix: 'exalted',   label: 'Exalted',   minRarity: 'epic' },
  { tier: 5, prefix: 'royal',     label: 'Royal',     minRarity: 'legendary' },
]);

export const GEMSTONES = Object.freeze([
  { id: 'diamond',  label: 'Diamond',  color: '#d8f1ff' },
  { id: 'emerald',  label: 'Emerald',  color: '#3ed98a' },
  { id: 'ruby',     label: 'Ruby',     color: '#ec4d58' },
  { id: 'sapphire', label: 'Sapphire', color: '#4f82ed' },
  { id: 'topaz',    label: 'Topaz',    color: '#e6ad42' },
]);

export const GEM_RESOURCES = Object.freeze(GEM_CUTS.flatMap(cut => GEMSTONES.map(gem => Object.freeze({
  id: `${cut.prefix}_${gem.id}`,
  name: `${cut.label} ${gem.label}`,
  artKey: `${cut.prefix}_${gem.id}`,
  tier: cut.tier,
  minRarity: cut.minRarity,
  family: 'Gemstone',
  color: gem.color,
  glow: `${gem.color}55`,
  description: `${cut.label} ${gem.label.toLowerCase()} suitable for socketing, attunement, and high-value crafting.`,
}))));

export const GEM_RESOURCES_BY_ID = Object.freeze(Object.fromEntries(
  GEM_RESOURCES.map(resource => [resource.id, resource]),
));

export const DULL_GEMS = Object.freeze(GEM_RESOURCES.filter(resource => resource.tier === 1));
export const TREASURE_GEMS = Object.freeze(GEM_RESOURCES.filter(resource => resource.tier <= 3));
