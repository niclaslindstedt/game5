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
// facing any way, slow enough, he SKATES up the queue's lane through the
// corral (`lift-board.ts`: turned to the way as a skier turns, then at a
// skater's pace, his strides counted for the gait), beside the queue standing on it — shouldering aside whoever is
// in his way (`crowd-lift.ts`'s `brushQueue`) — to the load zone: a chair
// takes him behind the station's fade, already sat in the carrier leaving
// it; a gondola's door takes him through its hall onto the platform, where
// his cabin comes round the wheel to him and he steps in and sits down
// (`stepGondola`); a drag stands him on its track until a T-bar of the
// lift's own comes round (`stepTee`) and takes him on it.
//
// CARRIED, the machine press lets go of the lift wherever he is (`letGo`:
// dropped off a chair, jumped out of a cabin, the bar let go of), and the
// tuck held `TUNING.lift.skip.hold` seconds skips him up it behind a fade
// (`skipUp`) to where he would be let go.
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

import { angleDiff, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { TUNING } from "./defs/tuning.ts";
import {
  BOARDING_RING,
  boardingRing,
  carrierAt,
  carrierSpeedAt,
  carrierGripAt,
  letGoOf,
  liftPlans,
  ropeAt,
  upRope,
  type LiftPlan,
} from "./lift-line.ts";
import {
  along,
  carrierNear,
  gondolaGrip,
  setOff,
  stepBoard,
  stepChairWait,
  stepGondola,
  stepTee,
  toPlatform,
} from "./lift-board.ts";
import type { PisteGrade } from "../mapgen/grades.ts";
import { carrierSwingAt } from "./carrier-swing.ts";
import type { Level, Run, SummitRamp } from "../mapgen/types.ts";
import { derive } from "./skier.ts";
import { type GameEvent, type GameState, type LiftRide, type SkierInput } from "./state.ts";

const K = TUNING.lift;

/** Where along the line a carrier is let go of: a chair's over the ramp, a
 * drag's short of its wheel, a gondola's cabin into its top station. */
function offAt(plan: LiftPlan): number {
  return plan.length - plan.look.off;
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
    ride.from = { ...ride.from, y: Number.NaN };
    ride.speed = plan.look.slow;
    ride.swing = 0;
    ride.tower = plan.supports.length;
    delete ride.faded;
    delete ride.carrier;
    delete ride.stand;
  }
  if (input.machine) {
    letGo(run, plan, ride, events);
    return false;
  }
  if (ride.phase === "ride") skipUp(run, plan, ride, input);
  if (ride.phase === "board") {
    if (stepBoard(run, plan, ride)) boarded(run, plan, ride);
    return true;
  }
  if (ride.phase === "wait") {
    const kind = plan.lift.kind;
    if (kind === "gondola") {
      if (stepGondola(run, plan, ride)) taken(run, plan, ride, events, -1);
    } else {
      const k = kind === "chair" ? stepChairWait(run, plan) : stepTee(run, plan);
      if (k >= 0) taken(run, plan, ride, events, k);
    }
    return true;
  }
  // The step he is stood off at the top is the lift's too.
  stepCarried(run, plan, ride, events);
  return true;
}

/** OFF THE LIFT WHEREVER HE IS, on the machine press: skating up to it or
 * waiting for his bar he simply skis away; carried, he lets go — off a
 * T-bar onto the track, off the seat of a chair, out of a gondola's door
 * on its right side — with the carrier's way, to fall however far there
 * is under him (`flight.ts` judges the landing). */
function letGo(run: GameState, plan: LiftPlan, ride: LiftRide, events: GameEvent[]): void {
  const c = run.skier;
  c.lift = null;
  if (ride.phase !== "ride") return;
  events.push({ kind: "lift", t: run.t, id: plan.lift.id, lift: plan.lift.kind, phase: "off" });
  if (plan.lift.kind === "gondola") {
    // Out of the door, clear of the cabin's side.
    c.x += plan.dz * K.jumpOut;
    c.z -= plan.dx * K.jumpOut;
  }
  if (plan.lift.kind === "drag") return;
  c.airborne = c.y - run.level.groundAt(c.x, c.z) - c.spec.cogHeight > 0.05;
  c.airTime = 0;
  derive(c, run.level);
}

/** HELD TUCKED FOR `skip.hold` s while carried, the lift goes by in a
 * moment: the picture fades out over `skip.fade` s, and he is put where a
 * free ride begun on this lift starts (`arrivalOf`: the top close ahead),
 * sat in his carrier, the picture fading back in (`faded`). */
function skipUp(run: GameState, plan: LiftPlan, ride: LiftRide, input: SkierInput): void {
  const dt = TUNING.dt;
  if (ride.skip === undefined) {
    ride.held = input.tuck >= 0.5 ? (ride.held ?? 0) + dt : 0;
    if (ride.held < K.skip.hold) return;
    if (arrivalOf(plan).u <= ride.u) {
      ride.held = 0;
      return;
    }
    ride.skip = 0;
  }
  ride.skip += dt;
  if (ride.skip < K.skip.fade) return;
  const there = arrivalOf(plan);
  ride.u = there.u;
  ride.speed = there.speed;
  delete ride.carrier;
  if (plan.lift.kind === "chair") onChair(plan, ride, carrierNear(plan, there.u, run.t), run.t);
  ride.swing = 0;
  ride.tower = Math.max(
    1,
    plan.supports.findIndex((p) => p.u > there.u),
  );
  ride.t = 0;
  ride.faded = true;
  ride.from = { ...ride.from, y: Number.NaN };
  delete ride.skip;
  ride.held = 0;
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
      t: 0,
      tower: 1,
      from: { x: c.x, y: Number.NaN, z: c.z, heading: c.heading },
      s: 0,
      pace: c.speed,
      head: c.heading,
      ringed,
    };
    c.lift = ride;
    events.push({ kind: "lift", t: run.t, id: plan.lift.id, lift: plan.lift.kind, phase: "board" });
    return;
  }
}

/** BOARDING DONE: a drag's track stands him waiting for his bar, and a
 * chair's load line for his chair (`wait`); a gondola's door takes him
 * through the hall onto its platform to wait for his cabin (`wait`,
 * `lift-board.ts`'s `toPlatform`). */
function boarded(run: GameState, plan: LiftPlan, ride: LiftRide): void {
  ride.t = 0;
  if (plan.lift.kind === "gondola") {
    toPlatform(run, plan, ride);
    return;
  }
  ride.phase = "wait";
}

/** On chair `k` of the lift, wherever the clock has it at `t`. */
function onChair(plan: LiftPlan, ride: LiftRide, k: number, t: number): void {
  const at = carrierAt(plan, k, t);
  ride.carrier = k;
  ride.u = at.side === 0 ? at.u : plan.length;
  ride.speed = carrierSpeedAt(plan, Math.min(ride.u, plan.length), 0);
  ride.tower = towerPast(plan, ride.u);
}

/** The next support up the line past `u`. */
function towerPast(plan: LiftPlan, u: number): number {
  return Math.max(
    1,
    plan.supports.findIndex((p) => p.u > u),
  );
}

/** TAKEN FROM WHERE HE STANDS by carrier `k` (-1: a cabin of his own): a
 * chair scooping him off its load line from behind (`hold`, over
 * `lift.scoop`), carried on wherever the clock has it; a T-bar from behind
 * on its track, the pull taken up from a stand as its cord pays out of the
 * spring box (`stepCarried`'s pick-up); a gondola's cabin alongside him on
 * its platform, creeping on while he racks his skis and steps in (`hold`,
 * over `gondola.stepIn`). */
function taken(
  run: GameState,
  plan: LiftPlan,
  ride: LiftRide,
  events: GameEvent[],
  k: number,
): void {
  const c = run.skier;
  const kind = plan.lift.kind;
  ride.phase = "ride";
  ride.t = 0;
  ride.u = kind === "gondola" ? K.gondola.load : plan.look.entry.at;
  ride.speed = kind === "gondola" ? K.gondola.creep : 0;
  ride.swing = 0;
  ride.tower = towerPast(plan, ride.u);
  ride.from = { x: c.x, y: c.y, z: c.z, heading: plan.heading };
  delete ride.faded;
  delete ride.due;
  if (k >= 0) ride.carrier = k;
  if (kind === "chair") onChair(plan, ride, k, run.t);
  events.push({ kind: "lift", t: run.t, id: plan.lift.id, lift: plan.lift.kind, phase: "take" });
  if (kind !== "drag") hold(run, plan, ride);
}

/** Carried: the grip up the rope at the rope's speed — slowed through the
 * terminal at the top — the chair or the cabin swinging on its hanger, and
 * let go of at the top. */
function stepCarried(run: GameState, plan: LiftPlan, ride: LiftRide, events: GameEvent[]): void {
  if (ride.stand !== undefined) {
    standUp(run, plan, ride);
    return;
  }
  const c = run.skier;
  const dt = TUNING.dt;
  const look = plan.look;
  const off = offAt(plan);
  const togo = Math.max(0, off - ride.u);
  // A cabin boarded off its platform creeps on while he steps in and its
  // doors shut (`cabinDoors`), and is taken back onto the rope after.
  const G = K.gondola;
  const creeping =
    plan.lift.kind === "gondola" && Number.isFinite(ride.from.y) && ride.t < G.stepIn + G.shut;
  const want = creeping
    ? G.creep
    : Math.min(look.speed, Math.sqrt(look.slow ** 2 + 2 * K.decel * togo));
  if (plan.lift.kind === "chair" && ride.carrier !== undefined) {
    // ON THE LIFT'S OWN CHAIR, wherever the clock has it: creeping through
    // the station, taken up to the rope's speed, slowed onto the unload.
    const at = carrierAt(plan, ride.carrier, run.t);
    ride.u = Math.min(off, Math.max(ride.u, at.side === 0 ? at.u : plan.length));
    ride.speed = carrierSpeedAt(plan, ride.u, 0);
  } else {
    ride.speed = Math.min(want, ride.speed + K.accel * dt);
    ride.u = Math.min(off, ride.u + ride.speed * dt);
    // A T-bar's rider never gets ahead of his bar's grip on the rope: the
    // cord paid out of its spring box between them only ever pulls.
    if (plan.lift.kind === "drag" && ride.carrier !== undefined) {
      const grip = carrierAt(plan, ride.carrier, run.t);
      if (grip.side === 0 && ride.u > grip.u) ride.u = grip.u;
    }
  }
  // Over a tower's sheaves the grip's way bends with the rope — the
  // carrier lurches into a swing off it (`carrierSwingAt`, read in `hold`).
  const s = plan.supports;
  while (ride.tower < s.length - 1 && s[ride.tower].u <= ride.u) {
    ride.tower++;
    events.push({ kind: "lift", t: run.t, id: plan.lift.id, lift: plan.lift.kind, phase: "tower" });
  }
  if (plan.lift.kind === "drag") {
    // Pulled up the track on his skis, sat back on his bar's right arm.
    const p = along(plan, ride.u, upRope(plan) + K.tee);
    setOff(run, p.x, p.z, plan.heading, ride.speed);
  } else hold(run, plan, ride);
  if (ride.u < off) return;
  // AT THE TOP.
  events.push({ kind: "lift", t: run.t, id: plan.lift.id, lift: plan.lift.kind, phase: "off" });
  if (plan.lift.kind === "gondola") {
    // Through the top station's hall — a cut, behind the picture's fade —
    // and out of its front door onto the pad, facing down the line,
    // walking out under the lift's hand (`standUp`).
    const p = letGoOf("gondola", plan.lift.bottom, plan.lift.top);
    setOff(run, p.x, p.z, p.heading, K.walkOut);
    ride.stand = 0;
    return;
  } else if (plan.lift.kind === "chair") {
    // His skis on the ramp, he stands up off the seat (`standUp`) — and
    // the chair he sat on runs on empty behind him.
    c.chairLeft = {
      index: ride.index,
      u: off,
      t: run.t,
      ...(ride.carrier !== undefined ? { carrier: ride.carrier } : {}),
    };
    ride.stand = 0;
    ride.swing = 0;
    return;
  }
  // Stood off it, the skis are his.
  c.lift = null;
}

/** STOOD UP OFF A CHAIR at the unload, a step of it: his skis on the ramp,
 * he rises off the seat over `lift.rise` s (`seatedShare`), pushing off
 * it and sliding on ahead of it, his way turned `lift.ramp` off the line to
 * the up rope's side — down the ramp on the diagonal, clear of the chairs
 * swinging round the wheel — and taken from the terminal's crawl up to
 * `lift.standUp`. Up, the skis are his. */
function standUp(run: GameState, plan: LiftPlan, ride: LiftRide): void {
  const c = run.skier;
  const dt = TUNING.dt;
  ride.stand = (ride.stand ?? 0) + dt;
  if (plan.lift.kind === "gondola") {
    // Out of a gondola's door, walked on out onto the pad.
    setOff(
      run,
      c.x + Math.sin(c.heading) * K.walkOut * dt,
      c.z + Math.cos(c.heading) * K.walkOut * dt,
      c.heading,
      K.walkOut,
    );
    if (ride.stand >= K.gondola.out) c.lift = null;
    return;
  }
  const e = smoothstep(0, 1, Math.min(1, ride.stand / K.rise));
  const heading = plan.heading + K.ramp * e;
  const way = plan.look.slow + (K.standUp - plan.look.slow) * e;
  setOff(run, c.x + Math.sin(heading) * way * dt, c.z + Math.cos(heading) * way * dt, heading, way);
  if (ride.stand >= K.rise) c.lift = null;
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
 * pad's rim, falling all the way); off a drag's top
 * every run a ramp comes down to and every other leaving it that
 * drops below it near enough (`joinOf`, the point it is joined at). A lane off the top that starts up
 * the contour above it is none of them. What the signs at a top point at,
 * and what a free ride's arrival picks its chair by. */
export function runsOffTop(
  level: Level,
  plan: LiftPlan,
): { run: number; at: { x: number; z: number; s: number } }[] {
  const top = plan.lift.top;
  const ramped = plan.lift.kind !== "drag";
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
  // Hung as the clock hangs every carrier (`carrierSwingAt`).
  ride.swing = carrierSwingAt(plan, ride.u, 0);
  const grip = along(plan, ride.u, upRope(plan));
  const gondola = plan.lift.kind === "gondola";
  // A cabin's grip runs on the station's rail through it (`gondolaGrip`).
  // ...and a chair's on its station's rail through the bottom terminal.
  const gy = gondola ? gondolaGrip(plan, ride.u) : carrierGripAt(plan, ride.u);
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
  // Scooped off the load line: lifted from where he stood onto the seat —
  // or stepped off a gondola's platform into its cabin, turned to its door
  // half way in and round to sit facing up the line.
  const k = seatedShare(ride);
  let heading = plan.heading;
  if (k < 1) {
    // Off the platform his step leads the sit.
    const w = gondola ? smoothstep(0, 0.7, k) : k;
    x = ride.from.x + (x - ride.from.x) * w;
    z = ride.from.z + (z - ride.from.z) * w;
    y = ride.from.y + (y - ride.from.y) * k;
    if (gondola) heading -= (Math.PI / 2) * Math.sin(Math.PI * k);
  }
  const dt = TUNING.dt;
  const fresh = ride.phase === "ride" && ride.t <= dt && k >= 1;
  c.vx = fresh ? plan.dx * ride.speed : (x - c.x) / dt;
  c.vy = fresh ? 0 : (y - c.y) / dt;
  c.vz = fresh ? plan.dz * ride.speed : (z - c.z) / dt;
  c.x = x;
  c.y = y;
  c.z = z;
  c.q = fromEuler(heading, ride.swing * k, 0);
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
 * a chair scoops him up over `lift.scoop` s and he stands up off it at
 * the unload over `lift.rise` s, a gondola's rider steps in
 * off its platform and sits down over `gondola.stepIn` s; every other
 * carrier, and a ride not boarded from the snow, has him at once. The pose
 * reads it. */
export function seatedShare(ride: LiftRide): number {
  if (ride.phase !== "ride") return 0;
  if (ride.stand !== undefined)
    return ride.kind === "chair" ? 1 - smoothstep(0, 1, Math.min(1, ride.stand / K.rise)) : 0;
  if (!Number.isFinite(ride.from.y)) return 1;
  const over = ride.kind === "gondola" ? K.gondola.stepIn : K.scoop;
  return smoothstep(0, 1, Math.min(1, ride.t / over));
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
    t: 0,
    tower: Math.max(
      1,
      s.findIndex((p) => p.u > u),
    ),
    from: { x: c.x, y: Number.NaN, z: c.z, heading: plan.heading },
  };
  if (plan.lift.kind === "chair") onChair(plan, c.lift, carrierNear(plan, u, run.t), run.t);
  if (plan.lift.kind === "drag") {
    // On a drag he is pulled up the track on his skis.
    const p = along(plan, c.lift.u, upRope(plan) + K.tee);
    setOff(run, p.x, p.z, plan.heading, c.lift.speed);
  } else hold(run, plan, c.lift);
  return resort.runs[pick].id;
}

/** HOW OPEN HIS CABIN'S DOORS ARE, 0 shut … 1 open, while a gondola has
 * him: sliding open as it comes round the wheel to the platform, open while
 * he steps in, and shut over `gondola.shut` s after; shut on any cabin he
 * did not board from the platform. The app draws it. */
export function cabinDoors(ride: LiftRide): number {
  const G = K.gondola;
  if (ride.kind !== "gondola") return 0;
  if (ride.phase === "wait") return smoothstep(-G.from, G.load - 1, ride.u);
  if (ride.phase !== "ride" || !Number.isFinite(ride.from.y)) return 0;
  return 1 - smoothstep(G.stepIn, G.stepIn + G.shut, ride.t);
}
