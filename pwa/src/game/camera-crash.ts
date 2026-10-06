// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CRASH'S LENS — the helicopter going down with the skier on its skid
// (`heli.ts`'s `crash`), seen whole. Three-free, so the suite reads it.
//
// It starts EXACTLY where the lens stood the moment it struck — whichever
// rung he was riding it on — and pulls back from there: out along the
// line it was already looking down, up over the snow and a little round
// the wreck, the look easing off what it was aimed at onto the fireball
// and the skier the blast threw, until the whole of it is in the frame —
// the ball rising off the snow, the pieces landing, him tumbling away.
// Then, as his flight nears its APEX, it CLOSES IN ON HIM and RIDES HIS
// PATH: a low tracking shot a few metres behind him and off to his side,
// carried along at his own speed and looking down the way he is going,
// so the snow and the trees stream past — left a little behind as he
// gathers speed falling, widened and tilted the faster he goes — and on
// down through his tumble along the snow until he stops. It is never
// inside the fireball.
// The SHOCK reaches the lens at the speed of sound and shakes it; a lens
// with a trunk between it and the wreck rises until it sees over it; it
// never goes under the snow.

import { fireballAt } from "@engine";

import type { LensPose, Vec3 } from "./camera-rigs.ts";

/** THE PULL-BACK: how long it takes, s; the least standoff it ends at, m,
 * and what each metre between the wreck and the thrown skier adds; how
 * high over the wreck it ends looking from, rad over the level at the
 * least; how fast it swings round the wreck, rad/s; the fov it settles
 * on, deg; how long the look takes to come round onto the crash, s; how
 * high over the wreck the look settles, m, and how far toward the skier,
 * a share. */
export const CRASH_LOOK = {
  pull: 2.6,
  start: 0.15,
  dist: 50,
  perSpread: 1.1,
  rise: 0.3,
  riseMost: 0.75,
  orbit: 0.06,
  fov: 60,
  turn: 1.1,
  over: 9,
  overMost: 22,
  /** How far the lens keeps drawing back after the pull, m/s — the
   * column climbing out of the frame. */
  drift: 2.5,
  toward: 0.35,
  /** The shake: its size, m, how fast it dies, 1/s, the fov's kick, deg,
   * and the speed the shock travels at, m/s. */
  shake: 1.1,
  settle: 2.4,
  kick: 5,
  sound: 340,
  /** THE FLINCH: a lens that was nearer the wreck than `flinch` m when it
   * went up (the chase, a few metres behind it; the nose, at the impact
   * itself) is thrown back out to that in its first `flinchFor` s — out
   * of the fireball as it swells, the pieces flying past it. */
  flinch: 28,
  flinchFor: 0.28,
  /** The least gap kept from the snow, m; how fast it rises over a trunk
   * in the way, m/s, and how high at most, m. */
  clearance: 3,
  climb: 14,
  climbMost: 45,
  /** THE CLOSE-IN ON HIM: it starts once the flinch is done (`zoomFrom`
   * s) and his flight is within `zoomLead` s of its apex — or at
   * `zoomLate` s whatever he is doing — and takes `zoomIn` s. */
  zoomFrom: 0.35,
  zoomLead: 0.6,
  zoomLate: 1.6,
  zoomIn: 0.8,
  /** THE TRACKING SHOT: `back` m behind him along his way and `side` m
   * off it, `up` m over him (low: level with him against the sky over
   * the apex, just over the snow he throws up after), looking `lead` m ahead of him down
   * his way and `drop` s of his fall ahead; the eye carried after its
   * place at `trail` /s, so it is left behind as he gathers speed, the
   * look after him at `follow` /s (the tumble's jolts taken out), his way
   * turned to at `steer` /s and held once he is slower than `still` m/s.
   * The fov opens from `fovSlow` by `fovPer` deg each m/s up to
   * `fovFast`, and the frame tilts `dutch` rad at speed. `fire` m is the
   * least it keeps off the fireball's skin. */
  back: 3,
  side: 2.2,
  up: 1.6,
  lead: 5,
  drop: 0.25,
  trail: 8,
  follow: 9,
  steer: 4,
  still: 3,
  fovSlow: 46,
  fovPer: 0.9,
  fovFast: 70,
  dutch: 0.14,
  fire: 4,
  g: 9.81,
} as const;

/** The lens's memory: where it started (polar about its look, so the
 * first frame is the lens it took over from), its clock and how far it
 * has risen over a trunk. */
export type CrashCam = {
  from: LensPose;
  dist: number;
  bearing: number;
  elevation: number;
  t: number;
  lift: number;
  /** When the shock reaches it, s. */
  shock: number;
  /** How far it flinches back, m, and along which way (level). */
  flinch: number;
  away: { x: number; z: number };
  /** THE CLOSE-IN: when it began, s (null until it does), which side of
   * his way it rides (±1), his way (level, unit), the look following him,
   * the tracking eye, and how far it has risen over a trunk, m. */
  zoomAt: number | null;
  hand: number;
  way: { x: number; z: number };
  look: Vec3;
  track: Vec3;
  nearLift: number;
};

/** The thrown skier as the crash's lens follows him: where his body is,
 * and how fast it is going, m/s (the suite may leave the speed out). */
export type Flung = Vec3 & { vx?: number; vy?: number; vz?: number };

/** Eased from rest to rest, 0..1. */
const smooth = (x: number): number => {
  const c = x <= 0 ? 0 : x >= 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};
/** Most of the way in its first part — the pull's whoosh back — got up
 * to speed over its first `C.start` s rather than leaping off its mark. */
const ease = (x: number, t: number): number => {
  const c = x <= 0 ? 0 : x >= 1 ? 1 : x;
  return (1 - (1 - c) ** 3) * Math.min(1, t / CRASH_LOOK.start);
};

/** THE CRASH'S LENS TAKES OVER from `from`, the lens on screen when it
 * struck, the wreck at `wreck`. */
export function startCrashCam(from: LensPose, wreck: Vec3): CrashCam {
  const dx = from.eye.x - from.target.x;
  const dy = from.eye.y - from.target.y;
  const dz = from.eye.z - from.target.z;
  const dist = Math.max(0.5, Math.hypot(dx, dy, dz));
  const near = Math.hypot(from.eye.x - wreck.x, from.eye.y - wreck.y, from.eye.z - wreck.z);
  // Back from the wreck, or — on it — back along the look.
  let ax = from.eye.x - wreck.x;
  let az = from.eye.z - wreck.z;
  if (Math.hypot(ax, az) < 2) {
    ax = from.eye.x - from.target.x;
    az = from.eye.z - from.target.z;
  }
  const al = Math.hypot(ax, az) || 1;
  return {
    flinch: Math.max(0, CRASH_LOOK.flinch - near),
    away: { x: ax / al, z: az / al },
    from: { ...from, eye: { ...from.eye }, target: { ...from.target } },
    dist,
    bearing: Math.atan2(dx, dz),
    elevation: Math.asin(Math.max(-1, Math.min(1, dy / dist))),
    t: 0,
    lift: 0,
    shock: near / CRASH_LOOK.sound,
    zoomAt: null,
    hand: 1,
    way: { x: 0, z: 1 },
    look: { x: 0, y: 0, z: 0 },
    track: { x: 0, y: 0, z: 0 },
    nearLift: 0,
  };
}

/** ONE FRAME OF THE CRASH'S LENS, `dt` s on: the wreck at `wreck`, the
 * thrown skier at `rider` (null when nobody was aboard), `blocked`
 * whether something solid stands between an eye and what it looks at. */
export function frameCrash(
  cam: CrashCam,
  wreck: Vec3,
  rider: Flung | null,
  dt: number,
  groundAt: (x: number, z: number) => number,
  blocked?: (eye: Vec3, target: Vec3) => boolean,
): LensPose {
  const C = CRASH_LOOK;
  cam.t += dt;
  const k = ease(cam.t / C.pull, cam.t);
  const turn = smooth(cam.t / C.turn);
  // Where the look settles: over the wreck, toward the skier it threw,
  // rising after the fireball and the smoke it rolls up into.
  const over = Math.min(C.overMost, C.over * (0.4 + cam.t / 3));
  const want = rider
    ? {
        x: wreck.x + (rider.x - wreck.x) * C.toward,
        y: wreck.y + over + (rider.y - wreck.y) * C.toward * 0.5,
        z: wreck.z + (rider.z - wreck.z) * C.toward,
      }
    : { x: wreck.x, y: wreck.y + over, z: wreck.z };
  const f = cam.from.target;
  const target = {
    x: f.x + (want.x - f.x) * turn,
    y: f.y + (want.y - f.y) * turn,
    z: f.z + (want.z - f.z) * turn,
  };
  const spread = rider ? Math.hypot(rider.x - wreck.x, rider.z - wreck.z) : 0;
  const far = Math.max(cam.dist, C.dist + spread * C.perSpread);
  const dist = cam.dist + (far - cam.dist) * k + C.drift * Math.max(0, cam.t - C.pull);
  const up = Math.min(C.riseMost, Math.max(cam.elevation, C.rise));
  const elevation = cam.elevation + (up - cam.elevation) * k;
  const bearing = cam.bearing + C.orbit * Math.max(0, cam.t - C.pull * 0.3);
  const flat = Math.cos(elevation) * dist;
  const eye = {
    x: target.x + Math.sin(bearing) * flat,
    y: target.y + Math.sin(elevation) * dist,
    z: target.z + Math.cos(bearing) * flat,
  };
  // The flinch out of the blast, kept as the pull goes on.
  const fl = cam.flinch * smooth(cam.t / C.flinchFor);
  eye.x += cam.away.x * fl;
  eye.z += cam.away.z * fl;
  eye.y += fl * 0.35;
  // Over a trunk in the way, and never under the snow.
  if (blocked?.(eye, wreck)) cam.lift = Math.min(C.climbMost, cam.nearLift + C.climb * dt);
  else cam.lift = Math.max(0, cam.lift - C.climb * 0.25 * dt);
  eye.y += cam.lift * k;
  eye.y = Math.max(eye.y, groundAt(eye.x, eye.z) + C.clearance * Math.min(1, k * 4));
  let fov = cam.from.fov + (C.fov - cam.from.fov) * k;
  let roll = cam.from.roll * (1 - k);
  if (rider) {
    const near = closeIn(cam, eye, target, wreck, rider, dt, groundAt, blocked);
    if (near) {
      fov += (near.fov - fov) * near.z;
      roll += (near.roll - roll) * near.z;
    }
  }
  // THE SHOCK: it reaches the lens at the speed of sound and dies away.
  const s = cam.t - cam.shock;
  if (s > 0) {
    const a = C.shake * Math.exp(-s * C.settle);
    eye.x += a * Math.sin(s * 41) * 0.6;
    eye.y += a * Math.sin(s * 33 + 1.3);
    eye.z += a * Math.sin(s * 47 + 2.1) * 0.6;
    target.x += a * 0.5 * Math.sin(s * 29 + 0.7);
    target.y += a * 0.5 * Math.sin(s * 37 + 2.9);
    fov += C.kick * Math.exp(-s * 6) * (s < 0.05 ? s / 0.05 : 1);
  }
  return { eye, target, fov, roll };
}

/** THE CLOSE-IN ON HIM as his flight nears its apex: the tracking shot
 * worked out and `eye` and `target` (the pull-back's) eased onto it in
 * place; the fov and the tilt it wants and how far in it is (`z`), or
 * null before it begins. */
function closeIn(
  cam: CrashCam,
  eye: Vec3,
  target: Vec3,
  wreck: Vec3,
  rider: Flung,
  dt: number,
  groundAt: (x: number, z: number) => number,
  blocked?: (eye: Vec3, target: Vec3) => boolean,
): { fov: number; roll: number; z: number } | null {
  const C = CRASH_LOOK;
  const vx = rider.vx ?? 0;
  const vz = rider.vz ?? 0;
  const vy = rider.vy ?? 0;
  const flat = Math.hypot(vx, vz);
  if (cam.zoomAt === null) {
    const apex = rider.vy === undefined ? Infinity : Math.max(0, rider.vy) / C.g;
    if (cam.t < C.zoomFrom || (apex > C.zoomLead && cam.t < C.zoomLate)) return null;
    cam.zoomAt = cam.t;
    // His way: as he flies, or — not told — out from the wreck.
    let wx = vx;
    let wz = vz;
    if (flat < C.still) {
      wx = rider.x - wreck.x;
      wz = rider.z - wreck.z;
    }
    const wl = Math.hypot(wx, wz);
    cam.way = wl > 0.01 ? { x: wx / wl, z: wz / wl } : { x: -cam.away.x, z: -cam.away.z };
    // Ride the side of his way the lens already stood on.
    const px = cam.way.z;
    const pz = -cam.way.x;
    cam.hand = px * (eye.x - rider.x) + pz * (eye.z - rider.z) < 0 ? -1 : 1;
    cam.look = { x: rider.x, y: rider.y, z: rider.z };
    cam.track = { ...eye };
  }
  const z = smooth((cam.t - cam.zoomAt) / C.zoomIn);
  // His way, turned to as it changes and held once he slows to a stop.
  if (flat > C.still) {
    const f = 1 - Math.exp(-C.steer * dt);
    const wx = cam.way.x + (vx / flat - cam.way.x) * f;
    const wz = cam.way.z + (vz / flat - cam.way.z) * f;
    const wl = Math.hypot(wx, wz) || 1;
    cam.way = { x: wx / wl, z: wz / wl };
  }
  const w = cam.way;
  const px = w.z * cam.hand;
  const pz = -w.x * cam.hand;
  const f = 1 - Math.exp(-C.follow * dt);
  const l = cam.look;
  l.x += (rider.x - l.x) * f;
  l.y += (rider.y - l.y) * f;
  l.z += (rider.z - l.z) * f;
  // Where the eye rides, and the eye carried after it — left behind a
  // little as he gathers speed.
  const want = {
    x: l.x - w.x * C.back + px * C.side,
    y: l.y + C.up,
    z: l.z - w.z * C.back + pz * C.side,
  };
  const g = 1 - Math.exp(-C.trail * dt);
  const tr = cam.track;
  tr.x += (want.x - tr.x) * g;
  tr.y += (want.y - tr.y) * g;
  tr.z += (want.z - tr.z) * g;
  const near = { ...tr };
  if (blocked?.(near, l)) cam.nearLift = Math.min(C.climbMost, cam.nearLift + C.climb * dt);
  else cam.nearLift = Math.max(0, cam.nearLift - C.climb * 0.25 * dt);
  near.y += cam.nearLift;
  clearFire(near, wreck, cam.t);
  near.y = Math.max(near.y, groundAt(near.x, near.z) + C.clearance * 0.4);
  // Looking down his way, and after his fall.
  const look = {
    x: l.x + w.x * C.lead,
    y: l.y + vy * C.drop,
    z: l.z + w.z * C.lead,
  };
  eye.x += (near.x - eye.x) * z;
  eye.y += (near.y - eye.y) * z;
  eye.z += (near.z - eye.z) * z;
  // The way in between kept out of the fireball too, and over the snow.
  clearFire(eye, wreck, cam.t);
  eye.y = Math.max(eye.y, groundAt(eye.x, eye.z) + C.clearance * 0.4);
  target.x += (look.x - target.x) * z;
  target.y += (look.y - target.y) * z;
  target.z += (look.z - target.z) * z;
  const speed = Math.hypot(vx, vy, vz);
  const fast = Math.min(1, speed / 20);
  return {
    fov: Math.min(C.fovFast, C.fovSlow + C.fovPer * speed),
    roll: -cam.hand * C.dutch * fast,
    z,
  };
}

/** OUT OF THE FIREBALL: an eye inside the wreck's ball at `t` s (and
 * `CRASH_LOOK.fire` m round it) pushed out of it, straight away from its
 * middle. */
function clearFire(eye: Vec3, wreck: Vec3, t: number): void {
  const ball = fireballAt(t);
  if (ball.glow <= 0) return;
  const reach = ball.radius + CRASH_LOOK.fire;
  const cy = wreck.y + ball.height;
  const ox = eye.x - wreck.x;
  const oy = eye.y - cy;
  const oz = eye.z - wreck.z;
  const off = Math.hypot(ox, oy, oz);
  if (off >= reach) return;
  if (off < 0.5) {
    eye.y = cy + reach;
    return;
  }
  eye.x = wreck.x + (ox * reach) / off;
  eye.y = cy + (oy * reach) / off;
  eye.z = wreck.z + (oz * reach) / off;
}
