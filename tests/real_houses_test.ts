// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL HOUSES OF A REAL FACE (`real-houses.ts`): a map raised on a
// real face stands its buildings where the real valley's houses stand —
// at a real house, turned along it, never on a run or in the hub — and a
// dealt map places exactly what it placed before.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { beforeAll, describe, expect, it } from "vitest";

import {
  REAL_HOUSES,
  REAL_RUN,
  bearingsOf,
  cabinsOf,
  felledTrees,
  generateLevel,
  kindOfSize,
  loadRealFace,
  nearestWithin,
  outsideHub,
  realHouseNear,
  realHousesOf,
  turnOff,
  type Level,
} from "@engine";
import { levelFor } from "./support/levels.ts";

let fell: Level | undefined;
const fellLevel = (): Level => (fell ??= generateLevel(1, { face: "fell-2" }));

describe("a real face's houses", () => {
  beforeAll(() => loadRealFace("fell-2"));

  it("are stood at real houses, turned along them, off every run and the hub", () => {
    const level = fellLevel();
    const real = cabinsOf(level).filter((c) => c.run === REAL_RUN);
    expect(real.length).toBeGreaterThan(20);
    expect(real.length).toBeLessThanOrEqual(REAL_HOUSES.most);
    const hit = { index: 0, s: 0, distance: Infinity, lateral: 0, x: 0, z: 0 };
    const hub = level.resort!.hub!;
    for (const c of real) {
      // At a real house: on its middle or a nudge off it, turned along it.
      const h = realHouseNear(level, c.x, c.z, 9)!;
      expect(h, c.id).not.toBeNull();
      expect(kindOfSize(h.size), c.id).toBe(c.kind);
      expect(bearingsOf(c.kind, h, c.heading).some((b) => turnOff(b, c.heading) < 1e-6)).toBe(true);
      // Off every run's snow and line, and out of the hub.
      expect(level.packedAt(c.x, c.z), c.id).toBeLessThan(0.25);
      for (const r of level.resort!.runs) {
        nearestWithin({ track: r }, c.x, c.z, 60, hit);
        if (hit.distance === Infinity) continue;
        expect(hit.distance - r.points[hit.index].width / 2, `${c.id} ${r.id}`).toBeGreaterThan(2);
      }
      expect(outsideHub(hub, c.x, c.z), c.id).toBeGreaterThan(0);
    }
    // Their yards are cleared: no trunk standing inside a real house's walls.
    const gone = felledTrees(level);
    for (const c of real) {
      for (let i = 0; i < level.trees.length; i++) {
        const t = level.trees[i];
        if (gone[i] || hypot(t.x - c.x, t.z - c.z) > 4) continue;
        throw new Error(`a trunk stands in ${c.id}`);
      }
    }
  });

  it("leave a dealt map's buildings as they were", () => {
    const level = levelFor(1);
    expect(realHousesOf(level)).toHaveLength(0);
    const cabins = cabinsOf(level);
    expect(cabins.some((c) => c.run === REAL_RUN)).toBe(false);
    // The buildings this seed stood before the real houses were added.
    let h = 2166136261;
    for (const c of cabins) {
      for (const v of [c.x, c.z, c.heading]) h = Math.imul(h ^ Math.round(v * 100), 16777619);
    }
    expect({ n: cabins.length, hash: h >>> 0 }).toEqual({ n: 53, hash: 2609318253 });
  });
});
