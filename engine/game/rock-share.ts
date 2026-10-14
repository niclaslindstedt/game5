// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE ROCK IS, ON THE GROUND'S OWN GRID — `rockShare` (`rocks.ts`)
// read at every node of the map's heightfield (its 2 m cells) and kept, so
// the physics (`rock-ground.ts`) and the ground's shader (which carries it
// beside the heights, `pwa/src/game/terrain.ts`) read the SAME numbers and
// blend them the same way: bilinear between the four nodes round a point,
// then eased from where rock starts to be laid to where it is whole
// (`rockMask`). A node is read only when a body or the drawing first asks
// for its tile, a byte-free empty mark for a tile of snow. A pure function
// of the map.

import type { Level } from "../mapgen/types.ts";
import { ROCKS } from "./defs/rocks.ts";
import { rockShare } from "./rocks.ts";

/** Nodes a tile's side. */
const TILE = 32;

/** The share under which no rock is laid, and the one it is whole at. */
export const MASK = [ROCKS.skin.from, 0.45] as const;

type Grid = {
  readonly bed: Level;
  readonly tiles: Map<number, Float32Array | null>;
};

const grids = new WeakMap<Level, Grid>();

function gridOf(level: Level): Grid {
  const bed = level.bedrock ?? level;
  let g = grids.get(bed);
  if (!g) {
    g = { bed, tiles: new Map() };
    grids.set(bed, g);
  }
  return g;
}

/** The slope (m per m) under which a node is never asked, well short of
 * where a wall starts (`ROCKS.wall`). */
const LEAST = 0.85;

/** The heightfield's own slope at node (c, r), centrally differenced. */
function slopeAt(f: Level["ground"], c: number, r: number): number {
  const d = f.data;
  const c0 = Math.max(0, c - 1);
  const c1 = Math.min(f.cols - 1, c + 1);
  const r0 = Math.max(0, r - 1) * f.cols;
  const r1 = Math.min(f.rows - 1, r + 1) * f.cols;
  const gx = (d[r * f.cols + c1] - d[r * f.cols + c0]) / (2 * f.cell);
  const gz = (d[r1 + c] - d[r0 + c]) / (2 * f.cell);
  return Math.sqrt(gx * gx + gz * gz);
}

function tileOf(g: Grid, ti: number, tj: number): Float32Array | null {
  const key = ti * 4096 + tj;
  const had = g.tiles.get(key);
  if (had !== undefined) return had;
  const f = g.bed.ground;
  const out = new Float32Array(TILE * TILE);
  let any = false;
  for (let b = 0; b < TILE; b++) {
    const r = tj * TILE + b;
    if (r >= f.rows) break;
    for (let a = 0; a < TILE; a++) {
      const c = ti * TILE + a;
      if (c >= f.cols) break;
      // Only a node on a slope near a wall's is asked: the rest is snow.
      if (slopeAt(f, c, r) < LEAST) continue;
      const v = rockShare(g.bed, f.originX + c * f.cell, f.originZ + r * f.cell);
      if (v > 0) {
        out[b * TILE + a] = v;
        any = true;
      }
    }
  }
  const kept = any ? out : null;
  g.tiles.set(key, kept);
  return kept;
}

/** The share at node (c, r), 0 off the map. */
function nodeOf(g: Grid, c: number, r: number): number {
  const f = g.bed.ground;
  if (c < 0 || r < 0 || c >= f.cols || r >= f.rows) return 0;
  const t = tileOf(g, Math.floor(c / TILE), Math.floor(r / TILE));
  return t ? t[(r % TILE) * TILE + (c % TILE)] : 0;
}

const ease = (x: number): number => {
  const t = Math.max(0, Math.min(1, (x - MASK[0]) / (MASK[1] - MASK[0])));
  return t * t * (3 - 2 * t);
};

/** HOW MUCH OF THE GROUND AT (x, z) IS ROCK, 0..1 — the nodes round it
 * blended and eased, as the ground's shader blends them. */
export function rockMask(level: Level, x: number, z: number): number {
  const g = gridOf(level);
  const f = g.bed.ground;
  const fx = (x - f.originX) / f.cell;
  const fz = (z - f.originZ) / f.cell;
  const c = Math.floor(fx);
  const r = Math.floor(fz);
  const u = fx - c;
  const v = fz - r;
  const a = nodeOf(g, c, r);
  const b = nodeOf(g, c + 1, r);
  const d = nodeOf(g, c, r + 1);
  const e = nodeOf(g, c + 1, r + 1);
  const lo = a + (b - a) * u;
  const raw = lo + (d + (e - d) * u - lo) * v;
  return raw > MASK[0] ? ease(raw) : 0;
}

/** Every node's share, row by row over the map's heightfield — the
 * drawing's copy, read once. */
export function rockShareNodes(level: Level): Float32Array {
  const g = gridOf(level);
  const f = g.bed.ground;
  const out = new Float32Array(f.cols * f.rows);
  for (let tj = 0; tj * TILE < f.rows; tj++) {
    for (let ti = 0; ti * TILE < f.cols; ti++) {
      const t = tileOf(g, ti, tj);
      if (!t) continue;
      for (let b = 0; b < TILE && tj * TILE + b < f.rows; b++) {
        for (let a = 0; a < TILE && ti * TILE + a < f.cols; a++) {
          out[(tj * TILE + b) * f.cols + ti * TILE + a] = t[b * TILE + a];
        }
      }
    }
  }
  return out;
}
