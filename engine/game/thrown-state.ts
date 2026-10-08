// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER THROWN AND THE SKIS HE LEFT (`crash.ts`, `ragdoll.ts`,
// `lone-skis.ts`, `nets.ts`) — beside `state.ts`, which re-exports both, so
// a reader asks the one place he always has.

import type { CrashCause } from "./state.ts";

/** THE SKIER THROWN — a body of his own from the moment he leaves his skis
 * until the reset stands him back on the piste (`crash.ts`): a RAGDOLL
 * (`ragdoll.ts`), thirteen points held together at the joints and each
 * meeting the snow and the trunks on its own, so he flops, slides and
 * comes to rest the way a body does. Written by `stepThrown` only; the
 * renderer hangs the figure on `points` and stamps the snow where he is
 * `touching`. */
export type Thrown = {
  cause: CrashCause;
  /** Seconds since he left the skis. */
  t: number;
  /** His centre of mass, world frame, m, and its velocity, m/s — what the
   * camera follows and the reset waits on. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** The bearing he was thrown along, rad (0 = +z, clockwise), and how far
   * his spine has turned in all since, rad — the tumble, counted. */
  heading: number;
  tumble: number;
  /** The body's points (`RAGDOLL` order), x y z each, world frame, m, and
   * where they were a step ago — the velocity is the difference. */
  points: number[];
  last: number[];
  /** Some part of him on the snow this step — and which, one bit a point
   * in `RAGDOLL` order: a limb planted in the snow yields, and the muscles
   * leave it be (`ragdoll.ts`). */
  touching: boolean;
  planted: number;
  /** Seconds since his trunk — the hips, the shoulders or the head — first
   * came down on the snow, or −1 while it has not: what the muscles' brace
   * gives way on (`crash.tone`). */
  down: number;
  /** Seconds he has lain STILL on the snow — every point under
   * `crash.restSpeed`, touching — without a break: what the reset waits on. */
  still: number;
  /** THE BLOWS THIS STEP, one per point in `RAGDOLL` order, m/s: the way
   * each point brought into the snow it was put back on, and into the
   * trunk it was pushed out of — 0 for none. Written by `stepRagdoll`, read
   * by `body.ts`; nothing in the fall reads them back. */
  impacts: number[];
  struck: number[];
  /** Which of his points are in an A-net this step, a bit each (`catchInNets`). */
  netted: number;
  /** RUN THROUGH (`gore.ts`): the point held on a spike, and where — the
   * rest of him hangs off it. Absent while nothing holds him. */
  pin?: { point: number; x: number; y: number; z: number } | null;
  /** THE SKIS LET GO (`lone-skis.ts`), the left one first: each its own
   * body from the moment its binding releases. */
  skis: LoneSki[];
};

/** ONE SKI WITHOUT ITS SKIER (`lone-skis.ts`): a stick the length of the
 * ski, its two ends meeting the snow and the trunks on their own, turned
 * about its length by `up`. Written by `stepLoneSkis` only; the renderer
 * lays the ski on it. */
export type LoneSki = {
  /** −1 the left ski, +1 the right. */
  side: number;
  /** Seconds left in its binding: while held it goes with his foot. */
  held: number;
  /** Where the boot stood along it, a share of its length from the tail. */
  mount: number;
  /** The tip and the tail of its base, x y z each, world frame, m, and
   * where they were a step ago — the velocity is the difference. */
  ends: number[];
  last: number[];
  /** The wrench it leaves its binding with, each end's, m a step — handed
   * to the held one when it lets go. */
  kick: number[];
  /** Out of its topsheet, unit, world frame: square to the tail-to-tip. */
  up: number[];
  /** Its turn about its own length, rad/s (right-handed about the tip). */
  spin: number;
  /** Which end is on the snow, one bit each: 1 the tip, 2 the tail. */
  touching: number;
  /** Which end is HOOKED in an A-net (bits as `touching`), held at `hook`;
   * `tried`, the end the mesh had its one chance by, 0 before (`nets.ts`). */
  hooked: number;
  hook: number[];
  tried: number;
};
