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
  airTempAt,
  FULL_ASSIST,
  cabinsOf,
  createGame,
  lastPiste,
  freeRunOf,
  freeRuns,
  generateLevel,
  lodgesOf,
  NEUTRAL_INPUT,
  SNOW_DIAL,
  skiRoutesOf,
  slalomRules,
  snowCoverOf,
  standSkier,
  step,
  TIMES_OF_DAY,
  WEATHER_KINDS,
  hourOfTime,
  SUMMER_DAY,
} from "@engine";

import {
  AFTERSKI_RUN,
  afterskiOn,
  SEASONS,
  SNOW_STOPS,
  SUMMER_STARTS,
  seasonRide,
  depthOf,
  againAt,
  freeAgainOptions,
  freeGameOptions,
  freeRestart,
  freeRunList,
  freeTopOptions,
  freshRide,
  HELI_RUN,
  BIKE_RUN,
  heliOn,
  markedRun,
  mergeRide,
  rideKept,
  rideOnto,
  runOn,
  runPicked,
  SKIS_START,
  SLED_RUN,
  sledOn,
  spotOn,
  startPicked,
  dealtDay,
  firstWhere,
  TEMP_STOPS,
  autoTempOf,
  quickRide,
  quickTempOf,
  QUICK_SEEDS,
  QUICK_ODDS,
  type FreeRide,
  QUICK_TEMP_SPREAD,
} from "../pwa/src/game/free-ride.ts";
import {
  CHART_VIEW,
  chartAngle,
  degrees,
  fromChart,
  seedSchematic,
  toChart,
} from "../pwa/src/game/seed-chart.ts";
import { DEFAULT_FACE } from "../pwa/src/game/face-picks.ts";
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
      temp: null,
      region: "alpine",
      face: null,
      grade: null,
      run: null,
      avalanche: true,
      where: false,
    });
  });

  it("keeps a temperature only on the row's own ladder", () => {
    expect(mergeRide({ temp: -10 }).temp).toBe(-10);
    expect(mergeRide({ temp: 5 }).temp).toBe(5);
    expect(mergeRide({ temp: 7 }).temp).toBe(null);
    expect(mergeRide({ temp: "cold" }).temp).toBe(null);
    for (const c of TEMP_STOPS) expect(mergeRide({ temp: c }).temp).toBe(c);
  });

  it("stands a first visit's WHERE steps on GENERATED, once", () => {
    const ride = firstWhere(freshSettings().ride);
    expect(ride.where).toBe(true);
    expect(ride.face).toBe(null);
    // A ride an older build stood on a real range is stood on GENERATED.
    const old = mergeRide({ face: DEFAULT_FACE, region: "alpine", placed: true });
    expect(old.face).toBe(DEFAULT_FACE);
    expect(old.where).toBe(false);
    expect(firstWhere(old).face).toBe(null);
    // Placed, it is wherever the skier last left it, a real range included.
    const left = { ...ride, face: DEFAULT_FACE };
    expect(firstWhere(left)).toBe(left);
  });

  it("names the day a map was dealt in the card's own words", () => {
    const level = syntheticLevel();
    const day = dealtDay(level);
    expect(SEASONS.map((s) => s.id)).toContain(day.season);
    expect(TIMES_OF_DAY).toContain(day.time);
    expect(WEATHER_KINDS).toContain(day.weather);
    // A map dealt on a season's own date at a time's own hour reads back as them.
    const lat = level.sun.latitude;
    const doy = 20;
    const at = {
      ...level,
      sun: { ...level.sun, dayOfYear: doy, hour: hourOfTime(lat, doy, "evening") },
    };
    expect(dealtDay(at)).toMatchObject({ season: "mid", time: "evening" });
  });

  it("shows on AUTO the air the ride would get, on the day and sky picked", () => {
    const level = generateLevel(9);
    const dealt = dealtDay(level);
    const ride = freshRide();
    // The map's own day: the air at its valley floor at its start hour.
    expect(autoTempOf(ride, dealt)).toBeCloseTo(airTempAt(level), 9);
    // A deep winter's night is colder than a spring afternoon.
    const night = autoTempOf({ ...ride, season: "mid", time: "night", weather: "clear" }, dealt)!;
    const spring = autoTempOf({ ...ride, season: "spring", time: "day", weather: "clear" }, dealt)!;
    expect(night).toBeLessThan(spring - 5);
    // ...and before the chart is in it has nothing to say.
    expect(autoTempOf(ride, null)).toBe(null);
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
    const junk = mergeRide({ seed: -3, season: "autumn", time: 11, snow: "slush", spot: { x: 1 } });
    expect(junk.seed).toBeNull();
    expect(junk.season).toBeNull();
    expect(junk.time).toBeNull();
    expect(junk.snow).toBe("medium");
    expect(junk.spot).toBeNull();
    expect(mergeRide("nonsense")).toEqual(freshRide());
    expect(mergeRide({ weather: "snow" }).weather).toBe("snow");
    expect(mergeRide({ weather: "hail" }).weather).toBeNull();
    // THE GRADE (R23, R42): no row asks it any more, so a stored one —
    // an older build's — is dropped and the mountain is the seed's own.
    expect(mergeRide({ grade: "black" }).grade).toBeNull();
    expect(mergeRide({ grade: "purple" }).grade).toBeNull();
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
    // The runs, then the ski routes (R42), each by the number on its sign.
    const routes = skiRoutesOf(level);
    expect(list.runs.map((r) => r.id)).toEqual([
      ...freeRuns(level).map((r) => r.id),
      ...routes.map((r) => r.id),
    ]);
    for (const r of list.runs) {
      expect(r.vertical).toBeGreaterThan(0);
      expect(r.number).toMatch(r.grade === "orange" ? /^SR\d+$/ : /^\d+$/);
    }
    const ride = freshRide();
    for (const grade of [null, "green", "blue", "red", "black", "orange"] as const) {
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
      temp: null,
      region: "fell" as const,
      face: null,
      grade: "black" as const,
      run: { seed: 9, region: "fell" as const, id: "4" },
      suit: "rig" as const,
      avalanche: true,
      where: true,
    };
    const opts = freeGameOptions(ride, 9, { spec: SKIS, assist: { yaw: 1, air: 1 } });
    expect(opts.mode).toBe("free");
    // A grade asked of the map (only a link's `?grade=` asks one now, R23),
    // and the seed's own where none is.
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
    // The TEMPERATURE row lays the air's knob over the sky — the dealt one
    // too — and never in summer.
    expect(
      freeGameOptions({ ...ride, temp: -10 }, 9, { spec: SKIS, assist: { yaw: 1, air: 1 } }).sky,
    ).toEqual({
      weather: "fog",
      temp: -10,
    });
    expect(
      freeGameOptions({ ...ride, weather: null, temp: 5 }, 9, {
        spec: SKIS,
        assist: { yaw: 1, air: 1 },
      }).sky,
    ).toEqual({ temp: 5 });
    expect(
      freeGameOptions({ ...ride, weather: null, temp: 5, season: "summer" }, 9, {
        spec: SKIS,
        assist: { yaw: 1, air: 1 },
      }).sky,
    ).toBe(undefined);
    const cold = createGame({
      ...freeGameOptions({ ...ride, temp: -15 }, 9, { spec: SKIS, assist: { yaw: 1, air: 1 } }),
      level: syntheticLevel(),
      quiet: true,
    });
    expect(airTempAt(cold.level)).toBeCloseTo(-15, 9);
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

  it("keeps the mountain being ridden for another run picked on it — nothing built again", () => {
    const opts = {
      ...freeGameOptions(freshRide(), 9, { spec: SKIS, assist: { yaw: 1, air: 1 } }),
      quiet: true,
    };
    const first = createGame({ ...opts, level: syntheticLevel() });
    const ridden = { ask: "alpine:dealt:9", level: first.level };
    expect(rideKept(ridden, first.level, "alpine:dealt:9")).toBe(first.level);
    // Another mountain, another map standing, or no ride yet: built afresh.
    expect(rideKept(ridden, first.level, "alpine:dealt:10")).toBeUndefined();
    expect(rideKept(ridden, syntheticLevel(), "alpine:dealt:9")).toBeUndefined();
    expect(rideKept(null, first.level, "alpine:dealt:9")).toBeUndefined();
    // The pause card's PISTE MAP: a spot picked elsewhere on the same map.
    const moved = { ...freshRide(), spot: { seed: 9, x: 400, z: 700 } };
    const next = freeGameOptions(moved, 9, { spec: SKIS, assist: { yaw: 1, air: 1 } });
    const there = createGame({ ...freeAgainOptions(next, first.level), quiet: true });
    expect(there.level).toBe(first.level);
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

  it("restarts a ride on the machine it was last chosen on, however he came off it", () => {
    const ride = { ...freshRide(), run: { seed: 9, region: freshRide().region, id: SLED_RUN } };
    const opts = {
      ...freeGameOptions(ride, 9, { spec: SKIS, assist: { yaw: 1, air: 1 } }),
      quiet: true,
    };
    expect(opts.sled).toBe(true);
    const first = createGame({ ...opts, level: syntheticLevel() });
    const free = freeAgainOptions(opts, first.level);
    // Still on the snowmobile: the restart is the snowmobile's.
    expect(first.sled?.rider).toBe(true);
    expect(freeRestart(first, free)?.sled).toBe(true);
    // Stepped off it and out on his skis: still the snowmobile's.
    if (first.sled) first.sled.rider = false;
    const again = createGame(freeRestart(first, free)!);
    expect(again.sled?.rider).toBe(true);
    // Thrown off it, the same.
    first.skier.thrown = { cause: "slam" } as never;
    expect(freeRestart(first, free)?.sled).toBe(true);
    // A ride on skis from the start starts again at the top of its slope.
    const skied = freeAgainOptions({ ...opts, sled: undefined }, first.level);
    const top = freeRestart(createGame(skied), skied);
    expect(top?.sled).toBeUndefined();
    expect(againAt(first.rules, top)).toBe("top");
  });

  it("restarts the helicopter picked on the pause card's piste map after he falls off its skid", () => {
    const skis = freeGameOptions(freshRide(), 9, { spec: SKIS, assist: { yaw: 1, air: 1 } });
    const first = createGame({ ...skis, quiet: true, level: syntheticLevel() });
    // The PISTE MAP's GO stands a new ride up on the helicopter: that is the
    // ride the restart keeps.
    const heli = freeAgainOptions(
      { ...skis, heli: true, run: undefined, byLift: false },
      first.level,
    );
    const flown = createGame({ ...heli, quiet: true });
    expect(flown.heli?.rider).toBe(true);
    // Lost his grip on the skid and down on the snow.
    if (flown.heli) flown.heli.rider = false;
    flown.skier.thrown = { cause: "grip" } as never;
    const next = freeRestart(flown, heli);
    expect(next?.heli).toBe(true);
    expect(againAt(flown.rules, next)).toBe("pad");
    expect(createGame(next!).heli?.rider).toBe(true);
  });

  it("names where the next rider stands after a death, as the restart stands him", () => {
    const opts = {
      ...freeGameOptions(freshRide(), 9, { spec: SKIS, assist: { yaw: 1, air: 1 } }),
      quiet: true,
    };
    const first = createGame({ ...opts, level: syntheticLevel() });
    const free = freeAgainOptions(opts, first.level);
    const rules = first.rules;
    // The last piste skied: its head (here the start line, the one piste's top).
    expect(againAt(rules, freeRestart(first, free))).toBe("top");
    expect(againAt(rules, { ...free, run: undefined })).toBe("start");
    expect(againAt(rules, { ...free, run: "r1" })).toBe("top");
    expect(againAt({ ...rules, heli: true }, { ...free, heli: true })).toBe("pad");
    expect(againAt({ ...rules, sled: true }, { ...free, sled: true })).toBe("sled");
    expect(againAt(rules, { ...free, para: true })).toBe("summit");
    expect(againAt(rules, { ...free, balloon: true })).toBe("basket");
    expect(againAt(rules, { ...free, summer: true, bike: true })).toBe("trail");
    // A race starts again at its start, whatever the free ride was.
    expect(againAt(slalomRules(1), free)).toBe("start");
    expect(freeRestart({ ...first, rules: slalomRules(1) }, free)).toBeNull();
    for (const at of ["start", "top", "pad", "sled", "summit", "basket"] as const) {
      expect(STRINGS.diedAgain[at]).toMatch(/^A NEW RIDER /);
    }
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
  });

  it("stands a summer ride up on the bike, in midsummer", () => {
    const ride = { ...freshRide(), season: "summer" as const };
    // A slope picked (or none) is no summer start: the downhill bike.
    const on = (id: string) => ({
      ...ride,
      run: { seed: 9, region: ride.region, face: ride.face, id },
    });
    const stood = seasonRide(on("4"), 9);
    expect(runOn(stood, 9)).toBe(BIKE_RUN);
    expect(SUMMER_STARTS[0]).toBe(BIKE_RUN);
    // The bike or an aircraft picked is kept.
    for (const id of SUMMER_STARTS) {
      expect(runOn(seasonRide(on(id), 9), 9)).toBe(id);
    }
    const opts = freeGameOptions(ride, 9, { spec: SKIS, assist: { yaw: 1, air: 1 } });
    expect(opts.summer).toBe(true);
    expect(opts.bike).toBe(true);
    expect(opts.heli).toBeFalsy();
    expect(opts.avalanche).toBeFalsy();
    // The spot tapped on the chart goes with it: the trail head nearest it.
    const tapped = { ...ride, spot: { seed: 9, x: 120, z: -40 } };
    const there = freeGameOptions(tapped, 9, { spec: SKIS, assist: { yaw: 1, air: 1 } });
    expect(there.spawn).toEqual({ x: 120, z: -40 });
    expect(there.byLift).toBeFalsy();
    // An aircraft picked in summer flies, and no bike is asked.
    const flown = freeGameOptions(on(HELI_RUN), 9, { spec: SKIS, assist: { yaw: 1, air: 1 } });
    expect(flown.heli).toBe(true);
    expect(flown.bike).toBeFalsy();
    // In winter there is no bike, whatever the ride kept.
    expect(
      freeGameOptions({ ...on(BIKE_RUN), season: null }, 9, {
        spec: SKIS,
        assist: { yaw: 1, air: 1 },
      }).bike,
    ).toBeFalsy();
    expect(opts.day?.dayOfYear).toBe(SUMMER_DAY);
    // A winter ride asks no summer of the engine.
    expect(
      "summer" in freeGameOptions(freshRide(), 9, { spec: SKIS, assist: { yaw: 1, air: 1 } }),
    ).toBe(false);
  });

  it("puts the seasons in winter's order, December to April, then summer", () => {
    const winter = SEASONS.filter((s) => s.id !== "summer").map((s) => s.day);
    expect(winter).toEqual([...winter].sort((a, b) => a - b));
    expect(winter[0]).toBeLessThan(0);
    expect(winter[winter.length - 1]).toBeLessThanOrEqual(105);
    // The last stop is midsummer, the summer ground's own day.
    expect(SEASONS[SEASONS.length - 1]).toEqual({ id: "summer", day: SUMMER_DAY });
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

  it("marks every house of a generated map where it stands", () => {
    const level = generateLevel(38);
    const houses = cabinsOf(level);
    expect(houses.length).toBeGreaterThan(0);
    const chart = seedSchematic(level, houses);
    expect(chart.houses).toHaveLength(houses.length);
    for (const [n, h] of chart.houses.entries()) {
      expect(h.kind).toBe(houses[n].kind);
      expect([h.x, h.y]).toEqual(toChart(level.size, houses[n].x, houses[n].z));
    }
    // A map handed no houses draws none.
    expect(seedSchematic(level).houses).toEqual([]);
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
    // Where he stands, to the metre, for the chip beside the seed.
    expect(snap.at).toEqual({ x: Math.round(state.skier.x), z: Math.round(state.skier.z) });
  });

  it("a race still reads its course", () => {
    const state = createGame({ level: syntheticLevel(), rivals: 0, quiet: true });
    const snap = takeSnapshot(state);
    expect(snap.free).toBe(false);
    expect(snap.minimap.checkpoints.length).toBe(state.level.checkpoints.length);
  });
});

describe("the START row and the RUN row (free-ride.ts)", () => {
  const region = freshRide().region;

  it("puts a machine on the START row, kept as a run id of its map", () => {
    const ride = { ...freshRide(), run: { seed: 7, region, id: "3" } };
    const onHeli = { ...ride, ...startPicked(ride, 7, HELI_RUN) };
    expect(heliOn(onHeli, 7)).toBe(true);
    expect(runOn(onHeli, 7)).toBe(HELI_RUN);
  });

  it("hands the ride back to the map's own run on the SLOPE", () => {
    const onHeli = { ...freshRide(), run: { seed: 7, region, id: HELI_RUN } };
    const onSkis = { ...onHeli, ...startPicked(onHeli, 7, SKIS_START) };
    expect(heliOn(onSkis, 7)).toBe(false);
    expect(runOn(onSkis, 7)).toBeNull();
  });

  it("skis any run picked, off a machine and whatever its colour", () => {
    const onSled = { ...freshRide(), run: { seed: 7, region, id: SLED_RUN } };
    const picked = { ...onSled, ...runPicked(onSled, 7, "5") };
    expect(sledOn(picked, 7)).toBe(false);
    expect(runOn(picked, 7)).toBe("5");
    expect(picked.spot).toBeNull();
    expect(freeGameOptions(picked, 7, { spec: SKIS, assist: { yaw: 1, air: 1 } }).run).toBe("5");
  });
});

describe("the START row's helicopter (free-ride.ts)", () => {
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

describe("the START row's other machine: the snowmobile (free-ride.ts)", () => {
  it("stands the ride up on the snowmobile, never by lift or at a spot", () => {
    const ride = {
      ...freshRide(),
      run: { seed: 7, region: freshRide().region, id: SLED_RUN },
      spot: { seed: 7, x: 100, z: 100 },
    };
    expect(sledOn(ride, 7)).toBe(true);
    expect(sledOn(ride, 8)).toBe(false);
    expect(heliOn(ride, 7)).toBe(false);
    const options = freeGameOptions(ride, 7, { spec: SKIS, assist: { yaw: 1, air: 1 } });
    expect(options.sled).toBe(true);
    expect(options.heli).toBe(false);
    expect(options.byLift).toBe(false);
    expect(options.spawn).toBeUndefined();
    expect(options.run).toBeUndefined();
    expect(sledOn(mergeRide(JSON.parse(JSON.stringify(ride))), 7)).toBe(true);
  });

  it("is a link's too, and the HUD reads its engine while he rides", () => {
    expect(readParams("?start=free&sled=1").sled).toBe(true);
    expect(readParams("?start=free").sled).toBe(false);
    const s = createGame({
      level: syntheticLevel(),
      mode: "free",
      sled: true,
      crowd: 0,
      quiet: true,
    });
    expect(takeSnapshot(s).sled?.kind).toBe("ridden");
    for (let i = 0; i < 240; i++) step(s, { ...NEUTRAL_INPUT, tuck: 1 });
    const going = takeSnapshot(s).sled;
    expect(going?.kind === "ridden" && going.rev > 0.5).toBe(true);
    // Off it, it calls him back while he is near.
    step(s, { ...NEUTRAL_INPUT, machine: true });
    for (let i = 0; i < 120; i++) step(s, { ...NEUTRAL_INPUT, brake: 1 });
    expect(takeSnapshot(s).sled?.kind).toBe("waiting");
  });

  it("offers the machine key only to a skier stood beside it", () => {
    const s = createGame({ level: syntheticLevel(), mode: "free", crowd: 0, quiet: true });
    const k = s.sled!;
    standSkier(s, k.x + 20, k.z, k.heading);
    step(s, NEUTRAL_INPUT);
    expect(takeSnapshot(s).sled).toMatchObject({ kind: "waiting", near: false });
    standSkier(s, k.x + 1.6, k.z, k.heading);
    step(s, NEUTRAL_INPUT);
    expect(takeSnapshot(s).sled).toMatchObject({ kind: "waiting", near: true });
  });
});

describe("the START row's afterski stop: the party in the lodge (free-ride.ts)", () => {
  it("stands the ride up inside the lodge, never at a spot or on a machine", () => {
    const ride = {
      ...freshRide(),
      run: { seed: 7, region: freshRide().region, id: AFTERSKI_RUN },
      spot: { seed: 7, x: 100, z: 100 },
    };
    expect(afterskiOn(ride, 7)).toBe(true);
    expect(afterskiOn(ride, 8)).toBe(false);
    const options = freeGameOptions(ride, 7, { spec: SKIS, assist: { yaw: 1, air: 1 } });
    expect(options.inLodge).toBe(true);
    expect(options.heli || options.sled || options.para).toBe(false);
    expect(options.spawn).toBeUndefined();
    expect(options.run).toBeUndefined();
    expect(afterskiOn(mergeRide(JSON.parse(JSON.stringify(ride))), 7)).toBe(true);
    // Started again, it is stood on the snow at the top of the slope.
    expect(freeTopOptions(options, undefined).inLodge).toBe(false);
  });

  it("begins at the party, and he heads out with the buzz he drank", () => {
    const level = generateLevel(7);
    expect(lodgesOf(level).length).toBeGreaterThan(0);
    const s = createGame({ level, mode: "free", inLodge: true, crowd: 0, quiet: true });
    expect(s.afterski?.inside).toBe(lodgesOf(level)[0].id);
    for (let i = 0; i < 120 * 30 && (s.afterski?.beers ?? 0) < 2; i++) step(s, NEUTRAL_INPUT);
    expect(s.afterski?.beers).toBeGreaterThanOrEqual(2);
    const buzz = s.skier.buzz ?? 0;
    expect(buzz).toBeGreaterThan(0);
    step(s, { ...NEUTRAL_INPUT, machine: true });
    expect(s.afterski?.inside).toBeNull();
    expect(s.skier.buzz).toBeCloseTo(buzz, 6);
  });

  it("moves the stored ride onto the paused ride's map for the pause card's PISTE MAP", () => {
    const ride = {
      ...mergeRide({}),
      seed: 7,
      snow: "deep" as const,
      run: { seed: 7, region: "alpine" as const, id: "3" },
      spot: { seed: 7, x: 1, z: 2 },
    };
    // Already there: the very ride, its run and spot kept.
    expect(rideOnto(ride, 7, "alpine")).toBe(ride);
    // Another map or country: the day and the snow carried over, the run
    // and the spot left to that map.
    for (const moved of [rideOnto(ride, 38, "alpine"), rideOnto(ride, 7, "fell")]) {
      expect(moved.snow).toBe("deep");
      expect(moved.run).toBeNull();
      expect(moved.spot).toBeNull();
    }
    expect(rideOnto(ride, 38, "fell")).toMatchObject({ seed: 38, region: "fell" });
  });
});

describe("QUICK START (free-ride.ts)", () => {
  it("deals a generated mountain, a winter day, a sky and a snow, on the toughest piste", () => {
    const base = {
      ...freshRide(),
      face: "alpine-1",
      run: { seed: 5, region: "alpine" as const, id: "r1" },
      spot: { seed: 5, x: 1, z: 2 },
      avalanche: false,
    };
    const seasons = new Set<string>();
    let k = 0;
    // A fixed stream walks every pick's whole range.
    const random = () => (k = (k * 7919 + 104729) % 1000003) / 1000003;
    for (let i = 0; i < 400; i++) {
      const ride = quickRide(base, random);
      expect(ride.face).toBeNull();
      expect(ride.run).toBeNull();
      expect(ride.spot).toBeNull();
      expect(ride.grade).toBeNull();
      expect(ride.season).not.toBe("summer");
      expect(ride.season).not.toBeNull();
      expect(TIMES_OF_DAY).toContain(ride.time);
      expect(WEATHER_KINDS).toContain(ride.weather);
      expect(ride.seed).toBeGreaterThanOrEqual(1);
      expect(ride.seed).toBeLessThanOrEqual(QUICK_SEEDS);
      expect(ride.avalanche).toBe(false);
      expect(TEMP_STOPS).toContain(ride.temp);
      seasons.add(ride.season!);
    }
    expect(seasons.size).toBe(4);
  });

  it("leans toward the sunset, the clear night and the steep countries", () => {
    let k = 0;
    const random = () => (k = (k * 7919 + 104729) % 1000003) / 1000003;
    const count = (pick: (r: FreeRide) => unknown, want: unknown, n = 2000): number => {
      k = 1;
      let hit = 0;
      for (let i = 0; i < n; i++) if (pick(quickRide(freshRide(), random)) === want) hit++;
      return hit / n;
    };
    expect(count((r) => r.time, "sunset")).toBeGreaterThan(count((r) => r.time, "day") * 2);
    expect(count((r) => r.region, "fell")).toBeLessThan(count((r) => r.region, "alpine") / 2);
    expect(count((r) => r.weather, "storm")).toBeLessThan(0.05);
    // No fog, overcast or storm after dark: a night is clear or near it.
    k = 1;
    for (let i = 0; i < 2000; i++) {
      const ride = quickRide(freshRide(), random);
      if (ride.time === "night") expect(Object.keys(QUICK_ODDS.night)).toContain(ride.weather);
    }
  });

  it("rolls an air that fits the season, the hour and the sky", () => {
    const mid = { region: "alpine", season: "mid", time: "morning", weather: "clear" } as const;
    const spring = { region: "alpine", season: "spring", time: "day", weather: "fair" } as const;
    // The same stray: the spring afternoon is the warmer.
    expect(quickTempOf(spring, () => 0.5)).toBeGreaterThan(quickTempOf(mid, () => 0.5));
    // Strayed at most the spread (and half a stop's snap) off the AUTO air.
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const lo = quickTempOf(mid, () => 0);
      const hi = quickTempOf(mid, () => 0.999);
      expect(quickTempOf(mid, () => r)).toBeGreaterThanOrEqual(lo);
      expect(quickTempOf(mid, () => r)).toBeLessThanOrEqual(hi);
      expect(hi - lo).toBeLessThanOrEqual(2 * QUICK_TEMP_SPREAD + 5);
    }
  });

  it("stands up as a free ride carried up to the map's toughest piste", () => {
    const ride = quickRide(freshRide(), () => 0.5);
    const o = freeGameOptions(ride, ride.seed!, { spec: SKIS, assist: FULL_ASSIST });
    expect(o.mode).toBe("free");
    expect(o.run).toBeUndefined();
    expect(o.byLift).toBe(true);
    expect(o.summer).toBeUndefined();
    expect(o.face).toBeUndefined();
  });
});
