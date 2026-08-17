import { useRef, useEffect, useState } from 'react';
import { PACK_TYPES, WELCOME_PACK_TYPE } from '../game/cards';
import { useGraphicsFeatures } from '../game/graphics';

export default function PackCard({ size = 'md', packType }) {
  const pt         = packType ?? WELCOME_PACK_TYPE ?? PACK_TYPES.iron;
  const elRef      = useRef(null);
  const canvasRef  = useRef(null);
  const rafRef     = useRef(null);
  const modelHandleRef = useRef(null);
  const touchState = useRef({ active: false, timer: null, scrolling: false });
  const features   = useGraphicsFeatures();
  const [modelLive, setModelLive] = useState(false);

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
    modelHandleRef.current?.setPointer(dx / cx, dy / cy);
  }

  function resetTilt() {
    const el = elRef.current;
    if (!el) return;
    el.classList.remove('pack-holo--active');
    el.classList.add('pack-holo--spring');
    el.style.setProperty('--rx',  0);
    el.style.setProperty('--ry',  0);
    el.style.setProperty('--hyp', 0);
    modelHandleRef.current?.setPointer(0, 0);
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

  useEffect(() => {
    if (!features.scene3d) {
      setModelLive(false);
      modelHandleRef.current?.dispose();
      modelHandleRef.current = null;
      return undefined;
    }

    let cancelled = false;
    let handle = null;
    setModelLive(false);
    import('../graphics/pack3d')
      .then(({ registerLivePack }) => registerLivePack({
        canvas: canvasRef.current,
        packType: pt,
        onReady: () => {
          if (!cancelled) setModelLive(true);
        },
      }))
      .then(nextHandle => {
        if (cancelled) {
          nextHandle?.dispose();
          return;
        }
        handle = nextHandle;
        modelHandleRef.current = nextHandle;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      handle?.dispose();
      if (modelHandleRef.current === handle) modelHandleRef.current = null;
    };
  }, [features.scene3d, pt.id, size]);

  return (
    <div
      ref={elRef}
      className={`pack-display pack-display--${size} pack-type-${pt.id}${features.scene3d ? ' pack-display--model-pending' : ''}${modelLive ? ' pack-display--model-live' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="pack-display__model" aria-hidden="true" />
      <div className="pack-display__legacy">
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
      </div>
    </div>
  );
}
