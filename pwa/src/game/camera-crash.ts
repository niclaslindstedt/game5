// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CRASH'S LENS — the helicopter going down with the skier on its skid
// (`heli.ts`'s `crash`), seen whole. Three-free, so the suite reads it.
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
// smoke climbs. The SHOCK reaches it at the speed of sound and shakes it,
// and the fov kicks with the flash. It is never inside the fireball.

import { fireballOf, WRECK } from "@engine";

import type { LensPose, Vec3 } from "./camera-rigs.ts";

/** THE BALL the lens frames: the engine's own, off the fuel it burns. */
const BALL = fireballOf(WRECK.fire.fuel * WRECK.fire.share);

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
  blocked?: (eye: Vec3, target: Vec3) => boolean,
): CrashCam {
  const C = CRASH_LOOK;
  const dist = Math.max(C.least, BALL.diameter * C.perBall + C.margin);
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
    const cost = Math.max(0, snow) + trees * 30 + Math.abs(turn) * 2;
    if (cost < best.cost) best = { bearing, lift: C.height + Math.max(0, snow), cost };
    if (snow <= 0 && !trees) break;
  }
  // Wooded in all round: stood up over the nearest crowns.
  if (best.cost >= 30) best.lift += C.overWoods;
  const at = eyeAt(wreck, best.bearing, dist, 0, groundAt);
  return {
    bearing: best.bearing,
    dist,
    lift: best.lift,
    t: 0,
    shock: Math.hypot(at.x - wreck.x, at.y - wreck.y, at.z - wreck.z) / C.sound,
  };
}

/** ONE FRAME OF THE CRASH'S LENS, `dt` s on, the wreck at `wreck`: the
 * slow push and drift, the look rising after the fire, the shock. */
export function frameCrash(
  cam: CrashCam,
  wreck: Vec3,
  dt: number,
  groundAt: (x: number, z: number) => number,
): LensPose {
  const C = CRASH_LOOK;
  cam.t += dt;
  const nearest = Math.max(C.nearest, BALL.diameter + 6);
  const dist = Math.max(nearest, cam.dist - C.push * cam.t);
  const bearing = cam.bearing + C.drift * cam.t;
  const eye = eyeAt(wreck, bearing, dist, cam.lift, groundAt);
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
