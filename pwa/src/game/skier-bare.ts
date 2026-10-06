// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER WITHOUT POLES — what his arms do with nothing in his hands
// (`SkierState.poles` off, the player's hard mode). `skier-pose.ts` asks;
// three-free, so the suite reads it (`tests/poleless_test.ts`) and the
// poleless lab measures it (`make poleless`).
//
// After the coaching of the FREE SKATE (skating with no pole action — the
// cross-country coaches' fourth gear, and the drill every skater is
// taught on): "the arms swing alternately forward and down the track …
// opposite to the legs, as in the diagonal stride. With the left leg
// gliding, the right arm is extended forward, forearm over the gliding
// ski, while the left forearm is extended to the rear. The arms pass close
// to the body … bent at the elbows … smooth, with good rhythm … relaxed";
// and at speed, the other variation: the hands together in front, as in a
// tuck. An alpine skier riding without poles is taught the same carriage
// as with them — the hands forward, a little wider than the shoulders, in
// sight, the elbows soft — never flung out like wings.
//
//   * RIDING he holds them FORWARD, a little wider than his shoulders, low
//     and soft (`bareRest`), and in a turn the outside hand goes forward
//     over the outside ski while the inside one drops toward the snow
//     (`bareHands`);
//   * STOOD STILL his arms HANG at his sides, the hands by his thighs;
//   * IN THE START GATE, with no wand to lean on poles over, he crouches
//     with his HANDS ON HIS KNEES (`onKnee`), ready to fall forward at GO;
//   * SKATING his arms SWING FROM THE SHOULDERS, opposite the legs
//     (`skaterArm`): through each push the arm on the PUSHING leg's side
//     comes forward and across, its forearm over the gliding ski, while
//     the other goes back past the hip — one smooth swing a push, eased at
//     both ends and still through the glide, hung off the shoulders so it
//     rides the trunk's roll over the gliding ski rather than bobbing on
//     its own;
//   * STRIDING (a walk, which is how he sets off on the flat as well as up
//     a rise) they swing opposite the legs as a man's do walking — the
//     stride's own stroke (`STRIDE_STROKE`) off the riding hand;
//   * in a TUCK his hands come together ahead of his face as any racer's.
//
// No plant is posed anywhere, and every fist is eased inside the arm's
// reach afterwards (`easeFist`).

import type { Gait } from "./skier-gait.ts";
import { add, clamp01, mix, type V3 } from "./skier-vec.ts";

/** WHERE AN EMPTY HAND RESTS, m, off the pole stance's grip (`MOUNTS.hand`,
 * x outward): RIDING, where a skier's hands are carried with poles or
 * without — forward, a little wider than the shoulders — let a little
 * lower and nearer, the elbows soft; STILL, hung at his side by the thigh. */
const RIDE = { out: 0.02, down: 0.08, back: 0.1 };
const HANG = { out: -0.08, down: 0.34, back: 0.32 };
/** THE FREE SKATE'S ARM, off its shoulder, m (x outward, y up, z ahead):
 * where the fist is at the FRONT of the swing — ahead of the shoulder and
 * across it, the forearm over the gliding ski, about level with the
 * bottom of the ribs — passing the hip in the MIDDLE of it, the elbow bent
 * and the arm close to the body, and at the BACK — behind the hip, the
 * forearm extended to the rear. The fist runs a smooth curve through the
 * three (`skaterArm`), the elbow bent most as the fist passes the hip
 * so it barely dips there (the arms stay bent through the swing — a
 * straight-armed pendulum bobs up and down twice a stride), and never
 * further from the shoulder than a bent arm reaches. */
const SWING = {
  front: { x: -0.2, y: -0.3, z: 0.38 },
  middle: { x: 0.05, y: -0.41, z: 0.1 },
  back: { x: 0.08, y: -0.33, z: -0.45 },
};
/** THE SWING'S TIMING: the share of a stride it takes, from the push's
 * start — the arms go through as the leg drives, are at the ends of
 * their swing as the push ends and the weight is over the new ski (the
 * forward forearm over it), and hang there through the glide until the
 * next push swings them back. */
const SWING_SPAN = 0.6;
/** In a turn (a full hang): the outside fist further ahead, and the inside
 * one out and down toward the snow, m. */
const TURN = { reach: 0.12, out: 0.06, down: 0.16 };
/** IN THE GATE: the hand on its knee — a little outside it, on top and
 * forward of the kneecap, m. */
const KNEE = { out: 0.03, up: 0.05, ahead: 0.07 };

/** Where the empty hand on side `side` (−1 left) rests, off the pole
 * stance's `grip`, `still` 0 riding … 1 stood still. */
export function bareRest(grip: V3, side: number, still: number): V3 {
  const k = Math.max(0, Math.min(1, still));
  const out = RIDE.out + (HANG.out - RIDE.out) * k;
  const down = RIDE.down + (HANG.down - RIDE.down) * k;
  const back = RIDE.back + (HANG.back - RIDE.back) * k;
  return { x: side * (Math.abs(grip.x) + out), y: grip.y - down, z: grip.z - back };
}

/** THE HAND ON THE KNEE in the start gate, for the knee at `knee`. */
export function onKnee(knee: V3, side: number): V3 {
  return { x: knee.x + side * KNEE.out, y: knee.y + KNEE.up, z: knee.z + KNEE.ahead };
}

/** THE SWING a skater's arm `i` (0 left) is at, −1 back … 1 forward, `push`
 * the pushing leg (0 left) at `phase` 0..1 of its stride: the arm on the
 * pushing leg's side swung from the back to the front through the push,
 * the other from the front to the back — opposite the legs — eased at both
 * ends and held through the end of the glide. Each stride's swing starts
 * where the last one left the arm, so nothing jumps at a change of leg. */
export function skaterSwing(i: 0 | 1, push: 0 | 1, phase: number): number {
  const u = clamp01(phase / SWING_SPAN);
  const e = (1 - Math.cos(Math.PI * u)) / 2;
  return i === push ? 2 * e - 1 : 1 - 2 * e;
}

/** THE FREE SKATE'S FIST off its shoulder for a swing `s` (−1 back … 1
 * forward) on side `side` (−1 left): the curve through the back, the
 * middle and the front of `SWING`, smooth in `s`. */
export function skaterArm(s: number, side: number): V3 {
  const { front: f, middle: m, back: b } = SWING;
  const at = (k: "x" | "y" | "z"): number =>
    m[k] + (s * (f[k] - b[k])) / 2 + s * s * ((f[k] + b[k]) / 2 - m[k]);
  return { x: side * at("x"), y: at("y"), z: at("z") };
}

/** Each empty fist's offset off its riding rest for a turn, m: the outside
 * hand forward over the outside ski, the inside one out and down. `hang`
 * −1..1, right positive, `free` how much his arms answer it. */
export function bareHands(hang: number, free: number): [V3, V3] {
  return [0, 1].map((i) => {
    const side = i === 0 ? -1 : 1;
    const turn = Math.abs(hang);
    const inside = side * hang > 0 ? turn : 0;
    const outside = side * hang < 0 ? turn : 0;
    return {
      x: free * side * TURN.out * inside,
      y: -free * TURN.down * inside,
      z: free * TURN.reach * outside,
    };
  }) as [V3, V3];
}

/** THE EMPTY HANDS PLACED, in place, on the fists the stance put at their
 * rest (`bareRest`): the turn's reach on them; skating, each swung from
 * its `shoulders` (`skaterArm`); and in the start gate his hands on his
 * knees. `crouch`, `air` and `ready` are the pose's own 0..1, `hang` its
 * −1..1. */
export function placeBare(
  hands: V3[],
  knees: readonly V3[],
  shoulders: readonly V3[],
  p: { gait: Gait; crouch: number; air: number; ready: number; hang: number },
): void {
  // Folded low at speed, the free skate's other carriage: the hands
  // together in front, as in the tuck, the swing gone.
  const skate = p.gait.skate * (1 - p.crouch) * (1 - p.air);
  const free = (1 - clamp01(skate + p.gait.stride)) * (1 - p.crouch) * (1 - p.air) * (1 - p.ready);
  const turn = bareHands(p.hang, free);
  for (const i of [0, 1] as const) {
    const side = i ? 1 : -1;
    const swung = add(shoulders[i], skaterArm(skaterSwing(i, p.gait.push, p.gait.phase), side));
    const held = mix(add(hands[i], turn[i]), swung, skate);
    hands[i] = mix(held, onKnee(knees[i], side), p.ready);
  }
}
