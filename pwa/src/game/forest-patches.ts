// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WOODS BY CELL — the forest's levels of detail decided a 64 m cell at a
// time rather than a tree at a time (`forest.ts` draws them). A cell is in
// one of five LEVELS, by how far its box stands from the lens:
//
//   0  its trees one by one, instanced, at the full and the mid cut (the
//      per-tree hand-over between those two is `tree-bands.ts`'s, as ever);
//   1  every tree of the cell MERGED into one mesh at the mid cut — the same
//      triangles the instanced mid cut draws, so the hand-over from level 0
//      swaps nothing the eye can see, but one draw and no per-tree work;
//   2  merged again at the far SKETCH, each tree its own variant's, thinned
//      by the FOREST row's far share;
//   3  the CANOPY SHELL: a sheet draped over the crowns on a 4 m grid, the
//      woods' dark sides and white tops and a stripe of the trees' own tiers
//      in it, so the forest runs on to the edge of the picture as a lumpy,
//      stippled roof rather than ending in a ring;
//   4  nothing (past the picture's edge, or behind the mountain).
//
// THE HAND-OVER IS A CELL'S. Every cell's level is one float in a small
// texture (`CellLod`), moving toward its target over `HAND_OVER_MS`; every
// drawable of level L reads its cell's value in its shader and keeps the
// pixels of a screen-space dither that are its share (`CELL_LOD_GLSL`), so
// a cell dissolves into its next level as a whole, the two levels' shares
// always summing to the whole cell. Nothing is rewritten per tree to do it.
//
// A CELL BEHIND THE MOUNTAIN IS NOT DRAWN: its tree tops are marched to the
// lens over the heightfield (`hidden`), and a cell every one of whose five
// points is under the ground's line is left out whatever its level.
//
// THE MERGED MESHES AND SHELLS ARE BUILT LAZILY and kept in a cache by the
// bytes they hold, the least recently drawn dropped first; a lens that jumps
// builds what it needs at once, one that rides builds a few milliseconds of
// them a frame, nearest first, and a cell whose mesh is not ready yet is
// drawn as its shell meanwhile.

import * as THREE from "three";

import { HAND_OVER_MS } from "./tree-bands.ts";

/** A cell's side, m. */
export const CELL = 64;

/** A shell tile's side, in cells. */
export const TILE = 8;

/** A merged block's side, in cells: one mesh, one draw, for its cells'
 * trees — the mid cut's, and the sketch's twice as wide, since its trees
 * are smaller and its blocks farther and more of them in the frame. */
export const BLOCK = 2;
export const SKETCH_BLOCK = 4;

/** The shell's grid spacing, m. */
export const SHELL_STEP = 4;

/** The level a cell is drawn at (see the header); 4 is nothing. */
export type CellLevel = 0 | 1 | 2 | 3 | 4;

/** Where each level ends, m from the lens to the nearest point of a cell's
 * box: the FOREST row's full and mid edges, the sketch's end and the
 * picture's. */
export type CellEdges = { near: number; mid: number; sketch: number; view: number };

/** Where the merged sketches give way to the shell for a FOREST row's mid
 * edge, m: a tree past it stands under a dozen pixels tall at a 1280-wide
 * picture, and the shell's lumps read as well as the sketch did. */
export function shellFrom(mid: number): number {
  return Math.max(mid * 2.5, mid + 450);
}

/** The level a cell `d` m off belongs at. */
export function levelAt(d: number, e: CellEdges): CellLevel {
  if (d < e.near) return 0;
  if (d < e.mid) return 1;
  if (d < e.sketch) return 2;
  if (d < e.view) return 3;
  return 4;
}

/** How far past an edge a cell must stand before it changes level, m. */
export const CELL_HYSTERESIS = 6;

/** The level a cell at `current` keeps or moves to `d` m off. */
export function settleLevel(current: CellLevel, d: number, e: CellEdges): CellLevel {
  const target = levelAt(d, e);
  if (target === current) return target;
  if (levelAt(d - CELL_HYSTERESIS, e) === current || levelAt(d + CELL_HYSTERESIS, e) === current)
    return current;
  return target;
}

/** THE CELLS' LEVELS in the shader: the texture and what reads it. `v` is a
 * cell's float level; a drawable of level `L` keeps a pixel while
 * `cellKeeps(v, L, dither)`. A level fading in (v between L−1 and L) keeps
 * the dither under its share, one fading out (v between L and L+1) the
 * dither over the next level's share — the two always the whole. */
export const CELL_LOD_GLSL = `
uniform sampler2D uCellLod;
uniform vec2 uCellGrid;
float cellLodAt(vec2 cell) {
  ivec2 c = clamp(ivec2(cell), ivec2(0), ivec2(int(uCellGrid.x) - 1));
  return texelFetch(uCellLod, c, 0).r;
}
bool cellKeeps(float v, float L, float dither) {
  if (v <= L) return dither < v - (L - 1.0);
  return dither >= v - L;
}`;

/** The screen-space dither every level shares (the same one the per-tree
 * hand-over uses, `forest.ts`'s `graftFade`), so complementary shares meet. */
export const LOD_DITHER =
  "fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))";

export type CellLod = {
  texture: THREE.DataTexture;
  /** Each cell's level now (float). */
  value: Float32Array;
  /** Each cell's settled level. */
  target: Uint8Array;
  uniforms: { uCellLod: { value: THREE.DataTexture }; uCellGrid: { value: THREE.Vector2 } };
};

export function createCellLod(cols: number): CellLod {
  const value = new Float32Array(cols * cols).fill(4);
  const texture = new THREE.DataTexture(value, cols, cols, THREE.RedFormat, THREE.FloatType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return {
    texture,
    value,
    target: new Uint8Array(cols * cols).fill(4),
    uniforms: {
      uCellLod: { value: texture },
      uCellGrid: { value: new THREE.Vector2(cols, CELL) },
    },
  };
}

/** Move cell `b`'s level `ms` milliseconds toward its target: never more
 * than one level apart (a jump of two comes in at the last one). Returns
 * whether it is still moving. */
export function stepLevel(lod: CellLod, b: number, ms: number): boolean {
  const t = lod.target[b];
  let v = lod.value[b];
  if (v === t) return false;
  if (v < t - 1) v = t - 1;
  if (v > t + 1) v = t + 1;
  const step = ms / HAND_OVER_MS;
  v = v < t ? Math.min(t, v + step) : Math.max(t, v - step);
  lod.value[b] = v;
  return v !== t;
}

/** Graft the cells' levels into a tree material: `level` the drawable's,
 * `cell` the GLSL for the cell (in cells, a vec2) its vertex belongs to —
 * a tree's foot, or a merged block's corner and the vertex's `sub` (its cell
 * in the block, `side` cells a row; `side` 0: no `sub`). A vertex whose
 * cell gives this level no share is folded away before it is drawn (every
 * vertex of a tree or a shell triangle shares its cell, so the whole of it
 * folds to nothing and costs no pixel); the rest keep their dither's share. */
export function graftCellLod(
  shader: THREE.WebGLProgramParametersWithUniforms,
  lod: CellLod,
  level: number,
  cell: string,
  side = 0,
): void {
  Object.assign(shader.uniforms, lod.uniforms);
  const L = level.toFixed(1);
  const sub = side > 0 ? "attribute float sub;" : "";
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>\n${CELL_LOD_GLSL}\n${sub}\nvarying float vCellLod;`,
    )
    .replace("#include <begin_vertex>", `#include <begin_vertex>\n  vCellLod = cellLodAt(${cell});`)
    .replace(
      "#include <project_vertex>",
      `#include <project_vertex>
  if (vCellLod <= ${L} - 1.0 || vCellLod >= ${L} + 1.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${CELL_LOD_GLSL}\nvarying float vCellLod;`)
    .replace(
      "void main() {",
      `void main() {\n  if (!cellKeeps(vCellLod, ${L}, ${LOD_DITHER})) discard;`,
    );
}

/** The GLSL for a merged block's or a shell tile's vertex's cell, `side`
 * cells a row. */
export const blockCell = (side: number): string =>
  `floor(modelMatrix[3].xz / uCellGrid.y + 0.5) + vec2(mod(sub, ${side.toFixed(1)}), floor(sub / ${side.toFixed(1)}))`;

/** What a cell's trees are, as the forest holds them (`forest.ts`): the
 * bin order, each tree's matrix, tint and girth, which are felled, and the
 * grid. */
export type CellTrees = {
  cols: number;
  binStart: Int32Array;
  matrices: Float32Array;
  colours: Float32Array;
  girths: Float32Array;
  gone: Uint8Array;
};

const nm = new THREE.Matrix3();
const m4 = new THREE.Matrix4();

/** Every tree of block (`bx`, `bz`) — `side` cells a side — merged into
 * one mesh, its points relative to the block's corner (the mesh stands
 * there) and each tagged with its cell in the block (`sub`), which is how
 * its shader knows the level of each tree's own cell; `shapeOf(i)` is tree
 * `i`'s shape, null to leave it out. The trunk's girth and the tint are
 * baked in; normals and colours are packed to bytes. */
export function mergeBlock(
  w: CellTrees,
  bx: number,
  bz: number,
  shapeOf: (i: number) => THREE.BufferGeometry | null,
  side = BLOCK,
): THREE.BufferGeometry | null {
  const cells: number[] = [];
  const subs: number[] = [];
  for (let r = 0; r < side; r++)
    for (let c = 0; c < side; c++) {
      const cc = bx * side + c;
      const rr = bz * side + r;
      if (cc >= w.cols || rr >= w.cols) continue;
      cells.push(rr * w.cols + cc);
      subs.push(r * side + c);
    }
  let n = 0;
  for (const b of cells)
    for (let i = w.binStart[b]; i < w.binStart[b + 1]; i++) {
      if (w.gone[i]) continue;
      const g = shapeOf(i);
      if (g) n += g.getAttribute("position").count;
    }
  if (n === 0) return null;
  const ox = bx * side * CELL;
  const oz = bz * side * CELL;
  const pos = new Float32Array(n * 3);
  const nrm = new Int8Array(n * 3);
  const col = new Uint8Array(n * 3);
  const sub = new Uint8Array(n);
  const spans = new Int32Array(side * side + 1);
  let o = 0;
  cells.forEach((b, cellIndex) => {
    spans[subs[cellIndex]] = o;
    const lo = w.binStart[b];
    const hi = w.binStart[b + 1];
    for (let i = lo; i < hi; i++) {
      if (w.gone[i]) continue;
      const g = shapeOf(i);
      if (!g) continue;
      const e = w.matrices.subarray(i * 16, i * 16 + 16);
      m4.fromArray(e);
      nm.getNormalMatrix(m4);
      const ne = nm.elements;
      const P = g.getAttribute("position").array as Float32Array;
      const N = g.getAttribute("normal").array as Float32Array;
      const C = g.getAttribute("color").array as Float32Array;
      const stem = g.getAttribute("stem") as THREE.BufferAttribute | undefined;
      const S = stem ? (stem.array as Float32Array) : null;
      const gx = w.girths[i * 2];
      const gz = w.girths[i * 2 + 1];
      const tr = w.colours[i * 3];
      const tg = w.colours[i * 3 + 1];
      const tb = w.colours[i * 3 + 2];
      const count = P.length / 3;
      for (let v = 0; v < count; v++) {
        let x = P[v * 3];
        const y = P[v * 3 + 1];
        let z = P[v * 3 + 2];
        if (S && S[v * 3 + 2] > 0) {
          // THE GIRTH, as `GIRTH_VERTEX` pushes it: out from the trunk's axis.
          const k = S[v * 3 + 2];
          x = S[v * 3] + (x - S[v * 3]) * (1 + (gx - 1) * k);
          z = S[v * 3 + 1] + (z - S[v * 3 + 1]) * (1 + (gz - 1) * k);
        }
        pos[o * 3] = e[0] * x + e[4] * y + e[8] * z + e[12] - ox;
        pos[o * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        pos[o * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14] - oz;
        const nx = N[v * 3];
        const ny = N[v * 3 + 1];
        const nz = N[v * 3 + 2];
        let ax = ne[0] * nx + ne[3] * ny + ne[6] * nz;
        let ay = ne[1] * nx + ne[4] * ny + ne[7] * nz;
        let az = ne[2] * nx + ne[5] * ny + ne[8] * nz;
        const l = 127 / (Math.hypot(ax, ay, az) || 1);
        ax *= l;
        ay *= l;
        az *= l;
        nrm[o * 3] = Math.round(ax);
        nrm[o * 3 + 1] = Math.round(ay);
        nrm[o * 3 + 2] = Math.round(az);
        col[o * 3] = Math.min(255, Math.round(C[v * 3] * tr * 255));
        col[o * 3 + 1] = Math.min(255, Math.round(C[v * 3 + 1] * tg * 255));
        col[o * 3 + 2] = Math.min(255, Math.round(C[v * 3 + 2] * tb * 255));
        sub[o] = subs[cellIndex];
        o++;
      }
    }
    for (let k = subs[cellIndex] + 1; k <= side * side; k++) spans[k] = o;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3, true));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3, true));
  g.setAttribute("sub", new THREE.BufferAttribute(sub, 1));
  g.userData.spans = spans;
  g.computeBoundingSphere();
  return g;
}

/** A kind's two colours as the shell paints it: the dark of its boughs and
 * the white of the snow on them — read off its own built shape, so a
 * region's or a summer's paint comes with it. */
export type ShellPaint = { needle: THREE.Color; snow: THREE.Color };

export function shellPaintOf(g: THREE.BufferGeometry): ShellPaint {
  const N = g.getAttribute("normal").array as Float32Array;
  const C = g.getAttribute("color").array as Float32Array;
  const P = g.getAttribute("position").array as Float32Array;
  g.computeBoundingBox();
  const { min, max } = g.boundingBox!;
  // The crown only: the trunk under it is not what a far eye sees.
  const above = min.y + (max.y - min.y) * 0.3;
  const needle = [0, 0, 0, 0];
  const snow = [0, 0, 0, 0];
  for (let v = 0; v < N.length / 3; v++) {
    if (P[v * 3 + 1] < above) continue;
    const ny = N[v * 3 + 1];
    const into = ny > 0.55 ? snow : ny < 0.2 ? needle : null;
    if (!into) continue;
    into[0] += C[v * 3];
    into[1] += C[v * 3 + 1];
    into[2] += C[v * 3 + 2];
    into[3]++;
  }
  const mean = (a: number[], fall: number) =>
    a[3] > 0
      ? new THREE.Color(a[0] / a[3], a[1] / a[3], a[2] / a[3])
      : new THREE.Color(fall, fall, fall);
  return { needle: mean(needle, 0.06), snow: mean(snow, 0.85) };
}

/** A far sketch painted as the mid cut reads from afar: what faces up
 * white with snow, what faces out the boughs' dark — the sketch's own
 * colours are its shading's, grey at a distance. A copy; the shape is kept. */
export function whitened(g: THREE.BufferGeometry, paint: ShellPaint): THREE.BufferGeometry {
  const out = g.clone();
  const N = out.getAttribute("normal");
  const C = out.getAttribute("color");
  const c = new THREE.Color();
  for (let v = 0; v < C.count; v++) {
    const up = Math.min(1, Math.max(0, (N.getY(v) - 0.1) / 0.5));
    c.copy(paint.needle).lerp(paint.snow, 0.15 + 0.5 * up);
    C.setXYZ(v, c.r, c.g, c.b);
  }
  return out;
}

function hash(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** One tree as the shell reads it. */
export type ShellTree = {
  x: number;
  y: number;
  z: number;
  height: number;
  crown: number;
  paint: ShellPaint;
  /** Whether its crown is a spire (a conifer) or a rounded head. */
  spire: boolean;
};

/** THE CANOPY SHELL over tile (`tx`, `tz`): a grid every `SHELL_STEP` m,
 * each point raised to the highest crown over it (a cone for a spire, a
 * dome for a rounded head), points no crown covers dropped under the snow
 * and the triangles all of whose points are bare left out — so the woods'
 * edges fall to the snow as dark skirts. Coloured by the crown that owns
 * each point: snow on what faces up, its boughs' dark on what does not, a
 * tree's load off a hash of its place. `tier` is each point's height up its
 * crown in tiers, for the shader's stripe. `ground(x, z)` is the snow. */
export function buildShell(
  tx: number,
  tz: number,
  trees: readonly ShellTree[],
  ground: (x: number, z: number) => number,
): THREE.BufferGeometry | null {
  if (trees.length === 0) return null;
  const side = TILE * CELL;
  const n = side / SHELL_STEP;
  const row = n + 1;
  const x0 = tx * side;
  const z0 = tz * side;
  const h = new Float32Array(row * row);
  const gnd = new Float32Array(row * row);
  const owner = new Int32Array(row * row).fill(-1);
  for (let j = 0; j < row; j++)
    for (let i = 0; i < row; i++) {
      const g = ground(x0 + i * SHELL_STEP, z0 + j * SHELL_STEP);
      gnd[j * row + i] = g;
      h[j * row + i] = g - 1.2;
    }
  trees.forEach((t, k) => {
    // A crown reads a touch wider at the shell's distance than its
    // collision radius, so a stand closes over into a roof.
    const R = Math.max(SHELL_STEP * 0.6, t.crown);
    const top = t.y + t.height - 0.3;
    const base = t.y + t.height * (t.spire ? 0.12 : 0.35);
    const i0 = Math.max(0, Math.ceil((t.x - R - x0) / SHELL_STEP));
    const i1 = Math.min(n, Math.floor((t.x + R - x0) / SHELL_STEP));
    const j0 = Math.max(0, Math.ceil((t.z - R - z0) / SHELL_STEP));
    const j1 = Math.min(n, Math.floor((t.z + R - z0) / SHELL_STEP));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(x0 + i * SHELL_STEP - t.x, z0 + j * SHELL_STEP - t.z) / R;
        // The grid point nearest the trunk always takes its top: a crown
        // narrower than the grid would otherwise fall between the points.
        const nearest =
          i === Math.round((t.x - x0) / SHELL_STEP) && j === Math.round((t.z - z0) / SHELL_STEP);
        if (d >= 1 && !nearest) continue;
        // A crown's top held over its nearest grid point (a spire between
        // four points would otherwise be read at half its height), falling
        // to its foot round it: steeply for a spire, as a dome for a head.
        const s = nearest ? 0 : Math.max(0, (d - 0.45) / 0.55);
        const y = top - (top - base) * (t.spire ? s * s : s * s * s);
        const v = j * row + i;
        if (y > h[v]) {
          h[v] = y;
          owner[v] = k;
        }
      }
  });
  let covered = 0;
  for (let v = 0; v < row * row; v++) if (owner[v] >= 0) covered++;
  if (covered === 0) return null;
  // Every grid point's normal, colour and tier.
  const N = new Int8Array(row * row * 3);
  const C = new Uint8Array(row * row * 3);
  const T = new Float32Array(row * row);
  const hAt = (i: number, j: number) =>
    h[Math.min(n, Math.max(0, j)) * row + Math.min(n, Math.max(0, i))];
  const c = new THREE.Color();
  for (let v = 0; v < row * row; v++) {
    const i = v % row;
    const j = Math.floor(v / row);
    let nx = hAt(i - 1, j) - hAt(i + 1, j);
    let nz = hAt(i, j - 1) - hAt(i, j + 1);
    let ny = 2 * SHELL_STEP;
    const l = 127 / Math.hypot(nx, ny, nz);
    nx *= l;
    ny *= l;
    nz *= l;
    N[v * 3] = Math.round(nx);
    N[v * 3 + 1] = Math.round(ny);
    N[v * 3 + 2] = Math.round(nz);
    const k = owner[v];
    if (k < 0) {
      c.setRGB(0.06, 0.07, 0.07);
    } else {
      const t = trees[k];
      // How loaded this crown is: most carry snow, some are shaken bare.
      const load = 0.5 + 0.5 * hash(t.x * 0.71 + 5, t.z * 1.3);
      // A loaded crown reads white from afar on all but its steepest
      // flanks; the shell's own slopes are steeper than the crowns', so
      // the snow is laid on by the load first and the slope after.
      const up = Math.min(1, Math.max(0, (ny / 127 - 0.2) / 0.6));
      c.copy(t.paint.needle).lerp(t.paint.snow, 0.3 + load * (0.3 + 0.3 * up));
      T[v] = ((h[v] - t.y) / t.height) * 9;
    }
    C[v * 3] = Math.round(Math.min(1, c.r) * 255);
    C[v * 3 + 1] = Math.round(Math.min(1, c.g) * 255);
    C[v * 3 + 2] = Math.round(Math.min(1, c.b) * 255);
  }
  // The triangles, a quad at a time, each kept while one of its points is
  // under a crown — unshared, so every one carries its own cell (`sub`) and
  // folds away whole when its cell is not at the shell's level.
  const list: number[] = [];
  const cellOf: number[] = [];
  const per = CELL / SHELL_STEP;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const a = j * row + i;
      const b = a + 1;
      const cc = a + row + 1;
      const d = a + row;
      const sub = Math.floor(j / per) * TILE + Math.floor(i / per);
      for (const [p, q, r] of [
        [a, d, cc],
        [a, cc, b],
      ]) {
        if (owner[p] < 0 && owner[q] < 0 && owner[r] < 0) continue;
        list.push(p, q, r);
        cellOf.push(sub);
      }
    }
  if (list.length === 0) return null;
  // Grouped by cell, so a cell not drawn is left out of the index whole.
  const order = cellOf.map((_, k) => k).sort((p, q) => cellOf[p] - cellOf[q] || p - q);
  const spans = new Int32Array(TILE * TILE + 1).fill(-1);
  const sorted: number[] = [];
  const subOf: number[] = [];
  for (const k of order) {
    if (spans[cellOf[k]] < 0) spans[cellOf[k]] = sorted.length;
    sorted.push(list[k * 3], list[k * 3 + 1], list[k * 3 + 2]);
    subOf.push(cellOf[k]);
  }
  spans[TILE * TILE] = sorted.length;
  for (let k = TILE * TILE - 1; k >= 0; k--) if (spans[k] < 0) spans[k] = spans[k + 1];
  for (let k = 0; k < sorted.length; k++) list[k] = sorted[k];
  for (let k = 0; k < subOf.length; k++) cellOf[k] = subOf[k];
  const used = list.length;
  const pos = new Float32Array(used * 3);
  const nrm = new Int8Array(used * 3);
  const col = new Uint8Array(used * 3);
  const tier = new Uint8Array(used);
  const sub = new Uint8Array(used);
  for (let o = 0; o < used; o++) {
    const v = list[o];
    pos[o * 3] = (v % row) * SHELL_STEP;
    pos[o * 3 + 1] = h[v];
    pos[o * 3 + 2] = Math.floor(v / row) * SHELL_STEP;
    for (let k = 0; k < 3; k++) {
      nrm[o * 3 + k] = N[v * 3 + k];
      col[o * 3 + k] = C[v * 3 + k];
    }
    tier[o] = Math.min(255, Math.round(T[v] * 25));
    sub[o] = cellOf[Math.floor(o / 3)];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3, true));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3, true));
  g.setAttribute("tier", new THREE.BufferAttribute(tier, 1));
  g.setAttribute("sub", new THREE.BufferAttribute(sub, 1));
  g.userData.spans = spans;
  g.computeBoundingSphere();
  return g;
}

/** THE CELLS A MESH DRAWS: its index cut to the points of the cells
 * `live` marks (by `sub`), so a block or a tile shown for one of its cells
 * submits that cell's triangles alone — the rest would only fold away in
 * the shader after their points were transformed. Rebuilt only when the
 * set moves. */
export function drawOnly(g: THREE.BufferGeometry, live: Uint8Array): void {
  const spans = g.userData.spans as Int32Array | undefined;
  if (!spans) return;
  let key = "";
  for (let k = 0; k < spans.length - 1; k++) key += live[k] ? "1" : "0";
  if (g.userData.live === key) return;
  g.userData.live = key;
  const total = spans[spans.length - 1];
  if (!key.includes("0")) {
    g.setIndex(null);
    g.setDrawRange(0, Infinity);
    return;
  }
  let index = g.userData.index as THREE.BufferAttribute | undefined;
  if (!index) {
    const a = total > 65535 ? new Uint32Array(total) : new Uint16Array(total);
    index = new THREE.BufferAttribute(a, 1);
    index.setUsage(THREE.DynamicDrawUsage);
    g.userData.index = index;
  }
  const a = index.array as Uint16Array | Uint32Array;
  let n = 0;
  for (let k = 0; k < spans.length - 1; k++)
    if (live[k]) for (let v = spans[k]; v < spans[k + 1]; v++) a[n++] = v;
  index.needsUpdate = true;
  g.setIndex(index);
  g.setDrawRange(0, n);
}

/** THE SHELL'S TIERS in its shader: a stripe of the boughs' dark across
 * each tier, faded to its mean as a tier gets finer than a pixel. */
export function graftShellTier(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nattribute float tier;\nvarying float vTier;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vTier = tier / 25.0;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying float vTier;")
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
  {
    float fw = fwidth(vTier);
    float band = smoothstep(0.35, 0.65, abs(fract(vTier) - 0.5) * 2.0);
    float stripe = mix(band, 0.5, clamp(fw * 1.6, 0.0, 1.0));
    diffuseColor.rgb *= mix(1.0, 0.75, stripe * step(0.05, vTier));
  }`,
    );
}

/** Whether a point at `px`, `py`, `pz` is hidden from the lens at `cx`,
 * `cy`, `cz` behind the ground: the line between them marched over the
 * heightfield, the ground standing over it by `margin` m somewhere. */
export function hidden(
  ground: (x: number, z: number) => number,
  cx: number,
  cy: number,
  cz: number,
  px: number,
  py: number,
  pz: number,
  margin = 3,
): boolean {
  const steps = 24;
  for (let s = 1; s < steps; s++) {
    const f = s / steps;
    const x = cx + (px - cx) * f;
    const z = cz + (pz - cz) * f;
    const y = cy + (py - cy) * f;
    if (ground(x, z) > y + margin) return true;
  }
  return false;
}

/** A cache of built meshes by key, held to a budget of bytes: the least
 * recently drawn dropped first. */
export type MeshCache<T> = {
  get(key: number): T | null | undefined;
  set(key: number, value: T | null, bytes: number): void;
  touch(key: number, frame: number): void;
  /** Drop the least recently touched until under the budget, never one
   * touched on `frame`. Returns what was dropped. */
  trim(frame: number): T[];
  bytes(): number;
  clear(): T[];
};

export function createMeshCache<T>(budget: number): MeshCache<T> {
  const items = new Map<number, { value: T | null; bytes: number; used: number }>();
  let total = 0;
  return {
    get(key) {
      const it = items.get(key);
      return it ? it.value : undefined;
    },
    set(key, value, bytes) {
      const old = items.get(key);
      if (old) total -= old.bytes;
      items.set(key, { value, bytes, used: 0 });
      total += bytes;
    },
    touch(key, frame) {
      const it = items.get(key);
      if (it) it.used = frame;
    },
    trim(frame) {
      const out: T[] = [];
      if (total <= budget) return out;
      const order = [...items.entries()].sort((a, b) => a[1].used - b[1].used);
      for (const [key, it] of order) {
        if (total <= budget || it.used >= frame) break;
        items.delete(key);
        total -= it.bytes;
        if (it.value) out.push(it.value);
      }
      return out;
    },
    bytes: () => total,
    clear() {
      const out: T[] = [];
      for (const it of items.values()) if (it.value) out.push(it.value);
      items.clear();
      total = 0;
      return out;
    },
  };
}

/** The bytes a geometry holds. */
export function geometryBytes(g: THREE.BufferGeometry | null): number {
  if (!g) return 64;
  let n = 0;
  for (const a of Object.values(g.attributes))
    n += (a.array as ArrayLike<number> & { byteLength: number }).byteLength;
  if (g.index) n += (g.index.array as ArrayLike<number> & { byteLength: number }).byteLength;
  return n;
}
