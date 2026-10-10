// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// LAKE ICE AND THE WATER'S PLAN: when a body of water is open, freezing,
// frozen or breaking up (`engine/game/lake-ice.ts`), and the plan the
// renderer draws it off (`pwa/src/game/water-plan.ts`) — the look a state
// is given, whether it shows at all, the shore map.

import { describe, expect, it } from "vitest";

import { airOn, bodyState, waterOn, type Level, type WaterBody } from "@engine";
import { lookOf, planWater, ringArea, shoreMap, showsAt } from "../pwa/src/game/water-plan.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** A day of the year from a month and a day of it (not a leap year). */
const MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const on = (month: number, day: number): number => MONTH[month - 1] + day;

describe("lake ice", () => {
  it("is colder high up and in midwinter", () => {
    expect(airOn(on(1, 20), 46, 2000, "alpine")).toBeLessThan(airOn(on(1, 20), 46, 500, "alpine"));
    expect(airOn(on(1, 20), 46, 800, "alpine")).toBeLessThan(airOn(on(7, 20), 46, 800, "alpine"));
    // The south's winter is the north's summer.
    expect(airOn(on(7, 20), -45, 800, "alpine")).toBeLessThan(airOn(on(1, 20), -45, 800, "alpine"));
  });

  it("holds a northern lake frozen from November to May", () => {
    const lake = (d: number) => waterOn(d, 63.4, 380, 8e6, false, "fell");
    for (const d of [on(12, 1), on(1, 15), on(3, 1), on(4, 15)])
      expect(lake(d).phase).toBe("frozen");
    expect(lake(on(3, 15)).ice).toBeGreaterThan(0.4);
    expect(lake(on(3, 15)).snow).toBeGreaterThan(0.9);
    expect(lake(on(8, 1)).phase).toBe("open");
  });

  it("opens an alpine valley lake by April but keeps a high tarn shut", () => {
    expect(waterOn(on(1, 30), 46, 800, 5e5, false, "alpine").phase).toBe("frozen");
    expect(waterOn(on(4, 15), 46, 800, 5e5, false, "alpine").phase).toBe("open");
    expect(waterOn(on(4, 15), 46, 2300, 5e4, false, "alpine").phase).toBe("frozen");
    const june = waterOn(on(6, 5), 46, 2300, 5e4, false, "alpine");
    expect(["thawing", "open"]).toContain(june.phase);
  });

  it("never freezes a great low lake", () => {
    for (let d = 0; d < 365; d += 15)
      expect(waterOn(d, 46, 370, 5e8, false, "alpine").phase).toBe("open");
  });

  it("closes a small pond before a big lake, and a lake before a river", () => {
    const firstFrozen = (area: number, running: boolean): number => {
      for (let d = 300; d < 500; d++) {
        if (waterOn(d, 63.4, 380, area, running, "fell").phase === "frozen") return d;
      }
      return Infinity;
    };
    expect(firstFrozen(2e4, false)).toBeLessThan(firstFrozen(8e7, false));
    expect(firstFrozen(2e5, false)).toBeLessThan(firstFrozen(2e5, true));
  });

  it("breaks up with a moat along the shore and rotten ice", () => {
    let seen = false;
    for (let d = on(4, 1); d < on(7, 1); d++) {
      const s = waterOn(d, 46, 2300, 5e4, false, "alpine");
      if (s.phase !== "thawing") continue;
      expect(s.moat).toBeGreaterThan(0);
      expect(s.rot).toBeGreaterThan(0);
      seen = true;
    }
    expect(seen).toBe(true);
  });

  it("is a pure function of the day", () => {
    expect(waterOn(400, 63, 500, 1e6, false, "fell")).toEqual(
      waterOn(400, 63, 500, 1e6, false, "fell"),
    );
    // Folded: a day a year on is the same day.
    expect(waterOn(40, 63, 500, 1e6, false, "fell")).toEqual(
      waterOn(405, 63, 500, 1e6, false, "fell"),
    );
  });
});

/** A square pond, `half` m either side of (x, z), counter-clockwise. */
function pond(x: number, z: number, half: number, y: number, realLevel: number): WaterBody {
  const ring = new Float32Array([
    x - half,
    z - half,
    x + half,
    z - half,
    x + half,
    z + half,
    x - half,
    z + half,
  ]);
  return { kind: "pond", rings: [ring], y, realLevel, area: ringArea(ring) };
}

function wet(day: number, realLevel: number): Level {
  const level = syntheticLevel({ noTrees: true });
  const y = level.groundAt(600, 600);
  return {
    ...level,
    sun: { ...level.sun, dayOfYear: day, latitude: 46 },
    water: [pond(600, 600, 60, y, realLevel)],
  };
}

describe("the water's plan", () => {
  it("has none on a dry map", () => {
    expect(planWater(syntheticLevel({ noTrees: true }))).toBeNull();
  });

  it("reads a body's state off its real height", () => {
    const level = wet(on(1, 20), 800);
    expect(bodyState(level, level.water![0]).phase).toBe("frozen");
    const summer = wet(on(7, 20), 800);
    expect(bodyState(summer, summer.water![0]).phase).toBe("open");
  });

  it("gives the ice the reach the state asks", () => {
    const open = lookOf(waterOn(on(7, 20), 46, 800, 1e4, false, "alpine"), 0);
    expect(open.ice[0]).toBeLessThan(0);
    expect(open.ice[1]).toBeGreaterThan(1000);
    const frozen = lookOf(waterOn(on(1, 30), 46, 800, 1e4, false, "alpine"), 0);
    expect(frozen.ice[0]).toBeGreaterThan(1000);
  });

  it("hides a cover wholly snowed over and shows the rest", () => {
    const snowed = lookOf(waterOn(on(2, 15), 63, 380, 1e6, false, "fell"), 0);
    expect(snowed.state.snow).toBeGreaterThan(0.999);
    expect(showsAt(snowed)).toBe(false);
    expect(showsAt(lookOf(waterOn(on(7, 20), 46, 800, 1e4, false, "alpine"), 0))).toBe(true);
    expect(planWater(wet(on(2, 15), 1500))!.shows).toBe(false);
    expect(planWater(wet(on(7, 20), 800))!.shows).toBe(true);
  });

  it("maps the distance to the shore inside each body", () => {
    const level = wet(on(7, 20), 800);
    const map = shoreMap(level, level.water!);
    const at = (x: number, z: number): number => {
      const c = Math.round((x - map.originX) / map.cell);
      const r = Math.round((z - map.originZ) / map.cell);
      return map.data[r * map.cols + c];
    };
    expect(at(600, 600)).toBeGreaterThan(at(600 + 50, 600));
    expect(at(600 + 50, 600)).toBeGreaterThan(0);
    expect(at(600 + 62, 600)).toBe(0);
  });
});
