import { forwardRef, useRef } from 'react';
import { RARITIES, TIERS, TAGS, fmt } from '../game/cards';

// Rarities that get the rainbow foil coating
const FOIL_RARITIES    = new Set(['uncommon', 'rare', 'epic', 'legendary', 'mythic']);
// Rarities that also get sparkle dots on top
const SPARKLE_RARITIES = new Set(['epic', 'legendary', 'mythic']);

const CardFace = forwardRef(function CardFace({ card, onClick, className, onSell, holo }, ref) {
  const rarity = RARITIES[card.rarity];
  const tier = card.tier ?? 1;
  const tag  = card.tag ? TAGS[card.tag] : null;

  // Internal ref for mouse tracking; merged with the forwarded ref below
  const wrapRef = useRef(null);
  const rafRef  = useRef(null);

  function mergeRef(el) {
    wrapRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  }

  function handleMouseMove(e) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = wrapRef.current;
      if (!el) return;
      const r  = el.getBoundingClientRect();
      const cx = r.width  / 2;
      const cy = r.height / 2;
      const dx = e.clientX - r.left - cx;
      const dy = e.clientY - r.top  - cy;
      el.style.setProperty('--rx',  -(dy / cy) * 15);
      el.style.setProperty('--ry',   (dx / cx) * 15);
      el.style.setProperty('--mx',  ((e.clientX - r.left) / r.width)  * 100);
      el.style.setProperty('--my',  ((e.clientY - r.top)  / r.height) * 100);
      el.style.setProperty('--hyp', Math.min(Math.hypot(dx / cx, dy / cy), 1));
    });
  }

  function handleMouseLeave() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const el = wrapRef.current;
    if (!el) return;
    el.classList.add('holo-spring');
    el.style.setProperty('--rx',  0);
    el.style.setProperty('--ry',  0);
    el.style.setProperty('--hyp', 0);
    setTimeout(() => el?.classList.remove('holo-spring'), 600);
  }

  function handleMouseEnter() {
    wrapRef.current?.classList.remove('holo-spring');
  }

  const hasFoil    = holo && FOIL_RARITIES.has(card.rarity);
  const hasSparkle = holo && SPARKLE_RARITIES.has(card.rarity);

  return (
    <div
      ref={mergeRef}
      className={`card-face-wrapper tier-${tier} ${className || ''} ${holo ? `holo-active holo--${card.rarity}` : ''} ${card.tag ? `has-tag-${card.tag}` : ''}`}
      style={{ '--glow-color': rarity.color }}
      onClick={onClick}
      onMouseMove={holo ? handleMouseMove : undefined}
      onMouseLeave={holo ? handleMouseLeave : undefined}
      onMouseEnter={holo ? handleMouseEnter : undefined}
    >
      <div className="card-face-inner">
        <div className="card-face-front" style={{ backgroundColor: rarity.color }}>
          <div className="card-tier-overlay" />
          {/* tag visual effect layer — sits above tier-overlay, below text */}
          {tag && <div className={`tag-vfx tag-vfx--${card.tag}`} aria-hidden="true" />}
          <div className="card-rarity">
            {rarity.name}
            {tier > 1 && <span className="card-tier-badge"> · Tier {TIERS[tier].name}</span>}
          </div>
          <div className="card-name">{card.name}</div>
          <div className="card-value">{fmt(card.value)}</div>
          {tag && <div className="card-tag-badge">{tag.name}</div>}
          {/* holo layers sit above card art/text, below the sell overlay */}
          {hasFoil    && <div className="holo-foil"    aria-hidden="true" />}
          {holo       && <div className="holo-glare"   aria-hidden="true" />}
          {hasSparkle && <div className="holo-sparkle" aria-hidden="true" />}
          {card.fuseScore != null && (
            <div className="card-fuse-badge">⊕{card.fuseScore}</div>
          )}
          {card.grade != null && (
            <div className={`card-grade-badge grade-badge--${card.grade === 10 ? 'gem' : card.grade >= 8 ? 'high' : card.grade >= 5 ? 'mid' : 'low'}`}>
              {card.grade}
            </div>
          )}
          {onSell && (
            <div className="sell-overlay">
              <button
                className="sell-btn"
                onClick={e => { e.stopPropagation(); onSell(); }}
              >
                Sell {fmt(card.value)}
              </button>
            </div>
          )}
        </div>
        <div className="card-face-back" style={{ backgroundColor: rarity.color }}>
          <div className="card-tier-overlay" />
          <span className="card-back-text">TCG</span>
          {tier > 1 && <span className="card-back-tier">T{TIERS[tier].name}</span>}
        </div>
      </div>
    </div>
  );
});

export default CardFace;
