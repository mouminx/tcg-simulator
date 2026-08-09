/**
 * Foundry backdrop — a worked stone mine shaft, lit by its own forge.
 *
 * A cave is defined by what is lit, not by what is there. So the priorities here are
 * almost the inverse of the wilderness scene:
 *
 *   1. **Darkness with pools of light.** Two point lights carry the whole scene: a warm
 *      forge fire near the camera and a cooler lantern deep in the shaft. Everything
 *      between them falls off into fog.
 *   2. **Dense, near-black fog.** Underground it is the only depth cue there is — there
 *      is no sky to silhouette against. It is also what makes the shaft read as
 *      *continuing* rather than ending at a wall.
 *   3. **Fire flicker.** The one thing that stops a cave looking like a still life. Sum
 *      of incommensurate sines, applied to intensity *and* to how far the light reaches.
 *   4. **Ore glinting in the walls.** The money shot for a mine: emissive crystals placed
 *      on the same surface function as the rock, so they sit *in* the wall rather than
 *      floating near it. Unlit material, so bloom catches them even in shadow.
 *   5. **Human workings** — support frames, sleepers and rails receding down the shaft.
 *      Without these it is a cave; with them it is a mine. The rails also draw the eye
 *      into the tunnel, which is what gives the composition depth.
 *
 * The tunnel is one displaced cylinder viewed from inside, not an assembly of walls. That
 * gives an irregular rock enclosure in a single draw call, and it lets ore, stalactites
 * and support frames all be positioned from the same radius function so nothing clips.
 *
 * `THREE` is passed in rather than imported so this module carries no static three
 * dependency — see backdrop.js for why that matters for code splitting.
 */

// Deterministic, so the mine does not reshuffle on every navigation.
function makeRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ── Shaft geometry ──────────────────────────────────────────────────────────
// The shaft runs along -Z. Its axis sits above the floor so the floor plane cuts a
// chord across the tube, which is what gives a cave cross-section rather than a pipe.
const AXIS_Y = 10;
const Z_NEAR = 44;
/**
 * Scattered features stop well short of Z_NEAR. The shell has to start behind the camera
 * to enclose it, but a stalactite or ore fleck at z=40 sits ~14 units from a camera at
 * z=26 and fills half the frame as an unreadable black wedge.
 */
const Z_DETAIL_NEAR = 16;
const Z_FAR = -124;
const SHAFT_LENGTH = Z_NEAR - Z_FAR;
const FLOOR_Y = 0;

/**
 * The shell is a partial arc, not a closed tube: the roof is cut away so an angled
 * bird's-eye camera can look down into the shaft. Angles follow shaftPoint, where PI/2 is
 * straight up — so the excluded band is centred there and the retained sweep runs the long
 * way round through the floor.
 *
 * At these limits the side walls still rise to y ~= 17, which keeps the support-frame
 * lintels (y ~= 15.5) enclosed. Read as a cutaway diorama, which is the point.
 */
const ARC_START = 0.889 * Math.PI;
const ARC_END = 2.111 * Math.PI;
const ARC_SEGS = 60;
const LEN_SEGS = 90;

/** Radius profile: a working chamber at the camera, narrowing as it drives deeper. */
function shaftRadius(z) {
  const k = (Z_NEAR - z) / SHAFT_LENGTH; // 0 at the near end, 1 at the far end
  return 21 - 8.5 * k;
}

/**
 * Irregularity of the rock face at a given angle and depth.
 *
 * Three incommensurate sines rather than value noise: it is a handful of flops, it never
 * repeats within the shaft, and rock has no characteristic scale to get wrong. Used by
 * the shell, the ore and the stalactites alike so they all agree on where the wall is.
 */
function wallOffset(angle, z) {
  return (
    1.00 * Math.sin(angle * 3.0 + z * 0.11)
    + 0.55 * Math.sin(angle * 5.3 - z * 0.19 + 1.3)
    + 0.30 * Math.sin(angle * 9.7 + z * 0.31 + 0.7)
    // Short wavelength (~9 units, i.e. a couple of facets) and the reason the wall reads as
    // hewn rock at all. Without a term at facet scale, flat shading had nothing to reveal:
    // neighbouring faces shared a normal and the fire-lit wall was a smooth gradient.
    + 0.26 * Math.sin(angle * 13.1 + z * 0.72 + 2.1)
  ) * 1.95;
}

/**
 * Half-width of the shaft at floor level, on the given side.
 *
 * The floor used to be a fixed 76-wide plane, which overhung the rock by a wide margin —
 * and because the shell is rendered BackSide, that apron was plainly visible outside the
 * tunnel as a large flat surface. Lit by the forge it became a smooth orange gradient
 * filling the left of the frame, which is what read as a featureless wall.
 *
 * The wall radius depends on the angle and the angle depends on the radius, so this
 * iterates twice from the undisplaced circle. Two rounds is plenty at this amplitude.
 */
function floorHalfWidth(z, side) {
  const r0 = shaftRadius(z);
  let hw = Math.sqrt(Math.max(4, r0 * r0 - AXIS_Y * AXIS_Y));
  for (let k = 0; k < 2; k += 1) {
    const r = r0 + wallOffset(Math.atan2(-AXIS_Y, side * hw), z);
    hw = Math.sqrt(Math.max(4, r * r - AXIS_Y * AXIS_Y));
  }
  return hw;
}

/**
 * The open rim of the shaft at a given depth. `side` is -1 for the left lip, +1 for the
 * right. Used to seal the surrounding rock surface flush against the cutaway.
 */
function rimPoint(z, side) {
  return shaftPoint(side < 0 ? ARC_START : ARC_END, z);
}

/** Point on the rock face. `inset` pulls a feature slightly into the stone. */
function shaftPoint(angle, z, inset = 0) {
  const r = shaftRadius(z) + wallOffset(angle, z) - inset;
  return {
    x: Math.cos(angle) * r,
    y: AXIS_Y + Math.sin(angle) * r,
    r,
  };
}

const ROCK_HUES = [0x4a4139, 0x38322c, 0x52483c, 0x2f2a25, 0x453d36];

/**
 * Ore hues. Weighted toward the metals the Foundry actually smelts, with two arcane
 * crystals for colour contrast — a wall of nothing but warm ore reads as monotone.
 */
const ORE_HUES = [
  0xe8c268, 0xe8c268, // gold
  0xd98a45, 0xd98a45, // copper
  0xc9d2da,           // silver
  0x5fc9d8,           // arcane teal
  0x9a6fd0,           // arcane violet
];

/**
 * Where the two lights sit. Module-level because the ore needs them at build time: ore is
 * lit by proximity to these, computed once, not per frame.
 */
const FIRE_POS = { x: -9.5, y: 4.4, z: 4 };
/**
 * A lamp hung on a mid-shaft support frame. Three pools of light receding into the dark
 * read as depth in a way two cannot: with only the forge and the far lantern there was a
 * large unlit gap between them, and unlit rock renders as absence rather than as distance.
 */
const MIDLAMP_POS = { x: -6.5, y: 13, z: -28 };
const LANTERN_POS = { x: 4, y: AXIS_Y + 2, z: -62 };
const LAMPS = [FIRE_POS, MIDLAMP_POS, LANTERN_POS];

/**
 * How strongly a point is lit by the nearest lamp, 0..1.
 *
 * Ore is drawn with an unlit material so it survives the darkness, but applying that
 * uniformly made every fleck equally bright regardless of where it sat — the result read
 * as confetti hanging in mid-air rather than as metal in rock, because a bright speck in
 * front of black rock has nothing to belong to. Baking proximity into the instance colour
 * restores the cue: ore glints where light reaches it and goes dark where it does not.
 */
function lightReach(x, y, z) {
  let best = 0;
  for (const L of LAMPS) {
    const d = Math.hypot(x - L.x, y - L.y, z - L.z);
    best = Math.max(best, Math.max(0, 1 - d / 46));
  }
  return best ** 0.75;
}

const FOG_COLOR = 0x4b3623;
/**
 * Linear fog, not FogExp2, and this is a direct consequence of the orthographic camera.
 *
 * FogExp2 attenuates by absolute distance from the camera. An orthographic rig sits ~110
 * units back from its target, so *every* surface was 90-190 units away and the whole frame
 * fogged uniformly at ~90% — a flat brown veil with no depth information in it at all. The
 * old density of 0.0108 was tuned for a camera standing inside the tunnel, where near rock
 * was genuinely a few units away.
 *
 * Ranged fog puts the falloff where the scene actually is: nothing before FOG_NEAR is
 * touched, and the far end of the shaft dissolves by FOG_FAR.
 *
 * FOG_COLOR stays a warm dusty brown. Fog covers most of an enclosed frame, so its colour
 * effectively *is* the scene's mid-tone; at the near-black it started as, everything past the
 * lamps collapsed and no amount of light could lift it, because fog is applied after lighting.
 */
const FOG_NEAR = 96;
const FOG_FAR = 230;

/** Soft additive disc for dust motes and the fire's glow sprite. */
function makeGlowTexture(THREE, inner = 'rgba(255,255,255,1)') {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, 'rgba(255,226,180,0.34)');
  g.addColorStop(1, 'rgba(255,190,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function buildCavernScene(THREE) {
  const rng = makeRng(19770412);
  const scene = new THREE.Scene();
  const disposables = [];
  const track = obj => { disposables.push(obj); return obj; };

  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const posV = new THREE.Vector3();
  const scaleV = new THREE.Vector3();
  const eulerQ = new THREE.Euler();

  scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);
  scene.background = new THREE.Color(FOG_COLOR);

  // ── Shaft shell ───────────────────────────────────────────────────────────
  // Built directly from shaftPoint over an (angle, z) grid rather than displacing a
  // CylinderGeometry. A cylinder cannot omit the roof without fighting its theta winding,
  // and building the grid myself means the ore, the stalactites and the floor all sample the
  // exact same surface function that the wall does.
  const shellGeo = track(new THREE.BufferGeometry());
  {
    const cols = ARC_SEGS + 1;
    const rows = LEN_SEGS + 1;
    const pos = new Float32Array(cols * rows * 3);
    const colors = new Float32Array(cols * rows * 3);
    const index = [];

    for (let r = 0; r < rows; r += 1) {
      const z = Z_NEAR - (r / LEN_SEGS) * SHAFT_LENGTH;
      for (let c = 0; c < cols; c += 1) {
        const angle = ARC_START + (c / ARC_SEGS) * (ARC_END - ARC_START);
        const pt = shaftPoint(angle, z);
        const i = (r * cols + c) * 3;
        pos[i] = pt.x;
        pos[i + 1] = pt.y;
        pos[i + 2] = z;

        // Patchy stone. A single mesh cannot use instanceColor, so the hue variety the rest
        // of the scene gets per instance is painted into the vertices here instead —
        // otherwise 170 units of wall is one flat tone and the eye reads it as a backdrop.
        //
        // These are MULTIPLIERS centred on 1.0, not colours. An earlier version sampled
        // ROCK_HUES and divided by hardcoded constants; because three converts colours to
        // linear space those components came out near 0.03-0.08 rather than the ~0.28 the
        // divisors assumed, so darker patches multiplied the wall down by ~10x. That, not
        // the light level, was why the rock rendered black.
        const n = Math.sin(pt.x * 0.13 + z * 0.075) * Math.sin(pt.y * 0.21 - z * 0.041);
        const v = 1 + 0.26 * n;
        const warm = 0.05 * Math.sin(pt.x * 0.07 - z * 0.03);
        colors[i] = v * (1 + warm);
        colors[i + 1] = v;
        colors[i + 2] = v * (1 - warm);
      }
    }

    for (let r = 0; r < LEN_SEGS; r += 1) {
      for (let c = 0; c < ARC_SEGS; c += 1) {
        const a = r * cols + c;
        const b = a + 1;
        const d = a + cols;
        const e = d + 1;
        index.push(a, d, b, b, d, e);
      }
    }

    shellGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    shellGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    shellGeo.setIndex(index);
    shellGeo.computeVertexNormals();
  }
  const shellMat = track(new THREE.MeshLambertMaterial({
    color: 0x4a4239,
    vertexColors: true,
    // DoubleSide rather than BackSide: with a hand-wound open arc, which face points inward
    // depends on index order, and the open roof means the far wall's outside is on screen too.
    side: THREE.DoubleSide,
    // Flat-shaded, unlike the wilderness canopy — this is the rock exception the forest
    // already makes for its boulders, and here it is doing the most work of any single
    // setting. Smooth-shaded, the fire-lit wall was one continuous orange gradient with no
    // surface at all. Faceted, every plane takes the firelight at its own angle and the
    // wall reads as hewn stone.
    flatShading: true,
  }));
  scene.add(new THREE.Mesh(shellGeo, shellMat));

  // ── Floor ─────────────────────────────────────────────────────────────────
  // A separate plane rather than flattening the shell's underside: clamping vertices
  // wrecks the normals, and a plane wider than the tube hides everything below it.
  // Unit width, widened per-vertex to the local shaft width below.
  const floorGeo = track(new THREE.PlaneGeometry(2, SHAFT_LENGTH + 12, 30, 90));
  floorGeo.rotateX(-Math.PI / 2);
  {
    const pos = floorGeo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const zLocal = pos.getZ(i);
      // Plane is centred on the origin; convert to world z to sample the shaft profile.
      const zWorld = zLocal + (Z_NEAR + Z_FAR) / 2;
      const side = pos.getX(i) < 0 ? -1 : 1;
      // +2.5 of overlap so the floor tucks under the rock instead of leaving a seam at
      // the join, which would show the tunnel's underside through the gap.
      const x = pos.getX(i) * (floorHalfWidth(zWorld, side) + 2.5);
      pos.setX(i, x);
      const z = zWorld;
      // Kept shallow — a mine floor is worked flat, and bumps here would make the
      // sleepers and rails visibly float.
      const h = 0.34 * Math.sin(x * 0.21 + z * 0.13) + 0.22 * Math.sin(x * 0.53 - z * 0.29);
      pos.setY(i, h);
    }
    pos.needsUpdate = true;
    floorGeo.computeVertexNormals();
  }
  const floorMat = track(new THREE.MeshLambertMaterial({ color: 0x332e28 }));
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, FLOOR_Y, (Z_NEAR + Z_FAR) / 2);
  scene.add(floor);

  // ── Surrounding rock surface ──────────────────────────────────────────────
  // Two strips running out from the shaft's open lips. Without them the cutaway floats in
  // haze with flat fog filling the corners of the frame; with them the same geometry reads as
  // a trench driven into solid rock, which is what a mine is. Built from rimPoint so they
  // meet the wall exactly along its whole tapering length.
  const SURFACE_OUT = 95;
  /**
   * Columns across the strip. This number is not free: the strip reuses LEN_SEGS rows so its
   * inner edge matches the shell rim exactly, which puts rows ~1.9 units apart. At 7 columns
   * the facets were 1.9 x 13.6 — long thin ribbons that flat shading turned into a corduroy
   * texture reading as rope or fur. 50 columns makes them square, which is what the faceted
   * look needs. The extra ~18k triangles are irrelevant on a 30fps backdrop; keeping the rim
   * exact matters far more, since a coarser strip cuts corners against the wall's wiggle and
   * leaves notches along the lip.
   */
  const SURFACE_SEGS = 50;
  const surfaceGeo = track(new THREE.BufferGeometry());
  {
    const rows = LEN_SEGS + 1;
    const cols = SURFACE_SEGS + 1;
    const perSide = rows * cols;
    const pos = new Float32Array(perSide * 2 * 3);
    const colors = new Float32Array(perSide * 2 * 3);
    const index = [];

    for (let sideIdx = 0; sideIdx < 2; sideIdx += 1) {
      const side = sideIdx === 0 ? -1 : 1;
      const base = sideIdx * perSide;
      for (let r = 0; r < rows; r += 1) {
        const z = Z_NEAR - (r / LEN_SEGS) * SHAFT_LENGTH;
        const rim = rimPoint(z, side);
        for (let c = 0; c < cols; c += 1) {
          const k = c / SURFACE_SEGS;
          const x = rim.x + side * SURFACE_OUT * k;
          // Rises away from the lip and undulates in both axes, so the flat shading has
          // something to catch.
          const y = rim.y
            + 4.5 * k
            + 2.6 * Math.sin(z * 0.058 + sideIdx * 1.7) * k
            + 1.5 * Math.sin(x * 0.075 + z * 0.041)
            + 0.7 * Math.sin(x * 0.163 - z * 0.107);
          const i = (base + r * cols + c) * 3;
          pos[i] = x;
          pos[i + 1] = y;
          pos[i + 2] = z;
          const n = Math.sin(x * 0.1 + z * 0.06) * Math.sin(x * 0.037 - z * 0.021);
          const v = 1 + 0.24 * n;
          colors[i] = v * 1.02;
          colors[i + 1] = v;
          colors[i + 2] = v * 0.96;
        }
      }
      for (let r = 0; r < LEN_SEGS; r += 1) {
        for (let c = 0; c < SURFACE_SEGS; c += 1) {
          const a = base + r * cols + c;
          const bb = a + 1;
          const d = a + cols;
          const e = d + 1;
          index.push(a, d, bb, bb, d, e);
        }
      }
    }

    surfaceGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    surfaceGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    surfaceGeo.setIndex(index);
    surfaceGeo.computeVertexNormals();

    // These strips face the open sky, and the hemisphere light is what gives them their tone.
    // Whether hand-wound triangles come out facing up or down is easy to get backwards, and
    // the material is DoubleSide so the mistake is invisible except as rock that renders far
    // too dark — it takes the hemisphere's *ground* colour instead of its sky colour. Flip
    // them if the winding went the wrong way rather than relying on getting it right.
    const nrm = surfaceGeo.attributes.normal;
    let ySum = 0;
    for (let i = 0; i < nrm.count; i += 1) ySum += nrm.getY(i);
    if (ySum < 0) {
      for (let i = 0; i < nrm.count; i += 1) {
        nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
      }
      nrm.needsUpdate = true;
    }
  }

  // Same stone material as the shaft wall, so the cutaway reads as one rock mass.
  scene.add(new THREE.Mesh(surfaceGeo, shellMat));

  // ── Stalactites and stalagmites ───────────────────────────────────────────
  // Positioned from shaftPoint so they meet the rock rather than hovering in front of it.
  const SPIKE_COUNT = 52;
  const spikeGeo = track(new THREE.ConeGeometry(1, 1, 6, 1));
  spikeGeo.translate(0, -0.5, 0); // tip at the origin, so instances hang from a surface
  // White material colour: instanceColor MULTIPLIES it, so supplying a dark rock tone in
  // both places squared it — 0x463d35 x 0x2f2a25 lands near 0.2% reflectance, i.e. black.
  // Where per-instance colour carries the real hue, the material must be white.
  const spikeMat = track(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
  const spikes = new THREE.InstancedMesh(spikeGeo, spikeMat, SPIKE_COUNT);
  const tint = new THREE.Color();
  for (let i = 0; i < SPIKE_COUNT; i += 1) {
    // Mostly floor now. With the roof cut away there is nothing overhead to hang from, so
    // the remaining "ceiling" spurs are rock jutting from the tops of the two side walls.
    const fromCeiling = rng() < 0.28;
    const z = Z_DETAIL_NEAR - rng() * (Z_DETAIL_NEAR - Z_FAR - 14);
    let length;
    if (fromCeiling) {
      // Only the retained upper edges of the arc — anything nearer the old apex would now
      // hang from empty air.
      const angle = rng() < 0.5
        ? ARC_START + rng() * 0.11 * Math.PI
        : ARC_END - rng() * 0.11 * Math.PI;
      const p = shaftPoint(angle, z, 0.6);
      length = 2 + rng() * 3;
      posV.set(p.x, p.y, z);
      // Hang along the inward radius, not straight down — they grow off the rock face.
      eulerQ.set(0, 0, Math.PI + angle - Math.PI / 2);
      quat.setFromEuler(eulerQ);
    } else {
      length = 1.6 + rng() * 3.4;
      // Clear of the rails: the centre is the walked, worked path, and a spike standing on
      // the track read as a black wedge planted across the composition.
      const side = rng() < 0.5 ? -1 : 1;
      posV.set(side * (6.5 + rng() * 9), FLOOR_Y + length, z);
      eulerQ.set(Math.PI, rng() * Math.PI * 2, 0); // tip up, base on the floor
      quat.setFromEuler(eulerQ);
    }
    // Squatter than before: thin cones at this camera angle read as thorns rather than
    // as rock, and there are a lot of them across the walls.
    const width = length * (0.3 + rng() * 0.22);
    scaleV.set(width, length, width);
    m4.compose(posV, quat, scaleV);
    spikes.setMatrixAt(i, m4);
    spikes.setColorAt(i, tint.setHex(ROCK_HUES[Math.floor(rng() * ROCK_HUES.length)]));
  }
  spikes.instanceMatrix.needsUpdate = true;
  if (spikes.instanceColor) spikes.instanceColor.needsUpdate = true;
  scene.add(spikes);

  // ── Rubble ────────────────────────────────────────────────────────────────
  const RUBBLE_COUNT = 130;
  const rubbleGeo = track(new THREE.IcosahedronGeometry(1, 0));
  const rubbleMat = track(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
  const rubble = new THREE.InstancedMesh(rubbleGeo, rubbleMat, RUBBLE_COUNT);
  for (let i = 0; i < RUBBLE_COUNT; i += 1) {
    const z = Z_DETAIL_NEAR + 6 - rng() * (Z_DETAIL_NEAR + 6 - Z_FAR);
    // Biased to the tunnel sides: the middle is the walked, cleared path.
    const side = rng() < 0.5 ? -1 : 1;
    const x = side * (5 + rng() * 13);
    const s = 0.5 + rng() * 1.9;
    posV.set(x, FLOOR_Y + s * 0.35, z);
    eulerQ.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    quat.setFromEuler(eulerQ);
    scaleV.set(s, s * (0.5 + rng() * 0.4), s);
    m4.compose(posV, quat, scaleV);
    rubble.setMatrixAt(i, m4);
    rubble.setColorAt(i, tint.setHex(ROCK_HUES[Math.floor(rng() * ROCK_HUES.length)]));
  }
  rubble.instanceMatrix.needsUpdate = true;
  if (rubble.instanceColor) rubble.instanceColor.needsUpdate = true;
  scene.add(rubble);

  // ── Ore veins ─────────────────────────────────────────────────────────────
  // MeshBasicMaterial, so they are bright regardless of where the lights fall and the
  // bloom pass picks them up out of shadow. That unlit look is the point: ore should
  // glint in the dark, which is what makes the shaft feel worth digging.
  const ORE_COUNT = 130;
  const oreGeo = track(new THREE.OctahedronGeometry(1, 0));
  const oreMat = track(new THREE.MeshBasicMaterial({
    color: 0xffffff,
    // Fogged like everything else, so distant ore dims into the haze instead of
    // hanging in front of it as bright confetti.
    fog: true,
  }));
  const ore = new THREE.InstancedMesh(oreGeo, oreMat, ORE_COUNT);
  for (let i = 0; i < ORE_COUNT; i += 1) {
    const z = Z_DETAIL_NEAR - 8 - rng() * (Z_DETAIL_NEAR - 8 - Z_FAR - 10);
    // Anywhere on the retained arc, biased off the very bottom where the floor would bury it.
    const angle = ARC_START + (0.04 + rng() * 0.92) * (ARC_END - ARC_START);
    const p = shaftPoint(angle, z, 0.15 + rng() * 0.3);
    posV.set(p.x, p.y, z);
    eulerQ.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    quat.setFromEuler(eulerQ);
    const s = 0.11 + rng() * 0.2;
    scaleV.set(s, s * (1 + rng()), s);
    m4.compose(posV, quat, scaleV);
    ore.setMatrixAt(i, m4);
    // Proximity to a lamp, times a per-instance richness so the vein is not uniform.
    // The 0.05 floor keeps far ore as the faintest suggestion rather than absent.
    const reach = lightReach(p.x, p.y, z);
    ore.setColorAt(i, tint.setHex(ORE_HUES[Math.floor(rng() * ORE_HUES.length)])
      .multiplyScalar((0.05 + 0.95 * reach) * (0.55 + rng() * 0.45)));
  }
  ore.instanceMatrix.needsUpdate = true;
  if (ore.instanceColor) ore.instanceColor.needsUpdate = true;
  scene.add(ore);

  // ── Support frames ────────────────────────────────────────────────────────
  // Posts and lintels, spaced down the shaft. Two instanced meshes rather than one
  // merged arch: no merge helper is imported, and the post box serves both uprights.
  const FRAME_COUNT = 9;
  const FRAME_SPACING = 15;
  const timberMat = track(new THREE.MeshLambertMaterial({ color: 0x4a3524, flatShading: true }));
  const postGeo = track(new THREE.BoxGeometry(1, 1, 1));
  postGeo.translate(0, 0.5, 0); // base at y=0, so height scales upward from the floor
  const posts = new THREE.InstancedMesh(postGeo, timberMat, FRAME_COUNT * 2);
  const beamGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const beams = new THREE.InstancedMesh(beamGeo, timberMat, FRAME_COUNT);
  for (let i = 0; i < FRAME_COUNT; i += 1) {
    // Starting 8 further back than the other detail: at 12 units the lintel of the
    // nearest frame sat above the top of the frustum and read as a black bar.
    const z = Z_DETAIL_NEAR - 8 - i * FRAME_SPACING;
    // Tuck the frame just inside the rock, and let the shaft's taper set its width.
    const halfWidth = shaftRadius(z) * 0.52;
    const height = 11 + shaftRadius(z) * 0.16;
    for (let side = 0; side < 2; side += 1) {
      const x = side === 0 ? -halfWidth : halfWidth;
      posV.set(x, FLOOR_Y, z);
      quat.identity();
      scaleV.set(1.1, height, 1.1);
      m4.compose(posV, quat, scaleV);
      posts.setMatrixAt(i * 2 + side, m4);
    }
    posV.set(0, FLOOR_Y + height + 0.55, z);
    quat.identity();
    scaleV.set(halfWidth * 2 + 2.2, 1.1, 1.3);
    m4.compose(posV, quat, scaleV);
    beams.setMatrixAt(i, m4);
  }
  posts.instanceMatrix.needsUpdate = true;
  beams.instanceMatrix.needsUpdate = true;
  scene.add(posts);
  scene.add(beams);

  // ── Rails ─────────────────────────────────────────────────────────────────
  // Perspective lines converging into the fog. Cheap, and they do more for the sense of
  // depth than any amount of extra rock.
  const SLEEPER_COUNT = 46;
  const sleeperGeo = track(new THREE.BoxGeometry(6.4, 0.34, 1.1));
  const sleeperMat = track(new THREE.MeshLambertMaterial({ color: 0x3f2f21, flatShading: true }));
  const sleepers = new THREE.InstancedMesh(sleeperGeo, sleeperMat, SLEEPER_COUNT);
  for (let i = 0; i < SLEEPER_COUNT; i += 1) {
    posV.set(0, FLOOR_Y + 0.2, Z_DETAIL_NEAR + 10 - i * 3.4);
    eulerQ.set(0, (rng() - 0.5) * 0.05, 0); // slight scatter; nothing underground is true
    quat.setFromEuler(eulerQ);
    scaleV.set(1, 1, 1);
    m4.compose(posV, quat, scaleV);
    sleepers.setMatrixAt(i, m4);
  }
  sleepers.instanceMatrix.needsUpdate = true;
  scene.add(sleepers);

  const railGeo = track(new THREE.BoxGeometry(0.32, 0.3, SLEEPER_COUNT * 3.4));
  const railMat = track(new THREE.MeshLambertMaterial({ color: 0x6b6f73 }));
  for (const x of [-2.2, 2.2]) {
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(x, FLOOR_Y + 0.5, Z_DETAIL_NEAR + 10 - (SLEEPER_COUNT * 3.4) / 2);
    scene.add(rail);
  }

  // ── Forge ─────────────────────────────────────────────────────────────────
  // Off to one side and near the camera, so its light rakes across the wall and the
  // support frames instead of flattening everything head-on.
  const FORGE_POS = new THREE.Vector3(FIRE_POS.x, FLOOR_Y, FIRE_POS.z);
  const braGeo = track(new THREE.CylinderGeometry(2.5, 3.3, 3.2, 10));
  const braMat = track(new THREE.MeshLambertMaterial({ color: 0x574a3c, flatShading: true }));
  const brazier = new THREE.Mesh(braGeo, braMat);
  brazier.position.set(FORGE_POS.x, FORGE_POS.y + 1.6, FORGE_POS.z);
  scene.add(brazier);

  const emberGeo = track(new THREE.IcosahedronGeometry(2.1, 0));
  const emberMat = track(new THREE.MeshBasicMaterial({ color: 0xff7a2e }));
  const embers = new THREE.Mesh(emberGeo, emberMat);
  embers.position.set(FORGE_POS.x, FORGE_POS.y + 3.2, FORGE_POS.z);
  embers.scale.set(1, 0.55, 1);
  scene.add(embers);

  // Sprite halo. Bloom alone cannot invent light scattering in the air between the fire
  // and the camera; this sells the fire as something burning rather than a lit shape.
  const glowMat = track(new THREE.SpriteMaterial({
    map: track(makeGlowTexture(THREE, 'rgba(255,214,150,0.95)')),
    color: 0xff9440,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  }));
  const glow = new THREE.Sprite(glowMat);
  glow.position.copy(embers.position);
  // Sprite scale is in WORLD units, and the fire sits only ~18 units from the camera. At
  // the 20 it started at, this single additive quad covered the left third of the frame and
  // washed out everything behind it — including all the rock detail. A halo should be
  // slightly larger than the fire it surrounds, nothing more.
  glow.scale.set(7, 7, 1);
  scene.add(glow);

  // Intensity is in candela and falls off as 1/d^decay, so the number has to be large:
  // three has been physically based since r155. At the old value of 2.6 a wall 20 units
  // away received 2.6/20^1.7 = 0.015 and the entire shaft rendered black. The wilderness
  // scene never hit this because directional and hemisphere lights do not attenuate.
  // decay 1.7 rather than a physical 2 so the light reaches down the shaft.
  const FIRE_INTENSITY = 210;
  const fireLight = new THREE.PointLight(0xff8c3a, FIRE_INTENSITY, 96, 1.7);
  fireLight.position.set(FIRE_POS.x, FIRE_POS.y, FIRE_POS.z);
  scene.add(fireLight);

  // ── Mid-shaft lamp ────────────────────────────────────────────────────────
  const midLamp = new THREE.PointLight(0xffb271, 120, 78, 1.7);
  midLamp.position.set(MIDLAMP_POS.x, MIDLAMP_POS.y, MIDLAMP_POS.z);
  scene.add(midLamp);

  const midGlowMat = track(new THREE.SpriteMaterial({
    map: track(makeGlowTexture(THREE, 'rgba(255,226,178,0.9)')),
    color: 0xffbd80,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  }));
  const midGlow = new THREE.Sprite(midGlowMat);
  midGlow.position.copy(midLamp.position);
  midGlow.scale.set(4.6, 4.6, 1);
  scene.add(midGlow);

  // A cooler second source far down the shaft. Two lights at different colour
  // temperatures separate foreground from background far better than one bright lamp.
  const LANTERN_INTENSITY = 150;
  const lantern = new THREE.PointLight(0x8fb4d8, LANTERN_INTENSITY, 110, 1.6);
  lantern.position.set(4, AXIS_Y + 2, -62);
  scene.add(lantern);

  const lanternGlowMat = track(new THREE.SpriteMaterial({
    map: track(makeGlowTexture(THREE, 'rgba(210,230,255,0.85)')),
    color: 0x9fc4e8,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  }));
  const lanternGlow = new THREE.Sprite(lanternGlowMat);
  lanternGlow.position.copy(lantern.position);
  lanternGlow.scale.set(11, 11, 1);
  scene.add(lanternGlow);

  // Enough ambient that rock never goes to pure black — fully black geometry reads as a
  // hole in the image rather than as unlit stone.
  // Floor for the darkest rock. Stone that renders at pure black reads as a hole in the
  // image, not as unlit stone — it was the main reason the first pass looked like objects
  // floating in a void instead of a cave.
  scene.add(new THREE.AmbientLight(0x9d907a, 3.6));
  scene.add(new THREE.HemisphereLight(0x6f82a3, 0x6b5238, 2.6));

  // Top fill, and it exists for a layout reason rather than a lighting one. The rock
  // surrounding the cutaway is beyond every lamp's reach, so it renders at roughly a third
  // the brightness of the trench. That would be fine for a picture — but this is a backdrop,
  // the UI panels cover the middle where the lit trench is, and the regions a player
  // actually sees through are the corners, which are exactly the unlit surface. A directional
  // light does not attenuate, so it lifts the surface without touching the lamps' falloff.
  const topFill = new THREE.DirectionalLight(0xbfc6d8, 1.35);
  topFill.position.set(24, 90, 30);
  scene.add(topFill);

  // ── Dust ──────────────────────────────────────────────────────────────────
  // Two counter-rotating groups at different heights. Rotating a container is free,
  // where per-frame position updates would touch the buffer every frame for no visible
  // gain at this size.
  const dustGroups = [];
  for (let g = 0; g < 2; g += 1) {
    const COUNT = 150;
    const geo = track(new THREE.BufferGeometry());
    const p = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i += 1) {
      const z = Z_DETAIL_NEAR + 8 - rng() * (Z_DETAIL_NEAR + 8 - Z_FAR) * 0.85;
      p[i * 3] = (rng() - 0.5) * 34;
      p[i * 3 + 1] = 1.5 + rng() * (g === 0 ? 9 : 18);
      p[i * 3 + 2] = z;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const mat = track(new THREE.PointsMaterial({
      map: track(makeGlowTexture(THREE)),
      color: g === 0 ? 0xffc98a : 0xa8bcd4,
      size: g === 0 ? 0.5 : 0.36,
      sizeAttenuation: true,
      transparent: true,
      opacity: g === 0 ? 0.5 : 0.34,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    dustGroups.push({ points, dir: g === 0 ? 1 : -1, baseY: points.position.y });
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  // Orthographic and angled down into the shaft, the diorama look. No perspective means no
  // vanishing point, so depth has to come from the receding lamps, the fog and the rails
  // rather than from convergence — which is why those three matter more here than they did
  // in the perspective framing.
  const VIEW_HEIGHT = 56;
  const CAM_TARGET = new THREE.Vector3(0, 4, -12);
  // ~42 degrees elevation, ~32 degrees off the shaft axis: high enough to see the floor and
  // both walls, shallow enough that the shaft still reads as running away from the viewer.
  const CAM_OFFSET = new THREE.Vector3(0.394, 0.669, 0.630).multiplyScalar(110);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 520);
  // backdrop.js rebuilds the frustum edges from this on every resize; an orthographic camera
  // has no `aspect` to set.
  camera.userData.viewHeight = VIEW_HEIGHT;
  camera.position.copy(CAM_TARGET).add(CAM_OFFSET);
  camera.lookAt(CAM_TARGET);

  const fireColor = new THREE.Color();
  const FIRE_HOT = new THREE.Color(0xffb066);
  const FIRE_COOL = new THREE.Color(0xff6a20);

  return {
    scene,
    camera,
    // Lower threshold and higher strength than the wilderness: the scene is dark, so
    // little exceeds the cut, and the glow is doing narrative work here rather than
    // just softening highlights.
    bloom: { strength: 1.05, radius: 0.8, threshold: 0.58 },
    // Compresses the fire's highlights instead of clipping them, and lifts the shadow end
    // enough that rock stays legible as rock.
    toneMapping: { type: 'ACESFilmicToneMapping', exposure: 1.15 },

    update(t) {
      // Fire flicker. Four incommensurate frequencies so it never settles into a visible
      // pulse, driving intensity, reach and colour temperature together — a real flame
      // gets hotter and whiter as it flares, it does not just get brighter.
      const flick = 0.74
        + 0.15 * Math.sin(t * 11.3)
        + 0.10 * Math.sin(t * 17.9 + 1.7)
        + 0.07 * Math.sin(t * 29.1 + 0.4)
        + 0.05 * Math.sin(t * 43.7 + 2.2);
      const f = Math.min(1.18, Math.max(0.46, flick));
      fireLight.intensity = FIRE_INTENSITY * f;
      fireLight.distance = 92 + 12 * f;
      fireColor.copy(FIRE_COOL).lerp(FIRE_HOT, Math.min(1, Math.max(0, (f - 0.5) / 0.6)));
      fireLight.color.copy(fireColor);
      emberMat.color.copy(fireColor);
      glowMat.color.copy(fireColor);
      glow.scale.setScalar(6.2 + 1.6 * f);
      embers.scale.set(1 + 0.06 * f, 0.55 + 0.08 * f, 1 + 0.06 * f);

      // The hung lamp swings a little, which animates its pool of light on the rock.
      midLamp.position.x = MIDLAMP_POS.x + Math.sin(t * 0.5) * 0.5;
      midGlow.position.x = midLamp.position.x;
      midLamp.intensity = 120 * (0.94 + 0.06 * Math.sin(t * 2.3));

      // The lantern breathes far more slowly — a shuttered lamp, not an open flame.
      const lf = 0.9 + 0.1 * Math.sin(t * 1.7) + 0.05 * Math.sin(t * 3.1 + 0.8);
      lantern.intensity = LANTERN_INTENSITY * lf;
      lanternGlow.scale.setScalar(10.5 * lf);

      // Dust: slow rotation plus a gentle rise, so motes drift rather than orbit visibly.
      for (const group of dustGroups) {
        group.points.rotation.y = t * 0.013 * group.dir;
        group.points.position.y = Math.sin(t * 0.11 * group.dir) * 1.2;
      }

      // Drift. With an orthographic camera, moving the rig pans rather than parallaxes, so
      // this stays small and slow — it exists to stop the frame feeling frozen, not to
      // suggest depth.
      const driftX = Math.sin(t * 0.045) * 3.4;
      const driftZ = Math.cos(t * 0.031) * 2.2;
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
