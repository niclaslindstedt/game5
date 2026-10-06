// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB's `lift-ring` view: a chair's BOARDING RING (`boardingRing`)
// from over the corral, looking out down the queue's lane at it — lit only
// on a free ride.

import { boardingRing, planLift, type Level } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

/** The lens on the first chair's boarding ring, or null on a map with no
 * chair. */
export function ringView(level: Level): LensPose | null {
  const lift = level.resort?.lifts.find((l) => l.kind === "chair");
  if (!lift) return null;
  const ring = boardingRing(planLift(level, lift));
  const out = Math.hypot(ring.x - lift.bottom.x, ring.z - lift.bottom.z) || 1;
  const ex = ring.x - ((ring.x - lift.bottom.x) / out) * 14;
  const ez = ring.z - ((ring.z - lift.bottom.z) / out) * 14;
  return {
    eye: { x: ex, y: level.groundAt(ex, ez) + 10, z: ez },
    target: { x: ring.x, y: level.groundAt(ring.x, ring.z) + 1, z: ring.z },
    fov: 60,
    roll: 0,
  };
}
