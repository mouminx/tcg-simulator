/**
 * Gold particle effects. Two modes off one component, because they share every mote detail —
 * the art, the sizing ramp, the seeded jitter — and differ only in where the motes go.
 *
 *   stream  Arcs from where the gold was earned up to the balance counter. Three sizes, picked from
 *           the amount, so a big payout looks like one.
 *   pop     Bursts radially in place and fades. Two sizes. Used for the gold cards in a treasure
 *           pack, which read as coins bursting where they sit rather than being carried off, and
 *           for the small flourish on the counter itself when a stream lands.
 *
 * ── Why the stream curves ──
 * Two nested elements per mote. The outer carries the HORIZONTAL travel on a linear timing function;
 * the inner carries the VERTICAL travel on an ease-in. Two axes covering their distance at different
 * rates over the same duration *is* a curve — the mote leaves fast and flat, then sweeps up into the
 * counter. One element animating `translate(x, y)` can only move in a straight line, whatever the
 * easing, because a single timing function applies to the whole transform.
 *
 * A pop reuses the same two elements with the SAME easing on both axes, which is what makes its
 * travel straight — radially outward, which is what a burst should be.
 */

/** Mote count, scatter and glyph size per size step. */
const STREAM_SIZES = {
  small: { count: 10, spread: 40, dot: 6, glyphEvery: 5, dur: [520, 260] },
  medium: { count: 20, spread: 62, dot: 8, glyphEvery: 4, dur: [560, 300] },
  large: { count: 34, spread: 92, dot: 10, glyphEvery: 3, dur: [600, 340] },
};

const POP_SIZES = {
  small: { count: 12, reach: 58, dot: 6, glyphEvery: 6, dur: [420, 200] },
  large: { count: 26, reach: 118, dot: 9, glyphEvery: 4, dur: [520, 260] },
};

/**
 * Picks a stream size from the amount earned. The thresholds are in gold, tuned against what the
 * game actually pays: a pack sells for single digits, a good card for tens, a mass-sell for hundreds.
 */
export function streamSizeForAmount(amount) {
  const gold = Number(amount) || 0;
  if (gold >= 100) return 'large';
  if (gold >= 20) return 'medium';
  return 'small';
}

/** Deterministic per-burst jitter. Seeded so a re-render cannot reshuffle motes mid-flight. */
function makeMotes(spec, seed, radial) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return Array.from({ length: spec.count }, (_, i) => {
    // A pop sends each mote out along its own angle; a stream scatters them at the origin and they
    // all travel to the same place.
    const angle = radial ? (i / spec.count) * Math.PI * 2 + rnd() * 0.5 : 0;
    const reach = radial ? spec.reach * (0.45 + rnd() * 0.55) : 0;
    return {
      id: i,
      offsetX: radial ? 0 : Math.round((rnd() * 2 - 1) * spec.spread),
      offsetY: radial ? 0 : Math.round((rnd() * 2 - 1) * spec.spread * 0.72),
      radialX: Math.round(Math.cos(angle) * reach),
      // Biased upward: coins thrown up and out read better than a symmetric ring.
      radialY: Math.round(Math.sin(angle) * reach - reach * 0.35),
      delay: Math.round(rnd() * 130),
      duration: spec.dur[0] + Math.round(rnd() * spec.dur[1]),
      scale: (0.6 + rnd() * 0.7).toFixed(2),
      glyph: i % spec.glyphEvery === 0 ? 'ᛜ' : null,
    };
  });
}

export default function GoldBurst({
  from,
  to = null,
  mode = 'stream',
  size = 'small',
  countScale = 1,
  seed = 1,
}) {
  const pop = mode === 'pop';
  const base = pop ? (POP_SIZES[size] ?? POP_SIZES.small) : (STREAM_SIZES[size] ?? STREAM_SIZES.small);
  // The graphics tier thins the mote count rather than switching the effect off — it is reward
  // feedback, not ambient motion. See the note in App.jsx.
  const spec = { ...base, count: Math.max(4, Math.round(base.count * countScale)) };
  const motes = makeMotes(spec, seed, pop);

  return (
    <div className={`gold-burst${pop ? ' gold-burst--pop' : ''}`} aria-hidden="true">
      {motes.map(mote => {
        const originX = from.x + mote.offsetX;
        const originY = from.y + mote.offsetY;
        const dx = pop ? mote.radialX : (to?.x ?? originX) - originX;
        const dy = pop ? mote.radialY : (to?.y ?? originY) - originY;
        return (
          <span
            key={mote.id}
            className="gold-burst__x"
            style={{
              left: `${originX}px`,
              top: `${originY}px`,
              // Deltas, not absolute targets: the transform is relative to where the mote starts.
              '--dx': `${dx}px`,
              '--dy': `${dy}px`,
              '--dur': `${mote.duration}ms`,
              '--delay': `${mote.delay}ms`,
              '--s': mote.scale,
              '--dot': `${spec.dot}px`,
            }}
          >
            <span className="gold-burst__y">
              {mote.glyph
                ? <span className="gold-burst__glyph">{mote.glyph}</span>
                : <span className="gold-burst__dot" />}
            </span>
          </span>
        );
      })}
    </div>
  );
}
