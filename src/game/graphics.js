import { createContext, useContext } from 'react';

/**
 * Graphics quality tiers.
 *
 * The expensive things in this app are not the game logic — they are compositing
 * features (mix-blend-mode, backdrop-filter, blur), always-running infinite
 * animations, and the per-card 3D tilt. On a machine without GPU acceleration all
 * of that falls to CPU software rasterization and the frame rate collapses.
 *
 * Quality is applied in two places:
 *   1. `data-quality` on <html>, which App.css uses to switch off effects wholesale.
 *   2. This context, for effects that live in JS rather than CSS (tilt handlers,
 *      holo layers, particle elements) and are better not mounted at all.
 */

export const QUALITY_LEVELS = ['low', 'medium', 'high'];

export const QUALITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const QUALITY_DESCRIPTIONS = {
  low: 'Flat colours, no animation or glow. For older or school laptops.',
  medium: 'Card effects on, ambient background animation off.',
  high: 'Everything on, as designed.',
};

/**
 * Per-tier feature gates. Components ask `features.holoTilt` rather than
 * comparing level strings, so adding a tier later does not mean hunting through
 * components for `=== 'low'` checks.
 */
export const QUALITY_FEATURES = Object.freeze({
  low: Object.freeze({
    holoTilt: false,       // per-pointer-move rAF writing 5 CSS vars per card
    holoLayers: false,     // foil / glare / sparkle overlays
    gradientCardBg: false, // 7 stacked radial-gradients per card → flat colour
    tagVfx: false,         // always-animating tag treatments
    runeParticles: false,  // 6 animated glyphs on the active nav tab
    tierOverlay: false,
    // A WebGL backdrop is the single most expensive thing the app can do. This flag
    // gates the dynamic import too, so `low` never downloads three.js at all — a
    // machine detected as software-rendering pays exactly zero bytes for it.
    scene3d: false,
    sceneResolution: 0,
  }),
  medium: Object.freeze({
    holoTilt: true,
    holoLayers: true,
    gradientCardBg: true,
    tagVfx: true,
    runeParticles: false,
    tierOverlay: true,
    scene3d: false,
    sceneResolution: 0,
  }),
  high: Object.freeze({
    holoTilt: true,
    holoLayers: true,
    gradientCardBg: true,
    tagVfx: true,
    runeParticles: true,
    tierOverlay: true,
    scene3d: true,
    // Full CSS-pixel resolution. The backdrop is presented unblurred, so the scene is
    // read directly — there is no blur left to hide resampling, and anything below 1
    // reads as a soft, aliased image rather than a stylised low-poly one.
    //
    // The cost this gives up is real (~8x the pixels of the old 0.35 blurred pass), so
    // it is bought back elsewhere: 30fps cap, no shadows, no post-processing, no
    // textures, and a device-pixel-ratio cap in backdrop.js.
    sceneResolution: 1,
  }),
});

/**
 * Detect whether the browser is compositing in software. This is the case the
 * auto-detect most needs to catch: managed/school Chrome installs frequently ship
 * with hardware acceleration disabled by policy, which no amount of CPU-core or
 * memory sniffing reveals. Such a machine can look fast on paper and still render
 * blend modes and blurs at single-digit frame rates.
 */
function isSoftwareRenderer() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    // No WebGL at all usually means no GPU compositing path either.
    if (!gl) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (!info) return false;
    const renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '');
    return /swiftshader|software|llvmpipe|basic render|microsoft basic/i.test(renderer);
  } catch {
    return false;
  }
}

/**
 * Pick a starting quality for a machine we know nothing about. Deliberately
 * cautious: landing on medium when high was possible costs some sparkle, while
 * landing on high when the machine cannot cope makes the game feel broken.
 */
export function detectQuality() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'high';

  // An explicit accessibility preference outranks any hardware guess.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return 'low';

  if (isSoftwareRenderer()) return 'low';

  // navigator.deviceMemory is Chrome-only and reports GiB rounded to a power of
  // two; absent elsewhere, hence the null checks rather than defaults.
  const memory = navigator.deviceMemory ?? null;
  const cores = navigator.hardwareConcurrency ?? null;

  if ((memory !== null && memory <= 2) || (cores !== null && cores <= 2)) return 'low';
  if ((memory !== null && memory <= 4) || (cores !== null && cores <= 4)) return 'medium';
  return 'high';
}

export function normalizeGraphicsSettings(saved) {
  const quality = saved?.quality;
  return {
    // `autoDetected` records that we guessed rather than the player choosing, so a
    // future run can re-guess while an explicit choice is always respected.
    quality: QUALITY_LEVELS.includes(quality) ? quality : null,
    autoDetected: saved?.autoDetected !== false,
  };
}

export const DEFAULT_GRAPHICS_SETTINGS = Object.freeze({
  quality: null,
  autoDetected: true,
});

export function resolveQuality(settings) {
  return QUALITY_LEVELS.includes(settings?.quality) ? settings.quality : detectQuality();
}

export const GraphicsContext = createContext(QUALITY_FEATURES.high);

export function useGraphicsFeatures() {
  return useContext(GraphicsContext);
}
