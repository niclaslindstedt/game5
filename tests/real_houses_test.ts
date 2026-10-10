// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL HOUSES OF A REAL FACE (`real-houses.ts`): a map raised on a
// real face stands its buildings where the real valley's houses stand —
// at a real house, turned along it, never on a run or in the hub — and
// lays its village's streets along the real town's (`real-streets.ts`);
// a dealt map places and lays exactly what it did before.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { beforeAll, describe, expect, it } from "vitest";

import {
  REAL_HOUSES,
  REAL_RUN,
  REAL_STREETS,
  bearingsOf,
  cabinsOf,
  felledTrees,
  generateLevel,
  inFrame,
  kindOfSize,
  loadRealFace,
  nearestWithin,
  outsideHub,
  realCrosses,
  realExit,
  realHouseNear,
  realHousesOf,
  realProfile,
  realTownOf,
  realWeight,
  townLines,
  turnOff,
  villageOf,
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
      // (Its own house is within a nudge; a neighbour may stand nearer.)
      expect(realHouseNear(level, c.x, c.z, 9), c.id).not.toBeNull();
      const own = realHousesOf(level).filter(
        (h) =>
          hypot(h.x - c.x, h.z - c.z) < 9 &&
          kindOfSize(h.size) === c.kind &&
          bearingsOf(c.kind, h, c.heading).some((b) => turnOff(b, c.heading) < 1e-6),
      );
      expect(own.length, c.id).toBeGreaterThan(0);
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

describe("a real face's town", () => {
  beforeAll(() => loadRealFace("fell-2"));

  it("is read off the hints, and a dealt map has none", () => {
    expect(realTownOf(fellLevel())?.streets.length).toBeGreaterThanOrEqual(REAL_STREETS.least);
    expect(realTownOf(levelFor(1))).toBeNull();
  });

  it("lays the village's town streets along the real ones, clear of the runs and the hub", () => {
    const level = fellLevel();
    const v = villageOf(level)!;
    expect(v, "a village on fell-2").not.toBeNull();
    const town = v.streets.filter((s) => s.kind === "town");
    expect(town.length).toBeGreaterThan(5);
    expect(town.length).toBeLessThanOrEqual(REAL_STREETS.town.most);
    const real = realTownOf(level)!.streets;
    // How far a point is from the nearest real street, m.
    const off = (x: number, z: number) => {
      let best = Infinity;
      for (const st of real) {
        for (let i = 1; i < st.points.length; i++) {
          const [a, b] = [st.points[i - 1], st.points[i]];
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const t = Math.max(
            0,
            Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)),
          );
          best = Math.min(best, hypot(a.x + dx * t - x, a.z + dz * t - z));
        }
      }
      return best;
    };
    const hub = level.resort!.hub!;
    const hit = { index: 0, s: 0, distance: Infinity, lateral: 0, x: 0, z: 0 };
    for (const st of town) {
      expect(st.length, st.id).toBeGreaterThanOrEqual(REAL_STREETS.town.shortest - 4);
      const j0 = v.junctions[st.from];
      const j1 = v.junctions[st.to];
      expect(j0.streets).toContain(st.id);
      expect(j1.streets).toContain(st.id);
      for (const p of st.points) {
        expect(off(p.x, p.z), st.id).toBeLessThan(3);
        expect(outsideHub(hub, p.x, p.z), st.id).toBeGreaterThan(0);
        for (const r of level.resort!.runs) {
          nearestWithin({ track: r }, p.x, p.z, 60, hit);
          if (hit.distance === Infinity) continue;
          expect(hit.distance - r.points[hit.index].width / 2, `${st.id} ${r.id}`).toBeGreaterThan(
            5,
          );
        }
      }
    }
  });

  it("leaves a dealt map's village as it was", () => {
    const v = villageOf(levelFor(1))!;
    expect(v.streets.some((s) => s.kind === "town")).toBe(false);
    let h = 2166136261;
    for (const st of v.streets) {
      for (const p of st.points) {
        for (const q of [p.x, p.z]) h = Math.imul(h ^ Math.round(q * 100), 16777619);
      }
    }
    expect({ n: v.streets.length, hash: h >>> 0 }).toEqual({ n: 13, hash: 439075045 });
  });
});

describe("the real town read in the village's frame", () => {
  // A main road along the valley 60 m out of the hub with a dip in it, a
  // street behind it 120 m out, two streets across between them, one of
  // them on to the valley's edge.
  const streets = [
    {
      main: true,
      points: [
        { x: 0, z: 1060 },
        { x: 200, z: 1070 },
        { x: 400, z: 1050 },
      ],
    },
    {
      main: false,
      points: [
        { x: 0, z: 1120 },
        { x: 400, z: 1125 },
      ],
    },
    {
      main: false,
      points: [
        { x: 150, z: 1040 },
        { x: 155, z: 1140 },
      ],
    },
    {
      main: true,
      points: [
        { x: 300, z: 1040 },
        { x: 310, z: 1290 },
      ],
    },
  ];
  const segs = inFrame(streets, 1000, 1);

  it("follows the real main road and the real street behind it", () => {
    const main = realProfile(
      segs,
      0,
      400,
      () => 34,
      () => 90,
      0.45,
    )!;
    expect(main).not.toBeNull();
    expect(main(200)).toBeGreaterThan(62);
    expect(main(200)).toBeLessThan(70);
    expect(main(0)).toBeGreaterThan(55);
    const back = realProfile(
      segs,
      0,
      400,
      (x) => main(x) + 40,
      (x) => main(x) + 100,
      0.45,
    )!;
    expect(back(200)).toBeGreaterThan(118);
    expect(back(200)).toBeLessThan(126);
    // Nothing runs along the valley in a band with no street in it.
    expect(
      realProfile(
        segs,
        0,
        400,
        () => 150,
        () => 200,
        0.45,
      ),
    ).toBeNull();
  });

  it("crosses where real streets cross, the main road first, and leaves by the road out", () => {
    const xs = realCrosses(
      segs,
      0,
      400,
      () => 60,
      () => 120,
    );
    expect(xs).toHaveLength(2);
    expect(Math.abs(xs[0] - 302)).toBeLessThan(3);
    expect(Math.abs(xs[1] - 152)).toBeLessThan(3);
    expect(realExit(segs, 0, 400, 300)).toEqual({ end: 1, x: 310 });
    expect(realWeight(segs, 0, 400, 200)).toBeGreaterThan(realWeight(segs, 0, 200, 200));
  });

  it("lays the town's other streets a stretch at a time, off what is laid", () => {
    const laid: { main: boolean; points: { x: number; z: number }[] }[] = [];
    townLines(
      { town: { x: 200, z: 1080, r: 300 }, streets },
      { x: 200, z: 1080 },
      4,
      // A wall across x = 230..250 cuts the streets running along the valley.
      (x) => x < 230 || x > 250,
      (main, points) => {
        laid.push({ main, points });
        return true;
      },
    );
    // The main roads first, the one across whole and the one along cut in two.
    expect(laid[0].main).toBe(true);
    expect(laid.filter((l) => l.main)).toHaveLength(3);
    for (const l of laid) for (const p of l.points) expect(p.x < 230 || p.x > 250).toBe(true);
  });
});
