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
//   TIPS / HELMET  the RIDER'S EYE: from his helmet on the skid, out over
//          his skis and down at the snow he is about to push off into.
//
// Every lens is kept clear of the snow, and none is ever inside the disc.

import { HELI, type HeliState } from "@engine";

import type { LensPose } from "./camera-rigs.ts";
import type { CameraRung } from "./renderer-api.ts";

/** Per rung: the standoff behind the machine, m, and what each m/s of
 * speed adds; the height over its middle, m; how far ahead of it the look
 * aims, m; the fov, deg. */
export const HELI_LOOK = {
  chase: { dist: 15, distPerSpeed: 0.08, height: 4.2, ahead: 8, fov: 60 },
  far: { dist: 46, distPerSpeed: 0.2, height: 15, ahead: 14, fov: 58 },
  high: { dist: 10, distPerSpeed: 0.1, height: 42, ahead: 4, fov: 64 },
  /** The rider's eye: over his seat by `up` m, out over the skid by `out`
   * m; the look out and down, and its fov. */
  eye: { up: 1.05, out: 0.25, lookOut: 6, lookFwd: 3, lookDown: 3, fov: 80 },
  /** How briskly the boom swings after the heading, 1/s, and the share of
   * the way it is going it leans toward at speed. */
  yaw: 2.2,
  travel: 0.5,
  /** The least gap kept from the snow, m. */
  clearance: 2.5,
} as const;

/** The boom's memory between frames. */
export type HeliCam = { yaw: number; fresh: boolean };

export function createHeliCam(): HeliCam {
  return { yaw: 0, fresh: true };
}

/** A body-frame offset off the helicopter's attitude, without its roll and
 * pitch beyond what a lens wants: heading only. */
function flat(h: number, x: number, z: number): { x: number; z: number } {
  const s = Math.sin(h);
  const c = Math.cos(h);
  return { x: c * x + s * z, z: -s * x + c * z };
}

/** ONE FRAME OF THE HELICOPTER'S LENS on rung `rung`, `dt` s after the
 * last, the machine drawn at `at` (its skid datum and heading). */
export function frameHeli(
  cam: HeliCam,
  h: HeliState,
  at: { x: number; y: number; z: number; heading: number },
  rung: CameraRung,
  dt: number,
  groundAt: (x: number, z: number) => number,
): LensPose {
  const speed = Math.hypot(h.vx, h.vz);
  const centre = { x: at.x, y: at.y + HELI.cog + 0.6, z: at.z };
  if (rung === "tips" || rung === "helmet") {
    // THE RIDER'S EYE, off the seat on the right skid.
    const E = HELI_LOOK.eye;
    // `HELI` is stated as the model is drawn; the body frame's x is turned
    // (`heli.ts`'s `SEAT`).
    const seat = flat(at.heading, -(HELI.seat.x + E.out), HELI.seat.z);
    const eye = { x: at.x + seat.x, y: at.y + HELI.seat.y + h.hang + E.up, z: at.z + seat.z };
    const look = flat(at.heading, -E.lookOut, E.lookFwd);
    cam.fresh = true;
    return {
      eye,
      target: { x: eye.x + look.x, y: eye.y - E.lookDown, z: eye.z + look.z },
      fov: E.fov,
      roll: h.roll * 0.5,
    };
  }
  const L = rung === "far" ? HELI_LOOK.far : rung === "high" ? HELI_LOOK.high : HELI_LOOK.chase;
  // The boom's bearing: the heading, leant toward the way it is going at
  // speed, followed on a spring.
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
  cam.fresh = false;
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
