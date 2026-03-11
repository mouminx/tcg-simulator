import { useRef } from 'react';
import { PACK_TYPES } from '../game/cards';

export default function PackCard({ size = 'md', packType }) {
  const pt = packType ?? PACK_TYPES.iron;
  const elRef  = useRef(null);
  const rafRef = useRef(null);

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
      className={`pack-display pack-display--${size} pack-type-${pt.id}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
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
