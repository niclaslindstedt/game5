// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE'S GEOMETRY in the physics' body frame (`bike-body.ts`):
// `BIKE`'s chart numbers, stated from the bottom bracket, carried onto the
// bike's own centre of mass, the steer axis and the fork's offset laid out,
// and each end's spring rated to the rider who sets its sag — worked once
// and read by the physics, the pose (`bike-pose.ts`) and the labs.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { BIKE, type BikeEnd } from "./defs/bike.ts";

const DEG = Math.PI / 180;
const G = 9.81;

/** A body-frame point or direction, m. */
export type V3 = { x: number; y: number; z: number };

const eps = BIKE.headAngle * DEG;
/** The steer axis, up and back along the head tube (body frame). */
export const STEER_AXIS: V3 = { x: 0, y: Math.sin(eps), z: -Math.cos(eps) };
/** Square to it, forward: the way the fork's offset points. */
export const OFFSET_DIR: V3 = { x: 0, y: Math.cos(eps), z: Math.sin(eps) };
/** The rear axle's path as it compresses (body frame, unit). */
export const REAR_PATH: V3 = (() => {
  const n = hypot(BIKE.rearPath.y, BIKE.rearPath.z);
  return { x: 0, y: BIKE.rearPath.y / n, z: BIKE.rearPath.z / n };
})();

/** The bottom bracket from the bike's centre of mass, body frame, m. */
export const BB: V3 = { x: 0, y: -BIKE.com.y, z: -BIKE.com.z };

/** Each axle with its end FULLY EXTENDED, body frame from the bike's centre
 * of mass, m: the chart's sagged axle less the sag along its path. */
export const REAR_AXLE: V3 = {
  x: 0,
  y: BB.y + BIKE.rearAxle.y - BIKE.rearEnd.sag * BIKE.rearEnd.travel * REAR_PATH.y,
  z: BB.z + BIKE.rearAxle.z - BIKE.rearEnd.sag * BIKE.rearEnd.travel * REAR_PATH.z,
};
const frontFull: V3 = {
  x: 0,
  y: BB.y + BIKE.frontAxle.y - BIKE.frontEnd.sag * BIKE.frontEnd.travel * STEER_AXIS.y,
  z: BB.z + BIKE.frontAxle.z - BIKE.frontEnd.sag * BIKE.frontEnd.travel * STEER_AXIS.z,
};
/** A point on the steer axis, body frame, m: the front axle stands
 * `BIKE.offset` ahead of it, square to it. */
export const STEER_AT: V3 = {
  x: 0,
  y: frontFull.y - BIKE.offset * OFFSET_DIR.y,
  z: frontFull.z - BIKE.offset * OFFSET_DIR.z,
};

/** The wheelbase at sag, m. */
export const WHEELBASE = BIKE.frontAxle.z - BIKE.rearAxle.z;
/** The trail, m: `(R cos ε − d) / sin ε`. */
export const TRAIL = (BIKE.front.radius * Math.cos(eps) - BIKE.offset) / Math.sin(eps);

/** THE FRONT AXLE steered `steer` rad and compressed `comp` m, body frame,
 * into `out`: about the steer axis through `STEER_AT`, the offset swung
 * with the bars, the fork sliding up its axis. */
export function frontAxleAt(steer: number, comp: number, out: V3): V3 {
  const c = Math.cos(steer);
  const s = Math.sin(steer);
  const d = BIKE.offset;
  // The offset turned about the axis: n cos δ + (a × n) sin δ, a × n = x̂.
  out.x = STEER_AT.x + d * s + comp * STEER_AXIS.x;
  out.y = STEER_AT.y + d * OFFSET_DIR.y * c + comp * STEER_AXIS.y;
  out.z = STEER_AT.z + d * OFFSET_DIR.z * c + comp * STEER_AXIS.z;
  return out;
}

/** THE FRONT WHEEL'S AXLE DIRECTION steered `steer` rad, body frame (the
 * right-hand unit vector turned about the steer axis). */
export function frontSpindle(steer: number, out: V3): V3 {
  const c = Math.cos(steer);
  const s = Math.sin(steer);
  out.x = c;
  out.y = STEER_AXIS.z * s;
  out.z = -STEER_AXIS.y * s;
  return out;
}

/** ONE END'S SPRING, rated to a rider: the force at `comp` m of travel,
 * N, with its rate at sag k0 (1 + a s / T) rising to `progression` × at
 * full travel; and its damper's critical share, N·s/m. */
export type EndSpring = {
  /** The base rate, N/m, and the progression term. */
  k0: number;
  a: number;
  travel: number;
  /** The damper at the stated ratio, N·s/m. */
  damping: number;
  /** The force at sag, N (what the rider's weight settles it to). */
  atSag: number;
  end: BikeEnd;
};

export function springForce(e: EndSpring, s: number): number {
  return e.k0 * (s + (e.a * s * s) / (2 * e.travel));
}

function rate(end: BikeEnd, load: number): EndSpring {
  const T = end.travel;
  const s = end.sag * T;
  const a = (end.progression - 1) / (1 - end.progression * end.sag);
  const k0 = load / (s + (a * s * s) / (2 * T));
  const kSag = k0 * (1 + (a * s) / T);
  const damping = 2 * end.zeta * Math.sqrt(kSag * (load / G));
  return { k0, a, travel: T, damping, atSag: load, end };
}

/** THE TWO ENDS rated to a rider of `mass` kg standing in the attack
 * stance — his weight and the bike's shared between the axles by where the
 * two centres of mass stand, carried along each end's path. */
export function springsFor(mass: number): { front: EndSpring; rear: EndSpring } {
  const hit = springCache.get(mass);
  if (hit) return hit;
  const M = BIKE.mass + mass;
  const zc = (BIKE.mass * BIKE.com.z + mass * BIKE.rider.stand.z) / M;
  const zr = BIKE.rearAxle.z;
  const zf = BIKE.frontAxle.z;
  const nf = (M * G * (zc - zr)) / (zf - zr);
  const nr = M * G - nf;
  // The wheels ride massless under the frame (the bike's mass is all on
  // it), so each end carries its axle's whole share along its path.
  const out = {
    front: rate(BIKE.frontEnd, nf * STEER_AXIS.y),
    rear: rate(BIKE.rearEnd, nr * REAR_PATH.y),
  };
  springCache.set(mass, out);
  return out;
}

const springCache = new Map<number, { front: EndSpring; rear: EndSpring }>();
