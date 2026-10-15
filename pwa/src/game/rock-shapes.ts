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

import {
  ROCKS,
  bareKept,
  bedCoord,
  bedLevel,
  bedOf,
  jointOf,
  riserOf,
  rockDraw as unit,
  rockHash,
  rockShare,
  ribOf,
  sliceTri,
  SLICE_STRIDE as F,
  snowShare,
  strataOf,
  type CliffWall,
  type Level,
  type SliceVerts,
  type Strata,
  type StrataCorner,
} from "@engine";
import { summerShown } from "./season-look.ts";

/** How dark the rock is where it goes into the snow, of its own colour. */
const FOOT = 0.45;
/** The snow the beds' treads hold on the mean (`snowShare`'s `held`
 * over a bed, its riser and the beds that shed it): the even cover a
 * calmed far face is painted with. */
const CALM_HELD = 0.06;

/** A CLIFF WALL'S BEDS: about `WALL_BED` m thick (0.45..1.55 of it), each
 * jutting `WALL_JUT` m out of the face at its top (the least and the most)
 * and its foot up to `WALL_CUT` m further in or a little further out; the
 * shader's fine joints run up it every `WALL_JOINT` m, and each block of
 * columns between two of the wall's own joints stands up to `WALL_BLOCK` m
 * out or back. */
const WALL_BED = 1.25;
const WALL_JUT = [0, 0.75] as const;
const WALL_CUT = 0.55;
const WALL_JOINT = 9;
const WALL_BLOCK = 0.45;
/** A bed's joint blocks span `WALL_BLOCKS` columns (the least and the
 * most); a joint's column stands `WALL_NOTCH` m back, its crack; a bed is
 * MASSIVE (twice and more as thick) `WALL_MASSIVE` of the time and a ROOF
 * (an overhang over a deep recess) `WALL_ROOF` of it. */
const WALL_BLOCKS = [1, 6] as const;
const WALL_NOTCH = 0.22;
const WALL_MASSIVE = 0.14;
const WALL_ROOF = 0.16;

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
  /** A vertex's bed and riser-or-tread (`smoothSkin`), -1 on a cliff's
   * wall; and its bed and joint coordinates, two floats, for the shader. */
  readonly zone: number[];
  readonly bed: number[];
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
  along: (p: P) => number,
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
  const l = Math.hypot(nx, ny, nz);
  // A bed pinched to nothing (clamped at the lip or the foot) draws none.
  if (l < 1e-6) return;
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
    m.zone.push(-1);
    // A wall's layers are level and its joints run up it, every so far
    // along it: the beds the shader draws, cut across.
    m.bed.push(p[1], along(p));
  }
}

/** Append the ROCK SKIN of a wall over lattice cells `i0..i1` × `j0..j1`
 * (exclusive ends, the lattice `cell` m and global, so two tiles share
 * the corners on their seam) to `m`, its rock `tone`: a corner every
 * cell, jittered in plan off a hash of the map's `seed` and its place;
 * every cell with a bare corner (`rockShare`) cut into two triangles along
 * a diagonal of its own, each SLICED ALONG THE BEDS (`sliceTri`) and laid
 * at the height the beds stand it (`liftOf`): a riser of bare stone over a
 * flatter tread a bed, the snow on the treads — the same triangles the
 * physics meets (`withRock`). Far out the beds are taken `every` few at
 * once. So the rock is the whole steep surface, from where the slope turns
 * too steep for snow to where it eases at the top, laid in bands of ledges
 * whose risers are crisp lines whatever the lattice. */
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
  every = 1,
): void {
  const S = ROCKS.skin;
  // Laid off the map under the skin the physics rides (`withRock`).
  level = level.bedrock ?? level;
  const st = strataOf(level);
  const ground = (x: number, z: number): number => level.groundAt(x, z);
  const stone = rockTone(tone);
  // A FAR CUT IS A FILTERED COPY of the near one, never a sparser sampling
  // of it: on a lattice coarser than the physics' a corner's bareness is
  // the mean of the ground round it, and what a cell that size cannot
  // carry — a corner's own roughness, a joint block's jog, a buttress —
  // fades with the cell, so the far rock is the near rock blurred rather
  // than aliased into a different crag at every cut.
  const coarse = cell > S.cell;
  const T = ROCKS.strata;
  const fade = (wave: number): number =>
    coarse ? Math.max(0, Math.min(1, wave / cell - 1.25)) : 1;
  const ribSoft = fade(T.ribs.across);
  const jogSoft = fade(T.joints[0]);
  const roughSoft = coarse ? S.cell / cell : 1;
  const bareAt = (x: number, z: number): number => {
    if (!coarse) return bareKept(rockShare(level, x, z));
    const r = cell / 3;
    let sum = rockShare(level, x, z);
    sum += rockShare(level, x + r, z) + rockShare(level, x - r, z);
    sum += rockShare(level, x, z + r) + rockShare(level, x, z - r);
    return bareKept(sum / 5);
  };
  const w = i1 - i0 + 1;
  const corners: (StrataCorner | null)[] = new Array(w * (j1 - j0 + 1)).fill(null);
  const cornerAt = (i: number, j: number): StrataCorner => {
    const k = (j - j0) * w + (i - i0);
    const had = corners[k];
    if (had) return had;
    const h = rockHash(seed, i, j);
    const x = (i + (unit(h, 0) - 0.5) * 2 * S.jitter) * cell;
    const z = (j + (unit(h, 1) - 0.5) * 2 * S.jitter) * cell;
    const g = level.groundAt(x, z);
    const c: StrataCorner = {
      x,
      z,
      g,
      w: bedCoord(st, x, z, g, jogSoft),
      bare: bareAt(x, z),
      rough: unit(h, 2) * roughSoft,
      rib: ribOf(st, level, x, z, ribSoft),
    };
    corners[k] = c;
    return c;
  };
  const over = summerShown() ? LEDGE : SNOW;
  const SNOW_MOST = summerShown() ? 0.5 : 1;
  const g = { x: 0, y: 1, z: 0 };
  const emit = (v: SliceVerts, k: number, mid: number): void => {
    const a = 0;
    const b = F * (k - 1);
    const c = F * k;
    const ex = v[b] - v[a];
    const ey = v[b + 1] - v[a + 1];
    const ez = v[b + 2] - v[a + 2];
    const fx = v[c] - v[a];
    const fy = v[c + 1] - v[a + 1];
    const fz = v[c + 2] - v[a + 2];
    let nx = ey * fz - ez * fy;
    let ny = ez * fx - ex * fz;
    let nz = ex * fy - ey * fx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) return;
    // Wound to face out of the hill (up).
    let q = b;
    let r = c;
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
      q = c;
      r = b;
    }
    nx /= l;
    ny /= l;
    nz /= l;
    // The bed and whether this is its riser: the zone a normal is smoothed
    // over, and its shade.
    const bed = bedOf(st, mid, every);
    const foot = bedLevel(st, bed, every);
    const thick = bedLevel(st, bed + 1, every) - foot;
    const riser = mid < foot + riserOf(st, bed, every) * thick;
    const zone = 2 * bed + (riser ? 1 : 0);
    const shade = 0.8 + 0.4 * unit(rockHash(st.seed, 0x77, bed * every), 0);
    // The snow lies as the physics reads it: a tread holds more.
    const rib = (v[a + 4] + v[b + 4] + v[c + 4]) / 3;
    const snow = SNOW_MOST * snowShare(st, mid, ny, rib, every);
    for (const p of [a, q, r]) {
      const x = v[p];
      const y = v[p + 1];
      const z = v[p + 2];
      const dark = y < level.groundAt(x, z) ? FOOT + 0.2 : 1;
      // Streaked down the fall line: wet and iron stains off the joints.
      const s = streakOf(st, x, z);
      const k0 = (1 - snow) * shade * s * dark;
      level.normalAt(x, z, g);
      // Calmed far out, the snow is the face's even cover (the beds' mean
      // share on the ground's slope), not ledge by ledge: a white lip a
      // pixel or two tall crawls as the lens moves.
      const even =
        SNOW_MOST * Math.max(0, Math.min(1, (g.y + CALM_HELD - S.slides) / (S.holds - S.slides)));
      const c0 = (1 - even) * dark;
      m.pos.push(x, y, z);
      m.nrm.push(nx, ny, nz);
      m.col.push(
        stone[0] * k0 * (1 + 0.25 * (1 - s)) + over[0] * snow,
        stone[1] * k0 + over[1] * snow,
        stone[2] * k0 * (1 - 0.25 * (1 - s)) + over[2] * snow,
      );
      m.soft.push(g.x, g.y, g.z);
      m.calm.push(
        stone[0] * c0 + over[0] * even,
        stone[1] * c0 + over[1] * even,
        stone[2] * c0 + over[2] * even,
      );
      m.zone.push(zone);
      m.bed.push(v[p + 3], jointOf(st, x, z));
    }
  };
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const a = cornerAt(i, j);
      const b = cornerAt(i + 1, j);
      const c = cornerAt(i + 1, j + 1);
      const d = cornerAt(i, j + 1);
      if (Math.max(a.bare, b.bare, c.bare, d.bare) <= 0) continue;
      const h = rockHash(seed, i, j, 7);
      if (unit(h, 0) < 0.5) {
        sliceTri(st, ground, a, b, c, emit, every);
        sliceTri(st, ground, a, c, d, emit, every);
      } else {
        sliceTri(st, ground, a, b, d, emit, every);
        sliceTri(st, ground, b, c, d, emit, every);
      }
    }
  }
}

/** THE STREAKS down a wall, 0.7..1 of the rock's shade: wet and iron
 * stains run down the face from the joints' cracks, a band every few
 * metres across it. */
function streakOf(st: Strata, x: number, z: number): number {
  const t = jointOf(st, x, z) * 7;
  const i = Math.floor(t);
  let f = t - i;
  f = f * f * (3 - 2 * f);
  const a = unit(rockHash(st.seed, 0x78, i), 0);
  const b = unit(rockHash(st.seed, 0x78, i + 1), 0);
  const n = a + (b - a) * f;
  return 1 - (0.3 * Math.max(0, n - 0.45)) / 0.55;
}

/** SMOOTH THE SKIN'S NORMALS within each bed's riser and tread (`zone`),
 * from vertex `from` on: a vertex shared by facets of one zone takes their
 * area-weighted mean, so a ledge reads as one planed slab and a riser as
 * one face, and the crease stays where the beds put it — at a riser's lip
 * and foot, never between two lattice triangles. A cliff's wall (zone -1)
 * keeps its facets. */
export function smoothSkin(m: RockMesh, from = 0): void {
  const key = new Map<string, number>();
  const n = m.zone.length;
  const acc: number[] = [];
  const slot = new Int32Array(n).fill(-1);
  for (let v = from; v < n; v += 3) {
    if (m.zone[v] < 0) continue;
    const p = m.pos;
    const ex = p[3 * v + 3] - p[3 * v];
    const ey = p[3 * v + 4] - p[3 * v + 1];
    const ez = p[3 * v + 5] - p[3 * v + 2];
    const fx = p[3 * v + 6] - p[3 * v];
    const fy = p[3 * v + 7] - p[3 * v + 1];
    const fz = p[3 * v + 8] - p[3 * v + 2];
    // Twice the area, along the facet's normal.
    const nx = ey * fz - ez * fy;
    const ny = ez * fx - ex * fz;
    const nz = ex * fy - ey * fx;
    for (let k = v; k < v + 3; k++) {
      const id = `${m.zone[k]}:${Math.round(p[3 * k] * 100)}:${Math.round(p[3 * k + 1] * 100)}:${Math.round(p[3 * k + 2] * 100)}`;
      let s = key.get(id);
      if (s === undefined) {
        s = acc.length;
        key.set(id, s);
        acc.push(0, 0, 0);
      }
      slot[k] = s;
      acc[s] += nx;
      acc[s + 1] += ny;
      acc[s + 2] += nz;
    }
  }
  for (let k = from; k < n; k++) {
    const s = slot[k];
    if (s < 0) continue;
    const l = Math.hypot(acc[s], acc[s + 1], acc[s + 2]) || 1;
    m.nrm[3 * k] = acc[s] / l;
    m.nrm[3 * k + 1] = acc[s + 1] / l;
    m.nrm[3 * k + 2] = acc[s + 2] / l;
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
 * its rock `tone`, LAID IN BEDS: the face from its lip to its foot cut
 * into bands `WALL_BED` m thick on the massif's dip (`strataOf`), each
 * band's top jutting out of the face and its foot mostly undercut, so a bed
 * is a lit lip over a shadowed recess with a ledge between them that holds
 * the snow; the bands step at the wall's joints, a block of columns
 * apiece, and each bed wears a shade of its own. Behind the lip and at the
 * foot it is tucked under the snow as before. The skier meets the wall's
 * columns (`wallSolids`), inside the face; a bed's lip stands up to
 * `WALL_JUT`'s most further out of it than the corners did. */
export function buildWall(m: RockMesh, w: CliffWall, tone: Tone, level?: Level): void {
  const stone = rockTone(tone);
  const { rows, cols, pos } = w;
  const fx = Math.sin(w.heading);
  const fz = Math.cos(w.heading);
  const corner = (r: number, j: number): P => {
    const i = (r * cols + j) * 3;
    return [pos[i], pos[i + 1], pos[i + 2]];
  };
  const lipY = (j: number): number => corner(1, j)[1];
  const calm = calmPaint(stone);
  const calmOf = (_p: P, n: P): { n: P; col: Tone } => ({ n, col: calm(n[1]) });
  const footY = (j: number): number => corner(rows - 1, j)[1];
  // Along the wall, in joints: a main one every `WALL_JOINT` m.
  const along = (p: P): number => (p[0] * fz - p[2] * fx) / WALL_JOINT;
  // A column's line down the face, eased with its neighbours' so the beds
  // run the wall and the columns do not stand out as strips.
  const eased = (r: number, j: number): P => {
    const c = corner(r, j);
    if (j === 0 || j === cols - 1) return c;
    const l = corner(r, j - 1);
    const n = corner(r, j + 1);
    return [c[0], c[1], c[2]].map((v, i) => 0.7 * v + 0.15 * (l[i] + n[i])) as P;
  };
  const st = level ? strataOf(level.bedrock ?? level) : null;
  const dx = st ? st.dipX : 0;
  const dz = st ? st.dipZ : 0;
  // The bed coordinate of a point on the face: its height off the dip.
  const wOf = (p: P): number => p[1] - dx * p[0] - dz * p[2];
  // The bands' levels, shared by every column so a bed runs the wall.
  let hi = -Infinity;
  let lo = Infinity;
  for (let j = 0; j < cols; j++) {
    hi = Math.max(hi, wOf(corner(1, j)));
    lo = Math.min(lo, wOf(corner(rows - 2, j)));
  }
  const levels: number[] = [];
  // The beds thin and thick by turns, now and then a MASSIVE one standing
  // as a band of its own.
  for (let k = 0, y = Math.floor(hi / WALL_BED) * WALL_BED; y > lo - WALL_BED && k < 64; k++) {
    levels.push(y);
    const h = rockHash(w.hash, 0x51, Math.round(y * 4));
    const massive = unit(h, 1) < WALL_MASSIVE;
    y -= WALL_BED * (massive ? 1.8 + 0.8 * unit(h, 2) : 0.45 + 1.1 * unit(h, 0));
  }
  // THE JOINTS are no grid: each bed's blocks are dealt their own widths
  // (`WALL_BLOCKS` columns, the least and the most — a wide one is two
  // blocks whose joint was skipped), and a run of a bed or few shares one
  // set before the joints JOG at a parting and the next run's are dealt
  // afresh. `blocks[k][j]` is column `j`'s block in bed `k`, numbered over
  // the whole wall.
  const blocks: number[][] = [];
  let id = 0;
  for (let k = 0, run = -1, left = 0; k <= levels.length; k++) {
    if (left <= 0) {
      run++;
      left = 1 + Math.floor(3 * unit(rockHash(w.hash, 0x55, run), 0));
      const row: number[] = [];
      let n = 0;
      let width = 1 + Math.floor(WALL_BLOCKS[1] * unit(rockHash(w.hash, 0x56, run), 0));
      for (let j = 0; j < cols; j++) {
        if (width-- <= 0) {
          id++;
          n++;
          const u = unit(rockHash(w.hash, 0x57, run, n), 0);
          width = WALL_BLOCKS[0] + Math.floor((WALL_BLOCKS[1] - WALL_BLOCKS[0] + 1) * u) - 1;
        }
        row.push(id);
      }
      id++;
      blocks.push(row);
    } else blocks.push(blocks[k - 1]);
    left--;
  }
  const blockOf = (j: number, k: number): number => blocks[Math.min(k, blocks.length - 1)][j];
  // A JOINT'S CRACK: the column a joint runs up stands back, a notch.
  const notchOf = (j: number, k: number): number =>
    j > 0 && j < cols - 1 && blockOf(j - 1, k) !== blockOf(j, k) ? WALL_NOTCH : 0;
  const band = (k: number, j: number): { top: number; foot: number; shade: number } => {
    const b = blockOf(j, k);
    const h = rockHash(w.hash, 0x52, k);
    const g = rockHash(w.hash, 0x53, k, b);
    // Each joint block stood out or back as a whole, a bed's jut on that.
    const block = WALL_BLOCK * (2 * unit(rockHash(w.hash, 0x54, b), 0) - 1);
    const notch = notchOf(j, k);
    const jut =
      WALL_JUT[0] +
      (WALL_JUT[1] - WALL_JUT[0]) * unit(h, 0) +
      0.18 * (unit(g, 0) - 0.5) +
      block -
      notch;
    // Most beds undercut, a few leaning back, and now and then a ROOF: a
    // bed jutting over a deep recess, an overhang's dark slot under it.
    const roof = unit(h, 3) < WALL_ROOF;
    const cut = roof ? -WALL_CUT * (1.6 + unit(g, 1)) : WALL_CUT * (2 * unit(h, 1) - 1.4);
    return {
      top: jut + (roof ? 0.35 : 0),
      foot: jut + cut,
      shade: (0.66 + 0.56 * unit(h, 2)) * (0.92 + 0.16 * unit(g, 2)),
    };
  };
  // Where on column `j` the bed coordinate is `v`, out of the face `out` m.
  const at = (j: number, v: number, out: number): P => {
    const a = eased(1, j);
    const c = eased(rows - 2, j);
    const wa = wOf(a);
    const wc = wOf(c);
    const t = wa - wc > 1e-6 ? Math.max(0, Math.min(1, (wa - v) / (wa - wc))) : 0;
    const p: P = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
    if (!level) return p;
    const g = level.groundAt(p[0], p[2]);
    // A column sunk under the snow keeps under it, its beds flat.
    if (a[1] < level.groundAt(a[0], a[2]) || c[1] < level.groundAt(c[0], c[2]) - 0.05) {
      p[1] = Math.min(p[1], g - ROCKS.face.sink);
      return p;
    }
    p[0] += fx * out;
    p[2] += fz * out;
    p[1] = Math.max(p[1], level.groundAt(p[0], p[2]) + 0.05);
    return p;
  };
  for (let j = 0; j < cols - 1; j++) {
    const a0 = corner(0, j);
    const b0 = corner(0, j + 1);
    const top = Math.max(lipY(j), lipY(j + 1));
    const bottom = Math.min(footY(j), footY(j + 1));
    const shadeAt = (p: P): number =>
      FOOT + (1 - FOOT) * Math.min(1, Math.max(0, (p[1] - bottom) / Math.max(0.5, top - bottom)));
    const mx = (a0[0] + b0[0]) / 2 + fx * 2;
    const mz = (a0[2] + b0[2]) / 2 + fz * 2;
    const inside: P = [mx - fx * 3, (a0[1] + b0[1]) / 2 - 2, mz - fz * 3];
    const quad = (a: P, b: P, c: P, d: P, paint: (ny: number) => Tone): void => {
      tri(m, a, b, c, inside, paint, shadeAt, calmOf, along);
      tri(m, a, c, d, inside, paint, shadeAt, calmOf, along);
    };
    // Behind the lip, down onto the face's first bed.
    const first = band(0, j);
    const firstB = band(0, j + 1);
    const plain = paintOf(stone, (w.hash ^ Math.imul(j + 1, 0x85ebca6b)) >>> 0, 1);
    quad(a0, b0, at(j + 1, levels[0], firstB.top), at(j, levels[0], first.top), plain);
    for (let k = 0; k < levels.length - 1; k++) {
      const pa = band(k, j);
      const pb = band(k, j + 1);
      const tone_: Tone = [stone[0] * pa.shade, stone[1] * pa.shade, stone[2] * pa.shade];
      const paint = snowOver(SNOW_HOLDS, tone_);
      const v0 = levels[k];
      const v1 = levels[k + 1];
      // The bed's face: out at its top, undercut at its foot.
      quad(
        at(j, v0, pa.top),
        at(j + 1, v0, pb.top),
        at(j + 1, v1, pb.foot),
        at(j, v1, pa.foot),
        paint,
      );
      // The ledge onto the next bed's top.
      const na = band(k + 1, j);
      const nb = band(k + 1, j + 1);
      quad(
        at(j, v1, pa.foot),
        at(j + 1, v1, pb.foot),
        at(j + 1, v1, nb.top),
        at(j, v1, na.top),
        paint,
      );
    }
    // The last bed down into the foot's snow.
    const last = levels.length - 1;
    const la = band(last, j);
    const lb = band(last, j + 1);
    quad(
      at(j, levels[last], la.top),
      at(j + 1, levels[last], lb.top),
      corner(rows - 1, j + 1),
      corner(rows - 1, j),
      plain,
    );
  }
}

/** A fresh, empty mesh. */
export const rockMesh = (): RockMesh => ({
  pos: [],
  nrm: [],
  col: [],
  soft: [],
  calm: [],
  zone: [],
  bed: [],
});
