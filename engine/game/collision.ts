// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER MEETING WHAT IS NOT SNOW — the trees, and the edge of the map.
// The snow itself is the legs' and the hull's (`skier.ts`); this is
// everything that stands up out of it.
//
// A TREE is its trunk: a vertical cylinder of `radius` from the ground at
// its foot to its top, and the crown drawn round it is nothing to the
// physics — a skier brushing snow off the lowest branches is a picture, and
// a skier meeting the trunk is the whole of the hit. The skier is three
// plan circles down his skis' length (the tips, the body and the tails),
// which is the footprint of a thing two metres long and most of a metre
// wide at any heading. A circle inside a trunk is pushed out along the line
// between their centres, the closing speed comes back at `restitution`, the
// speed along the trunk is scrubbed, and the push's lever about the CoG
// turns the skier — which is why a clipped tip spins a skier round and a
// trunk met dead centre stops him. The trunks are hashed once per level, so
// a step reads the handful near the skier rather than the forest.
//
// THE EDGE is a soft push back toward the middle over the last `bounds.soft`
// metres and a hard wall `bounds.margin` inside the map's own edge.

import { cellKey, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Level, TreeDef } from "../mapgen/types.ts";
import { envelopeOf, inertiaOf, totalMass } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";
import type { GameEvent, GameState } from "./state.ts";

const K = TUNING.trees;
const dt = TUNING.dt;

type TreeGrid = { cells: Map<number, number[]>; maxRadius: number };

const grids = new WeakMap<readonly TreeDef[], TreeGrid>();

function gridOf(trees: readonly TreeDef[]): TreeGrid {
  let grid = grids.get(trees);
  if (grid) return grid;
  const cells = new Map<number, number[]>();
  let maxRadius = 0;
  for (let i = 0; i < trees.length; i++) {
    const t = trees[i];
    const key = cellKey(Math.floor(t.x / K.cell), Math.floor(t.z / K.cell));
    const list = cells.get(key);
    if (list) list.push(i);
    else cells.set(key, [i]);
    if (t.radius > maxRadius) maxRadius = t.radius;
  }
  grid = { cells, maxRadius };
  grids.set(trees, grid);
  return grid;
}

/** Every tree whose trunk comes within `r` m of (x, z) in plan, by index
 * into `level.trees`, into `out` (cleared first). */
export function treesNear(level: Level, x: number, z: number, r: number, out: number[]): number[] {
  out.length = 0;
  const trees = level.trees;
  const grid = gridOf(trees);
  const reach = r + grid.maxRadius;
  const c0 = Math.floor((x - reach) / K.cell);
  const c1 = Math.floor((x + reach) / K.cell);
  const r0 = Math.floor((z - reach) / K.cell);
  const r1 = Math.floor((z + reach) / K.cell);
  for (let c = c0; c <= c1; c++) {
    for (let rr = r0; rr <= r1; rr++) {
      const list = grid.cells.get(cellKey(c, rr));
      if (!list) continue;
      for (const i of list) {
        const t = trees[i];
        const d = hypot(t.x - x, t.z - z) - t.radius;
        if (d <= r) out.push(i);
      }
    }
  }
  return out;
}

/** Where the three footprint circles stand along the skis, m forward of
 * the CoG, as shares of their half-length. */
const CIRCLES = [0.8, 0, -0.8];
const near: number[] = [];

/** Push the skier out of every trunk he has run into this step, and report
 * the hit. */
export function collideTrees(state: GameState, events: GameEvent[]): void {
  const c = state.skier;
  const level = state.level;
  if (level.trees.length === 0) return;
  const half = envelopeOf(c.spec).length / 2;
  treesNear(level, c.x, c.z, half + K.bodyRadius, near);
  if (near.length === 0) return;
  const m = totalMass(c.spec);
  const Iy = inertiaOf(c.spec).y;
  const fl = hypot(Math.sin(c.heading), Math.cos(c.heading));
  const fx = Math.sin(c.heading) / fl;
  const fz = Math.cos(c.heading) / fl;
  let worst = 0;
  let hitX = 0;
  let hitZ = 0;
  for (const i of near) {
    const t = level.trees[i];
    if (c.y < t.y - 1 || c.y > t.y + t.height) continue;
    for (const share of CIRCLES) {
      const ox = fx * share * half;
      const oz = fz * share * half;
      const dx = c.x + ox - t.x;
      const dz = c.z + oz - t.z;
      const d = hypot(dx, dz);
      const reach = K.bodyRadius + t.radius;
      if (d >= reach) continue;
      const nx = d > 1e-6 ? dx / d : -fx;
      const nz = d > 1e-6 ? dz / d : -fz;
      const pen = reach - d;
      c.x += nx * pen;
      c.z += nz * pen;
      const vn = c.vx * nx + c.vz * nz;
      if (vn >= 0) continue;
      const closing = -vn;
      // The normal part comes back at the restitution; the part along the
      // trunk is scrubbed, harder the harder the blow.
      const tx = c.vx - vn * nx;
      const tz = c.vz - vn * nz;
      const scrub = 1 - K.scrub * Math.min(1, closing / 8);
      c.vx = tx * scrub - K.restitution * vn * nx;
      c.vz = tz * scrub - K.restitution * vn * nz;
      // The blow's lever about the CoG turns the skier (world y is the
      // body's up while it is upright, which is the only way it meets a
      // trunk worth turning it for).
      const j = m * (1 + K.restitution) * closing;
      const yaw = (oz * nx - ox * nz) * j;
      c.wy += (yaw / Iy) * 0.5;
      if (closing > worst) {
        worst = closing;
        hitX = t.x;
        hitZ = t.z;
      }
    }
  }
  if (worst >= K.hitSpeed && c.hitCooldown <= 0) {
    c.hitCooldown = K.cooldown;
    events.push({ kind: "hit", t: state.t, speed: worst, x: hitX, z: hitZ });
  }
}

/** Turn the skier back from the edge of the map. */
export function keepInBounds(state: GameState): void {
  const c = state.skier;
  const B = TUNING.bounds;
  const lo = B.margin;
  const hi = state.level.size - B.margin;
  const soft = (p: number): number => {
    if (p < lo + B.soft) return ((lo + B.soft - p) / B.soft) * B.push;
    if (p > hi - B.soft) return -((p - (hi - B.soft)) / B.soft) * B.push;
    return 0;
  };
  c.vx += soft(c.x) * dt;
  c.vz += soft(c.z) * dt;
  if (c.x < lo) {
    c.x = lo;
    if (c.vx < 0) c.vx = 0;
  } else if (c.x > hi) {
    c.x = hi;
    if (c.vx > 0) c.vx = 0;
  }
  if (c.z < lo) {
    c.z = lo;
    if (c.vz < 0) c.vz = 0;
  } else if (c.z > hi) {
    c.z = hi;
    if (c.vz > 0) c.vz = 0;
  }
}
