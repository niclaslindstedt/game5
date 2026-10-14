// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GEAR STAGE'S BACKDROP — the place the rider card and the gear card
// stand him in (`gear-stage.ts`): the top of a groomed run on a clear winter
// morning, where a skier waits before he pushes off. Under him the corduroy
// the machines left in the night, ridged and glittering; the piste's marker
// poles down both edges; the run falling away behind him into a wooded
// valley; and across it a range of faceted peaks, snow on the gentle faces
// and rock through it on the steep ones, paling into the haze with
// distance under a deep winter-blue sky.
//
// Every piece is built in code in the game's own faceted look — the trees
// are the forest's own builder (`tree-shapes.ts`), the mountains a ridged
// noise cut into flat-shaded facets — so the card is a frame of the same
// world the race is skied in, not a photograph pasted behind it. It is a
// scene of its own: no level, no engine, a fog and a sky of its own.
//
// IN SUMMER (a free ride whose SEASON is summer) the same place with its
// snow gone: an alpine meadow round him, a dirt trail where the piste was,
// the woods in their summer paint (`summerPaint`, the forest's own), snow
// left only high on the range's gentle faces, and a paler, warmer sky.

import * as THREE from "three";
import { hash2, valueNoise } from "@niclaslindstedt/oss-game-framework/core/noise";

import { regionLookOf } from "./region-look.ts";
import { buildTree, summerPaint, treePaint, type TreeLod } from "./tree-shapes.ts";
import { TREE_VARIANTS } from "./tree-variants.ts";

/** The piste the skier stands on: its half width, m, running down +z. */
export const PISTE_HALF = 9;
/** Where the run starts to fall away behind him, m down it. */
const BROW = 16;

/** The sky's colours, linear: the zenith, the horizon's haze, and the
 * sun's warmth low in the sky — a winter's and a summer's. */
const SKIES = {
  winter: {
    zenith: new THREE.Color(0x1d58a8),
    horizon: new THREE.Color(0xc9ddef),
    warm: new THREE.Color(0xffe2b8),
  },
  summer: {
    zenith: new THREE.Color(0x2a66b8),
    horizon: new THREE.Color(0xd3e2ea),
    warm: new THREE.Color(0xfff0d0),
  },
} as const;

/** Where the low winter sun stands — behind the viewer's left shoulder, so
 * the skier is lit three-quarters on and the peaks across the valley
 * catch it on their faces. */
export const SUN_DIR = new THREE.Vector3(-0.72, 0.55, -0.42).normalize();

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The near ground's height at (x, z), m: flat round the skier and along
 * the piste, falling away behind him into the valley, rising either side. */
export function stageGround(x: number, z: number): number {
  // Out past the run's foot the valley floor runs level to the range.
  if (z > 400 || Math.abs(x) > 400) {
    const t = smoothstep(400, 700, Math.max(z, Math.abs(x)));
    return near(x, z) * (1 - t) + (FLOOR + (valueNoise(x, z, 300, 13) - 0.5) * 40) * t;
  }
  return near(x, z);
}

function near(x: number, z: number): number {
  // The run falls away ahead between two wooded shoulders that hold up.
  const side = smoothstep(22, 140, Math.abs(x));
  const fall = (-170 * smoothstep(BROW, 260, z) - 0.03 * Math.max(0, z - 260)) * (1 - 0.8 * side);
  const left = 46 * smoothstep(18, 150, -x);
  const right = 30 * smoothstep(24, 170, x);
  const r = Math.hypot(x, z);
  // The piste is groomed smooth; off it the snow lies in drifts.
  const off = smoothstep(PISTE_HALF, PISTE_HALF + 6, Math.abs(x));
  const bumps =
    (valueNoise(x, z, 9, 11) - 0.5) * 0.9 * off +
    (valueNoise(x, z, 46, 12) - 0.5) * 7 * smoothstep(14, 60, r);
  return fall + left + right + bumps * smoothstep(4, 14, r);
}

/** The valley floor, m, and how far off the range across it starts and
 * ends, m. */
const FLOOR = -260;
const PEAKS_NEAR = 3800;
const PEAKS_FAR = 26000;

/** THE SUMMITS across the valley, each where it stands (bearing off the
 * run's fall line, rad; distance, m), how high over the valley floor, m,
 * and how wide its base is for its height — a range of separate peaks, as
 * an alpine skyline is, not a wall. */
const SUMMITS: readonly { a: number; d: number; h: number; w: number }[] = [
  { a: -1.15, d: 9000, h: 1500, w: 2.3 },
  { a: -0.78, d: 12500, h: 2300, w: 1.9 },
  { a: -0.5, d: 7600, h: 1350, w: 2.6 },
  { a: -0.22, d: 15000, h: 2700, w: 1.7 },
  { a: 0.05, d: 9800, h: 1750, w: 2.0 },
  { a: 0.3, d: 13000, h: 2450, w: 1.8 },
  { a: 0.55, d: 8200, h: 1300, w: 2.7 },
  { a: 0.84, d: 11500, h: 2100, w: 2.0 },
  { a: 1.18, d: 9300, h: 1600, w: 2.4 },
  { a: -0.98, d: 19000, h: 2900, w: 1.6 },
  { a: 0.65, d: 20000, h: 3000, w: 1.6 },
];

/** The range's height over the valley floor at (x, z), m: the summits as
 * steep cones roughened by ridged noise into faces, ribs and couloirs. */
function peakHeight(x: number, z: number): number {
  let ridges = 0;
  let amp = 1;
  let scale = 2400;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    const n = valueNoise(x, z, scale, 31 + o);
    const ridge = 1 - Math.abs(2 * n - 1);
    ridges += ridge * ridge * amp;
    norm += amp;
    amp *= 0.5;
    scale *= 0.45;
  }
  ridges /= norm;
  let h = 0;
  for (const p of SUMMITS) {
    const px = Math.sin(p.a) * p.d;
    const pz = Math.cos(p.a) * p.d;
    const r = Math.hypot(x - px, z - pz) / (p.h * p.w);
    if (r >= 1) continue;
    h = Math.max(h, p.h * Math.pow(1 - r, 1.35));
  }
  return 0.75 * (h * (0.72 + 0.5 * ridges) + 260 * ridges);
}

/** The snow's own colour, a little blue, and the rock through it. */
const SNOW = new THREE.Color(0.9, 0.93, 0.97);
const ROCK = new THREE.Color(0.17, 0.165, 0.17);
const ROCK_WARM = new THREE.Color(0.27, 0.23, 0.2);
/** Summer's range under its snow: the high pasture and the scree. */
const PASTURE = new THREE.Color(0.2, 0.27, 0.1);
const SCREE = new THREE.Color(0.36, 0.34, 0.31);

function buildPeaks(summer: boolean): THREE.BufferGeometry {
  const rings = 70;
  const spokes = 220;
  const pos: number[] = [];
  const col: number[] = [];
  const at = (i: number, j: number): THREE.Vector3 => {
    const a = -1.45 + (2.9 * j) / spokes;
    const r = PEAKS_NEAR * Math.pow(PEAKS_FAR / PEAKS_NEAR, i / rings);
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const rise = smoothstep(PEAKS_NEAR, PEAKS_NEAR * 1.6, r);
    const y = FLOOR + rise * peakHeight(x, z);
    return new THREE.Vector3(x, y, z);
  };
  const grid: THREE.Vector3[][] = [];
  for (let i = 0; i <= rings; i++) {
    grid.push([]);
    for (let j = 0; j <= spokes; j++) grid[i].push(at(i, j));
  }
  const n = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const c = new THREE.Color();
  const face = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3): void => {
    e1.subVectors(b, a);
    e2.subVectors(d, a);
    n.crossVectors(e1, e2).normalize();
    if (n.y < 0) n.negate();
    const mid = (a.y + b.y + d.y) / 3;
    // Rock where the face is too steep to hold snow, and on the very tops
    // the wind scours; a hash of the facet breaks the line up.
    const jitter = hash2(Math.round(a.x), Math.round(a.z), 5) * 0.16;
    const steep = 1 - smoothstep(0.66, 0.84, n.y + jitter);
    const scour = 0.35 * smoothstep(900, 1500, mid);
    const rock = Math.min(1, steep + scour * (1 - n.y));
    c.copy(SNOW).lerp(jitter > 0.08 ? ROCK_WARM : ROCK, rock);
    if (summer) {
      // In summer the snow holds on only high and gentle; under it scree,
      // and the pasture low on the gentle faces.
      const snowy = smoothstep(1250, 1650, mid + jitter * 900) * smoothstep(0.78, 0.9, n.y);
      const green = (1 - smoothstep(300, 900, mid + jitter * 600)) * smoothstep(0.7, 0.85, n.y);
      c.copy(jitter > 0.08 ? ROCK_WARM : SCREE)
        .lerp(PASTURE, green)
        .lerp(SNOW, snowy);
    }
    for (const p of [a, b, d]) {
      pos.push(p.x, p.y, p.z);
      col.push(c.r, c.g, c.b);
    }
  };
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < spokes; j++) {
      const a = grid[i][j];
      const b = grid[i][j + 1];
      const d = grid[i + 1][j];
      const e = grid[i + 1][j + 1];
      face(a, d, b);
      face(b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function buildGround(): THREE.BufferGeometry {
  // Finer near the skier, where the lens is close, and coarse far out.
  const xs: number[] = [];
  const zs: number[] = [];
  for (let k = -60; k <= 60; k++) xs.push(Math.sign(k) * 4200 * Math.pow(Math.abs(k) / 60, 2.6));
  for (let k = 0; k <= 100; k++) zs.push(-40 + 3600 * Math.pow(k / 100, 2.4));
  const g = new THREE.BufferGeometry();
  const pos: number[] = [];
  for (const z of zs) for (const x of xs) pos.push(x, stageGround(x, z), z);
  const idx: number[] = [];
  const w = xs.length;
  for (let r = 0; r < zs.length - 1; r++) {
    for (let q = 0; q < w - 1; q++) {
      const a = r * w + q;
      idx.push(a, a + w, a + 1, a + 1, a + w, a + w + 1);
    }
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** THE SNOW AS SHADED: the corduroy on the piste — ridges across its
 * width, faded where a pixel spans several — and the glitter, a sparse
 * field of grains that catch the sun as the eye moves. */
function snowMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xf3f7fc, roughness: 0.82, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uPiste = { value: PISTE_HALF };
    shader.uniforms.uSun = { value: SUN_DIR };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorld;")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vWorld;
uniform float uPiste;
uniform vec3 uSun;
float stageHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float onPiste = 1.0 - smoothstep(uPiste - 0.6, uPiste + 0.4, abs(vWorld.x));
float cordX = vWorld.x / 0.07;
float cordW = fwidth(cordX);
float cord = 0.5 + 0.5 * cos(cordX * 6.2831853);
cord = mix(cord, 0.5, clamp(cordW * 1.6, 0.0, 1.0));
diffuseColor.rgb *= 1.0 - onPiste * 0.15 * cord;
float drift = stageHash(floor(vWorld.xz * 0.7));
diffuseColor.rgb *= 1.0 - (1.0 - onPiste) * 0.03 * drift;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
vec2 grain = floor(vWorld.xz * 70.0);
float g = stageHash(grain);
vec3 eye = normalize(cameraPosition - vWorld);
float facing = stageHash(grain + floor(dot(eye, vec3(37.0, 11.0, 23.0)) * 3.0));
float glint = step(0.9965, g) * step(0.55, facing);
float near = 1.0 - smoothstep(4.0, 22.0, distance(cameraPosition, vWorld));
totalEmissiveRadiance += vec3(1.0, 0.98, 0.94) * glint * near * 2.2 * max(0.0, uSun.y);`,
      );
  };
  return m;
}

/** THE MEADOW AS SHADED, in summer: grass in tussocks of their own shade
 * and a dirt trail down the run where
 * the piste was, wandering a little, its two wheel lines worn darker. */
function meadowMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWorld;")
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vWorld;
float stageHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float stageNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(stageHash(i), stageHash(i + vec2(1.0, 0.0)), f.x),
             mix(stageHash(i + vec2(0.0, 1.0)), stageHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
float tuft = stageNoise(vWorld.xz * 1.7) * 0.6 + stageNoise(vWorld.xz * 0.21) * 0.4;
vec3 grass = mix(vec3(0.13, 0.21, 0.06), vec3(0.30, 0.38, 0.12), tuft);
grass = mix(grass, vec3(0.42, 0.40, 0.22), 0.35 * smoothstep(0.62, 0.9, stageNoise(vWorld.xz * 0.05)));
float wander = 0.9 * sin(vWorld.z * 0.045) + 0.4 * sin(vWorld.z * 0.13 + 1.3);
float across = abs(vWorld.x - wander);
float trail = (1.0 - smoothstep(0.75, 1.15, across + (stageNoise(vWorld.xz * 3.0) - 0.5) * 0.3))
  * (1.0 - smoothstep(180.0, 260.0, vWorld.z));
vec3 dirt = mix(vec3(0.30, 0.23, 0.16), vec3(0.42, 0.34, 0.25), stageNoise(vWorld.xz * 6.0));
float ruts = 1.0 - 0.25 * (1.0 - smoothstep(0.05, 0.16, abs(across - 0.32)));
dirt *= ruts;
diffuseColor.rgb = mix(grass, dirt, trail);`,
      );
  };
  return m;
}

/** THE SKY: the deep blue overhead paling to the haze at the horizon, warm
 * toward the sun. */
function buildSky(sky: (typeof SKIES)[keyof typeof SKIES]): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: sky.zenith },
      uHorizon: { value: sky.horizon },
      uWarm: { value: sky.warm },
      uSun: { value: SUN_DIR },
    },
    vertexShader: `varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`,
    fragmentShader: `uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uWarm; uniform vec3 uSun;
varying vec3 vDir;
void main() {
  float up = clamp(vDir.y, 0.0, 1.0);
  vec3 c = mix(uHorizon, uZenith, pow(up, 0.38));
  float toSun = max(0.0, dot(normalize(vec3(vDir.x, 0.0, vDir.z)), normalize(vec3(uSun.x, 0.0, uSun.z))));
  c = mix(c, uWarm, 0.22 * pow(toSun, 3.0) * (1.0 - up));
  if (vDir.y < 0.0) c = uHorizon;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50000, 32, 16), material);
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  return dome;
}

/** THE PISTE'S MARKERS down both edges: a post in the run's colour with an
 * orange tip, one every 24 m — red on the right going down, as the
 * poles are set. */
function buildMarkers(group: THREE.Group, owned: (THREE.BufferGeometry | THREE.Material)[]): void {
  const post = new THREE.CylinderGeometry(0.035, 0.035, 1.6, 8);
  const tip = new THREE.CylinderGeometry(0.036, 0.036, 0.35, 8);
  const blue = new THREE.MeshStandardMaterial({ color: 0x1f5fbf, roughness: 0.5 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.5 });
  owned.push(post, tip, blue, orange);
  for (let k = 0; k < 7; k++) {
    const z = 6 + k * 24;
    for (const side of [-1, 1]) {
      const x = side * (PISTE_HALF + 0.8);
      const y = stageGround(x, z);
      const a = new THREE.Mesh(post, blue);
      a.position.set(x, y + 0.8, z);
      const b = new THREE.Mesh(tip, orange);
      b.position.set(x, y + 1.775, z);
      a.castShadow = b.castShadow = true;
      group.add(a, b);
    }
  }
}

/** THE WOODS: a stand of spruce and fir to his left on the run's shoulder
 * and the valley's forest below — the forest's own shapes, instanced. */
function buildWoods(
  group: THREE.Group,
  owned: (THREE.BufferGeometry | THREE.Material)[],
  summer: boolean,
): void {
  const winter = treePaint(regionLookOf("alpine"));
  const paint = summer ? summerPaint(winter) : winter;
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
    flatShading: false,
  });
  owned.push(material);
  type Spot = { x: number; z: number; h: number };
  const close: Spot[] = [];
  const far: Spot[] = [];
  for (let k = 0; k < 2400; k++) {
    const x = (hash2(k, 1, 77) - 0.5) * 1400;
    const z = 15 + hash2(k, 2, 77) * 900;
    const off = Math.abs(x) - PISTE_HALF;
    // The run is cut clear of trees, a margin either side of it.
    if (off < 5 + z * 0.02) continue;
    // Woods in clumps, thicker below the brow.
    const clump = valueNoise(x, z, 38, 78);
    if (clump < 0.42) continue;
    const h = 10 + 16 * hash2(k, 3, 77);
    // A stand on each shoulder of the run, framing it; the rest the
    // valley's forest, seen as a far band.
    if (Math.hypot(x, z + 6) < 75) continue;
    if (z < 320 && Math.abs(x) > 20 && Math.abs(x) < 260) close.push({ x, z, h });
    else far.push({ x, z, h });
  }
  const kinds = ["spruce", "fir"] as const;
  const plant = (spots: Spot[], lod: TreeLod, cast: boolean): void => {
    for (let v = 0; v < 4; v++) {
      const variant = TREE_VARIANTS[kinds[v % 2]][v];
      const mine = spots.filter((_, i) => i % 4 === v);
      if (mine.length === 0) continue;
      const geo = buildTree(variant, paint, lod);
      owned.push(geo);
      const im = new THREE.InstancedMesh(geo, material, mine.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      const p = new THREE.Vector3();
      mine.forEach((t, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash2(i, v, 9) * Math.PI * 2);
        const crown = t.h * 0.22;
        s.set(crown, t.h, crown);
        p.set(t.x, stageGround(t.x, t.z) - 0.3, t.z);
        im.setMatrixAt(i, m.compose(p, q, s));
      });
      im.castShadow = cast;
      im.receiveShadow = false;
      group.add(im);
    }
  };
  plant(close, 0, true);
  plant(far, 2, false);
}

export type Backdrop = {
  group: THREE.Group;
  /** The near snow (or summer's meadow), which takes the skier's shadow. */
  snow: THREE.Mesh;
  /** The haze the far world dissolves into — the sky's own horizon. */
  haze: THREE.Color;
  dispose: () => void;
};

export function createBackdrop(summer = false): Backdrop {
  const group = new THREE.Group();
  const owned: (THREE.BufferGeometry | THREE.Material)[] = [];
  const colours = summer ? SKIES.summer : SKIES.winter;
  const sky = buildSky(colours);
  owned.push(sky.geometry, sky.material as THREE.Material);
  group.add(sky);

  const groundGeo = buildGround();
  const groundMat = summer ? meadowMaterial() : snowMaterial();
  owned.push(groundGeo, groundMat);
  const snow = new THREE.Mesh(groundGeo, groundMat);
  snow.receiveShadow = true;
  group.add(snow);

  const peaksGeo = buildPeaks(summer);
  const peaksMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  });
  owned.push(peaksGeo, peaksMat);
  group.add(new THREE.Mesh(peaksGeo, peaksMat));

  // The piste's poles are a winter's: in summer the trail goes unmarked.
  if (!summer) buildMarkers(group, owned);
  buildWoods(group, owned, summer);
  return {
    group,
    snow,
    haze: colours.horizon,
    dispose: () => {
      for (const o of owned) o.dispose();
    },
  };
}
