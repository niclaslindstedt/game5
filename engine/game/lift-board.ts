// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// BOARDING A LIFT — the half of the lift ride (`lift-ride.ts`) before the
// carrier has him: the skier taken by a lift's load zone or its boarding
// ring skating up the queue's lane to the carrier, a T-bar waited for on a
// drag's track, and a gondola's cabin waited for on its platform and
// stepped into.
//
// SETTING OFF (`setOut`): taken facing off the way he has to go, he turns
// to it the way a skier does — he is never swivelled round on the spot
// while he slides along it. Rolling and turned a little, he SKATES ROUND,
// a step turned in each push (`SkierState.step`, the skate turn the
// figure's gait draws); coming in fast and turned far off it, he STOPS
// first, the skis thrown across and scraped to a stand (`SkierState.skid`,
// the hockey stop the pose draws); at a crawl he STEPS HIS SKIS ROUND on
// the spot a pair at a time (`SkierState.pivot`, `poles.ts`'s pairs). Once
// square to it, the way is laid from where he stands and he skates it.
//
// A GONDOLA (`stepGondola`): through the door at the back of the hall he
// comes out onto the platform beside the bullwheel and waits there. His
// cabin comes round the wheel on the station's RAIL (`railAt`), detached
// from the rope and slowing to a crawl, doors open; as it comes alongside
// he racks his skis on its door and steps in to sit on the bench along its
// back wall while it creeps on (`lift-ride.ts`'s `hold`, over
// `gondola.stepIn`), its doors shut, and it is taken back onto the rope.
//
// Pure over the level, the plan and the clock, like the ride: nothing here
// draws from the stream.

import { angleDiff, clamp, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { standSkier } from "./course.ts";
import { TUNING } from "./defs/tuning.ts";
import {
  CORRAL_TAIL,
  GONDOLA_IN_STATION,
  carrierPassing,
  queueLane,
  ropeAt,
  upRope,
  type LiftPlan,
} from "./lift-line.ts";
import { pivotSteps, strideRate } from "./poles.ts";
import { derive } from "./skier.ts";
import type { GameState, LiftRide } from "./state.ts";

const K = TUNING.lift;
const B = K.board;
const G = K.gondola;

/** A point `u` m of plan up a lift's line and `side` m right of it. */
export function along(plan: LiftPlan, u: number, side: number): { x: number; z: number } {
  return {
    x: plan.lift.bottom.x + plan.dx * u + plan.dz * side,
    z: plan.lift.bottom.z + plan.dz * u - plan.dx * side,
  };
}

/** The skier stood at a plan point and heading, moving `way` m/s along
 * `heading` — `standSkier`'s rest with a way kept. */
export function setOff(run: GameState, x: number, z: number, heading: number, way: number): void {
  standSkier(run, x, z, heading);
  const c = run.skier;
  c.vx = Math.sin(heading) * way;
  c.vz = Math.cos(heading) * way;
  derive(c, run.level);
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
  const off = B.past;
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

/** The way's length, m. */
export function wayLength(way: readonly { x: number; z: number }[]): number {
  let n = 0;
  for (let k = 1; k < way.length; k++) n += hypot(way[k].x - way[k - 1].x, way[k].z - way[k - 1].z);
  return n;
}

/** The way he is taken along from where he came in. */
export function boardWay(plan: LiftPlan, ride: LiftRide): { x: number; z: number }[] {
  return walkOf(plan, ride, ride.ringed ?? isRinged(plan, ride));
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

/** The heading along a way from `s` m into it, looking `board.ahead` m on. */
function aimOf(way: readonly { x: number; z: number }[], s: number, fallback: number): number {
  const at = alongWay(way, s);
  const ahead = alongWay(way, s + B.ahead);
  return hypot(ahead.x - at.x, ahead.z - at.z) > 0.05
    ? Math.atan2(ahead.x - at.x, ahead.z - at.z)
    : fallback;
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

/** SETTING OFF, before he skates the way: turned to it the way a skier
 * turns — stopped first if he came in fast and far off it, stepped round
 * on the spot at a crawl, skated round to it rolling — on his own line,
 * never slid along the way he is not facing. True once he is square to it:
 * the way is laid from where he stands then (`ride.from`). */
function setOut(run: GameState, plan: LiftPlan, ride: LiftRide): boolean {
  const dt = TUNING.dt;
  const c = run.skier;
  // The way laid from where he stands, and where it heads.
  ride.from.x = c.x;
  ride.from.z = c.z;
  const way = boardWay(plan, ride);
  let head = ride.head ?? c.heading;
  let pace = ride.pace ?? 0;
  const off = angleDiff(head, aimOf(way, 0, head));
  const pair = ride.pivot ?? 0;
  if (pair === 0 && Math.abs(off) <= B.square) {
    // Square to it: off he goes.
    ride.set = true;
    ride.walk = wayLength(way);
    ride.s = 0;
    return true;
  }
  let x = c.x;
  let z = c.z;
  let drive = 0;
  let step = 0;
  let skid = 0;
  let pivot = 0;
  if (pair !== 0 || pace <= B.crawl) {
    // AT A CRAWL: checked to a stand and stepped round on the spot, a pair
    // at a time — a pair begun is finished the way it was begun.
    pace = Math.max(0, pace - B.halt.decel * dt);
    x += Math.sin(head) * pace * dt;
    z += Math.cos(head) * pace * dt;
    pivot = pair !== 0 ? pair : Math.sign(off);
    const u0 = ride.pair ?? 0;
    // A pair is begun from the skis together.
    if (u0 === 0) c.stride = Math.ceil(c.stride - 1e-6);
    const u1 = Math.min(1, u0 + B.steps * dt);
    head += pivot * TUNING.poles.pivot.angle * (pivotSteps(u1).body - pivotSteps(u0).body);
    c.stride += u1 - u0;
    if (u1 >= 1) {
      c.stride = Math.round(c.stride);
      delete ride.pivot;
      delete ride.pair;
    } else {
      ride.pivot = pivot;
      ride.pair = u1;
    }
  } else if (Math.abs(off) > B.halt.off) {
    // FAST AND FAR OFF IT: the skis thrown across and scraped to a stand
    // on his own line.
    pace = Math.max(0, pace - B.halt.decel * dt);
    x += Math.sin(head) * pace * dt;
    z += Math.cos(head) * pace * dt;
    skid = clamp(pace / 2, 0.4, 1);
  } else {
    // ROLLING: skated round to it, a step turned into each push, checked
    // to a skater's pace.
    pace =
      pace > B.pace ? Math.max(B.pace, pace - B.brake * dt) : Math.min(B.pace, pace + B.brake * dt);
    head += clamp(off, -B.arc * dt, B.arc * dt);
    x += Math.sin(head) * pace * dt;
    z += Math.cos(head) * pace * dt;
    drive = B.drive;
    step = Math.sign(off);
  }
  setOff(run, x, z, head, pace);
  c.drive = drive;
  c.step = step;
  c.pivot = pivot;
  if (skid > 0) {
    // The hockey stop as the pose draws it: the skis pivoted across the
    // way he slides, to the side he will turn.
    c.skid = skid;
    c.brake = skid;
    c.skiAngle = Math.sign(off) * skid * 1.2;
  }
  if (drive > 0) c.stride += strideRate(pace, c.poles, step) * drive * dt;
  ride.head = head;
  ride.pace = pace;
  return false;
}

/** BOARDING: he turns to the way (`setOut`) and SKATES it to the carrier —
 * checked down from however fast he came in to a skater's pace, his legs
 * and poles working it (`SkierState.drive` and `.stride`, which the
 * figure's gait reads), a step turned into each push round its corners
 * (`SkierState.step`), and eased to a crawl onto the load line, turned up
 * the line over its last metres. True once he is at its end: a gondola's
 * door, a chair's load line or a drag's track. */
export function stepBoard(run: GameState, plan: LiftPlan, ride: LiftRide): boolean {
  const dt = TUNING.dt;
  const c = run.skier;
  if (!ride.set && !setOut(run, plan, ride)) return false;
  const way = boardWay(plan, ride);
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
  const aim = aimOf(way, s, ride.head ?? plan.heading);
  // Turned up the line over the last of the way.
  const last = 1 - Math.min(1, togo / B.ahead);
  const goal = aim + angleDiff(aim, plan.heading) * last;
  let head = ride.head ?? c.heading;
  const turn = clamp(angleDiff(head, goal), -B.turn * dt, B.turn * dt);
  head += turn;
  setOff(run, at.x, at.z, head, pace);
  // Skating it: the push and the strides the figure's gait is drawn by —
  // gliding while he is still checking down from coming in fast — and a
  // step turned into each push where the way bends.
  c.drive = pace <= B.pace + 0.2 && togo > B.end ? B.drive : 0;
  c.step = c.drive > 0 ? clamp(turn / (B.arc * dt), -1, 1) : 0;
  c.pivot = 0;
  c.stride += strideRate(pace, c.poles, c.step) * c.drive * dt;
  ride.s = s;
  ride.pace = pace;
  ride.head = head;
  if (s < total) return false;
  delete ride.s;
  delete ride.pace;
  delete ride.head;
  delete ride.walk;
  delete ride.set;
  c.drive = 0;
  c.step = 0;
  return true;
}

/** ON A DRAG'S TRACK: stood on its bar's right arm facing up the line
 * until the next T-bar comes round to him — the one the clock brings past
 * the load line (`carrierPassing`), so his is a bar of the lift's own.
 * True when it takes him from behind. */
export function stepTee(run: GameState, plan: LiftPlan): boolean {
  const p = boardAt(plan);
  setOff(run, p.x, p.z, plan.heading, 0);
  return carrierPassing(plan, plan.look.entry.at, run.t, TUNING.dt) >= 0;
}

/** THE STATION'S RAIL round a gondola's bottom wheel, `r` m along it: up
 * the line on the up rope's side from the wheel for `r` ≥ 0, and back
 * round the wheel behind it — the way a cabin comes to the platform — for
 * `r` < 0. Where it is in the world and the way a cabin runs there. */
export function railAt(plan: LiftPlan, r: number): { x: number; z: number; heading: number } {
  const radius = upRope(plan);
  if (r >= 0) return { ...along(plan, r, radius), heading: plan.heading };
  const a = Math.max(-Math.PI, r / radius);
  const p = along(plan, radius * Math.sin(a), radius * Math.cos(a));
  // Round the wheel clockwise from above, its tangent turned by the arc.
  return { ...p, heading: plan.heading + a };
}

/** How high a gondola's grip runs, m, `u` m up its line: on the station's
 * rail through it — its cabin's floor at the platform's — and climbing
 * onto the rope once out of it (`gondola.climb`). */
export function gondolaGrip(plan: LiftPlan, u: number): number {
  const rail = plan.supports[0].ground + G.rail;
  const k = smoothstep(GONDOLA_IN_STATION, GONDOLA_IN_STATION + G.climb, u);
  return rail + (ropeAt(plan, u) - rail) * k;
}

/** Where a gondola's rider waits for his cabin on the platform: off the
 * door side of its way, a little behind where its bench comes to. */
export function platformOf(plan: LiftPlan): { x: number; z: number } {
  return along(
    plan,
    G.load - K.cabinBack + (G.creep * G.stepIn) / 2,
    upRope(plan) + CABIN_HALF + G.platform,
  );
}

/** Half a cabin's width, m — `lifts.ts`'s cabin as drawn. */
export const CABIN_HALF = 0.98;

/** THROUGH THE DOOR AND OUT ON THE PLATFORM: stood on his skis beside his
 * cabin's way, facing up the line, while it comes round the wheel to him
 * on the rail (`ride.u`, the rail's `r`) from `gondola.from` m back along
 * it, slowing to the station's crawl. True once it is alongside. */
export function stepGondola(run: GameState, plan: LiftPlan, ride: LiftRide): boolean {
  const p = platformOf(plan);
  setOff(run, p.x, p.z, plan.heading, 0);
  const togo = Math.max(0, G.load - ride.u);
  ride.speed = Math.max(G.creep, Math.sqrt(G.creep ** 2 + 2 * G.come * togo));
  ride.u = Math.min(G.load, ride.u + ride.speed * TUNING.dt);
  return ride.u >= G.load;
}

/** Into the door: out on the platform, the picture fading back in there,
 * and his cabin set coming round the wheel. */
export function toPlatform(run: GameState, plan: LiftPlan, ride: LiftRide): void {
  ride.phase = "wait";
  ride.t = 0;
  ride.faded = true;
  ride.u = -G.from;
  ride.speed = Math.sqrt(G.creep ** 2 + 2 * G.come * (G.load + G.from));
  const p = platformOf(plan);
  setOff(run, p.x, p.z, plan.heading, 0);
}
