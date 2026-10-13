// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABLE GRIND — a lift's rope ridden as a rail (a free ride's,
// `RunRules.cables`). The arcade skateboarders' wire: a skier (or a rider)
// who comes DOWN onto a rope from above, his feet within its magnet
// (`CABLE.capture`), is put on it and slides it — and nothing else is asked
// of him; and the jump popped right under a rope low enough (`CABLE.ollie`)
// throws him up onto it, the ollie the game's, as a jib's near end is
// ridden onto. A rope is a line, as a jib is (`jib.ts`), so while he is on one
// the step is this module's and he is a bead on a wire.
//
// ON IT. He slides down the rope as a body on an incline: g along it, the
// Coulomb friction of his bases on the steel against the ROPE'S OWN WAY —
// a lift runs, the up rope up the line and the down rope down it, so the
// rope drags whoever is slower than it along with it — and the air's drag.
// The edge TAPPED over swaps him a quarter turn (a 50-50 to a slide and
// back), the lean held hard presses an end of the skis onto it.
//
// OFF IT. The jump let go POPS him off it where he is, on his speed along
// it and `CABLE.pop` up: in the air the strokes and the grabs are his as
// off any lip, and come down onto the rope again he is put back on it and
// the combo goes on (`tricks.ts`). Past the last of the rope before a
// station (`CABLE.ends`) he flies off its end. And a CARRIER — a chair, a
// cabin, a T-bar — come along the rope to him takes his skis off it and
// throws him down onto the snow (the `cable` crash cause).
//
// Nothing here is random and nothing reads a clock but the run's.

import { angleDiff, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { CABLE } from "./defs/cable.ts";
import { TUNING } from "./defs/tuning.ts";
import { carrierAt, carrierCount, liftPlans, ropeAt, upRope } from "./lift-line.ts";
import type { LiftPlan } from "./lift-line.ts";
import { throwRider } from "./crash.ts";
import { derive } from "./skier.ts";
import type { CableRide, GameEvent, GameState, SkierInput } from "./state.ts";

const QUARTER = Math.PI / 2;

/** A turn held to (−π, π]. */
function wrap(a: number): number {
  let r = a % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r <= -Math.PI) r += 2 * Math.PI;
  return r;
}

/** Where a rope runs across the line, m right of it: the up rope (`side`
 * 0) right, the down rope left. */
export function ropeSide(plan: LiftPlan, side: 0 | 1): number {
  return side === 0 ? upRope(plan) : -upRope(plan);
}

/** The rope's rise per metre of plan `u` m up the line. */
function gradeAt(plan: LiftPlan, u: number): number {
  return (ropeAt(plan, u + 0.5) - ropeAt(plan, u - 0.5)) / 1;
}

/** How fast a rope runs, m/s up the line: the up rope up, the down rope
 * down. */
function ropeSpeed(plan: LiftPlan, side: 0 | 1): number {
  return side === 0 ? plan.look.speed : -plan.look.speed;
}

/** THE CABLE'S STEP: onto a rope, along it or off it. "ride" while the step
 * is the rope's — he is on one, and the snow's step must not run;
 * "thrown" the step a carrier threw him off it; null when it is not his. */
export function stepCable(
  run: GameState,
  input: SkierInput,
  events: GameEvent[],
): "ride" | "thrown" | null {
  const c = run.skier;
  if (!run.rules.cables || c.thrown || c.lift || c.jib || run.phase !== "racing") {
    if (c.grind) c.grind = null;
    return null;
  }
  if (!c.grind) return mount(run, events) ? "ride" : null;
  return ride(run, input, events);
}

/** Onto the first rope he has come down onto, if any. */
function mount(run: GameState, events: GameEvent[]): boolean {
  const c = run.skier;
  if (!c.airborne) return false;
  // Coming down onto it — or the jump just popped under it, the ollie up
  // onto it the game's (as a jib's near end is).
  const ollie = c.popped <= CABLE.ollie.after && c.vy > 0;
  if (!ollie && c.vy > CABLE.rising) return false;
  const plans = liftPlans(run.level);
  const feet = c.y - c.spec.cogHeight;
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const b = plan.lift.bottom;
    const rx = c.x - b.x;
    const rz = c.z - b.z;
    const u = rx * plan.dx + rz * plan.dz;
    if (u < CABLE.ends || u > plan.length - CABLE.ends) continue;
    const v = rx * plan.dz - rz * plan.dx;
    for (const side of [0, 1] as const) {
      if (Math.abs(v - ropeSide(plan, side)) > CABLE.capture) continue;
      const over = feet - ropeAt(plan, u);
      const under = ollie ? -CABLE.ollie.reach : -CABLE.below;
      if (over < under || over > CABLE.above) continue;
      put(run, i, plan, side, u, events);
      return true;
    }
  }
  return false;
}

/** ON IT: his speed along the rope kept, his skis to the nearest quarter
 * off the way he slides. */
function put(
  run: GameState,
  index: number,
  plan: LiftPlan,
  side: 0 | 1,
  u: number,
  events: GameEvent[],
): void {
  const c = run.skier;
  const grade = gradeAt(plan, u);
  const cos = 1 / Math.sqrt(1 + grade * grade);
  const along = (c.vx * plan.dx + c.vz * plan.dz) * cos + c.vy * grade * cos;
  const v = along;
  const way = plan.heading + (v < 0 ? Math.PI : 0);
  const off = wrap(angleDiff(way, c.heading));
  const target = Math.round(off / QUARTER) * QUARTER;
  const ride: CableRide = {
    lift: index,
    side,
    u,
    v,
    yaw: off,
    target,
    press: null,
    tapped: false,
    loaded: false,
    time: 0,
  };
  c.grind = ride;
  // Whatever the strokes still owed of the flight onto it dies with it.
  const k = run.tricks;
  k.spinGoal = 0;
  k.flipGoal = 0;
  k.spinDone = 0;
  k.flipDone = 0;
  k.flipSpeed = 0;
  events.push({ kind: "grind", t: run.t, id: plan.lift.id, phase: "on" });
  hold(run, plan, ride, 0);
}

/** One step along it. */
function ride(run: GameState, input: SkierInput, events: GameEvent[]): "ride" | "thrown" | null {
  const c = run.skier;
  const r = c.grind as CableRide;
  const plan = liftPlans(run.level)[r.lift];
  if (!plan) {
    c.grind = null;
    return null;
  }
  const dt = TUNING.dt;
  const grade = gradeAt(plan, r.u);
  const cos = 1 / Math.sqrt(1 + grade * grade);
  const sin = grade * cos;
  // THE SLIDE: g down the rope, the drag of the running rope through the
  // friction of his bases, the air.
  const g = TUNING.g;
  const was = r.v;
  r.v -= g * sin * dt;
  const slip = r.v - ropeSpeed(plan, r.side);
  const grip = CABLE.friction * g * cos * dt;
  r.v -= Math.abs(slip) <= grip ? slip : Math.sign(slip) * grip;
  const drag = (0.5 * TUNING.airDensity * CABLE.drag) / CABLE.mass;
  r.v -= Math.sign(r.v) * drag * r.v * r.v * dt;
  // Turned back the other way along it by the rope, his skis stay where
  // they were: the way he slides is half a turn round.
  if (Math.sign(r.v) !== Math.sign(was) && was !== 0 && r.v !== 0) {
    r.yaw = wrap(r.yaw + Math.PI);
    r.target = wrap(r.target + Math.PI);
  }
  r.u += r.v * cos * dt;
  r.time += dt;
  // THE SWAP: the edge tapped over turns him a quarter on it.
  const over = Math.abs(input.steer) >= CABLE.tap;
  if (over && !r.tapped) r.target += Math.sign(input.steer) * QUARTER;
  r.tapped = over;
  // THE PRESS: the lean held hard, an end of the skis on it.
  r.press = input.lean >= CABLE.press ? "tail" : input.lean <= -CABLE.press ? "nose" : null;
  r.yaw += clamp(r.target - r.yaw, -CABLE.rate * dt, CABLE.rate * dt);
  // A CARRIER come along the rope to him: his skis taken, he is thrown.
  const hit = carrierOn(run, plan, r);
  if (hit !== null) {
    hold(run, plan, r, 0);
    const shove = (hit - r.v) * CABLE.shove * cos;
    c.grind = null;
    events.push({ kind: "grind", t: run.t, id: plan.lift.id, phase: "off" });
    throwRider(
      run,
      "cable",
      { x: c.vx + plan.dx * shove, y: c.vy, z: c.vz + plan.dz * shove },
      events,
    );
    return "thrown";
  }
  const jumped = r.loaded && !input.jump;
  r.loaded = input.jump === true;
  const end = r.u < CABLE.ends || r.u > plan.length - CABLE.ends;
  if (jumped || end) {
    // Off it: the skis come off it as they stood, straight onto the way he
    // slides, and popped, up off it.
    hold(run, plan, { ...r, yaw: Math.round(r.target / QUARTER) * QUARTER }, 0);
    if (jumped) c.vy += CABLE.pop;
    c.y += 0.02;
    c.airborne = true;
    c.grind = null;
    events.push({ kind: "grind", t: run.t, id: plan.lift.id, phase: "off" });
    derive(c, run.level);
    return "ride";
  }
  hold(run, plan, r, r.press === "nose" ? -1 : r.press === "tail" ? 1 : 0);
  return "ride";
}

/** The speed of a carrier on his rope within reach of him, m/s up the
 * line, or null when none is. */
function carrierOn(run: GameState, plan: LiftPlan, r: CableRide): number | null {
  const n = carrierCount(plan);
  for (let k = 0; k < n; k++) {
    const at = carrierAt(plan, k, run.t);
    if (!at.out || at.side !== r.side) continue;
    if (Math.abs(at.u - r.u) <= CABLE.reach) return ropeSpeed(plan, r.side);
  }
  return null;
}

/** The skier where the ride has him: on the rope, his skis at its turn,
 * the bases flat on it. */
function hold(run: GameState, plan: LiftPlan, r: CableRide, pressing: number): void {
  const c = run.skier;
  const b = plan.lift.bottom;
  const off = ropeSide(plan, r.side);
  const grade = gradeAt(plan, r.u);
  const cos = 1 / Math.sqrt(1 + grade * grade);
  const s = r.v < 0 ? -1 : 1;
  // The rope's fall the way he slides, rad (downhill positive).
  const fall = Math.atan(-grade * s);
  c.x = b.x + plan.dx * r.u + plan.dz * off;
  c.z = b.z + plan.dz * r.u - plan.dx * off;
  c.y = ropeAt(plan, r.u) + c.spec.cogHeight;
  const horiz = r.v * cos;
  c.vx = plan.dx * horiz;
  c.vz = plan.dz * horiz;
  c.vy = r.v * grade * cos;
  const way = plan.heading + (s < 0 ? Math.PI : 0);
  c.q = fromEuler(way + r.yaw, -fall * Math.cos(r.yaw) + pressing * 0.15, -fall * Math.sin(r.yaw));
  c.wx = c.wy = c.wz = 0;
  c.airborne = false;
  c.airTime = 0;
  c.edge = 0;
  c.skid = 0;
  c.sideSlip = 0;
  c.carve = 0;
  c.bodyHit = 0;
  c.rolledFor = 0;
  c.switched = Math.cos(r.yaw) < -0.5;
  for (const contact of c.contacts) {
    contact.touching = false;
    contact.load = 0;
  }
  derive(c, run.level);
}

/** Where a rope runs `u` m up a lift's line, m: its point and its height
 * over the sea — what a lab stands a skier over. */
export function ropeOver(
  plan: LiftPlan,
  side: 0 | 1,
  u: number,
): { x: number; y: number; z: number } {
  const b = plan.lift.bottom;
  const off = ropeSide(plan, side);
  return {
    x: b.x + plan.dx * u + plan.dz * off,
    y: ropeAt(plan, u),
    z: b.z + plan.dz * u - plan.dx * off,
  };
}

/** How far up a lift's line the rope stands lowest over the snow, m — and
 * how high there, m: where a skier reaches it most easily. */
export function lowestRope(
  run: GameState,
  plan: LiftPlan,
  side: 0 | 1,
): { u: number; clear: number } {
  let best = { u: CABLE.ends, clear: Infinity };
  for (let u = CABLE.ends; u <= plan.length - CABLE.ends; u += 2) {
    const at = ropeOver(plan, side, u);
    const clear = at.y - run.level.groundAt(at.x, at.z);
    if (clear < best.clear) best = { u, clear };
  }
  return best;
}
