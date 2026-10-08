// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS UNDER THE PARAMOTOR'S WING (`para.ts`) — three-free, so the suite
// reads it. The skier's ladder (`camera-rigs.ts`) frames a skier a couple of
// metres tall; hung six metres under a wing eight metres across, the same
// booms put the canopy out of the top of the frame. So while the rig is on
// him the BOOMS are framed off a point between him and his wing (`LIFT`
// metres up his lines), pulled back and up far enough to hold the whole of
// it — the pilot, the lines and the canopy. The BOLTED rungs stay on him
// (the pose's `lift` taken back off), turned with him as he hangs under the
// wing's bank: the cameras a pilot flies with, framed off the footage a
// paramotor pilot brings home:
//
//   HELMET  his own eyes, as a helmet camera sees: wide, tipped down so the
//           horizon rides high and his knees, boots and skis hang in the
//           bottom of the frame, banked with the wing and turned a little
//           into the turn, where a pilot looks;
//   TIPS    his eyes looking DOWN past his skis at the drop — his jacket,
//           his gloves on the toggles, the risers and the snow far below;
//   HIGH    THE CANOPY CAM, under the wing's middle looking down the line
//           cascade at him hung in the harness over the mountain.
//
// The figure is drawn on the bolted rungs too (`renderer.ts`): from inside
// the helmet his arms and legs are what a pilot's own camera sees.
// Handed back the moment the rig is let go.

import { PARA, paraRigged, type GameState } from "@engine";
import { fromAxisAngle, multiply } from "@niclaslindstedt/oss-game-framework/core/quat";

import {
  RIGS,
  type BoltedRig,
  type BoomRig,
  type Rig,
  type RigPose,
  type Rung,
} from "./camera-rigs.ts";

/** How far up his lines the booms are framed from, m. */
export const LIFT = 2.6;

/** His eyes in the harness, in his body frame, m: in front of his face,
 * where a camera on the helmet's chin sees past his own figure. */
const EYES = { x: 0, y: 0.72, z: 0.22 };

/** A bolted rung under the wing, its eye stated off the pilot (the pose's
 * `lift` taken back off). Hung under the wing he is flying, not falling: no
 * fall look, no snow's tremor, no widening with the speed. */
const bolted = (rig: Rig, over: Partial<BoltedRig>): BoltedRig => ({
  ...(rig as BoltedRig),
  fovPerSpeed: 0,
  tremor: 0,
  ...over,
  fallDown: 0,
});
const boom = (rig: Rig, over: Partial<BoomRig>): BoomRig => ({
  ...(rig as BoomRig),
  fall: 0,
  ...over,
});

/** The ladder under the wing. */
export const PARA_RIGS: Record<Rung, Rig> = {
  tips: bolted(RIGS.helmet, {
    eye: { x: 0, y: 0.8, z: 0.45 },
    down: 1.15,
    fov: 84,
    rollShare: 0.8,
  }),
  helmet: bolted(RIGS.helmet, { eye: EYES, down: 0.78, fov: 88, rollShare: 0.8, turn: 0.5 }),
  // The summit pad's close, level look (`SUMMIT_LOOK`) is a skier's: under
  // a wing it would put the lens inside the canopy, so the chase leaves it.
  chase: boom(RIGS.chase, {
    dist: 10.5,
    height: 1.4,
    fov: 64,
    fovMax: 80,
    clearance: 2,
    ride: 0,
  }),
  far: boom(RIGS.far, { dist: 20, height: 3.5, fov: 56, fovMax: 70, clearance: 3 }),
  // Looking all but straight down, a rolled horizon would only spin the
  // picture: the canopy cam keeps none of it.
  high: bolted(RIGS.helmet, {
    eye: { x: 0, y: PARA.wing.lines - 1.6, z: -1.6 },
    look: 30,
    down: 1.3,
    fov: 70,
    rollShare: 0,
  }),
  orbit: { kind: "orbit", radius: 17, height: 3, spin: 0.12, fov: 56 },
};

/** How far the bolted rungs look up on the snow, before he flies, rad. */
const GROUND_UP = 0.6;
/** How long the eyes take to come down over the drop once he flies, s. */
const HANG_IN = 1.2;

/** THE PILOT'S EYES COMING DOWN once he flies: `hung` eased toward 1 over
 * `dt` s. */
export function hangIn(hung: number, dt: number): number {
  return hung + (1 - hung) * (1 - Math.exp(-dt / HANG_IN));
}

/** WHETHER HIS OWN FIGURE IS DRAWN on `rung` of `ladder` (the ladder a
 * machine framed this frame, if any): his own eyes hide him, but flying
 * under the wing they see his arms and legs, as a pilot's camera does. */
export function figureShown(rung: Rung, ladder: unknown, airborne: boolean): boolean {
  if (rung !== "tips" && rung !== "helmet") return true;
  return ladder === PARA_RIGS && airborne;
}

/** Whether the lens is the wing's this frame: the rig on him. */
export function underWing(state: GameState): boolean {
  return paraRigged(state) && state.skier.thrown === null;
}

/** THE POSE THE LADDER FRAMES UNDER THE WING, written over `pose` (the
 * pilot's): lifted `LIFT` m along his lines toward the drawn wing (`wing`),
 * so the booms frame the whole rig, the lift kept as `RigPose.lift` for the
 * bolted rungs to take back off. */
export function paraRigPose(
  pose: RigPose,
  wing: { x: number; y: number; z: number } | null,
  hung = 1,
): RigPose {
  // On the snow, skiing off under the wing, his eyes are up on the slope
  // ahead and the horizon; lifted off, they come down to the bolted rungs'
  // own look over the drop (`hangIn` eases it) — tipped about his own right.
  if (hung < 1) pose.q = multiply(pose.q, fromAxisAngle(1, 0, 0, -GROUND_UP * (1 - hung)));
  if (!wing) {
    pose.y += LIFT;
    pose.lift = { x: 0, y: LIFT, z: 0 };
    return pose;
  }
  const dx = wing.x - pose.x;
  const dy = wing.y - pose.y;
  const dz = wing.z - pose.z;
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-3) return pose;
  const lift = { x: (dx / d) * LIFT, y: (dy / d) * LIFT, z: (dz / d) * LIFT };
  pose.x += lift.x;
  pose.y += lift.y;
  pose.z += lift.z;
  pose.lift = lift;
  return pose;
}
