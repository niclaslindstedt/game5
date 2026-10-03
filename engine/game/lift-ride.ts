// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFT RIDE — on a free ride (`RunRules.lifts`), a skier who rides into
// a lift's LOAD ZONE at its bottom station is carried to its top
// (`docs/summit-stations.md`). Each kind is boarded the way it is on a
// mountain (`LIFT_LOOK[kind].entry`, `lift-line.ts`):
//
//   * a CHAIR from the load line under its up rope: he is taken out onto
//     it facing up the line, the chair scoops him from behind and he rides
//     it seated, swinging on its hanger — a lurch as his grip runs over
//     each tower's sheaves, and forward as the chair slows into the top
//     terminal — and is stood up at the unload point over the ramp on the
//     station's pad (R26) with the chair's way under him;
//   * a GONDOLA through the door at the back of its station house: he goes
//     in and rides in a cabin, and walks out of the top station onto its
//     pad facing back down the mountain;
//   * a DRAG from the head of its track: the bar put behind his thighs, he
//     is pulled up the track standing on his skis and let go short of the
//     top wheel.
//
// A FREE RIDE BEGINS ON ONE (`arriveByLift`): seated a span or two below the
// top of the chair whose run passes nearest the spot the skier picked, and,
// once stood off it, LED off the pad toward that run and over its lip
// (`leadInput`) until he touches a control — then the skis are his.
//
// Pure over the level, the plan and the clock: nothing here draws from the
// stream, and a run whose rules carry no lifts never comes in here.

import { angleDiff, clamp, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { standSkier } from "./course.ts";
import { TUNING } from "./defs/tuning.ts";
import { liftPlans, ropeAt, upRope, type LiftPlan } from "./lift-line.ts";
import { derive } from "./skier.ts";
import type { GameEvent, GameState, LiftRide, SkierInput } from "./state.ts";

const K = TUNING.lift;

/** A point `u` m of plan up a lift's line and `side` m right of it. */
function along(plan: LiftPlan, u: number, side: number): { x: number; z: number } {
  return {
    x: plan.lift.bottom.x + plan.dx * u + plan.dz * side,
    z: plan.lift.bottom.z + plan.dz * u - plan.dx * side,
  };
}

/** Where along the line a carrier is let go of: a chair's over the ramp, a
 * drag's short of its wheel, a gondola's cabin into its top station. */
function offAt(plan: LiftPlan): number {
  return plan.length - plan.look.off;
}

/** The skier stood at a plan point and heading, moving `way` m/s along
 * `heading` — `standSkier`'s rest with a way kept. */
function setOff(run: GameState, x: number, z: number, heading: number, way: number): void {
  standSkier(run, x, z, heading);
  const c = run.skier;
  c.vx = Math.sin(heading) * way;
  c.vz = Math.cos(heading) * way;
  derive(c, run.level);
}

/** ONE STEP OF THE LIFT, before the skier is stepped: taken into a load
 * zone, taken to the carrier, carried, or stood off at the top. True while
 * the lift has him — the step is the lift's, and the snow, the trees and
 * the clock wait. `events` is the run's own list. */
export function stepLift(run: GameState, input: SkierInput, events: GameEvent[]): boolean {
  const c = run.skier;
  const ride = c.lift;
  if (!ride) {
    if (run.rules.lifts) boardLift(run, events);
    return c.lift !== null;
  }
  if (ride.phase === "lead") return false;
  const plan = liftPlans(run.level)[ride.index];
  if (!plan) {
    c.lift = null;
    return false;
  }
  ride.t += TUNING.dt;
  if (input.reset) {
    // A skier who will not wait is put at the top.
    ride.phase = "ride";
    ride.u = offAt(plan);
    ride.speed = plan.look.slow;
    ride.swing = 0;
    ride.swingRate = 0;
    ride.tower = plan.supports.length;
  }
  if (ride.phase === "board") {
    stepBoard(run, plan, ride);
    return true;
  }
  // The step he is stood off at the top is the lift's too.
  stepCarried(run, plan, ride, events);
  return true;
}

/** Into a load zone: inside it, slow enough and facing up the line. */
function boardLift(run: GameState, events: GameEvent[]): void {
  const c = run.skier;
  if (c.thrown || c.airborne || c.tunnel) return;
  const plans = liftPlans(run.level);
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const e = plan.look.entry;
    const rx = c.x - plan.lift.bottom.x;
    const rz = c.z - plan.lift.bottom.z;
    const u = rx * plan.dx + rz * plan.dz;
    const v = rx * plan.dz - rz * plan.dx;
    if (Math.abs(u - e.at) > e.along || Math.abs(v - e.side) > e.across) continue;
    if (c.speed > e.fastest || Math.abs(angleDiff(c.heading, plan.heading)) > e.turned) continue;
    c.lift = {
      index: i,
      id: plan.lift.id,
      kind: plan.lift.kind,
      phase: "board",
      u: plan.lift.kind === "gondola" ? 0 : e.at,
      speed: 0,
      swing: 0,
      swingRate: 0,
      t: 0,
      tower: 1,
      from: { x: c.x, y: Number.NaN, z: c.z, heading: c.heading },
      lead: null,
    };
    events.push({ kind: "lift", t: run.t, id: plan.lift.id, lift: plan.lift.kind, phase: "board" });
    return;
  }
}

/** Taken from where he came into the zone to the carrier: out onto a
 * chair's load line or a drag's track under its rope, or in at a gondola
 * station's door. */
function stepBoard(run: GameState, plan: LiftPlan, ride: LiftRide): void {
  const e = plan.look.entry;
  const to =
    plan.lift.kind === "gondola" ? along(plan, e.at, 0) : along(plan, ride.u, upRope(plan));
  const k = smoothstep(0, 1, Math.min(1, ride.t / e.board));
  const k0 = smoothstep(0, 1, Math.min(1, (ride.t - TUNING.dt) / e.board));
  const x = ride.from.x + (to.x - ride.from.x) * k;
  const z = ride.from.z + (to.z - ride.from.z) * k;
  const heading = ride.from.heading + angleDiff(ride.from.heading, plan.heading) * k;
  const way = (hypot(to.x - ride.from.x, to.z - ride.from.z) * (k - k0)) / TUNING.dt;
  setOff(run, x, z, heading, way);
  if (ride.t >= e.board) {
    ride.phase = "ride";
    ride.t = 0;
    ride.speed = plan.look.slow;
    const c = run.skier;
    ride.from = { x: c.x, y: c.y, z: c.z, heading: plan.heading };
  }
}

/** Carried: the grip up the rope at the rope's speed — slowed through the
 * terminal at the top — the chair or the cabin swinging on its hanger, and
 * let go of at the top. */
function stepCarried(run: GameState, plan: LiftPlan, ride: LiftRide, events: GameEvent[]): void {
  const c = run.skier;
  const dt = TUNING.dt;
  const look = plan.look;
  const off = offAt(plan);
  const togo = Math.max(0, off - ride.u);
  const want = Math.min(look.speed, Math.sqrt(look.slow ** 2 + 2 * K.decel * togo));
  const was = ride.speed;
  ride.speed = Math.min(want, ride.speed + K.accel * dt);
  ride.u = Math.min(off, ride.u + ride.speed * dt);
  // Over a tower's sheaves the grip's way bends with the rope: the carrier
  // swings off it — forward over a crest, back through a sag.
  const s = plan.supports;
  while (ride.tower < s.length - 1 && s[ride.tower].u <= ride.u) {
    const at = s[ride.tower].u;
    const before = (ropeAt(plan, at) - ropeAt(plan, at - K.bend)) / K.bend;
    const after = (ropeAt(plan, at + K.bend) - ropeAt(plan, at)) / K.bend;
    ride.swingRate += clamp(K.kick * (before - after), -K.kickMost, K.kickMost);
    ride.tower++;
    events.push({ kind: "lift", t: run.t, id: plan.lift.id, lift: plan.lift.kind, phase: "tower" });
  }
  if (plan.lift.kind === "drag") {
    // Pulled up the track on his skis.
    const p = along(plan, ride.u, upRope(plan));
    setOff(run, p.x, p.z, plan.heading, ride.speed);
  } else {
    // THE HANGER as a pendulum off a grip that is slowed and bent: its foot
    // swung forward by the grip's slowing, levelled by g, damped.
    const hang = plan.lift.kind === "gondola" ? K.cabinHang : K.chairHang;
    const ahead = (ride.speed - was) / dt;
    const acc =
      (-TUNING.g * Math.sin(ride.swing) - ahead * Math.cos(ride.swing)) / hang -
      K.damp * ride.swingRate;
    ride.swingRate += acc * dt;
    ride.swing = clamp(ride.swing + ride.swingRate * dt, -K.swingMost, K.swingMost);
    hold(run, plan, ride);
  }
  if (ride.u < off) return;
  // AT THE TOP.
  events.push({ kind: "lift", t: run.t, id: plan.lift.id, lift: plan.lift.kind, phase: "off" });
  if (plan.lift.kind === "gondola") {
    // Out of the top station's front onto its pad, facing down the line.
    const p = along(plan, plan.length - K.door, 0);
    setOff(run, p.x, p.z, plan.heading + Math.PI, K.walkOut);
  } else if (plan.lift.kind === "chair") {
    // Down the ramp on the diagonal, off to the up rope's side, clear of
    // the chairs swinging round the wheel.
    const p = along(plan, off, upRope(plan));
    setOff(run, p.x, p.z, plan.heading + K.ramp, K.standUp);
  }
  if (ride.lead && joinRun(run, ride.lead)) {
    ride.phase = "lead";
    ride.t = 0;
  } else c.lift = null;
}

/** Where the lead joins the run picked (`joinOf` from where he stands), and
 * how far down it it hands the controls back. False where it joins none. */
function joinRun(run: GameState, lead: NonNullable<LiftRide["lead"]>): boolean {
  const c = run.skier;
  const r = run.level.resort?.runs[lead.run];
  const join = r ? joinOf(r.points, c.x, c.y - c.spec.cogHeight, c.z) : null;
  if (!join) return false;
  lead.s = join.s;
  lead.until = Math.max(lead.until, join.s + K.leadNear);
  return true;
}

/** WHERE A RUN IS JOINED from a station's pad at (x, y, z): its nearest
 * point in plan lying `lift.drop` m or more below the pad — a run off a top
 * may start along the contour above it, and a skier is led DOWN onto it,
 * over the pad's lip — within `lift.joinFar` m; null where none is. */
function joinOf(
  points: readonly { x: number; y: number; z: number; s: number }[],
  x: number,
  y: number,
  z: number,
): { s: number; distance: number } | null {
  let best: { s: number; distance: number } | null = null;
  for (const p of points) {
    if (p.y > y - K.drop) continue;
    const d = hypot(p.x - x, p.z - z);
    if (d <= K.joinFar && (!best || d < best.distance)) best = { s: p.s, distance: d };
  }
  return best;
}

/** The rider where his carrier holds him: on a chair's seat, in a cabin —
 * the body's origin `seat` (or `cabin`) m down the hanger from the grip,
 * the hanger swung `swing` about the rope, the body pitched with it. */
function hold(run: GameState, plan: LiftPlan, ride: LiftRide): void {
  const c = run.skier;
  const grip = along(plan, ride.u, upRope(plan));
  const gy = ropeAt(plan, ride.u);
  const drop = plan.lift.kind === "gondola" ? K.cabin : K.seat;
  let x = grip.x + plan.dx * Math.sin(ride.swing) * drop;
  let z = grip.z + plan.dz * Math.sin(ride.swing) * drop;
  let y = gy - Math.cos(ride.swing) * drop;
  // Scooped off the load line: lifted from where he stood onto the seat.
  const k = seatedShare(ride);
  if (k < 1) {
    x = ride.from.x + (x - ride.from.x) * k;
    z = ride.from.z + (z - ride.from.z) * k;
    y = ride.from.y + (y - ride.from.y) * k;
  }
  const dt = TUNING.dt;
  const fresh = ride.phase === "ride" && ride.t <= dt && k >= 1;
  c.vx = fresh ? plan.dx * ride.speed : (x - c.x) / dt;
  c.vy = fresh ? 0 : (y - c.y) / dt;
  c.vz = fresh ? plan.dz * ride.speed : (z - c.z) / dt;
  c.x = x;
  c.y = y;
  c.z = z;
  c.q = fromEuler(plan.heading, ride.swing, 0);
  c.wx = c.wy = c.wz = 0;
  c.airborne = false;
  for (const contact of c.contacts) {
    contact.touching = false;
    contact.load = 0;
  }
  derive(c, run.level);
}

/** HOW SEATED a rider is, 0 stood on the load line … 1 sat on his carrier:
 * a chair scoops him up over `lift.scoop` s; every other carrier, and a
 * ride not boarded from the snow, has him at once. The pose reads it. */
export function seatedShare(ride: LiftRide): number {
  if (ride.phase === "board") return 0;
  if (ride.phase === "lead" || !Number.isFinite(ride.from.y)) return 1;
  return smoothstep(0, 1, Math.min(1, ride.t / K.scoop));
}

/** Whether the player has a hand on the controls. */
function touched(input: SkierInput): boolean {
  return (
    Math.abs(input.steer) > K.touch ||
    input.tuck > K.touch ||
    input.brake > K.touch ||
    Math.abs(input.lean) > K.touch * 2 ||
    !!input.jump ||
    !!input.carve ||
    input.reset
  );
}

/** THE LEAD off the free ride's lift: the input the skier is given toward
 * the run he picked — out over the pad and its lip and down onto the run
 * where it joins it (`joinRun`), then along it — until
 * he takes the controls, or is far enough down it, or long enough off the
 * chair; then his own. */
export function leadInput(run: GameState, input: SkierInput, events: GameEvent[]): SkierInput {
  const c = run.skier;
  const ride = c.lift;
  if (!ride || ride.phase !== "lead" || !ride.lead) return input;
  const r = run.level.resort?.runs[ride.lead.run];
  ride.t += TUNING.dt;
  const free = (): SkierInput => {
    c.lift = null;
    events.push({ kind: "lift", t: run.t, id: ride.id, lift: ride.kind, phase: "free" });
    return input;
  };
  if (!r || touched(input) || c.thrown || ride.t > K.leadFor) return free();
  // His place along the run, looked for about the last.
  const pts = r.points;
  let best = Infinity;
  let s = ride.lead.s;
  for (const p of pts) {
    if (p.s < ride.lead.s - K.back || p.s > ride.lead.s + K.window) continue;
    const d = hypot(p.x - c.x, p.z - c.z);
    if (d < best) {
      best = d;
      s = p.s;
    }
  }
  // Only ever on down it: a skier turning about on the pad is not sent
  // back up it.
  ride.lead.s = Math.max(ride.lead.s, s);
  if (ride.lead.s >= ride.lead.until) return free();
  const want = ride.lead.s + K.aim;
  const aim = pts.find((p) => p.s >= want) ?? pts[pts.length - 1];
  const bearing = Math.atan2(aim.x - c.x, aim.z - c.z);
  return {
    steer: clamp(angleDiff(c.heading, bearing) * K.steer, -1, 1),
    // At a crawl the tuck is the poles pushing him on (`poles.ts`).
    tuck: c.speed < K.push ? 1 : 0.25,
    brake: 0,
    lean: 0,
    reset: false,
  };
}

/** A FREE RIDE STARTED ON A LIFT: the chair whose run (R27) passes nearest
 * the spot (x, z) picked, the skier seated on it a span or two below its
 * top and led, once off it, toward that run as far down it as the spot (in
 * `lead.near`..`lead.far` of it). False where the map has no chair to ride
 * — a map from before the resorts. */
export function arriveByLift(run: GameState, x: number, z: number): boolean {
  const resort = run.level.resort;
  if (!resort) return false;
  const plans = liftPlans(run.level);
  // The run passing nearest the spot among those a rider stood off its
  // chair drops onto (`joinOf`); the nearest of any where none does.
  let pick = -1;
  let lift = -1;
  let cost = Infinity;
  let at = 0;
  resort.runs.forEach((r, i) => {
    if (r.kind !== "piste") return;
    const l = plans.findIndex((p) => p.lift.id === r.from);
    if (l < 0 || plans[l].lift.kind !== "chair") return;
    const top = plans[l].lift.top;
    const joins = joinOf(r.points, top.x, top.y, top.z) !== null;
    for (const p of r.points) {
      const d = hypot(p.x - x, p.z - z) + (joins ? 0 : K.noJoin);
      if (d < cost) {
        cost = d;
        pick = i;
        lift = l;
        at = p.s;
      }
    }
  });
  if (pick < 0) return false;
  const plan = plans[lift];
  const s = plan.supports;
  const last = s.length > 2 ? s[s.length - 2].u : 0;
  const u = clamp(last - K.before, plan.length - K.rideMost, plan.length - K.rideLeast);
  const c = run.skier;
  c.lift = {
    index: lift,
    id: plan.lift.id,
    kind: "chair",
    phase: "ride",
    u: Math.max(plan.look.entry.at, u),
    speed: plan.look.speed,
    swing: 0,
    swingRate: 0,
    t: 0,
    tower: Math.max(
      1,
      s.findIndex((p) => p.u > u),
    ),
    from: { x: c.x, y: Number.NaN, z: c.z, heading: plan.heading },
    lead: { run: pick, s: 0, until: clamp(at, K.leadNear, K.leadFar) },
  };
  hold(run, plan, c.lift);
  return true;
}
