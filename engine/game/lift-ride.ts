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
// A FREE RIDE BEGINS ON ONE (`arriveByLift`): a span or two below the top of
// the lift serving the run it is to start down — the first run of the course
// its colour chose, on whatever lift leaves that run's top — and, once off
// it, LED off the pad toward that run and over its lip (`leadInput`) until he
// touches a control — then the skis are his.
//
// Pure over the level, the plan and the clock: nothing here draws from the
// stream, and a run whose rules carry no lifts never comes in here.

import { angleDiff, clamp, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { standSkier } from "./course.ts";
import { TUNING } from "./defs/tuning.ts";
import {
  chairLane,
  liftPlans,
  ropeAt,
  stationHouses,
  upRope,
  type LiftPlan,
  type StationHouse,
} from "./lift-line.ts";
import type { Level } from "../mapgen/types.ts";
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
  const y = c.y - c.spec.cogHeight;
  // A run starting further off along the contour (a gondola's or a drag's,
  // pinned by its colour) is made for from farther — at its head, the first
  // of it below the pad, never its nearest point a long way down it.
  const join = r ? (joinOf(r.points, c.x, y, c.z) ?? headOf(r.points, c.x, y, c.z)) : null;
  if (!join) return false;
  lead.s = join.s;
  lead.until = Math.max(lead.until, join.s + K.leadNear);
  // Time to cross the pad to a run that starts beyond the near reach.
  lead.time = K.leadFor + Math.max(0, join.distance - K.joinFar) / K.leadPace;
  return true;
}

/** WHERE A RUN STARTING FAR OFF THE PAD IS JOINED from (x, y, z): the first
 * point of it lying `lift.drop` m or more below the pad within
 * `lift.joinReach` m; null where none is. */
function headOf(
  points: readonly { x: number; y: number; z: number; s: number }[],
  x: number,
  y: number,
  z: number,
): { s: number; distance: number } | null {
  for (const p of points) {
    if (p.y > y - K.drop) continue;
    const d = hypot(p.x - x, p.z - z);
    if (d <= K.joinReach) return { s: p.s, distance: d };
  }
  return null;
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
 * the run he picked — off a chair straight on down the lane to the parting
 * (`laneAim`), then across the pad and over its lip, round any station
 * house, down onto the run where it joins it (`joinRun`), then along it —
 * until
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
  if (!r || touched(input) || c.thrown || ride.t > ride.lead.time) return free();
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
  // back up it — and only once he is on it, not while he is still making
  // for a run that starts far off the pad, whose nearest point in the
  // window is its far end.
  if (best < K.window) ride.lead.s = Math.max(ride.lead.s, s);
  if (ride.lead.s >= ride.lead.until) return free();
  const want = ride.lead.s + K.aim;
  const lane = laneAim(run, ride);
  const aim =
    lane ?? round(run.level, c.x, c.z, pts.find((p) => p.s >= want) ?? pts[pts.length - 1]);
  const bearing = Math.atan2(aim.x - c.x, aim.z - c.z);
  // Down the lane and across the pad at a glide, checked to `laneSpeed`
  // for the turn at the parting and round the station; then on, over the
  // lip. At a crawl the tuck is the poles pushing him on (`poles.ts`).
  const top = liftPlans(run.level)[ride.index].lift.top;
  const near = lane || hypot(c.x - top.x, c.z - top.z) < K.padNear;
  const most = near ? K.laneSpeed : Infinity;
  const off = angleDiff(c.heading, bearing);
  return {
    steer: clamp(off * K.steer, -1, 1),
    tuck: c.speed < (near ? K.lanePush : K.push) ? 1 : 0.25,
    brake: clamp(c.speed - most, 0, 1),
    lean: 0,
    reset: false,
    // Round the station's corners the edge is cut harder.
    carve: near && Math.abs(off) > K.cutHarder,
  };
}

/** OFF A CHAIR, DOWN THE LANE (`chairLane`): while he is short of the
 * parting, the point `lift.laneAim` m on down the lane ahead of him —
 * straight on off the ramp past the house — and null from there on, or
 * anywhere out of the lane (`laneWide` m either side of it), where the
 * lead turns him for his run, the way the signs point. */
function laneAim(run: GameState, ride: LiftRide): { x: number; z: number } | null {
  if (ride.kind !== "chair") return null;
  const plan = liftPlans(run.level)[ride.index];
  const c = run.skier;
  const u = (c.x - plan.lift.bottom.x) * plan.dx + (c.z - plan.lift.bottom.z) * plan.dz;
  const v = (c.x - plan.lift.bottom.x) * plan.dz - (c.z - plan.lift.bottom.z) * plan.dx;
  const lane = chairLane(plan);
  // In the lane: between the unload and the parting, and in its width.
  const inLane = Math.abs(v - lane.v) < K.laneWide && u > offAt(plan) - K.laneWide;
  if (!inLane || u >= lane.exit - K.turnIn) return null;
  return along(plan, Math.min(u + K.laneAim, lane.exit + K.laneAim / 2), lane.v);
}

/** Every station house of a map, once per map: the lead steers round them. */
const housesOf = new WeakMap<Level, StationHouse[]>();

function houses(level: Level): StationHouse[] {
  let all = housesOf.get(level);
  if (!all) {
    all = liftPlans(level).flatMap((p) => stationHouses(level, p));
    housesOf.set(level, all);
  }
  return all;
}

/** THE WAY ROUND A STATION: `aim` as the lead heads for it from (x, z),
 * or, where the straight line there runs through a station house (with
 * `lift.houseGap` m to spare), the corner of the house to make for first:
 * alongside the house, the corner on his side at whichever end is the
 * shorter way round; off one end, the corner at that end on the side `aim`
 * lies. A rider stood off a chair on its pad is led on round the house
 * beside the way off, never through it. */
function round(
  level: Level,
  x: number,
  z: number,
  aim: { x: number; z: number },
): { x: number; z: number } {
  for (const h of houses(level)) {
    const { dx, dz } = h.plan;
    const a0 = (x - h.x) * dx + (z - h.z) * dz;
    const b0 = (x - h.x) * dz - (z - h.z) * dx;
    const a1 = (aim.x - h.x) * dx + (aim.z - h.z) * dz;
    const b1 = (aim.x - h.x) * dz - (aim.z - h.z) * dx;
    const hl = h.halfLength + K.houseGap;
    const hw = h.halfWidth + K.houseGap;
    // The box he is kept out of is a little inside the corners he makes
    // for, so a line from a corner on never crosses it again.
    if (!crosses(a0, b0, a1, b1, hl - 0.25, hw - 0.25)) continue;
    const round = (end: number, side: number) => ({ a: end * hl, b: side * hw });
    let corner;
    if (Math.abs(a0) >= hl - 0.25) corner = round(Math.sign(a0), Math.sign(b1) || 1);
    else {
      const side = Math.sign(b0) || 1;
      const way = (c: { a: number; b: number }) =>
        hypot(c.a - a0, c.b - b0) + hypot(a1 - c.a, b1 - c.b);
      const ahead = round(1, side);
      const back = round(-1, side);
      corner = way(ahead) <= way(back) ? ahead : back;
    }
    return { x: h.x + dx * corner.a + dz * corner.b, z: h.z + dz * corner.a - dx * corner.b };
  }
  return aim;
}

/** Whether the segment (a0, b0)–(a1, b1) passes through the box |a| < hl,
 * |b| < hw (a slab test). */
function crosses(a0: number, b0: number, a1: number, b1: number, hl: number, hw: number): boolean {
  let lo = 0;
  let hi = 1;
  for (const [p, q, half] of [
    [a0, a1, hl],
    [b0, b1, hw],
  ]) {
    const d = q - p;
    if (Math.abs(d) < 1e-9) {
      if (Math.abs(p) >= half) return false;
      continue;
    }
    const t0 = (-half - p) / d;
    const t1 = (half - p) / d;
    lo = Math.max(lo, Math.min(t0, t1));
    hi = Math.min(hi, Math.max(t0, t1));
    if (lo >= hi) return false;
  }
  return true;
}

/** A FREE RIDE STARTED ON A LIFT: the skier carried a span or two below
 * the top of the lift whose run (R27) is to be skied, and led, once off it,
 * toward that run as far down it as the spot (x, z) (in
 * `lead.near`..`lead.far` of it). The run is `pin` by id where one is named
 * — on whatever lift leaves its top, a chair, a gondola or a drag — and
 * otherwise the chair-served run passing nearest the spot. False where the
 * map has no such lift to ride — a map from before the resorts. */
export function arriveByLift(run: GameState, x: number, z: number, pin?: string): boolean {
  const resort = run.level.resort;
  if (!resort) return false;
  if (pin !== undefined && !resort.runs.some((r) => r.id === pin && r.kind === "piste")) {
    pin = undefined;
  }
  const plans = liftPlans(run.level);
  // The run passing nearest the spot among those a rider stood off its
  // chair drops onto (`joinOf`); the nearest of any where none does.
  let pick = -1;
  let lift = -1;
  let cost = Infinity;
  let at = 0;
  resort.runs.forEach((r, i) => {
    if (r.kind !== "piste" || (pin !== undefined && r.id !== pin)) return;
    const l = plans.findIndex((p) => p.lift.id === r.from);
    if (l < 0 || (pin === undefined && plans[l].lift.kind !== "chair")) return;
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
  if (pick < 0) return pin !== undefined ? arriveByLift(run, x, z) : false;
  const plan = plans[lift];
  const s = plan.supports;
  const last = s.length > 2 ? s[s.length - 2].u : 0;
  const u = clamp(last - K.before, plan.length - K.rideMost, plan.length - K.rideLeast);
  const c = run.skier;
  c.lift = {
    index: lift,
    id: plan.lift.id,
    kind: plan.lift.kind,
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
    lead: { run: pick, s: 0, until: clamp(at, K.leadNear, K.leadFar), time: K.leadFor },
  };
  if (plan.lift.kind === "drag") {
    // On a drag he is pulled up the track on his skis.
    const p = along(plan, c.lift.u, upRope(plan));
    setOff(run, p.x, p.z, plan.heading, c.lift.speed);
  } else hold(run, plan, c.lift);
  return true;
}
