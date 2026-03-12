import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import CardFace from './CardFace';
import { PACK_TYPES } from '../game/cards';

const PHASES = { INTRO: 'intro', SPLITTING: 'splitting', REVEALING: 'revealing', DONE: 'done' };

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

const PackOpening = forwardRef(function PackOpening({ cards, onDone, collectionBtnRef, packType }, ref) {
  const [phase, setPhase] = useState(PHASES.INTRO);
  const [flyAngle, setFlyAngle] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [queuedCards, setQueuedCards] = useState([]);
  const [collecting, setCollecting] = useState(false);
  const queueRefs = useRef([]);

  function handleSplit() {
    // Random angle between -18° and 18°, never near zero
    const sign = Math.random() < 0.5 ? -1 : 1;
    setFlyAngle(sign * (8 + Math.random() * 10));
    setPhase(PHASES.SPLITTING);
    // 150ms pause + 320ms top fly + ~30ms buffer before bottom starts (0.52s delay) + 480ms bottom = ~1100ms total
    setTimeout(() => setPhase(PHASES.REVEALING), 1100);
  }

  function handleQueueCurrent() {
    const card = cards[currentIdx];
    const nextIdx = currentIdx + 1;
    setQueuedCards(prev => [...prev, card]);
    setCurrentIdx(nextIdx);
    if (nextIdx >= cards.length) setPhase(PHASES.DONE);
  }

  function handleSkip() {
    setQueuedCards(cards);
    setCurrentIdx(cards.length);
    setPhase(PHASES.DONE);
  }

  function handleCollect() {
    setCollecting(true);
    const target = collectionBtnRef?.current;
    if (target) {
      const targetRect = target.getBoundingClientRect();
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
    setTimeout(onDone, 750);
  }

  useImperativeHandle(ref, () => ({
    advance() {
      if (phase === PHASES.INTRO) {
        handleSplit();
      } else if (phase === PHASES.REVEALING) {
        setQueuedCards(prev => [...prev, ...cards.slice(currentIdx)]);
        setCurrentIdx(cards.length);
        setPhase(PHASES.DONE);
      } else if (phase === PHASES.DONE && !collecting) {
        handleCollect();
      }
    },
  }), [phase, currentIdx, collecting, cards]);

  const cardsLeft = cards.length - currentIdx;

  return (
    <div className="pack-opening">
      <p className="hint">
        {phase === PHASES.INTRO && 'Click the pack to open it'}
        {phase === PHASES.SPLITTING && '\u00a0'}
        {phase === PHASES.REVEALING && 'Tap card to open next'}
        {phase === PHASES.DONE && 'All cards queued!'}
      </p>

      <div className="opening-stage">
        {(phase === PHASES.INTRO || phase === PHASES.SPLITTING) && (
          <SplitPack phase={phase} onClick={handleSplit} packType={packType} flyAngle={flyAngle} />
        )}
        {phase === PHASES.REVEALING && (
          <CardFace
            key={currentIdx}
            card={cards[currentIdx]}
            onClick={handleQueueCurrent}
            className="center-card"
            holo
          />
        )}
        {phase === PHASES.DONE && !collecting && (
          <button className="collect-btn" onClick={handleCollect}>
            Add to Collection
          </button>
        )}
      </div>

      {queuedCards.length > 0 && (
        <div className="cards-queue">
          {queuedCards.map((card, i) => (
            <CardFace
              key={card.id}
              ref={el => { queueRefs.current[i] = el; }}
              card={card}
              className="queued-card"
              holo
            />
          ))}
        </div>
      )}

      {phase === PHASES.REVEALING && (
        <p className="cards-remaining">{cardsLeft} remaining</p>
      )}

      {phase !== PHASES.DONE && (
        <button className="skip-anim-btn" onClick={handleSkip}>
          Skip
        </button>
      )}
    </div>
  );
});

export default PackOpening;
