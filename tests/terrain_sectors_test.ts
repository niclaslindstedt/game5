// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The ground's clipmap cut into sectors (`pwa/src/game/terrain.ts`): the
// sectors a level is drawn in, the lens's view leaving some out, must hold
// between them exactly the triangles of the level whole — none twice, none
// lost — or the snow opens a crack along a sector's edge.

import { describe, expect, it } from "vitest";

import { clipmapIndices, TERRAIN_SECTORS } from "../pwa/src/game/terrain.ts";

/** Every triangle of an index list, as a sorted key per triangle. */
function triangles(idx: Uint32Array): string[] {
  const out: string[] = [];
  for (let t = 0; t < idx.length; t += 3) out.push(`${idx[t]},${idx[t + 1]},${idx[t + 2]}`);
  return out;
}

describe("the clipmap's sectors (terrain.ts)", () => {
  for (const n of [96, 128, 192]) {
    for (const hole of [false, true]) {
      it(`n ${n}${hole ? ", a ring" : ", the full level"}: the sectors are the level whole`, () => {
        const [from, to] = hole ? [n / 4 + 1, (3 * n) / 4 - 1] : [0, 0];
        const whole = triangles(clipmapIndices(n, from, to)).sort();
        const step = n / TERRAIN_SECTORS;
        const parts: string[] = [];
        for (let sj = 0; sj < TERRAIN_SECTORS; sj++) {
          for (let si = 0; si < TERRAIN_SECTORS; si++) {
            const idx = clipmapIndices(
              n,
              from,
              to,
              si * step,
              (si + 1) * step,
              sj * step,
              (sj + 1) * step,
            );
            parts.push(...triangles(idx));
          }
        }
        expect(parts.length).toBe(whole.length);
        expect(parts.sort()).toEqual(whole);
      });
    }
  }
});
