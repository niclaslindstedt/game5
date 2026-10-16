// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE ROCK'S SKIN LIES, ON THE GROUND'S OWN GRID — the engine's
// `rockShare` (how bare a wall is, the share the skin is laid by) read once
// at every node of the map's heightfield, for the ground's texture to carry
// (`terrain.ts`, below nought in its packed channel: no sampler of its
// own).
// Three-free and DOM-free.

import { ROCKS, onAnyCliff, regionOf, rockShare, wallOf, type Level } from "@engine";

/** Nodes within `r` of a packed one, by two sliding windows (a square, a
 * little wider than `rockShare`'s disc). */
function nearPacked(level: Level, r: number): Uint8Array | null {
  const f = level.ground;
  const p = level.packed;
  if (!p || p.data.length !== f.cols * f.rows) return null;
  const { cols, rows } = f;
  const a = new Uint8Array(cols * rows);
  for (let k = 0; k < a.length; k++) a[k] = p.data[k] > ROCKS.packed ? 1 : 0;
  const b = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    let n = 0;
    for (let i = -r; i < cols; i++) {
      const add = i + r;
      if (add < cols) n += a[j * cols + add];
      const drop = i - r - 1;
      if (drop >= 0) n -= a[j * cols + drop];
      if (i >= 0) b[j * cols + i] = n > 0 ? 1 : 0;
    }
  }
  for (let i = 0; i < cols; i++) {
    let n = 0;
    for (let j = -r; j < rows; j++) {
      const add = j + r;
      if (add < rows) n += b[add * cols + i];
      const drop = j - r - 1;
      if (drop >= 0) n -= b[drop * cols + i];
      if (j >= 0) a[j * cols + i] = n > 0 ? 1 : 0;
    }
  }
  return a;
}

/** Every node's share, row by row, or null where the map lays no rock. */
export function rockShareNodes(level: Level): Float32Array | null {
  if (!regionOf(level).rock) return null;
  const f = level.ground;
  // Where no packed snow lies within reach the engine's own ring of reads
  // can only say so: the share is the wall's and the cliffs', asked
  // directly. A bike park (summer) is asked the engine's whole way.
  const near = level.bikePark
    ? null
    : nearPacked(level.bedrock ?? level, Math.ceil(ROCKS.skin.clear / f.cell) + 2);
  const bed = level.bedrock ?? level;
  const n = { x: 0, y: 1, z: 0 };
  const d = bed.ground.data;
  const lastC = f.cols - 1;
  const lastR = f.rows - 1;
  // Under a wall's slope, in metres of height a cell, squared — with room
  // for a map whose normal is read off more than its grid.
  const flat = (ROCKS.wall * 0.8 * f.cell) ** 2;
  const out = new Float32Array(f.cols * f.rows);
  let any = false;
  for (let r = 0; r < f.rows; r++) {
    for (let c = 0; c < f.cols; c++) {
      const x = f.originX + c * f.cell;
      const z = f.originZ + r * f.cell;
      // A node whose every one-sided slope on the grid is under a wall's
      // has none (the engine's normal at a node is one of them), so the
      // flat ground is passed over without asking.
      const k = r * f.cols + c;
      const h = d[k];
      const gx = Math.max(
        c < lastC ? Math.abs(d[k + 1] - h) : 0,
        c > 0 ? Math.abs(h - d[k - 1]) : 0,
      );
      const gz = Math.max(
        r < lastR ? Math.abs(d[k + f.cols] - h) : 0,
        r > 0 ? Math.abs(h - d[k - f.cols]) : 0,
      );
      if (gx * gx + gz * gz < flat) continue;
      // The wall's share off the normal the engine reads first: none under
      // a wall's slope, and then nothing else need be asked.
      bed.normalAt(x, z, n);
      const wall = wallOf(n);
      if (wall <= 0) continue;
      let v: number;
      if (near && !near[r * f.cols + c]) {
        v = bed.packedAt(x, z) > ROCKS.packed || onAnyCliff(bed, x, z, 0) ? 0 : wall;
      } else v = rockShare(level, x, z);
      if (v > 0) {
        out[r * f.cols + c] = v;
        any = true;
      }
    }
  }
  return any ? out : null;
}
