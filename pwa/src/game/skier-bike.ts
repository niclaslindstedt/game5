// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER ON THE DOWNHILL BIKE (`bike.ts`) — his dressed figure laid on
// the bike as the engine has it (`bikePose`): his hands round the grips, the
// balls of his feet on the pedals as the cranks turn them, his body in the
// ATTACK STANCE — knees and elbows bent and out, hips back over the saddle,
// chest low over the stem, head up — moved where the engine's rider body
// moves on its springs: back off the rear for a steep and a landing, down
// for a pop, forward to weight the front, across into a turn, his trunk held
// more upright than the bike he lays over. Off it he walks (`walking`). The
// same keys a body off its skis is laid with (`party-pose.ts`), so the
// figure hangs on it as on any move: the skis put away, nothing in his hands.
//
// THE FRAME is the root his figure is hung in while he rides: the bike's
// own attitude, its origin his centre of mass as the engine has it — so a
// grip is the bike's grip less where he stands on the frame.
//
// Three-free, so the suite reads it.

import { BIKE, BIKE_BB, type BikePose } from "@engine";

import { GRIPS, bracketFromRider, gripsAt, pedalsAt, type V3 } from "./bike-look.ts";
import { ANKLE, keyOf, keyPoints, movePose, type Key } from "./party-pose.ts";
import { ragdollPose, type BodyFrame } from "./skier-ragdoll.ts";
import type { SkierPose } from "./skier-pose.ts";

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3): V3 => v(a.x + b.x, a.y + b.y, a.z + b.z);

/** THE ATTACK STANCE's numbers: the hip joints' middle from his centre of
 * mass (down a little and back — his trunk bent forward over them), the
 * trunk's bend, the head's lift, and where the ankle stands off a pedal's
 * middle (the ball of the foot on the pedal, the heel dropped). */
export const ATTACK = {
  hips: v(0, -0.05, -0.13),
  pitch: 0.92,
  /** More bend as he folds for a pop, less hung off the back. */
  crouchPitch: 0.25,
  backPitch: 0.12,
  nod: -0.65,
  ankle: v(0, ANKLE + 0.012, -0.055),
  /** The share of the bike's lean his trunk does not follow: riders lay
   * the bike over under a body held nearer upright. */
  upright: 0.45,
  /** How far his hips bob with the pedal strokes, m. */
  bob: 0.012,
  /** How far his heels drop on the brakes, m. */
  brace: 0.018,
};

/** THE KEY that lays him on the bike posed `pose`, in the root's frame. */
export function riderKey(pose: BikePose): Key {
  const bb = bracketFromRider(pose);
  const [g0, g1] = gripsAt(pose.steer);
  const [p0, p1] = pedalsAt(pose.crank);
  const hips = ATTACK.hips;
  const back = Math.max(0, pose.shift);
  // Pedalling, his hips rise and fall twice a turn with the down stroke;
  // braking, his heels drop to brace against the pedals.
  const bob = pose.pedalling ? ATTACK.bob * Math.cos(2 * pose.crank) : 0;
  const brace = ATTACK.brace * Math.max(pose.front, pose.rear);
  const ankle = add(ATTACK.ankle, v(0, -brace, -brace * 0.5));
  return {
    hipX: hips.x,
    hipY: hips.y + bob,
    hipZ: hips.z,
    pitch:
      ATTACK.pitch +
      ATTACK.crouchPitch * pose.crouch +
      ATTACK.backPitch * back -
      0.1 * Math.max(0, -pose.shift),
    roll: -pose.roll * ATTACK.upright,
    twist: -pose.steer * 0.3,
    nod: ATTACK.nod - 0.2 * pose.crouch,
    feet: [add(add(bb, p0), ankle), add(add(bb, p1), ankle)],
    hands: [add(bb, g0), add(bb, g1)],
  };
}

/** THE RIDER ON THE BIKE as a stood pose (`SkisModel.setStood`): the root's
 * frame is his own centre of mass on the bike's attitude, so the snow under
 * him is never read. */
export function riderPose(pose: BikePose): (ground: number, frame: BodyFrame) => SkierPose {
  const points = keyPoints(riderKey(pose), 0);
  return (_ground, frame) => ragdollPose(points, frame);
}

/** WHERE HIS NEAR HAND HOLDS THE BIKE HE PUSHES, in his own frame (x his
 * right, y up off the ground, z ahead), m: the bike's near grip, the bike
 * stood `BIKE.walk.push` from him with nobody on its springs — the bottom
 * bracket at its static 0.355 m, the grips `GRIPS` over it. */
export function pushGrip(): V3 {
  const P = BIKE.walk.push;
  const side = Math.sign(P.across) || -1;
  // The grip on his side of the bike: the bike's own −x when it stands to
  // his right, +x to his left.
  const grip = GRIPS[side < 0 ? 1 : 0];
  return v(P.across + grip.x, 0.355 + grip.y, P.ahead + grip.z + BIKE_BB.z);
}

/** OFF THE BIKE, WALKING beside it (`BikeState.afoot`): the walk of a body
 * off its skis, its stride paced to his; stood still, stood. PUSHING it,
 * his near hand is on its near grip (`pushGrip`) and his head turned a
 * little to it; the other arm swings with his stride. */
export function walkingPose(walk: {
  walked: number;
  pace: number;
  push?: boolean;
}): (ground: number, frame: BodyFrame) => SkierPose {
  const pace = Math.min(1, Math.abs(walk.pace) / BIKE.walk.speed);
  // The stride's phase off the ground covered (a full stride ~1.6 m).
  const t = walk.walked / 1.36;
  if (!walk.push) return (ground, frame) => movePose({ kind: "walk", t, pace }, ground, frame);
  const key = keyOf({ kind: "walk", t, pace });
  const near = BIKE.walk.push.across < 0 ? 0 : 1;
  key.hands[near] = pushGrip();
  key.twist += 0.12 * Math.sign(BIKE.walk.push.across);
  key.pitch += 0.06;
  return (ground, frame) => ragdollPose(keyPoints(key, ground), frame);
}
