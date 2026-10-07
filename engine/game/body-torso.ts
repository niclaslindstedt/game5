// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRUNK'S FRAME off the ragdoll, for the body (`body.ts`): which way
// his right, his chest and his spine point this step, which side of him
// faced what he met, and how far a blow ran along his spine.

import { clamp, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import type { Facing } from "./defs/anatomy.ts";
import { RAGDOLL } from "./ragdoll.ts";

/** The body's frame off the ragdoll: its right and the way out of its
 * chest, unit vectors. */
const right: Vec3 = { x: 1, y: 0, z: 0 };
const chest: Vec3 = { x: 0, y: 0, z: 1 };
const spine: Vec3 = { x: 0, y: 1, z: 0 };
export function torsoOf(P: readonly number[]): void {
  const R = RAGDOLL;
  const hx = P[3 * R.hipR] - P[3 * R.hipL];
  const hy = P[3 * R.hipR + 1] - P[3 * R.hipL + 1];
  const hz = P[3 * R.hipR + 2] - P[3 * R.hipL + 2];
  const ux = (P[3 * R.shoulderL] + P[3 * R.shoulderR] - P[3 * R.hipL] - P[3 * R.hipR]) / 2;
  const uy =
    (P[3 * R.shoulderL + 1] + P[3 * R.shoulderR + 1] - P[3 * R.hipL + 1] - P[3 * R.hipR + 1]) / 2;
  const uz =
    (P[3 * R.shoulderL + 2] + P[3 * R.shoulderR + 2] - P[3 * R.hipL + 2] - P[3 * R.hipR + 2]) / 2;
  const ul = hypot3(ux, uy, uz) || 1;
  spine.x = ux / ul;
  spine.y = uy / ul;
  spine.z = uz / ul;
  const hl = hypot3(hx, hy, hz) || 1;
  right.x = hx / hl;
  right.y = hy / hl;
  right.z = hz / hl;
  // Out of the chest: right × up (x right, y up the spine, z out of it).
  const ox = right.y * uz - right.z * uy;
  const oy = right.z * ux - right.x * uz;
  const oz = right.x * uy - right.y * ux;
  const ol = hypot3(ox, oy, oz) || 1;
  chest.x = ox / ol;
  chest.y = oy / ol;
  chest.z = oz / ol;
}

/** Which side of the trunk faces what it met, `n` the way out of that
 * surface toward the body: his front when his chest faces into it. */
export function facingOf(nx: number, ny: number, nz: number): Facing {
  const d = chest.x * nx + chest.y * ny + chest.z * nz;
  if (d < -0.5) return "front";
  if (d > 0.5) return "back";
  return right.x * nx + right.y * ny + right.z * nz > 0 ? "left" : "right";
}

/** How far a blow along `n` (the way out of what he met) runs along his
 * spine, 0 … 1: from the head down it (`head`, a dive) or up it from the
 * seat (a fall on his backside, sat up). */
export function axialOf(nx: number, ny: number, nz: number, head: boolean): number {
  const d = spine.x * nx + spine.y * ny + spine.z * nz;
  return clamp(head ? -d : d, 0, 1);
}

/** How far a blow along `n` on a foot runs UP ITS LEG, 0 … 1: the leg's
 * own line from the foot (`foot`, a `RAGDOLL` index) to its hip. */
export function legAxialOf(
  P: readonly number[],
  foot: number,
  nx: number,
  ny: number,
  nz: number,
): number {
  const R = RAGDOLL;
  const hip = foot === R.footL ? R.hipL : R.hipR;
  const ux = P[3 * hip] - P[3 * foot];
  const uy = P[3 * hip + 1] - P[3 * foot + 1];
  const uz = P[3 * hip + 2] - P[3 * foot + 2];
  const l = hypot3(ux, uy, uz) || 1;
  return clamp((ux * nx + uy * ny + uz * nz) / l, 0, 1);
}
