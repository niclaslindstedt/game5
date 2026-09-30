// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEATH CAM — the skier thrown, shot as a scene rather than ridden.
//
// The moment the engine puts the player off his skis (`crash.ts`'s
// `Thrown`), the lens leaves the ladder and goes after HIM: it flies off
// whatever rung it was on to a low lens beside and behind the body, on the
// side of the line he was thrown along that it was already nearest, and
// closes in on him as he goes — the zoom narrowing and the arm drawing in.
// As he comes down on the snow the picture SLOWS: the time rate eases down
// ahead of the impact (read off how long his fall has left to go, so it is
// already slow when he lands) and holds there a beat, then comes most of
// the way back up while he slides. When he has stopped (`Thrown.still`) the
// lens TILTS DOWN ON HIM AND RISES: it swings in over the body looking down
// and climbs into the sky, swaying, until the reset stands him up and the
// picture cuts back to the ladder.
//
// EVERY MOVE IS EASED, NOTHING IS CUT IN. The lens, its aim and its zoom
// chase what the phase wants at their own rates from wherever the ladder
// left them, and the time rate chases its own target, so both the fly-in
// and the slide into slow motion are curves. Only the end is a cut: the
// reset puts the skis back on the track, often a long way off, and a lens
// swept across the map to it would be the worse picture.
//
// SLOW MOTION is fewer engine steps per frame and nothing else, the same
// lever the replay's director pulls (`replay-shots.ts`): the run, its clock
// and every rival are the ones the player would have had at full speed.
// The cam hands the app its `rate`; the app steps `rate` of a frame.
//
// Three-free: `frameDeath` turns the body as drawn into a `LensPose` and
// the renderer applies it. All time here is WALL time — the lens moves at
// its own pace while the world crawls.

import { TUNING, type Thrown } from "@engine";

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import type { LensPose, LineClear, Vec3 } from "./camera-rigs.ts";

/** The whole cam, as numbers. Metres, seconds (wall), degrees, radians. */
export const DEATH = {
  /** THE TIME RATE: its floor, at the impact; how many seconds of his fall
   * still to go the dip starts at (sim); how long it holds at the floor
   * after he meets the snow; the share the slide and the rise run at. */
  slow: 0.2,
  lead: 0.8,
  hold: 0.45,
  lie: 0.7,
  /** How briskly the rate chases its target going in and coming back, 1/s. */
  ease: 4,
  easeOut: 4,
  /** THE FOLLOW: the lens's bearing off the line he was thrown along, rad;
   * its arm from the body, far to near, drawn in over `zoom` s; its height
   * over him; the zoom's end, deg. */
  side: 0.75,
  far: 6.5,
  near: 4.2,
  zoom: 1.6,
  height: 1.3,
  fovNear: 40,
  /** How fast the lens, its aim and its zoom chase what they want, 1/s. */
  eyeRate: 4,
  aimRate: 9,
  fovRate: 2.2,
  /** THE RISE: the height it climbs to over `rise` s and on at `climb` m/s
   * after; the arm off the vertical it ends on (so it looks nearly straight
   * down); the lens's pace up there; the zoom it opens to. */
  top: 24,
  rise: 1.8,
  climb: 2.5,
  over: 3,
  riseRate: 3,
  fovRise: 48,
  /** THE SWAY: how far the lens drifts side to side, m, how far the
   * horizon tips, rad, and the period, s. */
  swayDrift: 0.8,
  swayRoll: 0.09,
  swayPeriod: 4.4,
  /** Never closer to the snow than this, m, and never drawn closer to him
   * than `pullMin` by what stands between. */
  clearance: 0.7,
  pullMin: 1.2,
} as const;

export type DeathCam = {
  /** Whether the lens is his: a body is down and the cam has engaged. */
  active: boolean;
  /** The time rate to step the run at, 0..1 — 1 when idle. */
  rate: number;
  /** Set on the frame the cam lets go (the reset), so the ladder snaps. */
  ended: boolean;
  /** Wall seconds since it engaged; since he first met the snow and since
   * he lay still (−1: not yet). */
  age: number;
  impactAge: number;
  restAge: number;
  /** Which side of his line the lens flies on, ±1. */
  side: number;
  eye: Vec3;
  aim: Vec3;
  fov: number;
  roll: number;
  /** The arm when the rise began: its bearing, its reach and its height. */
  restDir: { x: number; z: number };
  restReach: number;
  restHeight: number;
};

export function createDeathCam(): DeathCam {
  return {
    active: false,
    rate: 1,
    ended: false,
    age: 0,
    impactAge: -1,
    restAge: -1,
    side: 1,
    eye: { x: 0, y: 0, z: 0 },
    aim: { x: 0, y: 0, z: 0 },
    fov: 60,
    roll: 0,
    restDir: { x: 0, z: 1 },
    restReach: DEATH.near,
    restHeight: DEATH.height,
  };
}

/** Put the cam down: the lens back to the ladder, the rate back to 1. */
export function dropDeathCam(st: DeathCam): void {
  st.active = false;
  st.rate = 1;
  st.ended = false;
}

const smooth = (x: number): number => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const chase = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

/** Seconds (sim) before a body falling from `over` m above the snow at `vy`
 * m/s (up positive) meets it. */
export function fallLeft(over: number, vy: number): number {
  const g = TUNING.g;
  return (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * Math.max(0, over)))) / g;
}

/** What the time rate wants this frame. */
function rateWanted(st: DeathCam, body: Thrown | null, ground: number): number {
  if (!body) return 1;
  if (st.impactAge < 0) {
    const left = fallLeft(body.y - TUNING.crash.radius - ground, body.vy);
    return DEATH.slow + (1 - DEATH.slow) * smooth(left / DEATH.lead);
  }
  if (st.impactAge < DEATH.hold) return DEATH.slow;
  return DEATH.lie;
}

/** One frame of the cam, `real` wall seconds after the last. `body` is the
 * skier thrown as drawn, or null on his skis; `from` is the ladder's lens
 * this frame, which the cam flies off. Returns the lens to draw, or null
 * for the ladder's own. */
export function frameDeath(
  st: DeathCam,
  body: Thrown | null,
  from: LensPose,
  real: number,
  groundAt: (x: number, z: number) => number,
  clear?: LineClear,
): LensPose | null {
  st.ended = false;
  const ground = body ? groundAt(body.x, body.z) : 0;
  if (!body) {
    if (st.active) {
      st.active = false;
      st.ended = true;
    }
    st.rate += (1 - st.rate) * chase(DEATH.easeOut, real);
    if (st.rate > 0.999) st.rate = 1;
    return null;
  }
  if (!st.active) engage(st, body, from);
  st.age += real;
  // THE IMPACT is the body coming DOWN onto the snow. A skier is thrown
  // off his own two feet, so his first frame in the snow is the launch —
  // read that as the landing and the whole dip would be over before the
  // fall began.
  if (st.impactAge < 0 && body.touching && body.vy <= 0) st.impactAge = 0;
  else if (st.impactAge >= 0) st.impactAge += real;
  const want = rateWanted(st, body, ground);
  st.rate += (want - st.rate) * chase(want < st.rate ? DEATH.ease : DEATH.easeOut, real);

  const eye = { x: 0, y: 0, z: 0 };
  let fov: number;
  let eyeRate: number;
  let roll = 0;
  if (body.still > 0) {
    if (st.restAge < 0) beginRise(st, body);
    st.restAge += real;
    const u = st.restAge;
    const s = smooth(u / DEATH.rise);
    const h =
      st.restHeight + (DEATH.top - st.restHeight) * s + DEATH.climb * Math.max(0, u - DEATH.rise);
    const r = st.restReach + (DEATH.over - st.restReach) * s;
    const sway = smooth(u);
    const phase = (2 * Math.PI * u) / DEATH.swayPeriod;
    const drift = DEATH.swayDrift * Math.sin(phase) * sway;
    const d = st.restDir;
    eye.x = body.x + d.x * r + d.z * drift;
    eye.y = body.y + h;
    eye.z = body.z + d.z * r - d.x * drift;
    roll = DEATH.swayRoll * Math.sin(phase * 0.77 + 0.9) * sway;
    fov = DEATH.fovRise;
    eyeRate = DEATH.riseRate;
  } else {
    const z = smooth(st.age / DEATH.zoom);
    const arm = DEATH.far + (DEATH.near - DEATH.far) * z;
    armAt(body, st.side, arm, eye);
    fov = DEATH.fovNear;
    eyeRate = DEATH.eyeRate;
  }
  if (clear) pullIn(eye, body, clear);

  const ke = chase(eyeRate, real);
  st.eye.x += (eye.x - st.eye.x) * ke;
  st.eye.y += (eye.y - st.eye.y) * ke;
  st.eye.z += (eye.z - st.eye.z) * ke;
  const floor = groundAt(st.eye.x, st.eye.z) + DEATH.clearance;
  if (st.eye.y < floor) st.eye.y = floor;
  const ka = chase(DEATH.aimRate, real);
  st.aim.x += (body.x - st.aim.x) * ka;
  st.aim.y += (body.y - st.aim.y) * ka;
  st.aim.z += (body.z - st.aim.z) * ka;
  st.fov += (fov - st.fov) * chase(DEATH.fovRate, real);
  st.roll += (roll - st.roll) * chase(DEATH.eyeRate, real);
  return {
    eye: { ...st.eye },
    target: { ...st.aim },
    fov: st.fov,
    roll: st.roll,
  };
}

/** The follow lens's place for an arm of `arm` m on `side`. */
function armAt(body: Thrown, side: number, arm: number, out: Vec3): Vec3 {
  const h = body.heading + side * DEATH.side;
  out.x = body.x - Math.sin(h) * arm;
  out.y = body.y + DEATH.height;
  out.z = body.z - Math.cos(h) * arm;
  return out;
}

/** Take the lens off the ladder: start from where it is, on the side of
 * his line it is already nearest. */
function engage(st: DeathCam, body: Thrown, from: LensPose): void {
  st.active = true;
  st.age = 0;
  st.impactAge = -1;
  st.restAge = -1;
  const a = armAt(body, 1, DEATH.far, { x: 0, y: 0, z: 0 });
  const b = armAt(body, -1, DEATH.far, { x: 0, y: 0, z: 0 });
  const da = Math.hypot(a.x - from.eye.x, a.z - from.eye.z);
  const db = Math.hypot(b.x - from.eye.x, b.z - from.eye.z);
  st.side = da <= db ? 1 : -1;
  st.eye = { ...from.eye };
  st.aim = { ...from.target };
  st.fov = from.fov;
  st.roll = from.roll;
}

/** He has stopped: the rise starts from where the lens is. */
function beginRise(st: DeathCam, body: Thrown): void {
  st.restAge = 0;
  const dx = st.eye.x - body.x;
  const dz = st.eye.z - body.z;
  const reach = Math.hypot(dx, dz);
  st.restDir = reach > 1e-3 ? { x: dx / reach, z: dz / reach } : { x: 0, z: -1 };
  st.restReach = Math.max(DEATH.over, reach);
  st.restHeight = st.eye.y - body.y;
}

/** Draw the lens in toward him to what is clear of trunks and crowns. */
function pullIn(eye: Vec3, body: Thrown, clear: LineClear): void {
  const pivot = { x: body.x, y: body.y + 0.4, z: body.z };
  const len = Math.hypot(eye.x - pivot.x, eye.y - pivot.y, eye.z - pivot.z);
  if (len <= DEATH.pullMin) return;
  const share = clear(pivot, eye);
  if (share >= 1) return;
  const s = Math.max(DEATH.pullMin / len, share * 0.9);
  eye.x = pivot.x + (eye.x - pivot.x) * s;
  eye.y = pivot.y + (eye.y - pivot.y) * s;
  eye.z = pivot.z + (eye.z - pivot.z) * s;
}
