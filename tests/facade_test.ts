// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BUILDINGS' MATERIALS AND THE BUILDINGS (`docs/buildings.md`): the
// stack every building is painted in (`facade-paint.ts`) — every layer
// painted, deterministic, a repeating tile that wraps without a seam — the
// kit they are built with (`facade-kit.ts`) facing every face out, and the
// lift stations (`station-build.ts`) standing on their houses' footprints,
// down into the snow and no higher than a roof.

import { describe, expect, it } from "vitest";

import { liftPlans, stationHouses } from "@engine";
import { FacadeKit } from "../pwa/src/game/facade-kit.ts";
import {
  FACADE,
  FACADE_LAYERS,
  FACADE_TILE,
  paintFacades,
  paintPixel,
  type FacadeLayer,
} from "../pwa/src/game/facade-paint.ts";
import { buildStationHouses } from "../pwa/src/game/station-build.ts";
import { layStations } from "../pwa/src/game/station-plan.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const SIZE = 64;

describe("the facade stack", () => {
  const a = paintFacades(SIZE);

  it("paints every layer, colour and relief, the same bytes twice", () => {
    expect(a.albedo.length).toBe(SIZE * SIZE * 4 * FACADE_LAYERS);
    expect(a.normal.length).toBe(a.albedo.length);
    const b = paintFacades(SIZE);
    expect(Buffer.from(b.albedo).equals(Buffer.from(a.albedo))).toBe(true);
    expect(Buffer.from(b.normal).equals(Buffer.from(a.normal))).toBe(true);
  });

  it("gives every material but the plain one a pattern of its own", () => {
    for (let l = 1; l < FACADE_LAYERS; l++) {
      const off = l * SIZE * SIZE * 4;
      let lo = 255;
      let hi = 0;
      for (let i = 0; i < SIZE * SIZE; i++) {
        const y = a.albedo[off + i * 4 + 1];
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
      expect(hi - lo, `layer ${l}`).toBeGreaterThan(8);
    }
  });

  it("wraps every repeating tile without a seam", () => {
    for (let l = 0; l < FACADE_LAYERS; l++) {
      const layer = l as FacadeLayer;
      if (FACADE_TILE[layer].once) continue;
      // The tile's last column against its first: no worse a step than any
      // two neighbouring columns inside it.
      let edge = 0;
      let inner = 0;
      for (let k = 0; k < 64; k++) {
        const v = (k + 0.5) / 64;
        const lum = (u: number) => {
          const p = paintPixel(layer, u, v);
          return p.r + p.g + p.b;
        };
        edge += Math.abs(lum(0.999) - lum(0.001));
        inner += Math.abs(lum(0.501) - lum(0.499));
      }
      expect(edge, `layer ${l}`).toBeLessThan(inner + 64 * 0.6);
    }
  });

  it("keeps every roughness inside the material's range", () => {
    for (let l = 0; l < FACADE_LAYERS; l++) {
      const p = paintPixel(l as FacadeLayer, 0.37, 0.61);
      expect(p.rough).toBeGreaterThan(0.05);
      expect(p.rough).toBeLessThanOrEqual(1);
    }
  });
});

describe("the kit", () => {
  it("faces every side of a box and its roof out", () => {
    const kit = new FacadeKit().at(10, 0, -4, 0.7);
    kit.box(-2, 0, -3, 2, 3, 3, FACADE.boards, 0xffffff);
    kit.gableRoof(
      2,
      3,
      3,
      1.2,
      0.5,
      { layer: FACADE.roof, tint: 0xffffff },
      { layer: FACADE.boards, tint: 0xffffff },
      { layer: FACADE.plain, tint: 0x333333 },
      0.3,
    );
    const centre = kit.world([0, 2.5, 0]);
    const { pos, nrm } = kit.out;
    let out = 0;
    let all = 0;
    for (let t = 0; t < pos.length; t += 9) {
      const cx = (pos[t] + pos[t + 3] + pos[t + 6]) / 3 - centre[0];
      const cy = (pos[t + 1] + pos[t + 4] + pos[t + 7]) / 3 - centre[1];
      const cz = (pos[t + 2] + pos[t + 5] + pos[t + 8]) / 3 - centre[2];
      const d = cx * nrm[t] + cy * nrm[t + 1] + cz * nrm[t + 2];
      all++;
      if (d > 0) out++;
    }
    // The soffit and the snow's cut ends may lean either way of the
    // centre; everything else looks outward.
    expect(out / all).toBeGreaterThan(0.85);
  });

  it("lays a board wall's UVs in metres over the tile", () => {
    const kit = new FacadeKit();
    kit.wall(0, 0, 4.8, 0, 0, 2.4, FACADE.boards, 0xffffff);
    const us = kit.out.uv.filter((_, i) => i % 2 === 0);
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(4.8 / FACADE_TILE[FACADE.boards].u, 6);
  });
});

describe("the lift stations as built", () => {
  const level = LEVEL_SEEDS.map(levelFor).find((l) => liftPlans(l).length > 0)!;
  const plans = liftPlans(level);
  const kit = buildStationHouses(level, plans, layStations(level, plans));
  const { pos, uv, layer, col, glow, nrm } = kit.out;

  it("fills every attribute for every vertex", () => {
    const n = pos.length / 3;
    expect(n).toBeGreaterThan(0);
    expect(nrm.length).toBe(n * 3);
    expect(col.length).toBe(n * 3);
    expect(uv.length).toBe(n * 2);
    expect(layer.length).toBe(n);
    expect(glow.length).toBe(n);
    expect(layer.every((l) => Number.isInteger(l) && l >= 0 && l < FACADE_LAYERS)).toBe(true);
    expect(pos.every(Number.isFinite)).toBe(true);
  });

  it("stands each house on its footprint, down into the snow", () => {
    for (const p of plans) {
      for (const h of stationHouses(level, p)) {
        // The walls' foot is under the snow at every corner of the house.
        for (const a of [-1, 1]) {
          for (const b of [-1, 1]) {
            const x = h.x + p.dx * a * h.halfLength + p.dz * b * h.halfWidth;
            const z = h.z + p.dz * a * h.halfLength - p.dx * b * h.halfWidth;
            expect(h.base).toBeLessThan(level.groundAt(x, z));
          }
        }
      }
    }
  });

  it("keeps the whole resort's stations to a low-poly budget", () => {
    // A few hundred triangles a station end and its pieces.
    expect(kit.triangles / (plans.length * 2)).toBeLessThan(700);
  });
});
