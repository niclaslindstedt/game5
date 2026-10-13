// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R44 — WHAT A TRAIL KEEPS OFF, and the woods it is laid through. A trail is
// walked round the ski area's furniture — water, the stations, the cabins,
// the lifts' towers, the map's edge — and never along another trail or a
// piste: it may CROSS one (a traverse over a piste is how a bike park's
// trails get across the mountain), but where one runs the same way within
// `walk.apart` metres of it, it turns away.
//
// Pure: a function of the map; the occupancy grows as each trail is kept.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { cabinsOf } from "../game/cabins.ts";
import { liftPlans } from "../game/lift-line.ts";
import { BIKE_PARK_RULES as B } from "./bike-park-rules.ts";
import type { Keep } from "./bike-trail-walk.ts";
import { inWater } from "./real-water.ts";
import type { Level } from "./types.ts";

const W = B.walk;
/** The cell the blocked field and the lines are kept on, m. */
const CELL = 4;
const LINE = 8;

/** A line laid so far: a sample on it, the way it runs and its half-width. */
type Sample = { x: number; z: number; dx: number; dz: number; r: number };

/** What every trail of a park keeps off, and the trails and pistes already
 * there. `add` registers a kept trail's line. */
export type ParkKeep = Keep & {
  add(points: readonly { x: number; z: number; heading: number; width: number }[]): void;
  /** True where trees stand thick enough to call woods. */
  woods(x: number, z: number): boolean;
};

/** THE KEEP of `level`: its blocked ground (its edge, water, stations,
 * cabins, towers) and its pistes. */
export function parkKeep(level: Level): ParkKeep {
  const g = level.ground;
  const x0 = g.originX + W.edge;
  const z0 = g.originZ + W.edge;
  const x1 = g.originX + (g.cols - 1) * g.cell - W.edge;
  const z1 = g.originZ + (g.rows - 1) * g.cell - W.edge;
  const cols = Math.ceil((g.cols * g.cell) / CELL) + 1;
  const rows = Math.ceil((g.rows * g.cell) / CELL) + 1;
  const memo = new Uint8Array(cols * rows);
  const stations: { x: number; z: number; r: number }[] = [];
  const posts: { x: number; z: number; r: number }[] = [];
  for (const plan of liftPlans(level)) {
    const l = plan.lift;
    stations.push({ x: l.top.x, z: l.top.z, r: W.station.top });
    stations.push({ x: l.bottom.x, z: l.bottom.z, r: W.station.bottom });
    for (const s of plan.supports) if (!s.station) posts.push({ x: s.x, z: s.z, r: W.tower });
  }
  for (const c of cabinsOf(level)) posts.push({ x: c.x, z: c.z, r: W.cabin });
  const water = level.water;
  const blockedAt = (x: number, z: number): boolean => {
    if (x < x0 || x > x1 || z < z0 || z > z1) return true;
    for (const s of stations) if (hypot(s.x - x, s.z - z) < s.r) return true;
    for (const p of posts)
      if (Math.abs(p.x - x) < p.r && Math.abs(p.z - z) < p.r && hypot(p.x - x, p.z - z) < p.r)
        return true;
    return inWater(water, x, z);
  };
  // THE LINES: every piste and lane, then each trail as it is kept.
  const lines = new Map<number, Sample[]>();
  const key = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096);
  const put = (s: Sample) => {
    const k = key(Math.floor(s.x / LINE), Math.floor(s.z / LINE));
    let list = lines.get(k);
    if (!list) lines.set(k, (list = []));
    list.push(s);
  };
  for (const run of level.resort?.runs ?? []) {
    for (let i = 0; i < run.points.length; i += 2) {
      const p = run.points[i];
      put({ x: p.x, z: p.z, dx: Math.sin(p.heading), dz: Math.cos(p.heading), r: p.width / 2 });
    }
  }
  // THE WOODS: trees counted on a grid.
  const trees = new Map<number, number>();
  for (const t of level.trees) {
    const k = key(Math.floor(t.x / LINE), Math.floor(t.z / LINE));
    trees.set(k, (trees.get(k) ?? 0) + 1);
  }
  return {
    blocked(x, z) {
      const i = Math.floor((x - g.originX) / CELL);
      const j = Math.floor((z - g.originZ) / CELL);
      if (i < 0 || j < 0 || i >= cols || j >= rows) return true;
      const m = memo[j * cols + i];
      if (m) return m === 2;
      // Read at the cell's middle, so a cell answers alike wherever it is asked.
      const b = blockedAt(g.originX + (i + 0.5) * CELL, g.originZ + (j + 0.5) * CELL);
      memo[j * cols + i] = b ? 2 : 1;
      return b;
    },
    crowded(x, z, dx, dz) {
      const ci = Math.floor(x / LINE);
      const cj = Math.floor(z / LINE);
      const cos = Math.cos((35 * Math.PI) / 180);
      for (let j = cj - 2; j <= cj + 2; j++) {
        for (let i = ci - 2; i <= ci + 2; i++) {
          for (const s of lines.get(key(i, j)) ?? []) {
            if (hypot(s.x - x, s.z - z) > s.r + W.apart) continue;
            if (s.dx * dx + s.dz * dz > cos) return true;
          }
        }
      }
      return false;
    },
    add(points) {
      for (let i = 0; i < points.length; i += 2) {
        const p = points[i];
        put({ x: p.x, z: p.z, dx: Math.sin(p.heading), dz: Math.cos(p.heading), r: p.width / 2 });
      }
    },
    woods(x, z) {
      const ci = Math.floor(x / LINE);
      const cj = Math.floor(z / LINE);
      let n = 0;
      for (let j = cj - 1; j <= cj + 1; j++)
        for (let i = ci - 1; i <= ci + 1; i++) n += trees.get(key(i, j)) ?? 0;
      return n >= 4;
    },
  };
}
