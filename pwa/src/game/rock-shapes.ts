// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK AS BUILT — the DROPS' whole surface as coarse, faceted rock in
// the world frame: few triangles, all of them carrying the shape (no
// texture does it), flat-lit a facet at a time so a plane catches the sun
// and the next goes dark.
//
// A CLIFF'S WALL (`buildWall`): the engine's skin of corners over a rocky
// cliff's face (`cliffWalls`), lip to foot, two triangles a cell. (A wall
// too steep for snow is not built here: the ground itself is reshaped into
// its rock and drawn so — `rock-relief-glsl.ts`.)
//
// SNOW HOLDS ON A FACET THAT FACES UP: past `SNOW_HOLDS` of the sky the
// facet is painted snow, between it and `SNOW_SLIDES` a mix, the rest the
// region's rock in a shade of its own a facet. Three-free: plain arrays the
// draw (`rocks.ts`) hands the GPU and the suite counts.

import { rockDraw as unit, type CliffWall } from "@engine";
import { summerShown } from "./season-look.ts";

/** How dark the rock is where it goes into the snow, of its own colour. */
const FOOT = 0.45;

/** Linear 0..1 RGB, the way `region-look.ts` authors its tones. */
export type Tone = readonly [number, number, number];

/** The facet's up share (its normal's y) snow lies whole on, and the one
 * it slides off below. */
export const SNOW_HOLDS = 0.62;
export const SNOW_SLIDES = 0.42;
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
/** IN SUMMER the up-facing facets carry turf and lichen, not snow, and
 * only half cover them: a grey-green, linear. */
const LEDGE: Tone = [0.15, 0.17, 0.1];

/** The triangles a run of outcrops makes: positions, flat normals and
 * colours, three floats a vertex, three vertices a triangle — and the
 * same rock CALMED for the distance (`soft`, `calm`): the smooth normal of
 * the ground under each corner and the colour a facet of the rock's mean
 * shade would wear facing that way. Far out a facet is a few pixels and
 * its own shade and lighting only twinkle as the lens moves, so the draw
 * eases each corner over to its calm pair with distance (`rocks.ts`). */
export type RockMesh = {
  readonly pos: number[];
  readonly nrm: number[];
  readonly col: number[];
  readonly soft: number[];
  readonly calm: number[];
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
  calmOf: (p: P, n: P) => { n: P; col: Tone },
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
    const calm = calmOf(p, [nx, ny, nz]);
    m.pos.push(p[0], p[1], p[2]);
    m.nrm.push(nx, ny, nz);
    m.col.push(col[0] * k, col[1] * k, col[2] * k);
    m.soft.push(calm.n[0], calm.n[1], calm.n[2]);
    m.calm.push(calm.col[0] * k, calm.col[1] * k, calm.col[2] * k);
  }
}

/** A facet's paint off hash `h`'s draws from `n`: its own shade of the
 * rock `stone`, snow over it by how much it faces the sky. */
function paintOf(stone: Tone, h: number, n: number, holds = SNOW_HOLDS): (ny: number) => Tone {
  const f = 0.72 + 0.5 * unit(h, n);
  const warm = (unit(h, n + 1) - 0.5) * 0.05;
  return snowOver(holds, [stone[0] * f * (1 + warm), stone[1] * f, stone[2] * f * (1 - warm)]);
}

/** The paint of a facet of the rock's MEAN shade (`paintOf`'s middle draw,
 * no warmth): what the calmed rock wears. */
function calmPaint(stone: Tone, holds = SNOW_HOLDS): (ny: number) => Tone {
  const f = 0.72 + 0.5 * 0.5;
  return snowOver(holds, [stone[0] * f, stone[1] * f, stone[2] * f]);
}

/** `rock` with snow over it by the up share `ny`, whole past `holds`. */
function snowOver(holds: number, rock: Tone): (ny: number) => Tone {
  const slides = holds - (SNOW_HOLDS - SNOW_SLIDES);
  const summer = summerShown();
  const cover = summer ? LEDGE : SNOW;
  const most = summer ? 0.5 : 1;
  return (ny) => {
    const snow = most * Math.max(0, Math.min(1, (ny - slides) / (holds - slides)));
    return [
      rock[0] + (cover[0] - rock[0]) * snow,
      rock[1] + (cover[1] - rock[1]) * snow,
      rock[2] + (cover[2] - rock[2]) * snow,
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
  // Calm: a wall has no ground under it to borrow a normal from, so its
  // facets keep their own and wear the rock's mean shade.
  const calm = calmPaint(stone);
  const calmOf = (_p: P, n: P): { n: P; col: Tone } => ({ n, col: calm(n[1]) });
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
        tri(m, a, b, c, inside, paintOf(stone, h, 1), shadeAt, calmOf);
        tri(m, a, c, d, inside, paintOf(stone, h, 3), shadeAt, calmOf);
      } else {
        tri(m, a, b, d, inside, paintOf(stone, h, 1), shadeAt, calmOf);
        tri(m, b, c, d, inside, paintOf(stone, h, 3), shadeAt, calmOf);
      }
    }
  }
}

/** A fresh, empty mesh. */
export const rockMesh = (): RockMesh => ({ pos: [], nrm: [], col: [], soft: [], calm: [] });
