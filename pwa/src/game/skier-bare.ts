// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER WITHOUT POLES — what his arms do with nothing in his hands
// (`SkierState.poles` off, the player's hard mode). `skier-pose.ts` asks;
// three-free, so the suite reads it (`tests/poleless_test.ts`).
//
// With no poles there is no double pole, no plant in the gate and no tap
// to time a turn on (the engine skates him at every speed it drives him,
// `poles.ts`), and the arms go back to what a body does with them:
//
//   * SKATING he swings them like a speed skater — the arm on the side of
//     the pushing leg driven back and out past the hip as the leg goes out,
//     the other swung forward and ACROSS his chest over the gliding ski,
//     one swing a stride, so the arms carry him from ski to ski;
//   * STRIDING (a walk, which is how he sets off on the flat as well as up
//     a rise) they swing opposite the legs as a man's do walking — the
//     stride's own stroke (`STRIDE_STROKE`), which needs no pole;
//   * RIDING he holds them OUT for his balance — wider of the hips, a
//     little higher and further ahead than a skier holding poles, the
//     outside hand forward over the outside ski in a turn and the inside
//     one out low toward the snow, reaching for the balance a pole plant
//     would have given him;
//   * IN THE START GATE, with no wand to lean on poles over, he crouches
//     with his fists ahead of his knees, ready to fall forward at GO.
//
// Each of these is an offset off the hand the stance would put there: the
// pose eases every fist inside the arm's reach afterwards (`easeFist`).

import type { V3 } from "./skier-vec.ts";

/** THE SPEED SKATER'S SWING: how far a fist goes forward of its stance at
 * the front of the swing and behind it at the back, m; how far the fist
 * swung forward crosses toward the other side, and the one swung back goes
 * out, m; and how far each rises at the ends of the swing, m — a fist
 * forward comes up to the chest, one back comes up behind the hip. */
const SKATER = { ahead: 0.25, behind: 0.75, across: 0.2, out: 0.1, rise: 0.12 };
/** THE ARMS OUT FOR BALANCE while he rides: how far wider of the hips, m,
 * how much higher, m, and how far ahead, m; in a turn (a full hang), the
 * outside fist further ahead and the inside one out and down toward the
 * snow, m. */
const BALANCE = { wide: 0.16, up: 0.05, ahead: 0.06 };
const TURN = { reach: 0.1, out: 0.08, down: 0.12 };
/** IN THE GATE: the fists down and in ahead of the knees, m. */
const GATE = { down: 0.18, ahead: 0.08, inward: 0.08 };

export type BareArms = {
  /** How much of him is skating, 0..1 (`Gait.skate`). */
  skate: number;
  /** Where in the stride he is, 0..1, and which leg is pushing (0 left). */
  phase: number;
  push: 0 | 1;
  /** How much his arms are free to hold out — not working a stride, not
   * folded into a tuck, not in the air — 0..1. */
  free: number;
  /** How far he hangs into a turn, −1..1, right positive. */
  hang: number;
  /** How settled into the start gate he is, 0..1. */
  ready: number;
};

/** THE SWING a skater's arm `i` (0 left) is at, −1 driven back … 1 swung
 * forward: one cycle over two strides, the arm on the pushing leg's side
 * going back through its push while the other comes forward. */
export function skaterSwing(i: 0 | 1, push: 0 | 1, phase: number): number {
  const u = (push + phase) / 2;
  const left = -Math.sin(2 * Math.PI * u);
  return i === 0 ? left : -left;
}

/** Each fist's offset off its stance, m, for a skier with no poles. */
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
        a.free * side * (BALANCE.wide + TURN.out * inside) -
        a.ready * side * GATE.inward,
      y:
        a.skate * SKATER.rise * (fwd + back) +
        a.free * (BALANCE.up - TURN.down * inside) -
        a.ready * GATE.down,
      z:
        a.skate * (SKATER.ahead * fwd - SKATER.behind * back) +
        a.free * (BALANCE.ahead + TURN.reach * outside) +
        a.ready * GATE.ahead,
    };
  }) as [V3, V3];
}
