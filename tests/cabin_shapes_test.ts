// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CABINS AS BUILT (`cabin-shapes.ts`): every kind at both cuts drawn in
// the buildings' painted stack — every vertex naming a layer of it — within
// its triangle budget, the far cut cheaper than the near, and the windows
// lit at night through their casements alone.

import { describe, expect, it } from "vitest";

import { type LogKind } from "@engine";
import { buildCabin, cabinTriangles } from "../pwa/src/game/cabin-shapes.ts";
import { FACADE, FACADE_LAYERS } from "../pwa/src/game/facade-paint.ts";

/** The log buildings (the ski area's own are `village-build.ts`'s). */
const KINDS: LogKind[] = ["hut", "cabin", "chalet", "shed", "afterski"];

/** The most triangles each kind's near cut may take: its logs as geometry,
 * everything else in the paint. */
const BUDGET: Record<LogKind, number> = {
  hut: 1400,
  cabin: 1800,
  chalet: 2200,
  shed: 200,
  afterski: 4400,
};

describe("the cabins as built", () => {
  it("keep every kind's near cut within its budget, and the far cut cheaper", () => {
    for (const kind of KINDS) {
      const near = cabinTriangles(kind, 0);
      expect(near, kind).toBeLessThanOrEqual(BUDGET[kind]);
      expect(cabinTriangles(kind, 1), kind).toBeLessThan(near);
    }
  });

  it("name a layer of the painted stack at every vertex, with its UV", () => {
    for (const kind of KINDS) {
      for (const lod of [0, 1] as const) {
        const g = buildCabin(kind, lod);
        const layer = g.getAttribute("facadeLayer");
        const uv = g.getAttribute("facadeUv");
        expect(layer.count, kind).toBe(g.getAttribute("position").count);
        expect(uv.count, kind).toBe(layer.count);
        for (let i = 0; i < layer.count; i++) {
          const l = layer.getX(i);
          expect(Number.isInteger(l) && l >= 0 && l < FACADE_LAYERS, `${kind} ${l}`).toBe(true);
          expect(Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i))).toBe(true);
        }
        g.dispose();
      }
    }
  });

  it("light their windows at night: casements carry the glow at both cuts", () => {
    for (const kind of KINDS.filter((k) => k !== "shed")) {
      for (const lod of [0, 1] as const) {
        const g = buildCabin(kind, lod);
        const layer = g.getAttribute("facadeLayer");
        const glow = g.getAttribute("glow");
        let lit = 0;
        for (let i = 0; i < layer.count; i++) {
          if (layer.getX(i) === FACADE.casement) {
            expect(glow.getX(i), kind).toBe(1);
            lit++;
          }
        }
        expect(lit, `${kind} ${lod}`).toBeGreaterThan(0);
        g.dispose();
      }
    }
  });
});
