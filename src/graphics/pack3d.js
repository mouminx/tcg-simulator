import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODEL_URL = new URL('../assets/models/blank_tcg_card_pack.glb', import.meta.url).href;
const MODEL_HEIGHT = 2;
const OPEN_DURATION_MS = 1080;

const PALETTES = {
  dusk:       ['#120a05', '#6b3b12', '#efb454'],
  welcome:    ['#173737', '#b86c31', '#fff0bd'],
  iron:       ['#111a35', '#413080', '#a9c9ff'],
  blankSlate: ['#070b13', '#263244', '#d8e1ed'],
  arcane:     ['#16072d', '#6f22b7', '#ff8ee8'],
  void:       ['#02010a', '#25046b', '#8658ff'],
  primordial: ['#180b00', '#8a4d00', '#ffe06a'],
  vault1:     ['#070a0f', '#344b66', '#d9edff'],
  vault2:     ['#120900', '#8b5000', '#ffe264'],
  vault3:     ['#09051d', '#512693', '#e8d9ff'],
  holoEd:     ['#031321', '#155493', '#72f4ff'],
  foilEd:     ['#0b0f17', '#4e5d70', '#eef6ff'],
  reverseEd:  ['#031510', '#146d4c', '#7affc5'],
  shadowEd:   ['#030207', '#241151', '#a67cff'],
  nexusEd:    ['#05020e', '#4d087f', '#da69ff'],
  prismaticEd:['#090416', '#672174', '#90f5ff'],
};

const LABEL_CACHE = new Map();
let geometryPromise = null;
let liveRuntimePromise = null;

function paletteFor(packType) {
  return PALETTES[packType?.id] ?? PALETTES.iron;
}

function loadGeometry() {
  if (geometryPromise) return geometryPromise;
  geometryPromise = new Promise((resolve, reject) => {
    new GLTFLoader().load(MODEL_URL, gltf => {
      let source = null;
      gltf.scene.traverse(node => {
        if (!source && node.isMesh) source = node;
      });
      if (!source?.geometry) {
        reject(new Error('Card-pack GLB contains no mesh geometry'));
        return;
      }
      const geometry = source.geometry.clone();
      // The supplied GLB contains positions and indices only. Calculated normals let its
      // actual folds catch the key/rim lights instead of reading as a flat silver cutout.
      if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
      geometry.center();
      geometry.computeBoundingBox();
      resolve(geometry);
    }, undefined, reject);
  });
  return geometryPromise;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fitText(ctx, text, maxWidth, initialSize, family) {
  let size = initialSize;
  do {
    ctx.font = `600 ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  } while (size > 24);
  return size;
}

function getLabelTexture(packType) {
  const pt = packType ?? { id: 'iron', name: 'Iron', subtitle: 'Pack', stars: '✦ ✦ ✦', cardCount: 5 };
  const key = `${pt.id}:${pt.name}:${pt.subtitle}:${pt.stars}:${pt.cardCount}`;
  if (LABEL_CACHE.has(key)) return LABEL_CACHE.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  const [dark, mid, light] = paletteFor(pt);

  const base = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  base.addColorStop(0, dark);
  base.addColorStop(0.52, mid);
  base.addColorStop(1, dark);
  roundedRect(ctx, 10, 10, 748, 1060, 54);
  ctx.fillStyle = base;
  ctx.fill();

  const aura = ctx.createRadialGradient(384, 470, 20, 384, 470, 410);
  aura.addColorStop(0, `${light}b8`);
  aura.addColorStop(0.3, `${mid}70`);
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(10, 10, 748, 1060);

  // Fine diagonal foil weave. It remains restrained at shelf size but stops the
  // projected label reading as a perfectly smooth sticker in the opening close-up.
  ctx.save();
  roundedRect(ctx, 10, 10, 748, 1060, 54);
  ctx.clip();
  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = light;
  ctx.lineWidth = 2;
  for (let x = -1050; x < 900; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, 1080);
    ctx.lineTo(x + 1080, 0);
    ctx.stroke();
  }
  ctx.restore();

  roundedRect(ctx, 22, 22, 724, 1036, 45);
  ctx.strokeStyle = `${light}d9`;
  ctx.lineWidth = 6;
  ctx.stroke();
  roundedRect(ctx, 40, 40, 688, 1000, 36);
  ctx.strokeStyle = `${light}55`;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `${light}e8`;
  ctx.font = '34px "Quattrocento", serif';
  ctx.letterSpacing = '10px';
  ctx.fillText(pt.stars || '✦', 384, 105);

  // The central seal gives the foil something graphic to reflect without requiring
  // a separate bitmap for every current and future pack type.
  ctx.save();
  ctx.translate(384, 422);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = `${light}c8`;
  ctx.lineWidth = 7;
  ctx.strokeRect(-132, -132, 264, 264);
  ctx.strokeStyle = `${light}70`;
  ctx.lineWidth = 3;
  ctx.strokeRect(-100, -100, 200, 200);
  ctx.restore();
  ctx.fillStyle = light;
  ctx.shadowColor = light;
  ctx.shadowBlur = 34;
  ctx.font = '172px "Noto Sans Runic", serif';
  ctx.fillText('ᚨ', 384, 423);
  ctx.shadowBlur = 0;

  const family = '"Uncial Antiqua", "Metamorphous", serif';
  const title = String(pt.name ?? 'Arcana').toUpperCase();
  const titleSize = fitText(ctx, title, 630, 74, family);
  ctx.font = `600 ${titleSize}px ${family}`;
  ctx.fillStyle = '#fff9e8';
  ctx.shadowColor = dark;
  ctx.shadowBlur = 15;
  ctx.fillText(title, 384, 700);
  ctx.shadowBlur = 0;

  ctx.font = '32px "Quattrocento", serif';
  ctx.fillStyle = `${light}eb`;
  ctx.fillText(String(pt.subtitle ?? 'Pack').toUpperCase(), 384, 775);

  ctx.strokeStyle = `${light}9c`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(178, 834);
  ctx.lineTo(590, 834);
  ctx.stroke();
  ctx.font = '700 28px "Quattrocento", serif';
  ctx.fillStyle = 'rgba(255,249,232,0.78)';
  ctx.fillText(`${pt.cardCount ?? 5} CARDS`, 384, 895);

  const vignette = ctx.createRadialGradient(384, 520, 280, 384, 520, 610);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.48)');
  roundedRect(ctx, 10, 10, 748, 1060, 54);
  ctx.fillStyle = vignette;
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  LABEL_CACHE.set(key, texture);
  return texture;
}

function makeWrapperMaterial(packType) {
  const [, mid, light] = paletteFor(packType);
  const premium = /primordial|vault|holo|prismatic|nexus/i.test(packType?.id ?? '');
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(mid).lerp(new THREE.Color('#d9e2ee'), 0.38),
    metalness: 0.88,
    roughness: 0.23,
    clearcoat: 0.7,
    clearcoatRoughness: 0.18,
    iridescence: premium ? 0.65 : 0.18,
    iridescenceIOR: 1.45,
    emissive: new THREE.Color(light),
    emissiveIntensity: premium ? 0.055 : 0.018,
    side: THREE.DoubleSide,
  });
}

function makeLabelMaterial(packType) {
  const premium = /primordial|vault3|holo|prismatic|nexus/i.test(packType?.id ?? '');
  return new THREE.MeshPhysicalMaterial({
    map: getLabelTexture(packType),
    color: 0xffffff,
    metalness: 0.42,
    roughness: 0.31,
    clearcoat: 0.65,
    clearcoatRoughness: 0.14,
    iridescence: premium ? 0.75 : 0.2,
    iridescenceIOR: 1.5,
    side: THREE.DoubleSide,
  });
}

async function makePackAssembly(packType, { dissolving = false } = {}) {
  const sourceGeometry = await loadGeometry();
  const scale = MODEL_HEIGHT / (sourceGeometry.boundingBox.max.y - sourceGeometry.boundingBox.min.y);
  const group = new THREE.Group();

  const wrapperMaterial = makeWrapperMaterial(packType);
  const wrapper = new THREE.Mesh(sourceGeometry, wrapperMaterial);
  wrapper.scale.setScalar(scale);
  group.add(wrapper);

  // Projected face artwork: the model has no UVs, so this sits fractionally above
  // the broad front foil. The untouched perimeter and crimped edges remain real GLB
  // geometry and catch light independently from the printed face.
  const labelGeometry = new THREE.PlaneGeometry(1.04, 1.54, 48, 72);
  const labelMaterial = makeLabelMaterial(packType);
  const label = new THREE.Mesh(labelGeometry, labelMaterial);
  label.position.z = sourceGeometry.boundingBox.max.z * scale + 0.008;
  label.position.y = -0.015;
  group.add(label);

  const dissolveUniforms = [];
  if (dissolving) {
    patchDissolve(wrapperMaterial, sourceGeometry.boundingBox, dissolveUniforms);
    labelGeometry.computeBoundingBox();
    patchDissolve(labelMaterial, labelGeometry.boundingBox, dissolveUniforms);
  }

  return { group, wrapperMaterial, labelMaterial, labelGeometry, dissolveUniforms };
}

function patchDissolve(material, bounds, uniformsList) {
  const uniforms = {
    progress: { value: 0 },
    time: { value: 0 },
    color: { value: new THREE.Color('#ffd66b') },
    min: { value: bounds.min.clone() },
    size: { value: bounds.max.clone().sub(bounds.min) },
  };
  uniformsList.push(uniforms);
  material.onBeforeCompile = shader => {
    shader.uniforms.uPackDissolve = uniforms.progress;
    shader.uniforms.uPackTime = uniforms.time;
    shader.uniforms.uPackEdgeColor = uniforms.color;
    shader.uniforms.uPackBoundsMin = uniforms.min;
    shader.uniforms.uPackBoundsSize = uniforms.size;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n+varying vec3 vPackDissolvePosition;\n+uniform vec3 uPackBoundsMin;\n+uniform vec3 uPackBoundsSize;`.replace(/^\+/gm, ''))
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n+vPackDissolvePosition = (position - uPackBoundsMin) / max(uPackBoundsSize, vec3(0.0001));`.replace(/^\+/gm, ''));
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n+varying vec3 vPackDissolvePosition;\n+uniform float uPackDissolve;\n+uniform float uPackTime;\n+uniform vec3 uPackEdgeColor;\n+float packHash(vec3 p) {\n+  p = fract(p * 0.3183099 + vec3(.1, .2, .3));\n+  p *= 17.0;\n+  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));\n+}\n+float packNoise(vec3 p) {\n+  vec3 i = floor(p);\n+  vec3 f = fract(p);\n+  f = f * f * (3.0 - 2.0 * f);\n+  return mix(mix(mix(packHash(i), packHash(i + vec3(1,0,0)), f.x),\n+                 mix(packHash(i + vec3(0,1,0)), packHash(i + vec3(1,1,0)), f.x), f.y),\n+             mix(mix(packHash(i + vec3(0,0,1)), packHash(i + vec3(1,0,1)), f.x),\n+                 mix(packHash(i + vec3(0,1,1)), packHash(i + vec3(1,1,1)), f.x), f.y), f.z);\n+}`.replace(/^\+/gm, ''))
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n+float packField = packNoise(vPackDissolvePosition * vec3(5.0, 7.0, 3.0) + vec3(uPackTime * 0.22, -uPackTime * 0.16, 0.0));\n+float packCut = uPackDissolve * 1.34 - 0.22 - vPackDissolvePosition.y * 0.10;\n+if (packField < packCut) discard;\n+float packDissolveEdge = 1.0 - smoothstep(0.0, 0.075, packField - packCut);`.replace(/^\+/gm, ''))
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n+totalEmissiveRadiance += uPackEdgeColor * packDissolveEdge * (1.1 + uPackDissolve * 4.6);`.replace(/^\+/gm, ''));
  };
  material.customProgramCacheKey = () => 'arcana-pack-dissolve-v3';
  material.needsUpdate = true;
}

function addLighting(scene) {
  scene.add(new THREE.HemisphereLight(0xd9e9ff, 0x160b07, 1.5));
  const key = new THREE.DirectionalLight(0xffe7b7, 4.2);
  key.position.set(-2.8, 3.4, 4.8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8d65ff, 3.4);
  rim.position.set(3.4, 1.2, -2.5);
  scene.add(rim);
  const lower = new THREE.PointLight(0xff9e45, 26, 8, 2);
  lower.position.set(0, -2.2, 2.5);
  scene.add(lower);
}

function makeCamera(aspect = 2 / 3) {
  const camera = new THREE.PerspectiveCamera(31, aspect, 0.1, 30);
  camera.position.set(0, 0.02, 4.25);
  camera.lookAt(0, 0, 0);
  return camera;
}

async function createLivePackRuntime() {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  addLighting(scene);
  const camera = makeCamera();
  const entries = new Set();
  let raf = null;
  let disposed = false;
  let lastFrame = 0;

  function schedule() {
    if (raf === null && entries.size && !disposed) raf = requestAnimationFrame(frame);
  }

  function isVisible(canvas, rect) {
    if (!canvas?.isConnected || rect.width < 2 || rect.height < 2) return false;
    return rect.right > 0 && rect.bottom > 0
      && rect.left < window.innerWidth && rect.top < window.innerHeight;
  }

  function renderEntry(entry, now) {
    const { canvas, assembly } = entry;
    if (!assembly) return;
    const rect = canvas.getBoundingClientRect();
    if (!isVisible(canvas, rect)) return;

    // High quality deliberately pays for live GLB lighting, but all instances share
    // this one WebGL context. Each result is copied into its own ordinary canvas so
    // the pack keeps the correct DOM clipping, stacking, transforms, and occlusion.
    const dpr = Math.min(window.devicePixelRatio || 1, entries.size > 8 ? 1.25 : 1.5);
    const width = Math.max(2, Math.round(rect.width * dpr));
    const height = Math.max(2, Math.round(rect.height * dpr));
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const seconds = now / 1000;
    const pointerEnergy = Math.min(Math.hypot(entry.pointerX, entry.pointerY), 1);
    const targetX = -entry.pointerY * 0.17 - 0.025;
    const targetY = entry.pointerX * 0.23 - 0.07;
    entry.currentX += (targetX - entry.currentX) * 0.105;
    entry.currentY += (targetY - entry.currentY) * 0.105;
    assembly.group.rotation.x = entry.currentX + Math.sin(seconds * 0.53 + entry.phase) * 0.009;
    assembly.group.rotation.y = entry.currentY + Math.sin(seconds * 0.37 + entry.phase * 1.7) * 0.018;
    assembly.group.rotation.z = -0.012 + Math.sin(seconds * 0.61 + entry.phase) * 0.006;
    assembly.group.position.y = Math.sin(seconds * 0.78 + entry.phase) * 0.012;
    assembly.group.scale.setScalar(1 + pointerEnergy * 0.012);

    scene.add(assembly.group);
    renderer.render(scene, camera);
    scene.remove(assembly.group);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    entry.context.clearRect(0, 0, width, height);
    entry.context.drawImage(renderer.domElement, 0, 0, width, height);
    if (!entry.ready) {
      entry.ready = true;
      entry.onReady?.();
    }
  }

  function frame(now) {
    raf = null;
    if (disposed || !entries.size) return;
    // Twenty-four genuinely rendered frames per second is enough for the deliberately
    // restrained idle foil motion and keeps several shop/shelf packs inexpensive.
    if (now - lastFrame >= 1000 / 24) {
      lastFrame = now;
      entries.forEach(entry => renderEntry(entry, now));
    }
    schedule();
  }

  function register({ canvas, packType, onReady }) {
    if (!canvas) throw new Error('A canvas is required for a live pack');
    const entry = {
      canvas,
      context: canvas.getContext('2d'),
      assembly: null,
      pointerX: 0,
      pointerY: 0,
      currentX: -0.025,
      currentY: -0.07,
      phase: Math.random() * Math.PI * 2,
      onReady,
      ready: false,
      removed: false,
    };
    entries.add(entry);
    makePackAssembly(packType).then(assembly => {
      if (entry.removed) {
        assembly.wrapperMaterial.dispose();
        assembly.labelMaterial.dispose();
        assembly.labelGeometry.dispose();
        return;
      }
      entry.assembly = assembly;
      schedule();
    }).catch(() => {
      entries.delete(entry);
    });
    schedule();

    return {
      setPointer(x, y) {
        entry.pointerX = THREE.MathUtils.clamp(x, -1, 1);
        entry.pointerY = THREE.MathUtils.clamp(y, -1, 1);
      },
      dispose() {
        if (entry.removed) return;
        entry.removed = true;
        entries.delete(entry);
        entry.assembly?.wrapperMaterial.dispose();
        entry.assembly?.labelMaterial.dispose();
        entry.assembly?.labelGeometry.dispose();
        entry.assembly = null;
        if (!entries.size && raf !== null) {
          cancelAnimationFrame(raf);
          raf = null;
        }
      },
    };
  }

  return { register };
}

/**
 * Register a continuously rendered GLB pack. All ordinary pack instances share one
 * hidden renderer instead of opening a WebGL context apiece; the altar keeps its own
 * context because its dissolve shader and particles have a different lifecycle.
 */
export async function registerLivePack(options) {
  if (!liveRuntimePromise) {
    liveRuntimePromise = createLivePackRuntime().catch(error => {
      liveRuntimePromise = null;
      throw error;
    });
  }
  const runtime = await liveRuntimePromise;
  return runtime.register(options);
}

function makeEvaporationParticles(packType) {
  const count = 720;
  const positions = new Float32Array(count * 3);
  const directions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 1.18;
    positions[i3 + 1] = (Math.random() - 0.5) * 1.92;
    positions[i3 + 2] = 0.08 + (Math.random() - 0.5) * 0.14;
    directions[i3] = (Math.random() - 0.5) * 0.75;
    directions[i3 + 1] = 0.3 + Math.random() * 1.1;
    directions[i3 + 2] = (Math.random() - 0.5) * 0.6;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aDirection', new THREE.BufferAttribute(directions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const [, , light] = paletteFor(packType);
  const uniforms = {
    progress: { value: 0 },
    time: { value: 0 },
    color: { value: new THREE.Color(light) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uProgress: uniforms.progress,
      uTime: uniforms.time,
      uColor: uniforms.color,
    },
    vertexShader: `
      attribute vec3 aDirection;
      attribute float aSeed;
      uniform float uProgress;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        float birth = smoothstep(aSeed * 0.72, aSeed * 0.72 + 0.2, uProgress);
        float age = max(0.0, uProgress - aSeed * 0.48);
        vec3 p = position;
        p += aDirection * age * (0.55 + aSeed * 0.65);
        p.x += sin(uTime * 3.0 + aSeed * 31.0) * age * 0.12;
        p.y += age * age * 0.75;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        // Point size is already measured in screen pixels. Multiplying by a
        // perspective-scale constant here made each mote hundreds of pixels wide,
        // so their additive quads merged into a solid white canvas during opening.
        gl_PointSize = (1.6 + aSeed * 3.4) * birth * (1.0 - smoothstep(0.78, 1.16, uProgress));
        vAlpha = birth * (1.0 - smoothstep(0.72, 1.12, uProgress));
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float d = length(q);
        if (d > 0.5) discard;
        float glow = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor * (1.2 + glow * 1.8), glow * vAlpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 5;
  return { points, geometry, material, uniforms };
}

/** Mount the interactive altar render. It owns one context briefly, only while a pack is opening. */
export async function mountOpeningPack({ canvas, packType, onReady }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: (window.devicePixelRatio || 1) < 2,
    powerPreference: 'default',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  addLighting(scene);
  const camera = makeCamera();
  const assembly = await makePackAssembly(packType, { dissolving: true });
  scene.add(assembly.group);
  const particles = makeEvaporationParticles(packType);
  particles.points.visible = false;
  scene.add(particles.points);

  let disposed = false;
  let raf = null;
  let dissolveStartedAt = null;
  let pointerX = 0;
  let pointerY = 0;
  let currentX = -0.025;
  let currentY = -0.07;

  function resize() {
    if (disposed) return;
    const parent = canvas.parentElement;
    const width = Math.max(2, parent?.clientWidth ?? 200);
    const height = Math.max(2, parent?.clientHeight ?? 300);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function setPointer(normalX, normalY) {
    pointerX = THREE.MathUtils.clamp(normalX, -1, 1);
    pointerY = THREE.MathUtils.clamp(normalY, -1, 1);
  }

  function startDissolve() {
    if (dissolveStartedAt === null) dissolveStartedAt = performance.now();
  }

  function frame(now) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const elapsed = now / 1000;
    const progress = dissolveStartedAt === null
      ? 0
      : THREE.MathUtils.clamp((now - dissolveStartedAt) / OPEN_DURATION_MS, 0, 1.18);

    const targetY = dissolveStartedAt === null ? pointerX * 0.18 - 0.07 : pointerX * 0.05;
    const targetX = dissolveStartedAt === null ? pointerY * 0.13 - 0.025 : 0;
    currentX += (targetX - currentX) * 0.085;
    currentY += (targetY - currentY) * 0.085;
    assembly.group.rotation.x = currentX;
    assembly.group.rotation.y = currentY;
    assembly.group.rotation.z = Math.sin(elapsed * 0.72) * 0.012;
    assembly.group.position.y = Math.sin(elapsed * 1.15) * 0.025 + progress * 0.08;
    assembly.group.scale.setScalar(1 + Math.sin(Math.min(progress, 1) * Math.PI) * 0.055);

    assembly.dissolveUniforms.forEach(uniforms => {
      uniforms.progress.value = progress;
      uniforms.time.value = elapsed;
    });
    particles.points.visible = progress > 0.015;
    particles.uniforms.progress.value = progress;
    particles.uniforms.time.value = elapsed;
    renderer.render(scene, camera);
  }

  resize();
  raf = requestAnimationFrame(frame);
  onReady?.();

  return {
    resize,
    setPointer,
    startDissolve,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      assembly.wrapperMaterial.dispose();
      assembly.labelMaterial.dispose();
      assembly.labelGeometry.dispose();
      particles.geometry.dispose();
      particles.material.dispose();
      renderer.dispose();
      // Do not force-loss this canvas. React's development StrictMode deliberately
      // mounts, cleans up, and remounts effects once; a stale first mount can finish
      // loading after the second renderer already owns the same DOM canvas. Losing
      // the shared context there would blank the live renderer. Normal dispose plus
      // unmount is enough for this short-lived altar scene.
    },
  };
}
