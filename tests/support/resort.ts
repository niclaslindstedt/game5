// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RUNS OF A SKI AREA, ASKED "WHICH COVER THIS SPOT?" — for the suites
// that hold a resort's course (R28) to R1–R24 and the area round it to
// R25–R30, where what lies beside a course is often another run's snow:
// a run that merges into it, a lane that leaves it, a shoulder of the hub.
//
// A bucket grid of every run's segments, built once per published runs
// array and read-only after; a spot is COVERED by a run when the run's
// centreline, where it passes nearest, stands within its half-width there
// and `pad` of it — the question `NetIndex.covers` answers inside the
// engine, asked here of the published runs alone.
import type { Level, Run } from "@engine";

/** The bucket's side, m. */
const CELL = 50;

/** A segment between two stations of one run. */
type Segment = {
  run: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  wa: number;
  wb: number;
};

const grids = new WeakMap<readonly Run[], Map<number, Segment[]>>();

function gridOf(runs: readonly Run[]): Map<number, Segment[]> {
  const hit = grids.get(runs);
  if (hit) return hit;
  const grid = new Map<number, Segment[]>();
  runs.forEach((run, i) => {
    for (let k = 0; k + 1 < run.points.length; k++) {
      const a = run.points[k];
      const b = run.points[k + 1];
      const seg = { run: i, ax: a.x, az: a.z, bx: b.x, bz: b.z, wa: a.width, wb: b.width };
      const key = Math.floor(a.x / CELL) * 4096 + Math.floor(a.z / CELL);
      let list = grid.get(key);
      if (!list) grid.set(key, (list = []));
      list.push(seg);
    }
  });
  grids.set(runs, grid);
  return grid;
}

/** The indices (into `level.resort.runs`) of every run whose surface comes
 * within `pad` metres of (x, z) — read where the run's centreline passes
 * NEAREST it, as wide as the run is there, which is how the engine reads a
 * run's surface (`NetIndex.covers`). Empty off a resort. */
export function runsCovering(level: Level, x: number, z: number, pad: number): Set<number> {
  const out = new Set<number>();
  const runs = level.resort?.runs;
  if (!runs) return out;
  const grid = gridOf(runs);
  const bx = Math.floor(x / CELL);
  const bz = Math.floor(z / CELL);
  const reach = Math.ceil((pad + 50) / CELL) + 1;
  // Per run, its nearest segment and the half-width there.
  const nearest = new Map<number, { d: number; half: number }>();
  for (let dx = -reach; dx <= reach; dx++) {
    for (let dz = -reach; dz <= reach; dz++) {
      for (const g of grid.get((bx + dx) * 4096 + bz + dz) ?? []) {
        const ux = g.bx - g.ax;
        const uz = g.bz - g.az;
        const len2 = ux * ux + uz * uz || 1;
        const t = Math.min(1, Math.max(0, ((x - g.ax) * ux + (z - g.az) * uz) / len2));
        const d = Math.hypot(x - (g.ax + ux * t), z - (g.az + uz * t));
        const held = nearest.get(g.run);
        if (!held || d < held.d) nearest.set(g.run, { d, half: (g.wa + (g.wb - g.wa) * t) / 2 });
      }
    }
  }
  for (const [run, n] of nearest) if (n.d < n.half + pad) out.add(run);
  return out;
}

/** The plan distance from (x, z) to the nearest station of a lift's line,
 * m — a straight line from its bottom station to its top (R26). */
export function nearestLift(level: Level, x: number, z: number): number {
  let best = Infinity;
  for (const l of level.resort?.lifts ?? []) {
    const dx = l.top.x - l.bottom.x;
    const dz = l.top.z - l.bottom.z;
    const len2 = dx * dx + dz * dz || 1;
    const u = Math.min(1, Math.max(0, ((x - l.bottom.x) * dx + (z - l.bottom.z) * dz) / len2));
    best = Math.min(best, Math.hypot(x - (l.bottom.x + dx * u), z - (l.bottom.z + dz * u)));
  }
  return best;
}
