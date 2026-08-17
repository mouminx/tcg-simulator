import { forwardRef, memo, useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RARITIES, TIERS, TAGS, formatAffixText } from '../game/cards';
import Gold from './Gold';
import { useGraphicsFeatures } from '../game/graphics';
import { getClassArt } from '../game/cardArt';
import { CARD_COLORS } from '../game/cardColors';
import { GEM_RESOURCES_BY_ID } from '../game/gems';
import { describeSocket, normalizeCardSockets } from '../game/cardSockets';
import { getResourceArt } from '../game/resourceArt';
import tier1Stars from '../assets/tier-stars/tier1.svg';
import tier2Stars from '../assets/tier-stars/tier2.svg';
import tier3Stars from '../assets/tier-stars/tier3.svg';
import tier4Stars from '../assets/tier-stars/tier4.svg';
import tier5Stars from '../assets/tier-stars/tier5.svg';

// Rarities that get the rainbow foil coating
const FOIL_RARITIES    = new Set(['uncommon', 'rare', 'epic', 'legendary', 'mythic']);
// Rarities that also get sparkle dots on top
const SPARKLE_RARITIES = new Set(['epic', 'legendary', 'mythic']);
const RARITY_FRAME_COLORS = Object.freeze({
  common: '#f4f2e8',
  uncommon: '#58cf70',
  rare: '#4a8df0',
  epic: '#a855f7',
  legendary: '#f0cf4f',
  mythic: '#ef4444',
});
const TIER_STAR_ASSETS = {
  1: tier1Stars,
  2: tier2Stars,
  3: tier3Stars,
  4: tier4Stars,
  5: tier5Stars,
};

// `artDetail` selects which encode of the class art to load. Default 'thumb'
// (320x480, 0.59 MiB decoded) covers every 110-160px render, which is nearly all
// of them. Only pass 'full' where the card renders large enough that a thumb
// would look soft on a 2x DPR display: the 330px viewer modal / hover preview
// and the 200px pack-reveal center card.
const CardFace = forwardRef(function CardFace({ card, onClick, onAffixClick = null, onSocketClick = null, resourceDropTarget = null, showSocketTooltips = false, className, onSell, holo, visualMode = 'full', artDetail = 'thumb' }, ref) {
  const features = useGraphicsFeatures();
  const rarity = RARITIES[card.rarity];
  const tier = card.tier ?? 1;
  const tag  = card.tag ? TAGS[card.tag] : null;
  const compactVisuals = visualMode === 'compact';
  // Kept separate from `compactVisuals` on purpose: compact also shrinks the affix
  // text (`.card-affix-list--compact`), and a graphics setting has no business
  // changing type size. This flag only swaps the seven-gradient background for a
  // flat fill.
  const flatBackground = compactVisuals || !features.gradientCardBg;
  // Gate the 3D tilt at the source: no listeners attached means no per-pointer-move
  // rAF and no CSS custom property writes, which is the expensive part.
  const tiltEnabled = holo && features.holoTilt;

  // Internal ref for mouse tracking; merged with the forwarded ref below
  const wrapRef    = useRef(null);
  const rafRef     = useRef(null);
  const touchState = useRef({ active: false, timer: null });
  const [socketTip, setSocketTip] = useState(null);

  function updateSocketTip(event, socket, gem) {
    if (!showSocketTooltips || !socket || !gem) return;
    const tooltipWidth = 252;
    const tooltipHeight = 96;
    const offset = 14;
    const x = event.clientX + offset + tooltipWidth > window.innerWidth
      ? event.clientX - tooltipWidth - offset
      : event.clientX + offset;
    const y = event.clientY + offset + tooltipHeight > window.innerHeight
      ? event.clientY - tooltipHeight - offset
      : event.clientY + offset;
    const fullDescription = describeSocket(socket);
    setSocketTip({
      name: gem.name,
      description: fullDescription.startsWith(`${gem.name}: `)
        ? fullDescription.slice(gem.name.length + 2)
        : fullDescription,
      x: Math.max(8, x),
      y: Math.max(8, y),
    });
  }

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
    if (!el || !tiltEnabled) return;
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
  }, [tiltEnabled]);

  const hasFoil    = holo && features.holoLayers && FOIL_RARITIES.has(card.rarity);
  const hasSparkle = holo && features.holoLayers && SPARKLE_RARITIES.has(card.rarity);
  const artSrc = getClassArt(card.classType, card.artVariant ?? 0, artDetail);
  const artPosition = 'center 10%';
  const tierStarsSrc = TIER_STAR_ASSETS[tier] ?? tier1Stars;
  const frameColor = card.tag === 'firstEdition'
    ? '#f0c040'
    : (RARITY_FRAME_COLORS[card.rarity] ?? RARITY_FRAME_COLORS.common);

  const palette = CARD_COLORS[card.classType] ?? CARD_COLORS[card.name];
  const affixes = card.affixes ?? [];
  const sockets = normalizeCardSockets(card);

  // Seven spots scattered across the card [x%, y%]
  const SPOTS = [
    [15, 18], [82, 12], [48, 35],
    [22, 62], [76, 58], [10, 88], [88, 85],
  ];

  const cardBg = (() => {
    if (!Array.isArray(palette)) return palette ?? rarity.color;
    if (flatBackground) {
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
      style={{ '--glow-color': glowColor, '--card-frame-color': frameColor }}
      data-resource-drop-target={resourceDropTarget || undefined}
      onClick={onClick}
      onMouseMove={tiltEnabled ? handleMouseMove : undefined}
      onMouseLeave={tiltEnabled ? handleMouseLeave : undefined}
      onMouseEnter={tiltEnabled ? handleMouseEnter : undefined}
      onTouchStart={tiltEnabled ? handleTouchStart : undefined}
      onTouchEnd={tiltEnabled ? handleTouchEnd : undefined}
    >
      <div className="card-face-inner">
        <div className="card-face-front" style={{ background: cardBg }}>
          {/* Full-bleed portrait. Readability shading belongs to this artwork layer so the
              card keeps one uninterrupted image instead of recreating an inset art panel. */}
          <div className="card-art-frame">
            <div className="card-art-window">
              {artSrc
                ? <img src={artSrc} alt={card.name} className="card-art-img" draggable="false" loading="lazy" decoding="async" style={{ objectPosition: artPosition }} />
                : <div className="card-art-placeholder" />
              }
            </div>
          </div>
          {!compactVisuals && features.tierOverlay && <div className="card-tier-overlay" />}
          {!compactVisuals && features.tagVfx && tag && <div className={`tag-vfx tag-vfx--${card.tag}`} aria-hidden="true" />}

          {/* A card's tier is its affix count, so the stars live at the top as the
              first piece of information on the full-art face. */}
          <div className={`card-affix-stars card-affix-stars--tier-${tier}`} aria-label={`${tier} affix${tier === 1 ? '' : 'es'}`}>
            <div className="card-affix-stars__well">
              <div className="card-affix-stars__row" aria-hidden="true">
                {Array.from({ length: tier }, (_, index) => (
                  <img
                    key={`${card.id}-affix-star-${index}`}
                    src={tierStarsSrc}
                    alt=""
                    className="card-affix-stars__star"
                    draggable="false"
                    loading="lazy"
                    decoding="async"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* The name floats over the portrait rather than occupying a separate panel. */}
          <div className="card-header-row">
            <span className="card-name">{card.name}</span>
          </div>

          {/* No tag pill. A holo/foil/first-edition finish announces itself through the
              card's own treatment — the `has-tag-*` wrapper class and `tag-vfx` layer below —
              so naming it in text was redundant, and the row it needed was the main reason
              small cards ran out of vertical space and clipped their affixes. */}

          {affixes.length > 0 && (
            <div className={`card-affix-list${compactVisuals ? ' card-affix-list--compact' : ''}`}>
              {affixes.map(affix => (
                <div
                  key={`${card.id}-${affix.id}`}
                  className={`card-affix-line${affix.isHigher ? ' card-affix-line--higher' : ''}${onAffixClick ? ' card-affix-line--socket-target' : ''}`}
                  onClick={onAffixClick ? event => {
                    event.stopPropagation();
                    onAffixClick(affix.id);
                  } : undefined}
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

          {sockets.length > 0 && (
            <div className="card-socket-rail" aria-label={`${sockets.length} gem socket${sockets.length === 1 ? '' : 's'}`}>
              {sockets.map((socket, index) => {
                const gem = socket ? GEM_RESOURCES_BY_ID[socket.gemId] : null;
                return (
                  <span
                    key={`${card.id}-socket-${index}`}
                    className={`card-socket${gem ? ' card-socket--filled' : ''}${gem && onSocketClick ? ' card-socket--extractable' : ''}`}
                    style={gem ? { '--socket-color': gem.color } : undefined}
                    title={showSocketTooltips ? undefined : describeSocket(socket)}
                    onMouseEnter={gem ? event => updateSocketTip(event, socket, gem) : undefined}
                    onMouseMove={gem ? event => updateSocketTip(event, socket, gem) : undefined}
                    onMouseLeave={gem ? () => setSocketTip(null) : undefined}
                    onClick={gem && onSocketClick ? event => {
                      event.stopPropagation();
                      onSocketClick(index);
                    } : undefined}
                  >
                    {gem && (
                      <img
                        src={getResourceArt(gem.artKey)}
                        alt=""
                        aria-hidden="true"
                        draggable="false"
                      />
                    )}
                  </span>
                );
              })}
            </div>
          )}

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
      {showSocketTooltips && socketTip && createPortal(
        <div
          className="resource-tooltip card-socket-tooltip"
          style={{ left: socketTip.x, top: socketTip.y }}
          role="tooltip"
        >
          <span className="resource-tooltip__name">{socketTip.name}</span>
          <span className="resource-tooltip__desc">{socketTip.description}</span>
        </div>,
        document.body,
      )}
    </div>
  );
});

// Memoized because App.jsx re-renders the whole tree every time a production
// timer ticks. The cards socketed into Foundry / Wilderness / Expedition / Arcana
// slots pass only `card` + `visualMode` + `className` — no callbacks — so they
// hit the memo and stop re-rendering entirely between actual state changes.
// Rebuilding `cardBg` (seven radial-gradients) per card per tick was pure waste.
export default memo(CardFace);
