// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CRASH'S LENS — a machine going down with the skier on it (the
// helicopter's skid, `heli.ts`'s `crash`; the jump plane's door,
// `plane.ts`'s), seen whole. Three-free, so the suite reads it.
//
// The shot is THE MACHINE GOING UP, and only that: the lens never goes
// after the skier the blast throws. The moment it strikes the picture CUTS
// — a cut on the impact, the way a film cuts on action — to a lens planted
// on the snow well back from the wreck, low, looking up at it: far enough
// that the whole fireball and the column it rolls up into fit the frame,
// near enough that the wreck reads. It stands on the side the lens on
// screen was on, so the mountain keeps its place; turned round until no
// trunk and no rise of the snow stands between it and the fire. From
// there it holds for as long as the wreck burns: a slow push in, a slow
// drift round, the look rising after the ball as it lifts off and the
// smoke climbs — and where a trunk would come between it and the fire, or
// stand in its way, the drift and the push stop short of it. The SHOCK
// reaches it at the speed of sound and shakes it, and the fov kicks with
// the flash. It is never inside the fireball, whose size is the machine's
// own (`CrashOptions.ball`; the helicopter's when left out).

import { fireballOf, treesNear, WRECK, type Level } from "@engine";

import type { LensPose, Vec3 } from "./camera-rigs.ts";

/** THE BALL the lens frames when no other is named: the helicopter's own,
 * off the fuel it burns. */
const BALL = fireballOf(WRECK.fire.fuel * WRECK.fire.share);

/** What a machine's crash hands the lens: its fireball's diameter, m (0:
 * a pool fire alone), and where it went up when that is not where the
 * wreck comes to rest (a plane slid on past its own fireball). */
export type CrashOptions = { ball?: number; ballAt?: Vec3 };

/** Whether a lens at `eye` is wooded in looking at `target`. */
export type Blocked = (eye: Vec3, target: Vec3) => boolean;

/** THE VANTAGE: the standoff off the wreck, m — a share of the ball's
 * width and a margin, never under `least` — the eye's height over the
 * snow, m, the bearings tried round the lens's own, rad, the fov, deg;
 * THE HOLD: the push in, m/s, the nearest it pushes to, m, the drift
 * round, rad/s; THE LOOK: its height over the wreck at first and once
 * the smoke has climbed, m, over how long, s; THE SHOCK: its size, m, how
 * fast it dies, 1/s, the fov's kick, deg, and the speed it travels at,
 * m/s; and the least gap kept from the snow along the sight, m. */
export const CRASH_LOOK = {
  perBall: 1.55,
  margin: 12,
  least: 38,
  height: 3.2,
  tries: [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.1, -2.1, Math.PI] as const,
  fov: 54,
  push: 0.9,
  nearest: 30,
  drift: 0.03,
  lookLow: 5,
  lookHigh: 20,
  lookRise: 6,
  shake: 0.7,
  settle: 2.6,
  kick: 6,
  sound: 340,
  clearance: 1.6,
  /** How much higher it stands where every way round is wooded, m. */
  overWoods: 9,
} as const;

/** The lens's memory: where it stands off the wreck (level bearing and
 * standoff), how high it stands over the snow there, its clock and when
 * the shock reaches it. */
export type CrashCam = {
  bearing: number;
  dist: number;
  /** The fireball it frames, m across, and where it went up. */
  ball: number;
  ballAt: Vec3 | null;
  /** The seconds of push and drift it has moved by — held where the next
   * would put a trunk in the way. */
  moved: number;
  /** How high over the snow under the eye, m (raised where the snow
   * between would hide the wreck). */
  lift: number;
  t: number;
  shock: number;
};

/** Eased from rest to rest, 0..1. */
const smooth = (x: number): number => {
  const c = x <= 0 ? 0 : x >= 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};

/** Whether `eye` stands inside a fireball `ball` m across that went up
 * at `at` — or near enough that its smoke rolls over it. */
function inBall(eye: Vec3, ball: number, at: Vec3 | null | undefined): boolean {
  if (!at || ball <= 0) return false;
  return Math.hypot(eye.x - at.x, eye.z - at.z) < ball * 0.9 + CRASH_LOOK.margin;
}

/** The eye at `bearing` and `dist` off the wreck, `lift` m over the snow. */
function eyeAt(
  wreck: Vec3,
  bearing: number,
  dist: number,
  lift: number,
  groundAt: (x: number, z: number) => number,
): Vec3 {
  const x = wreck.x + Math.sin(bearing) * dist;
  const z = wreck.z + Math.cos(bearing) * dist;
  return { x, y: groundAt(x, z) + lift, z };
}

/** How far the snow between `eye` and `at` stands over the sight line at
 * its worst, m (≤ 0: it sees). */
function snowInWay(eye: Vec3, at: Vec3, groundAt: (x: number, z: number) => number): number {
  let worst = -Infinity;
  for (let i = 1; i < 12; i++) {
    const k = i / 12;
    const x = eye.x + (at.x - eye.x) * k;
    const y = eye.y + (at.y - eye.y) * k;
    const z = eye.z + (at.z - eye.z) * k;
    worst = Math.max(worst, groundAt(x, z) + CRASH_LOOK.clearance - y);
  }
  return worst;
}

/** THE CRASH'S LENS TAKES OVER from `from`, the lens on screen when it
 * struck, the wreck at `wreck`: the vantage it cuts to, chosen. */
export function startCrashCam(
  from: LensPose,
  wreck: Vec3,
  groundAt: (x: number, z: number) => number = () => wreck.y - 2,
  blocked?: Blocked,
  opts: CrashOptions = {},
): CrashCam {
  const C = CRASH_LOOK;
  const ball = opts.ball ?? BALL.diameter;
  const dist = Math.max(C.least, ball * C.perBall + C.margin);
  // The side the lens was on — or, on the wreck itself, behind its look.
  let ax = from.eye.x - wreck.x;
  let az = from.eye.z - wreck.z;
  if (Math.hypot(ax, az) < 3) {
    ax = from.eye.x - from.target.x;
    az = from.eye.z - from.target.z;
  }
  const own = Math.hypot(ax, az) > 1e-3 ? Math.atan2(ax, az) : 0;
  const aim = { x: wreck.x, y: wreck.y + C.lookLow, z: wreck.z };
  // The first bearing that sees the fire clear of the trunks and the snow;
  // failing that, the one the snow hides least, raised until it sees.
  let best: { bearing: number; lift: number; cost: number } = {
    bearing: own,
    lift: C.height,
    cost: Infinity,
  };
  for (const turn of C.tries) {
    const bearing = own + turn;
    const eye = eyeAt(wreck, bearing, dist, C.height, groundAt);
    const snow = snowInWay(eye, aim, groundAt);
    const trees = blocked?.(eye, aim) ? 1 : 0;
    const fire = inBall(eye, ball, opts.ballAt) ? 1 : 0;
    const cost = Math.max(0, snow) + trees * 30 + fire * 60 + Math.abs(turn) * 2;
    if (cost < best.cost) best = { bearing, lift: C.height + Math.max(0, snow), cost };
    if (snow <= 0 && !trees && !fire) break;
  }
  // Wooded in all round: stood up over the nearest crowns.
  if (best.cost >= 30) best.lift += C.overWoods;
  const at = eyeAt(wreck, best.bearing, dist, 0, groundAt);
  return {
    bearing: best.bearing,
    dist,
    ball,
    ballAt: opts.ballAt ?? null,
    moved: 0,
    lift: best.lift,
    t: 0,
    shock: Math.hypot(at.x - wreck.x, at.y - wreck.y, at.z - wreck.z) / C.sound,
  };
}

/** ONE FRAME OF THE CRASH'S LENS, `dt` s on, the wreck at `wreck`: the
 * slow push and drift (stopped short of a trunk where `blocked` says one
 * would come in the way), the look rising after the fire, the shock. */
export function frameCrash(
  cam: CrashCam,
  wreck: Vec3,
  dt: number,
  groundAt: (x: number, z: number) => number,
  blocked?: Blocked,
): LensPose {
  const C = CRASH_LOOK;
  cam.t += dt;
  const nearest = Math.max(C.nearest, cam.ball + 6);
  const placed = (moved: number): Vec3 =>
    eyeAt(
      wreck,
      cam.bearing + C.drift * moved,
      Math.max(nearest, cam.dist - C.push * moved),
      cam.lift,
      groundAt,
    );
  const aim = { x: wreck.x, y: wreck.y + C.lookLow, z: wreck.z };
  const next = placed(cam.moved + dt);
  if ((!blocked || !blocked(next, aim)) && !inBall(next, cam.ball, cam.ballAt)) cam.moved += dt;
  const eye = placed(cam.moved);
  // The look: on the ball as it swells on the snow, rising after it as
  // it lifts off and the smoke climbs out of it.
  const rise = smooth(cam.t / C.lookRise);
  const target = {
    x: wreck.x,
    y: wreck.y + C.lookLow + (C.lookHigh - C.lookLow) * rise,
    z: wreck.z,
  };
  let fov: number = C.fov;
  // THE SHOCK: it reaches the lens at the speed of sound and dies away.
  const s = cam.t - cam.shock;
  if (s > 0) {
    const a = C.shake * Math.exp(-s * C.settle);
    eye.x += a * Math.sin(s * 41) * 0.5;
    eye.y += a * Math.sin(s * 33 + 1.3);
    eye.z += a * Math.sin(s * 47 + 2.1) * 0.5;
    target.x += a * 0.6 * Math.sin(s * 29 + 0.7);
    target.y += a * 0.6 * Math.sin(s * 37 + 2.9);
    fov += C.kick * Math.exp(-s * 5) * (s < 0.04 ? s / 0.04 : 1);
  }
  return { eye, target, fov, roll: 0 };
}

const trunks: number[] = [];

/** WHETHER A TRUNK STANDS between `eye` and `at` — the crash's lens rises
 * over one. */
function treeBetween(level: Level, eye: Vec3, at: Vec3): boolean {
  for (let t = 0.05; t < 0.95; t += 0.05) {
    const px = eye.x + (at.x - eye.x) * t;
    const pz = eye.z + (at.z - eye.z) * t;
    const py = eye.y + (at.y + 2 - eye.y) * t;
    for (const i of treesNear(level, px, pz, 2.5, trunks)) {
      const tree = level.trees[i];
      if (tree.y + tree.height > py) return true;
    }
  }
  return false;
}

/** WHETHER THE CRASH'S LENS WOULD BE WOODED IN at `eye`: a trunk between
 * it and the fire, or a tree near enough the eye to fill the frame. */
export function wooded(level: Level, eye: Vec3, at: Vec3): boolean {
  if (treeBetween(level, eye, at)) return true;
  for (let t = 0; t < 0.35; t += 0.05) {
    const px = eye.x + (at.x - eye.x) * t;
    const pz = eye.z + (at.z - eye.z) * t;
    if (treesNear(level, px, pz, 4 + 22 * t, trunks).length > 0) return true;
  }
  return false;
}
