// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW CLOUD'S SHADOW ON THE SLOPE. White snow in the air over white
// snow on the ground has nothing to tell them apart by day: what makes a
// powder plume read in the sun is the SHADOW it lays across the slope
// beside it — a soft grey-blue blot the shape of the plume, stretched away
// from a low sun — and its shaded underside (the cloud's own, `shade`).
//
// Each puff's shadow is a soft ellipse laid IN THE PLANE OF THE SNOW where
// the key's ray through the puff meets it, stretched along the key by how
// much it grazes (1 ÷ n·k, at most `STRETCH`), drawn as a MULTIPLY over
// what is already there. Overlapping puffs stack as one Beer–Lambert
// column — a thick plume's shadow dark and a thin one's faint — but the
// stack takes away only the KEY's share of the snow's light, never more:
// each puff is told how many it lies under (`overlapOf`) and lays its
// root of the stack's shadow, so a roost of a hundred puffs is a shadow
// and never a black smear (the sky still lights a shadow):
// none in the mountain's shade or under an overcast, where there is no key
// to take (`snow-air-light.ts`'s `vAirKey`, the sky's irradiance on the
// snow's normal), and it fades into the haze.
//
// Presentation only. One instanced draw, the cloud's puffs read where they
// are (`snow-cloud.ts` hands them over after it flies them).

import * as THREE from "three";
import type { Level, Vec3 } from "@engine";

import { SKY_GLSL, type HazeUniforms } from "./haze.ts";
import { AIR_LIGHT_VERTEX } from "./snow-air-light.ts";
import { LOOSE } from "./trail-stamp.ts";
import { nodeTwin } from "./gpu-backend.ts";

/** The most a shadow is stretched along a grazing key. */
export const STRETCH = 3;
/** How dark a puff's middle lays its shadow, per unit of its opacity. */
export const DARK = 2.2;
/** The share of the key a cloud stops that still reaches the snow under
 * it: ice crystals scatter nearly all the light they stop, and most of it
 * FORWARD (Henyey–Greenstein g near 0.86), down onto its own shadow — so a
 * snow cloud's shadow is grey, never the black of a solid's. */
export const FILL = 0.5;
/** Below this key elevation (its sine) a shadow is too long to lay. */
const LOWEST = 0.04;

const VERTEX = /* glsl */ `
attribute vec4 iSpot;
attribute vec4 iFace;
attribute float iStack;
${AIR_LIGHT_VERTEX}
varying vec2 vUv;
varying float vTake;
varying float vOpacity;
varying float vStack;
varying vec3 vWorld;
void main() {
  vec3 n = iFace.xyz;
  float nk = max(dot(n, uSunDir), 0.05);
  // Two axes in the snow's plane: along the key's lean, and across it.
  vec3 t1 = uSunDir - n * dot(n, uSunDir);
  float l1 = length(t1);
  t1 = l1 > 1e-3 ? t1 / l1 : normalize(cross(n, vec3(0.0, 0.0, 1.0)));
  vec3 t2 = cross(n, t1);
  float r = iSpot.w;
  vec3 w = iSpot.xyz + t1 * position.x * r * min(1.0 / nk, ${STRETCH.toFixed(1)}) + t2 * position.y * r;
  vUv = position.xy;
  vWorld = w;
  // THE KEY'S SHARE of the snow's light here: what the shadow takes away.
  airLight(iSpot.xyz);
  float key = dot(vAirKey, vec3(0.2126, 0.7152, 0.0722)) * nk;
  float sky = dot(skyIrradiance(n) * 0.31831, vec3(0.2126, 0.7152, 0.0722));
  vTake = key / max(key + sky, 1e-4);
  vOpacity = iFace.w;
  vStack = max(iStack, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
${SKY_GLSL}
varying vec2 vUv;
varying float vTake;
varying float vOpacity;
varying float vStack;
varying vec3 vWorld;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  // The light let through: Beer–Lambert on the puff's soft profile.
  float through = 1.0 - vOpacity * (1.0 - exp(-${DARK.toFixed(2)} * exp(-2.6 * r2) * (1.0 - r2)));
  // The stack of vStack such puffs lets through pow(through, vStack) of
  // the key, and the sky lights the rest: this puff lays the vStack-th
  // root of that, so the multiplied stack is the stack's shadow.
  float keep = pow(1.0 - vTake * ${(1 - FILL).toFixed(2)} * (1.0 - pow(through, vStack)), 1.0 / vStack);
  // Into the haze, as the snow it lies on.
  vec3 ray = vWorld - cameraPosition;
  keep = mix(keep, 1.0, hazeAmount(length(ray), ray.y));
  // A multiply over the snow already drawn, in the linear light the
  // picture is drawn in before its grade (grade-pass.ts).
  gl_FragColor = vec4(vec3(keep), 1.0);
}
`;

/** The cell the shadows are binned in to find their neighbours, m. */
const CELL = 2;

/**
 * How many shadows each one lies under, itself counted: `spot` four floats
 * a shadow (its middle on the snow and its radius), `opacity` one a shadow
 * at stride `stride`. A neighbour counts by its opacity and by how far into
 * it this one's middle lies (1 at its middle, 0 at its rim). Written into
 * `out`, at least 1 each.
 */
export function overlapOf(
  spot: Float32Array,
  opacity: Float32Array,
  stride: number,
  n: number,
  out: Float32Array,
  bins: Map<number, number[]> = new Map(),
): void {
  bins.clear();
  const keyOf = (cx: number, cz: number) => cx * 73856093 + cz * 19349663;
  for (let i = 0; i < n; i++) {
    const k = keyOf(Math.floor(spot[i * 4] / CELL), Math.floor(spot[i * 4 + 2] / CELL));
    let bin = bins.get(k);
    if (!bin) bins.set(k, (bin = []));
    bin.push(i);
  }
  for (let i = 0; i < n; i++) {
    const x = spot[i * 4];
    const z = spot[i * 4 + 2];
    const reach = spot[i * 4 + 3];
    const span = Math.ceil(reach / CELL) + 1;
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    let sum = 1;
    for (let a = -span; a <= span; a++) {
      for (let b = -span; b <= span; b++) {
        const bin = bins.get(keyOf(cx + a, cz + b));
        if (!bin) continue;
        for (const j of bin) {
          if (j === i) continue;
          const r = spot[j * 4 + 3];
          const d = Math.hypot(spot[j * 4] - x, spot[j * 4 + 2] - z);
          if (d < r) sum += opacity[j * stride] * (1 - d / r);
        }
      }
    }
    out[i] = sum;
  }
}

/** The snow's surface as the terrain draws it, before the trail lowers it. */
function drawnSnow(level: Level, x: number, z: number): number {
  return level.groundAt(x, z) + LOOSE * (1 - level.packedAt(x, z));
}

export type CloudShadow = {
  mesh: THREE.Mesh;
  /** Lay the shadows of `count` puffs, as the cloud packs them for its
   * draw: `spot` four floats a puff (its middle and radius), `look` four
   * (its opacity first), under the key `key` (toward it). */
  update(
    level: Level,
    key: { x: number; y: number; z: number },
    count: number,
    spot: Float32Array,
    look: Float32Array,
  ): void;
  clear(): void;
  dispose(): void;
};

export function createCloudShadow(
  haze: HazeUniforms,
  keyCol: { value: THREE.Color },
  capacity: number,
): CloudShadow {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const spot = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  const face = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  spot.setUsage(THREE.DynamicDrawUsage);
  face.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("iSpot", spot);
  geometry.setAttribute("iFace", face);
  const stack = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  stack.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("iStack", stack);
  const bins = new Map<number, number[]>();
  geometry.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    uniforms: { ...haze, uKeyCol: keyCol },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor,
    blendDst: THREE.SrcColorFactor,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  // Drawn on the node renderer by its twin (`snow-cloud-tsl.ts`).
  nodeTwin(material, "particles", "cloud-shadow");
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  // On the snow, under the spray and the cloud.
  mesh.renderOrder = 4;
  mesh.name = "snow-cloud-shadow";
  const normal: Vec3 = { x: 0, y: 1, z: 0 };

  return {
    mesh,
    update(level, key, count, P, L) {
      const S = spot.array as Float32Array;
      const F = face.array as Float32Array;
      let n = 0;
      if (key.y > LOWEST) {
        for (let m = 0; m < count && n < capacity; m++) {
          const o = L[m * 4];
          if (o < 0.02) continue;
          const px = P[m * 4];
          const py = P[m * 4 + 1];
          const pz = P[m * 4 + 2];
          // Down the key's ray to the snow AS DRAWN — the engine's ground
          // with the loose cover over it (`snow-glsl.ts`'s `LOOSE`), or the
          // shadow lies under the powder's surface — twice, the second off
          // the snow the first one found.
          let g = drawnSnow(level, px, pz);
          let t = Math.max(0, (py - g) / key.y);
          let qx = px - key.x * t;
          let qz = pz - key.z * t;
          g = drawnSnow(level, qx, qz);
          t = Math.max(0, (py - g) / key.y);
          qx = px - key.x * t;
          qz = pz - key.z * t;
          g = drawnSnow(level, qx, qz);
          level.normalAt(qx, qz, normal);
          S[n * 4] = qx + normal.x * 0.03;
          S[n * 4 + 1] = g + normal.y * 0.03;
          S[n * 4 + 2] = qz + normal.z * 0.03;
          S[n * 4 + 3] = P[m * 4 + 3];
          F[n * 4] = normal.x;
          F[n * 4 + 1] = normal.y;
          F[n * 4 + 2] = normal.z;
          F[n * 4 + 3] = Math.min(1, o);
          n++;
        }
      }
      geometry.instanceCount = n;
      if (n > 0) {
        overlapOf(S, F.subarray(3), 4, n, stack.array as Float32Array, bins);
        stack.clearUpdateRanges();
        stack.addUpdateRange(0, n);
        stack.needsUpdate = true;
        spot.clearUpdateRanges();
        face.clearUpdateRanges();
        spot.addUpdateRange(0, n * 4);
        face.addUpdateRange(0, n * 4);
        spot.needsUpdate = true;
        face.needsUpdate = true;
      }
    },
    clear() {
      geometry.instanceCount = 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
