// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FALL, AS A PROFESSIONAL RIDES IT — what a skier's body does in the
// air, by HOW FAR he is falling. Kept by the view between frames
// (`skier-spring.ts` steps it, `skier-pose.ts` lays it on), three-free so
// the suite reads it; presentation only — the engine's flight is the
// engine's.
//
// Freeride coaching and film of skiers dropping cliffs agree on a sequence
// a good skier rides through, and on how much of it a drop gets to:
//
//   * SET (the first few tenths of any flight): compact, the knees drawn
//     up under him, the hands forward where he can see them and the upper
//     body quiet — a kicker on the piste is over before he does more.
//   * SPOT (a drop worth the name, and every height past it): opened out
//     for the balance, the hands forward and wider at chest height, the
//     chest over the knees, the head down on the landing he is spotting —
//     and STILL. However long the fall, the arms are never circled, flung
//     or swung about for the balance: a skier wheeling his arms in the air
//     is a skier who has lost it, and a professional rides a cliff with his
//     hands where he can see them and the rest of him quiet.
//   * COMMITTED (a lean held, at any height): a skier driving his body
//     over the skis — or back on them — has chosen his line through the
//     air, and the arms say so: set forward, a little lower and narrower
//     than a spot, the chest over them.
//   * REACH (the last few tenths before the snow, every flight): the arms
//     brought forward and down ahead of the knees, the legs extended toward
//     the snow so they have the stroke to take it — further the bigger the
//     fall.
//
// The sequence runs on THE FALL CLOCK: the seconds he has spent HIGH over
// the snow, never merely in the air, so a long flight low over a pitch (a
// table, a drop skied along the line) stays as secure as a kicker. The
// lean (`SkierState.lean`, after its lag) is read as the commitment. The
// reach is timed off where his flight meets the snow (`flightRead`: the
// engine's own ballistics marched over the map), never guessed off the
// clock.

import { smooth } from "./skier-stroke.ts";
import { add, clamp01, scale, type V3 } from "./skier-vec.ts";

/** What the flight reads of the world each frame: how far his skis are
 * over the snow, m (on its normal), and the seconds until his path meets
 * it (`Infinity` when it is not in sight). */
export type FlightRead = { clearance: number; ahead: number };

/** The ground a flight is read over — a `Level`'s queries. */
export type FlightGround = {
  groundAt(x: number, z: number): number;
  normalAt?(x: number, z: number, out: { x: number; y: number; z: number }): void;
};

const NORMAL = { x: 0, y: 1, z: 0 };

/** THE FALL as the view keeps it. */
export type Flight = {
  /** The fall clock, s: run on while he is high over the snow. */
  t: number;
  /** The stages as his body carries them, 0..1, and their rates. */
  spot: number;
  spotRate: number;
  reach: number;
  reachRate: number;
  /** How COMMITTED he is — the lean he holds, eased, 0..1. */
  commit: number;
  commitRate: number;
  /** How big a fall this is, 0..1 — what the reach extends the legs by. */
  size: number;
};

export function createFlight(): Flight {
  return {
    t: 0,
    spot: 0,
    spotRate: 0,
    reach: 0,
    reachRate: 0,
    commit: 0,
    commitRate: 0,
    size: 0,
  };
}

/** HOW HIGH COUNTS: the clearance the fall clock starts at and runs at
 * full rate from, m — a boot's height of air on a roller runs nothing. */
const HIGH = { from: 0.6, full: 2.2 };
/** THE STAGES on the fall clock, s: the spot comes in over these — a
 * flight high for half a second spots. The reach comes in over the last
 * `REACH` s before the snow, and `SIZE` is the fall clock a full-sized
 * fall has run by then. */
const SPOT = { from: 0.1, to: 0.32 };
const REACH = { at: 0.12, over: 0.38 };
const SIZE = 0.9;
/** A LEAN held this far (the engine's lean after its lag, either way) is a
 * skier committed to his line: from `from` the arms begin to set, at
 * `full` they are set. */
const COMMIT = { from: 0.1, full: 0.3 };
/** THE ARMS on the sphere their shoulders swing them round: the angle
 * from straight down (rad, forward positive), how far out from the body's
 * plane (rad) and how much of the arm's length the fist is from the
 * shoulder — spotting (forward, a little below the shoulders, wide), set
 * when committed (under the shoulders, a little narrower) and reaching
 * for the landing (forward and lower, ahead of the knees). */
const ARMS = {
  spot: { a: 1.2, out: 0.42, span: 0.8 },
  commit: { a: 1.0, out: 0.3, span: 0.8 },
  reach: { a: 0.9, out: 0.3, span: 0.84 },
};
/** How fast each stage comes and goes, rad/s (critically damped) — the
 * reach let go of on the snow more gently than it was taken, so the arms
 * come down out of it as he absorbs. */
const FOLLOW = { spot: 9, reach: 14, settle: 8, commit: 7 };
/** What the stages do to the body: the trunk pitched over the knees, rad,
 * the head bowed to the landing (its forward lean), and the legs —
 * gathered while spotting, m, reached long for the snow by `reach` +
 * `reachBig` × the size of the fall, m. */
const BODY = {
  spot: 0.14,
  reachPitch: 0.1,
  nod: 0.3,
  gather: 0.03,
  reach: 0.03,
  reachBig: 0.11,
  /** …and committed, the chest driven a little further over the knees. */
  commit: 0.06,
};

/** One value followed on a critically damped spring of `w` rad/s. */
function follow(v: number, rate: number, to: number, dt: number, w: number): [number, number] {
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    rate += (w * w * (to - v) - 2 * w * rate) * h;
    v += rate * h;
  }
  return [v, rate];
}

/** HOW FAR OVER THE SNOW HE IS, and how soon his flight meets it: the
 * skis' base under his centre (`cogHeight` below it) over the snow there,
 * along its normal, and his path — the engine's own ballistics under the
 * flight's `gravity`, m/s² — marched over the map until it meets the snow
 * (up to `horizon` s). */
export function flightRead(
  ground: FlightGround,
  c: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
  cogHeight: number,
  gravity: number,
  horizon = 2.5,
): FlightRead {
  const over = (x: number, y: number, z: number) => y - cogHeight - ground.groundAt(x, z);
  NORMAL.y = 1;
  ground.normalAt?.(c.x, c.z, NORMAL);
  const clearance = over(c.x, c.y, c.z) * NORMAL.y;
  const step = 0.04;
  let last = over(c.x, c.y, c.z);
  for (let t = step; t <= horizon + 1e-9; t += step) {
    const h = over(c.x + c.vx * t, c.y + c.vy * t - 0.5 * gravity * t * t, c.z + c.vz * t);
    if (h <= 0) return { clearance, ahead: t - (step * h) / (h - last) };
    last = h;
  }
  return { clearance, ahead: Number.POSITIVE_INFINITY };
}

/** Advance the fall by `dt` s: in the air or not, the world as read
 * (`flightRead`, or none — a lab without a map: the clock then runs on
 * the drop below the launch, and no landing is seen coming), how long
 * the engine has had him in the air, s, and the lean he holds. */
export function stepFlight(
  f: Flight,
  airborne: boolean,
  read: FlightRead | null | undefined,
  airTime: number,
  dt: number,
  gravity = 14.7,
  lean = 0,
): void {
  if (!(dt > 0)) return;
  const clearance = read ? read.clearance : 0.5 * gravity * airTime * airTime;
  const ahead = read ? read.ahead : Number.POSITIVE_INFINITY;
  if (airborne) f.t += dt * smooth((clearance - HIGH.from) / (HIGH.full - HIGH.from));
  else f.t = 0;
  const reachTo = airborne ? 1 - smooth((ahead - REACH.at) / REACH.over) : 0;
  const spotTo = airborne ? smooth((f.t - SPOT.from) / (SPOT.to - SPOT.from)) : 0;
  const commitTo = airborne
    ? smooth((Math.abs(lean) - COMMIT.from) / (COMMIT.full - COMMIT.from))
    : 0;
  [f.commit, f.commitRate] = follow(f.commit, f.commitRate, commitTo, dt, FOLLOW.commit);
  f.commit = clamp01(f.commit);
  if (airborne) f.size = Math.max(f.size, clamp01(f.t / SIZE));
  else if (f.reach < 0.02) f.size = 0;
  [f.spot, f.spotRate] = follow(f.spot, f.spotRate, spotTo, dt, FOLLOW.spot);
  [f.reach, f.reachRate] = follow(
    f.reach,
    f.reachRate,
    reachTo,
    dt,
    airborne ? FOLLOW.reach : FOLLOW.settle,
  );
  f.spot = clamp01(f.spot);
  f.reach = clamp01(f.reach);
}

/** THE FALL as the pose reads it (`SkierPoseInput.flight`). */
export type FlightShape = {
  /** How much of the arms the fall has, 0..1. */
  w: number;
  /** Both arms' angle (rad from hanging down, forward positive), how far
   * out of the body's plane, rad, and each fist's share of the arm. */
  arm: number;
  out: number;
  span: number;
  /** The trunk's extra pitch, rad, the head's bow and the hips' rise, m. */
  pitch: number;
  nod: number;
  lift: number;
};

/** The fall at this frame, `air` how far into the air his body is. */
export function flightShape(f: Flight, air: number): FlightShape {
  const reach = f.reach * air;
  const spot = f.spot * air;
  const mix = (a: number, b: number, k: number) => a + (b - a) * k;
  // Spotting forward (set a little lower when committed), or reaching down
  // ahead of the knees for the landing — both arms alike, and still.
  const set = (k: "a" | "out" | "span") =>
    mix(mix(ARMS.spot[k], ARMS.commit[k], f.commit), ARMS.reach[k], f.reach);
  return {
    w: Math.max(f.spot, f.reach),
    arm: set("a"),
    out: set("out"),
    span: set("span"),
    // The chest and the head let go of on their own springs, never in the
    // step the snow comes: he lands over his knees and looks up out of it.
    pitch: BODY.spot * f.spot + BODY.commit * f.commit * f.spot + BODY.reachPitch * f.reach,
    nod: BODY.nod * Math.max(f.spot, f.reach),
    lift: (BODY.reach + BODY.reachBig * f.size) * reach - BODY.gather * spot * (1 - f.reach),
  };
}

/** The way an arm of `side` (−1 left) points at angle `a`, `out` of the
 * body's plane, in the pair's frame. */
function armDir(side: number, a: number, out: number): V3 {
  const c = Math.cos(out);
  return { x: side * Math.sin(out), y: -Math.cos(a) * c, z: Math.sin(a) * c };
}

/** THE FISTS where the fall puts them: on the sphere round each shoulder,
 * mixed in by how much of the arms the fall has — the arms are home
 * (forward) whenever that is short of whole, so no fist is drawn through
 * him on the way. */
export function flightHands(F: FlightShape, shoulders: [V3, V3], hands: V3[], arm: number): void {
  if (F.w <= 0) return;
  for (const i of [0, 1]) {
    const at = add(shoulders[i], scale(armDir(i ? 1 : -1, F.arm, F.out), arm * F.span));
    const h = hands[i];
    hands[i] = {
      x: h.x + (at.x - h.x) * F.w,
      y: h.y + (at.y - h.y) * F.w,
      z: h.z + (at.z - h.z) * F.w,
    };
  }
}
