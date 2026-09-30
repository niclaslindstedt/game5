// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R22 — THE CLIFFS, held on the finished map: read off the cliffs the level
// publishes and the ground under them, never off the plan that laid them.

import { cliffFootprint } from "../mapgen/cliffs.ts";
import { nearestTrackPoint } from "../mapgen/query.ts";
import { regionOf, scaleCount } from "../mapgen/regions.ts";
import { LEVEL_RULES as R } from "../mapgen/rules.ts";
import type { Level } from "../mapgen/types.ts";
import type { Severity } from "./index.ts";

type Add = (rule: string, severity: Severity, message: string) => void;

/** R22 — the least share of its own drop a face must still show on the
 * ground: the two-metre grid rounds the top and the foot of a wall a couple
 * of metres high by a cell each. */
const DROP_SHOWN = 0.75;

/** Hold the cliffs to R22: how many, that each is a drop on the ground,
 * and that none comes near the piste. */
export function checkCliffs(level: Level, add: Add): void {
  const C = R.cliff;
  const cliffs = level.cliffs ?? [];
  const clear = R.track.width.max / 2 + C.clearance;
  for (const c of cliffs) {
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    // The face read across its middle: a metre behind the edge to a metre
    // past its foot, the mountain's own fall in it too.
    const top = level.groundAt(c.x - fx, c.z - fz);
    const foot = level.groundAt(c.x + fx * (c.face + 1), c.z + fz * (c.face + 1));
    if (top - foot < c.drop * DROP_SHOWN) {
      add(
        "R22",
        "warn",
        `${c.id} drops only ${(top - foot).toFixed(1)} m of its ${c.drop.toFixed(1)}`,
      );
    }
    let nearest = Infinity;
    for (const p of cliffFootprint(c)) {
      nearest = Math.min(nearest, nearestTrackPoint(level, p.x, p.z).distance);
    }
    if (nearest < clear - 1) {
      add("R22", "error", `${c.id} comes ${nearest.toFixed(0)} m from the piste's centreline`);
    }
  }
  if (cliffs.length < scaleCount(C.count, regionOf(level).kickers).min) {
    add("R22", "warn", `only ${cliffs.length} cliff(s)`);
  }
}
