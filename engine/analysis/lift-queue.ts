// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R26 — THE NEXT LIFT'S QUEUE, held on the finished map (generator v7):
// wherever a lift's top stands a skate from another lift's bottom station,
// the boarding ring at the open end of that station's corral lies ahead of a
// rider let go at the top and to one side, and the snow carries him down to
// it — read off what the level publishes (the lifts, the ground, the runs),
// never off the plan that laid it (`mapgen/lift-chain.ts`).

import { angleDiff, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { RESORT_RULES as RR } from "../mapgen/resort-rules.ts";
import { withinBand } from "../mapgen/rules.ts";
import type { Level, Lift } from "../mapgen/types.ts";
import { boardingRing, letGoOf, ruledLiftPlans, type LiftPlan } from "../game/lift-line.ts";

/** The step the way is read at, m. */
const READ = 1;

/** Every lift whose bottom station stands within `access.skate` of
 * another's top, with that top's lift: the pairs R29 counts a skater
 * across, and so the pairs whose queue must lie ahead. */
export function chainedLifts(level: Level): { upper: Lift; lower: LiftPlan }[] {
  const lifts = level.resort?.lifts ?? [];
  const plans = ruledLiftPlans(level);
  const out: { upper: Lift; lower: LiftPlan }[] = [];
  for (const upper of lifts) {
    if (upper.kind === "drag") continue;
    for (const lower of plans) {
      if (lower.lift.id === upper.id) continue;
      const b = lower.lift.bottom;
      if (hypot(b.x - upper.top.x, b.z - upper.top.z) < RR.access.skate) out.push({ upper, lower });
    }
  }
  return out;
}

/** Why the way off `upper`'s top to `lower`'s queue fails R26, or null:
 * the ring behind him or square across his way, too near or too far, or
 * snow that climbs or will not carry him to it. */
export function queueFault(level: Level, upper: Lift, lower: LiftPlan): string | null {
  const C = RR.lift.chain;
  const off = letGoOf(upper.kind, upper.bottom, upper.top);
  const ring = boardingRing(lower);
  const dx = ring.x - off.x;
  const dz = ring.z - off.z;
  const reach = hypot(dx, dz);
  const bearing = Math.abs(angleDiff(off.heading, Math.atan2(dx, dz)));
  const deg = (a: number): string => `${((a * 180) / Math.PI).toFixed(0)}°`;
  if (!withinBand(bearing, C.bearing, 0.02))
    return `lies ${deg(bearing)} off the way a rider out of ${upper.id} faces`;
  if (!withinBand(reach, C.reach, 0.5)) return `lies ${reach.toFixed(0)} m from him`;
  const n = Math.max(1, Math.ceil(reach / READ));
  const y0 = level.groundAt(off.x, off.z);
  let low = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const y = level.groundAt(off.x + dx * t, off.z + dz * t);
    if (y - low > C.rise) return `is reached over snow that climbs ${(y - low).toFixed(2)} m`;
    low = Math.min(low, y);
  }
  const fall = (y0 - level.groundAt(ring.x, ring.z)) / reach;
  if (fall < C.fall) return `is reached over snow falling only ${(fall * 100).toFixed(1)} %`;
  return null;
}
