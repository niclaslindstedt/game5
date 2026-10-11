// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW FAR A POINT STANDS OFF THE NEAREST PISTE'S EDGE — every run and lane
// of a map and the course raced, asked at once (`pisteGap`). A lift's
// tower keeps off the snow by it (`lift-line.ts`), and so does a person on
// foot (`civilian-spots.ts`), which asks it of thousands of spots as a
// free ride loads: each line carries a box, and a line whose box lies
// beyond the search is never asked at all.

import { nearestWithin } from "../mapgen/query.ts";
import type { Level, TrackHit, TrackPoint } from "../mapgen/types.ts";

/** A piste line and the box round its centreline points, m. */
type PisteLine = {
  readonly points: readonly TrackPoint[];
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
};

const lines = new WeakMap<Level, readonly PisteLine[]>();
/** Every piste of a map a tower keeps off: its runs and lanes, and the
 * course raced (a venue's own line, when one is set over the map). */
function pisteLines(level: Level): readonly PisteLine[] {
  let out = lines.get(level);
  if (!out) {
    out = [...(level.resort?.runs ?? []).map((r) => r.points), level.track.points]
      .filter((p) => p.length > 1)
      .map((points) => {
        let x0 = Infinity;
        let x1 = -Infinity;
        let z0 = Infinity;
        let z1 = -Infinity;
        for (const q of points) {
          x0 = Math.min(x0, q.x);
          x1 = Math.max(x1, q.x);
          z0 = Math.min(z0, q.z);
          z1 = Math.max(z1, q.z);
        }
        return { points, x0, x1, z0, z1 };
      });
    lines.set(level, out);
  }
  return out;
}

const hit: TrackHit = { index: 0, s: 0, distance: Infinity, lateral: 0, x: 0, z: 0 };
/** How far (x, z) stands outside the nearest piste's edge, m — negative
 * on its snow — looking `within` m of its edge (Infinity past that). */
export function pisteGap(level: Level, x: number, z: number, within = 40): number {
  let gap = Infinity;
  const reach = within + 40;
  for (const line of pisteLines(level)) {
    // A line whose box lies further off than the search reaches has no
    // segment inside it either (a segment is no nearer than the box), so
    // `nearestWithin` would find nothing: skipped before its hash is asked.
    if (x < line.x0 - reach || x > line.x1 + reach) continue;
    if (z < line.z0 - reach || z > line.z1 + reach) continue;
    const points = line.points;
    nearestWithin({ track: { points, length: 0 } }, x, z, reach, hit);
    if (hit.distance === Infinity) continue;
    const a = points[hit.index];
    const b = points[Math.min(points.length - 1, hit.index + 1)];
    const span = b.s - a.s;
    const t = span > 0 ? Math.min(1, Math.max(0, (hit.s - a.s) / span)) : 0;
    gap = Math.min(gap, hit.distance - (a.width + (b.width - a.width) * t) / 2);
  }
  return gap;
}
