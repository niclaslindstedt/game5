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
// A FREE RIDE BEGINS ON ONE (`arriveByLift`): the last few seconds of the
// ride up the lift serving the run it is to start down, the top close
// ahead — the run picked on the start card, or the first of the colour
// asked (`freeRunOf`), on whatever lift leaves that run's top. Stood off it,
// the skis are his: nothing steers him off a top. Every run off it lies
// under it, with a ramp down to it from the pad's rim (R26, R27), and the
// signs at the ramps' heads (`signsOf`) are all he follows.
//
// Pure over the level, the plan and the clock: nothing here draws from the
// stream, and a run whose rules carry no lifts never comes in here.

import { angleDiff, clamp, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { standSkier } from "./course.ts";
import { TUNING } from "./defs/tuning.ts";
import { liftPlans, ropeAt, upRope, type LiftPlan } from "./lift-line.ts";
import type { PisteGrade } from "../mapgen/grades.ts";
import { generatorTraits } from "../mapgen/versions.ts";
import type { Level, Run, SummitRamp } from "../mapgen/types.ts";
import { derive } from "./skier.ts";
import { type GameEvent, type GameState, type LiftRide, type SkierInput } from "./state.ts";

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
  // Stood off it, the skis are his.
  c.lift = null;
}

/** WHERE A RUN IS JOINED from a top at (x, y, z) with no ramp off it — a
 * drag's, or a level pad's from before the ramps: its nearest point in plan
 * lying `lift.drop` m or more below the top, within `lift.joinFar` m; null
 * where none is. */
function joinOf(
  points: readonly { x: number; y: number; z: number; s: number }[],
  x: number,
  y: number,
  z: number,
): { s: number; x: number; z: number; distance: number } | null {
  let best: { s: number; x: number; z: number; distance: number } | null = null;
  for (const p of points) {
    if (p.y > y - K.drop) continue;
    const d = hypot(p.x - x, p.z - z);
    if (d <= K.joinFar && (!best || d < best.distance))
      best = { s: p.s, x: p.x, z: p.z, distance: d };
  }
  return best;
}

/** THE RUNS A RIDER STOOD OFF A LIFT'S TOP CAN SKI ONTO, each with the way
 * he goes for it and the arc he joins it at: off a leaning pad (R26) every
 * run a ramp comes down to (`Lift.ramps` — from the ramp's head on the
 * pad's rim, falling all the way); off a drag's top, or a pad of v4's or
 * v5's, every run a ramp comes down to and every other leaving it that
 * drops below it near enough (`joinOf`, the point it is joined at). A lane off the top that starts up
 * the contour above it is none of them. What the signs at a top point at,
 * and what a free ride's arrival picks its chair by. */
export function runsOffTop(
  level: Level,
  plan: LiftPlan,
): { run: number; at: { x: number; z: number; s: number } }[] {
  const top = plan.lift.top;
  const old = generatorTraits(level.version);
  const ramped = plan.lift.kind !== "drag" && !old.levelPads && !old.looseTops;
  const out: { run: number; at: { x: number; z: number; s: number } }[] = [];
  (level.resort?.runs ?? []).forEach((r, i) => {
    if (r.from !== plan.lift.id) return;
    const ramp = rampOf(plan, r.id);
    const j = ramp
      ? { x: ramp.from.x, z: ramp.from.z, s: ramp.to.s }
      : ramped
        ? null
        : joinOf(r.points, top.x, top.y, top.z);
    if (j) out.push({ run: i, at: { x: j.x, z: j.z, s: j.s } });
  });
  return out;
}

/** The ramp down off a lift's top to a run (R26, `Lift.ramps`), if it has
 * one: where a rider stood off it skis down to that run. */
function rampOf(plan: LiftPlan, run: string): SummitRamp | undefined {
  return plan.lift.ramps?.find((q) => q.run === run);
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
  // Coming down to the ramp a chair carries him on the snow, never in it.
  if (plan.lift.kind === "chair") y = Math.max(y, run.level.groundAt(x, z) + K.sit);
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
  // Sat on the seat he is inclined to nothing: the snow passing under the
  // chair is not under his skis, and its cross-slope read as his lean
  // would turn the figure about its feet (`ski-stand.ts`) — the rider
  // sliding across the seat as the slope below him changes.
  c.incline *= 1 - k;
}

/** HOW SEATED a rider is, 0 stood on the load line … 1 sat on his carrier:
 * a chair scoops him up over `lift.scoop` s; every other carrier, and a
 * ride not boarded from the snow, has him at once. The pose reads it. */
export function seatedShare(ride: LiftRide): number {
  if (ride.phase === "board") return 0;
  if (!Number.isFinite(ride.from.y)) return 1;
  return smoothstep(0, 1, Math.min(1, ride.t / K.scoop));
}

/** THE RUNS A FREE RIDE CAN BE CARRIED TO THE TOP OF: every piste of the
 * ski area (R27) leaving the top of a lift, in the order of their ids —
 * the order the piste map numbers them in. Empty off a resort. */
export function freeRuns(level: Level): Run[] {
  const resort = level.resort;
  if (!resort) return [];
  return resort.runs
    .filter((r) => r.kind === "piste" && resort.lifts.some((l) => l.id === r.from))
    .sort((a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id));
}

/** WHICH RUN A FREE RIDE BY LIFT STARTS DOWN, by id, of `runs` (the ski
 * area's {@link freeRuns}, or any list in their order): `run` where it is
 * one of them; else the first of them in `grade`, where any is; else
 * `fallback` — the first run of the course the map is raced on (R28). A
 * colour asked for is a run of that colour even where no course of it
 * reaches the valley — the map's own course is only the nearest colour
 * (`chooseCourse`). The start card asks it of the runs its chart was sent,
 * the engine of the map. */
export function pickFreeRun(
  runs: readonly { id: string; grade: PisteGrade }[],
  ask: { run?: string | null; grade?: PisteGrade | null },
  fallback: string | undefined,
): string | undefined {
  if (ask.run != null && runs.some((r) => r.id === ask.run)) return ask.run;
  return runs.find((r) => r.grade === ask.grade)?.id ?? fallback;
}

/** {@link pickFreeRun} on `level`'s ski area; undefined off a resort. */
export function freeRunOf(
  level: Level,
  ask: { run?: string; grade?: PisteGrade },
): string | undefined {
  const resort = level.resort;
  if (!resort) return undefined;
  const course = resort.courses.find((c) => c.id === resort.course);
  return pickFreeRun(freeRuns(level), ask, course?.runs[0]);
}

/** WHERE A FREE RIDE'S LIFT RIDE STARTS: `lift.arrive` s of carrying short
 * of where the carrier lets him go, and the rope's speed there — the climb
 * the carrier makes (`stepCarried`: the rope's speed, slowed into the top
 * terminal) walked back from the let-go point a step at a time, so the
 * ride that follows takes those seconds to the step. Never below the load
 * zone, on a lift shorter than that. */
export function arrivalOf(plan: LiftPlan): { u: number; speed: number } {
  const off = offAt(plan);
  const least = plan.look.entry.at;
  const want = (togo: number): number =>
    Math.min(plan.look.speed, Math.sqrt(plan.look.slow ** 2 + 2 * K.decel * togo));
  let togo = 0;
  for (let t = 0; t < K.arrive && off - togo > least; t += TUNING.dt)
    togo += want(togo) * TUNING.dt;
  const u = Math.max(least, off - togo);
  return { u, speed: want(off - u) };
}

/** A FREE RIDE STARTED ON A LIFT: the skier carried the last few seconds
 * up the lift (`arrivalOf`) whose run (R27) is to be skied — the run `pin`
 * by id where one is named, on whatever lift leaves its top, a chair, a
 * gondola or a drag, and otherwise the chair-served run passing nearest
 * the spot (x, z) among those a rider stood off it can ski onto
 * (`runsOffTop`). Stood off at the top he skis to it himself, down its
 * ramp past its sign. The run's id; null where the map has no such lift
 * to ride — a map from before the resorts. */
export function arriveByLift(run: GameState, x: number, z: number, pin?: string): string | null {
  const resort = run.level.resort;
  if (!resort) return null;
  if (pin !== undefined && !resort.runs.some((r) => r.id === pin && r.kind === "piste")) {
    pin = undefined;
  }
  const plans = liftPlans(run.level);
  const off = new Map(plans.map((p) => [p, new Set(runsOffTop(run.level, p).map((j) => j.run))]));
  let pick = -1;
  let lift = -1;
  let cost = Infinity;
  resort.runs.forEach((r, i) => {
    if (r.kind !== "piste" || (pin !== undefined && r.id !== pin)) return;
    const l = plans.findIndex((p) => p.lift.id === r.from);
    if (l < 0 || (pin === undefined && plans[l].lift.kind !== "chair")) return;
    const joins = off.get(plans[l])?.has(i) ?? false;
    for (const p of r.points) {
      const d = hypot(p.x - x, p.z - z) + (joins ? 0 : K.noJoin);
      if (d < cost) {
        cost = d;
        pick = i;
        lift = l;
      }
    }
  });
  if (pick < 0) return pin !== undefined ? arriveByLift(run, x, z) : null;
  const plan = plans[lift];
  const s = plan.supports;
  const { u, speed } = arrivalOf(plan);
  const c = run.skier;
  c.lift = {
    index: lift,
    id: plan.lift.id,
    kind: plan.lift.kind,
    phase: "ride",
    u,
    speed,
    swing: 0,
    swingRate: 0,
    t: 0,
    tower: Math.max(
      1,
      s.findIndex((p) => p.u > u),
    ),
    from: { x: c.x, y: Number.NaN, z: c.z, heading: plan.heading },
  };
  if (plan.lift.kind === "drag") {
    // On a drag he is pulled up the track on his skis.
    const p = along(plan, c.lift.u, upRope(plan));
    setOff(run, p.x, p.z, plan.heading, c.lift.speed);
  } else hold(run, plan, c.lift);
  return resort.runs[pick].id;
}
