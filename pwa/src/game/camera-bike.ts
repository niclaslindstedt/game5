// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS ON THE DOWNHILL BIKE (`bike.ts`) — three-free, so the suite
// reads it. The ladder's rows (`camera-rigs.ts`) are a skier's: a tips lens
// a hand off the snow ahead of his boots, booms set for a body stood a
// metre over a pair of skis. On the bike he rides half a metre higher,
// over a frame 1.3 m long, so while he is on it the ladder is framed off
// THE BIKE — its centre of mass as drawn, its attitude, its way and its own
// flight — on rows of its own, and handed back the moment he is off it:
//
//   TIPS    THE BAR-CAM: a lens clamped on the bar beside the stem, the
//           front tyre and the fork's crown at the foot of the frame and
//           the trail coming at it, pitching and rolling with the bike;
//   HELMET  his own eyes, over the bars in the attack stance, tipped down
//           to the trail a few metres ahead;
//   CHASE   the close chase a filmer on a bike rides: a few metres behind
//           and just over his helmet, the whole bike and rider in the frame
//           (the rung a ride starts on);
//   FAR, HIGH  further out, and high over him;
//   ORBIT   round him.
//
// The booms keep every behaviour the ladder has (the springs, the lean with
// the face, the stretch, the trunks); only their sizes are the bike's.

import { BIKE, rotate, type BikeState, type Quat } from "@engine";

import type { RigPose, Rig, Rung } from "./camera-rigs.ts";

/** The ladder on the bike. Every eye is in its body frame (x right, y up,
 * z forward, the origin at the bike's centre of mass, some 0.5 m over the
 * ground at sag); every boom's height is over that centre. */
export const BIKE_RIGS: Record<Rung, Rig> = {
  tips: {
    kind: "bolted",
    // Beside the stem on the bar, a hand over it: the crown and the front
    // tyre under the frame's foot.
    eye: { x: 0.09, y: 0.6, z: 0.42 },
    look: 22,
    down: 0.22,
    fov: 80,
    fovPerSpeed: 0.25,
    rollShare: 0.75,
    tremor: 1,
  },
  helmet: {
    kind: "bolted",
    eye: { x: 0, y: 1.02, z: 0.16 },
    look: 14,
    down: 0.32,
    fov: 80,
    fovPerSpeed: 0.12,
    rollShare: 0.5,
    tremor: 0.8,
  },
  chase: {
    kind: "boom",
    dist: 3.4,
    distPerSpeed: 0.02,
    height: 1.55,
    aimAhead: 10,
    fov: 64,
    fovPerSpeed: 0.45,
    fovMax: 80,
    hold: 0.4,
    surge: 1,
    tremor: 1,
    yaw: { f: 1.3, zeta: 0.9, r: 0 },
    slipWeight: 0.3,
    lift: { f: 1.8, zeta: 0.75, r: 2 },
    liftAir: { f: 1, zeta: 0.85, r: 2 },
    lagMax: 2,
    incline: 0.5,
    inclineSteep: 0.7,
    ahead: 0.6,
    lean: { f: 0.8, zeta: 1, r: 0 },
    place: 0.35,
    look: { f: 1.6, zeta: 0.85, r: 0 },
    frame: 0.62,
    clearance: 1,
    ride: 0,
  },
  far: {
    kind: "boom",
    dist: 9,
    distPerSpeed: 0.03,
    height: 3.4,
    aimAhead: 14,
    fov: 56,
    fovPerSpeed: 0.4,
    fovMax: 72,
    hold: 0.4,
    surge: 1.4,
    tremor: 0.6,
    yaw: { f: 0.9, zeta: 0.9, r: 0 },
    slipWeight: 0.4,
    lift: { f: 1.2, zeta: 0.75, r: 2 },
    liftAir: { f: 0.7, zeta: 0.85, r: 2 },
    lagMax: 3,
    incline: 0.4,
    inclineSteep: 0.6,
    ahead: 0.8,
    lean: { f: 0.55, zeta: 1, r: 0 },
    place: 0.22,
    look: { f: 1.2, zeta: 0.9, r: 0 },
    frame: 0.66,
    clearance: 1.4,
    ride: 0,
  },
  high: {
    kind: "boom",
    dist: 13,
    distPerSpeed: 0.05,
    height: 10,
    aimAhead: 14,
    fov: 56,
    fovPerSpeed: 0.2,
    fovMax: 66,
    hold: 0,
    surge: 1,
    tremor: 0.3,
    yaw: { f: 0.65, zeta: 0.9, r: 0 },
    slipWeight: 0.5,
    lift: { f: 0.8, zeta: 0.8, r: 2 },
    liftAir: { f: 0.5, zeta: 0.9, r: 2 },
    lagMax: 4,
    incline: 0.35,
    inclineSteep: 0.35,
    ahead: 1,
    lean: { f: 0.45, zeta: 1, r: 0 },
    place: 0.12,
    look: { f: 1, zeta: 0.9, r: 0 },
    frame: 0.66,
    clearance: 2.5,
    ride: 0,
  },
  orbit: { kind: "orbit", radius: 7, height: 2.4, spin: 0.18, fov: 58 },
};

/** Whether the lens is the bike's this frame: he is on it, not thrown. */
export function ridingBike(b: BikeState | undefined, thrown: boolean): b is BikeState {
  return !!b?.onIt && !thrown;
}

/** THE POSE THE LADDER FRAMES WHILE HE RIDES, written over `pose` (the
 * rider's): the bike's centre as DRAWN (`at`, so the bar-cam never parts
 * from the bar it is clamped to), its attitude, its way and its flight.
 * Without a drawn bike yet (its first frame), its centre is read back off
 * the rider's place (his body rides the frame's own attitude). */
export function bikeRigPose(
  pose: RigPose,
  b: BikeState,
  at: { x: number; y: number; z: number; q: Quat } | null,
): RigPose {
  if (at) {
    pose.x = at.x;
    pose.y = at.y;
    pose.z = at.z;
    pose.q = { x: at.q.x, y: at.q.y, z: at.q.z, w: at.q.w };
  } else {
    const off = rotate(pose.q, {
      x: 0,
      y: BIKE.rider.stand.y - BIKE.com.y,
      z: BIKE.rider.stand.z - BIKE.com.z,
    });
    pose.x -= off.x;
    pose.y -= off.y;
    pose.z -= off.z;
  }
  pose.heading = b.heading;
  pose.pitch = b.pitch;
  pose.roll = b.roll;
  pose.vx = b.vx;
  pose.vy = b.vy;
  pose.vz = b.vz;
  pose.speed = b.speed;
  pose.airborne = b.airborne;
  pose.switched = false;
  pose.summit = 0;
  pose.ride = null;
  return pose;
}
