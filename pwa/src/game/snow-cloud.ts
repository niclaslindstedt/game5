// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW CLOUD — the fine powder a skier rips up and leaves hanging in
// the air behind him: the wall off a skid, the sheet off a carving edge,
// the bow wave over a buried tip, the ring a landing throws, the burst of
// a wipeout. `spray.ts` flies
// the heavy part (the grains and clumps that arc and fall inside a second);
// this is the other substance, the one that stalls, swells, drifts on the
// wind and settles for seconds. What each source throws out of which snow
// is `snow-cloud-plan.ts`'s (three-free, tested); what the snow IS is
// `snowpack.ts`'s. This module flies the puffs and draws them.
//
// A PUFF is a camera-facing quad (instanced, one draw for every skier's
// cloud) shaded as a small VOLUME rather than a disc:
//
//   * THE BODY is a soft ball eroded by a tiling noise that slides and
//     turns as the puff ages, so a young puff is round and dense and an old
//     one is torn into wisps;
//   * THE LIGHT is the sky's: a normal off the ball (bent by the noise) is
//     lit by the key light wrapped round its terminator, and SHADED BY
//     ITSELF — the snow between a pixel and the sun, read off the same
//     noise a step toward the sun, attenuated Beer–Lambert — so the core of
//     a thick plume goes the sky's blue-grey on its far side; the hemisphere
//     light fills it from the sky above and the snow below;
//   * FORWARD SCATTER: fine ice throws light on along the way it was going
//     (Henyey–Greenstein, g ≈ 0.6), so against a low sun the thin edges of
//     the cloud light up silver and the whole of it glows;
//   * GLINTS: in dry cold snow single crystals catch the sun and twinkle;
//   * THE LAMPS: at night every lamp's beam — the finish arena's floods,
//     the skiers' headlamps — lights what it passes through (the lamp
//     slots, `haze.ts`'s `lampReach`);
//   * it FADES INTO THE SNOW where it meets it (the lower part of a puff
//     sitting on the ground thins out instead of cutting a line), away
//     close to the lens (a chase camera rides inside the player's own
//     plume), and into the same haze as the hills.
//
// SORTED back to front every frame (an insertion sort over the last
// frame's order, which is nearly sorted already), so a lit puff in front
// of a shaded one is never drawn under it.
//
// Presentation only: it reads the engine's state and never writes it, and
// draws from a stream of its own.

import * as THREE from "three";
import { rotate, type Level, type SkierState, type Wind } from "@engine";

import { LAMP_GLSL, LAMP_SLOTS, SKY_GLSL, type HazeUniforms } from "./haze.ts";
import { SHELTER, SHELTER_GLSL } from "./shelter.ts";
import { skiShares } from "./ski-stand.ts";
import type { SkyLook } from "./sky.ts";
import {
  flyPuff,
  carveOf,
  driveOf,
  emptyRecipe,
  landingPuffs,
  puffOpacity,
  puffRadius,
  skidCloud,
  skiCloud,
  type CloudRecipe,
  CLOUD,
} from "./snow-cloud-plan.ts";
import type { SnowProps } from "./snowpack.ts";

const CAPACITY = 2400;
/** THE SELF-SHADOW's grid: cells across the sun's rays, m, how many (a
 * hash table — a collision only shades a puff a little too much), and how
 * dark a unit of cloud laid in front makes what is behind it. */
const SHADOW_CELL = 1.2;
const SHADOW_CELLS = 8192;
const SHADOW_DEPTH = 0.9;

function cell(u: number, v: number): number {
  return (Math.imul(u, 73856093) ^ Math.imul(v, 19349663)) & (SHADOW_CELLS - 1);
}

/** Taillights the cloud is reddened by. */

/** The cloud's own stream: nothing drawn may draw from the engine's. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** A tiling noise the puffs are carved from: two octaves of smooth value
 * noise at two scales in R and G, and a third seed in B. */
function noiseTexture(): THREE.DataTexture {
  const n = 64;
  const random = makeRandom(0xc10d);
  const lattice = (cells: number) => {
    const v = new Float32Array(cells * cells);
    for (let i = 0; i < v.length; i++) v[i] = random();
    return (x: number, y: number) => {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const fx = x - xi;
      const fy = y - yi;
      const at = (a: number, b: number) =>
        v[(((b % cells) + cells) % cells) * cells + (((a % cells) + cells) % cells)];
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
      const bottom = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
      return top + (bottom - top) * sy;
    };
  };
  const fbm = (cells: number) => {
    const a = lattice(cells);
    const b = lattice(cells * 2);
    const c = lattice(cells * 4);
    return (x: number, y: number) =>
      (a(x * cells, y * cells) * 0.55 +
        b(x * cells * 2, y * cells * 2) * 0.3 +
        c(x * cells * 4, y * cells * 4) * 0.15 -
        0.5) *
        1.6 +
      0.5;
  };
  const r = fbm(4);
  const g = fbm(8);
  const b = fbm(5);
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      const u = x / n;
      const v = y / n;
      data[i] = Math.round(255 * Math.min(1, Math.max(0, r(u, v))));
      data[i + 1] = Math.round(255 * Math.min(1, Math.max(0, g(u, v))));
      data[i + 2] = Math.round(255 * Math.min(1, Math.max(0, b(u, v))));
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const VERTEX = /* glsl */ `
attribute vec4 iPos;
attribute vec4 iLook;
attribute vec4 iSnow;
uniform float uNear;
uniform vec4 uFocus;
varying vec2 vUv;
varying vec2 vSpin;
varying vec4 vLook;
varying vec4 vSnow;
varying vec3 vWorld;
varying vec3 vRight;
varying vec3 vUp;
varying float vRadius;
void main() {
  vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 U = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float dist = length(iPos.xyz - cameraPosition);
  // Away close to the lens: a chase camera rides in its own skier's plume.
  float near = smoothstep(uNear * 0.35 + iPos.w * 0.2, uNear + iPos.w * 0.9, dist);
  // THE VEIL: the skier's own lens looks THROUGH his plume at him — what
  // stands between the lens and the skier, near the line of sight, is thinned
  // to \`uFocus.w\` (1 where the lens is planted and sees the cloud whole).
  // It reaches a metre PAST him too: his newest puffs are born round his
  // skis, at his own depth, and a ball of them sat on him otherwise.
  vec3 fwd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  vec3 toF = uFocus.xyz - cameraPosition;
  vec3 toP = iPos.xyz - cameraPosition;
  float before = smoothstep(dot(toF, fwd) + 1.0, dot(toF, fwd) - 1.5, dot(toP, fwd));
  vec3 dirF = toF / max(length(toF), 1e-3);
  float lat = length(toP - dirF * dot(toP, dirF));
  float onLine = 1.0 - smoothstep(1.2 + iPos.w * 0.6, 3.0 + iPos.w * 1.4, lat);
  vLook = iLook;
  vLook.x *= near * mix(1.0, uFocus.w, before * onLine);
  vUv = position.xy;
  float c = cos(iSnow.z);
  float s = sin(iSnow.z);
  vSpin = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
  vSnow = iSnow;
  vRight = R;
  vUp = U;
  vRadius = iPos.w;
  vec3 w = iPos.xyz + (R * position.x + U * position.y) * iPos.w;
  vWorld = w;
  // A puff too faint to see is not drawn at all: the veiled and the near
  // ones are the biggest on the screen, and fill is what a cloud costs.
  gl_Position = vLook.x > 0.025 ? projectionMatrix * viewMatrix * vec4(w, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
${SKY_GLSL}
${SHELTER_GLSL}
uniform sampler2D uNoise;
uniform vec3 uKey;
uniform vec3 uKeyCol;
uniform vec3 uSkyCol;
uniform vec3 uGroundCol;
uniform float uFlat;
uniform float uGlint;
uniform float uTime;
uniform float uNight;
${LAMP_GLSL}
varying vec2 vUv;
varying vec2 vSpin;
varying vec4 vLook;
varying vec4 vSnow;
varying vec3 vWorld;
varying vec3 vRight;
varying vec3 vUp;
varying float vRadius;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// The snow at a point of the sprite: a ball eroded by the noise, torn
// further into wisps the older it is.
float density(vec2 uv, vec2 spin, vec2 o, float age) {
  float r2 = dot(uv, uv);
  float n1 = texture2D(uNoise, spin * 0.38 + o + vec2(age * 0.22, -age * 0.31)).r;
  float n2 = texture2D(uNoise, spin * 0.8 + o.yx + vec2(-age * 0.15, age * 0.5)).g;
  // The fine curl that keeps a puff filling the lens from going smooth.
  float n3 = texture2D(uNoise, spin * 2.3 - o + vec2(age * 0.7, age * 0.2)).b;
  float n = n1 * 0.52 + n2 * 0.3 + n3 * 0.18;
  float body = 1.0 - r2;
  float erode = 0.15 + 0.55 * age;
  // A crisp billow edge young, torn wisps old.
  float v = body * (0.5 + 1.15 * n) - erode * (1.0 - n);
  return smoothstep(0.0, 0.5 - 0.25 * age, v) * (1.0 - r2 * r2 * 0.5);
}

void main() {
  float r2 = dot(vUv, vUv);
  // None of it inside the cabin the lens is in (\`shelter.ts\`).
  if (r2 > 1.0 || sheltered(vWorld)) discard;
  float age = vLook.z;
  float seed = vLook.y;
  vec2 o = vec2(fract(seed * 7.13), fract(seed * 3.71));
  float d = density(vUv, vSpin, o, age);
  vec3 toEye = normalize(cameraPosition - vWorld);
  float z = sqrt(max(0.0, 1.0 - r2));
  // Into the snow: a puff sitting on the ground thins out where it meets
  // it — measured on the ball's FRONT surface, not the flat card, which a
  // lens looking down would see cut off into a crescent.
  vec3 surface = vWorld + toEye * z * vRadius;
  float ground = smoothstep(vLook.w - 0.02, vLook.w + vRadius * 0.3, surface.y);
  float alpha = d * vLook.x * ground;
  if (alpha < 0.004) discard;
  // A normal off the ball, bent by the noise so the lit side has relief.
  float bx = texture2D(uNoise, vSpin * 0.6 + o + 0.13).b - 0.5;
  float by = texture2D(uNoise, vSpin * 0.6 + o.yx + 0.41).b - 0.5;
  // Not a hard ball: a flattened bulge, so a row of puffs is one body of
  // cloud rather than a string of beads each shaded on its own.
  vec3 N = normalize(vRight * (vUv.x * 0.6 + bx * 1.2) + vUp * (vUv.y * 0.6 + by * 1.2) + toEye * (0.4 + z));

  // SELF-SHADOW: how much snow lies between here and the key light, read a
  // step toward it across the sprite, and how thick the puff is.
  vec2 lp = vec2(dot(uKey, vRight), dot(uKey, vUp));
  float toward = density(vUv + lp * 0.45, vSpin + lp * 0.45, o, age);
  float thick = vSnow.y;
  // The puff's own relief, lightly, over the WHOLE CLOUD's shadow on it
  // (\`vSnow.w\`: how much of the sun reaches it through the rest).
  float shade = vSnow.w * exp(-(toward * 0.35 + d * 0.15) * thick);
  float lambert = clamp((dot(N, uKey) + 0.45) / 1.45, 0.0, 1.0);

  // FORWARD SCATTER (Henyey–Greenstein, g 0.6), strongest through the thin
  // parts: a cloud against the sun lights up at its edges.
  float g = 0.7;
  float mu = dot(-toEye, uKey);
  float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
  // Thin CLOUD, not a thin rim: the glow is the whole plume's (its lit
  // share), or a string of puffs lights up as a string of rings.
  float thin = 1.0 - d * 0.25;
  float forward = hg * 0.3 * thin * mix(1.0, vSnow.w, 0.6);

  float direct = (lambert * shade * (1.0 - 0.7 * uFlat) + forward * (1.0 - 0.8 * uFlat));
  vec3 amb = mix(uGroundCol, uSkyCol, N.y * 0.5 + 0.5) * mix(0.6, 1.0, shade);
  // Under the moon the snow on the ground is darker than the lights alone
  // say (the grade and the snow's own night); the cloud keeps pace with it.
  vec3 col = 0.96 * (1.0 - 0.15 * uNight) * (amb + uKeyCol * direct);

  // GLINTS: single crystals catching the key light, twinkling as they
  // turn — a pixel each, so they are hashed on the screen's own grid.
  vec2 gp = gl_FragCoord.xy / 2.0;
  float h = hash(floor(gp) + vec2(seed * 97.0, floor(uTime * 15.0 + seed * 40.0)));
  float spot = smoothstep(0.55, 0.1, length(fract(gp) - 0.5));
  // Most of them toward the sun, where the facets can throw it at the eye.
  float odds = 0.004 * vSnow.x * (0.4 + hg * 0.35);
  float glint = step(1.0 - odds, h) * spot * uGlint * smoothstep(0.1, 0.5, d) * shade;
  col += uKeyCol * glint * (3.0 + hg);

  // THE LAMPS: a floodlight's cone, a headlamp's beam, lights what it
  // passes through — brightest seen looking back up it. The slots are dealt
  // in order (\`dealLamps\`), so the first empty one ends them: by day the
  // loop is one test, not six.
  for (int i = 0; i < ${LAMP_SLOTS}; i++) {
    if (uLampOn[i] <= 0.0) break;
    vec3 back = uLampPos[i] - vWorld;
    float gap = length(back);
    float toward = 0.5 + 0.5 * pow(max(0.0, dot(-toEye, uLampDir[i])), 3.0);
    col += uLampCol[i] * lampReach(i, back / max(gap, 1e-3), gap) * toward * 1.8;
  }
  col += uPisteCol * length(pisteLight(vWorld)) * 1.2;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  vec3 ray = vWorld - cameraPosition;
  float dist = length(ray);
  vec3 hz = hazeColour(ray / max(dist, 1e-3));
  #if defined(TONE_MAPPING)
    hz = toneMapping(hz);
  #endif
  hz = linearToOutputTexel(vec4(hz, 1.0)).rgb;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, hz, hazeAmount(dist, ray.y));
}
`;

export type SnowCloud = {
  mesh: THREE.Mesh;
  /** Raise one skier's cloud over `dt`; `landed` is the landing's measure
   * this frame (0 for none), `snowAt` what the snow is at a point. */
  emit(
    skier: SkierState,
    dt: number,
    landed: number,
    snowAt: (x: number, z: number) => SnowProps,
  ): void;
  /** A BURST at a point — a wipeout's (`size` 1) or a body coming down on
   * the snow (less), carried along at (vx, vz). */
  burst(
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number,
    size: number,
    snow: SnowProps,
  ): void;
  /** A PUFF BLOWN by a helicopter's rotor wash (`heli-view.ts`): one
   * puff of loose snow at a point, thrown at (vx, vy, vz), `size` m. */
  blow(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number): void;
  /** Fly every puff and sort them for the lens. */
  update(dt: number, look: SkyLook, level: Level, wind: Wind, eye: THREE.Vector3): void;
  /** The skier the lens is looking at, and how thin his plume is drawn
   * between them (1: whole — a planted lens). */
  setFocus(x: number, y: number, z: number, veil: number): void;
  /** The SPRAY row's share of the rates and of the pool. */
  setBudget(share: number): void;
  clear(): void;
  dispose(): void;
};

export function createSnowCloud(haze: HazeUniforms): SnowCloud {
  const pos = new Float32Array(CAPACITY * 3);
  const vel = new Float32Array(CAPACITY * 3);
  const age = new Float32Array(CAPACITY);
  const life = new Float32Array(CAPACITY);
  const size0 = new Float32Array(CAPACITY);
  const grow = new Float32Array(CAPACITY);
  const tau = new Float32Array(CAPACITY);
  const settle = new Float32Array(CAPACITY);
  const opacity = new Float32Array(CAPACITY);
  const seed = new Float32Array(CAPACITY);
  const sparkle = new Float32Array(CAPACITY);
  const spin = new Float32Array(CAPACITY);
  const ground = new Float32Array(CAPACITY);
  /** The draw order (far first), and whether a slot is in it. */
  const order = new Int32Array(CAPACITY);
  const listed = new Uint8Array(CAPACITY);
  const key = new Float32Array(CAPACITY);
  let count = 0;
  /** THE CLOUD'S SHADOW ON ITSELF: the puffs walked sun-first (`sunOrder`,
   * by `toSun`), each reading how much cloud has already been laid across
   * its ray (`reach`, a hashed grid of cells across the sun's rays) before
   * laying its own; `lit` is what it reads, as the share of the sun left. */
  const sunOrder = new Int32Array(CAPACITY);
  const toSun = new Float32Array(CAPACITY);
  const lit = new Float32Array(CAPACITY).fill(1);
  const reach = new Float32Array(SHADOW_CELLS);
  let head = 0;
  let share = 1;
  let cap = CAPACITY;
  let clock = 0;
  const random = makeRandom(0x5c10d);

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
  const iLook = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
  const iSnow = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4);
  for (const a of [iPos, iLook, iSnow]) a.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("iPos", iPos);
  geometry.setAttribute("iLook", iLook);
  geometry.setAttribute("iSnow", iSnow);
  geometry.instanceCount = 0;

  const noise = noiseTexture();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...haze,
      uNoise: { value: noise },
      uKey: { value: new THREE.Vector3(0, 1, 0) },
      uKeyCol: { value: new THREE.Color(1, 1, 1) },
      uSkyCol: { value: new THREE.Color(0.5, 0.6, 0.8) },
      uGroundCol: { value: new THREE.Color(0.6, 0.6, 0.65) },
      uGlint: { value: 1 },
      uTime: { value: 0 },
      uNight: { value: 0 },
      uNear: { value: 2.2 },
      uFocus: { value: new THREE.Vector4(0, -1e5, 0, 1) },
      ...SHELTER,
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;

  function spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    r: CloudRecipe,
    g: number,
  ) {
    const i = head;
    head = (head + 1) % cap;
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    vel[i * 3] = vx;
    vel[i * 3 + 1] = vy;
    vel[i * 3 + 2] = vz;
    age[i] = 0;
    life[i] = r.hang * (0.7 + 0.6 * random());
    size0[i] = r.size * (0.6 + 0.8 * random());
    grow[i] = r.grow * (0.55 + 0.9 * random());
    tau[i] = r.tau * (0.8 + 0.4 * random());
    settle[i] = r.settle * (0.8 + 0.4 * random());
    opacity[i] = r.opacity * (0.75 + 0.5 * random());
    seed[i] = random();
    sparkle[i] = r.sparkle;
    spin[i] = random() * Math.PI * 2;
    ground[i] = g;
    if (!listed[i]) {
      listed[i] = 1;
      order[count++] = i;
    }
  }

  /** Walk the live puffs sun-first and shadow each by what lies before
   * it: cells `SHADOW_CELL` m across the sun's rays, written and read
   * bilinearly so a puff crossing a cell's edge does not pop. */
  function shadowWalk(kx: number, ky: number, kz: number): void {
    // Two axes across the sun's rays.
    let ax = -kz;
    let az = kx;
    let al = Math.hypot(ax, az);
    if (al < 1e-3) {
      ax = 1;
      az = 0;
      al = 1;
    }
    ax /= al;
    az /= al;
    const bx = ky * az;
    const by = kz * ax - kx * az;
    const bz = -ky * ax;
    let n = 0;
    for (let m = 0; m < count; m++) sunOrder[n++] = order[m];
    // Sun-first: the largest `toSun` first.
    for (let a = 1; a < n; a++) {
      const i = sunOrder[a];
      const v = toSun[i];
      let b = a - 1;
      while (b >= 0 && toSun[sunOrder[b]] < v) {
        sunOrder[b + 1] = sunOrder[b];
        b--;
      }
      sunOrder[b + 1] = i;
    }
    reach.fill(0);
    for (let m = 0; m < n; m++) {
      const i = sunOrder[m];
      const k = i * 3;
      const u = (pos[k] * ax + pos[k + 2] * az) / SHADOW_CELL;
      const v = (pos[k] * bx + pos[k + 1] * by + pos[k + 2] * bz) / SHADOW_CELL;
      const u0 = Math.floor(u);
      const v0 = Math.floor(v);
      const fu = u - u0;
      const fv = v - v0;
      const c00 = cell(u0, v0);
      const c10 = cell(u0 + 1, v0);
      const c01 = cell(u0, v0 + 1);
      const c11 = cell(u0 + 1, v0 + 1);
      const w00 = (1 - fu) * (1 - fv);
      const w10 = fu * (1 - fv);
      const w01 = (1 - fu) * fv;
      const w11 = fu * fv;
      const before = reach[c00] * w00 + reach[c10] * w10 + reach[c01] * w01 + reach[c11] * w11;
      // Ice scatters nearly all the light it stops, so what is shadowed is
      // lit again by the cloud round it: a second, gentler octave of the
      // same extinction stands for every scattering after the first.
      const tau = SHADOW_DEPTH * before;
      lit[i] = Math.min(1, Math.exp(-tau) + 0.45 * Math.exp(-tau * 0.2));
      // What this puff lays across the ray: its snow, spread over the cells
      // its disc covers.
      const a01 = age[i] / life[i];
      const r = puffRadius(size0[i], grow[i], a01);
      const laid =
        puffOpacity(opacity[i], size0[i], grow[i], a01) *
        Math.min(1, (r * r) / (SHADOW_CELL * SHADOW_CELL));
      reach[c00] += laid * w00;
      reach[c10] += laid * w10;
      reach[c01] += laid * w01;
      reach[c11] += laid * w11;
    }
  }

  /** The map the cloud was last flown over — where a new puff's ground is
   * read before its first flight. */
  let levelRef: Level | null = null;
  function groundOf(x: number, z: number): number {
    return levelRef ? levelRef.groundAt(x, z) : -1e4;
  }

  // Emission carries fractions over from frame to frame, per skier.
  let debt = new WeakMap<SkierState, number[]>();
  const wall = emptyRecipe();
  const ski = emptyRecipe();
  const puff = emptyRecipe();
  const blown: CloudRecipe = {
    ...emptyRecipe(),
    hang: 4.5,
    settle: 0.35,
    tau: 1.4,
    opacity: 0.55,
    sparkle: 0.4,
  };
  const drive = { speed: 0, skid: 0, edge: 0, grounded: false };
  const shares: [number, number] = [0.5, 0.5];

  const api: SnowCloud = {
    mesh,
    emit(skier, dt, landed, snowAt) {
      let owed = debt.get(skier);
      if (!owed) {
        owed = [0, 0, 0];
        debt.set(skier, owed);
      }
      // THE SKI THAT CARRIES HIM throws the cloud (`ski-stand.ts`): the
      // outside one, two thirds of his weight and more in a turn — the
      // wall rises off its boot, and each ski's sheet goes by its share.
      skiShares(skier, shares);
      const lead = skier.contacts[(shares[0] >= shares[1] ? 0 : 3) + 1];
      const under = rotate(skier.q, { x: 0, y: -skier.spec.cogHeight, z: 0 });
      const on = lead?.touching === true;
      const ux = on ? lead.x : skier.x + under.x;
      const uy = on ? lead.y : skier.y + under.y;
      const uz = on ? lead.z : skier.z + under.z;
      const snow = snowAt(ux, uz);
      driveOf(skier, drive);
      // Which way the skis are sliding across their own line.
      const out = skier.skiAngle !== 0 ? -Math.sign(skier.skiAngle) : -Math.sign(skier.edge || 1);
      // THE SKID'S WALL, off the loaded ski's boot, out across the way.
      skidCloud(drive, snow, wall);
      owed[0] += wall.rate * dt * share;
      while (owed[0] >= 1) {
        owed[0] -= 1;
        // Spread along the frame's path, so a fast skier's plume is a
        // stream and not a string of beads a frame apart.
        const back = random() * dt;
        const at = rotate(skier.q, {
          x: (random() - 0.5) * 0.7 + out * 0.3,
          y: 0.1 + (random() - 0.5) * 0.2,
          z: (random() - 0.5) * 0.8,
        });
        const kick = rotate(skier.q, {
          x: out * wall.back * (0.6 + 0.8 * random()),
          y: wall.lift * (0.55 + 0.7 * random()),
          z: (random() - 0.5) * 1.5,
        });
        const x = ux + at.x - skier.vx * back;
        const z = uz + at.z - skier.vz * back;
        spawn(
          x,
          uy + at.y - skier.vy * back,
          z,
          skier.vx * 0.45 + kick.x,
          skier.vy * 0.3 + kick.y,
          skier.vz * 0.45 + kick.z,
          wall,
          groundOf(x, z),
        );
      }
      // THE SKIS: the sheet off a carve, the bow wave of a buried tip.
      const carve = carveOf(drive);
      for (let k = 0; k < 2; k++) {
        const tip = skier.contacts[k * 3];
        const mid = skier.contacts[k * 3 + 1];
        if (!mid || !mid.touching) continue;
        skiCloud(carve, tip?.touching ? tip.sink : 0, snowAt(mid.x, mid.z), ski, drive.speed);
        owed[1 + k] += ski.rate * dt * share * 2 * shares[k];
        while (owed[1 + k] >= 1) {
          owed[1 + k] -= 1;
          const c = random() < 0.5 && tip?.touching ? tip : mid;
          const kick = rotate(skier.q, {
            x: out * (0.8 + random() * 2),
            y: ski.lift * (0.5 + random()),
            z: -ski.back * random(),
          });
          const back = random() * dt;
          const x = c.x - skier.vx * back;
          const z = c.z - skier.vz * back;
          spawn(
            x,
            c.y + 0.15,
            z,
            skier.vx * 0.5 + kick.x,
            kick.y,
            skier.vz * 0.5 + kick.z,
            ski,
            groundOf(x, z),
          );
        }
      }
      // THE LANDING: a ring of cloud rolled out from under the skier.
      if (landed > 0) {
        const at = snowAt(skier.x, skier.z);
        const n = Math.round(landingPuffs(landed, at) * share);
        // A landing's cloud is the fall's, not the forward speed's: lofted
        // whole however slow he was going.
        skidCloud(
          { speed: skier.speed, skid: 1, edge: 0, grounded: true },
          at,
          puff,
          CLOUD.loft.full,
        );
        const g = groundOf(skier.x, skier.z);
        for (let i = 0; i < n; i++) {
          const a = random() * Math.PI * 2;
          const sp = 1.5 + random() * (2 + landed * 0.35);
          spawn(
            skier.x + Math.sin(a) * 0.8,
            g + 0.2 + random() * 0.4,
            skier.z + Math.cos(a) * 1.1,
            Math.sin(a) * sp + skier.vx * 0.35,
            0.8 + random() * (1 + landed * 0.15),
            Math.cos(a) * sp + skier.vz * 0.35,
            puff,
            g,
          );
        }
      }
    },
    burst(x, y, z, vx, vz, size, snow) {
      // A body meeting the snow throws its own cloud, whatever the speed.
      skidCloud({ speed: 8, skid: 1, edge: 0, grounded: true }, snow, puff, CLOUD.loft.full);
      const n = Math.round(Math.min(45, (5 + 35 * size) * snow.loose * snow.fine) * share);
      for (let i = 0; i < n; i++) {
        const a = random() * Math.PI * 2;
        const sp = 0.8 + random() * (1.5 + 3 * size);
        spawn(
          x + Math.sin(a) * 0.4 * random(),
          y + random() * 0.4,
          z + Math.cos(a) * 0.4 * random(),
          Math.sin(a) * sp + vx * 0.3,
          1 + random() * (1.5 + 2 * size),
          Math.cos(a) * sp + vz * 0.3,
          puff,
          groundOf(x, z),
        );
      }
    },
    blow(x, y, z, vx, vy, vz, size) {
      // The wash's snow: big, slow-settling puffs that hang and drift — a
      // whiteout is the air full of them.
      blown.size = size;
      blown.grow = size * 2.2;
      if (random() > share) return;
      spawn(x, y, z, vx, vy, vz, blown, groundOf(x, z));
    },
    update(dt, look, level, wind, eye) {
      levelRef = level;
      clock += dt;
      const u = material.uniforms;
      (u.uKey.value as THREE.Vector3).set(look.key.x, look.key.y, look.key.z);
      const sun = look.keyIntensity * 0.34;
      const sky = look.ambient;
      (u.uKeyCol.value as THREE.Color).setRGB(
        look.keyColour[0] * sun,
        look.keyColour[1] * sun,
        look.keyColour[2] * sun,
      );
      (u.uSkyCol.value as THREE.Color).setRGB(
        look.skyLight[0] * sky * 0.8,
        look.skyLight[1] * sky * 0.8,
        look.skyLight[2] * sky * 0.84,
      );
      (u.uGroundCol.value as THREE.Color).setRGB(
        look.groundLight[0] * sky * 0.65,
        look.groundLight[1] * sky * 0.65,
        look.groundLight[2] * sky * 0.65,
      );
      u.uGlint.value = look.glitter * (1 - look.night);
      u.uTime.value = clock;
      u.uNight.value = look.night;

      const sunX = look.key.x;
      const sunY = look.key.y;
      const sunZ = look.key.z;
      // Fly, and drop the dead from the order.
      let live = 0;
      for (let n = 0; n < count; n++) {
        const i = order[n];
        if (life[i] <= 0 || i >= cap) {
          listed[i] = 0;
          continue;
        }
        age[i] += dt;
        if (age[i] >= life[i]) {
          life[i] = 0;
          listed[i] = 0;
          continue;
        }
        const k = i * 3;
        flyPuff(vel, k, wind.x, 0, wind.z, tau[i], settle[i], dt);
        pos[k] += vel[k] * dt;
        pos[k + 1] += vel[k + 1] * dt;
        pos[k + 2] += vel[k + 2] * dt;
        // Settled onto the snow: it lies there and is gone sooner.
        const r = puffRadius(size0[i], grow[i], age[i] / life[i]);
        const floor = level.groundAt(pos[k], pos[k + 2]);
        ground[i] = floor;
        if (pos[k + 1] < floor + r * 0.3) {
          pos[k + 1] = floor + r * 0.3;
          if (vel[k + 1] < 0) vel[k + 1] = 0;
          age[i] += dt * 0.6;
        }
        const dx = pos[k] - eye.x;
        const dy = pos[k + 1] - eye.y;
        const dz = pos[k + 2] - eye.z;
        key[i] = dx * dx + dy * dy + dz * dz;
        toSun[i] = pos[k] * sunX + pos[k + 1] * sunY + pos[k + 2] * sunZ;
        order[live++] = i;
      }
      count = live;
      shadowWalk(look.key.x, look.key.y, look.key.z);
      // Far first: insertion sort over last frame's order, nearly sorted.
      for (let a = 1; a < count; a++) {
        const i = order[a];
        const v = key[i];
        let b = a - 1;
        while (b >= 0 && key[order[b]] < v) {
          order[b + 1] = order[b];
          b--;
        }
        order[b + 1] = i;
      }
      const P = iPos.array as Float32Array;
      const L = iLook.array as Float32Array;
      const S = iSnow.array as Float32Array;
      for (let n = 0; n < count; n++) {
        const i = order[n];
        const a01 = age[i] / life[i];
        const r = puffRadius(size0[i], grow[i], a01);
        P[n * 4] = pos[i * 3];
        P[n * 4 + 1] = pos[i * 3 + 1];
        P[n * 4 + 2] = pos[i * 3 + 2];
        P[n * 4 + 3] = r;
        L[n * 4] = puffOpacity(opacity[i], size0[i], grow[i], a01);
        L[n * 4 + 1] = seed[i];
        L[n * 4 + 2] = a01;
        L[n * 4 + 3] = ground[i];
        S[n * 4] = sparkle[i];
        // How thick it shades itself: dense young, thin once spread.
        S[n * 4 + 1] = Math.min(1.2, (opacity[i] * (size0[i] * 2.2)) / r + 0.25);
        S[n * 4 + 2] = spin[i] + a01 * (seed[i] - 0.5) * 1.5;
        S[n * 4 + 3] = lit[i];
      }
      geometry.instanceCount = count;
      iPos.needsUpdate = true;
      iLook.needsUpdate = true;
      iSnow.needsUpdate = true;
    },
    setFocus(x, y, z, veil) {
      (material.uniforms.uFocus.value as THREE.Vector4).set(x, y, z, veil);
    },
    setBudget(next) {
      share = Math.max(0, Math.min(1, next));
      cap = Math.max(1, Math.round(CAPACITY * share));
      head %= cap;
      for (let i = cap; i < CAPACITY; i++) life[i] = 0;
    },
    clear() {
      life.fill(0);
      listed.fill(0);
      count = 0;
      geometry.instanceCount = 0;
      debt = new WeakMap();
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      noise.dispose();
    },
  };

  return api;
}
