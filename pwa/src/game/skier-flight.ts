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
//   * SPOT (a drop worth the name): opened out for the balance, the hands
//     forward and wider at chest height, the chest over the knees, the head
//     down on the landing he is spotting, the hands working the balance in
//     small slow corrections.
//   * THE WINDMILL (a cliff, a second and more of real height): the arms
//     circled from the shoulders, steadily, both together a beat apart —
//     forward over the top and down in front, the way a long jumper cycles
//     his arms, to soak up the forward rotation a lip throws a skier into
//     and keep the tips from dropping. Never flung: a measured circle a
//     second, wound up from the spot and wound down into the landing.
//   * COMMITTED (a lean held, at any height): a skier driving his body
//     over the skis — or back on them — has chosen his line through the
//     air, and the arms say so: set forward and quiet, a little lower and
//     narrower than a spot, the chest over them. He never windmills while
//     he leans: a circle of the arms is a skier fighting a rotation he did
//     not ask for, and a lean is one he did. Letting go of the lean high
//     over a cliff lets the windmill back in; taking it mid-circle brakes
//     the arms home into the set.
//   * REACH (the last few tenths before the snow, every flight): the arms
//     brought forward and down ahead of the knees, the legs extended toward
//     the snow so they have the stroke to take it — further the bigger the
//     fall.
//
// The sequence runs on THE FALL CLOCK: the seconds he has spent HIGH over
// the snow, never merely in the air, so a long flight low over a pitch (a
// table, a drop skied along the line) stays as secure as a kicker, and a
// long fall plays further into it — a small drop never reaches the
// windmill, a big cliff winds it up and keeps it going until the snow
// comes. The lean (`SkierState.lean`, after its lag) is read as the
// commitment: the further it is held the less of the spot's sway and the
// windmill is left. The reach is timed off where his flight meets the snow
// (`flightRead`: the engine's own ballistics marched over the map), never
// guessed off the clock.

import { smooth } from "./skier-stroke.ts";
import { add, clamp01, norm, scale, type V3 } from "./skier-vec.ts";

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
  mill: number;
  millRate: number;
  reach: number;
  reachRate: number;
  /** How COMMITTED he is — the lean he holds, eased, 0..1. */
  commit: number;
  commitRate: number;
  /** How big a fall this is, 0..1 — what the reach extends the legs by. */
  size: number;
  /** THE ARMS' ANGLE in the pair's own vertical plane, rad from hanging
   * straight down (forward positive), unwrapped — the windmill turns it
   * down through every circle — and its rate, rad/s. */
  arm: number;
  armRate: number;
  /** The circle the arms are wound down onto (whole turns), or NaN while
   * they circle. */
  home: number;
};

export function createFlight(): Flight {
  return {
    t: 0,
    spot: 0,
    spotRate: 0,
    mill: 0,
    millRate: 0,
    reach: 0,
    reachRate: 0,
    commit: 0,
    commitRate: 0,
    size: 0,
    arm: ARMS.spot.a,
    armRate: 0,
    home: Number.NaN,
  };
}

/** HOW HIGH COUNTS: the clearance the fall clock starts at and runs at
 * full rate from, m — a boot's height of air on a roller runs nothing. */
const HIGH = { from: 0.6, full: 2.2 };
/** THE STAGES on the fall clock, s: the spot comes in over the first, the
 * windmill over the second — a flight high for half a second spots, one
 * high for a second circles. The reach comes in over the last `REACH` s
 * before the snow, and `SIZE` is the fall clock a full-sized fall has run
 * by then. */
const SPOT = { from: 0.1, to: 0.32 };
const MILL = { from: 0.32, to: 0.65 };
const REACH = { at: 0.12, over: 0.38 };
/** …and the windmill is wound down over these seconds before the snow,
 * so the arms are home ahead of him before the reach takes them. */
const WIND = { at: 0.4, over: 0.4 };
const SIZE = 0.9;
/** A body turning faster than this, rad/s, is turning on purpose (a flip,
 * a spin on a tricks run) and does not windmill; past `full` not at all. */
const SPIN = { from: 1.5, full: 3 };
/** A LEAN held this far (the engine's lean after its lag, either way) is a
 * skier committed to his line: from `from` the windmill and the sway give
 * way, at `full` they are gone. */
const COMMIT = { from: 0.1, full: 0.3 };
/** THE ARMS on the sphere their shoulders swing them round: the angle
 * from straight down (rad, forward positive), how far out from the body's
 * plane (rad) and how much of the arm's length the fist is from the
 * shoulder — spotting (forward, a little below the shoulders, wide),
 * reaching for the landing (forward and lower, ahead of the knees) and
 * circling (further out, longer). */
const ARMS = {
  spot: { a: 1.2, out: 0.42, span: 0.8 },
  reach: { a: 0.9, out: 0.3, span: 0.84 },
  mill: { out: 0.45, span: 0.9 },
  /** Committed: set forward under the shoulders, a little narrower — the
   * hands where he can see them and nothing moving. */
  commit: { a: 1.0, out: 0.3, span: 0.8 },
  /** Circles a second at full windmill — measured, never a flail — and
   * how far the left arm runs behind the right, rad. */
  hz: 1.05,
  lag: 0.55,
  /** Winding home: how hard the circle is braked, rad/s², and how far
   * past home the arms may be taken back to it rather than round, rad. */
  brake: 16,
  back: 0.6,
  /** The balance worked while spotting: how far the arms rock, rad, and
   * how often, Hz. */
  sway: 0.08,
  swayHz: 0.7,
};
/** How fast each stage comes and goes, rad/s (critically damped) — the
 * reach let go of on the snow more gently than it was taken, so the arms
 * come down out of it as he absorbs — and how fast the circling gets up
 * to speed and the braking into home is taken up, 1/s. */
const FOLLOW = { spot: 9, mill: 8, reach: 14, settle: 8, speed: 6, home: 12, commit: 7 };
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
/** THE POLE IN THE FIST while the arms circle: a closed fist holds the rod
 * across the forearm with the wrist set, so the rod turns WITH the arm,
 * keeping the grip he spotted with — hung back and down past his hip with
 * the arm forward, back with it down, up behind his shoulder with it back,
 * forward over his head with it up — never run on out of the arm like a
 * lance, and never swung round the fist on its own. `grip` is the rod's
 * angle behind the arm in the circle's plane, rad (where the spotting
 * hang has it, so the circle starts and ends on the pole as it hangs);
 * `splay` how far it is turned out from the body's plane, rad, so the tip
 * passes wide of his skis and his head. */
const POLE = { grip: 1.95, splay: 0.38, off: 1.2 };

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
 * the engine has had him in the air, s, and how fast his body is
 * turning, rad/s. */
export function stepFlight(
  f: Flight,
  airborne: boolean,
  read: FlightRead | null | undefined,
  airTime: number,
  spin: number,
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
  // Turning on purpose (a flip, a spin) or leaning on purpose: no windmill.
  const calm = (1 - smooth((spin - SPIN.from) / (SPIN.full - SPIN.from))) * (1 - smooth(commitTo));
  const wind = airborne ? smooth((ahead - WIND.at) / WIND.over) : 0;
  const circling = smooth((f.t - MILL.from) / (MILL.to - MILL.from)) * calm;
  const millTo = circling * wind;
  if (airborne) f.size = Math.max(f.size, clamp01(f.t / SIZE));
  else if (f.reach < 0.02) f.size = 0;
  [f.spot, f.spotRate] = follow(f.spot, f.spotRate, spotTo, dt, FOLLOW.spot);
  [f.mill, f.millRate] = follow(f.mill, f.millRate, millTo, dt, FOLLOW.mill);
  [f.reach, f.reachRate] = follow(
    f.reach,
    f.reachRate,
    reachTo,
    dt,
    airborne ? FOLLOW.reach : FOLLOW.settle,
  );
  f.spot = clamp01(f.spot);
  f.mill = clamp01(f.mill);
  f.reach = clamp01(f.reach);
  // THE ARMS: circled down through the turns while the windmill is asked
  // for, its speed taken up as a motion; wound down once the snow is near
  // — the circle finished at its own pace and braked into home ahead of
  // him (or back a little, if they have only just passed it), never
  // hurried round faster than they circled.
  const home = homeAngle(f.reach, f.commit);
  const pace = 2 * Math.PI * ARMS.hz;
  const take = 1 - Math.exp(-FOLLOW.speed * dt);
  if (circling > 0.05 && wind > 0.5) {
    f.home = Number.NaN;
    f.armRate += (-pace * circling - f.armRate) * take;
    f.arm += f.armRate * dt;
    return;
  }
  if (Number.isNaN(f.home)) {
    const past = f.arm - home;
    const turns = Math.floor(past / (2 * Math.PI));
    const left = past - turns * 2 * Math.PI;
    f.home = left > 2 * Math.PI - ARMS.back ? turns + 1 : turns;
  }
  const dist = home + 2 * Math.PI * f.home - f.arm;
  const brake = Math.sign(dist) * Math.min(pace, Math.sqrt(2 * ARMS.brake * Math.abs(dist)));
  f.armRate += (brake - f.armRate) * (1 - Math.exp(-FOLLOW.home * dt));
  f.arm += f.armRate * dt;
  // Home and still: the turns let go of, so the angle never runs away.
  if (Math.abs(f.armRate) < 1e-3 && f.home !== 0 && f.mill < 0.01) {
    f.arm -= 2 * Math.PI * f.home;
    f.home = 0;
  }
}

/** Where the arms rest when they are not circling: spotting forward (set
 * a little lower when committed), or reaching down ahead of the knees for
 * the landing. */
function homeAngle(reach: number, commit: number): number {
  const set = ARMS.spot.a + (ARMS.commit.a - ARMS.spot.a) * commit;
  return set + (ARMS.reach.a - set) * reach;
}

/** THE FALL as the pose reads it (`SkierPoseInput.flight`). */
export type FlightShape = {
  /** How much of the arms the fall has, 0..1. */
  w: number;
  /** Each arm's angle (rad from hanging down, forward positive), how far
   * out of the body's plane, rad, and its fist's share of the arm. */
  arm: [number, number];
  out: number;
  span: number;
  /** How far round the circle the poles are thrown, 0..1. */
  mill: number;
  /** How much of each pole the circle turns with its fist, 0..1: the
   * windmill's, and as much as the arm is still off home while it is
   * wound down — so the rod is let go of only where it hangs anyway. */
  pole: [number, number];
  /** The trunk's extra pitch, rad, the head's bow and the hips' rise, m. */
  pitch: number;
  nod: number;
  lift: number;
};

/** The fall at this frame, `clock` the skier's own (`SkierSpring.clock`)
 * and `air` how far into the air his body is. */
export function flightShape(f: Flight, clock: number, air: number): FlightShape {
  const reach = f.reach * air;
  const spot = f.spot * air;
  const mill = f.mill * air;
  const sway = ARMS.sway * spot * (1 - f.mill) * (1 - f.reach) * (1 - f.commit);
  const rock = Math.sin(2 * Math.PI * ARMS.swayHz * clock);
  const mix = (a: number, b: number, k: number) => a + (b - a) * k;
  const arm: [number, number] = [f.arm + ARMS.lag * f.mill - sway * rock, f.arm + sway * rock];
  const home = homeAngle(f.reach, f.commit);
  const off = (a: number) => {
    const d = Math.abs(a - home) % (2 * Math.PI);
    return smooth(Math.min(d, 2 * Math.PI - d) / POLE.off);
  };
  return {
    w: Math.max(f.spot, f.reach),
    arm,
    out: mix(
      mix(mix(ARMS.spot.out, ARMS.commit.out, f.commit), ARMS.mill.out, f.mill),
      ARMS.reach.out,
      f.reach,
    ),
    span: mix(
      mix(mix(ARMS.spot.span, ARMS.commit.span, f.commit), ARMS.mill.span, f.mill),
      ARMS.reach.span,
      f.reach,
    ),
    mill,
    pole: [Math.max(mill, off(arm[0]) * air), Math.max(mill, off(arm[1]) * air)],
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
    const at = add(shoulders[i], scale(armDir(i ? 1 : -1, F.arm[i], F.out), arm * F.span));
    const h = hands[i];
    hands[i] = {
      x: h.x + (at.x - h.x) * F.w,
      y: h.y + (at.y - h.y) * F.w,
      z: h.z + (at.z - h.z) * F.w,
    };
  }
}

/** THE POLES CARRIED ROUND with the windmill (`POLE`): each rod turned
 * with its fist at the grip it was hanging in, turned out wide of him, so
 * it sweeps clear of his skis and his head as a held rod does. */
export function flightPole(F: FlightShape, i: number, hand: V3, tip: V3, pole: number): V3 {
  const k = F.pole[i];
  if (k <= 0) return tip;
  const side = i ? 1 : -1;
  const p = F.arm[i] - POLE.grip;
  const c = Math.cos(POLE.splay);
  const swept = { x: side * Math.sin(POLE.splay), y: -Math.cos(p) * c, z: Math.sin(p) * c };
  const now = norm({ x: tip.x - hand.x, y: tip.y - hand.y, z: tip.z - hand.z });
  return add(
    hand,
    scale(
      norm({
        x: now.x + (swept.x - now.x) * k,
        y: now.y + (swept.y - now.y) * k,
        z: now.z + (swept.z - now.z) * k,
      }),
      pole,
    ),
  );
}
