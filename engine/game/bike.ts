// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE — a summer free ride's machine (`CreateGameOptions.bike`,
// `docs/downhill-bike.md`). The ride begins on it at a TRAIL HEAD of the
// bike park on a lift's top (`startBike`); the player rides it down the
// park's trails or anywhere else the mountain lets a tyre go, on his own
// keys (`bikeControls`, the one place they are read): the tuck the pedals,
// the back key both brakes (the grab the rear alone, a skid), the edge the
// bars, the lean his weight fore and aft, the jump a pop. Ridden into a
// CHAIR's or a GONDOLA's load zone (the drags stand still in summer), he
// and the bike are carried up together (`lift-ride.ts` takes him as it
// takes a skier; the bike rides with him) and he is back on it at the top.
// THE MACHINE PRESS steps him off onto his feet beside it — he WALKS, the
// bike lying where he left it — and on again, stood beside it.
//
// The bodies are `bike-body.ts`'s, a landing's judge and what throws him
// `bike-judge.ts`'s, the ground `bike-world.ts`'s; this module owns what
// the bike is doing, the rider on it, the trunks and the map's edge
// against it. THROWN (over the bars, a washout, a lowside, a landing he
// did not ride away, a trunk, a post or a rock hit, his body put on the
// ground — the `bike` crash cause, his injuries the body's like any
// fall's), the bike goes on as a loose body sliding on its side, and stood
// back up he is back on it at the nearest trail within `BIKE.board.back` m.
//
// Pure over the level, the state and the clock: nothing here draws from
// the stream, and a run with no bike never comes in here.

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { bikeTrailById, bikeTrailHeads } from "../mapgen/bike-park-query.ts";
import type { BikeTrailHead } from "../mapgen/bike-park-types.ts";
import { rideBike, type BikeRide, type BikeStepReport } from "./bike-body.ts";
import { bikeToWorld, derive as deriveBike } from "./bike-frame.ts";
import { crashOf, startLanding, stepLanding } from "./bike-judge.ts";
import { freshBike, placeBike } from "./bike-place.ts";
import { keepTrail, restartPoint } from "./bike-trail.ts";
import { bikeWorldOf } from "./bike-world.ts";
import { mendBody, stepBody } from "./body.ts";
import { standing } from "./building-walls.ts";
import { standSkier } from "./course.ts";
import { throwRider } from "./crash.ts";
import { BIKE } from "./defs/bike.ts";
import { TUNING } from "./defs/tuning.ts";
import { liftZoneAt } from "./lift-ride.ts";
import { liftPlans } from "./lift-line.ts";
import { solidsNear, solidsOf } from "./posts.ts";
import { rockStrike } from "./rock-ground.ts";
import { derive } from "./skier.ts";
import type {
  BikeControls,
  BikeCrash,
  BikePhaseEvent,
  BikeState,
  GameEvent,
  GameState,
  SkierInput,
} from "./state.ts";

const dt = TUNING.dt;
const C = BIKE.crash;
const G = 9.81;
const IDLE: BikeControls = { pedal: 0, front: 0, rear: 0, steer: 0, lean: 0, crouch: 0 };
/** A trunk met slower than this is a nudge, not a hit worth saying, m/s. */
const HIT_SAY = 2;
/** The bike's plan as the trunks meet it: a capsule down its length, m. */
const HALF_L = 1.05;
const HALF_W = 0.3;
/** A riderless bike lying on its side: its centre over the ground, m, how
 * far over it lies, rad, how fast it goes over, rad/s, and the friction of
 * its bars, pedals and tyres sliding on the ground. */
const LYING = { y: 0.22, roll: 1.35, rate: 3, slide: 0.6 };
const report: BikeStepReport = { touchdown: false, impact: 0, frontFirst: false };

/** WHAT THE RIDER'S HANDS AND BODY DO, read off the skier's own input while
 * he rides — the one place the bike's controls are mapped: the TUCK the
 * pedals; the BACK KEY both brakes, the GRAB (the trick key) the rear
 * alone — a skid; the EDGE the bars (a turn asked, which his hands make by
 * leaning it); the LEAN his weight fore and aft (+1 back); the JUMP, held,
 * the legs folded for a pop, sprung on its release — a bunny hop, and over
 * a roller a pump. The MACHINE PRESS is on and off (`stepBike`). */
export function bikeControls(input: SkierInput): BikeControls {
  const brake = clamp(input.brake, 0, 1);
  const skid = input.trick ? 1 : 0;
  return {
    pedal: clamp(input.tuck, 0, 1),
    front: brake,
    rear: Math.max(brake, skid),
    steer: clamp(input.steer, -1, 1),
    lean: clamp(input.lean, -1, 1),
    crouch: input.jump ? 1 : 0,
  };
}

/** THE KEYS THAT WORK `ctl` — `bikeControls` turned round, for the bot,
 * which rides as the player does, through his input (`bike-pilot.ts`). A
 * front lever on its own is not a key: the bot's front is its rear. */
export function bikeInput(ctl: BikeControls): SkierInput {
  const both = Math.max(ctl.front, 0);
  return {
    steer: ctl.steer,
    tuck: ctl.pedal,
    brake: both,
    lean: ctl.lean,
    reset: false,
    ...(ctl.rear > both + 0.05 ? { trick: true } : {}),
    ...(ctl.crouch > 0.5 ? { jump: true } : {}),
  };
}

const say = (
  run: GameState,
  events: GameEvent[],
  phase: BikePhaseEvent,
  extra: { landing?: BikeState["landing"]; how?: BikeCrash } = {},
): void => {
  const b = run.bike!;
  const l = extra.landing;
  events.push({
    kind: "bike",
    t: run.t,
    phase,
    x: b.x,
    y: b.y,
    z: b.z,
    speed: b.speed,
    ...(l ? { landing: l.verdict, g: l.peak, air: l.air } : {}),
    ...(extra.how ? { how: extra.how } : {}),
  });
};

// ---- where a ride begins ---------------------------------------------------

/** THE HEAD a ride on `trail` begins at — that trail's, else the first of
 * the easiest grade on the park, else any. */
function headOf(run: GameState, trail: string | null): BikeTrailHead | null {
  const heads = bikeTrailHeads(run.level);
  if (heads.length === 0) return null;
  const named = trail ? heads.find((h) => h.trail === trail) : undefined;
  if (named) return named;
  for (const grade of ["green", "blue", "red", "black"]) {
    const h = heads.find(
      (x) => x.grade === grade && bikeTrailById(run.level, x.trail)?.kind === "trail",
    );
    if (h) return h;
  }
  return heads[0];
}

/** A BIKE for `run`'s rider, stood at rest on the head of `trail` (or the
 * park's easiest), nobody on it — where the skier stands when the map has
 * no park. */
export function freshBikeRide(run: GameState, trail: string | null = null): BikeState {
  const b = freshBike(run.skier.spec.skierMass);
  const head = headOf(run, trail);
  const world = bikeWorldOf(run.level, run.t);
  const c = run.skier;
  if (head) placeBike(b, world, head.x, head.z, head.heading, 0);
  else placeBike(b, world, c.x, c.z, c.heading, 0);
  b.trail = head?.trail ?? trail;
  return b;
}

/** THE RIDE BEGUN at its trail head: a fresh bike there, the rider on it
 * and mended. */
export function startBike(run: GameState, events: GameEvent[]): void {
  const b = run.bike!;
  Object.assign(b, freshBikeRide(run, b.trail));
  const c = run.skier;
  standSkier(run, b.x, b.z, b.heading);
  mendBody(c.body);
  c.thrown = null;
  mount(run, b);
  say(run, events, "restart");
}

// ---- the step --------------------------------------------------------------

/** ONE STEP OF THE BIKE, before the skier is stepped: ridden, carried up a
 * lift with him, lying where he left it or where it threw him — and the
 * rider on it held, walking beside it, or let go. True while the step is
 * the bike's (he rides it or walks) — the skier's own step waits. `events`
 * is the run's own list. */
export function stepBike(run: GameState, input: SkierInput, events: GameEvent[]): boolean {
  const b = run.bike;
  if (!b) return false;
  b.t += dt;
  if (b.hitCooldown > 0) b.hitCooldown -= dt;
  const c = run.skier;
  // THROWN OFF IT and stood back up: back on it.
  if (b.thrown && !c.thrown) {
    backOnTrail(run, b);
    b.thrown = false;
    mount(run, b);
    say(run, events, "right");
    return true;
  }
  // THROWN OFF IT BY SOMETHING ELSE: it goes on without him.
  if (b.onIt && c.thrown) {
    leave(run, b, events, "down");
    return false;
  }
  if (b.mode === "lift") return carried(run, b, events);
  if (!b.onIt) {
    loose(run, b);
    if (!b.afoot || c.thrown || c.lift) return false;
    if (input.machine && bikeWithin(run)) {
      if (b.mode === "down" || Math.abs(b.roll) > 0.3)
        placeBike(b, bikeWorldOf(run.level, run.t), b.x, b.z, b.heading, 0);
      mount(run, b);
      say(run, events, "board");
      return true;
    }
    // Pressed to start again, he is put back on it.
    if (input.reset) {
      backOnTrail(run, b);
      mount(run, b);
      say(run, events, "right");
      return true;
    }
    walk(run, b, input);
    return true;
  }
  // RIDDEN. The reset stands it back on the nearest trail, at rest.
  if (input.reset) {
    backOnTrail(run, b);
    hold(run, b);
    say(run, events, "right");
  }
  // THE MACHINE PRESS: off it, onto his feet.
  if (input.machine) {
    hopOff(run, b, events);
    return true;
  }
  ride(run, b, bikeControls(input), events);
  if (!b.onIt) return false;
  hold(run, b);
  // The blows of the ride on his body (`body.ts`): the landings' loads, a
  // trunk's blow — as on his skis.
  stepBody(run, events, null);
  // INTO A CHAIR'S OR A GONDOLA'S LOAD ZONE: the lift takes them both.
  const zone = liftZoneAt(run);
  if (zone && liftPlans(run.level)[zone.index].lift.kind !== "drag") {
    takeLift(run, b, events);
    return false;
  }
  return true;
}

/** HOW THE BIKE IS RIDDEN on this run: the assist's hands, his on the bars. */
function rideOf(run: GameState): BikeRide {
  return { yaw: run.assist.yaw, air: run.assist.air, hands: true };
}

/** The bodies stepped under `ctl`, the landings judged and said, the
 * trunks, the rock and the map's edge — and whatever throws him. */
function ride(run: GameState, b: BikeState, ctl: BikeControls, events: GameEvent[]): void {
  const world = bikeWorldOf(run.level, run.t);
  const v0 = { x: b.rider.vx, y: b.rider.vy, z: b.rider.vz };
  const air = b.airTime;
  b.controls = ctl;
  rideBike(b, ctl, world, rideOf(run), dt, report);
  if (report.touchdown) startLanding(b, report, world);
  // A flight is said once it has lasted.
  if (b.airborne && b.airTime >= BIKE.airCounts && air < BIKE.airCounts) {
    events.push({ kind: "air", t: run.t, vy: b.vy, speed: b.speed });
  }
  const done = stepLanding(b, dt);
  if (done) landed(run, b, events, done);
  const hit = trees(run, b);
  if (hit > HIT_SAY && b.hitCooldown <= 0) {
    b.hitCooldown = 0.5;
    events.push({ kind: "hit", t: run.t, speed: hit, x: b.x, z: b.z });
  }
  const rock = rockStrike(
    run.level,
    b.front.x,
    b.front.z,
    b.vx,
    b.vy,
    b.vz,
    C.rock.reach,
    C.rock.climb,
  );
  bounds(run, b);
  keepTrail(run.level, b);
  const how: BikeCrash | null = hit > C.hit || rock > C.rock.strike ? "hit" : crashOf(b, world, dt);
  if (!how) return;
  // A landing he could not hold is said before he goes down off it.
  if (b.landing) landed(run, b, events, b.landing);
  stepBody(run, events, null);
  throwOff(run, b, events, v0, how);
}

/** A LANDING SAID: the skier's own `land` (what the body and the record
 * read) and the bike's verdict. */
function landed(
  run: GameState,
  b: BikeState,
  events: GameEvent[],
  l: NonNullable<BikeState["landing"]>,
): void {
  b.landing = null;
  events.push({
    kind: "land",
    t: run.t,
    airTime: l.air,
    impact: l.v,
    speed: b.speed,
    harsh: l.verdict !== "clean",
    lost: 0,
    g: l.peak,
    off: l.peak / C.land,
  });
  say(run, events, "land", { landing: l });
}

// ---- the rider -------------------------------------------------------------

/** THE RIDER ON THE BIKE: the skier's body where the rider's is, turned
 * with the frame and off the snow — his skis are not on (he rides in shoes). */
function hold(run: GameState, b: BikeState): void {
  const c = run.skier;
  c.x = b.rider.x;
  c.y = b.rider.y;
  c.z = b.rider.z;
  c.vx = b.rider.vx;
  c.vy = b.rider.vy;
  c.vz = b.rider.vz;
  c.q = b.q;
  c.wx = b.wx;
  c.wy = b.wy;
  c.wz = b.wz;
  c.airborne = false;
  c.airTime = 0;
  for (const contact of c.contacts) {
    contact.touching = false;
    contact.load = 0;
  }
  derive(c, run.level);
  c.incline = 0;
  c.edge = 0;
  c.skid = 0;
  c.skiAngle = 0;
  c.tuck = 0;
  c.overFor = 0;
  c.stuckFor = 0;
  c.bodyHit = 0;
}

/** On it: the bike his. */
function mount(run: GameState, b: BikeState): void {
  const c = run.skier;
  b.onIt = true;
  b.mode = "ridden";
  b.afoot = null;
  b.lift = null;
  b.t = 0;
  b.controls = { ...IDLE };
  c.lift = null;
  c.tunnel = null;
  hold(run, b);
}

/** OFF IT ONTO HIS FEET on the machine press: stepped off on its left, the
 * bike let go to lie down where it rolls to, and he walks. */
function hopOff(run: GameState, b: BikeState, events: GameEvent[]): void {
  const c = run.skier;
  const left = bikeToWorld(b.q, { x: -0.7, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
  standSkier(run, b.x + left.x, b.z + left.z, b.heading);
  c.vx = b.vx;
  c.vz = b.vz;
  derive(c, run.level);
  b.onIt = false;
  b.mode = "parked";
  b.t = 0;
  b.controls = { ...IDLE };
  b.afoot = { walked: 0, pace: hypot(b.vx, b.vz) };
  say(run, events, "hop");
}

/** WHETHER THE MACHINE PRESS PUTS HIM ON IT: walking beside his bike —
 * within `BIKE.board.reach` of it, it lying still, he slower than
 * `BIKE.board.fastest`. What the HUD offers the press on is this. */
export function bikeWithin(run: GameState): boolean {
  const b = run.bike;
  const c = run.skier;
  if (!b || b.onIt || b.thrown || !b.afoot || b.mode === "lift") return false;
  if (c.thrown || c.lift) return false;
  return (
    hypot(c.x - b.x, c.z - b.z) <= BIKE.board.reach &&
    hypot3(c.vx, c.vy, c.vz) <= BIKE.board.fastest &&
    b.speed <= 1
  );
}

/** WALKING beside the bike: the tuck forward, the back key back, the edge
 * turning him — at a walker's pace on the ground. */
function walk(run: GameState, b: BikeState, input: SkierInput): void {
  const W = BIKE.walk;
  const c = run.skier;
  const a = b.afoot!;
  const want = (clamp(input.tuck, 0, 1) - 0.5 * clamp(input.brake, 0, 1)) * W.speed;
  a.pace += clamp(want - a.pace, -3 * dt, 3 * dt);
  const heading = c.heading + clamp(input.steer, -1, 1) * W.turn * dt;
  const lo = TUNING.bounds.margin;
  const hi = run.level.size - lo;
  let x = clamp(c.x + Math.sin(heading) * a.pace * dt, lo, hi);
  let z = clamp(c.z + Math.cos(heading) * a.pace * dt, lo, hi);
  // Held out of the trunks and the walls as the bike is.
  const pushed = outOf(run, x, z, 0, 0.3);
  x = pushed.x;
  z = pushed.z;
  a.walked += Math.abs(a.pace) * dt;
  standSkier(run, x, z, heading);
  c.vx = Math.sin(heading) * a.pace;
  c.vz = Math.cos(heading) * a.pace;
  derive(c, run.level);
}

/** THE RIDER THROWN `how`: his body off where it was, with the velocity it
 * had; the bike goes on without him. */
function throwOff(
  run: GameState,
  b: BikeState,
  events: GameEvent[],
  v0: { x: number; y: number; z: number },
  how: BikeCrash,
): void {
  const c = run.skier;
  standSkier(run, b.rider.x, b.rider.z, b.heading);
  c.x = b.rider.x;
  c.y = b.rider.y;
  c.z = b.rider.z;
  c.q = b.q;
  // Laid over with the bike, he takes its roll with him.
  if (how === "lowside" || how === "washout") {
    c.wx = b.wx;
    c.wy = b.wy;
    c.wz = b.wz;
  }
  leave(run, b, events, how);
  throwRider(run, "bike", v0, events, { how: C.over[how], keepSkis: true });
}

/** The bike left to itself, its rider thrown: down, waiting for him. */
function leave(run: GameState, b: BikeState, events: GameEvent[], how: BikeCrash): void {
  b.onIt = false;
  b.mode = "down";
  b.thrown = true;
  b.t = 0;
  b.landing = null;
  b.controls = { ...IDLE };
  say(run, events, "crash", { how });
}

/** STOOD BACK ON THE NEAREST TRAIL within `BIKE.board.back` m, facing down
 * it, at rest — or upright where it lies. */
function backOnTrail(run: GameState, b: BikeState): void {
  const world = bikeWorldOf(run.level, run.t);
  const p = restartPoint(run.level, b, BIKE.board.back);
  if (p) placeBike(b, world, p.x, p.z, p.heading, 0);
  else placeBike(b, world, b.x, b.z, b.heading, 0);
}

// ---- a lift ---------------------------------------------------------------

/** INTO A LIFT'S LOAD ZONE: he is the lift's, as a skier is, stood off the
 * bike with its way, and the bike is carried with him. */
function takeLift(run: GameState, b: BikeState, events: GameEvent[]): void {
  const c = run.skier;
  standSkier(run, c.x, c.z, b.heading);
  c.vx = b.vx;
  c.vz = b.vz;
  derive(c, run.level);
  b.onIt = false;
  b.mode = "lift";
  b.t = 0;
  b.controls = { ...IDLE };
  const zone = liftZoneAt(run);
  b.lift = zone ? liftPlans(run.level)[zone.index].lift.id : null;
  say(run, events, "lift");
}

/** CARRIED: the bike with him on the carrier (the drawing hangs it there)
 * until the lift lets him go — then, once he is on his feet, he is on it
 * again where he stands, rolling as he was. */
function carried(run: GameState, b: BikeState, events: GameEvent[]): boolean {
  const c = run.skier;
  if (c.lift || c.airborne || c.thrown) {
    b.x = c.x;
    b.y = c.y;
    b.z = c.z;
    b.q = c.q;
    b.vx = c.vx;
    b.vy = c.vy;
    b.vz = c.vz;
    b.wx = b.wy = b.wz = 0;
    b.rider.x = c.x;
    b.rider.y = c.y;
    b.rider.z = c.z;
    deriveBike(b);
    if (c.thrown) b.mode = "down";
    return false;
  }
  placeBike(b, bikeWorldOf(run.level, run.t), c.x, c.z, c.heading, Math.max(0, c.way));
  mount(run, b);
  say(run, events, "board");
  return true;
}

// ---- the bike on its own ---------------------------------------------------

const n = { x: 0, y: 1, z: 0 };

/** A RIDERLESS BIKE: lying on its side, sliding on the ground under its own
 * weight and its friction until it stops — a loose body, cheap. */
function loose(run: GameState, b: BikeState): void {
  const level = run.level;
  level.normalAt(b.x, b.z, n);
  // The slope's pull, and the ground's friction against the way it slides.
  let vx = b.vx;
  let vy = b.vy;
  let vz = b.vz;
  const into = vx * n.x + vy * n.y + vz * n.z;
  vx -= into * n.x;
  vy -= into * n.y;
  vz -= into * n.z;
  const gx = G * n.y * n.x;
  const gy = G * (n.y * n.y - 1);
  const gz = G * n.y * n.z;
  const pull = hypot3(gx, gy, gz);
  const v = hypot3(vx, vy, vz);
  const grip = LYING.slide * G * n.y;
  if (v < 0.05 && pull <= grip) {
    vx = vy = vz = 0;
  } else {
    vx += gx * dt;
    vy += gy * dt;
    vz += gz * dt;
    const w = hypot3(vx, vy, vz);
    const cut = Math.min(w, grip * dt);
    if (w > 0) {
      vx -= (vx / w) * cut;
      vy -= (vy / w) * cut;
      vz -= (vz / w) * cut;
    }
  }
  b.vx = vx;
  b.vy = vy;
  b.vz = vz;
  b.x += vx * dt;
  b.z += vz * dt;
  const pushed = outOf(run, b.x, b.z, HALF_L * 0.5, HALF_W);
  b.x = pushed.x;
  b.z = pushed.z;
  bounds(run, b);
  b.y = level.groundAt(b.x, b.z) + LYING.y;
  // Laid down on the side it leant to (the left, its chain's other side,
  // when it stood upright).
  const side = b.roll > 0.05 ? 1 : -1;
  const roll = b.roll + clamp(side * LYING.roll - b.roll, -LYING.rate * dt, LYING.rate * dt);
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  const pitch = Math.atan2(
    level.groundAt(b.x + fx * 0.6, b.z + fz * 0.6) - level.groundAt(b.x - fx * 0.6, b.z - fz * 0.6),
    1.2,
  );
  b.q = fromEuler(b.heading, pitch, roll);
  b.wx = b.wy = b.wz = 0;
  b.rider.x = b.x;
  b.rider.y = b.y;
  b.rider.z = b.z;
  b.rider.vx = b.vx;
  b.rider.vy = b.vy;
  b.rider.vz = b.vz;
  b.airborne = false;
  for (const w of [b.front, b.rear]) {
    w.touching = false;
    w.load = 0;
    w.spin *= Math.max(0, 1 - dt / 3);
    w.turn += w.spin * dt;
  }
  b.cadence = 0;
  deriveBike(b);
}

// ---- trunks and edges ------------------------------------------------------

const near: number[] = [];

/** THE TRUNKS AND THE POSTS (`posts.ts`) against the bike's plan — a
 * capsule down its length — pushed out of, the closing speed taken off.
 * Returns the hardest closing speed met, m/s. */
function trees(run: GameState, b: BikeState): number {
  const level = run.level;
  const solids = solidsOf(level);
  if (solids.length === 0) return 0;
  solidsNear(level, b.x, b.z, HALF_L + 1, near);
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  let worst = 0;
  for (const i of near) {
    const t = solids[i];
    if (b.y < t.y - 1 || b.y > t.y + t.height || !standing(run, t)) continue;
    const u = clamp((t.x - b.x) * fx + (t.z - b.z) * fz, -HALF_L, HALF_L);
    const dx = b.x + fx * u - t.x;
    const dz = b.z + fz * u - t.z;
    const d = hypot(dx, dz);
    const reach = HALF_W + t.radius;
    if (d >= reach) continue;
    const nx = d > 1e-6 ? dx / d : -fx;
    const nz = d > 1e-6 ? dz / d : -fz;
    shift(b, nx * (reach - d), nz * (reach - d));
    const vn = b.vx * nx + b.vz * nz;
    if (vn >= 0) continue;
    b.vx -= 1.3 * vn * nx;
    b.vz -= 1.3 * vn * nz;
    b.rider.vx -= 0.5 * vn * nx;
    b.rider.vz -= 0.5 * vn * nz;
    b.wy += u * (nx * fz - nz * fx) * -vn * 0.3;
    worst = Math.max(worst, -vn);
  }
  return worst;
}

/** (x, z) pushed out of every trunk and post within `half` m along nothing
 * and `width` m across: a walker's or a lying bike's plan. */
function outOf(
  run: GameState,
  x: number,
  z: number,
  half: number,
  width: number,
): { x: number; z: number } {
  const level = run.level;
  const solids = solidsOf(level);
  solidsNear(level, x, z, half + width + 1, near);
  for (const i of near) {
    const t = solids[i];
    if (!standing(run, t)) continue;
    const dx = x - t.x;
    const dz = z - t.z;
    const d = hypot(dx, dz);
    const reach = width + t.radius;
    if (d >= reach || d < 1e-6) continue;
    x = t.x + (dx / d) * reach;
    z = t.z + (dz / d) * reach;
  }
  return { x, z };
}

/** The bike, its rider and its wheels moved by (dx, dz). */
function shift(b: BikeState, dx: number, dz: number): void {
  b.x += dx;
  b.z += dz;
  b.rider.x += dx;
  b.rider.z += dz;
}

/** The map's edge: held inside it. */
function bounds(run: GameState, b: BikeState): void {
  const lo = TUNING.bounds.margin;
  const hi = run.level.size - lo;
  const dx = clamp(b.x, lo, hi) - b.x;
  const dz = clamp(b.z, lo, hi) - b.z;
  if (dx === 0 && dz === 0) return;
  shift(b, dx, dz);
  if (dx !== 0) b.vx = dx > 0 ? Math.max(0, b.vx) : Math.min(0, b.vx);
  if (dz !== 0) b.vz = dz > 0 ? Math.max(0, b.vz) : Math.min(0, b.vz);
}
