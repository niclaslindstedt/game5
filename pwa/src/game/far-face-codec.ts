// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL COUNTRY'S FILE FORMAT — how `make far-faces`
// (`scripts/far-faces.mjs`, which imports this) writes a face's far
// country and `far-faces.ts` reads it back. Import-free, so the bake and
// the game share one codec.
//
// A file holds a POLAR grid round the map's middle on `far-ranges-field.ts`'s
// layout (`bearings` spokes from the map's +z turning toward +x, `rows`
// rings spaced in the logarithm of the radius from `inner` to `outer` m):
// every height over the sea a whole number of `step` m over `base`, ring by
// ring, each the change from the sample before it as a zigzag varint, in
// base64.

/** One face's country as baked. */
export type FarFaceData = {
  readonly id: string;
  readonly bearings: number;
  readonly rows: number;
  readonly inner: number;
  readonly outer: number;
  /** A height's step, m, and the lowest height over the sea, m. */
  readonly step: number;
  readonly base: number;
  readonly data: string;
};

/** The layout every face is baked on: 256 spokes by 40 rings from 2.5 to
 * 60 km, heights to 4 m — some 15 kB a face. */
export const FAR_FACE = {
  bearings: 256,
  rows: 40,
  inner: 2500,
  outer: 60_000,
  step: 4,
} as const;

/** Heights over the sea (`heights`, row-major by ring) as a file's `base`
 * and `data`. */
export function encodeFarFace(
  heights: ArrayLike<number>,
  step: number,
): { base: number; data: string } {
  let base = Infinity;
  for (let k = 0; k < heights.length; k++) base = Math.min(base, heights[k]);
  base = Math.floor(base / step) * step;
  const bytes: number[] = [];
  let was = 0;
  for (let k = 0; k < heights.length; k++) {
    const v = Math.round((heights[k] - base) / step);
    const d = v - was;
    was = v;
    let z = d < 0 ? -2 * d - 1 : 2 * d;
    while (z >= 0x80) {
      bytes.push((z & 0x7f) | 0x80);
      z >>>= 7;
    }
    bytes.push(z);
  }
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return { base, data: btoa(bin) };
}

/** The heights over the sea a file holds, m, row-major by ring. */
export function decodeFarFace(face: FarFaceData): Float32Array {
  const bin = atob(face.data);
  const n = face.bearings * face.rows;
  const out = new Float32Array(n);
  let at = 0;
  let v = 0;
  for (let k = 0; k < n; k++) {
    let z = 0;
    let shift = 0;
    for (;;) {
      const b = bin.charCodeAt(at++);
      z |= (b & 0x7f) << shift;
      if (b < 0x80) break;
      shift += 7;
    }
    v += z & 1 ? -((z + 1) >>> 1) : z >>> 1;
    out[k] = face.base + v * face.step;
  }
  return out;
}
