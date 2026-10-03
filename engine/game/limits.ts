// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SKIER CAN DO — the model's own ceilings, stated once. The physics
// enforces them and the bot plans around them; a bot planning off a number
// that only resembles the one the physics applies is a skier on different
// skis. Nothing here has state: they are questions about a SPEC.

import { riderOf } from "./defs/riders.ts";
import { SKIS, totalMass, type SkiSpec } from "./defs/skis.ts";
import type { RunRules } from "./defs/modes.ts";
import { TUNING } from "./defs/tuning.ts";
import { footprintOf } from "./footprint.ts";
import { gripAt, type Grip } from "./snow.ts";
import { probesOf } from "./suspension.ts";

const scratch: Grip = { edge: 0, base: 0 };

/** The documented top speed in a tuck on the reference pitch, m/s — what
 * the bot reads as flat out; `tests/skier_test.ts` holds the physics to
 * it. */
export function topSpeedOf(spec: SkiSpec): number {
  return spec.topSpeed / 3.6;
}

/** THE PITCH the top speed is quoted on, rad: a 20° groomed schuss — a
 * red piste's steep pitch (36 %), the steepest a groomer holds a straight
 * line down for long. */
export const TOP_SPEED_PITCH = Math.PI / 9;

/** THE TERMINAL SPEED, m/s, on a groomed pitch of `grade` rad in a tuck:
 * where the air's drag on `cdATuck` balances the slope's pull less the
 * base's friction. Nothing drives a skier faster down a straight. */
export function terminalSpeed(spec: SkiSpec, grade: number, crouch = 1): number {
  const m = totalMass(spec);
  const pull = TUNING.g * (Math.sin(grade) - TUNING.snow.crrPacked * Math.cos(grade));
  if (pull <= 0) return 0;
  const cdA = spec.cdAUpright + (spec.cdATuck - spec.cdAUpright) * crouch;
  return Math.sqrt((2 * m * pull) / (TUNING.airDensity * cdA));
}

/** The full edge the skis can be put on at `speed` m/s, rad: the spec's
 * at a standstill, two thirds of it by `steer.fadeSpeed`. Read by the
 * physics AND the bot. */
export function edgeLockAt(spec: SkiSpec, speed: number): number {
  return spec.edgeMax / (1 + Math.abs(speed) / (2 * TUNING.steer.fadeSpeed));
}

/** The full edge at a speed, rad (`edgeLockAt` under the name the bot and
 * the labs shared with the sibling games). */
export function lockAt(spec: SkiSpec, speed: number): number {
  return edgeLockAt(spec, speed);
}

/** THE CURVATURE a ski on `edge` rad carves, 1/m: the sidecut's arc bent
 * into the snow tightens as the ski is tipped, `tan(edge) / sidecut`, so
 * 45° of edge carves about the sidecut radius and a ski laid flat runs
 * straight. */
export function carveCurvature(spec: SkiSpec, edge: number): number {
  return Math.tan(edge) / spec.sidecut;
}

/** THE TIPPING POINT, as a lateral acceleration over g: past it the skier
 * is thrown over his outside ski before it slides. A skier is not a
 * vehicle on a track: what holds him up in a carve is the INCLINATION of
 * the whole body toward the turn's centre, and the tangent of that angle
 * is the lateral load it balances. The most he holds is the whole's roll
 * (`skier.rollPacked`) plus the ANGULATION — his hips hung `hipReach` m
 * inside over his CoG height, folded half a tuck low — times the arcade's
 * `hangOff`. So a skier folded low into a turn holds a carve a tall one is
 * thrown out of, and on the groomer the edge's grip, not this, is what a
 * carve runs out of first. */
export function tipLimit(spec: SkiSpec): number {
  const low = spec.cogHeight - spec.crouchDrop / 2;
  const incline = TUNING.skier.rollPacked + Math.atan(spec.hipReach / low);
  return Math.tan(Math.min(incline, 1.2)) * TUNING.arcade.hangOff;
}

/** THE CHATTER at `speed` m/s on firm snow, 0 … the pair's own most
 * (`TUNING.chatter`): the speed's share, a smoothstep from `from` to
 * `full`, times how much of it the pair lets through (`footprint.ts`).
 * What the edge's hold loses to it is `chatter.loss` of this. */
export function chatterOf(spec: SkiSpec, speed: number): number {
  const C = TUNING.chatter;
  const k = Math.min(1, Math.max(0, (Math.abs(speed) - C.from) / (C.full - C.from)));
  return k * k * (3 - 2 * k) * footprintOf(spec).chatter;
}

/** The share of the edge's sideways hold left to a pair shaking at
 * `speed` m/s — what the physics multiplies the edge by. */
export function chatterHold(spec: SkiSpec, speed: number): number {
  return Math.max(0, 1 - TUNING.chatter.loss * chatterOf(spec, speed));
}

/** HOW HARD A SKIER CAN CORNER, m/s², on snow `packed` 0..1 at `speed`
 * m/s: the edges' (or in powder the bases') sideways grip over the whole
 * weight — the edges' less what the CHATTER costs them at that speed — or
 * the tipping point, whichever comes first. That is what a skier holding a
 * carve can call on; the bot reads it to judge a bend's speed. */
export function cornerGrip(spec: SkiSpec, packed: number, speed = 0): number {
  const grip = gripAt(packed, scratch, footprintOf(spec));
  const hold = grip.edge * chatterHold(spec, speed) * packed + grip.base * (1 - packed);
  return TUNING.g * Math.min(hold * TUNING.arcade.sideGrip, tipLimit(spec));
}

/** THE PULL ON A SKIER IN FLIGHT under `rules`, m/s² — the run's own
 * (`RunRules.airGravity`: the arcade's heavier air on a race, the real g on
 * a tricks run), which the physics applies once he is flying and the bot's
 * ballistics read to know where a kicker puts him down. */
export function flightGravity(rules: Pick<RunRules, "airGravity">): number {
  return TUNING.g * rules.airGravity;
}

/** How hard a skier can stop, m/s², on snow `packed` 0..1: the skid's own
 * drag on the whole weight plus the edges scrubbing sideways across the
 * way — a hockey stop on the groomer, a snowplough's shove in powder. */
export function brakeDecel(spec: SkiSpec, packed: number): number {
  const grip = gripAt(packed, scratch, footprintOf(spec));
  const hold = grip.edge * packed + grip.base * (1 - packed);
  const S = TUNING.steer;
  return TUNING.g * (S.skidDrag + hold * TUNING.grip.skidHold * Math.sin(S.skidFast) * 0.5);
}

const harsh = new WeakMap<SkiSpec, number>();

/** THE HARDEST LANDING A SKIER TAKES WHOLE, m/s into the slope. A leg
 * folded to its stop has stored ½·k·x², and the landing it can take without
 * bottoming is the one whose energy that covers: v = √(2E / m). So
 * `air.harshSpeed` — measured on the reference pair — scales as the square
 * root of the stroke energy per kilo, summed over every station, times the
 * pair's own give (`footprint.ts`: a soft ski lands softer). Read by the
 * landing (`flight.ts`) and by the bot, which plans a kicker's speed
 * against it. */
export function harshSpeedOf(spec: SkiSpec): number {
  const hit = harsh.get(spec);
  if (hit !== undefined) return hit;
  const stroke = (s: SkiSpec): number =>
    probesOf(s).reduce((sum, p) => sum + 0.5 * p.susp.rate * p.susp.travel ** 2, 0) / totalMass(s);
  // ...and as the root of the share of it his legs stop his weight over
  // (`RiderSpec.hold`): the fall height they take whole is in step with it.
  const v =
    TUNING.air.harshSpeed *
    Math.sqrt((stroke(spec) / stroke(SKIS)) * riderOf(spec).hold) *
    footprintOf(spec).harsh;
  harsh.set(spec, v);
  return v;
}
