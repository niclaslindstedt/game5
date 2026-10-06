// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The ground's clipmap rings laid out by wedge (`pwa/src/game/terrain.ts`):
// a ring is drawn as one run of its wedges, the ones the lens's view
// reaches, so the layout must hold exactly the ring's triangles — none
// twice, none lost, or the snow opens a crack along a wedge's edge — twice
// round, so any run of wedges across where the ring closes is one range.

import { describe, expect, it } from "vitest";

import { clipmapIndices, ringWedges, TERRAIN_WEDGES, wedgeOf } from "../pwa/src/game/terrain.ts";

/** Every triangle of an index list, as a key per triangle. */
function triangles(idx: Uint32Array, from = 0, to = idx.length): string[] {
  const out: string[] = [];
  for (let t = from; t < to; t += 3) out.push(`${idx[t]},${idx[t + 1]},${idx[t + 2]}`);
  return out;
}

describe("the clipmap's wedges (terrain.ts)", () => {
  for (const n of [96, 128, 192]) {
    const [from, to] = [n / 4 + 1, (3 * n) / 4 - 1];
    const w = ringWedges(n, from, to);
    const W = TERRAIN_WEDGES;

    it(`n ${n}: one lap is the ring whole, and the second the first again`, () => {
      const ring = triangles(clipmapIndices(n, from, to)).sort();
      const lap = w.starts[W];
      expect(w.index.length).toBe(2 * lap);
      expect(triangles(w.index, 0, lap).sort()).toEqual(ring);
      expect(triangles(w.index, lap)).toEqual(triangles(w.index, 0, lap));
    });

    it(`n ${n}: every wedge holds triangles, starts in order, and lies in its bounds`, () => {
      expect(w.starts.length).toBe(2 * W + 1);
      for (let k = 0; k < 2 * W; k++) expect(w.starts[k + 1]).toBeGreaterThan(w.starts[k]);
      for (let k = 0; k < W; k++) {
        const [i0, i1, j0, j1] = w.bounds.subarray(k * 4, k * 4 + 4);
        for (let t = w.starts[k]; t < w.starts[k + 1]; t++) {
          const v = w.index[t];
          const i = v % (n + 1);
          const j = Math.floor(v / (n + 1));
          expect(i).toBeGreaterThanOrEqual(i0);
          expect(i).toBeLessThanOrEqual(i1);
          expect(j).toBeGreaterThanOrEqual(j0);
          expect(j).toBeLessThanOrEqual(j1);
        }
      }
    });

    it(`n ${n}: a ring's wedge stands clear of the centre the lens is at`, () => {
      // A wedge's bounds may hold the centre only if the wedge reaches it,
      // and a ring's never does: that is what lets one behind the lens be
      // left out of the view.
      const c = n / 2;
      for (let k = 0; k < W; k++) {
        const [i0, i1, j0, j1] = w.bounds.subarray(k * 4, k * 4 + 4);
        const holds = i0 < c - 1 && i1 > c + 1 && j0 < c - 1 && j1 > c + 1;
        expect(holds, `wedge ${k}`).toBe(false);
      }
    });
  }

  it("every cell falls in a wedge", () => {
    for (let j = 0; j < 64; j++) {
      for (let i = 0; i < 64; i++) {
        const k = wedgeOf(64, i, j);
        expect(k).toBeGreaterThanOrEqual(0);
        expect(k).toBeLessThan(TERRAIN_WEDGES);
      }
    }
  });
});
