/**
 * Wilderness backdrop — an elevated conifer valley cut by a cold mountain stream.
 *
 * The composition is deliberately built from a few large, inexpensive systems:
 *
 *   - one vertex-coloured heightfield, carved around a shared river function;
 *   - one animated water ribbon plus one batched cascade/foam mesh;
 *   - instanced spruce, shrub and rock families arranged in broad visual masses;
 *   - two distant ridge silhouettes and one tiny atmospheric-particle pass.
 *
 * The river function is the scene's spine. Terrain, water, rocks and vegetation all ask
 * the same function where the channel is, so the procedural pieces cannot drift apart.
 * `THREE` is passed in rather than imported; backdrop.js remains the only module that
 * imports three, preserving the low/medium-quality no-download path.
 */

function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const clamp01 = value => Math.min(1, Math.max(0, value));
const lerp = (from, to, amount) => from + (to - from) * amount;
const smoothstep = (edge0, edge1, value) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const AREA_X = 148;
const AREA_Z_FAR = -190;
const AREA_Z_NEAR = 82;
const AREA_Z_SPAN = AREA_Z_NEAR - AREA_Z_FAR;

function riverProgress(z) {
  return clamp01((z - AREA_Z_FAR) / AREA_Z_SPAN);
}

/** S-curve from the distant upper-left to the lower-right foreground. */
function riverCenter(z) {
  const t = riverProgress(z);
  return -49 + 99 * t
    + Math.sin(t * Math.PI * 2.15 - 0.5) * 10
    + Math.sin(t * Math.PI * 5.0) * 2.8;
}

function riverWidth(z) {
  const t = riverProgress(z);
  return 7.2 + t * 5.6 + Math.sin(t * Math.PI * 3.0 + 0.4) * 1.2;
}

/** The stream loses height toward the camera, with three shallow shelves for cascades. */
function riverHeight(z) {
  const t = riverProgress(z);
  const shelves =
    smoothstep(0.25, 0.29, t) * 0.8
    + smoothstep(0.52, 0.56, t) * 1.0
    + smoothstep(0.76, 0.80, t) * 0.9;
  return 4.8 - t * 8.0 - shelves;
}

/**
 * Broad valley height. The left bank opens into a sunlit foreground meadow while the
 * right bank rises faster and carries the visually heavy forest wall from the reference.
 */
function terrainHeight(x, z) {
  const center = riverCenter(z);
  const width = riverWidth(z);
  const signedDistance = x - center;
  const distance = Math.abs(signedDistance);
  const bank = smoothstep(width * 0.72, width + 30, distance);
  const t = riverProgress(z);

  const sideRise = signedDistance > 0
    ? 8.7 + (1 - t) * 3.4
    : 6.2 + t * 3.2;
  const meadowLift = signedDistance < 0
    ? smoothstep(30, 112, distance) * (2.5 + t * 3.2)
    : smoothstep(35, 105, distance) * 4.5;
  const macro =
    Math.sin(x * 0.030 + z * 0.011) * 1.45
    + Math.cos(z * 0.031 - x * 0.010) * 1.15
    + Math.sin((x + z) * 0.018) * 0.75;

  // Keep the bed broad and smooth. Noise is faded out inside the channel so the water
  // never visibly intersects the ground when its ripple shader moves.
  return riverHeight(z) - 1.0
    + bank * (sideRise + meadowLift)
    + macro * smoothstep(width * 0.8, width + 18, distance);
}

function depthAt(z) {
  return 1 - riverProgress(z);
}

/** A physically lit foliage material with one travelling, height-weighted wind deformation. */
function makeWindMaterial(THREE, {
  strength,
  modelHeight,
  cacheKey,
  vertexColors = false,
  doubleSided = false,
  roughness = 0.88,
}) {
  const uniforms = {
    uTime: { value: 0 },
    uWindStrength: { value: strength },
    uModelHeight: { value: modelHeight },
  };
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors,
    roughness,
    metalness: 0,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });

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
             vec3 origin = instanceMatrix[3].xyz;
           #else
             vec3 origin = vec3(0.0);
           #endif
           float bend = clamp(position.y / uModelHeight, 0.0, 1.0);
           bend *= bend;
           float phase = origin.x * 0.075 + origin.z * 0.045;
           float gust = sin(uTime * 0.68 + phase)
             + 0.38 * sin(uTime * 1.12 + phase * 1.73);
           transformed.x += gust * uWindStrength * bend;
           transformed.z += cos(uTime * 0.41 + phase * 0.8)
             * uWindStrength * 0.34 * bend;
         }`,
      );
  };
  material.customProgramCacheKey = () => cacheKey;
  return { material, uniforms };
}

/**
 * Seamless, deterministic turf detail. One 256px DataTexture gives the whole heightfield
 * fine grass fibres and soil grain without an image asset or additional draw calls.
 */
function buildGroundTexture(THREE, track) {
  const SIZE = 256;
  const textureRng = makeRng(0x73a9f14d);

  function makeLattice(cells) {
    return Array.from({ length: cells * cells }, () => textureRng());
  }

  const coarse = makeLattice(8);
  const medium = makeLattice(24);
  const fine = makeLattice(64);
  const smooth = value => value * value * (3 - 2 * value);
  const sample = (lattice, cells, x, y) => {
    const gx = x / SIZE * cells;
    const gy = y / SIZE * cells;
    const x0 = Math.floor(gx) % cells;
    const y0 = Math.floor(gy) % cells;
    const x1 = (x0 + 1) % cells;
    const y1 = (y0 + 1) % cells;
    const tx = smooth(gx - Math.floor(gx));
    const ty = smooth(gy - Math.floor(gy));
    const top = lerp(lattice[y0 * cells + x0], lattice[y0 * cells + x1], tx);
    const bottom = lerp(lattice[y1 * cells + x0], lattice[y1 * cells + x1], tx);
    return lerp(top, bottom, ty);
  };

  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const broad = sample(coarse, 8, x, y);
      const clump = sample(medium, 24, x, y);
      const grain = sample(fine, 64, x, y);
      const soil = smoothstep(0.61, 0.88, broad * 0.62 + clump * 0.38);
      const index = (y * SIZE + x) * 4;
      data[index] = Math.round(205 + clump * 22 + grain * 9 - soil * 25);
      data[index + 1] = Math.round(216 + broad * 25 + grain * 8 - soil * 19);
      data[index + 2] = Math.round(184 + clump * 17 + grain * 7 - soil * 29);
      data[index + 3] = 255;
    }
  }

  // Short, slightly leaning fibres remain visible after mipmapping but never form a grid.
  for (let fibre = 0; fibre < 2400; fibre += 1) {
    const x = Math.floor(textureRng() * SIZE);
    const y = Math.floor(textureRng() * SIZE);
    const length = 1 + Math.floor(textureRng() * 4);
    const lean = textureRng() < 0.5 ? -1 : 1;
    const light = textureRng() < 0.42;
    for (let step = 0; step < length; step += 1) {
      const px = (x + (step > 1 ? lean : 0) + SIZE) % SIZE;
      const py = (y + step) % SIZE;
      const index = (py * SIZE + px) * 4;
      data[index] = Math.max(0, Math.min(255, data[index] + (light ? 13 : -19)));
      data[index + 1] = Math.max(0, Math.min(255, data[index + 1] + (light ? 19 : -13)));
      data[index + 2] = Math.max(0, Math.min(255, data[index + 2] + (light ? 7 : -17)));
    }
  }

  const texture = track(new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function buildTerrain(THREE, track, rng) {
  const geometry = track(new THREE.PlaneGeometry(
    AREA_X * 2,
    AREA_Z_SPAN,
    72,
    72,
  ));
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, (AREA_Z_NEAR + AREA_Z_FAR) / 2);

  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const meadow = new THREE.Color(0x668340);
  const sunGrass = new THREE.Color(0x8fa457);
  const forestFloor = new THREE.Color(0x243d28);
  const bankStone = new THREE.Color(0x536258);
  const earth = new THREE.Color(0x4c4933);
  const haze = new THREE.Color(0x6f8780);
  const color = new THREE.Color();

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const center = riverCenter(z);
    const distance = Math.abs(x - center);
    const width = riverWidth(z);
    const rightBank = x > center;
    const depth = depthAt(z);
    const height = terrainHeight(x, z);
    positions.setY(i, height);

    if (distance < width + 5) {
      color.copy(earth).lerp(bankStone, smoothstep(width - 1, width + 5, distance));
    } else if (rightBank) {
      color.copy(forestFloor).lerp(meadow, smoothstep(width + 10, width + 72, distance) * 0.32);
    } else {
      color.copy(meadow).lerp(sunGrass, smoothstep(width + 10, width + 82, distance));
    }
    color.lerp(haze, depth * 0.12);
    color.offsetHSL(0, (rng() - 0.5) * 0.012, (rng() - 0.5) * 0.014);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const uniforms = { uTime: { value: 0 } };
  const groundTexture = buildGroundTexture(THREE, track);
  const material = track(new THREE.MeshStandardMaterial({
    map: groundTexture,
    vertexColors: true,
    roughness: 0.98,
    metalness: 0,
  }));
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uTime;\nvarying vec3 vTerrainWorld;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying vec3 vTerrainWorld;
         float terrainHash(vec2 p) {
           p = fract(p * vec2(123.34, 456.21));
           p += dot(p, p + 45.32);
           return fract(p.x * p.y);
         }
         float terrainNoise(vec2 p) {
           vec2 i = floor(p);
           vec2 f = fract(p);
           f = f * f * (3.0 - 2.0 * f);
           return mix(
             mix(terrainHash(i), terrainHash(i + vec2(1.0, 0.0)), f.x),
             mix(terrainHash(i + vec2(0.0, 1.0)), terrainHash(i + vec2(1.0)), f.x),
             f.y
           );
         }
         float terrainFbm(vec2 p) {
           float value = 0.0;
           float amplitude = 0.5;
           mat2 turn = mat2(0.80, -0.60, 0.60, 0.80);
           for (int octave = 0; octave < 4; octave++) {
             value += terrainNoise(p) * amplitude;
             p = turn * p * 2.03 + 11.7;
             amplitude *= 0.5;
           }
           return value;
         }`,
      )
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `vec4 diffuseColor = vec4(diffuse, opacity);
         vec2 turf = vTerrainWorld.xz;
         float soilPatches = terrainFbm(turf * 0.032);
         float grassClumps = terrainFbm(turf * 0.17 + vec2(31.0, -17.0));
         float fineTurf = terrainNoise(turf * 1.28);
         float tinyFlecks = terrainNoise(turf * 3.7 + vec2(8.0, 19.0));
         float dapple = terrainFbm(turf * 0.024
           + vec2(uTime * 0.006, -uTime * 0.004));
         float patchTone = (soilPatches - 0.5) * 0.09
           + (grassClumps - 0.5) * 0.065
           + (fineTurf - 0.5) * 0.022;
         diffuseColor.rgb *= 0.94 + patchTone;
         diffuseColor.rgb += vec3(0.035, 0.062, 0.014)
           * smoothstep(0.48, 0.78, grassClumps) * 0.34;
         diffuseColor.rgb -= vec3(0.030, 0.022, 0.012)
           * smoothstep(0.61, 0.82, soilPatches) * (1.0 - grassClumps) * 0.28;
         diffuseColor.rgb += vec3(0.070, 0.062, 0.021)
           * smoothstep(0.57, 0.82, dapple) * 0.68;
         diffuseColor.rgb += vec3(0.022, 0.030, 0.008)
           * smoothstep(0.84, 0.96, tinyFlecks);`,
      );
  };
  material.customProgramCacheKey = () => 'wilderness-terrain-turf-v2';
  return { mesh: new THREE.Mesh(geometry, material), uniforms };
}

function buildRiver(THREE, track) {
  const Z_SEGMENTS = 128;
  const ACROSS = 8;
  const verticesAcross = ACROSS + 1;
  const positions = new Float32Array((Z_SEGMENTS + 1) * verticesAcross * 3);
  const colors = new Float32Array((Z_SEGMENTS + 1) * verticesAcross * 3);
  const uvs = new Float32Array((Z_SEGMENTS + 1) * verticesAcross * 2);
  const indices = [];
  const deep = new THREE.Color(0x174f5b);
  const clear = new THREE.Color(0x6ba9aa);
  const color = new THREE.Color();

  for (let row = 0; row <= Z_SEGMENTS; row += 1) {
    const t = row / Z_SEGMENTS;
    const z = lerp(AREA_Z_FAR - 3, AREA_Z_NEAR + 4, t);
    const center = riverCenter(z);
    const width = riverWidth(z);
    for (let column = 0; column <= ACROSS; column += 1) {
      const across = column / ACROSS;
      const lateral = (across - 0.5) * width * 2;
      const index = row * verticesAcross + column;
      positions[index * 3] = center + lateral;
      positions[index * 3 + 1] = riverHeight(z) + 0.18;
      positions[index * 3 + 2] = z;

      const edge = Math.abs(across - 0.5) * 2;
      color.copy(clear).lerp(deep, 0.68 - edge * 0.48 + depthAt(z) * 0.08);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
      uvs[index * 2] = across;
      uvs[index * 2 + 1] = t;

      if (row < Z_SEGMENTS && column < ACROSS) {
        const nextRow = index + verticesAcross;
        indices.push(index, nextRow, index + 1, nextRow, nextRow + 1, index + 1);
      }
    }
  }

  const geometry = track(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // ShaderMaterial does not inherit the stock fog uniforms automatically; merge them
  // explicitly so the renderer can refresh fogNear/fogFar/fogColor every frame.
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSunDirection: { value: new THREE.Vector3(-0.48, 0.82, 0.31).normalize() },
    },
  ]);
  const material = track(new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    vertexShader: `
      uniform float uTime;
      attribute vec3 color;
      varying vec2 vWaterUv;
      varying vec3 vWaterColor;
      varying vec3 vWaterWorld;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        float waveA = sin(uv.y * 96.0 - uTime * 1.30 + uv.x * 5.0);
        float waveB = sin(uv.y * 43.0 - uTime * 0.62 - uv.x * 9.0);
        p.y += waveA * 0.055 + waveB * 0.026;
        p.x += sin(uv.y * 31.0 - uTime * 0.38) * 0.035;
        vWaterUv = uv;
        vWaterColor = color;
        vWaterWorld = (modelMatrix * vec4(p, 1.0)).xyz;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDirection;
      varying vec2 vWaterUv;
      varying vec3 vWaterColor;
      varying vec3 vWaterWorld;
      #include <common>
      #include <fog_pars_fragment>
      float waterHash(vec2 p) {
        p = fract(p * vec2(443.897, 441.423));
        p += dot(p, p + 19.19);
        return fract(p.x * p.y);
      }
      float waterNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(waterHash(i), waterHash(i + vec2(1.0, 0.0)), f.x),
          mix(waterHash(i + vec2(0.0, 1.0)), waterHash(i + vec2(1.0)), f.x),
          f.y
        );
      }
      float waterFbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int octave = 0; octave < 3; octave++) {
          value += waterNoise(p) * amplitude;
          p = mat2(0.86, -0.51, 0.51, 0.86) * p * 2.08 + 7.3;
          amplitude *= 0.5;
        }
        return value;
      }
      void main() {
        vec2 flowUv = vec2(vWaterUv.x * 5.4, vWaterUv.y * 58.0 - uTime * 0.46);
        float broadFlow = waterFbm(flowUv);
        float crossingFlow = waterFbm(flowUv * vec2(1.75, 0.62)
          + vec2(uTime * 0.11, -uTime * 0.16));
        float fineFlow = waterNoise(flowUv * 2.65 + vec2(-uTime * 0.19, uTime * 0.32));
        float bank = smoothstep(0.55, 1.0, abs(vWaterUv.x - 0.5) * 2.0);
        float centerDepth = 1.0 - bank;
        float softGlint = smoothstep(0.69, 0.91,
          broadFlow * 0.58 + crossingFlow * 0.30 + fineFlow * 0.12);
        vec3 surfaceNormal = normalize(vec3(
          (crossingFlow - 0.5) * 0.58,
          1.0,
          (broadFlow - fineFlow) * 0.44
        ));
        vec3 viewDirection = normalize(cameraPosition - vWaterWorld);
        float fresnel = pow(1.0 - clamp(dot(surfaceNormal, viewDirection), 0.0, 1.0), 1.7);
        float sunReflection = pow(max(dot(
          reflect(-uSunDirection, surfaceNormal), viewDirection
        ), 0.0), 38.0);
        float reflectedRipple = smoothstep(0.55, 0.84,
          crossingFlow * 0.58 + fineFlow * 0.42);
        float reflectionBand = smoothstep(0.57, 0.82, crossingFlow)
          * smoothstep(0.30, 0.72, broadFlow);
        vec3 water = vWaterColor * (0.84 + (broadFlow - 0.5) * 0.16);
        water += vec3(0.22, 0.43, 0.42) * crossingFlow * 0.12;
        water += vec3(0.54, 0.72, 0.68) * softGlint * 0.11;
        water = mix(water, vec3(0.34, 0.53, 0.48), bank * 0.10);
        vec3 skyReflection = mix(
          vec3(0.26, 0.42, 0.39),
          vec3(0.72, 0.87, 0.85),
          reflectedRipple
        );
        vec3 bankReflection = vec3(0.10, 0.24, 0.17);
        vec3 reflectionColor = mix(skyReflection, bankReflection, bank * 0.46);
        water = mix(water, reflectionColor, 0.18 + fresnel * 0.46);
        water += vec3(0.38, 0.58, 0.56) * reflectionBand * 0.16;
        water += vec3(1.0, 0.91, 0.68) * sunReflection * 0.72;
        float alpha = mix(0.25, 0.51, centerDepth)
          + softGlint * 0.035 + broadFlow * 0.025 + fresnel * 0.11
          + reflectionBand * 0.055 + sunReflection * 0.16;
        gl_FragColor = vec4(water, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  }));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  return { mesh, uniforms };
}

/** All cascade lips are combined into one geometry and one draw call. */
function buildFoam(THREE, track) {
  const cascadeT = [0.275, 0.545, 0.785];
  const positions = [];
  const colors = [];
  const indices = [];
  const foamWhite = new THREE.Color(0xb7d8d1);
  const foamBlue = new THREE.Color(0x79aaa9);

  for (let cascade = 0; cascade < cascadeT.length; cascade += 1) {
    const z = lerp(AREA_Z_FAR, AREA_Z_NEAR, cascadeT[cascade]);
    const width = riverWidth(z) * 0.86;
    const center = riverCenter(z);
    const segments = 16;
    for (let segment = 0; segment < segments; segment += 1) {
      // Missing chunks let the water colour pass through and turn the lip into broken
      // turbulent froth instead of a graphic line drawn across the channel.
      if ((segment * 5 + cascade * 3) % 11 === 4) continue;
      const a0 = segment / segments;
      const a1 = (segment + 1) / segments;
      const x0 = center + lerp(-width, width, a0);
      const x1 = center + lerp(-width, width, a1);
      const leading0 = Math.sin(a0 * Math.PI * 5.3 + cascade * 1.7) * 0.72;
      const leading1 = Math.sin(a1 * Math.PI * 5.3 + cascade * 1.7) * 0.72;
      const thickness0 = 0.95 + ((segment + cascade) % 4) * 0.34;
      const thickness1 = 0.90 + ((segment + cascade + 2) % 5) * 0.28;
      const base = positions.length / 3;
      positions.push(
        x0, riverHeight(z + leading0) + 0.34, z + leading0,
        x1, riverHeight(z + leading1) + 0.34, z + leading1,
        x0, riverHeight(z + leading0 + thickness0) + 0.36, z + leading0 + thickness0,
        x1, riverHeight(z + leading1 + thickness1) + 0.36, z + leading1 + thickness1,
      );
      const color = segment % 3 === 0 ? foamBlue : foamWhite;
      for (let vertex = 0; vertex < 4; vertex += 1) {
        colors.push(color.r, color.g, color.b);
      }
      indices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
    }
  }

  const geometry = track(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = track(new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.29,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 3;
  return mesh;
}

function buildRidge(THREE, track, {
  z,
  baseY,
  height,
  color,
  phase,
}) {
  const SEGMENTS = 28;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= SEGMENTS; i += 1) {
    const t = i / SEGMENTS;
    const x = lerp(-230, 230, t);
    const crest = baseY + height
      + Math.sin(t * Math.PI * 4.2 + phase) * height * 0.22
      + Math.sin(t * Math.PI * 10.4 + phase * 0.7) * height * 0.09;
    positions.push(x, baseY - 45, z, x, crest, z);
    if (i < SEGMENTS) {
      const base = i * 2;
      indices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
    }
  }
  const geometry = track(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const material = track(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  return new THREE.Mesh(geometry, material);
}

/**
 * One reusable spruce crown built from drooping branch fans around a narrow inner crown.
 * Individual fans break the old stacked-cone silhouette while remaining one instanced mesh.
 */
function buildConiferGeometry(THREE, track) {
  const LEVELS = 10;
  const BRANCHES = 14;
  const positions = [];
  const colors = [];
  const indices = [];

  for (let level = 0; level < LEVELS; level += 1) {
    const heightT = level / (LEVELS - 1);
    const y = 2.6 + level * 1.78;
    const crownRadius = lerp(6.0, 0.72, Math.pow(heightT, 0.82));
    const branchWidth = lerp(1.45, 0.34, heightT);

    for (let branch = 0; branch < BRANCHES; branch += 1) {
      const angle = branch / BRANCHES * Math.PI * 2
        + level * 0.43
        + Math.sin(branch * 2.17 + level) * 0.055;
      const radial = crownRadius * (0.82 + Math.sin(branch * 4.31 + level * 1.7) * 0.12);
      const tangentX = -Math.sin(angle);
      const tangentZ = Math.cos(angle);
      const directionX = Math.cos(angle);
      const directionZ = Math.sin(angle);
      const rootRadius = 0.42 + heightT * 0.18;
      const midRadius = radial * 0.52;
      const width = branchWidth * (0.82 + Math.sin(branch * 1.37 + level * 2.4) * 0.14);
      const droop = lerp(0.82, 0.22, heightT) + radial * 0.055;
      const base = positions.length / 3;

      positions.push(
        directionX * rootRadius, y + 0.34, directionZ * rootRadius,
        directionX * midRadius + tangentX * width, y - droop * 0.23,
        directionZ * midRadius + tangentZ * width,
        directionX * midRadius - tangentX * width, y - droop * 0.23,
        directionZ * midRadius - tangentZ * width,
        directionX * radial + tangentX * width * 0.18, y - droop,
        directionZ * radial + tangentZ * width * 0.18,
      );
      colors.push(
        0.56, 0.59, 0.53,
        0.76, 0.80, 0.72,
        0.72, 0.77, 0.68,
        0.94, 0.98, 0.89,
      );
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  // Slender continuous core prevents pinholes between the branch fans without restoring
  // the tiered-pyramid look. It also catches the warm key light as a soft central spine.
  const coreSegments = 14;
  const lowerStart = positions.length / 3;
  for (let segment = 0; segment < coreSegments; segment += 1) {
    const angle = segment / coreSegments * Math.PI * 2;
    positions.push(Math.cos(angle) * 1.25, 2.0, Math.sin(angle) * 1.25);
    colors.push(0.52, 0.56, 0.49);
  }
  const upperStart = positions.length / 3;
  for (let segment = 0; segment < coreSegments; segment += 1) {
    const angle = segment / coreSegments * Math.PI * 2;
    positions.push(Math.cos(angle) * 0.08, 20.25, Math.sin(angle) * 0.08);
    colors.push(0.93, 0.97, 0.88);
  }
  for (let segment = 0; segment < coreSegments; segment += 1) {
    const next = (segment + 1) % coreSegments;
    indices.push(
      lowerStart + segment, upperStart + segment, lowerStart + next,
      lowerStart + next, upperStart + segment, upperStart + next,
    );
  }

  const geometry = track(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildTrees(THREE, track, rng) {
  const trees = [];
  const addTree = (x, z, scale = 1, yaw = rng() * Math.PI * 2) => {
    trees.push({ x, z, scale, yaw });
  };

  // Hand-authored anchors establish the three masses before procedural fill: cropped
  // foreground framing, the right forest wall, and the staggered middle ridge.
  [
    [-130, 60, 2.25], [-112, 48, 1.75], [-143, 18, 1.95], [-103, 72, 1.55],
    [125, 65, 2.20], [105, 50, 1.72], [137, 22, 2.02], [92, 70, 1.60],
    [48, -20, 1.48], [66, -43, 1.62], [27, -66, 1.35], [79, -91, 1.48],
    [-15, -91, 1.36], [-49, -112, 1.54], [4, -136, 1.28], [42, -151, 1.42],
  ].forEach(([x, z, scale]) => addTree(x, z, scale));

  // Dense right-hand conifer wall.
  for (let i = 0; i < 222; i += 1) {
    const z = lerp(AREA_Z_NEAR, AREA_Z_FAR + 8, rng());
    const center = riverCenter(z);
    const x = center + riverWidth(z) + 15 + Math.pow(rng(), 0.72) * 92;
    if (x < AREA_X + 20) addTree(x, z, 0.72 + rng() * 0.86 - depthAt(z) * 0.12);
  }

  // Left side stays open in the foreground meadow, then closes into forest up-valley.
  for (let i = 0; i < 138; i += 1) {
    const z = lerp(20, AREA_Z_FAR + 5, rng());
    const center = riverCenter(z);
    const distance = z > -45 ? 55 + rng() * 78 : 18 + Math.pow(rng(), 0.78) * 105;
    const x = center - riverWidth(z) - distance;
    if (x > -AREA_X - 18) addTree(x, z, 0.70 + rng() * 0.88 - depthAt(z) * 0.14);
  }

  // A distant wall of smaller silhouettes closes the top of the composition.
  for (let i = 0; i < 120; i += 1) {
    const z = lerp(-174, -207, rng());
    addTree(lerp(-165, 165, rng()), z, 0.48 + rng() * 0.48);
  }

  const count = trees.length;
  const trunkGeometry = track(new THREE.CylinderGeometry(0.48, 0.76, 8.4, 9));
  trunkGeometry.translate(0, 4.2, 0);
  const foliageGeometry = buildConiferGeometry(THREE, track);
  const trunkMaterial = track(new THREE.MeshStandardMaterial({
    color: 0x46372a,
    roughness: 1,
    metalness: 0,
  }));
  const foliageWind = makeWindMaterial(THREE, {
    strength: 0.62,
    modelHeight: 20.2,
    cacheKey: 'wilderness-conifer-wind-v2',
    vertexColors: true,
    doubleSided: true,
    roughness: 0.84,
  });
  track(foliageWind.material);
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);
  const foliage = new THREE.InstancedMesh(foliageGeometry, foliageWind.material, count);

  const shadowGeometry = track(new THREE.CircleGeometry(1, 14));
  shadowGeometry.rotateX(-Math.PI / 2);
  const shadowMaterial = track(new THREE.MeshBasicMaterial({
    color: 0x07140d,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  }));
  const shadows = new THREE.InstancedMesh(shadowGeometry, shadowMaterial, count);
  shadows.renderOrder = 1;

  const foliageColors = [0x18392c, 0x204632, 0x2a5638, 0x315f3c, 0x3d6841]
    .map(color => new THREE.Color(color));
  const hazeColor = new THREE.Color(0x77928a);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const axisY = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  trees.forEach((tree, index) => {
    const ground = terrainHeight(tree.x, tree.z);
    const depth = depthAt(tree.z);
    quaternion.setFromAxisAngle(axisY, tree.yaw);
    scale.set(tree.scale, tree.scale, tree.scale);
    position.set(tree.x, ground, tree.z);
    matrix.compose(position, quaternion, scale);
    trunks.setMatrixAt(index, matrix);

    const baseColor = foliageColors[Math.floor(rng() * foliageColors.length)].clone();
    baseColor.lerp(hazeColor, depth * 0.18);
    if (tree.x < riverCenter(tree.z)) baseColor.offsetHSL(0, 0, 0.025);
    const widthJitter = 0.90 + rng() * 0.20;
    position.set(tree.x, ground, tree.z);
    scale.set(tree.scale * widthJitter, tree.scale * (0.94 + rng() * 0.13), tree.scale * widthJitter);
    matrix.compose(position, quaternion, scale);
    foliage.setMatrixAt(index, matrix);
    foliage.setColorAt(index, baseColor);

    quaternion.setFromAxisAngle(axisY, -0.42);
    position.set(tree.x + tree.scale * 2.8, ground + 0.055, tree.z - tree.scale * 2.2);
    scale.set(tree.scale * 6.8, 1, tree.scale * 3.1);
    matrix.compose(position, quaternion, scale);
    shadows.setMatrixAt(index, matrix);
  });

  [shadows, trunks, foliage].forEach(mesh => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
  });
  return { meshes: [shadows, trunks, foliage], wind: foliageWind };
}

function buildBoulderGeometry(THREE, track, variant) {
  let geometry;
  if (variant === 0) geometry = new THREE.IcosahedronGeometry(2.25, 1);
  else if (variant === 1) geometry = new THREE.DodecahedronGeometry(2.20, 1);
  else geometry = new THREE.SphereGeometry(2.15, 11, 8);

  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const radialNoise = 1
      + Math.sin(x * 2.13 + z * 1.37 + variant) * 0.075
      + Math.sin(y * 2.71 - x * 0.83) * 0.045;
    positions.setXYZ(
      i,
      x * radialNoise * (variant === 2 ? 1.10 : 1),
      y * radialNoise * (variant === 0 ? 0.92 : 1),
      z * radialNoise * (variant === 1 ? 1.12 : 1),
    );
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return track(geometry);
}

function buildRocks(THREE, track, rng) {
  const rocks = [
    [-92, 48, 3.0], [-75, 34, 2.4], [-58, -3, 2.0], [82, 36, 2.7],
    [66, 2, 2.1], [45, -53, 2.4], [-34, -82, 2.0], [-71, -126, 2.6],
  ].map(([x, z, scale], variant) => ({ x, z, scale, variant: variant % 3 }));

  for (let i = 0; i < 92; i += 1) {
    const z = lerp(AREA_Z_FAR + 8, AREA_Z_NEAR - 3, rng());
    const center = riverCenter(z);
    const width = riverWidth(z);
    const inChannel = rng() < 0.34;
    const side = rng() < 0.5 ? -1 : 1;
    const offset = inChannel
      ? (rng() - 0.5) * width * 1.45
      : side * (width + 1 + Math.pow(rng(), 1.7) * 18);
    rocks.push({
      x: center + offset,
      z,
      scale: 0.42 + Math.pow(rng(), 1.8) * 1.85,
      variant: Math.floor(rng() * 3),
    });
  }

  const material = track(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    flatShading: false,
    roughness: 0.91,
    metalness: 0,
  }));
  const hues = [0x505b56, 0x5e655e, 0x687068, 0x46554f, 0x70736c]
    .map(color => new THREE.Color(color));
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const grouped = [[], [], []];
  rocks.forEach(rock => grouped[rock.variant].push(rock));

  const meshes = grouped.map((group, variant) => {
    const geometry = buildBoulderGeometry(THREE, track, variant);
    const mesh = new THREE.InstancedMesh(geometry, material, group.length);
    group.forEach((rock, index) => {
      const inWater = Math.abs(rock.x - riverCenter(rock.z)) < riverWidth(rock.z) * 0.9;
      const y = inWater ? riverHeight(rock.z) - 0.10 : terrainHeight(rock.x, rock.z);
      axis.set(rng() - 0.5, 0.3 + rng(), rng() - 0.5).normalize();
      quaternion.setFromAxisAngle(axis, rng() * Math.PI);
      position.set(rock.x, y + rock.scale * 0.45, rock.z);
      scale.set(
        rock.scale * (1.0 + rng() * 0.85),
        rock.scale * (0.50 + rng() * 0.42),
        rock.scale * (0.78 + rng() * 0.82),
      );
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, hues[Math.floor(rng() * hues.length)]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  });

  const PEBBLE_COUNT = 220;
  const pebbleGeometry = track(new THREE.IcosahedronGeometry(0.48, 1));
  const pebbles = new THREE.InstancedMesh(pebbleGeometry, material, PEBBLE_COUNT);
  for (let i = 0; i < PEBBLE_COUNT; i += 1) {
    const z = lerp(AREA_Z_FAR + 4, AREA_Z_NEAR - 2, rng());
    const center = riverCenter(z);
    const width = riverWidth(z);
    const inWater = rng() < 0.28;
    const side = rng() < 0.5 ? -1 : 1;
    const x = inWater
      ? center + (rng() - 0.5) * width * 1.65
      : center + side * (width + 0.5 + Math.pow(rng(), 1.8) * 8.5);
    const size = 0.28 + Math.pow(rng(), 2.1) * 0.88;
    const y = inWater ? riverHeight(z) - 0.18 : terrainHeight(x, z);
    axis.set(rng() - 0.5, 0.5 + rng(), rng() - 0.5).normalize();
    quaternion.setFromAxisAngle(axis, rng() * Math.PI);
    position.set(x, y + size * 0.22, z);
    scale.set(
      size * (0.85 + rng() * 1.0),
      size * (0.38 + rng() * 0.42),
      size * (0.75 + rng() * 0.95),
    );
    matrix.compose(position, quaternion, scale);
    pebbles.setMatrixAt(i, matrix);
    pebbles.setColorAt(i, hues[Math.floor(rng() * hues.length)]);
  }
  pebbles.instanceMatrix.needsUpdate = true;
  if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
  pebbles.frustumCulled = false;
  meshes.push(pebbles);
  return { meshes };
}

/** Asymmetric six-lobed crown, merged once and reused for every bush instance. */
function buildBushGeometry(THREE, track) {
  const lobes = [
    { x: 0, y: 1.55, z: 0, sx: 2.15, sy: 1.48, sz: 1.82 },
    { x: -1.55, y: 1.28, z: 0.24, sx: 1.42, sy: 1.16, sz: 1.36 },
    { x: 1.48, y: 1.18, z: -0.28, sx: 1.48, sy: 1.08, sz: 1.30 },
    { x: -0.44, y: 2.42, z: -0.32, sx: 1.38, sy: 1.22, sz: 1.30 },
    { x: 0.76, y: 2.10, z: 0.70, sx: 1.34, sy: 1.14, sz: 1.26 },
    { x: 0.02, y: 1.02, z: -1.10, sx: 1.55, sy: 0.92, sz: 1.12 },
  ];
  const positions = [];

  for (const lobe of lobes) {
    const source = new THREE.IcosahedronGeometry(1, 1);
    const part = source.index ? source.toNonIndexed() : source;
    if (part !== source) source.dispose();
    const attribute = part.attributes.position;
    for (let i = 0; i < attribute.count; i += 1) {
      positions.push(
        attribute.getX(i) * lobe.sx + lobe.x,
        attribute.getY(i) * lobe.sy + lobe.y,
        attribute.getZ(i) * lobe.sz + lobe.z,
      );
    }
    part.dispose();
  }

  const geometry = track(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildShrubs(THREE, track, rng) {
  const COUNT = 154;
  const HEIGHT = 3.7;
  const geometry = buildBushGeometry(THREE, track);
  const wind = makeWindMaterial(THREE, {
    strength: 0.28,
    modelHeight: HEIGHT,
    cacheKey: 'wilderness-shrub-wind-v3',
    roughness: 0.9,
  });
  track(wind.material);
  const mesh = new THREE.InstancedMesh(geometry, wind.material, COUNT);
  const hues = [0x2c4d2c, 0x385c31, 0x466936, 0x4f6d3b, 0x27472f]
    .map(color => new THREE.Color(color));
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const axisY = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  for (let i = 0; i < COUNT; i += 1) {
    const z = lerp(AREA_Z_FAR + 8, AREA_Z_NEAR - 3, rng());
    const center = riverCenter(z);
    const side = rng() < 0.47 ? -1 : 1;
    const offset = riverWidth(z) + 5 + Math.pow(rng(), 1.35) * 58;
    const x = center + side * offset;
    const size = 0.54 + rng() * 0.96;
    quaternion.setFromAxisAngle(axisY, rng() * Math.PI * 2);
    position.set(x, terrainHeight(x, z), z);
    scale.set(size * (0.92 + rng() * 0.28), size * (0.84 + rng() * 0.26), size * (0.90 + rng() * 0.30));
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, hues[Math.floor(rng() * hues.length)]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  return { mesh, wind };
}

function buildGrassTuftGeometry(THREE, track) {
  const BLADES = 7;
  const positions = [];
  const colors = [];
  const indices = [];
  for (let blade = 0; blade < BLADES; blade += 1) {
    const angle = blade / BLADES * Math.PI * 2 + Math.sin(blade * 3.7) * 0.18;
    const directionX = Math.cos(angle);
    const directionZ = Math.sin(angle);
    const tangentX = -directionZ;
    const tangentZ = directionX;
    const offset = 0.10 + (blade % 3) * 0.11;
    const height = 2.65 + (blade % 4) * 0.34;
    const width = 0.11 + (blade % 2) * 0.045;
    const bend = 0.32 + (blade % 3) * 0.12;
    const base = positions.length / 3;
    positions.push(
      directionX * offset + tangentX * width, 0, directionZ * offset + tangentZ * width,
      directionX * offset - tangentX * width, 0, directionZ * offset - tangentZ * width,
      directionX * (offset + bend * 0.42) + tangentX * width * 0.68, height * 0.55,
      directionZ * (offset + bend * 0.42) + tangentZ * width * 0.68,
      directionX * (offset + bend * 0.42) - tangentX * width * 0.68, height * 0.55,
      directionZ * (offset + bend * 0.42) - tangentZ * width * 0.68,
      directionX * (offset + bend) + tangentX * width * 0.16, height,
      directionZ * (offset + bend) + tangentZ * width * 0.16,
      directionX * (offset + bend) - tangentX * width * 0.16, height,
      directionZ * (offset + bend) - tangentZ * width * 0.16,
    );
    colors.push(
      0.58, 0.63, 0.48, 0.58, 0.63, 0.48,
      0.82, 0.88, 0.67, 0.82, 0.88, 0.67,
      1.0, 1.0, 0.84, 1.0, 1.0, 0.84,
    );
    indices.push(
      base, base + 2, base + 1, base + 1, base + 2, base + 3,
      base + 2, base + 4, base + 3, base + 3, base + 4, base + 5,
    );
  }
  const geometry = track(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Tall, wind-reactive grass colonies in one instanced draw call. */
function buildGrass(THREE, track, rng) {
  const COUNT = 1850;
  const HEIGHT = 3.7;
  const geometry = buildGrassTuftGeometry(THREE, track);
  const wind = makeWindMaterial(THREE, {
    strength: 0.48,
    modelHeight: HEIGHT,
    cacheKey: 'wilderness-grass-wind-v2',
    vertexColors: true,
    doubleSided: true,
    roughness: 1,
  });
  track(wind.material);
  const mesh = new THREE.InstancedMesh(geometry, wind.material, COUNT);
  const hues = [0x64843c, 0x769345, 0x829c4b, 0x526f35, 0x91a656]
    .map(color => new THREE.Color(color));
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const axisY = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  const patches = Array.from({ length: 34 }, (_, index) => {
    const z = lerp(AREA_Z_FAR + 12, AREA_Z_NEAR - 5, rng());
    const leftMeadow = index < 25;
    const direction = leftMeadow ? -1 : 1;
    const distance = riverWidth(z) + 8 + rng() * (leftMeadow ? 104 : 58);
    return {
      x: riverCenter(z) + direction * distance,
      z,
      radiusX: 8 + rng() * (leftMeadow ? 20 : 13),
      radiusZ: 7 + rng() * 15,
    };
  });

  for (let i = 0; i < COUNT; i += 1) {
    const patch = patches[Math.floor(rng() * patches.length)];
    const angle = rng() * Math.PI * 2;
    const radius = Math.pow(rng(), 1.7);
    let x = patch.x + Math.cos(angle) * patch.radiusX * radius;
    const z = Math.max(AREA_Z_FAR + 4, Math.min(
      AREA_Z_NEAR - 2,
      patch.z + Math.sin(angle) * patch.radiusZ * radius,
    ));
    const center = riverCenter(z);
    const width = riverWidth(z);
    if (Math.abs(x - center) < width + 4) {
      x = center + Math.sign(x - center || -1) * (width + 4 + rng() * 5);
    }
    x = Math.max(-AREA_X + 2, Math.min(AREA_X - 2, x));
    const size = 0.72 + rng() * 0.78;
    quaternion.setFromAxisAngle(axisY, rng() * Math.PI * 2);
    position.set(x, terrainHeight(x, z) + 0.025, z);
    scale.set(size * (0.82 + rng() * 0.26), size * (0.86 + rng() * 0.42), size * (0.82 + rng() * 0.26));
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, hues[Math.floor(rng() * hues.length)]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  return { mesh, wind };
}

function buildParticles(THREE, track, rng) {
  const COUNT = 180;
  const positions = new Float32Array(COUNT * 3);
  const phases = new Float32Array(COUNT);
  const sizes = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i += 1) {
    positions[i * 3] = lerp(-105, 120, rng());
    positions[i * 3 + 1] = 6 + rng() * 38;
    positions[i * 3 + 2] = lerp(-170, 68, rng());
    phases[i] = rng() * Math.PI * 2;
    sizes[i] = 2.8 + rng() * 2.8;
  }
  const geometry = track(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const uniforms = { uTime: { value: 0 } };
  const material = track(new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      attribute float aPhase;
      attribute float aSize;
      varying float vFade;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.31 + aPhase) * 3.1
          + sin(uTime * 0.067 + aPhase * 0.31) * 4.2;
        p.z += cos(uTime * 0.19 + aPhase * 0.8) * 1.7;
        p.y += sin(uTime * 0.37 + aPhase * 1.7) * 1.65;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = aSize;
        vFade = 0.26 + 0.16 * sin(aPhase * 2.0 + uTime * 0.42);
      }
    `,
    fragmentShader: `
      varying float vFade;
      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        float alpha = smoothstep(0.5, 0.12, d) * vFade;
        gl_FragColor = vec4(0.94, 0.91, 0.62, alpha);
      }
    `,
  }));
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 4;
  return { points, uniforms };
}

export function buildWildernessScene(THREE) {
  const rng = makeRng(20260808);
  const scene = new THREE.Scene();
  const disposables = [];
  const track = disposable => {
    disposables.push(disposable);
    return disposable;
  };

  // Cool haze is the distant light source in the reference; ranged fog preserves depth
  // under an orthographic camera, unlike exponential fog's almost-uniform attenuation.
  scene.background = new THREE.Color(0x8daaa5);
  scene.fog = new THREE.Fog(0x78968f, 155, 330);

  const farRidge = buildRidge(THREE, track, {
    z: -236, baseY: 7, height: 48, color: 0x496b62, phase: 1.1,
  });
  const nearRidge = buildRidge(THREE, track, {
    z: -214, baseY: 2, height: 36, color: 0x34564b, phase: 2.4,
  });
  scene.add(farRidge, nearRidge);

  const terrain = buildTerrain(THREE, track, rng);
  scene.add(terrain.mesh);

  const river = buildRiver(THREE, track);
  const foam = buildFoam(THREE, track);
  scene.add(river.mesh, foam);

  const trees = buildTrees(THREE, track, rng);
  scene.add(...trees.meshes);

  const rocks = buildRocks(THREE, track, rng);
  scene.add(...rocks.meshes);

  const shrubs = buildShrubs(THREE, track, rng);
  scene.add(shrubs.mesh);

  const grass = buildGrass(THREE, track, rng);
  scene.add(grass.mesh);

  const particles = buildParticles(THREE, track, rng);
  scene.add(particles.points);

  // A strong warm key and restrained cool fill create the bright meadow / deep forest
  // separation in the reference. Grounded canopy ellipses provide contact shadow without
  // the cost and aliasing of a full shadow map.
  const hemisphere = new THREE.HemisphereLight(0xcbe1dc, 0x16231b, 1.08);
  const sun = new THREE.DirectionalLight(0xffefbd, 4.15);
  sun.position.set(-120, 170, 105);
  const coolFill = new THREE.DirectionalLight(0x85b2bd, 0.32);
  coolFill.position.set(130, 70, -110);
  scene.add(hemisphere, sun, coolFill);

  // Long-lens/orthographic bird's-eye framing: enough elevation to expose the channel,
  // with the camera on the near-left so the channel travels upper-left to lower-right in
  // screen space, as it does in the art-direction reference.
  const VIEW_HEIGHT = 122;
  const CAMERA_TARGET = new THREE.Vector3(2, 3, -51);
  const CAMERA_OFFSET = new THREE.Vector3(-48, 128, 96);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 700);
  camera.userData.viewHeight = VIEW_HEIGHT;
  camera.position.copy(CAMERA_TARGET).add(CAMERA_OFFSET);
  camera.lookAt(CAMERA_TARGET);

  return {
    scene,
    camera,
    // No bloom: avoiding a full-resolution multi-pass blur is the largest GPU saving in
    // this backdrop. ACES preserves the sunlit grass/water highlights in the direct pass.
    toneMapping: { type: 'ACESFilmicToneMapping', exposure: 1.18 },

    update(time) {
      trees.wind.uniforms.uTime.value = time;
      shrubs.wind.uniforms.uTime.value = time;
      grass.wind.uniforms.uTime.value = time;
      terrain.uniforms.uTime.value = time;
      river.uniforms.uTime.value = time;
      particles.uniforms.uTime.value = time;

      // Foam breathes by less than a tenth of a world unit; it reads as current, not as
      // moving geometry. Camera drift is intentionally sub-pixel over most frames.
      foam.position.y = Math.sin(time * 0.88) * 0.075;
      foam.material.opacity = 0.27 + Math.sin(time * 1.05) * 0.025;
      const driftX = Math.sin(time * 0.045) * 2.65;
      const driftZ = Math.cos(time * 0.034) * 1.75;
      camera.position.set(
        CAMERA_TARGET.x + CAMERA_OFFSET.x + driftX,
        CAMERA_TARGET.y + CAMERA_OFFSET.y,
        CAMERA_TARGET.z + CAMERA_OFFSET.z + driftZ,
      );
      camera.lookAt(
        CAMERA_TARGET.x + driftX * 0.20,
        CAMERA_TARGET.y,
        CAMERA_TARGET.z + driftZ * 0.18,
      );
    },

    dispose() {
      for (const disposable of disposables) disposable.dispose?.();
      scene.clear();
    },
  };
}
