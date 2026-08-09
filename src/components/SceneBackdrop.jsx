import { useEffect, useRef, useState } from 'react';
import { useGraphicsFeatures } from '../game/graphics';

/**
 * Host for a WebGL backdrop.
 *
 * Renders a CSS gradient in every case, and lays a blurred WebGL canvas over it only
 * when the graphics tier allows it. So the visual never depends on WebGL succeeding:
 *
 *   quality low / medium  → gradient only, three.js is never downloaded
 *   quality high          → gradient + canvas, three.js loaded on demand
 *   high but no GL        → gradient only (the context request is allowed to fail)
 *
 * The gradient is keyed to the scene so the fallback still suits the room it is in.
 */
export default function SceneBackdrop({ scene, className = '' }) {
  const features = useGraphicsFeatures();
  const canvasRef = useRef(null);
  const handleRef = useRef(null);
  const [live, setLive] = useState(false);

  const enabled = Boolean(features.scene3d) && features.sceneResolution > 0;

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    let observer = null;

    // Dynamic import: this is what keeps three out of the main bundle.
    import('../scenes/backdrop')
      .then(({ mountBackdrop }) => {
        if (cancelled || !canvasRef.current) return;
        const handle = mountBackdrop({
          canvas: canvasRef.current,
          sceneId: scene,
          resolution: features.sceneResolution,
        });
        // null means the GL context was refused — stay on the gradient.
        if (!handle) return;
        handleRef.current = handle;
        setLive(true);

        if (typeof ResizeObserver !== 'undefined' && canvasRef.current.parentElement) {
          observer = new ResizeObserver(() => handle.resize());
          observer.observe(canvasRef.current.parentElement);
        } else {
          window.addEventListener('resize', handle.resize);
        }
      })
      .catch(() => {
        // Chunk failed to load (offline, blocked). Gradient stands in.
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (handleRef.current) {
        window.removeEventListener('resize', handleRef.current.resize);
        handleRef.current.dispose();
        handleRef.current = null;
      }
      setLive(false);
    };
  }, [enabled, scene, features.sceneResolution]);

  return (
    <div className={`scene-backdrop scene-backdrop--${scene} ${className}`.trim()} aria-hidden="true">
      <div className="scene-backdrop__gradient" />
      {enabled && (
        <canvas
          ref={canvasRef}
          className={`scene-backdrop__canvas${live ? ' scene-backdrop__canvas--live' : ''}`}
        />
      )}
      {/* Darkening veil. Keeps UI contrast predictable regardless of what the scene
          is doing underneath — without it, card text sits on moving mid-tones. */}
      <div className="scene-backdrop__veil" />
    </div>
  );
}
