/**
 * WebGL backdrop runtime.
 *
 * This is the ONLY module that imports three, and it is only ever reached through a
 * dynamic `import()` from SceneBackdrop.jsx. That keeps three (~150 KB gzipped) out of
 * the main bundle entirely: a machine on `low` quality — which is what software
 * renderers and low-core machines auto-detect to — never downloads a byte of it.
 *
 * The backdrop is presented **unblurred**, so the scene is read directly and has to
 * hold up to inspection. That sets the quality floor:
 *
 *   - it renders at full CSS-pixel size (`sceneResolution: 1`), with the device pixel
 *     ratio capped at 2 so a 3x display does not quadruple fill cost for no gain.
 *   - antialiasing is on below 2x DPR. At 2x and above the extra device pixels already
 *     supersample the edges, so MSAA there is paid-for and invisible.
 *
 * Savings that remain, since the blur is no longer paying for the resolution:
 *
 *   - the loop is capped at 30fps. Decorative background motion does not need 60,
 *     and this halves GPU time.
 *   - no shadow maps, no post-processing, no textures; low-poly geometry throughout.
 *   - the loop stops entirely when the tab is hidden or the host unmounts, so a
 *     backdrop never burns cycles for a screen nobody is looking at.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { buildWildernessScene } from './wildernessScene';
import { buildCavernScene } from './cavernScene';
import { buildSplashScene } from './splashScene';

const BUILDERS = {
  wilderness: buildWildernessScene,
  cavern: buildCavernScene,
  splash: buildSplashScene,
};

const TARGET_FPS = 30;
const FRAME_MS = 1000 / TARGET_FPS;

export function mountBackdrop({ canvas, sceneId, resolution = 1 }) {
  const build = BUILDERS[sceneId];
  if (!build) throw new Error(`Unknown backdrop scene: ${sceneId}`);

  // Below 2x DPR there are not enough device pixels to hide polygon edges, so MSAA
  // earns its cost. At 2x+ the display is already supersampling and MSAA is wasted.
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: dpr < 2,
      alpha: false,
      powerPreference: 'default',
      // Nothing reads pixels back, and not preserving the buffer lets the driver
      // pick the cheaper path.
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: true,
    });
  } catch {
    // Includes the software-rasterizer case: `failIfMajorPerformanceCaveat` makes the
    // context request fail rather than silently hand back a renderer that would run
    // at single-digit fps. The caller falls back to the static CSS backdrop.
    return null;
  }

  // Capped at 2: beyond that the extra pixels are invisible on a decorative backdrop
  // but the fill cost keeps scaling (a 3x display would be 2.25x the work of 2x).
  renderer.setPixelRatio(Math.min(dpr, 2));
  renderer.setClearColor(0x000000, 1);

  const built = build(THREE);

  // Tone mapping is opt-in per scene, like bloom below. The cavern needs it: a near-black
  // rock face lit by an open fire covers a dynamic range that clips ugly under the default
  // linear output — highlights flatten to white discs and the shadow end crushes to pure
  // black. The wilderness is evenly lit and deliberately does not ask for it, so its look
  // is unaffected.
  if (built.toneMapping) {
    renderer.toneMapping = THREE[built.toneMapping.type] ?? THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = built.toneMapping.exposure ?? 1;
  }

  // Bloom is what sells the golden-hour look — it is the light-scattering halo around
  // bright edges that reads as "painterly" rather than "flat shaded polygons". A scene
  // opts in by returning a `bloom` config; if the composer cannot be built we fall back
  // to rendering the scene directly, which still looks correct, just less luminous.
  let composer = null;
  if (built.bloom) {
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(built.scene, built.camera));
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(1, 1),
        built.bloom.strength ?? 0.6,
        built.bloom.radius ?? 0.7,
        built.bloom.threshold ?? 0.75,
      );
      composer.addPass(bloomPass);
      // UnrealBloomPass blurs at successively halved mip levels, so its cost scales
      // with the composer size rather than the pass count.
      composer.setPixelRatio(Math.min(dpr, 2));
    } catch {
      composer = null;
    }
  }

  let disposed = false;
  let rafId = null;
  let paused = false;
  let startedAt = null;
  let lastFrame = 0;
  // Accumulated scene time, so pausing does not cause a jump when we resume.
  let elapsed = 0;

  function resize() {
    if (disposed) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    const rw = Math.max(1, Math.round(w * resolution));
    const rh = Math.max(1, Math.round(h * resolution));
    renderer.setSize(rw, rh, false);
    composer?.setSize(rw, rh);
    // An orthographic camera has no `aspect` — its frustum is set by explicit edges, so it
    // has to be rebuilt from the viewport on every resize or the scene stretches. Scenes
    // declare how much world height they want in view via `camera.userData.viewHeight`;
    // width follows from the aspect so the pixels stay square.
    if (built.camera.isOrthographicCamera) {
      const halfH = (built.camera.userData.viewHeight ?? 40) / 2;
      const halfW = halfH * (w / h);
      built.camera.left = -halfW;
      built.camera.right = halfW;
      built.camera.top = halfH;
      built.camera.bottom = -halfH;
    } else {
      built.camera.aspect = w / h;
    }
    built.camera.updateProjectionMatrix();
  }

  function frame(now) {
    if (disposed) return;
    rafId = requestAnimationFrame(frame);
    if (paused) return;

    if (startedAt === null) startedAt = now;
    if (now - lastFrame < FRAME_MS) return;
    lastFrame = now;

    elapsed = (now - startedAt) / 1000;
    built.update(elapsed);
    if (composer) composer.render();
    else renderer.render(built.scene, built.camera);
  }

  function setPaused(next) {
    if (next === paused) return;
    paused = next;
    if (!paused) {
      // Re-anchor the clock so the scene resumes where it left off.
      startedAt = performance.now() - elapsed * 1000;
      lastFrame = 0;
    }
  }

  function handleVisibility() {
    setPaused(document.visibilityState === 'hidden');
  }

  document.addEventListener('visibilitychange', handleVisibility);

  // A lost context (driver reset, tab backgrounded too long) would otherwise leave a
  // black rectangle behind the UI. Swallow it and let the CSS backdrop show through.
  let contextLost = false;
  function handleContextLost(event) {
    event.preventDefault();
    contextLost = true;
    setPaused(true);
  }
  canvas.addEventListener('webglcontextlost', handleContextLost);

  resize();
  rafId = requestAnimationFrame(frame);

  return {
    resize,
    setPaused,
    get contextLost() { return contextLost; },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', handleVisibility);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      built.dispose();
      composer?.dispose();
      renderer.dispose();
      // Drops the GL context immediately instead of waiting for GC, which matters
      // when switching views repeatedly.
      renderer.forceContextLoss?.();
    },
  };
}
