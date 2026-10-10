// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WATER AS DRAWN — every lake, pond, reservoir and stream on the map,
// open, freezing, frozen or breaking up on the map's day (`lake-ice.ts`,
// decided once by `water-plan.ts`), shaded by `water-glsl.ts`.
//
// WHY IT IS CHEAP ENOUGH TO DRAW A WHOLE LAKE. The water is ONE mesh in ONE
// draw call: each body's shore triangulated once (a lake of a few square
// kilometres is a few hundred triangles — the shore's points, no grid over
// the water), the streams laid as ribbons beside them. Everything that
// varies across the water — the shore's distance, the waves, the ice and
// its snow — is worked out per pixel off two small textures and the
// clock, so the cost is the pixels it covers and nothing per vertex. A
// cover wholly under snow is the TERRAIN's to draw (the ground is flattened
// to the surface, and the snow on it is the snow): on a winter's map whose
// every lake is snowed over, the mesh is hidden and costs nothing.

import * as THREE from "three";
import { regionOf, type Level, type RegionId, type Wind } from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import {
  WATER_FRAGMENT_COLOUR,
  WATER_FRAGMENT_MIRROR,
  WATER_FRAGMENT_NORMAL,
  WATER_FRAGMENT_PARS,
  WATER_FRAGMENT_ROUGHNESS,
  WATER_VERTEX_MAIN,
  WATER_VERTEX_PARS,
} from "./water-glsl.ts";
import { HORIZON_BEARINGS, planWater, showsAt, type WaterPlan } from "./water-plan.ts";

/** How far over the ground the surface is drawn, m (the ground is
 * flattened to it; this keeps the water in front without a fight). */
const LIFT = 0.04;
/** The wind on the water: a lake lies in the lee of its own shore. */
const LAKE_WIND = 0.6;
/** A stream's run, m/s. */
const STREAM_RUN = 0.8;

/** Each country's water, linear RGB: the deep and the shallows over the bed.
 * The alpine's glacial water has a cold green-blue in it; the north's
 * forest lakes are dark with peat; the maritime's between. */
const WATER_TINT: Record<RegionId, { deep: number[]; shallow: number[] }> = {
  alpine: { deep: [0.008, 0.045, 0.055], shallow: [0.05, 0.1, 0.095] },
  fell: { deep: [0.01, 0.018, 0.017], shallow: [0.075, 0.068, 0.045] },
  continental: { deep: [0.009, 0.026, 0.032], shallow: [0.06, 0.07, 0.055] },
  maritime: { deep: [0.008, 0.035, 0.045], shallow: [0.05, 0.085, 0.08] },
};

export type WaterView = {
  group: THREE.Group;
  /** What the map's water is doing today, for the labs. */
  plan: WaterPlan;
  /** The run's moment: the clock the waves run on, the wind on them. */
  update(t: number, wind: Wind): void;
  dispose(): void;
};

/** The map's water, or null where it has none. */
export function createWater(level: Level, haze: HazeUniforms): WaterView | null {
  const plan = planWater(level);
  if (!plan) return null;
  const group = new THREE.Group();
  group.name = "water";

  const pos: number[] = [];
  const ice: number[] = [];
  const water: number[] = [];
  const flow: number[] = [];
  const index: number[] = [];
  const push = (
    x: number,
    y: number,
    z: number,
    look: { ice: number[]; more: number[] },
    f: [number, number, number, number],
  ): number => {
    pos.push(x, y, z);
    ice.push(...look.ice);
    water.push(...look.more);
    flow.push(...f);
    return pos.length / 3 - 1;
  };
  const still: [number, number, number, number] = [0, 0, 0, -1];

  for (const { body, look } of plan.bodies) {
    if (!showsAt(look)) continue;
    const rings = body.rings.map((r) => {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i < r.length; i += 2) pts.push(new THREE.Vector2(r[i], r[i + 1]));
      return pts;
    });
    const [outer, ...holes] = rings;
    const faces = THREE.ShapeUtils.triangulateShape(outer, holes);
    const base = pos.length / 3;
    for (const ring of rings) {
      for (const p of ring) push(p.x, body.y + LIFT, p.y, look, still);
    }
    for (const [a, b, c] of faces) index.push(base + a, base + c, base + b);
  }

  for (const s of plan.streams) {
    if (!showsAt(s)) continue;
    const look = { ...s, more: [-1, s.more[1], s.more[2], s.more[3]] };
    const p = s.points;
    const n = p.length / 3;
    let prev = -1;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      let dx = p[3 * b] - p[3 * a];
      let dz = p[3 * b + 2] - p[3 * a + 2];
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      const half = s.width / 2;
      const x = p[3 * i];
      const y = p[3 * i + 1] + LIFT;
      const z = p[3 * i + 2];
      const f = (d: number): [number, number, number, number] => [dx, dz, STREAM_RUN, d];
      const l = push(x - dz * half, y, z + dx * half, look, f(0));
      push(x, y, z, look, f(half));
      push(x + dz * half, y, z - dx * half, look, f(0));
      if (prev >= 0) {
        for (let k = 0; k < 2; k++) {
          const p0 = prev + k;
          const q0 = l + k;
          index.push(p0, p0 + 1, q0, p0 + 1, q0 + 1, q0);
        }
      }
      prev = l;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(
      pos.map((_, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  );
  geo.setAttribute("aIce", new THREE.Float32BufferAttribute(ice, 4));
  geo.setAttribute("aWater", new THREE.Float32BufferAttribute(water, 4));
  geo.setAttribute("aFlow", new THREE.Float32BufferAttribute(flow, 4));
  geo.setIndex(index);
  geo.computeBoundingSphere();

  const shoreTex = new THREE.DataTexture(
    plan.shore.data,
    plan.shore.cols,
    plan.shore.rows,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  shoreTex.minFilter = THREE.LinearFilter;
  shoreTex.magFilter = THREE.LinearFilter;
  shoreTex.needsUpdate = true;
  const rows = Math.max(1, plan.bodies.length);
  const horizonTex = new THREE.DataTexture(plan.horizon, HORIZON_BEARINGS, rows, THREE.RGBAFormat);
  horizonTex.wrapS = THREE.RepeatWrapping;
  horizonTex.minFilter = THREE.LinearFilter;
  horizonTex.magFilter = THREE.LinearFilter;
  horizonTex.needsUpdate = true;

  const s = plan.shore;
  const tint = WATER_TINT[regionOf(level).id];
  const own = {
    uShore: { value: shoreTex },
    uShoreBox: {
      value: new THREE.Vector4(s.originX, s.originZ, 1 / (s.cols * s.cell), 1 / (s.rows * s.cell)),
    },
    uShoreHalf: { value: new THREE.Vector2(0.5 / s.cols, 0.5 / s.rows) },
    uLakeHorizon: { value: horizonTex },
    uLakeHorizonRows: { value: rows },
    uWaterT: { value: 0 },
    uWaterWind: { value: new THREE.Vector2() },
    uDeep: { value: new THREE.Color().fromArray(tint.deep) },
    uShallow: { value: new THREE.Color().fromArray(tint.shallow) },
  };
  const material = hazeMaterial(
    new THREE.MeshStandardMaterial({ roughness: 0.05, metalness: 0, transparent: true }),
    haze,
    "water",
    (shader) => {
      Object.assign(shader.uniforms, own);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${WATER_VERTEX_PARS}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\n${WATER_VERTEX_MAIN}`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <color_fragment>", WATER_FRAGMENT_COLOUR)
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>\n${WATER_FRAGMENT_ROUGHNESS}`,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `#include <normal_fragment_maps>\n${WATER_FRAGMENT_NORMAL}`,
        )
        .replace(
          "#include <opaque_fragment>",
          `${WATER_FRAGMENT_MIRROR}\n#include <opaque_fragment>`,
        )
        // The sky's helpers come in with the haze, right after `common`;
        // the water's own read them, so they are stood after them.
        .replace(
          "#include <dithering_pars_fragment>",
          `#include <dithering_pars_fragment>\n${WATER_FRAGMENT_PARS}`,
        );
    },
  );
  material.depthWrite = false;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -4;
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  mesh.visible = index.length > 0;
  group.add(mesh);

  return {
    group,
    plan,
    update(t, wind) {
      own.uWaterT.value = t;
      own.uWaterWind.value.set(wind.x * LAKE_WIND, wind.z * LAKE_WIND);
    },
    dispose() {
      geo.dispose();
      material.dispose();
      shoreTex.dispose();
      horizonTex.dispose();
    },
  };
}
