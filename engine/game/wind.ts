// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIND — the air over the snow at run time: the mean R19 dealt, from
// the bearing it dealt, breathing in gusts and veering a little about it.
//
// A PURE FUNCTION OF (level, t). The gusts are a sum of slow sines whose
// phases are hashed from the map's own seed, so the same map at the same
// second has the same wind on every machine and in every replay — and the
// field draws NOTHING from `state.rng`, so no run's stream, and no sim
// digest, knows it exists. Nothing in the physics reads it: it is what the
// falling snow, the spindrift off the ridges and the clouds are carried by,
// and it is stated here, in the engine, so a later system that lets the skier
// feel it reads the same air the picture shows.

import type { Level } from "../mapgen/index.ts";
import { weatherOf } from "../mapgen/index.ts";

/** The air at a moment: which way it moves and how fast. */
export type Wind = {
  /** Velocity of the air, m/s, world frame (heading 0 along +z). */
  x: number;
  z: number;
  /** |velocity|, m/s. */
  speed: number;
  /** The gust over the mean, 0 (a lull) … 1 (the strongest the map gets). */
  gust: number;
};

/** The gusts' periods, s — a breath, a squall, a slow swing — and how much
 * of the mean each carries. */
const GUSTS: readonly { period: number; share: number }[] = [
  { period: 6.3, share: 0.14 },
  { period: 17.9, share: 0.2 },
  { period: 53, share: 0.16 },
];
/** The most the wind veers either side of its mean bearing, rad. */
const VEER = 0.22;

/** A phase in [0, 2π) hashed from a seed and a salt. */
function phase(seed: number, salt: number): number {
  let h = Math.imul((seed ^ salt) >>> 0, 0x9e3779b1) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca77) >>> 0;
  h ^= h >>> 13;
  return ((h >>> 0) / 4294967296) * Math.PI * 2;
}

/** The wind on `level` at run time `t`. */
export function windAt(
  level: Pick<Level, "seed" | "weather">,
  t: number,
  out: Wind = { x: 0, z: 0, speed: 0, gust: 0 },
): Wind {
  const w = weatherOf(level);
  let g = 0;
  let total = 0;
  for (let i = 0; i < GUSTS.length; i++) {
    const k = GUSTS[i];
    g += k.share * Math.sin((2 * Math.PI * t) / k.period + phase(level.seed, i + 1));
    total += k.share;
  }
  const speed = Math.max(0, w.wind * (1 + g));
  const veer = VEER * Math.sin((2 * Math.PI * t) / 41 + phase(level.seed, 9));
  // The air moves TOWARD the heading opposite the one it blows from.
  const toward = w.windFrom + Math.PI + veer;
  out.x = Math.sin(toward) * speed;
  out.z = Math.cos(toward) * speed;
  out.speed = speed;
  out.gust = total > 0 ? 0.5 + (0.5 * g) / total : 0.5;
  return out;
}
