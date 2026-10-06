// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HASH OF WHAT STANDS UP OUT OF THE SNOW — a trunk, a lift tower's
// column, a floodlight mast: each a vertical cylinder from the snow at its
// foot, hashed once per list on a grid of `trees.cell`, so a step reads the
// handful near a skier rather than the forest. `collision.ts` pushes a
// skier out of them; anything else that asks "is something standing here"
// asks this.

import { cellKey, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Level } from "../mapgen/types.ts";
import { TUNING } from "./defs/tuning.ts";

const CELL = TUNING.trees.cell;

/** A thing standing up out of the snow: its foot (x, z) and the snow's
 * height there, its height over that and its radius in plan, m. A
 * `TreeDef` is one. */
export type Upright = { x: number; z: number; y: number; height: number; radius: number };

type Grid = { cells: Map<number, number[]>; maxRadius: number };

const grids = new WeakMap<readonly Upright[], Grid>();

function gridOf(list: readonly Upright[]): Grid {
  let grid = grids.get(list);
  if (grid) return grid;
  const cells = new Map<number, number[]>();
  let maxRadius = 0;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const key = cellKey(Math.floor(t.x / CELL), Math.floor(t.z / CELL));
    const at = cells.get(key);
    if (at) at.push(i);
    else cells.set(key, [i]);
    if (t.radius > maxRadius) maxRadius = t.radius;
  }
  grid = { cells, maxRadius };
  grids.set(list, grid);
  return grid;
}

/** Every one of `list` that comes within `r` m of (x, z) in plan, by index
 * into `list`, into `out` (cleared first). */
export function uprightsNear(
  list: readonly Upright[],
  x: number,
  z: number,
  r: number,
  out: number[],
): number[] {
  out.length = 0;
  if (list.length === 0) return out;
  const grid = gridOf(list);
  const reach = r + grid.maxRadius;
  const c0 = Math.floor((x - reach) / CELL);
  const c1 = Math.floor((x + reach) / CELL);
  const r0 = Math.floor((z - reach) / CELL);
  const r1 = Math.floor((z + reach) / CELL);
  for (let c = c0; c <= c1; c++) {
    for (let rr = r0; rr <= r1; rr++) {
      const at = grid.cells.get(cellKey(c, rr));
      if (!at) continue;
      for (const i of at) {
        const t = list[i];
        const d = hypot(t.x - x, t.z - z) - t.radius;
        if (d <= r) out.push(i);
      }
    }
  }
  return out;
}

/** Every tree whose trunk comes within `r` m of (x, z) in plan, by index
 * into `level.trees`, into `out` (cleared first). */
export function treesNear(level: Level, x: number, z: number, r: number, out: number[]): number[] {
  return uprightsNear(level.trees, x, z, r, out);
}
