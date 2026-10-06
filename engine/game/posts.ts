// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POSTS — the steel a ski area stands in its snow, as solid to a skier
// as a trunk: every lift's towers and the posts under its two bullwheels
// (`lift-line.ts`'s plan, the columns `lifts.ts` draws), and every
// floodlight mast down its runs (`piste-masts.ts`, the poles
// `piste-lights.ts` draws). Each is an `Upright` — a vertical cylinder
// from the snow at its foot to its head — met by `collision.ts` exactly as
// a trunk is, so a column met square stops a skier and one clipped turns
// him. Kept per map, off the map alone, drawing from no stream.

import type { Level } from "../mapgen/types.ts";
import { liftPlans } from "./lift-line.ts";
import { PISTE_MAST, pisteMasts } from "./piste-masts.ts";
import { uprightsNear, type Upright } from "./upright-grid.ts";

const lists = new WeakMap<Level, Upright[]>();

/** Every post of `level`: the lifts' columns (their half-width at the foot
 * — a square tube, met on its flats), then the masts' poles. */
export function postsOf(level: Level): readonly Upright[] {
  let list = lists.get(level);
  if (list) return list;
  list = [];
  for (const plan of liftPlans(level)) {
    for (const s of plan.supports) {
      list.push({ x: s.x, z: s.z, y: s.ground, height: s.rope, radius: plan.look.column });
    }
  }
  for (const m of pisteMasts(level)) {
    list.push({ x: m.x, z: m.z, y: m.y, height: m.height, radius: PISTE_MAST.pole.foot });
  }
  lists.set(level, list);
  return list;
}

const solids = new WeakMap<Level, Upright[]>();

/** EVERYTHING SOLID standing in `level`'s snow: its trunks, in
 * `level.trees`' order — so a trunk's index is its index there — then its
 * posts. What a skier, his body thrown, his skis let go and the
 * snowmobile are pushed out of. */
export function solidsOf(level: Level): readonly Upright[] {
  let list = solids.get(level);
  if (list) return list;
  const posts = postsOf(level);
  list = posts.length === 0 ? level.trees : [...level.trees, ...posts];
  solids.set(level, list);
  return list;
}

/** Everything solid within `r` m of (x, z) in plan, by index into
 * `solidsOf(level)`, into `out` (cleared first). */
export function solidsNear(level: Level, x: number, z: number, r: number, out: number[]): number[] {
  return uprightsNear(solidsOf(level), x, z, r, out);
}
