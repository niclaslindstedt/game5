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
//     limb's line from where they were toward where the pose bends them on
//     a critically damped spring of their own (`LIMB_EASE.swing`, rad/s),
//     never faster than `LIMB_EASE.turn` rad/s — a bend that flips is drawn
//     swinging round instead, and the swing gathers and settles rather than
//     starting and stopping dead at the cap (a stalefish's elbow, thrown
//     round behind his leg, jolted at both ends of a capped swing).
//
// The feet, the hips and the trunk are the pose's own. Three-free, so the
// model (`board-model.ts`) and the motion lab (`make board-motion`) ease
// alike.

import type { SkierPose } from "./skier-pose.ts";
import { add, dot, len, norm, scale, sub, type V3 } from "./skier-vec.ts";

/** The hands' spring (rad/s, critically damped) and the most an elbow or a
 * knee comes round its limb's line (rad/s); a frame longer than `gap` s
 * (a pause, a cut) starts afresh. */
export const LIMB_EASE = { hands: 40, swing: 30, turn: 5, hips: 30, gap: 0.1 };

/** What is carried from frame to frame. */
export type LimbEase = {
  hands: [V3, V3] | null;
  speed: [V3, V3];
  elbows: [V3, V3] | null;
  knees: [V3, V3] | null;
  /** The elbows' and the knees' swing round their lines, rad/s (the
   * spring's own speed, closing negative). */
  swings: [number, number, number, number];
  /** The hips as drawn and their speed, m and m/s. */
  hips: V3 | null;
  hipSpeed: V3;
};

const ZERO: V3 = { x: 0, y: 0, z: 0 };

export function createLimbEase(): LimbEase {
  return {
    hands: null,
    speed: [ZERO, ZERO],
    elbows: null,
    knees: null,
    swings: [0, 0, 0, 0],
    hips: null,
    hipSpeed: ZERO,
  };
}

/** Forget the last frame: the next is taken as it is. */
export function resetLimbEase(e: LimbEase): void {
  e.hands = null;
  e.elbows = null;
  e.knees = null;
  e.speed = [ZERO, ZERO];
  e.swings = [0, 0, 0, 0];
  e.hips = null;
  e.hipSpeed = ZERO;
}

/** `v` with its part along `u` (a unit vector) taken out. */
const off = (v: V3, u: V3): V3 => sub(v, scale(u, dot(v, u)));
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** The middle joint of a limb from `root` to `end` (its bones `a` and `b`
 * long), bent toward `want`'s side of the line between them but turned no
 * more than `most` rad from `was`'s, the swing on the spring `swings[k]`
 * carries over `dt` s. */
function bend(
  root: V3,
  end: V3,
  a: number,
  b: number,
  want: V3,
  was: V3,
  most: number,
  swings: number[],
  k: number,
  dt: number,
): V3 {
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
    // The gap left after the spring's step: never past the pose, never
    // turned more than `most`.
    const rate = LIMB_EASE.swing;
    const decay = Math.exp(-rate * dt);
    const c = swings[k] + angle * rate;
    const left = clamp((angle + c * dt) * decay, Math.max(0, angle - most), angle);
    swings[k] = (swings[k] - c * rate * dt) * decay;
    const turned = angle - left;
    if (turned >= angle - 1e-9) {
      dir = to;
      swings[k] = 0;
    } else {
      // Turned that far from `from` toward `to` in their plane (round the
      // pose's side, `to`'s, when they are opposite).
      let side = sub(to, scale(from, dot(to, from)));
      if (len(side) < 1e-6) side = off(norm(sub(want, end)), u);
      side = len(side) < 1e-6 ? to : norm(side);
      dir = add(scale(from, Math.cos(turned)), scale(side, Math.sin(turned)));
    }
  }
  return add(add(root, scale(u, along)), scale(dir, up));
}

/** THE HIPS, and all he carries over them, on a critically damped spring
 * (`LIMB_EASE.hips`, rad/s): the pose stands his hips by limits met in a
 * frame — the shins never flatter than the boot lets them, the boot's
 * reach over the deck — and a landing's fold run into one stopped them
 * dead and threw them back. The trunk, the head and the shoulders are
 * moved with the hips — the hands left on their targets, so a grab keeps
 * its hold on the board — and the knees and elbows are bent after. */
function carryHips(e: LimbEase, pose: SkierPose, dt: number): SkierPose {
  const rate = LIMB_EASE.hips;
  const x = e.hips!.y - pose.hips.y;
  const v = e.hipSpeed.y;
  const k = Math.exp(-rate * dt);
  const c = v + x * rate;
  e.hipSpeed = { x: 0, y: (v - c * rate * dt) * k, z: 0 };
  // ...never left so far above him that a leg would not reach its foot:
  // the lag above the pose eased into the legs' slack (a hard stop there
  // pinned his hips at the straight leg and swung the knee round).
  let lag = (x + c * dt) * k;
  if (lag > 0) {
    let room = Infinity;
    for (let i = 0; i < 2; i++) {
      const leg =
        len(sub(pose.knees[i], pose.hipJoints[i])) + len(sub(pose.feet[i], pose.knees[i]));
      room = Math.min(room, leg * 0.99 - len(sub(pose.hipJoints[i], pose.feet[i])));
    }
    lag = room > 1e-4 ? room * Math.tanh(lag / room) : 0;
  }
  const d = { x: 0, y: lag, z: 0 };
  e.hips = add(pose.hips, d);
  const by = (p: V3): V3 => add(p, d);
  const two = (p: readonly [V3, V3]): [V3, V3] => [by(p[0]), by(p[1])];
  return {
    ...pose,
    hips: e.hips,
    hipJoints: two(pose.hipJoints),
    waist: by(pose.waist),
    neck: by(pose.neck),
    head: by(pose.head),
    shoulders: two(pose.shoulders),
    elbows: two(pose.elbows),
  };
}

/** `pose` with its hands, elbows and knees eased from the last frame's, `dt`
 * s on; `e` carries this frame on. */
export function easeLimbs(e: LimbEase, given: SkierPose, dt: number): SkierPose {
  if (!(dt > 0) || dt > LIMB_EASE.gap || !e.hands || !e.elbows || !e.knees || !e.hips) {
    const pose = given;
    e.hips = pose.hips;
    e.hipSpeed = ZERO;
    e.hands = [pose.hands[0], pose.hands[1]];
    e.swings = [0, 0, 0, 0];
    e.speed = [ZERO, ZERO];
    e.elbows = [pose.elbows[0], pose.elbows[1]];
    e.knees = [pose.knees[0], pose.knees[1]];
    return pose;
  }
  const pose = carryHips(e, given, dt);
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
    const upper = len(sub(given.elbows[i], given.shoulders[i]));
    const fore = len(sub(given.hands[i], given.elbows[i]));
    const reach = sub(hands[i], pose.shoulders[i]);
    if (len(reach) > (upper + fore) * 0.999)
      hands[i] = add(pose.shoulders[i], scale(norm(reach), (upper + fore) * 0.999));
    elbows[i] = bend(
      pose.shoulders[i],
      hands[i],
      upper,
      fore,
      pose.elbows[i],
      e.elbows[i],
      most,
      e.swings,
      i,
      dt,
    );
    const thigh = len(sub(given.knees[i], given.hipJoints[i]));
    const shin = len(sub(given.feet[i], given.knees[i]));
    knees[i] = bend(
      pose.hipJoints[i],
      pose.feet[i],
      thigh,
      shin,
      pose.knees[i],
      e.knees[i],
      most,
      e.swings,
      2 + i,
      dt,
    );
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

/** A share followed on a critically damped spring of `rate` rad/s: `was`
 * (null afresh) stepped `dt` s toward `want`. */
export type Follow = { at: number; speed: number };
export function follow(was: Follow | null, want: number, rate: number, dt: number): Follow {
  if (!was || !(dt > 0) || dt > LIMB_EASE.gap) return { at: want, speed: 0 };
  const x = was.at - want;
  const k = Math.exp(-rate * dt);
  const c = was.speed + x * rate;
  return { at: want + (x + c * dt) * k, speed: (was.speed - c * rate * dt) * k };
}

/** THE LOOP'S TUCK AS DRAWN, rad/s: a loop's tuck (`skier-somersault.ts`)
 * ramps up and straight back down — and a spin levelled for its landing
 * reads as the start of one that never comes — so drawn straight the knees
 * and boots were thrown up and turned back in a frame at its peak. */
export const TUCK_EASE = 18;
const READINGS = ["carve", "crouch", "load", "lean", "press", "pop", "windup", "air"] as const;
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
  for (const id of READINGS) {
    const rate = READING_EASE;
    const k = Math.exp(-rate * dt);
    const want = input[id];
    const was = e.at[id];
    if (want === undefined || was === undefined || fresh) {
      e.at[id] = want;
      e.speed[id] = 0;
      continue;
    }
    const x = was - want;
    const v = e.speed[id] ?? 0;
    const c = v + x * rate;
    e.at[id] = want + (x + c * dt) * k;
    e.speed[id] = (v - c * rate * dt) * k;
    input[id] = e.at[id];
  }
}

/** THE DECK CARRIED: the feet's lift his hips are drawn carried up to, on a
 * critically damped spring (`CARRY.rate`, rad/s) — a landing's deck come up
 * under him is taken up over a moment and let back down as the engine's
 * legs rebound, never followed down in a frame (a first-order lag snapped
 * down to the rebound stopped his hips dead at the bottom of every
 * landing). What is still owed is `sag`, taken in his knees (`sagOf`). */
export const CARRY = { rate: 9, deep: 0.15, high: 0.04 };

export type DeckCarry = { at: number; speed: number };

/** `carry` stepped `dt` s toward the feet's mean lift `mean`; null (or a
 * still rider, or a gap) takes `mean` as it is. */
export function carryDeck(
  carry: DeckCarry | null,
  mean: number,
  dt: number,
  still: boolean,
): DeckCarry {
  if (!carry || still || !(dt > 0) || dt > 0.1) return { at: mean, speed: 0 };
  const w = CARRY.rate;
  const x = carry.at - mean;
  const k = Math.exp(-w * dt);
  const c = carry.speed + x * w;
  return { at: mean + (x + c * dt) * k, speed: (carry.speed - c * w * dt) * k };
}

/** How far the knees take the deck still owed, m: up to `CARRY.deep` folded
 * in, a little of a deck dropped away left in the legs' reach — each a soft
 * limit, so the hips never stop dead on one. */
export function sagOf(sag: number): number {
  const room = sag >= 0 ? CARRY.deep : CARRY.high;
  return room * Math.tanh(sag / room);
}
