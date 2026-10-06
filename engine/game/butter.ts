// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// BUTTERS AND PRESSES — a rotation ON THE SNOW, on a run that has them
// (`RunRules.butters`: the knuckle huck, R38). Everything else in the
// engine turns a skier on the snow by his edges; a butter turns him on the
// END of his skis.
//
// THE PRESS. The lean held hard (`TUNING.tricks.butter.gate`) on the snow
// throws his weight onto one end of the pair — forward onto the tips (a
// NOSE press), back onto the tails (a TAIL press) — and the other end lifts:
// the lean's own work on the stations (`skier.ts` reads it as the weight
// fore and aft). Held, it is a press, and a press ridden off the knuckle is
// a trick of its own.
//
// THE BUTTER. Pressed, the edge is no longer an edge: the skis ride flat on
// the end he stands on, and the edge across its gate PIVOTS him about that
// end — gathered to a slow rate, the wind-up a rider sets on a deck a
// couple of metres before he rolls the knuckle. The pivot is kinematic, as
// a stroke's throw is in the air (`strokes.ts`): the body is turned at the
// rate asked, whatever the snow's yaw hold made of the step, and the boots
// swing round the pressed end. The skis then go across his way flat, and
// the snow brakes him for it — a butter costs speed, as it does.
//
// INTO THE AIR. The press he leaves the snow in is filed with the flight
// (`TrickState.takeoff`, `FlightRecord.butter`), so the reader names it (a
// NOSE BUTTER 540) and counts what it turned on the snow into the spin. A
// butter POPPED off the knuckle is owed the rest of its turn: the throw
// (`strokes.ts`) is asked for whatever brings his skis square to his line
// again in the butter's direction — past any stroke he tapped in, to the
// next half turn — so a butter wound to 270° is landed as a 360, and one
// tapped once more as a 540. A press still held across the lean's stroke
// gate at the lip throws a flip, too: a nose butter into a front flip. Let
// the lean go before the lip and the butter keeps what it wound for a
// moment (`keep`), and only the spin goes into the air.
//
// Nothing here is random and nothing reads a clock: a run replays to the
// same butter.

import { angleDiff, approach } from "@niclaslindstedt/oss-game-framework/core/math";
import { integrate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { TUNING } from "./defs/tuning.ts";
import { derive } from "./skier.ts";
import type { ButterRecord, GameState, PressEnd, SkierInput } from "./state.ts";

const T = TUNING.tricks;
const B = T.butter;

/** The end the lean asks to press, or null. Back (+1) is the tails. */
function pressAsked(input: SkierInput): PressEnd | null {
  if (input.lean <= -B.gate) return "nose";
  if (input.lean >= B.gate) return "tail";
  return null;
}

/** Whether the skier is pressing this step: butters on the run, on the
 * snow, on his skis, below the fastest a press is held at. */
function pressing(state: GameState, input: SkierInput): PressEnd | null {
  const c = state.skier;
  if (!state.rules.butters || c.airborne || c.thrown !== null) return null;
  if (state.phase !== "racing" || c.speed > B.fastest) return null;
  return pressAsked(input);
}

const flat: SkierInput = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };

/** THE INPUT THE SKIS RIDE ON while he presses: the edge is the pivot's,
 * not a carve's — the skis flat on the end he stands on. Anything else
 * passes as it is. */
export function butterInput(state: GameState, input: SkierInput): SkierInput {
  if (!pressing(state, input)) return input;
  Object.assign(flat, input);
  flat.steer = 0;
  flat.carve = false;
  return flat;
}

/** The press he is leaving the snow in (or let go of no longer than
 * `keep` s ago), for the flight to file — or null. */
export function takeoffPress(state: GameState): ButterRecord | null {
  const k = state.tricks;
  if (k.pressEnd === null || k.pressGone > B.keep) return null;
  return { end: k.pressEnd, held: k.pressFor, yaw: k.butterYaw };
}

/** One step of the press and the butter, after the skier has been stepped
 * and the strokes read (`run.ts`). `input` is what the skier asked for. */
export function stepButter(state: GameState, input: SkierInput): void {
  if (!state.rules.butters) return;
  const c = state.skier;
  const k = state.tricks;
  const dt = TUNING.dt;
  if (c.airborne) {
    squareButter(state);
    return;
  }
  const end = pressing(state, input);
  if (end === null) {
    k.press = null;
    k.pivot = 0;
    k.pressGone += dt;
    if (k.pressGone > B.keep) {
      k.pressEnd = null;
      k.pressFor = 0;
      k.butterYaw = 0;
    }
    return;
  }
  // A new press, or the other end: wound afresh.
  if (k.press !== end && (k.pressEnd !== end || k.pressGone > B.keep)) {
    k.pressFor = 0;
    k.butterYaw = 0;
    k.pivot = 0;
  }
  k.press = end;
  k.pressEnd = end;
  k.pressGone = 0;
  k.pressFor += dt;
  const spin = input.steer >= T.spinGate ? 1 : input.steer <= -T.spinGate ? -1 : 0;
  k.pivot = approach(k.pivot, spin * B.rate, B.accel * dt);
  if (k.pivot === 0) return;
  // THE PIVOT: the body turned at the butter's rate whatever the yaw hold
  // took off this step, and the boots swung round the pressed end.
  const h0 = c.heading;
  c.q = integrate(c.q, 0, k.pivot - c.wy, 0, dt);
  c.wy = k.pivot;
  derive(c, state.level);
  const reach = (end === "nose" ? 1 : -1) * B.pivot * c.spec.length;
  c.x += reach * (Math.sin(h0) - Math.sin(c.heading));
  c.z += reach * (Math.cos(h0) - Math.cos(c.heading));
  derive(c, state.level);
  k.butterYaw += k.pivot * dt;
}

/** IN THE AIR off a butter: once the flight can be thrown in, the throw is
 * owed whatever brings the skis square to his line again in the butter's
 * direction, past any stroke already tapped. Once a flight. */
function squareButter(state: GameState): void {
  const c = state.skier;
  const k = state.tricks;
  if (!k.takeoff || k.squared || k.takeoff.yaw === 0) return;
  const flying = c.thrown === null && c.airTime >= TUNING.air.counts && c.launchVy >= T.launch;
  if (!flying) return;
  k.squared = true;
  const tapped = k.spinGoal - k.spinDone;
  const dir = tapped !== 0 ? Math.sign(tapped) : Math.sign(k.takeoff.yaw);
  // How far round he is from square, the way he turns.
  const off = angleDiff(c.heading, Math.atan2(c.vx, c.vz));
  let owed = (((dir * off) % Math.PI) + Math.PI) % Math.PI;
  // Square already, a hair past it: no half turn more for that.
  if (owed > Math.PI - 0.25 && Math.abs(tapped) < 0.3) owed -= Math.PI;
  while (owed < Math.abs(tapped) - 0.3) owed += Math.PI;
  k.spinGoal = dir * owed;
  k.spinDone = 0;
  k.spinHeld = true;
}
