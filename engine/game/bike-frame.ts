// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE'S FRAME OF REFERENCE (`bike-body.ts`): its rotation as a matrix
// (columns right, up, forward), body ↔ world, the rider's stance target on
// it, and what is read off the state — the angles, the speeds, the centre of
// mass, where the rider stands on the frame. Scratch held here is the one
// matrix the step fills; nothing draws from any stream.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { toEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { BIKE } from "./defs/bike.ts";
import { BB, type V3 } from "./bike-geometry.ts";
import type { BikeControls, BikeState } from "./bike-state.ts";

const G = 9.81;
const R = BIKE.rider;

/** The frame's rotation, columns right, up, forward — filled by `matrixOf`. */
export const m3 = new Float64Array(9);
export const v3 = (): V3 => ({ x: 0, y: 0, z: 0 });

export function matrixOf(q: { x: number; y: number; z: number; w: number }): void {
  const { x, y, z, w } = q;
  // Columns: the body's x (right), y (up), z (forward) in the world.
  m3[0] = 1 - 2 * (y * y + z * z);
  m3[1] = 2 * (x * y + w * z);
  m3[2] = 2 * (x * z - w * y);
  m3[3] = 2 * (x * y - w * z);
  m3[4] = 1 - 2 * (x * x + z * z);
  m3[5] = 2 * (y * z + w * x);
  m3[6] = 2 * (x * z + w * y);
  m3[7] = 2 * (y * z - w * x);
  m3[8] = 1 - 2 * (x * x + y * y);
}

/** Body → world (direction). */
export function toWorld(b: V3, out: V3): V3 {
  const x = b.x;
  const y = b.y;
  const z = b.z;
  out.x = m3[0] * x + m3[3] * y + m3[6] * z;
  out.y = m3[1] * x + m3[4] * y + m3[7] * z;
  out.z = m3[2] * x + m3[5] * y + m3[8] * z;
  return out;
}

/** World → body (direction). */
export function toBody(w: V3, out: V3): V3 {
  const x = w.x;
  const y = w.y;
  const z = w.z;
  out.x = m3[0] * x + m3[1] * y + m3[2] * z;
  out.y = m3[3] * x + m3[4] * y + m3[5] * z;
  out.z = m3[6] * x + m3[7] * y + m3[8] * z;
  return out;
}

export const cross = (a: V3, b: V3, out: V3): V3 => {
  const x = a.y * b.z - a.z * b.y;
  const y = a.z * b.x - a.x * b.z;
  const z = a.x * b.y - a.y * b.x;
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
};
export const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;

/** The rider's stance target in the body frame, from the bike's centre of
 * mass, under the controls: stood in the attack stance, back and low on the
 * lean back, forward on the lean forward, folded on the crouch — and lifted
 * by what his legs settle under his weight (they push him there). */
export function stanceOf(b: BikeState, ctl: BikeControls, out: V3): V3 {
  const back = Math.max(0, b.shift);
  const fore = Math.max(0, -b.shift);
  const sag = (b.riderMass * G) / R.rate.up;
  out.x = 0;
  const tuck = b.tuck > 0 ? R.crouch : 0;
  out.y = BB.y + R.stand.y - R.low * back - Math.max(R.crouch * ctl.crouch, tuck) + sag;
  out.z = BB.z + R.stand.z - R.back * back + R.forward * fore;
  return out;
}

/** The roll off the vertical, rad, right side down positive. */
export function rollOf(): number {
  return Math.atan2(-m3[1], m3[4]);
}

/** THE NUMBERS READ OFF THE FRAME each step. */
export function derive(b: BikeState): void {
  const e = toEuler(b.q);
  b.heading = e.heading;
  b.pitch = e.pitch;
  matrixOf(b.q);
  b.roll = rollOf();
  b.speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
  const fx = m3[6];
  const fz = m3[8];
  const fl = hypot(fx, fz) || 1;
  b.way = (b.vx * fx + b.vz * fz) / fl;
}

/** The system's centre of mass — the bike's and the rider's — world, m. */
export function massCentre(b: BikeState, out: V3): V3 {
  const M = BIKE.mass + b.riderMass;
  out.x = (BIKE.mass * b.x + b.riderMass * b.rider.x) / M;
  out.y = (BIKE.mass * b.y + b.riderMass * b.rider.y) / M;
  out.z = (BIKE.mass * b.z + b.riderMass * b.rider.z) / M;
  return out;
}

/** WHERE THE RIDER STANDS ON THE FRAME, body frame from the bottom bracket,
 * m (right, up, forward) — the pose's (`bike-pose.ts`). */
export function riderOnFrame(b: BikeState, out: V3): V3 {
  matrixOf(b.q);
  toBody({ x: b.rider.x - b.x, y: b.rider.y - b.y, z: b.rider.z - b.z }, out);
  out.x -= BB.x;
  out.y -= BB.y;
  out.z -= BB.z;
  return out;
}

/** Body → world for a caller, with the frame's rotation `q`. */
export function bikeToWorld(q: BikeState["q"], v: V3, out: V3): V3 {
  matrixOf(q);
  return toWorld(v, out);
}
