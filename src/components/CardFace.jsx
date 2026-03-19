import { forwardRef, useRef, useEffect } from 'react';
import { RARITIES, TIERS, TAGS, formatAffixText } from '../game/cards';
import Gold from './Gold';
import { CLASS_ART } from '../game/cardArt';
import { CARD_COLORS } from '../game/cardColors';
import commonGem from '../assets/rarity-gems/common.svg';
import uncommonGem from '../assets/rarity-gems/uncommon.svg';
import rareGem from '../assets/rarity-gems/rare.svg';
import epicGem from '../assets/rarity-gems/epic.svg';
import legendaryGem from '../assets/rarity-gems/legendary.svg';
import mythicGem from '../assets/rarity-gems/mythic.svg';
import tier1Stars from '../assets/tier-stars/tier1.svg';
import tier2Stars from '../assets/tier-stars/tier2.svg';
import tier3Stars from '../assets/tier-stars/tier3.svg';
import tier4Stars from '../assets/tier-stars/tier4.svg';
import tier5Stars from '../assets/tier-stars/tier5.svg';

// Rarities that get the rainbow foil coating
const FOIL_RARITIES    = new Set(['uncommon', 'rare', 'epic', 'legendary', 'mythic']);
// Rarities that also get sparkle dots on top
const SPARKLE_RARITIES = new Set(['epic', 'legendary', 'mythic']);
const RARITY_GEMS = {
  common: commonGem,
  uncommon: uncommonGem,
  rare: rareGem,
  epic: epicGem,
  legendary: legendaryGem,
  mythic: mythicGem,
};
const TIER_STAR_ASSETS = {
  1: tier1Stars,
  2: tier2Stars,
  3: tier3Stars,
  4: tier4Stars,
  5: tier5Stars,
};

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
  const classVariants = CLASS_ART[card.classType];
  const artSrc = classVariants
    ? (classVariants[card.artVariant ?? 0] ?? classVariants[0] ?? null)
    : null;
  const artPosition = 'center 10%';
  const rarityGemSrc = RARITY_GEMS[card.rarity];
  const tierStarsSrc = TIER_STAR_ASSETS[tier] ?? tier1Stars;

  const palette = CARD_COLORS[card.classType] ?? CARD_COLORS[card.name];
  const affixes = card.affixes ?? [];

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
          </div>

          {/* Art window — 3:2 */}
          <div className="card-art-frame">
            <div className="card-art-window">
              {artSrc
                ? <img src={artSrc} alt={card.name} className="card-art-img" draggable="false" loading="lazy" decoding="async" style={{ objectPosition: artPosition }} />
                : <div className="card-art-placeholder" />
              }
            </div>
            <div className={`card-art-rarity-tab card-art-rarity-tab--${card.rarity}`} aria-label={rarity.name} title={rarity.name}>
              <div className="card-art-rarity-tab__well">
                <img
                  src={rarityGemSrc}
                  alt=""
                  aria-hidden="true"
                  className="card-art-rarity-tab__gem"
                  draggable="false"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>

          {/* Tag pills: special finish only */}
          {tag && (
            <div className="card-tags-row">
              <span className={`card-tag-pill card-tag-pill--tag card-tag-pill--tag-${card.tag}`}>
                <span className="card-tag-pill__label">{tag.name}</span>
              </span>
            </div>
          )}

          {affixes.length > 0 && (
            <div className={`card-affix-list${compactVisuals ? ' card-affix-list--compact' : ''}`}>
              {affixes.map(affix => (
                <div
                  key={`${card.id}-${affix.id}`}
                  className={`card-affix-line${affix.isHigher ? ' card-affix-line--higher' : ''}`}
                >
                  <span className="card-affix-bullet" aria-hidden="true">
                    {affix.isHigher ? '★' : '◆'}
                  </span>
                  <span className="card-affix-text">
                    {formatAffixText(affix)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Holo layers — sit above art, below header/tags */}
          {hasFoil    && <div className="holo-foil"    aria-hidden="true" />}
          {holo       && <div className="holo-glare"   aria-hidden="true" />}
          {hasSparkle && <div className="holo-sparkle" aria-hidden="true" />}

          {card.fuseScore != null && (
            <div className="card-fuse-badge">⊕{card.fuseScore}</div>
          )}
          <div className={`card-bottom-socket card-bottom-socket--tier-${tier}`} aria-label={`Tier ${tier}`}>
            <div className="card-bottom-socket__well">
              <div className="card-bottom-socket__stars" aria-hidden="true">
                {Array.from({ length: tier }, (_, index) => (
                  <img
                    key={`${card.id}-bottom-tier-star-${index}`}
                    src={tierStarsSrc}
                    alt=""
                    className="card-bottom-socket__star"
                    draggable="false"
                    loading="lazy"
                    decoding="async"
                  />
                ))}
              </div>
            </div>
          </div>
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
                Sell <Gold amount={card.value} />
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
