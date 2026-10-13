// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FAR RANGES, DRAWN — the country round a map out to the horizon, as
// two meshes of real ground lit by the run's own sky (the plan is
// `far-ranges-plan.ts`, the country `far-ranges-field.ts`):
//
//   * THE RINGS, the BACKDROP: drawn right after the dome, pinned just in
//     front of the far plane and writing no depth, so the whole map and
//     everything on it draws over them; their triangles come outermost
//     first, so a nearer range covers a farther one from anywhere.
//   * THE DISC, the map's own mountain coarse, at its real depth right
//     after them: where the clipmap stops (past the DISTANCE row's mist)
//     the map still stands in front of the ranges behind it.
//
// Both are lit as the snow is — the key light through the air DOWN TO THE
// HEIGHT of the face it lands on (`sky-light.ts`'s `sunAtHeight`: the peaks keep a
// warm sun after the valleys lose it, and Earth's shadow climbs them at
// dusk), cut off where the key is under the horizon that point sees toward
// it (a range shading the next), and the sky's hemisphere over all — then
// through the same haze every world material fades into (`HAZE_FRAGMENT`),
// the Earth's curve laid into the heights. The DISTANCE row's mist closes
// on them as it does on the ground, then lets them go again with every
// `FAR_MIST_FADE` m past its wall: the far ranges are no draw distance's.
//
// Presentation only: nothing here touches the engine's state or stream.

import * as THREE from "three";

import type { Level } from "@engine";
import { regionOf } from "@engine";

import { FAR_RADIUS } from "./horizon.ts";
import { HAZE_FRAGMENT, SKY_GLSL, type HazeUniforms } from "./haze.ts";
import { dealtGrid, farFrame, type FarFrame, type FarGrid } from "./far-ranges-field.ts";
import {
  FAR_AIR,
  FAR_MIST_FADE,
  FAR_RINGS,
  discMesh,
  farGround,
  horizonToward,
  keyBands,
  rimGrid,
  ringMesh,
  type FarMesh,
} from "./far-ranges-plan.ts";
import { regionLookOf } from "./region-look.ts";
import type { Tier } from "./settings-video.ts";
import { sunAtHeight } from "./sky-light.ts";
import { AERIAL_GLSL } from "./sky-gpu-glsl.ts";
import type { Dir, SkyLook } from "./sky.ts";
import { TERRAIN_REACH } from "./settings-video.ts";

/** The key's bearing has to have turned this far before the horizons are
 * marched again, rad; and how long a frame may march them, ms (a few
 * hundred vertices — the whole HIGH mesh again in a couple of seconds,
 * while the sun takes eight to turn the step on the sky's clock). */
const HORIZON_STEP = 0.007;
const HORIZON_BUDGET = 1;

/** A lab's switch (`make sky ARGS=--far=0`): the ranges drawn (null: as
 * the game draws them) or not, on every instance. */
let forced: boolean | null = null;
export function forceFar(on: boolean | null): void {
  forced = on;
}

export type FarRanges = {
  readonly group: THREE.Group;
  /** Build the country round `level` (null: none) for the key `key`; the
   * real faces' country (`far-faces/`) is fetched first. */
  setLevel(level: Level | null, key: Dir | null, grid?: FarGrid | null): void;
  /** The DISTANCE row's tier of rings. */
  setTier(tier: Tier): void;
  /** The light of this frame, and the horizons marched on a little. */
  update(look: SkyLook): void;
  /** What is drawn: vertices and triangles, for the labs. */
  stats(): { vertices: number; triangles: number };
  dispose(): void;
};

const VERTEX = /* glsl */ `
attribute vec3 aAlbedo;
attribute float aHorizon;
uniform float uBackdrop;
varying vec3 vHazeWorld;
varying vec3 vNormal;
varying vec3 vAlbedo;
varying float vHorizon;
void main() {
  vec3 w = position;
  // The Earth's curve, refracted: the ground falls away under the lens
  // with the square of the distance.
  vec2 off = w.xz - cameraPosition.xz;
  w.y -= dot(off, off) / ${(2 * FAR_RADIUS).toFixed(1)};
  vHazeWorld = w;
  vNormal = normal;
  vAlbedo = aAlbedo;
  vHorizon = aHorizon;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  if (uBackdrop > 0.5) gl_Position.z = gl_Position.w * 0.9999999;
}
`;

const FRAGMENT = /* glsl */ `
${SKY_GLSL}
${AERIAL_GLSL}
uniform vec4 uBandY;
uniform vec3 uBand[4];
uniform vec3 uKeyDir;
uniform vec3 uSkyLight;
uniform vec3 uGroundLight;
uniform float uAmbient;
uniform float uNear;
varying vec3 vHazeWorld;
varying vec3 vNormal;
varying vec3 vAlbedo;
varying float vHorizon;

// The key at height \`y\`: between the bands it was reckoned at.
vec3 keyAt(float y) {
  if (y <= uBandY.x) return uBand[0];
  if (y <= uBandY.y) return mix(uBand[0], uBand[1], (y - uBandY.x) / (uBandY.y - uBandY.x));
  if (y <= uBandY.z) return mix(uBand[1], uBand[2], (y - uBandY.y) / (uBandY.z - uBandY.y));
  return mix(uBand[2], uBand[3], clamp((y - uBandY.z) / (uBandY.w - uBandY.z), 0.0, 1.0));
}

// The air between the ranges: the game's haze over the map's scale, the
// clear air's past it (FAR_AIR).
float farAir(float dist) {
  return min(dist, ${FAR_AIR.near.toFixed(1)}) + max(dist - ${FAR_AIR.near.toFixed(1)}, 0.0) * ${FAR_AIR.thin.toFixed(3)};
}

// The DISTANCE row's mist, let go again past its wall — unless it is let
// open (\`uMistOpen\`, the disc standing past the wall), when it is only a
// floor under the air and is held, so the haze never thins outward.
float farMist(float dist, float rise) {
  float go = exp(-max(dist - uMist, 0.0) / ${FAR_MIST_FADE.toFixed(1)});
  return hazeMist(dist, rise) * mix(go, 1.0, uMistOpen);
}

void main() {
  vec3 hzRay0 = vHazeWorld - cameraPosition;
  // The disc stands only where the clipmap does not.
  if (uNear > 0.0 && length(hzRay0.xz) < uNear) discard;
  vec3 n = normalize(vNormal);
  float up = asin(clamp(uKeyDir.y, -1.0, 1.0));
  float lit = smoothstep(-0.006, 0.006, up - vHorizon);
  // The height the key is read at is the ground's own, the curve's drop
  // given back.
  vec2 off = vHazeWorld.xz - cameraPosition.xz;
  float y = vHazeWorld.y + dot(off, off) / ${(2 * FAR_RADIUS).toFixed(1)};
  vec3 key = keyAt(y) * max(dot(n, uKeyDir), 0.0) * lit;
  vec3 hemi = mix(uGroundLight, uSkyLight, 0.5 * n.y + 0.5) * uAmbient;
  gl_FragColor = vec4(vAlbedo * (key + hemi) / 3.14159265, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  ${HAZE_FRAGMENT.replace("hazeMist(hzDist, hzRay.y)", "farMist(hzDist, hzRay.y)").replace("hazeAir(hzDist, hzRay.y)", "hazeAir(farAir(hzDist), hzRay.y)")}
}
`;

type Part = {
  mesh: THREE.Mesh;
  plan: FarMesh;
  horizon: THREE.BufferAttribute;
};

function geometryOf(plan: FarMesh): {
  geometry: THREE.BufferGeometry;
  horizon: THREE.BufferAttribute;
} {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(plan.positions, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(plan.normals, 3));
  g.setAttribute("aAlbedo", new THREE.BufferAttribute(plan.albedo, 3));
  const horizon = new THREE.BufferAttribute(new Float32Array(plan.positions.length / 3), 1);
  g.setAttribute("aHorizon", horizon);
  g.setIndex(new THREE.BufferAttribute(plan.index, 1));
  return { geometry: g, horizon };
}

export function createFarRanges(haze: HazeUniforms): FarRanges {
  const group = new THREE.Group();
  group.name = "far-ranges";
  const own = {
    uBandY: { value: new THREE.Vector4(0, 1000, 2000, 3000) },
    uBand: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
    uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
    uSkyLight: { value: new THREE.Vector3(1, 1, 1) },
    uGroundLight: { value: new THREE.Vector3(1, 1, 1) },
    uAmbient: { value: 1 },
  };
  const material = (backdrop: boolean): THREE.ShaderMaterial => {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        ...haze,
        ...own,
        uBackdrop: { value: backdrop ? 1 : 0 },
        uNear: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthWrite: !backdrop,
      depthTest: true,
    });
    if (!backdrop) {
      // Behind the clipmap wherever both stand.
      m.polygonOffset = true;
      m.polygonOffsetFactor = 4;
      m.polygonOffsetUnits = 64;
    }
    return m;
  };
  const ringMaterial = material(true);
  const discMaterial = material(false);

  let level: Level | null = null;
  let frame: FarFrame | null = null;
  let grid: FarGrid | null = null;
  let tier: Tier = "high";
  let rings: Part | null = null;
  let disc: Part | null = null;
  let ground: ((x: number, z: number) => number) | null = null;
  /** The bearing the horizons stand for, and the march under way. */
  let bearing = NaN;
  let march: {
    bearing: number;
    part: 0 | 1;
    at: number;
    rings: Float32Array;
    disc: Float32Array;
  } | null = null;
  const band: [number, number, number] = [0, 0, 0];

  const drop = (p: Part | null): void => {
    if (!p) return;
    group.remove(p.mesh);
    p.mesh.geometry.dispose();
  };
  const partOf = (plan: FarMesh, mat: THREE.ShaderMaterial, order: number, name: string): Part => {
    const { geometry, horizon } = geometryOf(plan);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.renderOrder = order;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    return { mesh, plan, horizon };
  };
  const horizonsInto = (
    plan: FarMesh,
    out: Float32Array,
    from: number,
    to: number,
    b: number,
  ): void => {
    if (!ground) return;
    const p = plan.positions;
    for (let k = from; k < to; k++)
      out[k] = horizonToward(ground, p[k * 3], p[k * 3 + 1] + 2, p[k * 3 + 2], b);
  };
  const buildRings = (): void => {
    drop(rings);
    rings = null;
    if (!level || !frame || !grid) return;
    const look = regionLookOf(regionOf(level).id);
    rings = partOf(
      ringMesh(level, frame, grid, look, FAR_RINGS[tier]),
      ringMaterial,
      -8,
      "far-rings",
    );
    if (Number.isFinite(bearing)) {
      horizonsInto(
        rings.plan,
        rings.horizon.array as Float32Array,
        0,
        rings.horizon.count,
        bearing,
      );
      rings.horizon.needsUpdate = true;
    }
    march = null;
  };
  const bearingOf = (key: Dir): number => Math.atan2(key.x, key.z);

  return {
    group,
    setLevel(next, key, real = null) {
      drop(rings);
      drop(disc);
      rings = null;
      disc = null;
      march = null;
      bearing = NaN;
      level = next;
      frame = next ? farFrame(next) : null;
      grid = next && frame ? (real ?? dealtGrid(frame)) : null;
      ground = next && frame && grid ? farGround(next, frame, grid) : null;
      const box = haze.uFarRimBox.value;
      box.set(0, 0, 1, 0);
      if (!next || !frame || !grid) return;
      const look = regionLookOf(regionOf(next).id);
      disc = partOf(discMesh(next, frame, look, FAR_RINGS.high.disc), discMaterial, -7, "far-disc");
      const [b0, b1, b2, b3] = keyBands(frame);
      own.uBandY.value.set(b0, b1, b2, b3);
      if (key) bearing = bearingOf(key);
      buildRings();
      if (key) {
        horizonsInto(disc.plan, disc.horizon.array as Float32Array, 0, disc.horizon.count, bearing);
        disc.horizon.needsUpdate = true;
      }
      // THE RIM the clipmap carries past the edge, onto the shared haze.
      const rim = rimGrid(next, frame, grid);
      const tex = new THREE.DataTexture(
        rim.heights,
        rim.count,
        rim.count,
        THREE.RedFormat,
        THREE.FloatType,
      );
      tex.needsUpdate = true;
      haze.uFarRim.value?.dispose();
      haze.uFarRim.value = tex;
      box.set(rim.origin, rim.cell, rim.count, rim.count);
      haze.uFarRimSpan.value.set(rim.rise, rim.drop);
    },
    setTier(next) {
      if (next === tier) return;
      tier = next;
      buildRings();
    },
    update(look) {
      group.visible = forced ?? true;
      const k = look.key;
      own.uKeyDir.value.set(k.x, k.y, k.z);
      own.uSkyLight.value.set(...look.skyLight);
      own.uGroundLight.value.set(...look.groundLight);
      own.uAmbient.value = look.ambient;
      discMaterial.uniforms.uNear.value = discNear(haze.uMist.value);
      // The mist need close only where nothing stands past its wall.
      haze.uMistOpen.value = group.visible && disc ? 1 : 0;
      // The key at each band's height: the sun through the air down to it
      // (by day and through the twilights), the moon's as it is.
      const bands = own.uBand.value;
      const ys = own.uBandY.value;
      const sea = frame?.sea ?? 0;
      const bySun = look.key !== look.moon;
      [ys.x, ys.y, ys.z, ys.w].forEach((y, i) => {
        if (bySun) {
          sunAtHeight(look.elevation, Math.max(0, y - sea), band);
          const s = look.light * look.keyPass;
          bands[i].set(band[0] * s, band[1] * s, band[2] * s);
        } else {
          bands[i].set(...look.keyColour).multiplyScalar(look.keyIntensity);
        }
      });
      // THE HORIZONS: marched again a slice a frame once the key has
      // turned, and swapped in whole.
      if (!rings || !disc) return;
      const b = bearingOf(k);
      if (
        !march &&
        !(Math.abs(Math.atan2(Math.sin(b - bearing), Math.cos(b - bearing))) < HORIZON_STEP)
      ) {
        march = {
          bearing: b,
          part: 0,
          at: 0,
          rings: new Float32Array(rings.horizon.count),
          disc: new Float32Array(disc.horizon.count),
        };
      }
      if (!march) return;
      const until = performance.now() + HORIZON_BUDGET;
      while (march && performance.now() < until) {
        const part = march.part === 0 ? rings : disc;
        const out = march.part === 0 ? march.rings : march.disc;
        const to = Math.min(part.horizon.count, march.at + 32);
        horizonsInto(part.plan, out, march.at, to, march.bearing);
        march.at = to;
        if (to < part.horizon.count) break;
        if (march.part === 0) {
          march.part = 1;
          march.at = 0;
          continue;
        }
        (rings.horizon.array as Float32Array).set(march.rings);
        (disc.horizon.array as Float32Array).set(march.disc);
        rings.horizon.needsUpdate = true;
        disc.horizon.needsUpdate = true;
        bearing = march.bearing;
        march = null;
      }
    },
    stats() {
      let vertices = 0;
      let triangles = 0;
      for (const p of [rings, disc]) {
        if (!p) continue;
        vertices += p.horizon.count;
        triangles += p.plan.index.length / 3;
      }
      return { vertices, triangles };
    },
    dispose() {
      drop(rings);
      drop(disc);
      ringMaterial.dispose();
      discMaterial.dispose();
      haze.uFarRim.value?.dispose();
    },
  };
}

/** The disc's near edge for a mist (`uMist`, 0 none): it stands only past
 * where the clipmap draws the ground. */
export function discNear(mist: number): number {
  return mist > 0 ? mist : TERRAIN_REACH;
}
