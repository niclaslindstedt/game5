// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RIDING SWITCH — the skis going down the hill backward, tails first, on a
// run that lets the skier trick the mountain (`RunRules.stunts`: the free
// ride and tricks, never a race). He gets there by coming down off a 180
// (`strokes.ts`), or by turning round on the spot and letting the hill
// have him.
//
// What changes when he is (`SkierState.switched`):
//   - THE STEER is read the way he is GOING. Tails first, an edge to his
//     own right bends his way to the left — the carve asks `way · κ` of the
//     yaw (`skier.ts`), and the way is negative — so the thumb's right is
//     his left edge, and the line still bends the way the player pressed.
//     The body's physics needs nothing else: the stations, the grip, the
//     sidecut's toe-in and the inclination all read the way as signed.
//   - THE YAW HOLD keeps the TAILS on his line, as it keeps the tips on it
//     going forward (`heldSlip`).
//   - HE DOES NOT PUSH: a stride along his skis would be a stride back up
//     the hill (`poles.ts`'s drive is off while he is).
//   - In the air, the lens's aim and the landing are judged tails first
//     (`flight.ts`), and so is the end that digs (`crash.ts`'s `noseDown`).
//   - THE TAIL DIGS (`tailDug`): on the groomer every pair runs backward,
//     but in loose snow the leading end must ride over it, and a flat tail
//     is a blade into it — only a ski turned up at both ends (the park
//     ski's twin tips, `TAIL_RISE`) planes through powder switch.
//
// Decided ON THE SNOW, off the way he was making, with a margin either
// side of a standstill (`TUNING.switch.from`) so a skier slid to a stop
// does not flicker between the two — and HELD through a flight, so one
// spinning a 360 is not switch half way round it.

import { angleDiff, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { TUNING } from "./defs/tuning.ts";
import { tailRiseOf } from "./defs/tails.ts";
import { depthUnder } from "./snow.ts";
import type { GameState, SkierInput, SkierState } from "./state.ts";

const SW = TUNING.switch;

/** Decide whether the skier rides switch this step, and the steer he is
 * read as asking for: the input's, mirrored while he goes tails first on
 * the snow. */
export function switchSteer(state: GameState, input: SkierInput): number {
  const c = state.skier;
  if (!state.rules.stunts) c.switched = false;
  else if (!c.airborne) {
    if (c.way < -SW.from) c.switched = true;
    else if (c.way > SW.from) c.switched = false;
  }
  return clamp(c.switched && !c.airborne ? -input.steer : input.steer, -1, 1);
}

/** HOW FAR THE SKIS POINT OFF HIS LINE, rad, for the yaw hold to take out:
 * against the gliding ski's line going forward (skating, `SkierState.glide`),
 * against the tails' riding switch, and nothing below `slipFrom` m/s over
 * the snow (`flat`) or sliding back on a skier who is not riding switch.
 * `way` is the step's own way along the skis. */
export function heldSlip(c: SkierState, flat: number, way: number): number {
  if (flat <= TUNING.steer.slipFrom) return 0;
  const travel = Math.atan2(c.vx, c.vz);
  if (way > 0) return angleDiff(travel, c.heading + c.glide);
  return c.switched ? angleDiff(travel, c.heading + Math.PI) : 0;
}

/** THE TAIL DUG IN: whether a skier going tails first on the snow, at
 * `digSpeed` or more, is riding into more loose snow than his tails ride
 * over (`tailDig`, by `TAIL_RISE`) — the leading end dives and he
 * goes over it, as over the tips. */
export function tailDug(state: GameState): boolean {
  const c = state.skier;
  if (!state.rules.stunts || c.airborne || c.way > -SW.digSpeed) return false;
  const depth = depthUnder(state.snowDepth, state.fresh);
  const loose = TUNING.snow.cover * depth * (1 - clamp(c.packed, 0, 1));
  return loose * (1 - tailRiseOf(c.spec)) >= SW.tailDig;
}
