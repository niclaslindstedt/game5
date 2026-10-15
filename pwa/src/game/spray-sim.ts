// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SKIER THROWS — the seam every snow effect shares, three-free (so
// the labs fly the same pool in Node: `make snow-mass`, `make
// spray-metrics`):
//
//   * THE EDGES ON THE SNOW (`edgeSlips`): the skier's velocity read across
//     each ski's own line as it stands pivoted under him, each edge with its
//     share of the load (`ski-stand.ts`). A clean carve slides across
//     nothing; a hockey stop slides across at its whole speed. The spray,
//     the snow cloud and the deformable snow all read it, and none reads a
//     sliding edge any other way.
//   * THE POOL (`createSprayPool`): the WEIGHED spray's (`spray-mass.ts`,
//     `spray-mass-pool.ts`) — the kilograms an edge cuts off the snow's
//     hardness and the skier's load and the loose snow a ski shoves, thrown
//     out from under the base along the slide and down the fall line, the
//     same mass at every SPRAY stop. Its flight is the GPU's in the game
//     (`gpu-spray.ts`); the CPU pool here is the labs' and the measure's.
//
// The fine powder that hangs is `snow-cloud.ts`'s; what the snow is like
// (its kind and its age) is `snowpack.ts`'s.

import { rotate, type Level, type SkierState } from "@engine";

import { skiShares, stationOf } from "./ski-stand.ts";
import { createMassPool } from "./spray-mass-pool.ts";
import type { Launch } from "./spray-flight.ts";
import type { AgedSnow, SnowProps } from "./snowpack.ts";

/** What the age of the snow adds to what it throws (`ageSnow`), none when
 * nothing says. */
type Aged = SnowProps & Partial<Pick<AgedSnow, "plates" | "heavy" | "flake">>;

/** ONE EDGE ON THE SNOW: where it runs (tip to tail, world m), its share
 * of the load, which way it slides across its own line (a unit vector on
 * the snow) and how fast, m/s, and its own line's unit vector. */
export type EdgeSlip = {
  tip: { x: number; y: number; z: number };
  tail: { x: number; y: number; z: number };
  share: number;
  slide: number;
  across: { x: number; z: number };
  along: { x: number; z: number };
};

export function emptySlip(): EdgeSlip {
  return {
    tip: { x: 0, y: 0, z: 0 },
    tail: { x: 0, y: 0, z: 0 },
    share: 0,
    slide: 0,
    across: { x: 1, z: 0 },
    along: { x: 0, z: 1 },
  };
}

const shareBuf: [number, number] = [0.5, 0.5];

/** THE EDGES ON THE SNOW for one skier, into `out` (two for a pair, one
 * for a board — `count` says how many are filled): each a line from its
 * tip to its tail, its share of the load and how fast it slides ACROSS its
 * own line — the skier's velocity read across the skis as they stand
 * pivoted under him (`skiAngle`, clockwise positive). On a board the one
 * edge carries him whole. */
export function edgeSlips(skier: SkierState, out: [EdgeSlip, EdgeSlip]): number {
  const a = skier.skiAngle;
  const fwd = rotate(skier.q, { x: Math.sin(a), y: 0, z: Math.cos(a) });
  const flat = Math.hypot(fwd.x, fwd.z) || 1;
  const ax = fwd.x / flat;
  const az = fwd.z / flat;
  // Across the ski on the snow, to its right.
  const cx = az;
  const cz = -ax;
  const vAcross = skier.vx * cx + skier.vz * cz;
  const board = skier.contacts.length === 4;
  const n = board ? 1 : 2;
  if (!board) skiShares(skier, shareBuf);
  for (let k = 0; k < n; k++) {
    const e = out[k];
    const tip = board ? skier.contacts[0] : stationOf(skier.contacts, k, 0);
    const tail = board ? skier.contacts[3] : stationOf(skier.contacts, k, 2);
    const touching = board
      ? skier.contacts.some((c) => c.touching)
      : !!stationOf(skier.contacts, k, 1)?.touching;
    if (!tip || !tail || !touching || skier.airborne) {
      e.share = 0;
      e.slide = 0;
      continue;
    }
    e.tip.x = tip.x;
    e.tip.y = tip.y;
    e.tip.z = tip.z;
    e.tail.x = tail.x;
    e.tail.y = tail.y;
    e.tail.z = tail.z;
    e.share = board ? 1 : shareBuf[k];
    // The brake's scrub counts as a slide even where the drawn pivot is
    // small (a check down the fall line skids its skis without turning
    // them far): the snow goes the way the skis were turned, or off the
    // outside of the arc.
    const scrub = skier.skid * skier.speed * 0.45;
    e.slide = Math.max(Math.abs(vAcross), scrub);
    const lean = skier.skiAngle !== 0 ? -Math.sign(skier.skiAngle) : -Math.sign(skier.edge || 1);
    const s = Math.abs(vAcross) >= scrub * 0.5 ? (vAcross >= 0 ? 1 : -1) : lean;
    e.across.x = cx * s;
    e.across.z = cz * s;
    e.along.x = ax;
    e.along.z = az;
  }
  return n;
}

/** What the pool has done since it was last read: the lab's measure. */
export type SprayStats = {
  /** Grains thrown. */
  thrown: number;
  /** Summed launch speed off the snow, m/s, and summed peak height over
   * the snow, m, of every grain that came down. */
  launch: number;
  high: number;
  /** Summed distance from where each grain was thrown to where it came
   * down or faded, m, and how many did. */
  reach: number;
  done: number;
};

/** Who is told when a grain is thrown and when it is done — the labs'
 * probe (`make snow-mass`); the game passes none. */
export type SprayWatch = {
  spawn?(i: number): void;
  /** A weighed parcel's launch (`spray-flight.ts`), as the slot `i` was
   * filled — before its plane is known. */
  launch?(i: number, l: Launch): void;
  /** `peak` its highest over the snow, m; `reach` how far it came down
   * from where it was thrown, m. */
  retire?(i: number, peak: number, reach: number): void;
};

export type SprayPool = {
  readonly capacity: number;
  /** Per slot: position, velocity, size (m across), opacity, hardness
   * (0 a grain puff … 1 a clump), glint (0..1), age (s) and the fall speed
   * the air holds it to (m/s). Slots past `cap` are dead. */
  pos: Float32Array;
  vel: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
  hard: Float32Array;
  glint: Float32Array;
  age: Float32Array;
  term: Float32Array;
  readonly cap: number;
  emit(skier: SkierState, level: Level, dt: number, landed: number, snow?: Aged): void;
  burst(
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number,
    size: number,
    snow?: SnowProps,
  ): void;
  fling(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    hard: number,
  ): void;
  step(dt: number, level: Level): void;
  setBudget(share: number): void;
  clear(): void;
  /** The tally since the last read, reset by reading it. */
  stats(): SprayStats;
};

/** THE POOL a spray is flown from: the weighed spray's. */
export function createSprayPool(capacity = 6000, watch: SprayWatch = {}): SprayPool {
  return createMassPool(capacity, watch);
}
