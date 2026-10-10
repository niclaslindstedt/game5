// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R25 — A REAL FACE: the massif's shape read off a real mountainside.
//
// A resort can be raised on one of twenty REAL faces instead of the massif
// `massif.ts` deals: a 4×4 km stretch of a real ski mountain, its summit
// ridge along the map's top and its valley floor along the bottom, baked
// offline off the 30 m elevation model by `scripts/real-faces.mjs` into
// `real-faces-data.ts` (generated). What the face replaces is the massif's
// SHAPE — the ridge, the profile, the bench, the folds a dealt mountain is
// given — and nothing else: the vertical is still dealt in R25's band (the
// face stretched to it, so its grades are the game's), the peak, the
// shoulder and the village are read off where the real ones stand, and the
// rollers and the little hills R3 lays are laid over it at their own scale,
// under the 30 m the model can see. Everything downstream — the lifts, the
// runs walked and graded, the woods, the courses — is built onto it as onto
// any massif, by the same rules and the same analysis.
//
// A face is named by its region and a number, never by a place: the rule
// book names no real one.

import { FACE_DATA, FACE_GRID, type FaceData } from "./real-faces-data.ts";
import type { RegionId } from "./regions.ts";

/** One face decoded: real heights over the map's square, m, row 0 the
 * map's top edge, `FACE_GRID.n` samples a side `FACE_GRID.cell` apart. */
export type RealFace = {
  readonly id: string;
  readonly region: RegionId;
  readonly heights: Float32Array;
};

/** Every face there is, in the order the start card lists them. */
export const REAL_FACE_IDS: readonly string[] = FACE_DATA.map((f) => f.id);

/** The region a face lies in, or null for an id no face has. */
export function realFaceRegion(id: string): RegionId | null {
  return FACE_DATA.find((f) => f.id === id)?.region ?? null;
}

const decoded = new Map<string, RealFace>();

/** A face by its id, decoded once; null for an id no face has. */
export function realFace(id: string): RealFace | null {
  const kept = decoded.get(id);
  if (kept) return kept;
  const data = FACE_DATA.find((f) => f.id === id);
  if (!data) return null;
  const face = { id, region: data.region, heights: decode(data) };
  decoded.set(id, face);
  return face;
}

/** The base64 varints back to heights (the bake's `encode` undone). */
function decode(f: FaceData): Float32Array {
  const { n, step } = FACE_GRID;
  const bytes = base64(f.data);
  const q = new Int32Array(n * n);
  let at = 0;
  for (let i = 0; i < n * n; i++) {
    let z = 0;
    let shift = 0;
    let b: number;
    do {
      b = bytes[at++];
      z |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);
    const d = z & 1 ? -((z + 1) >>> 1) : z >>> 1;
    const r = Math.floor(i / n);
    const c = i - r * n;
    const left = c > 0 ? q[i - 1] : 0;
    const up = r > 0 ? q[i - n] : 0;
    const diag = r > 0 && c > 0 ? q[i - n - 1] : 0;
    q[i] = d + left + up - diag;
  }
  const out = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) out[i] = f.floor + q[i] * step;
  return out;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64 to bytes, with no host's decoder (the engine imports nothing). */
export function base64(s: string): Uint8Array {
  const value = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) value[B64.charCodeAt(i)] = i;
  const clean = s.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    acc = (acc << 6) | value[clean.charCodeAt(i)];
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

/** A Catmull–Rom weight set for a fraction `t` between samples 1 and 2. */
function weights(t: number, w: Float64Array): void {
  const t2 = t * t;
  const t3 = t2 * t;
  w[0] = -0.5 * t3 + t2 - 0.5 * t;
  w[1] = 1.5 * t3 - 2.5 * t2 + 1;
  w[2] = -1.5 * t3 + 2 * t2 + 0.5 * t;
  w[3] = 0.5 * t3 - 0.5 * t2;
}

const wx = new Float64Array(4);
const wz = new Float64Array(4);

/** The face's real height at a map point (`x`, `z`), m, bicubic between
 * its samples so the 2 m grid it is baked onto has no creases at 32 m. */
export function faceHeight(face: RealFace, x: number, z: number): number {
  const { n, cell } = FACE_GRID;
  const h = face.heights;
  const gx = Math.min(n - 1, Math.max(0, x / cell));
  const gz = Math.min(n - 1, Math.max(0, z / cell));
  const c = Math.min(n - 2, Math.floor(gx));
  const r = Math.min(n - 2, Math.floor(gz));
  weights(gx - c, wx);
  weights(gz - r, wz);
  let v = 0;
  for (let j = 0; j < 4; j++) {
    const rr = Math.min(n - 1, Math.max(0, r - 1 + j));
    let row = 0;
    for (let i = 0; i < 4; i++) {
      const cc = Math.min(n - 1, Math.max(0, c - 1 + i));
      row += h[rr * n + cc] * wx[i];
    }
    v += row * wz[j];
  }
  return v;
}

/** The mean of the face's heights over a band of rows and columns, m. */
export function faceMean(face: RealFace, x0: number, x1: number, z0: number, z1: number): number {
  const { cell } = FACE_GRID;
  let sum = 0;
  let count = 0;
  for (let z = z0; z <= z1; z += cell) {
    for (let x = x0; x <= x1; x += cell) {
      sum += faceHeight(face, x, z);
      count++;
    }
  }
  return sum / count;
}

/** Where along a row band (`z0`..`z1`) the face stands highest, or (with
 * `low`) lowest, between `x0` and `x1`: the x of the best column, m,
 * read on a 32 m step. */
export function faceExtreme(
  face: RealFace,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  low = false,
): number {
  const { cell } = FACE_GRID;
  let best = x0;
  let bestV = low ? Infinity : -Infinity;
  for (let x = x0; x <= x1; x += cell) {
    const v = faceMean(face, x, x, z0, z1);
    if (low ? v < bestV : v > bestV) {
      bestV = v;
      best = x;
    }
  }
  return best;
}
