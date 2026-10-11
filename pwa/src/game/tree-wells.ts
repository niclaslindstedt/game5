// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREE WELLS AS DRAWN — the hollow round a trunk in deep powder
// (`engine/game/tree-well.ts` is the hollow; this draws the same one).
//
// THE WELL MAP. The ground's mesh reads its height out of the generator's
// two-metre heightfield, far too coarse for a pit two or three metres
// across, so the wells come to the shader as a map of their own: a square
// of `SPAN` metres round the lens at `CELL` a texel, each texel the
// engine's own `wellDepthOf` over the snow the packed field leaves loose —
// the same number the skier's legs meet, never a second model. The vertex
// shader lowers the snow by it, the per-pixel normal takes its slope, and
// the colour reads its depth: the hollow under the boughs a cooler,
// shadier grey-blue, and on its floor the needles, twigs and flakes of bark
// a spruce sheds into it. The map is refilled only round the wells that
// reach it, when the lens has moved `RECENTRE` metres from its middle; the
// last eighth of it fades to nothing so a well never pops.
//
// THE TRUNK IN IT. A tree is drawn from the snow's surface up; a well
// opens the snow round its foot, so each well near the lens draws the
// trunk on down to its floor — a plain stub in the kind's own bark, as wide
// as the trunk's foot, going straight into the snow. Nothing else: no root
// and no dead twig, which at this scale read as thin spikes, not as wood.

import * as THREE from "three";
import { regionOf, wellDepthOf, type Level, type TreeWell } from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { regionLookOf } from "./region-look.ts";
import { FLARE } from "./tree-mesh.ts";
import { kindPaint, treePaint } from "./tree-shapes.ts";
import { treeTilt, trunkYaw } from "./tree-tilt.ts";
import { leadVariant } from "./tree-variants.ts";

/** The well map's texel, m, and its width in texels: `SPAN` m round the
 * lens. */
const CELL = 0.5;
const TEXELS = 320;
const SPAN = CELL * TEXELS;
/** How far the lens moves off the map's middle before it is refilled, m. */
const RECENTRE = 16;
/** The wells whose trunks are drawn: within `NEAR` m of the
 * lens and at least `SHOWN` m deep at the trunk. */
const NEAR = 70;
const SHOWN = 0.2;
const UP = new THREE.Vector3(0, 1, 0);

/** The shader's half: the map, its frame (origin x, origin z, span, on). */
export const WELL_GLSL = /* glsl */ `
uniform sampler2D uWell;
uniform vec4 uWellFrame;
float wellDepth(vec2 p) {
  if (uWellFrame.w <= 0.0) return 0.0;
  vec2 u = (p - uWellFrame.xy) / uWellFrame.z;
  vec2 e = min(u, 1.0 - u);
  float edge = min(e.x, e.y);
  if (edge <= 0.0) return 0.0;
  return textureLod(uWell, u, 0.0).r * smoothstep(0.0, 0.125, edge);
}
`;

export type WellUniforms = {
  uWell: { value: THREE.Texture };
  uWellFrame: { value: THREE.Vector4 };
};

export type TreeWellsView = {
  uniforms: WellUniforms;
  /** The trunks in the wells near the lens. */
  group: THREE.Group;
  /** Keep the map round the lens at (`x`, `z`). */
  follow(x: number, z: number): void;
  dispose(): void;
};

/** The deepest well over (`x`, `z`) among `near`, as loose as the packed
 * field leaves it — `tree-well.ts`'s `wellAt` over a short list. */
function depthAt(level: Level, near: readonly TreeWell[], x: number, z: number): number {
  let most = 0;
  for (const w of near) {
    const d = wellDepthOf(w, x, z);
    if (d > most) most = d;
  }
  return most > 0 ? most * (1 - level.packedAt(x, z)) : 0;
}

export function createTreeWells(level: Level, haze: HazeUniforms): TreeWellsView {
  const field = level.wells;
  const data = new Uint16Array(TEXELS * TEXELS);
  const tex = new THREE.DataTexture(data, TEXELS, TEXELS, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  const frame = new THREE.Vector4(0, 0, SPAN, field ? 1 : 0);
  const uniforms: WellUniforms = { uWell: { value: tex }, uWellFrame: { value: frame } };
  const group = new THREE.Group();
  group.name = "tree-wells";

  // The wood: a straight stub to the floor.
  const paint = treePaint(regionLookOf(regionOf(level).id));
  // The stub hangs DOWN from the drawn trunk's foot along its axis, as wide
  // all the way as the foot it carries on and cut with its five faces
  // (`tree-shapes.ts`'s nearest cut, `tree-mesh.ts`'s `stemUp` corners).
  const stubGeo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true, Math.PI / 2);
  stubGeo.translate(0, -0.5, 0);
  const room = field ? Math.min(field.list.length, 600) : 0;
  const stubs = new THREE.InstancedMesh(
    stubGeo,
    hazeMaterial(
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }),
      haze,
      "well-stub",
    ),
    Math.max(1, room),
  );
  stubs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(stubs.count * 3), 3);
  stubs.count = 0;
  stubs.frustumCulled = false;
  group.add(stubs);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const turn = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const colour = new THREE.Color();
  const axis = new THREE.Vector3();
  const ground = { x: 0, y: 1, z: 0 };
  let filled = false;

  /** The map refilled round (`cx`, `cz`), and the wood near it laid. */
  const fill = (cx: number, cz: number): void => {
    if (!field) return;
    const ox = Math.round((cx - SPAN / 2) / CELL) * CELL;
    const oz = Math.round((cz - SPAN / 2) / CELL) * CELL;
    frame.x = ox;
    frame.y = oz;
    data.fill(0);
    const ex = ox + SPAN;
    const ez = oz + SPAN;
    const touching = field.list.filter(
      (w) => w.x + w.bound > ox && w.x - w.bound < ex && w.z + w.bound > oz && w.z - w.bound < ez,
    );
    const depths = new Float32Array(TEXELS * TEXELS);
    for (const w of touching) {
      const c0 = Math.max(0, Math.floor((w.x - w.bound - ox) / CELL));
      const c1 = Math.min(TEXELS - 1, Math.ceil((w.x + w.bound - ox) / CELL));
      const r0 = Math.max(0, Math.floor((w.z - w.bound - oz) / CELL));
      const r1 = Math.min(TEXELS - 1, Math.ceil((w.z + w.bound - oz) / CELL));
      for (let r = r0; r <= r1; r++) {
        const z = oz + (r + 0.5) * CELL;
        for (let c = c0; c <= c1; c++) {
          const d = wellDepthOf(w, ox + (c + 0.5) * CELL, z);
          const k = r * TEXELS + c;
          if (d > depths[k]) depths[k] = d;
        }
      }
    }
    for (let k = 0; k < depths.length; k++) {
      if (depths[k] <= 0) continue;
      const x = ox + ((k % TEXELS) + 0.5) * CELL;
      const z = oz + (Math.floor(k / TEXELS) + 0.5) * CELL;
      data[k] = THREE.DataUtils.toHalfFloat(depths[k] * (1 - level.packedAt(x, z)));
    }
    tex.needsUpdate = true;

    // THE WOOD in the wells near the lens.
    let ns = 0;
    const trees = level.trees;
    const byPlace = new Map<number, number>();
    for (let i = 0; i < trees.length; i++) byPlace.set(trees[i].x * 4099 + trees[i].z, i);
    for (const w of touching) {
      if (ns >= room) break;
      if (Math.hypot(w.x - cx, w.z - cz) > NEAR) continue;
      const floor = depthAt(level, touching, w.x + w.trunk, w.z);
      if (floor < SHOWN) continue;
      const t = trees[byPlace.get(w.x * 4099 + w.z) ?? -1];
      if (!t) continue;
      const bark = kindPaint(paint, t.kind ?? "spruce").bark;
      // The drawn trunk's foot and its axis, as `forest.ts` stands it: sunk
      // a little and LEANT off plumb (`tree-tilt.ts`).
      level.normalAt(t.x, t.z, ground);
      const tilt = treeTilt(
        t.x,
        t.z,
        leadVariant(t.kind ?? "spruce").shape.form,
        ground.x,
        ground.z,
      );
      axis.set(tilt.dz, 0, -tilt.dx);
      q.setFromAxisAngle(axis, tilt.angle).multiply(turn.setFromAxisAngle(UP, trunkYaw(t.x, t.z)));
      const foot = t.y - 0.3 - t.radius * FLARE * Math.sin(tilt.angle);
      const r = t.radius * FLARE;
      // The stub: from the foot down past the well's floor.
      const length = foot - (t.y - floor) + 0.2;
      m.compose(p.set(t.x, foot, t.z), q, s.set(r, length, r));
      stubs.setMatrixAt(ns, m);
      stubs.setColorAt(ns, colour.copy(bark).multiplyScalar(0.75));
      ns++;
    }
    stubs.count = ns;
    stubs.instanceMatrix.needsUpdate = true;
    if (stubs.instanceColor) stubs.instanceColor.needsUpdate = true;
  };

  return {
    uniforms,
    group,
    follow(x, z) {
      if (!field) return;
      const mx = frame.x + SPAN / 2;
      const mz = frame.y + SPAN / 2;
      if (filled && Math.abs(x - mx) < RECENTRE && Math.abs(z - mz) < RECENTRE) return;
      filled = true;
      fill(x, z);
    },
    dispose() {
      tex.dispose();
      stubGeo.dispose();
      (stubs.material as THREE.Material).dispose();
    },
  };
}
