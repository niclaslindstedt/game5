// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW IN THE AIR, AND THE SNOW IT LAYS DOWN. R19 deals a map's fall on
// the whole — a few flakes out of a sunny sky, a steady fall under a grey
// lid, a blizzard under black cloud — and this is the fall at a MOMENT: the
// dealt mean breathing in squalls, the storm's gusts lifting the snow off
// the ground into the air, and how far a rider can see through it.
//
// A PURE FUNCTION OF (level, t), like the wind it rides (`windAt`): the
// squalls are slow sines whose phases are hashed from the map's own seed,
// so the same map at the same second is the same fall on every machine and
// in every replay, and nothing here draws from `state.rng`.
//
// THE NEW SNOW (`GameState.fresh`) is the one thing a fall does to the
// physics, and it is REAL-WORLD SLOW: a heavy fall lays two or three
// centimetres an hour, a blizzard six to eight — nothing a three-lap race
// can feel, and on a free ride left running an hour in a storm, a groomer
// gone soft under a hand's depth of powder and the powder beside it deeper
// than the dial it was dealt. `snow.ts` reads it (`packedUnder`,
// `depthUnder`); the picture reads the same number to bury the corduroy and
// fill the furrows.

import type { Level } from "../mapgen/index.ts";
import { snows, weatherOf } from "../mapgen/index.ts";
import { TUNING } from "./defs/tuning.ts";
import { windAt, type Wind } from "./wind.ts";

const S = TUNING.snow;

/** The fall at a moment. */
export type Fall = {
  /** How hard it is snowing now, 0 (nothing) … 1 (a blizzard at its worst) —
   * the snow in the air, blown snow and all. */
  fall: number;
  /** How far a rider can see through it, m — Koschmieder's visual range;
   * a clear day's air at no fall. */
  visibility: number;
};

/** The squalls' periods, s — a flurry passing, a band of cloud, the slow
 * swing of the whole system — and how much of the mean each carries. */
const SQUALLS: readonly { period: number; share: number }[] = [
  { period: 37, share: 0.35 },
  { period: 113, share: 0.4 },
  { period: 347, share: 0.25 },
];

/** How deep each snowing sky breathes about its mean, as a share of it: a
 * flurry comes and goes to nothing, a steady fall barely wavers, a storm
 * surges. */
const BREATH = { flurries: 0.9, snow: 0.3, storm: 0.35 } as const;

/** How much of a storm's gust is snow lifted off the ground into the air. */
const BLOWN = 0.3;

/** The visual range at a fall of 1, m, and how steeply it opens as the fall
 * thins (range ∝ fall^−k): a blizzard's forty-odd metres, a steady fall's
 * one or two hundred, a flurry's kilometre and more. */
const RANGE = { full: 45, k: 2, clear: 20000 } as const;

/** A phase in [0, 2π) hashed from a seed and a salt. */
function phase(seed: number, salt: number): number {
  let h = Math.imul((seed ^ salt) >>> 0, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * Math.PI * 2;
}

const scratchWind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };

/** The fall on `level` at run time `t`. */
export function snowAt(
  level: Pick<Level, "seed" | "weather">,
  t: number,
  out: Fall = { fall: 0, visibility: RANGE.clear },
): Fall {
  const w = weatherOf(level);
  if (!snows(w.kind) || w.snowfall <= 0) {
    out.fall = 0;
    out.visibility = RANGE.clear;
    return out;
  }
  let g = 0;
  for (let i = 0; i < SQUALLS.length; i++) {
    const k = SQUALLS[i];
    g += k.share * Math.sin((2 * Math.PI * t) / k.period + phase(level.seed, 0x5a + i));
  }
  let fall = w.snowfall * (1 + BREATH[w.kind] * g);
  if (w.kind === "storm") fall += BLOWN * (windAt(level, t, scratchWind).gust - 0.5);
  fall = Math.min(1, Math.max(0, fall));
  out.fall = fall;
  out.visibility = visibilityIn(fall);
  return out;
}

/** How far a rider can see through a fall of `fall` 0..1, m. */
export function visibilityIn(fall: number): number {
  return fall > 0 ? Math.min(RANGE.clear, RANGE.full * Math.pow(fall, -RANGE.k)) : RANGE.clear;
}

/** How fast new snow builds at a fall, m/s: the square of the fall, so a
 * flurry lays millimetres an hour and a blizzard `snow.freshRate`'s full
 * rate. */
export function freshRate(fall: number): number {
  return S.freshRate * fall * fall;
}

const scratchFall: Fall = { fall: 0, visibility: RANGE.clear };

/** One step's new snow on `level` at run time `t`, m. */
export function freshStep(level: Pick<Level, "seed" | "weather">, t: number, dt: number): number {
  return freshRate(snowAt(level, t, scratchFall).fall) * dt;
}
