// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS ON A PISTE MACHINE (`groomer.ts`) — three-free, so the suite
// reads it. The ladder's rows are built round a skier a metre tall; in the
// cab of a machine nine metres long and three tall they would put the tips
// lens inside its blade and the chase inside its cab. So while he drives
// one the ladder is framed off THE MACHINE — its middle a metre and a half
// over the snow, its attitude, its way — on rows of its own, as the
// snowmobile's are (`camera-sled.ts`):
//
//   TIPS    THE BLADE: a lens on the blade's top edge, the snow and its
//           heap coming at it, the work lamps' pool ahead;
//   HELMET  the DRIVER'S EYE in the cab, the hood and the blade's arms at
//           the foot of the frame;
//   CHASE   behind and over the tiller, the whole machine, the swath it
//           lays and the lamps' pool in the frame;
//   FAR, HIGH  the same further out, and high over it.

import { fromEuler, GROOMER, type GroomerState } from "@engine";

import type { RigPose, Rig, Rung } from "./camera-rigs.ts";

/** How far over the snow the pose's centre is, m: the bolted eyes and the
 * booms' heights are over it. */
export const GROOMER_CENTRE = 1.5;

const boom = (dist: number, height: number, fov: number, clearance: number): Rig => ({
  kind: "boom",
  dist,
  distPerSpeed: 0,
  height,
  aimAhead: 14,
  fov,
  fovPerSpeed: 0.2,
  fovMax: fov + 8,
  hold: 0.4,
  surge: 0.6,
  tremor: 0.6,
  yaw: { f: 0.7, zeta: 0.95, r: 0 },
  slipWeight: 0.2,
  lift: { f: 1, zeta: 0.85, r: 2 },
  liftAir: { f: 0.8, zeta: 0.9, r: 2 },
  lagMax: 4,
  incline: 0.4,
  inclineSteep: 0.5,
  ahead: 0.7,
  lean: { f: 0.5, zeta: 1, r: 0 },
  place: 0.2,
  look: { f: 1, zeta: 0.9, r: 0 },
  frame: 0.6,
  clearance,
  ride: 0,
});

/** The ladder on the machine, every eye in its body frame (x right, y up,
 * z forward, the origin `GROOMER_CENTRE` over the snow under the middle of
 * the tracks). */
export const GROOMER_RIGS: Record<Rung, Rig> = {
  tips: {
    kind: "bolted",
    eye: { x: 0.4, y: GROOMER.blade.height + 0.75 - GROOMER_CENTRE, z: GROOMER.blade.ahead - 0.9 },
    look: 30,
    down: 0.22,
    fov: 78,
    fovPerSpeed: 0.2,
    rollShare: 0.6,
    tremor: 0.6,
  },
  helmet: {
    kind: "bolted",
    eye: { x: 0, y: GROOMER.seat.y + 0.85 - GROOMER_CENTRE, z: GROOMER.seat.z + 0.2 },
    look: 30,
    down: 0.2,
    fov: 80,
    fovPerSpeed: 0.1,
    rollShare: 0.7,
    tremor: 0.5,
  },
  chase: boom(15, 6.5, 60, 2),
  far: boom(26, 10, 56, 3),
  high: boom(30, 24, 56, 4),
  orbit: { kind: "orbit", radius: 22, height: 8, spin: 0.12, fov: 55 },
};

/** The machine he drives this frame, if he is in a cab. */
export function drivenGroomer(state: {
  groomers?: GroomerState[];
  skier: { thrown: unknown };
}): GroomerState | null {
  if (state.skier.thrown) return null;
  return state.groomers?.find((g) => g.rider) ?? null;
}

/** THE POSE THE LADDER FRAMES WHILE HE DRIVES, written over `pose`: the
 * machine as `at` draws it (its place on the snow, its heading, pitch and
 * roll) or as the engine has it, its way and speed. */
export function groomerRigPose(
  pose: RigPose,
  g: GroomerState,
  at: { x: number; y: number; z: number; heading: number; pitch: number; roll: number } | null,
): RigPose {
  const p = at ?? g;
  pose.x = p.x;
  pose.y = p.y + GROOMER_CENTRE;
  pose.z = p.z;
  pose.q = fromEuler(p.heading, p.pitch, p.roll);
  pose.heading = p.heading;
  pose.pitch = p.pitch;
  pose.roll = p.roll;
  pose.vx = Math.sin(g.heading) * g.speed;
  pose.vy = 0;
  pose.vz = Math.cos(g.heading) * g.speed;
  pose.speed = Math.abs(g.speed);
  pose.airborne = false;
  pose.switched = false;
  pose.summit = 0;
  pose.ride = null;
  return pose;
}
