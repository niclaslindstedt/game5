// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER AS SPRINGS ON THE BIKE — the downhill rider's body driven as a
// set of masses on springs and dampers over the bike, so what he does
// between the poses comes out of his body's own physics rather than out of
// keys:
//
//   HIPS     a mass sprung to the attack stance's place (`skier-bike.ts`'s
//            key), thrown by the bike's every change of velocity (a
//            landing drives him down into his legs and he comes back up,
//            a brake throws him forward and he sets back); the legs'
//            drive while pedalling bobs and sways it;
//   TRUNK    the neck a second mass, sprung to where a rigid trunk would
//            put it but HOLDING ITS HEIGHT as the hips rise and sink (the
//            trunk folds over the hips instead), held a spine's length off
//            the hips and inside the arms' reach of the grips;
//   HEAD     a gimbal on the neck: aimed at the world's up and the trail
//            ahead whatever the bike does under it, its servo a quick one;
//   LIMBS    soft: each knee and elbow a point that lags its two-bone
//            answer on a spring, so the middle joint never jumps across,
//            the hands and the feet held on the grips and the pedals;
//   PEDALS   the cranks as drawn eased LEVEL when he coasts (the
//            downhiller's stance, the lead foot forward) and back onto the
//            engine's when he pedals; the foot out eased off and on as a
//            leg is, never switched.
//
// Presentation only: read off the engine's state, never written into it,
// nothing drawn from any stream, so no digest moves. One body a bike
// (`riderSpringsOf`), stepped once a moment of the run's clock however
// many readers ask for it (the bike's drawing and the rider's figure both
// do), started again at rest after a gap.
//
// Three-free and DOM-free, so the suite and the motion lab read it.

import { bikePose, RAGDOLL as R, type BikePose, type BikeState } from "@engine";
import { unrotate } from "@niclaslindstedt/oss-game-framework/core/quat";

import type { V3 } from "./bike-look.ts";
import type { RideStyle } from "./bike-ride-style.ts";
import { BODY } from "./skier-mounts.ts";
import type { Key } from "./party-pose.ts";

/** THE SPRINGS' NUMBERS. Natural frequencies Hz, damping ratios, gains
 * (the share of the bike's change of velocity felt as the body's own), m.
 * A leg-sprung body on a bike sits near 2 Hz; the head's neck servo is a
 * quick one; the limbs' points lag only a little. */
export const RIDER_SPRINGS = {
  /** The hips on the legs: soft and a little under-damped, so a landing
   * rings once and settles. */
  hips: { hz: 2.0, zeta: 0.5, gain: v3(0.16, 0.22, 0.14), most: 0.14 },
  /** The neck over the hips. */
  neck: { hz: 1.7, zeta: 0.65, gain: v3(0.1, 0.18, 0.08), most: 0.1 },
  /** How much of the engine's own rider rising and sinking on the frame
   * the neck does NOT follow (the trunk folds instead), and the time the
   * rider's mean height is read over, s. */
  hold: 0.45,
  holdTau: 0.7,
  /** The share of the engine's rider rising and sinking the hips follow
   * (the rest the legs keep, the body riding higher than the engine's
   * point over a deep fold), and the hips' place over the key's, m: a
   * downhiller's attack stands taller in the legs than the key's. */
  follow: 0.6,
  lift: 0.08,
  /** The head's gimbal: its servo, and how much of the world's up it is
   * aimed at against the trunk's (1: wholly the world's), and its lift
   * forward of that, rad — eyes down the trail. */
  head: { hz: 5, zeta: 0.85, world: 0.8, ahead: 0.62 },
  /** The trunk's attitude: its bend, roll and twist chasing the key's,
   * and the bike's pitch as the body FEELS it (a slow follower) — the
   * share of the bike's pitch off that the trunk does not follow: thrown
   * nose-down off a lip or nose-up into a landing, the bike turns under a
   * body that turns less. */
  trunk: { hz: 3, zeta: 0.8, feltHz: 0.6, feltZeta: 0.9, hold: 1, holdRoll: 0.35 },
  /** The knees' and elbows' points chasing their two-bone answer. */
  limb: { hz: 7, zeta: 0.95 },
  /** The cranks eased level coasting and back on pedalling; the foot out
   * put down and picked up. */
  crank: { hz: 2.2, zeta: 1 },
  foot: { hz: 2.6, zeta: 1, least: 0.04 },
  /** The legs' drive pedalling: the hips' bob (twice a turn) and sway
   * (once a turn), m, at full cadence (rpm). */
  pedal: { bob: 0.035, sway: 0.02, rpm: 90, low: 0.05 },
  /** His weight under the levers, past the key's own: down and back, m. */
  brake: { down: 0.05, back: 0.03 },
  /** How far each limb may be stretched toward its reach, a share of it. */
  reach: { leg: 0.97, arm: 0.96 },
  /** How close a hip may come to its ankle and a shoulder to its grip, m:
   * the knee and the elbow kept from folding past what a rider's do. */
  fold: { leg: 0.65, arm: 0.46, pedalling: 0.1 },
  /** A gap between readings past this, s, starts the body again at rest;
   * a step is cut into pieces no longer than `step`, s. */
  gap: 0.25,
  step: 1 / 120,
};

function v3(x: number, y: number, z: number): V3 {
  return { x, y, z };
}

const S = RIDER_SPRINGS;
const v = v3;
const add = (a: V3, b: V3): V3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: V3, b: V3): V3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const scale = (a: V3, k: number): V3 => v(a.x * k, a.y * k, a.z * k);
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: V3): number => Math.hypot(a.x, a.y, a.z);
const norm = (a: V3): V3 => {
  const l = len(a);
  return l > 1e-9 ? scale(a, 1 / l) : v(0, 1, 0);
};

/** A point mass on a spring: its offset or place, and its velocity. */
type Mass = { p: V3; u: V3 };
const mass = (p: V3): Mass => ({ p: { ...p }, u: v(0, 0, 0) });

/** One damped spring step of `m` toward `to`, semi-implicit Euler. */
function spring(m: Mass, to: V3, hz: number, zeta: number, dt: number): void {
  const w = 2 * Math.PI * hz;
  const k = w * w;
  const c = 2 * zeta * w;
  m.u.x += (k * (to.x - m.p.x) - c * m.u.x) * dt;
  m.u.y += (k * (to.y - m.p.y) - c * m.u.y) * dt;
  m.u.z += (k * (to.z - m.p.z) - c * m.u.z) * dt;
  m.p.x += m.u.x * dt;
  m.p.y += m.u.y * dt;
  m.p.z += m.u.z * dt;
}

/** The same for one number. */
type One = { p: number; u: number };
function spring1(m: One, to: number, hz: number, zeta: number, dt: number): void {
  const w = 2 * Math.PI * hz;
  m.u += (w * w * (to - m.p) - 2 * zeta * w * m.u) * dt;
  m.p += m.u * dt;
}

/** Kept inside `most` of the origin. */
function clampLen(p: V3, most: number): void {
  const l = len(p);
  if (l > most) {
    p.x *= most / l;
    p.y *= most / l;
    p.z *= most / l;
  }
}

/** THE BODY'S STATE, one a bike. */
export type RiderSprings = {
  /** The run's clock it was last stepped to, s (NaN: never). */
  t: number;
  /** The bike's velocity then, world m/s. */
  vel: V3;
  /** The hips' offset off the key's place, and the neck's off its rigid
   * place, in the bike's frame, m. */
  hips: Mass;
  neck: Mass;
  /** The engine rider's height on the frame, read slowly, m. */
  riderMean: number;
  /** The head's direction off the neck, the bike's frame (unit). */
  head: Mass;
  /** The knees' and elbows' points, the root's frame, m (null: unset). */
  knees: [Mass, Mass] | null;
  elbows: [Mass, Mass] | null;
  /** The cranks as drawn less the engine's, rad; the level the coasting
   * cranks are eased to (null pedalling). */
  crank: One;
  level: number | null;
  /** The bike's pitch as felt, rad; the trunk's bend, roll and twist as
   * sprung, rad (null: unset). */
  felt: One;
  feltRoll: One;
  angles: { pitch: One; roll: One; twist: One } | null;
  /** The foot out as put down, 0..1, and which. */
  foot: One;
  footSide: 0 | 1;
  /** How hard he pedals, 0..1 (his top knee folds deeper turning the
   * cranks). */
  pace: number;
  /** The bike pose read at the last step (for the points), and the clock
   * the limbs' points were last moved to, s. */
  pose: BikePose | null;
  limbT: number;
};

function fresh(): RiderSprings {
  return {
    t: Number.NaN,
    vel: v(0, 0, 0),
    hips: mass(v(0, 0, 0)),
    neck: mass(v(0, 0, 0)),
    riderMean: 0,
    head: mass(v(0, 1, 0)),
    knees: null,
    elbows: null,
    crank: { p: 0, u: 0 },
    level: null,
    felt: { p: 0, u: 0 },
    feltRoll: { p: 0, u: 0 },
    angles: null,
    foot: { p: 0, u: 0 },
    footSide: 0,
    pace: 0,
    pose: null,
    limbT: Number.NaN,
  };
}

const bodies = new WeakMap<BikeState, RiderSprings>();

/** THE BODY on bike `b`, stepped to the run's clock `t` (once a moment,
 * however many ask), its style `style` (the freerider's; none for the
 * trail look's rider). */
export function riderSpringsOf(b: BikeState, t: number, style?: RideStyle): RiderSprings {
  let sp = bodies.get(b);
  if (!sp) bodies.set(b, (sp = fresh()));
  stepSprings(sp, b, t, style);
  return sp;
}

/** THE CRANKS AS DRAWN: the engine's, eased level while he coasts. */
export function drawnCrank(sp: RiderSprings, b: BikeState): number {
  return b.crank + sp.crank.p;
}

/** THE BIKE'S POSE AS DRAWN: the engine's with the cranks as drawn. */
export function drawnPose(sp: RiderSprings, b: BikeState): BikePose {
  const pose = bikePose(b);
  pose.crank = drawnCrank(sp, b);
  return pose;
}

/** THE STYLE AS RIDDEN: the foot out eased (the rest as the style says). */
export function riddenStyle(sp: RiderSprings, style: RideStyle): RideStyle {
  return { ...style, footOut: sp.foot.p > S.foot.least ? sp.foot.p : 0, foot: sp.footSide };
}

/** The nearest level of the cranks to `crank`, rad: the pedals fore and
 * aft (`pedalsAt`: 0 or π). */
function levelOf(crank: number): number {
  return Math.round(crank / Math.PI) * Math.PI;
}

/** STEPS the body to `t`. */
function stepSprings(sp: RiderSprings, b: BikeState, t: number, style?: RideStyle): void {
  const dtAll = t - sp.t;
  const on = b.onIt && b.mode === "ridden";
  if (dtAll === 0) return;
  const pose = bikePose(b);
  const vel = v(b.vx, b.vy, b.vz);
  if (!on || !(dtAll > 0) || dtAll > S.gap) {
    // Begun again at rest: off the bike, a gap, or the clock run back.
    Object.assign(sp, fresh());
    sp.t = t;
    sp.vel = vel;
    sp.riderMean = pose.rider.y;
    sp.felt.p = pose.pitch;
    sp.feltRoll.p = pose.roll;
    sp.head = mass(headAim(b));
    if (!pose.pedalling) {
      sp.level = levelOf(b.crank);
      sp.crank.p = sp.level - b.crank;
    }
    sp.pose = pose;
    return;
  }
  // THE BIKE'S CHANGE OF VELOCITY, in its own frame: what the body feels
  // thrown by (a mass the bike is moved under keeps its velocity).
  const dv = unrotate(b.q, sub(vel, sp.vel));
  sp.vel = vel;
  const H = S.hips;
  const N = S.neck;
  sp.hips.u.x -= dv.x * H.gain.x;
  sp.hips.u.y -= dv.y * H.gain.y;
  sp.hips.u.z -= dv.z * H.gain.z;
  sp.neck.u.x -= dv.x * N.gain.x;
  sp.neck.u.y -= dv.y * N.gain.y;
  sp.neck.u.z -= dv.z * N.gain.z;
  // What the springs are drawn to this moment.
  const brake = style?.brake ?? 0;
  const pace = pose.pedalling ? Math.min(1, b.cadence / S.pedal.rpm) : 0;
  const crank = b.crank;
  const hipTo = v(
    S.pedal.sway * pace * Math.sin(crank),
    -S.pedal.bob * pace * Math.cos(2 * crank) - S.pedal.low * pace - S.brake.down * brake,
    -S.brake.back * brake,
  );
  // The foot out: put down or picked up, never switched; a foot asked on
  // the other side waits till this one is back on its pedal.
  const want = style?.footOut ?? 0;
  const side = style?.foot ?? sp.footSide;
  const footTo = side === sp.footSide ? want : 0;
  if (side !== sp.footSide && sp.foot.p < S.foot.least) sp.footSide = side;
  // The cranks: coasting, eased to the level nearest where they stopped;
  // pedalling, back onto the engine's.
  if (pose.pedalling) sp.level = null;
  else if (sp.level === null) sp.level = levelOf(drawnCrank(sp, b));
  const crankTo = sp.level === null ? 0 : sp.level - crank;
  const pieces = Math.max(1, Math.ceil(dtAll / S.step));
  const dt = dtAll / pieces;
  const aim = headAim(b);
  for (let i = 0; i < pieces; i++) {
    spring(sp.hips, hipTo, H.hz, H.zeta, dt);
    spring(sp.neck, v(0, 0, 0), N.hz, N.zeta, dt);
    spring(sp.head, aim, S.head.hz, S.head.zeta, dt);
    spring1(sp.crank, crankTo, S.crank.hz, S.crank.zeta, dt);
    spring1(sp.foot, footTo, S.foot.hz, S.foot.zeta, dt);
    spring1(sp.felt, pose.pitch, S.trunk.feltHz, S.trunk.feltZeta, dt);
    spring1(sp.feltRoll, pose.roll, S.trunk.feltHz, S.trunk.feltZeta, dt);
  }
  clampLen(sp.hips.p, H.most);
  clampLen(sp.neck.p, N.most);
  sp.foot.p = Math.max(0, Math.min(1, sp.foot.p));
  sp.riderMean += (pose.rider.y - sp.riderMean) * Math.min(1, dtAll / S.holdTau);
  sp.pace += (pace - sp.pace) * Math.min(1, dtAll / 0.3);
  sp.t = t;
  sp.pose = pose;
}

/** Where the head's gimbal aims, in the bike's frame: the world's up
 * (mostly) tipped forward toward the trail ahead. */
function headAim(b: BikeState): V3 {
  const up = unrotate(b.q, v(0, 1, 0));
  // The trail ahead: the bike's forward laid level in the world.
  const fwd = norm(sub(v(0, 0, 1), scale(up, up.z)));
  const lift = S.head.ahead;
  const world = norm(add(scale(up, Math.cos(lift)), scale(fwd, Math.sin(lift))));
  return world;
}

/** A two-bone reach from `root` toward `to` over `a` and `b`, the middle
 * joint bent toward `bend`: the middle joint and where the end gets to. */
function reach(root: V3, to: V3, a: number, b: number, bend: V3): [V3, V3] {
  const d0 = sub(to, root);
  const along = norm(d0);
  const d = Math.max(Math.abs(a - b) + 1e-3, Math.min(len(d0), (a + b) * 0.999));
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const off = sub(bend, scale(along, dot(bend, along)));
  const perp = len(off) < 1e-6 ? v(0, 0, 1) : norm(off);
  return [add(add(root, scale(along, x)), scale(perp, h)), add(root, scale(along, d))];
}

/** A point `p` kept between `least` and `most` of `from` (pulled straight
 * in or pushed straight out). */
function within(p: V3, from: V3, most: number, least = 0): V3 {
  const d = sub(p, from);
  const l = len(d);
  if (l > most) return add(from, scale(d, most / l));
  if (l < least && l > 1e-6) return add(from, scale(d, least / l));
  return p;
}

/** THE RIDER'S JOINTS on the sprung body (`RAGDOLL`'s order, the root's
 * frame — the bike's attitude about the engine's rider centre of mass),
 * laid off `key` (the stance asked, its hands and feet on the grips and
 * pedals as drawn). Moves the limbs' points on: call once a frame. */
export function springPoints(sp: RiderSprings, key: Key): number[] {
  const pose = sp.pose!;
  const dt = sp.t - sp.limbT;
  sp.limbT = sp.t;
  const L = S.reach;
  const legs = BODY.thigh + BODY.shin;
  const arms = BODY.upperArm + BODY.forearm;
  // THE HIPS: the key's place moved by the hips' spring, kept where both
  // feet reach their pedals.
  const sink = pose.rider.y - sp.riderMean;
  let hips = add(v(key.hipX, key.hipY + S.lift - (1 - S.follow) * sink, key.hipZ), sp.hips.p);
  for (let n = 0; n < 3; n++)
    for (const i of [0, 1] as const) {
      const hip = add(hips, v((i ? 1 : -1) * BODY.hip, 0, 0));
      const kept = within(hip, key.feet[i], legs * L.leg, S.fold.leg - S.fold.pedalling * sp.pace);
      hips = add(hips, sub(kept, hip));
    }
  // THE NECK: where the key's rigid trunk would put it, holding its height
  // against the engine's rider rising and sinking, moved by its spring.
  // THE TRUNK'S ATTITUDE: the key's, sprung, less the share of the bike's
  // pitch off what the body feels that it does not turn with.
  const T = S.trunk;
  const toPitch = key.pitch + T.hold * (pose.pitch - sp.felt.p);
  const toRoll = key.roll - T.holdRoll * (pose.roll - sp.feltRoll.p);
  if (!sp.angles || !(dt > 0 && dt <= S.gap))
    sp.angles = {
      pitch: { p: toPitch, u: 0 },
      roll: { p: toRoll, u: 0 },
      twist: { p: key.twist, u: 0 },
    };
  else {
    const pieces = Math.max(1, Math.ceil(dt / S.step));
    for (let n = 0; n < pieces; n++) {
      spring1(sp.angles.pitch, toPitch, T.hz, T.zeta, dt / pieces);
      spring1(sp.angles.roll, toRoll, T.hz, T.zeta, dt / pieces);
      spring1(sp.angles.twist, key.twist, T.hz, T.zeta, dt / pieces);
    }
  }
  const pitch = sp.angles.pitch.p;
  const roll = sp.angles.roll.p;
  const up0 = norm(v(Math.sin(roll), Math.cos(pitch) * Math.cos(roll), Math.sin(pitch)));
  let neck = add(add(hips, scale(up0, BODY.spine)), sp.neck.p);
  neck = add(neck, v(0, -S.hold * S.follow * sink, 0));
  const right0 = v(Math.cos(sp.angles.twist.p), 0, -Math.sin(sp.angles.twist.p));
  let up = up0;
  let right = right0;
  // A spine's length off the hips, the shoulders inside the arms' reach
  // of the grips (a few passes: each pulls a little of the other).
  for (let n = 0; n < 3; n++) {
    up = norm(sub(neck, hips));
    neck = add(hips, scale(up, BODY.spine));
    right = norm(sub(right0, scale(up, dot(right0, up))));
    for (const i of [0, 1] as const) {
      const sh = add(neck, scale(right, (i ? 1 : -1) * BODY.shoulder));
      const kept = within(sh, key.hands[i], arms * L.arm, S.fold.arm);
      neck = add(neck, sub(kept, sh));
    }
  }
  up = norm(sub(neck, hips));
  neck = add(hips, scale(up, BODY.spine));
  right = norm(sub(right0, scale(up, dot(right0, up))));
  const hipJ: [V3, V3] = [sub(hips, v(BODY.hip, 0, 0)), add(hips, v(BODY.hip, 0, 0))];
  const shoulders: [V3, V3] = [
    sub(neck, scale(right, BODY.shoulder)),
    add(neck, scale(right, BODY.shoulder)),
  ];
  // THE HEAD on its gimbal: the neck's column toward where it is aimed.
  const head = add(neck, scale(norm(sp.head.p), BODY.neck));
  const out: V3[] = new Array(R.count);
  out[R.hipL] = hipJ[0];
  out[R.hipR] = hipJ[1];
  out[R.shoulderL] = shoulders[0];
  out[R.shoulderR] = shoulders[1];
  out[R.head] = head;
  // THE LIMBS: each middle joint a point chasing its two-bone answer, the
  // limb then solved bent toward where that point is.
  const kneesOut = key.kneesOut ?? 0;
  const elbowsOut = key.elbowsOut ?? 0;
  const solve = (i: 0 | 1) => {
    const s = i ? 1 : -1;
    const knee0 = reach(
      hipJ[i],
      key.feet[i],
      BODY.thigh,
      BODY.shin,
      v(s * (0.15 + kneesOut), 0, 1),
    )[0];
    const elbow0 = reach(
      shoulders[i],
      key.hands[i],
      BODY.upperArm,
      BODY.forearm,
      v(s * (0.6 + elbowsOut), -0.4 + 0.5 * elbowsOut, -0.7),
    )[0];
    return { knee0, elbow0 };
  };
  const first = [solve(0), solve(1)];
  if (!sp.knees || !sp.elbows) {
    sp.knees = [mass(first[0].knee0), mass(first[1].knee0)];
    sp.elbows = [mass(first[0].elbow0), mass(first[1].elbow0)];
  } else if (dt > 0 && dt <= S.gap) {
    const pieces = Math.max(1, Math.ceil(dt / S.step));
    for (let n = 0; n < pieces; n++)
      for (const i of [0, 1] as const) {
        spring(sp.knees[i], first[i].knee0, S.limb.hz, S.limb.zeta, dt / pieces);
        spring(sp.elbows[i], first[i].elbow0, S.limb.hz, S.limb.zeta, dt / pieces);
      }
  }
  for (const i of [0, 1] as const) {
    const [knee, ankle] = reach(
      hipJ[i],
      key.feet[i],
      BODY.thigh,
      BODY.shin,
      sub(sp.knees![i].p, hipJ[i]),
    );
    out[i ? R.kneeR : R.kneeL] = knee;
    out[i ? R.footR : R.footL] = ankle;
    const [elbow, hand] = reach(
      shoulders[i],
      key.hands[i],
      BODY.upperArm,
      BODY.forearm,
      sub(sp.elbows![i].p, shoulders[i]),
    );
    out[i ? R.elbowR : R.elbowL] = elbow;
    out[i ? R.handR : R.handL] = hand;
  }
  const flat: number[] = [];
  for (const p of out) flat.push(p.x, p.y, p.z);
  return flat;
}
