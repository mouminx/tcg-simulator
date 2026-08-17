import { useEffect, useRef, useState } from 'react';
import PackCard from './PackCard';
import { useGraphicsFeatures } from '../game/graphics';

/**
 * Interactive GLB wrapper used only in the altar's opening stage. The ordinary
 * PackCard remains underneath until WebGL has produced its first frame, so a slow
 * dynamic import or refused context never leaves an empty click target.
 */
export default function PackModelOpening({ phase, onClick, packType, fallback }) {
  const canvasRef = useRef(null);
  const handleRef = useRef(null);
  const phaseRef = useRef(phase);
  const [live, setLive] = useState(false);
  const features = useGraphicsFeatures();
  const isIdle = phase === 'intro';

  phaseRef.current = phase;

  useEffect(() => {
    if (!features.scene3d) return undefined;
    let cancelled = false;
    let observer = null;

    import('../graphics/pack3d')
      .then(({ mountOpeningPack }) => mountOpeningPack({
        canvas: canvasRef.current,
        packType,
        onReady: () => {
          if (!cancelled) setLive(true);
        },
      }))
      .then(handle => {
        if (!handle || cancelled) {
          handle?.dispose();
          return;
        }
        handleRef.current = handle;
        if (phaseRef.current === 'splitting') handle.startDissolve();
        if (typeof ResizeObserver !== 'undefined' && canvasRef.current?.parentElement) {
          observer = new ResizeObserver(() => handle.resize());
          observer.observe(canvasRef.current.parentElement);
        } else {
          window.addEventListener('resize', handle.resize);
        }
      })
      .catch(() => {
        // The DOM pack below is the intentional no-WebGL fallback.
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (handleRef.current) {
        window.removeEventListener('resize', handleRef.current.resize);
        handleRef.current.dispose();
        handleRef.current = null;
      }
    };
  }, [packType, features.scene3d]);

  useEffect(() => {
    if (phase === 'splitting') handleRef.current?.startDissolve();
  }, [phase]);

  function handlePointerMove(event) {
    if (!isIdle || !handleRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    handleRef.current.setPointer(x, -y);
  }

  function handlePointerLeave() {
    handleRef.current?.setPointer(0, 0);
  }

  function activate(event) {
    if (!isIdle) return;
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onClick?.();
  }

  return (
    <div
      className={`pack-model-opening${features.scene3d ? ' pack-model-opening--webgl' : ''}${live ? ' pack-model-opening--live' : ''}${phase === 'splitting' ? ' pack-model-opening--dissolving' : ''}`}
      onClick={activate}
      onKeyDown={activate}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      role="button"
      tabIndex={isIdle ? 0 : -1}
      aria-label={`Open ${packType?.name ?? 'card'} pack`}
    >
      <div className="pack-model-opening__fallback" aria-hidden={live}>
        {fallback ?? <PackCard size="md" packType={packType} />}
      </div>
      <canvas ref={canvasRef} className="pack-model-opening__canvas" aria-hidden="true" />
      <div className="pack-model-opening__halo" aria-hidden="true" />
    </div>
  );
}
