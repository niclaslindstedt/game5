// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE LADDER FRAMES — the skier on his skis, and HIM, not his skis,
// once he is thrown.
//
// Once the engine throws the skier off (`crash.ts`'s `Thrown`), his
// `SkierState` goes on stepping as the skis he left — let go, sliding on
// down the hill — and his body is a ragdoll of its own. A boom framed off
// the skier's state would follow that sliding pair and leave the body to
// tumble out of the back of the frame. So while he is thrown the rig's pose
// is moved onto the BODY as drawn: its centre of mass brought down to where
// his boots would be (the snow under him once he lies), its travel the
// body's own, and its nose the way it was last going, held once it stops.
// The death cam (`camera-death.ts`) and the replay's lenses frame the body
// on their own; this is the ladder's.
//
// Three-free, so the suite reads it (`tests/camera_subject_test.ts`).

import { revertShare } from "@engine";
import type { SkierState, Thrown } from "@engine";
import type { Quat } from "@niclaslindstedt/oss-game-framework/core/quat";

import type { RigPose } from "./camera-rigs.ts";

/** How far his centre of mass stands over his boots, m — what is taken off
 * the body's height so the boom stands where it would over him on his skis,
 * never below the snow under him. */
export const THROWN_HIP = 0.9;

/** The body's speed over the snow above which its travel turns the nose
 * the boom stands behind, m/s; slower, the last such bearing is held. */
export const THROWN_TURN = 1;

/** What a lens on a thrown body keeps between frames. */
export type ThrownLens = { heading: number | null };

export function createThrownLens(): ThrownLens {
  return { heading: null };
}

/** Fill `pose` off the skier as the state has him and `drawn` (where he is
 * drawn this frame, `sink` the furrow he sits in), then move it onto his
 * body when he is thrown (`onBody`). */
export function subjectPose(
  pose: RigPose,
  skier: SkierState,
  drawn: { x: number; y: number; z: number; q: Quat },
  sink: number,
  body: Thrown | null,
  groundAt: (x: number, z: number) => number,
  mem: ThrownLens,
): RigPose {
  pose.x = drawn.x;
  pose.y = drawn.y - sink;
  pose.z = drawn.z;
  pose.q = drawn.q;
  // TURNING ROUND out of switch (`switch.ts`'s revert), the boom is told
  // the nose he had and has again — the line he travels — not the body
  // swung half round under it, which would swing the lens with it.
  const r = skier.revert;
  pose.heading = r ? skier.heading - r.turn * revertShare(r.u) + Math.PI : skier.heading;
  pose.pitch = skier.pitch;
  pose.roll = skier.roll;
  pose.vx = skier.vx;
  pose.vy = skier.vy;
  pose.vz = skier.vz;
  pose.speed = skier.speed;
  pose.airborne = skier.airborne;
  pose.switched = r ? false : skier.switched;
  pose.packed = skier.packed;
  return onBody(pose, body, groundAt, mem);
}

/** Move `pose` (filled off the skier's state) onto `body` when he is thrown;
 * on his skis it is left as it is and the memory let go. */
export function onBody(
  pose: RigPose,
  body: Thrown | null,
  groundAt: (x: number, z: number) => number,
  mem: ThrownLens,
): RigPose {
  if (!body) {
    mem.heading = null;
    return pose;
  }
  const plan = Math.hypot(body.vx, body.vz);
  if (plan > THROWN_TURN) mem.heading = Math.atan2(body.vx, body.vz);
  else mem.heading ??= pose.heading;
  pose.x = body.x;
  pose.z = body.z;
  pose.y = Math.max(groundAt(body.x, body.z), body.y - THROWN_HIP);
  pose.vx = body.vx;
  pose.vy = body.vy;
  pose.vz = body.vz;
  pose.speed = Math.hypot(body.vx, body.vy, body.vz);
  pose.heading = mem.heading;
  pose.switched = false;
  pose.airborne = !body.touching;
  return pose;
}
