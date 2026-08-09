import { useState, useRef, useEffect, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import CardFace from './CardFace';
import { ESSENCES_BY_ID, getElementResourceDescription, parseElementResourceId } from '../game/arcana';
import { PACK_TYPES } from '../game/cards';
import { audioEngine } from '../game/audio/audioEngine';
import { SOUND_IDS } from '../game/audio/audioLibrary';

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
  const revealCards = cards.length > 0 ? cards : resourceCards;
  const isResourceReveal = cards.length === 0 && resourceCards.length > 0;

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
    // Random angle between -18° and 18°, never near zero
    const sign = Math.random() < 0.5 ? -1 : 1;
    setFlyAngle(sign * (8 + Math.random() * 10));
    setPhase(PHASES.SPLITTING);
    // 150ms pause + 320ms top fly + ~30ms buffer before bottom starts (0.52s delay) + 480ms bottom = ~1100ms total
    setTimeout(() => setPhase(PHASES.REVEALING), 1100);
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
  function handleQuickDraw() {
    if (currentIdx >= revealCards.length) return;
    audioEngine.play(SOUND_IDS.packCollect);
    setQueuedCards(revealCards);
    setCurrentIdx(revealCards.length);
    startEssenceRewardSequence();
    // The strip sits below the opening stage and a full row of five falls past the fold on a
    // short window — which would defeat the point of a button whose job is to show you
    // everything at once. Deferred a frame so the cards exist before we scroll to them.
    requestAnimationFrame(() => {
      queueStripRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
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
        el.style.animation = 'none';
        el.getBoundingClientRect(); // force reflow
        const rect = el.getBoundingClientRect();
        const dx = tx - (rect.left + rect.width / 2);
        const dy = ty - (rect.top + rect.height / 2);
        el.style.transition = `transform 0.5s ease ${i * 0.07}s, opacity 0.4s ease ${i * 0.07 + 0.1}s`;
        el.style.transform = `translate(${dx}px, ${dy}px) scale(0.05)`;
        el.style.opacity = '0';
      });
    }

    const essenceTarget = inventoryTargetRef?.current;
    if (essenceTarget) {
      const targetRect = essenceTarget.getBoundingClientRect();
      const tx = targetRect.left + targetRect.width / 2;
      const ty = targetRect.top + targetRect.height / 2;
      essenceRefs.current.forEach((el, i) => {
        if (!el || i >= visibleEssenceCards) return;
        el.style.animation = 'none';
        el.getBoundingClientRect();
        const rect = el.getBoundingClientRect();
        const dx = tx - (rect.left + rect.width / 2);
        const dy = ty - (rect.top + rect.height / 2);
        el.style.transition = `transform 0.52s ease ${i * 0.07}s, opacity 0.4s ease ${i * 0.07 + 0.1}s`;
        el.style.transform = `translate(${dx}px, ${dy}px) scale(0.05)`;
        el.style.opacity = '0';
      });
    }

    const longestFlight = Math.max(queueRefs.current.length, visibleEssenceCards) * 70;
    setTimeout(onDone, 750 + longestFlight);
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
        {phase === PHASES.INTRO && 'Click the pack to open it'}
        {phase === PHASES.SPLITTING && '\u00a0'}
        {phase === PHASES.REVEALING && (isResourceReveal ? 'Tap reward card to open next' : 'Tap card to open next')}
        {phase === PHASES.ESSENCE && 'Motes distilled'}
        {phase === PHASES.DONE && 'Rewards ready'}
      </p>

      <div className={`opening-stage${showEssenceRewards ? ' opening-stage--with-rewards' : ''}`}>
        <div className="opening-stage-main">
          {(phase === PHASES.INTRO || phase === PHASES.SPLITTING) && (
            <SplitPack phase={phase} onClick={handleSplit} packType={packType} flyAngle={flyAngle} />
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
        <div className="cards-queue" ref={queueStripRef}>
          {queuedCards.map((card, i) => (
            isResourceReveal ? (
              <div
                key={card.id}
                ref={el => { queueRefs.current[i] = el; }}
                className="queued-card queued-card--resource"
              >
                <OpeningCurrencyCard reward={card} className="opening-resource-card opening-resource-card--queue" />
              </div>
            ) : (
              <CardFace
                key={card.id}
                ref={el => { queueRefs.current[i] = el; }}
                card={card}
                className="queued-card"
                holo
              />
            )
          ))}
        </div>
      )}

      {phase === PHASES.REVEALING && (
        <p className="cards-remaining">{cardsLeft} remaining</p>
      )}

      {(phase === PHASES.INTRO || phase === PHASES.REVEALING) && revealCards.length > 1 && (
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
