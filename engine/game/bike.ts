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
import { derive as deriveBike } from "./bike-frame.ts";
import { crashOf, startLanding, stepLanding } from "./bike-judge.ts";
import { dealtStrikes, freshTangle, stepTangle } from "./bike-tangle.ts";
import { freshBike, placeBike } from "./bike-place.ts";
import { keepTrail, restartPoint } from "./bike-trail.ts";
import { bikeWorldOf } from "./bike-world.ts";
import {
  BIKE_PLAN,
  barThrows,
  bikeInBounds,
  meetSolids,
  outOfSolids,
  planOut,
  shiftBike,
} from "./bike-solids.ts";
import { mendBody, stepBody } from "./body.ts";
import { standSkier } from "./course.ts";
import { throwRider } from "./crash.ts";
import { trafficStrike } from "./traffic-contact.ts";
import { beastStrike } from "./beast-hit.ts";
import { BIKE } from "./defs/bike.ts";
import { BIKE_TANGLE } from "./defs/bike-tangle.ts";
import { TUNING } from "./defs/tuning.ts";
import { liftZoneAt } from "./lift-ride.ts";
import { liftPlans } from "./lift-line.ts";
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
    crouch: input.jump || (input.pop ?? 0) > 0 ? 1 : 0,
    charge: input.pop,
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
    b.tangle = null;
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
    // PUSHED beside him, the bike is where his hands hold it (`walk`);
    // let go of — he is thrown or carried off — it lies down on its own.
    if (b.afoot && (c.thrown || c.lift)) b.afoot.push = false;
    // Thrown into it: the two tangled while they lie together — before the
    // bike's own step, which keeps it out of what it lies against.
    if (b.thrown && c.thrown) stepTangle(run, b, events);
    if (!b.afoot?.push) loose(run, b);
    if (!b.afoot || c.thrown || c.lift) return false;
    if (input.machine && bikeWithin(run)) {
      const world = bikeWorldOf(run.level, run.t);
      if (b.afoot.push) placeBike(b, world, b.x, b.z, b.heading, Math.max(0, b.afoot.pace));
      else if (b.mode === "down" || Math.abs(b.roll) > 0.3)
        placeBike(b, world, b.x, b.z, b.heading, 0);
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
  // THE VILLAGE'S TRAFFIC (`traffic-contact.ts`): a car, the bus, a bicycle
  // or a parked car met — held off it at a shuffle, knocked off past it.
  if (traffic(run, b, events)) return false;
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
  b.pace = Math.max(b.speed, (b.pace ?? 0) - BIKE_TANGLE.pace * dt);
  b.controls = ctl;
  rideBike(b, ctl, world, rideOf(run), dt, report);
  if (report.touchdown) startLanding(b, report, world);
  // A flight is said once it has lasted.
  if (b.airborne && b.airTime >= BIKE.airCounts && air < BIKE.airCounts) {
    events.push({ kind: "air", t: run.t, vy: b.vy, speed: b.speed });
  }
  const done = stepLanding(b, dt);
  if (done) landed(run, b, events, done);
  const met = meetSolids(run, b);
  const hit = Math.max(met.frame, met.bar);
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
  bikeInBounds(run, b);
  keepTrail(run.level, b);
  const struck = met.frame > C.hit || barThrows(met.bar) || rock > C.rock.strike;
  const how: BikeCrash | null = struck ? "hit" : crashOf(b, world, dt);
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

/** OFF IT ONTO HIS FEET on the machine press: stepped off on its right
 * (away from the chain) and stood beside it, its bars in his hands — he
 * walks it (`walk`). */
function hopOff(run: GameState, b: BikeState, events: GameEvent[]): void {
  const c = run.skier;
  const P = BIKE.walk.push;
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  // His spot: the bike's middle less the push's offset (`across` is his
  // side of it, so he stands the other way), clear of what stands there.
  const at = outOfSolids(
    run,
    b.x - fz * P.across - fx * P.ahead,
    b.z + fx * P.across - fz * P.ahead,
    WALKER,
  );
  standSkier(run, at.x, at.z, b.heading);
  c.vx = b.vx;
  c.vz = b.vz;
  derive(c, run.level);
  b.onIt = false;
  b.mode = "parked";
  b.t = 0;
  b.controls = { ...IDLE };
  b.afoot = { walked: 0, pace: Math.min(BIKE.walk.speed, hypot(b.vx, b.vz)), push: true };
  pushed(run, b);
  say(run, events, "hop");
}

/** A walker's reach round his middle, m: what he is held out of solids by. */
const WALKER = 0.3;

/** THE BIKE PUSHED BESIDE HIM: stood upright on its wheels at his side
 * (`BIKE.walk.push`), facing his way, rolling at his pace — and where a
 * trunk or a wall stands in its way, he is held back with it. */
function pushed(run: GameState, b: BikeState): void {
  const c = run.skier;
  const a = b.afoot!;
  const P = BIKE.walk.push;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  // The engine's right of heading h is (cos h, −sin h).
  const want = {
    x: c.x + fz * P.across + fx * P.ahead,
    z: c.z - fx * P.across + fz * P.ahead,
  };
  const clear = outOfSolids(run, want.x, want.z, BIKE_PLAN.wide);
  const dx = clear.x - want.x;
  const dz = clear.z - want.z;
  if (dx !== 0 || dz !== 0) {
    standSkier(run, c.x + dx, c.z + dz, c.heading);
    derive(c, run.level);
  }
  const spins = { f: b.front.turn, r: b.rear.turn };
  placeBike(b, bikeWorldOf(run.level, run.t), clear.x, clear.z, c.heading, a.pace);
  // ...its wheels turning on as it rolls, unridden: nobody on its springs.
  b.front.turn = spins.f + b.front.spin * dt;
  b.rear.turn = spins.r + b.rear.spin * dt;
  b.front.comp = 0;
  b.rear.comp = 0;
  b.mode = "parked";
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
    (b.afoot.push || b.speed <= 1)
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
  const clear = outOfSolids(run, x, z, WALKER);
  x = clear.x;
  z = clear.z;
  a.walked += Math.abs(a.pace) * dt;
  standSkier(run, x, z, heading);
  c.vx = Math.sin(heading) * a.pace;
  c.vz = Math.cos(heading) * a.pace;
  derive(c, run.level);
  if (a.push) pushed(run, b);
}

/** THE TRAFFIC AND THE WILDLIFE against the rider on the bike
 * (`trafficStrike`, `beastStrike`, which meet the skier where `hold` stood
 * him): held off a vehicle at a shuffle, staggered by an animal, the bike
 * moved with him; knocked off past it — the `car` or the `beast` crash
 * cause, the bike left down where it was. True when it threw him. */
function traffic(run: GameState, b: BikeState, events: GameEvent[]): boolean {
  const c = run.skier;
  const x = c.x;
  const z = c.z;
  const vx = c.vx;
  const vz = c.vz;
  const car = trafficStrike(run, events);
  if (car) {
    leave(run, b, events, "hit");
    throwRider(run, "car", car.v, events, { keepSkis: true });
    return true;
  }
  // ...and an animal on the trail (`beast-hit.ts`), on a free ride.
  const beast = run.wild ? beastStrike(run, events) : null;
  if (beast) {
    leave(run, b, events, "hit");
    throwRider(run, "beast", beast, events, { keepSkis: true });
    return true;
  }
  if (c.x !== x || c.z !== z) shiftBike(b, c.x - x, c.z - z);
  b.vx += c.vx - vx;
  b.vz += c.vz - vz;
  b.rider.vx = c.vx;
  b.rider.vz = c.vz;
  return false;
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
  const off = throwRider(run, "bike", v0, events, { how: C.over[how], keepSkis: true });
  // INTO HIS OWN BIKE (`bike-tangle.ts`): what the crash deals at the throw.
  b.tangle = freshTangle(b, off);
  dealtStrikes(run, b, how, Math.max(hypot3(v0.x, v0.y, v0.z), b.pace ?? 0), events);
}

/** The bike left to itself, its rider thrown: down, waiting for him. */
function leave(run: GameState, b: BikeState, events: GameEvent[], how: BikeCrash): void {
  if (run.skier.thrown) b.tangle = freshTangle(b, run.skier.thrown);
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
  planOut(run, b);
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
    // Down off the carrier (dropped off its seat, the fall thrown), the
    // bike lies where he does, waiting for him as after any fall: stood
    // up, he is put back on it.
    if (c.thrown) {
      b.mode = "down";
      b.thrown = true;
      b.t = 0;
    }
    return false;
  }
  placeBike(b, bikeWorldOf(run.level, run.t), c.x, c.z, c.heading, Math.max(0, c.way));
  // Let off at the top, the trail he rode below is behind him: a fall up
  // here puts him on the trail nearest it.
  b.ridden = null;
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
  const x0 = b.x;
  const z0 = b.z;
  b.x += vx * dt;
  b.z += vz * dt;
  const pushed = outOfSolids(run, b.x, b.z, BIKE_PLAN.wide);
  // Pushed out of a trunk or a post, its way into it is gone: a bike thrown
  // against one lies against it rather than sliding on into it every step.
  const px = pushed.x - b.x;
  const pz = pushed.z - b.z;
  const pd = hypot(px, pz);
  if (pd > 1e-6) {
    const toward = (b.vx * px + b.vz * pz) / pd;
    if (toward < 0) {
      b.vx -= (toward * px) / pd;
      b.vz -= (toward * pz) / pd;
    }
  }
  b.x = pushed.x;
  b.z = pushed.z;
  planOut(run, b);
  bikeInBounds(run, b);
  // Held against something (shoved there by the rider tangled in it), it
  // goes only as far as it went.
  const wx = b.x - x0 - vx * dt;
  const wz = b.z - z0 - vz * dt;
  if (wx * wx + wz * wz > 1e-10) {
    b.vx = (b.x - x0) / dt;
    b.vz = (b.z - z0) / dt;
  }
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
