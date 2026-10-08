// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI AREA'S OWN BUILDINGS AS BUILT (`village-build.ts`,
// `mountain-build.ts`, `docs/buildings.md`): every kind the engine stands
// (`resort-buildings.ts`) is drawn, every attribute filled, each building
// on its own footprint — down into the snow under it, no further out than
// its roof, its terrace and the furniture round it, no higher than its
// ridge and a mast — and to a low-poly budget.

import { describe, expect, it } from "vitest";

import { CABINS, cabinsOf, resortBuildingsOf, type Cabin } from "@engine";
import { FacadeKit } from "../pwa/src/game/facade-kit.ts";
import { FACADE_LAYERS } from "../pwa/src/game/facade-paint.ts";
import { buildResortBuilding, buildResortBuildings } from "../pwa/src/game/village-build.ts";
import { TOWER } from "../pwa/src/game/village-town.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

/** How far past its roof's or terrace's reach the furniture round a
 * building may stand (a rack, the flags, a tank), m; how far over its
 * ridge a chimney or a mast may rise. */
const AROUND = 6;
const ABOVE = 7.5;
/** The church's spire stands over its nave's ridge, as far as a spire's
 * point does (`village-town.ts`'s `TOWER`), its cross on it. */
const SPIRE = TOWER.spire + 2;

/** The most triangles any one building of a kind is drawn with. */
const BUDGET = 4000;

describe("the ski area's buildings as built", () => {
  const level = LEVEL_SEEDS.map(levelFor).find((l) => resortBuildingsOf(cabinsOf(l)).length > 6)!;
  const buildings = resortBuildingsOf(cabinsOf(level));
  const one = (c: Cabin) => {
    const kit = new FacadeKit();
    buildResortBuilding(kit, level, c);
    return kit;
  };

  it("draws every building the map stands, every attribute filled", () => {
    const { pos, nrm, col, uv, layer, glow } = buildResortBuildings(level).out;
    const n = pos.length / 3;
    expect(n).toBeGreaterThan(0);
    expect(nrm.length).toBe(n * 3);
    expect(col.length).toBe(n * 3);
    expect(uv.length).toBe(n * 2);
    expect(layer.length).toBe(n);
    expect(glow.length).toBe(n);
    expect(layer.every((l) => Number.isInteger(l) && l >= 0 && l < FACADE_LAYERS)).toBe(true);
    expect(pos.every(Number.isFinite)).toBe(true);
    expect(uv.every(Number.isFinite)).toBe(true);
    for (const c of buildings) expect(one(c).triangles, c.kind).toBeGreaterThan(40);
  });

  it("stands each on its footprint, down into the snow, under its ridge", () => {
    for (const c of buildings) {
      const d = CABINS[c.kind];
      const { pos } = one(c).out;
      const fx = Math.sin(c.heading);
      const fz = Math.cos(c.heading);
      let low = Infinity;
      for (let i = 0; i < pos.length; i += 3) {
        const dx = pos[i] - c.x;
        const dz = pos[i + 2] - c.z;
        // Into the building's frame: x across its front, z out of it.
        const lx = dx * fz - dz * fx;
        const lz = dx * fx + dz * fz;
        expect(Math.abs(lx), c.kind).toBeLessThan(d.width / 2 + d.reach.side + AROUND);
        expect(lz, c.kind).toBeLessThan(d.depth / 2 + d.reach.front + AROUND);
        expect(lz, c.kind).toBeGreaterThan(-d.depth / 2 - d.reach.back - AROUND);
        const top = c.kind === "church" ? SPIRE : d.ridge + ABOVE;
        expect(pos[i + 1] - c.y, c.kind).toBeLessThan(top);
        low = Math.min(low, pos[i + 1]);
      }
      // The plinth runs down past the lowest snow under the walls.
      expect(low, c.kind).toBeLessThan(c.base);
    }
  });

  it("keeps every building to a low-poly budget", () => {
    for (const c of buildings) expect(one(c).triangles, c.kind).toBeLessThan(BUDGET);
  });
});
