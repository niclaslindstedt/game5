// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HURT BY HIS OWN BIKE: the rider thrown off the downhill bike (`bike.ts`)
// and the bike he came off, lying and sliding together for the first
// seconds of the fall. Its parts — the two wheels, the chainring and the
// pedals, the bars and their ends, the frame's tubes — are SOLIDS his body's
// points meet: each point is pushed out of what it falls into, the bike is
// shoved by it in turn, and a point met hard takes a BLOW off steel
// (`body.ts`' `bikeBlows`). A touch may CATCH THE LIMB — a foot in a turning
// wheel's spokes, a shin on the ring's teeth, a hand hooked under the bars,
// a knee through the frame — and the caught limb is snatched to the part's
// speed (the YANK, which past a limb's ladder tears it off on a run with
// its INJURIES on — `gore.ts` reads the dose) and held to the bike a moment,
// the two dragging each other. At the throw itself the crash deals what a
// real one does (`dealtStrikes`): over the bars, a bar end in the belly, the
// stem in the groin, a foot kept on its pedal; laid down, the ring in the
// shin, the foot trapped under the frame.
//
// The numbers and their research are `defs/bike-tangle.ts`. Every chance is
// drawn off a hash of the run, the step and the point — never the stream —
// and a run with no bike never comes in here.

import { hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { hash2 } from "@niclaslindstedt/oss-game-framework/core/noise";
import { rotate, unrotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { BIKE } from "./defs/bike.ts";
import { BIKE_TANGLE } from "./defs/bike-tangle.ts";
import { TUNING } from "./defs/tuning.ts";
import { BB, REAR_AXLE, frontAxleAt, frontSpindle, type V3 } from "./bike-geometry.ts";
import { MASS, RAGDOLL, RADIUS } from "./ragdoll-points.ts";
import type { BikeCrash, BikePart, BikeState, BikeTangle } from "./bike-state.ts";
import type { GameEvent, GameState, Thrown } from "./state.ts";

const T = BIKE_TANGLE;
const R = RAGDOLL;
const dt = TUNING.dt;
const SALT = 0xb1ce7a9;
/** A draw off a hash of the run, the step, where the bike lies and `k` —
 * never the stream. */
function drawn(run: GameState, b: BikeState, k: number, salt: number): number {
  const at = (Math.floor(b.x * 997) * 31 + Math.floor(b.z * 991)) | 0;
  return hash2(run.tick ^ at, k, (run.seed ^ salt) | 0);
}

const PARTS: readonly BikePart[] = ["front", "rear", "ring", "bars", "stem", "frame"];

/** The frame's tubes, body frame from the bike's centre of mass, m: the
 * down tube, the seat tube, the top tube, the chain stays, the seat stays
 * and the fork (its lower end swung with the bars, set each step). */
const HEAD: V3 = { x: 0, y: T.head.y, z: T.head.z };
const SEAT: V3 = { x: 0, y: T.seat.y, z: T.seat.z };
const FORK: V3 = { x: 0, y: 0, z: 0 };
const TUBES: readonly [V3, V3][] = [
  [BB, HEAD],
  [BB, SEAT],
  [HEAD, SEAT],
  [BB, REAR_AXLE],
  [SEAT, REAR_AXLE],
  [HEAD, FORK],
];
const RING: V3 = { x: BB.x + T.ring.x, y: BB.y, z: BB.z };
const BAR_L: V3 = { x: -T.bars.half, y: T.bars.y, z: T.bars.z };
const BAR_R: V3 = { x: T.bars.half, y: T.bars.y, z: T.bars.z };
const STEM: V3 = { x: 0, y: T.bars.y, z: T.bars.z };

/** A fresh tangle, the points that lie in the bike already left be. */
export function freshTangle(b: BikeState, off: Thrown): BikeTangle {
  const t: BikeTangle = {
    snag: null,
    cool: new Array<number>(R.count).fill(0),
    ignore: 0,
    blows: [],
    dealt: [],
    t: 0,
  };
  setFrame(b);
  for (let i = 0; i < R.count; i++) if (nearest(b, off.points, i)) t.ignore |= 1 << i;
  return t;
}

// ---- the bike's parts in its own frame ------------------------------------

const frontC: V3 = { x: 0, y: 0, z: 0 };
const frontN: V3 = { x: 1, y: 0, z: 0 };
const REAR_N: V3 = { x: 1, y: 0, z: 0 };

/** The parts that move with the bars, for this step. */
function setFrame(b: BikeState): void {
  frontAxleAt(b.steer, 0, frontC);
  frontSpindle(b.steer, frontN);
  FORK.x = frontC.x;
  FORK.y = frontC.y;
  FORK.z = frontC.z;
}

/** The nearest part to a point: which, the gap from its surface less the
 * point's radius, m (negative inside), its surface point and the way out
 * toward the point (body frame), and whether a bar end. */
type Hit = { part: BikePart; gap: number; at: V3; n: V3; end: boolean; wheel: number };
const hit: Hit = {
  part: "frame",
  gap: 0,
  at: { x: 0, y: 0, z: 0 },
  n: { x: 0, y: 1, z: 0 },
  end: false,
  wheel: -1,
};
const local: V3 = { x: 0, y: 0, z: 0 };
const tmp: V3 = { x: 0, y: 0, z: 0 };

/** The point `i` of `P` against the bike: true, with `hit` filled, when it
 * touches a part. */
function nearest(b: BikeState, P: readonly number[], i: number): boolean {
  const w = { x: P[3 * i] - b.x, y: P[3 * i + 1] - b.y, z: P[3 * i + 2] - b.z };
  const p = unrotate(b.q, w);
  local.x = p.x;
  local.y = p.y;
  local.z = p.z;
  const r = RADIUS[i];
  hit.gap = Infinity;
  disc(local, frontC, frontN, BIKE.front.radius, "front", 0, r);
  disc(local, REAR_AXLE, REAR_N, BIKE.rear.radius, "rear", 1, r);
  ball(local, RING, T.ring.reach, "ring", r);
  for (const [a, c] of TUBES) segment(local, a, c, T.tube, "frame", r, false);
  segment(local, BAR_L, BAR_R, T.bars.radius, "bars", r, true);
  segment(local, STEM, HEAD, T.tube, "stem", r, false);
  return hit.gap < 0;
}

function take(part: BikePart, gap: number, ax: number, ay: number, az: number, p: V3, wheel = -1) {
  if (gap >= hit.gap) return false;
  let nx = p.x - ax;
  let ny = p.y - ay;
  let nz = p.z - az;
  const d = hypot3(nx, ny, nz);
  if (d > 1e-6) {
    nx /= d;
    ny /= d;
    nz /= d;
  } else {
    nx = 0;
    ny = 1;
    nz = 0;
  }
  hit.part = part;
  hit.gap = gap;
  hit.at.x = ax;
  hit.at.y = ay;
  hit.at.z = az;
  hit.n.x = nx;
  hit.n.y = ny;
  hit.n.z = nz;
  hit.end = false;
  hit.wheel = wheel;
  return true;
}

/** A wheel: a disc of radius `R` about `c`, square to `n`, `T.wheel.half`
 * thick at the tyre. */
function disc(p: V3, c: V3, n: V3, rad: number, part: BikePart, wheel: number, r: number): void {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const dz = p.z - c.z;
  const a = dx * n.x + dy * n.y + dz * n.z;
  const rx = dx - a * n.x;
  const ry = dy - a * n.y;
  const rz = dz - a * n.z;
  const rr = hypot3(rx, ry, rz);
  const s = rr > rad ? rad / rr : 1;
  const ax = c.x + rx * s;
  const ay = c.y + ry * s;
  const az = c.z + rz * s;
  const d = hypot3(p.x - ax, p.y - ay, p.z - az);
  if (take(part, d - T.wheel.half - r, ax, ay, az, p, wheel) && d < 1e-6) {
    hit.n.x = n.x;
    hit.n.y = n.y;
    hit.n.z = n.z;
  }
}

function ball(p: V3, c: V3, rad: number, part: BikePart, r: number): void {
  take(part, hypot3(p.x - c.x, p.y - c.y, p.z - c.z) - rad - r, c.x, c.y, c.z, p);
}

function segment(p: V3, a: V3, c: V3, rad: number, part: BikePart, r: number, bar: boolean) {
  const ex = c.x - a.x;
  const ey = c.y - a.y;
  const ez = c.z - a.z;
  const ll = ex * ex + ey * ey + ez * ez;
  const u =
    ll > 0
      ? Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey + (p.z - a.z) * ez) / ll))
      : 0;
  const ax = a.x + ex * u;
  const ay = a.y + ey * u;
  const az = a.z + ez * u;
  if (!take(part, hypot3(p.x - ax, p.y - ay, p.z - az) - rad - r, ax, ay, az, p)) return;
  if (bar) hit.end = Math.min(u, 1 - u) * 2 * T.bars.half < T.bars.end;
}

// ---- a step ---------------------------------------------------------------

/** The velocity of a point of the bike at `at` (body frame), world, m/s:
 * the bike's own, and on a wheel its rim's turn. */
function partVelocity(b: BikeState, at: V3, out: V3): V3 {
  out.x = b.vx;
  out.y = b.vy;
  out.z = b.vz;
  if (hit.wheel < 0) return out;
  const c = hit.wheel === 0 ? frontC : REAR_AXLE;
  const n = hit.wheel === 0 ? frontN : REAR_N;
  const spin = hit.wheel === 0 ? b.front.spin : b.rear.spin;
  const rx = at.x - c.x;
  const ry = at.y - c.y;
  const rz = at.z - c.z;
  // ω × r, ω along the axle.
  tmp.x = spin * (n.y * rz - n.z * ry);
  tmp.y = spin * (n.z * rx - n.x * rz);
  tmp.z = spin * (n.x * ry - n.y * rx);
  const t = rotate(b.q, tmp);
  out.x += t.x;
  out.y += t.y;
  out.z += t.z;
  return out;
}

/** The rim's speed of a wheel, m/s. */
function rimSpeed(b: BikeState, wheel: number): number {
  return wheel === 0
    ? Math.abs(b.front.spin) * BIKE.front.radius
    : Math.abs(b.rear.spin) * BIKE.rear.radius;
}

/** Whether point `i` can be caught by `part`: a limb by any of them, the
 * head by the bars or the frame alone. */
function catchable(i: number, part: BikePart): boolean {
  if (i === R.head) return part === "bars" || part === "frame" || part === "stem";
  return i >= R.kneeL;
}

const vp: V3 = { x: 0, y: 0, z: 0 };
const vb: V3 = { x: 0, y: 0, z: 0 };

/** ONE STEP OF THE TANGLE, before the loose bike's own (`bike.ts`) and
 * the ragdoll's: the held limb dragged with the bike, every point
 * kept out of the bike's parts, the blows and the catches. */
export function stepTangle(run: GameState, b: BikeState, events: GameEvent[]): void {
  const t = b.tangle;
  const off = run.skier.thrown;
  if (!t || !off) return;
  t.t += dt;
  t.blows.length = 0;
  for (const d of t.dealt) t.blows.push(d);
  t.dealt.length = 0;
  if (t.t > T.window) {
    t.snag = null;
    return;
  }
  setFrame(b);
  const P = off.points;
  const L = off.last;
  const mBike = BIKE.mass;
  // THE HELD LIMB: the body's pull on it moves the bike, and the limb is
  // set back on its part, going the bike's way.
  const s = t.snag;
  if (s) {
    const i = s.point;
    let a = rotate(b.q, s);
    const gx = P[3 * i] - (b.x + a.x);
    const gz = P[3 * i + 2] - (b.z + a.z);
    // Only its velocity, the bike brought up to the pace that closes the
    // gap (no faster than `towMost`): the bike's own step moves it, and
    // keeps it out of what it lies against.
    const gap = hypot(gx, gz);
    if (gap > 1e-6) {
      const want = Math.min((gap * T.tow) / dt, T.towMost);
      const along = (b.vx * gx + b.vz * gz) / gap;
      if (along < want) {
        b.vx += ((want - along) * gx) / gap;
        b.vz += ((want - along) * gz) / gap;
      }
    }
    a = rotate(b.q, s);
    P[3 * i] = b.x + a.x;
    P[3 * i + 1] = b.y + a.y;
    P[3 * i + 2] = b.z + a.z;
    L[3 * i] = P[3 * i] - b.vx * dt;
    L[3 * i + 1] = P[3 * i + 1] - b.vy * dt;
    L[3 * i + 2] = P[3 * i + 2] - b.vz * dt;
    s.left -= dt;
    if (s.left <= 0) {
      t.snag = null;
      t.cool[i] = T.free;
      t.ignore |= 1 << i;
    }
  }
  for (let i = 0; i < R.count; i++) {
    if (t.cool[i] > 0) t.cool[i] -= dt;
    if (t.snag && t.snag.point === i) continue;
    if (!nearest(b, P, i)) {
      t.ignore &= ~(1 << i);
      continue;
    }
    if (t.ignore & (1 << i)) continue;
    const n = rotate(b.q, hit.n);
    vp.x = (P[3 * i] - L[3 * i]) / dt;
    vp.y = (P[3 * i + 1] - L[3 * i + 1]) / dt;
    vp.z = (P[3 * i + 2] - L[3 * i + 2]) / dt;
    partVelocity(b, hit.at, vb);
    const rx = vp.x - vb.x;
    const ry = vp.y - vb.y;
    const rz = vp.z - vb.z;
    const close = -(rx * n.x + ry * n.y + rz * n.z);
    // Out of the part, its way into it gone.
    const pen = -hit.gap;
    P[3 * i] += n.x * pen;
    P[3 * i + 1] += n.y * pen;
    P[3 * i + 2] += n.z * pen;
    if (close > 0) {
      vp.x += n.x * close;
      vp.y += n.y * close;
      vp.z += n.z * close;
      // A blow shoves the bike (a body lying on it only presses it into
      // the ground, which holds it).
      if (close >= T.touch) {
        const share = (MASS[i] / (MASS[i] + mBike)) * T.shove;
        b.vx -= n.x * close * share;
        b.vz -= n.z * close * share;
      }
    }
    L[3 * i] = P[3 * i] - vp.x * dt;
    L[3 * i + 1] = P[3 * i + 1] - vp.y * dt;
    L[3 * i + 2] = P[3 * i + 2] - vp.z * dt;
    if (close < T.touch || t.cool[i] > 0) continue;
    t.cool[i] = T.cool;
    const trunk = i <= R.shoulderR;
    t.blows.push({
      point: i,
      v: hit.part === "ring" ? close * T.teeth : close,
      part: hit.part,
      kind: hit.end && trunk ? "spear" : "touch",
      nx: n.x,
      ny: n.y,
      nz: n.z,
    });
    // THE CATCH.
    if (t.snag || close < T.catchAt || !catchable(i, hit.part)) continue;
    const wheel = hit.wheel;
    if (wheel >= 0 && rimSpeed(b, wheel) < T.spin) continue;
    const chance =
      wheel >= 0
        ? T.catch.wheel
        : hit.part === "ring"
          ? T.catch.ring
          : hit.part === "frame"
            ? T.catch.frame
            : T.catch.bars;
    const u = drawn(run, b, i * 8 + PARTS.indexOf(hit.part), SALT);
    if (u >= chance) continue;
    const yank = hypot3(rx, ry, rz);
    snagOn(run, b, t, i, hit.part, hit.at, yank, events);
    if (wheel === 0) b.front.spin = 0;
    else if (wheel === 1) b.rear.spin = 0;
  }
}

/** Point `i` caught on `part` at `at` (body frame), snatched at `yank`
 * m/s: held, and the yank's blow. */
function snagOn(
  run: GameState,
  b: BikeState,
  t: BikeTangle,
  i: number,
  part: BikePart,
  at: V3,
  yank: number,
  events: GameEvent[],
): void {
  const u = drawn(run, b, i, SALT + 1);
  t.snag = {
    point: i,
    part,
    x: at.x,
    y: at.y,
    z: at.z,
    left: T.hold.least + (T.hold.most - T.hold.least) * u,
  };
  t.blows.push({ point: i, v: yank, part, kind: "yank", nx: 0, ny: 1, nz: 0 });
  events.push({
    kind: "bike",
    t: run.t,
    phase: "snag",
    part,
    x: b.x,
    y: b.y,
    z: b.z,
    speed: yank,
  });
}

// ---- at the throw -----------------------------------------------------------

/** WHAT THE CRASH DEALS AT THE THROW, `how` at `speed` m/s (the rider's
 * over the ground: the bike under him stops dead or goes down): onto the tangle's first step, and a foot held on the
 * bike from the start. */
export function dealtStrikes(
  run: GameState,
  b: BikeState,
  how: BikeCrash,
  speed: number,
  events: GameEvent[],
): void {
  const t = b.tangle;
  if (!t || speed < T.least) return;
  const draw = (k: number): number => drawn(run, b, k, SALT + 2);
  const struck = (part: BikePart): void => {
    events.push({ kind: "bike", t: run.t, phase: "struck", part, x: b.x, y: b.y, z: b.z, speed });
  };
  const fwd = { x: Math.sin(b.heading), y: 0, z: Math.cos(b.heading) };
  // The way out of the bike toward him: back along the bike, at him.
  const back = { nx: -fwd.x, ny: 0, nz: -fwd.z };
  const foot = draw(9) < 0.5 ? R.footL : R.footR;
  if (how === "bars" || how === "hit" || how === "landing") {
    const O = T.over;
    if (draw(1) < O.barEnd.chance) {
      t.dealt.push({
        point: R.hipL,
        v: speed * O.barEnd.share,
        part: "bars",
        kind: "spear",
        ...back,
      });
      struck("bars");
    } else if (draw(2) < O.stem.chance) {
      t.dealt.push({
        point: R.hipR,
        v: speed * O.stem.share,
        part: "stem",
        kind: "groin",
        ...back,
      });
      struck("stem");
    }
    if (draw(3) < O.pedal.chance) hold(run, b, t, foot, "ring", RING, events);
    // Over the front: a hand or a foot through the front wheel's spokes.
    else if (draw(6) < T.spokes.chance) {
      const limb = draw(7) < T.spokes.hand ? (draw(8) < 0.5 ? R.handL : R.handR) : foot;
      caught(
        run,
        b,
        t,
        limb,
        "front",
        frontAxleAt(b.steer, 0, { x: 0, y: 0, z: 0 }),
        speed,
        events,
      );
    }
  } else if (how === "lowside" || how === "washout") {
    const L = T.laid;
    // The leg under the drive side: the knee's point over the ring.
    if (draw(4) < L.ring.chance) {
      const knee = foot === R.footL ? R.kneeL : R.kneeR;
      t.dealt.push({
        point: knee,
        v: speed * L.ring.share * T.teeth,
        part: "ring",
        kind: "touch",
        nx: 0,
        ny: 1,
        nz: 0,
      });
      struck("ring");
    }
    if (draw(5) < L.trapped.chance) {
      const mid = {
        x: (BB.x + REAR_AXLE.x) / 2,
        y: (BB.y + REAR_AXLE.y) / 2,
        z: (BB.z + REAR_AXLE.z) / 2,
      };
      hold(run, b, t, foot, "frame", mid, events);
    } else if (draw(6) < T.spokes.chance) {
      // Laid down on it: the foot under him into the rear wheel's spokes.
      caught(run, b, t, foot, "rear", REAR_AXLE, speed, events);
    }
  }
}

/** A limb CAUGHT IN A WHEEL at the throw, the wheel still turning at the
 * crash's `speed`: snatched to it (`T.spokes.share` of it, the yank's blow
 * on the tangle's first step), held, and the wheel stopped dead. */
function caught(
  run: GameState,
  b: BikeState,
  t: BikeTangle,
  i: number,
  part: "front" | "rear",
  at: V3,
  speed: number,
  events: GameEvent[],
): void {
  const yank = speed * T.spokes.share;
  const u = drawn(run, b, i, SALT + 4);
  t.snag = {
    point: i,
    part,
    x: at.x,
    y: at.y,
    z: at.z,
    left: T.hold.least + (T.hold.most - T.hold.least) * u,
  };
  t.ignore &= ~(1 << i);
  t.dealt.push({ point: i, v: yank, part, kind: "yank", nx: 0, ny: 1, nz: 0 });
  if (part === "front") b.front.spin = 0;
  else b.rear.spin = 0;
  events.push({ kind: "bike", t: run.t, phase: "snag", part, x: b.x, y: b.y, z: b.z, speed: yank });
}

/** A foot held on the bike from the throw: no yank (it went with it), only
 * the hold. */
function hold(
  run: GameState,
  b: BikeState,
  t: BikeTangle,
  i: number,
  part: BikePart,
  at: V3,
  events: GameEvent[],
): void {
  const u = drawn(run, b, i, SALT + 3);
  t.snag = {
    point: i,
    part,
    x: at.x,
    y: at.y,
    z: at.z,
    left: T.hold.least + (T.hold.most - T.hold.least) * u,
  };
  t.ignore &= ~(1 << i);
  events.push({ kind: "bike", t: run.t, phase: "snag", part, x: b.x, y: b.y, z: b.z, speed: 0 });
}
