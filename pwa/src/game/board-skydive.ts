// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARDER'S BODY THROUGH A SKYDIVE (`chute.ts`, drawn by
// `board-model.ts`) — three-free, so the suite reads it. The same stages as
// the skier's (`skier-skydive.ts`'s `SkydiveShape`), laid the same way —
// his arms, his arch, the pull, the cut-away, the reserve's handle and the
// toggles are the skier's own (`skydivePose`) — with the board kept on both
// feet:
//
//   * HIS BODY FACES THE AIR AS A SKYDIVER'S DOES. Riding, a boarder stands
//     sideways to his board; jumping, he is posed square to his front like
//     the skier (his chest to the earth in the box, to the canopy's heading
//     under it) with the board ACROSS his feet, its nose on his lead side —
//     a skysurfer's board turned feet-across. The figure is turned about his
//     up by `yaw` to stand that frame where the stage wants it.
//   * POISED IN THE DOOR he stands sideways on the board along the sill,
//     facing out of the door, crouched, his hands on its posts; THE EXIT
//     turns him a quarter into the slipstream as he leaves it.
//   * THE BOX: the knees bent and apart, the shins up into the air with the
//     board flat across over the soles — its area square to the wind, as a
//     skysurfer's is held. A board fights a TRACK (it drags and flips a body
//     whose legs go straight, so the knees stay half bent and the board
//     trails flatter than a skier's skis); HEAD DOWN the legs go long with
//     the board over them.
//   * UNDER THE CANOPY the board hangs across under him, the knees a little
//     bent, the hands up on the toggles; THE FLARE brings the legs under him
//     and turns him side-on, the board pointed along his line of flight for
//     the snow, as he rides it away once it is down.
//
// The legs are the skier's turned limbs re-fitted to the board: the deck
// laid under the turned feet (`boardUnderFeet`), each boot set in its
// binding, the deck drawn in toward the hips where a leg would not reach,
// and each knee solved again between the hip and the boot's cuff — so the
// limbs keep their lengths and the boots never leave the bindings.

import type { BoardFrame, BoardPoseInput } from "./board-pose.ts";
import { bindingsOf, cuffOver } from "./board-pose.ts";
import { boardUnderFeet } from "./board-thrown.ts";
import type { SkierPose } from "./skier-joints.ts";
import { BODY, SHIN_ABOVE_CUFF, mountsFor, type Mounts } from "./skier-mounts.ts";
import { solveLimb } from "./skier-limbs.ts";
import { skierPose } from "./skier-pose.ts";
import { skydivePose, squareStand, type SkydiveShape } from "./skier-skydive.ts";
import { SOFT_BOOT } from "./board-look.ts";
import { add, len, mix, norm, scale, sub, type V3 } from "./skier-vec.ts";

const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** How much of a track's leg the board allows: the rest is the box's bent
 * knees. */
export const BOARD_TRACK = 0.5;

/** How far a leg may reach from the hip to the cuff, m, a hair short of
 * straight. */
const LEG_REACH = (BODY.thigh + SHIN_ABOVE_CUFF) * 0.985;

/** The mounts the square stand is laid on: the board's stance under the
 * soft boots' cuffs (the bindings' plate and the deck under them). */
export function boardSkydiveMounts(spec: {
  cogHeight: number;
  poleReach: number;
  crouchDrop?: number;
  board?: { stance: number };
}): Mounts {
  return mountsFor({ ...spec, stance: spec.board?.stance ?? 0.5 }, SOFT_BOOT.cuff + 0.04);
}

/** THE SQUARE STAND a skydive's body is laid from: stood at rest, his
 * front +z, crouched by `crouch`, the hands empty. */
export function boardSkydiveStand(mounts: Mounts, crouch: number): SkierPose {
  return skierPose(
    squareStand({
      hipRight: 0,
      hipAft: 0,
      lean: 0,
      steer: 0,
      crouch,
      airborne: false,
      landing: 0,
      poles: false,
      mounts,
    }),
  );
}

/** The turn about his up the stage stands him at, rad (+ his front turned
 * toward his right): out of the door (on his left) in it, square to his
 * front in the air, side-on to his line of flight at the flare's end. */
export function boardSkydiveYaw(s: SkydiveShape, lead: "regular" | "goofy"): number {
  const riding = lead === "regular" ? Math.PI / 2 : -Math.PI / 2;
  return (-Math.PI / 2) * s.door + riding * s.flare * s.hang;
}

/** THE POSE MADE OVER FOR THE SKYDIVE on a board: `stand` (the skier's
 * square standing pose, his front +z) with its arms laid as `s` has them,
 * its legs as the board lets them be, and the deck under the boots — all in
 * the frame `boardSkydiveYaw` turns. */
export function boardSkydivePose(
  stand: SkierPose,
  s: SkydiveShape,
  board: BoardPoseInput["board"],
  mounts: Mounts,
): { pose: SkierPose; deck: BoardFrame } {
  const arms = skydivePose(stand, s, mounts).pose;
  const legShape = { ...s, track: s.track * BOARD_TRACK, box: s.box + s.track * (1 - BOARD_TRACK) };
  const legs = skydivePose(stand, legShape, mounts).pose;
  const pose: SkierPose = {
    ...arms,
    knees: [...legs.knees] as [V3, V3],
    feet: [...legs.feet] as [V3, V3],
    boots: [...legs.boots] as SkierPose["boots"],
  };
  // The deck under the turned feet, the boots set in its bindings —
  // stood flat on the sill in the door and for the snow at the flare...
  const deck = boardUnderFeet(pose, board);
  const flat = Math.max(s.door, s.flare * s.hang);
  if (flat > 0) {
    const a = deck.along;
    const up = sub({ x: 0, y: 1, z: 0 }, scale(a, a.y));
    deck.normal = norm(mix(deck.normal, norm(up), flat));
    deck.right = norm(cross(deck.normal, a));
    const mid = mix(pose.feet[0], pose.feet[1], 0.5);
    const placed = bindingsOf(deck, { board });
    const cuffs = [0, 1].map((i) => cuffOver(placed.sole[i], placed.boot[i]));
    deck.centre = add(deck.centre, sub(mid, mix(cuffs[0], cuffs[1], 0.5)));
    const { sole, boot } = bindingsOf(deck, { board });
    for (let i = 0; i < 2; i++) {
      pose.boots[i] = boot[i];
      pose.feet[i] = cuffOver(sole[i], boot[i]);
    }
  }
  // ...drawn in toward the hips while a leg would not reach its binding...
  for (let k = 0; k < 4; k++) {
    let worst = 0;
    let pull: V3 = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 2; i++) {
      const d = sub(pose.hipJoints[i], pose.feet[i]);
      const over = len(d) - LEG_REACH;
      if (over > worst) {
        worst = over;
        pull = scale(d, over / len(d));
      }
    }
    if (worst <= 0) break;
    deck.centre = add(deck.centre, pull);
    for (let i = 0; i < 2; i++) pose.feet[i] = add(pose.feet[i], pull);
  }
  // ...and each knee solved again toward where the skier's bent.
  const knees = [...pose.knees] as [V3, V3];
  for (let i = 0; i < 2; i++) {
    const hip = pose.hipJoints[i];
    const pole = sub(legs.knees[i], mix(hip, legs.feet[i], 0.5));
    knees[i] = solveLimb(hip, pose.feet[i], BODY.thigh, SHIN_ABOVE_CUFF, pole);
  }
  pose.knees = knees;
  // In the door, facing out of it, both hands out on the door's posts.
  if (s.door > 0) {
    const hands = [...pose.hands] as [V3, V3];
    const elbows = [...pose.elbows] as [V3, V3];
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const sh = pose.shoulders[i];
      hands[i] = mix(pose.hands[i], add(sh, { x: side * 0.32, y: 0.05, z: 0.38 }), s.door);
      elbows[i] = solveLimb(sh, hands[i], BODY.upperArm, BODY.forearm, {
        x: side,
        y: -0.6,
        z: -0.2,
      });
    }
    pose.hands = hands;
    pose.elbows = elbows;
  }
  return { pose, deck };
}
