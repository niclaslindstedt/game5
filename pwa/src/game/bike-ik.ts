// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER ON THE BIKE SOLVED FROM HIS CONTACTS — constraints first. Where
// a downhill rider's limbs are is not a pose he holds but what his hands on
// the bars and his feet on the pedals leave him: every limb is a two-bone
// reach from its root to its contact, and the root itself is placed by a
// BALANCE MODEL. In order, every frame, as a pure function of the bike as
// the engine has it (`BikePose`) and the freerider's style
// (`bike-ride-style.ts`) — no switch, so nothing can snap that the bike
// under him does not. The one memory (`IKMemory`, optional) eases what the
// engine hands over as a step — the foot out of a slide, the brake, the hips
// — on critically damped springs over the run's clock:
//
//   CONTACTS  the grips where the turned bars have them, the ankles over
//             the pedals as the cranks turn them (the ball of the foot on
//             the pedal, the heel dropped), the bike turned under him in a
//             whip or a table, a foot put out toward the dirt in a slide;
//   HIPS      over the bottom bracket in the attack stance, then moved by
//             what the rider balances against: BACK and LOW on a steep and
//             FORWARD on a climb (his weight kept over the cranks along the
//             gravity the bike is pitched in), back and down under the
//             brakes, dropped and raised with the engine's rider body on its
//             springs (a pump, a landing, a pop), rocked over the pushing
//             pedal as the cranks turn, and never higher than both legs can
//             reach their pedals bent nor lower than the higher knee folds;
//   TRUNK     bent forward until the shoulders stand an arm bent to its
//             mark from the grips — so the elbows are the geometry's, a lower
//             hip folding the chest down to the bars, a hard brake opening
//             the arms — rolled more upright than the bike he lays over, his
//             shoulders square to the bars;
//   HEAD      on the neck toward the world's up and the trail ahead, so a
//             nose dropping into a landing or pitched up off a lip never
//             tips his eyes off the line;
//   LIMBS     knees and elbows from the reach toward POLES fixed to the bike
//             (the knees forward and out over the top tube, the elbows out
//             and back) and turned with it, so a whip carries them round
//             with the feet and the bend never flips.
//
// THE FRAME is `skier-bike.ts`'s root: the bike's own attitude (x right,
// y up, z forward), its origin the rider's centre of mass as the engine has
// it. Everything is placed off the bottom bracket, so the figure rides the
// bike, not the engine's rider spring: that spring is read as a signal only.
//
// Three-free, so the suite reads it.

import { RAGDOLL as R, type BikePose } from "@engine";
import { unrotate } from "@niclaslindstedt/oss-game-framework/core/quat";

import { bracketFromRider, gripsAt, pedalsAt, type V3 } from "./bike-look.ts";
import type { RideStyle } from "./bike-ride-style.ts";
import { ANKLE } from "./party-pose.ts";
import { BODY } from "./skier-mounts.ts";

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3): V3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: V3, b: V3): V3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a: V3, k: number): V3 => v(a.x * k, a.y * k, a.z * k);
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: V3): number => Math.hypot(a.x, a.y, a.z);
const norm = (a: V3): V3 => scale(a, 1 / (len(a) || 1));
const cross = (a: V3, b: V3): V3 =>
  v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const mix = (a: V3, b: V3, k: number): V3 => add(a, scale(sub(b, a), k));
const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));
/** A min and a max with no corner: within `k` of each other they blend. */
const softMin = (a: number, b: number, k: number): number =>
  Math.min(a, b) - k * Math.log1p(Math.exp(-Math.abs(a - b) / k));
const softMax = (a: number, b: number, k: number): number => -softMin(-a, -b, k);

/** The inside angle a two-bone limb of `a` and `b` stands at when its ends
 * are `d` apart, rad — and the reach a bend leaves it. */
const reachAt = (a: number, b: number, bend: number): number =>
  Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(bend));

const DEG = Math.PI / 180;

/** THE NUMBERS of the constraints, from downhill riders on video and in the
 * coaching guides (`docs/downhill-bike.md`): the attack stance's hips about
 * 0.6 m over the cranks and a hand's breadth behind them, the elbows bent
 * near a right angle and a half and out, the knees forward and out over the
 * top tube, the chest low, the eyes on the trail. */
export const BIKE_IK = {
  /** The hips' middle over the bottom bracket in the attack stance, m. */
  hips: v(0, 0.8, -0.12),
  /** How the engine's rider body on its springs is read: where it rests
   * over the bottom bracket, m, and the share of its travel the hips take
   * up and down and fore and aft. */
  rider: { rest: v(0, 0.74, -0.03), up: 0.85, back: 0.8 },
  /** THE SLOPE: hips moved back by `back` m for every unit of the slope's
   * tangent the bike is pitched down (forward on a climb, the tangent held
   * to `most`), lowered by `low` m and the arms opened by `arms` at a full
   * `steep` tangent. */
  slope: { back: 0.26, low: 0.1, steep: 0.8, most: 1.3, arms: 30 * DEG },
  /** Under the levers: back and down, m, and the arms opened, rad. */
  brake: { back: 0.1, down: 0.12, arms: 16 * DEG },
  /** THE PEDAL STROKE: the hips rocked over the pushing pedal (across, m)
   * and dipped as the cranks pass upright (m) — nothing while they stand
   * level, so coasting is still. */
  pedal: { across: 0.035, dip: 0.07, ahead: 0.02 },
  /** The hips' band over the bottom bracket, m, and how softly it holds. */
  band: { low: 0.4, high: 0.82, soft: 0.03 },
  /** THE LEGS: the straightest the knee is let stand (rad) and the tightest
   * it is let fold — the hips held between. */
  knee: { most: 155 * DEG, least: 72 * DEG },
  /** THE ARMS: the elbow's mark, rad — the trunk bends until the shoulders
   * stand there from the grips. */
  elbow: 112 * DEG,
  /** The trunk's bend forward of the bike's up, rad, held between. */
  pitch: { least: 0.38, most: 1.2 },
  /** The share of the bike's lean the trunk does not follow, and how much
   * of the bars' turn the shoulders take. */
  upright: 0.45,
  twist: 0.3,
  /** The head: on the neck toward the world's up, the line ahead and the
   * trunk's own up, in those shares. */
  head: { world: 0.55, ahead: 0.6, trunk: 0.35 },
  /** POLES the knees and elbows bend toward, in the bike's frame (x out to
   * each side). */
  kneePole: v(0.7, 0.05, 1),
  elbowPole: v(1, -0.25, -0.65),
  /** The ankle off a pedal's middle (the ball of the foot on it, the heel
   * dropped), m. */
  ankle: v(0, ANKLE + 0.012, -0.055),
  /** How much of a whip's or a table's turn the hips follow, and how far a
   * table draws them up toward the bike, m. */
  follow: { twist: 0.55, roll: 0.6, hips: 0.6 },
  /** The arms opened in a whip or a table at its peak, rad. */
  trickArms: 25 * DEG,
  tuck: 0.1,
  /** The foot out of a slide: from the bottom bracket, out to the side, low
   * over the dirt and ahead of the cranks, m. */
  foot: v(0.5, -0.2, 0.45),
};

/** A point turned under him by a whip's `yaw` then `roll` about his centre
 * of mass — `skier-bike.ts`' `underHim`, restated so the solver stands
 * alone. */
function turned(p: V3, yaw: number, roll: number): V3 {
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const x1 = p.x * cr - p.y * sr;
  const y1 = p.x * sr + p.y * cr;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  return v(x1 * cy + p.z * sy, y1, -x1 * sy + p.z * cy);
}

/** A two-bone reach from `root` toward `to` over `a` and `b`, the middle
 * joint bent toward `pole`: the middle joint and the end. The bend plane is
 * the pole's part across the limb — a pole kept well off the limb's line
 * never flips it. */
function reach(root: V3, to: V3, a: number, b: number, pole: V3): [V3, V3] {
  const d0 = sub(to, root);
  const along = norm(d0);
  const d = clamp(len(d0), Math.abs(a - b) + 1e-3, (a + b) * 0.999);
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const off = sub(pole, scale(along, dot(pole, along)));
  const perp = len(off) < 1e-6 ? v(0, 0, 1) : norm(off);
  return [add(add(root, scale(along, x)), scale(perp, h)), add(root, scale(along, d))];
}

/** The trunk's frame for a bend `pitch`, a roll and a twist: its up, right
 * and forward — `party-pose.ts`' `keyPoints`' own. */
function trunkFrame(pitch: number, roll: number, twist: number): [V3, V3, V3] {
  const up = norm(v(Math.sin(roll), Math.cos(pitch) * Math.cos(roll), Math.sin(pitch)));
  const right0 = v(Math.cos(twist), 0, -Math.sin(twist));
  const right = norm(sub(right0, scale(up, dot(right0, up))));
  return [up, right, cross(right, up)];
}

/** WHAT THE SOLVER REMEMBERS — nothing of the pose, only the few signals
 * that step where a body cannot, each followed by a critically damped
 * spring over the run's clock so what is pinned to it moves as a body
 * moves:
 *
 *   FOOT OUT  read off the tyres' slide, which flickers on and off a frame
 *             at a time through a loose turn: each foot's call is HELD as
 *             it decays (`hold` s from whole to nothing) and followed
 *             (`ease` s), so a slide puts the foot down once and keeps it
 *             there while the tyres keep breaking loose;
 *   HIPS      where the balance puts them is where they are heading — the
 *             levers grabbed, a pop, a landing move the mark in a frame and
 *             the body's middle follows it (`hips` s);
 *   BRAKE     the levers are a step, the weight going back behind them is
 *             not (`brake` s);
 *   CRANKS    the engine leaves the cranks wherever the last stroke left
 *             them; a rider coasting stands them LEVEL, his feet even, and
 *             turns them there as he stops pedalling — the drawn cranks
 *             carry an offset off the engine's that is eased to the nearest
 *             level while he coasts and back to nothing while he pedals
 *             (`crank` s). The drawn bike reads the same (`drawnCrank`).
 *
 * A call at the same moment again (a lab's second lens) moves nothing; a
 * gap in the clock past `gap` s starts over. */
export const IK_EASE = { hold: 0.45, feet: 0.2, hips: 0.09, brake: 0.15, crank: 0.35, gap: 0.3 };

export type IKMemory = {
  /** The run's time of the last solve and the step since, s (NaN: over). */
  t: number;
  dt: number;
  held: [number, number];
  out: [number, number];
  vel: number[];
  /** The hips' middle off the bottom bracket and its rate. */
  hip: V3 | null;
  hipVel: number[];
  brake: number;
  brakeVel: number[];
  /** The drawn cranks' offset off the engine's, rad, its rate, and when
   * it was last stepped. */
  crank: number;
  crankVel: number[];
  crankT: number;
};

export function ikMemory(): IKMemory {
  return {
    t: Number.NaN,
    dt: Number.NaN,
    held: [0, 0],
    out: [0, 0],
    vel: [0, 0],
    hip: null,
    hipVel: [0, 0, 0],
    brake: 0,
    brakeVel: [0],
    crank: 0,
    crankVel: [0],
    crankT: Number.NaN,
  };
}

/** `x` toward `to` on a critically damped spring of `ease` s over `dt`,
 * its rate `vel[i]` written back: the new place. */
function follow(x: number, to: number, vel: number[], i: number, ease: number, dt: number): number {
  const w = 2 / ease;
  const d = x - to;
  const e = Math.exp(-w * dt);
  const k = (vel[i] + w * d) * dt;
  vel[i] = (vel[i] - w * k) * e;
  return to + (d + k) * e;
}

const goesOn = (dt: number): boolean => dt >= 0 && dt <= IK_EASE.gap;

/** THE CRANKS AS DRAWN at the run's time `t`: the engine's, plus the eased
 * offset that stands them level while he coasts. The bike's drawing and
 * the rider's feet both ask, so they never part. */
export function drawnCrank(
  mem: IKMemory,
  pose: Pick<BikePose, "crank" | "pedalling">,
  t: number,
): number {
  const dt = t - mem.crankT;
  mem.crankT = t;
  const level = Math.round(pose.crank / Math.PI) * Math.PI - pose.crank;
  const want = pose.pedalling ? 0 : level;
  if (!goesOn(dt)) {
    mem.crank = want;
    mem.crankVel[0] = 0;
  } else mem.crank = follow(mem.crank, want, mem.crankVel, 0, IK_EASE.crank, dt);
  return pose.crank + mem.crank;
}

/** Steps the memory to the run's time `t`: each foot's share out, eased
 * off `style`'s call, and the levers as the body answers them. */
function stepMemory(
  mem: IKMemory,
  style: RideStyle | undefined,
  brake: number,
  t: number,
): { feet: [number, number]; brake: number } {
  const want = [0, 0];
  if (style && style.footOut > 0) want[style.foot] = style.footOut;
  const dt = t - mem.t;
  mem.t = t;
  mem.dt = dt;
  if (!goesOn(dt)) {
    for (const i of [0, 1] as const) {
      mem.held[i] = mem.out[i] = want[i];
      mem.vel[i] = 0;
    }
    mem.brake = brake;
    mem.brakeVel[0] = 0;
    mem.hip = null;
  } else {
    for (const i of [0, 1] as const) {
      mem.held[i] = Math.max(want[i], mem.held[i] - dt / IK_EASE.hold);
      mem.out[i] = follow(mem.out[i], mem.held[i], mem.vel, i, IK_EASE.feet, dt);
    }
    mem.brake = follow(mem.brake, brake, mem.brakeVel, 0, IK_EASE.brake, dt);
  }
  return { feet: [mem.out[0], mem.out[1]], brake: mem.brake };
}

/** THE RIDER'S THIRTEEN JOINTS (`RAGDOLL`'s order, flat x y z) on the bike
 * posed `pose`, ridden as `style` says, in the root's frame — each foot out
 * as `style` calls it, the noisy calls eased over the run's clock `t` where
 * a `memory` is handed (`IK_EASE`). */
export function ikPoints(pose: BikePose, style?: RideStyle, memory?: IKMemory, t = 0): number[] {
  const K = BIKE_IK;
  const lever = style ? style.brake : Math.max(pose.front, pose.rear);
  const eased = memory ? stepMemory(memory, style, lever, t) : null;
  const crank = memory ? drawnCrank(memory, pose, t) : pose.crank;
  const bb = bracketFromRider(pose);
  const yaw = style?.yaw ?? 0;
  const roll = style?.roll ?? 0;
  const turn = (p: V3): V3 => (yaw !== 0 || roll !== 0 ? turned(p, yaw, roll) : p);

  // ── THE CONTACTS ──────────────────────────────────────────────────────
  const grips = gripsAt(pose.steer).map((g) => turn(add(bb, g))) as [V3, V3];
  const ankles = pedalsAt(crank).map((p) => turn(add(add(bb, p), K.ankle))) as [V3, V3];
  const feet: [number, number] = eased?.feet ?? [
    style?.foot === 0 ? (style?.footOut ?? 0) : 0,
    style?.foot === 1 ? (style?.footOut ?? 0) : 0,
  ];
  for (const i of [0, 1] as const) {
    if (feet[i] <= 0) continue;
    const side = i ? 1 : -1;
    ankles[i] = mix(ankles[i], add(bb, v(side * K.foot.x, K.foot.y, K.foot.z)), feet[i]);
  }
  const footOut = Math.max(feet[0], feet[1]);
  const footSide = feet[1] - feet[0];

  // ── THE BALANCE: where the hips go, off the bottom bracket ────────────
  // Gravity in the bike's frame: its forward share is the slope he balances
  // against (nose down positive).
  const g = unrotate(pose.q, v(0, -1, 0));
  const slope = clamp(g.z / Math.max(0.3, -g.y), -K.slope.most, K.slope.most);
  const steep = clamp(Math.max(0, slope) / K.slope.steep, 0, 1);
  const brake = eased?.brake ?? lever;
  const spring = sub(pose.rider, K.rider.rest);
  const s = Math.sin(crank);
  const c2 = Math.cos(2 * crank);
  let hx = -K.pedal.across * s;
  let hy =
    K.hips.y +
    K.rider.up * spring.y -
    K.slope.low * steep * steep -
    K.brake.down * brake -
    (K.pedal.dip * (1 - c2)) / 2;
  let hz =
    K.hips.z +
    K.rider.back * spring.z -
    K.slope.back * slope -
    K.brake.back * brake +
    (K.pedal.ahead * (1 - c2)) / 2;
  if (style?.trick === "table") hy -= K.tuck * style.amount;
  // The foot out: his weight onto the outside foot, dropped over it.
  hy -= 0.03 * footOut;
  hz = clamp(hz, -0.46, 0.12);
  // Held in the band, then by the legs: no higher than both ankles can be
  // reached with the knee bent, no lower than the higher knee folds.
  const reachMost = reachAt(BODY.thigh, BODY.shin, K.knee.most);
  const reachLeast = reachAt(BODY.thigh, BODY.shin, K.knee.least);
  const S = K.band.soft;
  let top = bb.y + K.band.high;
  let floor = bb.y + K.band.low;
  for (const i of [0, 1] as const) {
    if (feet[i] > 0.5) continue;
    const hip = v(bb.x + hx + (i ? 1 : -1) * BODY.hip, 0, bb.z + hz);
    const a = ankles[i];
    const flat = Math.hypot(hip.x - a.x, hip.z - a.z);
    top = softMin(top, a.y + Math.sqrt(Math.max(0.01, reachMost ** 2 - flat ** 2)), S);
    if (flat < reachLeast) floor = softMax(floor, a.y + Math.sqrt(reachLeast ** 2 - flat ** 2), S);
  }
  const want = bb.y + hy;
  hy = softMax(softMin(want, top, S), Math.min(floor, top - 0.02), S);
  if (memory) {
    const m = memory;
    if (!m.hip) {
      m.hip = v(hx, hy - bb.y, hz);
      m.hipVel = [0, 0, 0];
    } else {
      const r = m.hipVel;
      const e = IK_EASE.hips;
      m.hip = v(
        follow(m.hip.x, hx, r, 0, e, m.dt),
        follow(m.hip.y, hy - bb.y, r, 1, e, m.dt),
        follow(m.hip.z, hz, r, 2, e, m.dt),
      );
    }
    hx = m.hip.x;
    hy = bb.y + m.hip.y;
    hz = m.hip.z;
  }
  // His hips go round with the bike thrown under him, by a share.
  const centre = mix(v(bb.x + hx, hy, bb.z + hz), turn(v(bb.x + hx, hy, bb.z + hz)), K.follow.hips);

  // ── THE TRUNK: bent until the arms stand at their mark ────────────────
  // The bars turned right take the right grip back: his shoulders turn
  // with them, as with the bike thrown under him (`turned`'s yaw).
  const twist = pose.steer * K.twist + yaw * K.follow.twist;
  // A whip's roll lays the bike's top toward −x (`turned`); his trunk
  // follows a share of it the same way, and leans off the bike's lean.
  const trunkRoll = -pose.roll * K.upright - roll * K.follow.roll + 0.12 * footSide;
  const arm = reachAt(
    BODY.upperArm,
    BODY.forearm,
    K.elbow + K.brake.arms * brake + K.slope.arms * steep + K.trickArms * (style?.amount ?? 0),
  );
  const shoulderGap = (p: number): number => {
    const [up, right] = trunkFrame(p, trunkRoll, twist);
    const neck = add(centre, scale(up, BODY.spine));
    const l = len(sub(sub(neck, scale(right, BODY.shoulder)), grips[0]));
    const r = len(sub(add(neck, scale(right, BODY.shoulder)), grips[1]));
    // The farther arm decides: neither is let reach past its mark.
    return Math.max(l, r);
  };
  // The gap to the bars shrinks as he bends toward them: bisect for the
  // bend that leaves the arm its mark, held to the trunk's band.
  let lo = K.pitch.least;
  let hi = K.pitch.most;
  let pitch: number;
  if (shoulderGap(lo) <= arm) pitch = lo;
  else if (shoulderGap(hi) >= arm) pitch = hi;
  else {
    for (let n = 0; n < 24; n++) {
      const mid = (lo + hi) / 2;
      if (shoulderGap(mid) > arm) lo = mid;
      else hi = mid;
    }
    pitch = (lo + hi) / 2;
  }
  const [up, right, fwd] = trunkFrame(pitch, trunkRoll, twist);
  const hips: [V3, V3] = [sub(centre, v(BODY.hip, 0, 0)), add(centre, v(BODY.hip, 0, 0))];
  const neck = add(centre, scale(up, BODY.spine));
  const shoulders: [V3, V3] = [
    sub(neck, scale(right, BODY.shoulder)),
    add(neck, scale(right, BODY.shoulder)),
  ];

  // ── THE HEAD: toward the world's up and the line ahead ────────────────
  const worldUp = scale(g, -1);
  const ahead = norm(sub(v(0, 0, 1), scale(worldUp, worldUp.z)));
  const H = K.head;
  const dir = norm(add(add(scale(worldUp, H.world), scale(ahead, H.ahead)), scale(up, H.trunk)));
  const head = add(add(neck, scale(dir, BODY.neck)), scale(fwd, 0.02));

  // ── THE LIMBS: two bones each, to the contacts ────────────────────────
  const joint: V3[] = new Array(R.count);
  joint[R.hipL] = hips[0];
  joint[R.hipR] = hips[1];
  joint[R.shoulderL] = shoulders[0];
  joint[R.shoulderR] = shoulders[1];
  joint[R.head] = head;
  for (const i of [0, 1] as const) {
    const side = i ? 1 : -1;
    const kp = turn(v(side * K.kneePole.x, K.kneePole.y, K.kneePole.z));
    const [knee, ankle] = reach(hips[i], ankles[i], BODY.thigh, BODY.shin, kp);
    joint[i ? R.kneeR : R.kneeL] = knee;
    joint[i ? R.footR : R.footL] = ankle;
    const ep = turn(v(side * K.elbowPole.x, K.elbowPole.y, K.elbowPole.z));
    const [elbow, hand] = reach(shoulders[i], grips[i], BODY.upperArm, BODY.forearm, ep);
    joint[i ? R.elbowR : R.elbowL] = elbow;
    joint[i ? R.handR : R.handL] = hand;
  }
  const flat: number[] = [];
  for (const p of joint) flat.push(p.x, p.y, p.z);
  return flat;
}
