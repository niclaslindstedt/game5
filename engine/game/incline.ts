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
//     ankles, knees and hips angulate (`skier.angulateMost`) — unless his
//     technique CROSSES UNDER (`Technique.cross`): his legs tip the skis
//     onto the new edge under a body still coming over, and draw them up
//     under him as they swing across.
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
import { snowNormal } from "./snow-normal.ts";
import type { Level } from "../mapgen/types.ts";

/** THE ROLL HELD is whole up to the most he inclines plus `HOLD_PAST` rad
 * (never under `HOLD_FULL` rad, 52°), then gives out over 0.4 rad. */
const HOLD_FULL = 0.9;
const HOLD_PAST = 0.05;

/** HOW MUCH OF HIS CROSS-UNDER a technique `T` keeps on a pitch `fall`
 * rad steep, 0..1: the whole of it on any pitch where it names no
 * `Crossing.steep`, and past that pitch given up for a cross-over over the
 * next `STEEP_FADE` rad — a giant slalom racer crosses under on the flat
 * and over on a steep complete turn. */
const STEEP_FADE = 0.1;
export function crossUnderOf(T: Technique, fall: number): number {
  const steep = T.cross.steep;
  return steep > 0 ? clamp(1 - (fall - steep) / STEEP_FADE, 0, 1) : 1;
}

/** The edge `goal` rad the skis may stand on now, the body laid `lean`
 * rad over (right side down positive) on snow `packed` of the groomer, on
 * a pitch `fall` rad steep: no further than the body is laid over to that
 * side plus his angulation's reach — so a skier rolls his skis over as he
 * lays himself into the turn, and an edge never bites at a racer's 70°
 * under a body still stood up (a 3 g bite against an upright body is a
 * high-side) — unless his technique's legs stand them on the new edge
 * under him first (`Crossing.under`: the cross-under). On the groomer: in
 * powder the roll is the whole of the turn. The physics' rule
 * (`edgeWithin`) and the bot's model of it (`turn-model.ts`) both read it
 * here. */
export function edgeReach(
  lean: number,
  goal: number,
  packed: number,
  fall: number,
  T: Technique,
): number {
  const reach = Math.max(
    TUNING.skier.angulateMost + Math.max(0, lean * Math.sign(goal)),
    T.cross.under * crossUnderOf(T, fall),
  );
  return Math.sign(goal) * Math.min(Math.abs(goal), reach + (1 - packed) * Math.PI);
}

/** Scratch for `crossFall`: the snow's normal under him. */
const up = { x: 0, y: 1, z: 0 };

/** THE PITCH UNDER `c`, rad, where his technique `T` crosses under only on
 * the flat (`Crossing.steep`) — 0 where it never asks. */
export function crossFall(level: Level, c: SkierState, T: Technique): number {
  if (T.cross.steep <= 0) return 0;
  snowNormal(level, c, up);
  return Math.acos(clamp(up.y, -1, 1));
}

/** `edgeReach` for the skier `c` as he stands, on a pitch `fall` rad. */
export function edgeWithin(c: SkierState, goal: number, fall: number, T: Technique): number {
  return edgeReach(c.incline, goal, c.packed, fall, T);
}

/** HOW FAR HE MAY COMMIT ACROSS into the next turn against the balance
 * (`balance` rad) of the one he is still making, 0..1: only as its load
 * falls under `skier.crossLoad` — leaning out of a 2 g turn into the next
 * before the edges have let it go is a skier thrown over them. The
 * physics' rule (`inclineTarget`) and the bot's model of it both read it
 * here. */
export function crossGate(balance: number): number {
  return clamp(1 - Math.abs(Math.tan(balance)) / TUNING.skier.crossLoad, 0, 1);
}

/** THE ROLL RATE, rad/s, at which a skier near upright is plainly being
 * swung from one turn into the next, and the inclination, rad, under which
 * he counts as near upright: what `retractionOf` reads a crossing off. */
const SWING_RATE = 3;
const SWING_UPRIGHT = 0.6;

/** HOW FAR HIS LEGS ARE PULLED UP NOW skiing `T`, m (`Crossing.retract`):
 * the whole of it with the body near upright (`rollRel` rad against the
 * snow) and rolling through it at `SWING_RATE` (`wz` rad/s) — the skis
 * swung under him from one edge to the next — and none on a straight run
 * or held in a turn, where nothing swings; on a pitch `fall` rad steep, as
 * much of it as he crosses under there (`crossUnderOf`). */
export function retractionOf(T: Technique, rollRel: number, wz: number, fall: number): number {
  if (T.cross.retract === 0) return 0;
  const upright = 1 - clamp(Math.abs(rollRel) / SWING_UPRIGHT, 0, 1);
  const swung = clamp(Math.abs(wz) / SWING_RATE, 0, 1);
  return T.cross.retract * crossUnderOf(T, fall) * upright * upright * (3 - 2 * upright) * swung;
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
  side = 0,
): number {
  const K = TUNING.skier;
  const packed = c.packed;
  const bent = Math.min(
    Math.abs(carveCurvature(spec, goal)) * (1 + TUNING.carve.tighten * c.carve),
    carveMost(spec, goal),
  );
  // The bend's pull, never more than the grip holds, less the wind's push
  // across him (`side`, toward his right, m/s²): the edges hold that too,
  // so he leans into a crosswind.
  const held = cornerGrip(spec, packed, speed, goal, T) * pressed;
  const pull = Math.min(c.way * c.way * bent, held) * Math.sign(goal);
  const asked = Math.atan2(clamp(pull - side, -held, held), TUNING.g);
  // Against the balance of the turn he is still making he crosses over
  // only as its load falls under `crossLoad`: leaning out of a 2 g turn
  // into the next before the edges have let it go is a skier thrown over
  // them.
  const opposed = asked * c.balance < 0;
  const commit = K.commit * (opposed ? crossGate(c.balance) : 1);
  const most = leanMostOf(T);
  const balance = c.balance + commit * (asked - c.balance);
  // In powder the steer rolls him over — but on his platforms
  // (`sidestep.ts`) it asks for a step, not a roll.
  const steer = c.sidestep !== 0 ? 0 : c.steer;
  return clamp(balance, -most, most) * packed + steer * K.rollPowder * (1 - packed);
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
