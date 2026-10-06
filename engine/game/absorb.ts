// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LANDING ABSORBED — what a skier's legs and trunk do in the moment
// the snow takes him back, which a pair of springs on their own does not.
//
// A knee taking a landing is no spring: it bends under the load and lets
// the body sink — eccentric work, the energy spent in the muscle — and it
// does not fling him back up off the snow when the bend is over. So from
// the air until `absorb.for` s after a touchdown the legs are SOFTER
// (`soften` of their rate let go), bend DEEPER before the stop
// (`deeper` more of their travel) and come back up SLOWLY (`rebound`
// times their own damping), and the trunk holds its fore-aft and side to
// side square against the slap of a ski meeting the snow end first
// (`steady`, a damping on the pitch and roll rates). A skier who comes down
// on his skis on a slope a skier lands on rides it away, sunk deep and
// rocking; one who comes down on his side, on his tips or off a cliff onto
// the flat still goes down (`crash.ts`). Every share eases off linearly
// over the window, so the legs are themselves again once he is skiing.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { TUNING } from "./defs/tuning.ts";
import type { SkierState } from "./state.ts";
import type { Probe } from "./suspension.ts";
import type { Level } from "../mapgen/types.ts";

const AB = TUNING.landing.absorb;

/** How much of the absorbing a skier's legs are doing, 0..1: all of it
 * while he is in the air, easing to nothing over `absorb.for` s after he
 * comes down. */
export function absorbShare(c: SkierState): number {
  if (c.thrown !== null) return 0;
  if (c.airborne) return 1;
  return clamp(1 - c.landing / AB.for, 0, 1);
}

/** The stop's rate and damping as multiples of the leg's own, and the most
 * any one station may ever push, as a multiple of the load it carries at
 * rest. The cap is the physics' fuse rather than a model: a leg folded to
 * its stop on a steep face sees its compression grow with every centimetre
 * the skier slides, and a spring that followed it would fire him off the
 * slope. */
const STOP_RATE = 12;
const STOP_DAMP = 4;
export const MAX_LOAD = 15;
/** THE STOP GIVES BACK LITTLE: a knee at the end of its bend loads at its
 * full rate and hands back only this share of it on the way out — the
 * hysteresis that makes it swallow a slam rather than spring off it. */
const STOP_RELEASE = 0.2;
/** BOTTOMING CONTROL: the compression damping rises over the last
 * `BOTTOM_ZONE` of the stroke, to `1 + BOTTOM_DAMP` times its own at the
 * end — the muscle a skier braces a landing with, so a big hit is slowed
 * before the stop has to catch it. */
const BOTTOM_ZONE = 0.3;
const BOTTOM_DAMP = 2;

/** WHAT ONE LEG PUSHES WITH, N along itself: its spring over `bent` m of
 * compression and its damper over `rate` m/s of it (closing positive),
 * `soft` and `dampen` of each (`damage.ts`, `trench.ts`), the stop past
 * its travel — all of it under `give` of a landing's absorbing (above) —
 * and never more than `MAX_LOAD` times its load at rest. */
export function legPush(
  p: Probe,
  bent: number,
  rate: number,
  soft: number,
  dampen: number,
  give: number,
): number {
  const leg = p.susp;
  const stroke = leg.travel * (1 + AB.deeper * give);
  const deep = clamp((bent / stroke - (1 - BOTTOM_ZONE)) / BOTTOM_ZONE, 0, 1);
  const damp =
    rate > 0 ? leg.bump * (1 + BOTTOM_DAMP * deep) : leg.rebound * (1 + AB.rebound * give);
  let spring = leg.rate * soft * (1 - AB.soften * give) * bent + damp * dampen * rate;
  if (bent > stroke) {
    spring +=
      STOP_RATE * leg.rate * (bent - stroke) * (rate > 0 ? 1 : STOP_RELEASE) +
      STOP_DAMP * leg.bump * Math.max(0, rate);
  }
  return Math.min(spring, MAX_LOAD * p.rest);
}

/** THE BODY FOLLOWS THE SKIS: on the snow while a landing is absorbed his
 * pitch and roll turn no faster than `absorb.rate` and his yaw no faster
 * than `absorb.yaw`, rad/s. A ski met end first or sideways is pivoted to
 * the slope and to the way by the ankles and the knees under a body that
 * goes on as it was — a rigid skier would be thrown round by it, and fly
 * off the next bump spinning past any hand that could catch it. Only the
 * leading end coming DOWN to the snow under them (`absorb.follow`) are let turn
 * faster: a landing on a knuckle's edge lays the skis along the slope
 * falling away ahead, where held level on their tails they would carry
 * him off it again. */
export function settleRates(c: SkierState, level: Level): void {
  c.wz = clamp(c.wz, -AB.rate, AB.rate);
  c.wy = clamp(c.wy, -AB.yaw, AB.yaw);
  // The slope under the end he is going toward (the tails, ridden
  // switch), along the skis, tips-up positive as `pitch` is.
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const ends = fx * c.vx + fz * c.vz < 0 ? -1 : 1;
  const reach = (ends * c.spec.length) / 2;
  level.normalAt(c.x + fx * reach, c.z + fz * reach, ground);
  const slope = Math.atan(-(ground.x * fx + ground.z * fz) / Math.max(0.2, ground.y));
  // That end above it: a rate taking it down (tips down is a positive
  // `wx`) closes the gap.
  const above = (c.pitch - slope) * ends > 0;
  c.wx = clamp(
    c.wx,
    above && ends < 0 ? -AB.follow : -AB.rate,
    above && ends > 0 ? AB.follow : AB.rate,
  );
}

const ground = { x: 0, y: 1, z: 0 };
