import { forwardRef, useRef, useEffect } from 'react';
import { RARITIES, TIERS, TAGS, fmt } from '../game/cards';
import { CARD_ART, CARD_ART_POSITION } from '../game/cardArt';
import { CARD_COLORS } from '../game/cardColors';

// Rarities that get the rainbow foil coating
const FOIL_RARITIES    = new Set(['uncommon', 'rare', 'epic', 'legendary', 'mythic']);
// Rarities that also get sparkle dots on top
const SPARKLE_RARITIES = new Set(['epic', 'legendary', 'mythic']);

const CardFace = forwardRef(function CardFace({ card, onClick, className, onSell, holo, visualMode = 'full' }, ref) {
  const rarity = RARITIES[card.rarity];
  const tier = card.tier ?? 1;
  const tag  = card.tag ? TAGS[card.tag] : null;
  const compactVisuals = visualMode === 'compact';

  // Internal ref for mouse tracking; merged with the forwarded ref below
  const wrapRef    = useRef(null);
  const rafRef     = useRef(null);
  const touchState = useRef({ active: false, timer: null });

  function mergeRef(el) {
    wrapRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  }

  function applyTilt(clientX, clientY) {
    const el = wrapRef.current;
    if (!el) return;
    const r  = el.getBoundingClientRect();
    const cx = r.width  / 2;
    const cy = r.height / 2;
    const dx = clientX - r.left - cx;
    const dy = clientY - r.top  - cy;
    el.style.setProperty('--rx',  -(dy / cy) * 15);
    el.style.setProperty('--ry',   (dx / cx) * 15);
    el.style.setProperty('--mx',  ((clientX - r.left) / r.width)  * 100);
    el.style.setProperty('--my',  ((clientY - r.top)  / r.height) * 100);
    el.style.setProperty('--hyp', Math.min(Math.hypot(dx / cx, dy / cy), 1));
  }

  function resetTilt() {
    const el = wrapRef.current;
    if (!el) return;
    el.classList.add('holo-spring');
    el.style.setProperty('--rx',  0);
    el.style.setProperty('--ry',  0);
    el.style.setProperty('--hyp', 0);
    setTimeout(() => el?.classList.remove('holo-spring'), 600);
  }

  function handleMouseMove(e) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => applyTilt(e.clientX, e.clientY));
  }

  function handleMouseLeave() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    resetTilt();
  }

  function handleMouseEnter() {
    wrapRef.current?.classList.remove('holo-spring');
  }

  // ── Touch tilt: hold 180ms then drag to tilt ────────────────────────────────
  // If the finger moves significantly before the timer fires it's a scroll — cancel tilt.
  function handleTouchStart(e) {
    clearTimeout(touchState.current.timer);
    touchState.current.active = false;
    touchState.current.scrolling = false;
    const t = e.touches[0];
    touchState.current.startX = t.clientX;
    touchState.current.startY = t.clientY;
    touchState.current.timer = setTimeout(() => {
      if (!touchState.current.scrolling) touchState.current.active = true;
    }, 180);
  }

  function handleTouchEnd() {
    clearTimeout(touchState.current.timer);
    if (touchState.current.active) {
      touchState.current.active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      resetTilt();
    }
  }

  // Must use addEventListener (not React synthetic) to pass { passive: false }
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    function onTouchMove(e) {
      const t = e.touches[0];
      if (!touchState.current.active) {
        // Before tilt activates: detect scroll intent by significant movement
        const dx = Math.abs(t.clientX - touchState.current.startX);
        const dy = Math.abs(t.clientY - touchState.current.startY);
        if (dx > 6 || dy > 6) {
          touchState.current.scrolling = true;
          clearTimeout(touchState.current.timer);
        }
        return;
      }
      e.preventDefault();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => applyTilt(t.clientX, t.clientY));
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  const hasFoil    = holo && FOIL_RARITIES.has(card.rarity);
  const hasSparkle = holo && SPARKLE_RARITIES.has(card.rarity);
  const artSrc      = CARD_ART[card.name];
  const artPosition = CARD_ART_POSITION[card.name] ?? 'center center';

  const palette = CARD_COLORS[card.name];

  // Seven spots scattered across the card [x%, y%]
  const SPOTS = [
    [15, 18], [82, 12], [48, 35],
    [22, 62], [76, 58], [10, 88], [88, 85],
  ];

  const cardBg = (() => {
    if (!Array.isArray(palette)) return palette ?? rarity.color;
    if (compactVisuals) {
      const [r0, g0, b0] = palette[0];
      return `rgb(${r0},${g0},${b0})`;
    }
    const [r0, g0, b0] = palette[0]; // darkest as solid base
    const spots = palette.map(([r, g, b], i) => {
      const [x, y] = SPOTS[i] ?? [50, 50];
      return `radial-gradient(ellipse at ${x}% ${y}%, rgba(${r},${g},${b},0.85) 0%, transparent 68%)`;
    });
    return `${spots.join(', ')}, rgb(${r0},${g0},${b0})`;
  })();

  // Mid-tone palette color for glow (gradients can't be used in box-shadow)
  const glowColor = Array.isArray(palette)
    ? `rgb(${palette[2].join(',')})`
    : (palette ?? rarity.color);

  return (
    <div
      ref={mergeRef}
      className={`card-face-wrapper tier-${tier} ${compactVisuals ? 'card-face-wrapper--compact' : ''} ${className || ''} ${holo ? `holo-active holo--${card.rarity}` : ''} ${card.tag ? `has-tag-${card.tag}` : ''}`}
      style={{ '--glow-color': glowColor }}
      onClick={onClick}
      onMouseMove={holo ? handleMouseMove : undefined}
      onMouseLeave={holo ? handleMouseLeave : undefined}
      onMouseEnter={holo ? handleMouseEnter : undefined}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="card-face-inner">
        <div className="card-face-front" style={{ background: cardBg }}>
          {!compactVisuals && <div className="card-tier-overlay" />}
          {!compactVisuals && tag && <div className={`tag-vfx tag-vfx--${card.tag}`} aria-hidden="true" />}

          {/* Header row: name left, tier stars right */}
          <div className="card-header-row">
            <span className="card-name">{card.name}</span>
            <span className={`card-tier-stars tier-stars--${tier}`}>
              {'✦'.repeat(tier)}
            </span>
          </div>

          {/* Art window — 3:2 */}
          <div className="card-art-window">
            {artSrc
              ? <img src={artSrc} alt={card.name} className="card-art-img" draggable="false" loading="lazy" decoding="async" style={{ objectPosition: artPosition }} />
              : <div className="card-art-placeholder" />
            }
          </div>

          {/* Tag pills: rarity, tag */}
          <div className="card-tags-row">
            <span
              className={`card-tag-pill card-tag-pill--rarity card-tag-pill--rarity-${card.rarity}`}
              style={{ '--pill-base': rarity.color }}
            >
              <span className="card-tag-pill__label">{rarity.name}</span>
            </span>
            {tag && (
              <span className={`card-tag-pill card-tag-pill--tag card-tag-pill--tag-${card.tag}`}>
                <span className="card-tag-pill__label">{tag.name}</span>
              </span>
            )}
          </div>

          {/* Holo layers — sit above art, below header/tags */}
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
        <div className="card-face-back" style={{ background: cardBg }}>
          {!compactVisuals && <div className="card-tier-overlay" />}
          <span className="card-back-text">TCG</span>
          {tier > 1 && <span className="card-back-tier">T{TIERS[tier].name}</span>}
        </div>
      </div>
    </div>
  );
});

export default CardFace;
