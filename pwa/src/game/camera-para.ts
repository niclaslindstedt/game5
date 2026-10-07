// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS UNDER THE PARAMOTOR'S WING (`para.ts`) — three-free, so the suite
// reads it. The skier's ladder (`camera-rigs.ts`) frames a skier a couple of
// metres tall; hung six metres under a wing eight metres across, the same
// booms put the canopy out of the top of the frame. So while the rig is on
// him the BOOMS are framed off a point between him and his wing (`LIFT`
// metres up his lines), pulled back and up far enough to hold the whole of
// it — the pilot, the lines and the canopy — and the bolted rungs (TIPS,
// HELMET) are his own, lowered by that lift so they stay where they were on
// him: the skis dangling under the lens, or his own eyes with the risers in
// the corners. Handed back the moment the rig is let go.

import { paraRigged, type GameState } from "@engine";

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

/** How far each bolted rung is tipped down under the wing, rad: hung over
 * the mountain, the level look is only haze — the skis dangling over the
 * snow far below are the shot, and the helmet's eyes look where he flies. */
const DOWN = { tips: 0.7, helmet: 0.3 };

const bolted = (rig: Rig, down: number): BoltedRig => {
  const b = rig as BoltedRig;
  // Hung under the wing he is flying, not falling: no fall look.
  return { ...b, eye: { x: b.eye.x, y: b.eye.y - LIFT, z: b.eye.z }, down, fallDown: 0 };
};
const boom = (rig: Rig, over: Partial<BoomRig>): BoomRig => ({
  ...(rig as BoomRig),
  fall: 0,
  ...over,
});

/** The ladder under the wing. */
export const PARA_RIGS: Record<Rung, Rig> = {
  tips: bolted(RIGS.tips, DOWN.tips),
  helmet: bolted(RIGS.helmet, DOWN.helmet),
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
  high: boom(RIGS.high, { dist: 24, height: 15, clearance: 4 }),
  orbit: { kind: "orbit", radius: 17, height: 3, spin: 0.12, fov: 56 },
};

/** Whether the lens is the wing's this frame: the rig on him. */
export function underWing(state: GameState): boolean {
  return paraRigged(state) && state.skier.thrown === null;
}

/** THE POSE THE LADDER FRAMES UNDER THE WING, written over `pose` (the
 * pilot's): lifted `LIFT` m along his lines toward the drawn wing (`wing`),
 * so the booms frame the whole rig. */
export function paraRigPose(
  pose: RigPose,
  wing: { x: number; y: number; z: number } | null,
): RigPose {
  if (!wing) {
    pose.y += LIFT;
    return pose;
  }
  const dx = wing.x - pose.x;
  const dy = wing.y - pose.y;
  const dz = wing.z - pose.z;
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-3) return pose;
  pose.x += (dx / d) * LIFT;
  pose.y += (dy / d) * LIFT;
  pose.z += (dz / d) * LIFT;
  return pose;
}
