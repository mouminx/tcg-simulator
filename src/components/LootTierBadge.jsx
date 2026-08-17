import { LOOT_TIER_LABELS, normalizeLootTier } from '../game/lootTiers';

export default function LootTierBadge({ tier, className = '' }) {
  const normalized = normalizeLootTier(tier);
  const label = LOOT_TIER_LABELS[normalized];
  return (
    <span
      className={`foundry-square-resource__tier ${className}`.trim()}
      aria-label={`Tier ${label}`}
    >
      {label}
    </span>
  );
}
