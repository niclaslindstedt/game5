// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER ON THE BIKE BY MOTION MATCHING — a LIBRARY of reference poses
// (`RIDER_POSES`), each a downhill rider caught in one situation and stated
// as NUMBERS (where his hips are over the bottom bracket, how far back, how
// bent his trunk is, where his head is held, how far his knees and elbows
// are out, whether a foot is off its pedal), and the situation it answers
// as the RIDE'S SIGNALS it is matched on (in the air and how far through the
// flight, the bike squashed, folded for a pop, weight back, the levers
// pulled, pedalling and where the cranks are, laid over, a foot out, a whip
// or a table and whether it is going out or coming back, just landed).
//
// Every frame the signals are read off the engine's pose and the
// freerider's style, smoothed, and the library's nearest pose is PICKED —
// held unless another is clearly nearer (`MATCH.stay`), so a signal
// hovering at an edge does not flick between two. A switch is never drawn
// as a switch: the pose is INERTIALIZED — the offset between what was drawn
// and the new pose, and the velocity it was drawn moving at, are carried
// and decayed on a critically damped spring (`MATCH.halflife`), so every
// channel leaves the old pose at the speed it had and settles on the new
// one without a pop. Over the picked pose, three things are solved, never
// keyed: the HEAD held where the pose holds it over the bottom bracket (the
// trunk folds round it, so the head stays quiet while the hips ride the
// bike's travel), the hands on the grips and the feet on the pedals as the
// bike has them (turned under him in a whip), and a REACH GUARD that keeps
// every leg inside the band a knee bends through.
//
// The numbers are traced off downhill riders on video and in photographs
// (`docs/downhill-bike.md`): the attack stance with the knees and elbows
// bent a good way and out, the chest over the stem; the standing sprint's
// hips over the downstroke; the landing folded deep and rebounding; the
// whip's legs pushing the bike out under square shoulders; the table's
// knees drawn up to it; the foot out low and ahead in a slide.
//
// Presentation only: the engine is never told, so no digest moves. Its
// memory is the caller's (one `RiderMotion` a rider), and it is a pure
// function of the frames it is handed in order. Three-free, so the suite
// and the labs read it.

import { BIKE_BB, RAGDOLL as R, type BikePose } from "@engine";

import { bracketFromRider, gripsAt, pedalsAt, type V3 } from "./bike-look.ts";
import type { RideStyle } from "./bike-ride-style.ts";
import { ANKLE, keyPoints, type Key } from "./party-pose.ts";
import { BODY } from "./skier-mounts.ts";
import { underHim } from "./skier-bike.ts";

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3): V3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: V3, b: V3): V3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const len = (a: V3): number => Math.hypot(a.x, a.y, a.z);
const mix = (a: V3, b: V3, k: number): V3 =>
  v(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

/** THE SIGNALS a pose is matched on, each smoothed. */
export type RiderSignals = {
  /** In the air (0 or 1), and the share of the flight flown, 0..1. */
  air: number;
  flight: number;
  /** Just landed: 1 at the touch-down of a real flight, fading to 0. */
  land: number;
  /** The fork's and the shock's travel used, their mean, 0..1. */
  squash: number;
  /** Folded for a pop (the engine's crouch), 0..1. */
  pop: number;
  /** His weight's shift, −1 forward to +1 back. */
  back: number;
  /** The levers pulled, 0..1. */
  brake: number;
  /** Pedalling (0 or 1), and the cranks' angle as its cosine and sine. */
  pedal: number;
  cs: number;
  sn: number;
  /** The bike laid over, rad (right side down positive). */
  lean: number;
  /** A foot off its pedal, 0..1. */
  foot: number;
  /** The whip's and the table's share thrown, 0..1, and which way it is
   * going: +1 going out, −1 coming back. */
  whip: number;
  table: number;
  trend: number;
};

/** A REFERENCE POSE's channels: where his hips are (`over` the bottom
 * bracket, m, ridden `follow` of the way with the engine's own body on its
 * springs; `back` behind the bottom bracket, m; across, m), the trunk's
 * bend forward (rad), its roll and twist, the head's nod, where his head is
 * held over the bottom bracket (m) and how much of the trunk's bend is
 * folded round holding it there (`gimbal`), how far his knees and elbows
 * are out, a foot off its pedal (0..1) and the knees drawn up (m). */
export type PoseChannels = {
  over: number;
  follow: number;
  back: number;
  across: number;
  pitch: number;
  roll: number;
  twist: number;
  nod: number;
  head: number;
  gimbal: number;
  kneesOut: number;
  elbowsOut: number;
  footOut: number;
  tuck: number;
};

/** A pose of the library: its name, the signals it answers, and how much
 * each of those counts beside the default weights. */
export type RiderPose = {
  id: string;
  want: Partial<RiderSignals>;
  weight?: Partial<Record<keyof RiderSignals, number>>;
  pose: PoseChannels;
};

/** The channels every pose starts from: the ATTACK stance. */
const ATTACK: PoseChannels = {
  over: 0.77,
  follow: 0.55,
  back: 0.15,
  across: 0,
  pitch: 0.92,
  roll: 0,
  twist: 0,
  nod: -0.5,
  head: 0.99,
  gimbal: 0.75,
  kneesOut: 0.55,
  elbowsOut: 0.6,
  footOut: 0,
  tuck: 0,
};
const pose = (o: Partial<PoseChannels>): PoseChannels => ({ ...ATTACK, ...o });

/** THE SIGNALS a pose wants unless it says otherwise: on the ground, not
 * popping, off the levers, not pedalling, no foot out, no trick, not just
 * landed. The rest (the squash, the lean, the weight's shift, the flight's
 * share, the cranks) count only where a pose names them. */
const NEUTRAL: Partial<RiderSignals> = {
  air: 0,
  land: 0,
  pop: 0,
  brake: 0,
  pedal: 0,
  foot: 0,
  whip: 0,
  table: 0,
};

/** How much a signal's miss costs, each squared. */
const WEIGHTS: Record<keyof RiderSignals, number> = {
  air: 6,
  flight: 3,
  land: 3,
  squash: 2,
  pop: 3,
  back: 1.5,
  brake: 2.5,
  pedal: 4,
  cs: 1,
  sn: 1,
  lean: 1.5,
  foot: 5,
  whip: 4,
  table: 4,
  trend: 1,
};

/** THE LIBRARY. Each pose a rider caught in one moment, its numbers traced
 * off riders on video and in photographs, never off a picture. */
export const RIDER_POSES: readonly RiderPose[] = [
  // ATTACK: stood on level cranks, knees and elbows bent and out, hips back
  // over the rear of the bottom bracket, chest low over the stem, eyes up.
  { id: "attack", want: { squash: 0.3 }, pose: ATTACK },
  // COMPRESSED: pushed down into a pump's face or a compression — the legs
  // and arms folded, the hips dropped, the head held.
  {
    id: "compress",
    want: { squash: 0.75 },
    pose: pose({ over: 0.67, follow: 0.65, pitch: 1.0, head: 0.92, back: 0.17 }),
  },
  // EXTENDED: the bike pushed away down a pump's back or a roller's
  // far side — the legs long, the hips high, the arms long.
  {
    id: "extend",
    want: { squash: 0.05 },
    pose: pose({ over: 0.83, follow: 0.5, pitch: 0.84, head: 1.04, back: 0.13 }),
  },
  // STEEP: weight back down a steep pitch — the hips behind the saddle's
  // nose, the arms long, the chest still over the bars.
  {
    id: "steep",
    want: { back: 0.8 },
    pose: pose({ over: 0.71, back: 0.27, pitch: 0.7, head: 0.97, nod: -0.62 }),
  },
  // FORWARD: weight onto the front for grip in a flat turn.
  {
    id: "forward",
    want: { back: -0.8 },
    pose: pose({ over: 0.77, back: 0.06, pitch: 1.05, head: 0.96 }),
  },
  // CARVE, either way: the bike laid over under a body held nearer upright,
  // the outside foot weighted, the inside knee open to the turn.
  {
    id: "carveL",
    want: { lean: -0.5 },
    pose: pose({ over: 0.73, roll: 0.06, twist: -0.06, pitch: 0.95, head: 0.95 }),
  },
  {
    id: "carveR",
    want: { lean: 0.5 },
    pose: pose({ over: 0.73, roll: -0.06, twist: 0.06, pitch: 0.95, head: 0.95 }),
  },
  // BRAKING: the levers pulled hard — hips back and low, heels down, the
  // arms long against the bike's dive, the head up.
  {
    id: "brake",
    want: { brake: 1, squash: 0.45 },
    pose: pose({ over: 0.71, follow: 0.5, back: 0.25, pitch: 0.74, head: 0.96, nod: -0.62 }),
  },
  // THE STANDING SPRINT, a pose a quarter of a turn: the hips over the
  // pedal going down, the bike rocked under him, the trunk low.
  ...[0, 1, 2, 3].map((k): RiderPose => {
    const a = (k * Math.PI) / 2;
    // Crank at angle a: the left pedal forward at 0, down at π/2.
    const downLeft = Math.sin(a);
    return {
      id: `sprint${k}`,
      want: { pedal: 1, cs: Math.cos(a), sn: Math.sin(a) },
      pose: pose({
        over: 0.8 + 0.03 * Math.cos(a) * Math.cos(a),
        follow: 0.4,
        back: 0.08,
        across: -0.035 * downLeft,
        pitch: 1.0,
        roll: -0.05 * downLeft,
        twist: 0.05 * Math.cos(a),
        head: 1.04,
        kneesOut: 0.35,
        elbowsOut: 0.5,
      }),
    };
  }),
  // THE POP: folded deep into the lip before springing off it.
  {
    id: "pop",
    want: { pop: 1 },
    pose: pose({ over: 0.65, follow: 0.6, back: 0.18, pitch: 1.08, head: 0.9 }),
  },
  // OFF THE LIP: the legs thrown long, the bike let rise to him.
  {
    id: "takeoff",
    want: { air: 1, flight: 0.1 },
    pose: pose({ over: 0.81, follow: 0.4, back: 0.16, pitch: 0.85, head: 1.04 }),
  },
  // FLOATING: the bike drawn up under him at the flight's top.
  {
    id: "float",
    want: { air: 1, flight: 0.5 },
    pose: pose({ over: 0.73, follow: 0.4, back: 0.15, pitch: 0.92, head: 0.97, tuck: 0.03 }),
  },
  // SPOTTING THE LANDING: the bike pushed down to meet the landing's back
  // side, the legs reaching, the eyes on where the wheels will touch.
  {
    id: "reach",
    want: { air: 1, flight: 0.9 },
    pose: pose({ over: 0.83, follow: 0.4, back: 0.14, pitch: 0.86, head: 1.04, nod: -0.4 }),
  },
  // TOUCH-DOWN: folded deep, the knees and elbows taking it.
  {
    id: "absorb",
    want: { land: 1, squash: 0.85 },
    weight: { squash: 1 },
    pose: pose({ over: 0.63, follow: 0.65, back: 0.2, pitch: 1.08, head: 0.86, nod: -0.62 }),
  },
  // REBOUND: up out of the fold, the legs coming long again.
  {
    id: "rebound",
    want: { land: 0.4, squash: 0.35 },
    weight: { squash: 1 },
    pose: pose({ over: 0.75, follow: 0.55, back: 0.17, pitch: 0.95, head: 0.96 }),
  },
  // THE WHIP: going out, the hips twisted with the bike and the legs
  // driving its rear out; at its peak the legs nearly straight; coming back,
  // the hips square again — the shoulders and eyes down the trail all the
  // way.
  {
    id: "whipOut",
    want: { air: 1, whip: 0.5, trend: 1 },
    pose: pose({ over: 0.77, follow: 0.35, back: 0.15, pitch: 0.92, head: 1.01, nod: -0.42 }),
  },
  {
    id: "whipPeak",
    want: { air: 1, whip: 1 },
    pose: pose({ over: 0.81, follow: 0.35, back: 0.13, pitch: 0.86, head: 1.04, kneesOut: 0.4 }),
  },
  {
    id: "whipBack",
    want: { air: 1, whip: 0.5, trend: -1 },
    pose: pose({ over: 0.77, follow: 0.35, back: 0.16, pitch: 0.93, head: 1.0 }),
  },
  // THE TABLE: the bike laid flat beside him, the knees drawn up to it,
  // the chest down over the bars.
  {
    id: "tableOut",
    want: { air: 1, table: 0.5, trend: 1 },
    pose: pose({ over: 0.71, follow: 0.35, back: 0.13, pitch: 1.02, head: 0.95, tuck: 0.05 }),
  },
  {
    id: "tablePeak",
    want: { air: 1, table: 1 },
    pose: pose({ over: 0.65, follow: 0.35, back: 0.11, pitch: 1.1, head: 0.9, tuck: 0.09 }),
  },
  {
    id: "tableBack",
    want: { air: 1, table: 0.5, trend: -1 },
    pose: pose({ over: 0.75, follow: 0.35, back: 0.14, pitch: 0.96, head: 0.98 }),
  },
  // THE FOOT OUT: the inside foot off its pedal, low and ahead, the weight
  // down on the outside pedal and the trunk dropped over it.
  {
    id: "footout",
    want: { foot: 1 },
    pose: pose({ over: 0.69, follow: 0.5, back: 0.16, pitch: 0.95, head: 0.92, footOut: 1 }),
  },
];

/** THE MATCH'S NUMBERS: how much nearer another pose must be before the
 * one held is left (its cost's share), the least time a pose is held, s,
 * the inertialization's half-life, s, and each signal's smoothing half-life,
 * s (a foot out rises fast and falls slow, so a slide's flicker reads as
 * one foot put down). */
export const MATCH = {
  stay: 0.25,
  hold: 0.1,
  halflife: 0.09,
  /** The half-life the solvers' answers are settled over, s. */
  settle: 0.06,
  /** The half-life an elbow's or a knee's swivel is settled over, s. */
  swivel: 0.05,
  smooth: 0.035,
  foot: { rise: 0.04, fall: 0.35 },
  /** A flight long enough to land from, s, and how long a landing is
   * remembered, s. */
  landAfter: 0.25,
  landFor: 0.45,
  /** The knee's reach: the hip to the ankle never past `most` nor under
   * `least` of the leg's length. */
  reach: { most: 0.99, least: 0.715 },
  /** The arm's reach the same way: the shoulder to the grip. */
  arm: { most: 0.93, least: 0.62 },
  /** The hips over the bottom bracket, m: never lower nor higher. */
  hips: [0.44, 0.835] as const,
  /** How far the hips are moved to hold the head, m at most. */
  lift: 0.15,
};

/** The channels as a list, for the inertialization. */
const CHANNELS = Object.keys(ATTACK) as (keyof PoseChannels)[];

/** THE MOTION of one rider: hand it every frame in order. */
export type RiderMotion = {
  /** The joints (the ragdoll's thirteen points, `RAGDOLL`'s order, in the
   * root's frame — the bike's attitude about his centre of mass) for the
   * bike posed `pose` at the run's time `t`, s, ridden as `style` says. */
  points(pose: BikePose, style: RideStyle | undefined, t: number): number[];
  /** The pose of the library held now, for a lab's caption. */
  held(): string;
  /** Forget everything (a reset, a new ride). */
  reset(): void;
};

/** The critically damped decay of an offset `x` moving at `vel` over `dt`
 * with a half-life `hl`: an inertialization's every channel. */
function decay(x: number, vel: number, hl: number, dt: number): [number, number] {
  const y = (4 * Math.LN2) / hl / 2;
  const j = vel + x * y;
  const e = Math.exp(-y * dt);
  return [e * (x + j * dt), e * (vel - j * y * dt)];
}

/** One step of a first-order smoother toward `to` with half-life `hl`. */
function ease(from: number, to: number, hl: number, dt: number): number {
  return to + (from - to) * Math.pow(0.5, dt / hl);
}

/** The cost of `pose` against the signals `s`. */
export function poseCost(p: RiderPose, s: RiderSignals): number {
  let c = 0;
  const want = { ...NEUTRAL, ...p.want };
  for (const k of Object.keys(want) as (keyof RiderSignals)[]) {
    const d = s[k] - (want[k] ?? 0);
    c += (p.weight?.[k] ?? WEIGHTS[k]) * d * d;
  }
  return c;
}

/** The library's nearest pose to the signals `s`. */
export function nearestPose(s: RiderSignals, library = RIDER_POSES): number {
  let best = 0;
  let cost = Infinity;
  library.forEach((p, i) => {
    const c = poseCost(p, s);
    if (c < cost) [best, cost] = [i, c];
  });
  return best;
}

/** THE RAW SIGNALS of a frame, before smoothing. */
export function signalsOf(pose: BikePose, style: RideStyle | undefined): RiderSignals {
  return {
    air: pose.airborne ? 1 : 0,
    flight: style?.flight ?? 0,
    land: 0,
    squash: (pose.forkShare + pose.shockShare) / 2,
    pop: pose.crouch,
    back: pose.shift,
    brake: Math.max(pose.front, pose.rear),
    pedal: pose.pedalling ? 1 : 0,
    cs: Math.cos(pose.crank),
    sn: Math.sin(pose.crank),
    lean: pose.roll,
    foot: style?.footOut ?? 0,
    whip: style?.trick === "whip" ? style.amount : 0,
    table: style?.trick === "table" ? style.amount : 0,
    trend: 0,
  };
}

/** A NEW RIDER'S MOTION. */
export function createRiderMotion(library: readonly RiderPose[] = RIDER_POSES): RiderMotion {
  let last = -Infinity;
  let cached: number[] | null = null;
  let sig: RiderSignals | null = null;
  let current = 0;
  let since = 0;
  let airFor = 0;
  let landClock = Infinity;
  let trick = 0;
  let foot: 0 | 1 = 0;
  /** What was drawn last frame, its velocity, and the offset being decayed. */
  const out = { ...ATTACK };
  const vel = Object.fromEntries(CHANNELS.map((k) => [k, 0])) as PoseChannels;
  const off = Object.fromEntries(CHANNELS.map((k) => [k, 0])) as PoseChannels;
  const offV = Object.fromEntries(CHANNELS.map((k) => [k, 0])) as PoseChannels;
  /** The solvers' answers as settled, and how fast they are moving. */
  const placed = [0, 0, 0, 0, 0, 0];
  const placedV = [0, 0, 0, 0, 0, 0];
  /** Each limb's bend as settled (`swivel`). */
  const bends = LIMBS.map(() => ({ at: v(0, 0, 0), vel: v(0, 0, 0), set: false }));

  const reset = (): void => {
    last = -Infinity;
    cached = null;
    sig = null;
    since = 0;
    airFor = 0;
    landClock = Infinity;
    trick = 0;
    for (const k of CHANNELS) off[k] = offV[k] = vel[k] = 0;
    for (const b of bends) b.set = false;
  };

  return {
    held: () => library[current].id,
    reset,
    points(pose, style, t) {
      if (t === last && cached) return cached;
      const dt = t - last;
      const fresh = !(dt > 0 && dt < 0.25) || !sig;
      if (fresh) reset();
      const raw = signalsOf(pose, style);
      // THE LANDING: a real flight's touch-down starts the landing's clock.
      if (raw.air) airFor = pose.airTime;
      else if (!fresh && sig && sig.air > 0.5 && airFor > MATCH.landAfter) {
        landClock = 0;
        airFor = 0;
      }
      if (!fresh) landClock += dt;
      raw.land = landClock < MATCH.landFor ? 1 - landClock / MATCH.landFor : 0;
      const amount = raw.whip + raw.table;
      raw.trend = fresh
        ? 1
        : amount > trick + 1e-4
          ? 1
          : amount < trick - 1e-4
            ? -1
            : (sig?.trend ?? 1);
      trick = amount;
      // THE SIGNALS SMOOTHED (the cranks and the air read as they are).
      if (fresh || !sig) sig = { ...raw };
      else
        for (const k of Object.keys(raw) as (keyof RiderSignals)[]) {
          if (k === "air" || k === "cs" || k === "sn" || k === "pedal" || k === "trend") {
            sig[k] = raw[k];
          } else if (k === "foot") {
            const hl = raw.foot > sig.foot ? MATCH.foot.rise : MATCH.foot.fall;
            sig.foot = ease(sig.foot, raw.foot, hl, dt);
          } else sig[k] = ease(sig[k], raw[k], MATCH.smooth, dt);
        }
      // Which foot is out is held while one is.
      if (style && style.footOut > 0.2 && out.footOut < 0.05) foot = style.foot;
      // THE MATCH: the nearest pose, the one held kept unless another is
      // clearly nearer.
      const best = nearestPose(sig, library);
      since += fresh ? 0 : dt;
      if (fresh) current = best;
      else if (best !== current && since >= MATCH.hold) {
        const held = poseCost(library[current], sig);
        if (poseCost(library[best], sig) < held * (1 - MATCH.stay) - 0.01) {
          // INERTIALIZE: carry what was drawn and how fast into the new pose.
          for (const k of CHANNELS) {
            off[k] = out[k] - library[best].pose[k];
            offV[k] = vel[k];
          }
          current = best;
          since = 0;
        }
      }
      const target = library[current].pose;
      for (const k of CHANNELS) {
        if (fresh) {
          out[k] = target[k];
          vel[k] = 0;
          continue;
        }
        [off[k], offV[k]] = decay(off[k], offV[k], MATCH.halflife, dt);
        const now = target[k] + off[k];
        vel[k] = (now - out[k]) / dt;
        out[k] = now;
      }
      last = t;
      const step = fresh ? 0 : dt;
      const settle = (at: Placement): Placement => {
        const goal = [at.hips.x, at.hips.y, at.hips.z, at.pitch, at.roll, at.twist];
        if (fresh) for (let i = 0; i < goal.length; i++) [placed[i], placedV[i]] = [goal[i], 0];
        else
          for (let i = 0; i < goal.length; i++)
            [placed[i], placedV[i]] = spring(placed[i], placedV[i], goal[i], MATCH.settle, step);
        return {
          hips: v(placed[0], placed[1], placed[2]),
          pitch: placed[3],
          roll: placed[4],
          twist: placed[5],
        };
      };
      cached = swivel(solve(pose, style, out, foot, sig, settle), bends, fresh ? 0 : dt);
      return cached;
    },
  };
}

/** WHERE THE SOLVERS PUT HIM: the hips from the bottom bracket, m, and the
 * trunk's bend, roll and twist, rad. */
export type Placement = { hips: V3; pitch: number; roll: number; twist: number };

/** One step of a critically damped spring of half-life `hl` toward `goal`:
 * the place and the velocity after `dt`. */
function spring(x: number, vel: number, goal: number, hl: number, dt: number): [number, number] {
  const y = (2 * Math.LN2) / hl;
  const j0 = x - goal;
  const j1 = vel + j0 * y;
  const e = Math.exp(-y * dt);
  return [e * (j0 + j1 * dt) + goal, e * (vel - j1 * y * dt)];
}

/** The four limbs: the root joint, the bend and the end. */
const LIMBS = [
  [R.shoulderL, R.elbowL, R.handL],
  [R.shoulderR, R.elbowR, R.handR],
  [R.hipL, R.kneeL, R.footL],
  [R.hipR, R.kneeR, R.footR],
] as const;

/** A limb's bend as carried from frame to frame: where it is off its root
 * joint, and how fast that is moving. */
type Bend = { at: V3; vel: V3; set: boolean };

/** THE BENDS SETTLED: every elbow and knee carried on a spring toward where
 * the two-bone reach put it this frame, then laid back on the circle the
 * bones allow — so the limb keeps its lengths and its ends, and only the
 * way it is bent (its swivel about the line from the root to the end) is
 * eased. An arm straightening past its pole turns its elbow over in a frame
 * the reach alone would draw. */
export function swivel(points: number[], bends: Bend[], dt: number): number[] {
  const at = (i: number): V3 => v(points[3 * i], points[3 * i + 1], points[3 * i + 2]);
  LIMBS.forEach(([a, b, c], k) => {
    const root = at(a);
    const end = at(c);
    const raw = sub(at(b), root);
    const bend = bends[k];
    if (!bend.set || dt <= 0) {
      bend.at = raw;
      bend.vel = v(0, 0, 0);
      bend.set = true;
      return;
    }
    const xs = [bend.at.x, bend.at.y, bend.at.z];
    const vs = [bend.vel.x, bend.vel.y, bend.vel.z];
    const gs = [raw.x, raw.y, raw.z];
    for (let i = 0; i < 3; i++) [xs[i], vs[i]] = spring(xs[i], vs[i], gs[i], MATCH.swivel, dt);
    bend.at = v(xs[0], xs[1], xs[2]);
    bend.vel = v(vs[0], vs[1], vs[2]);
    // Back onto the circle: the bend's place along the root-to-end line is
    // the bones' own, its swivel about it the settled one.
    const line = sub(end, root);
    const d = len(line) || 1e-6;
    const n = v(line.x / d, line.y / d, line.z / d);
    const along = raw.x * n.x + raw.y * n.y + raw.z * n.z;
    const r = len(sub(raw, v(n.x * along, n.y * along, n.z * along)));
    const s0 = bend.at;
    const k0 = s0.x * n.x + s0.y * n.y + s0.z * n.z;
    let side = sub(s0, v(n.x * k0, n.y * k0, n.z * k0));
    const sl = len(side);
    if (sl < 1e-6) return;
    side = v((side.x / sl) * r, (side.y / sl) * r, (side.z / sl) * r);
    const p = add(root, add(v(n.x * along, n.y * along, n.z * along), side));
    points[3 * b] = p.x;
    points[3 * b + 1] = p.y;
    points[3 * b + 2] = p.z;
  });
  return points;
}

/** The trunk's bend a rider is ever drawn at, rad: inside the attack
 * stance's band. */
const PITCH = [0.4, 1.18] as const;

/** The world's up in the bike's body frame, for the attitude `q`. */
function upInBike(q: { x: number; y: number; z: number; w: number }): V3 {
  // The conjugate turn of (0, 1, 0): the second row of q's matrix.
  const { x, y, z, w } = q;
  return v(2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x));
}

/** Where the shoulders stand for hips at `hips` and a trunk bent `pitch`,
 * rolled `roll` and twisted `twist` — `keyPoints`' own trunk. */
function shouldersOf(hips: V3, pitch: number, roll: number, twist: number): [V3, V3] {
  const u0 = v(Math.sin(roll), Math.cos(pitch) * Math.cos(roll), Math.sin(pitch));
  const un = len(u0) || 1;
  const up = v(u0.x / un, u0.y / un, u0.z / un);
  const r0 = v(Math.cos(twist), 0, -Math.sin(twist));
  const k = r0.x * up.x + r0.y * up.y + r0.z * up.z;
  const r1 = v(r0.x - up.x * k, r0.y - up.y * k, r0.z - up.z * k);
  const rn = len(r1) || 1;
  const neck = add(hips, v(up.x * BODY.spine, up.y * BODY.spine, up.z * BODY.spine));
  const s = BODY.shoulder / rn;
  return [sub(neck, v(r1.x * s, r1.y * s, r1.z * s)), add(neck, v(r1.x * s, r1.y * s, r1.z * s))];
}

/** THE HIPS moved up or down (and back where they must) until each leg's
 * hip-to-ankle stands inside `MATCH.reach` of the leg's length; where both
 * cannot, the middle of the two misses. */
function guardReach(hips: V3, feet: [V3, V3], footI: 0 | 1, footOut: number, bbY: number): V3 {
  const leg = BODY.thigh + BODY.shin;
  const lo = leg * MATCH.reach.least;
  const hi = leg * MATCH.reach.most;
  let at = hips;
  for (let pass = 0; pass < 8; pass++) {
    // The hips' own band over the bottom bracket.
    let top = bbY + MATCH.hips[1];
    let bottom = bbY + MATCH.hips[0];
    for (const i of [0, 1] as const) {
      if (i === footI && footOut > 0.5) continue;
      const hip = add(at, v((i ? 1 : -1) * BODY.hip, 0, 0));
      const f = feet[i];
      const h2 = (hip.x - f.x) ** 2 + (hip.z - f.z) ** 2;
      // The hip's heights over this foot that keep the leg in its band.
      const a = f.y + Math.sqrt(Math.max(0, lo * lo - h2));
      const b = f.y + Math.sqrt(Math.max(0, hi * hi - h2));
      bottom = Math.max(bottom, a);
      top = Math.min(top, b);
    }
    if (bottom <= top) return v(at.x, clamp(at.y, bottom, top), at.z);
    // No height serves both: back a little (the legs' heights draw
    // together the further behind them he is), then try again.
    at = v(at.x, (bottom + top) / 2, at.z - 0.03);
  }
  return at;
}

/** THE JOINTS for the channels `c` on the bike posed `pose`: the hips put,
 * the head held, the hands and feet on the bike, the reach guarded. */
export function solve(
  pose: BikePose,
  style: RideStyle | undefined,
  c: PoseChannels,
  footI: 0 | 1,
  sig: RiderSignals,
  settle?: (at: Placement) => Placement,
): number[] {
  const bb = bracketFromRider(pose);
  const [g0, g1] = gripsAt(pose.steer);
  const [p0, p1] = pedalsAt(pose.crank);
  const yaw = style?.yaw ?? 0;
  const roll = style?.roll ?? 0;
  const turn = (p: V3): V3 => (yaw !== 0 || roll !== 0 ? underHim(p, yaw, roll) : p);
  // The ankle off the pedal's middle: the ball of the foot on it, the heel
  // dropped — further on the pedal that is up, less on the one down.
  const ankle = (p: V3): V3 => v(0, ANKLE + 0.012 - 0.12 * p.y, -0.055);
  const hands: [V3, V3] = [turn(add(bb, g0)), turn(add(bb, g1))];
  const feet: [V3, V3] = [turn(add(add(bb, p0), ankle(p0))), turn(add(add(bb, p1), ankle(p1)))];
  // THE FOOT OUT: off its pedal, out to the side, low and ahead.
  if (c.footOut > 0.001) {
    const side = footI ? 1 : -1;
    const outAt = add(bb, v(side * 0.5, -0.2, 0.45));
    feet[footI] = mix(feet[footI], outAt, clamp(c.footOut, 0, 1));
  }
  // THE HIPS: over the bottom bracket by the pose, riding the engine's body
  // on its springs for `follow` of it (the engine's centre of mass is his
  // own: at the root's origin, so `bb` below it).
  const riderOver = -bb.y;
  let hips = v(
    c.across,
    bb.y + c.over + c.follow * (riderOver - 0.74),
    bb.z - c.back + c.follow * (pose.rider.z + 0.08),
  );
  // THE TRICK's body: the hips follow a share of the bike turned under him.
  const whipTwist = yaw * 0.5;
  const whipRoll = roll * 0.4;
  hips.y -= c.tuck * 1;
  // THE REACH GUARD: the hips stood where both legs bend inside the band
  // a knee bends through — high enough that the foot on the upper pedal is
  // not folded past it, low enough that the lower one is not locked out.
  hips = guardReach(hips, feet, footI, c.footOut, bb.y);
  // THE HEAD HELD: the trunk bent until the head stands where the pose holds
  // it over the bike's centre in the WORLD, whatever the bike's pitch — so
  // the head rides quiet while the hips take the bike's travel.
  const up = upInBike(pose.q);
  const fromBike = add(BIKE_BB, pose.rider);
  const reachUp = BODY.spine + BODY.neck * Math.cos(c.nod);
  const headAt = (p: number): number => {
    const h = add(hips, v(0, Math.cos(p) * reachUp, Math.sin(p) * reachUp + 0.02));
    return up.x * (h.x + fromBike.x) + up.y * (h.y + fromBike.y) + up.z * (h.z + fromBike.z);
  };
  const aim = c.head + (sig.squash - 0.3) * 0.04;
  const search = (): number => {
    let best = c.pitch;
    let miss = Infinity;
    for (let p = PITCH[0]; p <= PITCH[1] + 1e-9; p += 0.01) {
      const m = Math.abs(headAt(p) - aim) + 0.02 * Math.abs(p - c.pitch);
      if (m < miss) [miss, best] = [m, p];
    }
    return best;
  };
  let solved = search();
  // What the trunk's bend cannot hold the hips take: moved along the world's
  // up (as it lies in the bike's own plane) and guarded again — back off
  // the rear down a steep landing, up over the bike pitched up a lip.
  const short = clamp((aim - headAt(solved)) * c.gimbal, -MATCH.lift, MATCH.lift);
  if (Math.abs(short) > 1e-4) {
    const n = Math.hypot(up.y, up.z) || 1;
    hips = guardReach(
      add(hips, v(0, (up.y / n) * short, (up.z / n) * short)),
      feet,
      footI,
      c.footOut,
      bb.y,
    );
    solved = search();
  }
  let pitch = c.pitch + (solved - c.pitch) * c.gimbal;
  // THE ARM'S REACH: the trunk bent more or less until the shoulders stand
  // where the arms reach the grips with the elbows in their band; what the
  // bend cannot close, the hips close, moved toward the bars.
  let lay = -pose.roll * 0.45 + c.roll + whipRoll + (footI ? 1 : -1) * 0.12 * c.footOut;
  let twist = -pose.steer * 0.3 + c.twist + whipTwist;
  const arm = BODY.upperArm + BODY.forearm;
  const reachOf = (p: number): [number, number] => {
    const sh = shouldersOf(hips, p, lay, twist);
    const d0 = len(sub(hands[0], sh[0]));
    const d1 = len(sub(hands[1], sh[1]));
    return [Math.max(d0, d1), Math.min(d0, d1)];
  };
  for (let pass = 0; pass < 10; pass++) {
    const [far, near] = reachOf(pitch);
    if (far > arm * MATCH.arm.most && pitch < PITCH[1]) pitch += 0.03;
    else if (near < arm * MATCH.arm.least && pitch > PITCH[0]) pitch -= 0.03;
    else break;
  }
  pitch = clamp(pitch, PITCH[0], PITCH[1]);
  const [far] = reachOf(pitch);
  if (far > arm * MATCH.arm.most) {
    const grips = mix(hands[0], hands[1], 0.5);
    const sh = shouldersOf(hips, pitch, lay, twist);
    const to = sub(grips, mix(sh[0], sh[1], 0.5));
    const k = (far - arm * MATCH.arm.most) / (len(to) || 1);
    hips = add(hips, v(to.x * k, to.y * k, to.z * k));
  }
  pitch = clamp(pitch, PITCH[0], PITCH[1]);
  // SETTLED: the solvers' answers carried on springs from frame to frame
  // (`createRiderMotion`), so a bound met or a search's answer moved never
  // throws the hips or the trunk between two frames.
  if (settle) {
    const at = settle({ hips: sub(hips, bb), pitch, roll: lay, twist });
    hips = add(bb, at.hips);
    pitch = at.pitch;
    lay = at.roll;
    twist = at.twist;
  }
  const key: Key = {
    hipX: hips.x,
    hipY: hips.y,
    hipZ: hips.z,
    pitch,
    roll: lay,
    twist,
    nod: c.nod - 0.25 * (pitch - c.pitch),
    feet,
    hands,
    kneesOut: c.kneesOut,
    elbowsOut: c.elbowsOut,
  };
  return keyPoints(key, 0);
}
