// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE BIKE'S RIDE COMES TO (`bike.ts`, and the lab's bench): a landing
// judged — ridden away CLEAN, CASED short onto a deck, NOSED in front wheel
// first and steep, OVERSHOT onto the flat past a landing, or FLAT off a drop —
// with the body's peak over it; and whether the rider is past saving: the
// bike laid over past what a tyre holds (the LOWSIDE), the front let go
// (the WASHOUT), pitched over its front wheel (OVER THE BARS), a landing his
// legs could not take, or his body down on the ground. Pure over the bike's
// state and its world; nothing here draws from any stream.

import { BIKE } from "./defs/bike.ts";
import type { BikeStepReport, BikeWorld } from "./bike-body.ts";
import type { BikeCrash, BikeLanding, BikeState } from "./bike-state.ts";

const C = BIKE.crash;

/** Where on a jump a point lies, for the landing's judge: the DECK (a
 * table's top, a gap's open ground — short of the landing), the LANDING's
 * slope, the RUN-OUT past it, or plain ground. */
export type BikeZone = "deck" | "landing" | "runout" | "flat" | null;

/** A world that can say where a jump's parts lie (`BikeZone`). */
export type ZonedWorld = BikeWorld & { zoneAt?(x: number, z: number): BikeZone };

const n = { x: 0, y: 1, z: 0 };

/** The nose's pitch off the ground under the front wheel, rad (nose up
 * positive). */
function nosePitch(b: BikeState, world: BikeWorld): number {
  world.normalAt(b.front.x, b.front.z, n);
  // The frame's forward axis from its attitude.
  const { x, y, z, w } = b.q;
  const fx = 2 * (x * z + w * y);
  const fy = 2 * (y * z - w * x);
  const fz = 1 - 2 * (x * x + y * y);
  return Math.asin(Math.max(-1, Math.min(1, fx * n.x + fy * n.y + fz * n.z)));
}

/** Whether the bike's and rider's centre stands ahead of the front tyre's
 * patch along the bike's heading. */
function pastFront(b: BikeState): boolean {
  const M = BIKE.mass + b.riderMass;
  const cx = (BIKE.mass * b.x + b.riderMass * b.rider.x) / M;
  const cz = (BIKE.mass * b.z + b.riderMass * b.rider.z) / M;
  return (cx - b.front.x) * Math.sin(b.heading) + (cz - b.front.z) * Math.cos(b.heading) > 0;
}

/** A LANDING BEGUN on the step `report` says a flight ended: judged by
 * where it came down and how. */
export function startLanding(b: BikeState, report: BikeStepReport, world: ZonedWorld): void {
  const air = b.airTime;
  b.airTime = 0;
  if (air < BIKE.airCounts) return;
  const w = report.frontFirst ? b.front : b.rear;
  let verdict: BikeLanding = "clean";
  const zone = world.zoneAt ? world.zoneAt(w.x, w.z) : null;
  if (zone === "deck") verdict = "cased";
  else if (zone === "runout") verdict = "overshot";
  else if (report.frontFirst && nosePitch(b, world) < -0.45) verdict = "nosed";
  else if (zone === "flat" || (zone === null && flatUnder(b, world) && air > 0.45))
    verdict = "flat";
  b.landing = { t: 0, peak: b.g, air, verdict, v: report.impact };
}

function flatUnder(b: BikeState, world: BikeWorld): boolean {
  world.normalAt(b.rear.x, b.rear.z, n);
  return n.y > 0.985;
}

/** THE LANDING'S WINDOW stepped `dt` s: the body's peak kept; done, it is
 * handed back to be said. */
export function stepLanding(b: BikeState, dt: number): BikeState["landing"] {
  const l = b.landing;
  if (!l) return null;
  l.t += dt;
  l.peak = Math.max(l.peak, b.g);
  if (l.t < BIKE.landing.window) return null;
  b.landing = null;
  return l;
}

/** WHETHER THE RIDER IS PAST SAVING this step, and how — or null. Keeps
 * the lowside's and the washout's clocks. */
export function crashOf(b: BikeState, world: BikeWorld, dt: number): BikeCrash | null {
  // Laid over past what any tyre holds.
  b.leanFor = Math.abs(b.roll) > C.lean ? b.leanFor + dt : 0;
  if (b.leanFor >= C.leanFor) return "lowside";
  // The front let go at speed.
  const sliding = b.front.touching && b.front.over > C.slide && b.speed > C.slideFast;
  b.slideFor = sliding ? b.slideFor + dt : Math.max(0, b.slideFor - dt);
  if (b.slideFor >= C.slideFor) return "washout";
  // Over the bars: the rear off the ground, the nose down past the ground
  // under the front, and the whole weight (bike and rider) gone out past the
  // front tyre's patch — past that no lean back brings the rear down again.
  if (b.front.touching && !b.rear.touching && nosePitch(b, world) < -C.nose && pastFront(b))
    return "bars";
  // A landing his legs could not take.
  if (b.landing && b.g > C.land) return "landing";
  if (b.landing && b.landing.verdict === "nosed" && b.g > C.land * 0.6) return "bars";
  // His body on the ground.
  if (b.rider.y - world.groundAt(b.rider.x, b.rider.z) < C.low) return "down";
  return null;
}
