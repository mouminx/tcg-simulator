/**
 * Wilderness backdrop — a stylised conifer forest running a day/night cycle.
 *
 * Composed against a warm painterly low-poly reference. What carries the look, in order
 * of impact:
 *
 *   1. **Fog coloured to match the sky.** Distant trees dissolve into the same haze the
 *      sky is made of. It is free, and it does more for depth than any geometry. The fog
 *      colour is driven by the cycle, so the atmosphere recolours through the day.
 *   2. **Conifer silhouettes, densely layered.** Stacked cones read instantly as spruce.
 *      260 trees in 4 instanced draw calls.
 *   3. **A low key light**, so canopies are backlit rather than evenly shaded.
 *   4. **Hue variety** across foliage, grass and bushes via per-instance colour.
 *   5. **Bloom**, requested from the runtime through the `bloom` field returned below.
 *
 * Geometry is low-poly; shading is smooth. Low-poly is the silhouette, not the surface —
 * rocks are the exception and stay flat-shaded, because faceting reads correctly on rock.
 *
 * `THREE` is passed in rather than imported so this module carries no static three
 * dependency — see backdrop.js for why that matters for code splitting.
 */

// Deterministic, so the forest does not reshuffle on every navigation.
function makeRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * A full day in ten minutes, anchored to the wall clock rather than to mount time. That
 * way navigating away and back resumes the same time of day instead of restarting at dawn.
 */
const CYCLE_MS = 10 * 60 * 1000;

/**
 * Cycle keyframes. `at` is the normalised time of day: 0 dawn, 0.25 noon, 0.5 dusk,
 * 0.75 midnight. Everything between is linearly interpolated by `sampleCycle`.
 *
 * `fogDensity` stays inside 0.002–0.004 deliberately. FogExp2's factor is
 * 1 - exp(-(density * distance)^2), which ramps far faster than it looks — an earlier
 * pass used 0.0125 and erased the entire treeline.
 *
 * These came down by about a third when the camera became orthographic. FogExp2 measures
 * absolute distance from the camera, and an ortho rig stands ~150 units off its target
 * where the old perspective camera stood inside the scene — so the same density that gave a
 * pleasant haze before fogged the *whole* frame to a flat lavender grey.
 */
const CYCLE_KEYS = [
  {
    at: 0,
    zenith: 0x6d6796, high: 0xdb8f92, mid: 0xf7b394, horizon: 0xffe6bc,
    fog: 0xf0b394, fogDensity: 0.0034,
    sun: 0xffd09a, sunIntensity: 1.9,
    hemiSky: 0xffd9b0, hemiGround: 0x4a5a30, hemiIntensity: 1.0,
    halo: 0.72, stars: 0.12, moon: 0.0,
  },
  {
    at: 0.25,
    zenith: 0x3f7ec4, high: 0x77b0dc, mid: 0xb8d6e8, horizon: 0xe8f0ec,
    fog: 0xd3e2e6, fogDensity: 0.0022,
    sun: 0xfff6e2, sunIntensity: 2.5,
    hemiSky: 0xdcefff, hemiGround: 0x5c7038, hemiIntensity: 1.25,
    halo: 0.34, stars: 0.0, moon: 0.0,
  },
  {
    at: 0.5,
    zenith: 0x4a3560, high: 0xc4626a, mid: 0xf08a4c, horizon: 0xffc978,
    fog: 0xdd9468, fogDensity: 0.0036,
    sun: 0xff9d52, sunIntensity: 1.7,
    hemiSky: 0xffc396, hemiGround: 0x40361f, hemiIntensity: 0.85,
    halo: 0.85, stars: 0.2, moon: 0.15,
  },
  {
    at: 0.75,
    zenith: 0x080d20, high: 0x121a38, mid: 0x1d2748, horizon: 0x2c3358,
    fog: 0x1b2340, fogDensity: 0.0038,
    sun: 0x9fb6e8, sunIntensity: 0.42,
    hemiSky: 0x3a4a78, hemiGround: 0x131a20, hemiIntensity: 0.36,
    halo: 0.2, stars: 1.0, moon: 1.0,
  },
];

const SKY_VERT = `
  varying float vH;
  void main() {
    vH = normalize(position).y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Four-stop sky. The horizon band is pushed brightest so it blooms behind the treeline.
const SKY_FRAG = `
  uniform vec3 uZenith;
  uniform vec3 uHigh;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  varying float vH;
  void main() {
    float h = clamp(vH * 0.5 + 0.5, 0.0, 1.0);
    vec3 c = mix(uHorizon, uMid, smoothstep(0.42, 0.56, h));
    c = mix(c, uHigh, smoothstep(0.52, 0.72, h));
    c = mix(c, uZenith, smoothstep(0.70, 1.0, h));
    gl_FragColor = vec4(c, 1.0);
  }
`;

/** Soft additive disc, used for the sun core, its scattering halo, and the moon. */
function makeGlowTexture(THREE, innerAlpha = 1) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(255,255,255,${innerAlpha})`);
  g.addColorStop(0.25, 'rgba(255,244,220,0.45)');
  g.addColorStop(0.6, 'rgba(255,214,170,0.12)');
  g.addColorStop(1, 'rgba(255,200,160,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/**
 * A Lambert material whose vertices sway in the wind.
 *
 * Done in the vertex shader rather than by rewriting instance matrices each frame: with
 * ~1600 grass blades, per-frame matrix composition on the CPU would cost more than the
 * entire rest of the scene. Here the whole field animates from a single uniform update.
 *
 * Bend is proportional to normalised height squared, so the base stays planted and the
 * tip travels furthest — which is what makes it read as grass rather than a sliding mesh.
 * Geometry must be translated so its base sits at y = 0 for that normalisation to hold.
 */
function makeWindMaterial(THREE, { color, strength, modelHeight, flatShading = false }) {
  const uniforms = {
    uTime: { value: 0 },
    uWindStrength: { value: strength },
    uModelHeight: { value: modelHeight },
  };

  const material = new THREE.MeshLambertMaterial({ color, flatShading });
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;
    shader.uniforms.uModelHeight = uniforms.uModelHeight;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uWindStrength;
         uniform float uModelHeight;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         {
           #ifdef USE_INSTANCING
             vec3 iOrigin = instanceMatrix[3].xyz;
           #else
             vec3 iOrigin = vec3(0.0);
           #endif
           float bend = clamp(position.y / uModelHeight, 0.0, 1.0);
           bend *= bend;
           // Phase varies with world position so gusts travel across the field instead
           // of every blade moving in lockstep. Two offset waves keep it from looking
           // like a single sine.
           float phase = iOrigin.x * 0.14 + iOrigin.z * 0.09;
           float sway = sin(uTime * 1.5 + phase) + 0.45 * sin(uTime * 2.9 + phase * 1.7);
           transformed.x += sway * uWindStrength * bend;
           transformed.z += cos(uTime * 1.1 + phase * 0.8) * uWindStrength * 0.45 * bend;
         }`,
      );
  };
  // Keeps this patched program from being shared with unpatched Lambert materials.
  material.customProgramCacheKey = () => 'wilderness-wind';

  return { material, uniforms };
}

/**
 * Ground footprint every scatter is distributed over.
 *
 * This has to be a RECTANGLE, and that is a direct consequence of the orthographic camera.
 * The scene previously placed everything in a wedge — `spread = 130 + depth * 330` for trees,
 * and similar for grass, bushes and rocks — because a perspective frustum widens with depth,
 * so a wedge is exactly what fills the frame and nothing is wasted off-screen.
 *
 * An orthographic frustum is a box. That same wedge renders as a triangular clearing with
 * bare ground at the near corners: the forest visibly tapers toward the viewer, which reads
 * as a bug rather than as depth. So the distribution follows the projection.
 *
 * Sized to cover the view box with margin for tall trees leaning into frame.
 */
const AREA_X = 150;
const AREA_Z_NEAR = 70;
const AREA_Z_FAR = -180;
const AREA_Z_SPAN = AREA_Z_NEAR - AREA_Z_FAR;

/** 0 at the near edge of the footprint, 1 at the far edge — drives haze and thinning. */
function depthAt(z) {
  return Math.min(1, Math.max(0, (AREA_Z_NEAR - z) / AREA_Z_SPAN));
}

export function buildWildernessScene(THREE) {
  const rng = makeRng(20250806);
  const scene = new THREE.Scene();
  const disposables = [];
  const track = obj => { disposables.push(obj); return obj; };

  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const axisY = new THREE.Vector3(0, 1, 0);
  const axis = new THREE.Vector3();
  const posV = new THREE.Vector3();
  const scaleV = new THREE.Vector3();
  const tint = new THREE.Color();

  // ── Atmosphere ────────────────────────────────────────────────────────────
  scene.fog = new THREE.FogExp2(CYCLE_KEYS[0].fog, CYCLE_KEYS[0].fogDensity);

  const skyUniforms = {
    uZenith: { value: new THREE.Color(CYCLE_KEYS[0].zenith) },
    uHigh: { value: new THREE.Color(CYCLE_KEYS[0].high) },
    uMid: { value: new THREE.Color(CYCLE_KEYS[0].mid) },
    uHorizon: { value: new THREE.Color(CYCLE_KEYS[0].horizon) },
  };
  const skyGeo = track(new THREE.SphereGeometry(600, 24, 16));
  const skyMat = track(new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  }));
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // ── Stars ─────────────────────────────────────────────────────────────────
  // One draw call, faded in by the cycle. Cheap, and it is what makes night read as
  // night rather than as an underexposed day.
  const STAR_COUNT = 420;
  const starGeo = track(new THREE.BufferGeometry());
  {
    const p = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i += 1) {
      // Upper hemisphere only — stars below the treeline would read as fireflies.
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(rng() * 0.9 + 0.08);
      const r = 480;
      p[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      p[i * 3 + 1] = Math.cos(phi) * r;
      p[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  const starMat = track(new THREE.PointsMaterial({
    map: track(makeGlowTexture(THREE, 1)),
    color: 0xdce6ff,
    size: 3.4,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  }));
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ── Luminaries ────────────────────────────────────────────────────────────
  // Sun and moon ride opposite ends of the same arc; each fades out below the horizon.
  const ARC_RADIUS = 210;
  const ARC_HEIGHT = 150;
  const ARC_DEPTH = -250;

  const sunCoreMat = track(new THREE.SpriteMaterial({
    map: track(makeGlowTexture(THREE, 1)),
    color: 0xfff4d6,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }));
  const sunCore = new THREE.Sprite(sunCoreMat);
  sunCore.scale.setScalar(120);
  scene.add(sunCore);

  const haloMat = track(new THREE.SpriteMaterial({
    map: track(makeGlowTexture(THREE, 0.5)),
    color: 0xffc79a,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }));
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(430);
  scene.add(halo);

  const moonMat = track(new THREE.SpriteMaterial({
    map: track(makeGlowTexture(THREE, 1)),
    color: 0xdfe8ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  }));
  const moon = new THREE.Sprite(moonMat);
  moon.scale.setScalar(74);
  scene.add(moon);

  // ── Ground ────────────────────────────────────────────────────────────────
  const groundGeo = track(new THREE.PlaneGeometry(900, 620, 60, 44));
  groundGeo.rotateX(-Math.PI / 2);
  {
    const pos = groundGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    // Darker than the perspective version by roughly a quarter. Looking down at 52 degrees
    // puts far more ground in frame than looking along it did, so the same tones took the
    // backdrop from a mean luminance of ~45 to ~80 behind the UI panels — bright enough to
    // fight the text sitting on top of it.
    const lit = new THREE.Color(0x8b9749);
    const mid = new THREE.Color(0x52692f);
    const shade = new THREE.Color(0x293a1f);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h =
        Math.sin(x * 0.021) * 3.4 +
        Math.cos(z * 0.027) * 2.6 +
        Math.sin((x + z) * 0.012) * 2.0;
      pos.setY(i, h);
      const t = Math.min(1, Math.max(0, (h + 6) / 12));
      if (t < 0.5) c.copy(shade).lerp(mid, t * 2);
      else c.copy(mid).lerp(lit, (t - 0.5) * 2);
      c.offsetHSL(0, (rng() - 0.5) * 0.06, (rng() - 0.5) * 0.05);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groundGeo.computeVertexNormals();
  }
  scene.add(new THREE.Mesh(
    groundGeo,
    track(new THREE.MeshLambertMaterial({ vertexColors: true })),
  ));

  // ── Conifers ──────────────────────────────────────────────────────────────
  // One transform set applied to four InstancedMeshes (trunk + three cone tiers), each
  // tier's vertical offset baked into its matrix. 260 trees, 4 draw calls.
  // Thinned from 260: from above, a canopy dense enough to look good edge-on hides the
  // forest floor entirely, and the ground is half the point of a bird's-eye view.
  const TREE_COUNT = 185;
  const trunkGeo = track(new THREE.CylinderGeometry(0.5, 0.9, 8, 5));
  const tierGeos = [
    track(new THREE.ConeGeometry(5.2, 9, 7)),
    track(new THREE.ConeGeometry(4.0, 8, 7)),
    track(new THREE.ConeGeometry(2.6, 7, 7)),
  ];
  const TIER_Y = [8.5, 13.5, 18.0];

  const foliageMat = track(new THREE.MeshLambertMaterial());
  const trunkMat = track(new THREE.MeshLambertMaterial({ color: 0x50351f }));
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREE_COUNT);
  const tiers = tierGeos.map(g => new THREE.InstancedMesh(g, foliageMat, TREE_COUNT));
  [trunks, ...tiers].forEach(m => { m.frustumCulled = false; scene.add(m); });

  const FOLIAGE = [0x2f4a2c, 0x3c5f30, 0x537a35, 0x77963c, 0x9aa844, 0xb08a3a]
    .map(hex => new THREE.Color(hex));
  const tierTint = new THREE.Color();

  for (let i = 0; i < TREE_COUNT; i += 1) {
    const z = AREA_Z_NEAR - rng() * AREA_Z_SPAN;
    const x = (rng() - 0.5) * 2 * AREA_X;
    const depth = depthAt(z);
    const scale = 0.75 + rng() * 1.5 - depth * 0.15;
    quat.setFromAxisAngle(axisY, rng() * Math.PI * 2);

    // Only a light haze lerp is baked in. The heavy lifting is left to the fog, whose
    // colour follows the cycle — baking in a warm dawn tint would look wrong at night.
    tint.copy(FOLIAGE[Math.floor(rng() * FOLIAGE.length)]);
    tint.offsetHSL(0, -depth * 0.12, depth * 0.06);

    posV.set(x, 4 * scale, z);
    scaleV.set(scale, scale, scale);
    m4.compose(posV, quat, scaleV);
    trunks.setMatrixAt(i, m4);
    tierTint.copy(tint).multiplyScalar(0.55);
    trunks.setColorAt(i, tierTint);

    for (let t = 0; t < 3; t += 1) {
      posV.set(x, TIER_Y[t] * scale, z);
      scaleV.set(
        scale * (0.9 + rng() * 0.25),
        scale * (0.9 + rng() * 0.3),
        scale * (0.9 + rng() * 0.25),
      );
      m4.compose(posV, quat, scaleV);
      tiers[t].setMatrixAt(i, m4);
      tierTint.copy(tint).multiplyScalar(0.82 + t * 0.12);
      tiers[t].setColorAt(i, tierTint);
    }
  }
  [trunks, ...tiers].forEach(m => {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  // ── Tall grass ────────────────────────────────────────────────────────────
  // Squat tufts, not blades. A 0.22-radius 9-unit cone reads correctly from a camera standing
  // in the field, but from an angled bird's-eye view 1600 of them are thin vertical scratches
  // scattered over the ground — the single worst artefact of the projection change. Wider and
  // shorter reads as a clump of growth from above.
  //
  // Translated so the base sits at y = 0, which the wind shader's height normalisation
  // depends on.
  const GRASS_COUNT = 1200;
  const BLADE_H = 4.5;
  const bladeGeo = track(new THREE.ConeGeometry(0.85, BLADE_H, 5));
  bladeGeo.translate(0, BLADE_H / 2, 0);

  const grassWind = makeWindMaterial(THREE, {
    // Less sway than a tall blade would have — a tuft bends, it does not whip.
    strength: 0.7,
    modelHeight: BLADE_H,
  });
  track(grassWind.material);

  const grass = new THREE.InstancedMesh(bladeGeo, grassWind.material, GRASS_COUNT);
  grass.frustumCulled = false;
  const GRASS_HUES = [0x86a83e, 0xa4bd48, 0x6c8c34, 0xc0c454, 0x769a3a]
    .map(h => new THREE.Color(h));
  for (let i = 0; i < GRASS_COUNT; i += 1) {
    // Slightly denser toward the near edge so the field is not a perfectly uniform carpet,
    // but spread across the whole rectangle rather than a wedge.
    const z = AREA_Z_NEAR - Math.pow(rng(), 0.85) * AREA_Z_SPAN;
    const depth = depthAt(z);
    const s = 0.7 + rng() * 1.5;
    quat.setFromAxisAngle(axisY, rng() * Math.PI * 2);
    posV.set((rng() - 0.5) * 2 * AREA_X, 0, z);
    scaleV.set(s * (0.85 + rng() * 0.5), s * (0.6 + rng() * 0.7), s * (0.85 + rng() * 0.5));
    m4.compose(posV, quat, scaleV);
    grass.setMatrixAt(i, m4);
    grass.setColorAt(i, GRASS_HUES[Math.floor(rng() * GRASS_HUES.length)]);
  }
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  scene.add(grass);

  // ── Bushes ────────────────────────────────────────────────────────────────
  // Squashed icosahedra. They share the wind shader at a much lower strength, so they
  // rustle rather than sway.
  const BUSH_COUNT = 110;
  const BUSH_H = 5;
  const bushGeo = track(new THREE.IcosahedronGeometry(2.5, 1));
  bushGeo.translate(0, BUSH_H / 2, 0);

  const bushWind = makeWindMaterial(THREE, {
    strength: 0.32,
    modelHeight: BUSH_H,
  });
  track(bushWind.material);

  const bushes = new THREE.InstancedMesh(bushGeo, bushWind.material, BUSH_COUNT);
  bushes.frustumCulled = false;
  const BUSH_HUES = [0x3e6b2f, 0x4e7d36, 0x5f8b3c, 0x6f7a2e, 0x87732c]
    .map(h => new THREE.Color(h));
  for (let i = 0; i < BUSH_COUNT; i += 1) {
    const z = AREA_Z_NEAR - rng() * AREA_Z_SPAN;
    const depth = depthAt(z);
    const s = 0.65 + rng() * 1.5;
    quat.setFromAxisAngle(axisY, rng() * Math.PI * 2);
    posV.set((rng() - 0.5) * 2 * AREA_X, 0, z);
    // Wider than tall, so they read as bushes rather than small trees.
    scaleV.set(s * (1.1 + rng() * 0.5), s * (0.6 + rng() * 0.4), s * (1.1 + rng() * 0.5));
    m4.compose(posV, quat, scaleV);
    bushes.setMatrixAt(i, m4);
    bushes.setColorAt(i, BUSH_HUES[Math.floor(rng() * BUSH_HUES.length)]);
  }
  bushes.instanceMatrix.needsUpdate = true;
  if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true;
  scene.add(bushes);

  // ── Rocks ─────────────────────────────────────────────────────────────────
  // Scattered across the whole ground rather than clustered on one side, and sunk
  // slightly so they sit in the earth instead of resting on it. Flat-shaded — rock is
  // the one surface where faceting reads correctly.
  const ROCK_COUNT = 70;
  const rockGeo = track(new THREE.IcosahedronGeometry(3.4, 0));
  const rockMat = track(new THREE.MeshLambertMaterial({ flatShading: true }));
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, ROCK_COUNT);
  rocks.frustumCulled = false;
  const ROCK_HUES = [0x6f6a5e, 0x7d766a, 0x5d5850, 0x8a8175, 0x66604f]
    .map(h => new THREE.Color(h));
  for (let i = 0; i < ROCK_COUNT; i += 1) {
    const z = AREA_Z_NEAR - rng() * AREA_Z_SPAN;
    const depth = depthAt(z);
    const s = 0.35 + rng() * 1.9;
    axis.set(rng(), rng(), rng()).normalize();
    quat.setFromAxisAngle(axis, rng() * Math.PI);
    posV.set(
      (rng() - 0.5) * 2 * AREA_X,
      // Partially buried; larger rocks sink less.
      s * (0.35 + rng() * 0.4),
      z,
    );
    scaleV.set(s * (1 + rng() * 0.5), s * (0.6 + rng() * 0.5), s * (1 + rng() * 0.4));
    m4.compose(posV, quat, scaleV);
    rocks.setMatrixAt(i, m4);
    rocks.setColorAt(i, ROCK_HUES[Math.floor(rng() * ROCK_HUES.length)]);
  }
  rocks.instanceMatrix.needsUpdate = true;
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
  scene.add(rocks);

  // ── Light ─────────────────────────────────────────────────────────────────
  const hemi = new THREE.HemisphereLight(
    CYCLE_KEYS[0].hemiSky, CYCLE_KEYS[0].hemiGround, CYCLE_KEYS[0].hemiIntensity,
  );
  scene.add(hemi);
  const key = new THREE.DirectionalLight(CYCLE_KEYS[0].sun, CYCLE_KEYS[0].sunIntensity);
  scene.add(key);
  // Constant cool fill so shadow sides never go fully black, including at night.
  const fill = new THREE.DirectionalLight(0x9fb6d8, 0.34);
  fill.position.set(90, 40, 80);
  scene.add(fill);

  // ── Camera ────────────────────────────────────────────────────────────────
  // Orthographic, angled down over the treeline. The forest is distributed over a rectangle
  // (see AREA_X / AREA_Z_*) to match this box frustum.
  const VIEW_HEIGHT = 116;
  const CAM_TARGET = new THREE.Vector3(0, 6, -46);
  // ~52 degrees elevation, ~26 degrees round. At the 38 degrees this started at you look
  // *through* the rows rather than down at them: the canopy occluded the ground completely and
  // the result read as a flat side-on wall of trees, not a bird's-eye view. The standoff is
  // 150 rather than 210 because FogExp2 goes by absolute camera distance, and in an
  // orthographic rig that distance is a free parameter that only fog and clipping notice.
  const CAM_OFFSET = new THREE.Vector3(0.270, 0.788, 0.554).multiplyScalar(150);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 900);
  // backdrop.js rebuilds the frustum edges from this on resize.
  camera.userData.viewHeight = VIEW_HEIGHT;
  camera.position.copy(CAM_TARGET).add(CAM_OFFSET);
  camera.lookAt(CAM_TARGET);

  // ── Cycle sampling ────────────────────────────────────────────────────────
  const cA = new THREE.Color();
  const cB = new THREE.Color();

  function lerpKey(fromKey, toKey, k, prop, out) {
    cA.set(fromKey[prop]);
    cB.set(toKey[prop]);
    return out.copy(cA).lerp(cB, k);
  }

  function num(fromKey, toKey, k, prop) {
    return fromKey[prop] + (toKey[prop] - fromKey[prop]) * k;
  }

  function applyCycle(phase) {
    // Find the bracketing keyframes, wrapping the last back to the first.
    let i = 0;
    for (let j = 0; j < CYCLE_KEYS.length; j += 1) {
      if (phase >= CYCLE_KEYS[j].at) i = j;
    }
    const from = CYCLE_KEYS[i];
    const to = CYCLE_KEYS[(i + 1) % CYCLE_KEYS.length];
    const span = (to.at > from.at ? to.at : 1) - from.at;
    const k = span > 0 ? Math.min(1, Math.max(0, (phase - from.at) / span)) : 0;

    lerpKey(from, to, k, 'zenith', skyUniforms.uZenith.value);
    lerpKey(from, to, k, 'high', skyUniforms.uHigh.value);
    lerpKey(from, to, k, 'mid', skyUniforms.uMid.value);
    lerpKey(from, to, k, 'horizon', skyUniforms.uHorizon.value);
    lerpKey(from, to, k, 'fog', scene.fog.color);
    scene.fog.density = num(from, to, k, 'fogDensity');

    lerpKey(from, to, k, 'sun', key.color);
    key.intensity = num(from, to, k, 'sunIntensity');
    lerpKey(from, to, k, 'hemiSky', hemi.color);
    lerpKey(from, to, k, 'hemiGround', hemi.groundColor);
    hemi.intensity = num(from, to, k, 'hemiIntensity');

    starMat.opacity = num(from, to, k, 'stars');
    haloMat.opacity = num(from, to, k, 'halo');
    moonMat.opacity = num(from, to, k, 'moon');

    // Sun rides the arc: due east at dawn, overhead at noon, west at dusk, below at
    // midnight. The moon takes the opposite end.
    const angle = phase * Math.PI * 2;
    const sunX = -Math.cos(angle) * ARC_RADIUS;
    const sunY = Math.sin(angle) * ARC_HEIGHT;
    sunCore.position.set(sunX, sunY, ARC_DEPTH);
    halo.position.set(sunX, sunY, ARC_DEPTH);
    moon.position.set(-sunX, -sunY, ARC_DEPTH);

    // Fade the sun disc out below the horizon rather than letting it clip through the
    // ground, and keep the key light above it so nothing is lit from underneath.
    sunCoreMat.opacity = Math.min(1, Math.max(0, sunY / 40 + 0.35));
    key.position.set(sunX, Math.max(24, sunY), ARC_DEPTH * 0.6);
  }

  return {
    scene,
    camera,
    bloom: { strength: 0.72, radius: 0.85, threshold: 0.72 },

    update(t) {
      // Wall-clock anchored, so the time of day is continuous across navigations.
      applyCycle((Date.now() % CYCLE_MS) / CYCLE_MS);

      // One uniform write animates every blade and bush.
      grassWind.uniforms.uTime.value = t;
      bushWind.uniforms.uTime.value = t;

      // Orthographic drift pans rather than parallaxes, so it stays gentle.
      const driftX = Math.sin(t * 0.04) * 6;
      const driftZ = Math.cos(t * 0.028) * 4;
      camera.position.set(
        CAM_TARGET.x + CAM_OFFSET.x + driftX,
        CAM_TARGET.y + CAM_OFFSET.y,
        CAM_TARGET.z + CAM_OFFSET.z + driftZ,
      );
      camera.lookAt(CAM_TARGET.x + driftX * 0.5, CAM_TARGET.y, CAM_TARGET.z + driftZ * 0.5);
    },

    dispose() {
      for (const d of disposables) d.dispose?.();
      scene.clear();
    },
  };
}
