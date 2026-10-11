// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE AS THE MAP KNOWS IT — the street plan (`village-streets.ts`)
// and what its streets carry (`village-furniture.ts`), read back once the
// map's buildings are stood (`cabinsOf`), and the questions the rest of
// the engine and the drawing ask of it:
//
//   * `villageOf` — the streets, their junctions, the square and the car
//     park, and the lanes, sidewalks, bays, crossings, bus stop, lamps and
//     snow poles: what traffic drives, walkers walk and the drawing lays;
//   * `streetMaskAt` — what the ground at a point is (a carriageway, the
//     rest of a street to the back of its sidewalks or an open place, the
//     margin the trees are felled over, the gardens they are thinned in);
//   * `felledTrees` — which of the map's trees are gone for the village
//     (on its streets, its open places and its lots, most in the gardens
//     between) or for a building of the ski area's site: not drawn, not on
//     the chart and not solid;
//   * `villageSolids` — the street lamps' columns and the bus shelter's
//     posts, which a skier meets as he meets a mast.
//
// Pure functions of the map, kept per map; nothing here draws on any
// stream, so no digest moves.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { CABINS } from "./defs/cabins.ts";
import { VILLAGE_LOTS as L, STREET_FURNITURE as F, sideReach } from "./defs/village-streets.ts";
import { cabinsOf, type Cabin } from "./cabins.ts";
import { pick } from "./cabin-site.ts";
import { REAL_RUN } from "./real-houses.ts";
import { fellsTree, isResortBuilding } from "./resort-buildings.ts";
import type { Level } from "../mapgen/types.ts";
import type { Upright } from "./upright-grid.ts";
import { furnishStreets, type StreetFurniture } from "./village-furniture.ts";
import { rememberedStreets, type VillageStreets } from "./village-streets.ts";

/** A ski area's village: its streets and what they carry. */
export type Village = VillageStreets & StreetFurniture;

/** What the ground is at a point of the village (`streetMaskAt`). */
export const MASK = {
  /** Nothing of the village's. */
  none: 0,
  /** The gardens round it, where the trees are thinned. */
  garden: 1,
  /** The margin past a street, an open place or a lot the trees are
   * felled over. */
  felled: 2,
  /** A street to the back of its sidewalks, the square, the car park. */
  street: 3,
  /** A carriageway (its lanes and its parking strips) or a junction. */
  road: 4,
} as const;

const villages = new WeakMap<Level, Village | null>();

/** THE VILLAGE of `level` with its streets, or null where it has none. */
export function villageOf(level: Level): Village | null {
  const had = villages.get(level);
  if (had !== undefined) return had;
  cabinsOf(level);
  const plan = rememberedStreets(level) ?? null;
  const out = plan ? { ...plan, ...furnishStreets(level, plan) } : null;
  villages.set(level, out);
  return out;
}

/** The village's buildings on its streets (every one of the ski area's
 * buildings standing on a street of it). */
export function villageBuildingsOf(level: Level): Cabin[] {
  const v = villageOf(level);
  if (!v) return [];
  const ids = new Set(v.streets.map((s) => s.id));
  return cabinsOf(level).filter((c) => isResortBuilding(c.kind) && ids.has(c.run));
}

type Mask = { x0: number; z0: number; cols: number; rows: number; data: Uint8Array };
const CELL = 1;
const masks = new WeakMap<Level, Mask | null>();

function maskOf(level: Level): Mask | null {
  const had = masks.get(level);
  if (had !== undefined) return had;
  const v = villageOf(level);
  if (!v) {
    masks.set(level, null);
    return null;
  }
  const houses = villageBuildingsOf(level);
  const grow = L.thin + L.fell + 10;
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  const take = (x: number, z: number) => {
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    z1 = Math.max(z1, z);
  };
  for (const st of v.streets) for (const p of st.points) take(p.x, p.z);
  for (const c of houses) take(c.x, c.z);
  x0 = Math.floor(x0 - grow - 30);
  z0 = Math.floor(z0 - grow - 30);
  const cols = Math.ceil(x1 + grow + 30 - x0);
  const rows = Math.ceil(z1 + grow + 30 - z0);
  const data = new Uint8Array(cols * rows);
  const mask: Mask = { x0, z0, cols, rows, data };
  const mark = (i: number, j: number, value: number) => {
    if (i < 0 || j < 0 || i >= cols || j >= rows) return;
    const k = j * cols + i;
    if (data[k] < value) data[k] = value;
  };
  // THE STREETS: each piece of each, its carriageway, its sides, the
  // margins past them.
  for (const st of v.streets) {
    const S = st.section;
    const reach = [sideReach(S, 0), sideReach(S, 1)];
    const road = [S.lane + S.sides[0].park, S.lane + S.sides[1].park];
    const out = Math.max(reach[0], reach[1]) + L.fell + L.thin;
    for (let n = 1; n < st.points.length; n++) {
      const a = st.points[n - 1];
      const b = st.points[n];
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const len2 = Math.max(1e-9, ex * ex + ez * ez);
      const len = Math.sqrt(len2);
      const i0 = Math.floor(Math.min(a.x, b.x) - out - x0);
      const i1 = Math.ceil(Math.max(a.x, b.x) + out - x0);
      const j0 = Math.floor(Math.min(a.z, b.z) - out - z0);
      const j1 = Math.ceil(Math.max(a.z, b.z) + out - z0);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const px = x0 + (i + 0.5) * CELL;
          const pz = z0 + (j + 0.5) * CELL;
          const t = Math.max(0, Math.min(1, ((px - a.x) * ex + (pz - a.z) * ez) / len2));
          const dx = px - (a.x + ex * t);
          const dz = pz - (a.z + ez * t);
          const d = hypot(dx, dz);
          // Right of the way is (ez, −ex)/len: side 1.
          const side = (dx * ez - dz * ex) / len > 0 ? 1 : 0;
          if (d <= road[side]) mark(i, j, MASK.road);
          else if (d <= reach[side]) mark(i, j, MASK.street);
          else if (d <= reach[side] + L.fell) mark(i, j, MASK.felled);
          else if (d <= reach[side] + L.fell + L.thin) mark(i, j, MASK.garden);
        }
      }
    }
  }
  // THE JUNCTIONS: the carriageways' meeting, all road.
  for (const j of v.junctions) {
    if (j.exit) continue;
    let r = 0;
    for (const id of j.streets) {
      const st = v.streets.find((s) => s.id === id);
      if (st)
        r = Math.max(
          r,
          st.section.lane + Math.max(st.section.sides[0].park, st.section.sides[1].park),
        );
    }
    disc(mask, j.x, j.z, r, MASK.road, mark);
  }
  // THE OPEN PLACES and THE LOTS.
  for (const a of v.areas) {
    rect(mask, a.x, a.z, a.heading, a.half, a.depth, a.depth, 0, mark, MASK.street);
  }
  for (const c of houses) {
    const d = CABINS[c.kind];
    const hw = d.width / 2 + d.reach.side;
    rect(
      mask,
      c.x,
      c.z,
      c.heading,
      hw,
      d.depth / 2 + d.reach.back,
      d.depth / 2 + d.reach.front,
      L.fell,
      mark,
      MASK.felled,
    );
  }
  masks.set(level, mask);
  return mask;
}

type Mark = (i: number, j: number, value: number) => void;

function disc(m: Mask, x: number, z: number, r: number, value: number, mark: Mark): void {
  for (let j = Math.floor(z - r - m.z0); j <= Math.ceil(z + r - m.z0); j++) {
    for (let i = Math.floor(x - r - m.x0); i <= Math.ceil(x + r - m.x0); i++) {
      const px = m.x0 + i + 0.5;
      const pz = m.z0 + j + 0.5;
      if (hypot(px - x, pz - z) <= r) mark(i, j, value);
    }
  }
}

/** A rectangle in a frame (`hw` either side across, `back` behind and
 * `front` ahead of its middle along `heading`), grown by `pad` (marked
 * `value`, the inside one level up from it) and by the gardens' reach. */
function rect(
  m: Mask,
  x: number,
  z: number,
  heading: number,
  hw: number,
  back: number,
  front: number,
  pad: number,
  mark: Mark,
  value: number,
): void {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const out = hypot(hw, Math.max(back, front)) + pad + L.thin + 2;
  for (let j = Math.floor(z - out - m.z0); j <= Math.ceil(z + out - m.z0); j++) {
    for (let i = Math.floor(x - out - m.x0); i <= Math.ceil(x + out - m.x0); i++) {
      const dx = m.x0 + i + 0.5 - x;
      const dz = m.z0 + j + 0.5 - z;
      const lx = dx * fz - dz * fx;
      const lz = dx * fx + dz * fz;
      const ox = Math.max(0, Math.abs(lx) - hw);
      const oz = Math.max(0, lz - front, -back - lz);
      const d = hypot(ox, oz);
      if (d <= 0 && pad === 0) mark(i, j, value);
      else if (d <= pad) mark(i, j, pad === 0 ? value : MASK.felled);
      else if (d <= pad + L.thin) mark(i, j, MASK.garden);
    }
  }
}

/** WHAT THE GROUND IS at (x, z) of `level`'s village (`MASK`). */
export function streetMaskAt(level: Level, x: number, z: number): number {
  const m = maskOf(level);
  if (!m) return MASK.none;
  const i = Math.floor((x - m.x0) / CELL);
  const j = Math.floor((z - m.z0) / CELL);
  if (i < 0 || j < 0 || i >= m.cols || j >= m.rows) return MASK.none;
  return m.data[j * m.cols + i];
}

/** The box the village's ground lies in (its mask's), or null where the
 * map has no village. */
export function villageBox(
  level: Level,
): { x0: number; z0: number; x1: number; z1: number } | null {
  const m = maskOf(level);
  return m ? { x0: m.x0, z0: m.z0, x1: m.x0 + m.cols * CELL, z1: m.z0 + m.rows * CELL } : null;
}

/** Whether (x, z) is on a street of the village (to the back of its
 * sidewalks), its square or its car park. */
export function onStreet(level: Level, x: number, z: number): boolean {
  return streetMaskAt(level, x, z) >= MASK.street;
}

/** Whether (x, z) is on a carriageway of the village (where cars drive or
 * park) or a junction. */
export function onCarriageway(level: Level, x: number, z: number): boolean {
  return streetMaskAt(level, x, z) >= MASK.road;
}

const felled = new WeakMap<Level, Uint8Array>();

/** THE TREES GONE from `level`: 1 for each of `level.trees` felled for the
 * village (on a street, an open place or a lot, or past them in the
 * margin) or thinned out of its gardens (all but `VILLAGE_LOTS.keep`), or
 * standing inside the walls of one of the ski area's buildings
 * (`fellsTree`). */
export function felledTrees(level: Level): Uint8Array {
  let out = felled.get(level);
  if (out) return out;
  out = new Uint8Array(level.trees.length);
  // The village's own lots are the mask's; the rest of the ski area's
  // buildings, and a real face's houses wherever they stand (a real house
  // on a village lot is the real one's size, not the lot's), fell what
  // stands inside their walls.
  const own = new Set(villageBuildingsOf(level));
  const all = cabinsOf(level).filter(
    (c) => (isResortBuilding(c.kind) && !own.has(c)) || c.run === REAL_RUN,
  );
  const real = all.filter((c) => c.run === REAL_RUN);
  const seed = level.seed >>> 0;
  const m = maskOf(level);
  for (let i = 0; i < level.trees.length; i++) {
    const t = level.trees[i];
    const at = m ? streetMaskAt(level, t.x, t.z) : MASK.none;
    if (at >= MASK.felled) out[i] = 1;
    else if (at === MASK.garden) {
      const kept = pick(seed, "garden", Math.round(t.x * 7 + t.z * 13), 3) < L.keep;
      out[i] = kept && !fellsTree(real, t.x, t.z) ? 0 : 1;
    } else if (fellsTree(all, t.x, t.z)) out[i] = 1;
  }
  felled.set(level, out);
  return out;
}

const solids = new WeakMap<Level, Upright[]>();

/** THE VILLAGE'S SOLIDS: each street lamp's column (steel), and the bus
 * shelter's four posts. */
export function villageSolids(level: Level): readonly Upright[] {
  let list = solids.get(level);
  if (list) return list;
  list = [];
  const v = villageOf(level);
  if (v) {
    for (const l of v.lamps) {
      list.push({ x: l.x, z: l.z, y: l.y, height: l.height, radius: 0.09, stuff: "steel" });
    }
    const b = v.bus;
    if (b) {
      const fx = Math.sin(b.heading);
      const fz = Math.cos(b.heading);
      for (const [lx, lz] of [
        [-F.bus.along / 2, -F.bus.deep / 2],
        [F.bus.along / 2, -F.bus.deep / 2],
        [-F.bus.along / 2, F.bus.deep / 2],
        [F.bus.along / 2, F.bus.deep / 2],
      ]) {
        const x = b.x + lx * fz + lz * fx;
        const z = b.z - lx * fx + lz * fz;
        list.push({ x, z, y: level.groundAt(x, z), height: 2.5, radius: 0.06, stuff: "steel" });
      }
    }
  }
  solids.set(level, list);
  return list;
}
