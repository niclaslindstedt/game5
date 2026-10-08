// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POSTS — the steel a ski area stands in its snow, as solid to a skier
// as a trunk: every lift's towers and the posts under its two bullwheels
// (`lift-line.ts`'s plan, the columns `lifts.ts` draws), and every
// floodlight mast down its runs (`piste-masts.ts`, the poles
// `piste-lights.ts` draws), and in a thin season every snow gun beside them
// (`snow-guns.ts`: a carriage's bulk, a column's or a lance's pole). Each is an `Upright` — a vertical cylinder
// from the snow at its foot to its head — met by `collision.ts` exactly as
// a trunk is, so a column met square stops a skier and one clipped turns
// him. Kept per map, off the map alone, drawing from no stream.

import type { Level } from "../mapgen/types.ts";
import { cabinWalls } from "./cabins.ts";
import { TOWER_PAD, liftPlans } from "./lift-line.ts";
import { PISTE_MAST, pisteMasts } from "./piste-masts.ts";
import { wallSolids } from "./cliff-wall.ts";
import { gunSolid, standingGuns } from "./snow-guns.ts";
import { uprightsNear, type Upright } from "./upright-grid.ts";
import { felledTrees, villageSolids } from "./village.ts";

const lists = new WeakMap<Level, Upright[]>();

/** Every post of `level`: the lifts' columns (their half-width at the foot
 * — a square tube, met on its flats; a padded one met on its pad's), then
 * the masts' poles, then the snow guns standing. */
export function postsOf(level: Level): readonly Upright[] {
  let list = lists.get(level);
  if (list) return list;
  list = [];
  for (const plan of liftPlans(level)) {
    for (const s of plan.supports) {
      const radius = s.pad ? padRadius(plan.look.column) : plan.look.column;
      list.push({
        x: s.x,
        z: s.z,
        y: s.ground,
        height: s.rope,
        radius,
        stuff: s.pad ? "padded" : "steel",
      });
    }
  }
  for (const m of pisteMasts(level)) {
    list.push({
      x: m.x,
      z: m.z,
      y: m.y,
      height: m.height,
      radius: PISTE_MAST.pole.foot,
      stuff: "steel",
    });
  }
  for (const g of standingGuns(level)) {
    const { radius, height } = gunSolid(g);
    list.push({ x: g.x, z: g.z, y: g.y, height, radius, stuff: "steel" });
  }
  lists.set(level, list);
  return list;
}

/** A pad's octagon round a column, met on its flats, m. */
function padRadius(column: number): number {
  return (column * Math.SQRT2 + TOWER_PAD.thick) * Math.cos(Math.PI / 8);
}

const solids = new WeakMap<Level, Upright[]>();

/** EVERYTHING SOLID standing in `level`'s snow: its trunks, in
 * `level.trees`' order — so a trunk's index is its index there — then its
 * posts, then its cabins' walls (`cabins.ts`), then the rock walls of
 * its cliffs (`cliff-wall.ts`). What a skier, his body thrown, his skis let go
 * and the snowmobile are pushed out of. */
export function solidsOf(level: Level): readonly Upright[] {
  let list = solids.get(level);
  if (list) return list;
  const posts = postsOf(level);
  const cabins = cabinWalls(level);
  const rocks = wallSolids(level);
  const village = villageSolids(level);
  // A tree felled for the village or a building stands nowhere: kept in
  // its place in the list (so every index holds) as a solid no body is
  // ever under.
  const gone = felledTrees(level);
  const trees = gone.includes(1)
    ? level.trees.map((t, i) => (gone[i] ? { ...t, y: -1e5, height: 0, radius: 0 } : t))
    : level.trees;
  list =
    trees === level.trees && posts.length + cabins.length + rocks.length + village.length === 0
      ? level.trees
      : [...trees, ...posts, ...cabins, ...rocks, ...village];
  solids.set(level, list);
  return list;
}

/** Everything solid within `r` m of (x, z) in plan, by index into
 * `solidsOf(level)`, into `out` (cleared first). */
export function solidsNear(level: Level, x: number, z: number, r: number, out: number[]): number[] {
  return uprightsNear(solidsOf(level), x, z, r, out);
}
