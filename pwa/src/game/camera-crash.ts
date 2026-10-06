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
// Then, as his flight nears its APEX, it CLOSES IN ON HIM: from ahead of
// the way he was flung and off to the side of it, looking back at him
// with the fireball behind him in the frame — never inside it — narrowed, and it follows him down through the fall
// and the tumble along the snow.
// The SHOCK reaches the lens at the speed of sound and shakes it; a lens
// with a trunk between it and the wreck rises until it sees over it; it
// never goes under the snow.

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
   * `zoomLate` s whatever he is doing — and takes `zoomIn` s. It stands
   * `close` m off him, `closeUp` rad over the level, ahead of him along
   * the way he was flung and `aside` of the way off to the side of it,
   * never nearer the wreck than `fire` m (out of the fireball), its fov
   * narrowed to `closeFov` deg, its look following him at `follow` /s (the tumble's
   * jolts taken out), and swinging round him at `circle` rad/s. */
  zoomFrom: 0.35,
  zoomLead: 0.6,
  zoomLate: 1.6,
  zoomIn: 0.8,
  close: 8,
  closeUp: 0.22,
  aside: 0.7,
  fire: 20,
  closeFov: 40,
  follow: 9,
  circle: 0.12,
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
  /** THE CLOSE-IN: when it began, s (null until it does), the level way
   * off him it stands at, the look following him, and how far it has
   * risen over a trunk between them, m. */
  zoomAt: number | null;
  side: { x: number; z: number };
  look: Vec3;
  nearLift: number;
};

/** The thrown skier as the crash's lens follows him: where his body is,
 * and — while he flies — how fast he is rising, m/s. */
export type Flung = Vec3 & { vy?: number };

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
    side: { x: 0, z: 1 },
    look: { x: 0, y: 0, z: 0 },
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
  if (blocked?.(eye, wreck)) cam.lift = Math.min(C.climbMost, cam.lift + C.climb * dt);
  else cam.lift = Math.max(0, cam.lift - C.climb * 0.25 * dt);
  eye.y += cam.lift * k;
  eye.y = Math.max(eye.y, groundAt(eye.x, eye.z) + C.clearance * Math.min(1, k * 4));
  let fov = cam.from.fov + (C.fov - cam.from.fov) * k;
  if (rider) fov = closeIn(cam, eye, target, fov, wreck, rider, dt, groundAt, blocked);
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
  return { eye, target, fov, roll: cam.from.roll * (1 - k) };
}

/** THE CLOSE-IN ON HIM as his flight nears its apex: the follow pose
 * worked out and `eye` and `target` (the pull-back's) eased onto it in
 * place; the fov it hands back. */
function closeIn(
  cam: CrashCam,
  eye: Vec3,
  target: Vec3,
  fov: number,
  wreck: Vec3,
  rider: Flung,
  dt: number,
  groundAt: (x: number, z: number) => number,
  blocked?: (eye: Vec3, target: Vec3) => boolean,
): number {
  const C = CRASH_LOOK;
  if (cam.zoomAt === null) {
    const apex = rider.vy === undefined ? Infinity : Math.max(0, rider.vy) / C.g;
    if (cam.t < C.zoomFrom || (apex > C.zoomLead && cam.t < C.zoomLate)) return fov;
    cam.zoomAt = cam.t;
    // Ahead of the way he was flung, off to the side the lens already
    // stood on: he flies at it with the fire behind him.
    let fx = rider.x - wreck.x;
    let fz = rider.z - wreck.z;
    const fl = Math.hypot(fx, fz);
    if (fl < 0.5) {
      fx = -cam.away.x;
      fz = -cam.away.z;
    } else {
      fx /= fl;
      fz /= fl;
    }
    let px = -fz;
    let pz = fx;
    if (px * (eye.x - rider.x) + pz * (eye.z - rider.z) < 0) {
      px = -px;
      pz = -pz;
    }
    const sx = fx + px * C.aside;
    const sz = fz + pz * C.aside;
    const sl = Math.hypot(sx, sz);
    cam.side = { x: sx / sl, z: sz / sl };
    cam.look = { x: rider.x, y: rider.y, z: rider.z };
  }
  const since = cam.t - cam.zoomAt;
  const z = smooth(since / C.zoomIn);
  const f = 1 - Math.exp(-C.follow * dt);
  const l = cam.look;
  l.x += (rider.x - l.x) * f;
  l.y += (rider.y - l.y) * f;
  l.z += (rider.z - l.z) * f;
  const a = C.circle * since;
  const sx = cam.side.x * Math.cos(a) + cam.side.z * Math.sin(a);
  const sz = cam.side.z * Math.cos(a) - cam.side.x * Math.sin(a);
  const flat = Math.cos(C.closeUp) * C.close;
  const near = {
    x: l.x + sx * flat,
    y: l.y + Math.sin(C.closeUp) * C.close,
    z: l.z + sz * flat,
  };
  clearFire(near, wreck, cam.side);
  if (blocked?.(near, l)) cam.nearLift = Math.min(C.climbMost, cam.nearLift + C.climb * dt);
  else cam.nearLift = Math.max(0, cam.nearLift - C.climb * 0.25 * dt);
  near.y += cam.nearLift;
  near.y = Math.max(near.y, groundAt(near.x, near.z) + C.clearance * 0.5);
  eye.x += (near.x - eye.x) * z;
  eye.y += (near.y - eye.y) * z;
  eye.z += (near.z - eye.z) * z;
  // The way in between kept out of the fireball too.
  clearFire(eye, wreck, cam.side);
  target.x += (l.x - target.x) * z;
  target.y += (l.y - target.y) * z;
  target.z += (l.z - target.z) * z;
  return fov + (C.closeFov - fov) * z;
}

/** OUT OF THE FIREBALL: an eye nearer the wreck than `CRASH_LOOK.fire` m
 * (level) pushed out to it, straight away from it — or, on it, along
 * `side`. */
function clearFire(eye: Vec3, wreck: Vec3, side: { x: number; z: number }): void {
  const C = CRASH_LOOK;
  const ox = eye.x - wreck.x;
  const oz = eye.z - wreck.z;
  const off = Math.hypot(ox, oz);
  if (off >= C.fire) return;
  if (off > 0.5) {
    eye.x = wreck.x + (ox * C.fire) / off;
    eye.z = wreck.z + (oz * C.fire) / off;
  } else {
    eye.x += side.x * C.fire;
    eye.z += side.z * C.fire;
  }
}
