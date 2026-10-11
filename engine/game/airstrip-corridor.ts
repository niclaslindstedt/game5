// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR OFF EACH END OF THE AIRSTRIP — what stands up into the approach
// and the climb-out a strip's plane flies low over: every lift's rope and
// towers, read along its line, and the helipad (a machine on it, its wash
// and its own circuit). The strip's search (`airstrip.ts`) scores each
// rectangle by how much of that reaches into the corridors beyond its ends,
// so a strip whose final crosses a gondola's rope a few hundred metres out
// loses to one whose air is clear; the landing is laid the clearer way, and
// the pilot flying home holds his circuit over the highest rope as he holds
// it over the snow (`ropeTop`).
//
// THE CORRIDOR is an obstacle-clearance surface as a small field's is laid
// out: from the strip's end it widens out and rises with the glide path,
// a clearance under it, and anything that stands above that surface inside
// it is in the way — scored by how far it stands through it. The clearance
// is a generous one: a rope or a station the final passes a few tens of
// metres over is a strip laid in the wrong place.
//
// A pure function of the map, worked out once and kept per map; nothing
// here draws from the stream.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { HELI } from "./defs/heli.ts";
import { PLANE } from "./defs/plane.ts";
import { helipadOf } from "./heli-pad.ts";
import { liftPlans, ropeAt } from "./lift-line.ts";
import type { Level } from "../mapgen/types.ts";

/** THE SURFACE: how far out it is read, m; its half-width at the strip's
 * end, m, and how much it widens a metre out; the clearance kept under the
 * glide path, m, and the path's rise a metre out (the pilot's glide, 6°);
 * the steps a lift's line is read at, m; how far a helipad stands up into
 * it (a machine on it, its wash), m, and over how wide. */
export const CORRIDOR = {
  reach: 900,
  half: 45,
  widen: 0.12,
  clear: 40,
  rise: Math.tan(PLANE.pilot.glide),
  every: 15,
  pad: 45,
  padWide: 50,
} as const;

/** Something standing up into the air: where, how high its top, m (world),
 * and how wide it reaches across, m. */
type Obstacle = { x: number; z: number; y: number; r: number };

const cache = new WeakMap<Level, readonly Obstacle[]>();

/** Every rope, tower and the helipad, as points with a top. */
function obstaclesOf(level: Level): readonly Obstacle[] {
  let out = cache.get(level);
  if (!out) {
    const list: Obstacle[] = [];
    for (const p of liftPlans(level)) {
      // The rope along the line (its towers stand under it and no higher
      // than its sheaves, a few metres over it at most).
      for (let u = 0; u <= p.length; u += CORRIDOR.every) {
        const x = p.lift.bottom.x + p.dx * u;
        const z = p.lift.bottom.z + p.dz * u;
        list.push({ x, z, y: ropeAt(p, u) + 3, r: 6 });
      }
    }
    if (level.resort) {
      const pad = helipadOf(level);
      list.push({
        x: pad.x,
        z: pad.z,
        y: level.groundAt(pad.x, pad.z) + CORRIDOR.pad,
        r: HELI.pad.radius + CORRIDOR.padWide,
      });
    }
    out = list;
    cache.set(level, out);
  }
  return out;
}

/** HOW MUCH STANDS INTO THE CORRIDOR off a strip's end at (x, y, z),
 * flown out along (ux, uz) (a unit): each obstacle inside it counted once
 * and as much again for every 20 m it stands through the surface. 0 is
 * clear air. */
export function corridorIntrusion(
  level: Level,
  x: number,
  y: number,
  z: number,
  ux: number,
  uz: number,
): number {
  const C = CORRIDOR;
  let sum = 0;
  for (const o of obstaclesOf(level)) {
    const rx = o.x - x;
    const rz = o.z - z;
    const d = rx * ux + rz * uz;
    if (d < 0 || d > C.reach) continue;
    const e = Math.abs(rx * uz - rz * ux);
    if (e > C.half + C.widen * d + o.r) continue;
    const through = o.y - (y + C.rise * d - C.clear);
    if (through > 0) sum += 1 + through / 20;
  }
  return sum;
}

/** THE TOPS AS A GRID: the highest rope, tower or pad within `ROPE_NEAR`
 * m of each `ROPE_CELL` m square, world height (−Infinity where none). */
const ROPE_CELL = 50;
const ROPE_NEAR = 60;
const tops = new WeakMap<Level, { n: number; top: Float32Array }>();

function topsOf(level: Level): { n: number; top: Float32Array } {
  let g = tops.get(level);
  if (!g) {
    const n = Math.ceil(level.size / ROPE_CELL);
    const top = new Float32Array(n * n).fill(-Infinity);
    for (const o of obstaclesOf(level)) {
      const reach = o.r + ROPE_NEAR + ROPE_CELL;
      const i0 = Math.max(0, Math.floor((o.x - reach) / ROPE_CELL));
      const i1 = Math.min(n - 1, Math.floor((o.x + reach) / ROPE_CELL));
      const j0 = Math.max(0, Math.floor((o.z - reach) / ROPE_CELL));
      const j1 = Math.min(n - 1, Math.floor((o.z + reach) / ROPE_CELL));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const cx = (i + 0.5) * ROPE_CELL;
          const cz = (j + 0.5) * ROPE_CELL;
          if (hypot(o.x - cx, o.z - cz) > reach) continue;
          const k = j * n + i;
          if (o.y > top[k]) top[k] = o.y;
        }
      }
    }
    g = { n, top };
    tops.set(level, g);
  }
  return g;
}

/** THE HIGHEST ROPE OR TOWER (or the helipad's air) near (x, z), world
 * height, m — −Infinity where none: what a low circuit is held over, as
 * it is held over the snow (a cell's worth, so a little generous). */
export function ropeTop(level: Level, x: number, z: number): number {
  const g = topsOf(level);
  const i = Math.floor(x / ROPE_CELL);
  const j = Math.floor(z / ROPE_CELL);
  if (i < 0 || j < 0 || i >= g.n || j >= g.n) return -Infinity;
  return g.top[j * g.n + i];
}
