import LootTierBadge from './LootTierBadge';

/**
 * A square loot card — the framed tile the Bag, the collection queues and the altar all use.
 *
 * Extracted because a treasure cache has to keep this look at every step of being opened: held in the altar
 * row, in flight to the summoning spot, staged there, and again as the thing that shatters. It was rebuilt
 * ad hoc at some of those points and rendered as a bare `<img>` at others, so the cache visibly changed
 * appearance mid-flight and lost its gold border once opening began.
 *
 * `card-face-wrapper no-twirl foundry-square-resource` is the shared treatment; only the size classes are
 * local. Note those must be compound (`.card-face-wrapper.held-loot--sm`) —
 * `.card-face-wrapper.foundry-square-resource` sets `width: 100%` at specificity 0,2,0, and a single class
 * loses to it, leaving the tile to collapse against a content-sized parent.
 */
export default function LootTile({ artSrc, name = '', size = 'sm', tier = 1, className = '', children }) {
  return (
    <div
      className={`card-face-wrapper no-twirl foundry-square-resource foundry-square-resource--owned held-loot held-loot--${size} ${className}`.trim()}
    >
      <div className="card-face-inner">
        <div className="card-face-front foundry-square-resource__front">
          <div className="foundry-square-resource__art-wrap">
            {artSrc
              ? <img src={artSrc} alt={name} className="foundry-square-resource__art" draggable="false" />
              : <span className="held-loot__fallback" aria-hidden="true">✦</span>}
          </div>
          <LootTierBadge tier={tier} />
        </div>
      </div>
      {/* Overlays that need to sit inside the card's frame — the white-out during a cache's charge-up. */}
      {children}
    </div>
  );
}
