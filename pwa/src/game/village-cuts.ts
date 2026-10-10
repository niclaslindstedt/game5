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
// The blocks are gathered into DISTRICTS of `DISTRICT` × `DISTRICT` blocks,
// each with one mesh of its blocks' far cuts and one of a DISTANT cut (the
// far cut without the triangles under `DISTANT_AREA`, the lit panes and the
// long thin ones kept): a district with no block near the lens is one draw,
// at its far cut inside `DISTANT` metres and its distant one past it, so a
// real face's few thousand buildings spread over the mountain cost a draw a
// district rather than one a block; with every district distant, one mesh
// of every distant cut is drawn instead.
//
// One mesh of the whole village drew some 60 000 triangles from anywhere on
// the mountain. The blocks are the culling's tiles (`tile-split.ts`), each
// going to the sun's map, and through three's own frustum test, alone —
// built here per building rather than per triangle, so each can carry two
// cuts.
//
// A building goes whole into the block its origin stands in, so no building
// is ever drawn half at one cut and half at the other; the streets' edges
// and furniture, which run through the village, go by each triangle's
// middle. The lift stations' houses are cut the same way
// (`createBlockBuildings`, over `station-build.ts`), a station a building.

import * as THREE from "three";

import { cabinsOf, resortBuildingsOf, type Level } from "@engine";

import { FacadeKit, keepsTriangle, type FacadeArrays } from "./facade-kit.ts";
import { facadeGeometry, facadeMaterial } from "./facade-mesh.ts";
import { buildResortBuilding } from "./village-build.ts";
import { buildStreetEdges } from "./street-edges-build.ts";
import { buildStreetFurniture } from "./street-furniture-build.ts";
import type { HazeUniforms } from "./haze.ts";
import { BUILDING_TILE } from "./tile-split.ts";

/** A block's side, m: the tile the culling cuts the village into. */
export const BLOCK = BUILDING_TILE;
/** The far cut's floor, m²: a triangle smaller is left out of it. */
export const FAR_AREA = 0.3;
/** Where a block hands its near cut over to its far, m off its box, and
 * the band either side of it it keeps the cut it has. */
export const NEAR = 120;
const HYSTERESIS = 15;
/** A district's side, in blocks. */
export const DISTRICT = 4;
/** The distant cut's floor, m²: past `DISTANT` m a triangle smaller than
 * this is left out too (a window's reveal, a frame's bar). */
export const DISTANT_AREA = 1;
/** Where a district hands its far cut over to its distant one, m off its
 * box (with `HYSTERESIS` either side). */
export const DISTANT = 600;

/** One block: both cuts' arrays, the box round them and its district. */
export type VillageBlock = {
  near: FacadeArrays;
  far: FacadeArrays;
  min: [number, number, number];
  max: [number, number, number];
  district: string;
};

/** One district: the far and distant cuts of its blocks as one, and the
 * box round them. */
export type VillageDistrict = {
  far: FacadeArrays;
  distant: FacadeArrays;
  min: [number, number, number];
  max: [number, number, number];
};

/** A run of the kit's triangles and the point that says which block they
 * go in (null: each triangle by its own middle). */
export type Span = { from: number; to: number; at: [number, number] | null };

/** Builds every building onto one kit with `minArea` its floor, with the
 * spans that say where each went. */
export type BuildCut = (minArea: number) => { kit: FacadeKit; spans: Span[] };

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

/** The district a block's key is in. */
function districtOf(key: string): string {
  const [i, j] = key.split(",").map(Number);
  return `${Math.floor(i / DISTRICT)},${Math.floor(j / DISTRICT)}`;
}

/** THE BLOCKS of `level`'s village, both cuts each, in a fixed order. */
export function villageBlocks(level: Level): VillageBlock[] {
  return blocksOf((minArea) => buildCut(level, minArea));
}

/** THE BLOCKS of whatever `build` lays, both cuts each, in a fixed order. */
export function blocksOf(build: BuildCut): VillageBlock[] {
  const blocks = new Map<string, VillageBlock>();
  const blockAt = (key: string) => {
    let b = blocks.get(key);
    if (!b) {
      b = {
        near: emptyArrays(),
        far: emptyArrays(),
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
        district: "",
      };
      blocks.set(key, b);
    }
    return b;
  };
  for (const cut of ["near", "far"] as const) {
    const { kit, spans } = build(cut === "near" ? 0 : FAR_AREA);
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
        b.district = districtOf(key);
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

/** The arrays of `list` as one. */
function merged(list: readonly FacadeArrays[]): FacadeArrays {
  const out = emptyArrays();
  for (const a of list) {
    for (const k of Object.keys(out) as (keyof FacadeArrays)[]) {
      for (const v of a[k]) out[k].push(v);
    }
  }
  return out;
}

/** `a` without the triangles under `minArea` (`keepsTriangle`). */
function thinned(a: FacadeArrays, minArea: number): FacadeArrays {
  const out = emptyArrays();
  for (let t = 0; t < a.pos.length / 9; t++)
    if (keepsTriangle(a.pos, a.glow, t, minArea)) copyTri(a, t, out);
  return out;
}

/** THE DISTRICTS of `blocks` (`VillageBlock.district`), in a fixed order. */
export function districtsOf(blocks: readonly VillageBlock[]): Map<string, VillageDistrict> {
  const keys = [...new Set(blocks.map((b) => b.district))].sort();
  return new Map(
    keys.map((key) => {
      const own = blocks.filter((b) => b.district === key);
      const far = merged(own.map((b) => b.far));
      const min = [0, 1, 2].map((k) => Math.min(...own.map((b) => b.min[k])));
      const max = [0, 1, 2].map((k) => Math.max(...own.map((b) => b.max[k])));
      return [
        key,
        {
          far,
          distant: thinned(far, DISTANT_AREA),
          min: min as [number, number, number],
          max: max as [number, number, number],
        },
      ];
    }),
  );
}

/** How far `eye` is from a block's or a district's box, m (0 inside it). */
export function blockDistance(
  b: { min: readonly number[]; max: readonly number[] },
  eye: { x: number; y: number; z: number },
): number {
  const dx = Math.max(b.min[0] - eye.x, 0, eye.x - b.max[0]);
  const dy = Math.max(b.min[1] - eye.y, 0, eye.y - b.max[1]);
  const dz = Math.max(b.min[2] - eye.z, 0, eye.z - b.max[2]);
  return Math.hypot(dx, dy, dz);
}

/** Which cut a block takes at distance `d`, having had `was` (0 near, 1
 * far, −1 none yet) — a district too, its far and distant cuts handed
 * over at `at` (`DISTANT`). */
export function cutAt(d: number, was: number, at = NEAR): 0 | 1 {
  if (was === 0) return d > at + HYSTERESIS ? 1 : 0;
  if (was === 1) return d < at - HYSTERESIS ? 0 : 1;
  return d < at ? 0 : 1;
}

export type VillageBuildings = {
  group: THREE.Group;
  /** Each block at the cut `eye` sees it at. */
  update(eye: THREE.Vector3): void;
  dispose(): void;
};

/** The ski area's buildings, at their cuts, in one group. */
export function createVillageBuildings(level: Level, haze: HazeUniforms): VillageBuildings {
  return createBlockBuildings(villageBlocks(level), haze, "village");
}

/** `blocks` at their cuts in one group named `name`, in the facade's
 * paint. */
export function createBlockBuildings(
  blocks: readonly VillageBlock[],
  haze: HazeUniforms,
  name: string,
): VillageBuildings {
  const group = new THREE.Group();
  group.name = name;
  const material = facadeMaterial(haze, name);
  const geos: THREE.BufferGeometry[] = [];
  const meshOf = (a: FacadeArrays, cut: string) => {
    const geo = facadeGeometry(a);
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = `${name}-${cut}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  };
  const cuts = blocks.map((b) => [meshOf(b.near, "near"), meshOf(b.far, "far")]);
  const districts = districtsOf(blocks);
  const keys = [...districts.keys()];
  const own = keys.map((k) => blocks.flatMap((b, i) => (b.district === k ? [i] : [])));
  const areas = keys.map((k) => districts.get(k)!);
  const dcuts = areas.map((d) => [meshOf(d.far, "district"), meshOf(d.distant, "distant")]);
  const whole = meshOf(merged(areas.map((d) => d.distant)), "whole");
  // Until the first update, the whole village at its distant cut.
  whole.visible = blocks.length > 0;
  const band = new Int8Array(blocks.length).fill(-1);
  const dband = new Int8Array(keys.length).fill(-1);
  return {
    group,
    update(eye) {
      blocks.forEach((b, i) => {
        band[i] = cutAt(blockDistance(b, eye), band[i]);
      });
      let distant = true;
      areas.forEach((d, k) => {
        dband[k] = cutAt(blockDistance(d, eye), dband[k], DISTANT);
        if (dband[k] === 0) distant = false;
      });
      whole.visible = distant && blocks.length > 0;
      own.forEach((list, k) => {
        // A district with a block near the lens is drawn a block at a time.
        const split = !distant && list.some((i) => band[i] === 0);
        for (const i of list) {
          cuts[i][0].visible = split && band[i] === 0;
          cuts[i][1].visible = split && band[i] === 1;
        }
        dcuts[k][0].visible = !distant && !split && dband[k] === 0;
        dcuts[k][1].visible = !distant && !split && dband[k] === 1;
      });
    },
    dispose() {
      for (const g of geos) g.dispose();
      material.dispose();
    },
  };
}
