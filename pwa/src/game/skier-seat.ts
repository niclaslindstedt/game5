// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER SEATED ON A CHAIR (`lift-ride.ts`), as a reshaping of the pose
// `skierPose` stood him in (`seatedPose`) — three-free, so the suite reads
// it. Applied after the pose rather than inside it, so the stood pose the
// models are made from (`pwa/models-plugin.ts`'s sources) is untouched.
//
// A rider on a chairlift sits back on the seat with his thighs along it and
// his shins hanging from the front edge, the skis dangling under his knees,
// his back on the backrest, his hands on his thighs and the poles held
// upright beside his knees. The boots stay where the skis have them — the
// pair hangs under him as it stood under him — so the HIPS go to the seat:
// back against the chair's backrest and down onto the seat's top, the trunk
// carried with them and stood up off its lean, the knees solved again over
// the cuffs and the arms brought in to the thighs. `share` blends it in, so
// a chair scooping him off the load line sits him down rather than
// teleporting him. Sat on a helicopter's skid, his legs dangle
// (`skier-dangle.ts`): the seat carries their swing and the lower legs are
// turned to it about the knees.

import {
  BODY,
  MOUNTS,
  SHIN_ABOVE_CUFF,
  skierPose,
  type SkierPose,
  type SkierPoseInput,
} from "./skier-pose.ts";
import { swingLegs, type LegSwing } from "./skier-dangle.ts";
import { boardPose, type Board } from "./skier-sled.ts";
import { solveLimb } from "./skier-limbs.ts";
import type { Mounts } from "./skier-mounts.ts";
import type { V3 } from "./skier-vec.ts";

/** How far the chair's seat top hangs under its grip on the rope, m, and
 * where its backrest's face stands, m along the way he faces from under
 * the grip (behind it) — the chair's own (`lifts.ts` builds it to these). */
export const CHAIR_SEAT = 2.4;
export const CHAIR_BACK = -0.335;

/** The seat as the pose needs it: how seated he is, 0..1, the seat's top
 * in the body frame, m, and — dangling off a helicopter's skid — each
 * leg's swing (`skier-dangle.ts`). */
export type Seat = {
  share: number;
  y: number;
  legs?: readonly [LegSwing, LegSwing];
  /** STOOD ON A SNOWMOBILE'S BOARDS instead (`skier-sled.ts`): no seat at
   * all, but the trunk over the bars and the hands on the grips. */
  board?: Board;
};

/** The hip joints over the seat's top, m — the pelvis sat on it; how far
 * ahead of the backrest's face the hips sit, m (the seat and the back of
 * him between — sat back against it, never in it); the trunk's
 * lean back against the backrest, rad (negative: back); where the hands
 * rest along the thigh from the knee, and over it, m; and how far ahead of
 * its fist a pole held upright stands its basket, m. */
const PELVIS = 0.11;
const BACK = 0.17;
const SIT_PITCH = -0.08;
const HAND_ALONG = 0.3;
const HAND_OVER = 0.07;
const POLE_AHEAD = 0.18;

function lerp(a: V3, b: V3, k: number): V3 {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
}

/** The pose `p` sat down on the seat by `seat.share`. */
export function seatPose(p: SkierPose, seat: Seat, M: Mounts): SkierPose {
  const k = Math.max(0, Math.min(1, seat.share));
  if (k <= 0) return p;
  const hipsTo = { x: 0, y: seat.y + PELVIS, z: CHAIR_BACK + BACK };
  // Stood up off his lean, about the hips, the whole trunk rigid.
  const back = (p.pitch - SIT_PITCH) * k;
  const cos = Math.cos(back);
  const sin = Math.sin(back);
  const shift = {
    x: (hipsTo.x - p.hips.x) * k,
    y: (hipsTo.y - p.hips.y) * k,
    z: (hipsTo.z - p.hips.z) * k,
  };
  const carry = (q: V3): V3 => {
    const y = q.y - p.hips.y;
    const z = q.z - p.hips.z;
    return {
      x: q.x + shift.x,
      y: p.hips.y + shift.y + y * cos + z * sin,
      z: p.hips.z + shift.z + z * cos - y * sin,
    };
  };
  const hips = carry(p.hips);
  const hipJoints = [carry(p.hipJoints[0]), carry(p.hipJoints[1])] as [V3, V3];
  const shoulders = [carry(p.shoulders[0]), carry(p.shoulders[1])] as [V3, V3];
  // The knees over the cuffs, bent up and forward off the seat's edge.
  const knees = [0, 1].map((i) =>
    lerp(
      p.knees[i],
      solveLimb(hipJoints[i], p.feet[i], BODY.thigh, SHIN_ABOVE_CUFF, {
        x: (i ? 1 : -1) * 0.08,
        y: 1,
        z: 1,
      }),
      k,
    ),
  ) as [V3, V3];
  // The hands on the thighs, the elbows solved down and out to them.
  const hands = [0, 1].map((i) => {
    const on = lerp(knees[i], hipJoints[i], HAND_ALONG);
    return lerp(carry(p.hands[i]), { x: on.x, y: on.y + HAND_OVER, z: on.z }, k);
  }) as [V3, V3];
  const elbows = [0, 1].map((i) =>
    solveLimb(shoulders[i], hands[i], BODY.upperArm, BODY.forearm, {
      x: i ? 1 : -1,
      y: -0.6,
      z: -0.4,
    }),
  ) as [V3, V3];
  // The poles held upright beside the knees, the baskets hanging.
  const poles = p.poles
    ? ([0, 1].map((i) =>
        lerp(
          carry(p.poles![i]),
          { x: hands[i].x, y: hands[i].y - M.pole, z: hands[i].z + POLE_AHEAD },
          k,
        ),
      ) as [V3, V3])
    : null;
  return {
    ...p,
    hips,
    hipJoints,
    waist: carry(p.waist),
    neck: carry(p.neck),
    head: carry(p.head),
    pitch: p.pitch - back,
    knees,
    shoulders,
    elbows,
    hands,
    poles,
    look: p.look * (1 - k),
  };
}

/** The pose for `input`, sat on a chair's seat when there is one — what the
 * code's figure and the model are both posed by — its legs swung when the
 * seat dangles them. */
export function seatedPose(input: SkierPoseInput, seat: Seat | null): SkierPose {
  const p = skierPose(input);
  if (!seat || seat.share <= 0) return p;
  const M = input.mounts ?? MOUNTS;
  if (seat.board) return boardPose(p, seat.board, M, seat.share);
  const sat = seatPose(p, seat, M);
  return seat.legs ? swingLegs(sat, seat.legs, M).pose : sat;
}
