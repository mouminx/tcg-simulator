import { RARITIES } from '../game/cards';

/**
 * The shockwave under a card that has just been placed.
 *
 * Two layers, in the order they read: a ring of runes that flares outward and rotates, then plain
 * concentric rings expanding past it. The runes are the same set the Arcana table uses, so the
 * effect belongs to this game rather than looking like a generic UI pulse.
 *
 * The card drives its shape, so placing a good card looks like placing a good card:
 *
 *   affixes  -> how many plain rings expand (1 per affix, 2 minimum, 6 cap)
 *   rarity   -> how many runes are in the runic circle (6 for common, 14 for mythic)
 *   tier     -> overall reach and glow, and the accent colour is the rarity's own
 *
 * Purely presentational and `pointer-events: none` — App.jsx spawns it into a fixed overlay at the
 * card's centre and removes it on a timer, so it never participates in layout and cannot intercept
 * a drag.
 */

/** The Arcana table's runes. Sliced to length, so richer cards draw a denser circle. */
const ECHO_RUNES = ['ᚠ', 'ᚨ', 'ᛁ', 'ᚾ', 'ᛗ', 'ᛟ', '⩔', '𐌘', 'ᚱ', 'ᛊ', 'ᛞ', 'ᚷ', 'ᚲ', 'ᛚ'];

/** Runes in the circle, by rarity. Common still gets a full ring — just a sparse one. */
const RUNES_BY_RARITY = {
  common: 6,
  uncommon: 7,
  rare: 8,
  epic: 10,
  legendary: 12,
  mythic: 14,
};

const MAX_RINGS = 6;

export default function PlacementEcho({ x, y, size = 150, hole = null, rarity = 'common', tier = 1, affixes = 0 }) {
  /**
   * Without a hole there is no clip path, and the rings paint straight OVER the card's face instead
   * of passing under it — which is exactly what "the effect renders in front of the card" was. The
   * caller already refuses to spawn one it cannot measure; this enforces the same invariant here, so
   * a future call site cannot reintroduce it by omitting the hole.
   */
  if (!hole) return null;
  const runeCount = RUNES_BY_RARITY[rarity] ?? 6;
  // One ring per affix, but never fewer than two — a single ring does not read as a shockwave.
  const ringCount = Math.min(MAX_RINGS, Math.max(2, affixes));
  const accent = RARITIES[rarity]?.color ?? '#d4a44c';
  // Tier widens the reach and lifts the glow. Tier I is 1.0, tier V is 1.4.
  const tierScale = 1 + (Math.min(5, Math.max(1, tier)) - 1) * 0.1;

  /**
   * A hole punched out of the effect at the card's footprint, which is what makes the rings read
   * as passing UNDER the card rather than across its face. `evenodd` on a path with the viewport
   * as the outer subpath and the card as the inner one is the whole trick — a fixed overlay
   * cannot otherwise be slotted between a panel's background and the cards inside it, because it
   * is in a different stacking context.
   */
  // The outer subpath is deliberately far larger than any viewport rather than measured from
  // `window`: reading layout during render is a smell, and a measured rect would also go stale if
  // the window were resized mid-animation. Anything beyond the element's own box is ignored, so
  // oversizing costs nothing.
  const clip = hole
    ? {
      clipPath: 'path(evenodd, "M0 0 H20000 V20000 H0 Z '
        + `M${Math.round(hole.left)} ${Math.round(hole.top)} `
        + `H${Math.round(hole.left + hole.width)} `
        + `V${Math.round(hole.top + hole.height)} `
        + `H${Math.round(hole.left)} Z")`,
    }
    : undefined;

  return (
    <div className="placement-echo-clip" style={clip} aria-hidden="true">
      <div
        className="placement-echo"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          '--echo-size': `${Math.round(size * tierScale)}px`,
          '--echo-accent': accent,
          '--echo-glow': tierScale,
        }}
      >
        <span className="placement-echo__runes">
          {ECHO_RUNES.slice(0, runeCount).map((rune, index) => (
            <span
              key={rune}
              className="placement-echo__rune"
              // Placed round the circle, then counter-rotated so the glyph stays upright.
              style={{ '--rune-angle': `${(360 / runeCount) * index}deg` }}
            >
              {rune}
            </span>
          ))}
        </span>

        {Array.from({ length: ringCount }, (_, index) => (
          <span
            key={index}
            className="placement-echo__ring"
            style={{
              // Each ring stops a little shorter than the one before and starts a little later,
              // so they read as one wavefront rather than as concentric decoration.
              '--ring-end': (1 - index * (0.62 / MAX_RINGS)).toFixed(3),
              '--ring-delay': `${index * 105}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
