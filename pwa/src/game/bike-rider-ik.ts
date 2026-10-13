// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL RIDER SOLVED ON HIS BIKE — every joint of his body put where
// the bike as the engine has it (`bikePose`) and the rider's own body on its
// springs (`BikePose.rider`) say it must be, by inverse kinematics, every
// frame. Nothing here is a clip: the feet are on the pedals the cranks turn,
// the hands round the grips the bars steer, the hips where the engine's
// rider body has gone (back off a steep, down for a pop or a landing, fore
// to weight the front), and the trunk bent exactly as far as it takes for
// his arms to reach the bar with the elbows bent — so a bar pushed into a
// drop folds him over it and a bar pulled up on a manual stands him up.
//
// THE ATTACK STANCE as the coaching describes it (the class's research,
// `docs/downhill-bike.md`): knees and elbows bent and OUT — the rider's own
// suspension — heels dropped under the balls of the feet, hips back over
// the feet rather than the hands, chest low over the stem, the head up and
// looking down the trail. And the body held UPRIGHT while the bike lays
// over under it in a turn ("bike lean, body upright"), the outside foot
// weighted, the inside knee open to the turn.
//
// ON TOP of the engine's rider springs a little INERTIA the drawing adds
// (`createRiderDynamics`): the trunk and the hips lag the frame's own
// accelerations — a bump shoves the bike up into his legs, a landing folds
// them, the nose dropped into a hole leaves his chest a moment behind — and
// the head is held level against the frame's pitch and roll, eyes on the
// trail ahead.
//
// THE FRAME is the bike's body frame from the bottom bracket (x the engine's
// right, y up, z forward, metres), the frame `bike-look.ts` states the grips
// and pedals in. Side 0 is the body frame's −x. Three-free and DOM-free:
// `bike-rider-build.ts` hangs the drawn rider on it and the suite reads it.

import type { BikePose } from "@engine";

import { gripsAt, pedalsAt, BIKE_LOOK, type V3 } from "./bike-look.ts";
import { BODY } from "./skier-mounts.ts";
import { add, dot, len, mix, norm, scale, sub } from "./skier-vec.ts";

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const cross = (a: V3, b: V3): V3 =>
  v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

/** THE RIDER'S MEASURES, m — the game's own body (`BODY`, the ragdoll's), so
 * a crash hands him to the engine's ragdoll at the same lengths, and the
 * foot of a flat-pedal shoe. */
export const RIDER = {
  thigh: BODY.thigh,
  shin: BODY.shin,
  upperArm: BODY.upperArm,
  forearm: BODY.forearm,
  spine: BODY.spine,
  shoulder: 0.19,
  hip: BODY.hip,
  neck: BODY.neck,
  /** The shoe: the ankle over and behind the ball of the foot, the toe ahead
   * of it, the sole's thickness over the pedal's middle. */
  foot: { heel: 0.115, ankleUp: 0.075, toe: 0.085, sole: 0.03 },
};

/** THE STANCE'S NUMBERS. Each is the coaching's cue stated as geometry. */
export const STANCE = {
  /** The pelvis from the engine's rider centre of mass: down and back (the
   * body's mass sits in the chest over a bent-forward trunk). */
  pelvis: v(0, 0.13, -0.24),
  /** How much further back the pelvis goes per unit of the weight shifted
   * back (`BikePose.shift`), and forward per unit forward, m. */
  shiftBack: 0.06,
  shiftFore: 0.04,
  /** A CROUCH (a pop loaded, a landing taken): the hips further back, m,
   * and the arms bent further (the reach's share less), so the chest goes
   * down to the bar rather than the seat coming up under him. */
  crouchBack: 0.07,
  crouchReach: 0.12,
  /** THE ARMS: the shoulder-to-grip distance aimed at as a share of the arm
   * stretched straight — 0.86 is the elbows bent ~45°, the push-up's start. */
  reach: 0.86,
  /** The trunk's bend off the bike's vertical the solve may use, rad. */
  pitchMin: 0.35,
  pitchMax: 1.4,
  /** THE KNEES' and ELBOWS' poles: out to the side, forward (the knees) or
   * back and down (the elbows); the inside knee opened into a turn. */
  kneeOut: 0.32,
  kneeOpen: 0.9,
  elbowOut: 0.75,
  elbowBack: 0.55,
  elbowDown: 0.25,
  /** THE HEELS dropped under the balls of the feet, rad: always a little,
   * more folded for a pop, more again braking hard. */
  heel: 0.22,
  heelCrouch: 0.12,
  heelBrake: 0.16,
  /** The share of the bike's roll the trunk does NOT follow (the body held
   * upright over a bike laid over), and of its pitch the head undoes. */
  upright: 0.55,
  headLevel: 0.75,
  /** Where he looks: down the trail at this angle under the horizon, rad. */
  gaze: 0.2,
  /** The shoulders turned with the bars, rad of turn a rad of steer. */
  twist: 0.35,
  /** The outside foot weighted: the pelvis slid toward it per rad of lean. */
  weightOut: 0.05,
};

/** HIS JOINTS on the bike, in the bike's frame from the bottom bracket. The
 * pairs are side 0 (−x) first. `trunk` is the trunk's frame (right, up,
 * forward); `face` and `crown` the head's look and its up. */
export type RiderJoints = {
  pelvis: V3;
  hips: [V3, V3];
  knees: [V3, V3];
  ankles: [V3, V3];
  balls: [V3, V3];
  toes: [V3, V3];
  neck: V3;
  shoulders: [V3, V3];
  elbows: [V3, V3];
  hands: [V3, V3];
  head: V3;
  face: V3;
  crown: V3;
  trunk: { right: V3; up: V3; fwd: V3 };
};

/** THE DRAWING'S INERTIA a frame (`createRiderDynamics`): the pelvis's lag
 * off its place, m in the bike frame, and the trunk's pitch's, rad. */
export type RiderLag = { pelvis: V3; pitch: number };
export const NO_LAG: RiderLag = { pelvis: v(0, 0, 0), pitch: 0 };

/** A TWO-BONE LIMB from `root` toward `to`, bones `a` and `b` long, the
 * middle joint bent toward `pole`: the joint and the end (the end drawn in
 * to the limb's reach when `to` is past it). */
export function twoBone(root: V3, to: V3, a: number, b: number, pole: V3): [V3, V3] {
  const d0 = sub(to, root);
  const along = norm(d0);
  const d = clamp(len(d0), Math.abs(a - b) + 1e-3, (a + b) * 0.9995);
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  let off = sub(pole, scale(along, dot(pole, along)));
  if (len(off) < 1e-6) off = v(0, 1, 0);
  return [add(add(root, scale(along, x)), scale(norm(off), h)), add(root, scale(along, d))];
}

/** World up and the way ahead (level) seen in the bike's frame, off the
 * frame's attitude `q` (body → world). */
function levelOf(q: BikePose["q"]): { up: V3; ahead: V3 } {
  // q⁻¹ applied to world +y, and to the frame's own +z laid level.
  const un = (p: V3): V3 => {
    const { x, y, z, w } = q;
    // Rotate p by the conjugate (−x, −y, −z, w).
    const qx = -x;
    const qy = -y;
    const qz = -z;
    const tx = 2 * (qy * p.z - qz * p.y);
    const ty = 2 * (qz * p.x - qx * p.z);
    const tz = 2 * (qx * p.y - qy * p.x);
    return v(
      p.x + w * tx + (qy * tz - qz * ty),
      p.y + w * ty + (qz * tx - qx * tz),
      p.z + w * tz + (qx * ty - qy * tx),
    );
  };
  const up = un(v(0, 1, 0));
  const ahead = norm(sub(v(0, 0, 1), scale(up, up.z)));
  return { up, ahead };
}

/** THE FOOT on a pedal's middle `p`, the heel dropped `drop` rad: the ball
 * of the foot over the platform, the ankle up and back of it, the toe on. */
function footOn(p: V3, drop: number): { ball: V3; ankle: V3; toe: V3 } {
  const F = RIDER.foot;
  const ball = add(p, v(0, BIKE_LOOK.pedal.thick / 2 + F.sole * 0.5, 0.005));
  const fwd = v(0, Math.sin(drop), Math.cos(drop));
  const up = v(0, Math.cos(drop), -Math.sin(drop));
  return {
    ball,
    ankle: add(add(ball, scale(fwd, -F.heel)), scale(up, F.ankleUp)),
    toe: add(ball, scale(fwd, F.toe)),
  };
}

/** THE RIDER SOLVED on the bike posed `pose`, with the drawing's `lag`. */
export function solveRider(
  pose: BikePose,
  lag: RiderLag = NO_LAG,
  crank: number = pose.crank,
): RiderJoints {
  const S = STANCE;
  const R = RIDER;
  const level = levelOf(pose.q);
  const grips = gripsAt(pose.steer);
  const pedals = pedalsAt(crank);

  // THE FEET on the pedals, heels dropped.
  const brake = Math.max(pose.front, pose.rear);
  const drop = S.heel + S.heelCrouch * pose.crouch + S.heelBrake * brake;
  const feet = pedals.map((p) => footOn(p, drop));
  const ankles = feet.map((f) => f.ankle) as [V3, V3];

  // THE TRUNK'S AXES before its bend: across the bike, rolled back toward
  // the world's up by `upright` of the bike's roll (`level.up.x` is the
  // world's up leaning across the frame), turned with the bars.
  const across = clamp(level.up.x, -0.7, 0.7) * S.upright;
  const twist = -pose.steer * S.twist;
  const right0 = norm(v(Math.cos(twist), -across, -Math.sin(twist)));

  // THE PELVIS: where the engine's rider body is, moved by the shift and
  // the lag, slid toward the outside foot in a turn — and drawn down toward
  // the feet if the legs could not reach the pedals from it.
  const shift = pose.shift;
  let pelvis = add(
    add(pose.rider, S.pelvis),
    v(
      across * S.weightOut * 3,
      0,
      (shift > 0 ? -S.shiftBack * shift : -S.shiftFore * shift) - S.crouchBack * pose.crouch,
    ),
  );
  pelvis = add(pelvis, lag.pelvis);
  const legMost = (R.thigh + R.shin) * 0.975;
  for (let k = 0; k < 3; k++) {
    let worst = 0;
    for (const i of [0, 1]) {
      const hip = add(pelvis, scale(right0, (i ? 1 : -1) * R.hip));
      worst = Math.max(worst, len(sub(ankles[i], hip)) - legMost);
    }
    if (worst <= 0) break;
    const mid = scale(add(ankles[0], ankles[1]), 0.5);
    pelvis = add(pelvis, scale(norm(sub(mid, pelvis)), worst + 1e-3));
  }

  // THE TRUNK'S BEND, solved: the pitch at which the shoulders stand the
  // aimed reach from the grips (a bisection — the distance shrinks as the
  // trunk folds toward the bar).
  const armMost = R.upperArm + R.forearm;
  const want = armMost * (S.reach - S.crouchReach * pose.crouch);
  const trunkAt = (
    pitch: number,
  ): { up: V3; fwd: V3; right: V3; shoulders: [V3, V3]; neck: V3 } => {
    // The bend is about the trunk's own across axis, from the bike's up.
    const up = norm(add(scale(v(0, 1, 0), Math.cos(pitch)), scale(v(0, 0, 1), Math.sin(pitch))));
    const upR = norm(sub(up, scale(right0, dot(up, right0))));
    const right = norm(sub(right0, scale(upR, dot(right0, upR))));
    const fwd = cross(right, upR);
    const neck = add(pelvis, scale(upR, R.spine));
    const sh = add(add(neck, scale(upR, -BODY.shoulderDrop)), scale(fwd, BODY.shoulderFore));
    const shoulders: [V3, V3] = [
      add(sh, scale(right, -R.shoulder)),
      add(sh, scale(right, R.shoulder)),
    ];
    return { up: upR, fwd, right, shoulders, neck };
  };
  const gap = (pitch: number): number => {
    const t = trunkAt(pitch);
    return (len(sub(grips[0], t.shoulders[0])) + len(sub(grips[1], t.shoulders[1]))) / 2 - want;
  };
  let lo = S.pitchMin;
  let hi = S.pitchMax;
  let pitch: number;
  if (gap(lo) <= 0) pitch = lo;
  else if (gap(hi) >= 0) pitch = hi;
  else {
    for (let k = 0; k < 18; k++) {
      const m = (lo + hi) / 2;
      if (gap(m) > 0) lo = m;
      else hi = m;
    }
    pitch = (lo + hi) / 2;
  }
  pitch = clamp(pitch + lag.pitch, S.pitchMin, S.pitchMax);
  const trunk = trunkAt(pitch);

  // THE LEGS: hips off the pelvis, knees out and forward, the inside one
  // opened into the turn.
  const hips = [0, 1].map((i) => add(pelvis, scale(trunk.right, (i ? 1 : -1) * R.hip))) as [V3, V3];
  const knees: V3[] = [];
  const ankleAt: V3[] = [];
  for (const i of [0, 1]) {
    const side = i ? 1 : -1;
    // The bike laid over to its +x side (`across` < 0) has its +x leg inside.
    const inside = Math.max(0, -side * across);
    const pole = v(side * (S.kneeOut + S.kneeOpen * inside), 0.05, 1);
    const [k, a] = twoBone(hips[i], ankles[i], R.thigh, R.shin, pole);
    knees.push(k);
    ankleAt.push(a);
  }

  // THE ARMS: elbows out, back and down; the fists round the grips.
  const elbows: V3[] = [];
  const hands: V3[] = [];
  for (const i of [0, 1]) {
    const side = i ? 1 : -1;
    const pole = add(
      add(scale(trunk.right, side * S.elbowOut), scale(trunk.fwd, -S.elbowBack)),
      scale(trunk.up, -S.elbowDown),
    );
    const [e, h] = twoBone(trunk.shoulders[i], grips[i], R.upperArm, R.forearm, pole);
    elbows.push(e);
    hands.push(h);
  }

  // THE HEAD held up off the trunk toward the world's up, looking down the
  // trail under the horizon.
  const crown = norm(mix(trunk.up, level.up, S.headLevel));
  const lean = norm(add(scale(crown, 0.85), scale(trunk.fwd, 0.3)));
  const head = add(trunk.neck, scale(lean, R.neck));
  const look = norm(sub(scale(level.ahead, Math.cos(S.gaze)), scale(level.up, Math.sin(S.gaze))));
  const face = norm(sub(look, scale(crown, dot(look, crown))));

  return {
    pelvis,
    hips,
    knees: knees as [V3, V3],
    ankles: ankleAt as [V3, V3],
    balls: [feet[0].ball, feet[1].ball],
    toes: [feet[0].toe, feet[1].toe],
    neck: trunk.neck,
    shoulders: trunk.shoulders,
    elbows: elbows as [V3, V3],
    hands: hands as [V3, V3],
    head,
    face,
    crown,
    trunk: { right: trunk.right, up: trunk.up, fwd: trunk.fwd },
  };
}

/** THE DRAWING'S INERTIA: the pelvis on a damped spring against the frame's
 * own acceleration (in its frame, m/s², gravity left out) and the trunk's
 * pitch lagging the frame's pitch rate — stepped by the frame's `dt`. */
export const LAG = {
  /** The pelvis's spring, 1/s² and 1/s: about 1.8 Hz, near critically
   * damped — a body's legs, not a pogo stick. */
  stiff: 130,
  damp: 18,
  /** How far it may lag, m, and the trunk's pitch, rad. */
  most: 0.07,
  pitchMost: 0.12,
  /** The trunk's pitch lag per rad/s of the frame's pitch rate. */
  pitchRate: 0.035,
};

/** THE CRANKS AS DRAWN while he coasts: a rider ratchets them back to LEVEL
 * (the freewheel lets him), the leading foot as it stands, and holds them
 * there — the engine's own angle while he pedals. The ease's rate, 1/s. */
export const COAST_LEVEL = 6;

/** The level crank nearest `crank` (0 or π, mod 2π). */
export function levelCrank(crank: number): number {
  return Math.round(crank / Math.PI) * Math.PI;
}

export type RiderDynamics = {
  /** The cranks as drawn this frame: the engine's while he pedals, eased to
   * level while he coasts. */
  crank(pose: BikePose, dt: number): number;
  /** Step with the frame's acceleration `acc` and pitch rate `pitchRate`
   * (both in the bike's frame), `dt` s; the lag to solve with. */
  step(acc: V3, pitchRate: number, dt: number): RiderLag;
  reset(): void;
};

export function createRiderDynamics(): RiderDynamics {
  const p = v(0, 0, 0);
  const vel = v(0, 0, 0);
  let pitch = 0;
  const lag: RiderLag = { pelvis: p, pitch: 0 };
  let drawn: number | null = null;
  return {
    crank(pose, dt) {
      if (drawn === null || pose.pedalling) {
        drawn = pose.crank;
        return drawn;
      }
      // Wrap the drawn angle near the engine's, then ease it to level.
      drawn += Math.round((pose.crank - drawn) / (2 * Math.PI)) * 2 * Math.PI;
      const goal = levelCrank(drawn);
      drawn += (goal - drawn) * Math.min(1, clamp(dt, 0, 0.1) * COAST_LEVEL);
      return drawn;
    },
    step(acc, rate, dt) {
      const h = clamp(dt, 0, 1 / 30);
      for (const k of ["x", "y", "z"] as const) {
        // A body hung on springs in an accelerating frame feels −acc.
        const a = -LAG.stiff * p[k] - LAG.damp * vel[k] - acc[k] * 0.35;
        vel[k] += a * h;
        p[k] = clamp(p[k] + vel[k] * h, -LAG.most, LAG.most);
      }
      const goal = clamp(-rate * LAG.pitchRate, -LAG.pitchMost, LAG.pitchMost);
      pitch += (goal - pitch) * Math.min(1, h * 8);
      lag.pitch = pitch;
      return lag;
    },
    reset() {
      p.x = p.y = p.z = 0;
      vel.x = vel.y = vel.z = 0;
      pitch = 0;
      drawn = null;
    },
  };
}

/** THE SKELETON OFF THIRTEEN POINTS in the ragdoll's order (`RAGDOLL`: the
 * hips, the shoulders, the head, the knees, the feet — the ankles — the
 * elbows, the hands), any frame: the engine's ragdoll when he is thrown, a
 * walk's key when he pushes the bike. The feet are laid square to the shins
 * toward where his chest faces, the head looks where his chest does. */
export function jointsFromPoints(points: readonly number[]): RiderJoints {
  const at = (i: number): V3 => v(points[3 * i], points[3 * i + 1], points[3 * i + 2]);
  const hips: [V3, V3] = [at(0), at(1)];
  const shoulders: [V3, V3] = [at(2), at(3)];
  const pelvis = scale(add(hips[0], hips[1]), 0.5);
  const mid = scale(add(shoulders[0], shoulders[1]), 0.5);
  let up = norm(sub(mid, pelvis));
  const side = sub(shoulders[1], shoulders[0]);
  let right = sub(side, scale(up, dot(side, up)));
  right = len(right) < 1e-6 ? v(1, 0, 0) : norm(right);
  const fwd = cross(right, up);
  const neck = add(mid, scale(up, BODY.shoulderDrop));
  up = norm(sub(neck, pelvis));
  const knees: [V3, V3] = [at(5), at(6)];
  const ankles: [V3, V3] = [at(7), at(8)];
  const balls: V3[] = [];
  const toes: V3[] = [];
  for (const i of [0, 1]) {
    const shin = norm(sub(knees[i], ankles[i]));
    let ahead = sub(fwd, scale(shin, dot(fwd, shin)));
    ahead = len(ahead) < 1e-6 ? cross(right, shin) : norm(ahead);
    const ball = sub(
      add(ankles[i], scale(ahead, RIDER.foot.heel)),
      scale(shin, RIDER.foot.ankleUp),
    );
    balls.push(ball);
    toes.push(add(ball, scale(ahead, RIDER.foot.toe)));
  }
  const head = at(4);
  const crown = norm(sub(head, neck));
  const face = norm(sub(fwd, scale(crown, dot(fwd, crown))));
  return {
    pelvis,
    hips,
    knees,
    ankles,
    balls: balls as [V3, V3],
    toes: toes as [V3, V3],
    neck,
    shoulders,
    elbows: [at(9), at(10)],
    hands: [at(11), at(12)],
    head,
    face,
    crown,
    trunk: { right, up, fwd },
  };
}
