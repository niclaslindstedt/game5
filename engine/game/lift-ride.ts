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
// Or he rides into its BOARDING RING (`boardingRing`), the lit circle on
// the snow where the queue starts, just past the open end of its corral:
// facing any way, slow enough, he is glided up the queue's lane through the
// corral (`walkOf`), past the queue standing on it, to the load zone and boarded as above.
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
import {
  BOARDING_RING,
  CORRAL_TAIL,
  GONDOLA_IN_STATION,
  boardingRing,
  carrierPassing,
  liftPlans,
  queueLane,
  ropeAt,
  upRope,
  type LiftPlan,
} from "./lift-line.ts";
import { strideRate } from "./poles.ts";
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
 * zone, skating up to the carrier, waiting for a T-bar, carried, or stood
 * off at the top. True while the lift has him — the step is the lift's,
 * and the snow, the trees and the clock wait. `events` is the run's own
 * list. */
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
    delete ride.faded;
  }
  if (ride.phase === "board") {
    stepBoard(run, plan, ride, events);
    return true;
  }
  if (ride.phase === "wait") {
    stepWait(run, plan, ride, events);
    return true;
  }
  // The step he is stood off at the top is the lift's too.
  stepCarried(run, plan, ride, events);
  return true;
}

/** Into a load zone — inside it, slow enough and facing up the line — or
 * into a boarding ring, slow enough and facing any way. */
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
    const zoned =
      Math.abs(u - e.at) <= e.along &&
      Math.abs(v - e.side) <= e.across &&
      c.speed <= e.fastest &&
      Math.abs(angleDiff(c.heading, plan.heading)) <= e.turned;
    const ring = boardingRing(plan);
    const ringed =
      !zoned &&
      hypot(c.x - ring.x, c.z - ring.z) <= BOARDING_RING.radius &&
      c.speed <= BOARDING_RING.fastest;
    if (!zoned && !ringed) continue;
    const ride: LiftRide = {
      index: i,
      id: plan.lift.id,
      kind: plan.lift.kind,
      phase: "board",
      u: e.at,
      speed: 0,
      swing: 0,
      swingRate: 0,
      t: 0,
      tower: 1,
      from: { x: c.x, y: Number.NaN, z: c.z, heading: c.heading },
      s: 0,
      pace: c.speed,
      head: c.heading,
    };
    ride.walk = wayLength(walkOf(plan, ride, ringed));
    c.lift = ride;
    events.push({ kind: "lift", t: run.t, id: plan.lift.id, lift: plan.lift.kind, phase: "board" });
    return;
  }
}

/** Where boarding takes him: out onto a chair's load line under its up
 * rope, onto a drag's track on its bar's right arm (`lift.tee` right of
 * the rope), or in at a gondola station's door. */
export function boardAt(plan: LiftPlan): { x: number; z: number } {
  const e = plan.look.entry;
  if (plan.lift.kind === "gondola") return along(plan, e.at, 0);
  if (plan.lift.kind === "drag") return along(plan, e.at, upRope(plan) + K.tee);
  return along(plan, e.at, upRope(plan));
}

/** THE WAY A RIDER SKATES TO THE CARRIER, in the world. From the load
 * zone, straight to it. From the boarding ring: in at the corral's open
 * end on the queue's lane, then up the lane `board.past` m to the right
 * of the queue standing on it — past them, never through them (those in
 * his way are shouldered aside, `crowd-lift.ts`'s `brushQueue`) — and
 * onto the load line, a drag's track or a gondola's door. */
function walkOf(
  plan: LiftPlan,
  ride: Pick<LiftRide, "from">,
  ringed: boolean,
): { x: number; z: number }[] {
  const start = { x: ride.from.x, z: ride.from.z };
  if (!ringed) return [start, boardAt(plan)];
  const lane = queueLane(plan);
  const n = lane.length;
  const off = K.board.past;
  // Each leg's normal in (u, v), to the right of the way IN (toward the
  // load line).
  const normal = (a: { u: number; v: number }, b: { u: number; v: number }) => {
    const len = hypot(b.u - a.u, b.v - a.v) || 1;
    // The way in runs b → a; its right in (u, v) is (−dv, du) of a − b
    // turned — v is already right of the line.
    return { u: (a.v - b.v) / len, v: (b.u - a.u) / len };
  };
  const at = (a: { u: number; v: number }, b: { u: number; v: number }, d: number) => {
    const len = hypot(b.u - a.u, b.v - a.v) || 1;
    return { u: a.u + ((b.u - a.u) / len) * d, v: a.v + ((b.v - a.v) / len) * d };
  };
  const way: { x: number; z: number }[] = [start];
  // In at the corral's open end, on the lane's line just outside it…
  const a = lane[n - 2];
  const b = lane[n - 1];
  const mouth = at(a, b, CORRAL_TAIL + 1);
  way.push(along(plan, mouth.u, mouth.v));
  // …stepped across to the queue's right inside it…
  const nl = normal(a, b);
  const inside = at(a, b, CORRAL_TAIL - 1);
  way.push(along(plan, inside.u + nl.u * off, inside.v + nl.v * off));
  // …and up the lane beside the queue, every corner held off it.
  for (let k = n - 2; k >= 1; k--) {
    const n0 = normal(lane[k - 1], lane[k]);
    const n1 = normal(lane[k], lane[k + 1]);
    const mu = (n0.u + n1.u) / 2;
    const mv = (n0.v + n1.v) / 2;
    const m = hypot(mu, mv) || 1;
    way.push(along(plan, lane[k].u + (mu / m) * off, lane[k].v + (mv / m) * off));
  }
  // The last of it beside the front of the queue, then onto the carrier.
  const front = at(lane[0], lane[1], 1.5);
  const nf = normal(lane[0], lane[1]);
  way.push(along(plan, front.u + nf.u * off, front.v + nf.v * off));
  way.push(boardAt(plan));
  return way;
}

function wayLength(way: readonly { x: number; z: number }[]): number {
  let n = 0;
  for (let k = 1; k < way.length; k++) n += hypot(way[k].x - way[k - 1].x, way[k].z - way[k - 1].z);
  return n;
}

/** The point `s` m along a way, and the way it runs there. */
function alongWay(
  way: readonly { x: number; z: number }[],
  s: number,
): { x: number; z: number; heading: number } {
  let left = Math.max(0, s);
  for (let k = 1; k < way.length; k++) {
    const a = way[k - 1];
    const b = way[k];
    const seg = hypot(b.x - a.x, b.z - a.z);
    if (seg <= 1e-6) continue;
    if (left <= seg || k + 1 === way.length) {
      const t = Math.min(1, left / seg);
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        heading: Math.atan2(b.x - a.x, b.z - a.z),
      };
    }
    left -= seg;
  }
  const end = way[way.length - 1];
  return { x: end.x, z: end.z, heading: Number.NaN };
}

/** BOARDING: he SKATES his way to the carrier — checked down from however
 * fast he came in to a skater's pace, his legs and poles working it
 * (`SkierState.drive` and `.stride`, which the figure's gait reads), and
 * eased to a crawl onto the load line, turned up the line over its last
 * metres. There a gondola's door and a chair's load line take him in out
 * of sight (`faded`: sat in his carrier as it leaves the station), and a
 * drag's track stands him waiting for his bar (`wait`). */
function stepBoard(run: GameState, plan: LiftPlan, ride: LiftRide, events: GameEvent[]): void {
  const B = K.board;
  const dt = TUNING.dt;
  const c = run.skier;
  const way = walkOf(plan, ride, isRinged(plan, ride));
  const total = ride.walk ?? wayLength(way);
  let s = ride.s ?? 0;
  let pace = ride.pace ?? 0;
  const togo = Math.max(0, total - s);
  // Checked down to a skater's pace, and to a crawl onto the load line.
  const cap = Math.sqrt(B.end ** 2 + 2 * B.stop * togo);
  const want = Math.min(B.pace, cap);
  pace = pace > want ? Math.max(want, pace - B.brake * dt) : Math.min(want, pace + B.brake * dt);
  pace = Math.min(pace, cap);
  s = Math.min(total, s + pace * dt);
  const at = alongWay(way, s);
  const ahead = alongWay(way, s + B.ahead);
  const aim =
    hypot(ahead.x - at.x, ahead.z - at.z) > 0.05
      ? Math.atan2(ahead.x - at.x, ahead.z - at.z)
      : (ride.head ?? plan.heading);
  // Turned up the line over the last of the way.
  const last = 1 - Math.min(1, togo / B.ahead);
  const goal = aim + angleDiff(aim, plan.heading) * last;
  let head = ride.head ?? c.heading;
  head += clamp(angleDiff(head, goal), -B.turn * dt, B.turn * dt);
  setOff(run, at.x, at.z, head, pace);
  // Skating it: the push and the strides the figure's gait is drawn by —
  // gliding while he is still checking down from coming in fast.
  c.drive = pace <= B.pace + 0.2 && togo > B.end ? B.drive : 0;
  c.stride += strideRate(pace, c.poles) * c.drive * dt;
  ride.s = s;
  ride.pace = pace;
  ride.head = head;
  if (s < total) return;
  delete ride.s;
  delete ride.pace;
  delete ride.head;
  delete ride.walk;
  ride.t = 0;
  if (plan.lift.kind === "drag") {
    ride.phase = "wait";
    return;
  }
  // In at the door or onto the load line: sat in his carrier as it
  // leaves the station, and the picture fades back in on him there.
  const start = plan.lift.kind === "gondola" ? GONDOLA_IN_STATION + 2 : plan.look.entry.at + 2;
  ride.phase = "ride";
  ride.faded = true;
  ride.u = start;
  ride.speed = plan.look.slow;
  ride.swing = 0;
  ride.swingRate = 0;
  ride.tower = Math.max(
    1,
    plan.supports.findIndex((p) => p.u > start),
  );
  ride.from = { x: c.x, y: Number.NaN, z: c.z, heading: plan.heading };
  events.push({ kind: "lift", t: run.t, id: plan.lift.id, lift: plan.lift.kind, phase: "take" });
  hold(run, plan, ride);
}

/** Whether a ride came from the boarding ring: its way starts outside the
 * load zone. */
function isRinged(plan: LiftPlan, ride: LiftRide): boolean {
  const e = plan.look.entry;
  const rx = ride.from.x - plan.lift.bottom.x;
  const rz = ride.from.z - plan.lift.bottom.z;
  const u = rx * plan.dx + rz * plan.dz;
  const v = rx * plan.dz - rz * plan.dx;
  return !(Math.abs(u - e.at) <= e.along && Math.abs(v - e.side) <= e.across);
}

/** ON A DRAG'S TRACK: stood on its bar's right arm facing up the line
 * until the next T-bar comes round to him — the one the clock brings past
 * the load line (`carrierPassing`), so his is a bar of the lift's own —
 * and it takes him from behind: the bar under him, the pull taken up from
 * a stand (`stepCarried`'s pick-up). */
function stepWait(run: GameState, plan: LiftPlan, ride: LiftRide, events: GameEvent[]): void {
  const c = run.skier;
  const p = boardAt(plan);
  setOff(run, p.x, p.z, plan.heading, 0);
  if (carrierPassing(plan, plan.look.entry.at, run.t, TUNING.dt) < 0) return;
  ride.phase = "ride";
  ride.t = 0;
  ride.u = plan.look.entry.at;
  ride.speed = 0;
  ride.tower = Math.max(
    1,
    plan.supports.findIndex((s) => s.u > ride.u),
  );
  ride.from = { x: c.x, y: c.y, z: c.z, heading: plan.heading };
  events.push({ kind: "lift", t: run.t, id: plan.lift.id, lift: plan.lift.kind, phase: "take" });
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
    // Pulled up the track on his skis, sat back on his bar's right arm.
    const p = along(plan, ride.u, upRope(plan) + K.tee);
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
    // the chairs swinging round the wheel — and the chair he sat on runs
    // on empty behind him.
    const p = along(plan, off, upRope(plan));
    setOff(run, p.x, p.z, plan.heading + K.ramp, K.standUp);
    c.chairLeft = { index: ride.index, u: off, t: run.t };
  }
  // Stood off it, the skis are his.
  c.lift = null;
}

/** A CHAIR'S BOX under its grip, m: half its depth along the line (the
 * hanger behind the back to the footrest in front), half its width across
 * it, and how far under the rope its lowest bar hangs — `lifts.ts`'s chair
 * as drawn. And how far round a skier his body reaches, m, and how high
 * over the snow under him his legs stand, m: what a chair's bars sweep. */
const CHAIR_BOX = { halfAlong: 0.55, halfAcross: 1.2, drop: 2.95 };
const LEGS = { reach: 0.3, high: 1.2 };

/** WHERE THE EMPTY CHAIR IS, m up its line: the one a rider stood up off
 * (`SkierState.chairLeft`) running on at the terminal's speed from where
 * it let him go, over the unload ramp to the wheel — null once it is round
 * it, into the hood, as every chair goes. Pure over the clock. */
export function emptyChairAt(
  plan: LiftPlan,
  left: { u: number; t: number },
  t: number,
): number | null {
  const u = left.u + plan.look.slow * Math.max(0, t - left.t);
  return u < plan.length - 1 ? u : null;
}

/** THE EMPTY CHAIR RUN INTO HIM: a skier still in its way as it comes on
 * over the ramp — stopped on the unload, or skied back under the line — is
 * swept off his feet, and what it carries him off with is returned (null
 * when it misses him) — the chair running on over him, and forgotten
 * once it is round the wheel. Run each step he is on his skis. */
export function chairStrike(run: GameState): { x: number; z: number } | null {
  const c = run.skier;
  const left = c.chairLeft;
  if (!left) return null;
  const plan = liftPlans(run.level)[left.index];
  const u = plan ? emptyChairAt(plan, left, run.t) : null;
  if (!plan || u === null) {
    c.chairLeft = null;
    return null;
  }
  if (c.lift || c.thrown || c.airborne) return null;
  const rx = c.x - plan.lift.bottom.x;
  const rz = c.z - plan.lift.bottom.z;
  const su = rx * plan.dx + rz * plan.dz;
  const sv = rx * plan.dz - rz * plan.dx;
  if (Math.abs(su - u) > CHAIR_BOX.halfAlong + LEGS.reach) return null;
  if (Math.abs(sv - upRope(plan)) > CHAIR_BOX.halfAcross + LEGS.reach) return null;
  // Over his head on the line's way in, not yet down to his legs.
  if (ropeAt(plan, u) - CHAIR_BOX.drop > run.level.groundAt(c.x, c.z) + LEGS.high) return null;
  // Going on up the line faster than the chair, he is clear of it.
  if (c.vx * plan.dx + c.vz * plan.dz > plan.look.slow) return null;
  return { x: plan.dx * plan.look.slow, z: plan.dz * plan.look.slow };
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
  // A cabin's rider sits on the bench along its back wall, `cabinBack` m
  // behind the grip — the hanger's foot and he swung about it as one.
  const back = plan.lift.kind === "gondola" ? K.cabinBack : 0;
  const cs = Math.cos(ride.swing);
  const sn = Math.sin(ride.swing);
  const ahead = -back * cs + drop * sn;
  let x = grip.x + plan.dx * ahead;
  let z = grip.z + plan.dz * ahead;
  let y = gy - back * sn - drop * cs;
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
  if (ride.phase !== "ride") return 0;
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
    const p = along(plan, c.lift.u, upRope(plan) + K.tee);
    setOff(run, p.x, p.z, plan.heading, c.lift.speed);
  } else hold(run, plan, c.lift);
  return resort.runs[pick].id;
}
