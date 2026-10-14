// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE ROCK STANDS OUT — the DROPS, where the snow cannot hold and the
// whole surface is rock: the cliff faces (R22) and the natural walls too
// steep for anyone to ski. Never as blocks peeking out of a snow slope —
// the rock IS the surface there, from where the ground turns steep to
// where it eases again, so its top merges with the top of the hill.
//
//   * a CLIFF's face (`Level.cliffs`, the `C…` bands off the piste), the
//     wall a skier drops off and flies past: clad whole, lip to foot, by
//     `cliff-wall.ts`, and SOLID there. The DROPS across a run (R24's
//     `D…`, and the resort's runs') are ridden over and get none.
//   * a WALL: the natural ground past `ROCKS.wall` (about 52°), off the
//     packed snow and off every cliff — the headwalls and cliff bands of
//     the face, not the steep powder a skier takes on: `rockShare` says how
//     much of it is bare, and the drawing (`pwa/src/game/rock-shapes.ts`'
//     `buildSkin`) lays a skin of coarse rock over the ground there. That
//     skin hugs the ground the engine already stands a skier on, so it is
//     met as the wall itself is.
//
// A pure function of the map, off hashes of `level.seed` and never the
// engine's stream; none of it stands where a run is skied, so no digest
// moves. Only where the region lets rock break through the snow
// (`Region.rock`). The numbers are `defs/rocks.ts`'s.

import type { Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { nearestBikeTrailPoint } from "../mapgen/bike-park-query.ts";
import { BIKE_PARK_RULES } from "../mapgen/bike-park-rules.ts";
import type { Cliff, Level } from "../mapgen/types.ts";
import { ROCKS } from "./defs/rocks.ts";

const BASIS = 0x811c9dc5;
function mix(h: number, v: number): number {
  h = Math.imul(h ^ (v | 0), 0x01000193);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  return h ^ (h >>> 12);
}

/** A 32-bit hash of integers. */
export function hashOf(...k: number[]): number {
  let h = BASIS;
  for (const v of k) h = mix(h, v);
  return h >>> 0;
}

/** The hash to 0..1, its `n`th draw. */
export function unit(hash: number, n: number): number {
  return (mix(mix(BASIS, hash), n) >>> 0) / 4294967296;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How much of a wall the ground is at a normal, 0..1: none under
 * `ROCKS.wall`, all of it past `ROCKS.whole`. */
export function wallOf(n: Vec3): number {
  const across = Math.sqrt(n.x * n.x + n.z * n.z);
  return smooth(ROCKS.wall, ROCKS.whole, across / Math.max(1e-3, n.y));
}

/** A cliff that gets rock: a band of the face (R22), never a drop a run
 * is skied over (R24's, a resort run's). */
export const rockyCliff = (c: Cliff): boolean => !c.onTrack && !c.run;

/** Whether (x, z) is on any cliff — its shelf's last metres, its face, its
 * landing — with `reach` m to spare: a rocky cliff's face is its wall's
 * (`cliff-wall.ts`) and a drop's is the run's, so no wall rock lies there. */
export function onAnyCliff(level: Level, x: number, z: number, reach: number): boolean {
  for (const c of level.cliffs ?? []) {
    const dx = x - c.x;
    const dz = z - c.z;
    const down = dx * Math.sin(c.heading) + dz * Math.cos(c.heading);
    const across = dx * Math.cos(c.heading) - dz * Math.sin(c.heading);
    if (
      Math.abs(across) < c.width / 2 + 14 + reach &&
      down > -6 - reach &&
      down < c.face + 4 + reach
    ) {
      return true;
    }
  }
  return false;
}

const scratch: Vec3 = { x: 0, y: 1, z: 0 };

/** HOW BARE THE GROUND IS at (x, z), 0..1: its wall share (`wallOf`), none
 * on packed snow or on a cliff. The caller has asked the region
 * (`Region.rock`). */
export function rockShare(level: Level, x: number, z: number): number {
  // Laid off the map under its skin (`rock-ground.ts`), never the skin.
  level = level.bedrock ?? level;
  if (level.packedAt(x, z) > ROCKS.packed) return 0;
  level.normalAt(x, z, scratch);
  const bare = wallOf(scratch);
  if (bare <= 0 || onAnyCliff(level, x, z, 0) || nearCut(level, x, z)) return 0;
  return bare;
}

/** The ring offsets `nearCut` reads the packed snow at: a disc of
 * `ROCKS.skin.clear` m sampled every 2.5 m, finer than any run's edge. */
const RING: readonly (readonly [number, number])[] = (() => {
  const r = ROCKS.skin.clear;
  const out: [number, number][] = [];
  for (let dz = -r; dz <= r; dz += 2.5) {
    for (let dx = -r; dx <= r; dx += 2.5) {
      if (dx * dx + dz * dz <= r * r) out.push([dx, dz]);
    }
  }
  return out;
})();

/** Whether (x, z) lies within `ROCKS.skin.clear` m of packed snow or of a
 * summer bike trail's footprint (its tread and its bench): the rock is
 * kept off both, so what is drawn there is what is ridden. */
function nearCut(level: Level, x: number, z: number): boolean {
  for (const [dx, dz] of RING) {
    if (level.packedAt(x + dx, z + dz) > ROCKS.packed) return true;
  }
  if (!level.bikePark) return false;
  const reach = ROCKS.skin.clear + BIKE_PARK_RULES.bench.widest;
  const near = nearestBikeTrailPoint(level, x, z, reach + 4);
  return near !== null && near.distance < near.half + reach;
}
