/**
 * Foundry backdrop — an open-roofed underground forge chamber.
 *
 * The composition is intentionally built as a diorama rather than a tunnel: a dark rock
 * amphitheatre frames a broad worked floor, two mine portals feed curving rails into the
 * room, and a masonry furnace anchors the centre. Lava on both flanks supplies the warm
 * edge light and leads the eye toward the lower bridge. Everything is procedural and
 * deterministic; repeated detail is instanced and the only textures are tiny in-memory
 * radial masks for atmospheric particles.
 *
 * `THREE` is passed in so this module never pulls three.js into the main bundle. The
 * runtime remains responsible for the 30 fps cap, visibility pause and quality fallback.
 */

function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeGlowTexture(THREE) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.22, 'rgba(255,226,170,0.8)');
  gradient.addColorStop(0.55, 'rgba(255,154,70,0.22)');
  gradient.addColorStop(1, 'rgba(255,100,20,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roughenGeometry(THREE, geometry, seed, amount = 0.18) {
  const rng = makeRng(seed);
  const position = geometry.attributes.position;
  const direction = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    direction.fromBufferAttribute(position, i);
    const length = Math.max(0.001, direction.length());
    const wave = Math.sin(direction.x * 5.7 + direction.y * 3.1 + direction.z * 7.3 + seed);
    const scale = 1 + amount * (0.58 * wave + 0.42 * (rng() * 2 - 1));
    direction.multiplyScalar(scale / length * length);
    position.setXYZ(i, direction.x, direction.y, direction.z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function addRockSurfaceShader(material, cacheKey) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFoundryRockWorld;')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec4 foundryRockWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          foundryRockWorld = instanceMatrix * foundryRockWorld;
        #endif
        foundryRockWorld = modelMatrix * foundryRockWorld;
        vFoundryRockWorld = foundryRockWorld.xyz;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        varying vec3 vFoundryRockWorld;
        float foundryRockHash(vec3 p) {
          return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        }
      `)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        vec3 rockCell = floor(vFoundryRockWorld * 0.72);
        float grain = foundryRockHash(rockCell);
        float broad = sin(vFoundryRockWorld.x * 0.21 + vFoundryRockWorld.z * 0.13)
          * sin(vFoundryRockWorld.y * 0.31 - vFoundryRockWorld.z * 0.17);
        float strata = 0.5 + 0.5 * sin(vFoundryRockWorld.y * 1.35
          + vFoundryRockWorld.x * 0.08 + broad * 1.7);
        diffuseColor.rgb *= 0.79 + grain * 0.17 + strata * 0.09;
      `);
  };
  material.customProgramCacheKey = () => `foundry-rock-${cacheKey}`;
  return material;
}

function composeInstance(THREE, mesh, index, descriptor, scratch) {
  const {
    x = 0, y = 0, z = 0,
    sx = 1, sy = 1, sz = 1,
    rx = 0, ry = 0, rz = 0,
    color = 0xffffff,
  } = descriptor;
  scratch.position.set(x, y, z);
  scratch.euler.set(rx, ry, rz);
  scratch.quaternion.setFromEuler(scratch.euler);
  scratch.scale.set(sx, sy, sz);
  scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
  mesh.setMatrixAt(index, scratch.matrix);
  mesh.setColorAt(index, scratch.color.setHex(color));
}

function buildInstancedBoxes(THREE, track, scene, descriptors, materialOptions) {
  if (!descriptors.length) return null;
  const geometry = track(new THREE.BoxGeometry(1, 1, 1));
  const material = track(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.04,
    flatShading: true,
    ...materialOptions,
  }));
  const mesh = new THREE.InstancedMesh(geometry, material, descriptors.length);
  const scratch = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3(),
    euler: new THREE.Euler(),
    matrix: new THREE.Matrix4(),
    color: new THREE.Color(),
  };
  descriptors.forEach((descriptor, index) => composeInstance(THREE, mesh, index, descriptor, scratch));
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

function buildGround(THREE, track, scene, rng) {
  const geometry = track(new THREE.PlaneGeometry(118, 84, 40, 30));
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const edge = Math.max(Math.abs(x) / 59, Math.abs(z) / 42);
    const height = 0.24 * Math.sin(x * 0.23 + z * 0.17)
      + 0.14 * Math.sin(x * 0.61 - z * 0.38)
      - Math.max(0, edge - 0.82) * 2.2;
    position.setY(i, height);
    const variation = 0.78 + rng() * 0.28 + 0.08 * Math.sin(x * 0.14 - z * 0.11);
    color.setHex(0x49362a).multiplyScalar(variation);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  position.needsUpdate = true;
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = track(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.02,
  }));
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 vFoundryGround;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFoundryGround = position;');
    shader.fragmentShader = `varying vec3 vFoundryGround;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        vec2 tile = vFoundryGround.xz / vec2(4.4, 3.8);
        vec2 gridDist = abs(fract(tile) - 0.5);
        float mortar = smoothstep(0.462, 0.497, max(gridDist.x, gridDist.y));
        float broad = sin(vFoundryGround.x * 0.51 + vFoundryGround.z * 0.23)
          * sin(vFoundryGround.z * 0.73 - vFoundryGround.x * 0.19);
        diffuseColor.rgb *= (0.88 + 0.12 * broad) * (1.0 - mortar * 0.24);
      `);
  };

  const floor = new THREE.Mesh(geometry, material);
  floor.position.y = 0;
  scene.add(floor);

  const chasmGeometry = track(new THREE.PlaneGeometry(220, 170));
  chasmGeometry.rotateX(-Math.PI / 2);
  const chasmMaterial = track(new THREE.MeshStandardMaterial({
    color: 0x130c09,
    roughness: 1,
    metalness: 0,
  }));
  const chasm = new THREE.Mesh(chasmGeometry, chasmMaterial);
  chasm.position.y = -5.2;
  scene.add(chasm);
}

function buildCaveMasses(THREE, track, scene, rng) {
  const backMaterial = track(addRockSurfaceShader(new THREE.MeshStandardMaterial({
    color: 0x35241c,
    roughness: 0.98,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
  }), 'back'));
  const backMass = new THREE.Mesh(track(new THREE.PlaneGeometry(166, 52, 20, 8)), backMaterial);
  backMass.position.set(0, 18, -65);
  scene.add(backMass);

  const geometries = [
    roughenGeometry(THREE, track(new THREE.IcosahedronGeometry(1, 2)), 17, 0.16),
    roughenGeometry(THREE, track(new THREE.DodecahedronGeometry(1, 1)), 41, 0.19),
    roughenGeometry(THREE, track(new THREE.SphereGeometry(1, 14, 10)), 79, 0.16),
  ];
  const material = track(addRockSurfaceShader(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.02,
    flatShading: false,
  }), 'mass'));
  const palettes = [0x3c2a22, 0x493126, 0x56392a, 0x62402d, 0x31231e, 0x6b4731];
  const descriptors = [[], [], []];

  const pushRock = descriptor => {
    descriptors[Math.floor(rng() * descriptors.length)].push(descriptor);
  };

  for (let row = 0; row < 5; row += 1) {
    for (let x = -78; x <= 78; x += 5.8 + rng() * 2.6) {
      if (row < 3 && Math.abs(Math.abs(x) - 38) < 12.5) continue;
      const s = 4.2 + rng() * 4.5;
      pushRock({
        x: x + (rng() - 0.5) * 4,
        y: row * 5.2 + s * 0.28 + (rng() - 0.5) * 1.6,
        z: -50 - rng() * 10,
        sx: s * (0.85 + rng() * 0.6),
        sy: s * (0.62 + rng() * 0.7),
        sz: s * (0.72 + rng() * 0.5),
        rx: rng() * Math.PI,
        ry: rng() * Math.PI,
        rz: rng() * Math.PI,
        color: palettes[Math.floor(rng() * palettes.length)],
      });
    }
  }

  for (const side of [-1, 1]) {
    for (let z = -52; z <= 58; z += 5.5 + rng() * 2.5) {
      for (let row = 0; row < 4; row += 1) {
        const s = 4.2 + rng() * 4.8;
        pushRock({
          x: side * (58 + rng() * 12),
          y: row * 5 + s * 0.25,
          z: z + (rng() - 0.5) * 5,
          sx: s * (0.8 + rng() * 0.6),
          sy: s * (0.65 + rng() * 0.75),
          sz: s * (0.85 + rng() * 0.7),
          rx: rng() * Math.PI,
          ry: rng() * Math.PI,
          rz: rng() * Math.PI,
          color: palettes[Math.floor(rng() * palettes.length)],
        });
      }
    }
  }

  for (let x = -80; x <= 80; x += 6 + rng() * 3.2) {
    const centreClear = Math.abs(x) < 24;
    const s = centreClear ? 3.6 + rng() * 3.8 : 4.4 + rng() * 5.0;
    pushRock({
      x: x + (rng() - 0.5) * 5,
      y: -1 + s * 0.25,
      z: (centreClear ? 57 : 51) + rng() * (centreClear ? 4 : 11),
      sx: s * (0.9 + rng() * 0.55),
      sy: s * (0.55 + rng() * 0.65),
      sz: s * (0.82 + rng() * 0.65),
      rx: rng() * Math.PI,
      ry: rng() * Math.PI,
      rz: rng() * Math.PI,
      color: palettes[Math.floor(rng() * palettes.length)],
    });
  }

  const meshes = descriptors.map((items, variant) => {
    const mesh = new THREE.InstancedMesh(geometries[variant], material, items.length);
    const scratch = {
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
      euler: new THREE.Euler(),
      matrix: new THREE.Matrix4(),
      color: new THREE.Color(),
    };
    items.forEach((descriptor, index) => composeInstance(THREE, mesh, index, descriptor, scratch));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    return mesh;
  });

  return { pushRock, meshes, geometries, material };
}

function makeLavaMaterial(THREE, track) {
  return track(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorld;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amp = 0.55;
        for (int i = 0; i < 4; i++) {
          value += noise(p) * amp;
          p = p * 2.03 + 7.1;
          amp *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 flowUv = vec2(vUv.x * 5.0, vUv.y * 3.2 - uTime * 0.24);
        float flow = fbm(flowUv + vec2(sin(vUv.y * 8.0) * 0.28, 0.0));
        float veins = abs(sin((flow + vUv.y * 0.72) * 18.0));
        float hot = smoothstep(0.14, 0.86, flow) + 0.38 * pow(1.0 - veins, 5.0);
        float edge = smoothstep(0.0, 0.17, vUv.x) * smoothstep(1.0, 0.83, vUv.x);
        hot *= 0.72 + 0.28 * edge;
        vec3 deep = vec3(0.42, 0.035, 0.005);
        vec3 orange = vec3(1.65, 0.24, 0.016);
        vec3 yellow = vec3(2.45, 0.62, 0.075);
        vec3 color = mix(deep, orange, clamp(hot, 0.0, 1.0));
        color = mix(color, yellow, smoothstep(0.72, 1.18, hot));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.DoubleSide,
    depthWrite: true,
    toneMapped: false,
  }));
}

function makeRibbonGeometry(THREE, track, points, y = 0.24) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const distances = [0];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    distances.push(total);
  }

  for (let i = 0; i < points.length; i += 1) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const inv = 1 / Math.max(0.001, Math.hypot(dx, dz));
    const nx = -dz * inv;
    const nz = dx * inv;
    const width = points[i].width;
    positions.push(points[i].x + nx * width, y, points[i].z + nz * width);
    positions.push(points[i].x - nx * width, y, points[i].z - nz * width);
    const v = distances[i] / Math.max(0.001, total);
    uvs.push(0, v, 1, v);
    if (i < points.length - 1) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }

  const geometry = track(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildLava(THREE, track, scene) {
  const material = makeLavaMaterial(THREE, track);
  const rivers = [
    [
      { x: -50, z: -50, width: 3.2 }, { x: -52, z: -34, width: 3.7 },
      { x: -49, z: -18, width: 3.1 }, { x: -53, z: -2, width: 4.0 },
      { x: -48, z: 15, width: 3.7 }, { x: -52, z: 32, width: 4.4 },
      { x: -46, z: 51, width: 5.0 },
    ],
    [
      { x: 60, z: -18, width: 3.4 }, { x: 55, z: -5, width: 4.0 },
      { x: 58, z: 10, width: 3.5 }, { x: 50, z: 24, width: 4.4 },
      { x: 48, z: 39, width: 5.1 }, { x: 39, z: 55, width: 6.0 },
    ],
    [
      { x: 22, z: 50, width: 3.5 }, { x: 30, z: 45, width: 4.2 },
      { x: 39, z: 42, width: 4.6 }, { x: 49, z: 39, width: 5.1 },
    ],
  ];
  for (const points of rivers) {
    scene.add(new THREE.Mesh(makeRibbonGeometry(THREE, track, points), material));
  }

  const waterfallGeometry = track(new THREE.PlaneGeometry(8, 17, 4, 14));
  const falls = [
    { x: -50, y: 9, z: -49, sx: 1, sy: 1, rz: -0.06 },
    { x: 59, y: 7.2, z: -18, sx: 0.78, sy: 0.8, rz: 0.08 },
    { x: 42, y: 5.5, z: 50, sx: 0.7, sy: 0.62, rz: -0.12 },
  ];
  for (const fall of falls) {
    const mesh = new THREE.Mesh(waterfallGeometry, material);
    mesh.position.set(fall.x, fall.y, fall.z);
    mesh.scale.set(fall.sx, fall.sy, 1);
    mesh.rotation.z = fall.rz;
    scene.add(mesh);
  }
  return material;
}

function makeOffsetCurve(THREE, curve, offset, divisions = 56) {
  const points = [];
  for (let i = 0; i <= divisions; i += 1) {
    const t = i / divisions;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    points.push(new THREE.Vector3(
      point.x - tangent.z * offset,
      point.y,
      point.z + tangent.x * offset,
    ));
  }
  return new THREE.CatmullRomCurve3(points, false, 'centripetal');
}

function buildRails(THREE, track, scene) {
  const paths = [
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-38, 1.05, -46), new THREE.Vector3(-33, 1.05, -31),
      new THREE.Vector3(-31, 1.05, -13), new THREE.Vector3(-27, 1.05, 5),
      new THREE.Vector3(-18, 1.05, 23), new THREE.Vector3(-5, 1.05, 38),
    ], false, 'centripetal'),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-6, 1.05, 38), new THREE.Vector3(12, 1.05, 38.5),
      new THREE.Vector3(31, 1.05, 39), new THREE.Vector3(54, 1.05, 40),
    ], false, 'centripetal'),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(38, 1.05, -46), new THREE.Vector3(35, 1.05, -27),
      new THREE.Vector3(32, 1.05, -9), new THREE.Vector3(35, 1.05, 9),
      new THREE.Vector3(44, 1.05, 25), new THREE.Vector3(54, 1.05, 40),
    ], false, 'centripetal'),
  ];
  const railMaterial = track(new THREE.MeshStandardMaterial({
    color: 0x918071,
    roughness: 0.34,
    metalness: 0.88,
  }));
  for (const curve of paths) {
    for (const offset of [-2.05, 2.05]) {
      const geometry = track(new THREE.TubeGeometry(makeOffsetCurve(THREE, curve, offset), 72, 0.2, 5, false));
      scene.add(new THREE.Mesh(geometry, railMaterial));
    }
  }

  const sleeperDescriptors = [];
  for (const curve of paths) {
    const count = Math.max(8, Math.floor(curve.getLength() / 3.1));
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      sleeperDescriptors.push({
        x: point.x,
        y: 0.66,
        z: point.z,
        sx: 5.6,
        sy: 0.34,
        sz: 0.72,
        ry: Math.atan2(tangent.x, tangent.z),
        color: i % 3 === 0 ? 0x3b271b : 0x49301f,
      });
    }
  }
  buildInstancedBoxes(THREE, track, scene, sleeperDescriptors, { roughness: 0.92, metalness: 0 });
  return paths;
}

function addTimberFrame(descriptors, x, z, width = 18, height = 13) {
  const color = 0x4a2c18;
  descriptors.push(
    { x: x - width / 2, y: height / 2, z, sx: 1.5, sy: height, sz: 1.6, color },
    { x: x + width / 2, y: height / 2, z, sx: 1.5, sy: height, sz: 1.6, color },
    { x, y: height, z, sx: width + 2.4, sy: 1.7, sz: 1.8, color },
    { x: x - width * 0.26, y: height * 0.58, z: z + 0.2, sx: 1.0, sy: height * 0.78, sz: 1.0, rz: -0.72, color: 0x56351f },
    { x: x + width * 0.26, y: height * 0.58, z: z + 0.2, sx: 1.0, sy: height * 0.78, sz: 1.0, rz: 0.72, color: 0x56351f },
  );
}

function buildArchitecture(THREE, track, scene, rng) {
  const timbers = [];
  addTimberFrame(timbers, -38, -46, 19, 14);
  addTimberFrame(timbers, 38, -46, 19, 14);

  for (const x of [-5, 11, 27, 43, 58]) {
    timbers.push(
      { x, y: -1.4, z: 38, sx: 1.8, sy: 10, sz: 1.8, color: 0x3e281b },
      { x, y: -0.7, z: 33.5, sx: 1.3, sy: 8.6, sz: 1.3, color: 0x4c3020 },
      { x, y: -0.7, z: 42.5, sx: 1.3, sy: 8.6, sz: 1.3, color: 0x4c3020 },
    );
  }
  timbers.push(
    { x: 27, y: 0.15, z: 34, sx: 68, sy: 1.15, sz: 1.15, color: 0x4c3020 },
    { x: 27, y: 0.15, z: 43, sx: 68, sy: 1.15, sz: 1.15, color: 0x4c3020 },
  );

  addTimberFrame(timbers, 43, 9, 18, 12);
  addTimberFrame(timbers, -26, 18, 18, 10);
  for (const x of [-39, -23, 27, 43]) {
    timbers.push(
      { x, y: 4.8, z: -23, sx: 1.2, sy: 9.6, sz: 1.2, color: 0x4a2c18 },
      { x, y: 9.4, z: -23, sx: 14, sy: 1.1, sz: 1.2, color: 0x56351f },
    );
  }
  buildInstancedBoxes(THREE, track, scene, timbers, { roughness: 0.9, metalness: 0 });

  const stone = [];
  const brick = (x, y, z, sx, sy, sz, color = 0x514238) => stone.push({ x, y, z, sx, sy, sz, color });
  brick(2, 1.2, -9, 20, 2.4, 14, 0x493a31);
  brick(2, 6.1, -11, 17, 8, 11, 0x57463a);
  brick(2, 10.7, -12, 14, 2.3, 9, 0x49392f);
  brick(2, 15, -12.5, 8, 6.8, 7, 0x44352d);
  brick(2, 20.2, -13, 6.4, 4.2, 6, 0x3d3029);
  brick(2, 23.6, -13.3, 5.2, 2.8, 5.2, 0x342923);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      brick(-4 + col * 4.1 + (row % 2) * 1.1, 3.6 + row * 2.7, -4.7,
        3.7, 2.4, 1.2, row % 2 ? 0x5e4a3d : 0x524137);
    }
  }
  buildInstancedBoxes(THREE, track, scene, stone, { roughness: 0.93, metalness: 0.03 });

  const darkMaterial = track(new THREE.MeshBasicMaterial({ color: 0x080504 }));
  const portalGeometry = track(new THREE.PlaneGeometry(17, 13));
  for (const x of [-38, 38]) {
    const portal = new THREE.Mesh(portalGeometry, darkMaterial);
    portal.position.set(x, 6.5, -47.05);
    scene.add(portal);
  }

  const mouth = new THREE.Mesh(track(new THREE.PlaneGeometry(7.2, 5.1)), darkMaterial);
  mouth.position.set(2, 5.1, -4.05);
  scene.add(mouth);
  const fireMaterial = makeLavaMaterial(THREE, track);
  const fire = new THREE.Mesh(track(new THREE.PlaneGeometry(5.5, 3.5, 4, 4)), fireMaterial);
  fire.position.set(2, 4.75, -3.92);
  scene.add(fire);

  const propBoxes = [];
  const metal = 0x5d5650;
  propBoxes.push(
    { x: 17, y: 2.1, z: 6, sx: 7.4, sy: 1.3, sz: 3.0, color: metal },
    { x: 17, y: 1.0, z: 6, sx: 2.3, sy: 2.3, sz: 2.2, color: 0x45413d },
    { x: 17, y: 0.45, z: 6, sx: 4.5, sy: 0.9, sz: 3.6, color: 0x494038 },
    { x: -8, y: 1.5, z: 12, sx: 13, sy: 1.2, sz: 5.8, color: 0x4d2e1b },
    { x: -13.5, y: 3.4, z: 12, sx: 1, sy: 5.2, sz: 1, color: 0x3b2518 },
    { x: -2.5, y: 3.4, z: 12, sx: 1, sy: 5.2, sz: 1, color: 0x3b2518 },
    { x: 26, y: 1.5, z: -18, sx: 15, sy: 1.15, sz: 5.8, color: 0x4d2e1b },
    { x: 19.5, y: 3.5, z: -18, sx: 1, sy: 5.2, sz: 1, color: 0x3b2518 },
    { x: 32.5, y: 3.5, z: -18, sx: 1, sy: 5.2, sz: 1, color: 0x3b2518 },
  );

  for (const cart of [{ x: 15, z: 39 }, { x: 45, z: 39.5 }]) {
    propBoxes.push(
      { x: cart.x, y: 3.05, z: cart.z, sx: 9, sy: 3.5, sz: 5.2, color: 0x443025 },
      { x: cart.x, y: 4.35, z: cart.z, sx: 8.1, sy: 0.65, sz: 5.8, color: 0x5b3a23 },
    );
  }
  for (let i = 0; i < 11; i += 1) {
    const x = rng() < 0.55 ? 28 + rng() * 16 : -33 + rng() * 12;
    const z = rng() < 0.55 ? -3 + rng() * 20 : 8 + rng() * 22;
    const s = 2 + rng() * 2;
    propBoxes.push({
      x, y: s * 0.5, z, sx: s, sy: s, sz: s,
      ry: (rng() - 0.5) * 0.24,
      color: rng() < 0.3 ? 0x5a3a21 : 0x49301e,
    });
  }
  buildInstancedBoxes(THREE, track, scene, propBoxes, { roughness: 0.74, metalness: 0.16 });

  const tools = [];
  for (let i = 0; i < 12; i += 1) {
    const leftRack = i < 6;
    tools.push({
      x: leftRack ? -20 + i * 1.7 : 21 + (i - 6) * 1.8,
      y: 4.6 + (i % 2) * 0.9,
      z: leftRack ? -21.9 : -19.2,
      sx: 0.22,
      sy: 6.4 + (i % 3),
      sz: 0.22,
      rz: (i % 2 ? 1 : -1) * 0.16,
      color: i % 3 === 0 ? 0x8b735a : 0x625c56,
    });
  }
  tools.push(
    { x: -18, y: 2.3, z: -22, sx: 14, sy: 0.55, sz: 0.6, color: 0x4b2d1b },
    { x: 26, y: 2.3, z: -19, sx: 15, sy: 0.55, sz: 0.6, color: 0x4b2d1b },
  );
  buildInstancedBoxes(THREE, track, scene, tools, { roughness: 0.42, metalness: 0.68 });

  const wheelGeometry = track(new THREE.CylinderGeometry(1, 1, 0.48, 10));
  wheelGeometry.rotateZ(Math.PI / 2);
  const wheelMaterial = track(new THREE.MeshStandardMaterial({ color: 0x302c29, roughness: 0.45, metalness: 0.85 }));
  const wheels = new THREE.InstancedMesh(wheelGeometry, wheelMaterial, 8);
  const scratch = new THREE.Matrix4();
  let wheelIndex = 0;
  for (const cart of [{ x: 15, z: 39 }, { x: 45, z: 39.5 }]) {
    for (const dx of [-3.1, 3.1]) {
      for (const dz of [-2.3, 2.3]) {
        scratch.makeTranslation(cart.x + dx, 1.25, cart.z + dz);
        wheels.setMatrixAt(wheelIndex, scratch);
        wheelIndex += 1;
      }
    }
  }
  wheels.instanceMatrix.needsUpdate = true;
  scene.add(wheels);

  return { fireMaterial };
}

function buildSmallRocks(THREE, track, scene, rng) {
  const geometry = roughenGeometry(THREE, track(new THREE.IcosahedronGeometry(1, 0)), 119, 0.23);
  const material = track(addRockSurfaceShader(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.02,
    flatShading: true,
  }), 'rubble'));
  const count = 270;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();
  const color = new THREE.Color();
  const hues = [0x382a24, 0x47342a, 0x554033, 0x2b211c, 0x614735];
  for (let i = 0; i < count; i += 1) {
    const bank = i < 180;
    let x;
    let z;
    if (bank) {
      const right = rng() < 0.5;
      z = -47 + rng() * 99;
      const centre = right
        ? 56 - 0.14 * Math.max(0, z + 10)
        : -50 + Math.sin(z * 0.09) * 3;
      x = centre + (rng() < 0.5 ? -1 : 1) * (4.2 + rng() * 4.7);
    } else {
      const cartOre = i >= 230;
      if (cartOre) {
        const cartX = rng() < 0.5 ? 15 : 45;
        x = cartX + (rng() - 0.5) * 6.2;
        z = 39.2 + (rng() - 0.5) * 3.4;
      } else {
        x = (rng() - 0.5) * 105;
        z = (rng() - 0.5) * 79;
      }
    }
    const s = i >= 230 ? 0.65 + rng() * 1.2 : 0.38 + rng() * 1.5;
    position.set(x, (i >= 230 ? 4.8 : 0.2) + s * 0.34, z);
    euler.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    quaternion.setFromEuler(euler);
    scale.set(s * (0.8 + rng() * 0.8), s * (0.5 + rng() * 0.55), s * (0.8 + rng() * 0.7));
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, color.setHex(i >= 230 && rng() < 0.25 ? 0x8b6238 : hues[Math.floor(rng() * hues.length)]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
}

function buildAtmosphere(THREE, track, scene, rng) {
  const glowTexture = track(makeGlowTexture(THREE));
  const lampPositions = [
    new THREE.Vector3(-48, 9, -32), new THREE.Vector3(-18, 8, 20),
    new THREE.Vector3(25, 10, -31), new THREE.Vector3(47, 8, 12),
    new THREE.Vector3(29, 7.5, 39),
  ];
  const lampGeometry = track(new THREE.BufferGeometry().setFromPoints(lampPositions));
  const lampMaterial = track(new THREE.PointsMaterial({
    map: glowTexture,
    color: 0xffb45f,
    size: 16,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  }));
  scene.add(new THREE.Points(lampGeometry, lampMaterial));

  const pointLights = lampPositions.map((position, index) => {
    const intensity = index === 4 ? 310 : 380;
    const light = new THREE.PointLight(index === 2 ? 0xffc47d : 0xff9a45, intensity, 64, 1.68);
    light.position.copy(position);
    scene.add(light);
    return { light, intensity, phase: rng() * Math.PI * 2 };
  });

  const furnaceLight = new THREE.PointLight(0xff7a25, 690, 92, 1.64);
  furnaceLight.position.set(2, 7, -1);
  scene.add(furnaceLight);

  const lavaLights = [
    { position: [-49, 3, -1], intensity: 390 },
    { position: [52, 3, 18], intensity: 420 },
    { position: [35, 1, 48], intensity: 310 },
  ].map(item => {
    const light = new THREE.PointLight(0xff5a13, item.intensity, 72, 1.66);
    light.position.set(...item.position);
    scene.add(light);
    return { light, intensity: item.intensity, phase: rng() * 5 };
  });

  const smokeCount = 90;
  const smokeGeometry = track(new THREE.BufferGeometry());
  const smokePositions = new Float32Array(smokeCount * 3);
  const smokeSeeds = new Float32Array(smokeCount);
  const smokeSizes = new Float32Array(smokeCount);
  for (let i = 0; i < smokeCount; i += 1) {
    smokePositions[i * 3] = 2 + (rng() - 0.5) * 2.2;
    smokePositions[i * 3 + 1] = 24 + rng() * 2;
    smokePositions[i * 3 + 2] = -13 + (rng() - 0.5) * 1.4;
    smokeSeeds[i] = rng();
    smokeSizes[i] = 7 + rng() * 12;
  }
  smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
  smokeGeometry.setAttribute('aSeed', new THREE.BufferAttribute(smokeSeeds, 1));
  smokeGeometry.setAttribute('aSize', new THREE.BufferAttribute(smokeSizes, 1));
  const smokeMaterial = track(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      attribute float aSeed;
      attribute float aSize;
      varying float vLife;
      void main() {
        float life = fract(aSeed + uTime * 0.035);
        vLife = life;
        vec3 p = position;
        p.y += life * 26.0;
        p.x += sin(aSeed * 31.0 + uTime * 0.34 + life * 5.0) * (0.8 + life * 3.0);
        p.z += cos(aSeed * 19.0 + uTime * 0.27 + life * 4.0) * (0.4 + life * 1.8);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * (0.5 + life * 1.15);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vLife;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float disc = smoothstep(0.5, 0.08, length(q));
        float fade = smoothstep(0.0, 0.16, vLife) * (1.0 - smoothstep(0.68, 1.0, vLife));
        gl_FragColor = vec4(vec3(0.105, 0.085, 0.072), disc * fade * 0.23);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  }));
  scene.add(new THREE.Points(smokeGeometry, smokeMaterial));

  const emberCount = 135;
  const emberGeometry = track(new THREE.BufferGeometry());
  const emberPositions = new Float32Array(emberCount * 3);
  const emberSeeds = new Float32Array(emberCount);
  const emberSizes = new Float32Array(emberCount);
  for (let i = 0; i < emberCount; i += 1) {
    const source = rng();
    const base = source < 0.46 ? [2, 7, -1] : source < 0.72 ? [-49, 2, 2] : [51, 2, 20];
    emberPositions[i * 3] = base[0] + (rng() - 0.5) * 10;
    emberPositions[i * 3 + 1] = base[1] + rng() * 2;
    emberPositions[i * 3 + 2] = base[2] + (rng() - 0.5) * 16;
    emberSeeds[i] = rng();
    emberSizes[i] = 1.4 + rng() * 3.4;
  }
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
  emberGeometry.setAttribute('aSeed', new THREE.BufferAttribute(emberSeeds, 1));
  emberGeometry.setAttribute('aSize', new THREE.BufferAttribute(emberSizes, 1));
  const emberMaterial = track(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      attribute float aSeed;
      attribute float aSize;
      varying float vFade;
      void main() {
        float life = fract(aSeed + uTime * (0.07 + aSeed * 0.04));
        vec3 p = position;
        p.y += life * (8.0 + aSeed * 9.0);
        p.x += sin(aSeed * 41.0 + uTime * 0.9) * life * 2.4;
        p.z += cos(aSeed * 27.0 + uTime * 0.7) * life * 1.3;
        vFade = 1.0 - smoothstep(0.5, 1.0, life);
        gl_PointSize = aSize;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying float vFade;
      void main() {
        float disc = smoothstep(0.5, 0.12, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(3.2, 0.66, 0.08, disc * vFade);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  scene.add(new THREE.Points(emberGeometry, emberMaterial));

  const dustCount = 170;
  const dustGeometry = track(new THREE.BufferGeometry());
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i += 1) {
    dustPositions[i * 3] = (rng() - 0.5) * 120;
    dustPositions[i * 3 + 1] = 2 + rng() * 28;
    dustPositions[i * 3 + 2] = -45 + rng() * 91;
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = track(new THREE.PointsMaterial({
    map: glowTexture,
    color: 0xd6a66f,
    size: 0.72,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dust);

  return {
    pointLights,
    furnaceLight,
    lavaLights,
    smokeMaterial,
    emberMaterial,
    dust,
  };
}

export function buildCavernScene(THREE) {
  const rng = makeRng(20260811);
  const scene = new THREE.Scene();
  const disposables = [];
  const track = object => {
    disposables.push(object);
    return object;
  };

  scene.background = new THREE.Color(0x180f0b);
  scene.fog = new THREE.Fog(0x21150f, 158, 286);

  buildGround(THREE, track, scene, rng);
  buildCaveMasses(THREE, track, scene, rng);
  const lavaMaterial = buildLava(THREE, track, scene);
  buildRails(THREE, track, scene);
  const architecture = buildArchitecture(THREE, track, scene, rng);
  buildSmallRocks(THREE, track, scene, rng);
  const atmosphere = buildAtmosphere(THREE, track, scene, rng);

  scene.add(new THREE.AmbientLight(0x76513a, 2.05));
  scene.add(new THREE.HemisphereLight(0x806859, 0x25120b, 3.45));
  const topLight = new THREE.DirectionalLight(0xd49b70, 2.6);
  topLight.position.set(-34, 95, 48);
  scene.add(topLight);
  const coolRim = new THREE.DirectionalLight(0x8995a1, 0.62);
  coolRim.position.set(70, 52, -80);
  scene.add(coolRim);

  const VIEW_HEIGHT = 108;
  const cameraTarget = new THREE.Vector3(0, 5.5, -1);
  const cameraOffset = new THREE.Vector3(72, 137, 148);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 520);
  camera.userData.viewHeight = VIEW_HEIGHT;
  camera.position.copy(cameraTarget).add(cameraOffset);
  camera.lookAt(cameraTarget);

  return {
    scene,
    camera,
    bloom: { strength: 0.72, radius: 0.7, threshold: 0.78 },
    toneMapping: { type: 'ACESFilmicToneMapping', exposure: 1.22 },

    update(time) {
      lavaMaterial.uniforms.uTime.value = time;
      architecture.fireMaterial.uniforms.uTime.value = time + 1.7;
      atmosphere.smokeMaterial.uniforms.uTime.value = time;
      atmosphere.emberMaterial.uniforms.uTime.value = time;

      const furnaceFlicker = clamp(
        0.88
          + 0.10 * Math.sin(time * 8.3)
          + 0.07 * Math.sin(time * 13.7 + 1.4)
          + 0.04 * Math.sin(time * 23.1 + 0.6),
        0.66,
        1.15,
      );
      atmosphere.furnaceLight.intensity = 690 * furnaceFlicker;
      atmosphere.furnaceLight.distance = 88 + furnaceFlicker * 8;

      for (const item of atmosphere.pointLights) {
        item.light.intensity = item.intensity * (0.92
          + 0.06 * Math.sin(time * 2.1 + item.phase)
          + 0.03 * Math.sin(time * 5.9 + item.phase * 1.7));
      }
      for (const item of atmosphere.lavaLights) {
        item.light.intensity = item.intensity * (0.9
          + 0.08 * Math.sin(time * 1.7 + item.phase)
          + 0.04 * Math.sin(time * 4.3 + item.phase));
      }

      atmosphere.dust.rotation.y = Math.sin(time * 0.025) * 0.028;
      atmosphere.dust.position.y = Math.sin(time * 0.12) * 0.7;

      const driftX = Math.sin(time * 0.032) * 1.25;
      const driftZ = Math.cos(time * 0.026) * 1.0;
      camera.position.set(
        cameraTarget.x + cameraOffset.x + driftX,
        cameraTarget.y + cameraOffset.y,
        cameraTarget.z + cameraOffset.z + driftZ,
      );
      camera.lookAt(
        cameraTarget.x + driftX * 0.35,
        cameraTarget.y,
        cameraTarget.z + driftZ * 0.35,
      );
    },

    dispose() {
      for (const disposable of disposables) disposable.dispose?.();
      scene.clear();
    },
  };
}
