// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RAGDOLL'S POINTS (`ragdoll.ts`), stated in a module that imports only
// the tuning, so anything may read their order, masses and radii without
// pulling in the whole fall: the hips, the shoulders, the head, the knees,
// the feet, the elbows and the hands.

import { TUNING } from "./defs/tuning.ts";

const K = TUNING.crash;
const B = K.body;
const M = B.mass;

/** The body's points, in the order `Thrown.points` keeps them (x y z each). */
export const RAGDOLL = {
  hipL: 0,
  hipR: 1,
  shoulderL: 2,
  shoulderR: 3,
  head: 4,
  kneeL: 5,
  kneeR: 6,
  footL: 7,
  footR: 8,
  elbowL: 9,
  elbowR: 10,
  handL: 11,
  handR: 12,
  count: 13,
} as const;

/** Each point's mass, kg, in `RAGDOLL` order. */
export const MASS: readonly number[] = [
  M.hip,
  M.hip,
  M.shoulder,
  M.shoulder,
  M.head,
  M.knee,
  M.knee,
  M.foot,
  M.foot,
  M.elbow,
  M.elbow,
  M.hand,
  M.hand,
];

/** Each point's radius, m: the torso's, the head's, a limb's. */
export const RADIUS: readonly number[] = [
  K.radius,
  K.radius,
  K.radius,
  K.radius,
  B.head,
  ...new Array<number>(RAGDOLL.count - 5).fill(B.limb),
];
