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
  lastPiste,
  freeRunOf,
  freeRuns,
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
  freeAgainOptions,
  freeGameOptions,
  freeRunList,
  freeTopOptions,
  freshRide,
  HELI_RUN,
  heliOn,
  markedRun,
  mergeRide,
  runOn,
  spotOn,
} from "../pwa/src/game/free-ride.ts";
import {
  CHART_VIEW,
  chartAngle,
  degrees,
  fromChart,
  seedSchematic,
  toChart,
} from "../pwa/src/game/seed-chart.ts";
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
      run: null,
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

  it("keeps a run only on the seed and in the country it was picked on", () => {
    const ride = { ...freshRide(), run: { seed: 7, region: "alpine" as const, id: "3" } };
    expect(runOn(ride, 7)).toBe("3");
    expect(runOn(ride, 8)).toBeNull();
    expect(runOn({ ...ride, region: "fell" }, 7)).toBeNull();
    expect(mergeRide(JSON.parse(JSON.stringify(ride))).run).toEqual(ride.run);
    expect(mergeRide({ run: { seed: 7, region: "mars", id: "3" } }).run).toBeNull();
  });

  it("marks the run the engine rides: the one picked, else the first of the colour, else the map's", () => {
    const level = generateLevel(1);
    const list = freeRunList(level);
    expect(list.runs.map((r) => r.id)).toEqual(freeRuns(level).map((r) => r.id));
    for (const r of list.runs) {
      expect(r.vertical).toBeGreaterThan(0);
      expect(r.number).toMatch(/^\d+$/);
    }
    const ride = freshRide();
    for (const grade of [null, "green", "blue", "red", "black"] as const) {
      const marked = markedRun({ ...ride, grade }, 1, list);
      expect(marked?.id).toBe(freeRunOf(level, { grade: grade ?? undefined }));
    }
    const pick = list.runs[list.runs.length - 1];
    const picked = {
      ...ride,
      grade: "green" as const,
      run: { seed: 1, region: ride.region, id: pick.id },
    };
    expect(markedRun(picked, 1, list)?.id).toBe(pick.id);
    expect(markedRun(picked, 2, list)?.id).toBe(freeRunOf(level, { grade: "green" }));
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
      run: { seed: 9, region: "fell" as const, id: "4" },
    };
    const opts = freeGameOptions(ride, 9, { spec: SKIS, assist: { yaw: 1, air: 1 } });
    expect(opts.mode).toBe("free");
    // The GRADE row's colour (R23), and the seed's own where it stands on
    // AS DEALT.
    expect(opts.grade).toBe("black");
    expect(
      freeGameOptions({ ...ride, grade: null }, 9, { spec: SKIS, assist: { yaw: 1, air: 1 } })
        .grade,
    ).toBe(undefined);
    expect(opts.seed).toBe(9);
    expect(opts.snowDepth).toBe(depthOf("thick"));
    expect(opts.day).toEqual({ time: "morning", dayOfYear: 56 });
    expect(opts.spawn).toEqual({ x: 400, z: 200 });
    // The RUN row's run, on the map it was picked on and no other.
    expect(opts.run).toBe("4");
    expect(freeGameOptions(ride, 10, { spec: SKIS, assist: { yaw: 1, air: 1 } }).run).toBe(
      undefined,
    );
    expect(
      freeGameOptions({ ...ride, region: "alpine" }, 9, { spec: SKIS, assist: { yaw: 1, air: 1 } })
        .run,
    ).toBe(undefined);
    // A spot picked is where the ride starts — no chair up to its run's top;
    // with none (or one picked on another seed) the ride arrives by chair.
    expect(opts.byLift).toBe(false);
    expect(
      freeGameOptions({ ...ride, spot: null }, 9, { spec: SKIS, assist: { yaw: 1, air: 1 } })
        .byLift,
    ).toBe(true);
    expect(freeGameOptions(ride, 10, { spec: SKIS, assist: { yaw: 1, air: 1 } }).byLift).toBe(true);
    // The weather row names the sky and never an hour: the hour is the day's.
    expect(opts.sky).toEqual({ weather: "fog" });
    expect(
      freeGameOptions({ ...ride, weather: null }, 9, { spec: SKIS, assist: { yaw: 1, air: 1 } })
        .sky,
    ).toBe(undefined);
    const state = createGame({ ...opts, level: syntheticLevel(), quiet: true });
    expect(state.level.weather?.kind).toBe("fog");
    expect(state.rules.course).toBe(false);
    expect(state.snowDepth).toBe(depthOf("thick"));
    expect(state.level.sun.dayOfYear).toBe(56);
    expect(state.skier.lift).toBeNull();
    expect(
      freeGameOptions(ride, 10, { spec: SKIS, assist: { yaw: 1, air: 1 } }).spawn,
    ).toBeUndefined();
  });

  it("starts the same ride again on the very map it built — the renderer's", () => {
    // With a sky and an hour asked for: laid on again they would make a new
    // map the renderer never built, and the restart would never be drawn.
    const ride = { ...freshRide(), time: "evening" as const, weather: "storm" as const };
    const opts = {
      ...freeGameOptions(ride, 9, { spec: SKIS, assist: { yaw: 1, air: 1 } }),
      quiet: true,
    };
    const first = createGame({ ...opts, level: syntheticLevel() });
    const again = createGame(freeAgainOptions(opts, first.level));
    expect(again.level).toBe(first.level);
    expect(again.level.weather?.kind).toBe("storm");
    expect(again.skier.x).toBeCloseTo(first.skier.x, 9);
    expect(again.skier.z).toBeCloseTo(first.skier.z, 9);
  });

  it("restarts at the top of the slope: on the snow, never at the spot or up a lift", () => {
    const ride = { ...freshRide(), spot: { seed: 9, x: 400, z: 700 } };
    const opts = {
      ...freeGameOptions(ride, 9, { spec: SKIS, assist: { yaw: 1, air: 1 } }),
      quiet: true,
    };
    const first = createGame({ ...opts, level: syntheticLevel() });
    const top = freeTopOptions(freeAgainOptions(opts, first.level), lastPiste(first));
    expect(top.spawn).toBeUndefined();
    expect(top.byLift).toBe(false);
    const again = createGame(top);
    expect(again.level).toBe(first.level);
    // The map's one piste: its top is the start line.
    const slot = first.level.grid[0];
    expect(again.skier.x).toBeCloseTo(slot.x, 5);
    expect(again.skier.z).toBeCloseTo(slot.z, 5);
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
  it("hangs summit-up, seen from the valley, and a point goes to the chart and back", () => {
    // The world's +z is the fall line, so it runs DOWN the chart; the
    // viewer faces up the mountain, so the world's +x is on his left.
    expect(toChart(1000, 0, 0)).toEqual([CHART_VIEW, 0]);
    expect(toChart(1000, 1000, 1000)).toEqual([0, CHART_VIEW]);
    // A heading straight down the fall line points down the chart.
    expect(degrees(chartAngle(0))).toBeCloseTo(180);
    const back = fromChart(1600, ...toChart(1600, 420, 1210));
    expect(back.x).toBeCloseTo(420);
    expect(back.z).toBeCloseTo(1210);
  });

  it("holds a point off the chart on the map", () => {
    expect(fromChart(1000, -10, 150)).toEqual({ x: 1000, z: 1000 });
  });

  it("marks every kicker and the grid of a generated map", () => {
    const level = generateLevel(38);
    const chart = seedSchematic(level);
    expect(chart.size).toBe(level.size);
    // The summit above the base, and the piste falling down the chart.
    expect(toChart(level.size, level.mountain.summit.x, level.mountain.summit.z)[1]).toBeLessThan(
      toChart(level.size, level.mountain.base.x, level.mountain.base.z)[1],
    );
    const first = level.track.points[0];
    const last = level.track.points[level.track.points.length - 1];
    expect(toChart(level.size, first.x, first.z)[1]).toBeLessThan(
      toChart(level.size, last.x, last.z)[1],
    );
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

describe("the RUN row's last stop: the helicopter (free-ride.ts)", () => {
  it("stands the ride up on the helicopter, never by lift or at a spot", () => {
    const ride = {
      ...freshRide(),
      run: { seed: 7, region: freshRide().region, id: HELI_RUN },
      spot: { seed: 7, x: 100, z: 100 },
    };
    expect(heliOn(ride, 7)).toBe(true);
    expect(heliOn(ride, 8)).toBe(false);
    const options = freeGameOptions(ride, 7, { spec: SKIS, assist: { yaw: 1, air: 1 } });
    expect(options.heli).toBe(true);
    expect(options.byLift).toBe(false);
    expect(options.spawn).toBeUndefined();
    expect(options.run).toBeUndefined();
    // Kept through a stored blob.
    expect(heliOn(mergeRide(JSON.parse(JSON.stringify(ride))), 7)).toBe(true);
  });

  it("is a link's too, and the HUD reads it while he rides", () => {
    expect(readParams("?start=free&heli=1").heli).toBe(true);
    expect(readParams("?start=free").heli).toBe(false);
    const s = createGame({
      level: syntheticLevel(),
      mode: "free",
      heli: true,
      crowd: 0,
      quiet: true,
    });
    const snap = takeSnapshot(s);
    expect(snap.heli?.kind).toBe("flown");
    for (let i = 0; i < 600; i++)
      step(s, { ...NEUTRAL_INPUT, heli: { collective: 0.95, pitch: 0, roll: 0, pedal: 0 } });
    const up = takeSnapshot(s).heli;
    expect(up?.kind === "flown" && up.height > 20).toBe(true);
  });
});
