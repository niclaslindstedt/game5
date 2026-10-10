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
//   - TOO SLOW TO RIDE IT, HE TURNS ROUND (`RunRules.revert`: the free
//     ride and the tricks run): under `switch.revert.below` on the snow a
//     skier riding switch has nothing left to carry him, and going tails
//     first he cannot push — so he REVERTS, as a freestyler slides out of
//     a switch landing: the skis laid flat, unweighted and pivoted round
//     on their bases the way he is looking (the steer held, or the shorter
//     way onto his line), his way over the snow carried on through it.
//     Faced down his line again he poles and skates (`poles.ts`).
//
// Decided ON THE SNOW, off the way he was making, with a margin either
// side of a standstill (`TUNING.switch.from`) so a skier slid to a stop
// does not flicker between the two — and HELD through a flight, so one
// spinning a 360 is not switch half way round it.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  fromAxisAngle,
  multiply,
  normalize,
  type Vec3,
} from "@niclaslindstedt/oss-game-framework/core/quat";
import { TUNING } from "./defs/tuning.ts";
import { tailRiseOf } from "./defs/tails.ts";
import { depthUnder } from "./snow.ts";
import type { GameState, SkierInput, SkierState } from "./state.ts";

const SW = TUNING.switch;
const RV = SW.revert;

/** THE REVERT under way (`SkierState.revert`): how far through it he is,
 * 0..1 of `switch.revert.time`, and the yaw it turns him by in all, rad,
 * right (clockwise) positive — the side he looks over and turns to. */
export type Revert = { u: number; turn: number };

/** How far round a revert has turned him at `u` of it, 0..1: eased in and
 * out — the skis unweighted, swung and set down. */
export function revertShare(u: number): number {
  const t = clamp(u, 0, 1);
  return t * t * (3 - 2 * t);
}

/** THE SKIS LIGHT IN A REVERT: the share of their hold across the snow
 * they keep — least at the middle of it, where they are across the way —
 * and all of it when he is not reverting. */
export function revertHold(c: SkierState): number {
  return c.revert == null ? 1 : 1 - RV.unweight * Math.sin(Math.PI * c.revert.u);
}

/** Whether a skier riding switch turns round this step: the rules let him,
 * he is on the snow on his own skis, on nothing that carries him, and
 * slower than `revert.below`. */
function revertDue(state: GameState): boolean {
  const c = state.skier;
  return (
    state.rules.revert === true &&
    c.switched &&
    !c.airborne &&
    c.revert == null &&
    c.thrown === null &&
    c.lift === null &&
    c.tunnel === null &&
    c.jib == null &&
    c.sidestep === 0 &&
    c.trench === 0 &&
    c.speed < RV.below
  );
}

/** THE TURN A REVERT TAKES, rad: round onto the line he is travelling,
 * the way the steer is held or else the shorter way — a half turn the
 * steer's way (or to his right) when he is all but stood still. */
export function revertTurn(c: SkierState, steer: number): number {
  const flat = hypot(c.vx, c.vz);
  const side = steer !== 0 ? Math.sign(steer) : 0;
  if (flat < SW.from) return (side || 1) * Math.PI;
  const off = angleDiff(Math.atan2(c.vx, c.vz), c.heading);
  if (side === 0 || Math.sign(off) === side) return off;
  return off - side * 2 * Math.PI;
}

/** Decide whether the skier rides switch this step, and the steer he is
 * read as asking for: the input's, mirrored while he goes tails first on
 * the snow. */
export function switchSteer(state: GameState, input: SkierInput): number {
  const c = state.skier;
  if (c.revert != null) return 0;
  if (!state.rules.stunts) c.switched = false;
  else if (!c.airborne) {
    if (c.way < -SW.from) c.switched = true;
    else if (c.way > SW.from) c.switched = false;
  }
  if (revertDue(state)) {
    // The steer as he means it, read the way he is going (tails first).
    c.revert = { u: 0, turn: revertTurn(c, -input.steer) };
    return 0;
  }
  return clamp(c.switched && !c.airborne ? -input.steer : input.steer, -1, 1);
}

/** THE REVERT TURNED for a step: the body (and with it the skis) yawed
 * about the snow's normal `n` by this step's share of the turn, his way
 * over the snow left as it was — the skis pivot under a body that goes on.
 * Done, he is riding forward. Thrown, the revert is over. */
export function stepRevert(c: SkierState, n: Vec3, dt: number): void {
  const r = c.revert;
  if (r == null) return;
  if (c.thrown !== null) {
    c.revert = null;
    return;
  }
  const u = Math.min(1, r.u + dt / RV.time);
  const yaw = r.turn * (revertShare(u) - revertShare(r.u));
  c.q = normalize(multiply(fromAxisAngle(n.x, n.y, n.z, yaw), c.q));
  r.u = u;
  if (u >= 1) {
    c.revert = null;
    c.switched = false;
  }
}

/** HOW FAR THE SKIS POINT OFF HIS LINE, rad, for the yaw hold to take out:
 * against the gliding ski's line going forward (skating, `SkierState.glide`),
 * against the tails' riding switch, and nothing below `slipFrom` m/s over
 * the snow (`flat`) or sliding back on a skier who is not riding switch.
 * `way` is the step's own way along the skis. */
export function heldSlip(c: SkierState, flat: number, way: number): number {
  if (flat <= TUNING.steer.slipFrom || c.revert != null) return 0;
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
  // The day's skied-up or softened groomer (`piste-day.ts`) is heaps a
  // hand high over a hard base, never a cover a tail is buried in: the
  // share it loosened is read back as the groomer it was.
  const packed = state.piste ? c.packed + state.piste.loose : c.packed;
  const loose = TUNING.snow.cover * depth * (1 - clamp(packed, 0, 1));
  return loose * (1 - tailRiseOf(c.spec)) >= SW.tailDig;
}
