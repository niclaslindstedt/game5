// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI AREA'S BUILDINGS AT TWO CUTS — the village's town and base, the
// streets' edges and furniture and the mountain's restaurant and patrol hut
// (`village-build.ts`) cut into BLOCKS on a grid, each block built twice:
// its NEAR cut every triangle the kit lays, its FAR cut without the small
// ones (the frames, balusters, slats, props and the windrows' lumps —
// `FacadeKit.minArea`), the lit panes kept so the windows still glow across
// the valley. A block takes its near cut inside `NEAR` metres of the lens
// and its far one past it; with every block far — the whole of a run down
// the mountain — one mesh of every far cut is drawn instead, a single draw.
//
// One mesh of the whole village, as it was, drew some 60 000 triangles from
// anywhere on the mountain and into the sun's map whenever any of it was in
// the shadow's box; a block now goes to the sun's map, and through three's
// own frustum test, alone.
//
// A building goes whole into the block its origin stands in, so no building
// is ever drawn half at one cut and half at the other; the streets' edges
// and furniture, which run through the village, go by each triangle's
// middle.

import * as THREE from "three";

import { cabinsOf, resortBuildingsOf, type Level } from "@engine";

import { FacadeKit, type FacadeArrays } from "./facade-kit.ts";
import { facadeGeometry, facadeMaterial } from "./facade-mesh.ts";
import { buildResortBuilding } from "./village-build.ts";
import { buildStreetEdges } from "./street-edges-build.ts";
import { buildStreetFurniture } from "./street-furniture-build.ts";
import type { HazeUniforms } from "./haze.ts";

/** A block's side, m. */
export const BLOCK = 96;
/** The far cut's floor, m²: a triangle smaller is left out of it. */
export const FAR_AREA = 0.3;
/** Where a block hands its near cut over to its far, m off its box, and
 * the band either side of it it keeps the cut it has. */
export const NEAR = 120;
const HYSTERESIS = 15;

/** One block: both cuts' arrays and the box round them. */
export type VillageBlock = {
  near: FacadeArrays;
  far: FacadeArrays;
  min: [number, number, number];
  max: [number, number, number];
};

/** A run of the kit's triangles and the point that says which block they
 * go in (null: each triangle by its own middle). */
type Span = { from: number; to: number; at: [number, number] | null };

/** Every building and the streets' edges and furniture built onto one kit,
 * `minArea` its floor, with the spans that say where each went. */
function buildCut(level: Level, minArea: number): { kit: FacadeKit; spans: Span[] } {
  const kit = new FacadeKit();
  kit.minArea = minArea;
  const spans: Span[] = [];
  for (const c of resortBuildingsOf(cabinsOf(level))) {
    const from = kit.triangles;
    buildResortBuilding(kit, level, c);
    spans.push({ from, to: kit.triangles, at: [c.x, c.z] });
  }
  const from = kit.triangles;
  buildStreetEdges(kit, level);
  buildStreetFurniture(kit, level);
  spans.push({ from, to: kit.triangles, at: null });
  return { kit, spans };
}

const emptyArrays = (): FacadeArrays => ({
  pos: [],
  nrm: [],
  col: [],
  uv: [],
  layer: [],
  glow: [],
});

/** Copy triangle `t` of `a` onto `out`. */
function copyTri(a: FacadeArrays, t: number, out: FacadeArrays): void {
  for (let k = t * 3; k < t * 3 + 3; k++) {
    out.pos.push(a.pos[k * 3], a.pos[k * 3 + 1], a.pos[k * 3 + 2]);
    out.nrm.push(a.nrm[k * 3], a.nrm[k * 3 + 1], a.nrm[k * 3 + 2]);
    out.col.push(a.col[k * 3], a.col[k * 3 + 1], a.col[k * 3 + 2]);
    out.uv.push(a.uv[k * 2], a.uv[k * 2 + 1]);
    out.layer.push(a.layer[k]);
    out.glow.push(a.glow[k]);
  }
}

const keyOf = (x: number, z: number) => `${Math.floor(x / BLOCK)},${Math.floor(z / BLOCK)}`;

/** THE BLOCKS of `level`'s buildings, both cuts each, in a fixed order. */
export function villageBlocks(level: Level): VillageBlock[] {
  const blocks = new Map<string, VillageBlock>();
  const blockAt = (key: string) => {
    let b = blocks.get(key);
    if (!b) {
      b = {
        near: emptyArrays(),
        far: emptyArrays(),
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
      };
      blocks.set(key, b);
    }
    return b;
  };
  for (const cut of ["near", "far"] as const) {
    const { kit, spans } = buildCut(level, cut === "near" ? 0 : FAR_AREA);
    const a = kit.out;
    for (const s of spans) {
      for (let t = s.from; t < s.to; t++) {
        const p = t * 9;
        const key = s.at
          ? keyOf(s.at[0], s.at[1])
          : keyOf(
              (a.pos[p] + a.pos[p + 3] + a.pos[p + 6]) / 3,
              (a.pos[p + 2] + a.pos[p + 5] + a.pos[p + 8]) / 3,
            );
        const b = blockAt(key);
        copyTri(a, t, b[cut]);
        if (cut === "near") {
          for (let k = 0; k < 9; k++) {
            const v = a.pos[p + k];
            const axis = k % 3;
            if (v < b.min[axis]) b.min[axis] = v;
            if (v > b.max[axis]) b.max[axis] = v;
          }
        }
      }
    }
  }
  return [...blocks.keys()].sort().map((k) => blocks.get(k)!);
}

/** The arrays of every block's far cut as one. */
function mergedFar(blocks: readonly VillageBlock[]): FacadeArrays {
  const out = emptyArrays();
  for (const b of blocks) {
    for (const k of Object.keys(out) as (keyof FacadeArrays)[]) {
      for (const v of b.far[k]) out[k].push(v);
    }
  }
  return out;
}

/** How far `eye` is from a block's box, m (0 inside it). */
export function blockDistance(b: VillageBlock, eye: { x: number; y: number; z: number }): number {
  const dx = Math.max(b.min[0] - eye.x, 0, eye.x - b.max[0]);
  const dy = Math.max(b.min[1] - eye.y, 0, eye.y - b.max[1]);
  const dz = Math.max(b.min[2] - eye.z, 0, eye.z - b.max[2]);
  return Math.hypot(dx, dy, dz);
}

/** Which cut a block takes at distance `d`, having had `was` (0 near, 1
 * far, −1 none yet). */
export function cutAt(d: number, was: number): 0 | 1 {
  if (was === 0) return d > NEAR + HYSTERESIS ? 1 : 0;
  if (was === 1) return d < NEAR - HYSTERESIS ? 0 : 1;
  return d < NEAR ? 0 : 1;
}

export type VillageBuildings = {
  group: THREE.Group;
  /** Each block at the cut `eye` sees it at. */
  update(eye: THREE.Vector3): void;
  dispose(): void;
};

/** The ski area's buildings, at their cuts, in one group. */
export function createVillageBuildings(level: Level, haze: HazeUniforms): VillageBuildings {
  const group = new THREE.Group();
  group.name = "village";
  const material = facadeMaterial(haze, "village");
  const geos: THREE.BufferGeometry[] = [];
  const meshOf = (a: FacadeArrays, name: string) => {
    const geo = facadeGeometry(a);
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  };
  const blocks = villageBlocks(level);
  const cuts = blocks.map((b) => [meshOf(b.near, "village-near"), meshOf(b.far, "village-far")]);
  const whole = meshOf(mergedFar(blocks), "village-whole");
  // Until the first update, the whole village at its far cut.
  whole.visible = blocks.length > 0;
  const band = new Int8Array(blocks.length).fill(-1);
  return {
    group,
    update(eye) {
      let near = false;
      blocks.forEach((b, i) => {
        band[i] = cutAt(blockDistance(b, eye), band[i]);
        if (band[i] === 0) near = true;
      });
      whole.visible = !near && blocks.length > 0;
      cuts.forEach(([n, f], i) => {
        n.visible = near && band[i] === 0;
        f.visible = near && band[i] === 1;
      });
    },
    dispose() {
      for (const g of geos) g.dispose();
      material.dispose();
    },
  };
}
