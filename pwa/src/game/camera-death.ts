// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEATH CAM — the skier thrown, shot as a scene rather than ridden.
//
// The moment the engine puts the player off his skis (`crash.ts`'s
// `Thrown`), the lens leaves the ladder and goes after HIM: it flies off
// whatever rung it was on to a low lens beside and behind the body, on the
// side of the line he was thrown along that it was already nearest, and
// closes in on him as he goes — the zoom narrowing and the arm drawing in.
// When he has stopped (`Thrown.still`) the lens TILTS DOWN ON HIM AND
// RISES: it swings in over the body looking down and climbs into the sky,
// swaying, until the reset stands him up and the picture cuts back to the
// ladder.
//
// THE FALL RUNS AT FULL SPEED. There is no slow motion: the fall is the
// player's to watch, and the engine holds him down for it — no press of his
// stands him up for `crash.getUp` s, and the engine does at `crash.lieFor`
// — so the lens has seconds over him to fill, and climbs slowly enough to
// keep him in the frame through them. (The replay's director still slows
// its own moments, `replay-shots.ts`.)
//
// EVERY MOVE IS EASED, NOTHING IS CUT IN. The lens, its aim and its zoom
// chase what the phase wants at their own rates from wherever the ladder
// left them, so the fly-in is a curve. Only the end is a cut: the reset
// puts the skis back on the track, often a long way off, and a lens swept
// across the map to it would be the worse picture.
//
// Three-free: `frameDeath` turns the body as drawn into a `LensPose` and
// the renderer applies it.

import type { Thrown } from "@engine";

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import type { LensPose, LineClear, Vec3 } from "./camera-rigs.ts";

/** The whole cam, as numbers. Metres, seconds, degrees, radians. */
export const DEATH = {
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
  rise: 1.2,
  climb: 1,
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
  /** Set on the frame the cam lets go (the reset), so the ladder snaps. */
  ended: boolean;
  /** Seconds since it engaged, and since he lay still (−1: not yet). */
  age: number;
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
    ended: false,
    age: 0,
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

/** Put the cam down: the lens back to the ladder. */
export function dropDeathCam(st: DeathCam): void {
  st.active = false;
  st.ended = false;
}

const smooth = (x: number): number => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const chase = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

/** One frame of the cam, `dt` seconds after the last. `body` is the skier
 * thrown as drawn, or null on his skis; `from` is the ladder's lens this
 * frame, which the cam flies off. Returns the lens to draw, or null for the
 * ladder's own. */
export function frameDeath(
  st: DeathCam,
  body: Thrown | null,
  from: LensPose,
  dt: number,
  groundAt: (x: number, z: number) => number,
  clear?: LineClear,
): LensPose | null {
  st.ended = false;
  if (!body) {
    if (st.active) {
      st.active = false;
      st.ended = true;
    }
    return null;
  }
  if (!st.active) engage(st, body, from);
  st.age += dt;

  const eye = { x: 0, y: 0, z: 0 };
  let fov: number;
  let eyeRate: number;
  let roll = 0;
  if (body.still > 0) {
    if (st.restAge < 0) beginRise(st, body);
    st.restAge += dt;
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

  const ke = chase(eyeRate, dt);
  st.eye.x += (eye.x - st.eye.x) * ke;
  st.eye.y += (eye.y - st.eye.y) * ke;
  st.eye.z += (eye.z - st.eye.z) * ke;
  const floor = groundAt(st.eye.x, st.eye.z) + DEATH.clearance;
  if (st.eye.y < floor) st.eye.y = floor;
  const ka = chase(DEATH.aimRate, dt);
  st.aim.x += (body.x - st.aim.x) * ka;
  st.aim.y += (body.y - st.aim.y) * ka;
  st.aim.z += (body.z - st.aim.z) * ka;
  st.fov += (fov - st.fov) * chase(DEATH.fovRate, dt);
  st.roll += (roll - st.roll) * chase(DEATH.eyeRate, dt);
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
