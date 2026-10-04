// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INCLINATION — how far the skier lays himself into a turn, and how
// the edge he stands on follows it (`skier.ts` sums the forces; this is the
// lean they are held toward).
//
//   * THE TURN'S BALANCE (`SkierState.balance`): the lean at which the
//     snow's reaction under his skis — its grip across them over its push
//     along its normal — passes through his centre of mass, tan θ = a_lat / g
//     on the level, the way a bicycle leans: read off the turn he is
//     actually making, eased over `skier.balanceLag`. A skier on a traverse
//     leans into the hill by the slope's share; one in a hockey stop leans
//     back against the stop.
//   * HE COMMITS TO THE TURN HIS EDGE ASKS FOR: `skier.commit` of the way
//     on toward the balance of the bend the edge he is going for asks
//     (atan(v²κ / g), never more than the grip holds) — the cross-over that
//     has his body on its way into the new turn as the skis bite — but never
//     off a turn whose load is still on him (`skier.crossLoad`).
//   * THE EDGE IS THE INCLINATION AND THE ANGULATION: a ski stands on its
//     edge no further than the body is laid over to that side plus what the
//     ankles, knees and hips angulate (`skier.angulateMost`).
//
// The roll is held toward that lean by `skier.rollStiff` / `.rollDamp`,
// never past `.rollMax` × the arcade's `hangOff`, whole to a little past
// the most he inclines and giving out after it.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { TUNING } from "./defs/tuning.ts";
import type { Technique } from "./defs/technique.ts";
import type { SkiSpec } from "./defs/skis.ts";
import { carveCurvature, carveMost, cornerGrip } from "./limits.ts";
import type { SkierState } from "./state.ts";

/** THE ROLL HELD is whole up to the most he inclines plus `HOLD_PAST` rad
 * (never under `HOLD_FULL` rad, 52°), then gives out over 0.4 rad. */
const HOLD_FULL = 0.9;
const HOLD_PAST = 0.05;

/** The edge `goal` rad the skis may stand on now: no further than the body
 * is laid over to that side plus his angulation's reach — so a skier rolls
 * his skis over as he lays himself into the turn, and an edge never bites at
 * a racer's 70° under a body still stood up (a 3 g bite against an upright
 * body is a high-side). On the groomer: in powder the roll is the whole of
 * the turn. */
export function edgeWithin(c: SkierState, goal: number): number {
  const reach =
    TUNING.skier.angulateMost + Math.max(0, c.incline * Math.sign(goal)) + (1 - c.packed) * Math.PI;
  return Math.sign(goal) * Math.min(Math.abs(goal), reach);
}

/** THE TURN'S BALANCE eased toward the snow's grip across his skis
 * (`lateral`, N, right positive) over its push along its normal (`load`,
 * N) — read only while he stands on the snow. */
export function easeBalance(c: SkierState, lateral: number, load: number, dt: number): void {
  if (load <= 0) return;
  c.balance += (Math.atan2(lateral, load) - c.balance) * Math.min(1, dt / TUNING.skier.balanceLag);
}

/** The most he inclines into a carve skiing `T`, rad. */
export function leanMostOf(T: Technique): number {
  return Math.max(TUNING.skier.inclineMost, T.incline);
}

/** THE LEAN HIS ROLL IS HELD TOWARD, rad against the snow, right side down
 * positive: on the groomer the turn's balance, committed on toward the
 * bend the edge he is going for (`goal` rad) asks, no further than he
 * inclines; in powder the roll the edge asks for outright. */
export function inclineTarget(
  c: SkierState,
  spec: SkiSpec,
  T: Technique,
  speed: number,
  pressed: number,
  goal: number,
): number {
  const K = TUNING.skier;
  const packed = c.packed;
  const bent = Math.min(
    Math.abs(carveCurvature(spec, goal)) * (1 + TUNING.carve.tighten * c.carve),
    carveMost(spec, goal),
  );
  const asked =
    Math.atan2(
      Math.min(c.way * c.way * bent, cornerGrip(spec, packed, speed, goal, T) * pressed),
      TUNING.g,
    ) * Math.sign(goal);
  // Against the balance of the turn he is still making he crosses over
  // only as its load falls under `crossLoad`: leaning out of a 2 g turn
  // into the next before the edges have let it go is a skier thrown over
  // them.
  const opposed = asked * c.balance < 0;
  const commit =
    K.commit * (opposed ? clamp(1 - Math.abs(Math.tan(c.balance)) / K.crossLoad, 0, 1) : 1);
  const most = leanMostOf(T);
  const balance = c.balance + commit * (asked - c.balance);
  return clamp(balance, -most, most) * packed + c.steer * K.rollPowder * (1 - packed);
}

/** How much of his roll hold is left at `rollRel` rad against the snow,
 * 0..1: whole to a little past the most he inclines, giving out over the
 * 0.4 rad after it — a skier well over is going over and nothing holds
 * him. */
export function rollHeld(rollRel: number, T: Technique): number {
  const give = Math.max(HOLD_FULL, leanMostOf(T) + HOLD_PAST);
  return clamp((give + 0.4 - Math.abs(rollRel)) / 0.4, 0, 1);
}

/** THE ROLL HOLD's torque, N·m on the reference pair, toward `target`:
 * a technique that rolls from edge to edge faster (`Technique.edgeRate`)
 * lays his body over as much faster — his edge is his inclination and his
 * angulation — and none holds himself slacker than the free skier. */
export function rollHold(rollRel: number, target: number, wz: number, T: Technique): number {
  const K = TUNING.skier;
  const quick = Math.max(1, T.edgeRate);
  const most = quick * K.rollMax * TUNING.arcade.hangOff;
  return clamp(
    quick * K.rollStiff * (rollRel - target) - Math.sqrt(quick) * K.rollDamp * wz,
    -most,
    most,
  );
}
