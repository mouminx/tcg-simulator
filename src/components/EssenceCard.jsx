import ResourceCard from './ResourceCard';

const MOTE_ART = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/elements/motes/*.webp', { eager: true, import: 'default' }))
    .map(([path, src]) => [path.split('/').pop().replace(/\s+mote\.webp$/i, '').toLowerCase(), src]),
);

const WISP_ART = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/elements/wisps/*.webp', { eager: true, import: 'default' }))
    .map(([path, src]) => [path.split('/').pop().replace(/\s+wisp\.webp$/i, '').toLowerCase(), src]),
);

const ESSENCE_ART = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/elements/essences/*.webp', { eager: true, import: 'default' }))
    .map(([path, src]) => [path.split('/').pop().replace(/\s+essence\.webp$/i, '').toLowerCase(), src]),
);

const QUINTESSENCE_ART = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/elements/quintessences/*.webp', { eager: true, import: 'default' }))
    .map(([path, src]) => [path.split('/').pop().replace(/\s+quin?tessence\.webp$/i, '').toLowerCase(), src]),
);

const TIER_ART = {
  mote: MOTE_ART,
  wisp: WISP_ART,
  essence: ESSENCE_ART,
  quintessence: QUINTESSENCE_ART,
};

const TIER_LABELS = {
  mote: 'Mote',
  wisp: 'Wisp',
  essence: 'Essence',
  quintessence: 'Quintessence',
};

export default function EssenceCard({ essence, count = 0, tier = 'essence', className = '' }) {
  const artSrc = TIER_ART[tier]?.[essence.id] ?? null;
  const tierLabel = TIER_LABELS[tier] ?? 'Essence';
  return (
    <ResourceCard
      resource={essence}
      count={count}
      artSrc={artSrc}
      tagLabel={tierLabel}
      backLabel="ARCANA"
      className={className}
    />
  );
}
