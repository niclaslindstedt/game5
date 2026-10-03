// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER WITHOUT POLES — what his arms do with nothing in his hands
// (`SkierState.poles` off, the player's hard mode). `skier-pose.ts` asks;
// three-free, so the suite reads it (`tests/poleless_test.ts`).
//
// A skier holding poles carries his fists ahead of him at the grips, the
// forearms level, the poles hanging back — and a figure posed there with
// nothing in its hands reads as a man holding poles nobody drew. So with no
// poles the hands are placed for what a body does with empty hands, from
// the stance up (`bareRest`), never off the pole stance:
//
//   * STOOD STILL his arms HANG at his sides, the hands by his thighs;
//   * IN THE START GATE, with no wand to lean on poles over, he crouches
//     with his HANDS ON HIS KNEES (`onKnee`), ready to fall forward at GO;
//   * RIDING he holds them OUT for his balance — low and wide of the hips,
//     only a little ahead of him, the elbows soft — and in a turn the
//     outside hand goes forward over the outside ski while the inside one
//     reaches out and down toward the snow (`bareHands`);
//   * SKATING he swings them like a speed skater — the arm on the side of
//     the pushing leg driven back and out past the hip as the leg goes out,
//     the other swung forward and ACROSS his chest over the gliding ski,
//     one swing a stride, so the arms carry him from ski to ski;
//   * STRIDING (a walk, which is how he sets off on the flat as well as up
//     a rise) they swing opposite the legs as a man's do walking — the
//     stride's own stroke (`STRIDE_STROKE`) off the hanging hand;
//   * in a TUCK his hands come together ahead of his face as any racer's.
//
// No plant is posed anywhere, and every fist is eased inside the arm's
// reach afterwards (`easeFist`).

import type { V3 } from "./skier-vec.ts";

/** WHERE AN EMPTY HAND RESTS, m, off the pole stance's grip (`MOUNTS.hand`,
 * x outward): RIDING, out and down to the hips' height and drawn back
 * nearer the body — the arms held wide for the balance; STILL, hung at
 * his side by the thigh. */
const RIDE = { out: 0.2, down: 0.08, back: 0.16 };
const HANG = { out: -0.08, down: 0.34, back: 0.32 };
/** THE SPEED SKATER'S SWING: how far a fist goes forward of its rest at
 * the front of the swing and behind it at the back, m; how far the fist
 * swung forward crosses toward the other side, and the one swung back goes
 * out, m; and how far each rises at the ends of the swing, m — a fist
 * forward comes up to the chest, one back comes up behind the hip. */
const SKATER = { ahead: 0.32, behind: 0.62, across: 0.22, out: 0.08, rise: 0.16 };
/** In a turn (a full hang): the outside fist further ahead, and the inside
 * one out and down toward the snow, m. */
const TURN = { reach: 0.12, out: 0.1, down: 0.16 };
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

export type BareArms = {
  /** How much of him is skating, 0..1 (`Gait.skate`). */
  skate: number;
  /** Where in the stride he is, 0..1, and which leg is pushing (0 left). */
  phase: number;
  push: 0 | 1;
  /** How much his arms are free to answer a turn — not working a stride,
   * not folded into a tuck, not in the air — 0..1. */
  free: number;
  /** How far he hangs into a turn, −1..1, right positive. */
  hang: number;
};

/** THE SWING a skater's arm `i` (0 left) is at, −1 driven back … 1 swung
 * forward: one cycle over two strides, the arm on the pushing leg's side
 * going back through its push while the other comes forward. */
export function skaterSwing(i: 0 | 1, push: 0 | 1, phase: number): number {
  const u = (push + phase) / 2;
  const left = -Math.sin(2 * Math.PI * u);
  return i === 0 ? left : -left;
}

/** Each empty fist's offset off its rest, m: the skater's swing and the
 * turn's reach. */
export function bareHands(a: BareArms): [V3, V3] {
  return [0, 1].map((i) => {
    const side = i === 0 ? -1 : 1;
    const swing = skaterSwing(i as 0 | 1, a.push, a.phase);
    const fwd = Math.max(0, swing);
    const back = Math.max(0, -swing);
    const turn = Math.abs(a.hang);
    const inside = side * a.hang > 0 ? turn : 0;
    const outside = side * a.hang < 0 ? turn : 0;
    return {
      x:
        a.skate * side * (SKATER.out * back - SKATER.across * fwd) +
        a.free * side * TURN.out * inside,
      y: a.skate * SKATER.rise * (fwd + back) - a.free * TURN.down * inside,
      z: a.skate * (SKATER.ahead * fwd - SKATER.behind * back) + a.free * TURN.reach * outside,
    };
  }) as [V3, V3];
}
