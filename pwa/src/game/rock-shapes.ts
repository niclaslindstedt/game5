// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK AS BUILT — the DROPS' whole surface as coarse, faceted rock in
// the world frame: few triangles, all of them carrying the shape (no
// texture does it), flat-lit a facet at a time so a plane catches the sun
// and the next goes dark.
//
// A WALL'S SKIN (`buildSkin`): a jittered lattice of corners over the
// natural walls too steep to hold snow (the engine's `rockShare`), each
// corner stood a little proud of the ground where it is bare and tucked
// under the snow where it is not, so the rock is the surface of the whole
// steep face and its edges, the top of the hill among them, go into the
// snow rather than stopping. A CLIFF'S WALL (`buildWall`): the engine's
// skin of corners over a rocky cliff's face (`cliffWalls`), lip to foot.
// Two triangles a cell of either.
//
// SNOW HOLDS ON A FACET THAT FACES UP: past `SNOW_HOLDS` of the sky the
// facet is painted snow, between it and `SNOW_SLIDES` a mix, the rest the
// region's rock in a shade of its own a facet. Three-free: plain arrays the
// draw (`rocks.ts`) hands the GPU and the suite counts.

import { ROCKS, rockDraw as unit, rockHash, rockShare, type CliffWall, type Level } from "@engine";

/** How dark the rock is where it goes into the snow, of its own colour. */
const FOOT = 0.45;

/** Linear 0..1 RGB, the way `region-look.ts` authors its tones. */
export type Tone = readonly [number, number, number];

/** The facet's up share (its normal's y) snow lies whole on, and the one
 * it slides off below. */
export const SNOW_HOLDS = 0.62;
export const SNOW_SLIDES = 0.42;
/** A wall's skin lies at 50° and more, so snow holds only on its ledges:
 * whole past this up share (a facet tipped under 30°). */
const SKIN_HOLDS = 0.87;
/** The region's rock tone as the crags paint it: the region's hue, warmed
 * a little and brought to one VALUE (`ROCK_VALUE`, linear luminance) —
 * the shader's tone is that rock seen through a skin of snow and
 * spindrift, and bare stone is a weathered grey-brown, never the
 * near-black a dark albedo under a blue sky turns to nor the beige a pale
 * one goes in flat light. */
const WARM: Tone = [1.08, 1.0, 0.88];
export const ROCK_VALUE = 0.27;
export function rockTone(tone: Tone): Tone {
  const r = tone[0] * WARM[0];
  const g = tone[1] * WARM[1];
  const b = tone[2] * WARM[2];
  const k = ROCK_VALUE / Math.max(1e-3, 0.2126 * r + 0.7152 * g + 0.0722 * b);
  return [r * k, g * k, b * k];
}
/** Snow on rock, linear — a shade under the open snow's glare, lying thin. */
const SNOW: Tone = [0.86, 0.89, 0.94];

/** The triangles a run of outcrops makes: positions, flat normals and
 * colours, three floats a vertex, three vertices a triangle. */
export type RockMesh = {
  readonly pos: number[];
  readonly nrm: number[];
  readonly col: number[];
};

type P = [number, number, number];

/** A triangle, wound so its normal points away from `inside`. */
function tri(
  m: RockMesh,
  a: P,
  b: P,
  c: P,
  inside: P,
  paint: (ny: number) => Tone,
  shadeAt: (p: P) => number,
): void {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const ez = b[2] - a[2];
  const fx = c[0] - a[0];
  const fy = c[1] - a[1];
  const fz = c[2] - a[2];
  let nx = ey * fz - ez * fy;
  let ny = ez * fx - ex * fz;
  let nz = ex * fy - ey * fx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  const mx = (a[0] + b[0] + c[0]) / 3 - inside[0];
  const my = (a[1] + b[1] + c[1]) / 3 - inside[1];
  const mz = (a[2] + b[2] + c[2]) / 3 - inside[2];
  let q = b;
  let r = c;
  if (nx * mx + ny * my + nz * mz < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
    q = c;
    r = b;
  }
  const col = paint(ny);
  for (const p of [a, q, r]) {
    const k = shadeAt(p);
    m.pos.push(p[0], p[1], p[2]);
    m.nrm.push(nx, ny, nz);
    m.col.push(col[0] * k, col[1] * k, col[2] * k);
  }
}

/** A corner of a wall's skin: where it stands and how bare it is there. */
type Corner = { readonly p: P; readonly bare: number };

/** Append the ROCK SKIN of a wall over lattice cells `i0..i1` × `j0..j1`
 * (exclusive ends, the lattice `cell` m and global, so two tiles share
 * the corners on their seam) to `m`, its rock `tone`: a corner every
 * cell, jittered in plan off a hash of the map's `seed` and its place,
 * standing over the ground where it is bare (`rockShare`) — `proud` and up
 * to `rough` more by how bare — and tucked under the snow where it is not;
 * every cell with a bare corner laid as two flat facets, split along a
 * diagonal of its own. So the rock is the whole steep surface, from where
 * the slope turns too steep for snow to where it eases at the top, broken
 * into big flat planes at odd angles, with the snow on every facet that
 * faces the sky. */
export function buildSkin(
  m: RockMesh,
  level: Level,
  tone: Tone,
  seed: number,
  cell: number,
  i0: number,
  j0: number,
  i1: number,
  j1: number,
): void {
  const S = ROCKS.skin;
  const stone = rockTone(tone);
  const w = i1 - i0 + 1;
  const corners: (Corner | null)[] = new Array(w * (j1 - j0 + 1)).fill(null);
  const cornerAt = (i: number, j: number): Corner => {
    const k = (j - j0) * w + (i - i0);
    const had = corners[k];
    if (had) return had;
    const h = rockHash(seed, i, j);
    const x = (i + (unit(h, 0) - 0.5) * 2 * S.jitter) * cell;
    const z = (j + (unit(h, 1) - 0.5) * 2 * S.jitter) * cell;
    const bare = rockShare(level, x, z);
    const ground = level.groundAt(x, z);
    const y = bare > S.from ? ground + S.proud + S.rough * bare * unit(h, 2) : ground - S.sink;
    const c: Corner = { p: [x, y, z], bare };
    corners[k] = c;
    return c;
  };
  const shadeAt = (p: P): number => (p[1] < level.groundAt(p[0], p[2]) ? FOOT + 0.2 : 1);
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const a = cornerAt(i, j);
      const b = cornerAt(i + 1, j);
      const c = cornerAt(i + 1, j + 1);
      const d = cornerAt(i, j + 1);
      if (Math.max(a.bare, b.bare, c.bare, d.bare) <= S.from) continue;
      const h = rockHash(seed, i, j, 7);
      const mx = (a.p[0] + b.p[0] + c.p[0] + d.p[0]) / 4;
      const mz = (a.p[2] + b.p[2] + c.p[2] + d.p[2]) / 4;
      // Under the ground at the cell's middle: inside the hill.
      const inside: P = [mx, level.groundAt(mx, mz) - 3, mz];
      if (unit(h, 0) < 0.5) {
        tri(m, a.p, b.p, c.p, inside, paintOf(stone, h, 1, SKIN_HOLDS), shadeAt);
        tri(m, a.p, c.p, d.p, inside, paintOf(stone, h, 3, SKIN_HOLDS), shadeAt);
      } else {
        tri(m, a.p, b.p, d.p, inside, paintOf(stone, h, 1, SKIN_HOLDS), shadeAt);
        tri(m, b.p, c.p, d.p, inside, paintOf(stone, h, 3, SKIN_HOLDS), shadeAt);
      }
    }
  }
}

/** A facet's paint off hash `h`'s draws from `n`: its own shade of the
 * rock `stone`, snow over it by how much it faces the sky. */
function paintOf(stone: Tone, h: number, n: number, holds = SNOW_HOLDS): (ny: number) => Tone {
  const slides = holds - (SNOW_HOLDS - SNOW_SLIDES);
  return (ny) => {
    const f = 0.72 + 0.5 * unit(h, n);
    const warm = (unit(h, n + 1) - 0.5) * 0.05;
    const rock: Tone = [stone[0] * f * (1 + warm), stone[1] * f, stone[2] * f * (1 - warm)];
    const snow = Math.max(0, Math.min(1, (ny - slides) / (holds - slides)));
    return [
      rock[0] + (SNOW[0] - rock[0]) * snow,
      rock[1] + (SNOW[1] - rock[1]) * snow,
      rock[2] + (SNOW[2] - rock[2]) * snow,
    ];
  };
}

/** Append cliff `w`'s ROCK WALL to `m` (`cliff-wall.ts`' skin of corners),
 * its rock `tone`: two flat facets a cell of the skin, each cell split
 * along a diagonal of its own so no two read alike, every facet its own
 * shade of the rock, snow on the ones up at the lip that face the sky, and
 * the foot darkened where it goes into the snow. Two triangles a cell, a
 * few hundred a cliff. */
export function buildWall(m: RockMesh, w: CliffWall, tone: Tone): void {
  const stone = rockTone(tone);
  const { rows, cols, pos } = w;
  const fx = Math.sin(w.heading);
  const fz = Math.cos(w.heading);
  const corner = (r: number, j: number): P => {
    const i = (r * cols + j) * 3;
    return [pos[i], pos[i + 1], pos[i + 2]];
  };
  // Darker toward the foot: the sky hidden from the bottom of the wall.
  const lipY = (j: number): number => corner(1, j)[1];
  const footY = (j: number): number => corner(rows - 1, j)[1];
  for (let r = 0; r < rows - 1; r++) {
    for (let j = 0; j < cols - 1; j++) {
      const h = (w.hash ^ Math.imul(r + 1, 0x9e3779b1) ^ Math.imul(j + 1, 0x85ebca6b)) >>> 0;
      const a = corner(r, j);
      const b = corner(r, j + 1);
      const c = corner(r + 1, j + 1);
      const d = corner(r + 1, j);
      const mx = (a[0] + b[0] + c[0] + d[0]) / 4;
      const my = (a[1] + b[1] + c[1] + d[1]) / 4;
      const mz = (a[2] + b[2] + c[2] + d[2]) / 4;
      // Behind the face: back into the hill and down.
      const inside: P = [mx - fx * 3, my - 2, mz - fz * 3];
      const top = Math.max(lipY(j), lipY(j + 1));
      const bottom = Math.min(footY(j), footY(j + 1));
      const shadeAt = (p: P): number =>
        FOOT + (1 - FOOT) * Math.min(1, Math.max(0, (p[1] - bottom) / Math.max(0.5, top - bottom)));
      if (unit(h, 0) < 0.5) {
        tri(m, a, b, c, inside, paintOf(stone, h, 1), shadeAt);
        tri(m, a, c, d, inside, paintOf(stone, h, 3), shadeAt);
      } else {
        tri(m, a, b, d, inside, paintOf(stone, h, 1), shadeAt);
        tri(m, b, c, d, inside, paintOf(stone, h, 3), shadeAt);
      }
    }
  }
}

/** A fresh, empty mesh. */
export const rockMesh = (): RockMesh => ({ pos: [], nrm: [], col: [] });
