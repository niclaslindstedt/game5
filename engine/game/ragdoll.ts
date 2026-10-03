// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RAGDOLL — the skier's body once he is off his skis (`crash.ts`).
//
// Thirteen POINTS — the two hips, the two shoulders, the head, the knees,
// the feet, the elbows, the hands — each with a mass and a radius
// (`TUNING.crash.body`), moved by Verlet (a point's velocity is where it is
// less where it was a step ago) under gravity, and held together by what a
// body is:
//   - the TORSO rigid — the hips, the shoulders and the head held at every
//     distance between them, so the trunk and the head move as one piece;
//   - the LIMBS two bones each at their own lengths, hung off the hips and
//     the shoulders, free to swing but not through what a joint allows: a
//     knee bends only forward and an elbow only back, neither folds tighter
//     than the calf against the thigh or the forearm against the arm, a
//     thigh goes only so far back or up, a leg only so far out or across,
//     an arm never folds its hand into its shoulder, and no limb passes
//     through the chest.
// A light point is moved more than a heavy one by a joint pulled long, so
// the trunk carries the limbs and not the other way round.
//
// THE MUSCLES — what separates a man falling from a sack falling (the
// "active ragdoll" of the games that do this well): every limb is driven
// toward a pose in the trunk's own frame by a damped spring. In the air it
// is the PROTECTIVE REFLEX, stiff and quick — the hands thrown out toward
// the snow he is about to meet, the knees drawn up — and once his trunk is
// down it gives way to the slack pose a body lies in. The muscles are
// INSIDE the body, so whatever push and twist the drive would put on the
// whole of it is taken straight back off: the limbs move against the trunk,
// the trunk against the limbs, and only the snow and the trunks can turn
// him (Jakobsen's Verlet body, with the pose drive of an active ragdoll
// held to the conservation laws a real one keeps).
//
// THE SNOW meets every point on its own — the thing that makes a ragdoll
// lie down: a point below the surface (settled into powder by `sink` at the
// run's snow dial) is put back on it, its way into it gone; along it,
// Coulomb friction on the weight it bears and on the arrival, harder in
// powder; and the PLOUGH, the powder a buried point has to shove, taking a
// share of its way every second in proportion to how deep the snow is. A
// body going over and over drags its arms and legs through the snow on
// every turn and is stopped by it; in deep powder, at once. A TRUNK meets
// every point too, pushed out of it along the line of centres.
//
// None of it draws from the stream and none of it is random: the body is a
// pure function of the moment it left the skis, so a run replays crash for
// crash and a ghost falls where the skier did.

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { rotate, type Quat, type Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { TUNING } from "./defs/tuning.ts";
import { treesNear } from "./collision.ts";
import { depthUnder, packedUnder } from "./snow.ts";
import type { GameState, Thrown } from "./state.ts";

const K = TUNING.crash;
const B = K.body;
const dt = TUNING.dt;

/** The body's points, in the order `Thrown.points` keeps them (x y z each). */
export const RAGDOLL = {
  hipL: 0,
  hipR: 1,
  shoulderL: 2,
  shoulderR: 3,
  head: 4,
  kneeL: 5,
  kneeR: 6,
  footL: 7,
  footR: 8,
  elbowL: 9,
  elbowR: 10,
  handL: 11,
  handR: 12,
  count: 13,
} as const;

const N = RAGDOLL.count;
const T = K.tone;
const M = B.mass;
const MASS: number[] = [
  M.hip,
  M.hip,
  M.shoulder,
  M.shoulder,
  M.head,
  M.knee,
  M.knee,
  M.foot,
  M.foot,
];
MASS.push(M.elbow, M.elbow, M.hand, M.hand);
const W = MASS.map((m) => 1 / m);
const TOTAL = MASS.reduce((a, m) => a + m, 0);
const RADIUS: number[] = [K.radius, K.radius, K.radius, K.radius, B.head];
for (let i = 5; i < N; i++) RADIUS.push(B.limb);

/** The torso and the head in the torso's own frame (x right, y up the
 * spine, z out of the chest; the origin between the hips). */
const TORSO: Vec3[] = [
  { x: -B.hip, y: 0, z: 0 },
  { x: B.hip, y: 0, z: 0 },
  { x: -B.shoulder, y: B.spine, z: 0 },
  { x: B.shoulder, y: B.spine, z: 0 },
  { x: 0, y: B.spine + B.neck, z: 0.02 },
];

/** Every distance the body holds: point, point, length. */
const LINKS: number[] = [];
for (let i = 0; i < TORSO.length; i++) {
  for (let j = i + 1; j < TORSO.length; j++) {
    const a = TORSO[i];
    const b = TORSO[j];
    LINKS.push(i, j, hypot3(a.x - b.x, a.y - b.y, a.z - b.z));
  }
}
const R = RAGDOLL;
LINKS.push(R.hipL, R.kneeL, B.thigh, R.hipR, R.kneeR, B.thigh);
LINKS.push(R.kneeL, R.footL, B.shin, R.kneeR, R.footR, B.shin);
LINKS.push(R.shoulderL, R.elbowL, B.upperArm, R.shoulderR, R.elbowR, B.upperArm);
LINKS.push(R.elbowL, R.handL, B.forearm, R.elbowR, R.handR, B.forearm);

/** The least distance from the hip to the ankle and from the shoulder to
 * the hand: the knee and the elbow folded as tight as they go. */
const folded = (a: number, b: number, least: number): number =>
  Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(least));
const KNEE_FOLD = folded(B.thigh, B.shin, K.kneeFold);
const ELBOW_FOLD = folded(B.upperArm, B.forearm, K.elbowFold);
/** A limb this share of its full reach or longer is straight, and its
 * hinge is left alone. */
const STRAIGHT = 0.97;
const TORSO_MASS = MASS.slice(0, 5).reduce((a, m) => a + m, 0);

/** The body as it stands on the skis, in the skier's frame (x right, y up,
 * z forward, the origin at the centre of gravity): the hips over the boots,
 * the trunk pitched forward over bent knees, the hands out ahead on the
 * poles and the feet in the bindings — where the figure is drawn at the
 * moment of the blow, near enough that the throw does not jump. */
const PITCH = 0.4;
const HIPS: Vec3 = { x: 0, y: -0.05, z: -0.06 };
const STANDING: Vec3[] = (() => {
  const c = Math.cos(PITCH);
  const s = Math.sin(PITCH);
  const out = TORSO.map((p) => ({
    x: HIPS.x + p.x,
    y: HIPS.y + p.y * c - p.z * s,
    z: HIPS.z + p.y * s + p.z * c,
  }));
  for (const side of [-1, 1]) out.push({ x: side * 0.16, y: -0.5, z: 0.12 });
  for (const side of [-1, 1]) out.push({ x: side * 0.15, y: -0.95, z: 0 });
  for (const side of [-1, 1]) out.push({ x: side * 0.32, y: 0.22, z: 0.18 });
  for (const side of [-1, 1]) out.push({ x: side * 0.3, y: 0.05, z: 0.45 });
  return out;
})();

/** Stand the body on the skis at `q`, (`x`, `y`, `z`), and send it off at
 * `v` m/s turning at `w` rad/s (world frame) about its centre of mass. */
export function throwBody(
  q: Quat,
  x: number,
  y: number,
  z: number,
  v: Vec3,
  w: Vec3,
): { points: number[]; last: number[] } {
  const points: number[] = [];
  for (const p of STANDING) {
    const r = rotate(q, p);
    points.push(x + r.x, y + r.y, z + r.z);
  }
  // Settle the joints to their lengths before anything moves.
  for (let k = 0; k < 16; k++) holdLinks(points);
  const com = centreOf(points);
  const last: number[] = [];
  for (let i = 0; i < N; i++) {
    const rx = points[3 * i] - com.x;
    const ry = points[3 * i + 1] - com.y;
    const rz = points[3 * i + 2] - com.z;
    last.push(
      points[3 * i] - (v.x + w.y * rz - w.z * ry) * dt,
      points[3 * i + 1] - (v.y + w.z * rx - w.x * rz) * dt,
      points[3 * i + 2] - (v.z + w.x * ry - w.y * rx) * dt,
    );
  }
  return { points, last };
}

/** The body's centre of mass. */
export function centreOf(p: readonly number[]): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < N; i++) {
    x += p[3 * i] * MASS[i];
    y += p[3 * i + 1] * MASS[i];
    z += p[3 * i + 2] * MASS[i];
  }
  return { x: x / TOTAL, y: y / TOTAL, z: z / TOTAL };
}

// Scratch, per point: the floor under it, its powder, the snow's normal,
// how far the snow has pushed it up this step and how fast it came in.
const floor = new Float64Array(N);
const soft = new Float64Array(N);
const packed = new Float64Array(N);
const pushed = new Float64Array(N);
const arrive = new Float64Array(N);
const nx = new Float64Array(N);
const ny = new Float64Array(N);
const nz = new Float64Array(N);
const n: Vec3 = { x: 0, y: 1, z: 0 };
const near: number[] = [];

/** One step of the body: gravity, the joints, the snow, the trunks. Keeps
 * `b`'s centre, velocity, tumble, `touching` and `still` up to date. */
export function stepRagdoll(state: GameState, b: Thrown): void {
  const level = state.level;
  const P = b.points;
  const L = b.last;
  const spine0 = spineOf(P);
  drive(P, L, b);
  const g = TUNING.g * dt * dt;
  for (let i = 0; i < 3 * N; i++) {
    const v = P[i] - L[i];
    L[i] = P[i];
    P[i] += v;
  }
  for (let i = 0; i < N; i++) P[3 * i + 1] -= g;
  // The snow under each point, read once a step: it moves a hand's width.
  const depth = depthUnder(state.snowDepth, state.fresh);
  for (let i = 0; i < N; i++) {
    const x = P[3 * i];
    const z = P[3 * i + 2];
    const p = packedUnder(level.packedAt(x, z), state.fresh);
    packed[i] = p;
    soft[i] = (1 - p) * depth;
    floor[i] = level.groundAt(x, z) - K.sink * soft[i] + RADIUS[i];
    level.normalAt(x, z, n);
    nx[i] = n.x;
    ny[i] = n.y;
    nz[i] = n.z;
    pushed[i] = 0;
    // The way into the snow it brings to this step, m/s — what the
    // arrival adds to the weight it bears.
    const j = 3 * i;
    arrive[i] = Math.max(
      0,
      -((P[j] - L[j]) * n.x + (P[j + 1] - L[j + 1]) * n.y + (P[j + 2] - L[j + 2]) * n.z) / dt,
    );
  }
  const com0 = centreOf(P);
  treesNear(level, com0.x, com0.z, 2, near);
  const lo = TUNING.bounds.margin;
  const hi = level.size - TUNING.bounds.margin;
  for (let k = 0; k < K.iterations; k++) {
    // The joints' limits first and the bones' lengths last, so a step ends
    // with every bone its own length — and the pair of them giving the
    // body no energy (`calm`).
    const before = internal(P, L);
    holdJoints(P, L);
    holdLinks(P);
    calm(P, L, before);
    for (let i = 0; i < N; i++) {
      const j = 3 * i;
      P[j] = clamp(P[j], lo, hi);
      P[j + 2] = clamp(P[j + 2], lo, hi);
      for (const t of near) {
        const tree = level.trees[t];
        if (P[j + 1] > tree.y + tree.height) continue;
        const dx = P[j] - tree.x;
        const dz = P[j + 2] - tree.z;
        const d = hypot(dx, dz) || 1e-6;
        const reach = RADIUS[i] + tree.radius;
        if (d >= reach) continue;
        P[j] = tree.x + (dx / d) * reach;
        P[j + 2] = tree.z + (dz / d) * reach;
      }
      if (P[j + 1] < floor[i]) {
        pushed[i] += floor[i] - P[j + 1];
        P[j + 1] = floor[i];
      }
    }
  }
  // Along the snow: what every point on it loses of its way.
  let touching = false;
  let planted = 0;
  // The way the snow takes off the body as a whole (`crash.patch`), m/s·kg.
  let lx = 0;
  let ly = 0;
  let lz = 0;
  for (let i = 0; i < N; i++) {
    const j = 3 * i;
    let vx = (P[j] - L[j]) / dt;
    let vy = (P[j + 1] - L[j + 1]) / dt;
    let vz = (P[j + 2] - L[j + 2]) / dt;
    if (pushed[i] > 0) {
      touching = true;
      planted |= 1 << i;
      // The way into the snow is gone — and the way OUT of it is the
      // push's own, never faster than `crash.pushOut`: a point put back on
      // the surface from under it is a position corrected, not a launch,
      // and a body thrown down in powder starts with its feet and knees
      // under the surface it is put back on.
      const un = vx * nx[i] + vy * ny[i] + vz * nz[i];
      const out = clamp(un, 0, K.pushOut) - un;
      vx += out * nx[i];
      vy += out * ny[i];
      vz += out * nz[i];
      const along = vx * nx[i] + vy * ny[i] + vz * nz[i];
      const tx = vx - along * nx[i];
      const ty = vy - along * ny[i];
      const tz = vz - along * nz[i];
      const slide = hypot3(tx, ty, tz);
      if (slide > 1e-9) {
        const mu = K.frictionPacked * packed[i] + K.frictionPowder * (1 - packed[i]);
        // Every point on the snow bears its own weight and its own arrival,
        // so a body sliding flat slows as one piece rather than being
        // twisted round by whichever point the joints happened to press.
        const coulomb = Math.min(slide, mu * Math.max(TUNING.g * ny[i] * dt, arrive[i]));
        const plough = (slide - coulomb) * Math.min(1, K.plough * soft[i] * dt);
        const s = (coulomb + plough) / slide;
        // The point keeps its own share of the loss; the rest is the
        // patch's, taken off every point alike below.
        const own = s * (1 - K.patch);
        const m = MASS[i] * s * K.patch;
        vx -= tx * own;
        vy -= ty * own;
        vz -= tz * own;
        lx += tx * m;
        ly += ty * m;
        lz += tz * m;
      }
      L[j] = P[j] - vx * dt;
      L[j + 1] = P[j + 1] - vy * dt;
      L[j + 2] = P[j + 2] - vz * dt;
    }
  }
  let fastest = 0;
  for (let i = 0; i < N; i++) {
    const j = 3 * i;
    L[j] += (lx / TOTAL) * dt;
    L[j + 1] += (ly / TOTAL) * dt;
    L[j + 2] += (lz / TOTAL) * dt;
    fastest = Math.max(fastest, hypot3(P[j] - L[j], P[j + 1] - L[j + 1], P[j + 2] - L[j + 2]) / dt);
  }
  // The body on the snow scrubs off his turning: the spin about his centre
  // of mass taken down by `spinDrag` a second once a trunk's weight of him is
  // in the snow — his back on it, or his limbs buried in powder — and by
  // its share of that before.
  let lying = 0;
  let buried = 0;
  for (let i = 0; i < N; i++) {
    if (pushed[i] <= 0) continue;
    lying += MASS[i];
    buried += MASS[i] * soft[i];
  }
  // ...and the deeper the powder he is in, the more: a body sunk in it is
  // held all round, `spinDrag` more a second per unit of depth.
  if (lying > 0) {
    const deep = buried / lying;
    lying = Math.min(1, lying / TORSO_MASS);
    scrub(P, L, Math.min(1, K.spinDrag * lying * (1 + deep) * dt));
  }
  const com = centreOf(P);
  const was = centreOf(L);
  b.x = com.x;
  b.y = com.y;
  b.z = com.z;
  b.vx = (com.x - was.x) / dt;
  b.vy = (com.y - was.y) / dt;
  b.vz = (com.z - was.z) / dt;
  const spine1 = spineOf(P);
  b.tumble += Math.acos(clamp(dot(spine0, spine1), -1, 1));
  b.touching = touching;
  b.planted = planted;
  // Down: the brace gives way from the step his trunk, or a trunk's weight
  // of him, meets the snow.
  if (b.down >= 0) b.down += dt;
  else if (
    lying >= 0.5 ||
    pushed[R.hipL] + pushed[R.hipR] + pushed[R.shoulderL] + pushed[R.shoulderR] + pushed[R.head] > 0
  )
    b.down = 0;
  b.still = touching && fastest < K.restSpeed ? b.still + dt : 0;
}

// The limbs the muscles drive, each off the trunk point it hangs from.
const LIMB = [R.kneeL, R.kneeR, R.footL, R.footR, R.elbowL, R.elbowR, R.handL, R.handR];
const ROOT = [R.hipL, R.hipR, R.hipL, R.hipR, R.shoulderL, R.shoulderR, R.shoulderL, R.shoulderR];
const dv = new Float64Array(3 * LIMB.length);
const aim: Vec3 = { x: 0, y: 0, z: 0 };
const bow: Vec3 = { x: 0, y: 0, z: 0 };
const pose = new Float64Array(3 * LIMB.length);

/** THE MUSCLES: every limb pulled toward its pose in the trunk's frame by
 * a damped spring — the brace in the air, giving way to the slack pose
 * once the trunk has come down (`crash.tone`) — as a change of velocity
 * (the last positions moved), with the push and the twist that change
 * would put on the body as a whole taken back off every point: the
 * muscles turn the limbs against the trunk and never the man. */
function drive(P: number[], L: number[], b: Thrown): void {
  const brace = b.down < 0 ? 1 : Math.exp(-T.relax * b.down);
  const w = T.lie + (T.brace - T.lie) * brace;
  const zeta = T.lieDamp + (T.braceDamp - T.lieDamp) * brace;
  const spring = Math.min(0.5, (w * dt) ** 2);
  const damp = Math.min(0.9, 2 * zeta * w * dt);
  frameOf(P);
  posePoints(brace);
  let px = 0;
  let py = 0;
  let pz = 0;
  for (let k = 0; k < LIMB.length; k++) {
    const i = 3 * LIMB[k];
    const r = 3 * ROOT[k];
    const q = 3 * k;
    // A limb planted in the snow yields: driven against it, a stiff arm
    // or leg is a lever he vaults himself over.
    if (b.planted & (1 << LIMB[k])) {
      dv[q] = dv[q + 1] = dv[q + 2] = 0;
      continue;
    }
    // The pose, from its root, in the world.
    const tx = P[r] + across.x * pose[q] + up.x * pose[q + 1] + chest.x * pose[q + 2];
    const ty = P[r + 1] + across.y * pose[q] + up.y * pose[q + 1] + chest.y * pose[q + 2];
    const tz = P[r + 2] + across.z * pose[q] + up.z * pose[q + 1] + chest.z * pose[q + 2];
    for (let a = 0; a < 3; a++) {
      const rel = P[i + a] - L[i + a] - (P[r + a] - L[r + a]);
      dv[q + a] = spring * ((a === 0 ? tx : a === 1 ? ty : tz) - P[i + a]) - damp * rel;
    }
    const m = MASS[LIMB[k]];
    px += m * dv[q];
    py += m * dv[q + 1];
    pz += m * dv[q + 2];
  }
  // The drive's push on the body as a whole, and its twist about the
  // centre of mass.
  const com = centreOf(P);
  let hx = 0;
  let hy = 0;
  let hz = 0;
  for (let k = 0; k < LIMB.length; k++) {
    const i = 3 * LIMB[k];
    const q = 3 * k;
    const m = MASS[LIMB[k]];
    const rx = P[i] - com.x;
    const ry = P[i + 1] - com.y;
    const rz = P[i + 2] - com.z;
    hx += m * (ry * dv[q + 2] - rz * dv[q + 1]);
    hy += m * (rz * dv[q] - rx * dv[q + 2]);
    hz += m * (rx * dv[q + 1] - ry * dv[q]);
    L[i] -= dv[q];
    L[i + 1] -= dv[q + 1];
    L[i + 2] -= dv[q + 2];
  }
  const spin = unturn(P, com, hx, hy, hz);
  for (let i = 0; i < N; i++) {
    const j = 3 * i;
    const rx = P[j] - com.x;
    const ry = P[j + 1] - com.y;
    const rz = P[j + 2] - com.z;
    L[j] += px / TOTAL + spin.y * rz - spin.z * ry;
    L[j + 1] += py / TOTAL + spin.z * rx - spin.x * rz;
    L[j + 2] += pz / TOTAL + spin.x * ry - spin.y * rx;
  }
}

/** Take `share` of the body's turning about its centre of mass away — a
 * rigid turn removed from every point's velocity, its way left alone. */
function scrub(P: number[], L: number[], share: number): void {
  const com = centreOf(P);
  let hx = 0;
  let hy = 0;
  let hz = 0;
  for (let i = 0; i < N; i++) {
    const j = 3 * i;
    const rx = P[j] - com.x;
    const ry = P[j + 1] - com.y;
    const rz = P[j + 2] - com.z;
    const vx = P[j] - L[j];
    const vy = P[j + 1] - L[j + 1];
    const vz = P[j + 2] - L[j + 2];
    hx += MASS[i] * (ry * vz - rz * vy);
    hy += MASS[i] * (rz * vx - rx * vz);
    hz += MASS[i] * (rx * vy - ry * vx);
  }
  const w = unturn(P, com, hx * share, hy * share, hz * share);
  for (let i = 0; i < N; i++) {
    const j = 3 * i;
    const rx = P[j] - com.x;
    const ry = P[j + 1] - com.y;
    const rz = P[j + 2] - com.z;
    L[j] += w.y * rz - w.z * ry;
    L[j + 1] += w.z * rx - w.x * rz;
    L[j + 2] += w.x * ry - w.y * rx;
  }
}

/** The turn, rad a step, that carries angular momentum (`hx`, `hy`, `hz`)
 * about `com` — the body's inertia about its centre of mass inverted. */
function unturn(P: number[], com: Vec3, hx: number, hy: number, hz: number): Vec3 {
  let xx = 0;
  let yy = 0;
  let zz = 0;
  let xy = 0;
  let xz = 0;
  let yz = 0;
  for (let i = 0; i < N; i++) {
    const j = 3 * i;
    const rx = P[j] - com.x;
    const ry = P[j + 1] - com.y;
    const rz = P[j + 2] - com.z;
    const m = MASS[i];
    xx += m * (ry * ry + rz * rz);
    yy += m * (rx * rx + rz * rz);
    zz += m * (rx * rx + ry * ry);
    xy -= m * rx * ry;
    xz -= m * rx * rz;
    yz -= m * ry * rz;
  }
  const c00 = yy * zz - yz * yz;
  const c01 = xz * yz - xy * zz;
  const c02 = xy * yz - xz * yy;
  const det = xx * c00 + xy * c01 + xz * c02;
  if (Math.abs(det) < 1e-12) return { x: 0, y: 0, z: 0 };
  const c11 = xx * zz - xz * xz;
  const c12 = xy * xz - xx * yz;
  const c22 = xx * yy - xy * xy;
  return {
    x: (c00 * hx + c01 * hy + c02 * hz) / det,
    y: (c01 * hx + c11 * hy + c12 * hz) / det,
    z: (c02 * hx + c12 * hy + c22 * hz) / det,
  };
}

/** The pose the muscles drive toward, into `pose` (per limb, off its root,
 * in the trunk's frame — x across to his right, y up the spine, z out of
 * the chest): `brace` of the way from the slack pose a body lies in to the
 * protective reflex. The brace is held in HIS frame, never chasing the
 * world's down: a pair of hands that kept reaching for the snow while he
 * turned would windmill, and every windmill turns the trunk the faster the
 * other way. */
function posePoints(brace: number): void {
  const arm = B.upperArm + B.forearm;
  for (let s = 0; s < 2; s++) {
    const side = s === 0 ? -1 : 1;
    // LEGS: the thigh off the spine's line by `hip`, the knee bent by
    // `knee`, splayed `out` — the brace spread and a little bent, never
    // tucked (a body that draws itself in spins up like a diver), the
    // slack all but straight.
    const hip = 0.15 + 0.15 * brace;
    const knee = 0.3 + 0.25 * brace;
    const out = 0.12 + 0.1 * brace;
    const kx = side * out * B.thigh;
    const ky = -Math.cos(hip) * B.thigh;
    const kz = Math.sin(hip) * B.thigh;
    set(0 + s, kx, ky, kz);
    set(
      2 + s,
      kx + side * out * B.shin,
      ky - Math.cos(hip - knee) * B.shin,
      kz + Math.sin(hip - knee) * B.shin,
    );
    // ARMS: the slack ones out at his sides along the snow; the brace's
    // thrown out ahead of him and wide, a little down — the hands put out
    // to meet the snow.
    const slack = 1 - brace;
    unit(
      aim,
      side * (0.55 * slack + 0.5 * brace),
      -0.8 * slack - 0.3 * brace,
      0.05 * slack + 0.8 * brace,
    );
    const h = (slack * 0.92 + brace * T.reach) * arm;
    set(6 + s, aim.x * h, aim.y * h, aim.z * h);
    // The elbow where the two bones put it, bowed back and out off the
    // line to the hand.
    const u = B.upperArm;
    const along = (u * u - B.forearm * B.forearm + h * h) / (2 * h);
    const off = Math.sqrt(Math.max(0, u * u - along * along));
    const bx = side * 0.4;
    const bz = -1;
    const ba = bx * aim.x + bz * aim.z;
    unit(bow, bx - ba * aim.x, -ba * aim.y, bz - ba * aim.z);
    set(
      4 + s,
      aim.x * along + bow.x * off,
      aim.y * along + bow.y * off,
      aim.z * along + bow.z * off,
    );
  }
}

function set(k: number, x: number, y: number, z: number): void {
  pose[3 * k] = x;
  pose[3 * k + 1] = y;
  pose[3 * k + 2] = z;
}

/** The body's kinetic energy about its centre of mass, J·kg⁻¹·step² (the
 * velocities are in m a step — only ever compared with itself). */
function internal(P: number[], L: number[]): number {
  const vc = velocityOf(P, L);
  let e = 0;
  for (let i = 0; i < N; i++) {
    const j = 3 * i;
    e +=
      MASS[i] *
      ((P[j] - L[j] - vc.x) ** 2 +
        (P[j + 1] - L[j + 1] - vc.y) ** 2 +
        (P[j + 2] - L[j + 2] - vc.z) ** 2);
  }
  return e / 2;
}

/** The centre of mass's velocity, m a step. */
function velocityOf(P: number[], L: number[]): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < N; i++) {
    const j = 3 * i;
    x += MASS[i] * (P[j] - L[j]);
    y += MASS[i] * (P[j + 1] - L[j + 1]);
    z += MASS[i] * (P[j + 2] - L[j + 2]);
  }
  return { x: x / TOTAL, y: y / TOTAL, z: z / TOTAL };
}

/** THE JOINTS GIVE THE BODY NO ENERGY. A joint's limit puts a point right
 * and carries no velocity, and the bones' lengths are then held with it —
 * so a big correction (a hand pushed out of the chest, a knee put back on
 * its hinge) is a kick of speed out of nowhere, and a body lying still was
 * thrown back up off the snow by one. Whatever a pass of them added to the
 * body's motion about its centre of mass, `before` of it going in, is
 * taken back off that motion, shared over it all; its way is left alone.
 * (The snow's push is not theirs, and is the snow's to keep in check —
 * `crash.pushOut`.) */
function calm(P: number[], L: number[], before: number): void {
  const after = internal(P, L);
  if (after <= before || after < 1e-12) return;
  const s = Math.sqrt(before / after);
  const vc = velocityOf(P, L);
  for (let i = 0; i < N; i++) {
    const j = 3 * i;
    L[j] = P[j] - (vc.x + (P[j] - L[j] - vc.x) * s);
    L[j + 1] = P[j + 1] - (vc.y + (P[j + 1] - L[j + 1] - vc.y) * s);
    L[j + 2] = P[j + 2] - (vc.z + (P[j + 2] - L[j + 2] - vc.z) * s);
  }
}

/** Every distance the body holds, each pulled back to its length — the
 * lighter end moved the more. */
function holdLinks(P: number[]): void {
  for (let k = 0; k < LINKS.length; k += 3) {
    const i = 3 * LINKS[k];
    const j = 3 * LINKS[k + 1];
    const dx = P[j] - P[i];
    const dy = P[j + 1] - P[i + 1];
    const dz = P[j + 2] - P[i + 2];
    const d = hypot3(dx, dy, dz) || 1e-9;
    const wi = W[LINKS[k]];
    const wj = W[LINKS[k + 1]];
    const s = (d - LINKS[k + 2]) / d / (wi + wj);
    P[i] += dx * s * wi;
    P[i + 1] += dy * s * wi;
    P[i + 2] += dz * s * wi;
    P[j] -= dx * s * wj;
    P[j + 1] -= dy * s * wj;
    P[j + 2] -= dz * s * wj;
  }
}

const across: Vec3 = { x: 1, y: 0, z: 0 };
const up: Vec3 = { x: 0, y: 1, z: 0 };
const chest: Vec3 = { x: 0, y: 0, z: 1 };
const bend: Vec3 = { x: 0, y: 0, z: 1 };
const fold: Vec3 = { x: 0, y: 0, z: 1 };

/** What the joints will not do: a knee bent backwards is folded forwards,
 * a thigh past its reach brought back inside it, a hand folded into its
 * shoulder pushed out. A LIMIT IS A POSITION PUT RIGHT AND NOTHING ELSE:
 * every point it moves has its last position moved with it, so the
 * correction carries no velocity — in Verlet a knee folded straight by a
 * hand's width in one step would otherwise be a hand's width a step of
 * speed, and a foot met fast on the snow threw the whole body half a
 * metre into the air off exactly that. */
function holdJoints(P: number[], L: number[]): void {
  frameOf(P);
  for (let s = 0; s < 2; s++) {
    const side = s === 0 ? -1 : 1;
    const hip = 3 * (R.hipL + s);
    const knee = 3 * (R.kneeL + s);
    const foot = 3 * (R.footL + s);
    // The knee bends forward only: one bent the other way, off the line
    // from the hip to the foot, is brought back onto it — measured against
    // the chest square to that line, so a leg raised along the chest is
    // never turned inside out — once the leg is bent at all: a leg all but
    // straight is a knee locked a few degrees past, as knees go, and a
    // hinge put right on it only fights the bones' lengths, each fight a
    // kick of speed out of nowhere.
    const lx = P[foot] - P[hip];
    const ly = P[foot + 1] - P[hip + 1];
    const lz = P[foot + 2] - P[hip + 2];
    const ll = lx * lx + ly * ly + lz * lz || 1e-9;
    const cl = (chest.x * lx + chest.y * ly + chest.z * lz) / ll;
    unit(bend, chest.x - cl * lx, chest.y - cl * ly, chest.z - cl * lz);
    const back =
      (P[knee] - (P[hip] + P[foot]) / 2) * bend.x +
      (P[knee + 1] - (P[hip + 1] + P[foot + 1]) / 2) * bend.y +
      (P[knee + 2] - (P[hip + 2] + P[foot + 2]) / 2) * bend.z;
    if (back < 0 && ll < (STRAIGHT * (B.thigh + B.shin)) ** 2)
      shift(P, L, R.kneeL + s, R.hipL + s, R.footL + s, bend, -back);
    // The thigh: not far behind the hip, not far above it, not splayed out
    // past the splits nor crossed far over the other leg.
    const tx = P[knee] - P[hip];
    const ty = P[knee + 1] - P[hip + 1];
    const tz = P[knee + 2] - P[hip + 2];
    const fore = tx * chest.x + ty * chest.y + tz * chest.z;
    if (fore < -K.hipBack * B.thigh)
      shift(P, L, knee / 3, hip / 3, -1, chest, -K.hipBack * B.thigh - fore);
    const rise = tx * up.x + ty * up.y + tz * up.z;
    if (rise > K.hipUp * B.thigh) shift(P, L, knee / 3, hip / 3, -1, up, K.hipUp * B.thigh - rise);
    const out = side * (tx * across.x + ty * across.y + tz * across.z);
    if (out > 0.75 * B.thigh)
      shift(P, L, knee / 3, hip / 3, -1, across, side * (0.75 * B.thigh - out));
    if (out < -0.25 * B.thigh)
      shift(P, L, knee / 3, hip / 3, -1, across, side * (-0.25 * B.thigh - out));
    // The knee folded no tighter than the calf against the thigh.
    const span = Math.sqrt(ll);
    if (span < KNEE_FOLD) {
      unit(fold, lx, ly, lz);
      shift(P, L, R.footL + s, R.hipL + s, -1, fold, KNEE_FOLD - span);
    }
    // The hand never folded into its shoulder, nor the forearm through the
    // upper arm.
    const shoulder = 3 * (R.shoulderL + s);
    const elbow = 3 * (R.elbowL + s);
    const hand = 3 * (R.handL + s);
    const hx = P[hand] - P[shoulder];
    const hy = P[hand + 1] - P[shoulder + 1];
    const hz = P[hand + 2] - P[shoulder + 2];
    const reach = hypot3(hx, hy, hz) || 1e-9;
    const least = Math.max(K.foldArm, ELBOW_FOLD);
    if (reach < least) {
      unit(fold, hx, hy, hz);
      shift(P, L, R.handL + s, R.shoulderL + s, -1, fold, least - reach);
    }
    // The elbow bends one way: it never points out ahead of the chest off
    // the line from the shoulder to the hand — the arm turns in its socket
    // far enough to point the elbow out, down, back or in, never forward.
    // Measured against the chest square to that line, and only where the
    // line leaves the chest a direction to be square in.
    const ch = (chest.x * hx + chest.y * hy + chest.z * hz) / (reach * reach);
    const sx = chest.x - ch * hx;
    const sy = chest.y - ch * hy;
    const sz = chest.z - ch * hz;
    if (sx * sx + sy * sy + sz * sz > 0.09) {
      unit(bend, sx, sy, sz);
      const ahead =
        (P[elbow] - (P[shoulder] + P[hand]) / 2) * bend.x +
        (P[elbow + 1] - (P[shoulder + 1] + P[hand + 1]) / 2) * bend.y +
        (P[elbow + 2] - (P[shoulder + 2] + P[hand + 2]) / 2) * bend.z;
      if (ahead > 0 && reach < STRAIGHT * (B.upperArm + B.forearm))
        shift(P, L, R.elbowL + s, R.shoulderL + s, R.handL + s, bend, -ahead);
    }
  }
  keepOut(P, L);
}

/** No limb through the chest: every point of the arms and the legs kept
 * `crash.torso` off the line of the spine, from between the hips to
 * between the shoulders — pushed out square to it, the trunk pushed back
 * as one piece by mass, and the closing velocity between them taken away
 * (an inelastic stop, as every joint's is). */
function keepOut(P: number[], L: number[]): void {
  const hl = 3 * R.hipL;
  const sl = 3 * R.shoulderL;
  const ax = (P[hl] + P[hl + 3]) / 2;
  const ay = (P[hl + 1] + P[hl + 4]) / 2;
  const az = (P[hl + 2] + P[hl + 5]) / 2;
  const sx = (P[sl] + P[sl + 3]) / 2 - ax;
  const sy = (P[sl + 1] + P[sl + 4]) / 2 - ay;
  const sz = (P[sl + 2] + P[sl + 5]) / 2 - az;
  const ss = sx * sx + sy * sy + sz * sz || 1e-9;
  for (let i = R.kneeL; i < N; i++) {
    const j = 3 * i;
    const t = clamp(((P[j] - ax) * sx + (P[j + 1] - ay) * sy + (P[j + 2] - az) * sz) / ss, 0, 1);
    const dx = P[j] - (ax + sx * t);
    const dy = P[j + 1] - (ay + sy * t);
    const dz = P[j + 2] - (az + sz * t);
    const d = hypot3(dx, dy, dz);
    if (d >= K.torso || d < 1e-6) continue;
    unit(fold, dx, dy, dz);
    const by = K.torso - d;
    const limb = (by * TORSO_MASS) / (MASS[i] + TORSO_MASS);
    const trunk = limb - by;
    // The closing speed, m a step: the limb's less the trunk's there.
    let vt = 0;
    for (let k = 0; k < 5; k++) {
      const q = 3 * k;
      vt +=
        (P[q] - L[q]) * fold.x + (P[q + 1] - L[q + 1]) * fold.y + (P[q + 2] - L[q + 2]) * fold.z;
    }
    const rel =
      (P[j] - L[j]) * fold.x +
      (P[j + 1] - L[j + 1]) * fold.y +
      (P[j + 2] - L[j + 2]) * fold.z -
      vt / 5;
    const into = Math.min(0, rel);
    const vl = (into * TORSO_MASS) / (MASS[i] + TORSO_MASS);
    move(P, L, i, fold, limb, limb + vl);
    for (let k = 0; k < 5; k++) move(P, L, k, fold, trunk, trunk - into + vl);
  }
}

/** Move point `i` by `by` m along `d`, its last position by `last` m. */
function move(P: number[], L: number[], i: number, d: Vec3, by: number, last: number): void {
  const j = 3 * i;
  P[j] += d.x * by;
  P[j + 1] += d.y * by;
  P[j + 2] += d.z * by;
  L[j] += d.x * last;
  L[j + 1] += d.y * last;
  L[j + 2] += d.z * last;
}

/** Move point `i` by `by` m along `d` against point `j` (and `k`, unless
 * -1) — the push shared by mass, so a joint's limit turns the body without
 * shoving it anywhere. A LIMIT IS AN INELASTIC STOP: the correction itself
 * carries no velocity (every last position moves with its point), and the
 * RELATIVE velocity across the joint that runs into the limit is taken
 * away, shared by mass the same way — so a limb meeting its stop is
 * stopped against the trunk, and the body's own way is left to it. */
function shift(
  P: number[],
  L: number[],
  i: number,
  j: number,
  k: number,
  d: Vec3,
  by: number,
): void {
  const wi = W[i];
  const wj = k < 0 ? W[j] : 1 / (MASS[j] + MASS[k]);
  const share = wi / (wi + wj);
  // The velocity across the joint along the push, m a step: the point's
  // less its partner's (the partners' mean, for two).
  const q = 3 * i;
  const r = 3 * j;
  const t = k < 0 ? r : 3 * k;
  const vi = (P[q] - L[q]) * d.x + (P[q + 1] - L[q + 1]) * d.y + (P[q + 2] - L[q + 2]) * d.z;
  const vj =
    ((P[r] - L[r]) * d.x +
      (P[r + 1] - L[r + 1]) * d.y +
      (P[r + 2] - L[r + 2]) * d.z +
      (P[t] - L[t]) * d.x +
      (P[t + 1] - L[t + 1]) * d.y +
      (P[t + 2] - L[t + 2]) * d.z) /
    2;
  const rel = vi - vj;
  const into = by > 0 ? Math.min(0, rel) : Math.max(0, rel);
  const a = by * share;
  const b = by - a;
  const va = into * share;
  const vb = into - va;
  for (const [p, m, v] of [
    [i, a, va],
    [j, -b, -vb],
    [k, -b, -vb],
  ]) {
    if (p < 0) continue;
    P[3 * p] += d.x * m;
    P[3 * p + 1] += d.y * m;
    P[3 * p + 2] += d.z * m;
    L[3 * p] += d.x * (m + v);
    L[3 * p + 1] += d.y * (m + v);
    L[3 * p + 2] += d.z * (m + v);
  }
}

/** The pelvis's frame into `across`, `up` and `chest` (x × y = z). */
function frameOf(P: number[]): void {
  const hl = 3 * R.hipL;
  const hr = 3 * R.hipR;
  const sl = 3 * R.shoulderL;
  const sr = 3 * R.shoulderR;
  unit(across, P[hr] - P[hl], P[hr + 1] - P[hl + 1], P[hr + 2] - P[hl + 2]);
  unit(
    up,
    (P[sl] + P[sr] - P[hl] - P[hr]) / 2,
    (P[sl + 1] + P[sr + 1] - P[hl + 1] - P[hr + 1]) / 2,
    (P[sl + 2] + P[sr + 2] - P[hl + 2] - P[hr + 2]) / 2,
  );
  unit(
    chest,
    across.y * up.z - across.z * up.y,
    across.z * up.x - across.x * up.z,
    across.x * up.y - across.y * up.x,
  );
}

function unit(out: Vec3, x: number, y: number, z: number): void {
  const l = hypot3(x, y, z) || 1;
  out.x = x / l;
  out.y = y / l;
  out.z = z / l;
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** The direction up his spine, from between the hips to between the
 * shoulders. */
function spineOf(P: readonly number[]): Vec3 {
  const hl = 3 * R.hipL;
  const sl = 3 * R.shoulderL;
  const out = { x: 0, y: 0, z: 0 };
  unit(
    out,
    P[sl] + P[sl + 3] - P[hl] - P[hl + 3],
    P[sl + 1] + P[sl + 4] - P[hl + 1] - P[hl + 4],
    P[sl + 2] + P[sl + 5] - P[hl + 2] - P[hl + 5],
  );
  return out;
}
