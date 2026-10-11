// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ENGINE'S EULER ANGLES INTO A QUATERNION THE VIEW HOLDS, with nothing
// allocated: the framework's `core/quat` `fromEuler` builds three axis
// quaternions and two products as fresh objects, which a view posing every
// carrier of every lift each frame turns into thousands of objects a
// frame. The same arithmetic in the same order, written into `out`, so the
// numbers are the very ones `fromEuler` returns to the bit.

import { hypot4 } from "@niclaslindstedt/oss-game-framework/core/math";

/** Anything with a quaternion's four numbers to write. */
type QuatOut = { x: number; y: number; z: number; w: number };

/** `fromEuler(heading, pitch, roll)` into `out`: yaw, then pitch about the
 * yawed right axis (nose up positive), then roll about the forward axis
 * (right side down positive). Returns `out`. */
export function eulerInto<Q extends QuatOut>(
  out: Q,
  heading: number,
  pitch: number,
  roll: number,
): Q {
  // fromAxisAngle(0, 1, 0, heading), (1, 0, 0, −pitch), (0, 0, 1, −roll).
  const sy = Math.sin(heading * 0.5);
  const ax = 0 * sy;
  const ay = 1 * sy;
  const az = 0 * sy;
  const aw = Math.cos(heading * 0.5);
  const sx = Math.sin(-pitch * 0.5);
  const bx = 1 * sx;
  const by = 0 * sx;
  const bz = 0 * sx;
  const bw = Math.cos(-pitch * 0.5);
  const sz = Math.sin(-roll * 0.5);
  const cx = 0 * sz;
  const cy = 0 * sz;
  const cz = 1 * sz;
  const cw = Math.cos(-roll * 0.5);
  // multiply(a, b): rotate by b first, then by a.
  const mx = aw * bx + ax * bw + ay * bz - az * by;
  const my = aw * by - ax * bz + ay * bw + az * bx;
  const mz = aw * bz + ax * by - ay * bx + az * bw;
  const mw = aw * bw - ax * bx - ay * by - az * bz;
  // multiply(m, c).
  let x = mw * cx + mx * cw + my * cz - mz * cy;
  let y = mw * cy - mx * cz + my * cw + mz * cx;
  let z = mw * cz + mx * cy - my * cx + mz * cw;
  let w = mw * cw - mx * cx - my * cy - mz * cz;
  // normalize.
  const n = hypot4(x, y, z, w) || 1;
  x /= n;
  y /= n;
  z /= n;
  w /= n;
  out.x = x;
  out.y = y;
  out.z = z;
  out.w = w;
  return out;
}
