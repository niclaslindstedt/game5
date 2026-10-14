// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK AS BUILT — the DROPS' whole surface as stone in the world frame:
// a wall's rock is the engine's ROCK FIELD (`rock-field.ts`: beds stepping
// out into ledges, joint blocks with flat faces, all of it by how bare the
// wall is) triangulated ADAPTIVELY a tile at a time (`rock-rtin.ts`): a
// block's flat face a few big triangles, a ledge's lip and a crack many
// small ones, and the tolerance the cut's (`RockCut`) — a few cm near the
// lens, where the mesh stands on the surface the physics rides, metres far
// out, where a triangle is a few pixels.
//
// GEOMORPHED: every vertex of a cut carries where the NEXT, coarser cut's
// surface stands under it (its height, its normal and its paint, read off
// that cut's own triangles), and the draw slides it there over the last
// stretch before the band's edge (`rocks.ts`) — so when the coarser cut
// takes the tile over nothing moves. SMOOTH where the stone is smooth: a
// vertex's normal is the mean of the faces round it, kept to a face's own
// across a crease sharper than `CREASE`, so a ledge's lip stays a lip and a
// block's face reads as one plane, not a field of facets.
//
// A CLIFF'S WALL (`buildWall`): the engine's skin of corners over a rocky
// cliff's face (`cliffWalls`), lip to foot, flat facets.
//
// Snow is painted in the draw off the normal (a ledge facing the sky holds
// it), so the mesh carries the rock's own paint: the region's stone, a shade
// a block and a bed, darker in the cracks and at the back of a ledge.
// Three-free: plain arrays the draw (`rocks.ts`) hands the GPU and the suite
// counts.

import {
  ROCKS,
  rockDraw as unit,
  rockFieldAt,
  rtinMesh,
  rtinStart,
  rtinStep,
  type CliffWall,
  type RockField,
  type RtinBuild,
} from "@engine";

/** How dark the rock is where it goes into the snow, of its own colour. */
const FOOT = 0.45;

/** Linear 0..1 RGB, the way `region-look.ts` authors its tones. */
export type Tone = readonly [number, number, number];

/** The facet's up share (its normal's y) snow lies whole on, and the one
 * it slides off below — the engine's, so the rock a skier rides is bare
 * where it is drawn bare. */
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

/** A face's normal against its neighbours' mean past this cosine (37°) is
 * a crease: the face keeps its own. */
const CREASE = 0.8;
/** How far a tile's edge is hung down to cover a seam with its neighbour's
 * cut, m (and at least this many of the cut's tolerance). */
const SKIRT = 0.6;
const SKIRT_TOLS = 3;
/** Under the ridden rock a cut may stand this many times its tolerance. */
export const DOWN = 4;

/** The triangles of a tile, three vertices a triangle, never shared:
 * positions, normals and the rock's paint; where the next cut stands under
 * each (`morph`: its height and normal; `mcol`: its paint); and the beds'
 * phase (`phi`), which the draw bands. */
export type RockMesh = {
  readonly pos: number[];
  readonly nrm: number[];
  readonly col: number[];
  readonly morph: number[];
  readonly mcol: number[];
  readonly phi: number[];
};

/** A fresh, empty mesh. */
export const rockMesh = (): RockMesh => ({
  pos: [],
  nrm: [],
  col: [],
  morph: [],
  mcol: [],
  phi: [],
});

/** A cut of the rock: its grid, m, and its tolerance, m. */
export type RockCut = { readonly step: number; readonly tol: number };

/** One sampling of a tile at a cut's grid. */
type Grid = {
  readonly n: number;
  readonly step: number;
  readonly y: Float32Array;
  readonly ground: Float32Array;
  readonly col: Float32Array;
  readonly phi: Float32Array;
  rtin: RtinBuild | null;
};

const point = { y: 0, ground: 0, rock: 0, phi: 0, shade: 0, cavity: 0 };

function grid(n: number, step: number): Grid {
  const size = (n + 1) * (n + 1);
  return {
    n,
    step,
    y: new Float32Array(size),
    ground: new Float32Array(size),
    col: new Float32Array(size * 3),
    phi: new Float32Array(size),
    rtin: null,
  };
}

/** A sample's paint: the stone, a shade of its block and bed, darker in a
 * crack, at the back of a ledge and where it goes under the snow. */
function paint(stone: Tone, out: Float32Array, k: number): void {
  const p = point;
  const f = (0.8 + 0.4 * p.shade) * (1 - 0.5 * p.cavity) * (p.y < p.ground ? FOOT + 0.2 : 1);
  const warm = (p.shade - 0.5) * 0.08;
  out[3 * k] = stone[0] * f * (1 + warm);
  out[3 * k + 1] = stone[1] * f;
  out[3 * k + 2] = stone[2] * f * (1 - warm);
}

/** A TILE UNDER WAY: its samples, its errors, then its mesh. */
export type TileBuild = {
  readonly field: RockField;
  readonly stone: Tone;
  /** Its corner, m. */
  readonly x0: number;
  readonly z0: number;
  readonly cut: RockCut;
  /** The next, coarser cut it slides to (none for the last). */
  readonly next: RockCut | null;
  readonly fine: Grid;
  readonly coarse: Grid | null;
  /** The rows sampled so far. */
  row: number;
  mesh: RockMesh | null;
};

/** Start building the `side` m tile at (x0, z0) at `cut`. */
export function startTile(
  field: RockField,
  tone: Tone,
  x0: number,
  z0: number,
  side: number,
  cut: RockCut,
  next: RockCut | null,
): TileBuild {
  const n = Math.round(side / cut.step);
  return {
    field,
    stone: rockTone(tone),
    x0,
    z0,
    cut,
    next,
    fine: grid(n, cut.step),
    coarse: next ? grid(n / 2, cut.step * 2) : null,
    row: 0,
    mesh: null,
  };
}

/** Work on `b` while `more()` says so; true once its mesh is made. */
export function stepTile(b: TileBuild, more: () => boolean): boolean {
  const g = b.fine;
  const size = g.n + 1;
  while (b.row < size) {
    const z = b.z0 + b.row * g.step;
    for (let i = 0; i < size; i++) {
      const k = b.row * size + i;
      rockFieldAt(b.field, b.x0 + i * g.step, z, point, g.step);
      g.y[k] = point.y;
      g.ground[k] = point.ground;
      g.phi[k] = point.phi;
      paint(b.stone, g.col, k);
    }
    b.row++;
    if (!more()) return false;
  }
  if (!g.rtin) {
    g.rtin = rtinStart(g.n, g.y, g.ground, DOWN);
    // The coarser cut's samples: every other one of these, as that cut
    // samples the field (its ledges eased to a slab where they are finer
    // than its grid), so this cut slides onto the very surface it hands over to.
    const c = b.coarse;
    if (c) {
      const cs = c.n + 1;
      for (let j = 0; j < cs; j++) {
        for (let i = 0; i < cs; i++) {
          const k = j * cs + i;
          rockFieldAt(b.field, b.x0 + i * c.step, b.z0 + j * c.step, point, c.step);
          c.y[k] = point.y;
          c.ground[k] = point.ground;
          c.phi[k] = point.phi;
          paint(b.stone, c.col, k);
        }
      }
      c.rtin = rtinStart(c.n, c.y, c.ground, DOWN);
    }
  }
  if (!rtinStep(g.rtin, more)) return false;
  if (b.coarse && !rtinStep(b.coarse.rtin!, more)) return false;
  b.mesh = meshOf(b);
  return true;
}

/** A grid's triangles at a tolerance: the ones with rock showing at a
 * corner, as corner indices, with each corner's normal (smooth within a
 * crease). */
type Tris = { idx: number[]; nrm: Float32Array; any: Uint8Array };

function trianglesOf(g: Grid, tol: number, all: boolean): Tris {
  const size = g.n + 1;
  const s = g.step;
  const idx: number[] = [];
  const shows = (k: number): boolean => g.y[k] > g.ground[k] - 0.005;
  rtinMesh(g.rtin!, tol, (ax, ay, bx, by, cx, cy) => {
    const a = ay * size + ax;
    const b = by * size + bx;
    const c = cy * size + cx;
    if (!all && !shows(a) && !shows(b) && !shows(c)) return;
    idx.push(a, b, c);
  });
  // Face normals (up), wound up, summed over each corner by area.
  const nt = idx.length / 3;
  const face = new Float32Array(nt * 3);
  const sum = new Float32Array(size * size * 3);
  const any = new Uint8Array(nt);
  for (let t = 0; t < nt; t++) {
    const a = idx[3 * t];
    let b = idx[3 * t + 1];
    let c = idx[3 * t + 2];
    const ax = (a % size) * s;
    const az = Math.floor(a / size) * s;
    let e1x = (b % size) * s - ax;
    let e1z = Math.floor(b / size) * s - az;
    let e1y = g.y[b] - g.y[a];
    let e2x = (c % size) * s - ax;
    let e2z = Math.floor(c / size) * s - az;
    let e2y = g.y[c] - g.y[a];
    let ny = e1z * e2x - e1x * e2z;
    if (ny < 0) {
      // Wound so its normal faces up (three's front faces count anticlockwise).
      [b, c] = [c, b];
      idx[3 * t + 1] = b;
      idx[3 * t + 2] = c;
      [e1x, e2x] = [e2x, e1x];
      [e1y, e2y] = [e2y, e1y];
      [e1z, e2z] = [e2z, e1z];
      ny = -ny;
    }
    const nx = e1y * e2z - e1z * e2y;
    const nz = e1x * e2y - e1y * e2x;
    any[t] = shows(a) || shows(b) || shows(c) ? 1 : 0;
    const l = Math.hypot(nx, ny, nz) || 1;
    face[3 * t] = nx / l;
    face[3 * t + 1] = ny / l;
    face[3 * t + 2] = nz / l;
    if (!any[t]) continue;
    for (const v of [a, b, c]) {
      sum[3 * v] += nx;
      sum[3 * v + 1] += ny;
      sum[3 * v + 2] += nz;
    }
  }
  const nrm = new Float32Array(idx.length * 3);
  for (let t = 0; t < nt; t++) {
    const fx = face[3 * t];
    const fy = face[3 * t + 1];
    const fz = face[3 * t + 2];
    for (let q = 0; q < 3; q++) {
      const v = idx[3 * t + q];
      let mx = sum[3 * v];
      let my = sum[3 * v + 1];
      let mz = sum[3 * v + 2];
      const l = Math.hypot(mx, my, mz);
      const o = 3 * (3 * t + q);
      if (l > 0) {
        mx /= l;
        my /= l;
        mz /= l;
      }
      if (l > 0 && mx * fx + my * fy + mz * fz > CREASE) {
        nrm[o] = mx;
        nrm[o + 1] = my;
        nrm[o + 2] = mz;
      } else {
        nrm[o] = fx;
        nrm[o + 1] = fy;
        nrm[o + 2] = fz;
      }
    }
  }
  return { idx, nrm, any };
}

/** Where the coarser cut stands under every fine sample: its height,
 * normal and paint, off its own triangles. */
function morphOf(b: TileBuild): Float32Array | null {
  const c = b.coarse;
  if (!c || !b.next) return null;
  const fs = b.fine.n + 1;
  const cs = c.n + 1;
  const out = new Float32Array(fs * fs * 7);
  const tris = trianglesOf(c, b.next.tol, true);
  const { idx, nrm } = tris;
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]];
    // Fine grid coordinates of the corners.
    const px = v.map((k) => 2 * (k % cs));
    const py = v.map((k) => 2 * Math.floor(k / cs));
    const det = (px[1] - px[0]) * (py[2] - py[0]) - (px[2] - px[0]) * (py[1] - py[0]);
    if (det === 0) continue;
    const x0 = Math.min(...px);
    const x1 = Math.max(...px);
    const y0 = Math.min(...py);
    const y1 = Math.max(...py);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const w1 = ((x - px[0]) * (py[2] - py[0]) - (px[2] - px[0]) * (y - py[0])) / det;
        const w2 = ((px[1] - px[0]) * (y - py[0]) - (x - px[0]) * (py[1] - py[0])) / det;
        const w0 = 1 - w1 - w2;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const o = 7 * (y * fs + x);
        const w = [w0, w1, w2];
        let hy = 0;
        let nx = 0;
        let ny = 0;
        let nz = 0;
        let r = 0;
        let gg = 0;
        let bb = 0;
        for (let q = 0; q < 3; q++) {
          const k = v[q];
          hy += w[q] * c.y[k];
          const no = 3 * (t + q);
          nx += w[q] * nrm[no];
          ny += w[q] * nrm[no + 1];
          nz += w[q] * nrm[no + 2];
          r += w[q] * c.col[3 * k];
          gg += w[q] * c.col[3 * k + 1];
          bb += w[q] * c.col[3 * k + 2];
        }
        const l = Math.hypot(nx, ny, nz) || 1;
        out[o] = hy;
        out[o + 1] = nx / l;
        out[o + 2] = ny / l;
        out[o + 3] = nz / l;
        out[o + 4] = r;
        out[o + 5] = gg;
        out[o + 6] = bb;
      }
    }
  }
  return out;
}

function meshOf(b: TileBuild): RockMesh {
  const g = b.fine;
  const size = g.n + 1;
  const s = g.step;
  const m = rockMesh();
  const { idx, nrm } = trianglesOf(g, b.cut.tol, false);
  const morph = morphOf(b);
  const vertex = (k: number, no: number, drop: number): void => {
    m.pos.push(b.x0 + (k % size) * s, g.y[k] - drop, b.z0 + Math.floor(k / size) * s);
    m.nrm.push(nrm[no], nrm[no + 1], nrm[no + 2]);
    m.col.push(g.col[3 * k], g.col[3 * k + 1], g.col[3 * k + 2]);
    m.phi.push(g.phi[k]);
    if (morph) {
      const o = 7 * k;
      m.morph.push(morph[o] - drop, morph[o + 1], morph[o + 2], morph[o + 3]);
      m.mcol.push(morph[o + 4], morph[o + 5], morph[o + 6]);
    } else {
      m.morph.push(g.y[k] - drop, nrm[no], nrm[no + 1], nrm[no + 2]);
      m.mcol.push(g.col[3 * k], g.col[3 * k + 1], g.col[3 * k + 2]);
    }
  };
  for (let t = 0; t < idx.length; t += 3) {
    for (let q = 0; q < 3; q++) vertex(idx[t + q], 3 * (t + q), 0);
  }
  // SKIRTS: every edge on the tile's border hung down, facing out of the
  // tile, so a neighbour at another cut never shows a seam between them —
  // seen only from outside the tile, where the neighbour lies lower. An
  // edge under the snow at both ends needs none: the snow is behind it.
  const drop = Math.max(SKIRT, SKIRT_TOLS * b.cut.tol);
  const n = g.n;
  const shows = (k: number): boolean => g.y[k] > g.ground[k] - 0.005;
  for (let t = 0; t < idx.length; t += 3) {
    for (let q = 0; q < 3; q++) {
      const a = idx[t + q];
      const c = idx[t + ((q + 1) % 3)];
      if (!shows(a) && !shows(c)) continue;
      const ax = a % size;
      const ay = Math.floor(a / size);
      const cx = c % size;
      const cy = Math.floor(c / size);
      // Out of the tile: −x, +x, −z or +z.
      let ox = 0;
      let oz = 0;
      if (ax === cx && (ax === 0 || ax === n)) ox = ax === 0 ? -1 : 1;
      else if (ay === cy && (ay === 0 || ay === n)) oz = ay === 0 ? -1 : 1;
      else continue;
      // Wound so its face (along the edge × down) looks out.
      const out = (cz: number, cx2: number): number => ox * cz - oz * cx2;
      const forward = out(cy - ay, cx - ax) > 0;
      const p = forward ? a : c;
      const r = forward ? c : a;
      const np = 3 * (t + (p === a ? q : (q + 1) % 3));
      const nr = 3 * (t + (p === a ? (q + 1) % 3 : q));
      vertex(p, np, 0);
      vertex(r, nr, 0);
      vertex(r, nr, drop);
      vertex(p, np, 0);
      vertex(r, nr, drop);
      vertex(p, np, drop);
    }
  }
  return m;
}

/** Append cliff `w`'s ROCK WALL to `m` (`cliff-wall.ts`' skin of corners),
 * its rock `tone`: two flat facets a cell of the skin, each cell split
 * along a diagonal of its own so no two read alike, every facet its own
 * shade of the rock, and the foot darkened where it goes into the snow. Two
 * triangles a cell, a few hundred a cliff. */
export function buildWall(m: RockMesh, w: CliffWall, tone: Tone): void {
  const stone = rockTone(tone);
  const { rows, cols, pos } = w;
  const fx = Math.sin(w.heading);
  const fz = Math.cos(w.heading);
  type P = [number, number, number];
  const corner = (r: number, j: number): P => {
    const i = (r * cols + j) * 3;
    return [pos[i], pos[i + 1], pos[i + 2]];
  };
  const lipY = (j: number): number => corner(1, j)[1];
  const footY = (j: number): number => corner(rows - 1, j)[1];
  const tri = (a: P, b: P, c: P, inside: P, shade: (p: P) => number, h: number): void => {
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const ez = b[2] - a[2];
    const gx = c[0] - a[0];
    const gy = c[1] - a[1];
    const gz = c[2] - a[2];
    let nx = ey * gz - ez * gy;
    let ny = ez * gx - ex * gz;
    let nz = ex * gy - ey * gx;
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
    const f = 0.8 + 0.4 * unit(h, 1);
    for (const p of [a, q, r]) {
      const k = shade(p) * f;
      m.pos.push(p[0], p[1], p[2]);
      m.nrm.push(nx, ny, nz);
      m.col.push(stone[0] * k, stone[1] * k, stone[2] * k);
      m.morph.push(p[1], nx, ny, nz);
      m.mcol.push(stone[0] * k, stone[1] * k, stone[2] * k);
      m.phi.push(p[1]);
    }
  };
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
      // Darker toward the foot: the sky hidden from the bottom of the wall.
      const shade = (p: P): number =>
        FOOT + (1 - FOOT) * Math.min(1, Math.max(0, (p[1] - bottom) / Math.max(0.5, top - bottom)));
      if (unit(h, 0) < 0.5) {
        tri(a, b, c, inside, shade, h);
        tri(a, c, d, inside, shade, h ^ 0x5bd1e995);
      } else {
        tri(a, b, d, inside, shade, h);
        tri(b, c, d, inside, shade, h ^ 0x5bd1e995);
      }
    }
  }
}
