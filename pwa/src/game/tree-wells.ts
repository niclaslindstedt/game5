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
// trunk down to its floor (a stub in the kind's own bark, flared at the
// root) and the dead lower branches a conifer carries there — bare, grey,
// drooping twigs under the green boughs, the thing that hides a real well
// and catches a skier who falls into one.

import * as THREE from "three";
import { regionOf, wellDepthOf, type Level, type TreeWell } from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { regionLookOf } from "./region-look.ts";
import { FLARE } from "./tree-mesh.ts";
import { kindPaint, treePaint } from "./tree-shapes.ts";
import { treeTilt } from "./tree-tilt.ts";
import { leadVariant } from "./tree-variants.ts";

/** The well map's texel, m, and its width in texels: `SPAN` m round the
 * lens. */
const CELL = 0.5;
const TEXELS = 320;
const SPAN = CELL * TEXELS;
/** How far the lens moves off the map's middle before it is refilled, m. */
const RECENTRE = 16;
/** The wells whose trunks and twigs are drawn: within `NEAR` m of the
 * lens and at least `SHOWN` m deep at the trunk. */
const NEAR = 70;
const SHOWN = 0.2;
/** Dead twigs a well's trunk carries, at the most, in `WHORLS` whorls. */
const TWIGS = 22;
const WHORLS = 3;
const RUST = new THREE.Color(0x8a5232);
const GREY = new THREE.Color(0x8a8378);

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
  /** The trunks and twigs in the wells near the lens. */
  group: THREE.Group;
  /** Keep the map round the lens at (`x`, `z`). */
  follow(x: number, z: number): void;
  dispose(): void;
};

function hash(x: number, z: number, k: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

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

  // The wood: a flared stub to the floor, and the bare dead twigs.
  const paint = treePaint(regionLookOf(regionOf(level).id));
  // The stub hangs DOWN from the drawn trunk's foot along its axis, the
  // root flare widening on below it.
  const stubGeo = new THREE.CylinderGeometry(1, 1.18, 1, 7, 1, true);
  stubGeo.translate(0, -0.5, 0);
  const twigGeo = new THREE.CylinderGeometry(0.006, 0.06, 1, 4, 1);
  twigGeo.translate(0, 0.5, 0);
  const wood = (name: string): THREE.MeshStandardMaterial =>
    hazeMaterial(
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }),
      haze,
      name,
    );
  const room = field ? Math.min(field.list.length, 600) : 0;
  const stubs = new THREE.InstancedMesh(stubGeo, wood("well-stub"), Math.max(1, room));
  const twigs = new THREE.InstancedMesh(twigGeo, wood("well-twig"), Math.max(1, room * TWIGS));
  for (const im of [stubs, twigs]) {
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(im.count * 3), 3);
    im.count = 0;
    im.frustumCulled = false;
    group.add(im);
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const e = new THREE.Euler();
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
    let nt = 0;
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
      q.setFromAxisAngle(axis, tilt.angle);
      const foot = t.y - 0.3 - t.radius * FLARE * Math.sin(tilt.angle);
      const shift = Math.tan(tilt.angle);
      const r = t.radius * FLARE;
      // The stub: from the foot down past the well's floor.
      const length = foot - (t.y - floor) + 0.2;
      m.compose(p.set(t.x, foot, t.z), q, s.set(r, length, r));
      stubs.setMatrixAt(ns, m);
      stubs.setColorAt(ns, colour.copy(bark).multiplyScalar(0.75));
      ns++;
      // THE DEAD TWIGS, a conifer's alone: bare, drooping, round the trunk
      // between the floor and the snow's surface.
      if (w.reach <= t.radius + 0.8) continue;
      const bottom = t.y - floor;
      const top = t.y - 0.1;
      // A spruce's boughs grow in WHORLS round the stem: a few at one
      // height, the next whorl a hand or two above.
      const count = Math.round(TWIGS * (0.6 + 0.4 * hash(t.x, t.z, 1)));
      const each = Math.ceil(count / WHORLS);
      for (let j = 0; j < count && nt < room * TWIGS; j++) {
        const h = hash(t.x, t.z, j + 2);
        const whorl = Math.floor(j / each);
        const yaw = ((j % each) / each) * Math.PI * 2 + whorl * 0.9 + h * 0.8;
        const y = bottom + 0.3 + ((top - bottom - 0.3) * (whorl + 0.5 * h)) / WHORLS;
        const len = (w.reach - t.radius) * (0.35 + 0.45 * hash(t.x, t.z, j + 23));
        // On the leant axis at that height.
        const ax = t.x + tilt.dx * shift * (y - foot);
        const az = t.z + tilt.dz * shift * (y - foot);
        // Out from the trunk and drooping: tipped from up toward the side.
        e.set(Math.PI / 2 + 0.25 + 0.35 * h, yaw, 0, "YXZ");
        q.setFromEuler(e);
        m.compose(
          p.set(ax + Math.sin(yaw) * t.radius * 0.8, y, az + Math.cos(yaw) * t.radius * 0.8),
          q,
          s.set(1, len, 1),
        );
        twigs.setMatrixAt(nt, m);
        // ...a dead bough's needles gone rust-brown, or long since dropped
        // and the wood weathered grey.
        twigs.setColorAt(
          nt,
          colour.copy(bark).lerp(hash(t.x, t.z, j + 31) < 0.6 ? RUST : GREY, 0.6),
        );
        nt++;
      }
    }
    stubs.count = ns;
    twigs.count = nt;
    for (const im of [stubs, twigs]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
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
      twigGeo.dispose();
      (stubs.material as THREE.Material).dispose();
      (twigs.material as THREE.Material).dispose();
    },
  };
}
