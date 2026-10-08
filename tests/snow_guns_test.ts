// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW GUNS (`engine/game/snow-guns.ts`): out in a thin season on a dry
// day, on the windward edge past the groomed width, aimed so their cone lands
// on the run; solid to a skier; running — and laying machine snow the
// physics reads as loose — only on a run with the ski area's machines.

import { describe, expect, it } from "vitest";
import {
  createGame,
  gunSeason,
  machineSnowAt,
  nearestTrackPoint,
  trackPointAt,
  packedSnow,
  SNOW_GUN,
  snowGunsOf,
  snowGunsOut,
  snowGunsRun,
  solidsOf,
  withDay,
  withSky,
  type Level,
} from "@engine";

import { levelFor, LEVEL_SEEDS } from "./support/levels.ts";

const base = levelFor(LEVEL_SEEDS[1]);

/** How far (x, z) is off run `line`'s centreline, and its width there. */
function offRun(level: Level, line: number, x: number, z: number): { off: number; width: number } {
  const run = level.resort!.runs[line];
  const lone = { track: { points: run.points, length: run.length } };
  const hit = nearestTrackPoint(lone as never, x, z);
  return { off: hit.distance, width: trackPointAt(lone as never, hit.s).width };
}
/** The map on a day of the year, under a clear sky at mid-morning. */
const on = (dayOfYear: number, weather: "clear" | "snow" = "clear"): Level =>
  withSky(withDay(base, { dayOfYear, hour: 10 }), { weather });

describe("the seasons the guns stand in", () => {
  it("stands them early and late in the winter, never in midwinter", () => {
    expect(gunSeason(on(330))).toBe("early");
    expect(gunSeason(on(5))).toBe("early");
    expect(gunSeason(on(30))).toBeNull();
    expect(gunSeason(on(70))).toBe("late");
  });

  it("stands them down while it snows", () => {
    expect(snowGunsOut(on(349))).toBe(true);
    expect(snowGunsOut(on(349, "snow"))).toBe(false);
    expect(snowGunsOut(on(30))).toBe(false);
  });

  it("stops them under a spring noon's sun, never an early season's", () => {
    expect(snowGunsRun(on(349))).toBe(true);
    const noon = withSky(withDay(base, { dayOfYear: 115, hour: 12.5 }), { weather: "clear" });
    expect(snowGunsRun(noon)).toBe(false);
  });
});

describe("where the guns stand", () => {
  const level = on(349);
  const guns = snowGunsOf(level);

  it("puts out both kinds along a ski area's runs", () => {
    expect(guns.length).toBeGreaterThan(10);
    expect(guns.some((g) => g.mount === "lance")).toBe(true);
    expect(guns.some((g) => g.mount !== "lance")).toBe(true);
  });

  it("stands every one past the groomed width, never on the skiable snow", () => {
    for (const g of guns) {
      const { off, width } = offRun(level, g.line, g.x, g.z);
      expect(off).toBeGreaterThan(width / 2 + 1);
    }
  });

  it("aims every cone onto its own run", () => {
    for (const g of guns) {
      const { off, width } = offRun(level, g.line, g.land.x, g.land.z);
      expect(off).toBeLessThan(width / 2 + 2);
    }
  });

  it("keeps guns apart and is the same map twice", () => {
    for (let i = 0; i < guns.length; i++) {
      for (let j = i + 1; j < guns.length; j++) {
        expect(Math.hypot(guns[i].x - guns[j].x, guns[i].z - guns[j].z)).toBeGreaterThanOrEqual(
          SNOW_GUN.clear.gun,
        );
      }
    }
    const again = snowGunsOf(on(349));
    expect(again.map((g) => [g.x, g.z, g.mount])).toEqual(guns.map((g) => [g.x, g.z, g.mount]));
  });

  it("makes a standing gun solid, and none in midwinter", () => {
    const early = solidsOf(level).length;
    const mid = solidsOf(on(30)).length;
    expect(early - mid).toBe(guns.length);
  });
});

describe("the machine snow", () => {
  it("is laid on a free ride when the guns run, and nowhere else", () => {
    const level = on(349);
    expect(createGame({ level, mode: "free", crowd: 0, quiet: true }).machineSnow).toBeDefined();
    expect(createGame({ level, mode: "timeTrial", quiet: true }).machineSnow).toBeUndefined();
    expect(
      createGame({ level: on(30), mode: "free", crowd: 0, quiet: true }).machineSnow,
    ).toBeUndefined();
  });

  it("reads as loose snow where a whale lies", () => {
    const level = on(349);
    const state = createGame({ level, mode: "free", crowd: 0, quiet: true });
    const snow = state.machineSnow!;
    const w = snow.whales[0];
    expect(machineSnowAt(snow, w.x, w.z)).toBeCloseTo(w.h, 5);
    expect(machineSnowAt(snow, w.x + w.ux * w.a * 1.1, w.z + w.uz * w.a * 1.1)).toBe(0);
    const bare = { ...state, machineSnow: undefined };
    expect(packedSnow(state, w.x, w.z)).toBeLessThan(packedSnow(bare, w.x, w.z) + 1e-9);
    expect(packedSnow(state, w.x, w.z)).toBe(0);
  });
});
