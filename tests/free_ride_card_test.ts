// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE AS THE APP ASKS FOR ONE — every rule behind the start card
// that can be read without a browser: what a stored ride reads back as
// (`free-ride.ts`), the options a ride is stood up with, the rows' readings,
// the chart's one mapping to the snow and back (`seed-chart.ts`), the URL
// that boots one (`url-params.ts`), and the HUD's and the minimap's free
// ride (`snapshot.ts`, `minimap-view.ts`).

import { describe, expect, it } from "vitest";

import {
  SKIS,
  createGame,
  generateLevel,
  NEUTRAL_INPUT,
  SNOW_DIAL,
  snowCoverOf,
  step,
} from "@engine";

import {
  SEASONS,
  SNOW_STOPS,
  depthOf,
  freeGameOptions,
  freshRide,
  mergeRide,
  spotOn,
} from "../pwa/src/game/free-ride.ts";
import { CHART_VIEW, fromChart, seedSchematic, toChart } from "../pwa/src/game/seed-chart.ts";
import { freshSettings, mergeSettings } from "../pwa/src/game/settings.ts";
import { takeSnapshot } from "../pwa/src/game/snapshot.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { readParams } from "../pwa/src/game/url-params.ts";
import { syntheticLevel } from "./support/synthetic.ts";

describe("what the start card remembers (free-ride.ts, settings.ts)", () => {
  it("defers every day row to the map on a first visit", () => {
    const ride = freshSettings().ride;
    expect(ride).toEqual({
      seed: null,
      season: null,
      time: null,
      snow: "medium",
      spot: null,
      weather: null,
      region: "alpine",
      grade: null,
    });
  });

  it("reads an older blob with no ride in it as a fresh one", () => {
    expect(mergeSettings({ camera: "tips" }).ride).toEqual(freshRide());
  });

  it("checks every field of a stored ride on its own", () => {
    const ride = mergeRide({
      seed: 42,
      season: "late",
      time: "night",
      snow: "deep",
      spot: { seed: 42, x: 100, z: 200 },
    });
    expect(ride.seed).toBe(42);
    expect(ride.season).toBe("late");
    expect(ride.time).toBe("night");
    expect(ride.snow).toBe("deep");
    expect(ride.spot).toEqual({ seed: 42, x: 100, z: 200 });
    const junk = mergeRide({ seed: -3, season: "summer", time: 11, snow: "slush", spot: { x: 1 } });
    expect(junk.seed).toBeNull();
    expect(junk.season).toBeNull();
    expect(junk.time).toBeNull();
    expect(junk.snow).toBe("medium");
    expect(junk.spot).toBeNull();
    expect(mergeRide("nonsense")).toEqual(freshRide());
    expect(mergeRide({ weather: "snow" }).weather).toBe("snow");
    expect(mergeRide({ weather: "hail" }).weather).toBeNull();
    // THE GRADE (R23): one of the four, or the seed's own.
    expect(mergeRide({ grade: "black" }).grade).toBe("black");
    expect(mergeRide({ grade: "orange" }).grade).toBeNull();
  });

  it("reads the faders' blob onto the nearest snow and hands the day back to the map", () => {
    // A dial of 2 is 80 cm of loose snow: nearest THICK's 70.
    const old = mergeRide({ seed: 5, day: 40, hour: 11, depth: 2 });
    expect(old.snow).toBe("thick");
    expect(mergeRide({ depth: 2.5 }).snow).toBe("deep");
    expect(old.season).toBeNull();
    expect(old.time).toBeNull();
    expect(mergeRide({ depth: 0.25 }).snow).toBe("thin");
    expect(mergeRide({ depth: 1 }).snow).toBe("medium");
  });

  it("keeps a spot only on the seed it was picked on", () => {
    const ride = { ...freshRide(), spot: { seed: 7, x: 10, z: 20 } };
    expect(spotOn(ride, 7)).toEqual({ x: 10, z: 20 });
    expect(spotOn(ride, 8)).toBeNull();
  });

  it("stands a ride up as a free run on the card's answers", () => {
    const ride = {
      seed: 9,
      season: "late" as const,
      time: "morning" as const,
      snow: "thick" as const,
      spot: { seed: 9, x: 400, z: 200 },
      weather: "fog" as const,
      region: "fell" as const,
      grade: "black" as const,
    };
    const opts = freeGameOptions(ride, 9, SKIS, { yaw: 1, air: 1 });
    expect(opts.mode).toBe("free");
    // The GRADE row's colour (R23), and the seed's own where it stands on
    // AS DEALT.
    expect(opts.grade).toBe("black");
    expect(freeGameOptions({ ...ride, grade: null }, 9, SKIS, { yaw: 1, air: 1 }).grade).toBe(
      undefined,
    );
    expect(opts.seed).toBe(9);
    expect(opts.snowDepth).toBe(depthOf("thick"));
    expect(opts.day).toEqual({ time: "morning", dayOfYear: 56 });
    expect(opts.spawn).toEqual({ x: 400, z: 200 });
    // The weather row names the sky and never an hour: the hour is the day's.
    expect(opts.sky).toEqual({ weather: "fog" });
    expect(freeGameOptions({ ...ride, weather: null }, 9, SKIS, { yaw: 1, air: 1 }).sky).toBe(
      undefined,
    );
    const state = createGame({ ...opts, level: syntheticLevel(), quiet: true });
    expect(state.level.weather?.kind).toBe("fog");
    expect(state.rules.course).toBe(false);
    expect(state.snowDepth).toBe(depthOf("thick"));
    expect(state.level.sun.dayOfYear).toBe(56);
    expect(freeGameOptions(ride, 10, SKIS, { yaw: 1, air: 1 }).spawn).toBeUndefined();
  });
});

describe("what the rows ask for", () => {
  it("lays the loose snow as deep as each snow stop says, MEDIUM the race's own", () => {
    for (const stop of SNOW_STOPS) {
      expect(snowCoverOf(depthOf(stop.id)) * 100).toBeCloseTo(stop.cm, 6);
      expect(depthOf(stop.id)).toBeGreaterThanOrEqual(SNOW_DIAL.min);
      expect(depthOf(stop.id)).toBeLessThanOrEqual(SNOW_DIAL.max);
    }
    expect(SNOW_STOPS.map((s) => s.cm)).toEqual([20, 40, 70, 100]);
    // The deepest stop is the dial's deepest, and a metre of snow.
    expect(depthOf("deep")).toBeCloseTo(SNOW_DIAL.max, 9);
    expect(depthOf("medium")).toBeCloseTo(1, 9);
    // The row's hint states every stop's depth.
    for (const stop of SNOW_STOPS) expect(STRINGS.startSnowHint).toContain(`${stop.cm} cm`);
  });

  it("puts the seasons in winter's order, December to April", () => {
    const days = SEASONS.map((s) => s.day);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(days[0]).toBeLessThan(0);
    expect(days[days.length - 1]).toBeLessThanOrEqual(105);
  });
});

describe("the chart (seed-chart.ts)", () => {
  it("is north-up, and a point goes to the chart and back", () => {
    expect(toChart(1000, 0, 0)).toEqual([0, CHART_VIEW]);
    expect(toChart(1000, 1000, 1000)).toEqual([CHART_VIEW, 0]);
    const back = fromChart(1600, ...toChart(1600, 420, 1210));
    expect(back.x).toBeCloseTo(420);
    expect(back.z).toBeCloseTo(1210);
  });

  it("holds a point off the chart on the map", () => {
    expect(fromChart(1000, -10, 150)).toEqual({ x: 0, z: 0 });
  });

  it("marks every kicker and the grid of a generated map", () => {
    const level = generateLevel(38);
    const chart = seedSchematic(level);
    expect(chart.size).toBe(level.size);
    expect(chart.kickers).toHaveLength(level.kickers.length);
    expect(chart.kickers.some((k) => !k.onTrack)).toBe(level.kickers.some((k) => !k.onTrack));
    for (const k of chart.kickers) {
      expect(k.x).toBeGreaterThanOrEqual(0);
      expect(k.x).toBeLessThanOrEqual(CHART_VIEW);
      expect(k.y).toBeGreaterThanOrEqual(0);
      expect(k.y).toBeLessThanOrEqual(CHART_VIEW);
    }
    // An open path: the start line first, the finish last, nothing closed.
    expect(chart.track.startsWith("M")).toBe(true);
    expect(chart.track.includes("Z")).toBe(false);
    const pts = level.track.points;
    const [ex, ey] = toChart(level.size, pts[pts.length - 1].x, pts[pts.length - 1].z);
    expect(chart.track.endsWith(`L${ex.toFixed(1)} ${ey.toFixed(1)}`)).toBe(true);
    const [gx, gy] = toChart(level.size, level.grid[0].x, level.grid[0].z);
    expect(chart.grid.x).toBeCloseTo(gx);
    expect(chart.grid.y).toBeCloseTo(gy);
  });
});

describe("the URL (url-params.ts)", () => {
  it("boots a free ride off ?start=free", () => {
    const p = readParams("?start=free&seed=12");
    expect(p.rides).toBe(true);
    expect(p.free).toBe(true);
    expect(p.seed).toBe(12);
    expect(readParams("?start=race").free).toBe(false);
  });

  it("opens the start card off ?menu=start", () => {
    const p = readParams("?menu=start");
    expect(p.menu).toBe(true);
    expect(p.page).toBe("start");
  });
});

describe("the HUD over a free ride (snapshot.ts, minimap-view.ts)", () => {
  it("reads the best air and the distance, and puts no checkpoint on the plate", () => {
    const state = createGame({ level: syntheticLevel(), mode: "free", quiet: true });
    for (let i = 0; i < 360; i++) step(state, { ...NEUTRAL_INPUT, tuck: 1 });
    const snap = takeSnapshot(state);
    expect(snap.free).toBe(true);
    expect(snap.distance).toBe(state.progress.distance);
    expect(snap.distance).toBeGreaterThan(0);
    expect(snap.bestAir).toBe(state.progress.bestAir);
    expect(snap.missed).toBeNull();
    expect(snap.split).toBeNull();
    expect(snap.minimap.checkpoints).toHaveLength(0);
    expect(snap.minimap.chevron).toBeNull();
  });

  it("a race still reads its course", () => {
    const state = createGame({ level: syntheticLevel(), rivals: 0, quiet: true });
    const snap = takeSnapshot(state);
    expect(snap.free).toBe(false);
    expect(snap.minimap.checkpoints.length).toBe(state.level.checkpoints.length);
  });
});
