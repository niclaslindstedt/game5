// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HELIPAD — where a free ride's helicopter stands on the valley floor:
// a level patch of the hub's open snow (R29), as near the village as one
// lies, with the rotor's sweep and a margin clear of every trunk, every
// lift's line and bottom station and both wind tunnels' lanes — beside the
// runs' run-outs, where a skier coming down the mountain glides to it. A
// map with no hub (one of the single-piste generations) puts it beside the
// finish.
//
// A pure function of the map, worked out once and kept per map; nothing
// here draws from the stream, so no digest can see it.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { treesNear } from "./collision.ts";
import { HELI } from "./defs/heli.ts";
import { liftPlans } from "./lift-line.ts";
import type { Level } from "../mapgen/types.ts";

/** A pad: the skid datum's place on the snow and the heading the
 * helicopter is parked facing (up the mountain, its nose to the face). */
export type Helipad = { x: number; y: number; z: number; heading: number };

/** The grid the floor is searched on, m, and how far out from the village
 * (or the finish), m. */
const STEP = 8;
const SEARCH = 420;
/** The gap kept from a lift's line and from its bottom station, and from a
 * tunnel's lane, m. */
const LINE_GAP = 16;
const STATION_GAP = 34;
const TUNNEL_GAP = 14;

const pads = new WeakMap<Level, Helipad>();
const near: number[] = [];

/** THE PAD of `level`, worked out once. */
export function helipadOf(level: Level): Helipad {
  let pad = pads.get(level);
  if (!pad) {
    pad = findPad(level);
    pads.set(level, pad);
  }
  return pad;
}

/** The ground's steepest lean over the pad's circle, as a slope (rise over
 * run) read off its rim against its middle. */
function leanOver(level: Level, x: number, z: number, r: number): number {
  const g = level.groundAt(x, z);
  let most = 0;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const d = Math.abs(level.groundAt(x + Math.sin(a) * r, z + Math.cos(a) * r) - g) / r;
    most = Math.max(most, d);
  }
  return most;
}

/** Whether (x, z) is clear: no trunk under the sweep, off every lift's line
 * and station, and out of the tunnels' lanes. */
function clearAt(level: Level, x: number, z: number): boolean {
  const room = HELI.pad.radius;
  if (treesNear(level, x, z, room, near).length > 0) return false;
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
  return true;
}

function findPad(level: Level): Helipad {
  const resort = level.resort;
  const finish = level.track.points[level.track.points.length - 1];
  const centre = resort ? resort.village : { x: finish.x, z: finish.z };
  const half = level.size / 2;
  const edge = HELI.pad.radius + 30;
  let best: { x: number; z: number; cost: number } | null = null;
  for (let dz = -SEARCH; dz <= SEARCH; dz += STEP) {
    for (let dx = -SEARCH; dx <= SEARCH; dx += STEP) {
      const x = centre.x + dx;
      const z = centre.z + dz;
      if (Math.abs(x - half) > half - edge || Math.abs(z - half) > half - edge) continue;
      const d = hypot(dx, dz);
      if (best && d >= best.cost) continue;
      const lean = leanOver(level, x, z, HELI.pad.radius);
      if (lean > HELI.pad.slope) continue;
      const cost = d + lean * 600;
      if (best && cost >= best.cost) continue;
      if (!clearAt(level, x, z)) continue;
      best = { x, z, cost };
    }
  }
  // Nowhere level and clear: the village (or the finish) itself.
  const at = best ?? { x: centre.x, z: centre.z };
  // Parked facing up the mountain: the fall line is +z, so the nose to −z.
  return { x: at.x, y: level.groundAt(at.x, at.z), z: at.z, heading: Math.PI };
}
