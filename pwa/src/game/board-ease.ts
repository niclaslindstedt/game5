// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARDER'S LIMBS EASED BETWEEN FRAMES. `boardPose` is a pure
// function of one frame's readings, and a few of its answers can move
// faster than a body does: a hand's target thrown across by a grab caught
// or let go, an elbow or a knee whose bend is decided by a pole that swings
// past the limb's own line and flips it to the other side in a frame. This
// carries the last frame's limbs and eases each toward the new pose:
//
//   * THE HANDS follow their targets on a critically damped spring
//     (`LIMB_EASE.hands`, rad/s) — a few hundredths of a second behind,
//     never jumping;
//   * THE ELBOWS AND KNEES keep their bone lengths and come round their
//     limb's line from where they were toward where the pose bends them,
//     no faster than `LIMB_EASE.turn` rad/s — a bend that flips is drawn
//     swinging round instead.
//
// The feet, the hips and the trunk are the pose's own. Three-free, so the
// model (`board-model.ts`) and the motion lab (`make board-motion`) ease
// alike.

import type { SkierPose } from "./skier-pose.ts";
import { add, dot, len, norm, scale, sub, type V3 } from "./skier-vec.ts";

/** The hands' spring (rad/s, critically damped) and the most an elbow or a
 * knee comes round its limb's line (rad/s); a frame longer than `gap` s
 * (a pause, a cut) starts afresh. */
export const LIMB_EASE = { hands: 40, turn: 14, gap: 0.1 };

/** What is carried from frame to frame. */
export type LimbEase = {
  hands: [V3, V3] | null;
  speed: [V3, V3];
  elbows: [V3, V3] | null;
  knees: [V3, V3] | null;
};

const ZERO: V3 = { x: 0, y: 0, z: 0 };

export function createLimbEase(): LimbEase {
  return { hands: null, speed: [ZERO, ZERO], elbows: null, knees: null };
}

/** Forget the last frame: the next is taken as it is. */
export function resetLimbEase(e: LimbEase): void {
  e.hands = null;
  e.elbows = null;
  e.knees = null;
  e.speed = [ZERO, ZERO];
}

/** `v` with its part along `u` (a unit vector) taken out. */
const off = (v: V3, u: V3): V3 => sub(v, scale(u, dot(v, u)));

/** The middle joint of a limb from `root` to `end` (its bones `a` and `b`
 * long), bent toward `want`'s side of the line between them but turned no
 * more than `most` rad from `was`'s. */
function bend(root: V3, end: V3, a: number, b: number, want: V3, was: V3, most: number): V3 {
  const span = sub(end, root);
  const d0 = len(span);
  if (d0 < 1e-6) return want;
  const u = scale(span, 1 / d0);
  const d = Math.min(Math.max(d0, Math.abs(a - b) + 1e-4), a + b - 1e-4);
  const along = (a * a - b * b + d * d) / (2 * d);
  const up = Math.sqrt(Math.max(0, a * a - along * along));
  const w = off(sub(want, root), u);
  const p = off(sub(was, root), u);
  let dir: V3;
  if (len(w) < 1e-6) dir = len(p) < 1e-6 ? ZERO : norm(p);
  else if (len(p) < 1e-6) dir = norm(w);
  else {
    const from = norm(p);
    const to = norm(w);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot(from, to))));
    if (angle <= most) dir = to;
    else {
      // Turned `most` from `from` toward `to` in their plane (round the
      // pose's side, `to`'s, when they are opposite).
      let side = sub(to, scale(from, dot(to, from)));
      if (len(side) < 1e-6) side = off(norm(sub(want, end)), u);
      side = len(side) < 1e-6 ? to : norm(side);
      dir = add(scale(from, Math.cos(most)), scale(side, Math.sin(most)));
    }
  }
  return add(add(root, scale(u, along)), scale(dir, up));
}

/** `pose` with its hands, elbows and knees eased from the last frame's, `dt`
 * s on; `e` carries this frame on. */
export function easeLimbs(e: LimbEase, pose: SkierPose, dt: number): SkierPose {
  if (!(dt > 0) || dt > LIMB_EASE.gap || !e.hands || !e.elbows || !e.knees) {
    e.hands = [pose.hands[0], pose.hands[1]];
    e.speed = [ZERO, ZERO];
    e.elbows = [pose.elbows[0], pose.elbows[1]];
    e.knees = [pose.knees[0], pose.knees[1]];
    return pose;
  }
  const w = LIMB_EASE.hands;
  const most = LIMB_EASE.turn * dt;
  const hands: [V3, V3] = [ZERO, ZERO];
  const elbows: [V3, V3] = [ZERO, ZERO];
  const knees: [V3, V3] = [ZERO, ZERO];
  for (let i = 0; i < 2; i++) {
    // The hand on its spring: the exact step of a critically damped one.
    const x = sub(e.hands[i], pose.hands[i]);
    const v = e.speed[i];
    const k = Math.exp(-w * dt);
    const c = add(v, scale(x, w));
    hands[i] = add(pose.hands[i], scale(add(x, scale(c, dt)), k));
    e.speed[i] = scale(sub(v, scale(c, w * dt)), k);
    // Kept inside the arm's reach.
    const upper = len(sub(pose.elbows[i], pose.shoulders[i]));
    const fore = len(sub(pose.hands[i], pose.elbows[i]));
    const reach = sub(hands[i], pose.shoulders[i]);
    if (len(reach) > (upper + fore) * 0.999)
      hands[i] = add(pose.shoulders[i], scale(norm(reach), (upper + fore) * 0.999));
    elbows[i] = bend(pose.shoulders[i], hands[i], upper, fore, pose.elbows[i], e.elbows[i], most);
    const thigh = len(sub(pose.knees[i], pose.hipJoints[i]));
    const shin = len(sub(pose.feet[i], pose.knees[i]));
    knees[i] = bend(pose.hipJoints[i], pose.feet[i], thigh, shin, pose.knees[i], e.knees[i], most);
  }
  e.hands = hands;
  e.elbows = elbows;
  e.knees = knees;
  return { ...pose, hands, elbows, knees };
}

/** THE READINGS THE POSE IS SHAPED BY, eased the same way: the engine ramps
 * a carve cut hard, a tuck, a press or a load on a straight line, and a
 * pose laid straight off a ramp turns its corners in a frame (the trunk
 * thrown forward at the ramp's start, stopped dead at its end). Each is
 * followed on a critically damped spring (`READING_EASE`, rad/s) — a few
 * hundredths of a second behind, its corners rounded. */
export const READING_EASE = 30;
const READINGS = ["carve", "crouch", "load", "lean", "press", "pop", "windup"] as const;
type Reading = (typeof READINGS)[number];
export type ReadingEase = {
  at: Partial<Record<Reading, number>>;
  speed: Partial<Record<Reading, number>>;
};

export function createReadingEase(): ReadingEase {
  return { at: {}, speed: {} };
}

/** `input`'s readings eased in place from the last frame's, `dt` s on. */
export function easeReadings(
  e: ReadingEase,
  input: Partial<Record<Reading, number>>,
  dt: number,
): void {
  const fresh = !(dt > 0) || dt > LIMB_EASE.gap;
  const k = Math.exp(-READING_EASE * dt);
  for (const id of READINGS) {
    const want = input[id];
    const was = e.at[id];
    if (want === undefined || was === undefined || fresh) {
      e.at[id] = want;
      e.speed[id] = 0;
      continue;
    }
    const x = was - want;
    const v = e.speed[id] ?? 0;
    const c = v + x * READING_EASE;
    e.at[id] = want + (x + c * dt) * k;
    e.speed[id] = (v - c * READING_EASE * dt) * k;
    input[id] = e.at[id];
  }
}
