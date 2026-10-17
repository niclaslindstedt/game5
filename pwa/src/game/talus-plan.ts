// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TALUS — the blocks a wall sheds, lying on the ground below it: an
// apron along a rock band's foot and a cone out of every gully's mouth,
// at the angle loose blocks come to rest at (33–37°), SORTED as a real
// one is (the fine stuff stops near the wall, the big blocks roll on to
// the toe) and half buried in the snow. Where each stone lies, its size,
// its shape and its shade — a pure function of the map off hashes of its
// seed on a salt of its own (`TALUS_SALT`), never the engine's stream, so
// no digest moves.
//
// PRESENTATION ONLY, kept out of every skiable line: no stone lies within
// `TALUS.clear` m of packed snow (a run, a lane, a groomed course) or of a
// summer bike trail, nor on a cliff's shelf, face or landing, so nothing a
// skier rides on a run is met there. Off the runs, under a wall, a skier
// passes through them; the physics never reads them (`talus.ts` draws
// them). Three-free and DOM-free.

import {
  ROCKS,
  nearestBikeTrailPoint,
  onAnyCliff,
  regionOf,
  rockDraw,
  rockHash,
  rockyCliff,
  type Level,
} from "@engine";
import { rockShareNodes } from "./rock-share-nodes.ts";

/** The talus's own salt, so its hashes are never the skin's. */
export const TALUS_SALT = 0x7a1a5;

export const TALUS = {
  /** Candidates on a jittered lattice this many m apart. */
  cell: 2.1,
  /** How far below a wall's foot the blocks run out, m. */
  reach: 46,
  /** The steps the walk up the fall line takes looking for the wall, m. */
  step: 3,
  /** A node at least this bare is the wall a block fell from. */
  wall: 0.45,
  /** The slope band a stone lies on (tan): from the toe's 17°, where the
   * big blocks roll out, to a steep 45°, densest at the angle of repose,
   * 33–37° (`repose`). */
  slope: [0.3, 1.0] as const,
  repose: [0.65, 0.75] as const,
  /** No stone within this many m of packed snow or a bike trail. */
  clear: 12,
  /** The stones' size along the run, m: the top's fine stuff to the toe's
   * blocks (scaled 0.6..1.3 a stone). */
  fine: 0.32,
  toe: 2.6,
  /** The share of the candidates kept at the top, falling to the toe. */
  dense: 0.75,
  /** The most stones a square lays; the smallest go first past it. */
  most: 700,
} as const;

/** One stone: where it lies (the ground under it), its half sizes along
 * its own axes, its yaw, the axis it is settled on (half way between the
 * slope's normal and plumb), how deep it is buried, its shade and warmth
 * and which of the shapes it is. */
export type TalusStone = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly yaw: number;
  readonly ux: number;
  readonly uy: number;
  readonly uz: number;
  readonly bury: number;
  readonly shade: number;
  readonly warm: number;
  readonly shape: number;
  /** Where along the run it lies, 0 at the wall's foot, 1 at the toe. */
  readonly run: number;
};

/** The number of shapes `talus.ts` builds. */
export const TALUS_SHAPES = 6;

/** A smooth value noise of a hash, 0..1 (the fans along a wall's foot). */
function fan(seed: number, x: number, z: number, scale: number): number {
  const fx = x / scale;
  const fz = z / scale;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const v = (a: number, b: number): number => rockDraw(rockHash(seed, a, b), 0);
  const top = v(i, j) + (v(i + 1, j) - v(i, j)) * sx;
  const bot = v(i, j + 1) + (v(i + 1, j + 1) - v(i, j + 1)) * sx;
  return top + (bot - top) * sz;
}

/** The talus is planned a square of the map at a time, this many m a
 * side, as the lens nears it (`talus.ts`): the whole map's at once is a
 * second or two of work no loading card should wait on. */
export const TALUS_TILE = 128;

const memo = new WeakMap<Level, Map<number, readonly TalusStone[]>>();

/** The stones of the talus square `(i, j)` (`TALUS_TILE` m a side; none
 * where its region lays no rock), planned once a map. */
export function talusTile(level: Level, i: number, j: number): readonly TalusStone[] {
  let tiles = memo.get(level);
  if (!tiles) {
    tiles = new Map();
    memo.set(level, tiles);
  }
  const key = j * 4096 + i;
  const had = tiles.get(key);
  if (had) return had;
  const out = planTile(level, i, j);
  tiles.set(key, out);
  return out;
}

function planTile(level: Level, ti: number, tj: number): TalusStone[] {
  if (!regionOf(level).rock) return [];
  const bed = level.bedrock ?? level;
  const f = bed.ground;
  const nodes = rockShareNodes(level);
  const cliffs = (level.cliffs ?? []).filter(rockyCliff);
  if (!nodes && cliffs.length === 0) return [];
  const T = TALUS;
  const seed = rockHash(level.seed, TALUS_SALT);
  const shareAt = (x: number, z: number): number => {
    if (!nodes) return 0;
    const c = Math.round((x - f.originX) / f.cell);
    const r = Math.round((z - f.originZ) / f.cell);
    if (c < 0 || r < 0 || c >= f.cols || r >= f.rows) return 0;
    return nodes[r * f.cols + c];
  };
  // A rocky cliff's face below its lip, the wall a block falls off: a
  // point within its width and between its lip and foot.
  const onFace = (x: number, z: number): boolean => {
    for (const c of cliffs) {
      const dx = x - c.x;
      const dz = z - c.z;
      const down = dx * Math.sin(c.heading) + dz * Math.cos(c.heading);
      const across = dx * Math.cos(c.heading) - dz * Math.sin(c.heading);
      if (Math.abs(across) < c.width / 2 && down > 0 && down < c.face) return true;
    }
    return false;
  };
  // THE MASK: the 16 m cells of the square a stone may lie in, within
  // `reach` of a bare node or below a rocky cliff — so the walk is asked
  // only there.
  const x0 = ti * TALUS_TILE;
  const z0 = tj * TALUS_TILE;
  const mc = TALUS_TILE / 16;
  const mask = new Uint8Array(mc * mc);
  let any = false;
  const mark = (x: number, z: number, r: number): void => {
    const i0 = Math.max(0, Math.floor((x - r - x0) / 16));
    const i1 = Math.min(mc - 1, Math.floor((x + r - x0) / 16));
    const j0 = Math.max(0, Math.floor((z - r - z0) / 16));
    const j1 = Math.min(mc - 1, Math.floor((z + r - z0) / 16));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        mask[j * mc + i] = 1;
        any = true;
      }
    }
  };
  if (nodes) {
    const r = T.reach + 4;
    const c0 = Math.max(0, Math.floor((x0 - r - f.originX) / f.cell));
    const c1 = Math.min(f.cols - 1, Math.ceil((x0 + TALUS_TILE + r - f.originX) / f.cell));
    const r0 = Math.max(0, Math.floor((z0 - r - f.originZ) / f.cell));
    const r1 = Math.min(f.rows - 1, Math.ceil((z0 + TALUS_TILE + r - f.originZ) / f.cell));
    for (let rr = r0; rr <= r1; rr += 2) {
      for (let c = c0; c <= c1; c += 2) {
        if (nodes[rr * f.cols + c] > T.wall)
          mark(f.originX + c * f.cell, f.originZ + rr * f.cell, r);
      }
    }
  }
  for (const c of cliffs) {
    const d = c.face + T.reach / 2;
    mark(c.x + Math.sin(c.heading) * d, c.z + Math.cos(c.heading) * d, c.width / 2 + T.reach);
  }
  if (!any) return [];
  const n = { x: 0, y: 1, z: 0 };
  const m = { x: 0, y: 1, z: 0 };
  const clear = (x: number, z: number): boolean => {
    if (bed.packedAt(x, z) > ROCKS.packed) return false;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      for (const r of [T.clear / 2, T.clear]) {
        if (bed.packedAt(x + Math.cos(a) * r, z + Math.sin(a) * r) > ROCKS.packed) return false;
      }
    }
    if (onAnyCliff(bed, x, z, 3)) return false;
    if (level.bikePark) {
      const near = nearestBikeTrailPoint(level, x, z, T.clear + 8);
      if (near && near.distance < near.half + T.clear) return false;
    }
    return true;
  };
  const out: TalusStone[] = [];
  const per = Math.round(TALUS_TILE / T.cell);
  const pitch = TALUS_TILE / per;
  for (let jj = 0; jj < per; jj++) {
    for (let ii = 0; ii < per; ii++) {
      const i = ti * per + ii;
      const j = tj * per + jj;
      const h = rockHash(seed, i, j);
      const x = (i + 0.5 + (rockDraw(h, 0) - 0.5) * 0.9) * pitch;
      const z = (j + 0.5 + (rockDraw(h, 1) - 0.5) * 0.9) * pitch;
      const mi = Math.floor((x - x0) / 16);
      const mj = Math.floor((z - z0) / 16);
      if (mi < 0 || mj < 0 || mi >= mc || mj >= mc || !mask[mj * mc + mi]) continue;
      if (shareAt(x, z) > 0.05) continue;
      bed.normalAt(x, z, n);
      const tan = Math.hypot(n.x, n.z) / Math.max(1e-3, n.y);
      if (tan < T.slope[0] || tan > T.slope[1]) continue;
      // UP THE FALL LINE to the wall it fell from (the normal leans
      // downhill), following the slope as it bends.
      let px = x;
      let pz = z;
      let foot = -1;
      for (let s = T.step; s <= T.reach; s += T.step) {
        bed.normalAt(px, pz, m);
        const l = Math.hypot(m.x, m.z) || 1;
        px -= (m.x / l) * T.step;
        pz -= (m.z / l) * T.step;
        if (shareAt(px, pz) > T.wall || onFace(px, pz)) {
          foot = s;
          break;
        }
      }
      if (foot < 0) continue;
      const run = foot / T.reach;
      // Densest at the angle of repose, thinner off it; in FANS along the
      // foot (the cones out of the gullies' mouths); thinner to the toe.
      const off =
        tan < T.repose[0]
          ? (T.repose[0] - tan) / 0.35
          : tan > T.repose[1]
            ? (tan - T.repose[1]) / 0.25
            : 0;
      // Under the repose only the blocks that rolled on, toward the toe.
      const slopeW = Math.max(0, 1 - off) * (tan < T.repose[0] ? 0.4 + 0.6 * run : 1);
      const fans = fan(seed ^ 0x66616e, x, z, 38);
      const keep = T.dense * slopeW * (0.2 + 1.3 * fans * fans) * (1 - 0.6 * run);
      if (rockDraw(h, 2) > keep) continue;
      if (!clear(x, z)) continue;
      const u = rockDraw(h, 3);
      const size = (T.fine + (T.toe - T.fine) * run ** 1.3) * (0.6 + 0.7 * u);
      const shape = Math.floor(rockDraw(h, 4) * TALUS_SHAPES);
      // A piece's proportions: a rounded boulder, a slab, a shard, a block.
      const kind = Math.floor(rockDraw(h, 5) * 4);
      const st = [
        [1, 0.8, 0.95],
        [1.25, 0.42, 1.05],
        [1.45, 0.62, 0.62],
        [1.05, 0.85, 0.9],
      ][kind];
      const e = 0.85 + 0.3 * rockDraw(h, 6);
      const sx = (size / 2) * st[0] * e;
      const sy = (size / 2) * st[1];
      const sz = ((size / 2) * st[2]) / e;
      // Settled half way between lying on the slope and plumb.
      let ux = n.x * 0.5;
      let uy = n.y * 0.5 + 0.5;
      let uz = n.z * 0.5;
      const ul = Math.hypot(ux, uy, uz);
      ux /= ul;
      uy /= ul;
      uz /= ul;
      out.push({
        x,
        y: bed.groundAt(x, z),
        z,
        sx,
        sy,
        sz,
        yaw: rockDraw(h, 7) * Math.PI * 2,
        ux,
        uy,
        uz,
        bury: (0.22 + 0.2 * rockDraw(h, 8)) * sy * 2,
        shade: 0.62 + 0.4 * rockDraw(h, 9),
        warm: (rockDraw(h, 10) - 0.5) * 2,
        shape,
        run,
      });
    }
  }
  if (out.length > T.most) {
    // The smallest go first.
    out.sort((a, b) => b.sy - a.sy);
    out.length = T.most;
  }
  return out;
}
