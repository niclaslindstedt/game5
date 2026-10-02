// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY ON ITS LEGS, kept by the view between frames (it is the
// picture's, not the physics'): the spring the figure's mass rides on its
// legs, and the moments a pose eases through rather than jumps — into the
// air and out of it, a jump loaded and sprung. Stepped with the frame's
// `dt` (`skis-body.ts`); `skier-pose.ts` reads it. Three-free.

import { strideRate, type Save, type SkierState } from "@engine";

import { gaitOf } from "./skier-gait.ts";

import { JOLT_KEYS, joltOf, NO_JOLT, type Jolt } from "./skier-save.ts";

/** THE BODY ON ITS LEGS — the secondary motion a skier's own mass has on
 * top of the skis, kept by the view (it is the picture's, not the
 * physics'): a spring-damper in the pair's vertical, kicked by every change
 * in the pair's own climb, so a landing that stops the skis dead leaves the
 * body still coming down — the knees fold and spring back — and the chatter
 * of a hard piste is a jiggle. */
export type SkierSpring = {
  /** The fold, m (positive sunk), and its rate, m/s. */
  bump: number;
  rate: number;
  /** The pair's climb at the last frame, m/s, or NaN before the first. */
  lastVy: number;
  /** How far into the AIR his body is, 0 on the snow to 1 in flight —
   * eased, so leaving the snow and meeting it again are motions, not a
   * pose swapped in a frame. */
  air: number;
  airRate: number;
  /** A JUMP's load as his body holds it, 0..1: it follows the engine's
   * load down into the crouch and, sprung, lets go of it over the pop
   * rather than in the step the engine zeroes it. */
  load: number;
  loadRate: number;
  /** His own clock, s — what a skier standing still breathes and shifts
   * his weight by, started at his own offset so a start line of four does
   * not breathe in step. */
  clock: number;
  /** THE POLE PLANT a turn is started on: the side the skis were last put
   * on their edge to (−1 left, 1 right, 0 none yet), how long ago, the
   * plant under way (the pole, 0 left; seconds into it, `Infinity` with
   * none; how long it lasts, s) and how much of a plant his riding allows
   * (0..1, eased — none tucked, working, in the air or at a crawl). */
  turnSide: -1 | 0 | 1;
  turnHeld: number;
  plantSide: 0 | 1;
  plantT: number;
  plantLength: number;
  plantOk: number;
  /** THE HIPS' SHIFT INTO A TURN as his body carries it, m, and its rate —
   * the engine's `hipRight` followed on a critically damped spring, so a
   * change of edge starts as a motion rather than at full speed in a step
   * (NaN until the first ride is read). */
  hip: number;
  hipRate: number;
  /** THE EDGE AND THE PAIR'S ROLL as his body carries them, rad, and their
   * rates — the skis are the engine's to the frame, but the legs above the
   * boots and the trunk on them take a rate-limited edge up as a motion. */
  edge: number;
  edgeRate: number;
  roll: number;
  rollRate: number;
  /** THE SAVE as his body makes it (`skier-save.ts`): the shape a near fall
   * throws him into, followed on a spring so it comes on and goes as a
   * motion, and one save cut short by the next does not jump. */
  jolt: Jolt;
  joltRate: Jolt;
  /** THE SKID'S PIVOT as the skis are drawn, rad, and its rate — the
   * engine's `skiAngle` followed: it is the brake times the steer key, so
   * it swings the skis across in a single step whenever the key changes
   * under the brake (and at GO, out of the gate's held brake). */
  skiAngle: number;
  skiAngleRate: number;
  /** THE START GATE: how far into the ready stance he is, 0..1, and its
   * rate — set under the lights, the poles planted over the wand, and
   * come out of as GO sends him into his first push. */
  ready: number;
  readyRate: number;
  /** THE SNOW PASSED SINCE THE LAST PLANT, m, and the stride it was planted
   * on (the engine's stride count, floored; NaN before the first) — how
   * far behind him a planted basket is, kept as he went rather than
   * guessed off his speed now, which overshoots while a push is speeding
   * him up. */
  poled: number;
  poledStride: number;
  /** HOW MUCH HE WORKS THE POLES as his arms carry it (`Gait.keep`), and
   * its rate — giving the stroke up for the tuck, and taking it back, as
   * a motion (NaN until the first ride is read). */
  keep: number;
  keepRate: number;
};

/** What the plant reads of the run, when the caller hands it in: the
 * skis' edge in the world (rad, right positive), the speed (m/s), the
 * tuck (0..1) and the drive at a crawl (`SkierState.drive`). */
export type SpringRide = {
  edge: number;
  speed: number;
  crouch: number;
  drive: number;
  hipRight: number;
  roll: number;
  /** What he last nearly fell to (`SkierState.save`). */
  save?: Save | null;
  /** The skid's pivot, rad (`SkierState.skiAngle`); none when left out. */
  skiAngle?: number;
  /** The engine's stride count and the way along the skis, m/s
   * (`SkierState.stride` / `.way`) — the plants the snow is passed from. */
  stride?: number;
  way?: number;
  /** The pair's pitch, rad, and the body thrown off it (`SkierState`) —
   * what the gait is read off. */
  pitch?: number;
  thrown?: SkierState["thrown"];
};
/** How quickly his body is thrown into a save and fights back out of it,
 * rad/s — a tenth of a second to most of the way: a flung arm moves at
 * some four metres a second and no faster, so a blow reads as a motion
 * (`tests/skier_save_test.ts` holds a joint under 3 cm a step). */
const JOLT_FOLLOW = 24;
/** How quickly he gives the poles up for the tuck and takes them back,
 * rad/s — some quarter of a second. */
const KEEP_FOLLOW = 12;
/** How quickly his body takes up the engine's hip shift, its edge and
 * its roll, rad/s — a spring
 * some seventy milliseconds slow, critically damped. */
const HIP_FOLLOW = 30;

/** THE PLANT'S TIMING: the edge a turn is read as begun past (rad), so a
 * flat run's chatter starts nothing; the least a
 * turn must have held for the next to be planted on (s); the speeds a
 * plant is made between (m/s); and how long one takes, s — the swing, the
 * touch and the release, shorter the faster he goes. */
const PLANT = { on: 0.14, held: 0.35, slow: 3, fast: 26, length: 6.5, least: 0.42, most: 0.85 };

/** The body's natural frequency on its legs, rad/s (about 2.3 Hz), its
 * damping ratio, the share of the pair's change of climb the body is
 * kicked by (the legs soak up the rest before the knees move), and the most
 * they fold or extend, m. */
const LEGS = { omega: 14.5, zeta: 0.42, kick: 0.5, fold: 0.22, extend: 0.05 };
/** How fast the body goes into the air and comes back to the snow, and
 * how fast a load is taken and let go, rad/s — critically damped springs,
 * so each starts as a motion rather than at full speed in a step: a fifth
 * of a second to most of the way into the air, a tenth to let go of a
 * jump, the time a skier's extension takes. */
const EASE = { up: 16, down: 25, take: 32, release: 29 };
/** How fast he settles into the start gate's stance and comes out of it,
 * rad/s — out of it is the first push, which is quick. */
const READY = { in: 9, out: 20 };

export function createSkierSpring(offset = 0): SkierSpring {
  return {
    bump: 0,
    rate: 0,
    lastVy: Number.NaN,
    air: 0,
    airRate: 0,
    load: 0,
    loadRate: 0,
    clock: offset,
    turnSide: 0,
    turnHeld: 0,
    plantSide: 0,
    plantT: Number.POSITIVE_INFINITY,
    plantLength: PLANT.most,
    plantOk: 0,
    hip: Number.NaN,
    hipRate: 0,
    edge: 0,
    edgeRate: 0,
    roll: 0,
    rollRate: 0,
    jolt: { ...NO_JOLT },
    joltRate: { ...NO_JOLT },
    skiAngle: 0,
    skiAngleRate: 0,
    ready: 0,
    readyRate: 0,
    poled: 0,
    poledStride: Number.NaN,
    keep: Number.NaN,
    keepRate: 0,
  };
}

/** One reading followed on a critically damped spring of `w` rad/s: its
 * value and rate after `dt` s toward `to`. */
function follow(v: number, rate: number, to: number, dt: number, w = HIP_FOLLOW): [number, number] {
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    rate += (w * w * (to - v) - 2 * w * rate) * h;
    v += rate * h;
  }
  return [v, rate];
}

/** The hips' shift, the edge, the roll and the skid's pivot followed
 * (`SkierSpring.hip`, `.edge`, `.roll`, `.skiAngle`) — taken as they are
 * on the first ride read. */
function stepBody(s: SkierSpring, ride: SpringRide, dt: number): void {
  if (Number.isNaN(s.hip)) {
    s.hip = ride.hipRight;
    s.edge = ride.edge;
    s.roll = ride.roll;
    s.skiAngle = ride.skiAngle ?? 0;
    return;
  }
  [s.hip, s.hipRate] = follow(s.hip, s.hipRate, ride.hipRight, dt);
  [s.edge, s.edgeRate] = follow(s.edge, s.edgeRate, ride.edge, dt);
  [s.roll, s.rollRate] = follow(s.roll, s.rollRate, ride.roll, dt);
  const to = joltOf(ride.save);
  for (const k of JOLT_KEYS) {
    [s.jolt[k], s.joltRate[k]] = follow(s.jolt[k], s.joltRate[k], to[k], dt, JOLT_FOLLOW);
  }
  [s.skiAngle, s.skiAngleRate] = follow(s.skiAngle, s.skiAngleRate, ride.skiAngle ?? 0, dt);
}

/** Read the turns off the run and start a plant on each new one — the
 * pole on the inside of the turn being begun, the downhill pole of the
 * last — the way a skier times his turns on his poles. */
function stepPlant(s: SkierSpring, ride: SpringRide, airborne: boolean, dt: number): void {
  s.plantT += dt;
  s.turnHeld += dt;
  const ok =
    airborne || ride.speed < PLANT.slow || ride.speed > PLANT.fast
      ? 0
      : Math.max(0, 1 - ride.crouch * 1.6) * Math.max(0, 1 - ride.drive * 6);
  s.plantOk = ok + (s.plantOk - ok) * Math.exp(-8 * dt);
  // A turn is over when the next one begins, not when the skis pass flat
  // between them.
  const e = ride.edge;
  const side = e > PLANT.on ? 1 : e < -PLANT.on ? -1 : 0;
  if (side === 0 || side === s.turnSide) return;
  if (s.turnHeld > PLANT.held && s.plantT > s.plantLength && s.plantOk > 0.5) {
    s.plantSide = side > 0 ? 1 : 0;
    s.plantT = 0;
    s.plantLength = Math.max(PLANT.least, Math.min(PLANT.most, PLANT.length / ride.speed));
  }
  s.turnSide = side;
  s.turnHeld = 0;
}

/** The snow passed since the last plant: run on by the way, and begun
 * again on each new stride from the share of it already gone — and how
 * much he works the poles, followed. */
function stepPoled(s: SkierSpring, ride: SpringRide, airborne: boolean, dt: number): void {
  if (ride.stride === undefined || ride.way === undefined) return;
  const keep = gaitOf({
    drive: ride.drive,
    stride: ride.stride,
    speed: ride.speed,
    way: ride.way,
    crouch: ride.crouch,
    pitch: ride.pitch ?? 0,
    airborne,
    thrown: ride.thrown ?? null,
  }).keep;
  if (Number.isNaN(s.keep)) s.keep = keep;
  else [s.keep, s.keepRate] = follow(s.keep, s.keepRate, keep, dt, KEEP_FOLLOW);
  const n = Math.floor(ride.stride);
  const way = Math.abs(ride.way);
  if (n !== s.poledStride) {
    const rate = strideRate(ride.speed) * Math.max(0.2, ride.drive);
    s.poled = ((ride.stride - n) * way) / rate;
    s.poledStride = n;
  } else s.poled += way * dt;
}

/** Advance the body on its legs by `dt` s for a pair climbing at `vy` m/s
 * (the engine's own), in the air or not, a jump loaded `load` of the way
 * (0..1; the engine's `jumpLoad` over a full one), `waiting` in the start
 * gate under the lights or not. */
export function stepSkierSpring(
  s: SkierSpring,
  vy: number,
  airborne: boolean,
  dt: number,
  load = 0,
  ride?: SpringRide,
  waiting = false,
): void {
  if (!(dt > 0)) return;
  s.clock += dt;
  [s.ready, s.readyRate] = follow(
    s.ready,
    s.readyRate,
    waiting ? 1 : 0,
    dt,
    waiting ? READY.in : READY.out,
  );
  s.ready = Math.max(0, Math.min(1, s.ready));
  if (ride) {
    stepPlant(s, ride, airborne, dt);
    stepBody(s, ride, dt);
    stepPoled(s, ride, airborne, dt);
  }
  const into = airborne ? 1 : 0;
  [s.air, s.airRate] = follow(s.air, s.airRate, into, dt, airborne ? EASE.up : EASE.down);
  s.air = Math.max(0, Math.min(1, s.air));
  const held = airborne ? 0 : Math.max(0, Math.min(1, load));
  [s.load, s.loadRate] = follow(
    s.load,
    s.loadRate,
    held,
    dt,
    held > s.load ? EASE.take : EASE.release,
  );
  s.load = Math.max(0, Math.min(1, s.load));
  if (!Number.isNaN(s.lastVy)) {
    // The pair's change of climb since the last frame is a kick the body
    // does not share: it keeps going the way it was.
    s.rate += (vy - s.lastVy) * LEGS.kick * (airborne ? 0 : 1);
  }
  s.lastVy = vy;
  const n = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const acc = -LEGS.omega * LEGS.omega * s.bump - 2 * LEGS.zeta * LEGS.omega * s.rate;
    s.rate += acc * h;
    s.bump += s.rate * h;
  }
  if (s.bump > LEGS.fold) {
    s.bump = LEGS.fold;
    s.rate = Math.min(0, s.rate);
  } else if (s.bump < -LEGS.extend) {
    s.bump = -LEGS.extend;
    s.rate = Math.max(0, s.rate);
  }
}

/** THE SKID'S PIVOT AS DRAWN: the spring's, once it has read a ride and
 * while he is on his skis — the engine's own otherwise (thrown, the skis
 * go on without him and are drawn where the engine has them). */
export function drawnSkiAngle(
  s: SkierSpring,
  skier: { skiAngle: number; thrown: unknown },
): number {
  return Number.isNaN(s.hip) || skier.thrown ? skier.skiAngle : s.skiAngle;
}

/** How long after GO a skier still held on his brake with no push begun is
 * read as still in the gate, s — the field's rivals react a beat after the
 * lights go out (`RACE.reactBand`), held in the gate until they do. */
const GATE_HOLD = 1;
/** …and the most he creeps there on his held brake, m/s. */
const GATE_CREEP = 0.6;

/** IN THE START GATE: under the lights, or just after GO and still held
 * there on the brake, standing, not yet pushing — what `stepSkierSpring`'s
 * `waiting` is handed for a run. */
export function inStartGate(run: {
  phase: string;
  t: number;
  rules: { countdown: number };
  input: { brake: number };
  skier: { drive: number; speed: number };
}): boolean {
  if (run.phase === "countdown") return true;
  return (
    run.phase === "racing" &&
    run.t - run.rules.countdown < GATE_HOLD &&
    run.input.brake >= 1 &&
    run.skier.drive <= 0 &&
    run.skier.speed < GATE_CREEP
  );
}
