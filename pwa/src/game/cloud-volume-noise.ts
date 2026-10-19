// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VOLUME'S NOISE — the two 3D textures HIGH's raymarched cloud is
// carved from (`cloud-volume-glsl.ts`), made in code, three-free, so the
// suite holds their tiling and their spread (`tests/cloud_volume_test.ts`).
//
// A heap seen close is a pile of rounded puffs, each one a pile of smaller
// ones: neither a smooth gradient noise (which makes soft, wispy blobs)
// nor a cellular one (which makes bubbles) alone. The usual answer, and
// ours, is the two together:
//
//   * THE SHAPE (64³, four channels): a gradient-noise fbm DILATED by an
//     inverted cellular fbm (`perlinWorley`: where the cells are full the
//     gradient noise is lifted toward one, so its hollows are round cells
//     rather than smooth dips) — the puffs' outline — and three cellular
//     fbms an octave apart, which the shader sums and cuts the first by,
//     so the big puffs carry smaller ones on their edges.
//   * THE DETAIL (32³, three channels): cellular fbms at higher frequencies
//     eaten out of a cloud's edge only (where it is thin), billowed on a
//     heap's top and dragged into wisps under its base.
//
// Every channel TILES (the lattice and the cells wrap at the period), so
// the shader reads them anywhere with a repeat; every channel is stretched
// to the bytes' range off its own spread, as the field's noise is.

/** A hash of a key and a salt to 0..1 (the field's own mixer, kept here so
 * the module stands alone — the volume's noise is its own). */
function cloudHash(key: number, salt: number): number {
  let h = Math.imul((key ^ Math.imul(salt, 0x27d4eb2d)) >>> 0, 0x9e3779b1) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** The shape texture's texels a side, and the detail's. */
export const SHAPE_SIZE = 64;
export const DETAIL_SIZE = 32;

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const wrapI = (i: number, n: number): number => ((i % n) + n) % n;

/** A tileable gradient noise of `cells` lattice cells a period, read at
 * (x, y, z) in cells; about −1..1. */
function gradient(x: number, y: number, z: number, cells: number, dirs: Uint8Array): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  let s = 0;
  for (let k = 0; k < 8; k++) {
    const dx = k & 1;
    const dy = (k >> 1) & 1;
    const dz = (k >> 2) & 1;
    // One of the twelve edge directions of a cube, Perlin's improved set.
    const g =
      dirs[(wrapI(iz + dz, cells) * cells + wrapI(iy + dy, cells)) * cells + wrapI(ix + dx, cells)];
    const px = fx - dx;
    const py = fy - dy;
    const pz = fz - dz;
    const u = g < 8 ? px : py;
    const v = g < 4 ? py : pz;
    const dot = ((g & 1) === 0 ? u : -u) + ((g & 2) === 0 ? v : -v);
    const w =
      (dx ? fade(fx) : 1 - fade(fx)) *
      (dy ? fade(fy) : 1 - fade(fy)) *
      (dz ? fade(fz) : 1 - fade(fz));
    s += w * dot;
  }
  return s;
}

/** The lattice's gradient directions, one of twelve a corner, `cells`³. */
function directions(cells: number, salt: number): Uint8Array {
  const d = new Uint8Array(cells * cells * cells);
  for (let i = 0; i < d.length; i++) d[i] = Math.floor(cloudHash(i, salt) * 12);
  return d;
}

/** The feature points of a tileable cellular noise: one a cell, `cells`³. */
function features(cells: number, salt: number): Float32Array {
  const f = new Float32Array(cells * cells * cells * 3);
  for (let i = 0; i < cells * cells * cells; i++)
    for (let a = 0; a < 3; a++) f[i * 3 + a] = cloudHash(i, salt + a * 7919);
  return f;
}

/** One minus the distance to the nearest feature point (in cells, cut at
 * one): 1 at a cell's heart, 0 between cells. (x, y, z) in cells. */
function cellular(x: number, y: number, z: number, cells: number, pts: Float32Array): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  let best = 9;
  for (let dz = -1; dz <= 1; dz++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx;
        const cy = iy + dy;
        const cz = iz + dz;
        const k = ((wrapI(cz, cells) * cells + wrapI(cy, cells)) * cells + wrapI(cx, cells)) * 3;
        const ex = cx + pts[k] - x;
        const ey = cy + pts[k + 1] - y;
        const ez = cz + pts[k + 2] - z;
        const d = ex * ex + ey * ey + ez * ez;
        if (d < best) best = d;
      }
  return 1 - Math.min(1, Math.sqrt(best));
}

/** Stretch every channel of `raw` (`channels` interleaved) to 0..255 off
 * its own 0.5th and 99.5th percentiles. */
function toBytes(raw: Float32Array, channels: number): Uint8Array {
  const out = new Uint8Array(raw.length);
  const n = raw.length / channels;
  for (let c = 0; c < channels; c++) {
    const col = new Float32Array(n);
    for (let i = 0; i < n; i++) col[i] = raw[i * channels + c];
    col.sort();
    const lo = col[Math.floor(n * 0.005)];
    const hi = col[Math.floor(n * 0.995)];
    const k = 255 / Math.max(hi - lo, 1e-6);
    for (let i = 0; i < n; i++)
      out[i * channels + c] = Math.round(
        Math.min(255, Math.max(0, (raw[i * channels + c] - lo) * k)),
      );
  }
  return out;
}

// isolation:stateless: the noise volumes, decoded once (tests/support/isolation.ts).
let shape: Uint8Array | null = null;
let detail: Uint8Array | null = null;

/** THE SHAPE, `SHAPE_SIZE`³ × RGBA bytes (x fastest): R the Perlin-Worley
 * (a four-octave gradient fbm of 4 cells a period dilated by a cellular
 * fbm of the same), G, B and A cellular fbms of 4, 8 and 16 cells. */
export function cloudShapeNoise(): Uint8Array {
  if (shape) return shape;
  const N = SHAPE_SIZE;
  const cells = [4, 8, 16, 32, 64];
  const sets = cells.map((c, i) => features(c, 31 + i));
  const w = [0.625, 0.25, 0.125];
  const raw = new Float32Array(N * N * N * 4);
  const oct = new Float32Array(5);
  const dirs = [0, 1, 2, 3].map((o) => directions(4 << o, 51 + o));
  for (let z = 0; z < N; z++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        let g = 0;
        let amp = 1;
        let norm = 0;
        for (let o = 0; o < 4; o++) {
          const c = 4 << o;
          const k = c / N;
          g += amp * gradient(x * k, y * k, z * k, c, dirs[o]);
          norm += amp;
          amp *= 0.5;
        }
        const perlin = Math.min(1, Math.max(0, 0.5 + 0.5 * (g / norm) * 1.6));
        // Each cellular octave once; the three fbms share them.
        for (let o = 0; o < 5; o++) {
          const k = cells[o] / N;
          oct[o] = cellular(x * k, y * k, z * k, cells[o], sets[o]);
        }
        const w4 = w[0] * oct[0] + w[1] * oct[1] + w[2] * oct[2];
        const w8 = w[0] * oct[1] + w[1] * oct[2] + w[2] * oct[3];
        const w16 = w[0] * oct[2] + w[1] * oct[3] + w[2] * oct[4];
        const i = ((z * N + y) * N + x) * 4;
        // Dilated: the gradient noise lifted where the cells are full.
        raw[i] = w4 + perlin * (1 - w4);
        raw[i + 1] = w4;
        raw[i + 2] = w8;
        raw[i + 3] = w16;
      }
  shape = toBytes(raw, 4);
  return shape;
}

/** THE DETAIL, `DETAIL_SIZE`³ × RGBA bytes: cellular fbms of 2, 4 and 8
 * cells a period (A unused, one). */
export function cloudDetailNoise(): Uint8Array {
  if (detail) return detail;
  const N = DETAIL_SIZE;
  const cells = [2, 4, 8, 16, 32];
  const sets = cells.map((c, i) => features(c, 71 + i));
  const w = [0.625, 0.25, 0.125];
  const raw = new Float32Array(N * N * N * 4);
  const oct = new Float32Array(5);
  for (let z = 0; z < N; z++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        for (let o = 0; o < 5; o++) {
          const k = cells[o] / N;
          oct[o] = cellular(x * k, y * k, z * k, cells[o], sets[o]);
        }
        const i = ((z * N + y) * N + x) * 4;
        for (let c = 0; c < 3; c++)
          raw[i + c] = w[0] * oct[c] + w[1] * oct[c + 1] + w[2] * oct[c + 2];
        raw[i + 3] = 1;
      }
  detail = toBytes(raw, 4);
  for (let i = 3; i < detail.length; i += 4) detail[i] = 255;
  return detail;
}

/** A channel `c` of a `n`³ RGBA texture at texel (x, y, z), wrapped, 0..1. */
export function texelOf(
  data: Uint8Array,
  n: number,
  x: number,
  y: number,
  z: number,
  c: number,
): number {
  return data[((wrapI(z, n) * n + wrapI(y, n)) * n + wrapI(x, n)) * 4 + c] / 255;
}

const remap = (x: number, a: number, b: number, c: number, d: number): number =>
  c + ((x - a) / (b - a)) * (d - c);

/** THE PUFFS' SHAPE as the shader reads it off a shape texel's four
 * channels: the Perlin-Worley cut by the cellular octaves' sum, 0..1. */
export function shapeOf(r: number, g: number, b: number, a: number): number {
  const fbm = g * 0.625 + b * 0.25 + a * 0.125;
  return Math.min(1, Math.max(0, remap(r, fbm - 1, 1, 0, 1)));
}
