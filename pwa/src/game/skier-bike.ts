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
import type { RideStyle } from "./bike-ride-style.ts";
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
  hips: v(0, -0.03, -0.11),
  pitch: 0.82,
  /** More bend as he folds for a pop, less hung off the back. */
  crouchPitch: 0.25,
  backPitch: 0.12,
  nod: -0.65,
  ankle: v(0, ANKLE + 0.012, -0.055),
  /** The share of the bike's lean his trunk does not follow: riders lay
   * the bike over under a body held nearer upright. */
  upright: 0.45,
};

/** THE KEY that lays him on the bike posed `pose`, in the root's frame. */
export function riderKey(pose: BikePose): Key {
  const bb = bracketFromRider(pose);
  const [g0, g1] = gripsAt(pose.steer);
  const [p0, p1] = pedalsAt(pose.crank);
  const hips = ATTACK.hips;
  const back = Math.max(0, pose.shift);
  return {
    hipX: hips.x,
    hipY: hips.y,
    hipZ: hips.z,
    pitch:
      ATTACK.pitch +
      ATTACK.crouchPitch * pose.crouch +
      ATTACK.backPitch * back -
      0.1 * Math.max(0, -pose.shift),
    roll: -pose.roll * ATTACK.upright,
    twist: -pose.steer * 0.3,
    nod: ATTACK.nod - 0.2 * pose.crouch,
    feet: [add(add(bb, p0), ATTACK.ankle), add(add(bb, p1), ATTACK.ankle)],
    hands: [add(bb, g0), add(bb, g1)],
  };
}

/** A point of the bike turned under him by the style's `yaw` then `roll`
 * (`bike-ride-style.ts`) about his centre of mass — the root's origin. */
export function underHim(p: V3, yaw: number, roll: number): V3 {
  // Rolled about the bike's forward axis (−y toward +x), then yawed about
  // its up axis (+z toward +x).
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const x1 = p.x * cr - p.y * sr;
  const y1 = p.x * sr + p.y * cr;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  return v(x1 * cy + p.z * sy, y1, -x1 * sy + p.z * cy);
}

/** THE FREERIDER'S STANCE (`bike-variant.ts`'s freeride look): the attack
 * stance ridden wider and lower — the knees and the elbows OUT, the hips
 * back and down over the saddle, the chest over the stem and the eyes up
 * the trail. */
export const FREERIDE = {
  kneesOut: 0.55,
  elbowsOut: 0.6,
  hips: v(0, -0.035, -0.08),
  pitch: 0.1,
  nod: 0.12,
  /** Under the levers: his weight further back and down. */
  brake: { back: 0.07, down: 0.04, pitch: -0.08 },
  /** How much of the bike's whip his hips follow (his shoulders and eyes
   * stay down the trail), and how far his knees draw up in a table. */
  follow: { twist: 0.35, roll: 0.3 },
  tuck: 0.12,
  /** His inside foot out of a slide, from the bottom bracket in the
   * bike's frame: out to the side, low over the dirt and ahead of the
   * cranks, the sole skimming it. */
  foot: v(0.5, -0.2, 0.45),
};

/** THE KEY that lays the FREERIDER on the bike posed `pose`, riding it as
 * `style` says: whipped, tabled, a foot out, on the brakes. */
export function freerideKey(pose: BikePose, style: RideStyle): Key {
  const key = riderKey(pose);
  const F = FREERIDE;
  const bb = bracketFromRider(pose);
  key.kneesOut = F.kneesOut;
  key.elbowsOut = F.elbowsOut;
  key.hipY = F.hips.y - F.brake.down * style.brake;
  key.hipZ = F.hips.z - F.brake.back * style.brake;
  key.pitch += F.pitch + F.brake.pitch * style.brake;
  key.nod += F.nod;
  // THE WHIP: the bike under him turned, his hands and feet with it, his
  // hips following a share of it and his shoulders kept square.
  const { yaw, roll } = style;
  if (yaw !== 0 || roll !== 0) {
    key.hands = [underHim(key.hands[0], yaw, roll), underHim(key.hands[1], yaw, roll)];
    key.feet = [underHim(key.feet[0], yaw, roll), underHim(key.feet[1], yaw, roll)];
    key.twist += yaw * F.follow.twist;
    key.roll += roll * F.follow.roll;
    if (style.trick === "table") key.hipY -= F.tuck * style.amount;
  }
  // THE FOOT OUT: the inside foot off its pedal toward the dirt.
  if (style.footOut > 0) {
    const i = style.foot;
    const side = i ? 1 : -1;
    const out = add(bb, v(side * F.foot.x, F.foot.y, F.foot.z));
    const k = style.footOut;
    const f = key.feet[i];
    key.feet[i] = v(f.x + (out.x - f.x) * k, f.y + (out.y - f.y) * k, f.z + (out.z - f.z) * k);
    // His weight onto the outside foot, the trunk dropped over it.
    key.hipY -= 0.03 * k;
    key.roll += side * 0.12 * k;
  }
  return key;
}

/** THE RIDER ON THE BIKE as a stood pose (`SkisModel.setStood`): the root's
 * frame is his own centre of mass on the bike's attitude, so the snow under
 * him is never read. With a `style`, the freerider (`freerideKey`). */
export function riderPose(
  pose: BikePose,
  style?: RideStyle,
): (ground: number, frame: BodyFrame) => SkierPose {
  const points = riderPoints(pose, style);
  return (_ground, frame) => ragdollPose(points, frame);
}

/** THE RIDER'S JOINTS on the bike posed `pose` (the ragdoll's thirteen
 * points, `RAGDOLL`'s order, in the root's frame — the bike's attitude about
 * his centre of mass): what `riderPose` hangs the figure on, and what the
 * bike motion lab (`make bike-motion`) measures against the grips and the
 * pedals. */
export function riderPoints(pose: BikePose, style?: RideStyle): number[] {
  return keyPoints(style ? freerideKey(pose, style) : riderKey(pose), 0);
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
