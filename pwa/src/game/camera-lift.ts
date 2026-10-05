// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFT, as the lens rides it — how close the chase boom (`camera-rigs.ts`)
// comes in behind a skier carried up a lift (`lift-ride.ts`), and how it lets
// him go again as he stands up off the chair and slides down the unload ramp
// on his own. Three-free, so the suite reads it
// (`tests/camera_lift_test.ts`).
//
// The chase boom is set for a skier going DOWN a mountain: 4.3 m back, its
// arm leaning with the fall line read off the snow under him. Carried up a
// chair he is eight metres over that snow and climbing, so the ground it
// reads is the wrong ground and the standoff turns him into a figure on a
// distant chair. A rider's own view of a ride is the one wanted instead — the
// lens close behind him and a little over his head, level, the chair's back
// and hanger in the frame's foot and the rope running on up to the top
// station ahead of him (`docs/summit-stations.md`). Coming into the top the
// skis touch on the flat, he stands where it tips down and the chair pushes
// him off down the ramp, gliding on away from the chair's path before he
// turns for his run. The lift lets him go there, and the lens eases out over
// `release` s to the chase — on the pad the summit's own low look behind him
// (`camera-summit.ts`), opening out only once he is over the lip.

import type { LiftRide } from "@engine";

type LiftKind = LiftRide["kind"];

/** How the boom stands on a lift, per kind: its standoff behind him, m, its
 * height over him, m, its fov, deg, and where he stands in the frame (a
 * share of the half-fov under the axis — lower than the chase's, so the
 * rope and the top station show over him). A chair's rider is drawn sat,
 * the lens over his shoulder; a gondola's is hidden in its cabin, so the
 * lens stands off the cabin's tail; a drag's is stood on the snow behind
 * his T-bar. */
export const LIFT_LOOK = {
  chair: { dist: 2.6, height: 0.95, fov: 64, place: 0.42 },
  gondola: { dist: 6.5, height: 1.6, fov: 64, place: 0.3 },
  drag: { dist: 3.2, height: 1.25, fov: 62, place: 0.36 },
  /** How briskly the boom comes in once he is taken, 1/s, and how briskly
   * it opens out again once the lift lets him go at the top. */
  take: 2.5,
  release: 0.55,
} as const;

/** What the boom is handed (`RigPose.ride`): how much of the lift's look
 * it takes, 0..1, and that look. */
export type RideLook = {
  share: number;
  dist: number;
  height: number;
  fov: number;
  place: number;
};

/** The look's memory between frames: the share it has eased to, and the
 * kind of lift it last rode (kept after the lift lets go, while it opens
 * out). */
export type RideMemory = { share: number; kind: LiftKind | null };

export function createRideMemory(): RideMemory {
  return { share: 0, kind: null };
}

/** The share the look is headed for: whole while `lift` has him. */
export function rideTarget(lift: LiftRide | null): number {
  return lift ? 1 : 0;
}

/** One frame of the lift's look, `dt` s after the last: the share eased
 * toward its target (in at `take`; out at `release` once the lift lets
 * go). Null once nothing of it is left. `snap` puts the share straight at
 * its target (a new run). */
export function stepRideLook(
  mem: RideMemory,
  lift: LiftRide | null,
  dt: number,
  snap = false,
): RideLook | null {
  if (lift) mem.kind = lift.kind;
  const want = rideTarget(lift);
  if (snap) mem.share = want;
  else if (want > mem.share) {
    mem.share += (want - mem.share) * (1 - Math.exp(-LIFT_LOOK.take * dt));
  } else mem.share += (want - mem.share) * (1 - Math.exp(-LIFT_LOOK.release * dt));
  if (mem.share < 1e-3 || !mem.kind) {
    mem.share = 0;
    return null;
  }
  return { share: mem.share, ...LIFT_LOOK[mem.kind] };
}
