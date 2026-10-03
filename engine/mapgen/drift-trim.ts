// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DRIFTS A HUB GROOMS AWAY (v4, R17 and R29): a run's drifts dealt
// before the hub was laid are cut back where the hub's grooming has packed
// the snow since, and the run's whole width is groomed over what was cut, so
// a drift never lies half-groomed across a hub's floor and a run's line
// stays packed under it (R27).

import type { Heightfield } from "@niclaslindstedt/oss-game-framework/core/heightfield";
import type { BuiltRun } from "./resort-build.ts";

/** Cut a run's drifts back to the stretches the hub's grooming has not
 * reached (`before`: the packed field as it lay before the hub was laid),
 * and groom the run's whole width over what was cut (R17, R29). */
export function trimDrifts(b: BuiltRun, packed: Heightfield, before: Float32Array): void {
  const pts = b.walked.points;
  const at = (s: number) => {
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.s - s) < Math.abs(best.s - s)) best = p;
    return best;
  };
  const cellOf = (x: number, z: number): number =>
    Math.round((z - packed.originZ) / packed.cell) * packed.cols +
    Math.round((x - packed.originX) / packed.cell);
  const hubbed = (s: number): boolean => {
    const p = at(s);
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    for (const u of [-0.5, -0.25, 0, 0.25, 0.5]) {
      const i = cellOf(p.x + rx * u * p.width, p.z + rz * u * p.width);
      if (i >= 0 && i < before.length && packed.data[i] > before[i] + 0.02) return true;
    }
    return false;
  };
  const groomOver = (from: number, to: number): void => {
    for (const p of pts) {
      if (p.s < from || p.s > to) continue;
      const r = p.width / 2 + packed.cell;
      for (let dz = -r; dz <= r; dz += packed.cell)
        for (let dx = -r; dx <= r; dx += packed.cell) {
          if (dx * dx + dz * dz > r * r) continue;
          const i = cellOf(p.x + dx, p.z + dz);
          if (i >= 0 && i < packed.data.length) packed.data[i] = Math.max(packed.data[i], 1);
        }
    }
  };
  const kept = [];
  for (const d of b.drifts) {
    let to = d.to;
    while (to > d.from && hubbed(to)) to -= TRIM_STEP;
    let from = d.from;
    while (from < to && hubbed(from)) from += TRIM_STEP;
    if (to < d.to) groomOver(to, d.to + TRIM_STEP);
    if (from > d.from) groomOver(d.from - TRIM_STEP, from);
    if (to - from >= TRIM_LEAST) kept.push({ ...d, from, to });
    else groomOver(d.from - TRIM_STEP, d.to + TRIM_STEP);
  }
  if (
    kept.length === b.drifts.length &&
    kept.every((d, k) => d.to === b.drifts[k].to && d.from === b.drifts[k].from)
  )
    return;
  b.drifts.length = 0;
  b.drifts.push(...kept);
  b.run.drifts = b.drifts;
}

/** The step a drift is cut back by, m, and the shortest kept, m. */
const TRIM_STEP = 4;
const TRIM_LEAST = 20;
