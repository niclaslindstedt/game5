// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PLANE'S WRECK — what a light turboprop does when it goes into the
// snow (`plane.ts`'s `crash`): the KIND of crash its attitude and way say it
// was, the fuel it had left, the FIREBALL that fuel goes up in (the
// helicopter's law, `heli-wreck.ts`), the POOL FIRE the rest burns as, and
// how long. Kept apart from `plane.ts`'s table, which the Blender model is
// made from: none of this is the machine's shape.
//
// WHAT A STRUT-BRACED HIGH-WING TURBOPROP DOES IN THE SNOW — the research
// these numbers stand on, in our own words (accident-investigation reports
// of light utility singles and skydiving planes, the pool-fire and
// fireball literature of process safety):
//   - HOW IT COMES APART is set by how it went in. The lift struts buckle
//     and the wings fold back or up at their root fittings, often tearing
//     off with their tanks, which spill the fuel there — so the fire is
//     centred on the wing roots and the cabin. The tailcone breaks just aft
//     of the cabin, behind the door, the fin usually whole. The light
//     turbine (≈150 kg) tears off its mount and rolls on ahead, its cowling
//     split. The gear legs and the skis are torn off. The cabin is crushed
//     from the nose back.
//   - FLOWN STRAIGHT IN (`nose`), the nose and the engine take it all: the
//     cabin concertinas, the tail whips forward over it and breaks, the
//     wings fold forward. A WING TIP CAUGHT at speed and a bank (`cart`)
//     tears that wing off where it struck and slews and rolls the rest,
//     often over onto its back, strewing pieces along the way. Set down
//     flat too fast or with the gear folded (`belly`), it toboggans on
//     tens of metres, the gear left behind, a wing folded up. Out of a
//     STALL AND SPIN (`spin`) it comes down nearly flat and turning, little
//     way on: crushed down onto itself, the wings folded up at the roots.
//     INTO THE TREES (`tree`), a wing is torn off on a trunk and the rest
//     slews round it.
//   - THE PROPELLER'S BLADES tell whether the engine was under power: bent
//     back evenly at idle, curled and twisted forward under power.
//   - JET FUEL is far less volatile than petrol: a FIREBALL needs an impact
//     hard enough to throw the fuel out as a fine mist (a wing striking at
//     speed). Slower, the fuel spills and lights as a POOL FIRE at the wing
//     roots; a pool of jet fuel burns away at about 0.04 kg/m²·s, its flames
//     two to three times its width tall (Heskestad's flame height) under a
//     thick black column; on snow the pool melts its way down into slush
//     and burns smaller as it goes, steam mixed into its smoke. The cabin's
//     trim and the tyres burn on after the fuel is gone, a smouldering hulk.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";

import { fireballGrowth, fireballOf, WRECK } from "./heli-wreck.ts";

/** HOW IT WENT IN (`plane.ts`'s crash, `wreckKindOf`): flown into the snow
 * nose first, a wing tip caught and CARTWHEELED, slid in flat on its BELLY,
 * down out of a stall and SPIN, or into the TREES. */
export type WreckKind = "nose" | "cart" | "belly" | "spin" | "tree";

export const PLANE_WRECK = {
  /** THE FUEL'S BURN in the air, kg/h: a light turboprop of the class at
   * idle and at full power (≈0.6 kg/kW·h at full, more at idle), drawn
   * down from the jump flight's load (`PLANE.fuel`). The plane's mass is
   * held at its working weight: a flight burns some tens of kilograms of
   * a 2.5-tonne machine. [class sheet] */
  burn: { idle: 70, full: 200 },
  /** THE FIREBALL: the share of the fuel thrown out as mist and burnt in
   * the ball at a hard impact (`share`, as the helicopter's), ramping in
   * from `light` m/s (too slow to mist jet fuel: a pool fire alone) to
   * `full` m/s; under `least` kg in the ball, none. Its growth, lift-off,
   * rise and heat are the helicopter's (`WRECK.fire`). */
  ball: { share: 0.3, light: 14, full: 45, least: 6 },
  /** HOW OPEN ITS TANKS ARE TORN by the kind of crash, a share of the
   * ball's mist: a nose-in, a cartwheel and a spin burst the wing tanks
   * (the wing torn off or crushed in), the trees rip the wings open on
   * their trunks, and a belly slide mostly keeps its wings and tanks
   * whole — a strut or a wheel tears one open, and the fuel that leaks
   * burns as a pool fire. [accident-survey pattern; no single source] */
  torn: { nose: 1, cart: 1, spin: 0.85, tree: 0.9, belly: 0.35 },
  /** THE POOL FIRE: the fuel left spills round the wing roots over about
   * `area` m², burning away at `rate` kg/m²·s (jet fuel's), its flames as
   * tall as Heskestad's correlation makes them at `heat` MJ/kg and a
   * radiative-loss combustion efficiency `eff`; on snow the pool sinks into
   * its own slush and burns down to `snow` of its rate by the end. Past the
   * fuel the hulk SMOULDERS on (`smoulder` s, its fire a share `ember` of
   * the pool's). Never under `least` s: a wing's tank alone burns a minute. */
  pool: {
    area: 45,
    rate: 0.04,
    heat: 43,
    eff: 0.7,
    snow: 0.55,
    smoulder: 120,
    ember: 0.22,
    least: 40,
  },
  /** WHAT EACH KIND IS, at the moment it struck: a SPIN is a stalled wing
   * share past `stalled` turning past `yaw` rad/s about its up, or falling
   * steeper than `spinPath` rad stalled; a NOSE-IN a flight path steeper
   * than `nosePath` rad down or the nose under `nosePitch`; a CARTWHEEL a
   * wing tip struck first with the bank past `cartRoll` rad and `cartWay`
   * m/s along the snow. Else on its belly. */
  kinds: {
    stalled: 0.3,
    yaw: 0.6,
    spinPath: 1.0,
    nosePath: 0.55,
    nosePitch: -0.5,
    cartRoll: 0.3,
    cartWay: 12,
  },
} as const;

/** What the fire of a wreck with `fuel` kg aboard struck at `speed` m/s
 * (`kind` the way it went in — a nose-in's when left out) comes to: the fuel in the ball, kg (0: no ball), its diameter, m, and
 * life, s; the pool's fuel, kg, its radius, m, how long it burns, s, and its
 * flames' height at first, m; and the whole fire's life with the hulk's
 * smoulder, s. */
export type PlaneFire = {
  ball: number;
  diameter: number;
  life: number;
  pool: number;
  radius: number;
  burns: number;
  flame: number;
  out: number;
};

/** THE FIRE OF A WRECK off its fuel and its impact. */
export function planeFireOf(fuel: number, speed: number, kind: WreckKind = "nose"): PlaneFire {
  const B = PLANE_WRECK.ball;
  const P = PLANE_WRECK.pool;
  const f = Math.max(0, fuel);
  const k = Math.min(1, Math.max(0, (speed - B.light) / (B.full - B.light)));
  const mist = f * B.share * PLANE_WRECK.torn[kind] * k * k * (3 - 2 * k);
  const ball = mist >= B.least ? mist : 0;
  const { diameter, life } = ball > 0 ? fireballOf(ball) : { diameter: 0, life: 0 };
  const pool = f - ball;
  // The pool spreads over its area, less with less fuel (a film some 4 mm
  // deep at the least), and burns it away at the rate, slowed by the snow.
  const area = Math.min(P.area, pool / (800 * 0.004));
  const radius = Math.sqrt(Math.max(1, area) / Math.PI);
  const mean = (1 + P.snow) / 2;
  const burns = pool > 0 ? Math.max(P.least, pool / (P.rate * Math.max(1, area) * mean)) : 0;
  // Heskestad: L = 0.235 Q^⅖ − 1.02 D, Q the fire's heat release in kW.
  const Q = P.rate * area * P.heat * 1e3 * P.eff;
  const flame = pool > 0 ? Math.max(1.5, 0.235 * Q ** 0.4 - 1.02 * 2 * radius) : 0;
  return { ball, diameter, life, pool, radius, burns, flame, out: burns + P.smoulder };
}

/** THE POOL'S FIRE at `age` s, 0..1 of its first strength: lit full,
 * sinking into its slush to `snow` of it as the fuel goes, guttering out
 * over the last tenth, then the hulk's smoulder (`ember`) dying away. */
export function poolHeat(fire: PlaneFire, age: number): number {
  const P = PLANE_WRECK.pool;
  if (age < 0 || fire.out <= 0) return 0;
  if (age < fire.burns) {
    const k = age / fire.burns;
    const sink = 1 - (1 - P.snow) * k;
    const gutter = k > 0.9 ? Math.max(P.ember, (1 - k) / 0.1) : 1;
    return sink * gutter;
  }
  const s = (age - fire.burns) / Math.max(1, fire.out - fire.burns);
  return s >= 1 ? 0 : P.ember * (1 - s) ** 1.5;
}

/** THE WRECK'S FIREBALL at `age` s: as the helicopter's (`fireballAt`) off
 * this fire's own ball — its radius, its height over the snow, its life,
 * its glow; nothing where there was no ball. */
export function planeFireballAt(
  fire: PlaneFire,
  age: number,
): { radius: number; height: number; life: number; glow: number } {
  if (fire.ball <= 0) return { radius: 0, height: 0, life: 0, glow: 0 };
  const F = WRECK.fire;
  const radius = (fire.diameter / 2) * fireballGrowth(age, fire.life);
  const up = Math.max(0, age - F.lift * fire.life);
  const reach = F.rise / F.riseRate;
  const risen =
    up < reach
      ? 0.5 * F.riseRate * up * up
      : 0.5 * F.riseRate * reach * reach + F.rise * (up - reach);
  return {
    radius,
    height: risen + radius * 0.55,
    life: fire.life,
    glow: Math.max(0, 1 - age / fire.life),
  };
}

/** WHICH KIND OF CRASH it was: `tip` the wing tip struck first (−1 the
 * left, +1 the right, 0 neither), `tree` a crown or a trunk; the way it was
 * going, m/s, its pitch and roll, rad, its yaw rate about its up, rad/s,
 * and the share of its wing stalled. */
export function wreckKindOf(c: {
  tip: number;
  tree: boolean;
  vx: number;
  vy: number;
  vz: number;
  pitch: number;
  roll: number;
  yawRate: number;
  stalled: number;
}): WreckKind {
  const K = PLANE_WRECK.kinds;
  if (c.tree) return "tree";
  const way = hypot(c.vx, c.vz);
  const path = Math.atan2(-c.vy, Math.max(0.1, way));
  const stalled = c.stalled > K.stalled;
  if (stalled && (Math.abs(c.yawRate) > K.yaw || path > K.spinPath)) return "spin";
  if (path > K.nosePath || c.pitch < K.nosePitch) return "nose";
  if (c.tip !== 0 && Math.abs(c.roll) > K.cartRoll && way > K.cartWay) return "cart";
  return "belly";
}
