// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK AS BUILT — the DROPS' whole surface as coarse rock in the world
// frame: few triangles carrying the big shape, SMOOTH-LIT across the gentle
// folds and CREASED only where two facets meet at a sharp angle (past
// `CREASE`), so the eye reads slabs and edges rather than a lattice; the
// rest — the beds, the joints, the cracks, the grain, the streaks, the snow
// on the ledges — is the rock's own material's (`rock-material.ts`), drawn
// in its shader without a texture.
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
// WHAT A VERTEX CARRIES: the region's rock tone darkened where it goes into
// the snow and in a CAVITY (a corner sunk below its neighbours: a crack, the
// underside of a ledge), never a shade of its own a facet — the colour that
// varies, varies by the rock's structure in the shader. The snow is laid
// there too, off the facet's own tilt, so it lies where the ridden skin
// (`rock-ground.ts`) is snow. Three-free: plain arrays the draw (`rocks.ts`)
// hands the GPU and the suite counts.

import {
  ROCKS,
  cornerRise,
  rockDraw as unit,
  rockHash,
  rockShare,
  type CliffWall,
  type Level,
} from "@engine";

/** How dark the rock is where it goes into the snow, of its own colour. */
const FOOT = 0.45;

/** Linear 0..1 RGB, the way `region-look.ts` authors its tones. */
export type Tone = readonly [number, number, number];

/** The facet's up share (its normal's y) snow lies whole on, and the one
 * it slides off below — the shader's ledge snow (`rock-material.ts`). */
export const SNOW_HOLDS = ROCKS.skin.holds;
export const SNOW_SLIDES = ROCKS.skin.slides;
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

/** A facet folded more than this off its corner's smooth normal, rad,
 * keeps its own there, so a hard edge; gentler folds are lit smooth across
 * (about 45° between two facets meeting). Real rock has hard edges at a
 * block's arrises and smooth-ish planes within one. */
const CREASE = (32 * Math.PI) / 180;
const CREASE_COS = Math.cos(CREASE);
/** The share of a facet's own normal kept where it is lit smooth. */
const FACET = 0.4;
/** How far a corner sunk below its neighbours (m, along its normal) darkens
 * it, and the darkest a cavity goes, of the rock's own colour; a corner
 * standing proud of them lightens a little, to `PROUD_MOST`. */
const CAVITY = 0.9;
const CAVITY_MOST = 0.55;
const PROUD_MOST = 1.08;

/** The triangles a run of outcrops makes: positions, normals (smooth, but
 * creased past `CREASE`) and colours, three floats a vertex, three vertices
 * a triangle; `snow` how much of the vertex's facet holds snow and
 * `bare` how bare its corner's ground is (`rockShare`: the skin's edge
 * runs out into the snow), one each a vertex — and the same rock CALMED for the distance (`soft`, `calm`): the
 * smooth normal of the ground under each corner and the rock's colour with
 * no cavity. Far out a facet is a few pixels and its own lighting only
 * twinkles as the lens moves, so the draw eases each corner over to its
 * calm pair with distance (`rocks.ts`). */
export type RockMesh = {
  readonly pos: number[];
  readonly nrm: number[];
  readonly col: number[];
  readonly snow: number[];
  readonly bare: number[];
  readonly soft: number[];
  readonly calm: number[];
};

type P = [number, number, number];

/** A corner of the rock: where it stands, its smooth normal (outward), the
 * shade its cavity and its foot give it (`k`) and its foot's alone
 * (`foot`: far out the cavity's speckle is a facet's own shade again), and
 * the calmed normal far out. */
type Vert = {
  readonly p: P;
  readonly n: P;
  readonly k: number;
  readonly foot: number;
  readonly bare: number;
  readonly soft: P;
};

/** How much of a facet facing up by `ny` holds snow, 0..1. */
function snowOf(ny: number): number {
  return Math.max(0, Math.min(1, (ny - SNOW_SLIDES) / (SNOW_HOLDS - SNOW_SLIDES)));
}

/** A triangle, wound so its normal points away from `inside`; each vertex
 * lit by its corner's smooth normal unless the facet folds away from it
 * past `CREASE`, where the facet's own is kept. */
function tri(m: RockMesh, a: Vert, b: Vert, c: Vert, inside: P, stone: Tone): void {
  const ex = b.p[0] - a.p[0];
  const ey = b.p[1] - a.p[1];
  const ez = b.p[2] - a.p[2];
  const fx = c.p[0] - a.p[0];
  const fy = c.p[1] - a.p[1];
  const fz = c.p[2] - a.p[2];
  let nx = ey * fz - ez * fy;
  let ny = ez * fx - ex * fz;
  let nz = ex * fy - ey * fx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  const mx = (a.p[0] + b.p[0] + c.p[0]) / 3 - inside[0];
  const my = (a.p[1] + b.p[1] + c.p[1]) / 3 - inside[1];
  const mz = (a.p[2] + b.p[2] + c.p[2]) / 3 - inside[2];
  let q = b;
  let r = c;
  if (nx * mx + ny * my + nz * mz < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
    q = c;
    r = b;
  }
  const snow = snowOf(ny);
  for (const v of [a, q, r]) {
    const smooth = v.n[0] * nx + v.n[1] * ny + v.n[2] * nz > CREASE_COS;
    m.pos.push(v.p[0], v.p[1], v.p[2]);
    if (smooth) {
      // Smooth across the fold, with a share of the facet kept so a slab
      // still catches the sun as a plane.
      const sx = v.n[0] * (1 - FACET) + nx * FACET;
      const sy = v.n[1] * (1 - FACET) + ny * FACET;
      const sz = v.n[2] * (1 - FACET) + nz * FACET;
      const sl = Math.hypot(sx, sy, sz) || 1;
      m.nrm.push(sx / sl, sy / sl, sz / sl);
    } else m.nrm.push(nx, ny, nz);
    m.col.push(stone[0] * v.k, stone[1] * v.k, stone[2] * v.k);
    m.snow.push(snow);
    m.bare.push(v.bare);
    m.soft.push(v.soft[0], v.soft[1], v.soft[2]);
    m.calm.push(stone[0] * v.foot, stone[1] * v.foot, stone[2] * v.foot);
  }
}

/** The smooth normal of a grid of corners at one of them, off its four
 * neighbours (central differences: seamless across tiles that share them),
 * turned to face away from `inside`, and how far the corner stands off
 * their mean along it (negative: sunk, a cavity). */
function lattice(c: P, w: P, e: P, s: P, n: P, out: P): { n: P; off: number } {
  const ax = e[0] - w[0];
  const ay = e[1] - w[1];
  const az = e[2] - w[2];
  const bx = n[0] - s[0];
  const by = n[1] - s[1];
  const bz = n[2] - s[2];
  let nx = ay * bz - az * by;
  let ny = az * bx - ax * bz;
  let nz = ax * by - ay * bx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  if (nx * out[0] + ny * out[1] + nz * out[2] < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const mx = (w[0] + e[0] + s[0] + n[0]) / 4;
  const my = (w[1] + e[1] + s[1] + n[1]) / 4;
  const mz = (w[2] + e[2] + s[2] + n[2]) / 4;
  const off = (c[0] - mx) * nx + (c[1] - my) * ny + (c[2] - mz) * nz;
  return { n: [nx, ny, nz], off };
}

/** A cavity's shade off a corner's offset from its neighbours, m. */
function cavityShade(off: number): number {
  return Math.max(CAVITY_MOST, Math.min(PROUD_MOST, 1 + CAVITY * off));
}

/** A corner of a wall's skin: where it stands and how bare it is there. */
type Corner = { readonly p: P; readonly bare: number };

/** Append the ROCK SKIN of a wall over lattice cells `i0..i1` × `j0..j1`
 * (exclusive ends, the lattice `cell` m and global, so two tiles share
 * the corners on their seam) to `m`, its rock `tone`: a corner every
 * cell, jittered in plan off a hash of the map's `seed` and its place,
 * standing over the ground where it is bare (`rockShare`) by the engine's
 * `cornerRise` — a slow swell its neighbours share and a little of its own
 * — and tucked under the snow where it is not; every cell with a bare
 * corner laid as two facets, split along a diagonal of its own. So the
 * rock is the whole steep surface, from where the slope turns too steep
 * for snow to where it eases at the top, broken into tilted slabs, lit
 * smooth across a fold and hard at an arris. */
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
  // Laid off the map under the skin the physics rides (`withRock`).
  level = level.bedrock ?? level;
  const stone = rockTone(tone);
  // One corner of margin round the cells: a corner's smooth normal is read
  // off its neighbours, the same on both sides of a tile's seam.
  const w = i1 - i0 + 3;
  const corners: (Corner | null)[] = new Array(w * (j1 - j0 + 3)).fill(null);
  const verts: (Vert | null)[] = new Array(corners.length).fill(null);
  const cornerAt = (i: number, j: number): Corner => {
    const k = (j - j0 + 1) * w + (i - i0 + 1);
    const had = corners[k];
    if (had) return had;
    const h = rockHash(seed, i, j);
    const x = (i + (unit(h, 0) - 0.5) * 2 * S.jitter) * cell;
    const z = (j + (unit(h, 1) - 0.5) * 2 * S.jitter) * cell;
    const bare = rockShare(level, x, z);
    const ground = level.groundAt(x, z);
    const y = bare > S.from ? ground + cornerRise(seed, i, j, bare) : ground - S.sink;
    const c: Corner = { p: [x, y, z], bare };
    corners[k] = c;
    return c;
  };
  const g = { x: 0, y: 1, z: 0 };
  const vertAt = (i: number, j: number): Vert => {
    const k = (j - j0 + 1) * w + (i - i0 + 1);
    const had = verts[k];
    if (had) return had;
    const c = cornerAt(i, j);
    level.normalAt(c.p[0], c.p[2], g);
    const soft: P = [g.x, g.y, g.z];
    const l = lattice(
      c.p,
      cornerAt(i - 1, j).p,
      cornerAt(i + 1, j).p,
      cornerAt(i, j - 1).p,
      cornerAt(i, j + 1).p,
      soft,
    );
    const foot = c.p[1] < level.groundAt(c.p[0], c.p[2]) ? FOOT + 0.2 : 1;
    const v: Vert = { p: c.p, n: l.n, k: cavityShade(l.off) * foot, foot, bare: c.bare, soft };
    verts[k] = v;
    return v;
  };
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const a = cornerAt(i, j);
      const b = cornerAt(i + 1, j);
      const c = cornerAt(i + 1, j + 1);
      const d = cornerAt(i, j + 1);
      if (Math.max(a.bare, b.bare, c.bare, d.bare) <= S.from) continue;
      const va = vertAt(i, j);
      const vb = vertAt(i + 1, j);
      const vc = vertAt(i + 1, j + 1);
      const vd = vertAt(i, j + 1);
      const h = rockHash(seed, i, j, 7);
      const mx = (a.p[0] + b.p[0] + c.p[0] + d.p[0]) / 4;
      const mz = (a.p[2] + b.p[2] + c.p[2] + d.p[2]) / 4;
      // Under the ground at the cell's middle: inside the hill.
      const inside: P = [mx, level.groundAt(mx, mz) - 3, mz];
      if (unit(h, 0) < 0.5) {
        tri(m, va, vb, vc, inside, stone);
        tri(m, va, vc, vd, inside, stone);
      } else {
        tri(m, va, vb, vd, inside, stone);
        tri(m, vb, vc, vd, inside, stone);
      }
    }
  }
}

/** Append cliff `w`'s ROCK WALL to `m` (`cliff-wall.ts`' skin of corners),
 * its rock `tone`: two facets a cell of the skin, each cell split along a
 * diagonal of its own so no two read alike, lit smooth across the grid's
 * folds and hard past `CREASE`, the snow on the ones up at the lip that
 * face the sky, a cavity darkened, and the foot darkened where it goes into
 * the snow. Two triangles a cell, a few hundred a cliff. */
export function buildWall(m: RockMesh, w: CliffWall, tone: Tone): void {
  const stone = rockTone(tone);
  const { rows, cols, pos } = w;
  const fx = Math.sin(w.heading);
  const fz = Math.cos(w.heading);
  const corner = (r: number, j: number): P => {
    const rr = Math.max(0, Math.min(rows - 1, r));
    const jj = Math.max(0, Math.min(cols - 1, j));
    const i = (rr * cols + jj) * 3;
    return [pos[i], pos[i + 1], pos[i + 2]];
  };
  // Darker toward the foot: the sky hidden from the bottom of the wall.
  const lipY = (j: number): number => corner(1, j)[1];
  const footY = (j: number): number => corner(rows - 1, j)[1];
  // Out of the face: away from the hill behind it.
  const out: P = [-fx, 0.3, -fz];
  const verts: (Vert | null)[] = new Array(rows * cols).fill(null);
  const vertAt = (r: number, j: number): Vert => {
    const had = verts[r * cols + j];
    if (had) return had;
    const p = corner(r, j);
    const l = lattice(
      p,
      corner(r, j - 1),
      corner(r, j + 1),
      corner(r - 1, j),
      corner(r + 1, j),
      out,
    );
    const top = lipY(j);
    const bottom = footY(j);
    const foot =
      FOOT + (1 - FOOT) * Math.min(1, Math.max(0, (p[1] - bottom) / Math.max(0.5, top - bottom)));
    // A wall has no ground under it to borrow a normal from: far out its
    // corners keep their own smooth one.
    const v: Vert = { p, n: l.n, k: cavityShade(l.off) * foot, foot, bare: 1, soft: l.n };
    verts[r * cols + j] = v;
    return v;
  };
  for (let r = 0; r < rows - 1; r++) {
    for (let j = 0; j < cols - 1; j++) {
      const h = (w.hash ^ Math.imul(r + 1, 0x9e3779b1) ^ Math.imul(j + 1, 0x85ebca6b)) >>> 0;
      const a = vertAt(r, j);
      const b = vertAt(r, j + 1);
      const c = vertAt(r + 1, j + 1);
      const d = vertAt(r + 1, j);
      const mx = (a.p[0] + b.p[0] + c.p[0] + d.p[0]) / 4;
      const my = (a.p[1] + b.p[1] + c.p[1] + d.p[1]) / 4;
      const mz = (a.p[2] + b.p[2] + c.p[2] + d.p[2]) / 4;
      // Behind the face: back into the hill and down.
      const inside: P = [mx - fx * 3, my - 2, mz - fz * 3];
      if (unit(h, 0) < 0.5) {
        tri(m, a, b, c, inside, stone);
        tri(m, a, c, d, inside, stone);
      } else {
        tri(m, a, b, d, inside, stone);
        tri(m, b, c, d, inside, stone);
      }
    }
  }
}

/** A fresh, empty mesh. */
export const rockMesh = (): RockMesh => ({
  pos: [],
  nrm: [],
  col: [],
  snow: [],
  bare: [],
  soft: [],
  calm: [],
});
