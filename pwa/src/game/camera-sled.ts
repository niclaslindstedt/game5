// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS ON THE SNOWMOBILE (`sled.ts`) — three-free, so the suite reads
// it. The ladder's rows (`camera-rigs.ts`) are built round a skier a metre
// tall over his boots: the TIPS lens a hand's height off the snow ahead of
// them and the HELMET lens at his eyes, the booms a few metres behind his
// back. Stood on the boards of a machine three metres long, the same rows
// put the tips lens INSIDE its hood and the chase on top of its tunnel. So
// while he rides it the ladder is framed off THE MACHINE — its centre of
// gravity as it is drawn, its attitude, its way, its own flight — on rows
// of its own, rung by rung, and handed back the moment he is off it:
//
//   TIPS    THE NOSE: a lens bolted low on the bumper, ahead of the hood,
//           the snow coming straight at it and the lamp's pool on it —
//           the bumper camera of a racer, the machine pitching and rolling
//           it over every drift;
//   HELMET  the RIDER'S EYE over the bars, tipped down far enough that the
//           hood and the bars stand at the foot of the frame;
//   CHASE   behind and over the rider's head, the whole machine and the
//           roost off its belt in the frame;
//   FAR, HIGH  the same further out, and high over it.
//
// The booms keep every behaviour the ladder has (the springs, the lean
// with the face, the stretch, the trunks); only their sizes are the
// machine's. Nothing on a summit's pad or a lift is the machine's.

import { rotate, SLED, type Quat, type SledState } from "@engine";

import type { RigPose, Rig, Rung } from "./camera-rigs.ts";

/** The ladder on the machine. Every eye is in its body frame (x right, y up,
 * z forward, the origin at the centre of gravity, `SLED.cogHeight` over the
 * snow); every boom's height is over that centre. */
export const SLED_RIGS: Record<Rung, Rig> = {
  tips: {
    kind: "bolted",
    eye: { x: 0, y: 0.02, z: 1.56 },
    look: 30,
    down: 0.05,
    fov: 74,
    fovPerSpeed: 0.3,
    rollShare: 0.6,
    tremor: 1,
  },
  helmet: {
    kind: "bolted",
    eye: { x: 0, y: 1.38, z: 0.16 },
    look: 30,
    down: 0.22,
    fov: 82,
    fovPerSpeed: 0.2,
    rollShare: 0.6,
    tremor: 0.8,
  },
  chase: {
    kind: "boom",
    dist: 5.6,
    distPerSpeed: 0,
    height: 2.4,
    aimAhead: 16,
    fov: 62,
    fovPerSpeed: 0.5,
    fovMax: 78,
    hold: 0.4,
    surge: 1,
    tremor: 1,
    yaw: { f: 1.1, zeta: 0.9, r: 0 },
    slipWeight: 0.3,
    lift: { f: 1.6, zeta: 0.75, r: 2 },
    liftAir: { f: 0.9, zeta: 0.85, r: 2 },
    lagMax: 2.6,
    incline: 0.5,
    inclineSteep: 0.7,
    ahead: 0.6,
    lean: { f: 0.7, zeta: 1, r: 0 },
    place: 0.3,
    look: { f: 1.5, zeta: 0.85, r: 0 },
    frame: 0.66,
    clearance: 1.3,
    ride: 0,
  },
  far: {
    kind: "boom",
    dist: 13,
    distPerSpeed: 0.02,
    height: 4.6,
    aimAhead: 16,
    fov: 56,
    fovPerSpeed: 0.4,
    fovMax: 72,
    hold: 0.4,
    surge: 1.4,
    tremor: 0.6,
    yaw: { f: 0.8, zeta: 0.9, r: 0 },
    slipWeight: 0.4,
    lift: { f: 1.2, zeta: 0.75, r: 2 },
    liftAir: { f: 0.7, zeta: 0.85, r: 2 },
    lagMax: 3.4,
    incline: 0.4,
    inclineSteep: 0.6,
    ahead: 0.8,
    lean: { f: 0.55, zeta: 1, r: 0 },
    place: 0.22,
    look: { f: 1.2, zeta: 0.9, r: 0 },
    frame: 0.66,
    clearance: 1.6,
    ride: 0,
  },
  high: {
    kind: "boom",
    dist: 16,
    distPerSpeed: 0.05,
    height: 12,
    aimAhead: 16,
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
    lagMax: 4.5,
    incline: 0.35,
    inclineSteep: 0.35,
    ahead: 1,
    lean: { f: 0.45, zeta: 1, r: 0 },
    place: 0.12,
    look: { f: 1, zeta: 0.9, r: 0 },
    frame: 0.66,
    clearance: 3,
    ride: 0,
  },
  orbit: { kind: "orbit", radius: 18, height: 6, spin: 0.14, fov: 55 },
};

/** Whether the lens is the machine's this frame: he is on its boards. */
export function ridingSled(s: SledState | undefined, thrown: boolean): s is SledState {
  return !!s?.rider && !thrown;
}

/** THE POSE THE LADDER FRAMES WHILE HE RIDES, written over `pose` (the
 * rider's): the machine's centre as it is DRAWN (`at`, so a bolted lens
 * never parts from the hood it sits on), its attitude, its way and its own
 * flight. Without a drawn machine yet (its first frame), its centre is
 * read back off the rider's place (`riderFrame` turned round; his
 * attitude is the machine's while he rides). */
export function sledRigPose(
  pose: RigPose,
  s: SledState,
  at: { x: number; y: number; z: number; q: Quat } | null,
  riderCog: number,
): RigPose {
  if (at) {
    pose.x = at.x;
    pose.y = at.y;
    pose.z = at.z;
    pose.q = { x: at.q.x, y: at.q.y, z: at.q.z, w: at.q.w };
  } else {
    const b = SLED.boards;
    const off = rotate(pose.q, {
      x: s.riderRight * 0.5,
      y: b.y + riderCog,
      z: b.z - s.riderAft * 0.5,
    });
    pose.x -= off.x;
    pose.y -= off.y;
    pose.z -= off.z;
  }
  pose.heading = s.heading;
  pose.pitch = s.pitch;
  pose.roll = s.roll;
  pose.vx = s.vx;
  pose.vy = s.vy;
  pose.vz = s.vz;
  pose.speed = s.speed;
  pose.airborne = s.airborne;
  pose.switched = false;
  pose.summit = 0;
  pose.ride = null;
  return pose;
}
