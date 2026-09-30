// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R21 — THE REGION'S OWN SNOW: what the wind has done to the mountain
// before the groomer came up it.
//
// THE WIND CRUST, laid only in a region whose row asks for it, off a
// stream of its own (the attempt's sub-seed, salted) so it moves not a
// single number anything else on the map draws: a packed share pressed
// into the powder over broad patches of slow noise and over every crest a
// few metres proud of the ground round it — the wind scours what stands up
// and drops its snow in the lee. Laid on the finished mountain, kickers and
// all.
//
// It never reaches the piste: it is folded into the packed field only past
// `CLEAR` metres of the centreline, so R10 holds — the piste and its
// shoulders are the groomer's alone, and a drift across it (R17) is fresh
// snow over the groomer, never over a crust.

import { smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  createHeightfield,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { valueNoise } from "@niclaslindstedt/oss-game-framework/core/noise";
import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import type { Region } from "./regions.ts";
import { LEVEL_RULES as R } from "./rules.ts";

const CRUST_SALT = 0x0c2057a1;

/** How far from the centreline the region's own snow starts, m: past the
 * widest piste's flat shoulder and its windrow (R8, R18), with three metres
 * to spare — and so past where R10 reads the powder beside the piste. */
export const CLEAR = R.track.width.max / 2 + R.track.shoulder.flat + R.berm.width + 3;

/** …and the metres it eases in over past that. */
const EASE = 10;

/** One box pass along a line of `n` values `stride` apart, `radius` either
 * way, as a running sum. */
function boxLine(
  src: Float32Array,
  dst: Float32Array,
  start: number,
  stride: number,
  n: number,
  radius: number,
): void {
  let sum = 0;
  let count = 0;
  for (let k = 0; k < Math.min(n, radius); k++) {
    sum += src[start + k * stride];
    count++;
  }
  for (let i = 0; i < n; i++) {
    const add = i + radius;
    if (add < n) {
      sum += src[start + add * stride];
      count++;
    }
    const drop = i - radius - 1;
    if (drop >= 0) {
      sum -= src[start + drop * stride];
      count--;
    }
    dst[start + i * stride] = sum / count;
  }
}

/** A box blur of a grid, `radius` cells either way, run twice (≈ a
 * gaussian). */
function blur(src: Float32Array, cols: number, rows: number, radius: number): Float32Array {
  const a = Float32Array.from(src);
  const b = new Float32Array(src.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let r = 0; r < rows; r++) boxLine(a, b, r * cols, 1, cols, radius);
    for (let c = 0; c < cols; c++) boxLine(b, a, c, cols, rows, radius);
  }
  return a;
}

/** R21 — the wind crust's share of the mountain, 0..1 on the ground's
 * grid, or null in a region that lays none. */
export function layCrust(sub: number, region: Region, ground: Heightfield): Heightfield | null {
  const spec = region.crust;
  if (!spec) return null;
  const rng = createRng((sub ^ CRUST_SALT) >>> 0);
  const seed = rng.int(1, 1 << 30);
  const { cols, rows, cell } = ground;
  // What stands proud of the country within fifty metres of it is what the
  // wind scours.
  const around = blur(ground.data, cols, rows, Math.round(12 / cell) * 2);
  const crust = createHeightfield(ground.originX, ground.originZ, cell, cols, rows);
  const edge = 1 - spec.cover;
  for (let r = 0; r < rows; r++) {
    const z = ground.originZ + r * cell;
    for (let c = 0; c < cols; c++) {
      const x = ground.originX + c * cell;
      const o = r * cols + c;
      const n =
        valueNoise(x, z, spec.scale, seed) * 0.7 +
        valueNoise(x, z, spec.scale * 0.3, seed + 11) * 0.3;
      const patch = smoothstep(edge - 0.08, edge + 0.08, n);
      const proud = smoothstep(0.4, 3.5, ground.data[o] - around[o]) * spec.exposed;
      crust.data[o] = Math.max(patch, proud);
    }
  }
  return crust;
}

/** Fold the region's crust into the packed field at its support, taken out
 * within `CLEAR` of the piste (`dist`, the corridor's distance to its
 * centreline), where the crust's own field is zeroed too so what is
 * published is what is laid. */
export function foldSurface(
  packed: Heightfield,
  dist: Float32Array,
  region: Region,
  crust: Heightfield,
): void {
  const support = region.crust?.packed ?? 0;
  const p = packed.data;
  for (let o = 0; o < p.length; o++) {
    const m = smoothstep(CLEAR, CLEAR + EASE, dist[o]);
    crust.data[o] *= m;
    p[o] = Math.max(p[o], crust.data[o] * support);
  }
}
