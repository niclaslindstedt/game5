// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY ON ITS LEGS, kept by the view between frames (it is the
// picture's, not the physics'): the spring the figure's mass rides on its
// legs, and the moments a pose eases through rather than jumps — into the
// air and out of it, a jump loaded and sprung. Stepped with the frame's
// `dt` (`skis-body.ts`); `skier-pose.ts` reads it. Three-free.

import { revertShare, stepQuick, strideRate, TUNING, type Save, type SkierState } from "@engine";
import { hopLook, revertLook, WIND_UP } from "./skier-switch.ts";

import { flying, gaitOf } from "./skier-gait.ts";

import { JOLT_KEYS, joltOf, NO_JOLT, type Jolt } from "./skier-save.ts";
import { createFlight, stepFlight, type Flight, type FlightRead } from "./skier-flight.ts";

/** THE BODY ON ITS LEGS — the secondary motion a skier's own mass has on
 * top of the skis, kept by the view (it is the picture's, not the
 * physics'): HIS UPPER BODY IS A MASS OF ITS OWN, carried on his legs as on
 * two springs (`LEGS`). Every change in the pair's climb is a kick the body
 * does not share — it goes on the way it was going — and the legs' spring
 * brings it back damped against THE LINE HE RIDES (`slope`: the pair's
 * climb taken slowly, the pitch and the long swells), never against the
 * skis' every bump: so a roller under the skis folds his knees and lets
 * them out again while his head rides on level, a landing that stops the
 * skis dead leaves the body still coming down until the knees have taken
 * it, and the chatter of a hard piste is a jiggle in the legs. */
export type SkierSpring = {
  /** The fold, m (positive sunk: his body below where the engine carries
   * it, the knees folded by as much), and its rate, m/s. */
  bump: number;
  rate: number;
  /** The pair's climb at the last frame, m/s, or NaN before the first. */
  lastVy: number;
  /** THE LINE HE RIDES: the pair's climb taken slowly (`LEGS.line`), m/s
   * — what the body is damped toward (NaN before the first frame) — and
   * its trend, m/s², so a climb changing steadily (a stop, a run gathering
   * speed, a long compression) is followed without a lag. */
  slope: number;
  slopeRate: number;
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
  /** HOW FAR HE HAS BEEN EDGING LATELY, rad: the edge's size taken over
   * `SWING_SPAN` s (NaN until the first ride is read) — linked turns hold
   * it up through each edge change, a straight run lets it go, so a flat
   * ski between two turns is told from one on a schuss
   * (`technique-pose.ts`'s `transitOf`). */
  swing: number;
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
  /** THE UPPER BODY'S LEAD into a turn: the steer key (−1..1, right
   * positive) followed twice — quickly by his shoulders and head
   * (`upper`), slowly by his legs (`lower`), each with its rate. What `upper` is ahead of `lower` is the lead
   * (`leadOf`): a skier starts a turn by moving his upper body into it,
   * and the knees follow the skis (`skier-pose.ts`'s `LEAD`). None at a
   * crawl, in the air, braking or thrown. */
  upper: number;
  upperRate: number;
  lower: number;
  lowerRate: number;
  /** THE PAIR'S PITCH as his trunk carries it, rad (tips up positive), and
   * its rate: the skis rock fore and aft over every bump with the snow
   * under them, and the trunk above his ankles, knees and hips takes the
   * long pitch of the slope and not the rocking (NaN until the first ride
   * is read). In the air it closes on the pair's own — a flip turns all of
   * him. */
  pitch: number;
  pitchRate: number;
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
  /** STEPPING ROUND ON THE SPOT, 0..1, eased (`STEP_FOLLOW`): a skier
   * stepping his skis round is no longer waiting with his arms hung — he
   * holds them out for his balance. */
  stepping: number;
  /** STOOD OVER THE HILL on his platforms (`hillLean`), rad, right side
   * down positive, and its rate: the body drawn upright in the world over
   * skis set into a steep slope, rather than square to the snow and
   * leaning off the face. */
  hill: number;
  hillRate: number;
  /** ...and how far onto his platforms he is, the side the hill rises on
   * eased over −1..1, and its rate — what plants his poles for it. */
  platform: number;
  platformRate: number;
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
  /** THE FALL as his body rides it (`skier-flight.ts`): secure off a
   * kicker, spotting a drop or a cliff, reaching for the snow. */
  flight: Flight;
  /** LOOKING BACK OVER A SHOULDER while he rides switch: how far into it
   * his body is, 0..1, its rate, and the shoulder (the side the hips hang to for a positive `hipRight`) — the
   * shoulder picked as he turns round and kept until he faces his skis'
   * way again, so the head is never flicked from side to side. */
  back: number;
  backRate: number;
  backSide: -1 | 1;
  /** THE WIND-UP before a hop into switch (`skier-switch.ts`'s `WIND_UP`):
   * −1..1, signed to the side he means to turn to — the shoulders wound the
   * other way — and its rate. */
  wind: number;
  windRate: number;
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
  /** The steer key and the skid's share (`SkierState.steer` / `.skid`) —
   * what the upper body's lead is read off; none when left out. */
  steer?: number;
  skid?: number;
  /** What he last nearly fell to (`SkierState.save`). */
  save?: Save | null;
  /** The skid's pivot, rad (`SkierState.skiAngle`); none when left out. */
  skiAngle?: number;
  /** The engine's stride count and the way along the skis, m/s
   * (`SkierState.stride` / `.way`) — the plants the snow is passed from. */
  stride?: number;
  way?: number;
  /** The step turn he is making (`SkierState.step`); none when left out. */
  step?: number;
  /** The pair's pitch, rad, and the body thrown off it (`SkierState`) —
   * what the gait is read off. */
  pitch?: number;
  thrown?: SkierState["thrown"];
  /** How long he has been in the air, s, and his body's rates, rad/s
   * (`SkierState`) — what the fall is staged by. */
  airTime?: number;
  /** The lean as the body has it (`SkierState.lean`), −1..1 — in the air,
   * how committed he is to his line (`skier-flight.ts`). */
  lean?: number;
  /** Seconds since he last sprang a jump (`SkierState.popped`). */
  popped?: number;
  /** Stepping round on the spot (`SkierState.pivot`), ±1 or 0. */
  pivot?: number;
  /** On his platforms across a steep slope (`SkierState.sidestep`), ±1 or
   * 0 — stepping up it while the stride's phase is under way. */
  sidestep?: number;
  /** Riding tails first (`SkierState.switched`). */
  switched?: boolean;
  /** Turning round out of it (`SkierState.revert`), or none. */
  revert?: SkierState["revert"];
  /** The jump being loaded, s (`SkierState.jumpLoad`). */
  jumpLoad?: number;
  /** Hopped into switch a moment ago (`SkierState.hopHeld`). */
  hopHeld?: number;
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
/** THE LEAD: how quickly the upper body and the legs follow the key,
 * rad/s (the legs some 200 ms behind it — the engine's own lag and the
 * edge's tip together), the most the upper body is accelerated by, /s²
 * (the key flips in a step; this is what keeps the shoulders from
 * snapping after it — some 0.15 s from straight to a full lead), and the
 * speeds the lead comes in between, m/s: at a crawl the skis are turned
 * on their bases and he leads with nothing. */
const LEAD = { upper: 40, lower: 10, most: 180, from: 2, to: 6 };

/** How quickly his trunk takes up the pair's pitch on the snow, rad/s —
 * the slope's long pitch in a few tenths of a second, the skis' rocking
 * over a bump (a few times a second) hardly at all. */
const PITCH_FOLLOW = 7;

/** How far his trunk is held off the pair's pitch, rad (tips up positive:
 * the skis rocked back under him, so the trunk is that much further
 * forward of them) — faded out as he goes into the air, where the pair
 * and he turn as one. */
export function pitchHeld(s: SkierSpring, pairPitch: number): number {
  if (Number.isNaN(s.pitch)) return 0;
  const off = Math.max(-PITCH_HOLD, Math.min(PITCH_HOLD, pairPitch - s.pitch));
  return off * (1 - Math.max(0, Math.min(1, s.air)));
}
/** The most the trunk is held off the skis' pitch, rad. */
const PITCH_HOLD = 0.3;

/** THE PLANT'S TIMING: the edge a turn is read as begun past (rad), so a
 * flat run's chatter starts nothing; the least a
 * turn must have held for the next to be planted on (s); the speeds a
 * plant is made between (m/s); and how long one takes, s — the swing, the
 * touch and the release, shorter the faster he goes. */
export const PLANT = {
  on: 0.14,
  held: 0.35,
  slow: 3,
  fast: 26,
  length: 6.5,
  least: 0.42,
  most: 0.85,
};

/** How long the edge is remembered over for `SkierSpring.swing`, s — a
 * little over a slalom turn, so the edge change between two is inside it. */
const SWING_SPAN = 0.6;

/** How long a plant takes at `speed` m/s, s. */
export const plantLength = (speed: number): number =>
  Math.max(PLANT.least, Math.min(PLANT.most, PLANT.length / speed));

/** THE LEGS AS SPRINGS, after what skiers' legs are measured to do. The
 * body's whole weight on bent knees rides at some 2–3 Hz (2.75 Hz stood on
 * flexed knees under vertical vibration; hopping, 2.2 Hz) and passes what
 * is slower than about 6 Hz up to the pelvis — but over bumps a skier does
 * better than a spring: he folds his knees as the skis climb and lets them
 * out into the trough, and his head rides on level (the mogul skier's
 * "quiet upper body"; over 0.5 m swells 4 m apart his knees work between
 * 32° and 84°, his hips between 40° and 107°). So the body here rides
 * SLOWER than the legs' own bounce — `omega` rad/s (about 1 Hz) — damped by
 * `zeta` against the line he rides — the pair's climb taken up over
 * `line` s — and kicked by the WHOLE of every change in the pair's climb.
 * A landing's absorption is the same spring: the impact phase of a ski
 * jumper's landing is some 0.19 s, and the fold here peaks a quarter of a
 * second after the skis stop. `fold` and `extend` are how far the legs can
 * fold below and stretch above the stance in all, m — the engine's own
 * compression spent first (`stepSkierSpring`'s `lift`), stiffening over
 * the last `stop.zone` m of the fold at `stop.omega` rad/s — and `flight`
 * how long in the air, s, makes a hop a flight, landed against the snow
 * he comes down on rather than the line he left. */
export const LEGS = {
  omega: 6,
  zeta: 1,
  line: 0.8,
  fold: 0.4,
  extend: 0.1,
  stop: { zone: 0.12, omega: 45 },
  flight: 0.3,
};
/** How fast the body goes into the air and comes back to the snow, and
 * how fast a load is taken and let go, rad/s — critically damped springs,
 * so each starts as a motion rather than at full speed in a step: a fifth
 * of a second to most of the way into the air, a tenth to let go of a
 * jump, the time a skier's extension takes. */
const EASE = { up: 16, down: 25, take: 32, release: 29 };
/** How fast he settles into the start gate's stance and comes out of it,
 * rad/s — out of it is the first push, which is quick. */
const READY = { in: 9, out: 20 };
/** How quickly he turns to look back over a shoulder once he rides switch,
 * and back round once he faces his skis' way again, rad/s — some third of
 * a second: a deliberate turn of the head and shoulders, never a flick. */
const BACK_FOLLOW = 7;
/** How fast the look follows a revert's, 1/s — a head held on the line,
 * and a quick swing across when the turn is to the other shoulder. */
const REVERT_SWING = 14;
/** How quickly he winds up against a hop into switch as the legs load,
 * and unwinds out of it at the pop, rad/s — the unwinding is the throw. */
const WIND = { in: 10, out: 30 };
/** How quickly a step turn on the spot takes him out of his idle stance
 * and lets him back into it, 1/s — a third of a second to most of it. */
const STEP_FOLLOW = 6;
/** ON HIS PLATFORMS across a steep slope (`sidestep.ts`), how far toward
 * upright in the world his body is drawn — a skier sidestepping stands
 * over his feet, his ankles and knees rolled into the hill to set the
 * edges, never square to a 45° face — and how quickly he is stood over the
 * hill and let back, rad/s. */
export const HILL = { share: 0.85, follow: 5 };

/** The lean over the hill his body is drawn at on his platforms, rad,
 * right side down positive (`HILL`): the slope under him — his frame
 * stands square to the snow, so its own tilt — toward the side it rises
 * on; 0 off them. */
export function hillLean(ride: Pick<SpringRide, "sidestep" | "pitch" | "roll">): number {
  if (!ride.sidestep) return 0;
  const slope = Math.acos(Math.cos(ride.pitch ?? 0) * Math.cos(ride.roll));
  return Math.sign(ride.sidestep) * slope * HILL.share;
}

export function createSkierSpring(offset = 0): SkierSpring {
  return {
    bump: 0,
    rate: 0,
    lastVy: Number.NaN,
    slope: Number.NaN,
    slopeRate: 0,
    air: 0,
    airRate: 0,
    load: 0,
    loadRate: 0,
    clock: offset,
    turnSide: 0,
    turnHeld: 0,
    swing: Number.NaN,
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
    upper: 0,
    upperRate: 0,
    lower: 0,
    lowerRate: 0,
    pitch: Number.NaN,
    pitchRate: 0,
    jolt: { ...NO_JOLT },
    joltRate: { ...NO_JOLT },
    skiAngle: 0,
    skiAngleRate: 0,
    ready: 0,
    readyRate: 0,
    stepping: 0,
    hill: 0,
    hillRate: 0,
    platform: 0,
    platformRate: 0,
    poled: 0,
    poledStride: Number.NaN,
    keep: Number.NaN,
    keepRate: 0,
    flight: createFlight(),
    back: 0,
    backRate: 0,
    backSide: 1,
    wind: 0,
    windRate: 0,
  };
}

/** THE BODY STOOD BACK UP: the spring taken back to rest, as a fresh one
 * on his own clock — for a skier off his skis, whose legs carried nothing
 * while he tumbled, so the climb he had going down and the fold he was
 * in are not what he stands up into at the reset. */
export function restSkierSpring(s: SkierSpring): void {
  Object.assign(s, createSkierSpring(s.clock));
}

/** One reading followed on a critically damped spring of `w` rad/s: its
 * value and rate after `dt` s toward `to`, accelerated by `most` /s² at
 * most. */
function follow(
  v: number,
  rate: number,
  to: number,
  dt: number,
  w = HIP_FOLLOW,
  most = Number.POSITIVE_INFINITY,
): [number, number] {
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const acc = w * w * (to - v) - 2 * w * rate;
    rate += Math.max(-most, Math.min(most, acc)) * h;
    v += rate * h;
  }
  return [v, rate];
}

/** The share of the upper body's lead his riding allows, 0..1: on the
 * snow, on his skis, moving, and not braking. */
function leadShare(ride: SpringRide, airborne: boolean): number {
  if (airborne || ride.thrown) return 0;
  const k = Math.max(0, Math.min(1, (ride.speed - LEAD.from) / (LEAD.to - LEAD.from)));
  return k * k * (3 - 2 * k) * (1 - Math.min(1, ride.skid ?? 0));
}

/** The hips' shift, the edge, the roll, the upper body's lead and the
 * skid's pivot followed (`SkierSpring.hip`, `.edge`, `.roll`, `.upper` and
 * `.lower`, `.skiAngle`) and the trunk's pitch (`.pitch`) — taken as they
 * are on the first ride read. */
function stepBody(s: SkierSpring, ride: SpringRide, airborne: boolean, dt: number): void {
  const pitch = ride.pitch ?? 0;
  if (Number.isNaN(s.pitch)) s.pitch = pitch;
  else {
    const w = airborne ? HIP_FOLLOW : PITCH_FOLLOW;
    [s.pitch, s.pitchRate] = follow(s.pitch, s.pitchRate, pitch, dt, w);
  }
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
  const key = Math.max(-1, Math.min(1, ride.steer ?? 0)) * leadShare(ride, airborne);
  [s.upper, s.upperRate] = follow(s.upper, s.upperRate, key, dt, LEAD.upper, LEAD.most);
  [s.lower, s.lowerRate] = follow(s.lower, s.lowerRate, key, dt, LEAD.lower);
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
  const size = Math.abs(ride.edge);
  s.swing = Number.isNaN(s.swing)
    ? size
    : s.swing + (size - s.swing) * (1 - Math.exp(-dt / SWING_SPAN));
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
    s.plantLength = plantLength(ride.speed);
  }
  s.turnSide = side;
  s.turnHeld = 0;
}

/** The snow passed since the last plant: run on by the way, and begun
 * again on each new stride from the share of it already gone — and how
 * much he works the poles, followed. Hands back how much of him is
 * working for his speed this frame, 0..1 (the gait's stride, skate and
 * double pole together). */
function stepPoled(s: SkierSpring, ride: SpringRide, airborne: boolean, dt: number): number {
  if (ride.stride === undefined || ride.way === undefined) return 0;
  const gait = gaitOf({
    drive: ride.drive,
    stride: ride.stride,
    speed: ride.speed,
    way: ride.way,
    step: ride.step,
    crouch: ride.crouch,
    pitch: ride.pitch ?? 0,
    airborne,
    airTime: ride.airTime,
    popped: ride.popped,
    thrown: ride.thrown ?? null,
  });
  const keep = gait.keep;
  if (Number.isNaN(s.keep)) s.keep = keep;
  else [s.keep, s.keepRate] = follow(s.keep, s.keepRate, keep, dt, KEEP_FOLLOW);
  const n = Math.floor(ride.stride);
  const way = Math.abs(ride.way);
  // A new stride's plant — or no stride running (coasting, carried up a
  // lift): the snow passed is the gait's own reckoning again, never the
  // metres glided since a plant long gone.
  if (n !== s.poledStride || !(ride.drive > 0)) {
    const step = ride.step ?? 0;
    const rate =
      strideRate(ride.speed, true, step) * stepQuick(step, ride.speed) * Math.max(0.2, ride.drive);
    s.poled = ((ride.stride - n) * way) / rate;
    s.poledStride = n;
  } else s.poled += way * dt;
  return Math.min(1, gait.stride + gait.skate + gait.pole);
}

/** Advance the body on its legs by `dt` s for a pair climbing at `vy` m/s
 * (the engine's own), in the air or not, a jump loaded `load` of the way
 * (0..1; the engine's `jumpLoad` over a full one), `waiting` in the start
 * gate under the lights or not; `fall` the snow under his flight as read
 * (`flightRead`) and the flight's gravity, m/s²; `lift` how far the drawn
 * skis already stand folded up toward him off the engine's own legs, m
 * (the mean of `gearLift`) — what the legs have left to fold is less it. */
export function stepSkierSpring(
  s: SkierSpring,
  vy: number,
  airborne: boolean,
  dt: number,
  load = 0,
  ride?: SpringRide,
  waiting = false,
  fall?: { read: FlightRead | null; gravity: number },
  lift = 0,
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
  // LOOKING BACK, on the snow: a 180 is landed before he turns his head
  // to see where he is going. The shoulder is picked as he starts turning
  // round — the side his hips hang to, if he is in a turn — and kept.
  // (Round off a hop into switch, he holds the look through its landing.)
  const back = ride?.switched && (!airborne || (ride.hopHeld ?? 0) > 0) ? 1 : 0;
  if (back > 0 && s.back < 0.15 && ride && Math.abs(ride.hipRight) > 0.05)
    s.backSide = ride.hipRight > 0 ? 1 : -1;
  [s.back, s.backRate] = follow(s.back, s.backRate, back, dt, BACK_FOLLOW);
  s.back = Math.max(0, Math.min(1, s.back));
  // ...and TURNING ROUND (the revert), the look held on his line as the
  // body comes round under it (`revertLook`) — swung across through the
  // middle when he turns to the other side than the shoulder he had.
  const revert = ride?.revert;
  // WOUND UP for a hop into switch while the legs load with the edge held
  // — and unwound hard as the pop turns him (`hopLook` takes the head).
  const steer = ride?.steer ?? 0;
  const winding =
    ride && !airborne && !ride.switched && !revert && Math.abs(steer) >= TUNING.switch.hop.steer
      ? Math.sign(steer) * Math.max(0, Math.min(1, (ride.jumpLoad ?? 0) / WIND_UP.full))
      : 0;
  [s.wind, s.windRate] = follow(s.wind, s.windRate, winding, dt, winding ? WIND.in : WIND.out);
  if (revert) {
    const to =
      revert.to === "switch"
        ? hopLook(revert.u, revert.turn, revertShare)
        : revertLook(revert.u, revert.turn, revertShare);
    const at = s.back * s.backSide;
    const look = at + (to - at) * Math.min(1, REVERT_SWING * dt);
    s.back = Math.min(1, Math.abs(look));
    if (look !== 0) s.backSide = look > 0 ? 1 : -1;
    s.backRate = 0;
  }
  let work = 0;
  if (ride) {
    const climbing = ride.sidestep && ride.stride !== undefined && ride.stride % 1 > 1e-6 ? 1 : 0;
    const stepping = Math.max(Math.abs(ride.pivot ?? 0), climbing);
    s.stepping += (stepping - s.stepping) * Math.min(1, STEP_FOLLOW * dt);
    [s.hill, s.hillRate] = follow(s.hill, s.hillRate, hillLean(ride), dt, HILL.follow);
    [s.platform, s.platformRate] = follow(
      s.platform,
      s.platformRate,
      Math.sign(ride.sidestep ?? 0),
      dt,
      HILL.follow,
    );
    stepPlant(s, ride, airborne, dt);
    stepBody(s, ride, airborne, dt);
    work = stepPoled(s, ride, airborne, dt);
  }
  stepFlight(s.flight, airborne, fall?.read, ride?.airTime ?? 0, dt, fall?.gravity, ride?.lean);
  // A HOP is not a flight (`flying`): he goes compact only once he is
  // really flying.
  const into = flying({ airborne, airTime: ride?.airTime, popped: ride?.popped }) ? 1 : 0;
  [s.air, s.airRate] = follow(s.air, s.airRate, into, dt, into ? EASE.up : EASE.down);
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
  stepLegs(s, vy, airborne, dt, ride, lift, work);
}

/** THE BODY ON ITS LEGS stepped (`LEGS`): kicked by the pair's change of
 * climb, sprung back toward where the engine carries him and damped
 * against the line he rides — and in the air brought back over the skis,
 * the two flying as one. */
function stepLegs(
  s: SkierSpring,
  vy: number,
  airborne: boolean,
  dt: number,
  ride: SpringRide | undefined,
  lift: number,
  work: number,
): void {
  // THE LINE: the pair's own climb taken slowly — exact on any steady
  // line, a skid sideways down a pitch included, and carried on through a
  // hop over a crest. A real FLIGHT is landed against the climb the snow
  // he comes down on asks of him instead: the way along the skis up their
  // pitch, which the air eases onto the landing slope (`flight.ts`) — not
  // against the fall he came down on. With no ride read, the climb he
  // has once he is back on the snow.
  //
  // Taken by a lag alone, a climb changing steadily is followed a lag
  // behind for as long as it changes — and the body, damped toward a line
  // that far off the skis' own, sank by it: braking down a pitch at a
  // seventh of a g pinned his legs at their deepest fold. So the line
  // follows the climb's TREND too (`slopeRate`), and a steady change is
  // ridden on it exactly: what is left is the body's own sag under the
  // push, the legs' spring's (`LEGS.omega`), a few centimetres a tenth
  // of a g.
  const read = ride?.way !== undefined && ride.pitch !== undefined;
  if (airborne && !read) {
    s.slope = Number.NaN;
    s.slopeRate = 0;
  } else if (airborne && (ride?.airTime ?? 0) > LEGS.flight) {
    s.slope = ride!.way! * Math.sin(ride!.pitch!);
    s.slopeRate = 0;
  } else if (Number.isNaN(s.slope)) {
    s.slope = vy;
    s.slopeRate = 0;
  } else {
    // Critically damped and of the second order, at the lag's own rate:
    // any faster and the body follows the rollers he should ride over.
    const w = 1 / LEGS.line;
    const miss = vy - s.slope;
    s.slopeRate += w * w * miss * dt;
    s.slope += (s.slopeRate + 2 * w * miss) * dt;
  }
  // The pair's change of climb since the last frame is a push the body
  // does not share: it keeps going the way it was — spread over the frame
  // it came in. (In the air the two fall together; and a JUMP is his own
  // legs throwing his body up off the snow, so the body goes with it.)
  // Nor is the climb he makes WORKING for his speed: a skate across a
  // side slope glides up on one arm of the V and down on the other, and
  // his body goes up and down with the legs that push it there — kicked
  // by it, he would sit deep on every uphill stride and stand tall on
  // every downhill one.
  const sprang = ride?.popped !== undefined && ride.popped <= dt;
  const own = 1 - work;
  const kick = Number.isNaN(s.lastVy) || airborne || sprang ? 0 : (own * (vy - s.lastVy)) / dt;
  s.lastVy = vy;
  // On the snow the body is damped against the line, so a bump the skis
  // climb faster than it folds him; in the air, against the skis, and his
  // legs bring him back over them as they fly.
  const give = airborne ? 0 : own * (vy - s.slope);
  // The legs' reach: what the engine's compression has folded them by is
  // spent. Over the last of it the knees stiffen (`LEGS.stop`), so a hard
  // landing is slowed into the deepest fold rather than stopped dead at it.
  const fold = LEGS.fold - Math.max(0, lift);
  const extend = -LEGS.extend - Math.min(0, lift);
  const deep = fold - LEGS.stop.zone;
  const n = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    let acc =
      kick - LEGS.omega * LEGS.omega * s.bump - 2 * LEGS.zeta * LEGS.omega * (s.rate - give);
    if (s.bump > deep) {
      const w = LEGS.stop.omega;
      acc -= w * w * (s.bump - deep) + 2 * w * Math.max(0, s.rate);
    }
    s.rate += acc * h;
    s.bump += s.rate * h;
  }
  // ...and a body run to the very end of it is carried with the skis.
  if (s.bump > fold) {
    s.bump = fold;
    s.rate = Math.min(0, s.rate);
  } else if (s.bump < extend) {
    s.bump = extend;
    s.rate = Math.max(0, s.rate);
  }
}

/** THE UPPER BODY'S LEAD into a turn, −1..1, right positive: how far his
 * shoulders have gone into it ahead of his legs — the most at the start of
 * a turn (and of the next, at an edge change), none once the legs have
 * caught up. */
export function leadOf(s: SkierSpring): number {
  return Math.max(-1, Math.min(1, s.upper - s.lower));
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
 * `waiting` is handed for a run; `"house"` for a slalom's start house,
 * held there until he goes. */
export function inStartGate(run: {
  phase: string;
  t: number;
  rules: { countdown: number; start?: string; course?: boolean };
  input: { brake: number };
  skier: { drive: number; speed: number; launch?: number };
  progress?: { started: boolean };
}): boolean | "house" {
  // A slalom's start house (`start-push.ts`): his poles hold him there
  // until he throws himself out.
  if (run.rules.start === "interval" && run.rules.course) {
    const gone = run.progress?.started === true || (run.skier.launch ?? -1) >= 0;
    return run.phase !== "finished" && !gone ? "house" : false;
  }
  if (run.phase === "countdown") return true;
  return (
    run.phase === "racing" &&
    run.t - run.rules.countdown < GATE_HOLD &&
    run.input.brake >= 1 &&
    run.skier.drive <= 0 &&
    run.skier.speed < GATE_CREEP
  );
}
