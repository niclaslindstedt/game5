// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK AS THE GROUND DRAWS IT, ON THE PROCESSOR — the clipmap's
// vertices lifted by `ROCK_VERTEX` (`rock-relief-glsl.ts`) and the triangle
// between them, worked out again here so the drawn rock can be held to the
// rock a body meets (`withRock`): the rock eval lab's physics gap
// (`make rock-eval`) and `tests/rock_drawn_test.ts`. Three-free and
// DOM-free. The only thing it leaves out is the morph a level's last
// quarter makes toward the next one (a point there is read on the next,
// coarser level, which it is most of the way to).

import { RELIEF, bedrockOf, reliefParams, reliefParts, rockMask, type Level } from "@engine";

/** The clipmap as it stands: its finest spacing and side (cells), its
 * levels' centres, the first and last level drawn, and the lens. */
export type ClipView = {
  n: number;
  spacing: number;
  reliefHalf: number;
  centres: { x: number; z: number }[];
  base: number;
  last: number;
  eye: { x: number; z: number };
};

const views = new WeakMap<Level, ClipView>();

/** The clipmap `terrain.ts` drew `level` with last. */
export function clipViewOf(level: Level): ClipView | undefined {
  return views.get(bedrockOf(level));
}

/** Kept by `terrain.ts` each time it moves the clipmap. */
export function keepClipView(level: Level, view: ClipView): void {
  views.set(bedrockOf(level), view);
}

const parts = { beds: 0, ribs: 0, lift: 0 };
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The ground map's slope at (x, z) as `groundTextures` writes it (each
 * node's central difference) and the hardware blends it. */
function slopeAt(level: Level, x: number, z: number): number {
  const f = level.ground;
  const d = f.data;
  const node = (c: number, r: number, out: number[]): void => {
    c = Math.min(f.cols - 1, Math.max(0, c));
    r = Math.min(f.rows - 1, Math.max(0, r));
    const at = (cc: number, rr: number): number =>
      d[Math.min(f.rows - 1, Math.max(0, rr)) * f.cols + Math.min(f.cols - 1, Math.max(0, cc))];
    out[0] = (at(c + 1, r) - at(c - 1, r)) / (2 * f.cell);
    out[1] = (at(c, r + 1) - at(c, r - 1)) / (2 * f.cell);
  };
  const fx = (x - f.originX) / f.cell;
  const fz = (z - f.originZ) / f.cell;
  const c = Math.floor(fx);
  const r = Math.floor(fz);
  const u = fx - c;
  const v = fz - r;
  const a = [0, 0];
  const b = [0, 0];
  const e = [0, 0];
  const g = [0, 0];
  node(c, r, a);
  node(c + 1, r, b);
  node(c, r + 1, e);
  node(c + 1, r + 1, g);
  const gx = (a[0] * (1 - u) + b[0] * u) * (1 - v) + (e[0] * (1 - u) + g[0] * u) * v;
  const gz = (a[1] * (1 - u) + b[1] * u) * (1 - v) + (e[1] * (1 - u) + g[1] * u) * v;
  return Math.hypot(gx, gz);
}

/** A vertex of the drawn ground at (x, z): its height over the ground
 * under the rock (the loose cover left out — it is the snow's), m. */
function vertexRock(level: Level, view: ClipView, x: number, z: number): number {
  const m = rockMask(level, x, z);
  if (m <= 0) return 0;
  const p = reliefParams(level);
  const y = level.groundAt(x, z);
  reliefParts(p, x, z, y, parts);
  const r = Math.max(view.spacing, Math.hypot(x - view.eye.x, z - view.eye.z) / view.reliefHalf);
  const rs = Math.max(slopeAt(level, x, z), 0.3);
  const fb = smooth(2, 4, p.bed / (rs * r));
  const fr = smooth(2, 4, RELIEF.rib / r);
  return m * (parts.beds * fb + parts.ribs * fr + parts.lift);
}

/** The drawn rock's height at (x, z) as the clipmap draws it, m, or null
 * where no level drawn reaches. `level` is the bare map. */
export function drawnRockAt(level: Level, view: ClipView, x: number, z: number): number | null {
  const half = view.n / 2;
  for (let l = view.base; l <= view.last; l++) {
    const s = view.spacing * 2 ** l;
    const c = view.centres[l];
    const gi = (x - c.x) / s + half;
    const gj = (z - c.z) / s + half;
    // Inside this level and short of its morph (a finer one, if drawn,
    // stands over it there).
    if (Math.max(Math.abs(gi - half), Math.abs(gj - half)) > 0.72 * half) continue;
    const i = Math.floor(gi);
    const j = Math.floor(gj);
    const u = gi - i;
    const v = gj - j;
    const at = (a: number, b: number): number => {
      const vx = c.x + (i + a - half) * s;
      const vz = c.z + (j + b - half) * s;
      return level.groundAt(vx, vz) + vertexRock(level, view, vx, vz);
    };
    // The cell's two triangles split along its b–c diagonal
    // (`clipmapIndices`: a, c, b and b, c, d).
    if (u + v <= 1) {
      const a = at(0, 0);
      return a + (at(1, 0) - a) * u + (at(0, 1) - a) * v;
    }
    const d = at(1, 1);
    return d + (at(0, 1) - d) * (1 - u) + (at(1, 0) - d) * (1 - v);
  }
  return null;
}
