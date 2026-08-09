import { useRef, useEffect } from 'react';
import { PACK_TYPES, WELCOME_PACK_TYPE } from '../game/cards';

export default function PackCard({ size = 'md', packType }) {
  const pt         = packType ?? WELCOME_PACK_TYPE ?? PACK_TYPES.iron;
  const elRef      = useRef(null);
  const rafRef     = useRef(null);
  const touchState = useRef({ active: false, timer: null, scrolling: false });

  function applyTilt(clientX, clientY) {
    const el = elRef.current;
    if (!el) return;
    const r  = el.getBoundingClientRect();
    const cx = r.width  / 2;
    const cy = r.height / 2;
    const dx = clientX - r.left - cx;
    const dy = clientY - r.top  - cy;
    el.style.setProperty('--rx',  -(dy / cy) * 12);
    el.style.setProperty('--ry',   (dx / cx) * 12);
    el.style.setProperty('--mx',  ((clientX - r.left) / r.width)  * 100);
    el.style.setProperty('--my',  ((clientY - r.top)  / r.height) * 100);
    el.style.setProperty('--hyp', Math.min(Math.hypot(dx / cx, dy / cy), 1));
  }

  function resetTilt() {
    const el = elRef.current;
    if (!el) return;
    el.classList.remove('pack-holo--active');
    el.classList.add('pack-holo--spring');
    el.style.setProperty('--rx',  0);
    el.style.setProperty('--ry',  0);
    el.style.setProperty('--hyp', 0);
    setTimeout(() => el?.classList.remove('pack-holo--spring'), 600);
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
    const el = elRef.current;
    if (!el) return;
    el.classList.remove('pack-holo--spring');
    el.classList.add('pack-holo--active');
  }

  function handleTouchStart(e) {
    clearTimeout(touchState.current.timer);
    touchState.current.active   = false;
    touchState.current.scrolling = false;
    const t = e.touches[0];
    touchState.current.startX = t.clientX;
    touchState.current.startY = t.clientY;
    touchState.current.timer = setTimeout(() => {
      if (!touchState.current.scrolling) {
        touchState.current.active = true;
        elRef.current?.classList.add('pack-holo--active');
      }
    }, 180);
  }

  function handleTouchEnd(e) {
    clearTimeout(touchState.current.timer);
    if (touchState.current.active) {
      touchState.current.active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      resetTilt();
      // Prevent the synthetic click so a tilt gesture doesn't also open the pack
      e.preventDefault();
    }
  }

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    function onTouchMove(e) {
      const t = e.touches[0];
      if (!touchState.current.active) {
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

  return (
    <div
      ref={elRef}
      className={`pack-display pack-display--${size} pack-type-${pt.id}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="pack-strip-top">
        <div className="pack-stars">{pt.stars}</div>
      </div>
      <div className="pack-cut-line" />
      <div className="pack-body">
        <div className="pack-sheen" />
        <div className="pack-title">{pt.name}</div>
        <div className="pack-subtitle">{pt.subtitle}</div>
        <div className="pack-card-count">{pt.cardCount ?? 5} CARDS</div>
      </div>
      <div className="pack-holo-foil"    aria-hidden="true" />
      <div className="pack-holo-glare"   aria-hidden="true" />
      <div className="pack-holo-sparkle" aria-hidden="true" />
    </div>
  );
}
