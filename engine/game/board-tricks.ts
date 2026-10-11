// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SNOWBOARDER'S TRICKS — what the score (`tricks.ts`) and the strokes
// (`strokes.ts`) call a board's: the same strokes turn him, the same purse
// pays him, and only the NAMES are the board's own. Nothing here moves a
// body or draws from a stream, and nothing is read on a pair of skis — a
// ski run's score, words and digest are what they were.
//
// THE GRABS (`boardGrabOf`): with the trick button held in the air the lean
// and the edge pick the hand and the place, as they pick a skier's daffy or
// spread — the lean FORWARD a front-hand grab, BACK a rear-hand one, the
// edge toward his TOES or his HEELS the edge it is on:
//
//                 heel        none        toe
//   forward       method      nose        mute
//   none          melon       indy        mute
//   back          stalefish   tail        indy
//
// — the INDY, the rear hand on the toe edge between the feet, the grab the
// sport teaches first, is what the button alone gives.
//
// THE SPIN'S SIDE (`spinSide`): FRONTSIDE when the turn opens his chest to
// the way he is going first, BACKSIDE when it turns his back to it — so a
// regular rider (left foot forward, facing the board's right) spins
// frontside ANTICLOCKWISE from above and a goofy one clockwise, and riding
// switch swaps the two for each of them, since he faces the other side of
// his travel. A spin taken off riding switch is a SWITCH spin; one popped
// off the nose rather than the tail is a NOLLIE one (`popOf`).

import { TUNING } from "./defs/tuning.ts";
import type { SkiSpec } from "./defs/skis.ts";
import type { BoardGrab, SpinTag } from "./board-state.ts";
import type { SkierInput, SkierState } from "./state.ts";

const T = TUNING.tricks;

/** How far the lean and the edge are carried to pick a grab — a skier's
 * grab is picked across the same half of each axis (`strokes.ts`). */
const PICK = 0.5;

/** Which way he faces off the board's nose: +1 its right (a regular
 * rider), −1 its left (a goofy one). */
function faceOf(spec: SkiSpec): number {
  return spec.board?.lead === "goofy" ? -1 : 1;
}

/** Which edge the steer `steer` (the input's, positive to the right of the
 * way he is going) points at: +1 his toes, −1 his heels, 0 neither. */
export function edgeOf(steer: number, spec: SkiSpec, switched: boolean): number {
  if (Math.abs(steer) < PICK) return 0;
  return Math.sign(steer) * faceOf(spec) * (switched ? -1 : 1);
}

/** THE GRAB the lean and the edge ask for on a board (the table above). */
export function boardGrabOf(input: SkierInput, spec: SkiSpec, switched: boolean): BoardGrab {
  const edge = edgeOf(input.steer, spec, switched);
  const fore = input.lean <= -PICK;
  const back = input.lean >= PICK;
  if (edge < 0) return fore ? "method" : back ? "stalefish" : "melon";
  if (edge > 0) return back ? "indy" : "mute";
  return fore ? "nose" : back ? "tail" : "indy";
}

/** FRONTSIDE or BACKSIDE for a spin of signed `yaw` rad (clockwise from
 * above positive) by a rider on `spec` who took off riding switch or not. */
export function spinSide(yaw: number, spec: SkiSpec, switched: boolean): "frontside" | "backside" {
  return yaw * faceOf(spec) * (switched ? -1 : 1) < 0 ? "frontside" : "backside";
}

/** The pop a lean of `lean` (−1 forward … +1 back) springs: off the nose
 * with it carried forward, off the tail otherwise. */
export function popOf(lean: number): "ollie" | "nollie" {
  return lean <= -PICK ? "nollie" : "ollie";
}

/** AS HE LEAVES THE SNOW (`tricks.ts`): the pop the flight left on, if it
 * was his own (`popWindow` s after the jump sprang). */
export function takeOff(c: SkierState): void {
  if (!c.board) return;
  c.board.pop = c.popped <= T.popWindow ? popOf(c.lean) : null;
}

/** WHAT A BOARD'S SPIN OR HALF TURN IS CALLED, for a flight that has
 * turned `yaw` rad and took off riding switch or not; nothing on skis. */
export function spinTag(c: SkierState, yaw: number, switched: boolean): SpinTag | undefined {
  if (!c.board) return undefined;
  const tag: SpinTag = { side: spinSide(yaw, c.spec, switched) };
  if (switched) tag.switched = true;
  else if (c.board.pop === "nollie") tag.nollie = true;
  return tag;
}
