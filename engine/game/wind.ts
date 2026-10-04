// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIND — the air over the snow at run time: the mean R19 dealt, from
// the bearing it dealt, breathing in gusts and veering a little about it.
//
// A PURE FUNCTION OF (level, t). The gusts are a sum of slow sines whose
// phases are hashed from the map's own seed, so the same map at the same
// second has the same wind on every machine and in every replay — and the
// field draws NOTHING from `state.rng`, so no run's stream knows it exists.
// It is what the falling snow, the spindrift off the ridges and the clouds
// are carried by — and, brought down to a skier's body where he is
// (`airAt`), what his drag is against (`air.ts`), what he hears and what the
// HUD's wind meter reads (`airflowAt`): one air for all of them.

import { hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";

import type { Level, TreeDef } from "../mapgen/index.ts";
import { weatherOf } from "../mapgen/index.ts";
import { TUNING } from "./defs/tuning.ts";

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

// ── THE AIR WHERE A SKIER IS ────────────────────────────────────────────
// `windAt` is the weather's mean wind as R19 states it: at 10 m over open
// ground. A skier is a metre or so off the snow, somewhere on a mountain,
// often among trees, and the air there is less (`TUNING.wind`):
//   * THE LOG LAW. Over a surface of roughness z0 the mean wind grows as
//     ln(z / z0) with height, so the wind at the body is ln(h / z0) over
//     ln(10 / z0) of the 10 m wind — three quarters at a metre over snow.
//   * EXPOSURE. The flow is squeezed over the ridge and lies in the lee of
//     the valley: the 10 m wind itself runs from `valley` to `summit` of the
//     dealt mean, linearly up the mountain's vertical.
//   * THE WOODS. Under a closed canopy the trunk space keeps a fraction of
//     the open wind; a lane through the woods, a glade, a lone tree keep
//     more. The crowns' share of the ground round him (`shelterAt`, off a
//     grid baked once a map from its trees) takes up to `shelter.most` off.
// All of it a pure function of the map, the place and the clock, so the
// physics, the sound and the HUD meet the same air, and a replay its own.

const W = TUNING.wind;

/** The crowns' share of the ground, baked once per tree list. */
type ShelterGrid = { n: number; cell: number; cover: Float32Array };

const shelters = new WeakMap<readonly TreeDef[], ShelterGrid>();

/** How tall a tree must be to throw its whole shelter, m — krummholz and a
 * sapling break the wind at a skier's knees, not at his head. */
const SHELTER_TALL = 6;

function shelterOf(trees: readonly TreeDef[], size: number): ShelterGrid {
  const had = shelters.get(trees);
  if (had) return had;
  const cell = W.shelter.cell;
  const n = Math.max(2, Math.ceil(size / cell) + 1);
  // Each crown's area splatted into the cell its trunk stands in…
  const crowns = new Float64Array(n * n);
  for (const t of trees) {
    const i = Math.min(n - 1, Math.max(0, Math.round(t.x / cell)));
    const j = Math.min(n - 1, Math.max(0, Math.round(t.z / cell)));
    crowns[j * n + i] += Math.PI * t.crown * t.crown * Math.min(1, t.height / SHELTER_TALL);
  }
  // …summed over a square of the shelter's reach round every cell, through
  // a summed-area table, and taken as a share of the ground in it.
  const sat = new Float64Array((n + 1) * (n + 1));
  for (let j = 0; j < n; j++) {
    let row = 0;
    for (let i = 0; i < n; i++) {
      row += crowns[j * n + i];
      sat[(j + 1) * (n + 1) + i + 1] = sat[j * (n + 1) + i + 1] + row;
    }
  }
  const k = Math.max(1, Math.round(W.shelter.radius / cell));
  const cover = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    const j0 = Math.max(0, j - k);
    const j1 = Math.min(n, j + k + 1);
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - k);
      const i1 = Math.min(n, i + k + 1);
      const sum =
        sat[j1 * (n + 1) + i1] -
        sat[j0 * (n + 1) + i1] -
        sat[j1 * (n + 1) + i0] +
        sat[j0 * (n + 1) + i0];
      cover[j * n + i] = Math.min(1, sum / ((i1 - i0) * (j1 - j0) * cell * cell));
    }
  }
  const grid = { n, cell, cover };
  shelters.set(trees, grid);
  return grid;
}

/** What share of the open wind the woods leave at (x, z), 0..1 — 1 in the
 * open, `1 − shelter.most` under a closed canopy. */
export function shelterAt(level: Pick<Level, "trees" | "size">, x: number, z: number): number {
  if (level.trees.length === 0) return 1;
  const { n, cell, cover } = shelterOf(level.trees, level.size);
  const u = Math.min(n - 1.001, Math.max(0, x / cell));
  const v = Math.min(n - 1.001, Math.max(0, z / cell));
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fu = u - i;
  const fv = v - j;
  const a = cover[j * n + i] + (cover[j * n + i + 1] - cover[j * n + i]) * fu;
  const b = cover[(j + 1) * n + i] + (cover[(j + 1) * n + i + 1] - cover[(j + 1) * n + i]) * fu;
  const share = a + (b - a) * fv;
  return 1 - W.shelter.most * Math.min(1, share / W.shelter.full);
}

/** The share of the 10 m wind left at `height` m over the snow (the log
 * law over the snow's roughness). */
export function profileAt(height: number): number {
  const z0 = W.roughness;
  return Math.log(Math.max(2 * z0, height) / z0) / Math.log(W.refHeight / z0);
}

/** What a map's place on the mountain does to the 10 m wind: `valley` on
 * the valley floor to `summit` at the top. A map without a mountain is
 * all one height. */
export function exposureAt(
  level: Pick<Level, "mountain" | "groundAt">,
  x: number,
  z: number,
): number {
  const m = level.mountain;
  if (!m || m.vertical <= 0) return 1;
  const up = Math.min(1, Math.max(0, (level.groundAt(x, z) - m.base.y) / m.vertical));
  return W.valley + (W.summit - W.valley) * up;
}

/** The levels `airAt` reads. */
export type AirLevel = Pick<Level, "seed" | "weather" | "trees" | "size" | "mountain" | "groundAt">;

/** THE AIR AT (x, z), `height` m over the snow, at run time `t`: the
 * weather's wind brought down to the height, exposed on the mountain and
 * sheltered by the woods. `gust` is the weather's own. */
export function airAt(
  level: AirLevel,
  t: number,
  x: number,
  z: number,
  height: number,
  out: Wind = { x: 0, z: 0, speed: 0, gust: 0 },
): Wind {
  windAt(level, t, out);
  const k = profileAt(height) * exposureAt(level, x, z) * shelterAt(level, x, z);
  out.x *= k;
  out.z *= k;
  out.speed *= k;
  return out;
}

/** THE AIR AS A MOVING SKIER MEETS IT — the APPARENT wind: the air where
 * he is (`airAt`) less his own velocity. Skiing at 28 m/s into a 28 m/s
 * headwind is 56 m/s in the face; the same wind behind him is a calm. The
 * wind he hears and the HUD's wind meter; the physics' drag is the same
 * air (`air.ts`). */
export type Airflow = {
  /** Velocity of the air past the skier, m/s, world frame. */
  x: number;
  y: number;
  z: number;
  /** |velocity|, m/s — the wind in his ears. */
  speed: number;
  /** How much of it is in his FACE, m/s: along his heading, positive with
   * the air streaming back past him (a headwind, or simply his speed),
   * negative with it pushing him from behind. */
  head: number;
  /** How much of it is ACROSS him, m/s: positive moving toward his right
   * (the heading's clockwise side — `steer` and `edge`'s right), which is a
   * wind from his left. */
  across: number;
};

/** Where a skier is and how he is moving — all `airflowAt` asks of one. */
export type AirRider = {
  x: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
};

/** The height the wind is felt at, m: a skier's body, about a metre up. */
export const BODY_HEIGHT = 1;

const AIR: Wind = { x: 0, z: 0, speed: 0, gust: 0 };

/** The apparent wind on `rider` on `level` at run time `t`. A skier at
 * rest feels the air where he stands. */
export function airflowAt(
  level: AirLevel,
  t: number,
  rider: AirRider,
  out: Airflow = { x: 0, y: 0, z: 0, speed: 0, head: 0, across: 0 },
): Airflow {
  const w = airAt(level, t, rider.x, rider.z, BODY_HEIGHT, AIR);
  out.x = w.x - rider.vx;
  out.y = -rider.vy;
  out.z = w.z - rider.vz;
  out.speed = hypot3(out.x, out.y, out.z);
  const fx = Math.sin(rider.heading);
  const fz = Math.cos(rider.heading);
  out.head = -(out.x * fx + out.z * fz);
  out.across = out.x * fz - out.z * fx;
  return out;
}
