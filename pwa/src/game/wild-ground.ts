// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COUNTRY AS THE WILDLIFE ASKS ABOUT IT — the handful of questions both
// placers (`bird-roost.ts`, `beast-plan.ts`) put to a map, answered once off
// what the `Level` publishes: how far the nearest trunk is (a wood's edge, a
// meadow, a tall spruce to perch in), how far the loop is, where the drawn
// snow's surface stands, how steep the ground is, and where the ridge is.
//
// Three-free, like everything the wildlife decides, so the tests read it;
// cached against the level, because both placers and the renderer ask.

import { nearestTrackPoint, type Level, type TreeDef, type Vec3 } from "@engine";

import { LOOSE } from "./trail-stamp.ts";

/** The trees' bins, m. */
const CELL = 16;

export type WildGround = {
  readonly level: Level;
  /** The nearest trunk to (`x`, `z`) within `reach` m, or null. */
  nearestTree(x: number, z: number, reach: number): TreeDef | null;
  /** How far the loop's centreline is, m. */
  trackDistance(x: number, z: number): number;
  /** Where the drawn snow stands: the ground plus the loose cover the
   * shader lifts off the groomer (`LOOSE`). */
  snowY(x: number, z: number): number;
  /** Whether (`x`, `z`) is on a frozen river's ice (R21, `iceAt`) — kept
   * clear of every animal and its prints, as the loop is. */
  onIce(x: number, z: number): boolean;
  /** Rise over run of the ground. */
  slope(x: number, z: number): number;
  /** Inside the map with `margin` m to spare. */
  inside(x: number, z: number, margin?: number): boolean;
  /** Every tree at least `height` m tall, tallest first. */
  tallTrees(height: number): readonly TreeDef[];
};

const cache = new WeakMap<Level, WildGround>();

export function wildGround(level: Level): WildGround {
  const hit = cache.get(level);
  if (hit) return hit;
  const bins = new Map<number, TreeDef[]>();
  const key = (ix: number, iz: number): number => ix * 4096 + iz;
  for (const t of level.trees) {
    const k = key(Math.floor(t.x / CELL), Math.floor(t.z / CELL));
    const bin = bins.get(k);
    if (bin) bin.push(t);
    else bins.set(k, [t]);
  }
  const normal: Vec3 = { x: 0, y: 1, z: 0 };
  const ground: WildGround = {
    level,
    nearestTree(x, z, reach) {
      const r = Math.ceil(reach / CELL);
      const ix = Math.floor(x / CELL);
      const iz = Math.floor(z / CELL);
      let best: TreeDef | null = null;
      let bestD = reach * reach;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          const bin = bins.get(key(ix + dx, iz + dz));
          if (!bin) continue;
          for (const t of bin) {
            const d = (t.x - x) ** 2 + (t.z - z) ** 2;
            if (d < bestD) {
              bestD = d;
              best = t;
            }
          }
        }
      }
      return best;
    },
    trackDistance: (x, z) => nearestTrackPoint(level, x, z).distance,
    snowY: (x, z) => level.groundAt(x, z) + LOOSE * (1 - level.packedAt(x, z)),
    onIce: (x, z) => (level.iceAt?.(x, z) ?? 0) > 0,
    slope(x, z) {
      level.normalAt(x, z, normal);
      return Math.sqrt(Math.max(0, 1 - normal.y * normal.y)) / Math.max(normal.y, 1e-3);
    },
    inside: (x, z, margin = 0) =>
      x > margin && z > margin && x < level.size - margin && z < level.size - margin,
    tallTrees: (height) =>
      level.trees.filter((t) => t.height >= height).sort((a, b) => b.height - a.height),
  };
  cache.set(level, ground);
  return ground;
}
