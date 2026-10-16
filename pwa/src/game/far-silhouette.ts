// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FAR RANGES AS A PAINTED BAND — what a PAINTED horizon (the HORIZON row's)
// draws in place of the rings' mesh: the skyline round the map baked once
// into a strip a texel a bearing, and painted on the dome itself
// (`sky-dome.ts`) as two flat layers of hazy ridges, the far one paler
// than the near. No mesh, no march of horizons, one read a pixel of sky.
//
// Each bearing is walked out from the map's edge to the far country's
// last ring, over the same ground the rings stand on (`farHeightAt`), the
// Earth's curve laid in; the point seen highest from an eye over the
// map's middle is kept for each layer — its height and its distance, so
// the dome can turn it into an angle from wherever the lens stands.
//
// Three-free and DOM-free; `tests/far_ranges_test.ts` reads it.

import type { Level } from "@engine";

import { FAR_RADIUS } from "./horizon.ts";
import { farHeightAt, type FarFrame, type FarGrid } from "./far-ranges-field.ts";
import { edgeRadius } from "./far-ranges-plan.ts";

export const SILHOUETTE = {
  /** Bearings round the map, a texel each. */
  bins: 512,
  /** Samples out along each bearing, spaced in the logarithm of the radius. */
  samples: 40,
  /** The near layer is the country within this of the map's middle, m; the
   * far layer the rest. */
  split: 12_000,
  /** The eye the skyline is reckoned from: this share of the vertical over
   * the valley floor, at the map's middle. */
  eye: 0.5,
} as const;

/** The baked skyline: for bearing `i` (0 along +z, clockwise from above),
 * `data[i * 4 ..]` is the near layer's height (in the map's frame, the
 * curve's drop taken off) and distance from the middle, then the far
 * layer's, m. A layer with nothing in it reads a height far under the eye. */
export type Silhouette = {
  readonly bins: number;
  readonly data: Float32Array;
};

export function silhouetteOf(
  level: Pick<Level, "groundAt">,
  frame: FarFrame,
  grid: FarGrid,
): Silhouette {
  const { bins, samples, split } = SILHOUETTE;
  const data = new Float32Array(bins * 4);
  const c = frame.size / 2;
  const eye = frame.floor + SILHOUETTE.eye * frame.vertical;
  for (let i = 0; i < bins; i++) {
    const a = (i / bins) * Math.PI * 2;
    const sx = Math.sin(a);
    const sz = Math.cos(a);
    const r0 = edgeRadius(frame.size, a);
    let near = -Infinity;
    let far = -Infinity;
    const best = [eye - 1e4, split, eye - 1e4, grid.outer];
    for (let k = 0; k < samples; k++) {
      const r = r0 * Math.pow(grid.outer / r0, k / (samples - 1));
      const y =
        farHeightAt(level, frame, grid, c + r * sx, c + r * sz) - (r * r) / (2 * FAR_RADIUS);
      const rise = (y - eye) / r;
      if (r < split) {
        if (rise > near) {
          near = rise;
          best[0] = y;
          best[1] = r;
        }
      } else if (rise > far) {
        far = rise;
        best[2] = y;
        best[3] = r;
      }
    }
    data.set(best, i * 4);
  }
  return { bins, data };
}
