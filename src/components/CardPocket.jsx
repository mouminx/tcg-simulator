import { useEffect, useState } from 'react';
import CardFace from './CardFace';
import Gold from './Gold';
import { audioEngine } from '../game/audio/audioEngine';
import { SOUND_IDS } from '../game/audio/audioLibrary';

/**
 * The player's **Hand** — the carrier that feeds every production station.
 *
 * NOTE ON NAMING: the UI calls this the Hand. The code, CSS classes and persisted save
 * keys still call it the `pocket`, because `pocket` / `pocketCapacity` / `pocketExpanded`
 * are save-state keys and renaming them would need a save migration for no player-visible
 * benefit. Treat `pocket` in code as meaning "hand".
 *
 * ── A fan along the bottom edge, not a side drawer ─────────────────────────────
 * The cards are held in an arc across the bottom of the screen with roughly their top half
 * showing, and hovering one lifts it fully into view. This replaced a right-edge slide-out
 * drawer. The reason is reach: a side drawer is close to whatever happens to be on that side
 * and far from everything else, whereas the bottom edge is roughly **equidistant from every
 * station in the playspace** — which matters for a UI whose whole job is dragging cards into
 * slots scattered across the view. It also stops competing with the Bag for the right edge.
 *
 * ── Two rules that this layout will break if you undo them ────────────────────
 *  1. **The hit box does not move; only the art does.** `.hand__slot` is rotated into place and
 *     then stays put; the lift on hover is applied to `.hand__lift` inside it. Lifting the slot
 *     itself slides the hover target out from under the pointer, which drops the hover, snaps it
 *     back and re-triggers — chatter that reads as several cards reacting at once. The same trap
 *     caught the old drawer's sideways peek.
 *  2. **`:hover` survives onto the lifted card because `.hand__lift` is a DESCENDANT of the
 *     slot.** An ancestor stays `:hover` while the pointer is over a descendant even when that
 *     descendant is transformed outside the ancestor's box, so the revealed card and its remove
 *     button are reachable. Hoist the lift out of the slot and the card becomes untouchable.
 *
 * ── Drag payload ───────────────────────────────────────────────────────────────
 * `text/plain` carries the bare card id, because every station slot's drop handler
 * already reads that format. Source information rides along in a second MIME type so
 * hand-internal drops can tell a reorder from an incoming collection card, without
 * breaking any existing drop target.
 */

export const CARD_SOURCE_MIME = 'application/x-card-source';

/**
 * Drag props for a card **already socketed in a station**, so it can be pulled back to the Hand.
 *
 * Spread onto the wrapper around the socketed `CardFace`, never onto `CardFace` itself — that
 * component is memoized and slot-socketed cards deliberately pass it no callbacks so they hit the
 * memo and stop re-rendering on every production tick. A fresh `onDragStart` handed to it would
 * defeat that for every card in every station.
 *
 * The source is just `'station'` with no slot id: the Hand does not need to know which station a
 * card came from, because `handleAddToHandFromStation` finds it by id across every slot array and
 * clears it there. That keeps all four call sites identical and means a new station gets this for
 * free by spreading the same props.
 */
export function socketedCardDragProps(card, { onDragStart } = {}) {
  if (!card) return {};
  return {
    draggable: true,
    onDragStart: event => {
      /**
       * NO `stopPropagation` here. It was tried and it silently broke the whole feature: the Hand's
       * catch band is only `pointer-events: auto` while a drag is in flight, and the flag that arms it
       * comes from a window-level `dragstart` listener — which a stopped event never reaches. The card
       * lifted, nothing could receive it, and the drop was a no-op.
       */
      audioEngine.play(SOUND_IDS.cardFlip);
      event.dataTransfer.setData('text/plain', String(card.id));
      event.dataTransfer.setData(CARD_SOURCE_MIME, 'station');
      event.dataTransfer.effectAllowed = 'move';
      onDragStart?.(event);
    },
  };
}

/**
 * Fan geometry constants.
 *
 * `PIVOT_PX` lives here rather than only in CSS because the arc maths below needs it, and two copies
 * of the same number would drift. It is handed to CSS as `--hand-pivot`.
 *
 * `MAX_SPREAD_DEG` is capped fairly tight (34, not the 46 first tried) because the outer angle is
 * what buries the outer cards: rotating about a pivot 660px below sags a card by
 * `pivot x (1 - cos θ)`, which at ±23deg is 52px — enough to leave a full hand's end cards 72% below
 * the screen edge, showing neither nameplate nor art. At ±17deg it is 29px.
 */
const PIVOT_PX = 660;
const MAX_STEP_DEG = 6;
const MAX_SPREAD_DEG = 34;

/**
 * Depth of the arc — how much lower the outermost card sits than the middle one, in px.
 *
 * This is an EXACT target, not an amount added on top of the rotation, and that is what lets the
 * resting height be pinned to "60% of every card showing". Rotating about the pivot sags a card by
 * `pivot x (1 - cos θ)` all by itself — ~4px for three cards but ~29px for ten — so the per-card
 * drop *subtracts that sag back off* and substitutes the value below. The drop is therefore negative
 * for a wide fan, which is fine: it is cancelling curvature the rotation already produced.
 *
 * Without this the arc grew with the hand size, and the end cards of a full hand sank past the 60%
 * line no matter what the resting offset was set to.
 *
 * Must stay in step with `--hand-arc` in App.css, which is fed from here.
 */
const ARC_DEPTH_PX = 20;

/**
 * A fanned trio of cards — the conventional symbol for a player's hand, and far more
 * legible at control size than a literal hand would be.
 */
function HandIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect
        x="3.4" y="7.2" width="7.4" height="11" rx="1.3"
        transform="rotate(-19 7.1 12.7)"
        fill="currentColor" opacity="0.5"
      />
      <rect
        x="13.2" y="7.2" width="7.4" height="11" rx="1.3"
        transform="rotate(19 16.9 12.7)"
        fill="currentColor" opacity="0.72"
      />
      <rect
        x="8.3" y="5.9" width="7.4" height="11.8" rx="1.3"
        fill="currentColor" opacity="0.96"
      />
    </svg>
  );
}

export default function CardPocket({
  pocket,
  capacity,
  balance = 0,
  nextUnlockCost = null,
  onAdd,
  onRemove,
  onUnlock,
  onReorder,
  onPlaceFromCollection,
  onAddFromStation,
}) {
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [draggingIndex, setDraggingIndex] = useState(null);
  // Whether ANY card drag is currently in flight. The catch band below is only a drop target
  // while one is, because a permanently live band across the bottom of the screen would swallow
  // pointer events from whatever view is underneath it.
  const [dragActive, setDragActive] = useState(false);
  const [bandOver, setBandOver] = useState(false);

  const pocketCards = pocket ?? [];
  const filled = pocketCards.length;
  const isFull = filled >= capacity;
  const canUnlock = nextUnlockCost != null;
  const canAffordUnlock = canUnlock && balance >= nextUnlockCost;

  /**
   * Global drag tracking. `dragend` is the authoritative reset — it always fires on the drag
   * source once the operation finishes, however it finished. The `drop` listener is a bubble-phase
   * backstop and MUST NOT be capture-phase: capture runs window-first, so it would clear
   * `dragOverIndex` before the slot's own drop handler had a chance to read it.
   */
  useEffect(() => {
    const start = () => setDragActive(true);
    const end = () => {
      setDragActive(false);
      setBandOver(false);
      setDragOverIndex(null);
      setDraggingIndex(null);
    };
    // Capture phase, so no target handler can stop this from arming the band — the same hazard that
    // `socketedCardDragProps` documents above, made structurally impossible rather than remembered.
    window.addEventListener('dragstart', start, true);
    window.addEventListener('dragend', end);
    window.addEventListener('drop', end);
    return () => {
      window.removeEventListener('dragstart', start, true);
      window.removeEventListener('dragend', end);
      window.removeEventListener('drop', end);
    };
  }, []);

  function readSource(e) {
    // Types are reliably readable on drop; treat anything unlabelled as a collection card
    // so drags from views that predate this metadata still work.
    const raw = e.dataTransfer.getData(CARD_SOURCE_MIME);
    if (!raw) return { kind: 'collection', index: null };
    const [kind, index] = raw.split(':');
    return { kind, index: index === undefined ? null : Number(index) };
  }

  function handleSlotDragOver(e, index) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
    setBandOver(false);
  }

  function handleSlotDrop(e, index) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    setDraggingIndex(null);
    const cardId = e.dataTransfer.getData('text/plain');
    if (!cardId) return;
    const { kind, index: fromIndex } = readSource(e);

    if (kind === 'pocket' && fromIndex !== null) {
      if (fromIndex === index) return;
      onReorder?.(fromIndex, index);
      return;
    }
    /**
     * A card dragged out of a station slot MOVES into the hand — it has to be cleared from the slot
     * it came from. Falling through to `onAdd` would copy it out of the Collection instead and leave
     * the station still holding it, so the same card would be in two places.
     */
    if (kind === 'station') {
      onAddFromStation?.(cardId);
      return;
    }
    /**
     * A card arriving from outside is ADDED while there is room, even though it landed on top of a
     * card rather than on bare band. Only a full hand swaps.
     *
     * It used to always swap by position, which was defensible for the old drawer — its slots were
     * discrete numbered positions you aimed at. In a fan the cards overlap and cover most of the
     * band, so "drag to the bottom of the screen to add" landed on a card far more often than not,
     * and quietly evicted whatever was under the pointer back to the Collection instead of adding.
     */
    if (!isFull) {
      onAdd?.(cardId);
      return;
    }
    onPlaceFromCollection?.(cardId, index);
  }

  /** Dropping anywhere on the catch band appends — "drag to the bottom of the screen to add". */
  function handleBandDrop(e) {
    e.preventDefault();
    setBandOver(false);
    setDragOverIndex(null);
    setDraggingIndex(null);
    if (isFull) return;
    const cardId = e.dataTransfer.getData('text/plain');
    const { kind } = readSource(e);
    if (!cardId || kind === 'pocket') return;
    if (kind === 'station') {
      onAddFromStation?.(cardId);
      return;
    }
    onAdd?.(cardId);
  }

  /**
   * Fan geometry. Every card carries only an ANGLE; the arc — the sideways spread and the way
   * outer cards sit lower — falls out of rotating about a pivot far below the screen edge
   * (`--hand-pivot` in App.css). Composing separate x/y/rotate transforms per card was the
   * alternative and it needs all three kept in agreement as the count changes; one angle cannot
   * fall out of step with itself.
   */
  const step = filled > 1 ? Math.min(MAX_STEP_DEG, MAX_SPREAD_DEG / (filled - 1)) : 0;
  const mid = (filled - 1) / 2;
  /**
   * The drop that makes each card's total sag exactly `ARC_DEPTH_PX x (offset / maxOffset)²`.
   *
   * `pivotSag(i)` is the sag rotation alone already gave card i; subtracting it and adding the
   * wanted value replaces the curvature rather than adding to it. That is what keeps the outermost
   * card sitting exactly `ARC_DEPTH_PX` below the middle one at every hand size, which in turn is
   * what lets App.css pin the resting position to "60% of every card showing".
   */
  const pivotSag = index =>
    PIVOT_PX * (1 - Math.cos((Math.abs(index - mid) * step * Math.PI) / 180));
  const dropFor = index =>
    (mid > 0 ? ARC_DEPTH_PX * ((index - mid) / mid) ** 2 - pivotSag(index) : 0);

  return (
    <div
      className={[
        'hand',
        dragActive ? 'hand--drag-active' : '',
        bandOver ? 'hand--band-over' : '',
        isFull ? 'hand--full' : '',
      ].filter(Boolean).join(' ')}
      /**
       * Both are fed from JS so the arc maths above and the CSS geometry cannot disagree:
       * `--hand-pivot` is the fan's centre of curvature, and `--hand-arc` is what the resting offset
       * subtracts to land the outermost card on the 60%-showing line.
       * They must be set HERE, on `.hand`, not on `.hand__fan` — `--hand-hidden` is declared on this
       * element, and a custom property set on a child cannot feed a parent's declaration.
       */
      style={{ '--hand-pivot': `${PIVOT_PX}px`, '--hand-arc': `${ARC_DEPTH_PX}px` }}
    >
      {/* The catch band. Full width so "drag to the bottom" needs no aim, and inert unless a card
          is actually in flight. */}
      <div
        className="hand__band"
        onDragOver={e => {
          if (isFull) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setBandOver(true);
        }}
        onDragLeave={e => {
          if (!e.currentTarget.contains(e.relatedTarget)) setBandOver(false);
        }}
        onDrop={handleBandDrop}
      >
        <span className="hand__band-label">
          {isFull ? `Hand full — ${filled}/${capacity}` : 'Drop to add to your hand'}
        </span>
      </div>

      <div className="hand__fan" style={{ '--hand-count': filled }}>
        {pocketCards.map((card, index) => (
          <div
            key={card.id}
            className={[
              'hand__slot',
              dragOverIndex === index ? 'hand__slot--drop' : '',
              draggingIndex === index ? 'hand__slot--dragging' : '',
            ].filter(Boolean).join(' ')}
            style={{
              '--hand-angle': `${((index - mid) * step).toFixed(2)}deg`,
              '--hand-drop': `${dropFor(index).toFixed(1)}px`,
              '--hand-index': index,
            }}
            draggable
            onDragStart={e => {
              audioEngine.play(SOUND_IDS.cardFlip);
              setDraggingIndex(index);
              e.dataTransfer.setData('text/plain', String(card.id));
              e.dataTransfer.setData(CARD_SOURCE_MIME, `pocket:${index}`);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => { setDraggingIndex(null); setDragOverIndex(null); }}
            onDragOver={e => handleSlotDragOver(e, index)}
            onDrop={e => handleSlotDrop(e, index)}
            title={`${card.name} — drag to a station slot, or onto another card to reorder`}
          >
            {/* Everything that MOVES lives in here. See rule 1 in the header comment. */}
            <div className="hand__lift">
              <CardFace card={card} visualMode="compact" className="hand__card-face no-twirl" />
              <button
                className="hand__card-remove"
                onClick={e => { e.stopPropagation(); onRemove(card.id); }}
                aria-label={`Return ${card.name} to Collection`}
                title="Return to Collection"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {filled === 0 && (
        <p className="hand__empty">Drag cards from your Collection to the bottom of the screen</p>
      )}

      {/* Bottom-left cluster: the count and buying another slot. Off to the side rather than centred
          above the fan, because a hovered card lifts straight through the middle and would pass
          behind — or fight with — anything sitting there.
          There is no show/hide toggle: the hand is always out. A carrier that feeds every station is
          not something you should have to open first, and a control that can hide it is one more
          state where a drag has nowhere to land. */}
      <div className="hand__rail">
        <span className="hand__count" title={`${filled} of ${capacity} hand slots filled`}>
          <HandIcon className="hand__count-icon" />
          <span className="hand__count-value">{filled}/{capacity}</span>
        </span>

        {canUnlock && (
          <button
            type="button"
            className="hand__unlock"
            disabled={!canAffordUnlock}
            onClick={onUnlock}
            title={canAffordUnlock ? 'Buy another hand slot' : 'Not enough gold for another slot'}
            aria-label={`Unlock another hand slot for ${nextUnlockCost}`}
          >
            <span className="hand__unlock-plus" aria-hidden="true">+</span>
            <span className="hand__unlock-cost"><Gold amount={nextUnlockCost} /></span>
          </button>
        )}
      </div>
    </div>
  );
}
