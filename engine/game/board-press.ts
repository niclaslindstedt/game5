// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SNOWBOARDER'S PRESSES AND BUTTERS — the board on the snow with the
// rider's weight over one end, its numbers and their sources in
// `defs/board-moves.ts` (`TUNING.board.press`). Nothing here touches a pair
// of skis: every function hands a skier back exactly what he had (a press
// of 0, a hold and a lock of 1, no pitch), so no ski run's digest can see
// it.
//
// THE PRESS (`BoardMoves.press`): the lean carried well over, at a crawl
// to a run's pace, on the snow and riding his board (not on a rail, a
// lift, a sideslip or one foot out), moves his weight over the NOSE (the
// lean forward) or the TAIL (back). The deck is pitched onto that end
// over the lean's own balance (`pressPitch`), so the legs at the far end
// unload and its stations lift off the snow; the edge is let flat
// (`pressFlat`) — a press is ridden on the base — and with one end on the
// snow the stations hold less across (`pressHold`).
//
// THE BUTTER: the steer held through a press twists the board round on
// the end left on the snow (`stepPress`) — the board yawed about the
// snow's normal, its middle carried round the pivot, and his way over the
// snow left as it was: the board turns under a body that goes on, as in a
// revert (`switch.ts`). While it turns the yaw hold lets the board off his
// line (`buttering`, read by `heldSlip`), so a butter carried past a
// quarter turn is held on round to ride fakie, and let go short of it
// comes back to ride on. A soft board butters quicker than a stiff one.

import { approach, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  fromAxisAngle,
  multiply,
  normalize,
  rotate,
  type Vec3,
} from "@niclaslindstedt/oss-game-framework/core/quat";
import { TUNING } from "./defs/tuning.ts";
import type { SkierState } from "./state.ts";

const P = TUNING.board.press;
const NOSE = { x: 0, y: 0, z: 1 };

/** How far a lean of `lean` (−1 forward … +1 back) presses at `speed`
 * m/s, −1 the nose … +1 the tail: smoothly from `from` of its throw to
 * `full`, whole under `slow` m/s and gone by `fast`. */
export function pressAsked(lean: number, speed: number): number {
  const t = clamp((Math.abs(lean) - P.from) / (P.full - P.from), 0, 1);
  const pace = 1 - clamp((speed - P.slow) / (P.fast - P.slow), 0, 1);
  return Math.sign(lean) * t * t * (3 - 2 * t) * pace;
}

/** Whether a rider may press this step: on a board, on the snow on his own
 * board — not thrown, carried, on a jib, stood across a slope on his edge,
 * a foot out, loading a jump, turning round or bogged. */
function pressReady(c: SkierState): boolean {
  return (
    c.board !== undefined &&
    !c.board.free &&
    !c.airborne &&
    c.thrown === null &&
    c.lift === null &&
    c.tunnel === null &&
    c.jib == null &&
    c.grind == null &&
    c.sidestep === 0 &&
    c.jumpLoad === 0 &&
    c.revert == null &&
    c.trench === 0
  );
}

/** THE BUTTER'S RATE, rad/s clockwise, for a press of `press` with the
 * steer `side` as pressed (positive to the right) on a board of `flex`. */
export function butterRate(press: number, side: number, flex: number): number {
  const turn = clamp((Math.abs(side) - P.dead) / (1 - P.dead), 0, 1);
  return Math.sign(side) * turn * Math.abs(press) * P.spin * (1 - P.stiff * flex);
}

/** ONE STEP OF THE PRESS AND THE BUTTER, about the snow's normal `n`. */
export function stepPress(c: SkierState, n: Vec3, dt: number): void {
  const m = c.board;
  if (!m) return;
  const want = pressReady(c) ? pressAsked(c.lean, c.speed) : 0;
  m.press = approach(m.press, want, P.rate * dt);
  if (Math.abs(m.press) < 0.02) {
    m.butter = 0;
    return;
  }
  if (!pressReady(c)) return;
  // The steer as pressed: riding fakie, `switchSteer` mirrors it.
  const side = c.switched ? -c.steer : c.steer;
  const yaw = butterRate(m.press, side, c.spec.flex) * dt;
  if (yaw === 0) return;
  const before = rotate(c.q, NOSE);
  c.q = normalize(multiply(fromAxisAngle(n.x, n.y, n.z, yaw), c.q));
  const after = rotate(c.q, NOSE);
  // ...about the pressed end: the nose's (a press forward) or the tail's.
  const end = -Math.sign(m.press) * P.end * c.spec.length;
  c.x += end * (before.x - after.x);
  c.z += end * (before.z - after.z);
  m.butter += yaw;
}

/** The deck's pitch a press asks on top of the lean's balance, rad, nose
 * up positive (a tail press); 0 on skis. */
export function pressPitch(c: SkierState): number {
  return c.board ? P.lift * c.board.press : 0;
}

/** The share of the edge's lock left him by a press (flat on its base); 1
 * on skis. */
export function pressFlat(c: SkierState): number {
  return c.board ? 1 - P.flat * Math.abs(c.board.press) : 1;
}

/** The share of the stations' hold across left by a press; 1 on skis. */
export function pressHold(c: SkierState): number {
  return c.board ? 1 - P.grip * Math.abs(c.board.press) : 1;
}

/** Whether the board is being buttered round — pressed with the steer past
 * its dead zone — when the yaw hold lets it off his line. */
export function buttering(c: SkierState): boolean {
  return (
    c.board !== undefined &&
    Math.abs(c.board.press) > 0.2 &&
    Math.abs(c.steer) > P.dead &&
    pressReady(c)
  );
}
