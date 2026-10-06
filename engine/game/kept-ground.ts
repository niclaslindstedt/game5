// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROUND THE SKI AREA KEEPS — where the snow is cleared by hand and by
// machine through the day whatever falls: every top station's pad and
// deck, a chair's unload ramp and the way off past its house, the RAMPS off
// a top's rim down onto its runs, a drag's let-go, the load zone and corral
// at every lift's foot — and the TRANSPORT LANES between them, the
// machines' own roads, ploughed open through the day. A fall over a ski
// area is skied into its runs (`piste-day.ts`), but the flat ground round a
// station and along a cat track has no pitch that would carry a rider
// through it — so it is shovelled, milled and ploughed, and stays the
// night's packed snow under only what has come down since the ride began
// (`snow.ts`'s `packedSnow`, `pisteIce`).
//
// A pure function of the map — the lifts it publishes and the rule book's
// measures — baked once per map into a set of cells (`groomed.ts`'s) and
// asked by a lookup. Read only on a run dealt the day's piste, so nothing
// else a map is skied for moves.

import { RESORT_RULES as RR } from "../mapgen/resort-rules.ts";
import type { Level } from "../mapgen/types.ts";
import { GROOM_CELL, groomCellOf } from "./groomed.ts";

/** How far round a lift's foot its load zone, corral and queue are kept,
 * m: past the corral's tail and the boarding ring either side. */
const FOOT = 16;
/** The margin kept past a ramp's own edges, m. */
const RAMP_EDGE = 1;

const baked = new WeakMap<Level, Set<number>>();

/** Mark every cell whose middle lies within `half` m of the segment a→b. */
function keep(
  cells: Set<number>,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  half: number,
): void {
  const C = GROOM_CELL;
  const x0 = Math.floor((Math.min(ax, bx) - half) / C);
  const x1 = Math.floor((Math.max(ax, bx) + half) / C);
  const z0 = Math.floor((Math.min(az, bz) - half) / C);
  const z1 = Math.floor((Math.max(az, bz) + half) / C);
  const ex = bx - ax;
  const ez = bz - az;
  const ee = ex * ex + ez * ez;
  for (let i = x0; i <= x1; i++) {
    for (let j = z0; j <= z1; j++) {
      const px = (i + 0.5) * C;
      const pz = (j + 0.5) * C;
      const h = ee > 1e-9 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / ee)) : 0;
      const dx = px - ax - ex * h;
      const dz = pz - az - ez * h;
      if (dx * dx + dz * dz <= half * half) cells.add(groomCellOf(px, pz));
    }
  }
}

/** THE KEPT CELLS of a map (`groomCellOf`'s keys), baked on first ask:
 * every station's ground and every transport lane's. */
export function keptCells(level: Level): Set<number> {
  const had = baked.get(level);
  if (had) return had;
  const cells = new Set<number>();
  const L = RR.lift;
  for (const l of level.resort?.lifts ?? []) {
    // The foot: the load line, the corral and the queue.
    keep(cells, l.bottom.x, l.bottom.z, l.bottom.x, l.bottom.z, FOOT);
    if (l.kind === "drag") {
      // A drag's let-go, `drag.letGo` m short of its top wheel.
      const len = Math.max(1, Math.hypot(l.top.x - l.bottom.x, l.top.z - l.bottom.z));
      const x = l.top.x - ((l.top.x - l.bottom.x) / len) * L.drag.letGo;
      const z = l.top.z - ((l.top.z - l.bottom.z) / len) * L.drag.letGo;
      keep(cells, x, z, x, z, L.drag.rim);
    } else {
      // A top's pad — the deck, the unload and the way off the house —
      // whichever generator cut it (the widest pad any of them does).
      keep(cells, l.top.x, l.top.z, l.top.x, l.top.z, Math.max(L.top.pad, L.pad) / 2);
    }
    for (const r of l.ramps ?? [])
      keep(cells, r.from.x, r.from.z, r.to.x, r.to.z, r.width / 2 + RAMP_EDGE);
  }
  // The TRANSPORT LANES (R27): the cat tracks between the runs and to the
  // lifts' feet, the machines' own roads, kept open through the day.
  for (const r of level.resort?.runs ?? []) {
    if (r.kind !== "road") continue;
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1];
      const b = r.points[i];
      keep(cells, a.x, a.z, b.x, b.z, b.width / 2);
    }
  }
  baked.set(level, cells);
  return cells;
}

/** Whether the ground under (x, z) is kept clear through the day. */
export function keptAt(level: Level, x: number, z: number): boolean {
  return keptCells(level).has(groomCellOf(x, z));
}
