/**
 * Splash / loading backdrop — a snow-capped range of layered ridges at dawn.
 *
 * Nothing moves in here but the camera. The screen's only particles are the diagonal rune stream,
 * which is DOM (see SplashScreen.jsx) — this scene used to carry its own field of rising motes as
 * well, and two unrelated drifts crossing each other read as noise rather than as one effect.
 *
 * Same constraints as the wilderness scene (unblurred, full resolution, no textures or
 * shadows), but composed for a title card rather than a place: the ridges are flat
 * unlit silhouettes stacked in depth, so the image reads as layered value bands — which
 * is both a clean look when sharp and very cheap to draw.
 *
 * The centre of frame is kept low-contrast so the wordmark sitting on top of it has
 * somewhere quiet to land.
 */

function makeRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SKY_VERT = `
  varying float vH;
  void main() {
    vH = normalize(position).y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uBottom;
  varying float vH;
  void main() {
    float h = clamp(vH * 0.5 + 0.5, 0.0, 1.0);
    // Bands compressed toward the horizon. Spread evenly, the warm dawn colour sat at the very
    // bottom of the sphere — entirely behind the ridges — so the sky read as flat night with the
    // one thing that made it dawn permanently hidden.
    vec3 c = mix(uBottom, uMid, smoothstep(0.46, 0.60, h));
    c = mix(c, uTop, smoothstep(0.58, 0.92, h));
    gl_FragColor = vec4(c, 1.0);
  }
`;

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Summits for one ridge, spread across its width with jitter.
 *
 * Peaks rather than sine waves, and that is the whole difference between hills and mountains.
 * Two summed sines give evenly spaced rounded humps — moorland. Overlapping triangular peaks with
 * randomised height and half-width give sharp summits, deep saddles, and the occasional spire.
 *
 * Peak geometry is in WORLD units, converted to profile space at the end. Sizing peaks as a
 * fraction of ridge width made them scale with the ridge: a 1700-unit ridge got 250-unit-wide
 * summits against a 76-unit rise, which is a hill. Steepness is the whole effect, so it has to be
 * set independently of width.
 */
function makePeaks(rng, width, spacing, halfWidth) {
  const count = Math.max(2, Math.round(width / spacing));
  const peaks = [];
  for (let i = 0; i < count; i += 1) {
    peaks.push({
      x: (i + 0.5) / count + (rng() - 0.5) * (0.7 / count),
      // Squared, so most summits are modest and the occasional one towers. An even spread of
      // heights reads as a saw blade.
      h: 0.3 + rng() * rng() * 1.05,
      w: (halfWidth * (0.62 + rng() * 0.76)) / width,
    });
  }
  return peaks;
}

/** Silhouette height at `x` (0..1 across the ridge), 0 in the saddles. */
function peakProfile(peaks, x, seed) {
  let h = 0;
  for (const peak of peaks) {
    const d = Math.abs(x - peak.x) / peak.w;
    // Exponent under 1 makes the flanks slightly convex, which reads as rock rather than as a
    // paper triangle.
    if (d < 1) h = Math.max(h, peak.h * Math.pow(1 - d, 0.78));
  }
  // Crag detail, scaled by height so saddles stay clean.
  return Math.max(0, h + h * 0.1 * Math.sin(x * 96 + seed) + h * 0.055 * Math.sin(x * 231 + seed * 3));
}

/**
 * One ridge, positioned by where its silhouette should land in frame rather than by an abstract
 * amplitude.
 *
 *   baseY    the bottom of the ridge body — kept well below frame so layers never show a gap
 *   saddleY  the world height of the valleys between summits
 *   summitY  the world height the TALLEST summit reaches
 *
 * Specifying the summit directly is the only workable way to frame this. An earlier version
 * scaled displacement as a fraction of body height, and because the profile's maximum varies
 * with the random peaks, the near ridge's summits ended up 469 units tall — it filled the entire
 * frame with flat dark purple, which looked exactly like an empty scene.
 *
 * Every row is displaced in proportion to its height up the plane, not just the top edge. That
 * keeps the silhouette while leaving intermediate rows to carry a snowline; with a single row
 * there is nowhere to put one, and unlit mountains at this scale look like cut paper.
 */
function buildRidge(THREE, { width, segments, rows, spacing, halfWidth, seed, color, snow, snowMix, baseY, saddleY, summitY }) {
  const height = saddleY - baseY;
  const rise = summitY - saddleY;
  const geo = new THREE.PlaneGeometry(width, height, segments, rows);
  const rng = makeRng(seed);
  const peaks = makePeaks(rng, width, spacing, halfWidth);

  // Normalise against the profile's actual maximum, so `summitY` means what it says whatever
  // the random peaks came out as.
  let peakMax = 0;
  for (let i = 0; i <= 512; i += 1) peakMax = Math.max(peakMax, peakProfile(peaks, i / 512, seed));
  if (peakMax <= 0) peakMax = 1;

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(color);
  const cap = new THREE.Color(snow);
  const tint = new THREE.Color();

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i) / width + 0.5;
    // 0 at the ridge's base, 1 at its top edge.
    const v = (pos.getY(i) + height / 2) / height;
    const profile = peakProfile(peaks, x, seed) / peakMax;
    pos.setY(i, pos.getY(i) + profile * rise * v);

    // Snow reaches further down the taller summits, and not into the saddles at all.
    const snowT = smoothstep(0.55, 1, v) * smoothstep(0.4, 1, profile) * snowMix;
    tint.copy(base).lerp(cap, snowT);
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // White material: vertexColors MULTIPLY it, and these carry the real hue.
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, (baseY + saddleY) / 2, 0);
  return { mesh, geo, mat };
}

export function buildSplashScene(THREE) {
  const scene = new THREE.Scene();
  const disposables = [];
  const track = obj => { disposables.push(obj); return obj; };

  const skyGeo = track(new THREE.SphereGeometry(400, 16, 12));
  const skyMat = track(new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      // Dawn palette, tuned to the game's gold/amber UI rather than a neutral blue.
      uTop: { value: new THREE.Color(0x241d3d) },
      uMid: { value: new THREE.Color(0x7d5568) },
      uBottom: { value: new THREE.Color(0xe8ac6a) },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  }));
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // Far ridges are lighter (more atmosphere between them and the camera) and get
  // progressively darker toward the foreground — aerial perspective, faked cheaply.
  // Raised into the lower-middle of frame and lightened. Unblurred, the previous
  // palette sat too close to the sky and the silhouettes disappeared into it; the
  // separation between adjacent bands is what makes the layering legible when sharp.
  const ridgeSpecs = [
    // Widths are sized to the visible frame at each depth plus margin for parallax, not far
    // beyond it — a 1700-unit ridge put only two or three summits on screen, so the range read
    // as a couple of broad humps. Summits step DOWN toward the viewer, which is how a real range
    // reads: the far peaks sit highest in frame. Far ridges are lighter and carry the most snow
    // (aerial perspective, faked cheaply), and spacing widens toward the foreground so near
    // mountains read as a few large masses rather than a comb of identical spikes.
    { width: 940, segments: 340, rows: 9, spacing: 78, halfWidth: 46, seed: 11, color: 0x9b86ad, snow: 0xf8e4cc, snowMix: 0.92, z: -250, baseY: -190, saddleY: -4,  summitY: 104 },
    { width: 800, segments: 320, rows: 9, spacing: 80, halfWidth: 48, seed: 27, color: 0x7a6390, snow: 0xefd2b6, snowMix: 0.76, z: -186, baseY: -190, saddleY: -16, summitY: 72 },
    { width: 660, segments: 300, rows: 9, spacing: 84, halfWidth: 52, seed: 43, color: 0x554169, snow: 0xd9ab88, snowMix: 0.5,  z: -130, baseY: -190, saddleY: -26, summitY: 44 },
    { width: 520, segments: 280, rows: 9, spacing: 92, halfWidth: 58, seed: 61, color: 0x362a4c, snow: 0x9a7b6b, snowMix: 0.26, z: -82,  baseY: -200, saddleY: -34, summitY: 20 },
    { width: 400, segments: 240, rows: 9, spacing: 104, halfWidth: 66, seed: 79, color: 0x1d1730, snow: 0x4e3e58, snowMix: 0.14, z: -44,  baseY: -210, saddleY: -40, summitY: 1 },
  ];
  const ridges = ridgeSpecs.map(spec => {
    const r = buildRidge(THREE, spec);
    r.mesh.position.z = spec.z;
    track(r.geo);
    track(r.mat);
    scene.add(r.mesh);
    return r.mesh;
  });

  const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 600);
  camera.position.set(0, 4, 60);
  camera.lookAt(0, 2, -120);

  return {
    scene,
    camera,
    // Lower threshold than the wilderness: the ridges are unlit flats, so only the sky and the
    // brightest snow should catch the halo.
    bloom: { strength: 0.55, radius: 0.9, threshold: 0.78 },

    update(t) {
      // Very slow drift, and each ridge parallaxes by depth so the layers separate.
      const drift = Math.sin(t * 0.022);
      camera.position.x = drift * 9;
      camera.position.y = 4 + Math.sin(t * 0.03) * 1.1;
      camera.lookAt(drift * 3, 2, -120);

      for (let i = 0; i < ridges.length; i += 1) {
        ridges[i].position.x = -drift * (1.6 + i * 1.5);
      }

    },

    dispose() {
      for (const d of disposables) d.dispose?.();
      scene.clear();
    },
  };
}
