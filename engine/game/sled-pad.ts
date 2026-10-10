// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE SNOWMOBILE IS PARKED — a free ride's sled waits at the bottom of
// the mountain: a level patch of the hub's open snow (R29) beside the
// village, clear of every trunk, every lift's line and bottom station, both
// wind tunnels' lanes and the helicopter's pad — beside the runs' run-outs,
// where a skier coming down the mountain glides to it. A map with no hub
// parks it beside the finish. Parked facing up the mountain, the way it is
// ridden away.
//
// A pure function of the map, worked out once and kept per map; nothing
// here draws from the stream, so no digest can see it.

import { waterWithin } from "../mapgen/real-water.ts";
import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { treesNear } from "./collision.ts";
import { HELI } from "./defs/heli.ts";
import { SLED } from "./defs/sled.ts";
import { helipadOf } from "./heli-pad.ts";
import { liftPlans } from "./lift-line.ts";
import type { Level } from "../mapgen/types.ts";

/** A spot: the snow under the sled's middle and the heading it is parked
 * facing. */
export type SledSpot = { x: number; y: number; z: number; heading: number };

/** The grid searched, m, and how far out from the village. */
const STEP = 6;
const SEARCH = 360;
/** The gaps kept from a lift's line, its bottom station, a tunnel's lane,
 * and the helicopter's pad (past the rotor's wash), m; and the distance
 * from the village it would rather be at — beside it, not in it. */
const LINE_GAP = 12;
const STATION_GAP = 26;
const TUNNEL_GAP = 10;
const HELI_GAP = 26;
const BESIDE = 50;

const spots = new WeakMap<Level, SledSpot>();
const near: number[] = [];

/** THE SPOT of `level`, worked out once. */
export function sledSpotOf(level: Level): SledSpot {
  let spot = spots.get(level);
  if (!spot) {
    spot = findSpot(level);
    spots.set(level, spot);
  }
  return spot;
}

/** The ground's steepest lean over a circle of radius `r`, rise over run. */
function leanOver(level: Level, x: number, z: number, r: number): number {
  const g = level.groundAt(x, z);
  let most = 0;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    most = Math.max(
      most,
      Math.abs(level.groundAt(x + Math.sin(a) * r, z + Math.cos(a) * r) - g) / r,
    );
  }
  return most;
}

function clearAt(level: Level, x: number, z: number): boolean {
  const room = SLED.pad.radius;
  if (waterWithin(level.water, x, z, room)) return false;
  if (treesNear(level, x, z, room + 2, near).length > 0) return false;
  for (const p of liftPlans(level)) {
    const rx = x - p.lift.bottom.x;
    const rz = z - p.lift.bottom.z;
    if (hypot(rx, rz) < STATION_GAP + room) return false;
    const u = rx * p.dx + rz * p.dz;
    const v = rx * p.dz - rz * p.dx;
    if (u > -room && u < p.length + room && Math.abs(v) < LINE_GAP + room) return false;
  }
  for (const t of level.resort?.tunnels ?? []) {
    for (const q of t.points) {
      if (hypot(q.x - x, q.z - z) < TUNNEL_GAP + room + t.width / 2) return false;
    }
  }
  const pad = helipadOf(level);
  return hypot(pad.x - x, pad.z - z) >= HELI.pad.radius + HELI_GAP + room;
}

function findSpot(level: Level): SledSpot {
  const resort = level.resort;
  const finish = level.track.points[level.track.points.length - 1];
  const centre = resort ? resort.village : { x: finish.x, z: finish.z };
  const half = level.size / 2;
  const edge = SLED.pad.radius + 30;
  let best: { x: number; z: number; cost: number } | null = null;
  for (let dz = -SEARCH; dz <= SEARCH; dz += STEP) {
    for (let dx = -SEARCH; dx <= SEARCH; dx += STEP) {
      const x = centre.x + dx;
      const z = centre.z + dz;
      if (Math.abs(x - half) > half - edge || Math.abs(z - half) > half - edge) continue;
      const d = Math.abs(hypot(dx, dz) - BESIDE);
      if (best && d >= best.cost) continue;
      const lean = leanOver(level, x, z, SLED.pad.radius);
      if (lean > SLED.pad.slope) continue;
      const cost = d + lean * 400;
      if (best && cost >= best.cost) continue;
      if (!clearAt(level, x, z)) continue;
      best = { x, z, cost };
    }
  }
  const at = best ?? { x: centre.x + 12, z: centre.z };
  // Parked facing up the mountain: the fall line is +z, so the nose to −z.
  return { x: at.x, y: level.groundAt(at.x, at.z), z: at.z, heading: Math.PI };
}
