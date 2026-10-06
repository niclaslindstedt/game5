// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS ON THE HELICOPTER (`heli.ts`) — three-free, so the suite reads
// it. While the skier sits on its skid the ladder's lenses, built to frame
// a skier a metre tall, would sit inside a thirteen-metre airframe; so the
// helicopter takes the lens, rung by rung, and hands it back to the ladder
// the moment he pushes off:
//
//   CHASE  behind and over the machine, swung round after its heading on a
//          spring and leant toward the way it is going at speed — the
//          arcade's chase view of a helicopter, the rider on the near skid
//          in the frame;
//   FAR    the same further out and higher, the mountain round it;
//   HIGH   high over it looking down, the snow under it and the drop;
//   TIPS   THE NOSE: a lens bolted under the chin, ahead of the airframe,
//          looking out along the nose — it pitches, rolls and shakes with
//          the machine, the slope coming up at it in a dive;
//   HELMET THE NOSE LOOKING DOWN: the same place on a level mount, turned
//          only with the heading and tipped down at the snow ahead — the
//          lens a landing or a drop is aimed with.
//
// A change of rung is FLOWN, never cut: for `HANDOVER` s both rungs are
// framed and the lens is flown from the one to the other, as the skier's
// ladder does (`camera.ts`) — but ROUND the machine rather than through
// it (`orbitBlend`): from the chase behind it to the nose ahead of it a
// straight line runs through the cabin. Every lens is kept clear of the
// snow, and none is ever inside the disc.

import { HELI, rotate, type HeliState, type Quat } from "@engine";

import { blendLens, HANDOVER, type LensPose } from "./camera-rigs.ts";
import type { CameraRung } from "./renderer-api.ts";

/** Per rung: the standoff behind the machine, m, and what each m/s of
 * speed adds; the height over its middle, m; how far ahead of it the look
 * aims, m; the fov, deg. */
export const HELI_LOOK = {
  chase: { dist: 15, distPerSpeed: 0.08, height: 4.2, ahead: 8, fov: 60 },
  far: { dist: 46, distPerSpeed: 0.2, height: 15, ahead: 14, fov: 58 },
  high: { dist: 10, distPerSpeed: 0.1, height: 42, ahead: 4, fov: 64 },
  /** The nose lens, in the body frame (y up from the skid datum, z
   * forward): `out` m ahead of the nose's tip at height `up`; how
   * far down it looks, rad, and its fov, deg — `bolted` the chin camera
   * that turns with the whole machine, `level` the look-down one turned
   * only with its heading. */
  nose: {
    up: 1.02,
    out: 0.35,
    bolted: { down: 0.14, fov: 74 },
    level: { down: 0.62, fov: 70 },
  },
  /** How briskly the boom swings after the heading, 1/s, and the share of
   * the way it is going it leans toward at speed. */
  yaw: 2.2,
  travel: 0.5,
  /** The least gap kept from the snow, m — the booms', and the nose's. */
  clearance: 2.5,
  noseClearance: 0.4,
  /** The least the lens stands off the machine's middle half-way through
   * a hand-over, m: clear of the rotor's tips. */
  orbit: 7,
} as const;

/** THE MACHINE'S MIDDLE as drawn, which a hand-over flies round. */
export function heliMiddleOf(at: HeliAt): { x: number; y: number; z: number } {
  const off = flat(at.heading, 0, (HELI.body.nose + HELI.body.tail) / 2);
  return { x: at.x + off.x, y: at.y + HELI.cog + 0.6, z: at.z + off.z };
}

/** A HAND-OVER FLOWN ROUND `centre`, `t` 0..1 through it, eased: the eye
 * swung about it — its bearing, its height over it and its standoff each
 * eased from the one lens's to the other's, the bearing the short way
 * round — and kept `least` m off it in the middle of the move, so it
 * never cuts through the airframe; the look, the fov and the roll
 * blended as `blendLens` does. */
export function orbitBlend(
  a: LensPose,
  b: LensPose,
  t: number,
  centre: { x: number; y: number; z: number },
  least: number = HELI_LOOK.orbit,
): LensPose {
  const s = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const lens = blendLens(a, b, t);
  const ax = a.eye.x - centre.x;
  const az = a.eye.z - centre.z;
  const bx = b.eye.x - centre.x;
  const bz = b.eye.z - centre.z;
  const ra = Math.hypot(ax, az);
  const rb = Math.hypot(bx, bz);
  const ba = Math.atan2(ax, az);
  let turn = Math.atan2(bx, bz) - ba;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  const bearing = ba + turn * s;
  const r = Math.max(ra + (rb - ra) * s, least * Math.sin(Math.PI * s));
  lens.eye.x = centre.x + Math.sin(bearing) * r;
  lens.eye.z = centre.z + Math.cos(bearing) * r;
  return lens;
}

/** The boom's memory between frames: its bearing, whether it starts afresh
 * on the next frame, whether a change of rung on the next frame is cut
 * rather than flown, and the hand-over between two rungs — the rung framed last, the
 * one it is being flown from and the seconds since. */
export type HeliCam = {
  yaw: number;
  fresh: boolean;
  cut: boolean;
  rung: CameraRung | null;
  from: CameraRung | null;
  since: number;
};

export function createHeliCam(): HeliCam {
  return { yaw: 0, fresh: true, cut: false, rung: null, from: null, since: HANDOVER };
}

/** The machine as drawn: its skid datum, heading and attitude. */
export type HeliAt = { x: number; y: number; z: number; heading: number; q?: Quat };

/** A body-frame offset off the helicopter's heading alone. */
function flat(h: number, x: number, z: number): { x: number; z: number } {
  const s = Math.sin(h);
  const c = Math.cos(h);
  return { x: c * x + s * z, z: -s * x + c * z };
}

/** The boom's bearing stepped `dt` on: the heading, leant toward the way
 * it is going at speed, followed on a spring. */
function stepYaw(cam: HeliCam, h: HeliState, at: HeliAt, dt: number): void {
  const speed = Math.hypot(h.vx, h.vz);
  const travel = speed > 3 ? Math.atan2(h.vx, h.vz) : at.heading;
  let lean = travel - at.heading;
  lean = Math.atan2(Math.sin(lean), Math.cos(lean));
  const want = at.heading + lean * HELI_LOOK.travel * Math.min(1, speed / 25);
  if (cam.fresh) cam.yaw = want;
  else {
    let d = want - cam.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    cam.yaw += d * (1 - Math.exp(-HELI_LOOK.yaw * dt));
  }
}

/** THE NOSE LENS: bolted under the chin (`tips`) or level and looking
 * down (`helmet`). */
function noseLens(
  h: HeliState,
  at: HeliAt,
  bolted: boolean,
  groundAt: (x: number, z: number) => number,
): LensPose {
  const N = HELI_LOOK.nose;
  const z = HELI.body.nose + N.out;
  const L = bolted ? N.bolted : N.level;
  const q = at.q;
  let eye: { x: number; y: number; z: number };
  let look: { x: number; y: number; z: number };
  const ahead = { x: 0, y: -Math.sin(L.down), z: Math.cos(L.down) };
  if (bolted && q) {
    const off = rotate(q, { x: 0, y: N.up, z });
    eye = { x: at.x + off.x, y: at.y + off.y, z: at.z + off.z };
    look = rotate(q, ahead);
  } else {
    const off = flat(at.heading, 0, z);
    eye = { x: at.x + off.x, y: at.y + N.up, z: at.z + off.z };
    const f = flat(at.heading, 0, ahead.z);
    look = { x: f.x, y: ahead.y, z: f.z };
  }
  eye.y = Math.max(eye.y, groundAt(eye.x, eye.z) + HELI_LOOK.noseClearance);
  const reach = 30;
  return {
    eye,
    target: { x: eye.x + look.x * reach, y: eye.y + look.y * reach, z: eye.z + look.z * reach },
    fov: L.fov,
    // The bolted lens's roll is in its attitude already when it has one;
    // the level mount keeps the horizon level.
    roll: bolted && !q ? h.roll : 0,
  };
}

/** THE LENS ON RUNG `rung` this frame, off the boom's bearing as it
 * stands — a pure function of the machine, the bearing and the snow. */
export function heliLens(
  cam: HeliCam,
  h: HeliState,
  at: HeliAt,
  rung: CameraRung,
  groundAt: (x: number, z: number) => number,
): LensPose {
  if (rung === "tips" || rung === "helmet") return noseLens(h, at, rung === "tips", groundAt);
  const L = rung === "far" ? HELI_LOOK.far : rung === "high" ? HELI_LOOK.high : HELI_LOOK.chase;
  const speed = Math.hypot(h.vx, h.vz);
  const centre = { x: at.x, y: at.y + HELI.cog + 0.6, z: at.z };
  const dist = L.dist + L.distPerSpeed * speed;
  const fx = Math.sin(cam.yaw);
  const fz = Math.cos(cam.yaw);
  const eye = {
    x: centre.x - fx * dist,
    y: centre.y + L.height,
    z: centre.z - fz * dist,
  };
  eye.y = Math.max(eye.y, groundAt(eye.x, eye.z) + HELI_LOOK.clearance);
  return {
    eye,
    target: { x: centre.x + fx * L.ahead, y: centre.y, z: centre.z + fz * L.ahead },
    fov: L.fov,
    roll: 0,
  };
}

/** ONE FRAME OF THE HELICOPTER'S LENS on rung `rung`, `dt` s after the
 * last, the machine drawn at `at` — flown across from the rung before for
 * `HANDOVER` s after a change. */
export function frameHeli(
  cam: HeliCam,
  h: HeliState,
  at: HeliAt,
  rung: CameraRung,
  dt: number,
  groundAt: (x: number, z: number) => number,
): LensPose {
  stepYaw(cam, h, at, dt);
  if (cam.fresh || (cam.cut && cam.rung !== rung)) {
    cam.from = null;
    cam.since = HANDOVER;
  } else if (cam.rung !== null && cam.rung !== rung) {
    // A change mid-blend flies on from the rung it was heading for, as the
    // skier's ladder does.
    cam.from = cam.rung;
    cam.since = 0;
  }
  cam.fresh = false;
  cam.cut = false;
  cam.rung = rung;
  const lens = heliLens(cam, h, at, rung, groundAt);
  if (cam.from === null || cam.since >= HANDOVER) {
    cam.from = null;
    return lens;
  }
  cam.since += dt;
  const from = heliLens(cam, h, at, cam.from, groundAt);
  const out = orbitBlend(from, lens, cam.since / HANDOVER, heliMiddleOf(at));
  out.eye.y = Math.max(out.eye.y, groundAt(out.eye.x, out.eye.z) + HELI_LOOK.noseClearance);
  return out;
}
