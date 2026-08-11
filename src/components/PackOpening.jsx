import { useState, useRef, useEffect, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import CardFace from './CardFace';
import LootTile from './LootTile';
import { ESSENCES_BY_ID, getElementResourceDescription, parseElementResourceId } from '../game/arcana';
import { PACK_TYPES, getPackGroup } from '../game/cards';
import { audioEngine } from '../game/audio/audioEngine';
import { SOUND_IDS } from '../game/audio/audioLibrary';
import { clearLootFlightGhosts, flyLootElement } from '../game/lootFlight';

const PHASES = { INTRO: 'intro', SPLITTING: 'splitting', REVEALING: 'revealing', ESSENCE: 'essence', DONE: 'done' };

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

const RESOURCE_ART = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/resources/*.webp', { eager: true, import: 'default' }))
    .map(([path, src]) => [path.split('/').pop().replace(/\.webp$/i, '').toLowerCase(), src]),
);

/** The chest, shared with the Wilderness queue tile so both draw the same object. */
const TREASURE_ART = RESOURCE_ART['treasure_chest'] ?? null;

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

function fmtCount(count) {
  return new Intl.NumberFormat('en-US').format(count ?? 0);
}

function formatArcanaDropName(essence, tier, amount) {
  const tierLabel = TIER_LABELS[tier] ?? 'Essence';
  const baseName = essence.name.replace(/ Essence$/i, '');
  const plural = amount === 1 ? tierLabel : `${tierLabel}s`;
  return `${baseName} ${plural}`;
}

function TooltipResourceCard({ artSrc, name, description, amount, className = '' }) {
  const [tipPos, setTipPos] = useState(null);
  const [clampedPos, setClampedPos] = useState(null);
  const tipRef = useRef(null);

  useLayoutEffect(() => {
    if (!tipPos || !tipRef.current) {
      setClampedPos(null);
      return;
    }
    const { width, height } = tipRef.current.getBoundingClientRect();
    const OFFSET = 14;
    let x = tipPos.x + OFFSET;
    let y = tipPos.y + OFFSET;
    if (x + width > window.innerWidth - 8) x = tipPos.x - width - OFFSET;
    if (y + height > window.innerHeight - 8) y = tipPos.y - height - OFFSET;
    setClampedPos({ x, y });
  }, [tipPos]);

  function handleMouseMove(event) {
    setTipPos({ x: event.clientX, y: event.clientY });
  }

  return (
    <>
      <div
        className={`card-face-wrapper no-twirl foundry-square-resource foundry-square-resource--owned inventory-tile ${className}`.trim()}
        onMouseEnter={handleMouseMove}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTipPos(null)}
      >
        <div className="card-face-inner">
          <div
            className="card-face-front foundry-square-resource__front opening-resource-card__front"
          >
            <div className="foundry-square-resource__header foundry-square-resource__header--count-only">
              <span className="foundry-square-resource__count">{fmtCount(amount)}</span>
            </div>
            <div className="foundry-square-resource__art-wrap">
              {artSrc ? <img src={artSrc} alt={name} className="foundry-square-resource__art" /> : null}
            </div>
          </div>
        </div>
      </div>
      {tipPos && createPortal(
        <div
          ref={tipRef}
          className="resource-tooltip"
          style={{ left: (clampedPos ?? tipPos).x, top: (clampedPos ?? tipPos).y }}
        >
          <span className="resource-tooltip__name">{name}</span>
          {description && <span className="resource-tooltip__desc">{description}</span>}
        </div>,
        document.body,
      )}
    </>
  );
}

function OpeningArcanaResourceCard({ essence, amount, tier, className = '' }) {
  const artSrc = TIER_ART[tier]?.[essence.id] ?? null;
  const name = formatArcanaDropName(essence, tier, amount);
  const description = getElementResourceDescription(
    tier === 'essence' ? essence.id : `${essence.id}_${tier}`
  );

  return (
    <TooltipResourceCard
      artSrc={artSrc}
      name={name}
      description={description}
      amount={amount}
      className={className}
    />
  );
}

function OpeningCurrencyCard({ reward, className = '' }) {
  return (
    <TooltipResourceCard
      artSrc={RESOURCE_ART[(reward.artKey ?? '').toLowerCase()] ?? null}
      name={reward.name}
      description={reward.description}
      amount={reward.amount}
      className={className}
    />
  );
}


/**
 * A treasure cache breaking open.
 *
 * Treasure is not a card pack: it has no foil to tear, and running it through `SplitPack` meant a cache of
 * gold opened with the same paper-tearing animation as a booster. This is its own three-beat sequence —
 * brighten, rays, burst — timed to `TREASURE_BURST_MS` so the phase machine and the CSS cannot drift.
 *
 *   0-350ms    the chest brightens and its glow swells
 *   250-800ms  rays grow out from behind it, rotating
 *   700-1200ms it shatters into particles and fades, leaving the loot behind
 *
 * The particle field is built ONCE per mount with a seeded generator. Built inline it would be reshuffled by
 * any re-render mid-burst, and this component re-renders on the phase change that starts the animation — so
 * the particles would jump at exactly the moment they became visible.
 */
const TREASURE_BURST_MS = 1320;
/** How long the cache charges up before it comes apart. The remainder of the burst is the shatter. */
const TREASURE_CHARGE_MS = 520;
const TREASURE_PARTICLES = 30;
function makeShards(count, seed = 1337) {
  let state = seed;
  const rand = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  return Array.from({ length: count }, (_, i) => {
    // Spread around the full circle with jitter, so it reads as a shatter rather than a starburst.
    const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.5;
    const distance = 90 + rand() * 150;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      size: 3 + rand() * 6,
      delay: rand() * 130,
      spin: (rand() - 0.5) * 540,
      bright: rand() > 0.55,
    };
  });
}

/**
 * The card, cut into random triangular fragments.
 *
 * An `<img>` cannot break apart — so at the moment of the shatter the card is REPLACED by these pieces, each
 * a plain white div clipped to one triangle. White because the charge ends with the card flooded to pure
 * white: the object on screen at that instant IS a white rounded square, and that is what has to break.
 * Fragments showing the chest again would give the substitution away.
 *
 * **The pattern is radial, not a grid**, because that is how things actually break: cracks run outward from an
 * impact point and are crossed by a concentric fracture. So:
 *
 *   - one impact point, placed off-centre so the break is never symmetrical
 *   - `SPOKES` random angles, sorted, giving wedges of differing width
 *   - one jittered concentric ring, so the crack ringing the impact is uneven
 *
 * Wedges inside the ring are triangles from the impact point; wedges outside it are quads split into two
 * triangles — so every fragment is a triangle. Adjacent pieces share their spoke endpoints *by construction*,
 * which is what makes them tile the card with no seams.
 *
 * Regenerated per opening (see the `useRef` in `TreasureCache`, and `PackOpening` mounts fresh per pack), so
 * no two caches break the same way. Per-piece duration and delay are randomised too, which is what makes the
 * fragments fade at different times rather than in lockstep.
 */
const SPOKES = 9;
/** Beyond the far corner from any impact point, so the outer band always covers them. */
const OUTER_R = 1.25;

function makeShatter() {
  const cx = 0.42 + Math.random() * 0.16;
  const cy = 0.40 + Math.random() * 0.18;

  const angles = Array.from({ length: SPOKES }, () => Math.random() * Math.PI * 2).sort((a, b) => a - b);
  // The ring's radius per spoke, so the concentric crack is jagged rather than a clean circle.
  const ring = angles.map(() => 0.26 + Math.random() * 0.16);

  const pt = (angle, r) => [(cx + Math.cos(angle) * r) * 100, (cy + Math.sin(angle) * r) * 100];
  const poly = (...points) => `polygon(${points.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(', ')})`;

  const pieces = [];
  const push = (points) => {
    // Fly along the line from the impact point to this triangle's centroid: fragments leave in the direction
    // the break pushed them, which is what separates this from a random scatter.
    const gx = points.reduce((t, [x]) => t + x, 0) / points.length / 100;
    const gy = points.reduce((t, [, y]) => t + y, 0) / points.length / 100;
    const dx = gx - cx;
    const dy = gy - cy;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const travel = 130 + Math.random() * 210;
    pieces.push({
      clip: poly(...points),
      tx: (dx / dist) * travel,
      ty: (dy / dist) * travel,
      spin: (Math.random() - 0.5) * 900,
      // Inner fragments leave first — the break propagates outward — with jitter so it is not a clean wave.
      delay: dist * 190 + Math.random() * 70,
      dur: 430 + Math.random() * 190,
    });
  };

  for (let i = 0; i < SPOKES; i++) {
    const j = (i + 1) % SPOKES;
    const a0 = angles[i];
    // Wrapping wedge must go the long way round, or the last piece is drawn inside-out and leaves a gap.
    const a1 = j === 0 ? angles[0] + Math.PI * 2 : angles[j];
    const r0 = ring[i];
    const r1 = ring[j];

    // Inside the ring: a triangle from the impact point.
    push([[cx * 100, cy * 100], pt(a0, r0), pt(a1, r1)]);
    // Outside it: a quad, split into two triangles.
    const inner0 = pt(a0, r0);
    const inner1 = pt(a1, r1);
    const outer0 = pt(a0, OUTER_R);
    const outer1 = pt(a1, OUTER_R);
    push([inner0, inner1, outer1]);
    push([inner0, outer1, outer0]);
  }
  return pieces;
}

/**
 * A treasure cache breaking open.
 *
 * Treasure is not a card pack: it has no foil to tear, and running it through `SplitPack` meant a cache of
 * gold opened with the same paper-tearing animation as a booster. It keeps the framed loot-card look it has
 * everywhere else (see `LootTile`) right up to the instant it comes apart.
 *
 *   0-520ms     CHARGE: the card grows and brightens to pure white
 *   520-1200ms  SHATTER: the card is swapped for a grid of fragments that fly apart
 *   throughout   rays sweep out from behind it and gold particles scatter
 *
 * The two stages are real state, not just CSS timing, because the swap from one card to twenty-five pieces
 * has to happen at a specific moment — at the top of the white-out, where there is nothing recognisable on
 * screen to give the substitution away.
 */
function TreasureCache({ phase, onClick }) {
  const bursting = phase === PHASES.SPLITTING;
  const [shattered, setShattered] = useState(false);
  const shards = useRef(null);
  if (!shards.current) shards.current = makeShards(TREASURE_PARTICLES);
  // Built once per mount, and `PackOpening` mounts fresh for each pack — so every cache breaks differently,
  // while staying stable across the re-render that starts the animation.
  const pieces = useRef(null);
  if (!pieces.current) pieces.current = makeShatter();

  useEffect(() => {
    if (!bursting) return undefined;
    const t = setTimeout(() => setShattered(true), TREASURE_CHARGE_MS);
    return () => clearTimeout(t);
  }, [bursting]);

  return (
    <div
      className={`treasure-cache${bursting ? ' treasure-cache--bursting' : ''}${shattered ? ' treasure-cache--shattered' : ''}`}
      onClick={bursting ? undefined : onClick}
      role="button"
      tabIndex={bursting ? -1 : 0}
      aria-label="Break open the treasure cache"
      onKeyDown={e => { if (!bursting && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick?.(); } }}
    >
      {/* Behind the card, so the rays read as light escaping from it rather than drawn on top of it. */}
      <span className="treasure-cache__rays" aria-hidden="true" />
      <span className="treasure-cache__flare" aria-hidden="true" />

      <span className="treasure-cache__card">
        {shattered ? (
          <span className="treasure-shatter" aria-hidden="true">
            {pieces.current.map((p, i) => (
              /* TWO elements per fragment, and it has to be two: the card is a ROUNDED square, so a
                 fragment is `triangle ∩ rounded-square`. One element cannot express an intersection of two
                 clips — so the outer carries the triangle and the motion, and the inner carries the card's
                 corner radius. Clipping happens in the outer's own coordinates and the transform is applied
                 after, so the piece keeps its shape rigidly as it flies. Without this, a shattering card
                 briefly grows square corners it never had. */
              <span
                key={i}
                className="treasure-piece"
                style={{
                  clipPath: p.clip,
                  WebkitClipPath: p.clip,
                  '--tx': `${p.tx.toFixed(1)}px`,
                  '--ty': `${p.ty.toFixed(1)}px`,
                  '--spin': `${p.spin.toFixed(0)}deg`,
                  '--pd': `${p.delay.toFixed(0)}ms`,
                  '--dur': `${p.dur.toFixed(0)}ms`,
                }}
              >
                {/* WHITE, not the artwork. The charge ends with the card flooded to pure white, so that is
                    what breaks — fragments showing the chest again would announce the substitution and undo
                    the illusion. The union of the white triangles is exactly the white rounded square the
                    card left off as, at the same scale, so the swap is invisible. */}
                <span className="treasure-piece__fill" />
              </span>
            ))}
          </span>
        ) : (
          <LootTile artSrc={TREASURE_ART} name="Treasure" size="md" className="treasure-cache__tile">
            {/* The white-out lives inside the card's frame, so the border whitens with the art rather than
                staying gold around a blank square. */}
            <span className="treasure-cache__whiteout" aria-hidden="true" />
          </LootTile>
        )}
      </span>

      {bursting && (
        <span className="treasure-cache__shards" aria-hidden="true">
          {shards.current.map((s, i) => (
            <span
              key={i}
              className={`treasure-shard${s.bright ? ' treasure-shard--bright' : ''}`}
              style={{
                '--sx': `${s.x.toFixed(1)}px`,
                '--sy': `${s.y.toFixed(1)}px`,
                '--ss': `${s.size.toFixed(1)}px`,
                '--sd': `${s.delay.toFixed(0)}ms`,
                '--spin': `${s.spin.toFixed(0)}deg`,
              }}
            />
          ))}
        </span>
      )}
    </div>
  );
}

function SplitPack({ phase, onClick, packType, flyAngle }) {
  const pt     = packType ?? PACK_TYPES.iron;
  const elRef  = useRef(null);
  const rafRef = useRef(null);
  const isIdle = phase === PHASES.INTRO;

  function handleMouseMove(e) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = elRef.current;
      if (!el) return;
      const r  = el.getBoundingClientRect();
      const cx = r.width  / 2;
      const cy = r.height / 2;
      const dx = e.clientX - r.left - cx;
      const dy = e.clientY - r.top  - cy;
      el.style.setProperty('--rx',  -(dy / cy) * 12);
      el.style.setProperty('--ry',   (dx / cx) * 12);
      el.style.setProperty('--mx',  ((e.clientX - r.left) / r.width)  * 100);
      el.style.setProperty('--my',  ((e.clientY - r.top)  / r.height) * 100);
      el.style.setProperty('--hyp', Math.min(Math.hypot(dx / cx, dy / cy), 1));
    });
  }

  function handleMouseLeave() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const el = elRef.current;
    if (!el) return;
    el.classList.remove('pack-holo--active');
    el.classList.add('pack-holo--spring');
    el.style.setProperty('--rx',  0);
    el.style.setProperty('--ry',  0);
    el.style.setProperty('--hyp', 0);
    setTimeout(() => el?.classList.remove('pack-holo--spring'), 600);
  }

  function handleMouseEnter() {
    const el = elRef.current;
    if (!el) return;
    el.classList.remove('pack-holo--spring');
    el.classList.add('pack-holo--active');
  }

  return (
    <div
      ref={elRef}
      className={`split-pack pack-type-${pt.id} ${isIdle ? 'split-pack--idle' : ''}`}
      onClick={isIdle ? onClick : undefined}
      onMouseMove={isIdle ? handleMouseMove : undefined}
      onMouseLeave={isIdle ? handleMouseLeave : undefined}
      onMouseEnter={isIdle ? handleMouseEnter : undefined}
    >
      <div
        className={`split-piece split-piece-top ${phase === PHASES.SPLITTING ? 'split-piece-top--fly' : ''}`}
        style={phase === PHASES.SPLITTING ? { '--fly-angle': `${flyAngle}deg` } : undefined}
      >
        <div className="pack-stars">{pt.stars}</div>
      </div>
      <div className={`split-piece split-piece-bottom ${phase === PHASES.SPLITTING ? 'split-piece-bottom--drop' : ''}`}>
        <div className="pack-sheen" />
        <div className="split-piece-body">
          <div className="pack-title">{pt.name}</div>
          <div className="pack-subtitle">{pt.subtitle}</div>
          <div className="pack-card-count">{pt.cardCount ?? 5} CARDS</div>
        </div>
      </div>
      {isIdle && <div className="pack-holo-foil"    aria-hidden="true" />}
      {isIdle && <div className="pack-holo-glare"   aria-hidden="true" />}
      {isIdle && <div className="pack-holo-sparkle" aria-hidden="true" />}
    </div>
  );
}

/** A single coin card worth at least this much gets the bigger in-place burst. */
const COIN_POP_LARGE_THRESHOLD = 25;

const PackOpening = forwardRef(function PackOpening({ cards, resourceCards = [], essenceDrops = [], onDone, onCoinPop, collectionBtnRef, inventoryTargetRef, packType }, ref) {
  const [phase, setPhase] = useState(PHASES.INTRO);
  const [flyAngle, setFlyAngle] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [queuedCards, setQueuedCards] = useState([]);
  const [collecting, setCollecting] = useState(false);
  const [visibleEssenceCards, setVisibleEssenceCards] = useState(0);
  const [visibleEssenceText, setVisibleEssenceText] = useState(0);
  const queueRefs = useRef([]);
  const queueStripRef = useRef(null);
  const essenceRefs = useRef([]);
  const flyGhostsRef = useRef([]);
  const revealCards = cards.length > 0 ? cards : resourceCards;
  const isResourceReveal = cards.length === 0 && resourceCards.length > 0;
  /**
   * Driven by the pack's GROUP, not by `isResourceReveal`. Those coincide today — treasure is the only thing
   * that opens into resources — but the group is the declared fact and the reveal shape is a consequence of
   * it, so a future card pack that happened to yield resources would not accidentally get the chest.
   */
  const isTreasure = getPackGroup(packType?.id) === 'treasure';

  useEffect(() => () => {
    // Flight ghosts live under <body>, outside React's tree. Claiming normally unmounts this component,
    // and navigating away mid-flight must clean them up too.
    clearLootFlightGhosts(flyGhostsRef.current);
  }, []);

  function startEssenceRewardSequence() {
    if (isResourceReveal || essenceDrops.length === 0) {
      setPhase(PHASES.DONE);
      return;
    }
    setVisibleEssenceCards(0);
    setVisibleEssenceText(0);
    setPhase(PHASES.ESSENCE);
  }

  function handleSplit() {
    // The cache's own sound, on the press that breaks it — the same rule the collect flows follow. Only for
    // treasure: a card pack's `pack.open` already fired in App when the pack was committed, and playing it
    // again here would double it.
    if (isTreasure) audioEngine.play(SOUND_IDS.treasureOpen);
    // Random angle between -18° and 18°, never near zero
    const sign = Math.random() < 0.5 ? -1 : 1;
    setFlyAngle(sign * (8 + Math.random() * 10));
    setPhase(PHASES.SPLITTING);
    // A cache bursts on its own schedule; a pack is 150ms pause + 320ms top fly + ~30ms buffer before the
    // bottom starts (0.52s delay) + 480ms bottom = ~1100ms. Both read their duration from one constant so
    // the reveal cannot start before the animation finishes.
    setTimeout(() => {
      if (isTreasure) {
        // A cache spills its whole contents. There is nothing to draw one at a time — the chest has already
        // burst, so tapping five gold cards in sequence afterwards is ceremony for a reward that has been
        // shown arriving. This is the same state `handleQuickDraw` produces, reached without the button.
        revealAll();
        return;
      }
      setPhase(PHASES.REVEALING);
    }, isTreasure ? TREASURE_BURST_MS : 1100);
  }

  function handleQueueCurrent() {
    // The signature moment of the game. Pitch jitter on this sound is what stops five
    // sequential reveals sounding like one machine — see detuneJitter in audioLibrary.
    audioEngine.play(SOUND_IDS.cardFlip);
    const card = revealCards[currentIdx];
    const nextIdx = currentIdx + 1;
    setQueuedCards(prev => [...prev, card]);
    setCurrentIdx(nextIdx);
    if (nextIdx >= revealCards.length) startEssenceRewardSequence();
  }

  /**
   * Quick Draw — reveal everything at once instead of tapping through card by card.
   *
   * Works from the unopened pack too, not just mid-reveal, so a player sitting on a stack
   * can clear one in two clicks. The rapid-cards pool is the right sound here by the same
   * rule as claiming a summon: many cards moving at once, rather than a single flip.
   */
  /**
   * Put the entire draw in the queue strip at once and move to the next phase.
   *
   * Shared by Quick Draw and by the treasure burst, which needs exactly this and no button. It does NOT play
   * a sound: Quick Draw is a press and should be audible, the burst is not, so the caller decides.
   */
  function revealAll() {
    if (currentIdx >= revealCards.length) return;
    setQueuedCards(revealCards);
    setCurrentIdx(revealCards.length);
    startEssenceRewardSequence();
    // The strip sits below the opening stage and a full row of five falls past the fold on a
    // short window — which would defeat the point of showing everything at once. Deferred a frame
    // so the cards exist before we scroll to them.
    requestAnimationFrame(() => {
      queueStripRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function handleQuickDraw() {
    if (currentIdx >= revealCards.length) return;
    audioEngine.play(SOUND_IDS.packCollect);
    revealAll();
  }

  function handleCollect() {
    // On the press. App's onDone runs after the cards finish flying to the Collection tab.
    audioEngine.play(SOUND_IDS.packCollect);
    setCollecting(true);
    /**
     * Treasure-pack coin cards **burst where they sit** rather than flying somewhere.
     *
     * They used to fly to the Bag like resource cards do, which was wrong twice over: the coins do
     * not go into the Bag, they go onto your balance, and watching five identical gold cards travel
     * to an inventory they never enter reads as a bug. Popping in place says "this is money, it is
     * yours now" without implying a destination. The card itself just fades on the spot.
     */
    if (isResourceReveal) {
      queueRefs.current.forEach((el, i) => {
        if (!el) return;
        const reward = resourceCards[i];
        const rect = el.getBoundingClientRect();
        const amount = reward?.type === 'coins' ? (reward.amount ?? 0) : 0;
        window.setTimeout(() => {
          onCoinPop?.({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            // Two sizes, so a big find looks like one.
            size: amount >= COIN_POP_LARGE_THRESHOLD ? 'large' : 'small',
          });
        }, i * 110);
        el.style.animation = 'none';
        el.getBoundingClientRect();
        el.style.transition = `transform 0.34s ease ${i * 0.11}s, opacity 0.3s ease ${i * 0.11 + 0.04}s`;
        el.style.transform = 'scale(1.14)';
        el.style.opacity = '0';
      });
      const popFlight = 420 + queueRefs.current.length * 110;
      setTimeout(onDone, popFlight);
      return;
    }

    const cardTarget = collectionBtnRef?.current;
    if (cardTarget) {
      const targetRect = cardTarget.getBoundingClientRect();
      const tx = targetRect.left + targetRect.width / 2;
      const ty = targetRect.top + targetRect.height / 2;
      queueRefs.current.forEach((el, i) => {
        if (!el) return;
        const flight = flyLootElement(el, { x: tx, y: ty, index: i });
        if (flight) flyGhostsRef.current.push(flight);
      });
    }

    const essenceTarget = inventoryTargetRef?.current;
    if (essenceTarget) {
      const targetRect = essenceTarget.getBoundingClientRect();
      const tx = targetRect.left + targetRect.width / 2;
      const ty = targetRect.top + targetRect.height / 2;
      essenceRefs.current.forEach((el, i) => {
        if (!el || i >= visibleEssenceCards) return;
        const flight = flyLootElement(el, {
          x: tx,
          y: ty,
          index: i,
          durationMs: 520,
        });
        if (flight) flyGhostsRef.current.push(flight);
      });
    }

    const longestFlight = Math.max(queueRefs.current.length, visibleEssenceCards) * 70;
    setTimeout(() => {
      onDone();
      clearLootFlightGhosts(flyGhostsRef.current);
    }, 750 + longestFlight);
  }

  useEffect(() => {
    if (phase !== PHASES.ESSENCE) return undefined;

    const timers = [];

    essenceDrops.forEach((_, index) => {
      timers.push(setTimeout(() => {
        setVisibleEssenceCards(index + 1);
      }, 110 + index * 190));

      timers.push(setTimeout(() => {
        setVisibleEssenceText(index + 1);
      }, 240 + index * 190));
    });

    timers.push(setTimeout(() => {
      setPhase(PHASES.DONE);
    }, 320 + essenceDrops.length * 190));

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [phase, essenceDrops]);

  useImperativeHandle(ref, () => ({
    advance() {
      if (phase === PHASES.INTRO) {
        handleSplit();
      } else if (phase === PHASES.REVEALING) {
        setQueuedCards(prev => [...prev, ...revealCards.slice(currentIdx)]);
        setCurrentIdx(revealCards.length);
        startEssenceRewardSequence();
      } else if (phase === PHASES.ESSENCE) {
        setVisibleEssenceCards(essenceDrops.length);
        setVisibleEssenceText(essenceDrops.length);
        setPhase(PHASES.DONE);
      } else if (phase === PHASES.DONE && !collecting) {
        handleCollect();
      }
    },
  }), [phase, currentIdx, collecting, revealCards, essenceDrops, isResourceReveal]);

  const cardsLeft = revealCards.length - currentIdx;
  const showEssenceRewards = essenceDrops.length > 0 && (phase === PHASES.ESSENCE || phase === PHASES.DONE);

  return (
    <div className="pack-opening">
      <p className="hint">
        {phase === PHASES.INTRO && (isTreasure ? 'Click the cache to break it open' : 'Click the pack to open it')}
        {phase === PHASES.SPLITTING && '\u00a0'}
        {phase === PHASES.REVEALING && (isResourceReveal ? 'Tap reward card to open next' : 'Tap card to open next')}
        {phase === PHASES.ESSENCE && 'Motes distilled'}
        {phase === PHASES.DONE && 'Rewards ready'}
      </p>

      <div className={`opening-stage${showEssenceRewards ? ' opening-stage--with-rewards' : ''}`}>
        <div className="opening-stage-main">
          {(phase === PHASES.INTRO || phase === PHASES.SPLITTING) && (
            isTreasure
              ? <TreasureCache phase={phase} onClick={handleSplit} />
              : <SplitPack phase={phase} onClick={handleSplit} packType={packType} flyAngle={flyAngle} />
          )}
          {phase === PHASES.REVEALING && (
            isResourceReveal ? (
              <div key={currentIdx} className="opening-resource-card-slot" onClick={handleQueueCurrent}>
                <OpeningCurrencyCard
                  reward={revealCards[currentIdx]}
                  className="center-card opening-resource-card opening-resource-card--reveal"
                />
              </div>
            ) : (
              <CardFace
                key={currentIdx}
                card={revealCards[currentIdx]}
                onClick={handleQueueCurrent}
                className="center-card"
                holo
                artDetail="full"
              />
            )
          )}
          {phase === PHASES.DONE && !collecting && (
            <button className="collect-btn summon-btn summon-btn--primary" onClick={handleCollect}>
              Claim Summon
            </button>
          )}
        </div>

        {showEssenceRewards && (
          <aside className="opening-rewards-panel">
            <div className="opening-rewards-panel__head">
              <span className="opening-rewards-panel__title">Rewards</span>
            </div>

            <div className="opening-rewards-grid" aria-hidden="true">
              {essenceDrops.map((drop, index) => {
                const { elementId, tier } = parseElementResourceId(drop.essenceId);
                const essence = ESSENCES_BY_ID[elementId];
                if (!essence) return null;
                return (
                  <div
                    key={`${drop.essenceId}-${index}`}
                    ref={el => { essenceRefs.current[index] = el; }}
                    className={`opening-reward-tile${index < visibleEssenceCards ? ' opening-reward-tile--visible' : ''}`}
                  >
                    <OpeningArcanaResourceCard
                      essence={essence}
                      amount={drop.amount}
                      tier={tier}
                      className="opening-resource-card"
                    />
                  </div>
                );
              })}
            </div>

            <div className="opening-rewards-list">
              {essenceDrops.map((drop, index) => {
                const { elementId, tier } = parseElementResourceId(drop.essenceId);
                const essence = ESSENCES_BY_ID[elementId];
                if (!essence) return null;
                return (
                  <p
                    key={drop.essenceId}
                    className={`opening-reward-line${index < visibleEssenceText ? ' opening-reward-line--visible' : ''}`}
                  >
                    +{drop.amount} {formatArcanaDropName(essence, tier, drop.amount)}
                  </p>
                );
              })}
            </div>
          </aside>
        )}
      </div>

      {queuedCards.length > 0 && (
        // Drawn cards are a stacked horizontal line, not a wrapping grid. A pack can hold 20, which wrapped
        // to four rows and made the reveal taller than its column — the scrolling this was meant to remove.
        // `--stack-gaps` is what lets the overlap tighten so the whole draw fits; see `.stack-line`.
        <div
          className="cards-queue stack-line"
          ref={queueStripRef}
          style={{ '--stack-gaps': Math.max(1, queuedCards.length - 1) }}
        >
          {queuedCards.map((card, i) => (
            /* The wrapper is not decoration, it is REQUIRED. `queue-enter` animates `transform` on the card
               with `fill: both`, and a finished animation's transform beats a plain declaration — so the
               stack's hover lift had to live on a different element or it would never apply. It also gives
               the viewport-level collection clone one exact, stable card-sized box to copy. */
            <div
              key={card.id}
              ref={el => { queueRefs.current[i] = el; }}
              className="queued-card-slot"
              // Ascending, so each card lands on top of the last — it reads as being dealt onto a pile.
              style={{ zIndex: i + 1 }}
            >
              {isResourceReveal ? (
                <div className="queued-card queued-card--resource">
                  <OpeningCurrencyCard reward={card} className="opening-resource-card opening-resource-card--queue" />
                </div>
              ) : (
                <CardFace card={card} className="queued-card" holo />
              )}
            </div>
          ))}
        </div>
      )}

      {phase === PHASES.REVEALING && (
        <p className="cards-remaining">{cardsLeft} remaining</p>
      )}

      {/* Not for treasure: a cache already reveals everything at once, so the only thing Quick Draw could do
          during its INTRO is skip the burst — turning the opening animation into a button you learn to avoid. */}
      {!isTreasure && (phase === PHASES.INTRO || phase === PHASES.REVEALING) && revealCards.length > 1 && (
        <button
          className="quick-draw-btn"
          onClick={handleQuickDraw}
          title={`Reveal all ${revealCards.length} at once`}
        >
          Quick Draw
        </button>
      )}
    </div>
  );
});

export default PackOpening;
